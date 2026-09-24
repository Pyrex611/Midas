import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
}
