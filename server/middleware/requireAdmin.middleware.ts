import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { verifyOperatorToken } from '../lib/operatorAuth';

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  // 1. Check database user role
  if (req.user?.isAdmin) {
    return next();
  }

  // 2. Check cryptographic operator token header
  const operatorToken = req.headers['x-operator-token'] as string | undefined;
  if (operatorToken && verifyOperatorToken(operatorToken)) {
    return next();
  }

  // 3. Reject with clear clearance requirement
  return res.status(403).json({
    error: 'Operator clearance required. Provide a valid operator token or submit master passphrase.',
    requiresClearance: true,
  });
}