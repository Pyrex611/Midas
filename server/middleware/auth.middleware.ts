import 'dotenv/config';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth, clerkClient } from '@clerk/clerk-sdk-node';
import prisma from '../lib/prisma';
import { env } from '../config/env';
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

const CACHE_TTL_MS = 3 * 60 * 1000;
const userCache = new Map<string, { value: CachedUser; expiresAt: number }>();

const cleanKey = (key?: string) => (key ? key.trim().replace(/^["']|["']$/g, '') : '');

const resolvedPublishableKey = cleanKey(
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);
if (resolvedPublishableKey && !process.env.CLERK_PUBLISHABLE_KEY) {
  process.env.CLERK_PUBLISHABLE_KEY = resolvedPublishableKey;
}

const resolvedSecretKey = cleanKey(process.env.CLERK_SECRET_KEY);
if (resolvedSecretKey && !process.env.CLERK_SECRET_KEY) {
  process.env.CLERK_SECRET_KEY = resolvedSecretKey;
}

let clerkHandlerInstance: any = null;
function getClerkHandler() {
  if (!clerkHandlerInstance) {
    clerkHandlerInstance = ClerkExpressRequireAuth();
  }
  return clerkHandlerInstance;
}

function decodeJwtIssuer(token: string): string {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return String(payload.iss || '').toLowerCase();
  } catch {
    return '';
  }
}

async function authenticateSupabaseToken(token: string, req: Request, res: Response, next: NextFunction) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase Auth is not configured on this server' });
  }

  const tokenKey = `sb:${crypto.createHash('sha256').update(token).digest('hex').slice(0, 24)}`;
  const cached = userCache.get(tokenKey);
  if (cached && cached.expiresAt > Date.now()) {
    (req as AuthRequest).user = cached.value;
    return next();
  }

  try {
    const supaRes = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!supaRes.ok) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired Supabase session' });
    }

    const supaUser: any = await supaRes.json();
    const sbId = supaUser?.id;
    const email = supaUser?.email ? String(supaUser.email).toLowerCase().trim() : null;
    if (!sbId || !email) {
      return res.status(401).json({ error: 'Unauthorized: Supabase identity missing email' });
    }

    const displayName =
      supaUser?.user_metadata?.full_name ||
      supaUser?.user_metadata?.name ||
      email.split('@')[0];

    let user = await prisma.user.findUnique({
      where: { supabaseAuthId: sbId },
      select: { id: true, email: true, isAdmin: true },
    });

    if (!user) {
      user = await prisma.user.upsert({
        where: { email },
        update: { supabaseAuthId: sbId },
        create: {
          supabaseAuthId: sbId,
          email,
          name: displayName,
        },
        select: { id: true, email: true, isAdmin: true },
      });
    }

    const resolved: CachedUser = { id: user.id, email: user.email, isAdmin: user.isAdmin };
    userCache.set(tokenKey, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });

    (req as AuthRequest).user = resolved;
    next();
  } catch (err: any) {
    logger.error({ err: err?.message }, '[AUTH] Supabase session validation failed');
    return res.status(500).json({ error: 'Authentication verification failed' });
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const mode = env.AUTH_PROVIDER || 'dual';
  const issuer = bearerToken ? decodeJwtIssuer(bearerToken) : '';
  const looksLikeSupabase =
    mode === 'supabase' ||
    (mode === 'dual' && issuer.includes('supabase'));

  if (looksLikeSupabase && bearerToken) {
    return authenticateSupabaseToken(bearerToken, req, res, next);
  }

  if (mode === 'supabase') {
    return res.status(401).json({ error: 'Unauthorized: Missing Supabase Bearer token' });
  }

  if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    logger.error('[AUTH] Clerk keys missing while handling Clerk auth request');
    return res.status(500).json({ error: 'Authentication service not configured' });
  }

  getClerkHandler()(req, res, async (err: any) => {
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

      const cacheKey = `clerk:${clerkId}`;
      const cached = userCache.get(cacheKey);
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

        if (!email) {
          try {
            const clerkUser = await clerkClient.users.getUser(clerkId);
            email =
              clerkUser.emailAddresses?.find((e: any) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
              clerkUser.emailAddresses?.[0]?.emailAddress;
            name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username;
          } catch {}
        }

        if (!email) email = `user-${clerkId.substring(0, 8)}@clerk.local`;
        if (!name) name = email.split('@')[0];

        user = await prisma.user.upsert({
          where: { email: email.toLowerCase().trim() },
          update: { clerkId },
          create: { clerkId, email: email.toLowerCase().trim(), name },
          select: { id: true, email: true, isAdmin: true },
        });
      }

      const resolvedUser: CachedUser = { id: user.id, email: user.email, isAdmin: user.isAdmin };
      userCache.set(cacheKey, { value: resolvedUser, expiresAt: Date.now() + CACHE_TTL_MS });

      authReq.user = resolvedUser;
      next();
    } catch (dbErr: any) {
      logger.error({ dbErr: dbErr?.message || dbErr }, '[AUTH] Database session validation failed');
      res.status(500).json({ error: 'Database session validation failed' });
    }
  });
};