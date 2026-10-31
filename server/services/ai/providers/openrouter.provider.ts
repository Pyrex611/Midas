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

  private extractMessageContent(choice: any, modelName: string): string {
    const message = choice?.message;
    if (!message) {
      if (typeof choice?.text === 'string' && choice.text.trim()) return choice.text;
      throw new Error(`OpenRouter returned an empty choice structure for model "${modelName}"`);
    }

    // 1. Direct content string
    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content;
    }

    // 2. Reasoning / Thinking models on OpenRouter
    if (typeof message.reasoning === 'string' && message.reasoning.trim()) {
      return message.reasoning;
    }
    if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
      return message.reasoning_content;
    }

    if (choice.finish_reason === 'length') {
      throw new Error(`Model "${modelName}" exceeded token limit during reasoning. Use a faster instruction model.`);
    }

    throw new Error(`OpenRouter model "${modelName}" returned empty content and reasoning`);
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
        max_tokens: 3500,
      }),
      signal: AbortSignal.timeout(30_000),
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
    return this.extractMessageContent(choice, cleanModel);
  }
}