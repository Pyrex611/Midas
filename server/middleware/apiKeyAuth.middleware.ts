import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { verifyApiKey } from '../lib/apiKeys';
import { logger } from '../config/logger';

export interface ApiKeyRequest extends Request {
  apiUser?: {
    id: string;
    scopes: string[];
    keyId: string;
  };
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || (!authHeader.startsWith('Bearer midas_live_') && !authHeader.startsWith('Bearer tc_live_'))) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing API Key. Expected Bearer midas_live_... or Bearer tc_live_...',
    });
  }

  const rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  const prefix = rawKey.startsWith('midas_live_') ? rawKey.slice(0, 19) : rawKey.slice(0, 16);

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

    (req as ApiKeyRequest).apiUser = {
      id: keyRecord.userId,
      scopes: keyRecord.scopes || ['*'],
      keyId: keyRecord.id,
    };

    prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch((err) => {
      logger.warn({ err: err?.message }, 'Failed to update apiKey lastUsedAt');
    });

    next();
  } catch (error) {
    logger.error({ error }, 'API key authentication failure');
    res.status(500).json({ error: 'API key authentication failed' });
  }
}

/**
 * Granular scope verification middleware:
 * Supports exact match ('campaigns:write'), domain wildcards ('campaigns:*'), and super-admin ('*').
 */
export function requireApiKeyScope(requiredScope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiKeyRequest;
    if (!apiReq.apiUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const scopes = apiReq.apiUser.scopes || [];

    if (scopes.includes('*') || scopes.includes(requiredScope)) {
      return next();
    }

    const [domain] = requiredScope.split(':');
    if (scopes.includes(`${domain}:*`)) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: API Key lacks required permission "${requiredScope}"`,
      requiredScope,
    });
  };
}