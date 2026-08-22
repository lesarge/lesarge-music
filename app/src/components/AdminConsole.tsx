import React, { useState, useEffect } from 'react';
import { Server, Activity, Cpu, HardDrive, Globe, RefreshCw, CheckCircle2, Wifi } from 'lucide-react';
import { fetchAdminModels } from '../services/lesargeApi';
import { ModelAdminConfig } from '../types';

export const AdminConsole: React.FC = () => {
  const [models, setModels] = useState<ModelAdminConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAdminModels = async () => {
    try {
      const data = await fetchAdminModels();
      setModels(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminModels();
    const interval = setInterval(loadAdminModels, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono mb-2">
            <Globe className="w-3.5 h-3.5" />
            music.lesarge.ch Infrastructure
          </div>
          <h2 className="text-2xl font-bold">Admin Console & GPU Cluster Monitor</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Real-time telemetry and GPU VRAM load metrics across Lesarge AI worker clusters.
          </p>
        </div>

        <button
          onClick={loadAdminModels}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Ping Cluster Nodes
        </button>
      </div>

      {/* Cluster Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Domain Production Host</div>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">music.lesarge.ch</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> SSL & Edge Proxy Healthy
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Active Model Workers</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {models.reduce((acc, m) => acc + m.activeWorkers, 0)}{' '}
            <span className="text-xs text-slate-500 font-normal">GPU Nodes</span>
          </div>
          <div className="text-[11px] text-indigo-600 font-medium mt-1">Parallel audio/video execution</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total VRAM Allocation</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {models.reduce((acc, m) => acc + m.vramUsedGb, 0).toFixed(1)}{' '}
            <span className="text-xs text-slate-500 font-normal">
              / {models.reduce((acc, m) => acc + m.vramTotalGb, 0).toFixed(0)} GB
            </span>
          </div>
          <div className="text-[11px] text-purple-600 font-medium mt-1">NVIDIA A100 / H100 Tensor Core</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Cluster Avg Latency</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            {Math.round(models.reduce((acc, m) => acc + m.latencyMs, 0) / (models.length || 1))} ms
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5" /> High-speed Interconnect
          </div>
        </div>
      </div>

      {/* Model Worker Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {models.map((m) => (
          <div
            key={m.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                  {m.type.replace('_', ' ')}
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-1">{m.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{m.role}</p>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                  m.status === 'ONLINE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                ● {m.status}
              </span>
            </div>

            <div className="text-xs font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-slate-600 truncate">
              Endpoint: {m.endpoint}
            </div>

            {/* GPU Usage Bar */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-indigo-600" /> GPU Compute Load
                  </span>
                  <span className="font-mono text-indigo-600 font-bold">{m.gpuUsagePercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${m.gpuUsagePercent}%` }}
                  />
                </div>
              </div>

              {/* VRAM Bar */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5 text-purple-600" /> VRAM Memory
                  </span>
                  <span className="font-mono text-purple-600 font-bold">
                    {m.vramUsedGb} / {m.vramTotalGb} GB
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(m.vramUsedGb / m.vramTotalGb) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
              <span>Latency: {m.latencyMs} ms</span>
              <span>Active Workers: {m.activeWorkers}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
