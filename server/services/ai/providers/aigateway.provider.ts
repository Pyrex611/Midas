import { AIProvider } from '../types';

export class AIGatewayProvider implements AIProvider {
  readonly name = 'aigateway';

  constructor(
    private gatewayUrl: string = process.env.AI_GATEWAY_URL || 'https://api.vercel.ai/v1',
    private apiKey: string = process.env.AI_GATEWAY_KEY || '',
    private model: string = process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini'
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.gatewayUrl && (this.apiKey || this.gatewayUrl.includes('gateway.ai.cloudflare')));
  }

  async complete(prompt: string, system?: string): Promise<string> {
    const cleanUrl = this.gatewayUrl.replace(/\/$/, '');
    const endpoint = cleanUrl.endsWith('/chat/completions')
      ? cleanUrl
      : cleanUrl.endsWith('/v1')
      ? `${cleanUrl}/chat/completions`
      : `${cleanUrl}/v1/chat/completions`;

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey.trim()}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`AI Gateway error (${response.status}): ${rawText}`);
    }

    const data = JSON.parse(rawText);
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`AI Gateway returned empty message content: ${rawText}`);
    }
    return content;
  }
}