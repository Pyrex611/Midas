import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateApiKey } from '../lib/apiKeys';

const MAX_KEYS_PER_WORKSPACE = 15;

export const listWorkspaceApiKeys = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const keys = await prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(keys);
  } catch (error) {
    next(error);
  }
};

export const createWorkspaceApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { label, scopes } = req.body;

    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'A label is required for this API Key' });
    }

    const currentCount = await prisma.apiKey.count({
      where: { userId, revokedAt: null },
    });

    if (currentCount >= MAX_KEYS_PER_WORKSPACE) {
      return res.status(400).json({
        error: `Workspace limit reached: You can have a maximum of ${MAX_KEYS_PER_WORKSPACE} active API keys. Revoke unused keys before creating new ones.`,
      });
    }

    const validatedScopes = Array.isArray(scopes) && scopes.length > 0 ? scopes : ['*'];
    const { plaintextKey, keyPrefix, keyHash } = generateApiKey('midas');

    const created = await prisma.apiKey.create({
      data: {
        userId,
        label: label.trim(),
        keyPrefix,
        keyHash,
        scopes: validatedScopes,
      },
    });

    res.status(201).json({
      id: created.id,
      label: created.label,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      plaintextKey,
      createdAt: created.createdAt,
      message: 'Save this API key safely. It will not be shown again.',
    });
  } catch (error) {
    next(error);
  }
};

export const revokeWorkspaceApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const key = await prisma.apiKey.findFirst({ where: { id, userId } });
    if (!key) return res.status(404).json({ error: 'API Key not found' });

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true, message: 'API key revoked successfully' });
  } catch (error) {
    next(error);
  }
};