import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from './auth.middleware';
import { requireApiKey, requireApiKeyScope, ApiKeyRequest } from './apiKeyAuth.middleware';
import { logger } from '../config/logger';

/**
 * Unified Dual-Authentication Middleware:
 * Accepts EITHER:
 *  1. Programmatic API Key (`Bearer midas_live_...` or `Bearer tc_live_...`), hydrating
 *     both `req.apiUser` and `req.user` so standard controllers & campaign RBAC work seamlessly.
 *  2. Dashboard Clerk Session JWT (delegating to `requireAuth`).
 */
export const requireAuthOrApiKey = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || '';
  const isApiKey =
    authHeader.startsWith('Bearer midas_live_') ||
    authHeader.startsWith('Bearer tc_live_');

  if (isApiKey) {
    return requireApiKey(req, res, async () => {
      try {
        const apiReq = req as ApiKeyRequest;
        const userId = apiReq.apiUser?.id;
        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized: Missing API key identity' });
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, isAdmin: true },
        });

        if (!user) {
          return res.status(401).json({ error: 'Unauthorized: API key owner no longer exists' });
        }

        (req as AuthRequest).user = {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        };

        next();
      } catch (err: any) {
        logger.error({ err: err?.message }, '[DUAL-AUTH] Failed to hydrate API key user');
        res.status(500).json({ error: 'Authentication failure' });
      }
    });
  }

  return requireAuth(req, res, next);
};

/**
 * Enforces an API key scope ONLY when the request authenticated via API key.
 * Clerk browser sessions pass straight through to `requireCampaignRole`.
 */
export const requireScopeIfApiKey = (requiredScope: string) => {
  const scopeGuard = requireApiKeyScope(requiredScope);
  return (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiKeyRequest;
    if (!apiReq.apiUser) {
      return next();
    }
    return scopeGuard(req, res, next);
  };
};