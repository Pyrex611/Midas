import { logger } from '../config/logger';
import { promptManager, PromptParams } from './promptManager.service';

export interface ReplyAnalysis {
  sentiment: 'very positive' | 'positive' | 'neutral' | 'negative' | 'very negative';
  intent: string;
  painPoints?: string[];
  objections?: string[];
  interestLevel?: number; // 1-10
  buyingSignals?: string[];
  suggestedApproach?: string;
  keyPoints?: string[];
}

interface AIProvider {
  complete(prompt: string, system?: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

class MockProvider implements AIProvider {
  async isAvailable() { return true; }

  async complete(prompt: string): Promise<string> {
    logger.debug('MockProvider generating fallback response');
    if (prompt.includes('sentiment') || prompt.includes('Reply text')) {
      return JSON.stringify({
        sentiment: 'neutral',
        intent: 'asking for info',
        painPoints: ['CRM integration friction'],
        objections: [],
        interestLevel: 6,
        buyingSignals: ['requested details'],
        suggestedApproach: 'Provide a brief one-pager and offer an asynchronous demo.',
        keyPoints: []
      });
    } else {
      return JSON.stringify({
        subject: '{Quick question|Quick idea} regarding {{company}}',
        body: '{Hi|Hey|Hello} {{name}},\n\n{I noticed|Looks like} {{company}} is active in your market. We help teams automate pipeline conversion without adding overhead.\n\nWorth exploring?\n\nBest,\n{{senderName}}'
      });
    }
  }
}

class OpenAIProvider implements AIProvider {
  constructor(private apiKey: string, private model = 'gpt-4-turbo-preview') {}

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

    const data: any = await response.json();
    return data.choices[0].message.content;
  }
}

class GeminiProvider implements AIProvider {
  constructor(private apiKey: string, private model = 'gemini-2.5-flash-lite') {}

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

    const data: any = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}

class DeepSeekProvider implements AIProvider {
  constructor(private apiKey: string, private model = 'deepseek-chat') {}

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

    const data: any = await response.json();
    return data.choices[0].message.content;
  }
}

class OpenRouterProvider implements AIProvider {
  constructor(private apiKey: string, private model: string) {}

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
        'HTTP-Referer': 'https://midas.outreach',
        'X-Title': 'Midas Engine',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('OpenRouter API returned invalid response structure');
    }

    const choice = data.choices[0];
    let rawContent = choice.message?.content || '';
    if (!rawContent && choice.message?.reasoning) {
      rawContent = choice.message.reasoning;
    }
    return rawContent;
  }
}

class OllamaProvider implements AIProvider {
  constructor(private baseUrl = 'http://localhost:11434', private model = 'llama3.1:8b') {}

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
    const data: any = await response.json();
    return data.response;
  }
}

export class AIService {
  private primaryProvider: AIProvider;
  private fallbackProvider: AIProvider | null = null;
  private mockProvider = new MockProvider();

  constructor() {
    const primaryType = (process.env.AI_PROVIDER || 'mock').toLowerCase();
    const fallbackType = process.env.PRIMARY_FALLBACK_PROVIDER?.toLowerCase();

    logger.info({ primary: primaryType, fallback: fallbackType }, 'Initializing Dynamic AI Failover Engine');

    this.primaryProvider = this.createProvider(primaryType);

    if (fallbackType && fallbackType !== primaryType) {
      try {
        this.fallbackProvider = this.createProvider(fallbackType);
      } catch (err) {
        logger.error({ err, fallbackType }, 'Failed to initialize fallback AI provider');
      }
    }
  }

