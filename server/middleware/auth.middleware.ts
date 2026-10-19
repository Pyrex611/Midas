import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth, clerkClient } from '@clerk/clerk-sdk-node';
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

const cleanKey = (key?: string) => (key ? key.trim().replace(/^["']|["']$/g, '') : '');

// 1. Resolve publishable key from any configured environment variable name
const resolvedPublishableKey = cleanKey(
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

// 2. Synchronize to process.env.CLERK_PUBLISHABLE_KEY where @clerk/clerk-sdk-node expects it.
// ClerkMiddlewareOptions does NOT accept publishableKey in its options object.
if (resolvedPublishableKey) {
  process.env.CLERK_PUBLISHABLE_KEY = resolvedPublishableKey;
}

// 3. Resolve and sanitize secret key
const resolvedSecretKey = cleanKey(process.env.CLERK_SECRET_KEY);
if (resolvedSecretKey) {
  process.env.CLERK_SECRET_KEY = resolvedSecretKey;
}

// 4. Instantiate ClerkExpressRequireAuth with valid ClerkMiddlewareOptions (only accepts secretKey, jwtKey, etc.)
const clerkAuthHandler = ClerkExpressRequireAuth(
  resolvedSecretKey ? { secretKey: resolvedSecretKey } : {}
);

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.CLERK_SECRET_KEY && !resolvedSecretKey) {
    logger.error('[AUTH] CLERK_SECRET_KEY is missing from environment variables');
    return res.status(500).json({ error: 'Authentication service not configured (missing secret key)' });
  }

  if (!process.env.CLERK_PUBLISHABLE_KEY && !resolvedPublishableKey) {
    logger.error('[AUTH] CLERK_PUBLISHABLE_KEY / VITE_CLERK_PUBLISHABLE_KEY is missing from environment variables');
    return res.status(500).json({ error: 'Authentication service not configured (missing publishable key)' });
  }

  clerkAuthHandler(req, res, async (err: any) => {
    if (err) {
      logger.error({ err: err?.message || err }, '[AUTH] Clerk token verification failed');
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
        let email = authReq.auth.sessionClaims?.email;
        let name = authReq.auth.sessionClaims?.fullName;

        // Fallback: If session JWT doesn't contain email claims, fetch directly from Clerk Backend API
        if (!email) {
          try {
            const clerkUser = await clerkClient.users.getUser(clerkId);
            email =
              clerkUser.emailAddresses?.find((e: any) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
              clerkUser.emailAddresses?.[0]?.emailAddress;
            name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username;
          } catch (fetchErr) {
            logger.warn({ fetchErr }, '[AUTH] Could not fetch user profile from Clerk API, using fallback email');
          }
        }

        if (!email) {
          email = `user-${clerkId.substring(0, 8)}@clerk.local`;
        }
        if (!name) {
          name = email.split('@')[0];
        }

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
      logger.error({ dbErr: dbErr?.message || dbErr }, '[AUTH] Database session validation failed');
      res.status(500).json({ error: 'Database session validation failed' });
    }
  });
};