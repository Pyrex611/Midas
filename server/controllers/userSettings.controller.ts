import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

export const getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return res.json({});
    }

    res.json(settings);
  } catch (error) {
    next(error);
  }
};

const VALID_PERIODS = ['hour', 'day'] as const;

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { sendLimit, sendPeriod } = req.body;

    // Previously this endpoint silently discarded the request body entirely
    // (the UserSettings model had no columns to write to) — the frontend's
    // "Settings updated successfully" message was a false positive. Now real.
    const data: { sendLimit?: number | null; sendPeriod?: string | null } = {};
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

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    res.json(settings);
  } catch (error) {
    next(error);
  }
};
