import React, { useState } from 'react';
import {
  Sliders,
  Grid,
  Palette,
  Sparkles,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { FilterState } from '../types';
import { DEFAULT_FILTER_STATE } from '../utils/canvasFilters';

interface FilterControlsProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  filters,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState<'adjust' | 'matrix' | 'channels' | 'effects' | 'presets'>('adjust');

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'sobel':
        onChange({
          ...DEFAULT_FILTER_STATE,
          edgeDetection: 'sobel',
          brightness: 10,
        });
        break;
      case 'cyber':
        onChange({
          ...DEFAULT_FILTER_STATE,
          hue: -25,
          saturation: 60,
          contrast: 30,
          sharpen: 3,
        });
        break;
      case 'vintage':
        onChange({
          ...DEFAULT_FILTER_STATE,
          sepia: true,
          contrast: 15,
          brightness: -5,
          noise: 15,
        });
        break;
      case 'noir':
        onChange({
          ...DEFAULT_FILTER_STATE,
          grayscale: true,
          contrast: 45,
          brightness: -10,
          sharpen: 2,
        });
        break;
      case 'blueprint':
        onChange({
          ...DEFAULT_FILTER_STATE,
          edgeDetection: 'prewitt',
          invert: true,
          threshold: 110,
        });
        break;
      case 'hdr':
        onChange({
          ...DEFAULT_FILTER_STATE,
          contrast: 35,
          saturation: 40,
          sharpen: 4,
          gamma: 1.15,
        });
        break;
      default:
        onChange(DEFAULT_FILTER_STATE);
    }
  };

  return (
    <aside className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0 overflow-hidden text-slate-800">
      {/* Inspector Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
          Matrix Inspector & Controls
        </span>
        <button
          onClick={() => onChange(DEFAULT_FILTER_STATE)}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <RotateCcw className="h-3 w-3" />
          Reset All
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center border-b border-slate-200 bg-slate-100/60 p-1 gap-1 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('adjust')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
            activeTab === 'adjust'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Adjust</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
            activeTab === 'matrix'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Grid className="h-3.5 w-3.5" />
          <span>Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
            activeTab === 'channels'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>RGB</span>
        </button>

        <button
          onClick={() => setActiveTab('effects')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
            activeTab === 'effects'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>FX</span>
        </button>

        <button
          onClick={() => setActiveTab('presets')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
            activeTab === 'presets'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Presets</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 flex-1 overflow-y-auto space-y-5 text-xs">
        {/* TAB 1: ADJUSTMENTS */}
        {activeTab === 'adjust' && (
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Luminance & Saturation
            </div>

            {/* Brightness */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-700">
                <span className="font-medium">Brightness</span>
                <span className="font-mono text-blue-600 font-bold">{filters.brightness}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={filters.brightness}
                onChange={(e) => updateFilter('brightness', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Contrast */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-700">
                <span className="font-medium">Contrast</span>
                <span className="font-mono text-blue-600 font-bold">{filters.contrast}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={filters.contrast}
                onChange={(e) => updateFilter('contrast', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-700">
                <span className="font-medium">Saturation</span>
                <span className="font-mono text-blue-600 font-bold">{filters.saturation}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={filters.saturation}
                onChange={(e) => updateFilter('saturation', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Hue */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-700">
                <span className="font-medium">Hue Rotation</span>
                <span className="font-mono text-blue-600 font-bold">{filters.hue}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={filters.hue}
                onChange={(e) => updateFilter('hue', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Gamma */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-700">
                <span className="font-medium">Gamma Curve</span>
                <span className="font-mono text-blue-600 font-bold">{filters.gamma.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.05"
                value={filters.gamma}
                onChange={(e) => updateFilter('gamma', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Toggles */}
            <div className="pt-2 grid grid-cols-3 gap-2">
              <button
                onClick={() => updateFilter('grayscale', !filters.grayscale)}
                className={`py-1.5 px-2 rounded border text-center font-medium transition-colors ${
                  filters.grayscale
                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Grayscale
              </button>
              <button
                onClick={() => updateFilter('sepia', !filters.sepia)}
                className={`py-1.5 px-2 rounded border text-center font-medium transition-colors ${
                  filters.sepia
                    ? 'bg-amber-50 border-amber-200 text-amber-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Sepia
              </button>
              <button
                onClick={() => updateFilter('invert', !filters.invert)}
                className={`py-1.5 px-2 rounded border text-center font-medium transition-colors ${
                  filters.invert
                    ? 'bg-purple-50 border-purple-200 text-purple-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Invert
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MATRIX & CONVOLUTIONS */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Convolutions & Kernels
            </div>

            <div className="space-y-2">
              <label className="font-semibold text-slate-700 block">Edge Detection Operator</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'none', label: 'Off' },
                  { id: 'sobel', label: 'Sobel Filter' },
                  { id: 'laplacian', label: 'Laplacian Kernel' },
                  { id: 'prewitt', label: 'Prewitt Filter' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateFilter('edgeDetection', item.id as any)}
                    className={`py-2 px-3 rounded border text-left font-medium transition-all ${
                      filters.edgeDetection === item.id
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sharpening */}
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-slate-700">
                <span className="font-medium">Sharpening Matrix Intensity</span>
                <span className="font-mono text-blue-600 font-bold">{filters.sharpen}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={filters.sharpen}
                onChange={(e) => updateFilter('sharpen', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Matrix Kernel Visualizer */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Active 3x3 Convolution Matrix
              </span>
              <div className="grid grid-cols-3 gap-1 font-mono text-xs text-center font-semibold">
                {filters.edgeDetection === 'sobel' ? (
                  <>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">-1</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-slate-400">0</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">1</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">-2</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-slate-400">0</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">2</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">-1</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-slate-400">0</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">1</div>
                  </>
                ) : (
                  <>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-slate-400">0</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">-{filters.sharpen}</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-slate-400">0</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">-{filters.sharpen}</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-emerald-600">
                      {1 + 4 * filters.sharpen}
                    </div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">-{filters.sharpen}</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-slate-400">0</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-blue-600">-{filters.sharpen}</div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded text-slate-400">0</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CHANNELS */}
        {activeTab === 'channels' && (
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              RGB Channel Gain Multipliers
            </div>

            {/* Red */}
            <div className="space-y-1">
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Red Gain</span>
                <span className="font-mono">{filters.redChannel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={filters.redChannel}
                onChange={(e) => updateFilter('redChannel', Number(e.target.value))}
                className="w-full accent-red-600 cursor-pointer"
              />
            </div>

            {/* Green */}
            <div className="space-y-1">
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Green Gain</span>
                <span className="font-mono">{filters.greenChannel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={filters.greenChannel}
                onChange={(e) => updateFilter('greenChannel', Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Blue */}
            <div className="space-y-1">
              <div className="flex justify-between text-blue-600 font-semibold">
                <span>Blue Gain</span>
                <span className="font-mono">{filters.blueChannel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={filters.blueChannel}
                onChange={(e) => updateFilter('blueChannel', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 4: EFFECTS */}
        {activeTab === 'effects' && (
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Binarization & Noise
            </div>

            {/* Threshold */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-700 font-semibold">
                <span>Binary Threshold</span>
                <span className="font-mono text-blue-600">{filters.threshold || 'Off'}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={filters.threshold}
                onChange={(e) => updateFilter('threshold', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Pixelate */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-700 font-semibold">
                <span>Pixel Size</span>
                <span className="font-mono text-blue-600">{filters.pixelate > 1 ? `${filters.pixelate}px` : 'Off'}</span>
              </div>
              <input
                type="range"
                min="1"
                max="40"
                value={filters.pixelate}
                onChange={(e) => updateFilter('pixelate', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Noise */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-700 font-semibold">
                <span>Grain Noise</span>
                <span className="font-mono text-blue-600">{filters.noise}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.noise}
                onChange={(e) => updateFilter('noise', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 5: PRESETS */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Curated Filter Matrices
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'sobel', name: 'Sobel Edges', desc: 'Structural outline' },
                { id: 'cyber', name: 'Cyberpunk', desc: 'Vibrant neon saturation' },
                { id: 'vintage', name: 'Analog Vintage', desc: 'Warm warm-tone sepia' },
                { id: 'noir', name: 'Film Noir', desc: 'High contrast monochrome' },
                { id: 'blueprint', name: 'Blueprint', desc: 'Architectural line art' },
                { id: 'hdr', name: 'HDR Boost', desc: 'Enhanced contrast' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className="p-2.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 rounded text-left transition-colors flex flex-col gap-0.5"
                >
                  <span className="font-bold text-xs text-slate-800">{p.name}</span>
                  <span className="text-[10px] text-slate-500">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
