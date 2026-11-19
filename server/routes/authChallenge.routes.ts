import { Router, Request, Response } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.middleware';
import { authEmailHookService } from '../services/authEmailHook.service';
import { logger } from '../config/logger';

const router = Router();

const authChallengeIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  keyPrefix: 'auth_chal_ip',
  message: 'Too many authentication attempts from this network. Please wait a few minutes.',
});

// Per-email soft budget (generous for real users, blocks spam loops)
const emailWindowCache = new Map<string, { count: number; lastSentAt: number; resetAt: number }>();

function checkEmailBudget(cleanEmail: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  if (emailWindowCache.size > 2000) {
    for (const [k, v] of emailWindowCache.entries()) {
      if (v.resetAt <= now) emailWindowCache.delete(k);
    }
  }

  let entry = emailWindowCache.get(cleanEmail);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, lastSentAt: now, resetAt: now + 10 * 60 * 1000 };
    emailWindowCache.set(cleanEmail, entry);
    return { allowed: true };
  }

  if (now - entry.lastSentAt < 10_000) {
    return { allowed: false, retryAfterSec: Math.ceil((10_000 - (now - entry.lastSentAt)) / 1000) };
  }

  if (entry.count >= 8) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  entry.lastSentAt = now;
  return { allowed: true };
}

/**
 * POST /api/auth/send-challenge
 * Bypasses Supabase's 2/hr built-in email limit by generating tokens via
 * Admin generate_link and dispatching directly through MIDAS's ESP router.
 */
router.post('/send-challenge', authChallengeIpLimiter, async (req: Request, res: Response) => {
  try {
    const { email, deliveryType = 'code', name } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const budget = checkEmailBudget(cleanEmail);
    if (!budget.allowed) {
      return res.status(429).json({
        error: `Please wait ${budget.retryAfterSec}s before requesting another authentication email.`,
      });
    }

    if (!authEmailHookService.isAdminServiceConfigured()) {
      return res.status(501).json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on backend',
        fallbackToClientOtp: true,
      });
    }

    await authEmailHookService.generateAndDispatchChallenge({
      email: cleanEmail,
      deliveryType: deliveryType === 'link' ? 'link' : 'code',
      name: typeof name === 'string' ? name.trim() : undefined,
    });

    res.status(200).json({
      success: true,
      deliveryType: deliveryType === 'link' ? 'link' : 'code',
      message:
        deliveryType === 'link'
          ? `Sign-in link sent to ${cleanEmail}`
          : `6-digit verification code sent to ${cleanEmail}`,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, '[AUTH-CHALLENGE] Failed to send challenge');
    res.status(400).json({ error: err?.message || 'Could not dispatch authentication email' });
  }
});

/**
 * POST /api/auth/register-password
 * Registers a brand-new password user via Supabase Admin API without triggering
 * Supabase's 2/hr SMTP limit, then sends the 6-digit verification code via MIDAS.
 */
router.post('/register-password', authChallengeIpLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const budget = checkEmailBudget(cleanEmail);
    if (!budget.allowed) {
      return res.status(429).json({
        error: `Please wait ${budget.retryAfterSec}s before retrying.`,
      });
    }

    if (!authEmailHookService.isAdminServiceConfigured()) {
      return res.status(501).json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on backend',
        fallbackToClientOtp: true,
      });
    }

    await authEmailHookService.registerPasswordAndSendCode({
      email: cleanEmail,
      password,
      name: typeof name === 'string' ? name.trim() : undefined,
    });

    res.status(201).json({
      success: true,
      needsConfirmation: true,
      message: `Account created. Enter the 6-digit code sent to ${cleanEmail}.`,
    });
  } catch (err: any) {
    const status = err?.statusCode === 409 ? 409 : 400;
    logger.error({ err: err?.message }, '[AUTH-REGISTER] Password signup failed');
    res.status(status).json({ error: err?.message || 'Registration failed' });
  }
});

export default router;