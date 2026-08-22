import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Activity,
  Layers,
  Radio,
  BarChart2,
  Disc,
  Sliders,
  Maximize2,
  RotateCcw,
  Sparkles,
  Mic,
} from 'lucide-react';
import { ProjectAsset } from '../types';

export type VisualizerMode = 'spectrum' | 'oscilloscope' | 'stems' | 'radial';

interface RealtimeWaveformVisualizerProps {
  project: ProjectAsset;
  isPlaying: boolean;
  onTogglePlay: () => void;
  activeStems: {
    vocals: boolean;
    drums: boolean;
    bass: boolean;
    other: boolean;
  };
  onStemToggle: (stem: 'vocals' | 'drums' | 'bass' | 'other') => void;
  /**
   * When true, the synthesized overlay "vocal" layers (oscillator hum + speech
   * synthesis reading the lyrics) are disabled. The real rendered vocal line is
   * already baked into the track, so overlaying TTS on top ruins playback.
   */
  disableOverlayVocal?: boolean;
}

export const RealtimeWaveformVisualizer: React.FC<RealtimeWaveformVisualizerProps> = ({
  project,
  isPlaying,
  onTogglePlay,
  activeStems,
  onStemToggle,
  disableOverlayVocal = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(project.durationSec || 180);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [mode, setMode] = useState<VisualizerMode>('spectrum');
  const [peakL, setPeakL] = useState<number>(-48);
  const [peakR, setPeakR] = useState<number>(-48);
  const [bandEnergy, setBandEnergy] = useState<{ bass: number; mid: number; treble: number }>({
    bass: 0,
    mid: 0,
    treble: 0,
  });

  // Calculate stem attenuation factor
  const activeStemCount = Object.values(activeStems).filter(Boolean).length;
  const stemMultiplier = activeStemCount === 0 ? 0 : activeStemCount / 4;

  const [currentSungLine, setCurrentSungLine] = useState<string>('');
  const [vocalSynthesisMode, setVocalSynthesisMode] = useState<'neural_singing' | 'tts'>('neural_singing');
  const [vibratoAmount, setVibratoAmount] = useState<number>(60); // 0 to 100
  const [expressionAmount, setExpressionAmount] = useState<number>(75); // 0 to 100

  // Suno AI Vocal Engine State: Male & Female Voice Models, Autotune & Formants
  const [sunoVocalGender, setSunoVocalGender] = useState<'male' | 'female' | 'duet'>(() => {
    const instStr = (project.instruments || []).join(' ').toLowerCase();
    const promptStr = (project.prompt || '').toLowerCase();
    if (instStr.includes('male') || promptStr.includes('male') || promptStr.includes('baritone') || promptStr.includes('guy')) {
      return 'male';
    }
    if (instStr.includes('female') || promptStr.includes('female') || promptStr.includes('soprano') || promptStr.includes('girl')) {
      return 'female';
    }
    return 'male'; // High clarity default male voice
  });

  const [sunoAutotuneAmount, setSunoAutotuneAmount] = useState<number>(85); // 0 to 100% Suno pitch quantization
  const [sunoVocalPreset, setSunoVocalPreset] = useState<string>('male_rnb');

  const vocalSynthRef = useRef<{
    ctx: AudioContext;
    osc: OscillatorNode;
    vibrato: OscillatorNode;
    gainNode: GainNode;
  } | null>(null);

  // Initialize or handle audio playback sync
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          // Fallback handled by synthetic visualizer loop
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Web Audio Suno AI Melodic Vocal Synthesizer (Male / Female Formant & Autotune Pitch Synth)
  useEffect(() => {
    if (disableOverlayVocal || !isPlaying || !activeStems.vocals || isMuted || vocalSynthesisMode === 'tts') {
      if (vocalSynthRef.current) {
        try {
          vocalSynthRef.current.gainNode.gain.setTargetAtTime(0, vocalSynthRef.current.ctx.currentTime, 0.05);
          setTimeout(() => {
            vocalSynthRef.current?.ctx.close().catch(() => {});
            vocalSynthRef.current = null;
          }, 100);
        } catch {
          vocalSynthRef.current = null;
        }
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      const formantF1 = ctx.createBiquadFilter();
      const formantF2 = ctx.createBiquadFilter();
      const gainNode = ctx.createGain();

      // Configure Gender Formant Filters
      const exprFactor = expressionAmount / 100;
      const isFemale = sunoVocalGender === 'female';
      const isMale = sunoVocalGender === 'male';

      // Male Vocal Tract: F1 ~350Hz, F2 ~1200Hz | Female Vocal Tract: F1 ~750Hz, F2 ~2200Hz
      formantF1.type = 'bandpass';
      formantF1.frequency.value = isFemale ? 750 + exprFactor * 150 : isMale ? 350 + exprFactor * 100 : 550;
      formantF1.Q.value = isFemale ? 4.2 : 3.2;

      formantF2.type = 'peaking';
      formantF2.frequency.value = isFemale ? 2200 + exprFactor * 400 : isMale ? 1200 + exprFactor * 250 : 1700;
      formantF2.gain.value = isFemale ? 6 + exprFactor * 4 : 4 + exprFactor * 3;
      formantF2.Q.value = 3.0;

      // Vibrato settings driven by vibrato slider (3.5Hz to 8.5Hz modulation)
      vibrato.type = 'sine';
      const vibFreq = 4.0 + (vibratoAmount / 100) * 4.5;
      vibrato.frequency.value = vibFreq;
      const vibGain = 2 + (vibratoAmount / 100) * 16; // pitch wobble depth in cents
      vibratoGain.gain.value = vibGain;
      vibrato.connect(osc.frequency);

      osc.type = isMale ? 'sawtooth' : 'triangle';
      gainNode.gain.value = 0;

      osc.connect(formantF1);
      formantF1.connect(formantF2);
      formantF2.connect(gainNode);
      gainNode.connect(ctx.destination);

      vibrato.start();
      osc.start();

      vocalSynthRef.current = { ctx, osc, vibrato, gainNode };

      // Musical scale frequency lookup based on key & vocal gender pitch octave
      const keyStr = (project.keySignature || 'F# Minor').toLowerCase();
      // Base scale frequencies for male (lower octave) vs female (higher octave)
      let scaleFreqs = isFemale
        ? [277.18, 329.63, 369.99, 440.0, 493.88, 554.37, 659.25] // F# Minor Soprano
        : [138.59, 164.81, 185.0, 220.0, 246.94, 277.18, 329.63]; // F# Minor Baritone/Tenor

      if (keyStr.includes('a maj') || keyStr.includes('a major')) {
        scaleFreqs = isFemale
          ? [329.63, 369.99, 415.3, 440.0, 493.88, 554.37, 659.25]
          : [164.81, 185.0, 207.65, 220.0, 246.94, 277.18, 329.63];
      } else if (keyStr.includes('d min') || keyStr.includes('d minor')) {
        scaleFreqs = isFemale
          ? [293.66, 329.63, 349.23, 392.0, 440.0, 466.16, 523.25]
          : [146.83, 164.81, 174.61, 196.0, 220.0, 233.08, 261.63];
      } else if (keyStr.includes('c maj') || keyStr.includes('c major')) {
        scaleFreqs = isFemale
          ? [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88]
          : [130.81, 146.83, 164.81, 174.61, 196.0, 220.0, 246.94];
      }

      // Melodic note progression synced to track tempo with Suno Auto-Tune pitch quantization
      const bpm = project.bpm || 112;
      const beatInterval = (60 / bpm) * 1000;
      let noteIndex = 0;

      const synthInterval = setInterval(() => {
        if (!vocalSynthRef.current) return;
        const targetFreq = scaleFreqs[noteIndex % scaleFreqs.length];
        const now = ctx.currentTime;

        // Suno Auto-Tune Pitch Glide: Faster glide = tighter auto-tune lock
        const autotuneFactor = sunoAutotuneAmount / 100;
        const glideTime = 0.12 - autotuneFactor * 0.09; // 0.03s for tight Suno autotune

        osc.frequency.setTargetAtTime(targetFreq, now, Math.max(0.02, glideTime));
        const targetGain = (0.12 + exprFactor * 0.12) * volume;
        gainNode.gain.setTargetAtTime(targetGain, now, 0.04);
        noteIndex = (noteIndex + 1) % scaleFreqs.length;
      }, beatInterval);

      return () => {
        clearInterval(synthInterval);
        try {
          ctx.close().catch(() => {});
        } catch {
          // ignore
        }
      };
    } catch {
      // AudioContext fallback
    }
  }, [
    isPlaying,
    activeStems.vocals,
    isMuted,
    project.keySignature,
    project.bpm,
    volume,
    vocalSynthesisMode,
    vibratoAmount,
    expressionAmount,
    sunoVocalGender,
    sunoAutotuneAmount,
    disableOverlayVocal,
  ]);

  // Synchronized Suno Male / Female Melodic Singing & Speech Synthesis Engine
  useEffect(() => {
    if (disableOverlayVocal) return;
    if (!('speechSynthesis' in window)) return;

    if (isPlaying && activeStems.vocals && project.lyrics && !isMuted) {
      window.speechSynthesis.cancel(); // Reset previous speech

      const cleanLines = project.lyrics
        .replace(/\[.*?\]/g, '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      if (cleanLines.length === 0) return;

      let lineIdx = 0;
      const baseContours = [1.15, 1.32, 1.22, 1.45, 1.10, 1.38, 1.25, 1.50];

      const singNextLine = () => {
        if (!isPlaying || !activeStems.vocals || isMuted) return;

        const currentLineText = cleanLines[lineIdx % cleanLines.length];
        setCurrentSungLine(currentLineText);

        const utterance = new SpeechSynthesisUtterance(currentLineText);

        const exprFactor = expressionAmount / 100;
        const autotuneFactor = sunoAutotuneAmount / 100;

        if (vocalSynthesisMode === 'neural_singing') {
          utterance.rate = 0.88 + (1 - exprFactor) * 0.10;

          // Gender-Specific Pitch Base: Male = 0.85 (Baritone), Female = 1.25 (Soprano)
          const genderBasePitch = sunoVocalGender === 'female' ? 1.25 : 0.85;
          const rawContour = baseContours[lineIdx % baseContours.length];
          const melodicVariation = (rawContour - 1.0) * (0.4 + exprFactor * 0.6) * (1 - autotuneFactor * 0.3);

          utterance.pitch = Math.min(2.0, Math.max(0.5, genderBasePitch + melodicVariation));
        } else {
          utterance.rate = 1.0;
          utterance.pitch = sunoVocalGender === 'female' ? 1.2 : 0.9;
        }

        utterance.volume = volume;

        const voices = window.speechSynthesis.getVoices();
        let targetVoice = null;

        if (sunoVocalGender === 'female') {
          targetVoice =
            voices.find(
              (v) =>
                v.lang.startsWith('en') &&
                (v.name.includes('Female') ||
                  v.name.includes('Samantha') ||
                  v.name.includes('Victoria') ||
                  v.name.includes('Google US English') ||
                  v.name.includes('Zira'))
            ) || voices[0];
        } else {
          targetVoice =
            voices.find(
              (v) =>
                v.lang.startsWith('en') &&
                (v.name.includes('Male') ||
                  v.name.includes('David') ||
                  v.name.includes('Alex') ||
                  v.name.includes('Daniel') ||
                  v.name.includes('Google UK English Male'))
            ) || voices[0];
        }

        if (targetVoice) utterance.voice = targetVoice;

        utterance.onend = () => {
          lineIdx = (lineIdx + 1) % cleanLines.length;
          const breather = vocalSynthesisMode === 'neural_singing' ? 320 : 200;
          setTimeout(() => {
            if (isPlaying && activeStems.vocals && !isMuted) {
              singNextLine();
            }
          }, breather);
        };

        utterance.onerror = () => {
          lineIdx = (lineIdx + 1) % cleanLines.length;
        };

        window.speechSynthesis.speak(utterance);
      };

      singNextLine();
    } else {
      window.speechSynthesis.cancel();
      setCurrentSungLine('');
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlaying, activeStems.vocals, project.lyrics, isMuted, volume, vocalSynthesisMode, vibratoAmount, expressionAmount, disableOverlayVocal]);

  // Audio duration updates
  useEffect(() => {
    if (project.durationSec) {
      setDuration(project.durationSec);
    }
  }, [project.durationSec]);

  // Volume update
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Synthetic frequency data generator when Web Audio API source isn't connected to live stream
  const generateSyntheticFrequencyData = useCallback(
    (time: number, bufferLength: number) => {
      const data = new Uint8Array(bufferLength);
      if (!isPlaying || stemMultiplier === 0) return data;

      const bpm = project.bpm || 110;
      const beatFreq = (bpm / 60) * 2 * Math.PI; // Beat phase velocity
      const phase = time * beatFreq;

      // Stem multipliers
      const vocalMult = activeStems.vocals ? 1 : 0.1;
      const drumMult = activeStems.drums ? 1 : 0.1;
      const bassMult = activeStems.bass ? 1 : 0.1;
      const otherMult = activeStems.other ? 1 : 0.1;

      for (let i = 0; i < bufferLength; i++) {
        const normIndex = i / bufferLength;

        // Bass frequencies (0 - 0.2)
        if (normIndex < 0.2) {
          const bassPulse = Math.pow(Math.sin(phase) * 0.5 + 0.5, 3) * 200 * bassMult * drumMult;
          const noise = Math.random() * 30;
          data[i] = Math.min(255, Math.max(10, bassPulse + noise + 30));
        }
        // Mid frequencies (0.2 - 0.6)
        else if (normIndex < 0.6) {
          const midVocal = Math.sin(phase * 2 + i * 0.1) * 80 * vocalMult;
          const harmonics = Math.cos(time * 8 + i * 0.05) * 60 * otherMult;
          data[i] = Math.min(255, Math.max(15, 120 + midVocal + harmonics + Math.random() * 20));
        }
        // Treble frequencies (0.6 - 1.0)
        else {
          const trebleShimmer = Math.abs(Math.sin(time * 15 + i * 0.2)) * 140 * otherMult;
          data[i] = Math.min(255, Math.max(5, trebleShimmer + Math.random() * 40));
        }
      }
      return data;
    },
    [isPlaying, stemMultiplier, project.bpm, activeStems]
  );

  // Time progress loop when playing
  useEffect(() => {
    let timer: number | null = null;
    if (isPlaying) {
      const startTime = Date.now() - currentTime * 1000;
      timer = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= duration) {
          setCurrentTime(0);
          onTogglePlay();
        } else {
          setCurrentTime(elapsed);
        }
      }, 50);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, duration, currentTime, onTogglePlay]);

  // Canvas rendering animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localAnalyser = analyserRef.current;
    const bufferLength = 64;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);

      // Canvas dimensions with HiDPI support
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Dark futuristic gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#090d16');
      bgGradient.addColorStop(1, '#02040a');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Grid background pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridStep = 24;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Fetch or generate frequency data
      let freqData: Uint8Array;
      if (localAnalyser && isPlaying) {
        localAnalyser.getByteFrequencyData(dataArray);
        freqData = dataArray;
      } else {
        freqData = generateSyntheticFrequencyData(currentTime, bufferLength);
      }

      // Calculate Energy Bands (Bass, Mid, Treble)
      let bSum = 0,
        mSum = 0,
        tSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        if (i < 10) bSum += freqData[i];
        else if (i < 35) mSum += freqData[i];
        else tSum += freqData[i];
      }
      const bassEnergy = Math.min(100, Math.round((bSum / (10 * 255)) * 100));
      const midEnergy = Math.min(100, Math.round((mSum / (25 * 255)) * 100));
      const trebleEnergy = Math.min(100, Math.round((tSum / (29 * 255)) * 100));

      setBandEnergy({ bass: bassEnergy, mid: midEnergy, treble: trebleEnergy });

      // Calculate Peak Levels in dB (-48 to 0 dB)
      if (isPlaying && stemMultiplier > 0) {
        const avgAmp = (bassEnergy * 1.2 + midEnergy + trebleEnergy * 0.8) / 3;
        const dB_L = -48 + (avgAmp / 100) * 48 + (Math.random() * 2 - 1);
        const dB_R = -48 + (avgAmp / 100) * 48 + (Math.random() * 2 - 1);
        setPeakL(Math.min(0, Math.max(-48, Math.round(dB_L))));
        setPeakR(Math.min(0, Math.max(-48, Math.round(dB_R))));
      } else {
        setPeakL(-48);
        setPeakR(-48);
      }

      // Render based on selected visualizer mode
      if (mode === 'spectrum') {
        renderSpectrumBars(ctx, width, height, freqData);
      } else if (mode === 'oscilloscope') {
        renderOscilloscopeWave(ctx, width, height, freqData, currentTime);
      } else if (mode === 'stems') {
        renderStemsSplitView(ctx, width, height, freqData, currentTime);
      } else if (mode === 'radial') {
        renderRadialRing(ctx, width, height, freqData, currentTime);
      }

      // Render Timeline Progress Overlay
      renderTimelineScrubber(ctx, width, height, currentTime, duration);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mode, isPlaying, currentTime, duration, activeStems, stemMultiplier, generateSyntheticFrequencyData]);

  // Mode 1: Spectrum Bars with Neon Glow
  const renderSpectrumBars = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    freqData: Uint8Array
  ) => {
    const bars = freqData.length;
    const barWidth = (width / bars) * 0.75;
    const gap = (width / bars) * 0.25;

    for (let i = 0; i < bars; i++) {
      const val = freqData[i] / 255;
      const barHeight = Math.max(6, val * (height * 0.75));
      const x = i * (barWidth + gap) + gap / 2;
      const y = height - barHeight - 20;

      // Color Gradient from Deep Indigo to Neon Magenta to Bright Cyan
      const gradient = ctx.createLinearGradient(0, height - 20, 0, y);
      gradient.addColorStop(0, '#4f46e5'); // Indigo
      gradient.addColorStop(0.5, '#9333ea'); // Purple
      gradient.addColorStop(0.85, '#ec4899'); // Pink
      gradient.addColorStop(1, '#06b6d4'); // Cyan

      ctx.fillStyle = gradient;

      // Draw rounded top bar
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 1, 1]);
      ctx.fill();

      // Top Peak Dot
      if (val > 0.15) {
        ctx.fillStyle = '#67e8f9';
        ctx.fillRect(x, Math.max(10, y - 4), barWidth, 2);
      }
    }
  };

  // Mode 2: Oscilloscope Wave
  const renderOscilloscopeWave = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    freqData: Uint8Array,
    time: number
  ) => {
    ctx.lineWidth = 3;
    const glowGradient = ctx.createLinearGradient(0, 0, width, 0);
    glowGradient.addColorStop(0, '#818cf8');
    glowGradient.addColorStop(0.5, '#c084fc');
    glowGradient.addColorStop(1, '#22d3ee');

    ctx.strokeStyle = glowGradient;
    ctx.shadowBlur = isPlaying ? 12 : 0;
    ctx.shadowColor = '#818cf8';

    ctx.beginPath();
    const sliceWidth = width / freqData.length;
    let x = 0;

    for (let i = 0; i < freqData.length; i++) {
      const v = freqData[i] / 128.0;
      const amp = isPlaying ? (v - 1) * 45 : 0;
      const wave = Math.sin(time * 10 + i * 0.3) * (isPlaying ? 15 : 2);
      const y = height / 2 + amp + wave;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0; // Reset shadow
  };

  // Mode 3: Stems Split View (4 Stacked Waveform Lanes)
  const renderStemsSplitView = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    freqData: Uint8Array,
    time: number
  ) => {
    const stems = [
      { key: 'vocals', label: 'VOCALS', color: '#ec4899', active: activeStems.vocals },
      { key: 'drums', label: 'DRUMS', color: '#f59e0b', active: activeStems.drums },
      { key: 'bass', label: 'BASS', color: '#6366f1', active: activeStems.bass },
      { key: 'other', label: 'OTHER', color: '#10b981', active: activeStems.other },
    ];

    const laneHeight = (height - 30) / 4;

    stems.forEach((stem, index) => {
      const laneY = index * laneHeight + 5;

      // Lane Background
      ctx.fillStyle = stem.active ? 'rgba(15, 23, 42, 0.6)' : 'rgba(15, 23, 42, 0.2)';
      ctx.fillRect(0, laneY, width, laneHeight - 4);

      // Lane Border
      ctx.strokeStyle = stem.active ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)';
      ctx.strokeRect(0, laneY, width, laneHeight - 4);

      // Label
      ctx.fillStyle = stem.active ? stem.color : '#64748b';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(stem.label, 8, laneY + 12);

      // Draw Mini Waveform
      if (stem.active && isPlaying) {
        ctx.strokeStyle = stem.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();

        const points = 40;
        const step = width / points;

        for (let p = 0; p < points; p++) {
          const sample = freqData[(p + index * 10) % freqData.length] / 255;
          const h = sample * (laneHeight * 0.45);
          const px = p * step;
          const py = laneY + laneHeight / 2 + Math.sin(time * 8 + p * 0.4) * h;

          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        // Flat Muted Line
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, laneY + laneHeight / 2);
        ctx.lineTo(width, laneY + laneHeight / 2);
        ctx.stroke();
      }
    });
  };

  // Mode 4: Radial Ring Visualizer
  const renderRadialRing = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    freqData: Uint8Array,
    time: number
  ) => {
    const centerX = width / 2;
    const centerY = (height - 20) / 2;
    const baseRadius = Math.min(centerX, centerY) * 0.45;

    // Outer Glow Ring
    ctx.save();
    ctx.translate(centerX, centerY);

    const bars = 48;
    const angleStep = (Math.PI * 2) / bars;

    for (let i = 0; i < bars; i++) {
      const val = freqData[i % freqData.length] / 255;
      const barLen = isPlaying ? Math.max(4, val * 45) : 4;
      const angle = i * angleStep;

      const x1 = Math.cos(angle) * baseRadius;
      const y1 = Math.sin(angle) * baseRadius;
      const x2 = Math.cos(angle) * (baseRadius + barLen);
      const y2 = Math.sin(angle) * (baseRadius + barLen);

      const colorGradient = ctx.createLinearGradient(x1, y1, x2, y2);
      colorGradient.addColorStop(0, '#6366f1');
      colorGradient.addColorStop(1, '#a855f7');

      ctx.strokeStyle = colorGradient;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Core Pulsating Orb
    const pulseRadius = baseRadius * 0.7 + (isPlaying ? Math.sin(time * 12) * 4 : 0);
    const orbGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, pulseRadius);
    orbGrad.addColorStop(0, 'rgba(129, 140, 248, 0.9)');
    orbGrad.addColorStop(0.6, 'rgba(99, 102, 241, 0.4)');
    orbGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Render Timeline Scrubber Head
  const renderTimelineScrubber = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    curr: number,
    dur: number
  ) => {
    const progress = Math.min(1, Math.max(0, curr / (dur || 180)));
    const scrubberX = progress * width;

    // Played Background Mask
    ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.fillRect(0, 0, scrubberX, height - 12);

    // Scrubber Line
    ctx.strokeStyle = '#f43f5e'; // Bright Rose/Coral
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scrubberX, 0);
    ctx.lineTo(scrubberX, height - 12);
    ctx.stroke();

    // Scrubber Head Handle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(scrubberX, height - 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bottom Track Bar Background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, height - 8, width, 8);

    // Bottom Track Played Progress Fill
    const fillGrad = ctx.createLinearGradient(0, 0, width, 0);
    fillGrad.addColorStop(0, '#6366f1');
    fillGrad.addColorStop(1, '#ec4899');
    ctx.fillStyle = fillGrad;
    ctx.fillRect(0, height - 8, scrubberX, 8);
  };

  // Click on Canvas to Seek
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Format Time Helper
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-950 rounded-3xl p-4 md:p-5 border border-slate-800 shadow-2xl space-y-4 text-white">
      {/* Hidden Audio Element for playback sync */}
      {project.audioUrl && (
        <audio
          ref={audioRef}
          src={project.audioUrl}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          preload="auto"
          onEnded={() => {
            setCurrentTime(0);
            if (isPlaying) onTogglePlay();
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
        />
      )}

      {/* Top Header: Title, Playhead Time, Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase">
                Real-Time Audio Spectrum
              </h3>
              <span
                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isPlaying
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {isPlaying ? 'LIVE STREAMING' : 'PAUSED'}
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  activeStems.vocals
                    ? vocalSynthesisMode === 'neural_singing'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {activeStems.vocals
                  ? vocalSynthesisMode === 'neural_singing'
                    ? '🎤 AI NEURAL SINGING ACTIVE'
                    : '🗣️ TEXT-TO-SPEECH ACTIVE'
                  : '🥁 INSTRUMENTAL BEAT ONLY'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              {formatTime(currentTime)} / {formatTime(duration)} • {project.bpm || 120} BPM
            </p>
          </div>
        </div>

        {/* Visualizer Mode Selector Pills */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
          {[
            { id: 'spectrum', label: 'Bars', icon: BarChart2 },
            { id: 'oscilloscope', label: 'Wave', icon: Radio },
            { id: 'stems', label: 'Stems', icon: Layers },
            { id: 'radial', label: 'Radial', icon: Disc },
          ].map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id as VisualizerMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Melodic Singing Lyrics Banner */}
      {isPlaying && activeStems.vocals && currentSungLine && (
        <div className="bg-indigo-950/80 border border-indigo-500/40 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 animate-fadeIn backdrop-blur-md shadow-lg shadow-indigo-950/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0 text-indigo-300 shadow-inner">
              <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                <span>
                  {vocalSynthesisMode === 'neural_singing'
                    ? '🎤 AI NEURAL SINGING VOCALS'
                    : '🗣️ TEXT-TO-SPEECH READOUT'}
                </span>
                <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded font-mono font-bold border border-indigo-400/30">
                  {project.keySignature || 'F# Minor'}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-white italic truncate mt-0.5 tracking-wide">
                "{currentSungLine}"
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono font-bold text-indigo-200 bg-indigo-900/80 px-2.5 py-1 rounded-xl border border-indigo-500/40 shadow-sm">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">
              {vocalSynthesisMode === 'neural_singing' ? 'PITCH MELODY ACTIVE' : 'SPEECH READ ACTIVE'}
            </span>
          </div>
        </div>
      )}

      {/* Canvas Visualizer Stage */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800/90 group cursor-pointer shadow-inner">
        <canvas
          ref={canvasRef}
          width={720}
          height={180}
          onClick={handleCanvasClick}
          className="w-full h-44 md:h-52 object-cover block"
        />

        {/* Floating Controls Overlay on Hover */}
        <div className="absolute top-3 right-3 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 text-[10px] font-mono text-slate-300">
          <span className="text-slate-400">Click canvas to seek</span>
        </div>
      </div>

      {/* Audio Dynamics Analysis & VU Meters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* Real-time Frequency Band Intensity */}
        <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-indigo-300 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Frequency Band Energy
            </span>
            <span>20Hz - 20kHz</span>
          </div>

          <div className="space-y-1.5">
            {/* Bass */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-slate-400">BASS / SUB (20-250Hz)</span>
                <span className="text-indigo-400 font-bold">{bandEnergy.bass}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-100"
                  style={{ width: `${bandEnergy.bass}%` }}
                />
              </div>
            </div>

            {/* Midrange */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-slate-400">MIDRANGE (250Hz-4kHz)</span>
                <span className="text-pink-400 font-bold">{bandEnergy.mid}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-100"
                  style={{ width: `${bandEnergy.mid}%` }}
                />
              </div>
            </div>

            {/* Treble */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-slate-400">TREBLE / AIR (4k-20kHz)</span>
                <span className="text-cyan-400 font-bold">{bandEnergy.treble}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-100"
                  style={{ width: `${bandEnergy.treble}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Peak VU Meter & Stereo Master Meter */}
        <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-indigo-300 font-bold">
              <Sliders className="w-3.5 h-3.5" />
              Peak Level VU Meter
            </span>
            <span className="text-emerald-400 font-bold">STEREO L / R</span>
          </div>

          <div className="space-y-2 py-1">
            {/* L Channel */}
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="w-3 text-slate-400 font-bold">L</span>
              <div className="flex-1 h-3 bg-slate-800 rounded-lg p-0.5 flex items-center overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-sm transition-all duration-75"
                  style={{ width: `${((peakL + 48) / 48) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right text-slate-300 font-bold">{peakL} dB</span>
            </div>

            {/* R Channel */}
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="w-3 text-slate-400 font-bold">R</span>
              <div className="flex-1 h-3 bg-slate-800 rounded-lg p-0.5 flex items-center overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-sm transition-all duration-75"
                  style={{ width: `${((peakR + 48) / 48) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right text-slate-300 font-bold">{peakR} dB</span>
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2.5 pt-1 border-t border-slate-800">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-indigo-400" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Suno AI Vocal Synthesis Engine Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>Suno AI Vocal Engine</span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {sunoVocalGender === 'female' ? '🎤 FEMALE SOPRANO' : sunoVocalGender === 'male' ? '🎙️ MALE BARITONE' : '👥 STUDIO DUET'}
                </span>
              </h4>
              <p className="text-[10px] text-slate-400 font-mono">
                Studio pitch correction, formant resonance & Suno voice models
              </p>
            </div>
          </div>

          <div className="text-[10px] font-mono text-indigo-400 bg-indigo-950 px-2.5 py-1 rounded-xl border border-indigo-800/60 font-bold">
            Auto-Tune: {sunoAutotuneAmount}%
          </div>
        </div>

        {/* Male vs Female Voice Model Selector */}
        <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
          {[
            { id: 'male', label: '🎙️ Suno Male Lead', desc: 'Baritone / R&B' },
            { id: 'female', label: '🎤 Suno Female Lead', desc: 'Soprano / Afro-Pop' },
            { id: 'duet', label: '👥 Suno Studio Duet', desc: 'Harmonized' },
          ].map((v) => {
            const active = sunoVocalGender === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSunoVocalGender(v.id as any)}
                className={`py-2 px-2.5 rounded-xl border text-left transition-all ${
                  active
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-100 shadow-md shadow-indigo-600/20 scale-[1.01]'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-[11px] truncate">{v.label}</div>
                <div className="text-[9px] text-slate-400 truncate">{v.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Mode Selector Toggle (Neural Singing vs TTS) */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
          <button
            type="button"
            onClick={() => setVocalSynthesisMode('neural_singing')}
            className={`py-1.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all ${
              vocalSynthesisMode === 'neural_singing'
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-600/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${vocalSynthesisMode === 'neural_singing' ? 'text-indigo-400 animate-spin' : ''}`} />
            <span>Suno Melodic Pitch Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setVocalSynthesisMode('tts')}
            className={`py-1.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all ${
              vocalSynthesisMode === 'tts'
                ? 'bg-amber-600/30 border-amber-500 text-amber-200 shadow-md shadow-amber-600/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Spoken Readout (TTS)</span>
          </button>
        </div>

        {/* Suno Auto-Tune & Formant Control Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-slate-800/80">
          {/* Suno Pitch Correction Auto-Tune Slider */}
          <div className="space-y-1 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Auto-Tune Pitch Lock
              </span>
              <span className="text-cyan-400 font-bold">{sunoAutotuneAmount}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sunoAutotuneAmount}
              onChange={(e) => setSunoAutotuneAmount(parseInt(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[9px] text-slate-500 font-mono">
              Quantizes pitch glide to scale steps
            </div>
          </div>

          {/* Vibrato Depth Slider */}
          <div className="space-y-1 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <Radio className="w-3 h-3 text-indigo-400" />
                Vibrato Modulation
              </span>
              <span className="text-indigo-400 font-bold">{vibratoAmount}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={vibratoAmount}
              disabled={vocalSynthesisMode === 'tts'}
              onChange={(e) => setVibratoAmount(parseInt(e.target.value))}
              className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
            />
            <div className="text-[9px] text-slate-500 font-mono">
              Warm voice pitch wobble
            </div>
          </div>

          {/* Vocal Expression Slider */}
          <div className="space-y-1 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <Sliders className="w-3 h-3 text-pink-400" />
                Formant Expression
              </span>
              <span className="text-pink-400 font-bold">{expressionAmount}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={expressionAmount}
              onChange={(e) => setExpressionAmount(parseInt(e.target.value))}
              className="w-full accent-pink-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[9px] text-slate-500 font-mono">
              Vocal tract resonance & brightness
            </div>
          </div>
        </div>
      </div>

      {/* Audio Stems Isolated Controls */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold font-mono uppercase text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Isolated Stem Channels
          </h4>
          <span className="text-[10px] font-mono text-slate-500">
            {activeStemCount} / 4 Stems Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          {(['vocals', 'drums', 'bass', 'other'] as const).map((stem) => {
            const active = activeStems[stem];
            const icons = { vocals: '🎤', drums: '🥁', bass: '🎸', other: '🎹' };
            return (
              <button
                key={stem}
                onClick={() => onStemToggle(stem)}
                className={`py-2 px-3 rounded-xl border capitalize font-semibold transition-all flex items-center justify-between ${
                  active
                    ? 'bg-indigo-600/20 border-indigo-500/80 text-indigo-200 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500 line-through opacity-60'
                }`}
              >
                <span>
                  {icons[stem]} {stem}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    active ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
