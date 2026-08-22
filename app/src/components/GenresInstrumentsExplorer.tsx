import React, { useState } from 'react';
import { Search, Music, Disc, Globe, Layers, ArrowRight, Zap, Radio } from 'lucide-react';
import { INITIAL_GENRES } from '../data/genres';
import { INITIAL_INSTRUMENTS } from '../data/instruments';
import { Genre, Instrument } from '../types';

interface GenresInstrumentsExplorerProps {
  onSelectGenre: (genreName: string) => void;
  onSelectInstrument: (instrumentName: string) => void;
}

export const GenresInstrumentsExplorer: React.FC<GenresInstrumentsExplorerProps> = ({
  onSelectGenre,
  onSelectInstrument,
}) => {
  const [activeTab, setActiveTab] = useState<'genres' | 'instruments'>('genres');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const genreCategories = [
    'All',
    'African',
    'Pop & R&B',
    'Hip Hop',
    'Electronic',
    'Rock & Metal',
    'Jazz & Blues',
    'Latin & Caribbean',
    'World & Folk',
  ];

  const instrumentCategories = [
    'All',
    'Keyboard',
    'Strings',
    'Brass & Woodwinds',
    'Percussion & Drums',
    'Traditional & African',
    'Synthesizer & Electronic',
    'Vocals',
  ];

  const filteredGenres = INITIAL_GENRES.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.region.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || g.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredInstruments = INITIAL_INSTRUMENTS.filter((inst) => {
    const matchesSearch =
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.region.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || inst.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_70%)] pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-mono mb-2">
              <Globe className="w-3.5 h-3.5" />
              Comprehensive Music Matrix
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Genres & Instruments Ecosystem</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Explore 60+ global genres and 45+ organic and electronic instruments synthesized natively by Lesarge ACE-Step 1.5.
            </p>
          </div>

          {/* Toggle Tab */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700 shrink-0">
            <button
              onClick={() => {
                setActiveTab('genres');
                setSelectedCategory('All');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'genres'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Disc className="w-4 h-4" />
              Genres ({INITIAL_GENRES.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('instruments');
                setSelectedCategory('All');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'instruments'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Music className="w-4 h-4" />
              Instruments ({INITIAL_INSTRUMENTS.length})
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === 'genres' ? 'genres, regions, or BPM...' : 'instruments, families, or sounds...'}`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 no-scrollbar">
          {(activeTab === 'genres' ? genreCategories : instrumentCategories).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Display */}
      {activeTab === 'genres' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGenres.map((g) => (
            <div
              key={g.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-indigo-300 hover:shadow-lg transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold uppercase">
                      {g.category}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-indigo-600 transition-colors">
                      {g.name}
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {g.typical_bpm_min}–{g.typical_bpm_max} BPM
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-3">
                  {g.description}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="font-medium text-slate-700">Origin:</span> {g.region}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.instruments.slice(0, 4).map((inst, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60"
                      >
                        🎵 {inst}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectGenre(g.name)}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-600 rounded-xl text-xs font-semibold text-slate-700 transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
              >
                <span>Create with {g.name}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInstruments.map((inst) => (
            <div
              key={inst.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-indigo-300 hover:shadow-lg transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold uppercase">
                      {inst.category}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1 group-hover:text-purple-600 transition-colors">
                      {inst.name}
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {inst.family}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-3">
                  {inst.description}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Globe className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span className="font-medium text-slate-700">Region:</span> {inst.region}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {inst.typical_genres.slice(0, 3).map((tg, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100"
                      >
                        🎹 {tg}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectInstrument(inst.name)}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-purple-600 hover:text-white border border-slate-200 hover:border-purple-600 rounded-xl text-xs font-semibold text-slate-700 transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
              >
                <span>Add {inst.name} to Instruments</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
