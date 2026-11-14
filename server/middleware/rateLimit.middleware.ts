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

const stores = new Map<string, Map<string, BucketEntry>>();

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

/**
 * Zero-dependency, serverless-safe fixed-window rate limiter.
 * Performs lazy bucket pruning when map size grows past 2,000 entries
 * so no background setInterval timers block Lambda shutdown.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyPrefix = 'rl',
    message = 'Too many requests. Please slow down and try again shortly.',
  } = options;

  if (!stores.has(keyPrefix)) {
    stores.set(keyPrefix, new Map());
  }
  const store = stores.get(keyPrefix)!;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = extractClientIp(req);
    const key = `${keyPrefix}:${ip}`;

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

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: message,
        retryAfterSeconds: retryAfterSec,
      });
    }

    next();
  };
}

/**
 * Caps arbitrary `metadata` JSON payload sizes on public ingestion endpoints
 * to prevent DB bloat or enumeration abuse.
 */
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