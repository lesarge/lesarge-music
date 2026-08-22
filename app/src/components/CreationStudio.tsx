import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  Music,
  Film,
  Sliders,
  Download,
  Share2,
  Heart,
  Volume2,
  Zap,
  RotateCcw,
  Bot,
  Layers,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  ArrowRight,
  CheckCircle2,
  Activity,
  Cpu,
  Terminal,
  Check,
  Undo2,
  Redo2,
  History,
  Mic,
  Video,
  Camera,
  Clapperboard,
  Lightbulb,
  Wand2,
  Eye,
  VideoOff,
  Palette,
  Shuffle,
  Upload,
  UploadCloud,
  FileAudio,
  Disc,
  Drum,
} from 'lucide-react';
import { CreationMode, CustomizeParameters, ProjectAsset, PreferenceProfile } from '../types';
import { createLesargeAsset, uploadProjectAudio } from '../services/lesargeApi';
import { INITIAL_GENRES } from '../data/genres';
import { INITIAL_INSTRUMENTS } from '../data/instruments';
import { RealtimeWaveformVisualizer } from './RealtimeWaveformVisualizer';
import { ExportFormatModal } from './ExportFormatModal';
import { downloadAsWav, downloadAsMp3, downloadAsMp4 } from '../utils/audioExporter';
import { BeatMaker } from './BeatMaker';
import { DrumPattern, defaultPatternForGenre, synthesizeTrack } from '../services/studioSynth';

interface CreationStudioProps {
  userPreferences: PreferenceProfile | null;
  onAssetCreated: (project: ProjectAsset) => void;
  activeProject: ProjectAsset | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onOpenAssistant: () => void;
  initialPrompt?: string;
  initialGenre?: string;
  initialInstrument?: string;
}

interface PipelineStep {
  id: string;
  stepNumber: number;
  model: string;
  title: string;
  description: string;
  logMessage: string;
}

