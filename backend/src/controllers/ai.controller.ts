import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';

export const optimizeContext = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { context } = req.body;
    if (!context || typeof context !== 'string' || context.length < 5) {
      return res.status(400).json({ error: 'Please provide a more detailed context to optimize.' });
    }

    // This prompt forces the AI to analyze the "Who, What, Why" of the user's goal
    const prompt = `You are an elite Sales Strategy Consultant. 
    Take the following raw campaign context and transform it into a high-fidelity "SDR Context Brief" that will be used by an AI to write cold emails.
    
    ORIGINAL CONTEXT: "${context}"

    YOUR TASK:
    1. Identify the core Value Proposition.
    2. Identify the specific Pain Point being solved.
    3. Specify the Target Persona's likely goals.
    4. Rewrite the context to be descriptive, professional, and analytical.
    
    RULES:
    - Return ONLY the optimized text. 
    - Do not include headers like "Optimized Context:".
    - Do not include conversational filler.
    - Max 150 words.
    - Focus on results and outcomes.`;

    const system = 'You are a Senior SDR Manager. Output only the refined strategy text.';
    const optimized = await aiService.complete(prompt, system);

    // Clean up any stray quotes the AI might return
    const cleaned = optimized.replace(/^["']|["']$/g, '').trim();

    res.json({ optimized: cleaned });
  } catch (error) {
    logger.error({ error }, 'Failed to optimize context');
    next(error);
  }
};