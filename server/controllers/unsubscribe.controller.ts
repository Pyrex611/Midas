import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

async function doUnsubscribe(token: string) {
  const lead = await prisma.lead.findUnique({ where: { unsubscribeToken: token } });
  if (!lead) return null;

  if (lead.status !== 'UNSUBSCRIBED') {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'UNSUBSCRIBED', outreachStatus: 'UNSUBSCRIBED' },
    });
    // Also drop any future sends already queued for them (follow-ups, etc.)
    await prisma.pendingEmail.deleteMany({ where: { leadId: lead.id } });
    logger.info({ leadId: lead.id }, 'Lead unsubscribed via one-click link');
  }
  return lead;
}

// RFC 8058 one-click unsubscribe: mail clients (Gmail, Yahoo, etc.) send a
// POST here with no user-facing confirmation when the recipient clicks
// "Unsubscribe" in their own mail UI — required to actually pair with the
// `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header we send.
export const unsubscribeOneClick = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const lead = await doUnsubscribe(token);
    if (!lead) return res.status(404).send('Not found');
    res.status(200).send('OK');
  } catch (error) {
    logger.error({ error }, 'One-click unsubscribe failed');
    res.status(500).send('Error');
  }
};

// Human clicking the plain-text link in the email body — shows a simple
// confirmation page rather than silently no-oping.
export const unsubscribePage = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const lead = await doUnsubscribe(token);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!lead) {
      return res.status(404).send(`
        <html><body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center;">
          <h2>Link not found</h2>
          <p>This unsubscribe link is invalid or has expired.</p>
        </body></html>
      `);
    }

    res.send(`
      <html><body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center;">
        <h2>You've been unsubscribed</h2>
        <p>${lead.email} will not receive any further emails from this sender.</p>
      </body></html>
    `);
  } catch (error) {
    logger.error({ error }, 'Unsubscribe page failed');
    res.status(500).send('Something went wrong. Please try again later.');
  }
};
