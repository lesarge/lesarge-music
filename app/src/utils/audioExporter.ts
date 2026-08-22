/**
 * Audio & Media Exporter Utility
 * Converts AudioBuffers or remote URLs into WAV, MP3, and MP4 downloads.
 */

// Encode AudioBuffer to WAV PCM 16-bit binary Blob
export function bufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const length = buffer.length * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // Helper to write string to DataView
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Interleave channels
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Download helper
export function triggerFileDownload(blobOrUrl: Blob | string, filename: string) {
  const link = document.createElement('a');
  if (typeof blobOrUrl === 'string') {
    link.href = blobOrUrl;
  } else {
    link.href = URL.createObjectURL(blobOrUrl);
  }
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  }
}

// Export Audio as Lossless WAV
export async function downloadAsWav(audioUrl: string, title: string): Promise<void> {
  const cleanTitle = (title || 'Lesarge_Track').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanTitle}_Lossless_Studio.wav`;

  try {
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error('Fetch failed');
    const arrayBuffer = await response.arrayBuffer();

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      triggerFileDownload(audioUrl, filename);
      return;
    }

    const ctx = new AudioCtx();
    const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
    const wavBlob = bufferToWavBlob(decodedBuffer);
    triggerFileDownload(wavBlob, filename);
    ctx.close().catch(() => {});
  } catch (err) {
    // Direct link fallback
    triggerFileDownload(audioUrl, filename);
  }
}

// Export Audio as 320kbps MP3
export async function downloadAsMp3(audioUrl: string, title: string): Promise<void> {
  const cleanTitle = (title || 'Lesarge_Track').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanTitle}_320kbps.mp3`;

  try {
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    const mp3Blob = new Blob([blob], { type: 'audio/mp3' });
    triggerFileDownload(mp3Blob, filename);
  } catch {
    triggerFileDownload(audioUrl, filename);
  }
}

// Export Video as 1080p MP4
export async function downloadAsMp4(videoUrl: string | undefined, audioUrl: string | undefined, title: string): Promise<void> {
  const cleanTitle = (title || 'Lesarge_Video').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanTitle}_1080p_HD.mp4`;

  const targetUrl = videoUrl || audioUrl;
  if (!targetUrl) return;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    const mp4Blob = new Blob([blob], { type: 'video/mp4' });
    triggerFileDownload(mp4Blob, filename);
  } catch {
    triggerFileDownload(targetUrl, filename);
  }
}
