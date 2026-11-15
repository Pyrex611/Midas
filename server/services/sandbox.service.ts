import prisma from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface SandboxSendResult {
  success: boolean;
  sandboxDomain: string;
  messageId?: string;
  remainingToday: number;
  dailyLimit: number;
}

export class SandboxService {
  private getCredentials(): { domain: string; apiKey: string; region: 'us' | 'eu' } | null {
    if (env.SANDBOX_DOMAIN && env.SANDBOX_MAILGUN_KEY) {
      return {
        domain: env.SANDBOX_DOMAIN.trim(),
        apiKey: env.SANDBOX_MAILGUN_KEY.trim(),
        region: env.SANDBOX_REGION || 'us',
      };
    }

    if (env.MAILGUN_API_KEY && env.EMAIL_FROM && env.EMAIL_FROM.includes('.') && !env.EMAIL_FROM.includes('vercel.app')) {
      return {
        domain: env.EMAIL_FROM.trim(),
        apiKey: env.MAILGUN_API_KEY.trim(),
        region: env.MAILGUN_REGION || 'us',
      };
    }

    return null;
  }

  public isConfigured(): boolean {
    return Boolean(this.getCredentials());
  }

  public async getSandboxStatus(userId: string): Promise<{
    available: boolean;
    domain: string | null;
    sentToday: number;
    dailyLimit: number;
    remainingToday: number;
  }> {
    const creds = this.getCredentials();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const sentToday = await prisma.outboundEmail.count({
      where: {
        userId,
        isIncoming: false,
        sentAt: { gte: startOfDay },
        subject: { startsWith: '[MIDAS SANDBOX]' },
      },
    });

    const dailyLimit = env.SANDBOX_DAILY_LIMIT || 15;
    return {
      available: Boolean(creds),
      domain: creds?.domain || null,
      sentToday,
      dailyLimit,
      remainingToday: Math.max(0, dailyLimit - sentToday),
    };
  }

  /**
   * Dispatches a real live test email without requiring the developer to buy a
   * domain or configure Mailgun DNS first.
   *
   * SECURITY GUARDRAIL:
   * Sandbox recipients MUST match the authenticated user's own account email
   * (`userEmail`) to prevent spammers from abusing shared sandbox reputation.
   */
  public async sendSandboxTest(options: {
    userId: string;
    userEmail: string;
    toEmail?: string;
    subject?: string;
    body?: string;
  }): Promise<SandboxSendResult> {
    const creds = this.getCredentials();
    if (!creds) {
      throw new Error(
        'Zero-Setup Sandbox is not configured on this server (missing SANDBOX_DOMAIN / SANDBOX_MAILGUN_KEY). ' +
        'Connect your own domain under Sending Domains to dispatch live emails.'
      );
    }

    const accountEmail = options.userEmail.trim().toLowerCase();
    const requestedTo = (options.toEmail || accountEmail).trim().toLowerCase();

    if (requestedTo !== accountEmail) {
      throw new Error(
        `Sandbox sends are strictly restricted to your own verified account email (${accountEmail}). ` +
        `Connect a custom Sending Domain to email external prospects.`
      );
    }

    const status = await this.getSandboxStatus(options.userId);
    if (status.remainingToday <= 0) {
      throw new Error(
        `Daily sandbox limit reached (${status.dailyLimit}/${status.dailyLimit}). ` +
        `Connect your own Sending Domain to unlock higher limits.`
      );
    }

    const rawSubject = (options.subject || 'Hello from MIDAS Golden Infrastructure').trim();
    const finalSubject = rawSubject.startsWith('[MIDAS SANDBOX]')
      ? rawSubject
      : `[MIDAS SANDBOX] ${rawSubject}`;

    const finalBody = (
      options.body ||
      `Hi there,\n\nThis is a live test email dispatched via MIDAS Zero-Setup Sandbox (${creds.domain}).\n\nYour outbound pipeline, HTML envelope rendering, and API key authentication are working end-to-end.\n\nNext step: connect your custom domain under Sending Domains when ready to reach external prospects.`
    ).trim();

    const baseUrl = creds.region === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3';
    const authHeader = `Basic ${Buffer.from(`api:${creds.apiKey}`).toString('base64')}`;

    const form = new URLSearchParams();
    form.append('from', `MIDAS Sandbox <sandbox@${creds.domain}>`);
    form.append('to', accountEmail);
    form.append('subject', finalSubject);
    form.append('text', finalBody);
    form.append(
      'html',
      `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:24px auto;padding:24px;border-radius:16px;border:1px solid #D4AF37;background:#FFFFFF;color:#1F1124;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#4A2559;margin-bottom:12px;">MIDAS Zero-Setup Sandbox</div>
        <div style="font-size:14px;line-height:1.65;">${finalBody.replace(/\n/g, '<br/>')}</div>
      </div>`
    );

    const res = await fetch(`${baseUrl}/${creds.domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    const rawText = await res.text();
    let parsed: any = {};
    try { parsed = JSON.parse(rawText); } catch { parsed = { message: rawText }; }

    if (!res.ok) {
      throw new Error(`Sandbox delivery rejected (${res.status}): ${parsed.message || rawText}`);
    }

    // Record inside Lead + OutboundEmail cleanly so user sees it immediately in telemetry
    const selfLead = await prisma.lead.upsert({
      where: { userId_email: { userId: options.userId, email: accountEmail } },
      update: {},
      create: {
        userId: options.userId,
        email: accountEmail,
        name: accountEmail.split('@')[0],
        status: 'CONTACTED',
        outreachStatus: 'SENT',
      },
    });

    const cleanMessageId = (parsed.id || '').replace(/^<|>$/g, '').trim();
    await prisma.outboundEmail.create({
      data: {
        userId: options.userId,
        leadId: selfLead.id,
        subject: finalSubject,
        body: finalBody,
        status: 'SENT',
        messageId: cleanMessageId || null,
        fromAddress: `sandbox@${creds.domain}`,
        toAddress: accountEmail,
      },
    });

    logger.info({ userId: options.userId, domain: creds.domain }, 'Guarded sandbox test email sent');

    return {
      success: true,
      sandboxDomain: creds.domain,
      messageId: cleanMessageId || undefined,
      remainingToday: Math.max(0, status.remainingToday - 1),
      dailyLimit: status.dailyLimit,
    };
  }
}

export const sandboxService = new SandboxService();