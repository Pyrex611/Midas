import { AIProvider } from '../types';

export class AIGatewayProvider implements AIProvider {
  readonly name = 'aigateway';

  constructor(
    private gatewayUrl: string = process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1',
    private apiKey: string = process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_KEY || process.env.VERCEL_OIDC_TOKEN || '',
    private model: string = process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini'
  ) {}

  async isAvailable(): Promise<boolean> {
    const key = this.apiKey || process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_KEY || process.env.VERCEL_OIDC_TOKEN;
    return Boolean(key || this.gatewayUrl.includes('gateway.ai.cloudflare'));
  }

  /**
   * Auto-formats model strings into Vercel AI Gateway creator/model syntax
   * (e.g. "gpt-4o-mini" -> "openai/gpt-4o-mini", "claude-3-5-sonnet" -> "anthropic/claude-3-5-sonnet")
   */
  private formatModelSlug(rawModel: string): string {
    const trimmed = (rawModel || 'openai/gpt-4o-mini').trim();
    if (trimmed.includes('/')) return trimmed;

    if (trimmed.startsWith('gpt-') || trimmed.startsWith('o1') || trimmed.startsWith('o3')) {
      return `openai/${trimmed}`;
    }
    if (trimmed.startsWith('claude-')) {
      return `anthropic/${trimmed}`;
    }
    if (trimmed.startsWith('gemini-')) {
      return `google/${trimmed}`;
    }
    if (trimmed.startsWith('llama-')) {
      return `meta-llama/${trimmed}`;
    }
    if (trimmed.startsWith('deepseek-')) {
      return `deepseek/${trimmed}`;
    }
    return trimmed;
  }

  async complete(prompt: string, system?: string): Promise<string> {
    // 1. Sanitize & Migrate legacy broken api.vercel.ai URLs to ai-gateway.vercel.sh
    let cleanUrl = (this.gatewayUrl || 'https://ai-gateway.vercel.sh/v1').trim().replace(/\/+$/, '');
    if (cleanUrl.includes('api.vercel.ai')) {
      cleanUrl = cleanUrl.replace('api.vercel.ai', 'ai-gateway.vercel.sh');
    }

    const endpoint = cleanUrl.endsWith('/chat/completions')
      ? cleanUrl
      : cleanUrl.endsWith('/v1')
      ? `${cleanUrl}/chat/completions`
      : `${cleanUrl}/v1/chat/completions`;

    // 2. Resolve Auth Token (Cascade: Instance Key -> AI_GATEWAY_API_KEY -> VERCEL_OIDC_TOKEN)
    const token =
      this.apiKey ||
      process.env.AI_GATEWAY_API_KEY ||
      process.env.AI_GATEWAY_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      '';

    if (!token && !cleanUrl.includes('gateway.ai.cloudflare')) {
      throw new Error(
        'Vercel AI Gateway requires an API key. Create one at Vercel Dashboard → AI Gateway, ' +
        'or set AI_GATEWAY_API_KEY in your Vercel project environment variables.'
      );
    }

    const resolvedModel = this.formatModelSlug(this.model);

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
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
      throw new Error(`AI Gateway error (${response.status}): ${parsedError}`);
    }

    const data = JSON.parse(rawText);
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`AI Gateway returned empty message content: ${rawText}`);
    }
    return content;
  }
}