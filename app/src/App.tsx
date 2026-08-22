import React, { useState, useEffect } from 'react';
import { LesargeHeader } from './components/LesargeHeader';
import { CreationStudio } from './components/CreationStudio';
import { AceStepStudio } from './components/AceStepStudio';
import { GenresInstrumentsExplorer } from './components/GenresInstrumentsExplorer';
import { PreferenceEngineView } from './components/PreferenceEngineView';
import { ProjectLibrary } from './components/ProjectLibrary';
import { JobQueueMonitor } from './components/JobQueueMonitor';
import { AdminConsole } from './components/AdminConsole';
import { PythonCodeModal } from './components/PythonCodeModal';
import { QwenAssistantDrawer } from './components/QwenAssistantDrawer';
import { UniversalInstallerManager } from './components/UniversalInstallerManager';
import { AIDiagnosticsView } from './components/AIDiagnosticsView';
import { InstallerWizardModal } from './components/InstallerWizardModal';
import { fetchProjects, fetchUserPreferences } from './services/lesargeApi';
import { ProjectAsset, PreferenceProfile } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('ace');
  const [projects, setProjects] = useState<ProjectAsset[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectAsset | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [userPreferences, setUserPreferences] = useState<PreferenceProfile | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isInstallerWizardOpen, setIsInstallerWizardOpen] = useState<boolean>(false);

  // Selected filters from matrix
  const [initialPrompt, setInitialPrompt] = useState<string>('');
  const [initialGenre, setInitialGenre] = useState<string | undefined>();
  const [initialInstrument, setInitialInstrument] = useState<string | undefined>();

  const loadData = async () => {
    try {
      const [projs, prefs] = await Promise.all([
        fetchProjects(),
        fetchUserPreferences(),
      ]);
      setProjects(projs);
      setUserPreferences(prefs);
      if (projs.length > 0 && !activeProject) {
        setActiveProject(projs[0]);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssetCreated = (newProject: ProjectAsset) => {
    setProjects((prev) => [newProject, ...prev]);
    setActiveProject(newProject);
    setIsPlaying(true);
    setActiveTab('creation');
  };

  const handleSelectGenreFromExplorer = (genreName: string) => {
    setInitialGenre(genreName);
    setInitialPrompt(`Create a modern ${genreName} track with authentic groove.`);
    setActiveTab('creation');
  };

  const handleSelectInstrumentFromExplorer = (instName: string) => {
    setInitialInstrument(instName);
    setInitialPrompt(`Compose an uplifting track featuring prominent ${instName}.`);
    setActiveTab('creation');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col antialiased">
      {/* Navigation Header */}
      <LesargeHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'code') {
            setIsCodeModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onOpenInstallerWizard={() => setIsInstallerWizardOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {activeTab === 'ace' && (
          <AceStepStudio onSwitchToOffline={() => setActiveTab('creation')} />
        )}

        {activeTab === 'creation' && (
          <CreationStudio
            userPreferences={userPreferences}
            onAssetCreated={handleAssetCreated}
            activeProject={activeProject}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onOpenAssistant={() => setIsAssistantOpen(true)}
            initialPrompt={initialPrompt}
            initialGenre={initialGenre}
            initialInstrument={initialInstrument}
          />
        )}

        {activeTab === 'installer' && (
          <UniversalInstallerManager
            onOpenInstallerWizard={() => setIsInstallerWizardOpen(true)}
          />
        )}

        {activeTab === 'diagnostics' && <AIDiagnosticsView />}

        {activeTab === 'matrix' && (
          <GenresInstrumentsExplorer
            onSelectGenre={handleSelectGenreFromExplorer}
            onSelectInstrument={handleSelectInstrumentFromExplorer}
          />
        )}

        {activeTab === 'preferences' && <PreferenceEngineView />}

        {activeTab === 'library' && (
          <ProjectLibrary
            projects={projects}
            activeProject={activeProject}
            isPlaying={isPlaying}
            onPlayProject={(p) => {
              setActiveProject(p);
              setIsPlaying(true);
              setActiveTab('creation');
            }}
            onRefreshProjects={loadData}
          />
        )}

        {activeTab === 'jobs' && <JobQueueMonitor />}

        {activeTab === 'admin' && <AdminConsole />}
      </main>

      {/* Installer Wizard Modal */}
      <InstallerWizardModal
        isOpen={isInstallerWizardOpen}
        onClose={() => setIsInstallerWizardOpen(false)}
        onLaunchApp={() => {
          setIsInstallerWizardOpen(false);
          setActiveTab('creation');
        }}
      />

      {/* Qwen AI Assistant Drawer */}
      <QwenAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onApplyPrompt={(p) => {
          setInitialPrompt(p);
          setActiveTab('creation');
        }}
      />

      {/* Ace Python / Code Editor Modal */}
      <PythonCodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        filters={{
          brightness: 0,
          contrast: 0,
          saturation: 0,
          hue: 0,
          gamma: 1,
          blur: 0,
          sharpen: 0,
          edgeDetection: 'none',
          threshold: 0,
          grayscale: false,
          sepia: false,
          invert: false,
          pixelate: 1,
          noise: 0,
          redChannel: 100,
          greenChannel: 100,
          blueChannel: 100,
        }}
      />
    </div>
  );
}

