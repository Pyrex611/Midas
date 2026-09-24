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

// In-memory cache to map Clerk IDs to local PostgreSQL UUIDs for 0ms middleware lookups.
// TTL'd (5 min) so an admin-flag change (or any other cached field) doesn't
// stay stale indefinitely on a long-lived warm serverless instance.
const CACHE_TTL_MS = 5 * 60 * 1000;
const userCache = new Map<string, { value: CachedUser; expiresAt: number }>();

export const requireAuth = (req: any, res: Response, next: NextFunction) => {
  ClerkExpressRequireAuth()(req, res, async (err: any) => {
    if (err) {
      logger.error({ err }, 'Clerk verification failed');
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    try {
      const clerkId = req.auth?.userId;
      if (!clerkId) {
        return res.status(401).json({ error: 'Unauthorized: Missing User Identity' });
      }

      // Check cache first for 0ms resolution
      const cached = userCache.get(clerkId);
      if (cached && cached.expiresAt > Date.now()) {
        req.user = cached.value;
        return next();
      }

      let user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, email: true, isAdmin: true },
      });

      if (!user) {
        const email = req.auth.sessionClaims?.email || `user-${clerkId.substring(0, 8)}@clerk.local`;
        const name = req.auth.sessionClaims?.fullName || email.split('@')[0];

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

      req.user = resolvedUser;
      next();
    } catch (dbErr: any) {
      logger.error({ dbErr }, 'Database session resolution failed');
      res.status(500).json({ error: 'Database session validation failed' });
    }
  });
};
