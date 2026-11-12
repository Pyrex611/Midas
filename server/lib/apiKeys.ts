import crypto from 'crypto';

export interface GeneratedApiKey {
  plaintextKey: string;
  keyPrefix: string;
  keyHash: string;
}

export function generateApiKey(prefixType: 'midas' | 'tc' = 'midas'): GeneratedApiKey {
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  const plaintextKey = prefixType === 'midas' ? `midas_live_${randomEntropy}` : `tc_live_${randomEntropy}`;
  const keyPrefix = plaintextKey.slice(0, prefixType === 'midas' ? 19 : 16);
  const keyHash = hashApiKey(plaintextKey);

  return {
    plaintextKey,
    keyPrefix,
    keyHash,
  };
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

export function verifyApiKey(candidateKey: string, storedHash: string): boolean {
  if (!candidateKey || !storedHash) return false;
  const candidateHash = hashApiKey(candidateKey);
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');

  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}