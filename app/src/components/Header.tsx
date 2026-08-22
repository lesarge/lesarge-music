import React from 'react';
import {
  Sparkles,
  Code2,
  Image as ImageIcon,
  Upload,
  RotateCcw,
  History,
  Activity,
  Download,
} from 'lucide-react';
import { PresetImage } from '../types';

interface HeaderProps {
  currentImage: PresetImage | null;
  onOpenGallery: () => void;
  onOpenAIModal: () => void;
  onOpenCodeModal: () => void;
  onToggleHistory: () => void;
  onResetFilters: () => void;
  onUploadImage: (file: File) => void;
  onExportImage: () => void;
  isAiLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentImage,
  onOpenGallery,
  onOpenAIModal,
  onOpenCodeModal,
  onToggleHistory,
  onResetFilters,
  onUploadImage,
  onExportImage,
  isAiLoading,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage(e.target.files[0]);
    }
  };

  return (
    <header className="h-14 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between px-6 shrink-0 text-slate-200 sticky top-0 z-30 shadow-md">
      {/* Brand & Project Name */}
      <div className="flex items-center space-x-4">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-sm shadow-blue-900/30">
          V
        </div>
        <div className="h-4 w-px bg-slate-700 mx-2 hidden sm:block"></div>
        <div className="text-sm font-medium text-slate-300 hidden sm:block">
          Project: <span className="text-white font-semibold">VisionLab Matrix_v2</span>
        </div>
        <div className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-[10px] rounded uppercase tracking-wider font-mono font-bold border border-emerald-800/80 hidden md:inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Llama 3 + Ace Engine
        </div>
      </div>

      {/* Center Image Controls */}
      <div className="flex items-center space-x-2 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
        <button
          onClick={onOpenGallery}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
          <span className="truncate max-w-[120px]">
            {currentImage ? currentImage.name : 'Preset Library'}
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 text-slate-300 hover:text-white transition-colors"
          title="Upload custom image"
        >
          <Upload className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden sm:inline">Upload</span>
        </button>

        <div className="h-3 w-px bg-slate-700" />

        <button
          onClick={onResetFilters}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 text-slate-400 hover:text-slate-200 transition-colors"
          title="Reset active filters"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenAIModal}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded shadow-lg shadow-blue-900/20 transition-all flex items-center gap-1.5"
        >
          <Sparkles className={`h-3.5 w-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">AI Studio</span>
        </button>

        <button
          onClick={onOpenCodeModal}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded border border-slate-700 transition-colors flex items-center gap-1.5"
          title="Export Python Script"
        >
          <Code2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="hidden md:inline">Python</span>
        </button>

        <button
          onClick={onToggleHistory}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
          title="History Timeline"
        >
          <History className="h-4 w-4" />
        </button>

        <button
          onClick={onExportImage}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded border border-slate-700 transition-colors"
          title="Download Rendered Image"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