  private createProvider(type: string): AIProvider {
    switch (type) {
      case 'openai':
        return new OpenAIProvider(process.env.OPENAI_API_KEY || '', process.env.OPENAI_MODEL || 'gpt-4-turbo-preview');
      case 'gemini':
        return new GeminiProvider(process.env.GEMINI_API_KEY || '', process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite');
      case 'deepseek':
        return new DeepSeekProvider(process.env.DEEPSEEK_API_KEY || '', process.env.DEEPSEEK_MODEL || 'deepseek-chat');
      case 'openrouter':
        return new OpenRouterProvider(process.env.OPENROUTER_API_KEY || '', process.env.OPENROUTER_MODEL || 'deepseek/deepseek-r1:free');
      case 'ollama':
        return new OllamaProvider(process.env.OLLAMA_URL || 'http://localhost:11434', process.env.OLLAMA_POWERFUL_MODEL || 'llama3.1:8b');
      case 'mock':
      default:
        return new MockProvider();
    }
  }

  private async attemptComplete(prompt: string, system?: string): Promise<string> {
    try {
      return await this.primaryProvider.complete(prompt, system);
    } catch (primaryError) {
      logger.error({ error: primaryError, provider: process.env.AI_PROVIDER }, 'Primary AI provider failed');

      if (this.fallbackProvider) {
        try {
          logger.info({ fallback: process.env.PRIMARY_FALLBACK_PROVIDER }, 'Switching to fallback AI provider');
          return await this.fallbackProvider.complete(prompt, system);
        } catch (fallbackError) {
          logger.error({ error: fallbackError }, 'Fallback AI provider failed');
        }
      }

      logger.warn('Failing over to Mock AI provider');
      return await this.mockProvider.complete(prompt, system);
    }
  }

  private extractJSON(raw: string): any {
    // Strip DeepSeek R1 reasoning tags if present
    const cleanedRaw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    const match = cleanedRaw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`No JSON object found in response: ${cleanedRaw.substring(0, 300)}`);
    }

    try {
      return JSON.parse(match[0]);
    } catch (err) {
      // Bracket depth matching fallback
      let depth = 0;
      let start = -1;
      for (let i = 0; i < cleanedRaw.length; i++) {
        const ch = cleanedRaw[i];
        if (ch === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            const candidate = cleanedRaw.substring(start, i + 1);
            try {
              return JSON.parse(candidate);
            } catch (e) {
              // keep searching
            }
          }
        }
      }
      throw new Error(`Could not extract valid JSON from response: ${cleanedRaw.substring(0, 300)}`);
    }
  }

  async complete(prompt: string, system?: string): Promise<string> {
    return this.attemptComplete(prompt, system);
  }

  async generateDraft(
    tone: string = 'professional',
    useCase: 'initial' | 'followup' | 'reply' = 'initial',
    campaignContext?: string | null,
    reference?: string | null,
    companyContext?: string | null,
    originalEmail?: string,
    sentiment?: string,
    stepNumber?: number
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
      stepNumber,
    };
    const prompt = promptManager.buildPrompt(params);
    const system = 'You are an elite B2B sales copywriter. Output only valid JSON with "subject" and "body".';

    const raw = await this.attemptComplete(prompt, system);
    const parsed = this.extractJSON(raw);
    if (!parsed.subject || !parsed.body) {
      throw new Error(`Parsed JSON missing subject or body: ${JSON.stringify(parsed)}`);
    }
    return { subject: parsed.subject, body: parsed.body };
  }

  async analyzeReply(replyText: string): Promise<ReplyAnalysis> {
    const prompt = `Analyze the following B2B email reply from a lead. Provide a JSON response with:
- sentiment: one of "very positive", "positive", "neutral", "negative", "very negative"
- intent: short phrase describing primary intent
- painPoints: array of pain points mentioned (if any)
- objections: array of objections raised (if any)
- interestLevel: number 1-10
- buyingSignals: array of buying signals (if any)
- suggestedApproach: recommended next step
- keyPoints: array of important notes

Reply text: """${replyText}"""`;

    const system = 'You are an expert sales analyst. Output only valid JSON.';
    const raw = await this.attemptComplete(prompt, system);
    const parsed = this.extractJSON(raw);
    if (!parsed.sentiment || !parsed.intent) {
      throw new Error(`Parsed analysis missing sentiment or intent: ${JSON.stringify(parsed)}`);
    }
    return parsed as ReplyAnalysis;
  }
}

export const aiService = new AIService();