import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

interface CachedResponse {
  inFlight: boolean;
  statusCode?: number;
  body?: any;
  expiresAt: number;
}

const localCache = new Map<string, CachedResponse>();
const TTL_MS = 5 * 60 * 1000;

/**
 * Prevents duplicate entity creation when a client retries after a transient
 * 503 timeout guard or double-click. Triggered when `Idempotency-Key` header is sent.
 */
export function idempotencyGuard() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const rawKey = req.headers['idempotency-key'] as string | undefined;
    if (!rawKey || !rawKey.trim()) {
      return next();
    }

    const userId = req.user?.id || 'anon';
    const cacheKey = `${userId}:${req.method}:${req.baseUrl}${req.path}:${rawKey.trim()}`;
    const now = Date.now();

    if (localCache.size > 1000) {
      for (const [k, v] of localCache.entries()) {
        if (v.expiresAt <= now) localCache.delete(k);
      }
    }

    const existing = localCache.get(cacheKey);
    if (existing && existing.expiresAt > now) {
      if (existing.inFlight) {
        return res.status(409).json({
          error: 'An identical request with this Idempotency-Key is currently in progress.',
        });
      }
      if (existing.statusCode && existing.body !== undefined) {
        res.setHeader('X-Idempotent-Replay', 'true');
        return res.status(existing.statusCode).json(existing.body);
      }
    }

    localCache.set(cacheKey, { inFlight: true, expiresAt: now + TTL_MS });

    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode < 500) {
        localCache.set(cacheKey, {
          inFlight: false,
          statusCode: res.statusCode,
          body,
          expiresAt: Date.now() + TTL_MS,
        });
      } else {
        localCache.delete(cacheKey);
      }
      return originalJson(body);
    };

    res.on('close', () => {
      const current = localCache.get(cacheKey);
      if (current?.inFlight) localCache.delete(cacheKey);
    });

    next();
  };
}