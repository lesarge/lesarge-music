import React, { useEffect, useState } from 'react';
import { Cpu, Server, Music2, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

interface AceStatus {
  frontend: boolean;
  backend: boolean;
  model: boolean;
}

interface AceStepStudioProps {
  onSwitchToOffline: () => void;
}

export const AceStepStudio: React.FC<AceStepStudioProps> = ({ onSwitchToOffline }) => {
  const [status, setStatus] = useState<AceStatus | null>(null);
  const [checking, setChecking] = useState(true);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/lesarge/ace-status');
      const data = await res.json();
      setStatus({ frontend: !!data.frontend, backend: !!data.backend, model: !!data.model });
    } catch {
      setStatus({ frontend: false, backend: false, model: false });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 8000);
    return () => clearInterval(timer);
  }, []);

  const pill = (label: string, ok: boolean | undefined, icon: React.ReactNode) => (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
        ok === undefined
          ? 'bg-slate-100 border-slate-200 text-slate-500'
          : ok
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-rose-50 border-rose-200 text-rose-700'
      }`}
    >
      {icon}
      {label}
      <span
        className={`w-2 h-2 rounded-full ${
          ok === undefined ? 'bg-slate-400' : ok ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-fuchsia-600/20">
            <Music2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-slate-900 text-sm tracking-tight">
                ACE-Step 1.5 Studio
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 text-[10px] font-mono font-bold">
                LOCAL AI ENGINE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Open-source Suno alternative — free, local, unlimited
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pill('Frontend :3002', status?.frontend, <Server className="w-3.5 h-3.5" />)}
          {pill('API :3001', status?.backend, <Cpu className="w-3.5 h-3.5" />)}
          {pill('ACE-Step Model :8001 (GPU)', status?.model, <Cpu className="w-3.5 h-3.5" />)}
          <button
            onClick={() => {
              setChecking(true);
              checkStatus();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors"
            title="Re-check status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            Check
          </button>
        </div>
      </div>

      {/* GPU / model warning */}
      {status && !status.model && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-bold text-amber-800">
              ACE-Step model is not running on this PC
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              The AI model requires an NVIDIA GPU with 4GB+ VRAM (CUDA). This machine only has Intel
              integrated graphics, so music generation here is unavailable. You can still explore the
              studio UI — it will work instantly if you run this setup on a PC with an NVIDIA GPU
              (start{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">ace-step-api --port 8001</code>).
            </p>
          </div>
          <button
            onClick={onSwitchToOffline}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-colors"
          >
            Use Offline Engine instead
          </button>
        </div>
      )}

      {/* Studio iframe */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/60">
          <span className="text-[11px] font-mono text-slate-500">http://localhost:3002</span>
          <a
            href="http://localhost:3002"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
          >
            Open in new tab <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <iframe
          src="http://localhost:3002"
          title="ACE-Step 1.5 Studio"
          className="w-full border-0"
          style={{ height: 'calc(100vh - 260px)', minHeight: 520 }}
        />
      </div>
    </div>
  );
};
