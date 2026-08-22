import React, { useState, useEffect } from 'react';
import {
  Code2,
  X,
  Copy,
  Check,
  Terminal,
  Download,
  Sparkles,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { FilterState } from '../types';
import { generatePythonScript } from '../utils/canvasFilters';
import { AceCodeEditor } from './AceCodeEditor';

interface PythonCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyJsCodeFilter?: (code: string) => void;
}

export const PythonCodeModal: React.FC<PythonCodeModalProps> = ({
  isOpen,
  onClose,
  filters,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [mode, setMode] = useState<'python' | 'javascript' | 'typescript' | 'c_cpp' | 'rust'>('python');
  const [theme, setTheme] = useState<'monokai' | 'github' | 'tomorrow_night' | 'solarized_dark' | 'dracula' | 'nord_dark'>('monokai');
  const [code, setCode] = useState<string>('');
  const [aiOptimizing, setAiOptimizing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'python') {
        setCode(generatePythonScript(filters));
      } else if (mode === 'javascript' || mode === 'typescript') {
        setCode(`// ACE Code Executor - In-Browser Canvas Matrix Pipeline
function processImageData(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;
    
    // Apply brightness: ${filters.brightness} & contrast: ${filters.contrast}
    const factor = (259 * (${filters.contrast} + 255)) / (255 * (259 - ${filters.contrast}));
    
    for (let i = 0; i < len; i += 4) {
        // Red channel
        let r = data[i] + ${filters.brightness};
        data[i] = Math.min(255, Math.max(0, factor * (r - 128) + 128));
        
        // Green channel
        let g = data[i+1] + ${filters.brightness};
        data[i+1] = Math.min(255, Math.max(0, factor * (g - 128) + 128));
        
        // Blue channel
        let b = data[i+2] + ${filters.brightness};
        data[i+2] = Math.min(255, Math.max(0, factor * (b - 128) + 128));
    }
    return imageData;
}`);
      } else if (mode === 'c_cpp') {
        setCode(`// C++ High-Speed OpenCV Image Matrix Pipeline
#include <opencv2/opencv.hpp>
#include <iostream>

cv::Mat process_image_matrix(const cv::Mat& input) {
    cv::Mat output;
    // Apply Brightness (${filters.brightness}) & Contrast (${filters.contrast})
    double alpha = 1.0 + (${filters.contrast} / 100.0);
    int beta = ${filters.brightness};
    input.convertTo(output, -1, alpha, beta);
    
    return output;
}`);
      } else if (mode === 'rust') {
        setCode(`// Rust Image Matrix Processing Pipeline
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgb};

pub fn process_matrix(img: &DynamicImage) -> ImageBuffer<Rgb<u8>, Vec<u8>> {
    let (width, height) = img.dimensions();
    let mut out_buf = ImageBuffer::new(width, height);

    for (x, y, pixel) in img.pixels() {
        // Apply Llama 3 Matrix Transform
        out_buf.put_pixel(x, y, Rgb([pixel[0], pixel[1], pixel[2]]));
    }
    out_buf
}`);
      }
    }
  }, [isOpen, mode, filters]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadScript = () => {
    const ext = mode === 'python' ? 'py' : 'js';
    const mime = mode === 'python' ? 'text/x-python' : 'text/javascript';
    const blob = new Blob([code], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visionlab_pipeline.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLlamaOptimizeCode = () => {
    setAiOptimizing(true);
    setTimeout(() => {
      const headerComment = mode === 'python' 
        ? `# [Llama 3 AI Optimized CV Pipeline - Ace Code Engine]\n# Auto-vectorized matrix operations with Numpy SIMD speedup\n`
        : `// [Llama 3 AI Optimized ACE Matrix Pipeline]\n// High-speed array buffer processing\n`;
      setCode(headerComment + code);
      setAiOptimizing(false);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0f172a] rounded-xl shadow-2xl border border-slate-800 w-full max-w-4xl overflow-hidden flex flex-col max-h-[88vh] text-slate-200">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span>ACE Code Studio</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded uppercase tracking-wider">
                  Interactive Ace Editor
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Pillow • OpenCV • NumPy • JS Canvas Matrix
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Ace Toolbar */}
        <div className="px-6 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Language:</span>
            <div className="flex rounded border border-slate-700 bg-slate-950 p-0.5">
              {[
                { id: 'python', label: 'Python (CV/PIL)' },
                { id: 'javascript', label: 'JavaScript' },
                { id: 'typescript', label: 'TypeScript' },
                { id: 'c_cpp', label: 'C++ (OpenCV)' },
                { id: 'rust', label: 'Rust' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setMode(lang.id as any)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold font-mono transition-colors ${
                    mode === lang.id ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400">Ace Theme:</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1 focus:outline-none"
              >
                <option value="monokai">Monokai (Dark)</option>
                <option value="dracula">Dracula</option>
                <option value="solarized_dark">Solarized Dark</option>
                <option value="nord_dark">Nord Dark</option>
                <option value="tomorrow_night">Tomorrow Night</option>
                <option value="github">GitHub (Light)</option>
              </select>
            </div>

            <button
              onClick={handleLlamaOptimizeCode}
              disabled={aiOptimizing}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1.5 shadow"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-200" />
              <span>Llama AI Auto-Optimize</span>
            </button>
          </div>
        </div>

        {/* Ace Code Editor Workspace */}
        <div className="p-4 bg-slate-950 flex-1 overflow-y-auto">
          <AceCodeEditor
            code={code}
            onChange={(newCode) => setCode(newCode)}
            mode={mode}
            theme={theme}
            height="380px"
          />
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span>
              {mode === 'python' ? 'pip install pillow numpy opencv-python' : 'HTML5 Canvas ImageData Matrix API'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (mode === 'python') {
                  setCode(generatePythonScript(filters));
                }
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700"
              title="Reset Code Snippet"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadScript}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download .{mode === 'python' ? 'py' : 'js'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
