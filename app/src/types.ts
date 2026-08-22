export type CreationMode = 'music' | 'video' | 'music_video';

export interface Genre {
  id: string;
  name: string;
  category: 'African' | 'Electronic' | 'Pop & R&B' | 'Rock & Metal' | 'Hip Hop' | 'Jazz & Blues' | 'Latin & Caribbean' | 'World & Folk' | 'Classical & Ambient' | 'Other';
  parent_genre?: string;
  subgenre?: string;
  region: string;
  description: string;
  typical_bpm_min: number;
  typical_bpm_max: number;
  moods: string[];
  instruments: string[];
  tags: string[];
  active: boolean;
}

export interface Instrument {
  id: string;
  name: string;
  category: 'Keyboard' | 'Strings' | 'Brass & Woodwinds' | 'Percussion & Drums' | 'Traditional & African' | 'Synthesizer & Electronic' | 'Vocals';
  family: string;
  region: string;
  description: string;
  typical_genres: string[];
  typical_moods: string[];
  tags: string[];
}

export interface PreferenceProfile {
  learningEnabled: boolean;
  genreScores: Record<string, number>; // e.g. { "Afrobeats": 82, "Amapiano": 74, "R&B": 61 }
  instrumentScores: Record<string, number>; // e.g. { "Piano": 88, "Bass": 82, "Djembe": 60 }
  moodScores: Record<string, number>; // e.g. { "Uplifting": 85, "Emotional": 79 }
  preferredBpmMin: number;
  preferredBpmMax: number;
  totalGenerations: number;
  totalLikes: number;
  totalDownloads: number;
  historyLogs: { timestamp: string; action: string; details: string }[];
}

export interface SongStructureItem {
  part: string;
  lyricsSnippet: string;
  durationSec: number;
}

export interface StoryboardScene {
  sceneNumber: number;
  timeStartSec: number;
  timeEndSec: number;
  visualPrompt: string;
  cameraMovement: string;
  lighting: string;
  mood: string;
}

export interface CustomizeParameters {
  genre: string;
  subgenre: string;
  mood: string;
  energy: 'Low' | 'Medium' | 'High' | 'Explosive';
  bpm: number;
  keySignature: string;
  instruments: string[];
  vocalStyle: 'Male Vocal' | 'Female Vocal' | 'Duet' | 'Choir' | 'Instrumental';
  language: string;
  durationSec: number;
  lyrics: string;
  isInstrumental: boolean;
}

export interface StemUrls {
  vocals?: string;
  drums?: string;
  bass?: string;
  other?: string;
}

export interface ProjectAsset {
  id: string;
  title: string;
  prompt: string;
  mode: CreationMode;
  genre: string;
  subgenre: string;
  mood: string;
  bpm: number;
  keySignature: string;
  instruments: string[];
  lyrics: string;
  storyboard?: StoryboardScene[];
  audioUrl?: string;
  videoUrl?: string;
  stems?: StemUrls;
  waveformData: number[];
  thumbnailUrl: string;
  durationSec: number;
  created_at: string;
  likes: number;
  plays: number;
  isFavorite: boolean;
  isLiked: boolean;
  modelUsed: string;
  modelVersion: string;
  parentProjectId?: string;
}

export type JobStatus =
  | 'QUEUED'
  | 'STARTING'
  | 'PLANNING'
  | 'GENERATING_SEMANTICS'
  | 'RENDERING_AUDIO'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface StructuredMusicGenerationPlan {
  genre: string;
  subgenre?: string;
  language?: string;
  mood: string[];
  energy?: 'low' | 'medium' | 'high' | 'explosive';
  bpm: number;
  keySignature?: string;
  vocal_style?: string;
  instruments: string[];
  structure: string[];
  lyrics?: string;
  isInstrumental?: boolean;
}

export interface AiJob {
  id: string;
  title: string;
  mode: CreationMode;
  prompt: string;
  status: JobStatus;
  progressPercent: number;
  currentStepMessage: string;
  structuredPlan?: StructuredMusicGenerationPlan;
  modelRoute: {
    qwenIntent: boolean;
    qwenMusic: boolean;
    aceStepAudioFallback?: boolean;
    qwenStoryboard: boolean;
    qwenVideo: boolean;
    ffmpegRender: boolean;
  };
  logs: string[];
  createdAt: string;
  completedAt?: string;
  resultProjectId?: string;
  errorMessage?: string;
}

