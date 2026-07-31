import { logger } from '../config/logger';
import { env } from '../config/env';
import { promptManager, PromptParams } from './promptManager.service';

// ===== ANALYSIS INTERFACE =====
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

// ===== PROVIDER INTERFACE =====
interface AIProvider {
  complete(prompt: string, system?: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

// ===== MOCK PROVIDER (Safe Fallback) =====
class MockProvider implements AIProvider {
  async isAvailable() { return true; }

  async complete(prompt: string, system?: string): Promise<string> {
    logger.debug('MockProvider generating fallback response');
    if (prompt.includes('sentiment') || prompt.includes('analyze')) {
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
      return JSON.stringify({ 
        subject: "Quick question for {{company}}", 
        body: "Hi {{name}},\n\nI noticed your work in the industry and wanted to reach out regarding the objective we discussed.\n\nWould you be open to a brief chat?\n\nBest,\n{{senderName}}" 
      });
    }
  }
}

// ===== OPENROUTER PROVIDER (Primary) =====
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
        'HTTP-Referer': 'https://midas-outreach.com',
        'X-Title': 'Midas AI SDR',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// ===== GEMINI PROVIDER (Standard Fallback) =====
class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-flash') {
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
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
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

// ===== AI SERVICE WITH STRATEGIC CONTEXT =====
export class AIService {
  private primaryProvider: AIProvider;
  private fallbackProvider: AIProvider | null = null;
  private mockProvider = new MockProvider();
  private requestQueue: (() => Promise<any>)[] = [];
  private processing = false;

  constructor() {
    const primaryType = env.AI_PROVIDER?.toLowerCase() || 'openrouter';
    const fallbackType = env.PRIMARY_FALLBACK_PROVIDER?.toLowerCase() || 'gemini';

    this.primaryProvider = this.createProvider(primaryType, env.OPENROUTER_MODEL || env.OPENAI_MODEL);
    
    if (fallbackType && fallbackType !== primaryType) {
      this.fallbackProvider = this.createProvider(fallbackType, env.GEMINI_MODEL);
    }
  }

  private createProvider(type: string, model?: string): AIProvider {
    switch (type) {
      case 'openrouter':
        return new OpenRouterProvider(env.OPENROUTER_API_KEY || '', model || 'deepseek/deepseek-r1:free');
      case 'gemini':
        return new GeminiProvider(env.GEMINI_API_KEY || '', model || 'gemini-1.5-flash');
      case 'mock':
      default:
        return new MockProvider();
    }
  }

  /**
   * Generates a cold email or reply draft using the refined Phase 5 Strategic Brain.
   */
  async generateDraft(
    tone: string = 'professional',
    useCase: 'initial' | 'followup' | 'reply' = 'initial',
    campaignContext?: string | null,
    reference?: string | null,
    companyContext?: string | null,
    originalEmail?: string,      // Lead's reply
    sentiment?: string,
    stepNumber?: number,
    objective?: string | null,   // Global Campaign Goal
    microObjective?: string | null, // Current Step Goal
    targetTool?: string | null,     // Phone number or Link
    lastEmailContent?: string | null // For Narrative Stitching
  ): Promise<{ subject: string; body: string }> {
    
    const variationSeed = Math.floor(Math.random() * 1000000);
    
    // Assemble the full strategic parameter set for the PromptManager
    const params: PromptParams = {
      useCase,
      tone,
      campaignContext,
      objective,
      microObjective,
      targetTool,
      reference,
      companyContext,
      variationSeed,
      originalEmail,
      lastEmailContent, // 🔥 The Stitch
      sentiment,
      stepNumber
    };

    const prompt = promptManager.buildPrompt(params);
    const system = 'You are an expert B2B SDR closer. Output ONLY a valid JSON object with "subject" and "body" fields.';

    return this.enqueue(async () => {
      const raw = await this.attemptComplete(prompt, system);
      const parsed = this.extractJSON(raw);
      
      if (!parsed.subject || !parsed.body) {
        throw new Error('AI Response missing critical fields');
      }
      
      return { 
        subject: parsed.subject.trim(), 
        body: parsed.body.trim() 
      };
    });
  }

  /**
   * Standard completion method with fallback logic.
   */
  async complete(prompt: string, system?: string): Promise<string> {
    return this.enqueue(() => this.attemptComplete(prompt, system));
  }

  private async attemptComplete(prompt: string, system?: string): Promise<string> {
    try {
      return await this.primaryProvider.complete(prompt, system);
    } catch (err) {
      logger.warn({ err }, 'Primary AI provider failed, trying fallback...');
      if (this.fallbackProvider) {
        try {
          return await this.fallbackProvider.complete(prompt, system);
        } catch (fErr) {
          logger.error({ fErr }, 'Fallback AI provider failed.');
        }
      }
      return await this.mockProvider.complete(prompt, system);
    }
  }

  /**
   * Analyze a reply to detect sentiment, intent, and buying signals.
   */
  async analyzeReply(replyText: string): Promise<ReplyAnalysis> {
    const prompt = `Analyze this B2B email reply. Provide a detailed JSON analysis:
    - sentiment: "very positive", "positive", "neutral", "negative", "very negative"
    - intent: e.g. "interested", "not interested", "ooo", "asking for info", "referral"
    - interestLevel: 1-10
    - buyingSignals: array of strings (e.g. "asked for price", "asked for meeting")
    - suggestedApproach: string
    
    Reply text: """${replyText}"""`;

    const system = 'You are a senior sales manager. Output only valid JSON.';

    return this.enqueue(async () => {
      const raw = await this.attemptComplete(prompt, system);
      return this.extractJSON(raw) as ReplyAnalysis;
    });
  }

  /**
   * Robust JSON extraction using brace-counting to survive LLM conversational filler.
   */
  private extractJSON(raw: string): any {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object found in AI response');
    }

    const candidate = raw.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (err) {
      // Fallback: try more aggressive cleaning
      const cleaned = candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); 
      return JSON.parse(cleaned);
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
        // Artificial delay to prevent rate limiting (500ms default)
        await new Promise(res => setTimeout(res, env.AI_REQUEST_DELAY_MS || 500));
      }
    }
    this.processing = false;
  }
}

export const aiService = new AIService();