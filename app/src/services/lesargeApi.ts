import {
  CreationMode,
  CustomizeParameters,
  ProjectAsset,
  PreferenceProfile,
  AiJob,
  Genre,
  Instrument,
  ModelAdminConfig,
  AIModelDownloadState,
} from '../types';

export async function createLesargeAsset(payload: {
  prompt: string;
  mode: CreationMode;
  customizeParams?: Partial<CustomizeParameters>;
  userPreferences?: PreferenceProfile;
  generatedAudio?: { durationSec?: number; waveformData?: number[] };
}): Promise<{ job: AiJob; project: ProjectAsset }> {
  const response = await fetch('/api/lesarge/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Creation failed with status ${response.status}`);
  }

  return await response.json();
}

export async function uploadProjectAudio(
  id: string,
  blob: Blob,
  durationSec: number,
  waveformData?: number[]
): Promise<{ audioUrl: string; durationSec: number; size: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'audio/wav',
    'X-Duration-Sec': String(durationSec),
  };
  if (waveformData && waveformData.length > 0) {
    headers['X-Waveform-Data'] = btoa(JSON.stringify(waveformData));
  }

  const response = await fetch(`/api/lesarge/projects/${id}/audio`, {
    method: 'POST',
    headers,
    body: blob,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Audio upload failed with status ${response.status}`);
  }

  return await response.json();
}

export async function fetchProjects(): Promise<ProjectAsset[]> {
  const res = await fetch('/api/lesarge/projects');
  if (!res.ok) throw new Error('Failed to fetch projects');
  const data = await res.json();
  return data.projects || [];
}

export async function updateProjectReaction(id: string, action: 'like' | 'favorite' | 'delete'): Promise<ProjectAsset | null> {
  const res = await fetch(`/api/lesarge/projects/${id}/reaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error('Reaction failed');
  const data = await res.json();
  return data.project || null;
}

export async function fetchUserPreferences(): Promise<PreferenceProfile> {
  const res = await fetch('/api/lesarge/preferences');
  if (!res.ok) throw new Error('Failed to fetch preferences');
  const data = await res.json();
  return data.profile;
}

export async function updateUserPreferences(payload: Partial<PreferenceProfile>): Promise<PreferenceProfile> {
  const res = await fetch('/api/lesarge/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update preferences');
  const data = await res.json();
  return data.profile;
}

export async function fetchJobs(): Promise<AiJob[]> {
  const res = await fetch('/api/lesarge/jobs');
  if (!res.ok) throw new Error('Failed to fetch jobs');
  const data = await res.json();
  return data.jobs || [];
}

export async function fetchAdminModels(): Promise<ModelAdminConfig[]> {
  const res = await fetch('/api/lesarge/admin/models');
  if (!res.ok) throw new Error('Failed to fetch admin models');
  const data = await res.json();
  return data.models || [];
}

export async function sendLesargeAssistantChat(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const res = await fetch('/api/lesarge/qwen/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Assistant response failed');
  }
  const data = await res.json();
  return data.reply;
}

// ============================================================
// INSTALLER, DIAGNOSTICS & HARDWARE ROUTER API HELPERS
// ============================================================

export async function fetchHardwareSpecs() {
  const res = await fetch('/api/installer/hardware-scan');
  if (!res.ok) throw new Error('Failed to fetch hardware specs');
  const data = await res.json();
  return data.hardware;
}

export async function simulateHardwareMode(payload: { vramGb?: number; ramGb?: number; os?: string }) {
  const res = await fetch('/api/installer/hardware-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to set hardware mode');
  const data = await res.json();
  return data.hardware;
}

export async function fetchInstallerComponents() {
  const res = await fetch('/api/installer/components');
  if (!res.ok) throw new Error('Failed to fetch installer components');
  const data = await res.json();
  return data.components;
}

export async function toggleInstallerComponent(id: string, isSelected: boolean) {
  const res = await fetch('/api/installer/components/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, isSelected }),
  });
  if (!res.ok) throw new Error('Failed to toggle component');
  const data = await res.json();
  return data.components;
}

export async function fetchDirectoryTree() {
  const res = await fetch('/api/installer/directory-structure');
  if (!res.ok) throw new Error('Failed to fetch directory tree');
  const data = await res.json();
  return data.tree;
}

export async function fetchInstallerPackages() {
  const res = await fetch('/api/installer/packages');
  if (!res.ok) throw new Error('Failed to fetch installer packages');
  const data = await res.json();
  return data.packages;
}

export async function fetchDiagnosticsHealth() {
  const res = await fetch('/api/diagnostics/health');
  if (!res.ok) throw new Error('Failed to fetch diagnostics health');
  const data = await res.json();
  return data.diagnostics;
}

export async function triggerSystemRepair() {
  const res = await fetch('/api/diagnostics/repair', { method: 'POST' });
  if (!res.ok) throw new Error('System repair failed');
  const data = await res.json();
  return data;
}

export async function fetchWorkerProcesses() {
  const res = await fetch('/api/workers/status');
  if (!res.ok) throw new Error('Failed to fetch worker processes');
  const data = await res.json();
  return data.workers;
}

export async function controlWorkerProcess(workerId: string, action: 'restart' | 'stop') {
  const res = await fetch('/api/workers/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId, action }),
  });
  if (!res.ok) throw new Error('Worker control failed');
  const data = await res.json();
  return data.worker;
}

export async function fetchHybridRouterConfig() {
  const res = await fetch('/api/router/config');
  if (!res.ok) throw new Error('Failed to fetch router config');
  const data = await res.json();
  return data.config;
}

export async function updateHybridRouterConfig(config: any) {
  const res = await fetch('/api/router/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update router config');
  const data = await res.json();
  return data.config;
}

// ============================================================
// AI MODEL MANAGER API HELPERS
// ============================================================

export async function fetchAIModelManagerStatus(): Promise<{
  models: AIModelDownloadState[];
  isDownloading: boolean;
  batchProgress: number;
}> {
  const res = await fetch('/api/models/manager/status');
  if (!res.ok) throw new Error('Failed to fetch AI model manager status');
  const data = await res.json();
  return {
    models: data.models,
    isDownloading: data.isDownloading,
    batchProgress: data.batchProgress,
  };
}

export async function triggerAIModelDownload(modelIds?: string[]) {
  const res = await fetch('/api/models/manager/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelIds }),
  });
  if (!res.ok) throw new Error('Failed to start model download');
  const data = await res.json();
  return data;
}

export async function verifyAIModelChecksum(modelId: string) {
  const res = await fetch('/api/models/manager/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId }),
  });
  if (!res.ok) throw new Error('Failed to verify model checksum');
  const data = await res.json();
  return data.model;
}

export async function registerAIModel(modelId: string) {
  const res = await fetch('/api/models/manager/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId }),
  });
  if (!res.ok) throw new Error('Failed to register model');
  const data = await res.json();
  return data.model;
}

