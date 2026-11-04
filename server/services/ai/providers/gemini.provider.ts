import { AIProvider } from '../types';
import { isReasoningModel } from '../utils/modelClassifier';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  constructor(
    private apiKey: string = process.env.GEMINI_API_KEY || '',
    private model: string = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey || process.env.GEMINI_API_KEY);
  }

  async complete(prompt: string, system?: string): Promise<string> {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not configured');

    let cleanModel = (this.model || 'gemini-1.5-flash').trim();
    if (cleanModel.startsWith('google/')) {
      cleanModel = cleanModel.replace('google/', '');
    }

    const isThinking = isReasoningModel('gemini', cleanModel);

    // For structured copywriting tasks, disable internal thinking budget if model supports it
    // to prevent burning output tokens on internal chain-of-thought
    const generationConfig: Record<string, any> = {
      temperature: 0.7,
      maxOutputTokens: isThinking ? 4000 : 1500,
    };

    if (isThinking && cleanModel.includes('thinking')) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${key.trim()}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    const rawText = await response.text();
    if (!response.ok) {
      let parsedError = rawText;
      try {
        const errorJson = JSON.parse(rawText);
        parsedError = errorJson.error?.message || errorJson.message || rawText;
      } catch {}
      throw new Error(`Gemini API error (${response.status}): ${parsedError}`);
    }

    const data = JSON.parse(rawText);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(`Gemini returned an empty response. Try using "gemini-1.5-flash" or verify API key.`);
    }
    return text;
  }
}