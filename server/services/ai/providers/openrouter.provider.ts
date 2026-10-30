import { AIProvider } from '../types';

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';

  constructor(
    private apiKey: string = process.env.OPENROUTER_API_KEY || '',
    private model: string = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat'
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey || process.env.OPENROUTER_API_KEY);
  }

  async complete(prompt: string, system?: string): Promise<string> {
    const key = this.apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not configured');

    const cleanModel = (this.model || 'deepseek/deepseek-chat').trim();

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key.trim()}`,
        'HTTP-Referer': 'https://midas.outreach',
        'X-Title': 'Midas Engine',
      },
      body: JSON.stringify({
        model: cleanModel,
        messages,
        temperature: 0.7,
        max_tokens: 2500,
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
      throw new Error(`OpenRouter API error (${response.status}): ${parsedError}`);
    }

    const data = JSON.parse(rawText);
    const choice = data.choices?.[0];
    const rawContent = choice?.message?.content || choice?.message?.reasoning || '';
    if (!rawContent) {
      throw new Error(`OpenRouter API returned empty content: ${rawText}`);
    }
    return rawContent;
  }
}