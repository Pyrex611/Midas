import { logger } from '../config/logger';
import { env } from '../config/env';
import { promptManager, PromptParams } from './promptManager.service';

// ===== ANALYSIS INTERFACE =====
export interface ReplyAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: string;
  painPoints?: string[];
  objections?: string[];
  interestLevel?: number; // 1-10
  buyingSignals?: string[];
  suggestedApproach?: string;
  keyPoints?: string[];
}

// ===== PROVIDER INTERFACE =====
interface AIProvider {
  complete(prompt: string, system?: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

// ===== MOCK PROVIDER =====
class MockProvider implements AIProvider {
  async isAvailable() { return true; }

  async complete(prompt: string, system?: string): Promise<string> {
    logger.debug('MockProvider generating response');
    if (prompt.includes('sentiment')) {
      return JSON.stringify({
        sentiment: 'neutral',
        intent: 'asking for info',
        painPoints: [],
        objections: [],
        interestLevel: 5,
        buyingSignals: [],
        suggestedApproach: 'provide more information',
        keyPoints: []
      });
    } else {
      const subjects = [
        'Quick question regarding {{company}}',
        'Loved your recent post on {{topic}}',
        'Following up – {{company}}',
      ];
      const bodies = [
        `Hi {{name}},\n\nI've been following {{company}}'s recent work in the industry and was impressed by your team's achievements. At our company, we specialize in helping businesses like yours achieve {{valueProposition}}.\n\nWould you be open to a 10‑minute call next week? I'd love to share some insights that could be relevant.\n\nBest regards,\n{{senderName}}`,
        `Hi {{name}},\n\nI came across your post about {{topic}} and it really resonated. At {{senderCompany}}, we're working on something that aligns perfectly with that vision.\n\nIf you're open to it, I'd love to exchange ideas – no strings attached.\n\nCheers,\n{{senderName}}`,
        `Hi {{name}},\n\nJust wanted to gently follow up on my previous email. I know how busy things get.\n\nIf you're not the right person, could you point me to who handles {{valueProposition}} at {{company}}?\n\nThanks either way,\n{{senderName}}`,
      ];
      const idx = Math.floor(Math.random() * subjects.length);
      return JSON.stringify({ subject: subjects[idx], body: bodies[idx] });
    }
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

  async isAvailable() { return !!this.apiKey; }

  async complete(prompt: string, system?: string): Promise<string> {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// ===== GEMINI PROVIDER =====
class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-pro') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable() { return !!this.apiKey; }

  async complete(prompt: string, system?: string): Promise<string> {
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}

// ===== OLLAMA PROVIDER =====
class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = 'http://localhost:11434', model = 'llama3.1:8b') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async isAvailable() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/tags`);
      return resp.ok;
    } catch {
      return false;
    }
  }

  async complete(prompt: string, system?: string): Promise<string> {
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: fullPrompt,
        stream: false,
        options: { temperature: 0.7 },
      }),
    });

    if (!response.ok) throw new Error('Ollama generation failed');
    const data = await response.json();
    return data.response;
  }
}

// ===== DEEPSEEK PROVIDER =====
class DeepSeekProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'deepseek-chat') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable() { return !!this.apiKey; }

  async complete(prompt: string, system?: string): Promise<string> {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// ===== OPENROUTER PROVIDER =====
class OpenRouterProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable() { return !!this.apiKey; }

  async complete(prompt: string, system?: string): Promise<string> {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

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
        messages,
        temperature: 0.7,
        max_tokens: 5120,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, errorText }, 'OpenRouter API error');
      throw new Error(`OpenRouter API error (${response.status})`);
    }

    const data = await response.json();
    logger.debug({ openRouterResponse: JSON.stringify(data).substring(0, 2000) }, 'OpenRouter raw response');

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('OpenRouter API returned invalid response structure');
    }

    const choice = data.choices[0];
    let rawContent = choice.message?.content || '';
    if (!rawContent && choice.message?.reasoning) {
      rawContent = choice.message.reasoning;
    }
    if (!rawContent) {
      rawContent = JSON.stringify(choice.message);
    }
    return rawContent;
  }
}

// ===== AI SERVICE WITH QUEUE =====
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
        this.provider = new OllamaProvider(env.OLLAMA_URL, env.OLLAMA_POWERFUL_MODEL);
        break;
      case 'deepseek':
        this.provider = new DeepSeekProvider(env.DEEPSEEK_API_KEY || '', env.DEEPSEEK_MODEL);
        break;
      case 'openrouter':
        this.provider = new OpenRouterProvider(env.OPENROUTER_API_KEY || '', env.OPENROUTER_MODEL);
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

  /**
   * Public method for generic completions (used by reply drafting).
   */
  async complete(prompt: string, system?: string): Promise<string> {
    return this.enqueue(() => this.provider.complete(prompt, system));
  }

  /**
   * Generate a cold email draft (uses PromptManager).
   */
  async generateDraft(
    tone: string = 'professional',
    useCase: 'initial' | 'followup' | 'reply' = 'initial',
    campaignContext?: string | null,
    reference?: string | null,
    companyContext?: string | null,
    originalEmail?: string,
    sentiment?: string
  ): Promise<{ subject: string; body: string }> {
    const variationSeed = Math.floor(Math.random() * 1000000);
    const params: PromptParams = {
      useCase,
      tone,
      campaignContext,
      reference,
      companyContext,
      variationSeed,
      originalEmail,
      sentiment,
    };
    const prompt = promptManager.buildPrompt(params);
    const system = 'You are an expert B2B cold email copywriter. Output only valid JSON with "subject" and "body".';

    return this.enqueue(async () => {
      try {
        const raw = await this.provider.complete(prompt, system);
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error(`No JSON object found in response: ${raw.substring(0, 500)}`);
        }
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.subject || !parsed.body) {
          throw new Error(`Parsed JSON missing subject/body: ${JSON.stringify(parsed)}`);
        }
        return { subject: parsed.subject, body: parsed.body };
      } catch (error) {
        logger.error({ error, provider: env.AI_PROVIDER }, 'AI provider failed, falling back to mock');
        const mock = new MockProvider();
        const raw = await mock.complete(prompt, system);
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Mock provider returned invalid JSON');
        }
        return JSON.parse(jsonMatch[0]);
      }
    });
  }

  /**
   * Analyze a reply email.
   */
  async analyzeReply(replyText: string): Promise<ReplyAnalysis> {
    const prompt = `You are an elite sales analyst and manager. Analyze the following email reply from a lead. Provide a detailed JSON analysis with the following fields:
- sentiment: one of "positive", "neutral", "negative"
- intent: a short phrase describing the lead's primary intent (e.g., "interested", "not interested", "out of office", "asking for info", "objection", "scheduling")
- painPoints: an array of specific pain points mentioned (if any)
- objections: an array of specific objections raised (if any)
- interestLevel: a number from 1 to 10 indicating the lead's interest level (1 = not interested, 10 = highly interested)
- buyingSignals: an array of buying signals detected (e.g., "asked about pricing", "mentioned timeline", "wants demo")
- suggestedApproach: a brief recommendation on how to reply (e.g., "provide case study", "schedule a demo", "address pricing concern", "ask clarifying question")
- keyPoints: an array of any other important points from the email

If a field is not applicable, omit it or use an empty array.
Reply text: """${replyText}"""
Output only valid JSON.`;

    const system = 'You are an expert sales analyst. Output only valid JSON.';

    return this.enqueue(async () => {
      try {
        const raw = await this.provider.complete(prompt, system);
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error(`No JSON object found in response: ${raw.substring(0, 500)}`);
        }
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.sentiment || !parsed.intent) {
          throw new Error(`Parsed JSON missing sentiment/intent: ${JSON.stringify(parsed)}`);
        }
        return parsed as ReplyAnalysis;
      } catch (error) {
        logger.error({ error, provider: env.AI_PROVIDER }, 'Reply analysis failed, using default');
        return {
          sentiment: 'neutral',
          intent: 'unknown',
          painPoints: [],
          objections: [],
          interestLevel: 5,
          buyingSignals: [],
          suggestedApproach: 'ask clarifying question',
          keyPoints: [],
        };
      }
    });
  }
}

export const aiService = new AIService();