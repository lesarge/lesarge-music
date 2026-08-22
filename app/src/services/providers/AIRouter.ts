import { MusicGenerationProvider, StructuredMusicPlan } from './MusicProvider';
import { VideoGenerationProvider } from './VideoProvider';
import { qwenMusicProvider } from './QwenMusicProvider';
import { aceStepMusicProvider } from './AceStepMusicProvider';
import { qwenVideoProvider } from './QwenVideoProvider';
import { HybridRouterConfig } from '../../types';

export type TaskType =
  | 'TEXT'
  | 'LYRICS'
  | 'MUSIC_ANALYSIS'
  | 'PROMPT_TRANSFORMATION'
  | 'VIDEO_PLANNING'
  | 'MUSIC_GENERATION'
  | 'MUSIC_COVER'
  | 'VIDEO_GENERATION'
  | 'SPEECH'
  | 'MEDIA_PROCESSING';

export interface RouteDecision {
  taskType: TaskType;
  selectedProviderId: string;
  selectedProviderName: string;
  isFallback: boolean;
  reason: string;
}

export class LesargeAIRouter {
  private musicProviders: Map<string, MusicGenerationProvider> = new Map();
  private videoProviders: Map<string, VideoGenerationProvider> = new Map();
  private primaryMusicProviderId = 'qwen_music';
  private primaryVideoProviderId = 'qwen_video';

  constructor() {
    this.registerMusicProvider(qwenMusicProvider);
    this.registerMusicProvider(aceStepMusicProvider);
    this.registerVideoProvider(qwenVideoProvider);
  }

  public registerMusicProvider(provider: MusicGenerationProvider) {
    this.musicProviders.set(provider.id, provider);
  }

  public registerVideoProvider(provider: VideoGenerationProvider) {
    this.videoProviders.set(provider.id, provider);
  }

  /**
   * Route task automatically without user intervention
   */
  public async routeTask(
    taskType: TaskType,
    routerConfig?: HybridRouterConfig
  ): Promise<RouteDecision> {
    switch (taskType) {
      case 'TEXT':
      case 'LYRICS':
      case 'MUSIC_ANALYSIS':
      case 'PROMPT_TRANSFORMATION':
      case 'VIDEO_PLANNING':
        return {
          taskType,
          selectedProviderId: 'qwen_text',
          selectedProviderName: 'Qwen 2.5 Text Orchestrator',
          isFallback: false,
          reason: 'Routed to Qwen Text LLM for natural-language reasoning & planning.',
        };

      case 'MUSIC_GENERATION':
      case 'MUSIC_COVER': {
        const qwenHealth = await qwenMusicProvider.getHealth();
        const isQwenAvailable = qwenHealth.status === 'ONLINE' || qwenHealth.status === 'DEGRADED';

        if (isQwenAvailable) {
          return {
            taskType,
            selectedProviderId: 'qwen_music',
            selectedProviderName: 'Qwen-Music AI (Primary Engine)',
            isFallback: false,
            reason: 'Routed to Qwen-Music (Tokenizer → LLM → 48kHz Render).',
          };
        }

        // Check if fallback enabled by administrator
        const allowFallback = routerConfig?.fallbackToCloudOnLowVram ?? true;
        if (allowFallback) {
          return {
            taskType,
            selectedProviderId: 'ace_step',
            selectedProviderName: 'ACE-Step 1.5 (Fallback Engine)',
            isFallback: true,
            reason: 'Qwen-Music unavailable; routed to ACE-Step fallback engine as configured.',
          };
        }

        throw new Error('Qwen-Music engine is unavailable and fallback generation is disabled.');
      }

      case 'VIDEO_GENERATION':
        return {
          taskType,
          selectedProviderId: 'qwen_video',
          selectedProviderName: 'Qwen Video AI Studio (1080p)',
          isFallback: false,
          reason: 'Routed to Qwen Video Generator & FFmpeg composite pipeline.',
        };

      case 'SPEECH':
        return {
          taskType,
          selectedProviderId: 'qwen_tts',
          selectedProviderName: 'Qwen3-TTS Vocal Synthesizer',
          isFallback: false,
          reason: 'Routed to Qwen Neural Vocal Synthesizer.',
        };

      case 'MEDIA_PROCESSING':
        return {
          taskType,
          selectedProviderId: 'ffmpeg_nvenc',
          selectedProviderName: 'FFmpeg Hardware Transcoder',
          isFallback: false,
          reason: 'Routed to FFmpeg NVENC acceleration.',
        };

      default:
        return {
          taskType,
          selectedProviderId: 'qwen_text',
          selectedProviderName: 'Qwen 2.5 Orchestrator',
          isFallback: false,
          reason: 'Default routing to Qwen core brain.',
        };
    }
  }

  public getMusicProvider(providerId?: string): MusicGenerationProvider {
    if (providerId && this.musicProviders.has(providerId)) {
      return this.musicProviders.get(providerId)!;
    }
    return this.musicProviders.get(this.primaryMusicProviderId) || qwenMusicProvider;
  }

  public getVideoProvider(providerId?: string): VideoGenerationProvider {
    if (providerId && this.videoProviders.has(providerId)) {
      return this.videoProviders.get(providerId)!;
    }
    return this.videoProviders.get(this.primaryVideoProviderId) || qwenVideoProvider;
  }
}

export const lesargeAIRouter = new LesargeAIRouter();
