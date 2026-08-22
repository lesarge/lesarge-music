import React, { useEffect, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Columns,
  Info,
} from 'lucide-react';
import { FilterState } from '../types';
import { applyFiltersToCanvas } from '../utils/canvasFilters';

interface ImageCanvasProps {
  imageUrl: string;
  filters: FilterState;
  onCanvasUpdated: (targetCanvas: HTMLCanvasElement) => void;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  imageUrl,
  filters,
  onCanvasUpdated,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const filteredCanvasRef = useRef<HTMLCanvasElement>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const [splitPos, setSplitPos] = useState<number>(50);

  // Pixel Inspector state
  const [hoverPixel, setHoverPixel] = useState<{
    x: number;
    y: number;
    r: number;
    g: number;
    b: number;
    hex: string;
    lum: number;
  } | null>(null);

  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Load Image into source canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      const sourceCanvas = sourceCanvasRef.current;
      if (!sourceCanvas) return;

      sourceCanvas.width = img.naturalWidth;
      sourceCanvas.height = img.naturalHeight;

      const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }

      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setPan({ x: 0, y: 0 });
      setZoom(1);

      if (filteredCanvasRef.current) {
        applyFiltersToCanvas(sourceCanvas, filteredCanvasRef.current, filters);
        onCanvasUpdated(filteredCanvasRef.current);
      }
    };
  }, [imageUrl]);

  // Re-render filters when state changes
  useEffect(() => {
    const sourceCanvas = sourceCanvasRef.current;
    const filteredCanvas = filteredCanvasRef.current;
    if (sourceCanvas && filteredCanvas && sourceCanvas.width > 0) {
      applyFiltersToCanvas(sourceCanvas, filteredCanvas, filters);
      onCanvasUpdated(filteredCanvas);
    }
  }, [filters]);

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.25, 5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.25, 0.2));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    // Inspect pixel
    const canvas = filteredCanvasRef.current;
    if (!canvas || !containerRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);

    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        const r = p[0], g = p[1], b = p[2];
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        setHoverPixel({ x, y, r, g, b, hex, lum });
      }
    } else {
      setHoverPixel(null);
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="relative flex-1 bg-slate-100 flex flex-col items-center justify-center overflow-hidden select-none min-h-[420px]">
      {/* Hidden Source Canvas */}
      <canvas ref={sourceCanvasRef} className="hidden" />

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoverPixel(null);
        }}
        className={`w-full h-full flex items-center justify-center p-6 relative cursor-${
          isDragging ? 'grabbing' : 'grab'
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          className="relative max-w-full max-h-[68vh] flex items-center justify-center shadow-2xl rounded-xl overflow-hidden border border-slate-200 bg-white"
        >
          {/* Main Filtered Canvas */}
          <canvas
            ref={filteredCanvasRef}
            className="max-w-full max-h-[68vh] object-contain block"
          />

          {/* Split View */}
          {isSplitView && sourceCanvasRef.current && (
            <div
              style={{ width: `${splitPos}%` }}
              className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-blue-500 bg-white shadow-xl z-10"
            >
              <img
                src={imageUrl}
                alt="Before"
                className="max-w-none max-h-[68vh] object-contain block"
                style={{
                  width: filteredCanvasRef.current?.clientWidth,
                  height: filteredCanvasRef.current?.clientHeight,
                }}
              />
              <span className="absolute top-3 left-3 bg-slate-900/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow">
                Original
              </span>
            </div>
          )}

          {/* Split Slider */}
          {isSplitView && (
            <input
              type="range"
              min="0"
              max="100"
              value={splitPos}
              onChange={(e) => setSplitPos(Number(e.target.value))}
              className="absolute inset-x-0 bottom-2 z-20 w-4/5 mx-auto accent-blue-600 cursor-pointer"
            />
          )}
        </div>

        {/* Pixel Hover Inspector Overlay */}
        {hoverPixel && (
          <div className="absolute top-4 left-4 bg-white border border-slate-200 p-2.5 rounded-xl shadow-xl z-20 flex items-center gap-3 text-xs text-slate-800">
            <div
              className="w-7 h-7 rounded border border-slate-300 shadow-inner flex-shrink-0"
              style={{ backgroundColor: hoverPixel.hex }}
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-mono font-bold text-slate-900">
                <span>{hoverPixel.hex}</span>
                <span className="text-[10px] font-normal text-slate-400">
                  [{hoverPixel.x}, {hoverPixel.y}]
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <span className="text-red-600">R:{hoverPixel.r}</span>
                <span className="text-emerald-600">G:{hoverPixel.g}</span>
                <span className="text-blue-600">B:{hoverPixel.b}</span>
                <span className="text-slate-700">L:{hoverPixel.lum}</span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Floating Viewport Controls */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-lg text-slate-600 text-xs">
          <button
            onClick={() => setIsSplitView(!isSplitView)}
            className={`p-1.5 rounded transition-colors ${
              isSplitView
                ? 'bg-blue-50 text-blue-600 font-bold'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
            title="Split-Screen Original vs Processed"
          >
            <Columns className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-slate-200" />

          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-slate-100 transition-colors text-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="font-mono text-[11px] px-1 text-slate-600 font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-slate-100 transition-colors text-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded hover:bg-slate-100 transition-colors text-slate-500"
            title="Reset Zoom"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Image Dimensions Info Badge */}
        {imageSize.width > 0 && (
          <div className="absolute bottom-4 left-4 z-20 hidden md:flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm text-[11px] text-slate-600 font-mono">
            <Info className="h-3.5 w-3.5 text-blue-600" />
            <span>
              {imageSize.width} × {imageSize.height} px
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
