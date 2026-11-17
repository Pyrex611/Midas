import crypto from 'crypto';
import { logger } from '../config/logger';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Ephemeral fallback ONLY for local development — production refuses to trust
// static public secrets and disables passphrase unlock unless explicitly configured.
const DEV_EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string | null {
  const configured = process.env.ENCRYPTION_KEY || process.env.CRON_SECRET;
  if (configured && configured.trim().length >= 16) {
    return configured.trim();
  }
  if (IS_PRODUCTION) {
    return null;
  }
  return DEV_EPHEMERAL_SECRET;
}

function getConfiguredPassphrase(): string | null {
  const configured = process.env.OPERATOR_PASSPHRASE || process.env.ADMIN_PASSPHRASE;
  if (configured && configured.trim().length >= 12) {
    return configured.trim();
  }
  if (IS_PRODUCTION) {
    return null;
  }
  logger.warn('[OPERATOR-AUTH] OPERATOR_PASSPHRASE not set in non-production environment — passphrase unlock disabled until configured.');
  return null;
}

export interface OperatorTokenPayload {
  role: 'operator_admin';
  issuedAt: number;
  nonce: string;
}

function safeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyMasterPassphrase(candidate: string): boolean {
  if (!candidate || typeof candidate !== 'string') return false;
  const master = getConfiguredPassphrase();
  if (!master) return false;
  return safeCompare(candidate.trim(), master);
}

export function generateOperatorToken(): { token: string; expiresAt: number } {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error('Operator signing secret unavailable: set ENCRYPTION_KEY or CRON_SECRET.');
  }

  const issuedAt = Date.now();
  const expiresAt = issuedAt + 60 * 60 * 1000;
  const payload: OperatorTokenPayload = {
    role: 'operator_admin',
    issuedAt,
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(serialized)
    .digest('base64url');

  return {
    token: `${serialized}.${signature}`,
    expiresAt,
  };
}

export function verifyOperatorToken(token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const secret = getSigningSecret();
  if (!secret) return false;

  try {
    const [serialized, signature] = token.split('.');
    if (!serialized || !signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(serialized)
      .digest('base64url');

    if (!safeCompare(signature, expectedSignature)) return false;

    const payload: OperatorTokenPayload = JSON.parse(
      Buffer.from(serialized, 'base64url').toString('utf8')
    );

    const age = Date.now() - payload.issuedAt;
    if (age > 60 * 60 * 1000 || age < 0) {
      return false;
    }

    return payload.role === 'operator_admin';
  } catch {
    return false;
  }
}