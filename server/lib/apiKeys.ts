import crypto from 'crypto';

export interface GeneratedApiKey {
  plaintextKey: string;
  keyPrefix: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedApiKey {
  // Prefix tc_live_ + 32 random hex bytes (64 chars)
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  const plaintextKey = `tc_live_${randomEntropy}`;
  const keyPrefix = plaintextKey.slice(0, 16); // e.g. tc_live_a1b2c3d4
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