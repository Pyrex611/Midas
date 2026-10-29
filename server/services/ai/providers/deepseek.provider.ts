import { AIProvider } from '../types';

export class DeepSeekProvider implements AIProvider {
  readonly name = 'deepseek';

  constructor(
    private apiKey: string = process.env.DEEPSEEK_API_KEY || '',
    private model: string = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async complete(prompt: string, system?: string): Promise<string> {
    if (!this.apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`DeepSeek API error (${response.status}): ${rawText}`);
    }

    const data = JSON.parse(rawText);
    return data.choices[0].message.content;
  }
}