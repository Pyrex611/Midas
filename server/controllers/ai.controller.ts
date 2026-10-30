import { Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { encrypt } from '../lib/encryption';
import { ConfirmedProviderIntegration } from '../services/ai/types';

const PROVIDER_NAMES: Record<string, string> = {
  aigateway: 'Vercel AI Gateway',
  openrouter: 'OpenRouter',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  ollama: 'Ollama (Local)',
  mock: 'Built-in Mock',
};

export const optimizeContext = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { context } = req.body;
    if (!context || typeof context !== 'string') {
      return res.status(400).json({ error: 'Context string required' });
    }

    const prompt = `You are an expert sales copywriter and strategist. The following is a user-provided campaign context for a cold outreach campaign. Refine and expand it to be specific, compelling, and structured for generating high-converting B2B emails. Return ONLY the optimized context as plain text without commentary. Original context: "${context}"`;

    const system = 'You are an expert sales copywriter. Output only the optimized text.';
    const optimized = await aiService.complete(prompt, system, req.user?.id);

    const cleaned = optimized.replace(/^["']|["']$/g, '').trim();
    res.json({ optimized: cleaned });
  } catch (error) {
    logger.error({ error }, 'Failed to optimize campaign context');
    next(error);
  }
};

export const getAIDiagnostics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const diagnosticResult = await aiService.testActiveProvider(req.user?.id);
    res.json(diagnosticResult);
  } catch (error) {
    next(error);
  }
};

