import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from '../constants/systemPrompt';

const MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
];

export class GeminiApiError extends Error {
  public readonly status?: number;
  public readonly model?: string;
  public readonly details?: string;

  constructor(message: string, opts?: { status?: number; model?: string; details?: string }) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = opts?.status;
    this.model = opts?.model;
    this.details = opts?.details;
  }
}

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY ?? (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
  if (!key) {
    throw new GeminiApiError(
      'No Gemini API key found. Please configure VITE_GEMINI_API_KEY in your env file.',
      { status: 401 }
    );
  }
  return key;
}

/**
 * Sends request to Gemini API to structure text into a JSON outline representation.
 * Supports both local dev and Apps Script proxy environments.
 */
export async function processDocumentStream(
  input: string,
  onChunk: (text: string) => void
): Promise<string> {
  const systemInstruction = SYSTEM_PROMPT;
  const parts = [
    {
      text: `### Restructure and outline the following raw document content:\n\n${
        input || 'Please organize my empty input.'
      }`
    }
  ];

  // GAS environment proxy
  if (typeof window !== 'undefined' && (window as any).google?.script?.run) {
    const contents = [{ role: 'user', parts }];
    try {
      const gasResult = await new Promise<string>((resolve, reject) => {
        (window as any).google.script.run
          .withSuccessHandler((response: { text?: string; error?: string }) => {
            if (response && response.error) {
              reject(new GeminiApiError(response.error));
            } else {
              const text = response?.text || '';
              onChunk(text);
              resolve(text);
            }
          })
          .withFailureHandler((err: any) => {
            reject(new GeminiApiError(err?.message || 'GAS server request failed.'));
          })
          .queryGemini(MODEL_CHAIN[0], contents, systemInstruction);
      });
      return gasResult;
    } catch (gasError: any) {
      const msg = gasError?.message || '';
      if (msg.includes('permission') || msg.includes('UrlFetchApp') || msg.includes('authorization')) {
        throw new GeminiApiError(
          'Apps Script URL Fetch authorization required. Open Editor, run forceAuth, consent to scopes, and reload.',
          { status: 403 }
        );
      }
      throw new GeminiApiError(
        `GAS proxy error: ${msg}. Check Apps Script logs for detailed trace.`,
        { status: 500 }
      );
    }
  }

  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  let lastError: GeminiApiError | null = null;

  for (const modelName of MODEL_CHAIN) {
    try {
      const result = await ai.models.generateContentStream({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: { systemInstruction },
      });

      let fullText = '';
      for await (const chunk of result) {
        const text = chunk.text ?? '';
        fullText += text;
        onChunk(fullText);
      }

      return fullText;
    } catch (err: any) {
      console.warn(`[Gemini] Failed model ${modelName}:`, err?.message ?? err);
      const status = err?.status ?? err?.httpStatusCode;
      lastError = new GeminiApiError(
        err?.message ?? 'Gemini API call encountered an error.',
        { status, model: modelName }
      );

      if (status && status < 500 && status !== 429) break;
    }
  }

  throw lastError ?? new GeminiApiError('Could not reach the Gemini API after all model fallbacks.');
}
