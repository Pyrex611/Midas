import { z } from 'zod';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Sanitize connection URL for Neon's HTTP SQL Gateway (stripping -pooler and TCP parameters)
const rawDatabaseUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || '';

if (rawDatabaseUrl) {
  let cleanUrl = rawDatabaseUrl.replace(/-pooler(\.[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech)/gi, '$1');
  cleanUrl = cleanUrl.replace(/&?channel_binding=[^&]*/g, '');
  cleanUrl = cleanUrl.replace(/&?pgbouncer=[^&]*/g, '');
  cleanUrl = cleanUrl.replace(/&?connection_limit=[^&]*/g, '');
  cleanUrl = cleanUrl.replace(/\?&/, '?').replace(/\?$/, '').trim();

  process.env.DATABASE_URL = cleanUrl;
}

// SECURITY + AVAILABILITY NOTE on CRON_SECRET / ENCRYPTION_KEY:
// These previously had a hardcoded fallback value baked into source (a real
// vulnerability — a static secret anyone reading the repo could use). The
// fix for that must NOT be "require it globally or crash the whole app" —
// that trades one outage-class bug for another: a single missing/short env
// var would then take down every unrelated API route, not just the feature
// that actually needs it (this happened in practice — see cronAuth
// middleware's comment for the concrete incident). So: no hardcoded
// default, ever, but no global fatal requirement either. Each var is
// validated ONLY at its actual point of use:
//   - CRON_SECRET: checked in server/middleware/cronAuth.middleware.ts —
//     if unset, cron endpoints alone return 500, nothing else is affected.
//   - ENCRYPTION_KEY: currently unused anywhere in the codebase; validate
//     it at whichever call site first actually starts using it, not here.
// In development only, a random ephemeral CRON_SECRET is generated at boot
// (logged clearly) purely so `npm run dev` works without any setup.
if (process.env.NODE_ENV !== 'production' && !process.env.CRON_SECRET) {
  process.env.CRON_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn(
    '[env] CRON_SECRET is not set — generated a temporary development-only value ' +
    '(changes every restart). Set it explicitly before deploying: openssl rand -hex 32'
  );
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173,https://midas-aem.vercel.app'),
  // Only vercel.app preview URLs starting with this prefix are trusted for
  // credentialed CORS requests (e.g. "midas-aem" matches
  // "midas-aem-git-feature-yourteam.vercel.app"). Prevents any unrelated
  // *.vercel.app deployment from making authenticated cross-origin calls.
  CORS_VERCEL_PROJECT_PREFIX: z.string().default('midas-aem'),
  MAX_FILE_SIZE_MB: z.string().default('10'),

  // No hardcoded default, and NOT hard-required here — see note above.
  // Nothing in this codebase currently reads it; kept for forward
  // compatibility with per-tenant credential encryption (see Phase 3 notes).
  ENCRYPTION_KEY: z.string().optional(),
  EMAIL_SERVICE: z.enum(['ethereal', 'smtp', 'mailgun']).default('mailgun'),
  EMAIL_FROM: z.string().default('noreply@outreach.local'),

  // Clerk Authentication Keys
  CLERK_SECRET_KEY: z.string().optional(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // Mailgun Deliverability Infrastructure
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_WEBHOOK_KEY: z.string().optional(),
  // 'us' (default, api.mailgun.net) or 'eu' (api.eu.mailgun.net) — Mailgun
  // accounts are region-locked at signup and the wrong base URL fails silently.
  MAILGUN_REGION: z.enum(['us', 'eu']).default('us'),

  // Automation & Cron Infrastructure. No hardcoded default (a known static
  // secret is a real vulnerability) and NOT hard-required at this global
  // level (a missing value here must only disable cron endpoints, not the
  // whole app) — enforced instead in server/middleware/cronAuth.middleware.ts.
  CRON_SECRET: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // --- Optional Upstash QStash signature verification (see docs/QSTASH_SETUP.md) ---
  // Both optional and safe to leave unset: cronAuth.middleware.ts falls back
  // to the CRON_SECRET bearer check, and the @upstash/qstash import used to
  // check these is loaded lazily/defensively so a missing dependency or
  // unset keys never affect any other route.
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

  // --- Modular email verification (see server/services/verification) ---
  // 'mock' (default — no real vendor call, used until a provider key exists),
  // 'bounceban' | 'neverbounce' | 'zerobounce'. Adding a new vendor only
  // requires a new provider file + an entry in this enum + its own API key var.
  VERIFICATION_PROVIDER: z.enum(['mock', 'bounceban', 'neverbounce', 'zerobounce']).default('mock'),
  BOUNCEBAN_API_KEY: z.string().optional(),
  NEVERBOUNCE_API_KEY: z.string().optional(),
  ZEROBOUNCE_API_KEY: z.string().optional(),

  // AI Provider Credentials
  AI_PROVIDER: z.enum(['mock', 'openai', 'gemini', 'ollama', 'deepseek', 'openrouter']).default('mock'),
  PRIMARY_FALLBACK_PROVIDER: z.enum(['mock', 'openai', 'gemini', 'ollama', 'deepseek', 'openrouter']).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash-lite'),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('deepseek/deepseek-r1:free'),
  OLLAMA_URL: z.string().default('http://localhost:11434'),
  OLLAMA_FAST_MODEL: z.string().default('llama3.2:1b'),
  OLLAMA_POWERFUL_MODEL: z.string().default('llama3.1:8b'),

  AI_REQUEST_DELAY_MS: z.string().default('500').transform(Number),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

// Post-parse, scoped warnings (never fatal) for vars that are optional at
// the schema level but should really be set before relying on the feature
// that needs them.
if (env.NODE_ENV === 'production' && (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32)) {
  console.warn(
    '[env] CRON_SECRET is unset or shorter than 32 chars — /api/cron/* endpoints will refuse ' +
    'all requests until it is set (generate one with: openssl rand -hex 32). Nothing else is affected.'
  );
}
