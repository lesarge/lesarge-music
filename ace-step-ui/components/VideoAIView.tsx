import React, { useCallback, useEffect, useState } from 'react';
import { Video, Loader2, Sparkles, RefreshCw, Play, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface VideoJobResult {
  videoUrl?: string;
  fps?: number;
  frames?: number;
}

interface VideoJob {
  id: string;
  status: string;
  params?: string;
  result?: string | null;
  error?: string | null;
  created_at?: string;
}

interface StatusResponse {
  jobId: string;
  status: string;
  progress: number;
  result: VideoJobResult | null;
  error: string | null;
}

const api = async <T,>(endpoint: string, token: string | null, options: { method?: string; body?: unknown } = {}): Promise<T> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return res.json();
};

export const VideoAIView: React.FC = () => {
  const { token } = useAuth();

  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState('');
  const [negative, setNegative] = useState('');
  const [frames, setFrames] = useState(16);
  const [fps, setFps] = useState(8);
  const [steps, setSteps] = useState(12);
  const [resolution, setResolution] = useState<'256' | '384' | '512'>('256');
  const [seed, setSeed] = useState<number | null>(null);

  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoJobResult | null>(null);

  const [history, setHistory] = useState<VideoJob[]>([]);

  const checkHealth = useCallback(() => {
    api<{ healthy: boolean }>('/video/health', null)
      .then((r) => setHealthy(r.healthy))
      .catch(() => setHealthy(false));
  }, []);

  useEffect(() => {
    checkHealth();
    const t = setInterval(checkHealth, 20000);
    return () => clearInterval(t);
  }, [checkHealth]);

  const loadHistory = useCallback(() => {
    if (!token) return;
    api<{ jobs: VideoJob[] }>('/video/history', token)
      .then((r) => setHistory(r.jobs))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const generate = async () => {
    if (!prompt.trim() || !token) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const body = {
        prompt: prompt.trim(),
        negative_prompt: negative.trim() || undefined,
        num_frames: frames,
        fps,
        width: Number(resolution),
        height: Number(resolution),
        num_inference_steps: steps,
        seed: seed ?? null,
      };
      const r = await api<{ jobId: string }>('/video/generate', token, { method: 'POST', body });
      setJobId(r.jobId);
      pollStatus(r.jobId);
    } catch (e: any) {
      setError(e.message);
      setGenerating(false);
    }
  };

  const pollStatus = useCallback(async (id: string) => {
    const timer = setInterval(async () => {
      try {
        const s = await api<StatusResponse>(`/video/status/${id}`, token);
        setProgress(s.progress);
        if (s.status === 'done') {
          setResult(s.result);
          setGenerating(false);
          clearInterval(timer);
          loadHistory();
        } else if (s.status === 'failed') {
          setError(s.error || 'Video generation failed');
          setGenerating(false);
          clearInterval(timer);
        }
      } catch {
        // service temporarily unreachable; keep polling
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [token, loadHistory]);

  const statusLine = (job: VideoJob): string => {
    if (job.status === 'done') return 'Done';
    if (job.status === 'failed') return `Failed: ${job.error || ''}`;
    return 'Running / queued';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-50 dark:bg-suno-panel">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Video className="w-6 h-6 text-violet-500" />
          <h1 className="text-xl font-bold">AI Video Generator</h1>
          <span
            className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
              healthy === null
                ? 'bg-zinc-200 dark:bg-white/10 text-zinc-500'
                : healthy
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/15 text-red-500'
            }`}
          >
            {healthy === null ? 'Checking…' : healthy ? 'Engine ready' : 'Video service offline'}
          </span>
        </div>

        <div className="bg-white dark:bg-suno-panel rounded-xl border border-zinc-200 dark:border-white/10 p-4 space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the video scene, e.g. 'a lone astronaut walking through a neon city at night, cinematic'"
            rows={3}
            className="w-full rounded-lg bg-zinc-100 dark:bg-black/30 border border-zinc-200 dark:border-white/10 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            value={negative}
            onChange={(e) => setNegative(e.target.value)}
            placeholder="Negative prompt (optional) — e.g. 'blurry, distorted, watermark'"
            className="w-full rounded-lg bg-zinc-100 dark:bg-black/30 border border-zinc-200 dark:border-white/10 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            {[
              { label: 'Frames', value: frames, set: setFrames, min: 8, max: 32, step: 8 },
              { label: 'FPS', value: fps, set: setFps, min: 4, max: 30, step: 2 },
              { label: 'Steps', value: steps, set: setSteps, min: 4, max: 40, step: 2 },
            ].map((opt) => (
              <label key={opt.label} className="flex flex-col gap-1">
                <span className="text-zinc-500 dark:text-zinc-400">{opt.label}</span>
                <input
                  type="number"
                  value={opt.value}
                  min={opt.min}
                  max={opt.max}
                  step={opt.step}
                  onChange={(e) => (opt.set as (v: number) => void)(Number(e.target.value))}
                  className="rounded-lg bg-zinc-100 dark:bg-black/30 border border-zinc-200 dark:border-white/10 p-2 text-sm"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500 dark:text-zinc-400">Resolution</span>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as typeof resolution)}
                className="rounded-lg bg-zinc-100 dark:bg-black/30 border border-zinc-200 dark:border-white/10 p-2 text-sm"
              >
                <option value="256">256 × 256</option>
                <option value="384">384 × 384</option>
                <option value="512">512 × 512</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500 dark:text-zinc-400">Seed</span>
              <input
                type="number"
                value={seed ?? ''}
                placeholder="random"
                onChange={(e) => setSeed(e.target.value === '' ? null : Number(e.target.value))}
                className="rounded-lg bg-zinc-100 dark:bg-black/30 border border-zinc-200 dark:border-white/10 p-2 text-sm"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={generate}
              disabled={generating || !prompt.trim() || !healthy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate Video'}
            </button>
            <button
              onClick={() => { checkHealth(); loadHistory(); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-200 dark:bg-white/10 text-sm hover:bg-zinc-300 dark:hover:bg-white/20"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <span className="ml-auto text-xs text-zinc-400">
              {generating ? 'This can take several minutes on CPU.' : 'First run downloads ~7 GB of models.'}
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm break-words">{error}</div>
          )}

          {generating && (
            <div className="p-3 rounded-lg bg-violet-500/10 text-sm">
              <div className="flex justify-between mb-1 text-violet-600 dark:text-violet-400">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating video…
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {result && result.videoUrl && (
            <div className="p-3 rounded-lg bg-emerald-500/10 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                <Play className="w-4 h-4" /> Video ready
              </div>
              <video controls className="w-full rounded-lg bg-black" src={result.videoUrl} />
              <a
                href={result.videoUrl}
                download
                className="inline-flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <Download className="w-3.5 h-3.5" /> Download MP4
              </a>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold mb-2 text-zinc-500 dark:text-zinc-400">Recent generations</h2>
            <div className="space-y-2">
              {history.slice(0, 8).map((job) => (
                <div
                  key={job.id}
                  className="bg-white dark:bg-suno-panel rounded-lg border border-zinc-200 dark:border-white/10 p-3 text-sm flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-zinc-700 dark:text-zinc-300">
                      {job.params ? (() => { try { return JSON.parse(job.params).prompt; } catch { return job.id; } })() : job.id}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">{statusLine(job)}</div>
                  </div>
                  {job.status === 'done' && job.result && (() => {
                    try {
                      const r = JSON.parse(job.result);
                      if (r.videoUrl) return <video src={r.videoUrl} controls className="w-24 h-16 rounded bg-black object-cover" />;
                    } catch { /* ignore */ }
                    return null;
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