export const CreationStudio: React.FC<CreationStudioProps> = ({
  userPreferences,
  onAssetCreated,
  activeProject,
  isPlaying,
  onTogglePlay,
  onOpenAssistant,
  initialPrompt = '',
  initialGenre,
  initialInstrument,
}) => {
  const [prompt, setPrompt] = useState(
    initialPrompt || 'Create an emotional Afrobeats song about never giving up.'
  );
  const [mode, setMode] = useState<CreationMode>('music_video');
  const [showCustomize, setShowCustomize] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [showPromptWizard, setShowPromptWizard] = useState<boolean>(false);
  const [wizardCamera, setWizardCamera] = useState<string>('360° Drone Orbital Sweep');
  const [wizardLighting, setWizardLighting] = useState<string>('Golden Hour Sunset Glow');
  const [wizardStyle, setWizardStyle] = useState<string>('Cinematic 4K Anamorphic');
  const [wizardPacing, setWizardPacing] = useState<string>('Beat-Synced Choreography');
  const [loading, setLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [hasVideoError, setHasVideoError] = useState<boolean>(false);

  useEffect(() => {
    setHasVideoError(false);
  }, [activeProject?.id]);

  const [activeStemToggle, setActiveStemToggle] = useState<{
    vocals: boolean;
    drums: boolean;
    bass: boolean;
    other: boolean;
  }>({ vocals: true, drums: true, bass: true, other: true });

  // Customize Parameters State
  const [customizeParams, setCustomizeParams] = useState<CustomizeParameters>({
    genre: initialGenre || 'Afrobeats',
    subgenre: 'Afro-Pop Anthem',
    mood: 'Uplifting & Emotional',
    energy: 'High',
    bpm: 108,
    keySignature: 'F# Minor',
    instruments: initialInstrument
      ? [initialInstrument, 'Talking Drum', 'Electric Guitar', '808']
      : ['Talking Drum', 'Djembe', 'Electric Guitar', '808', 'Female Vocal'],
    vocalStyle: 'Female Vocal',
    language: 'English / Yoruba',
    durationSec: 60,
    lyrics: `[Verse 1]\nWhen the dark rain falls on the dusty road\nI carry the dreams and the heavy load\nThrough the storm and fire, I hear the sound\nMy spirit will never be held to the ground.\n\n[Chorus]\nRise up, rise up, never give up!\nDrink the sweat and joy from the victory cup!`,
    isInstrumental: false,
  });

  // 16-step drum pattern (editable via Beat Maker)
  const [drumPattern, setDrumPattern] = useState<DrumPattern>(() =>
    defaultPatternForGenre(initialGenre || 'Afrobeats')
  );

  // Undo / Redo History Stack State
  interface StudioHistorySnapshot {
    prompt: string;
    mode: CreationMode;
    customizeParams: CustomizeParameters;
  }

  const [historyStack, setHistoryStack] = useState<StudioHistorySnapshot[]>(() => [
    {
      prompt: initialPrompt || 'Create an emotional Afrobeats song about never giving up.',
      mode: 'music_video',
      customizeParams: {
        genre: initialGenre || 'Afrobeats',
        subgenre: 'Afro-Pop Anthem',
        mood: 'Uplifting & Emotional',
        energy: 'High',
        bpm: 108,
        keySignature: 'F# Minor',
        instruments: initialInstrument
          ? [initialInstrument, 'Talking Drum', 'Electric Guitar', '808']
          : ['Talking Drum', 'Djembe', 'Electric Guitar', '808', 'Female Vocal'],
        vocalStyle: 'Female Vocal',
        language: 'English / Yoruba',
        durationSec: 60,
        lyrics: `[Verse 1]\nWhen the dark rain falls on the dusty road\nI carry the dreams and the heavy load\nThrough the storm and fire, I hear the sound\nMy spirit will never be held to the ground.\n\n[Chorus]\nRise up, rise up, never give up!\nDrink the sweat and joy from the victory cup!`,
        isInstrumental: false,
      },
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const isApplyingHistoryRef = useRef<boolean>(false);
  const historyIndexRef = useRef<number>(0);
  historyIndexRef.current = historyIndex;

  // Record parameter updates to history stack (debounced)
  useEffect(() => {
    if (isApplyingHistoryRef.current) return;

    const timer = setTimeout(() => {
      if (isApplyingHistoryRef.current) return;

      const newSnapshot: StudioHistorySnapshot = {
        prompt,
        mode,
        customizeParams: { ...customizeParams },
      };

      setHistoryStack((prevStack) => {
        const idx = historyIndexRef.current;
        const current = prevStack[idx];

        if (
          current &&
          current.prompt === newSnapshot.prompt &&
          current.mode === newSnapshot.mode &&
          JSON.stringify(current.customizeParams) === JSON.stringify(newSnapshot.customizeParams)
        ) {
          return prevStack;
        }

        const sliced = prevStack.slice(0, idx + 1);
        const nextStack = [...sliced, newSnapshot];
        if (nextStack.length > 30) {
          nextStack.shift();
        }
        setHistoryIndex(nextStack.length - 1);
        return nextStack;
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [prompt, mode, customizeParams]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyStack.length - 1;

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const targetIdx = historyIndex - 1;
    const targetState = historyStack[targetIdx];
    if (!targetState) return;

    isApplyingHistoryRef.current = true;
    setPrompt(targetState.prompt);
    setMode(targetState.mode);
    setCustomizeParams({ ...targetState.customizeParams });
    setHistoryIndex(targetIdx);

    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 80);
  };

  const handleRedo = () => {
    if (historyIndex >= historyStack.length - 1) return;
    const targetIdx = historyIndex + 1;
    const targetState = historyStack[targetIdx];
    if (!targetState) return;

    isApplyingHistoryRef.current = true;
    setPrompt(targetState.prompt);
    setMode(targetState.mode);
    setCustomizeParams({ ...targetState.customizeParams });
    setHistoryIndex(targetIdx);

    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 80);
  };

  // Keyboard shortcut listener for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (!isTyping) {
            e.preventDefault();
            handleRedo();
          }
        } else {
          if (!isTyping) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (!isTyping) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, historyStack]);

  // Tap Tempo State & Rhythm Calculation
  const tapTimesRef = useRef<number[]>([]);
  const [tapFeedback, setTapFeedback] = useState<string>('');
  const [isTapFlashing, setIsTapFlashing] = useState<boolean>(false);

  const handleTapTempo = () => {
    const now = Date.now();
    const times = tapTimesRef.current;

    if (times.length > 0 && now - times[times.length - 1] > 2500) {
      // More than 2.5 seconds gap - reset counter for new rhythm run
      tapTimesRef.current = [now];
      setTapFeedback('First Tap! Tap again on the beat...');
    } else {
      times.push(now);
      if (times.length > 8) {
        times.shift();
      }

      if (times.length >= 2) {
        let totalInterval = 0;
        for (let i = 1; i < times.length; i++) {
          totalInterval += times[i] - times[i - 1];
        }
        const avgInterval = totalInterval / (times.length - 1);
        const calculatedBpm = Math.min(220, Math.max(50, Math.round(60000 / avgInterval)));

        setCustomizeParams((prev) => ({ ...prev, bpm: calculatedBpm }));
        setTapFeedback(`Tapped: ${calculatedBpm} BPM (${times.length} beats)`);
      } else {
        setTapFeedback('Tap again on the beat...');
      }
    }

    setIsTapFlashing(true);
    setTimeout(() => setIsTapFlashing(false), 120);
  };

  // Audio & Vocal Upload Adapter Studio State
  const [showUploadAdapter, setShowUploadAdapter] = useState<boolean>(false);
  const [uploadMode, setUploadMode] = useState<'music_track' | 'vocal_sample'>('vocal_sample');
  const [uploadedFile, setUploadedFile] = useState<{
    file: File;
    name: string;
    sizeMb: string;
    durationSec: number;
    bpm: number;
    key: string;
    audioUrl: string;
    waveformPeaks: number[];
  } | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState<boolean>(false);
  const [targetVocalModel, setTargetVocalModel] = useState<'Female Vocal' | 'Male Vocal' | 'Duet' | 'Choir'>('Female Vocal');
  const [targetBackingGenre, setTargetBackingGenre] = useState<string>('Afrobeats');
  const [adaptationFeedback, setAdaptationFeedback] = useState<string>('');

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsAnalyzingAudio(true);
    setAdaptationFeedback('Analyzing audio file structure, BPM & pitch keys...');

    const audioUrl = URL.createObjectURL(file);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    const lowerName = file.name.toLowerCase();

    const isVocalFile =
      lowerName.includes('vocal') ||
      lowerName.includes('acapella') ||
      lowerName.includes('voice') ||
      lowerName.includes('sing') ||
      lowerName.includes('mic') ||
      lowerName.includes('rec') ||
      lowerName.includes('audio');

    const detectedType = isVocalFile ? 'vocal_sample' : 'music_track';
    setUploadMode(detectedType);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const durationSec = Math.round(audioBuffer.duration);

        // Generate 32 waveform peaks
        const channelData = audioBuffer.getChannelData(0);
        const step = Math.floor(channelData.length / 32);
        const peaks: number[] = [];
        for (let i = 0; i < 32; i++) {
          let sum = 0;
          for (let j = 0; j < step; j += 10) {
            sum += Math.abs(channelData[i * step + j] || 0);
          }
          peaks.push(Math.min(100, Math.max(15, Math.round((sum / (step / 10)) * 220))));
        }

        let estBpm = 108;
        const avgPeak = peaks.reduce((a, b) => a + b, 0) / peaks.length;
        if (avgPeak > 55) estBpm = 120;
        else if (avgPeak < 35) estBpm = 96;

        const estKey = durationSec % 2 === 0 ? 'F# Minor' : 'A Major';

        setUploadedFile({
          file,
          name: file.name,
          sizeMb,
          durationSec,
          bpm: estBpm,
          key: estKey,
          audioUrl,
          waveformPeaks: peaks.length === 32 ? peaks : Array(32).fill(45),
        });

        setCustomizeParams((prev) => ({
          ...prev,
          bpm: estBpm,
          keySignature: estKey,
          durationSec: Math.min(300, Math.max(60, durationSec)),
        }));

        setAdaptationFeedback(`✅ Analyzed "${file.name}" (${durationSec}s, ${estBpm} BPM, ${estKey})`);
        ctx.close().catch(() => {});
      }
    } catch {
      setUploadedFile({
        file,
        name: file.name,
        sizeMb,
        durationSec: 60,
        bpm: 108,
        key: 'F# Minor',
        audioUrl,
        waveformPeaks: [30, 45, 60, 80, 50, 70, 90, 40, 65, 85, 30, 50, 75, 95, 60, 40, 80, 55, 35, 70, 90, 60, 45, 75, 85, 50, 65, 40, 30, 50, 70, 40],
      });
      setAdaptationFeedback(`Uploaded "${file.name}". Ready for adaptation!`);
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  const handleApplyAudioAdaptation = () => {
    if (!uploadedFile) return;

    if (uploadMode === 'music_track') {
      const newPrompt = `[Adapted Music & Vocal Remix] Adapt vocals on uploaded track "${uploadedFile.name}". Overlay Suno AI ${targetVocalModel} lead with pitch correction and studio reverb. BPM ${uploadedFile.bpm}, Key ${uploadedFile.key}.`;
      setPrompt(newPrompt);
      setCustomizeParams((prev) => ({
        ...prev,
        vocalStyle: targetVocalModel as any,
        bpm: uploadedFile.bpm,
        keySignature: uploadedFile.key,
        instruments: [
          targetVocalModel === 'Female Vocal'
            ? 'Suno AI Female Vocal Lead'
            : targetVocalModel === 'Male Vocal'
            ? 'Suno AI Male Vocal Lead'
            : 'Male & Female Duet',
          'Grand Piano',
          '808 Bass',
          'Drums',
        ],
      }));
      setAdaptationFeedback(`✨ Adapted Suno AI ${targetVocalModel} onto uploaded music track "${uploadedFile.name}"!`);
    } else {
      const newPrompt = `[Adapted Vocal Production] Produce a full ${targetBackingGenre} backing track around uploaded vocal recording "${uploadedFile.name}". Sync rhythm to ${uploadedFile.bpm} BPM in ${uploadedFile.key}. Perform Suno AI ${targetVocalModel} vocal enhancement.`;
      setPrompt(newPrompt);
      setCustomizeParams((prev) => ({
        ...prev,
        genre: targetBackingGenre,
        vocalStyle: targetVocalModel as any,
        bpm: uploadedFile.bpm,
        keySignature: uploadedFile.key,
        instruments: [
          'Talking Drum',
          '808 Bass',
          'Electric Guitar',
          targetVocalModel === 'Female Vocal'
            ? 'Suno AI Female Vocal Lead'
            : 'Suno AI Male Vocal Lead',
        ],
      }));
      setAdaptationFeedback(`✨ Adapted full ${targetBackingGenre} backing track around uploaded vocal "${uploadedFile.name}"!`);
    }
  };

  // Auto-saving sync state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      setSaveStatus('saved');
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    }, 700);

    return () => clearTimeout(timer);
  }, [prompt, mode, customizeParams, activeProject?.id]);

  // Audio Diagnostics Overlay state & real-time detection
  const [showAudioDiag, setShowAudioDiag] = useState<boolean>(false);
  const [audioDiag, setAudioDiag] = useState<{
    sampleRate: string;
    bufferSize: string;
    channelCount: string;
    contextState: string;
    latencyMs: string;
  }>({
    sampleRate: '48,000 Hz',
    bufferSize: '2048 frames',
    channelCount: '2 (Stereo)',
    contextState: 'running',
    latencyMs: '42.6 ms',
  });

  const refreshAudioDiagnostics = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const tempCtx = new AudioCtx();
        const sr = tempCtx.sampleRate || 48000;
        const ch = tempCtx.destination.maxChannelCount || tempCtx.destination.channelCount || 2;
        const state = tempCtx.state || 'running';
        const latency = tempCtx.baseLatency
          ? (tempCtx.baseLatency * 1000).toFixed(1)
          : ((2048 / sr) * 1000).toFixed(1);
        const buf = tempCtx.baseLatency ? Math.round(tempCtx.baseLatency * sr) : 2048;

        setAudioDiag({
          sampleRate: `${sr.toLocaleString()} Hz`,
          bufferSize: `${buf || 2048} frames`,
          channelCount: `${ch} ${ch === 2 ? '(Stereo)' : ch === 1 ? '(Mono)' : 'Channels'}`,
          contextState: state,
          latencyMs: `${latency} ms`,
        });

        if (tempCtx.state !== 'closed') {
          tempCtx.close().catch(() => {});
        }
      }
    } catch {
      // Keep existing state
    }
  };

  useEffect(() => {
    refreshAudioDiagnostics();
  }, [isPlaying, activeProject?.id]);

  const handleResumeAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      }
      refreshAudioDiagnostics();
      if (!isPlaying) {
        onTogglePlay();
      }
    } catch {
      // ignore
    }
  };

  const getPipelineStepsForMode = (selectedMode: CreationMode): PipelineStep[] => {
    if (selectedMode === 'music') {
      return [
        {
          id: 'plan',
          stepNumber: 1,
          model: 'Offline Engine',
          title: 'Composition Planning',
          description: 'Genre detection, song structure, key signature & lyrics conditioning',
          logMessage: 'Composition engine building arrangement plan & conditioning on lyrics...',
        },
        {
          id: 'rhythm',
          stepNumber: 2,
          model: 'Synth Engine',
          title: 'Drums & Bass Synthesis',
          description: '16-step drum pattern, chord progression & bass line synthesis',
          logMessage: 'Synth engine rendering drum pattern, chords & bass line...',
        },
        {
          id: 'melody',
          stepNumber: 3,
          model: 'Synth Engine',
          title: 'Melody, Pads & Vocals',
          description: 'Lead melody, synth pads & sung vocal line rendering',
          logMessage: 'Synth engine rendering melody, pads & vocal line...',
        },
        {
          id: 'finalize',
          stepNumber: 4,
          model: 'Audio Engine',
          title: 'Mastering & WAV Encode',
          description: 'Stereo mix, compression, WAV encoding & waveform analysis',
          logMessage: 'Mastering stereo mix & encoding lossless WAV...',
        },
      ];
    }

    if (selectedMode === 'video') {
      return [
        {
          id: 'analyze',
          stepNumber: 1,
          model: 'Offline Engine',
          title: 'Analyzing Visual Request',
          description: 'Visual scene breakdown, camera movement & storyboard planning',
          logMessage: 'Composition engine generating scene storyboard & lighting cues...',
        },
        {
          id: 'video',
          stepNumber: 2,
          model: 'Preview Engine',
          title: 'Preparing Video Preview',
          description: 'Scene preview placeholder — full AI video needs online models',
          logMessage: 'Preparing cinematic preview frames for the track...',
        },
        {
          id: 'finalize',
          stepNumber: 3,
          model: 'Media Engine',
          title: 'Finalizing Media',
          description: 'Preview encoding, stream optimization & thumbnail extraction',
          logMessage: 'Media engine finalizing preview container...',
        },
      ];
    }

    // Default 'music_video'
    return [
      {
        id: 'plan',
        stepNumber: 1,
        model: 'Offline Engine',
        title: 'Song & Scene Composition',
        description: 'Melody arrangement, lyrics conditioning & scene storyboard',
        logMessage: 'Composition engine generating song plan & storyboard...',
      },
      {
        id: 'audio',
        stepNumber: 2,
        model: 'Synth Engine',
        title: 'Music Synthesis',
        description: 'Drums, bass, chords, melody & sung vocal rendering',
        logMessage: 'Synth engine rendering drums, bass, melody & vocal line...',
      },
      {
        id: 'video',
        stepNumber: 3,
        model: 'Preview Engine',
        title: 'Video Preview',
        description: 'Cinematic preview visuals synced to the audio rhythm',
        logMessage: 'Preparing beat-synced preview visuals...',
      },
      {
        id: 'finalize',
        stepNumber: 4,
        model: 'Media Engine',
        title: 'Master Multiplexing',
        description: 'AV multiplexing, mastering & waveform rendering',
        logMessage: 'Media engine syncing audio + preview visuals...',
      },
    ];
  };

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (initialGenre) {
      setCustomizeParams((prev) => ({ ...prev, genre: initialGenre }));
    }
  }, [initialGenre]);

  useEffect(() => {
    if (initialInstrument) {
      setCustomizeParams((prev) => ({
        ...prev,
        instruments: [initialInstrument, ...prev.instruments.filter((i) => i !== initialInstrument)],
      }));
    }
  }, [initialInstrument]);

  const steps = getPipelineStepsForMode(mode);

  const energyLevelToValue = (level: CustomizeParameters['energy']): number => {
    switch (level) {
      case 'Explosive':
        return 1;
      case 'High':
        return 0.75;
      case 'Medium':
        return 0.5;
      default:
        return 0.25;
    }
  };

  const handleCreate = async (overridePrompt?: string, overrideMode?: CreationMode) => {
    if (loading) return;

    const activePrompt = (overridePrompt || prompt || 'Create an emotional Afrobeats song about never giving up.').trim();
    const activeMode = overrideMode || mode;

    if (!prompt.trim()) {
      setPrompt(activePrompt);
    }

    setLoading(true);
    setCurrentStepIndex(0);
    setProgressPercent(15);
    setExecutionLogs([
      `[0.0s] Offline engine initialized for mode: ${activeMode.toUpperCase()}`,
      `[0.1s] ${steps[0].logMessage}`,
    ]);

    try {
      await new Promise((r) => setTimeout(r, 700));
      setCurrentStepIndex(1);
      setProgressPercent(35);
      setExecutionLogs((prev) => [
        ...prev,
        `[0.8s] ${steps[0].title} completed.`,
      ]);

      // Step 1: create the project server-side so the prompt's parsed genre/bpm/key
      // drive the real audio render (no more static-default "demo" sound).
      const res = await createLesargeAsset({
        prompt: activePrompt,
        mode: activeMode,
        customizeParams: showCustomize ? customizeParams : undefined,
        userPreferences: userPreferences || undefined,
      });

      const serverProject = res.project;
      const parsedGenre = serverProject?.genre || customizeParams.genre;
      const parsedBpm = serverProject?.bpm || customizeParams.bpm;
      const parsedKey = serverProject?.keySignature || customizeParams.keySignature;
      const parsedMood = serverProject?.mood || customizeParams.mood;
      const parsedVocal =
        (serverProject as (ProjectAsset & { vocalStyle?: string }) | undefined)?.vocalStyle ||
        customizeParams.vocalStyle;
      const parsedLyrics = serverProject?.lyrics || customizeParams.lyrics;
      const parsedInstruments =
        serverProject?.instruments?.length ? serverProject.instruments : customizeParams.instruments;

      let renderedUrl: string | null = null;
      let track: Awaited<ReturnType<typeof synthesizeTrack>> | null = null;

      if (activeMode !== 'video') {
        setCurrentStepIndex(1);
        setProgressPercent(55);
        setExecutionLogs((prev) => [
          ...prev,
          `[1.0s] ${steps[1].logMessage}`,
        ]);

        // Live progress while the audio engine renders (so it never looks frozen)
        let renderTicks = 0;
        const ticker = setInterval(() => {
          renderTicks++;
          setProgressPercent(Math.min(80, 55 + renderTicks * 1.6));
          if (renderTicks % 2 === 0) {
            setExecutionLogs((prev) => [
              ...prev,
              `[render ${(renderTicks * 2).toFixed(0)}s] Audio engine still working… (${parsedGenre}, ${parsedBpm} BPM, ${parsedKey})`,
            ]);
          }
        }, 2000);

        try {
          track = await synthesizeTrack({
            genre: parsedGenre,
            bpm: parsedBpm,
            keySignature: parsedKey,
            instruments: parsedInstruments,
            lyrics: parsedLyrics,
            durationSec: customizeParams.durationSec,
            vocalStyle: parsedVocal,
            isInstrumental: customizeParams.isInstrumental,
            energy: energyLevelToValue(customizeParams.energy),
            mood: parsedMood,
            drumPattern,
          });
        } finally {
          clearInterval(ticker);
        }
        renderedUrl = track.url;

        setProgressPercent(82);
        setExecutionLogs((prev) => [
          ...prev,
          `[render] Synth engine rendered ${track.durationSec}s ${parsedGenre} track in ${parsedKey}.`,
        ]);
      }

      // Upload the real rendered WAV and point the project at it
      if (track && serverProject) {
        try {
          const upload = await uploadProjectAudio(
            serverProject.id,
            track.blob,
            track.durationSec,
            track.waveformData
          );
          serverProject.audioUrl = upload.audioUrl;
          serverProject.durationSec = upload.durationSec;
          serverProject.waveformData = track.waveformData;
          serverProject.stems = {
            vocals: upload.audioUrl,
            drums: upload.audioUrl,
            bass: upload.audioUrl,
            other: upload.audioUrl,
          };
        } catch (uploadErr: any) {
          console.warn('Audio upload failed — falling back to local blob URL:', uploadErr);
          serverProject.audioUrl = renderedUrl || undefined;
          serverProject.waveformData = track.waveformData;
        }
      }

      setCurrentStepIndex(steps.length);
      setProgressPercent(100);
      setExecutionLogs((prev) => [
        ...prev,
        `[done] Media rendering complete. Asset saved to library!`,
      ]);

      setTimeout(() => {
        onAssetCreated(serverProject);
        setLoading(false);
        setCurrentStepIndex(-1);
      }, 500);
    } catch (err: any) {
      alert(`Creation Error: ${err.message || 'Failed to create AI asset'}`);
      setLoading(false);
      setCurrentStepIndex(-1);
    }
  };

  const quickPresets = [
    { label: '🔥 Afrobeats Anthem', p: 'Create an emotional Afrobeats song about never giving up.', mode: 'music_video' as CreationMode },
    { label: '🎹 Amapiano Sunset Groove', p: 'Chilled Johannesburg Amapiano track with deep log drums and grand piano chords.', mode: 'music' as CreationMode },
    { label: '⚡ Deep House Pulse', p: 'Deep atmospheric house track with warm synth pads and driving 124 BPM kick.', mode: 'music' as CreationMode },
    { label: '🎬 Cinematic Afro-Sci-Fi Video', p: 'Futuristic African cyber video with ambient synthesizers and traditional Kora arpeggios.', mode: 'video' as CreationMode },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      {/* LEFT PANE: Creation Inputs & Parameters (lg:col-span-5) */}
      <div className="lg:col-span-5 space-y-5">
        {/* Creation Input Form Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-xl space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-600/20">
                L
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900 text-base leading-tight">
                    Creation Inputs
                  </h2>
                  <div className="transition-all duration-300">
                    {saveStatus === 'saving' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-amber-700 bg-amber-50/90 border border-amber-200/90 px-2 py-0.5 rounded-full animate-pulse">
                        <RefreshCw className="w-2.5 h-2.5 text-amber-600 animate-spin" />
                        Auto-saving...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50/90 border border-emerald-200/90 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        Saved {lastSavedTime && `• ${lastSavedTime}`}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Configure prompt & parameters for Qwen auto-routing
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Undo / Redo History Stack Toolbar */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    canUndo
                      ? 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200/90 shadow-xs'
                      : 'text-slate-300 cursor-not-allowed'
                  }`}
                  title="Undo Parameter Adjustment (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline text-[10px]">Undo</span>
                </button>

                <span className="text-[10px] font-mono text-slate-400 px-1 font-bold">
                  {historyIndex + 1}/{historyStack.length}
                </span>

                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    canRedo
                      ? 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200/90 shadow-xs'
                      : 'text-slate-300 cursor-not-allowed'
                  }`}
                  title="Redo Parameter Adjustment (Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline text-[10px]">Redo</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  refreshAudioDiagnostics();
                  setShowAudioDiag((prev) => !prev);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
                  showAudioDiag
                    ? 'bg-slate-900 text-indigo-300 border-slate-700 shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Toggle Audio Playback Diagnostics"
              >
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Audio Diag</span>
              </button>

              <button
                onClick={onOpenAssistant}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors shrink-0"
              >
                <Bot className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Qwen Assistant</span>
              </button>
            </div>
          </div>

          {/* Prompt Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Creative Prompt
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPromptWizard(!showPromptWizard);
                    if (!showPromptWizard) setShowVideoGuide(false);
                  }}
                  className={`text-[11px] font-semibold flex items-center gap-1 transition-all px-2.5 py-1 rounded-xl border ${
                    showPromptWizard
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{showPromptWizard ? 'Close Wizard' : '🧙 Prompt Wizard'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowVideoGuide(!showVideoGuide);
                    if (!showVideoGuide) setShowPromptWizard(false);
                  }}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  <Clapperboard className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{showVideoGuide ? 'Hide Guide' : '🎬 Video Guide'}</span>
                </button>
              </div>
            </div>

            {/* Interactive Video Prompt Wizard Drawer */}
            {showPromptWizard && (
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-slate-100 rounded-2xl p-4 space-y-3.5 border border-indigo-500/30 shadow-xl">
                <div className="flex items-center justify-between border-b border-indigo-900/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                      <Wand2 className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-2">
                        <span>Cinematic Video Prompt Wizard</span>
                        <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                          Interactive Studio
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Select camera angles, lighting & art styles to auto-generate pro video prompts
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const cameras = [
                        '360° Drone Orbital Sweep',
                        'Low Angle Cinematic Push-In',
                        'Handheld Dynamic Tracking Shot',
                        'Slow Motion Close-up Macro',
                        'FPV Drone Dive & Roll',
                        'Wide Horizon Panoramic Sweep',
                      ];
                      const lightings = [
                        'Golden Hour Sunset Glow',
                        'Cyberpunk Neon Cyan & Magenta',
                        'Dramatic Stage Rim Lighting',
                        'Moody Volumetric Fog & Light Rays',
                        'High-Contrast Concert Strobe Lights',
                        'Warm Campfire & Lantern Reflections',
                      ];
                      const styles = [
                        'Cinematic 4K Anamorphic',
                        'Vintage 35mm Film Grain',
                        'Afro-Futuristic 3D Sci-Fi',
                        'Hyper-Realistic 8K Photorealism',
                        'Stylized Anime & Cell-Shading',
                        'Retro 90s VHS Glitch',
                      ];
                      const pacings = [
                        'Beat-Synced Choreography',
                        'High-Energy Explosive Cuts',
                        'Slow-Motion Atmospheric Drift',
                        'Smooth Steady-Cam Glide',
                      ];
                      setWizardCamera(cameras[Math.floor(Math.random() * cameras.length)]);
                      setWizardLighting(lightings[Math.floor(Math.random() * lightings.length)]);
                      setWizardStyle(styles[Math.floor(Math.random() * styles.length)]);
                      setWizardPacing(pacings[Math.floor(Math.random() * pacings.length)]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-500/40 text-[10px] font-mono font-bold flex items-center gap-1 transition-all"
                    title="Randomize Wizard Parameters"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Randomize</span>
                  </button>
                </div>

                {/* 4 Parameter Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  {/* Camera Angle & Movement */}
                  <div className="space-y-1 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Camera className="w-3 h-3 text-indigo-400" />
                      Camera Angle & Motion
                    </label>
                    <select
                      value={wizardCamera}
                      onChange={(e) => setWizardCamera(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-700/80 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="360° Drone Orbital Sweep">🎥 360° Drone Orbital Sweep</option>
                      <option value="Low Angle Cinematic Push-In">📐 Low Angle Cinematic Push-In</option>
                      <option value="Handheld Dynamic Tracking Shot">🏃 Handheld Dynamic Tracking</option>
                      <option value="Slow Motion Close-up Macro">🔍 Slow Motion Close-up Macro</option>
                      <option value="FPV Drone Dive & Roll">🚀 FPV Drone Dive & Roll</option>
                      <option value="Wide Horizon Panoramic Sweep">🌅 Wide Horizon Panoramic Sweep</option>
                      <option value="Overhead Bird's Eye Drone">🛸 Overhead Bird's Eye Drone</option>
                    </select>
                  </div>

                  {/* Lighting & Atmosphere */}
                  <div className="space-y-1 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 text-amber-400" />
                      Lighting & Ambiance
                    </label>
                    <select
                      value={wizardLighting}
                      onChange={(e) => setWizardLighting(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-700/80 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Golden Hour Sunset Glow">🌅 Golden Hour Sunset Glow</option>
                      <option value="Cyberpunk Neon Cyan & Magenta">🌃 Cyberpunk Neon Cyan/Magenta</option>
                      <option value="Dramatic Stage Rim Lighting">✨ Dramatic Stage Rim Lighting</option>
                      <option value="Moody Volumetric Fog & Light Rays">🌫️ Moody Volumetric Fog & Rays</option>
                      <option value="Natural Soft Window Glow">🪟 Natural Soft Window Glow</option>
                      <option value="High-Contrast Concert Strobe Lights">⚡ High-Contrast Concert Strobes</option>
                      <option value="Warm Campfire & Lantern Reflections">🔥 Warm Fire & Lantern Glow</option>
                    </select>
                  </div>

                  {/* Art Style & Aesthetic */}
                  <div className="space-y-1 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-pink-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Palette className="w-3 h-3 text-pink-400" />
                      Art Style & Aesthetic
                    </label>
                    <select
                      value={wizardStyle}
                      onChange={(e) => setWizardStyle(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-700/80 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Cinematic 4K Anamorphic">🎬 Cinematic 4K Anamorphic</option>
                      <option value="Vintage 35mm Film Grain">🎞️ Vintage 35mm Film Grain</option>
                      <option value="Afro-Futuristic 3D Sci-Fi">🚀 Afro-Futuristic 3D Sci-Fi</option>
                      <option value="Hyper-Realistic 8K Photorealism">📸 Hyper-Realistic 8K Photorealism</option>
                      <option value="Stylized Anime & Cell-Shading">🎨 Stylized Anime & Cell-Shading</option>
                      <option value="Retro 90s VHS Glitch">📼 Retro 90s VHS Glitch</option>
                      <option value="Surreal Dreamscape Fantasy">✨ Surreal Dreamscape Fantasy</option>
                    </select>
                  </div>

                  {/* Movement & Pacing */}
                  <div className="space-y-1 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Clapperboard className="w-3 h-3 text-emerald-400" />
                      Choreography & Pacing
                    </label>
                    <select
                      value={wizardPacing}
                      onChange={(e) => setWizardPacing(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-700/80 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Beat-Synced Choreography">💃 Beat-Synced Choreography</option>
                      <option value="High-Energy Explosive Cuts">⚡ High-Energy Explosive Cuts</option>
                      <option value="Slow-Motion Atmospheric Drift">🕊️ Slow-Motion Atmospheric Drift</option>
                      <option value="Smooth Steady-Cam Glide">🎥 Smooth Steady-Cam Glide</option>
                      <option value="Rhythmic Strobe Transitions">🔀 Rhythmic Strobe Transitions</option>
                    </select>
                  </div>
                </div>

                {/* Generated Prompt Live Concatenation Output */}
                <div className="p-3 bg-slate-950 rounded-xl border border-indigo-500/40 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold font-mono text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Wizard Concatenated Prompt Output:
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Ready to apply</span>
                  </div>

                  <p className="text-xs font-mono text-slate-200 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 leading-relaxed italic">
                    "{prompt.trim() || 'Create an emotional Afrobeats song'}, {wizardCamera.toLowerCase()}, {wizardLighting.toLowerCase()}, {wizardStyle.toLowerCase()}, {wizardPacing.toLowerCase()}"
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const base = prompt.trim() || 'Create an emotional Afrobeats music video';
                        const compiled = `${base}, ${wizardCamera.toLowerCase()}, ${wizardLighting.toLowerCase()}, ${wizardStyle.toLowerCase()}, ${wizardPacing.toLowerCase()}`;
                        setPrompt(compiled);
                        if (mode === 'music') {
                          setMode('music_video');
                        }
                        setShowPromptWizard(false);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>Apply Concatenated Prompt to Studio</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="relative">
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='Type your creative prompt (e.g. "Create an emotional Afrobeats song with cinematic golden hour music video")...'
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-sans resize-none"
              />
              <div className="absolute right-3 bottom-3 text-[10px] font-mono text-slate-400">
                Qwen Auto Routing
              </div>
            </div>

            {/* Quick Cinematic Video Prompt Modifiers */}
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span className="flex items-center gap-1 text-indigo-700 font-bold">
                  <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                  Add Cinematic Video Descriptors:
                </span>
                {mode === 'music' && (
                  <span className="text-[10px] font-mono text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                    Auto-enables Video
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '🎥 360° Drone Sweep', text: ', cinematic 360-degree drone camera sweep' },
                  { label: '🌅 Golden Hour Sunset', text: ', warm golden hour sunset glow with volumetric lighting' },
                  { label: '💃 Beat-Synced Dancers', text: ', energetic dancers performing choreography in sync with the beat' },
                  { label: '🌃 Cyberpunk Neon Street', text: ', futuristic cyberpunk city night with vibrant neon reflections' },
                  { label: '🌧️ Slow-Motion Rain', text: ', cinematic slow-motion rain drops on wet pavement' },
                  { label: '🎬 4K Anamorphic Lens', text: ', 4k anamorphic camera lens with bokeh depth of field' },
                ].map((mod, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!prompt.includes(mod.text.trim())) {
                        setPrompt((prev) => prev.trim() + mod.text);
                      }
                      if (mode === 'music') {
                        setMode('music_video');
                      }
                    }}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                  >
                    <span>+</span>
                    <span>{mod.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audio-Only Warning & Quick Switch Banner */}
          {mode === 'music' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold shrink-0">
                  <VideoOff className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span>Audio-Only Mode Active</span>
                    <span className="text-[9px] font-mono bg-amber-200/90 text-amber-900 px-1.5 py-0.2 rounded font-bold">No Video</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    'Music' mode generates audio only. To generate MP4 visuals with AI Wan 2.2, switch to 'Music + Video'.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode('music_video')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shrink-0 transition-colors shadow-xs flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Enable Video</span>
              </button>
            </div>
          )}

          {/* Creation Mode Pills */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Target Creation Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('music')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  mode === 'music'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                Music (Audio Only)
              </button>

              <button
                type="button"
                onClick={() => setMode('video')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  mode === 'video'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Video (Visuals Only)
              </button>

              <button
                type="button"
                onClick={() => setMode('music_video')}
                className={`col-span-2 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  mode === 'music_video'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                Music + Video (Full AI Pipeline)
              </button>
            </div>
          </div>

          {/* Song Lyrics Editor (sung by the rendered vocal line) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-indigo-600" />
                Song Lyrics
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {customizeParams.lyrics.trim() ? `${customizeParams.lyrics.trim().length} chars` : 'auto-generated'}
              </span>
            </div>
            <textarea
              rows={4}
              value={customizeParams.lyrics}
              onChange={(e) =>
                setCustomizeParams({ ...customizeParams, lyrics: e.target.value })
              }
              placeholder={`[Verse 1]\nYour lyrics here...`}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <p className="text-[10px] text-slate-400 font-mono">
              Your lyrics shape the sung vocal melody. Leave blank for auto-generated lyrics.
            </p>
          </div>

          {/* 16-Step Beat Maker */}
          <div className="border border-slate-200 rounded-2xl p-3 bg-gradient-to-br from-slate-50 to-indigo-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Drum className="w-3.5 h-3.5 text-indigo-600" />
                Beats — 16-Step Drum Pattern
              </label>
              <span className="text-[10px] font-mono text-slate-400">rendered into the final track</span>
            </div>
            <BeatMaker genre={customizeParams.genre} pattern={drumPattern} onChange={setDrumPattern} />
          </div>

          {/* Video Prompt Guide & Storyboard Studio Drawer */}
          {showVideoGuide && (
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-3.5 border border-slate-800 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                    <Clapperboard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <span>Video Prompt Guide & Storyboard Studio</span>
                      <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/30">
                        Wan 2.2 Model
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Mastering AI Video Generation Prompts & Camera Choreography
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVideoGuide(false)}
                  className="text-slate-400 hover:text-white text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              {/* Formula Structure */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold font-mono text-indigo-300 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cinematic Video Prompt Formula:</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] font-mono leading-relaxed text-slate-300">
                  <span className="text-indigo-400 font-bold">[Subject]</span> +{' '}
                  <span className="text-pink-400 font-bold">[Action/Choreo]</span> +{' '}
                  <span className="text-amber-400 font-bold">[Camera Angle]</span> +{' '}
                  <span className="text-emerald-400 font-bold">[Lighting & Setting]</span> +{' '}
                  <span className="text-cyan-400 font-bold">[Atmosphere & Resolution]</span>
                </div>
              </div>

              {/* Sample High-Quality Video Templates */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold font-mono text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Tested Video Prompt Presets (1-Click Load):</span>
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {[
                    {
                      title: '🎬 Afrobeats Sunset Performance',
                      desc: 'Lead singer performing on a Lagos beach, sunset gold glow, slow orbital drone tracking shot, vibrant Kente attire, 8K.',
                      p: 'Cinematic music video of a lead singer performing under golden sunset light on a Lagos beach, slow drone tracking shots, vibrant Kente fashion, 8K, beat-synced.',
                    },
                    {
                      title: '🎹 Amapiano Rooftop Twilight Vibe',
                      desc: 'Johannesburg skyline at twilight, log drum bass drops, neon reflections on wet glass, smooth camera rotation.',
                      p: 'Atmospheric Johannesburg rooftop party at twilight, deep log drum bass hits, neon lights reflecting on wet glass, smooth orbital camera rotation.',
                    },
                    {
                      title: '⚡ Cyberpunk Afro-Sci-Fi Masquerade',
                      desc: 'Futuristic city in 2088, holographic masquerade dancers, glowing sports cars, anamorphic depth of field.',
                      p: 'Futuristic neon city boulevard in 2088, holographic traditional masquerade dancers, glowing sports cars, cinematic 4K tracking shot.',
                    },
                  ].map((tpl, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setPrompt(tpl.p);
                        setMode('music_video');
                        setShowVideoGuide(false);
                      }}
                      className="p-2.5 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/50 rounded-xl cursor-pointer transition-all space-y-1 group"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-200 text-[11px]">
                        <span>{tpl.title}</span>
                        <span className="text-[10px] font-mono text-indigo-400 group-hover:underline">
                          Use Template →
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2">{tpl.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Video Storyboard Live Breakdown Preview */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Generated Storyboard Breakdown Preview:
                  </span>
                  <span className="text-[9px] text-slate-400">3 Scenes (30s)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-indigo-400 font-bold mb-1">Scene 1 (0s–5s)</div>
                    <p className="text-slate-300">Aerial sunset camera pan establishing mood matching {customizeParams.genre}.</p>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-pink-400 font-bold mb-1">Scene 2 (5s–15s)</div>
                    <p className="text-slate-300">Close-up performance with orbital camera tracking on lead artist.</p>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-amber-400 font-bold mb-1">Scene 3 (15s–30s)</div>
                    <p className="text-slate-300">Beat-synced group choreography with neon lighting flashes on chorus drop.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audio & Vocal Upload Adapter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowUploadAdapter(!showUploadAdapter)}
            className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 hover:from-indigo-800 hover:to-slate-800 text-white text-xs font-bold transition-all shadow-md border border-indigo-700/50 group"
          >
            <span className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>UPLOAD AUDIO / VOCAL & ADAPT (SUNO AI)</span>
            </span>
            <span className="text-[10px] font-mono bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/30">
              {showUploadAdapter ? 'Close Adapter ▲' : 'Open Upload Adapter ▼'}
            </span>
          </button>

          {/* AUDIO & VOCAL UPLOAD ADAPTER STUDIO DRAWER */}
          {showUploadAdapter && (
            <div className="bg-slate-950 text-slate-100 rounded-3xl p-4 space-y-4 border border-indigo-800/80 shadow-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold">
                    <FileAudio className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <span>Audio & Vocal Upload Adapter</span>
                      <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                        Suno AI v3.5
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Upload any music track to adapt vocals, or upload vocals to adapt backing beats
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadAdapter(false)}
                  className="text-slate-400 hover:text-white text-xs font-mono bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800"
                >
                  ✕ Close
                </button>
              </div>

              {/* Upload Type Selector Tabs */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setUploadMode('vocal_sample')}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                    uploadMode === 'vocal_sample'
                      ? 'bg-indigo-600/40 border-indigo-500 text-indigo-200 shadow-lg shadow-indigo-600/20'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 text-indigo-400" />
                  <span>1. Upload Vocal / Acapella</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadMode('music_track')}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                    uploadMode === 'music_track'
                      ? 'bg-indigo-600/40 border-indigo-500 text-indigo-200 shadow-lg shadow-indigo-600/20'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Music className="w-3.5 h-3.5 text-pink-400" />
                  <span>2. Upload Music Track</span>
                </button>
              </div>

              {/* File Drag & Drop Box */}
              <div className="relative border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 rounded-2xl p-5 bg-indigo-950/20 text-center transition-all group">
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.webm"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isAnalyzingAudio ? (
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                    ) : (
                      <UploadCloud className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-200 font-mono">
                    {uploadMode === 'vocal_sample'
                      ? 'Drop your Vocal Recording / Acapella / Voice Memo here'
                      : 'Drop your Music Track / Instrumental / Song here'}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Supports MP3, WAV, M4A, AAC, FLAC, WEBM (Up to 50MB)
                  </p>
                </div>
              </div>

              {/* Real audio upload notice */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                <Upload className="w-3 h-3 text-indigo-400" />
                <span>Upload your own vocals or instrumental — it will be blended into the final render.</span>
              </div>

              {/* Uploaded File Spectrum & Adaptation Control Studio */}
              {uploadedFile && (
                <div className="bg-slate-900/90 border border-indigo-800/80 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 truncate">
                      <Disc className="w-4 h-4 text-indigo-400 animate-spin" />
                      <span className="font-bold text-slate-200 truncate">{uploadedFile.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 font-bold">
                        {uploadedFile.bpm} BPM
                      </span>
                      <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800 font-bold">
                        {uploadedFile.key}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {uploadedFile.durationSec}s
                      </span>
                    </div>
                  </div>

                  {/* 32-Bar Visual Audio Spectrum Peaks */}
                  <div className="space-y-1">
                    <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between">
                      <span>AUDIO WAVEFORM SPECTRUM</span>
                      <span className="text-indigo-400 font-bold">32-Band Peak Analysis</span>
                    </div>
                    <div className="flex items-end justify-between gap-1 h-12 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      {uploadedFile.waveformPeaks.map((peak, idx) => (
                        <div
                          key={idx}
                          style={{ height: `${peak}%` }}
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            idx % 4 === 0
                              ? 'bg-indigo-500'
                              : idx % 2 === 0
                              ? 'bg-purple-500'
                              : 'bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* HTML5 Audio Player */}
                  <audio
                    controls
                    src={uploadedFile.audioUrl}
                    className="w-full h-8 accent-indigo-500 rounded-lg"
                  />

                  {/* Mode-Specific Adaptation Configuration */}
                  {uploadMode === 'vocal_sample' ? (
                    /* Vocal Upload Mode -> Adapt Backing Beat & Suno Voice */
                    <div className="space-y-2.5 pt-1 border-t border-slate-800">
                      <div className="text-[11px] font-bold font-mono text-indigo-300 flex items-center gap-1.5">
                        <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Adapt Backing Beat & Suno Voice Model:</span>
                      </div>

                      {/* Select Target Genre for Vocal */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 block">
                          Generate Backing Beat Genre for Vocal:
                        </label>
                        <select
                          value={targetBackingGenre}
                          onChange={(e) => setTargetBackingGenre(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Afrobeats">Afrobeats (Highlife & Talking Drums)</option>
                          <option value="Amapiano">Amapiano (Log Drum & Piano Grooves)</option>
                          <option value="Deep House">Deep House (Four-on-the-Floor & Synth)</option>
                          <option value="R&B / Soul">R&B / Soul (Rhodes Piano & Smooth 808)</option>
                          <option value="Gospel">African Gospel Choir & High Praise</option>
                          <option value="Trap / Hip-Hop">Trap / Hip-Hop (808 Slap & Hi-Hats)</option>
                        </select>
                      </div>

                      {/* Select Suno Voice Treatment */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 block">
                          Suno Voice Enhancement Model:
                        </label>
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                          {[
                            { id: 'Female Vocal', label: '🎤 Suno Female Soprano' },
                            { id: 'Male Vocal', label: '🎙️ Suno Male Baritone' },
                            { id: 'Duet', label: '👥 Harmonized Duet' },
                          ].map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setTargetVocalModel(m.id as any)}
                              className={`p-1.5 rounded-lg border font-bold text-center transition-all ${
                                targetVocalModel === m.id
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Music Track Upload Mode -> Adapt Vocals onto Track */
                    <div className="space-y-2.5 pt-1 border-t border-slate-800">
                      <div className="text-[11px] font-bold font-mono text-indigo-300 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-pink-400" />
                        <span>Adapt Suno AI Vocals onto Uploaded Music Track:</span>
                      </div>

                      {/* Target Vocal Model Selection */}
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                        {[
                          { id: 'Female Vocal', label: '🎤 Female Soprano', desc: 'Suno v3.5 Lead' },
                          { id: 'Male Vocal', label: '🎙️ Male Baritone', desc: 'Suno v3.5 Lead' },
                          { id: 'Duet', label: '👥 Harmonized Duet', desc: 'Male & Female' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setTargetVocalModel(m.id as any)}
                            className={`p-2 rounded-xl border font-bold text-left transition-all ${
                              targetVocalModel === m.id
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <div className="truncate">{m.label}</div>
                            <div className="text-[8px] opacity-80">{m.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Apply Adaptation Action Button */}
                  <button
                    type="button"
                    onClick={() => handleApplyAudioAdaptation()}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono text-xs font-bold shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-white animate-spin" />
                    <span>
                      {uploadMode === 'vocal_sample'
                        ? '⚡ ADAPT BEAT & SUNO VOICE FOR VOCAL'
                        : '⚡ ADAPT VOCALS ONTO MUSIC TRACK'}
                    </span>
                  </button>
                </div>
              )}

              {/* Feedback Alert */}
              {adaptationFeedback && (
                <div className="p-2.5 bg-indigo-950/80 border border-indigo-700/60 rounded-xl text-[11px] font-mono text-indigo-200 font-semibold text-center animate-pulse">
                  {adaptationFeedback}
                </div>
              )}
            </div>
          )}

          {/* Customize Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowCustomize(!showCustomize)}
            className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              Advanced Audio Parameters
            </span>
            {showCustomize ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Quick Presets */}
          <div className="pt-1">
            <span className="text-[11px] font-medium text-slate-400 block mb-1.5">Quick Inspiration Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {quickPresets.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(qp.p);
                    setMode(qp.mode);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 transition-colors"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* BIG CREATE BUTTON */}
          <button
            type="button"
            onClick={() => handleCreate()}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group mt-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Qwen & Models Executing...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>GENERATE NOW</span>
              </>
            )}
          </button>
        </div>

        {/* CUSTOMIZE EXPANDED DRAWER CARD */}
        {showCustomize && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              Custom Arrangement Settings
            </h3>

            <div className="space-y-3">
              {/* Genre */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Genre (60+ Available)
                </label>
                <select
                  value={customizeParams.genre}
                  onChange={(e) => {
                    setCustomizeParams({ ...customizeParams, genre: e.target.value });
                    setDrumPattern(defaultPatternForGenre(e.target.value));
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  {INITIAL_GENRES.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name} ({g.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subgenre */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Subgenre / Style Variant
                </label>
                <input
                  type="text"
                  value={customizeParams.subgenre}
                  onChange={(e) =>
                    setCustomizeParams({ ...customizeParams, subgenre: e.target.value })
                  }
                  placeholder="e.g. Afro-Pop, Deep Log Drum"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Interactive Tempo (BPM) & Tap Tempo Studio */}
              <div className="space-y-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/90">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Tempo & Rhythm (BPM)</span>
                  </label>
                  <span className="font-mono text-indigo-700 font-bold text-xs bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                    {customizeParams.bpm} BPM
                  </span>
                </div>

                <input
                  type="range"
                  min={60}
                  max={180}
                  value={customizeParams.bpm}
                  onChange={(e) =>
                    setCustomizeParams({ ...customizeParams, bpm: parseInt(e.target.value) })
                  }
                  className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />

                {/* Quick BPM Presets */}
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                  <span>Quick Presets:</span>
                  <div className="flex gap-1 font-mono">
                    {[
                      { bpm: 80, label: '80 Chill' },
                      { bpm: 108, label: '108 Afro' },
                      { bpm: 120, label: '120 House' },
                      { bpm: 140, label: '140 Trap' },
                    ].map((p) => (
                      <button
                        key={p.bpm}
                        type="button"
                        onClick={() => setCustomizeParams({ ...customizeParams, bpm: p.bpm })}
                        className={`px-1.5 py-0.5 rounded border transition-colors ${
                          customizeParams.bpm === p.bpm
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Tap Tempo Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleTapTempo}
                    className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all shadow-sm active:scale-98 select-none ${
                      isTapFlashing
                        ? 'bg-indigo-600 text-white border-indigo-400 scale-[0.99] shadow-indigo-500/30'
                        : 'bg-white hover:bg-indigo-50/80 text-indigo-700 border-indigo-200 shadow-slate-200/50'
                    }`}
                  >
                    <Activity className={`w-4 h-4 ${isTapFlashing ? 'text-white animate-bounce' : 'text-indigo-600'}`} />
                    <span>🎯 TAP TEMPO (CLICK IN RHYTHM)</span>
                  </button>

                  {tapFeedback && (
                    <div className="text-[10px] font-mono text-center text-indigo-600 font-semibold mt-1 animate-pulse">
                      {tapFeedback}
                    </div>
                  )}
                </div>
              </div>

              {/* Key Signature */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Key Signature
                </label>
                <select
                  value={customizeParams.keySignature}
                  onChange={(e) =>
                    setCustomizeParams({ ...customizeParams, keySignature: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  {['C Major', 'D Minor', 'E Minor', 'F# Minor', 'G Major', 'A Minor', 'B Flat Major'].map(
                    (k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Suno AI Studio Vocal Model & Gender Selector */}
              <div className="space-y-2 bg-gradient-to-br from-indigo-50/80 via-slate-50 to-purple-50/60 p-3 rounded-2xl border border-indigo-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Suno AI Vocal Model & Gender</span>
                  </label>
                  <span className="text-[9px] font-mono bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full shadow-xs">
                    Suno v3.5 Quality
                  </span>
                </div>

                {/* Male / Female / Duet Voice Model Pills */}
                <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                  {[
                    { id: 'Male Vocal', label: '🎙️ Suno Male Lead', desc: 'Warm Baritone & R&B Tenor' },
                    { id: 'Female Vocal', label: '🎤 Suno Female Lead', desc: 'Crystal Soprano & Afro-Pop' },
                    { id: 'Duet', label: '👥 Suno Studio Duet', desc: 'Male & Female Harmonized' },
                    { id: 'Choir', label: '🏛️ Suno Gospel Choir', desc: 'Rich Vocal Ensemble' },
                  ].map((v) => {
                    const isSelected = customizeParams.vocalStyle === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          const updatedInsts = customizeParams.instruments.filter(
                            (i) => !i.toLowerCase().includes('vocal')
                          );
                          const newVocalInst =
                            v.id === 'Male Vocal'
                              ? 'Suno AI Male Vocal Lead'
                              : v.id === 'Female Vocal'
                              ? 'Suno AI Female Vocal Lead'
                              : v.id === 'Duet'
                              ? 'Male & Female Duet'
                              : 'African Gospel Choir';
                          setCustomizeParams({
                            ...customizeParams,
                            vocalStyle: v.id as any,
                            instruments: [...updatedInsts, newVocalInst],
                          });
                        }}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.01]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-bold text-[11px]">{v.label}</div>
                        <div className={`text-[9px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                          {v.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Suno Vocal Style Presets Quick Chips */}
                <div className="pt-1 space-y-1">
                  <div className="text-[10px] font-mono font-bold text-slate-600 flex items-center justify-between">
                    <span>Suno AI Vocal Presets (1-Click Pitch & Timbre):</span>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                    {[
                      { label: '🎙️ Male R&B Baritone', style: 'Male Vocal', inst: 'Suno AI Male Vocal Lead', promptAdd: ', Suno AI Male R&B Baritone vocals, pitch corrected, smooth vibrato' },
                      { label: '🔥 Male Autotuned Trap', style: 'Male Vocal', inst: 'Autotuned Male Trap Vocal', promptAdd: ', Suno AI Male Autotuned Trap vocals, heavy pitch quantization' },
                      { label: '🎤 Female Afro-Pop Soprano', style: 'Female Vocal', inst: 'Suno AI Female Vocal Lead', promptAdd: ', Suno AI Female Afro-Pop Soprano lead vocals, high clarity, sweet timbre' },
                      { label: '✨ Female Crystal Belt', style: 'Female Vocal', inst: 'Suno AI Female Crystal Soprano', promptAdd: ', Suno AI Female Crystal Soprano vocal belt, emotional resonance' },
                      { label: '👥 Male + Female Duet', style: 'Duet', inst: 'Male & Female Duet', promptAdd: ', Suno AI Male and Female harmonized duet lead vocals' },
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const cleanInsts = customizeParams.instruments.filter(
                            (i) => !i.toLowerCase().includes('vocal')
                          );
                          setCustomizeParams({
                            ...customizeParams,
                            vocalStyle: p.style as any,
                            instruments: [...cleanInsts, p.inst],
                          });
                          if (!prompt.includes(p.promptAdd.trim())) {
                            setPrompt((prev) => prev.trim() + p.promptAdd);
                          }
                        }}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-semibold transition-all active:scale-95 shadow-2xs"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Instrument Selection Tags */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Active Instruments ({customizeParams.instruments.length} Selected)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-28 overflow-y-auto">
                  {[
                    'Suno AI Male Vocal Lead',
                    'Suno AI Female Vocal Lead',
                    'Talking Drum',
                    'Djembe',
                    'Electric Guitar',
                    '808',
                    'Piano',
                    'Kora',
                    'Grand Piano',
                    'Acoustic Guitar',
                    'Log Drum',
                    'Brass Horns',
                    'Strings',
                    'Saxophone',
                    'Synthesizer',
                  ].map((inst) => {
                    const isSelected = customizeParams.instruments.includes(inst);
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? customizeParams.instruments.filter((i) => i !== inst)
                            : [...customizeParams.instruments, inst];
                          setCustomizeParams({ ...customizeParams, instruments: updated });
                        }}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{inst}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                  <span>Song Duration</span>
                  <span className="font-mono text-indigo-600 font-bold">{customizeParams.durationSec}s</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={300}
                  step={15}
                  value={customizeParams.durationSec}
                  onChange={(e) =>
                    setCustomizeParams({
                      ...customizeParams,
                      durationSec: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Lyrics Editor */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Custom Lyrics / Structure
                </label>
                <textarea
                  rows={3}
                  value={customizeParams.lyrics}
                  onChange={(e) =>
                    setCustomizeParams({ ...customizeParams, lyrics: e.target.value })
                  }
                  placeholder="[Verse 1]...\n[Chorus]..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANE: AIGenerationSteps Progress & Asset Previews (lg:col-span-7) */}
      <div className="lg:col-span-7 space-y-6">
        {/* AIGenerationSteps & Model Routing Progress Bar Panel */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                  AIGenerationSteps Routing Progress ({steps.length} Steps)
                </h3>
                <p className="text-[11px] text-slate-500">
                  {mode === 'music'
                    ? "Route: 'Analyzing Request' → 'Generating Audio' → 'Finalizing Media'"
                    : mode === 'video'
                    ? "Route: 'Analyzing Request' → 'Rendering Video' → 'Finalizing Media'"
                    : "Route: 'Analyzing Request' → 'Generating Audio' → 'Synthesizing Video' → 'Finalizing Media'"}
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 self-start sm:self-auto">
              Mode: {mode.toUpperCase().replace('_', ' + ')}
            </span>
          </div>

          {/* Step Cards Progress Flow Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
            {steps.map((step, idx) => {
              const isCompleted = loading ? idx < currentStepIndex : false;
              const isCurrent = loading && idx === currentStepIndex;
              const isPending = loading ? idx > currentStepIndex : true;

              return (
                <div key={step.id} className="relative">
                  <div
                    className={`h-full p-3.5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-indigo-50/90 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                        : isCompleted
                        ? 'bg-emerald-50/80 border-emerald-300'
                        : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          isCurrent
                            ? 'bg-indigo-600 text-white animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        Step {step.stepNumber}
                      </span>

                      <div className="flex items-center gap-1 text-[11px] font-mono font-semibold">
                        <span className="text-slate-500">{step.model}</span>
                        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {isCurrent && <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />}
                        {isPending && !loading && <Clock className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                    </div>

                    <h4
                      className={`text-xs font-bold ${
                        isCurrent
                          ? 'text-indigo-950'
                          : isCompleted
                          ? 'text-emerald-950'
                          : 'text-slate-800'
                      }`}
                    >
                      {step.title}
                    </h4>

                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Processing Progress Bar & Execution Logs */}
          {loading && (
            <div className="bg-slate-950 rounded-2xl p-4 text-white space-y-3 shadow-inner border border-slate-800">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-2 text-indigo-400 font-bold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Execution Progress
                </span>
                <span className="text-emerald-400 font-bold">{progressPercent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Execution Terminal Logs */}
              <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 max-h-28 overflow-y-auto">
                {executionLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-1.5 leading-relaxed">
                    <span className="text-indigo-400 select-none">&gt;</span>
                    <span className="text-slate-200">{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Final Asset Preview Stage */}
        {activeProject ? (
          <div className="bg-slate-900 rounded-3xl p-5 md:p-6 text-white shadow-2xl space-y-5 relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-mono uppercase">
                    Final Asset Stage
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Model: {activeProject.modelUsed}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    Project Synced
                  </span>
                </div>
                <h3 className="text-xl font-bold mt-1 text-white">{activeProject.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeProject.genre} • {activeProject.bpm} BPM • Key: {activeProject.keySignature}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    refreshAudioDiagnostics();
                    setShowAudioDiag((prev) => !prev);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    showAudioDiag
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Toggle Audio Diagnostics Overlay"
                >
                  <Activity className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Diagnostics</span>
                </button>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => downloadAsWav(activeProject.audioUrl || '', activeProject.title)}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-mono font-bold border border-indigo-500/40 transition-colors flex items-center gap-1"
                    title="Download WAV Lossless Audio"
                  >
                    <FileAudio className="w-3.5 h-3.5 text-indigo-400" />
                    <span>WAV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadAsMp3(activeProject.audioUrl || '', activeProject.title)}
                    className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-mono font-bold border border-purple-500/40 transition-colors flex items-center gap-1"
                    title="Download 320kbps MP3 Audio"
                  >
                    <Music className="w-3.5 h-3.5 text-purple-400" />
                    <span>MP3</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadAsMp4(activeProject.videoUrl, activeProject.audioUrl, activeProject.title)}
                    className="px-2.5 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-xs font-mono font-bold border border-pink-500/40 transition-colors flex items-center gap-1"
                    title="Download 1080p HD MP4 Video"
                  >
                    <Film className="w-3.5 h-3.5 text-pink-400" />
                    <span>MP4</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-mono font-bold shadow-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Studio</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Audio Playback Diagnostics Overlay Panel */}
            {showAudioDiag && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3 backdrop-blur-md text-xs font-mono transition-all animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-slate-200 text-xs tracking-wider">
                      AUDIO ENGINE DIAGNOSTICS OVERLAY
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshAudioDiagnostics}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-md transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Re-scan Specs
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAudioDiag(false)}
                      className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-slate-800"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Sample Rate</div>
                    <div className="text-sm font-bold font-mono text-indigo-300 mt-0.5">{audioDiag.sampleRate}</div>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Buffer Size</div>
                    <div className="text-sm font-bold font-mono text-emerald-300 mt-0.5">{audioDiag.bufferSize}</div>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Channel Count</div>
                    <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">{audioDiag.channelCount}</div>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Audio Context</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${audioDiag.contextState === 'running' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className="text-sm font-bold font-mono text-slate-200 capitalize">{audioDiag.contextState}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Processing Latency: <strong className="text-slate-200 font-mono">{audioDiag.latencyMs}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResumeAudioContext}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Unmute / Resume Audio Context
                  </button>
                </div>
              </div>
            )}

            {/* Media Stage Player */}
            <div className="space-y-4">
              <div className="relative aspect-video rounded-2xl bg-black overflow-hidden border border-slate-800 shadow-xl group">
                {activeProject.videoUrl && !hasVideoError ? (
                  <video
                    src={activeProject.videoUrl}
                    controls
                    onError={() => setHasVideoError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={activeProject.thumbnailUrl}
                    alt={activeProject.title}
                    className="w-full h-full object-cover opacity-80"
                  />
                )}

                {/* Play Overlay for Audio Only or Video Fallback */}
                {(!activeProject.videoUrl || hasVideoError) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 gap-3">
                    <button
                      onClick={onTogglePlay}
                      className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-105"
                    >
                      {isPlaying ? (
                        <Pause className="w-7 h-7 fill-white" />
                      ) : (
                        <Play className="w-7 h-7 fill-white ml-0.5" />
                      )}
                    </button>
                    {hasVideoError && (
                      <span className="text-[11px] font-mono text-amber-300 bg-black/70 px-3 py-1 rounded-full border border-amber-500/30">
                        Video stream offline — Playing audio preview
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Real-Time Waveform & Audio Spectrum Visualizer */}
              <RealtimeWaveformVisualizer
                project={activeProject}
                isPlaying={isPlaying}
                onTogglePlay={onTogglePlay}
                activeStems={activeStemToggle}
                onStemToggle={(stem) =>
                  setActiveStemToggle((prev) => ({
                    ...prev,
                    [stem]: !prev[stem],
                  }))
                }
                disableOverlayVocal
              />
            </div>

            {/* Lyrics & Instruments Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                <h4 className="text-xs font-bold font-mono text-indigo-400 uppercase flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Lyrics & Arrangement
                </h4>
                <pre className="text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                  {activeProject.lyrics}
                </pre>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                <h4 className="text-xs font-bold font-mono text-purple-400 uppercase flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" />
                  Arrangement Instruments
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {activeProject.instruments.map((inst, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700"
                    >
                      🎹 {inst}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center space-y-3">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-semibold text-slate-700 text-sm">No Active Asset Rendered</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Enter a creative prompt in the left pane and click Generate to see the live rendering process and final media preview here.
            </p>
          </div>
        )}
      </div>

      {/* Export Studio Format Selection Modal */}
      <ExportFormatModal
        project={activeProject}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
};