export interface ModelAdminConfig {
  id: string;
  name: string;
  type:
    | 'qwen_text'
    | 'qwen_music'
    | 'qwen_music_tokenizer'
    | 'qwen_music_llm'
    | 'qwen_music_render'
    | 'qwen_tts'
    | 'qwen_video'
    | 'ace_step'
    | 'asr'
    | 'ffmpeg';
  role: string;
  provider: string;
  endpoint: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNAVAILABLE';
  latencyMs: number;
  gpuUsagePercent: number;
  vramUsedGb: number;
  vramTotalGb: number;
  activeWorkers: number;
}

export type HardwareTier = 'LOW' | 'NORMAL' | 'HIGH_END';

export interface HardwareSpecs {
  osName: string;
  osArchitecture: string;
  cpuModel: string;
  cpuCores: number;
  ramTotalGb: number;
  ramAvailableGb: number;
  gpuModel: string;
  isNvidiaGpu: boolean;
  vramTotalGb: number;
  diskFreeGb: number;
  pythonVersion?: string;
  ffmpegVersion?: string;
  cudaVersion?: string;
  tier: HardwareTier;
  recommendedFeatures: {
    textOrchestration: boolean;
    musicGeneration: boolean;
    videoGeneration: boolean;
    voiceSynthesis: boolean;
    speechToText: boolean;
  };
}

export interface InstallerComponent {
  id: string;
  name: string;
  version: string;
  category: 'core' | 'orchestration' | 'music' | 'video' | 'tts' | 'asr' | 'media';
  sizeGb: number;
  isRequired: boolean;
  isSelected: boolean;
  hardwareRequirement: string;
  status: 'Installed' | 'Available' | 'Downloading' | 'Error';
  location: string;
  checksum: string;
  description: string;
}

export type ModelDownloadPhase = 'IDLE' | 'DOWNLOADING' | 'VERIFYING' | 'REGISTERING' | 'INSTALLED' | 'ERROR';

export interface AIModelDownloadState {
  id: string;
  name: string;
  version: string;
  category: string;
  sizeGb: number;
  downloadedMb: number;
  totalMb: number;
  progressPercent: number;
  downloadSpeedMb: number;
  phase: ModelDownloadPhase;
  checksum: string;
  verificationStatus: 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED';
  verificationMessage?: string;
  registered: boolean;
  location: string;
  updatedAt: string;
}

export interface LocalDirectoryNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  sizeMb?: number;
  children?: LocalDirectoryNode[];
}

export interface AIWorkerProcess {
  id: string;
  name: string;
  role: string;
  pid: number;
  status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'STANDBY';
  cpuUsagePercent: number;
  ramUsageMb: number;
  gpuUsagePercent: number;
  vramUsageMb: number;
  currentTask?: string;
  lastHealthCheck: string;
}

export interface AIDiagnosticService {
  name: string;
  status: 'Online' | 'Degraded' | 'Offline' | 'Not Installed';
  latencyMs: number;
  version: string;
  hardwareDevice: string;
  message: string;
}

export interface AIDiagnosticsState {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'ATTENTION';
  lastChecked: string;
  services: AIDiagnosticService[];
  logs: {
    installer: string[];
    ai: string[];
    qwen: string[];
    music: string[];
    video: string[];
    tts: string[];
    asr: string[];
    ffmpeg: string[];
  };
}

export interface HybridRouterConfig {
  aiMode: 'LOCAL' | 'CLOUD' | 'HYBRID';
  cloudApiEndpoint: string;
  fallbackToCloudOnLowVram: boolean;
  autoSelectBestWorker: boolean;
  maxParallelJobs: number;
}


// Legacy Code & Filter Interfaces for Python Code Modal compatibility
export interface FilterState {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  gamma: number;
  blur: number;
  sharpen: number;
  edgeDetection: 'none' | 'sobel' | 'laplacian' | 'prewitt';
  threshold: number;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
  pixelate: number;
  noise: number;
  redChannel: number;
  greenChannel: number;
  blueChannel: number;
}

export interface PresetImage {
  id: string;
  name: string;
  category: 'Nature' | 'Architecture' | 'Portrait' | 'Technical' | 'Abstract';
  url: string;
  description: string;
}

export interface HistogramDataPoint {
  bin: number;
  red: number;
  green: number;
  blue: number;
  luminance: number;
}

export interface DominantColor {
  hex: string;
  rgb: [number, number, number];
  percentage: number;
}

export interface GeminiVisionResponse {
  caption: string;
  summary: string;
  detectedObjects: string[];
  suggestedFilters: Partial<FilterState>;
  pythonSnippet: string;
  tags: string[];
}

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  filterState: FilterState;
  label: string;
}

