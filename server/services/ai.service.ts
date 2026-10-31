import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { promptManager, PromptParams } from './promptManager.service';
import { tryDecrypt } from '../lib/encryption';
import {
  AIProvider,
  ReplyAnalysis,
  InboundClassification,
  InboundIntentCategory,
  ConfirmedProviderIntegration,
} from './ai/types';
import { MockProvider } from './ai/providers/mock.provider';
import { OpenAIProvider } from './ai/providers/openai.provider';
import { GeminiProvider } from './ai/providers/gemini.provider';
import { DeepSeekProvider } from './ai/providers/deepseek.provider';
import { OpenRouterProvider } from './ai/providers/openrouter.provider';
import { AIGatewayProvider } from './ai/providers/aigateway.provider';

export type { ReplyAnalysis, InboundClassification, InboundIntentCategory, ConfirmedProviderIntegration } from './ai/types';

export interface GenerateDraftOptions {
  tone?: string;
  useCase?: 'initial' | 'followup' | 'reply';
  campaignContext?: string | null;
  reference?: string | null;
  companyContext?: string | null;
  originalEmail?: string;
  sentiment?: string;
  stepNumber?: number;
  userId?: string;
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
          overrides?.gatewayUrl || process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1',
          overrides?.apiKey || process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_KEY || process.env.VERCEL_OIDC_TOKEN || '',
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

  public async resolveUserProvider(userId?: string): Promise<AIProvider> {
    if (!userId) return this.defaultPrimaryProvider;

    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings) {
        return this.defaultPrimaryProvider;
      }

      let providerName = settings.aiProvider;
      let model = settings.aiModel || undefined;
      let decryptedKey = tryDecrypt(settings.aiApiKeyEncrypted) || undefined;
      let gatewayUrl = settings.aiGatewayUrl || undefined;

      if (settings.aiIntegrations && Array.isArray(settings.aiIntegrations)) {
        const integrations = settings.aiIntegrations as unknown as ConfirmedProviderIntegration[];
        const matched = integrations.find(i => i.provider === providerName || i.id === providerName);
        if (matched) {
          providerName = matched.provider;
          model = settings.aiModel || matched.activeModel;
          if (matched.apiKeyEncrypted) {
            decryptedKey = tryDecrypt(matched.apiKeyEncrypted) || decryptedKey;
          }
          if (matched.gatewayUrl) {
            gatewayUrl = matched.gatewayUrl;
          }
        }
      }

      if (!providerName) return this.defaultPrimaryProvider;

      if (gatewayUrl && gatewayUrl.includes('api.vercel.ai')) {
        gatewayUrl = gatewayUrl.replace('api.vercel.ai', 'ai-gateway.vercel.sh');
      }

