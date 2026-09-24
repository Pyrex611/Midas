import crypto from 'crypto';
import { logger } from '../config/logger';

const ALGORITHM = 'aes-256-gcm';

/**
 * Was dead code before Phase 3 (defined, never imported anywhere). Now used
 * by domain.service.ts to store a per-tenant Mailgun API key at rest, for
 * users who bring their own Mailgun account instead of sharing the
 * platform's (see "Bring your own Mailgun key" in domain.service.ts).
 *
 * Requires ENCRYPTION_KEY (a 64-char hex string = 32 bytes) to be set.
 * Unlike CRON_SECRET, this is checked lazily here — at the point of actual
 * use — rather than globally in env.ts, so an unset key only breaks the
 * BYO-Mailgun-key feature specifically, not the whole app (see env.ts's
 * comment on why global hard-requirements for optional features are
 * dangerous).
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 64) {
    throw new Error(
      'ENCRYPTION_KEY is not set (or too short) — required to store a per-domain Mailgun key. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  return Buffer.from(raw.slice(0, 64), 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // ivHex:authTagHex:ciphertextHex — self-contained, no separate storage needed.
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) throw new Error('Malformed encrypted payload');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Returns null instead of throwing — for read paths where a missing/bad key should degrade, not crash. */
export function tryDecrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decrypt(payload);
  } catch (error) {
    logger.error({ error }, 'Failed to decrypt stored value — ENCRYPTION_KEY may have changed');
    return null;
  }
}
