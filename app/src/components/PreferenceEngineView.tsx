import React, { useState, useEffect } from 'react';
import { Brain, Sliders, RotateCcw, ShieldCheck, Activity, BarChart3, Check, RefreshCw } from 'lucide-react';
import { fetchUserPreferences, updateUserPreferences } from '../services/lesargeApi';
import { PreferenceProfile } from '../types';

export const PreferenceEngineView: React.FC = () => {
  const [profile, setProfile] = useState<PreferenceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const data = await fetchUserPreferences();
      setProfile(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const handleToggleLearning = async () => {
    if (!profile) return;
    setUpdating(true);
    try {
      const updated = await updateUserPreferences({ learningEnabled: !profile.learningEnabled });
      setProfile(updated);
    } finally {
      setUpdating(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset your personalization profile?')) return;
    setUpdating(true);
    try {
      const updated = await updateUserPreferences({ reset: true } as any);
      setProfile(updated);
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mr-2" />
        <span className="text-sm font-medium text-slate-600">Loading User Preference Profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono mb-2">
            <Brain className="w-3.5 h-3.5" />
            Structured Personalization Layer
          </div>
          <h2 className="text-2xl font-bold">User Preference & Learning Engine</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Personalization adapts Qwen context parameters dynamically without destructive model retraining. Your creation likes and play counts update affinity scores for ACE-Step 1.5.
          </p>
        </div>

        {/* Master Learning Switch */}
        <div className="flex items-center gap-3 bg-slate-800/90 p-3 rounded-2xl border border-slate-700 shrink-0">
          <div>
            <div className="text-xs font-semibold text-white">AI Learning Engine</div>
            <div className="text-[10px] text-slate-400">
              {profile.learningEnabled ? 'Tracking creation preferences' : 'Learning disabled'}
            </div>
          </div>
          <button
            onClick={handleToggleLearning}
            disabled={updating}
            className={`w-12 h-6 rounded-full p-1 transition-colors relative ${
              profile.learningEnabled ? 'bg-indigo-600' : 'bg-slate-600'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                profile.learningEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total AI Generations</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{profile.totalGenerations}</div>
          <div className="text-[11px] text-indigo-600 font-medium mt-1">Processed via Qwen + ACE-Step</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Liked Tracks & Videos</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{profile.totalLikes}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Positive affinity signals</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Preferred BPM Tempo</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {profile.preferredBpmMin}–{profile.preferredBpmMax} <span className="text-xs text-slate-500 font-normal">BPM</span>
          </div>
          <div className="text-[11px] text-purple-600 font-medium mt-1">Mid-tempo groove zone</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Profile Status</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Active
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">music.lesarge.ch sync ready</div>
        </div>
      </div>

      {/* Affinity Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Genre Affinities */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Genre Affinity Scores
            </h3>
            <span className="text-[11px] font-mono text-slate-500">% Affinity Weight</span>
          </div>

          <div className="space-y-3">
            {Object.entries(profile.genreScores || {}).map(([genre, score]) => (
              <div key={genre}>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>{genre}</span>
                  <span className="font-mono text-indigo-600">{score}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(Number(score), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instrument Affinities */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-600" />
              Instrument Affinity Scores
            </h3>
            <span className="text-[11px] font-mono text-slate-500">% Affinity Weight</span>
          </div>

          <div className="space-y-3">
            {Object.entries(profile.instrumentScores || {}).map(([inst, score]) => (
              <div key={inst}>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>{inst}</span>
                  <span className="font-mono text-purple-600">{score}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(Number(score), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Log Audit Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Preference Learning Audit Log
            </h3>
            <p className="text-xs text-slate-500">
              Recent user interactions captured by the Lesarge Preference Engine
            </p>
          </div>

          <button
            onClick={handleReset}
            disabled={updating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Learning History
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-mono text-[11px]">
                <th className="pb-2 font-medium">Timestamp</th>
                <th className="pb-2 font-medium">Action Event</th>
                <th className="pb-2 font-medium">Qwen Context Impact Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {profile.historyLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 font-mono text-[11px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 font-semibold text-slate-900">{log.action}</td>
                  <td className="py-2.5 text-slate-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
