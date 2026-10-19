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
    const optimized = await aiService.complete(prompt, system);

    const cleaned = optimized.replace(/^["']|["']$/g, '').trim();

    res.json({ optimized: cleaned });
  } catch (error) {
    logger.error({ error }, 'Failed to optimize campaign context');
    next(error);
  }
};