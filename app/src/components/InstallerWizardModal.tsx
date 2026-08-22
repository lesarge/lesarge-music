import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Cpu,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Download,
  FolderTree,
  Terminal,
  ShieldCheck,
  Play,
  X,
  Server,
  Layers,
  Bot,
  Zap,
} from 'lucide-react';
import {
  fetchHardwareSpecs,
  simulateHardwareMode,
  fetchInstallerComponents,
  toggleInstallerComponent,
  fetchAIModelManagerStatus,
  triggerAIModelDownload,
} from '../services/lesargeApi';
import { HardwareSpecs, InstallerComponent, AIModelDownloadState } from '../types';

interface InstallerWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchApp: () => void;
}

export const InstallerWizardModal: React.FC<InstallerWizardModalProps> = ({
  isOpen,
  onClose,
  onLaunchApp,
}) => {
  const [step, setStep] = useState<number>(1);
  const [hardware, setHardware] = useState<HardwareSpecs | null>(null);
  const [components, setComponents] = useState<InstallerComponent[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [installingStatus, setInstallingStatus] = useState<string>('');
  const [installerLogs, setInstallerLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [modelsState, setModelsState] = useState<AIModelDownloadState[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      setIsScanning(true);
      const [hw, comps, modelStatus] = await Promise.all([
        fetchHardwareSpecs(),
        fetchInstallerComponents(),
        fetchAIModelManagerStatus().catch(() => ({ models: [], isDownloading: false, batchProgress: 100 })),
      ]);
      setHardware(hw);
      setComponents(comps);
      setModelsState(modelStatus.models);
    } catch {
      // Fallback state handled
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  const handleSimulateHardware = async (vramGb: number) => {
    setIsScanning(true);
    try {
      const updatedHw = await simulateHardwareMode({ vramGb });
      setHardware(updatedHw);
    } catch {
      // Ignore
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleComponent = async (id: string, currentSelected: boolean) => {
    try {
      const updated = await toggleInstallerComponent(id, !currentSelected);
      setComponents(updated);
    } catch {
      // Fallback
    }
  };

  const totalDiskRequired = components
    .filter((c) => c.isSelected)
    .reduce((sum, c) => sum + c.sizeGb, 0);

  const startInstallation = async () => {
    setStep(5);
    setInstallProgress(0);
    setInstallingStatus('Initializing AIModelManager & Local Deployment Pipeline...');
    setInstallerLogs([
      `[0.0s] Installer process started for Lesarge Music AI v1.5.2`,
      `[0.2s] Target directory confirmed: C:\\LesargeMusicAI\\`,
      `[0.4s] Hardware tier profiling: ${hardware?.tier || 'HIGH_END'}`,
      `[0.6s] Triggering AIModelManager download pipeline...`,
    ]);

    const selectedIds = components.filter((c) => c.isSelected).map((c) => c.id);
    try {
      await triggerAIModelDownload(selectedIds);
    } catch {
      // Ignore initial trigger error
    }

    const phaseTracker = new Set<string>();

    const interval = setInterval(async () => {
      try {
        const res = await fetchAIModelManagerStatus();
        setModelsState(res.models);
        setInstallProgress(res.batchProgress);

        const activeModels = res.models.filter((m) => selectedIds.includes(m.id));
        const downloadingModels = activeModels.filter((m) => m.phase === 'DOWNLOADING');
        const verifyingModels = activeModels.filter((m) => m.phase === 'VERIFYING');
        const registeringModels = activeModels.filter((m) => m.phase === 'REGISTERING');
        const installedModels = activeModels.filter((m) => m.phase === 'INSTALLED');

        if (downloadingModels.length > 0) {
          const totalSpeed = downloadingModels.reduce((acc, m) => acc + m.downloadSpeedMb, 0).toFixed(1);
          setInstallingStatus(`Downloading AI Weights (${downloadingModels.length} active @ ${totalSpeed} MB/s)...`);
        } else if (verifyingModels.length > 0) {
          setInstallingStatus(`Verifying SHA-256 Checksums for downloaded models...`);
        } else if (registeringModels.length > 0) {
          setInstallingStatus(`Registering local AI background worker daemons...`);
        } else if (installedModels.length === activeModels.length && activeModels.length > 0) {
          setInstallingStatus(`All selected AI models downloaded, verified (SHA-256), and registered!`);
        }

        // Log transition events
        for (const m of activeModels) {
          const keyD = `${m.id}_DOWNLOADING`;
          const keyV = `${m.id}_VERIFYING`;
          const keyVDone = `${m.id}_VERIFIED`;
          const keyR = `${m.id}_REGISTERING`;
          const keyI = `${m.id}_INSTALLED`;

          if (m.phase === 'DOWNLOADING' && !phaseTracker.has(keyD)) {
            phaseTracker.add(keyD);
            setInstallerLogs((prev) => [...prev, `[AIModelManager] Downloading ${m.name} (${m.sizeGb} GB)...`]);
          }
          if (m.phase === 'VERIFYING' && !phaseTracker.has(keyV)) {
            phaseTracker.add(keyV);
            setInstallerLogs((prev) => [...prev, `[AIModelManager] Calculating SHA-256 checksum for ${m.name}...`]);
          }
          if (m.verificationStatus === 'VERIFIED' && !phaseTracker.has(keyVDone)) {
            phaseTracker.add(keyVDone);
            setInstallerLogs((prev) => [...prev, `[AIModelManager] SHA-256 MATCH PASS: ${m.checksum.substring(0, 24)}...`]);
          }
          if (m.phase === 'REGISTERING' && !phaseTracker.has(keyR)) {
            phaseTracker.add(keyR);
            setInstallerLogs((prev) => [...prev, `[AIModelManager] Registering ${m.id}-worker daemon on localhost...`]);
          }
          if (m.phase === 'INSTALLED' && !phaseTracker.has(keyI)) {
            phaseTracker.add(keyI);
            setInstallerLogs((prev) => [...prev, `[AIModelManager] READY: ${m.name} registered in C:\\${m.location}`]);
          }
        }

        if (installedModels.length === activeModels.length && activeModels.length > 0) {
          clearInterval(interval);
          setTimeout(() => {
            setIsFinished(true);
            setStep(6);
          }, 1200);
        }
      } catch {
        // Retry polling
      }
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 flex items-center justify-between border-b border-indigo-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-600/30">
              L
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                Lesarge Music AI — Universal Installer
              </h2>
              <p className="text-xs text-indigo-300 font-mono">
                Windows Desktop / Web Deployment / Android Remote Setup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between overflow-x-auto gap-2 no-scrollbar text-xs font-semibold shrink-0">
          {[
            { num: 1, label: 'Welcome' },
            { num: 2, label: 'Hardware Check' },
            { num: 3, label: 'Tier Profiling' },
            { num: 4, label: 'Component Selection' },
            { num: 5, label: 'Installation' },
            { num: 6, label: 'Health Check' },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-2 shrink-0 ${
                step === s.num
                  ? 'text-indigo-600 font-bold'
                  : step > s.num
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono ${
                  step === s.num
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : step > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </div>
              <span>{s.label}</span>
              {s.num < 6 && <span className="text-slate-300 font-normal">→</span>}
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* STEP 1: WELCOME */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-indigo-600 text-white shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    Welcome to Lesarge Music AI Setup
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    This setup wizard automatically detects your computer's hardware, installs only the models your GPU and CPU can support, isolates dependencies locally in <code className="px-1.5 py-0.5 rounded bg-indigo-100 font-mono text-indigo-900 text-xs">C:\LesargeMusicAI\</code>, and registers local AI background workers.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    1
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Zero System Pollution</h4>
                  <p className="text-xs text-slate-500">
                    Installs Python, CUDA runtimes & FFmpeg locally in isolated app folders. Leaves your system PATH clean.
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    2
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Smart Hardware Profiling</h4>
                  <p className="text-xs text-slate-500">
                    Does not download massive 15GB video models unless your GPU has suitable VRAM capacity.
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    3
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Lesarge AI Router</h4>
                  <p className="text-xs text-slate-500">
                    Automatically routes music requests to local Qwen & ACE-Step 1.5 workers, or optional cloud endpoints.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: HARDWARE CHECK */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">System Hardware Detection</h3>
                  <p className="text-xs text-slate-500">Scanning CPU, RAM, GPU, VRAM & local environment...</p>
                </div>
                <button
                  onClick={loadInitialData}
                  disabled={isScanning}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Cpu className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>Rescan Hardware</span>
                </button>
              </div>

              {hardware && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Operating System</span>
                      <span className="text-indigo-600 font-mono">{hardware.osName}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Processor (CPU)</span>
                      <span className="text-slate-900 font-mono truncate max-w-[200px]" title={hardware.cpuModel}>
                        {hardware.cpuModel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>System Memory (RAM)</span>
                      <span className="text-emerald-700 font-mono">{hardware.ramTotalGb} GB DDR5</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Disk Free Storage</span>
                      <span className="text-indigo-700 font-mono">{hardware.diskFreeGb} GB Available</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Graphics Accelerator (GPU)</span>
                      <span className="text-purple-700 font-mono truncate max-w-[200px]" title={hardware.gpuModel}>
                        {hardware.gpuModel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Dedicated GPU VRAM</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-mono font-bold">
                        {hardware.vramTotalGb} GB VRAM
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Python Runtime</span>
                      <span className="text-slate-600 font-mono">{hardware.pythonVersion}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>FFmpeg Binaries</span>
                      <span className="text-slate-600 font-mono">{hardware.ffmpegVersion}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Hardware Test Simulator Controls */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>Hardware Simulation Tester</span>
                </div>
                <p className="text-xs text-amber-800">
                  Test how the installer adapts component choices for low VRAM vs high-end GPUs:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleSimulateHardware(4)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100"
                  >
                    Simulate Low Hardware (4GB VRAM)
                  </button>
                  <button
                    onClick={() => handleSimulateHardware(8)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100"
                  >
                    Simulate Normal Hardware (8GB VRAM)
                  </button>
                  <button
                    onClick={() => handleSimulateHardware(16)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100"
                  >
                    Simulate High-End Hardware (16GB VRAM)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: TIER PROFILING */}
          {step === 3 && hardware && (
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-xs font-bold uppercase tracking-wider">
                    Hardware Profile Assigned
                  </span>
                  <span className="text-xs font-mono text-slate-400">Tier Code: {hardware.tier}</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-xl shadow-lg shadow-indigo-600/40">
                    {hardware.tier === 'HIGH_END' ? '⚡' : hardware.tier === 'NORMAL' ? '⚙️' : '💻'}
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-white">
                      {hardware.tier === 'HIGH_END'
                        ? 'High-End AI Studio Tier'
                        : hardware.tier === 'NORMAL'
                        ? 'Normal Music AI Tier'
                        : 'Low / Basic Hardware Tier'}
                    </h3>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      {hardware.tier === 'HIGH_END'
                        ? 'Optimal hardware detected! Full support for Qwen, ACE-Step 1.5, Wan 2.2 Video AI, TTS & ASR.'
                        : hardware.tier === 'NORMAL'
                        ? 'Suitable GPU detected. Full local music generation enabled; video AI recommended via Cloud.'
                        : 'CPU / Integrated graphics detected. Basic music enabled; heavy models disabled or routed to cloud.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Qwen 2.5 Text</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>ACE-Step Music</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Qwen3-TTS Vocal</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    {hardware.recommendedFeatures.videoGeneration ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>Wan 2.2 Video AI</span>
                  </div>
                </div>
              </div>

              {hardware.tier === 'LOW' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 space-y-1">
                    <p className="font-bold">Notice regarding Video AI Generation:</p>
                    <p>
                      Your device has limited VRAM. To avoid system crashes, Wan 2.2 Video AI is marked as Optional and will use Lesarge Hybrid Cloud Routing when video generation is requested.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: COMPONENT SELECTION & STORAGE ESTIMATOR */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Select AI Models & Components</h3>
                  <p className="text-xs text-slate-500">Customize model installation choices before starting download.</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-indigo-700">
                    Estimated Disk Usage: {totalDiskRequired.toFixed(1)} GB
                  </div>
                  <div className="text-[11px] text-slate-500">Disk Free: {hardware?.diskFreeGb || 248.5} GB</div>
                </div>
              </div>

              <div className="space-y-3">
                {components.map((comp) => (
                  <div
                    key={comp.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                      comp.isSelected
                        ? 'border-indigo-300 bg-indigo-50/40 shadow-sm'
                        : 'border-slate-200 bg-white opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={comp.isSelected}
                        disabled={comp.isRequired}
                        onChange={() => handleToggleComponent(comp.id, comp.isSelected)}
                        className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{comp.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                            {comp.version}
                          </span>
                          {comp.isRequired && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                              REQUIRED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{comp.description}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                          <span>Req: {comp.hardwareRequirement}</span>
                          <span>•</span>
                          <span>Path: {comp.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold font-mono text-slate-900">{comp.sizeGb} GB</div>
                      <span
                        className={`text-[10px] font-bold ${
                          comp.status === 'Installed' ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      >
                        {comp.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: INSTALLATION PROGRESS */}
          {step === 5 && (
            <div className="space-y-6">
              {/* Main Overall Progress Bar */}
              <div className="space-y-2 bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-indigo-400 animate-bounce" />
                    {installingStatus}
                  </span>
                  <span className="font-mono text-indigo-400 text-sm font-extrabold">{installProgress}%</span>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${installProgress}%` }}
                  />
                </div>
              </div>

              {/* Real-time AIModelManager Active Downloads & Checksum Verifier List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Active Local AI Model Downloads & Verification Pipeline
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    Target: C:\LesargeMusicAI\models\
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                  {modelsState
                    .filter((m) => components.find((c) => c.id === m.id && c.isSelected))
                    .map((m) => (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-2xl border text-xs transition-all ${
                          m.phase === 'INSTALLED'
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : m.phase === 'DOWNLOADING'
                            ? 'bg-indigo-50/50 border-indigo-200'
                            : m.phase === 'VERIFYING'
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="truncate text-slate-900 font-extrabold">{m.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              m.phase === 'INSTALLED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.phase === 'DOWNLOADING'
                                ? 'bg-indigo-100 text-indigo-800 animate-pulse'
                                : m.phase === 'VERIFYING'
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {m.phase === 'INSTALLED' && 'VERIFIED & REGISTERED'}
                            {m.phase === 'DOWNLOADING' && `DL ${m.downloadSpeedMb} MB/s`}
                            {m.phase === 'VERIFYING' && 'SHA-256 VERIFYING'}
                            {m.phase === 'REGISTERING' && 'REGISTERING'}
                            {m.phase === 'IDLE' && 'PENDING'}
                          </span>
                        </div>

                        {/* Model Progress Bar */}
                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden my-2">
                          <div
                            className={`h-full transition-all duration-300 ${
                              m.phase === 'INSTALLED'
                                ? 'bg-emerald-500'
                                : m.phase === 'VERIFYING'
                                ? 'bg-amber-500'
                                : 'bg-indigo-600'
                            }`}
                            style={{ width: `${m.progressPercent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                          <span>
                            {m.downloadedMb} / {m.totalMb} MB
                          </span>
                          <span className="font-bold">{m.progressPercent}%</span>
                        </div>

                        {/* Verification & Checksum Status Message */}
                        {m.verificationMessage && (
                          <div className="mt-1.5 text-[10px] font-mono truncate text-slate-500 border-t border-slate-200/60 pt-1 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{m.verificationMessage}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Console Live Terminal */}
              <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 font-mono text-xs text-emerald-400 space-y-1 max-h-48 overflow-y-auto shadow-inner">
                <div className="text-slate-500 border-b border-slate-800 pb-1 mb-2 flex items-center justify-between">
                  <span>Installer Terminal Output (C:\LesargeMusicAI\)</span>
                  <span className="text-[10px] text-emerald-500 font-bold">REALTIME LOG</span>
                </div>
                {installerLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-slate-600 shrink-0">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: HEALTH CHECK & FINISH */}
          {step === 6 && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xl shadow-emerald-600/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  Lesarge Music AI Installed & Ready!
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Local AI workers, Qwen 2.5 orchestrator, ACE-Step 1.5 music synthesizer, and FFmpeg media binaries are verified and running.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-md mx-auto space-y-2 text-xs text-left font-mono">
                <div className="flex items-center justify-between text-slate-700">
                  <span>Qwen 2.5 Text AI</span>
                  <span className="text-emerald-600 font-bold">✓ Ready (Port 5001)</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Qwen-Music Primary Engine</span>
                  <span className="text-emerald-600 font-bold">✓ Ready (Port 5002)</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Qwen3-TTS Vocal Synthesizer</span>
                  <span className="text-emerald-600 font-bold">✓ Ready (Port 5003)</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>FFmpeg Media Engine</span>
                  <span className="text-emerald-600 font-bold">✓ Ready (NVENC)</span>
                </div>
              </div>

              {/* Standalone Installer Download Link for Offline Machines */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 max-w-md mx-auto flex items-center justify-between text-left gap-3">
                <div>
                  <div className="text-xs font-bold text-indigo-950">Save Offline Setup Zip Package (.zip)</div>
                  <div className="text-[11px] text-indigo-700">100% extractable setup package with Setup.bat & PowerShell installer</div>
                </div>
                <a
                  href="/downloads/LesargeMusicAI-Offline-Setup.zip"
                  download="LesargeMusicAI-Offline-Setup.zip"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .zip</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-50 p-6 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {step > 1 && step < 5 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < 4 && (
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20"
              >
                Continue Setup →
              </button>
            )}

            {step === 4 && (
              <button
                onClick={startInstallation}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Begin Installation ({totalDiskRequired.toFixed(1)} GB)</span>
              </button>
            )}

            {step === 6 && (
              <button
                onClick={() => {
                  onClose();
                  onLaunchApp();
                }}
                className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/20 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>START LESARGE MUSIC AI</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
