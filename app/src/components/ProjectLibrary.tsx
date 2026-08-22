import React, { useState } from 'react';
import { Play, Pause, Heart, Star, Download, Film, Music, Share2, Layers, Sparkles, Trash2, FileText, X, FileAudio } from 'lucide-react';
import { ProjectAsset } from '../types';
import { updateProjectReaction } from '../services/lesargeApi';
import { ExportFormatModal } from './ExportFormatModal';
import { downloadAsWav, downloadAsMp3, downloadAsMp4 } from '../utils/audioExporter';

interface ProjectLibraryProps {
  projects: ProjectAsset[];
  activeProject: ProjectAsset | null;
  isPlaying: boolean;
  onPlayProject: (project: ProjectAsset) => void;
  onRefreshProjects: () => void;
}

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({
  projects,
  activeProject,
  isPlaying,
  onPlayProject,
  onRefreshProjects,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'music' | 'video' | 'music_video'>('all');
  const [selectedLyricsProject, setSelectedLyricsProject] = useState<ProjectAsset | null>(null);
  const [exportModalProject, setExportModalProject] = useState<ProjectAsset | null>(null);

  const filteredProjects = projects.filter((p) => {
    if (filterMode === 'all') return true;
    return p.mode === filterMode;
  });

  const handleLike = async (p: ProjectAsset) => {
    await updateProjectReaction(p.id, 'like');
    onRefreshProjects();
  };

  const handleFavorite = async (p: ProjectAsset) => {
    await updateProjectReaction(p.id, 'favorite');
    onRefreshProjects();
  };

  const handleDelete = async (p: ProjectAsset) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await updateProjectReaction(p.id, 'delete');
    onRefreshProjects();
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono mb-2">
            <Layers className="w-3.5 h-3.5" />
            Media Assets Repository
          </div>
          <h2 className="text-2xl font-bold">Project Library & Stems</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Access finished audio tracks, generated music videos, isolated stems (Vocals, Drums, Bass), and Qwen song lyrics.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
          {(['all', 'music', 'video', 'music_video'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                filterMode === mode
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode === 'music_video' ? 'Music Video' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-2xl border border-slate-200">
          <Music className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 text-base">No media projects found</h3>
          <p className="text-xs text-slate-500 mt-1">
            Create your first song or video in Creation Studio!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => {
            const isThisActive = activeProject?.id === p.id;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border overflow-hidden transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                  isThisActive ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
                }`}
              >
                {/* Media Artwork & Play Badge */}
                <div className="relative aspect-video bg-slate-900 group overflow-hidden">
                  <img
                    src={p.thumbnailUrl}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                  {/* Play Overlay Button */}
                  <button
                    onClick={() => onPlayProject(p)}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      {isThisActive && isPlaying ? (
                        <Pause className="w-6 h-6 fill-white" />
                      ) : (
                        <Play className="w-6 h-6 fill-white ml-0.5" />
                      )}
                    </div>
                  </button>

                  {/* Mode Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-mono border border-white/10">
                    {p.mode === 'video' || p.mode === 'music_video' ? (
                      <Film className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <Music className="w-3 h-3 text-purple-400" />
                    )}
                    <span className="capitalize">{p.mode.replace('_', ' ')}</span>
                  </div>

                  {/* BPM & Key */}
                  <div className="absolute bottom-3 left-3 text-white">
                    <h3 className="font-bold text-sm leading-tight text-white drop-shadow">
                      {p.title}
                    </h3>
                    <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                      {p.genre} • {p.bpm} BPM • {p.keySignature}
                    </div>
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    "{p.prompt}"
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {p.instruments.slice(0, 4).map((inst, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80"
                      >
                        {inst}
                      </span>
                    ))}
                  </div>

                  {/* Model Tag */}
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 pt-1 border-t border-slate-100">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    <span>Model: {p.modelUsed}</span>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLike(p)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        p.isLiked
                          ? 'bg-red-50 border-red-200 text-red-600'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${p.isLiked ? 'fill-red-600' : ''}`} />
                    </button>

                    <button
                      onClick={() => handleFavorite(p)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        p.isFavorite
                          ? 'bg-amber-50 border-amber-200 text-amber-600'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-amber-500'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${p.isFavorite ? 'fill-amber-600' : ''}`} />
                    </button>

                    {p.lyrics && (
                      <button
                        onClick={() => setSelectedLyricsProject(p)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 transition-colors"
                        title="View Lyrics & Storyboard"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => downloadAsWav(p.audioUrl || '', p.title)}
                      className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-mono font-bold border border-indigo-200 transition-colors flex items-center gap-1"
                      title="Download Lossless WAV Audio"
                    >
                      <FileAudio className="w-3 h-3 text-indigo-600" />
                      <span>WAV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadAsMp3(p.audioUrl || '', p.title)}
                      className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-mono font-bold border border-purple-200 transition-colors flex items-center gap-1"
                      title="Download 320kbps MP3 Audio"
                    >
                      <Music className="w-3 h-3 text-purple-600" />
                      <span>MP3</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadAsMp4(p.videoUrl, p.audioUrl, p.title)}
                      className="px-2 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 text-[10px] font-mono font-bold border border-pink-200 transition-colors flex items-center gap-1"
                      title="Download 1080p HD MP4 Video"
                    >
                      <Film className="w-3 h-3 text-pink-600" />
                      <span>MP4</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportModalProject(p)}
                      className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                      title="All Export Formats & Stems"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lyrics & Storyboard Modal */}
      {selectedLyricsProject && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setSelectedLyricsProject(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-lg">
                {selectedLyricsProject.title}
              </h3>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono mb-2">
                Qwen Generated Lyrics
              </h4>
              <pre className="text-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed">
                {selectedLyricsProject.lyrics}
              </pre>
            </div>

            {selectedLyricsProject.storyboard && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase font-mono">
                  Wan 2.2 Storyboard Scenes
                </h4>
                <div className="space-y-2">
                  {selectedLyricsProject.storyboard.map((sc) => (
                    <div
                      key={sc.sceneNumber}
                      className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs"
                    >
                      <div className="flex justify-between font-semibold text-indigo-900 mb-1">
                        <span>Scene {sc.sceneNumber} ({sc.timeStartSec}s–{sc.timeEndSec}s)</span>
                        <span className="font-mono text-[10px] text-indigo-600">{sc.lighting}</span>
                      </div>
                      <p className="text-slate-700">{sc.visualPrompt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export & Download Format Modal */}
      <ExportFormatModal
        project={exportModalProject}
        isOpen={!!exportModalProject}
        onClose={() => setExportModalProject(null)}
      />
    </div>
  );
};
