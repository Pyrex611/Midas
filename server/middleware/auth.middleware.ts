import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  auth?: any;
}

// In-memory cache to map Clerk IDs to local PostgreSQL UUIDs without blocking DB queries
const userCache = new Map<string, { id: string; email: string }>();

export const requireAuth = (req: any, res: Response, next: NextFunction) => {
  ClerkExpressRequireAuth()(req, res, async (err: any) => {
    if (err) {
      logger.error({ err }, 'Clerk authentication failed');
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    try {
      const clerkId = req.auth?.userId;
      if (!clerkId) {
        return res.status(401).json({ error: 'Unauthorized: Missing User Identity' });
      }

      // Check in-memory cache first for fast 0ms resolution
      if (userCache.has(clerkId)) {
        req.user = userCache.get(clerkId)!;
        return next();
      }

      // Retrieve or create user record
      let user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, email: true },
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
          select: { id: true, email: true },
        });
      }

      // Cache the result in-memory
      const resolvedUser = { id: user.id, email: user.email };
      userCache.set(clerkId, resolvedUser);

      req.user = resolvedUser;
      next();
    } catch (dbErr: any) {
      logger.error({ dbErr }, 'Database session resolution failed');
      res.status(500).json({ error: 'Database session validation failed' });
    }
  });
};