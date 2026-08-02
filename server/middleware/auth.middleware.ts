import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

// Export AuthRequest interface to resolve downstream controller compilation errors
export interface AuthRequest extends Request {
  user?: any;
  auth?: any;
}

export const requireAuth = (req: any, res: Response, next: NextFunction) => {
  // Execute Clerk's official token validation (called with zero arguments to automatically consume environment keys)
  ClerkExpressRequireAuth()(req, res, async (err: any) => {
    if (err) {
      logger.error({ err }, 'Clerk verification failed');
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired Clerk session' });
    }

    try {
      const clerkId = req.auth.userId;
      if (!clerkId) {
        return res.status(401).json({ error: 'Unauthorized: Missing Clerk User ID' });
      }

      // Self-healing check: Fetch user's local database UUID mapping
      let user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, email: true },
      });

      if (!user) {
        logger.info({ clerkId }, 'Clerk user not found in local DB. Performing self-healing syncing...');
        
        // Fetch fallback email from Clerk's session claims
        const email = req.auth.sessionClaims?.email || `user-${clerkId.substring(0, 8)}@clerk.local`;
        const name = req.auth.sessionClaims?.fullName || email.split('@')[0];

        // Perform an upsert to prevent any race conditions during registration
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

      // Populate req.user so that downstream Express controllers continue to work with zero refactoring
      req.user = { id: user.id, email: user.email };
      next();
    } catch (dbErr: any) {
      logger.error({ dbErr }, 'Database verification/syncing during auth failed');
      res.status(500).json({ error: 'Database session validation failed' });
    }
  });
};