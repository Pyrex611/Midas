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

  /**
   * Universal Content Extractor across all models in Vercel AI Gateway:
   * Handles standard models (content), reasoning models (reasoning / reasoning_content),
   * and multi-part content arrays.
   */
  private extractMessageContent(choice: any, modelName: string): string {
    const message = choice?.message;
    if (!message) {
      if (typeof choice?.text === 'string' && choice.text.trim()) return choice.text;
      throw new Error(`AI Gateway returned an empty choice structure for model "${modelName}"`);
    }

    // 1. Standard Content String
    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content;
    }

    // 2. Multi-part Content Array
    if (Array.isArray(message.content)) {
      const textPart = message.content.find((p: any) => p.type === 'text' || typeof p.text === 'string');
      if (textPart?.text?.trim()) return textPart.text;
    }

    // 3. Reasoning / Thinking Models (Nemotron, DeepSeek-R1, QwQ)
    if (typeof message.reasoning === 'string' && message.reasoning.trim()) {
      return message.reasoning;
    }
    if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
      return message.reasoning_content;
    }

    // 4. Token Length Limit Exhaustion Detection
    if (choice.finish_reason === 'length') {
      throw new Error(
        `Model "${modelName}" hit its max token limit during reasoning without completing output. ` +
        `Switch to a fast instruction model (e.g. "openai/gpt-4o-mini" or "deepseek/deepseek-chat") in Settings.`
      );
    }

    throw new Error(`AI Gateway model "${modelName}" returned empty content and no reasoning text`);
  }

  async complete(prompt: string, system?: string): Promise<string> {
    let cleanUrl = (this.gatewayUrl || 'https://ai-gateway.vercel.sh/v1').trim().replace(/\/+$/, '');
    if (cleanUrl.includes('api.vercel.ai')) {
      cleanUrl = cleanUrl.replace('api.vercel.ai', 'ai-gateway.vercel.sh');
    }

    const endpoint = cleanUrl.endsWith('/chat/completions')
      ? cleanUrl
      : cleanUrl.endsWith('/v1')
      ? `${cleanUrl}/chat/completions`
      : `${cleanUrl}/v1/chat/completions`;

    const token =
      this.apiKey ||
      process.env.AI_GATEWAY_API_KEY ||
      process.env.AI_GATEWAY_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      '';

    if (!token && !cleanUrl.includes('gateway.ai.cloudflare')) {
      throw new Error(
        'Vercel AI Gateway requires an API key. Set AI_GATEWAY_API_KEY in Vercel environment variables or enter it in Settings.'
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
        max_tokens: 3500, // Headroom for reasoning models + JSON payload
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
      throw new Error(`AI Gateway error (${response.status}): ${parsedError}`);
    }

    const data = JSON.parse(rawText);
    const choice = data.choices?.[0];
    return this.extractMessageContent(choice, resolvedModel);
  }
}