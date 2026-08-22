import React, { useState } from 'react';
import {
  BarChart2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Palette,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { HistogramDataPoint, DominantColor } from '../types';

interface HistogramPanelProps {
  histogramData: HistogramDataPoint[];
  dominantColors: DominantColor[];
}

export const HistogramPanel: React.FC<HistogramPanelProps> = ({
  histogramData,
  dominantColors,
}) => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeChannel, setActiveChannel] = useState<'all' | 'red' | 'green' | 'blue' | 'lum'>('all');

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1800);
  };

  return (
    <div className="bg-white border-t border-slate-200 text-slate-800 p-4 transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Pixel Matrix Analytics & Color Histogram
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Channel Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200 text-[10px] font-mono">
            {(['all', 'red', 'green', 'blue', 'lum'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`px-2 py-0.5 rounded transition-colors uppercase font-bold ${
                  activeChannel === ch
                    ? 'bg-white text-blue-600 border border-slate-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* Histogram Chart */}
          <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200 h-40 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-1">
              <span>0 (Dark)</span>
              <span>255 (Bright)</span>
            </div>

            <div className="w-full h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={histogramData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis dataKey="bin" tick={{ fill: '#64748b', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#0f172a',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  {(activeChannel === 'all' || activeChannel === 'red') && (
                    <Area
                      type="monotone"
                      dataKey="red"
                      stroke="#ef4444"
                      fill="#f87171"
                      fillOpacity={0.25}
                    />
                  )}
                  {(activeChannel === 'all' || activeChannel === 'green') && (
                    <Area
                      type="monotone"
                      dataKey="green"
                      stroke="#10b981"
                      fill="#34d399"
                      fillOpacity={0.25}
                    />
                  )}
                  {(activeChannel === 'all' || activeChannel === 'blue') && (
                    <Area
                      type="monotone"
                      dataKey="blue"
                      stroke="#3b82f6"
                      fill="#60a5fa"
                      fillOpacity={0.25}
                    />
                  )}
                  {activeChannel === 'lum' && (
                    <Area
                      type="monotone"
                      dataKey="luminance"
                      stroke="#64748b"
                      fill="#94a3b8"
                      fillOpacity={0.3}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dominant Color Swatches */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 h-40 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
              <Palette className="h-3.5 w-3.5 text-blue-600" />
              <span>Extracted Palette</span>
            </div>

            <div className="space-y-1">
              {dominantColors.map((col, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200 text-xs shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border border-slate-300 shadow-inner"
                      style={{ backgroundColor: col.hex }}
                    />
                    <div className="font-mono text-[11px] font-bold text-slate-800">
                      {col.hex}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">
                      {col.percentage}%
                    </span>
                    <button
                      onClick={() => handleCopyHex(col.hex)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Copy Hex Code"
                    >
                      {copiedHex === col.hex ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
