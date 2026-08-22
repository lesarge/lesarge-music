import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, Clock, AlertCircle, RefreshCw, Terminal, Layers, ArrowRight, Activity } from 'lucide-react';
import { fetchJobs } from '../services/lesargeApi';
import { AiJob } from '../types';

export const JobQueueMonitor: React.FC = () => {
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = async () => {
    try {
      const data = await fetchJobs();
      setJobs(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono mb-2">
            <Cpu className="w-3.5 h-3.5" />
            Distributed Worker Pipeline
          </div>
          <h2 className="text-2xl font-bold">AI Job Queue & Model Routing</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Real-time status of Qwen 2.5 intent analysis, ACE-Step 1.5 music synthesis, Wan 2.2 video generation, and FFmpeg media rendering.
          </p>
        </div>

        <button
          onClick={loadJobs}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Status
        </button>
      </div>

      {/* Model Pipeline Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-700 uppercase font-mono mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          Automated Model Pipeline Flow
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center text-xs">
          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="font-bold text-indigo-900 font-mono">1. Qwen 2.5</div>
            <div className="text-[11px] text-indigo-700 mt-0.5">Prompt, Lyrics & Routing</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
            <div className="font-bold text-purple-900 font-mono">2. ACE-Step 1.5</div>
            <div className="text-[11px] text-purple-700 mt-0.5">Audio & Vocal Synthesis</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div className="font-bold text-blue-900 font-mono">3. Wan 2.2</div>
            <div className="text-[11px] text-blue-700 mt-0.5">Video & Scene Render</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="font-bold text-emerald-900 font-mono">4. FFmpeg</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">Sync, Stems & Waveform</div>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 text-base">No active jobs in queue</h3>
          <p className="text-xs text-slate-500 mt-1">
            Trigger a new generation in Creation Studio to see live progress here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : job.status === 'PROCESSING'
                          ? 'bg-indigo-100 text-indigo-800 animate-pulse'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {job.status}
                    </span>
                    <span className="text-xs font-mono text-slate-400">ID: {job.id}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-1">{job.title}</h3>
                </div>

                <div className="text-right text-xs font-mono text-slate-500">
                  Created: {new Date(job.createdAt).toLocaleTimeString()}
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>{job.currentStepMessage}</span>
                  <span className="font-mono text-indigo-600 font-bold">{job.progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${job.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Terminal Logs */}
              {job.logs && job.logs.length > 0 && (
                <div className="bg-slate-950 rounded-xl p-3 text-slate-300 font-mono text-[11px] space-y-1">
                  <div className="text-slate-500 text-[10px] flex items-center gap-1 border-b border-slate-800 pb-1 mb-1">
                    <Terminal className="w-3 h-3 text-indigo-400" />
                    <span>Worker Console Output</span>
                  </div>
                  {job.logs.map((log, i) => (
                    <div key={i} className="leading-relaxed truncate">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
