import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function requestTimeoutGuard(timeoutMs: number = 15000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow long-running one-time database migration requests to use Vercel's full maxDuration
    if (req.originalUrl.startsWith('/api/admin/migration')) {
      return next();
    }

    const timer = setTimeout(() => {
      if (res.headersSent) return;
      logger.error(
        { method: req.method, path: req.originalUrl, timeoutMs },
        'Request exceeded timeout guard — likely a hung upstream dependency'
      );
      res.status(503).json({
        error: 'This request is taking much longer than expected and has been stopped. Please try again shortly.',
      });
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}