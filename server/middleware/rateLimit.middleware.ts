import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

const memoryStores = new Map<string, Map<string, BucketEntry>>();

function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0].split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

async function checkUpstashRateLimit(key: string, windowMs: number, max: number): Promise<{ count: number; ttlMs: number } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const cleanBase = url.replace(/\/$/, '');
    const res = await fetch(`${cleanBase}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['PTTL', key],
      ]),
      signal: AbortSignal.timeout(1_500),
    });

    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ result: number }>;
    const count = Number(results?.[0]?.result || 1);
    let ttlMs = Number(results?.[1]?.result ?? -1);

    if (ttlMs < 0) {
      await fetch(`${cleanBase}/pexpire/${encodeURIComponent(key)}/${windowMs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(1_000),
      }).catch(() => {});
      ttlMs = windowMs;
    }

    return { count, ttlMs };
  } catch {
    return null;
  }
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyPrefix = 'rl',
    message = 'Too many requests. Please slow down and try again shortly.',
  } = options;

  if (!memoryStores.has(keyPrefix)) {
    memoryStores.set(keyPrefix, new Map());
  }
  const store = memoryStores.get(keyPrefix)!;

  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = extractClientIp(req);
    const key = `midas:${keyPrefix}:${ip}`;

    const upstash = await checkUpstashRateLimit(key, windowMs, max);

    let count: number;
    let resetEpochSec: number;
    let retryAfterSec: number;

    if (upstash) {
      count = upstash.count;
      retryAfterSec = Math.max(1, Math.ceil(upstash.ttlMs / 1000));
      resetEpochSec = Math.ceil((now + upstash.ttlMs) / 1000);
    } else {
      if (store.size > 2000) {
        for (const [k, entry] of store.entries()) {
          if (entry.resetAt <= now) store.delete(k);
        }
      }
      let entry = store.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 1, resetAt: now + windowMs };
        store.set(key, entry);
      } else {
        entry.count += 1;
      }
      count = entry.count;
      retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      resetEpochSec = Math.ceil(entry.resetAt / 1000);
    }

    const remaining = Math.max(0, max - count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetEpochSec));

    if (count > max) {
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: message, retryAfterSeconds: retryAfterSec });
    }

    next();
  };
}

export function limitMetadataSize(maxBytes: number = 16384) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.metadata !== undefined && req.body.metadata !== null) {
      try {
        const serialized = JSON.stringify(req.body.metadata);
        if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
          return res.status(413).json({
            error: `Metadata payload exceeds maximum allowed size (${maxBytes} bytes).`,
          });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid metadata JSON structure' });
      }
    }
    next();
  };
}