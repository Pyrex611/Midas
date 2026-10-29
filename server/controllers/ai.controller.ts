import { Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';

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

/**
 * POST /api/ai/test
 * Pre-flight test endpoint to test any provider, model, API key, and gateway URL in real-time.
 */
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
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};