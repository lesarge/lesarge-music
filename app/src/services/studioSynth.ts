/**
 * studioSynth.ts — Real offline procedural music synthesis engine.
 *
 * Renders an actual WAV track in the browser (OfflineAudioContext) from
 * genre / key / BPM / instruments / lyrics / drum-pattern parameters.
 * No sample MP3s, no fake progress. 100% Web Audio API synthesis.
 */

import { bufferToWavBlob } from '../utils/audioExporter';

export interface DrumPattern {
  kick: boolean[];
  snare: boolean[];
  hihat: boolean[];
  clap: boolean[];
}

export interface SynthParams {
  genre: string;
  bpm: number;
  keySignature: string;
  instruments: string[];
  lyrics: string;
  durationSec: number;
  vocalStyle: string;
  isInstrumental: boolean;
  energy: number;
  mood: string;
  drumPattern?: DrumPattern;
}

export interface RenderedTrack {
  blob: Blob;
  buffer: AudioBuffer;
  durationSec: number;
  waveformData: number[];
  url: string;
}

export const STEPS = 16;

// ---------------------------------------------------------------------------
// Small deterministic PRNG (mulberry32) so results are stable per request
// ---------------------------------------------------------------------------
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Music theory helpers
// ---------------------------------------------------------------------------
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function parseKey(keySignature: string): { root: number; minor: boolean; name: string } {
  const k = (keySignature || 'A Minor').trim();
  const minor = /min/i.test(k);
  let root = 9; // default A
  const m = k.match(/^([A-Ga-g])([#b♯♭]*)/);
  if (m) {
    const base = m[1].toUpperCase();
    root = NOTE_NAMES.indexOf(base);
    if (root < 0) root = 9;
    if (m[2].includes('#') || m[2].includes('♯')) root = (root + 1) % 12;
    if (m[2].includes('b') || m[2].includes('♭')) root = (root + 11) % 12;
  }
  return { root, minor, name: `${NOTE_NAMES[root]} ${minor ? 'Minor' : 'Major'}` };
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function buildScale(root: number, minor: boolean): number[] {
  const intervals = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  // Base at C3 (midi 48) so chords sit in a playable register
  return intervals.map((iv) => root + iv + 48);
}

function chordFromScale(scale: number[], deg: number, baseOctave: number): number[] {
  const get = (d: number, oct: number) => scale[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
  return [get(deg, baseOctave), get(deg + 2, baseOctave), get(deg + 4, baseOctave), get(deg + 6, baseOctave)];
}

function pentatonicIndices(scale: number[], minor: boolean): number[] {
  // indices into scale array for pentatonic subset
  return minor ? [0, 2, 3, 4, 6] : [0, 1, 2, 4, 5];
}

// ---------------------------------------------------------------------------
// Genre configuration table
// ---------------------------------------------------------------------------
type BassStyle = 'fourfloor' | 'logdrum' | 'syncopated' | 'trap' | 'legato' | 'reggae' | 'rock';
type LeadStyle = 'pluck' | 'saw' | 'square' | 'sine' | 'organ';

interface GenreConfig {
  id: string;
  aliases: string[];
  bpm: number;
  patterns: Record<'kick' | 'snare' | 'hihat' | 'clap', string>;
  bass: BassStyle;
  lead: LeadStyle;
  minor: boolean;
  progression: number[];
  padWave: OscillatorType;
  leadWave: OscillatorType;
  arp: boolean;
  energy: number;
}

const P = (s: string) => s.split('').map((c) => c === 'x');

const GENRE_CONFIGS: GenreConfig[] = [
  {
    id: 'afrobeats', aliases: ['afrobeats', 'afrobeat', 'afropop', 'afro pop'], bpm: 108,
    patterns: { kick: 'x...x...x.x.....', snare: '....x.......x...', hihat: 'x.x.x.x.x.x.x.x.', clap: '........x.......' },
    bass: 'syncopated', lead: 'pluck', minor: true, progression: [0, 5, 2, 6],
    padWave: 'triangle', leadWave: 'triangle', arp: false, energy: 0.75,
  },
  {
    id: 'amapiano', aliases: ['amapiano', 'log drum', 'logdrum', 'piano groove'], bpm: 113,
    patterns: { kick: 'x..x.x...x..x.x..', snare: '....x.......x...', hihat: '.x.x.x.x.x.x.x.x.', clap: '..x...x...x...x.' },
    bass: 'logdrum', lead: 'pluck', minor: true, progression: [0, 5, 2, 4],
    padWave: 'triangle', leadWave: 'sine', arp: true, energy: 0.6,
  },
  {
    id: 'afro_house', aliases: ['afro house'], bpm: 122,
    patterns: { kick: 'x...x...x...x...', snare: '....x.......x...', hihat: 'x.x.x.x.x.x.x.x.', clap: '....x.......x...' },
    bass: 'fourfloor', lead: 'pluck', minor: true, progression: [0, 5, 2, 4],
    padWave: 'triangle', leadWave: 'triangle', arp: true, energy: 0.8,
  },
  {
    id: 'deep_house', aliases: ['deep house', 'house', 'tech house', 'progressive house', 'edm', 'techhouse'], bpm: 124,
    patterns: { kick: 'x...x...x...x...', snare: '....x.......x...', hihat: '..x..x..x..x..x..', clap: '....x.......x...' },
    bass: 'fourfloor', lead: 'saw', minor: true, progression: [0, 5, 3, 4],
    padWave: 'sawtooth', leadWave: 'sawtooth', arp: true, energy: 0.8,
  },
  {
    id: 'rnb', aliases: ['rnb', 'r&b', 'soul', 'afro rnb', 'afro r&b', 'afro soul', 'slow jam'], bpm: 88,
    patterns: { kick: 'x.......x.......', snare: '....x.......x...', hihat: 'x.x...x.x.x...x.', clap: '........x.......' },
    bass: 'legato', lead: 'sine', minor: true, progression: [0, 5, 4, 4],
    padWave: 'sine', leadWave: 'sine', arp: false, energy: 0.45,
  },
  {
    id: 'gospel', aliases: ['gospel', 'worship', 'church', 'choir'], bpm: 110,
    patterns: { kick: 'x...x...x...x...', snare: '....x.......x...', hihat: 'x.x.x.x.x.x.x.x.', clap: '........x.......' },
    bass: 'syncopated', lead: 'organ', minor: false, progression: [0, 4, 5, 3],
    padWave: 'sawtooth', leadWave: 'sawtooth', arp: false, energy: 0.7,
  },
  {
    id: 'trap', aliases: ['trap', 'hip hop', 'hiphop', 'rap', 'afro trap', 'afro-trap'], bpm: 138,
    patterns: { kick: 'x......x........', snare: '........x.......', hihat: 'x.xx.xx.x.xx.xx.x', clap: '........x.......' },
    bass: 'trap', lead: 'square', minor: true, progression: [0, 6, 5, 3],
    padWave: 'sawtooth', leadWave: 'square', arp: false, energy: 0.85,
  },
  {
    id: 'synthwave', aliases: ['synthwave', 'synth wave', 'cyber', 'sci-fi', 'retro', 'synth', 'future'], bpm: 120,
    patterns: { kick: 'x...x...x...x...', snare: '....x.......x...', hihat: 'x.x.x.x.x.x.x.x.', clap: '........x.......' },
    bass: 'fourfloor', lead: 'saw', minor: true, progression: [0, 5, 6, 4],
    padWave: 'sawtooth', leadWave: 'sawtooth', arp: true, energy: 0.8,
  },
  {
    id: 'highlife', aliases: ['highlife'], bpm: 116,
    patterns: { kick: 'x...x...x...x...', snare: '....x.......x...', hihat: 'x.x.x.x.x.x.x.x.', clap: '........x.......' },
    bass: 'syncopated', lead: 'pluck', minor: false, progression: [0, 3, 4, 3],
    padWave: 'triangle', leadWave: 'triangle', arp: false, energy: 0.6,
  },
  {
    id: 'dancehall', aliases: ['dancehall', 'reggae', 'ska', 'ragga'], bpm: 100,
    patterns: { kick: 'x.......x.......', snare: '....x.......x...', hihat: 'x.x.x...x.x.x...', clap: '........x.......' },
    bass: 'reggae', lead: 'pluck', minor: true, progression: [0, 6, 5, 4],
    padWave: 'triangle', leadWave: 'triangle', arp: false, energy: 0.6,
  },
  {
    id: 'rock', aliases: ['rock', 'metal', 'punk', 'indie', 'alternative', 'alt rock'], bpm: 130,
    patterns: { kick: 'x...x...x...x...', snare: '....x.......x...', hihat: 'x.x.x.x.x.x.x.x.', clap: '........x.......' },
    bass: 'rock', lead: 'saw', minor: true, progression: [0, 5, 3, 4],
    padWave: 'sawtooth', leadWave: 'sawtooth', arp: false, energy: 0.9,
  },
  {
    id: 'techno', aliases: ['techno', 'trance', 'progressive'], bpm: 130,
    patterns: { kick: 'x...x...x...x...', snare: '....x.......x...', hihat: '..x..x..x..x..x..', clap: '....x.......x...' },
    bass: 'fourfloor', lead: 'saw', minor: true, progression: [0, 4, 5, 3],
    padWave: 'sawtooth', leadWave: 'sawtooth', arp: true, energy: 0.85,
  },
  {
    id: 'jazz', aliases: ['jazz', 'blues', 'swing'], bpm: 100,
    patterns: { kick: 'x...x.......x...', snare: '....x.......x...', hihat: 'x.x.x...x.x.x...', clap: '........x.......' },
    bass: 'legato', lead: 'sine', minor: true, progression: [0, 6, 5, 0],
    padWave: 'triangle', leadWave: 'sine', arp: false, energy: 0.4,
  },
  {
    id: 'ambient', aliases: ['ambient', 'lo-fi', 'lofi', 'chill', 'meditation', 'relax'], bpm: 80,
    patterns: { kick: 'x.......x.......', snare: '....x.......x...', hihat: '...x....x...x...', clap: '........x.......' },
    bass: 'legato', lead: 'sine', minor: true, progression: [0, 5, 3, 6],
    padWave: 'sine', leadWave: 'sine', arp: false, energy: 0.25,
  },
  {
    id: 'dance', aliases: ['dance', 'pop', 'edm'], bpm: 120,
    patterns: { kick: 'x...x...x...x...', snare: '....x.......x...', hihat: 'x.x.x.x.x.x.x.x.', clap: '....x.......x...' },
    bass: 'fourfloor', lead: 'saw', minor: false, progression: [0, 4, 5, 3],
    padWave: 'sawtooth', leadWave: 'sawtooth', arp: true, energy: 0.8,
  },
];

const DEFAULT_CONFIG: GenreConfig = {
  id: 'default', aliases: [], bpm: 108,
  patterns: { kick: 'x...x...x.x.....', snare: '....x.......x...', hihat: 'x.x.x.x.x.x.x.x.', clap: '........x.......' },
  bass: 'syncopated', lead: 'pluck', minor: true, progression: [0, 5, 2, 6],
  padWave: 'triangle', leadWave: 'triangle', arp: false, energy: 0.7,
};

// Exact genre-name lookup (lowercased) → synth config id. Covers every genre in
// the UI library plus the server's parsed genre names, so no genre silently
// falls back to the DEFAULT (Afrobeats-ish) config.
const GENRE_NAME_MAP: Record<string, string> = {
  afrobeats: 'afrobeats', amapiano: 'amapiano', 'afro house': 'afro_house',
  'afro soul': 'rnb', 'afro r&b': 'rnb', highlife: 'highlife',
  juju: 'afrobeats', fuji: 'afrobeats', soukous: 'afrobeats', 'congolese rumba': 'afrobeats',
  'african gospel': 'gospel', 'bongo flava': 'afrobeats', gengetone: 'trap', gqom: 'afro_house',
  kizomba: 'afrobeats', makossa: 'afrobeats', mbalax: 'afrobeats', marrabenta: 'afrobeats',
  taarab: 'afrobeats', zilizopendwa: 'afrobeats', kwaito: 'afro_house', maskandi: 'afrobeats',
  pop: 'dance', 'r&b': 'rnb', 'r&b / soul': 'rnb', soul: 'rnb', funk: 'rnb',
  'hip hop': 'trap', rap: 'trap', house: 'deep_house', 'deep house': 'deep_house',
  'tech house': 'deep_house', 'progressive house': 'deep_house', techno: 'techno', trance: 'techno',
  edm: 'deep_house', 'drum & bass': 'techno', dubstep: 'techno', ambient: 'ambient',
  'lo-fi': 'ambient', lofi: 'ambient', rock: 'rock', metal: 'rock', punk: 'rock', indie: 'rock',
  alternative: 'rock', jazz: 'jazz', blues: 'jazz', reggae: 'dancehall', dancehall: 'dancehall',
  latin: 'dancehall', reggaeton: 'dancehall', salsa: 'dance', bachata: 'dance', merengue: 'dance',
  flamenco: 'dance', classical: 'ambient', country: 'rock', folk: 'rock', 'k-pop': 'dance',
  'j-pop': 'dance', arabic: 'ambient', indian: 'ambient', world: 'afrobeats', experimental: 'ambient',
  'gospel afro-fusion': 'gospel', 'afro-trap / hip hop': 'trap', 'afro-cyber synthwave': 'synthwave',
  'reggae / dancehall': 'dancehall', 'jazz / blues': 'jazz', 'ambient / lo-fi': 'ambient',
};

export function getGenreConfig(genre: string): GenreConfig {
  const g = (genre || '').trim().toLowerCase();
  const mapped = GENRE_NAME_MAP[g];
  if (mapped) {
    const direct = GENRE_CONFIGS.find((c) => c.id === mapped);
    if (direct) return direct;
  }
  for (const cfg of GENRE_CONFIGS) {
    if (cfg.aliases.some((a) => g.includes(a))) return cfg;
  }
  return DEFAULT_CONFIG;
}

export function defaultPatternForGenre(genre: string): DrumPattern {
  const cfg = getGenreConfig(genre);
  return {
    kick: P(cfg.patterns.kick),
    snare: P(cfg.patterns.snare),
    hihat: P(cfg.patterns.hihat),
    clap: P(cfg.patterns.clap),
  };
}

export function patternFromStrings(p: { kick: string; snare: string; hihat: string; clap: string }): DrumPattern {
  return { kick: P(p.kick), snare: P(p.snare), hihat: P(p.hihat), clap: P(p.clap) };
}

export function patternToStrings(p: DrumPattern): { kick: string; snare: string; hihat: string; clap: string } {
  const s = (arr: boolean[]) => arr.map((b) => (b ? 'x' : '.')).join('');
  return { kick: s(p.kick), snare: s(p.snare), hihat: s(p.hihat), clap: s(p.clap) };
}

// ---------------------------------------------------------------------------
// Drum synthesis (shared by renderer and live beat preview)
// ---------------------------------------------------------------------------
export function playKick(ctx: BaseAudioContext, t: number, out: AudioNode, depth = 1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  const startFreq = 160 - depth * 20;
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.9, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + 0.32);
}

export function makeNoiseBuffer(ctx: BaseAudioContext, dur: number, decaySec: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(dur * ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (decaySec * ctx.sampleRate));
  }
  return buffer;
}

export function playSnare(ctx: BaseAudioContext, t: number, out: AudioNode, cachedBuf?: AudioBuffer) {
  const buffer = cachedBuf || makeNoiseBuffer(ctx, 0.2, 0.035);
  const data = buffer.getChannelData(0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.45, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t);
  src.stop(t + 0.22);
}

export function playHihat(ctx: BaseAudioContext, t: number, out: AudioNode, open = false, cachedBuf?: AudioBuffer) {
  const dur = open ? 0.28 : 0.06;
  const buffer = cachedBuf || makeNoiseBuffer(ctx, dur, 0.02);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7800;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(open ? 0.22 : 0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export function playClap(ctx: BaseAudioContext, t: number, out: AudioNode, cachedBuf?: AudioBuffer) {
  const buffer = cachedBuf || makeNoiseBuffer(ctx, 0.09, 0.01);
  const makeBurst = (start: number, length: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(start);
    src.stop(start + length + 0.02);
  };
  makeBurst(t, 0.02);
  makeBurst(t + 0.025, 0.02);
  makeBurst(t + 0.05, 0.09);
}

// ---------------------------------------------------------------------------
// Real-time drum preview for the beat maker (live AudioContext)
// ---------------------------------------------------------------------------
export function scheduleDrumStep(ctx: AudioContext, kind: 'kick' | 'snare' | 'hihat' | 'clap', time: number) {
  const dest = ctx.destination;
  if (kind === 'kick') playKick(ctx, time, dest);
  else if (kind === 'snare') playSnare(ctx, time, dest);
  else if (kind === 'hihat') playHihat(ctx, time, dest);
  else playClap(ctx, time, dest);
}

// ---------------------------------------------------------------------------
// Full track renderer
// ---------------------------------------------------------------------------
const SAMPLE_RATE = 44100;

function getBarDuration(bpm: number) {
  return (60 / bpm) * 4;
}

function buildStructure(totalBars: number): string[] {
  const template = ['intro', 'verse', 'verse', 'pre', 'chorus', 'chorus', 'verse', 'verse', 'pre', 'chorus', 'chorus', 'outro'];
  const out: string[] = [];
  let i = 0;
  while (out.length < totalBars) {
    out.push(template[i % template.length]);
    i++;
  }
  return out;
}

function generatePhrase(scale: number[], seed: number, minor: boolean, length: number, sparsity: number, octave: number): number[] {
  const rand = mulberry32(seed);
  const pent = pentatonicIndices(scale, minor);
  const phrase: number[] = [];
  let last = Math.floor(pent.length / 2);
  for (let i = 0; i < length; i++) {
    if (rand() < sparsity) {
      phrase.push(-1);
      continue;
    }
    const move = Math.round(rand() * 2 - 1);
    last = Math.max(0, Math.min(pent.length - 1, last + move));
    phrase.push(scale[pent[last]] + 12 * octave);
  }
  return phrase;
}

export async function synthesizeTrack(params: SynthParams): Promise<RenderedTrack> {
  const cfg = getGenreConfig(params.genre);
  const key = parseKey(params.keySignature);
  const bpm = Math.max(50, Math.min(200, params.bpm || cfg.bpm));
  const energy = Math.max(0, Math.min(1, params.energy ?? cfg.energy));
  const minor = params.keySignature && /min/i.test(params.keySignature) ? key.minor : cfg.minor;
  const scale = buildScale(key.root, minor);
  const minorMode = /min/i.test(params.keySignature || '') || cfg.minor;

  const patterns: DrumPattern = params.drumPattern
    ? params.drumPattern
    : defaultPatternForGenre(params.genre);

  const barDur = getBarDuration(bpm);
  const totalBars = Math.max(12, Math.min(120, Math.round(params.durationSec / barDur)));
  const totalSec = totalBars * barDur;
  const structure = buildStructure(totalBars);

  const ctx = new OfflineAudioContext(2, Math.ceil(totalSec * SAMPLE_RATE) + 1, SAMPLE_RATE);

  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 20;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  master.connect(comp);
  comp.connect(ctx.destination);

  const drumBus = ctx.createGain();
  drumBus.gain.value = 0.8;
  const drumPanner = ctx.createStereoPanner();
  drumPanner.pan.value = 0;
  drumBus.connect(drumPanner);
  drumPanner.connect(master);

  const bassBus = ctx.createGain();
  bassBus.gain.value = 0.5;
  const bassFilter = ctx.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.value = 420;
  bassBus.connect(bassFilter);
  bassFilter.connect(master);

  const padBus = ctx.createGain();
  padBus.gain.value = 0.2;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 1600;
  padBus.connect(padFilter);
  padFilter.connect(master);

  const leadBus = ctx.createGain();
  leadBus.gain.value = 0.16;
  const leadDelay = ctx.createDelay(0.6);
  leadDelay.delayTime.value = (60 / bpm) * 0.75;
  const leadDelayGain = ctx.createGain();
  leadDelayGain.gain.value = 0.3;
  leadBus.connect(leadDelay);
  leadDelay.connect(leadDelayGain);
  leadDelayGain.connect(leadBus);
  leadBus.connect(master);

  const vocalBus = ctx.createGain();
  vocalBus.gain.value = 0.2;
  vocalBus.connect(master);

  const arpBus = ctx.createGain();
  arpBus.gain.value = 0.1;
  arpBus.connect(master);

  // Reusable noise buffers — dramatically fewer allocations during the render loop
  const snareNoise = makeNoiseBuffer(ctx, 0.2, 0.035);
  const hihatNoise = makeNoiseBuffer(ctx, 0.28, 0.02);
  const clapNoise = makeNoiseBuffer(ctx, 0.09, 0.01);

  const seed = hashSeed(`${params.genre}|${bpm}|${key.name}|${params.keySignature}`);
  const rand = mulberry32(seed + 7);

  const progression = cfg.progression;
  const hasVocal =
    !params.isInstrumental &&
    params.vocalStyle !== 'Instrumental' &&
    (params.lyrics || '').trim().length > 0;

  const femaleVoice = /female|soprano|girl|woman/i.test(params.vocalStyle);
  const duet = /duet|choir/i.test(params.vocalStyle);

  // Pre-generate melodic phrases (deterministic) — distinct verse / chorus material
  const leadPhrase = generatePhrase(scale, seed, minor, 32, 0.55, 1);
  const leadPhraseChorus = generatePhrase(scale, seed + 777, minor, 32, 0.5, 1);
  const vocalPhrase = generatePhrase(scale, seed + 1234, minor, 32, 0.45, femaleVoice ? 2 : 1);
  const vocalPhraseChorus = generatePhrase(scale, seed + 5555, minor, 32, 0.4, femaleVoice ? 2 : 1);

  const scheduleBassNote = (t: number, freq: number, durBeats: number, style: BassStyle) => {
    const osc = ctx.createOscillator();
    osc.type = style === 'trap' ? 'sine' : style === 'rock' ? 'sawtooth' : 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const dur = (60 / bpm) * durBeats;
    gain.gain.setValueAtTime(0.001, t);
    if (style === 'fourfloor' || style === 'logdrum') {
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.92);
    } else if (style === 'trap') {
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + dur * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    } else {
      gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
      gain.gain.setValueAtTime(0.5, t + dur * 0.85);
      gain.gain.linearRampToValueAtTime(0.001, t + dur);
    }
    osc.connect(gain);
    gain.connect(bassBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  const schedulePad = (t: number, chord: number[], gainMul = 1) => {
    const gain = ctx.createGain();
    const target = 0.35 * gainMul;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(target, t + barDur * 0.5);
    gain.gain.setValueAtTime(target, t + barDur * 0.9);
    gain.gain.linearRampToValueAtTime(0.0001, t + barDur);
    chord.forEach((midi, idx) => {
      const osc = ctx.createOscillator();
      osc.type = cfg.padWave;
      const detune = (idx - 1.5) * 4;
      osc.detune.value = detune;
      osc.frequency.value = midiToFreq(midi);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + barDur + 0.05);
    });
    gain.connect(padBus);
  };

  const scheduleLeadNote = (t: number, midi: number, durBeats: number, style: LeadStyle) => {
    const osc = ctx.createOscillator();
    osc.type = cfg.leadWave;
    osc.frequency.value = midiToFreq(midi);
    if (style === 'pluck') {
      const gain = ctx.createGain();
      const dur = (60 / bpm) * durBeats;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(leadBus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } else {
      const gain = ctx.createGain();
      const dur = (60 / bpm) * durBeats;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
      gain.gain.setValueAtTime(0.3, t + dur * 0.8);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2800;
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(leadBus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  };

  const VOWELS = [
    { f1: 900, f2: 1200 },
    { f1: 500, f2: 1900 },
    { f1: 700, f2: 1100 },
    { f1: 400, f2: 2200 },
    { f1: 1100, f2: 1400 },
  ];

  const scheduleVocalNote = (t: number, midi: number, durBeats: number, syllable: number) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = midiToFreq(midi);
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 5.2;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 6;
    vibrato.connect(vibGain);
    vibGain.connect(osc.frequency);

    const vowel = VOWELS[syllable % VOWELS.length];
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = femaleVoice ? vowel.f1 * 1.6 : duet ? vowel.f1 * 1.25 : vowel.f1;
    f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = femaleVoice ? vowel.f2 * 1.6 : duet ? vowel.f2 * 1.25 : vowel.f2;
    f2.Q.value = 4;

    const gain = ctx.createGain();
    const dur = (60 / bpm) * durBeats;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    gain.gain.setValueAtTime(0.5, t + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);

    osc.connect(f1);
    f1.connect(f2);
    f2.connect(gain);
    gain.connect(vocalBus);
    osc.start(t);
    vibrato.start(t);
    osc.stop(t + dur + 0.05);
    vibrato.stop(t + dur + 0.05);

    if (duet) {
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = midiToFreq(midi + 3);
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.0001, t);
      gain2.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
      const f1b = ctx.createBiquadFilter();
      f1b.type = 'bandpass';
      f1b.frequency.value = (femaleVoice ? vowel.f1 * 1.4 : vowel.f1) + 80;
      f1b.Q.value = 5;
      osc2.connect(f1b);
      f1b.connect(gain2);
      gain2.connect(vocalBus);
      osc2.start(t);
      osc2.stop(t + dur + 0.05);
    }
  };

  const scheduleArp = (t: number, chord: number[]) => {
    const stepDur = (60 / bpm) / 2;
    for (let i = 0; i < 16; i++) {
      const note = chord[i % chord.length] + 12;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = midiToFreq(note);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t + i * stepDur);
      gain.gain.exponentialRampToValueAtTime(0.18, t + i * stepDur + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * stepDur + stepDur * 0.8);
      osc.connect(gain);
      gain.connect(arpBus);
      osc.start(t + i * stepDur);
      osc.stop(t + i * stepDur + stepDur * 0.85);
    }
  };

  // Beat seeding: keep phrase stable but vary start by bar
  let leadBar = 0;
  let vocalBar = 0;

  for (let bar = 0; bar < totalBars; bar++) {
    const t0 = bar * barDur;
    const section = structure[bar];
    const chordIdx = Math.floor(bar / 2) % progression.length;
    const chord = chordFromScale(scale, progression[chordIdx], 0);
    const isChorus = section === 'chorus';

    // Chords (pads) — play everywhere except sparse intro/outro tail
    if (section !== 'intro') {
      const padGainMul = isChorus ? 1 : section === 'verse' ? 0.78 : 0.55;
      schedulePad(t0, chord, padGainMul);
    }

    // Drums
    const drumGain = section === 'chorus' ? 1 : section === 'verse' ? 0.9 : 0.7;
    const barGain = ctx.createGain();
    barGain.gain.value = drumGain;
    barGain.connect(drumBus);
    for (let step = 0; step < STEPS; step++) {
      const t = t0 + step * (barDur / STEPS);
      if (patterns.kick[step]) playKick(ctx, t, barGain);
      if (patterns.snare[step]) playSnare(ctx, t, barGain, snareNoise);
      if (patterns.hihat[step]) playHihat(ctx, t, barGain, step % 8 === 6 && energy > 0.7, hihatNoise);
      if (patterns.clap[step]) playClap(ctx, t, barGain, clapNoise);
    }
    // extra energy fills on chorus
    if (section === 'chorus' && energy > 0.6 && bar % 2 === 1) {
      for (let s = 12; s < 16; s++) {
        if (rand() < 0.6) playHihat(ctx, t0 + s * (barDur / STEPS), barGain, true);
      }
    }

    // Bass
    const rootMidi = chord[0];
    if (section !== 'intro') {
      const style = cfg.bass;
      if (style === 'fourfloor' || style === 'rock') {
        for (let b = 0; b < 4; b++) {
          scheduleBassNote(t0 + b * barDur / 4, midiToFreq(rootMidi), 1, style);
        }
      } else if (style === 'logdrum') {
        scheduleBassNote(t0, midiToFreq(rootMidi - 12), 2, style);
        scheduleBassNote(t0 + barDur / 2, midiToFreq(rootMidi - 12), 1, style);
        scheduleBassNote(t0 + barDur * 0.75, midiToFreq(rootMidi - 7), 0.5, style);
      } else if (style === 'trap') {
        scheduleBassNote(t0, midiToFreq(rootMidi - 12), 1.5, style);
        scheduleBassNote(t0 + barDur / 2, midiToFreq(rootMidi - 5), 1.5, style);
      } else if (style === 'reggae') {
        scheduleBassNote(t0 + barDur * 0.25, midiToFreq(rootMidi - 12), 0.5, style);
        scheduleBassNote(t0 + barDur * 0.75, midiToFreq(rootMidi - 12), 0.5, style);
      } else if (style === 'legato') {
        scheduleBassNote(t0, midiToFreq(rootMidi - 12), 2, style);
        scheduleBassNote(t0 + barDur / 2, midiToFreq(rootMidi - 12), 2, style);
      } else {
        // syncopated afrobeats style
        scheduleBassNote(t0, midiToFreq(rootMidi - 12), 1.5, style);
        scheduleBassNote(t0 + barDur * 0.5, midiToFreq(rootMidi - 7), 0.5, style);
        scheduleBassNote(t0 + barDur * 0.75, midiToFreq(rootMidi - 12), 0.5, style);
      }
    }

    // Arp (chorus/verse, synth genres)
    if (cfg.arp && (section === 'chorus' || section === 'verse') && bar % 2 === 0) {
      scheduleArp(t0, chord);
    }

    // Lead melody (verse + chorus) — chorus lifts an octave on alternating bars
    if ((section === 'verse' || isChorus) && energy > 0.2) {
      const phrase = isChorus ? leadPhraseChorus : leadPhrase;
      const octLift = isChorus && bar % 2 === 1 ? 12 : 0;
      for (let i = 0; i < 32; i++) {
        const midi = phrase[i];
        if (midi === -1) continue;
        const noteDur = 0.25; // 16th note
        scheduleLeadNote(t0 + i * (barDur / 32) * 2, midi + octLift, noteDur, cfg.lead);
      }
      leadBar++;
    }

    // Sung vocal melody
    if (hasVocal && (section === 'verse' || isChorus)) {
      const phrase = isChorus ? vocalPhraseChorus : vocalPhrase;
      for (let i = 0; i < 32; i++) {
        const midi = phrase[i];
        if (midi === -1) continue;
        const noteDur = 0.5; // sustained 8th = "sung" phrasing
        const syllable = (vocalBar * 32 + i) % 24;
        scheduleVocalNote(t0 + i * (barDur / 32) * 2, midi, noteDur, syllable);
      }
      vocalBar++;
    }
  }

  const buffer = await ctx.startRendering();

  // Sanitize: a non-finite sample anywhere corrupts the WAV/waveform output.
  // Some Web Audio implementations emit NaN at isolated sample positions.
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      if (!Number.isFinite(data[i])) data[i] = 0;
    }
  }

  const blob = bufferToWavBlob(buffer);

  // Waveform peaks (80 bins)
  const channel = buffer.getChannelData(0);
  const bins = 80;
  const stepSize = Math.max(1, Math.floor(channel.length / bins));
  const waveformData: number[] = [];
  for (let b = 0; b < bins; b++) {
    let sum = 0;
    const start = b * stepSize;
    const end = Math.min(channel.length, start + stepSize);
    for (let i = start; i < end; i += 32) {
      sum += Math.abs(channel[i]);
    }
    const rms = end > start ? sum / Math.max(1, Math.floor((end - start) / 32)) : 0;
    waveformData.push(Math.min(100, Math.round(rms * 520)));
  }

  const url = URL.createObjectURL(blob);

  return {
    blob,
    buffer,
    durationSec: Math.round(buffer.duration),
    waveformData,
    url,
  };
}