export const testAIConfiguration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { provider, model, apiKey, gatewayUrl } = req.body;

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required for testing' });
    }

    const result = await aiService.testCustomConfiguration({
      provider,
      model,
      apiKey,
      gatewayUrl,
      userId: req.user?.id,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ai/integrations
 * Returns active provider, active model, and list of confirmed integrations (with keys masked).
 */
export const getConfirmedIntegrations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    let integrations: ConfirmedProviderIntegration[] = [];
    if (settings?.aiIntegrations && Array.isArray(settings.aiIntegrations)) {
      integrations = settings.aiIntegrations as unknown as ConfirmedProviderIntegration[];
    } else {
      // Auto-synthesize default confirmed state if empty
      const activeP = settings?.aiProvider || process.env.AI_PROVIDER || 'aigateway';
      const activeM = settings?.aiModel || (activeP === 'aigateway' ? 'openai/gpt-4o-mini' : 'gemini-1.5-flash');
      integrations = [
        {
          id: activeP,
          provider: activeP,
          displayName: PROVIDER_NAMES[activeP] || activeP.toUpperCase(),
          gatewayUrl: settings?.aiGatewayUrl || 'https://ai-gateway.vercel.sh/v1',
          hasApiKey: Boolean(settings?.aiApiKeyEncrypted || process.env.AI_GATEWAY_API_KEY || process.env.GEMINI_API_KEY),
          models: [activeM],
          activeModel: activeM,
          lastTestedAt: new Date().toISOString(),
          status: 'HEALTHY',
          latencyMs: 380,
        },
      ];
    }

    const safeIntegrations = integrations.map(({ apiKeyEncrypted, ...rest }) => ({
      ...rest,
      hasApiKey: rest.hasApiKey || Boolean(apiKeyEncrypted),
    }));

    res.json({
      activeProvider: settings?.aiProvider || integrations[0]?.provider || 'aigateway',
      activeModel: settings?.aiModel || integrations[0]?.activeModel || 'openai/gpt-4o-mini',
      integrations: safeIntegrations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/confirm
 * Pings provider + model; on success, saves as a confirmed integration & sets as active default.
 */
export const confirmProvider = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { provider, model, apiKey, gatewayUrl, setAsActive = true } = req.body;

    if (!provider || !model) {
      return res.status(400).json({ error: 'Provider and model are required' });
    }

    // 1. Run live test ping
    const testResult = await aiService.testCustomConfiguration({
      provider,
      model,
      apiKey: apiKey?.trim() || undefined,
      gatewayUrl: gatewayUrl?.trim() || undefined,
      userId,
    });

    if (testResult.status !== 'HEALTHY') {
      return res.status(400).json({
        error: `Provider verification failed: ${testResult.errorDetail || 'Connection rejected'}`,
        diagnostic: testResult,
      });
    }

    // 2. Fetch or initialize existing integrations list
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    let integrations: ConfirmedProviderIntegration[] = [];
    if (settings?.aiIntegrations && Array.isArray(settings.aiIntegrations)) {
      integrations = [...(settings.aiIntegrations as unknown as ConfirmedProviderIntegration[])];
    }

    const existingIdx = integrations.findIndex(i => i.id === provider);
    const encryptedKey = apiKey?.trim() ? encrypt(apiKey.trim()) : (existingIdx >= 0 ? integrations[existingIdx].apiKeyEncrypted : settings?.aiApiKeyEncrypted);

    const updatedEntry: ConfirmedProviderIntegration = {
      id: provider,
      provider,
      displayName: PROVIDER_NAMES[provider] || provider.toUpperCase(),
      gatewayUrl: provider === 'aigateway' ? (gatewayUrl?.trim() || 'https://ai-gateway.vercel.sh/v1') : null,
      hasApiKey: Boolean(apiKey?.trim() || encryptedKey),
      apiKeyEncrypted: encryptedKey || null,
      models: existingIdx >= 0
        ? Array.from(new Set([...integrations[existingIdx].models, model.trim()]))
        : [model.trim()],
      activeModel: model.trim(),
      lastTestedAt: new Date().toISOString(),
      status: 'HEALTHY',
      latencyMs: testResult.latencyMs || 400,
    };

    if (existingIdx >= 0) {
      integrations[existingIdx] = updatedEntry;
    } else {
      integrations.push(updatedEntry);
    }

    const updatePayload: Record<string, any> = {
      aiIntegrations: integrations as any,
    };

    if (setAsActive) {
      updatePayload.aiProvider = provider;
      updatePayload.aiModel = model.trim();
      if (encryptedKey) updatePayload.aiApiKeyEncrypted = encryptedKey;
      if (provider === 'aigateway' && gatewayUrl) updatePayload.aiGatewayUrl = gatewayUrl.trim();
    }

    await prisma.userSettings.upsert({
      where: { userId },
      update: updatePayload,
      create: { userId, ...updatePayload },
    });

    logger.info({ userId, provider, model }, '[AI-ENGINE] Provider integration confirmed and saved');

    const safeIntegrations = integrations.map(({ apiKeyEncrypted: _, ...rest }) => rest);

    res.json({
      success: true,
      activeProvider: setAsActive ? provider : (settings?.aiProvider || provider),
      activeModel: setAsActive ? model.trim() : (settings?.aiModel || model.trim()),
      integrations: safeIntegrations,
      latencyMs: testResult.latencyMs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/add-model
 * Pings new model for an existing confirmed provider and adds it to confirmed models list.
 */
export const addModelToProvider = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { providerId, model } = req.body;

    if (!providerId || !model || !model.trim()) {
      return res.status(400).json({ error: 'Provider and model are required' });
    }

    const cleanModel = model.trim();

    // 1. Fetch user integration
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const integrations: ConfirmedProviderIntegration[] = (settings?.aiIntegrations as any) || [];
    const target = integrations.find(i => i.id === providerId);

    if (!target) {
      return res.status(404).json({ error: 'Provider integration not found. Set up the provider first.' });
    }

    // 2. Test model with provider's credentials
    const testResult = await aiService.testCustomConfiguration({
      provider: target.provider,
      model: cleanModel,
      gatewayUrl: target.gatewayUrl || undefined,
      userId,
    });

    if (testResult.status !== 'HEALTHY') {
      return res.status(400).json({
        error: `Model verification failed: ${testResult.errorDetail || 'Model rejected by provider'}`,
      });
    }

    // 3. Append model to integration
    target.models = Array.from(new Set([...target.models, cleanModel]));
    target.activeModel = cleanModel;
    target.lastTestedAt = new Date().toISOString();
    target.latencyMs = testResult.latencyMs;

    await prisma.userSettings.update({
      where: { userId },
      data: {
        aiIntegrations: integrations as any,
        aiModel: cleanModel,
      },
    });

    res.json({
      success: true,
      activeModel: cleanModel,
      integrations: integrations.map(({ apiKeyEncrypted: _, ...r }) => r),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/switch-active
 * Fast 1-click switch of active AI provider and model from anywhere in the UI.
 */
export const switchActiveProviderAndModel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { provider, model } = req.body;

    if (!provider || !model) {
      return res.status(400).json({ error: 'Provider and model are required' });
    }

    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const integrations: ConfirmedProviderIntegration[] = (settings?.aiIntegrations as any) || [];

    const target = integrations.find(i => i.id === provider);
    if (target) {
      target.activeModel = model.trim();
    }

    await prisma.userSettings.upsert({
      where: { userId },
      update: {
        aiProvider: provider,
        aiModel: model.trim(),
        aiIntegrations: integrations as any,
      },
      create: {
        userId,
        aiProvider: provider,
        aiModel: model.trim(),
      },
    });

    logger.info({ userId, provider, model }, '[AI-ENGINE] Switched active AI provider/model');

    res.json({
      success: true,
      activeProvider: provider,
      activeModel: model.trim(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/ai/integrations/:id
 */
export const deleteIntegration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    let integrations: ConfirmedProviderIntegration[] = (settings?.aiIntegrations as any) || [];

    integrations = integrations.filter(i => i.id !== id);
    const nextActive = integrations[0];

    await prisma.userSettings.update({
      where: { userId },
      data: {
        aiIntegrations: integrations as any,
        aiProvider: nextActive ? nextActive.provider : 'mock',
        aiModel: nextActive ? nextActive.activeModel : 'mock-default',
      },
    });

    res.json({
      success: true,
      activeProvider: nextActive ? nextActive.provider : 'mock',
      activeModel: nextActive ? nextActive.activeModel : 'mock-default',
      integrations: integrations.map(({ apiKeyEncrypted: _, ...r }) => r),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/ai/integrations/:id/models
 */
export const deleteModel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const model = req.query.model as string;

    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const integrations: ConfirmedProviderIntegration[] = (settings?.aiIntegrations as any) || [];
    const target = integrations.find(i => i.id === id);

    if (target && target.models.length > 1) {
      target.models = target.models.filter(m => m !== model);
      if (target.activeModel === model) {
        target.activeModel = target.models[0];
      }
      await prisma.userSettings.update({
        where: { userId },
        data: { aiIntegrations: integrations as any },
      });
    }

    res.json({ success: true, integrations: integrations.map(({ apiKeyEncrypted: _, ...r }) => r) });
  } catch (error) {
    next(error);
  }
};