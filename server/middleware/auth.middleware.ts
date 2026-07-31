import { Request, Response, NextFunction } from 'express';
import { getSession } from '@auth/express';
import { authConfig } from '../lib/auth';

export interface AuthRequest extends Request {
  user?: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await getSession(req, authConfig);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = session.user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};