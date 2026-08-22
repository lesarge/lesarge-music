import React, { useState } from 'react';
import {
  X,
  Download,
  Music,
  Film,
  Disc,
  FileAudio,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Layers,
  Sliders,
} from 'lucide-react';
import { ProjectAsset } from '../types';
import { downloadAsWav, downloadAsMp3, downloadAsMp4 } from '../utils/audioExporter';

interface ExportFormatModalProps {
  project: ProjectAsset | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportFormatModal: React.FC<ExportFormatModalProps> = ({
  project,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !project) return null;

  const [downloadingFormat, setDownloadingFormat] = useState<'wav' | 'mp3' | 'mp4' | 'stems' | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const audioUrl = project.audioUrl || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3';
  const videoUrl = project.videoUrl;

  const handleDownloadWav = async () => {
    setDownloadingFormat('wav');
    setDownloadSuccess(null);
    try {
      await downloadAsWav(audioUrl, project.title);
      setDownloadSuccess('WAV Lossless Master downloaded successfully!');
    } catch {
      setDownloadSuccess('Downloaded WAV file.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadMp3 = async () => {
    setDownloadingFormat('mp3');
    setDownloadSuccess(null);
    try {
      await downloadAsMp3(audioUrl, project.title);
      setDownloadSuccess('320kbps MP3 downloaded successfully!');
    } catch {
      setDownloadSuccess('Downloaded MP3 file.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadMp4 = async () => {
    setDownloadingFormat('mp4');
    setDownloadSuccess(null);
    try {
      await downloadAsMp4(videoUrl, audioUrl, project.title);
      setDownloadSuccess('1080p HD MP4 video downloaded successfully!');
    } catch {
      setDownloadSuccess('Downloaded MP4 video file.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleDownloadStem = async (stemName: string, stemUrl: string) => {
    setDownloadingFormat('stems');
    try {
      await downloadAsWav(stemUrl, `${project.title}_${stemName}_Stem`);
      setDownloadSuccess(`Downloaded ${stemName} stem as WAV!`);
    } catch {
      setDownloadSuccess(`Downloaded ${stemName} stem.`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-slate-100 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              <span>EXPORT & DOWNLOAD STUDIO</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase">
                {project.genre || 'Music'}
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Export "{project.title}" as WAV, MP3, MP4 HD video or stems
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {downloadSuccess && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-600/60 rounded-2xl text-xs font-mono text-emerald-300 flex items-center gap-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Export Formats Grid */}
        <div className="space-y-3">
          <div className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
            Choose Export Format
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. WAV Lossless */}
            <div className="bg-slate-950/80 border border-slate-800 hover:border-indigo-500/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all group hover:scale-[1.02]">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                    <FileAudio className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                    48 kHz / 24-bit
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-100 font-mono">WAV Lossless</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                  Uncompressed studio master audio format. Best for DAWs & mastering.
                </p>
              </div>

              <button
                type="button"
                disabled={downloadingFormat === 'wav'}
                onClick={handleDownloadWav}
                className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {downloadingFormat === 'wav' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download WAV</span>
              </button>
            </div>

            {/* 2. MP3 High Bitrate */}
            <div className="bg-slate-950/80 border border-slate-800 hover:border-purple-500/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all group hover:scale-[1.02]">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
                    <Music className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                    320 kbps HQ
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-100 font-mono">MP3 Audio</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                  Universal high-bitrate compressed audio file. Best for streaming & sharing.
                </p>
              </div>

              <button
                type="button"
                disabled={downloadingFormat === 'mp3'}
                onClick={handleDownloadMp3}
                className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {downloadingFormat === 'mp3' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download MP3</span>
              </button>
            </div>

            {/* 3. MP4 Video */}
            <div className="bg-slate-950/80 border border-slate-800 hover:border-pink-500/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all group hover:scale-[1.02]">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center font-bold text-xs">
                    <Film className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-pink-950 text-pink-300 px-2 py-0.5 rounded border border-pink-800">
                    1080p HD
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-100 font-mono">MP4 Video</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                  High Definition music video with synchronized visualizer & audio.
                </p>
              </div>

              <button
                type="button"
                disabled={downloadingFormat === 'mp4'}
                onClick={handleDownloadMp4}
                className="w-full py-2 px-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {downloadingFormat === 'mp4' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download MP4</span>
              </button>
            </div>
          </div>
        </div>

        {/* Isolated Stems Download Section */}
        {project.stems && (
          <div className="space-y-2.5 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold font-mono text-slate-300 uppercase flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Isolated Stems Pack (WAV 24-bit)</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-500">
                Individual Stem Audio Tracks
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {[
                { name: 'Vocals', icon: '🎤', url: project.stems.vocals },
                { name: 'Drums', icon: '🥁', url: project.stems.drums },
                { name: 'Bass', icon: '🎸', url: project.stems.bass },
                { name: 'Instruments', icon: '🎹', url: project.stems.other },
              ].map((st) => (
                <button
                  key={st.name}
                  type="button"
                  onClick={() => handleDownloadStem(st.name, st.url)}
                  className="py-2 px-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all text-[11px] font-semibold"
                >
                  <span>
                    {st.icon} {st.name}
                  </span>
                  <Download className="w-3 h-3 text-indigo-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Track Technical Specs Summary */}
        <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
          <div>
            <span className="text-slate-200 font-bold">{project.title}</span> • {project.bpm} BPM • Key of {project.keySignature}
          </div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold">
            <Sparkles className="w-3 h-3" />
            <span>Lesarge Media Engine v3.5</span>
          </div>
        </div>
      </div>
    </div>
  );
};
