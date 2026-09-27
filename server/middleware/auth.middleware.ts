import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
  auth?: any;
}

type CachedUser = { id: string; email: string; isAdmin: boolean };

const CACHE_TTL_MS = 5 * 60 * 1000;
const userCache = new Map<string, { value: CachedUser; expiresAt: number }>();

// Instantiate the Clerk middleware handler once at module scope
const clerkAuthHandler = ClerkExpressRequireAuth();

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Graceful check for unconfigured Clerk environments
  if (!process.env.CLERK_SECRET_KEY) {
    logger.error('[AUTH] CLERK_SECRET_KEY is not configured in environment variables');
    return res.status(500).json({ error: 'Authentication service not configured' });
  }

  clerkAuthHandler(req, res, async (err: any) => {
    if (err) {
      logger.error({ err: err.message || err }, '[AUTH] Clerk token verification failed');
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    try {
      const authReq = req as AuthRequest;
      const clerkId = authReq.auth?.userId;

      if (!clerkId) {
        return res.status(401).json({ error: 'Unauthorized: Missing User Identity' });
      }

      // Check cache for 0ms resolution
      const cached = userCache.get(clerkId);
      if (cached && cached.expiresAt > Date.now()) {
        authReq.user = cached.value;
        return next();
      }

      let user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, email: true, isAdmin: true },
      });

      if (!user) {
        const email = authReq.auth.sessionClaims?.email || `user-${clerkId.substring(0, 8)}@clerk.local`;
        const name = authReq.auth.sessionClaims?.fullName || email.split('@')[0];

        user = await prisma.user.upsert({
          where: { email },
          update: { clerkId },
          create: {
            clerkId,
            email,
            name,
          },
          select: { id: true, email: true, isAdmin: true },
        });
      }

      const resolvedUser: CachedUser = { id: user.id, email: user.email, isAdmin: user.isAdmin };
      userCache.set(clerkId, { value: resolvedUser, expiresAt: Date.now() + CACHE_TTL_MS });

      authReq.user = resolvedUser;
      next();
    } catch (dbErr: any) {
      logger.error({ dbErr: dbErr.message || dbErr }, '[AUTH] Database user sync failed');
      res.status(500).json({ error: 'Database session validation failed' });
    }
  });
};