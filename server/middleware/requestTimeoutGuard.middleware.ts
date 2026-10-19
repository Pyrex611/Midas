import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Wraps every request in a timeout. If a handler hasn't responded within
 * `timeoutMs`, the client gets a fast, clear 503 instead of hanging until
 * Vercel's own hard limit (300s on most plans) kills the function with no
 * useful signal to the frontend or to us in the logs.
 *
 * This does NOT cancel the underlying work (Node/Prisma don't give us a
 * clean way to abort an in-flight fetch from here), so on a genuine
 * hang the serverless invocation still runs to Vercel's limit in the
 * background — but the PERSON sees an error in ~15s instead of a spinner
 * for 5 minutes, and the log line below tells us exactly which route and
 * how long it had been running, instead of the previous silent cutoff with
 * no route information at all.
 */
export function requestTimeoutGuard(timeoutMs: number = 15000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (res.headersSent) return;
      logger.error(
        { method: req.method, path: req.originalUrl, timeoutMs },
        'Request exceeded timeout guard — likely a hung upstream dependency (database, AI provider, Mailgun, etc.)'
      );
      res.status(503).json({
        error: 'This request is taking much longer than expected and has been stopped. ' +
               'This usually means an upstream service (database, AI provider) is unreachable or overloaded. Please try again shortly.',
      });
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}
