import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * QStash signature verification is OPTIONAL hardening on top of the
 * required Bearer CRON_SECRET check below. It must never be able to break
 * anything else in the app if the `@upstash/qstash` package isn't
 * installed, isn't resolvable in a given deploy, or throws for any other
 * reason.
 *
 * IMPORTANT LESSON BAKED INTO THIS FILE: a plain top-level
 * `import { Receiver } from '@upstash/qstash'` at the top of this file
 * previously caused a site-wide outage — every single `/api/*` route
 * started returning 500, not just the cron endpoints. Why: `server/app.ts`
 * imports the entire route tree (including this file, transitively) at
 * module load time, so ONE unresolved import anywhere in that tree throws
 * during Node's `require()` of the whole bundle, before Express even
 * finishes constructing the app — meaning the serverless function crashes
 * on every invocation regardless of which path was requested. The fix is
 * this file: the import only happens lazily, inside a try/catch, the first
 * time QStash verification is actually attempted — never at module load.
 */
let qstashReceiverCtor: any = null;
let qstashLoadAttempted = false;

function loadQStashReceiver(): any {
  if (qstashLoadAttempted) return qstashReceiverCtor;
  qstashLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@upstash/qstash');
    qstashReceiverCtor = mod.Receiver;
  } catch (error) {
    logger.warn(
      '@upstash/qstash is not installed — QStash signature verification is disabled. ' +
      'This is fine if you are only using the static CRON_SECRET bearer header ' +
      '(Vercel Cron, GitHub Actions, cron-job.org, or QStash forwarding CRON_SECRET). ' +
      'Run `npm install @upstash/qstash` to enable signature verification (see docs/QSTASH_SETUP.md).'
    );
    qstashReceiverCtor = null;
  }
  return qstashReceiverCtor;
}

let qstashReceiverInstance: any = null;
function getQStashReceiver(): any {
  if (qstashReceiverInstance) return qstashReceiverInstance;
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return null;

  const Receiver = loadQStashReceiver();
  if (!Receiver) return null;

  try {
    qstashReceiverInstance = new Receiver({ currentSigningKey, nextSigningKey });
    return qstashReceiverInstance;
  } catch (error) {
    logger.error({ error }, 'Failed to construct QStash Receiver — signature verification disabled');
    return null;
  }
}

/**
 * Accepts EITHER:
 *  1. A static `Authorization: Bearer $CRON_SECRET` header — used by Vercel
 *     Cron (which auto-attaches this when CRON_SECRET is set), the GitHub
 *     Actions backup workflow, cron-job.org, and QStash schedules that
 *     forward it via `Upstash-Forward-Authorization`.
 *  2. A verified Upstash QStash signature (`Upstash-Signature` header) —
 *     only checked if `@upstash/qstash` is installed AND
 *     QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY are set. Absent
 *     either, this path is skipped entirely (not an error) and option 1
 *     is the only accepted auth method — which is the default, working
 *     configuration out of the box.
 */
export async function verifyCronRequest(req: Request, res: Response, next: NextFunction) {
  if (!process.env.CRON_SECRET) {
    logger.error('CRON_SECRET is not configured — refusing all cron requests');
    return res.status(500).json({ error: 'Cron is not configured on this deployment' });
  }

  const authHeader = req.headers.authorization;
  const expectedBearer = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader === expectedBearer) {
    return next();
  }

  const qstashSignature = req.headers['upstash-signature'] as string | undefined;
  if (qstashSignature) {
    const receiver = getQStashReceiver();
    if (receiver) {
      try {
        const bodyString = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
        const isValid = await receiver.verify({ signature: qstashSignature, body: bodyString });
        if (isValid) return next();
      } catch (error) {
        logger.warn({ error }, 'QStash signature verification failed');
      }
    }
  }

  return res.status(401).json({ error: 'Unauthorized Cron Execution' });
}
