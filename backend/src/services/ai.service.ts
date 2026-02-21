import { logger } from '../config/logger';
import { env } from '../config/env';

// ===== PROVIDER INTERFACE =====
interface AIProvider {
  generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ): Promise<{ subject: string; body: string }>;
  isAvailable(): Promise<boolean>;
}

// ===== MOCK PROVIDER =====
class MockProvider implements AIProvider {
  async isAvailable() {
    return true;
  }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    logger.debug({ tone, useCase, campaignContext }, 'MockProvider generating draft');
    return this.generateMockDraft(tone, useCase, campaignContext);
  }

  private generateMockDraft(
    tone: string,
    useCase: string,
    campaignContext?: string
  ): { subject: string; body: string } {
    const baseDrafts: Record<string, { subject: string; body: string }> = {
      'professional-initial': {
        subject: 'Quick question regarding {{company}}',
        body: `Hi {{name}},\n\nI've been following {{company}}'s recent work in the industry and was impressed by your team's achievements. At our company, we specialize in helping businesses like yours achieve {{valueProposition}}.\n\nWould you be open to a 10‑minute call next week? I'd love to share some insights that could be relevant.\n\nBest regards,\n{{senderName}}`,
      },
      'friendly-initial': {
        subject: 'Loved your recent post on {{topic}}',
        body: `Hi {{name}},\n\nI came across your post about {{topic}} and it really resonated. At {{senderCompany}}, we're working on something that aligns perfectly with that vision.\n\nIf you're open to it, I'd love to exchange ideas – no strings attached.\n\nCheers,\n{{senderName}}`,
      },
      'followup1': {
        subject: 'Following up – {{company}}',
        body: `Hi {{name}},\n\nJust wanted to gently follow up on my previous email. I know how busy things get.\n\nIf you're not the right person, could you point me to who handles {{valueProposition}} at {{company}}?\n\nThanks either way,\n{{senderName}}`,
      },
    };

    const key = `${tone}-${useCase}`;
    return baseDrafts[key] || baseDrafts['professional-initial'];
  }
}

// ===== OPENAI PROVIDER =====
class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-3.5-turbo') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable() {
    return !!this.apiKey;
  }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    const prompt = this.buildPrompt(tone, useCase, campaignContext, reference, companyContext);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert B2B cold email copywriter. Output only valid JSON with "subject" and "body". Use placeholders {{name}}, {{company}}, {{position}}, {{valueProposition}}, {{senderName}} as needed. If a reference story is provided, you may use {{reference_company}} as a placeholder.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return this.parseResponse(content);
  }

  protected buildPrompt(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ): string {
    return `You are an expert in B2B cold outreach with a 40%+ reply rate.
Generate a ${tone} cold email for ${useCase} outreach.

${campaignContext ? `CAMPAIGN OBJECTIVE: ${campaignContext}` : 'General outreach'}

${reference ? `REFERENCE STORY: ${reference}
Use this story as a case study, mentioning the company name as {{reference_company}} if appropriate.` : ''}

IMPORTANT REQUIREMENTS:
- Subject line: compelling, under 60 characters, no placeholders.
- Body: 3-4 short paragraphs, under 150 words, mobile‑friendly.
- Use placeholders EXACTLY as: {{name}}, {{company}}, {{position}}, {{valueProposition}}, {{senderName}}.
- If a reference story is provided, you may use {{reference_company}}; otherwise, do not mention any client story.
- No links, no attachments, no "click here".
- End with a clear, low‑friction call‑to‑action (e.g., "Would you be open to a brief chat?").
- Output ONLY valid JSON: {"subject": "...", "body": "..."}
${companyContext ? `Context about the sender's company: ${companyContext}` : ''}`;
  }

  protected parseResponse(raw: string): { subject: string; body: string } {
    try {
      return JSON.parse(raw);
    } catch {
      const subjectMatch = raw.match(/"subject"\s*:\s*"([^"]+)"/);
      const bodyMatch = raw.match(/"body"\s*:\s*"([^"]+)"/);
      return {
        subject: subjectMatch?.[1] || 'New opportunity',
        body: bodyMatch?.[1]?.replace(/\\n/g, '\n') || 'Hi {{name}}...',
      };
    }
  }
}

