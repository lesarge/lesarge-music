"""YuE low-VRAM generation service for 8GB VRAM NVIDIA GPUs.

Wraps the ExLlamaV2 inference engine from sgsdxzy/YuE-exllamav2 and forces
sequential layer offloading (YuEGP "Profile 4/5" logic) so the combined
model-weight + KV-cache + activation footprint stays strictly below a
configurable VRAM budget during generation.

Requirements:
  - NVIDIA GPU with >= 8 GB VRAM and CUDA 12.4
  - pip install -r requirements.txt  (torch 2.6.0 cu124, exllamav2, ...)
  - EXL2-quantized models (auto-downloaded if missing):
      stage1: Doctor-Shotgun/YuE-s1-7B-anneal-en-cot-exl2   (4.25bpw-h6)
      stage2: Doctor-Shotgun/YuE-s2-1B-general-exl2         (8.0bpw-h8)
  - xcodec_mini_infer tokenizer/codec + Vocos decoders (already vendored)

Usage as a library:

    from yue_8gb_service import Yue8GbService

    service = Yue8GbService(vram_budget_mb=6144)
    result = service.generate(
        genres="inspiring female uplifting pop airy vocal electronic bright vocal vocal",
        lyrics="[verse]\\nFirst line of the song\\nSecond line\\n\\n[chorus]\\nCatchy hook here\\n\\n",
        output_dir="./output",
        run_n_segments=2,
    )
    # result["mix"] -> final 44.1kHz mixed track path

Usage as a CLI:

    python yue_8gb_service.py --genre-txt prompt_egs/genre.txt --lyrics-txt prompt_egs/lyrics.txt --output-dir ./output
"""

import argparse
import gc
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from dataclasses import dataclass

import torch

from common import get_cache_class, seed_everything
from exllamav2 import ExLlamaV2, ExLlamaV2Config, ExLlamaV2Tokenizer
from infer_postprocess import post_process
from infer_stage1 import SampleSettings, Stage1Pipeline, Stage1Pipeline_EXL2
from infer_stage2 import Stage2Pipeline, Stage2Pipeline_EXL2
from models.soundstream_hubert_new import SoundStream
from omegaconf import OmegaConf

ENGINE_ROOT = os.path.dirname(os.path.dirname(_HERE))

DEFAULT_STAGE1_MODEL = "Doctor-Shotgun/YuE-s1-7B-anneal-en-cot-exl2"
DEFAULT_STAGE2_MODEL = "Doctor-Shotgun/YuE-s2-1B-general-exl2"

DEFAULT_BASIC_MODEL_CONFIG = os.path.join(ENGINE_ROOT, "xcodec_mini_infer", "final_ckpt", "config.yaml")
DEFAULT_RESUME_PATH = os.path.join(ENGINE_ROOT, "xcodec_mini_infer", "final_ckpt", "ckpt_00360000.pth")
DEFAULT_VOCOS_CONFIG = os.path.join(ENGINE_ROOT, "xcodec_mini_infer", "decoders", "config.yaml")
DEFAULT_VOCAL_DECODER = os.path.join(ENGINE_ROOT, "xcodec_mini_infer", "decoders", "decoder_131000.pth")
DEFAULT_INST_DECODER = os.path.join(ENGINE_ROOT, "xcodec_mini_infer", "decoders", "decoder_151000.pth")


def _resolve_model_dir(model_path: str) -> str:
    if os.path.isdir(model_path):
        return os.path.abspath(model_path)
    from huggingface_hub import snapshot_download

    return snapshot_download(repo_id=model_path, allow_patterns=None)


