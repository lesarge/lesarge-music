"""
Lesarge Music AI - Video Generator service.
Standalone FastAPI service using HuggingFace diffusers (AnimateDiff) on CPU.
Endpoints:
  GET  /v1/health
  POST /v1/video/generate   {prompt, negative_prompt, num_frames, fps, width, height,
                             num_inference_steps, guidance_scale, seed}
  GET  /v1/video/status/{job_id}
  GET  /video/{filename}    -> serves generated mp4 files
"""
from __future__ import annotations

import os
import sys
import time
import uuid
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

OUTPUT_DIR = Path(os.getenv("VIDEO_OUTPUT_DIR", Path(__file__).parent / "output" / "videos"))
MODEL_BASE = os.getenv("VIDEO_MODEL", "emilianJR/epiCRealism")
MOTION_ADAPTER = os.getenv("VIDEO_MOTION_ADAPTER", "guoyww/animatediff-motion-adapter-v1-5-2")
DEFAULT_NEGATIVE = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, username, blurry, deformed, ugly, extra limbs, oversaturated"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Lesarge Video Generator")

_jobs: dict[str, dict] = {}
_lock = threading.Lock()
_pipe = None
_pipe_lock = threading.Lock()


class GenerateRequest(BaseModel):
    prompt: str = "A dreamy night sky over mountains, cinematic, soft lighting"
    negative_prompt: str = DEFAULT_NEGATIVE
    num_frames: int = 16
    fps: int = 8
    width: int = 256
    height: int = 256
    num_inference_steps: int = 12
    guidance_scale: float = 7.5
    seed: int | None = None


def _load_pipeline():
    global _pipe
    with _pipe_lock:
        if _pipe is not None:
            return _pipe
        print("Loading AnimateDiff pipeline (first run downloads ~4 GB of models)...", flush=True)
        import torch
        from diffusers import AnimateDiffPipeline, EulerDiscreteScheduler, MotionAdapter

        motion = MotionAdapter.from_pretrained(MOTION_ADAPTER)
        pipe = AnimateDiffPipeline.from_pretrained(MODEL_BASE, motion_adapter=motion)
        pipe.scheduler = EulerDiscreteScheduler.from_config(pipe.scheduler.config)
        pipe.enable_vae_slicing()
        if hasattr(pipe, "enable_attention_slicing"):
            pipe.enable_attention_slicing()
        if hasattr(pipe, "enable_model_cpu_offload"):
            pass  # CPU offload only matters for GPU
        _pipe = pipe
        print("Pipeline ready.", flush=True)
        return _pipe


def _encode_mp4(frames, out_path: Path, fps: int) -> None:
    import av

    with av.open(str(out_path), mode="w") as container:
        stream = container.add_stream("h264", rate=fps)
        stream.width, stream.height = frames[0].size
        stream.pix_fmt = "yuv420p"
        stream.options = {"crf": "23", "preset": "fast"}
        for img in frames:
            frame = av.VideoFrame.from_image(img)
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)


def _run_job(job_id: str, req: GenerateRequest) -> None:
    try:
        import torch
        from diffusers.utils import export_to_video  # noqa: F401  (fallback)

        job = _jobs[job_id]
        job["stage"] = "loading-model"
        pipe = _load_pipeline()

        job["stage"] = "generating"
        steps_done = {"n": 0}

        def on_step(pipe_, step_index, timestep, callback_kwargs):
            steps_done["n"] += 1
            total = req.num_inference_steps
            job["progress"] = int(round(100 * steps_done["n"] / max(total, 1)))
            return callback_kwargs

        gen = torch.Generator(device="cpu")
        gen.manual_seed(req.seed if req.seed is not None else int(time.time() * 1000) % 2**31)

        output = pipe(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            num_frames=req.num_frames,
            guidance_scale=req.guidance_scale,
            num_inference_steps=req.num_inference_steps,
            width=req.width,
            height=req.height,
            generator=gen,
            callback_on_step_end=on_step,
        )
        frames = output.frames[0]
        job["progress"] = 100
        job["stage"] = "encoding"
        out_path = OUTPUT_DIR / f"{job_id}.mp4"
        _encode_mp4(frames, out_path, req.fps)
        job["status"] = "done"
        job["filename"] = out_path.name
        job["video_path"] = str(out_path)
    except Exception as exc:  # noqa: BLE001
        job["status"] = "failed"
        job["error"] = str(exc)
        print(f"Job {job_id} failed: {exc}", file=sys.stderr, flush=True)


@app.get("/v1/health")
def health():
    return {"status": "ok", "service": "lesarge-video"}


@app.post("/v1/video/generate")
def generate(req: GenerateRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(400, "prompt is required")
    job_id = uuid.uuid4().hex[:12]
    with _lock:
        _jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "stage": "queued",
            "progress": 0,
            "error": None,
            "filename": None,
            "created_at": time.time(),
        }
    threading.Thread(target=_run_job, args=(job_id, req), daemon=True).start()
    return {"job_id": job_id}


@app.get("/v1/video/status/{job_id}")
def status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return {k: job.get(k) for k in ("id", "status", "stage", "progress", "error", "filename", "created_at")}


@app.get("/video/{filename}")
def video_file(filename: str):
    safe = Path(filename).name
    path = OUTPUT_DIR / safe
    if not path.exists():
        raise HTTPException(404, "file not found")
    return FileResponse(str(path), media_type="video/mp4", filename=safe)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("VIDEO_API_PORT", "8011"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
