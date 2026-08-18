import { z } from 'zod';
import dotenv from 'dotenv';

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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MAX_FILE_SIZE_MB: z.string().default('10'),

  ENCRYPTION_KEY: z.string().length(64),
  EMAIL_SERVICE: z.enum(['ethereal', 'smtp', 'mailgun']).default('mailgun'),
  EMAIL_FROM: z.string().default('noreply@outreach.local'),

  // Clerk Authentication Keys
  CLERK_SECRET_KEY: z.string().optional(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // Mailgun Deliverability Infrastructure
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_WEBHOOK_KEY: z.string().optional(),

  // Automation & Cron Infrastructure
  CRON_SECRET: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  BOUNCEBAN_API_KEY: z.string().optional(),

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