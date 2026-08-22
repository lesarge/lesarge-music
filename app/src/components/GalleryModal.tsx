import React from 'react';
import { X, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { PRESET_IMAGES } from '../data/presetImages';
import { PresetImage } from '../types';

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImage: PresetImage | null;
  onSelectImage: (image: PresetImage) => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  isOpen,
  onClose,
  selectedImage,
  onSelectImage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="bg-[#0f172a] px-6 py-4 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-semibold tracking-tight">Image Matrix Benchmark Library</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-4">
          <p className="text-xs text-slate-500">
            Select a calibrated high-resolution test pattern to analyze color space, convolution matrices, and edge kernels.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRESET_IMAGES.map((img) => {
              const isSelected = selectedImage?.id === img.id;
              return (
                <div
                  key={img.id}
                  onClick={() => {
                    onSelectImage(img);
                    onClose();
                  }}
                  className={`group relative bg-white rounded-xl border transition-all cursor-pointer overflow-hidden shadow-sm hover:shadow-md ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="h-36 w-full overflow-hidden relative bg-slate-100">
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
                      {img.category}
                    </span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-white p-1 rounded-full shadow">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 space-y-1">
                    <h3 className="text-xs font-bold text-slate-800 truncate">{img.name}</h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {img.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
