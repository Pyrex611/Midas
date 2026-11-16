import { z } from 'zod';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

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
  CORS_VERCEL_PROJECT_PREFIX: z.string().default('midas-aem'),
  MAX_FILE_SIZE_MB: z.string().default('10'),
  ENCRYPTION_KEY: z.string().optional(),
  EMAIL_SERVICE: z.enum(['ethereal', 'smtp', 'mailgun']).default('mailgun'),
  EMAIL_FROM: z.string().default('midas-aem.vercel.app'),
  APP_URL: z.string().url().optional(),

  // Authentication Mode ('clerk' | 'supabase' | 'dual')
  AUTH_PROVIDER: z.enum(['clerk', 'supabase', 'dual']).default('dual'),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // Supabase Infrastructure
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('midas-uploads'),
  STORAGE_PROVIDER: z.enum(['auto', 'supabase', 'vercel_blob']).default('auto'),

  // Dodo Payments
  DODO_PAYMENTS_API_KEY: z.string().optional(),
  DODO_PAYMENTS_WEBHOOK_SECRET: z.string().optional(),
  DODO_PAYMENTS_MODE: z.enum(['test_mode', 'live_mode']).default('test_mode'),
  DODO_PRODUCT_CHIEF_MONTHLY: z.string().optional(),
  DODO_PRODUCT_CHIEF_ANNUAL: z.string().optional(),
  DODO_PRODUCT_SYNDICATE_MONTHLY: z.string().optional(),
  DODO_PRODUCT_SYNDICATE_ANNUAL: z.string().optional(),

  // ESP Webhooks & Credentials
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_WEBHOOK_KEY: z.string().optional(),
  MAILGUN_REGION: z.enum(['us', 'eu']).default('us'),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  // Upstash Redis REST
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Zero-Setup Sandbox Mode
  SANDBOX_DOMAIN: z.string().optional(),
  SANDBOX_MAILGUN_KEY: z.string().optional(),
  SANDBOX_REGION: z.enum(['us', 'eu']).default('us'),
  SANDBOX_DAILY_LIMIT: z.string().default('15').transform((v) => Math.max(1, Number(v) || 15)),

  // Cloudflare for SaaS Tracking Custom Hostnames
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  CLOUDFLARE_SAAS_FALLBACK_ORIGIN: z.string().optional(),

  // Automation & Cron Infrastructure
  CRON_SECRET: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Send Rate Safety Guards
  SEND_SWEEP_BATCH_SIZE: z.string().default('5').transform((v) => Math.min(Math.max(1, Number(v) || 5), 10)),
  SENDER_COOLDOWN_SECONDS: z.string().default('20').transform((v) => Math.max(5, Number(v) || 20)),

  // Optional Upstash QStash signature verification
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

  // Modular email verification
  VERIFICATION_PROVIDER: z.enum(['mock', 'bounceban', 'neverbounce', 'zerobounce']).default('mock'),
  BOUNCEBAN_API_KEY: z.string().optional(),
  NEVERBOUNCE_API_KEY: z.string().optional(),
  ZEROBOUNCE_API_KEY: z.string().optional(),

  // AI Provider Credentials
  AI_PROVIDER: z.enum(['mock', 'openai', 'gemini', 'ollama', 'deepseek', 'openrouter', 'aigateway']).default('aigateway'),
  PRIMARY_FALLBACK_PROVIDER: z.enum(['mock', 'openai', 'gemini', 'ollama', 'deepseek', 'openrouter', 'aigateway']).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('deepseek/deepseek-chat'),
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_GATEWAY_KEY: z.string().optional(),
  AI_GATEWAY_URL: z.string().default('https://ai-gateway.vercel.sh/v1'),
  AI_GATEWAY_MODEL: z.string().default('openai/gpt-4o-mini'),
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