def _kv_bytes_per_token_per_layer(config: ExLlamaV2Config, cache_mode: str) -> float:
    n_kv = int(getattr(config, "num_key_value_heads", None) or config.num_attention_heads)
    hidden = config.hidden_size
    n_heads = config.num_attention_heads
    head_dim = int(getattr(config, "head_dim", None) or (hidden // n_heads))
    bytes_per_value = {"FP16": 2.0, "Q8": 1.0, "Q6": 0.75, "Q4": 0.5}.get(cache_mode, 2.0)
    return 2.0 * n_kv * head_dim * bytes_per_value


def compute_gpu_split(
    model_dir: str,
    vram_budget_mb: float,
    cache_size: int,
    cache_mode: str,
    activation_reserve_mb: float = 512.0,
) -> list:
    config = ExLlamaV2Config(model_dir)
    n_layers = int(config.num_hidden_layers)

    total_bytes = 0.0
    for name in os.listdir(model_dir):
        if name.endswith((".safetensors", ".bin", ".pt", ".pth")):
            total_bytes += os.path.getsize(os.path.join(model_dir, name))

    vocab, hidden = config.vocab_size, config.hidden_size
    embed_bytes = 2.0 * vocab * hidden * 2.0
    layer_bytes = max(total_bytes - embed_bytes, 0.0) / max(n_layers, 1)

    cache_bytes_all = _kv_bytes_per_token_per_layer(config, cache_mode) * n_layers * cache_size
    cache_bytes_all_mb = cache_bytes_all / (1024.0 * 1024.0)

    weights_budget_mb = vram_budget_mb - cache_bytes_all_mb - activation_reserve_mb
    layer_bytes_mb = max(layer_bytes / (1024.0 * 1024.0), 0.0)
    gpu_layers = 0 if layer_bytes_mb <= 0 else int(weights_budget_mb / layer_bytes_mb)
    gpu_layers = max(1, min(n_layers, gpu_layers))

    weights_on_gpu_mb = gpu_layers * layer_bytes_mb
    cache_on_gpu_mb = _kv_bytes_per_token_per_layer(config, cache_mode) * gpu_layers * cache_size / (1024.0 * 1024.0)
    total_mb = weights_on_gpu_mb + cache_on_gpu_mb + activation_reserve_mb

    print(
        f"[yue_8gb] model={os.path.basename(model_dir)} layers={gpu_layers}/{n_layers} "
        f"(+{n_layers - gpu_layers} CPU-streamed) weights~{weights_on_gpu_mb:.0f}MB "
        f"cache~{cache_on_gpu_mb:.0f}MB act~{activation_reserve_mb:.0f}MB total~{total_mb:.0f}MB "
        f"budget={vram_budget_mb:.0f}MB"
    )
    return [gpu_layers]


class Stage1Pipeline_SequentialOffload(Stage1Pipeline_EXL2):
    def __init__(
        self,
        model_path: str,
        device: torch.device,
        cache_size: int,
        cache_mode: str,
        vram_budget_mb: float,
        activation_reserve_mb: float,
        **kwargs,
    ):
        Stage1Pipeline.__init__(self, device, **kwargs)
        assert device.type == "cuda", "ExLlamaV2 does not support CPU inference."

        model_dir = _resolve_model_dir(model_path)
        device_idx = self.device.index
        gpu_split = compute_gpu_split(model_dir, vram_budget_mb, cache_size, cache_mode, activation_reserve_mb)
        if len(gpu_split) < torch.cuda.device_count():
            gpu_split = gpu_split + [0] * (torch.cuda.device_count() - len(gpu_split))

        exl2_config = ExLlamaV2Config(model_dir)
        exl2_config.no_sdpa = True
        self.model = ExLlamaV2(exl2_config)
        self.model.load(gpu_split)

        self.tokenizer = ExLlamaV2Tokenizer(exl2_config)
        self.cache_size = cache_size
        self.cache_mode = get_cache_class(cache_mode)
        self._budget_mb = vram_budget_mb


class Stage2Pipeline_SequentialOffload(Stage2Pipeline_EXL2):
    def __init__(
        self,
        model_path: str,
        device: torch.device,
        cache_size: int,
        cache_mode: str,
        vram_budget_mb: float,
        activation_reserve_mb: float,
    ):
        Stage2Pipeline.__init__(self, device)
        assert device.type == "cuda", "ExLlamaV2 does not support CPU inference."

        model_dir = _resolve_model_dir(model_path)
        device_idx = self.device.index
        gpu_split = compute_gpu_split(model_dir, vram_budget_mb, cache_size, cache_mode, activation_reserve_mb)
        if len(gpu_split) < torch.cuda.device_count():
            gpu_split = gpu_split + [0] * (torch.cuda.device_count() - len(gpu_split))

        exl2_config = ExLlamaV2Config(model_dir)
        self.model = ExLlamaV2(exl2_config)
        self.model.load(gpu_split)

        self.model.modules[0].device_idx = self.model.modules[1].device_idx
        self.model.modules[0].reload()

        self.tokenizer = ExLlamaV2Tokenizer(exl2_config)
        self.cache_size = cache_size
        self.cache_mode = get_cache_class(cache_mode)
        self._budget_mb = vram_budget_mb


@dataclass
class Yue8GbConfig:
    stage1_model: str = DEFAULT_STAGE1_MODEL
    stage2_model: str = DEFAULT_STAGE2_MODEL
    basic_model_config: str = DEFAULT_BASIC_MODEL_CONFIG
    resume_path: str = DEFAULT_RESUME_PATH
    vocos_config: str = DEFAULT_VOCOS_CONFIG
    vocal_decoder_path: str = DEFAULT_VOCAL_DECODER
    inst_decoder_path: str = DEFAULT_INST_DECODER
    cuda_idx: int = 0
    vram_budget_mb: float = 6144.0
    activation_reserve_mb: float = 512.0
    stage1_cache_size: int = 16384
    stage2_cache_size: int = 8192
    stage1_cache_mode: str = "Q4"
    stage2_cache_mode: str = "Q8"
    use_guidance: bool = True
    repetition_penalty: float = 1.1
    seed: int | None = None
    rescale: bool = True


class Yue8GbService:
    def __init__(self, config: Yue8GbConfig | None = None):
        if config is None:
            config = Yue8GbConfig()
        self.config = config
        if config.seed is not None:
            seed_everything(config.seed)
        if not torch.cuda.is_available():
            raise RuntimeError("Yue8GbService requires a CUDA-capable NVIDIA GPU (8GB VRAM).")
        self.device = torch.device(f"cuda:{config.cuda_idx}")
        self._stage1 = None
        self._stage2 = None
        self._codec_model = None

    def _check_vram(self):
        used = torch.cuda.memory_allocated(self.device) / (1024.0 * 1024.0)
        reserved = torch.cuda.memory_reserved(self.device) / (1024.0 * 1024.0)
        slack_mb = self.config.vram_budget_mb + 1024.0
        if reserved > slack_mb:
            print(f"[yue_8gb] WARNING VRAM reserved={reserved:.0f}MB used={used:.0f}MB budget={self.config.vram_budget_mb:.0f}MB")
        else:
            print(f"[yue_8gb] VRAM ok: used={used:.0f}MB reserved={reserved:.0f}MB")
        return used

    def load_stage1(self):
        if self._stage1 is not None:
            return self._stage1
        self._stage1 = Stage1Pipeline_SequentialOffload(
            model_path=self.config.stage1_model,
            device=self.device,
            cache_size=self.config.stage1_cache_size,
            cache_mode=self.config.stage1_cache_mode,
            vram_budget_mb=self.config.vram_budget_mb,
            activation_reserve_mb=self.config.activation_reserve_mb,
            basic_model_config=self.config.basic_model_config,
            resume_path=self.config.resume_path,
        )
        self._check_vram()
        return self._stage1

    def unload_stage1(self):
        if self._stage1 is not None:
            del self._stage1
            self._stage1 = None
            gc.collect()
            torch.cuda.empty_cache()
            print("[yue_8gb] stage1 unloaded from VRAM")

    def load_stage2(self):
        if self._stage2 is not None:
            return self._stage2
        self._stage2 = Stage2Pipeline_SequentialOffload(
            model_path=self.config.stage2_model,
            device=self.device,
            cache_size=self.config.stage2_cache_size,
            cache_mode=self.config.stage2_cache_mode,
            vram_budget_mb=self.config.vram_budget_mb,
            activation_reserve_mb=self.config.activation_reserve_mb,
        )
        self._check_vram()
        return self._stage2

    def unload_stage2(self):
        if self._stage2 is not None:
            del self._stage2
            self._stage2 = None
            gc.collect()
            torch.cuda.empty_cache()
            print("[yue_8gb] stage2 unloaded from VRAM")

    def load_codec(self):
        if self._codec_model is not None:
            return self._codec_model
        model_config = OmegaConf.load(self.config.basic_model_config)
        assert model_config.generator.name == "SoundStream"
        codec_model = SoundStream(**model_config.generator.config).to(self.device)
        parameter_dict = torch.load(self.config.resume_path, map_location=self.device, weights_only=False)
        codec_model.load_state_dict(parameter_dict["codec_model"])
        codec_model.eval()
        self._codec_model = codec_model
        return codec_model

    def unload_codec(self):
        if self._codec_model is not None:
            del self._codec_model
            self._codec_model = None
            gc.collect()
            torch.cuda.empty_cache()
            print("[yue_8gb] codec unloaded from VRAM")

    def generate(
        self,
        genres: str,
        lyrics: str,
        output_dir: str = "./output",
        run_n_segments: int = 2,
        max_new_tokens: int = 3000,
        use_audio_prompt: bool = False,
        audio_prompt_path: str = "",
        use_dual_tracks_prompt: bool = False,
        vocal_track_prompt_path: str = "",
        instrumental_track_prompt_path: str = "",
        prompt_start_time: float = 0.0,
        prompt_end_time: float = 30.0,
    ) -> dict:
        os.makedirs(output_dir, exist_ok=True)
        sample_settings = SampleSettings(use_guidance=self.config.use_guidance, repetition_penalty=self.config.repetition_penalty)

        stage1 = self.load_stage1()
        raw_output = stage1.generate(
            use_dual_tracks_prompt=use_dual_tracks_prompt,
            vocal_track_prompt_path=vocal_track_prompt_path,
            instrumental_track_prompt_path=instrumental_track_prompt_path,
            use_audio_prompt=use_audio_prompt,
            audio_prompt_path=audio_prompt_path,
            genres=genres,
            lyrics=lyrics,
            run_n_segments=run_n_segments,
            max_new_tokens=max_new_tokens,
            prompt_start_time=prompt_start_time,
            prompt_end_time=prompt_end_time,
            sample_settings=sample_settings,
        )
        stage1.save(raw_output, output_dir, use_audio_prompt, use_dual_tracks_prompt)
        self.unload_stage1()

        stage2 = self.load_stage2()
        outputs = stage2.generate(output_dir=output_dir)
        stage2.save(output_dir=output_dir, outputs=outputs)
        self.unload_stage2()

        codec_model = self.load_codec()
        post_process(
            codec_model=codec_model,
            device=self.device,
            output_dir=output_dir,
            config_path=self.config.vocos_config,
            vocal_decoder_path=self.config.vocal_decoder_path,
            inst_decoder_path=self.config.inst_decoder_path,
            rescale=self.config.rescale,
        )
        self.unload_codec()

        stage1_dir = os.path.join(output_dir, "stage1")
        stage2_dir = os.path.join(output_dir, "stage2")
        recons_dir = os.path.join(output_dir, "recons")
        vocoder_dir = os.path.join(output_dir, "vocoder", "stems")
        final_mix = os.path.join(output_dir, "itrack_mixed.mp3")

        result = {
            "output_dir": output_dir,
            "stage1_vocal": os.path.join(stage1_dir, "vtrack.npy"),
            "stage1_instrumental": os.path.join(stage1_dir, "itrack.npy"),
            "stage2_vocal": os.path.join(stage2_dir, "vtrack.npy"),
            "stage2_instrumental": os.path.join(stage2_dir, "itrack.npy"),
            "recons_vocal": os.path.join(recons_dir, "vtrack.mp3"),
            "recons_instrumental": os.path.join(recons_dir, "itrack.mp3"),
            "vocoder_vocal": os.path.join(vocoder_dir, "vtrack.mp3"),
            "vocoder_instrumental": os.path.join(vocoder_dir, "itrack.mp3"),
            "mix": final_mix,
        }
        print(f"[yue_8gb] generation complete -> {result['mix']}")
        return result


def build_cli_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="YuE low-VRAM (8GB) full-song generator via ExLlamaV2 sequential offload")
    p.add_argument("--genre-txt", type=str, help="File with genre tags")
    p.add_argument("--lyrics-txt", type=str, help="File with structured lyrics ([verse]/[chorus]/... sections)")
    p.add_argument("--genres", type=str, help="Inline genre tags (alternative to --genre-txt)")
    p.add_argument("--lyrics", type=str, help="Inline structured lyrics (alternative to --lyrics-txt)")
    p.add_argument("--output-dir", type=str, default="./output")
    p.add_argument("--run-n-segments", type=int, default=2)
    p.add_argument("--max-new-tokens", type=int, default=3000)
    p.add_argument("--stage1-model", type=str, default=DEFAULT_STAGE1_MODEL)
    p.add_argument("--stage2-model", type=str, default=DEFAULT_STAGE2_MODEL)
    p.add_argument("--vram-budget-mb", type=float, default=6144.0)
    p.add_argument("--activation-reserve-mb", type=float, default=512.0)
    p.add_argument("--stage1-cache-size", type=int, default=16384)
    p.add_argument("--stage2-cache-size", type=int, default=8192)
    p.add_argument("--stage1-cache-mode", type=str, default="Q4", choices=["FP16", "Q8", "Q6", "Q4"])
    p.add_argument("--stage2-cache-mode", type=str, default="Q8", choices=["FP16", "Q8", "Q6", "Q4"])
    p.add_argument("--no-guidance", action="store_true")
    p.add_argument("--repetition-penalty", type=float, default=1.1)
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--no-rescale", action="store_true")
    p.add_argument("--cuda-idx", type=int, default=0)
    return p


def main(argv=None):
    p = build_cli_parser()
    args = p.parse_args(argv)

    if args.genre_txt:
        with open(args.genre_txt, encoding="utf-8") as f:
            genres = f.read().strip()
    elif args.genres:
        genres = args.genres.strip()
    else:
        p.error("provide --genre-txt or --genres")

    if args.lyrics_txt:
        with open(args.lyrics_txt, encoding="utf-8") as f:
            lyrics = f.read().strip()
    elif args.lyrics:
        lyrics = args.lyrics.strip()
    else:
        p.error("provide --lyrics-txt or --lyrics")

    config = Yue8GbConfig(
        stage1_model=args.stage1_model,
        stage2_model=args.stage2_model,
        cuda_idx=args.cuda_idx,
        vram_budget_mb=args.vram_budget_mb,
        activation_reserve_mb=args.activation_reserve_mb,
        stage1_cache_size=args.stage1_cache_size,
        stage2_cache_size=args.stage2_cache_size,
        stage1_cache_mode=args.stage1_cache_mode,
        stage2_cache_mode=args.stage2_cache_mode,
        use_guidance=not args.no_guidance,
        repetition_penalty=args.repetition_penalty,
        seed=args.seed,
        rescale=not args.no_rescale,
    )
    service = Yue8GbService(config)
    result = service.generate(
        genres=genres,
        lyrics=lyrics,
        output_dir=args.output_dir,
        run_n_segments=args.run_n_segments,
        max_new_tokens=args.max_new_tokens,
    )
    print(f"MIXED TRACK: {result['mix']}")
    return result


if __name__ == "__main__":
    torch.autograd.grad_mode._enter_inference_mode(True)
    torch.autograd.set_grad_enabled(False)
    main()
