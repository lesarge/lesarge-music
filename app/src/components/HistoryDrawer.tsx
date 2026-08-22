import React from 'react';
import { History, X, RotateCcw, Clock, Trash2 } from 'lucide-react';
import { HistoryEntry, FilterState } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onRestoreEntry: (filters: FilterState) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onRestoreEntry,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-slide-left">
      {/* Drawer Header */}
      <div className="bg-[#0f172a] px-4 py-3 border-b border-slate-800 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider">Matrix Snapshot History</h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Clock className="h-8 w-8 mx-auto opacity-40" />
            <p className="text-xs">No saved filter snapshots yet.</p>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              onClick={() => onRestoreEntry(item.filterState)}
              className="p-3 bg-white hover:bg-blue-50/50 rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 block">{item.label}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <RotateCcw className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
          ))
        )}
      </div>

      {/* Drawer Footer */}
      {history.length > 0 && (
        <div className="p-3 bg-white border-t border-slate-200">
          <button
            onClick={onClearHistory}
            className="w-full py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear History Timeline
          </button>
        </div>
      )}
    </div>
  );
};
