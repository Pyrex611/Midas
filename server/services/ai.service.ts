import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { promptManager, PromptParams } from './promptManager.service';
import { tryDecrypt } from '../lib/encryption';
import {
  AIProvider,
  ReplyAnalysis,
  InboundClassification,
  InboundIntentCategory,
} from './ai/types';
import { MockProvider } from './ai/providers/mock.provider';
import { OpenAIProvider } from './ai/providers/openai.provider';
import { GeminiProvider } from './ai/providers/gemini.provider';
import { DeepSeekProvider } from './ai/providers/deepseek.provider';
import { OpenRouterProvider } from './ai/providers/openrouter.provider';
import { AIGatewayProvider } from './ai/providers/aigateway.provider';

export type { ReplyAnalysis, InboundClassification, InboundIntentCategory } from './ai/types';

export interface UserAIConfig {
  provider: string;
  model?: string;
  apiKey?: string;
  gatewayUrl?: string;
}

export class AIService {
  private defaultPrimaryProvider: AIProvider;
  private defaultFallbackProvider: AIProvider | null = null;
  private mockProvider = new MockProvider();

  constructor() {
    const primaryType = (process.env.AI_PROVIDER || 'mock').toLowerCase();
    const fallbackType = process.env.PRIMARY_FALLBACK_PROVIDER?.toLowerCase();

    logger.info({ primary: primaryType, fallback: fallbackType }, '[AI-ENGINE] Initializing Modular AI Engine');

    this.defaultPrimaryProvider = this.createProviderInstance(primaryType);

    if (fallbackType && fallbackType !== primaryType) {
      try {
        this.defaultFallbackProvider = this.createProviderInstance(fallbackType);
      } catch (err: any) {
        logger.error({ err: err?.message, fallbackType }, '[AI-ENGINE] Failed to initialize fallback AI provider');
      }
    }
  }

  public createProviderInstance(type: string, overrides?: { model?: string; apiKey?: string; gatewayUrl?: string }): AIProvider {
    switch (type.toLowerCase()) {
      case 'gemini':
        return new GeminiProvider(
          overrides?.apiKey || process.env.GEMINI_API_KEY || '',
          overrides?.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash'
        );
      case 'openrouter':
        return new OpenRouterProvider(
          overrides?.apiKey || process.env.OPENROUTER_API_KEY || '',
          overrides?.model || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat'
        );
      case 'aigateway':
        return new AIGatewayProvider(
          overrides?.gatewayUrl || process.env.AI_GATEWAY_URL || 'https://api.vercel.ai/v1',
          overrides?.apiKey || process.env.AI_GATEWAY_KEY || '',
          overrides?.model || process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini'
        );
      case 'openai':
        return new OpenAIProvider(
          overrides?.apiKey || process.env.OPENAI_API_KEY || '',
          overrides?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
        );
      case 'deepseek':
        return new DeepSeekProvider(
          overrides?.apiKey || process.env.DEEPSEEK_API_KEY || '',
          overrides?.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat'
        );
      case 'mock':
      default:
        return new MockProvider();
    }
  }

  /**
   * Resolves active AI configuration for a specific user.
   * Checks database UserSettings first; falls back to server env vars.
   */
  public async resolveUserProvider(userId?: string): Promise<AIProvider> {
    if (!userId) return this.defaultPrimaryProvider;

    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings || !settings.aiProvider) {
        return this.defaultPrimaryProvider;
      }

      const decryptedKey = tryDecrypt(settings.aiApiKeyEncrypted) || undefined;

