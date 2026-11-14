import { AIProvider } from '../types';

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';

  constructor(
    private baseUrl: string = process.env.OLLAMA_URL || 'http://localhost:11434',
    private model: string = process.env.OLLAMA_POWERFUL_MODEL || 'llama3.1:8b'
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const cleanBase = this.baseUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanBase}/api/tags`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(prompt: string, system?: string): Promise<string> {
    const cleanBase = this.baseUrl.replace(/\/+$/, '');
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

    const response = await fetch(`${cleanBase}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: fullPrompt,
        stream: false,
        options: { temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(25_000),
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Ollama generation failed (${response.status}): ${rawText}`);
    }

    const data = JSON.parse(rawText);
    if (!data.response) {
      throw new Error(`Ollama returned an empty response for model "${this.model}"`);
    }
    return data.response;
  }
}