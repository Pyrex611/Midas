import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import {
  decodeOpenToken,
  decodeClickToken,
  TRANSPARENT_GIF_BUFFER,
  isBotScanner,
} from '../lib/tracking';

/**
 * GET /api/track/open/:token
 */
export const trackOpen = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Content-Length', '43');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(TRANSPARENT_GIF_BUFFER);

  const { token } = req.params;
  const payload = decodeOpenToken(token);
  if (!payload) return;

  const userAgent = req.headers['user-agent'] || '';
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
  const isScanner = isBotScanner(userAgent);

  try {
    const email = await prisma.outboundEmail.findUnique({
      where: { id: payload.outboundEmailId },
      select: { id: true, sentAt: true, openedAt: true },
    });

    if (email && !email.openedAt && !isScanner) {
      await prisma.outboundEmail.update({
        where: { id: email.id },
        data: { openedAt: new Date() },
      });
    }

    await prisma.leadActivityEvent.create({
      data: {
        leadId: payload.leadId,
        campaignId: payload.campaignId || null,
        eventType: 'EMAIL_OPENED',
        metadata: {
          outboundEmailId: payload.outboundEmailId,
          userAgent,
          ip,
          isScannerFiltered: isScanner,
        },
      },
    });
  } catch (err: any) {
    logger.warn({ err: err?.message, outboundEmailId: payload.outboundEmailId }, 'Failed to record open telemetry');
  }
};

/**
 * GET /api/track/click/:token
 */
export const trackClick = async (req: Request, res: Response) => {
  const { token } = req.params;
  const payload = decodeClickToken(token);

  if (!payload || !payload.targetUrl) {
    return res.status(404).send('Link not found or expired');
  }

  let sanitizedUrl = payload.targetUrl.trim();
  if (!/^https?:\/\//i.test(sanitizedUrl)) {
    sanitizedUrl = `https://${sanitizedUrl}`;
  }

  res.redirect(302, sanitizedUrl);

  const userAgent = req.headers['user-agent'] || '';
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
  const isScanner = isBotScanner(userAgent);

  try {
    const email = await prisma.outboundEmail.findUnique({
      where: { id: payload.outboundEmailId },
      select: { id: true, clickedAt: true },
    });

    if (email && !email.clickedAt && !isScanner) {
      await prisma.outboundEmail.update({
        where: { id: email.id },
        data: { clickedAt: new Date() },
      });
    }

    await prisma.leadActivityEvent.create({
      data: {
        leadId: payload.leadId,
        campaignId: payload.campaignId || null,
        eventType: 'EMAIL_CLICKED',
        metadata: {
          outboundEmailId: payload.outboundEmailId,
          targetUrl: sanitizedUrl,
          userAgent,
          ip,
          isScannerFiltered: isScanner,
        },
      },
    });
  } catch (err: any) {
    logger.warn({ err: err?.message, outboundEmailId: payload.outboundEmailId }, 'Failed to record click telemetry');
  }
};