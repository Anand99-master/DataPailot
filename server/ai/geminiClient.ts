import { GoogleGenAI } from '@google/genai';

/**
 * Server-side Gemini Client utility for DataPilot.
 * Strictly initialized server-side using process.env.GEMINI_API_KEY.
 * The key is never exposed to browser/client.
 */
let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }

  return aiInstance;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';

/**
 * Executes a Gemini model call with automatic fallback if primary model experiences 503 high demand spikes.
 */
export async function generateContentWithFallback(
  params: {
    contents: string | any[];
    config?: any;
    model?: string;
  }
) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('Gemini AI client is not configured.');
  }

  const primaryModel = params.model || GEMINI_MODEL;

  try {
    return await ai.models.generateContent({
      model: primaryModel,
      contents: params.contents,
      config: params.config
    });
  } catch (err: any) {
    // If 503 UNAVAILABLE or high demand, attempt fallback model
    const errorStr = String(err?.message || err || '');
    if (errorStr.includes('503') || errorStr.includes('high demand') || errorStr.includes('UNAVAILABLE')) {
      console.warn(`Primary model ${primaryModel} 503 unavailable, attempting fallback ${GEMINI_FALLBACK_MODEL}...`);
      return await ai.models.generateContent({
        model: GEMINI_FALLBACK_MODEL,
        contents: params.contents,
        config: params.config
      });
    }
    throw err;
  }
}

