import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { encrypt } from '../lib/encryption';

export const getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return res.json({ hasAiApiKey: false });
    }

    // Never return raw or encrypted API keys
    const { aiApiKeyEncrypted, ...safeSettings } = settings;
    res.json({
      ...safeSettings,
      hasAiApiKey: Boolean(aiApiKeyEncrypted),
    });
  } catch (error) {
    next(error);
  }
};

const VALID_PERIODS = ['hour', 'day'] as const;
const VALID_PROVIDERS = ['gemini', 'openrouter', 'aigateway', 'openai', 'deepseek', 'ollama', 'mock'] as const;

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      sendLimit,
      sendPeriod,
      companyName,
      physicalAddress,
      customOptOutText,
      aiProvider,
      aiModel,
      aiApiKey,
      clearAiApiKey,
      aiGatewayUrl,
    } = req.body;

    const data: Record<string, any> = {};

    if (sendLimit !== undefined) {
      const n = Number(sendLimit);
      if (sendLimit !== null && (!Number.isInteger(n) || n <= 0)) {
        return res.status(400).json({ error: 'sendLimit must be a positive integer' });
      }
      data.sendLimit = sendLimit === null ? null : n;
    }

    if (sendPeriod !== undefined) {
      if (sendPeriod !== null && !VALID_PERIODS.includes(sendPeriod)) {
        return res.status(400).json({ error: `sendPeriod must be one of: ${VALID_PERIODS.join(', ')}` });
      }
      data.sendPeriod = sendPeriod;
    }

    if (companyName !== undefined) {
      data.companyName = typeof companyName === 'string' ? companyName.trim() : null;
    }

    if (physicalAddress !== undefined) {
      data.physicalAddress = typeof physicalAddress === 'string' ? physicalAddress.trim() : null;
    }

    if (customOptOutText !== undefined) {
      data.customOptOutText = typeof customOptOutText === 'string' ? customOptOutText.trim() : null;
    }

    // AI Provider & Model Configuration
    if (aiProvider !== undefined) {
      if (aiProvider !== null && !VALID_PROVIDERS.includes(aiProvider)) {
        return res.status(400).json({ error: `aiProvider must be one of: ${VALID_PROVIDERS.join(', ')}` });
      }
      data.aiProvider = aiProvider;
    }

    if (aiModel !== undefined) {
      data.aiModel = typeof aiModel === 'string' && aiModel.trim() ? aiModel.trim() : null;
    }

    if (aiGatewayUrl !== undefined) {
      data.aiGatewayUrl = typeof aiGatewayUrl === 'string' && aiGatewayUrl.trim() ? aiGatewayUrl.trim() : null;
    }

    // Encrypt custom API key if provided
    if (aiApiKey && typeof aiApiKey === 'string' && aiApiKey.trim()) {
      data.aiApiKeyEncrypted = encrypt(aiApiKey.trim());
    } else if (clearAiApiKey === true) {
      data.aiApiKeyEncrypted = null;
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    const { aiApiKeyEncrypted, ...safeSettings } = settings;
    res.json({
      ...safeSettings,
      hasAiApiKey: Boolean(aiApiKeyEncrypted),
    });
  } catch (error) {
    next(error);
  }
};