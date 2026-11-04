import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { verifyApiKey } from '../lib/apiKeys';
import { logger } from '../config/logger';

export interface ApiKeyRequest extends Request {
  apiUser?: {
    id: string;
    scopes: string[];
  };
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer tc_live_')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key. Expected Bearer tc_live_...' });
  }

  const rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  const prefix = rawKey.slice(0, 16);

  try {
    const keyRecord = await prisma.apiKey.findFirst({
      where: {
        keyPrefix: prefix,
        revokedAt: null,
      },
    });

    if (!keyRecord) {
      return res.status(401).json({ error: 'Unauthorized: API Key not found or revoked' });
    }

    const isValid = verifyApiKey(rawKey, keyRecord.keyHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }

    // Attach verified API user
    (req as ApiKeyRequest).apiUser = {
      id: keyRecord.userId,
      scopes: keyRecord.scopes,
    };

    // Asynchronously update lastUsedAt without blocking request lifecycle
    prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(err => {
      logger.warn({ err: err?.message }, 'Failed to update apiKey lastUsedAt');
    });

    next();
  } catch (error) {
    logger.error({ error }, 'API key authentication failure');
    res.status(500).json({ error: 'API key authentication failed' });
  }
}