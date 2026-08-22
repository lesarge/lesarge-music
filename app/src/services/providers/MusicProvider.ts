export interface MusicCapabilities {
  text_to_music: boolean;
  lyrics_to_music: boolean;
  instrumental: boolean;
  cover_generation: boolean;
  reference_audio: boolean;
  extend: boolean;
  multi_stem: boolean;
}

export interface StructuredMusicPlan {
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
  referenceAudioUrl?: string;
}

export interface MusicGenerationRequest {
  plan: StructuredMusicPlan;
  prompt?: string;
  mode?: 'music' | 'video' | 'music_video';
  customParams?: any;
}

export interface MusicGenerationResult {
  audioUrl: string;
  stems?: Record<string, string>;
  durationSec: number;
  modelUsed: string;
  modelVersion: string;
  waveformData?: number[];
  sampleRateHz?: number; // Target 48000 Hz for Qwen-Music-Render
  semanticTokenCount?: number;
}

export interface MusicProviderHealth {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNAVAILABLE';
  message: string;
  installedComponents?: {
    tokenizer: boolean;
    llm: boolean;
    render: boolean;
  };
}

export interface MusicGenerationProvider {
  id: string;
  name: string;
  version: string;
  getCapabilities(): Promise<MusicCapabilities> | MusicCapabilities;
  getHealth(): Promise<MusicProviderHealth>;
  generateMusic(request: MusicGenerationRequest): Promise<MusicGenerationResult>;
  generateFromLyrics?(lyrics: string, plan: StructuredMusicPlan): Promise<MusicGenerationResult>;
  generateInstrumental?(plan: StructuredMusicPlan): Promise<MusicGenerationResult>;
  generateCover?(referenceUrl: string, plan: StructuredMusicPlan): Promise<MusicGenerationResult>;
  generateVariation?(parentProjectId: string, plan: StructuredMusicPlan): Promise<MusicGenerationResult>;
  extendMusic?(audioUrl: string, durationSec: number): Promise<MusicGenerationResult>;
}
