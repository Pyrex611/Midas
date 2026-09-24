import crypto from 'crypto';
import prisma from './prisma';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://midas-aem.vercel.app';

/** Generates a token the first time a lead needs one (self-healing for leads imported before unsubscribe tokens existed). */
export async function ensureUnsubscribeToken(leadId: string, currentToken: string | null): Promise<string> {
  if (currentToken) return currentToken;
  const token = crypto.randomBytes(16).toString('hex');
  await prisma.lead.update({ where: { id: leadId }, data: { unsubscribeToken: token } });
  return token;
}

export function buildUnsubscribeUrl(token: string): string {
  return `${APP_BASE_URL.replace(/\/$/, '')}/api/unsubscribe/${token}`;
}
