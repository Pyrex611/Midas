import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { encrypt, decrypt } from '../lib/encryption';
import { emailService } from '../services/email.service'; // 👈 IMPORT ADDED
import { logger } from '../config/logger';

/**
 * GET /api/user/settings
 * Retrieve the authenticated user's settings (passwords masked).
 */
export const getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return res.json({}); // no settings yet
    }

    // Return settings with passwords masked
    const { smtpPass, imapPass, ...safeSettings } = settings;
    res.json({
      ...safeSettings,
      smtpPass: smtpPass ? '********' : null,
      imapPass: imapPass ? '********' : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/settings
 * Update the authenticated user's settings. Passwords are encrypted before storage.
 */
export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      emailFrom,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      imapHost,
      imapPort,
      imapSecure,
      imapUser,
      imapPass,
    } = req.body;

    const data: any = {
      emailFrom,
      smtpHost,
      smtpPort: smtpPort ? parseInt(smtpPort) : undefined,
      smtpSecure: smtpSecure === 'true' ? true : smtpSecure === 'false' ? false : undefined,
      smtpUser,
      imapHost,
      imapPort: imapPort ? parseInt(imapPort) : undefined,
      imapSecure: imapSecure === 'true' ? true : imapSecure === 'false' ? false : undefined,
      imapUser,
    };

    // Encrypt passwords if provided
    if (smtpPass) data.smtpPass = encrypt(smtpPass);
    if (imapPass) data.imapPass = encrypt(imapPass);

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    // Clear email service cache for this user so next send picks up new settings
    emailService.clearCache(userId); // 👈 NOW WORKS

    // Return safe version
    const { smtpPass: _, imapPass: __, ...safeSettings } = settings;
    res.json({
      ...safeSettings,
      smtpPass: smtpPass ? '********' : null,
      imapPass: imapPass ? '********' : null,
    });
  } catch (error) {
    next(error);
  }
};