      return this.createProviderInstance(providerName, {
        model,
        apiKey: decryptedKey,
        gatewayUrl,
      });
    } catch {
      return this.defaultPrimaryProvider;
    }
  }

  /**
   * Completes a prompt through the active provider with explicit error throwing
   * (never silently degrades to mock if an active live provider was requested).
   */
  private async attemptComplete(
    prompt: string,
    system?: string,
    activeProvider?: AIProvider,
    allowMockFallback: boolean = false
  ): Promise<string> {
    const provider = activeProvider || this.defaultPrimaryProvider;

    try {
      return await provider.complete(prompt, system);
    } catch (primaryError: any) {
      logger.error(
        {
          provider: provider.name,
          error: primaryError?.message || String(primaryError),
        },
        '[AI-ENGINE] Primary AI provider execution failed'
      );

      // Attempt configured fallback if available
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

      // If operator explicitly configured a live provider, NEVER swallow error with mock!
      if (!allowMockFallback && provider.name !== 'mock') {
        throw new Error(`[${provider.name.toUpperCase()}] ${primaryError?.message || 'AI Provider request failed'}`);
      }

      logger.warn('[AI-ENGINE] Degrading to Mock AI provider (background safe fallback)');
      return await this.mockProvider.complete(prompt, system);
    }
  }

  /**
   * Robust JSON extraction: handles thinking blocks, markdown fences,
   * and extracts JSON even if embedded inside reasoning text.
   */
  private extractJSON(raw: string): any {
    // 1. Strip thinking tags
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 2. Strip outer markdown fences: ```json ... ``` or ``` ... ```
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // 3. Find outer braces
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }

    // 4. Fallback scanner
    let depth = 0;
    let start = -1;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          const candidate = cleaned.substring(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {}
        }
      }
    }

    throw new Error(`AI generated response but it could not be parsed into valid JSON. Response snippet: ${cleaned.substring(0, 180)}`);
  }

  async complete(prompt: string, system?: string, userId?: string): Promise<string> {
    const provider = await this.resolveUserProvider(userId);
    return this.attemptComplete(prompt, system, provider, false);
  }

  async generateDraft(options: GenerateDraftOptions): Promise<{ subject: string; body: string }>;
  async generateDraft(
    tone?: string,
    useCase?: 'initial' | 'followup' | 'reply',
    campaignContext?: string | null,
    reference?: string | null,
    companyContext?: string | null,
    originalEmail?: string,
    sentiment?: string,
    stepNumber?: number,
    userId?: string
  ): Promise<{ subject: string; body: string }>;
  async generateDraft(
    optionsOrTone: GenerateDraftOptions | string = 'professional',
    useCase: 'initial' | 'followup' | 'reply' = 'initial',
    campaignContext?: string | null,
    reference?: string | null,
    companyContext?: string | null,
    originalEmail?: string,
    sentiment?: string,
    stepNumber?: number,
    userId?: string
  ): Promise<{ subject: string; body: string }> {
    let opts: GenerateDraftOptions;

    if (typeof optionsOrTone === 'string') {
      opts = {
        tone: optionsOrTone,
        useCase,
        campaignContext,
        reference,
        companyContext,
        originalEmail,
        sentiment,
        stepNumber,
        userId,
      };
    } else {
      opts = optionsOrTone;
    }

    const provider = await this.resolveUserProvider(opts.userId);
    const variationSeed = Math.floor(Math.random() * 1000000);
    const resolvedTone = opts.tone || 'professional';
    const params: PromptParams = {
      useCase: opts.useCase || 'initial',
      tone: resolvedTone,
      campaignContext: opts.campaignContext,
      reference: opts.reference,
      companyContext: opts.companyContext,
      variationSeed,
      originalEmail: opts.originalEmail,
      sentiment: opts.sentiment,
      stepNumber: opts.stepNumber,
    };

    const prompt = promptManager.buildPrompt(params);
    const system = 'You are an elite B2B sales copywriter. Output only valid JSON with "subject" and "body".';

    // Disallow silent mock fallback for user-requested drafts
    const raw = await this.attemptComplete(prompt, system, provider, false);
    const parsed = this.extractJSON(raw);
    if (!parsed.subject || !parsed.body) {
      throw new Error(`Parsed JSON missing "subject" or "body" property`);
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
    const raw = await this.attemptComplete(prompt, system, provider, true);
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
    const raw = await this.attemptComplete(prompt, system, provider, true);
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
    const raw = await this.attemptComplete(prompt, system, provider, true);
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

  async testCustomConfiguration(config: {
    provider: string;
    model?: string;
    apiKey?: string;
    gatewayUrl?: string;
    userId?: string;
  }): Promise<{
    status: 'HEALTHY' | 'ERROR';
    latencyMs?: number;
    responsePreview?: string;
    errorDetail?: string;
  }> {
    let resolvedKey = config.apiKey?.trim();

    if (!resolvedKey && config.userId) {
      try {
        const settings = await prisma.userSettings.findUnique({
          where: { userId: config.userId },
        });
        if (settings?.aiApiKeyEncrypted) {
          resolvedKey = tryDecrypt(settings.aiApiKeyEncrypted) || undefined;
        }
      } catch {}
    }

    let gatewayUrl = config.gatewayUrl?.trim();
    if (gatewayUrl && gatewayUrl.includes('api.vercel.ai')) {
      gatewayUrl = gatewayUrl.replace('api.vercel.ai', 'ai-gateway.vercel.sh');
    }

    const testProvider = this.createProviderInstance(config.provider, {
      model: config.model?.trim(),
      apiKey: resolvedKey,
      gatewayUrl,
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