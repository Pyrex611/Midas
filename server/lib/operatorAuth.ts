import crypto from 'crypto';

const SIGNING_SECRET = process.env.ENCRYPTION_KEY || process.env.CRON_SECRET || 'midas_operator_secret_32_chars_min';
const MASTER_PASSPHRASE = process.env.OPERATOR_PASSPHRASE || process.env.ADMIN_PASSPHRASE || 'midas_operator_2026';

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
  return safeCompare(candidate.trim(), MASTER_PASSPHRASE.trim());
}

export function generateOperatorToken(): { token: string; expiresAt: number } {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 60 * 60 * 1000; // 60 minutes
  const payload: OperatorTokenPayload = {
    role: 'operator_admin',
    issuedAt,
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(serialized)
    .digest('base64url');

  return {
    token: `${serialized}.${signature}`,
    expiresAt,
  };
}

export function verifyOperatorToken(token?: string): boolean {
  if (!token || typeof token !== 'string') return false;

  try {
    const [serialized, signature] = token.split('.');
    if (!serialized || !signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(serialized)
      .digest('base64url');

    if (!safeCompare(signature, expectedSignature)) return false;

    const payload: OperatorTokenPayload = JSON.parse(
      Buffer.from(serialized, 'base64url').toString('utf8')
    );

    // Hard ceiling: token cannot be older than 60 minutes
    const age = Date.now() - payload.issuedAt;
    if (age > 60 * 60 * 1000 || age < 0) {
      return false;
    }

    return payload.role === 'operator_admin';
  } catch {
    return false;
  }
}