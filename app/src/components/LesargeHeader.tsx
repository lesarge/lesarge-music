import React from 'react';
import {
  Sparkles,
  Music,
  Disc,
  Brain,
  Layers,
  Cpu,
  Server,
  Code,
  Bot,
  Globe,
  Download,
  Activity,
} from 'lucide-react';

interface LesargeHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenAssistant: () => void;
  onOpenInstallerWizard?: () => void;
}

export const LesargeHeader: React.FC<LesargeHeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenAssistant,
  onOpenInstallerWizard,
}) => {
  const navTabs = [
    { id: 'ace', label: 'ACE-Step AI', icon: Music },
    { id: 'creation', label: 'Offline Engine', icon: Sparkles },
    { id: 'installer', label: 'Installer System', icon: Download },
    { id: 'diagnostics', label: 'AI Diagnostics', icon: Activity },
    { id: 'matrix', label: 'Genres & Instruments', icon: Disc },
    { id: 'preferences', label: 'Preference Engine', icon: Brain },
    { id: 'library', label: 'Project Library', icon: Layers },
    { id: 'jobs', label: 'Job Queue', icon: Cpu },
    { id: 'admin', label: 'Admin Console', icon: Server },
    { id: 'code', label: 'Python Editor', icon: Code },
  ];


  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 font-sans shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo & Web Admin Tag */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-600/20">
              L
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-base tracking-tight">
                  Lesarge Music AI
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono font-bold">
                  v1.5
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                <Globe className="w-3 h-3 text-emerald-500" />
                <span>music.lesarge.ch</span>
              </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right AI Assistant & Status Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAssistant}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all group"
            >
              <Bot className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Qwen 2.5 Assistant</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex lg:hidden overflow-x-auto pb-2 gap-1 no-scrollbar border-t border-slate-100 pt-2">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
