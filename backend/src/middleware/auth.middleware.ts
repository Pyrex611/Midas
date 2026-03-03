import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../config/logger';

export interface AuthRequest extends Request {
  user?: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user;
    next();
  } catch (error) {
    logger.error({ error }, 'Auth middleware error');
    res.status(500).json({ error: 'Authentication failed' });
  }
};