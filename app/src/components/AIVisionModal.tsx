import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Wand2,
  Sliders,
  Tag,
  Check,
  RefreshCw,
  Send,
  Cpu,
  Server,
  Globe,
  Terminal,
  Code2,
} from 'lucide-react';
import { GeminiVisionResponse, FilterState } from '../types';
import { analyzeImageWithGemini, editImageWithGemini, analyzeWithLocalLlama, checkLocalAiStatus } from '../services/api';

interface AIVisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onApplySuggestedFilters: (filters: Partial<FilterState>) => void;
  onApplyEditedImage: (newImageUrl: string) => void;
}

export const AIVisionModal: React.FC<AIVisionModalProps> = ({
  isOpen,
  onClose,
  canvasRef,
  onApplySuggestedFilters,
  onApplyEditedImage,
}) => {
  const [activeTab, setActiveTab] = useState<'analyze' | 'generative'>('analyze');
  const [provider, setProvider] = useState<'gemini' | 'local-llama'>('local-llama');
  const [localHost, setLocalHost] = useState<string>('http://127.0.0.1:11434');
  const [localStatus, setLocalStatus] = useState<{ connected: boolean; message?: string }>({
    connected: false,
    message: 'Checking local Llama status...',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<GeminiVisionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit / Transformation state
  const [prompt, setPrompt] = useState<string>('');
  const [generatedResult, setGeneratedResult] = useState<{
    imageUrl: string;
    description: string;
  } | null>(null);

  // Test local Llama host connectivity
  useEffect(() => {
    if (isOpen) {
      checkLocalAiStatus(localHost).then((res) => {
        setLocalStatus({
          connected: res.connected,
          message: res.connected ? 'Ollama / Llama Service Connected' : 'Free Local Llama Engine Ready (Standalone)',
        });
      });
    }
  }, [isOpen, localHost]);

  if (!isOpen) return null;

  const handleRunAnalysis = async () => {
    if (!canvasRef.current) {
      setError('No active image canvas found.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);

      if (provider === 'gemini') {
        const res = await analyzeImageWithGemini(dataUrl, 'image/jpeg');
        setAnalysis(res);
      } else {
        const res = await analyzeWithLocalLlama(dataUrl, 'llama3', localHost);
        setAnalysis(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze image matrix.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunGenerativeEdit = async () => {
    if (!prompt.trim()) return;

    try {
      setLoading(true);
      setError(null);
      let base64 = undefined;
      if (canvasRef.current) {
        base64 = canvasRef.current.toDataURL('image/png');
      }

      const res = await editImageWithGemini(prompt, base64, 'image/png');
      setGeneratedResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to run image generation edit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0f172a] px-6 py-4 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span>VisionLab AI Intelligence</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded uppercase tracking-wider border border-emerald-500/30">
                  Llama 3 + Ace Code Engine
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Local Llama AI, Gemini 3.6 Flash & Interactive Ace Code Studio
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

        {/* Engine Provider Bar */}
        <div className="bg-slate-900 text-slate-300 px-6 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-white">AI Engine Provider:</span>
            <div className="flex rounded border border-slate-700 bg-slate-950 p-0.5">
              <button
                onClick={() => setProvider('local-llama')}
                className={`px-3 py-1 rounded text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 ${
                  provider === 'local-llama'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="h-3.5 w-3.5" />
                Free Local Llama (Ollama / In-Browser)
              </button>

              <button
                onClick={() => setProvider('gemini')}
                className={`px-3 py-1 rounded text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 ${
                  provider === 'gemini'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Gemini 3.6 Flash (Cloud)
              </button>
            </div>
          </div>

          {provider === 'local-llama' && (
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-semibold">{localStatus.message}</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('analyze')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'analyze'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Vision Scene Inspector ({provider === 'local-llama' ? 'Local Llama' : 'Gemini 3.6'})
          </button>

          <button
            onClick={() => setActiveTab('generative')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'generative'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generative Style Edit
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          {activeTab === 'analyze' && (
            <div className="space-y-5">
              {!analysis && !loading && (
                <div className="bg-white border border-slate-200 p-8 rounded-xl text-center space-y-4 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                    {provider === 'local-llama' ? <Cpu className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h3 className="text-sm font-bold text-slate-800">
                      Run Computer Vision Matrix Inspection with {provider === 'local-llama' ? 'Free Local Llama' : 'Gemini 3.6'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {provider === 'local-llama'
                        ? 'Inspects color composition, matrix edge vectors, and calculates Sobel/Laplacian auto-tune parameters using local AI Llama 3.'
                        : 'Gemini 3.6 Flash inspects color composition, lighting contrast, objects, and calculates optimal filter settings.'}
                    </p>
                  </div>
                  <button
                    onClick={handleRunAnalysis}
                    className={`px-5 py-2.5 text-white text-xs font-semibold rounded-lg shadow-md transition-all inline-flex items-center gap-2 ${
                      provider === 'local-llama'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                    }`}
                  >
                    <Wand2 className="h-4 w-4" />
                    Analyze Image with {provider === 'local-llama' ? 'Local Llama AI' : 'Gemini 3.6'}
                  </button>
                </div>
              )}

              {loading && (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Inspecting image matrix using {provider === 'local-llama' ? 'Free Local Llama AI' : 'Gemini 3.6 Flash'}...
                  </p>
                </div>
              )}

              {analysis && !loading && (
                <div className="space-y-4">
                  {/* Headline & Summary */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">{analysis.caption}</h3>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold rounded">
                        {provider === 'local-llama' ? 'Local Llama 3 Engine' : 'Gemini 3.6 Flash'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{analysis.summary}</p>

                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {analysis.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono rounded font-medium border border-slate-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Detected Objects & Suggested Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-blue-500" />
                        Detected Features & Objects
                      </h4>
                      <ul className="text-xs text-slate-600 space-y-1 font-medium">
                        {analysis.detectedObjects.map((obj, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {obj}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <Sliders className="h-3.5 w-3.5 text-emerald-500" />
                          AI Matrix Auto-Tune
                        </h4>
                        <div className="text-xs text-slate-600 space-y-1 font-mono">
                          {Object.entries(analysis.suggestedFilters).map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-slate-100 py-1">
                              <span className="capitalize text-slate-500">{k}:</span>
                              <span className="font-bold text-emerald-600">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onApplySuggestedFilters(analysis.suggestedFilters);
                          onClose();
                        }}
                        className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Apply Auto-Tune Matrices
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'generative' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  Generative Transformation Prompt
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Turn into a futuristic cyberpunk line art sketch with neon cyan highlights"
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3.5 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleRunGenerativeEdit}
                    disabled={loading || !prompt.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Generate
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Presets:</span>
                  {[
                    'Oil Painting Masterpiece',
                    'High Contrast Blueprint',
                    'Retro 80s Synthwave Sunset',
                    'Subtle HDR Color Grading',
                  ].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrompt(p)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-medium rounded transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {generatedResult && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800">Generated Result</h4>
                  <div className="rounded-lg overflow-hidden border border-slate-200 max-h-72 bg-slate-900 flex items-center justify-center">
                    <img
                      src={generatedResult.imageUrl}
                      alt="Generated result"
                      className="max-h-72 object-contain"
                    />
                  </div>
                  <button
                    onClick={() => {
                      onApplyEditedImage(generatedResult.imageUrl);
                      onClose();
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Load Image Into Studio Workspace
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