// ===== GOOGLE GEMINI PROVIDER =====
class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-pro') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable() {
    return !!this.apiKey;
  }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    const prompt = this.buildPrompt(tone, useCase, campaignContext, reference, companyContext);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 400,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    return this.parseResponse(text);
  }

  private buildPrompt = OpenAIProvider.prototype.buildPrompt;
  private parseResponse = OpenAIProvider.prototype.parseResponse;
}

// ===== OLLAMA PROVIDER =====
class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private fastModel: string;
  private powerfulModel: string;

  constructor(
    baseUrl = 'http://localhost:11434',
    fastModel = 'llama3.2:1b',
    powerfulModel = 'llama3.1:8b'
  ) {
    this.baseUrl = baseUrl;
    this.fastModel = fastModel;
    this.powerfulModel = powerfulModel;
  }

  async isAvailable() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/tags`);
      return resp.ok;
    } catch {
      return false;
    }
  }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    const model = useCase === 'initial' ? this.powerfulModel : this.fastModel;
    const prompt = this.buildPrompt(tone, useCase, campaignContext, reference, companyContext);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9 },
      }),
    });

    if (!response.ok) throw new Error('Ollama generation failed');
    const data = await response.json();
    return this.parseResponse(data.response);
  }

  private buildPrompt = OpenAIProvider.prototype.buildPrompt;
  private parseResponse = OpenAIProvider.prototype.parseResponse;
}

// ===== DEEPSEEK PROVIDER (direct) – kept for backward compatibility =====
class DeepSeekProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'deepseek-chat') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable() {
    return !!this.apiKey;
  }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    const prompt = this.buildPrompt(tone, useCase, campaignContext, reference, companyContext);
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert B2B cold email copywriter. Output only valid JSON with "subject" and "body". Use placeholders {{name}}, {{company}}, {{position}}, {{valueProposition}}, {{senderName}} as needed. If a reference story is provided, you may use {{reference_company}} as a placeholder.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return this.parseResponse(content);
  }

  private buildPrompt = OpenAIProvider.prototype.buildPrompt;
  private parseResponse = OpenAIProvider.prototype.parseResponse;
}

// ===== OPENROUTER PROVIDER (extends OpenAIProvider for simplicity) =====
// ===== OPENROUTER PROVIDER (with response logging and mock fallback) =====
class OpenRouterProvider extends OpenAIProvider {
  constructor(apiKey: string, model: string) {
    super(apiKey, model);
  }

  async generateDraft(
    tone: string,
    useCase: string,
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ) {
    const prompt = this.buildPrompt(tone, useCase, campaignContext, reference, companyContext);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://your-app.com',
        'X-Title': 'Lead Management System',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert B2B cold email copywriter. Output ONLY valid JSON with "subject" and "body". Do not include any reasoning, markdown, or additional text. The JSON must be parseable. Use placeholders {{name}}, {{company}}, {{position}}, {{valueProposition}}, {{senderName}} as needed. If a reference story is provided, you may use {{reference_company}} as a placeholder.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 5120, // Increased to give model room
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Log the error but fall back to mock
      logger.error({ status: response.status, errorText }, 'OpenRouter API error, falling back to mock');
      const mock = new MockProvider();
      return mock.generateDraft(tone, useCase, campaignContext, reference, companyContext);
    }

    const data = await response.json();

    // Log the full response for debugging (limit to 2000 chars)
    logger.debug({ openRouterResponse: JSON.stringify(data).substring(0, 2000) }, 'OpenRouter raw response');

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      logger.error({ data }, 'OpenRouter API returned invalid structure, falling back to mock');
      const mock = new MockProvider();
      return mock.generateDraft(tone, useCase, campaignContext, reference, companyContext);
    }

    const choice = data.choices[0];
    let rawContent = choice.message?.content || '';
    if (!rawContent && choice.message?.reasoning) {
      rawContent = choice.message.reasoning;
    }
    if (!rawContent) {
      rawContent = JSON.stringify(choice.message);
    }

    // Attempt to extract JSON
    const extracted = this.extractJSON(rawContent);
    if (extracted) {
      return extracted;
    }

    // If extraction fails, log the raw content and fall back to mock
    logger.error({ rawContent: rawContent.substring(0, 1000) }, 'Failed to extract JSON from OpenRouter response, falling back to mock');
    const mock = new MockProvider();
    return mock.generateDraft(tone, useCase, campaignContext, reference, companyContext);
  }

  /**
   * Extracts a JSON object containing "subject" and "body" from a possibly messy string.
   */
  private extractJSON(text: string): { subject: string; body: string } | null {
    let start = 0;
    while (true) {
      const openIdx = text.indexOf('{', start);
      if (openIdx === -1) break;

      let depth = 0;
      let closeIdx = -1;
      for (let i = openIdx; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            closeIdx = i;
            break;
          }
        }
      }
      if (closeIdx === -1) break;

      const candidate = text.substring(openIdx, closeIdx + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed.subject && parsed.body) {
          return {
            subject: parsed.subject.trim(),
            body: parsed.body.trim(),
          };
        }
      } catch (e) {
        // Not valid JSON, continue
      }
      start = openIdx + 1;
    }
    return null;
  }
}

// ===== AI SERVICE WITH REQUEST QUEUE =====
export class AIService {
  private provider: AIProvider;
  private requestQueue: (() => Promise<any>)[] = [];
  private processing = false;

  constructor() {
    const providerType = env.AI_PROVIDER?.toLowerCase() || 'mock';
    logger.info({ provider: providerType }, 'Initializing AI service');

    switch (providerType) {
      case 'openai':
        this.provider = new OpenAIProvider(env.OPENAI_API_KEY || '', env.OPENAI_MODEL);
        break;
      case 'gemini':
        this.provider = new GeminiProvider(env.GEMINI_API_KEY || '', env.GEMINI_MODEL);
        break;
      case 'ollama':
        this.provider = new OllamaProvider(
          env.OLLAMA_URL,
          env.OLLAMA_FAST_MODEL,
          env.OLLAMA_POWERFUL_MODEL
        );
        break;
      case 'deepseek':
        this.provider = new DeepSeekProvider(env.DEEPSEEK_API_KEY || '', env.DEEPSEEK_MODEL);
        break;
      case 'openrouter':
        if (!env.OPENROUTER_API_KEY) {
          logger.warn('OPENROUTER_API_KEY not set, falling back to mock');
          this.provider = new MockProvider();
        } else {
          this.provider = new OpenRouterProvider(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL);
        }
        break;
      case 'mock':
      default:
        this.provider = new MockProvider();
        break;
    }
  }

  private async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    this.processing = true;
    while (this.requestQueue.length > 0) {
      const next = this.requestQueue.shift();
      if (next) {
        await next();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    this.processing = false;
  }

  async generateDraft(
    tone: string = 'professional',
    useCase: string = 'initial',
    campaignContext?: string,
    reference?: string,
    companyContext?: string
  ): Promise<{ subject: string; body: string }> {
    return this.enqueue(async () => {
      try {
        return await this.provider.generateDraft(tone, useCase, campaignContext, reference, companyContext);
      } catch (error) {
        logger.error({ error, provider: env.AI_PROVIDER }, 'AI provider failed, falling back to mock');
        const mock = new MockProvider();
        return mock.generateDraft(tone, useCase, campaignContext, reference, companyContext);
      }
    });
  }
}

export const aiService = new AIService();