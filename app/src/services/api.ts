import { GeminiVisionResponse } from '../types';

export async function analyzeImageWithGemini(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<GeminiVisionResponse> {
  const response = await fetch('/api/gemini/analyze-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

export async function editImageWithGemini(
  prompt: string,
  imageBase64?: string,
  mimeType: string = 'image/png'
): Promise<{ imageUrl: string; description: string }> {
  const response = await fetch('/api/gemini/edit-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, imageBase64, mimeType }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  return await response.json();
}

export async function checkLocalAiStatus(host = 'http://127.0.0.1:11434'): Promise<{
  connected: boolean;
  host: string;
  models: any[];
  message?: string;
}> {
  try {
    const res = await fetch(`/api/local-ai/status?host=${encodeURIComponent(host)}`);
    return await res.json();
  } catch {
    return { connected: false, host, models: [], message: 'Standalone Local Llama mode available.' };
  }
}

export async function analyzeWithLocalLlama(
  imageBase64: string,
  model = 'llama3',
  host = 'http://127.0.0.1:11434'
): Promise<GeminiVisionResponse> {
  const response = await fetch('/api/local-ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, model, host }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Local AI Error: ${response.status}`);
  }

  const result = await response.json();
  return result.data || result;
}

