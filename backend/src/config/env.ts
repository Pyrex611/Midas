import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MAX_FILE_SIZE_MB: z.string().default('10'),

  // Email service selector
  EMAIL_SERVICE: z.enum(['ethereal', 'smtp']).default('ethereal'),

  // SMTP settings (required if EMAIL_SERVICE=smtp)
  EMAIL_FROM: z.string().default('noreply@outreach.local'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.enum(['true', 'false']).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // AI Provider
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

  // IMAP settings
  IMAP_HOST: z.string(),
  IMAP_PORT: z.string().transform(Number),
  IMAP_USER: z.string(),
  IMAP_PASS: z.string(),
  IMAP_TLS: z.enum(['true', 'false']).default('true'),
  IMAP_MAILBOX: z.string().default('INBOX'),
  IMAP_POLL_INTERVAL: z.string().default('300000').transform(Number),
  IMAP_CONN_TIMEOUT: z.string().default('30000').transform(Number),
  
  AI_REQUEST_DELAY_MS: z.string().default('500').transform(Number),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;