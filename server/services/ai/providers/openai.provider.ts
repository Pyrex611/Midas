import { AIProvider } from '../types';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  constructor(
    private apiKey: string = process.env.OPENAI_API_KEY || '',
    private model: string = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey || process.env.OPENAI_API_KEY);
  }

  async complete(prompt: string, system?: string): Promise<string> {
    const key = this.apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not configured');

    let cleanModel = (this.model || 'gpt-4o-mini').trim();
    if (cleanModel.startsWith('openai/')) {
      cleanModel = cleanModel.replace('openai/', '');
    }

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key.trim()}`,
      },
      body: JSON.stringify({
        model: cleanModel,
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const rawText = await response.text();
    if (!response.ok) {
      let parsedError = rawText;
      try {
        const errorJson = JSON.parse(rawText);
        parsedError = errorJson.error?.message || errorJson.message || rawText;
      } catch {}
      throw new Error(`OpenAI API error (${response.status}): ${parsedError}`);
    }

    const data = JSON.parse(rawText);
    return data.choices[0].message.content;
  }
}