import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * POST /api/ai/optimize-context
 * Optimize a campaign context string using AI.
 */
export const optimizeContext = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { context } = req.body;
    if (!context || typeof context !== 'string') {
      return res.status(400).json({ error: 'Context string required' });
    }

    const prompt = `You are an expert sales copywriter and strategist. The following is a user‑provided campaign context for a cold email outreach. Please refine and expand it to be more specific, compelling, and likely to generate high‑quality emails. Return only the optimized context as plain text, no extra commentary. Original context: "${context}"`;

    const system = 'You are an expert copywriter. Output only the optimized text.';
    const optimized = await aiService.complete(prompt, system);

    // Trim and clean
    const cleaned = optimized.replace(/^["']|["']$/g, '').trim();

    res.json({ optimized: cleaned });
  } catch (error) {
    logger.error({ error }, 'Failed to optimize context');
    next(error);
  }
};