      return this.createProviderInstance(settings.aiProvider, {
        model: settings.aiModel || undefined,
        apiKey: decryptedKey,
        gatewayUrl: settings.aiGatewayUrl || undefined,
      });
    } catch {
      return this.defaultPrimaryProvider;
    }
  }

  private async attemptComplete(prompt: string, system?: string, activeProvider?: AIProvider): Promise<string> {
    const provider = activeProvider || this.defaultPrimaryProvider;

    try {
      return await provider.complete(prompt, system);
    } catch (primaryError: any) {
      logger.error(
        {
          provider: provider.name,
          error: primaryError?.message || String(primaryError),
          stack: primaryError?.stack,
        },
        '[AI-ENGINE] Configured AI provider call failed'
      );

      if (this.defaultFallbackProvider) {
        try {
          logger.info({ fallback: this.defaultFallbackProvider.name }, '[AI-ENGINE] Switching to fallback AI provider');
          return await this.defaultFallbackProvider.complete(prompt, system);
        } catch (fallbackError: any) {
          logger.error(
            {
              fallback: this.defaultFallbackProvider.name,
              error: fallbackError?.message || String(fallbackError),
            },
            '[AI-ENGINE] Fallback AI provider also failed'
          );
        }
      }

      logger.warn('[AI-ENGINE] ALL CONFIGURED AI PROVIDERS FAILED — Falling over to Mock AI provider');
      return await this.mockProvider.complete(prompt, system);
    }
  }

  private extractJSON(raw: string): any {
    const cleanedRaw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    const match = cleanedRaw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`No JSON object found in response: ${cleanedRaw.substring(0, 300)}`);
    }

    try {
      return JSON.parse(match[0]);
    } catch {
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
            } catch {
              // continue scanning
            }
          }
        }
      }
      throw new Error(`Could not extract valid JSON from response: ${cleanedRaw.substring(0, 300)}`);
    }
  }

  async complete(prompt: string, system?: string, userId?: string): Promise<string> {
    const provider = await this.resolveUserProvider(userId);
    return this.attemptComplete(prompt, system, provider);
  }

  async generateDraft(
    tone: string = 'professional',
    useCase: 'initial' | 'followup' | 'reply' = 'initial',
    campaignContext?: string | null,
    reference?: string | null,
    companyContext?: string | null,
    originalEmail?: string,
    sentiment?: string,
    stepNumber?: number,
    userId?: string
  ): Promise<{ subject: string; body: string }> {
    const provider = await this.resolveUserProvider(userId);
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

    const raw = await this.attemptComplete(prompt, system, provider);
    const parsed = this.extractJSON(raw);
    if (!parsed.subject || !parsed.body) {
      throw new Error(`Parsed JSON missing subject or body: ${JSON.stringify(parsed)}`);
    }
    return { subject: parsed.subject, body: parsed.body };
  }

  async classifyIntent(replyText: string, userId?: string): Promise<InboundClassification> {
    const provider = await this.resolveUserProvider(userId);
    const prompt = `Analyze this inbound B2B email response from a prospect.
Classify the response into exact JSON with:
- "intent": exactly one of ["INTERESTED_DEMO", "INTERESTED_INFO", "OBJECTION_PRICING", "OBJECTION_TIMING", "OBJECTION_COMPETITOR", "NOT_DECISION_MAKER", "OUT_OF_OFFICE", "UNSUBSCRIBE_REQUEST", "NEUTRAL_QUESTION"]
- "sentiment": exactly one of ["very positive", "positive", "neutral", "negative", "very negative"]
- "confidence": number 0.0 to 1.0
- "extractedReturnDate": ISO date string if OOO specifies a return date (e.g. "2026-11-20"), otherwise null
- "summary": one sentence summary of what the prospect said
- "recommendedAction": one of ["CONVERT_CALL", "SEND_COLLATERAL", "HANDLE_OBJECTION", "FREEZE_OOO", "UNSUBSCRIBE", "MANUAL_REVIEW"]

Prospect Reply Text:
"""
${replyText}
"""`;

    const system = 'You are an expert sales analyst. Return only valid JSON.';
    const raw = await this.attemptComplete(prompt, system, provider);
    const parsed = this.extractJSON(raw);

    return {
      intent: parsed.intent || 'NEUTRAL_QUESTION',
      sentiment: parsed.sentiment || 'neutral',
      confidence: parsed.confidence || 0.8,
      extractedReturnDate: parsed.extractedReturnDate || null,
      summary: parsed.summary || 'Prospect replied.',
      recommendedAction: parsed.recommendedAction || 'MANUAL_REVIEW',
    };
  }

  async generateObjectionResponse(
    campaign: { context?: string | null; reference?: string | null; targetTool?: string | null; extendedObjective?: string | null },
    lead: { name: string; company?: string | null },
    inboundText: string,
    intent: InboundIntentCategory,
    userId?: string
  ): Promise<{ subject: string; body: string }> {
    const provider = await this.resolveUserProvider(userId);
    const prompt = `You are a world-class sales development representative.
A prospect has raised an objection of type "${intent}".
Your goal is to politely resolve the objection, remove friction, and steer towards the target tool: "${campaign.targetTool || 'a short 15-minute call'}".

Campaign Strategy Context: "${campaign.context || 'B2B Solutions'}"
Extended SDR Guidelines: "${campaign.extendedObjective || 'Be concise, low-pressure, and helpful.'}"
Prospect Name: "${lead.name}"
Prospect Company: "${lead.company || 'their team'}"
Prospect's Message:
"""
${inboundText}
"""

Rules:
1. Under 75 words total.
2. Directly address their specific friction point.
3. Soft CTA aligned with "${campaign.targetTool || 'the next step'}".
4. Use Spintax for greetings: {Hi|Hey} {{name}},

Output JSON: {"subject": "Re: ...", "body": "..."}`;

    const system = 'You are an elite B2B objection handling copywriter. Return valid JSON only.';
    const raw = await this.attemptComplete(prompt, system, provider);
    return this.extractJSON(raw);
  }

  async analyzeReply(replyText: string, userId?: string): Promise<ReplyAnalysis> {
    const provider = await this.resolveUserProvider(userId);
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
    const raw = await this.attemptComplete(prompt, system, provider);
    return this.extractJSON(raw) as ReplyAnalysis;
  }

  async testActiveProvider(userId?: string): Promise<{
    configuredProvider: string;
    status: 'HEALTHY' | 'ERROR';
    latencyMs?: number;
    responsePreview?: string;
    errorDetail?: string;
  }> {
    const provider = await this.resolveUserProvider(userId);
    const start = Date.now();
    try {
      const result = await provider.complete(
        'Return JSON: {"status": "ok", "message": "ping"}',
        'Output valid JSON only.'
      );
      const latencyMs = Date.now() - start;
      return {
        configuredProvider: provider.name,
        status: 'HEALTHY',
        latencyMs,
        responsePreview: result.substring(0, 100),
      };
    } catch (err: any) {
      return {
        configuredProvider: provider.name,
        status: 'ERROR',
        errorDetail: err?.message || String(err),
      };
    }
  }

  /**
   * Directly test any user-specified combination of provider, model, key, and gateway URL.
   */
  async testCustomConfiguration(config: {
    provider: string;
    model?: string;
    apiKey?: string;
    gatewayUrl?: string;
  }): Promise<{
    status: 'HEALTHY' | 'ERROR';
    latencyMs?: number;
    responsePreview?: string;
    errorDetail?: string;
  }> {
    const testProvider = this.createProviderInstance(config.provider, {
      model: config.model,
      apiKey: config.apiKey,
      gatewayUrl: config.gatewayUrl,
    });

    const start = Date.now();
    try {
      const result = await testProvider.complete(
        'Return JSON: {"status": "ok", "message": "ping"}',
        'Output valid JSON only.'
      );
      const latencyMs = Date.now() - start;
      return {
        status: 'HEALTHY',
        latencyMs,
        responsePreview: result.substring(0, 100),
      };
    } catch (err: any) {
      return {
        status: 'ERROR',
        errorDetail: err?.message || String(err),
      };
    }
  }
}

export const aiService = new AIService();