import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Drum,
  Music,
  Drumstick,
  Zap,
} from 'lucide-react';
import {
  DrumPattern,
  STEPS,
  defaultPatternForGenre,
  scheduleDrumStep,
  getGenreConfig,
} from '../services/studioSynth';

interface BeatMakerProps {
  genre: string;
  pattern: DrumPattern;
  onChange: (pattern: DrumPattern) => void;
}

const ROWS: { key: keyof DrumPattern; label: string; icon: React.ReactNode }[] = [
  { key: 'kick', label: 'KICK', icon: <Drum className="w-3.5 h-3.5" /> },
  { key: 'snare', label: 'SNARE', icon: <Drumstick className="w-3.5 h-3.5" /> },
  { key: 'hihat', label: 'HI-HAT', icon: <Zap className="w-3.5 h-3.5" /> },
  { key: 'clap', label: 'CLAP', icon: <Music className="w-3.5 h-3.5" /> },
];

export const BeatMaker: React.FC<BeatMakerProps> = ({ genre, pattern, onChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const audioRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  const stopPlayback = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(-1);
    stepRef.current = 0;
  };

  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioRef.current) {
        audioRef.current.close().catch(() => undefined);
        audioRef.current = null;
      }
    };
  }, []);

  const runScheduler = () => {
    if (!audioRef.current) return;
    const ctx = audioRef.current;
    const stepDur = 60 / getGenreConfig(genre).bpm / 4; // 16 steps per bar @ genre preview tempo
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const step = stepRef.current % STEPS;
      const p = patternRef.current;
      if (p.kick[step]) scheduleDrumStep(ctx, 'kick', nextTimeRef.current);
      if (p.snare[step]) scheduleDrumStep(ctx, 'snare', nextTimeRef.current);
      if (p.hihat[step]) scheduleDrumStep(ctx, 'hihat', nextTimeRef.current);
      if (p.clap[step]) scheduleDrumStep(ctx, 'clap', nextTimeRef.current);
      setCurrentStep(step);
      nextTimeRef.current += stepDur;
      stepRef.current++;
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    const ctx = audioRef.current;
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    stepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.08;
    setIsPlaying(true);
    timerRef.current = window.setInterval(runScheduler, 30);
  };

  const toggleStep = (row: keyof DrumPattern, step: number) => {
    const next = { ...pattern, [row]: pattern[row].map((v, i) => (i === step ? !v : v)) };
    onChange(next);
  };

  const resetToGenre = () => {
    onChange(defaultPatternForGenre(genre));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
          <Drum className="w-3.5 h-3.5 text-indigo-400" />
          <span>Beat Maker — 16-Step Drum Machine</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={resetToGenre}
            title="Reset to genre preset"
            className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className={`py-1.5 px-3 rounded-lg font-mono text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              isPlaying
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? 'STOP' : 'PREVIEW'}
          </button>
        </div>
      </div>

      <div className="grid gap-1.5">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <div className="w-24 shrink-0 flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400">
              <span className="text-indigo-400">{row.icon}</span>
              <span>{row.label}</span>
            </div>
            <div
              className="grid gap-1 flex-1"
              style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
            >
              {pattern[row.key].map((active, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleStep(row.key, i)}
                  className={`h-7 rounded-md transition-all border ${
                    active
                      ? 'bg-indigo-500 border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                      : 'bg-slate-800/80 border-slate-700 hover:border-indigo-500/60'
                  } ${currentStep === i ? 'ring-2 ring-emerald-400/80 scale-105' : ''} ${
                    i % 4 === 0 ? 'border-l-2' : ''
                  }`}
                  aria-label={`${row.label} step ${i + 1}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="grid gap-1 pl-[6.5rem]"
        style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
      >
        {Array.from({ length: STEPS }).map((_, i) => (
          <div
            key={i}
            className={`text-center text-[8px] font-mono ${
              i % 4 === 0 ? 'text-indigo-400 font-bold' : 'text-slate-600'
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-500 font-mono">
        Click the pads to build your drum pattern. This pattern is rendered into the final track.
      </p>
    </div>
  );
};
