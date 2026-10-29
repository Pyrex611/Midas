import { AIProvider } from '../types';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  constructor(
    private apiKey: string = process.env.GEMINI_API_KEY || '',
    private model: string = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async complete(prompt: string, system?: string): Promise<string> {
    if (!this.apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey.trim()}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status}): ${rawText}`);
    }

    const data = JSON.parse(rawText);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(`Gemini returned unexpected structure: ${rawText}`);
    }
    return text;
  }
}