import { StoryboardScene } from '../../types';

export interface VideoCapabilities {
  text_to_video: boolean;
  image_to_video: boolean;
  scene_generation: boolean;
  max_resolution: string;
  max_duration_sec: number;
}

export interface VideoProviderHealth {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNAVAILABLE';
  message: string;
}

export interface VideoGenerationRequest {
  prompt: string;
  storyboard?: StoryboardScene[];
  audioUrl?: string;
  durationSec?: number;
}

export interface VideoGenerationResult {
  videoUrl: string;
  scenes?: { sceneNumber: number; videoUrl: string }[];
  durationSec: number;
  modelUsed: string;
}

export interface VideoGenerationProvider {
  id: string;
  name: string;
  version: string;
  getCapabilities(): Promise<VideoCapabilities> | VideoCapabilities;
  getHealth(): Promise<VideoProviderHealth>;
  generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
  generateScene?(scene: StoryboardScene): Promise<string>;
  generateFromImage?(imageUrl: string, prompt: string): Promise<VideoGenerationResult>;
  generateFromText?(prompt: string): Promise<VideoGenerationResult>;
  cancelJob?(jobId: string): Promise<boolean>;
}
