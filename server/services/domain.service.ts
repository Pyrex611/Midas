import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { encrypt, tryDecrypt } from '../lib/encryption';

function generateCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

export class DomainService {
  private baseUrlFor(region?: string | null): string {
    return region === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3';
  }

  private authHeaderFor(mailgunApiKey: string): string {
    const cleanKey = mailgunApiKey.trim();
    return `Basic ${Buffer.from(`api:${cleanKey}`).toString('base64')}`;
  }

  /** Never return the encrypted key or the receiving test code to the client. */
  private sanitize(domain: any) {
    if (!domain) return domain;
    const { mailgunApiKeyEncrypted, ...rest } = domain;
    return { ...rest, hasMailgunKey: !!mailgunApiKeyEncrypted };
  }

  /**
   * Sends one real test email through the given domain+key.
   * Safely handles both JSON and plain-text (401 Forbidden) Mailgun responses.
   */
  private async sendTestEmail(domainName: string, mailgunApiKey: string, region: string | null, toEmail: string) {
    const cleanTo = (toEmail || '').trim().toLowerCase();
    if (!cleanTo || !cleanTo.includes('@')) {
      throw new Error(`Invalid test recipient email address: "${toEmail}". Please provide a valid email.`);
    }

    const cleanDomain = domainName.trim().toLowerCase();
    const cleanKey = mailgunApiKey.trim();
    const url = `${this.baseUrlFor(region)}/${cleanDomain}/messages`;

    logger.info({ domain: cleanDomain, region: region || 'us', recipient: cleanTo }, 'Dispatching Mailgun connectivity test send');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeaderFor(cleanKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        from: `Midas Connectivity Test <postmaster@${cleanDomain}>`,
        to: cleanTo,
        subject: 'Midas: your domain is connected',
        text: `This confirms ${cleanDomain} can send email through your Mailgun account via Midas.\n\nNext step: confirm receiving — check the Domains page for a one-time code and test address.`,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });

    const rawText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }

    if (!res.ok) {
      const errorMsg = data.message || rawText || `HTTP ${res.status}`;
      logger.error({ status: res.status, errorMsg, domain: cleanDomain }, 'Mailgun rejected test send');
      throw new Error(`Mailgun rejected the test send (${res.status}): ${errorMsg}`);
    }

    return data;
  }

  private appUrl(): string {
    const configured = process.env.APP_URL;
    if (configured) return configured.replace(/\/$/, '');
    return 'https://midas-aem.vercel.app';
  }

  private routeExpressionFor(domainName: string): string {
    return `match_recipient('.*@${domainName.replace(/\./g, '\\.')}')`;
  }

  private async listRoutes(mailgunApiKey: string, region: string | null): Promise<{ items: any[] }> {
    const res = await fetch(`${this.baseUrlFor(region)}/routes?limit=100`, {
      headers: { Authorization: this.authHeaderFor(mailgunApiKey) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to list Mailgun routes (${res.status}): ${text}`);
    }
    return res.json();
  }

  private async ensureInboundRoute(
    domainId: string,
    domainName: string,
    mailgunApiKey: string,
    region: string | null
  ): Promise<string> {
    const webhookUrl = `${this.appUrl()}/api/webhooks/mailgun/inbound`;
    const expression = this.routeExpressionFor(domainName);

    const current = await prisma.domain.findUnique({ where: { id: domainId }, select: { routeId: true } });
    if (current?.routeId) {
      try {
        const check = await fetch(`${this.baseUrlFor(region)}/routes/${current.routeId}`, {
          headers: { Authorization: this.authHeaderFor(mailgunApiKey) },
          signal: AbortSignal.timeout(10_000),
        });
        if (check.ok) return current.routeId;
      } catch {
        // Fall through
      }
    }

    const list = await this.listRoutes(mailgunApiKey, region);
    const existing = (list.items || []).find((r: any) => r.expression === expression);
    if (existing) return existing.id;

    const form = new URLSearchParams();
    form.set('priority', '0');
    form.set('description', `Midas inbound — ${domainName}`);
    form.set('expression', expression);
    form.append('action', `forward("${webhookUrl}")`);
    form.append('action', 'stop()');

    const res = await fetch(`${this.baseUrlFor(region)}/routes`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeaderFor(mailgunApiKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    const raw = await res.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }

    if (!res.ok) {
      throw new Error(data.message || `Failed to create Mailgun inbound route (${res.status})`);
    }
    return data.route?.id || '';
  }

  async connectWithKey(userId: string, domainName: string, mailgunApiKey: string, region: string | null, testRecipientEmail: string) {
    const cleanDomain = domainName.toLowerCase().trim();
    const cleanKey = mailgunApiKey.trim();

    const existing = await prisma.domain.findFirst({ where: { userId, domainName: cleanDomain } });
    if (existing) throw new Error('This domain is already connected to your account');

    const domain = await prisma.domain.create({
      data: {
        userId,
        domainName: cleanDomain,
        status: 'pending_setup',
        mailgunApiKeyEncrypted: encrypt(cleanKey),
        mailgunRegion: region || null,
      },
    });

    const updated = await this.runSendTest(userId, domain.id, testRecipientEmail);
    return this.sanitize(updated);
  }

  async runSendTest(userId: string, domainId: string, testRecipientEmail: string) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');
    if (!domain.mailgunApiKeyEncrypted) throw new Error('No Mailgun API key is set for this domain');

    const key = tryDecrypt(domain.mailgunApiKeyEncrypted);
    if (!key) throw new Error('Could not decrypt the stored Mailgun key — please reconnect this domain with the key again');

    await this.sendTestEmail(domain.domainName, key, domain.mailgunRegion, testRecipientEmail);

    const receivingTestCode = generateCode();
    const receivingTestAddress = `connectivity@${domain.domainName}`;

    let routeId = domain.routeId ?? undefined;
    try {
      routeId = await this.ensureInboundRoute(domain.id, domain.domainName, key, domain.mailgunRegion);
    } catch (err: any) {
      logger.warn(
        { err: err.message, domainId: domain.id },
        'Automatic Mailgun inbound route setup failed — receiving test will need a manually-configured Route'
      );
    }

    return prisma.domain.update({
      where: { id: domainId },
      data: {
        status: 'active',
        sendTestPassedAt: new Date(),
        receivingTestCode,
        receivingTestAddress,
        routeId,
      },
    });
  }

  async resetReceivingTest(userId: string, domainId: string) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');

    return this.sanitize(await prisma.domain.update({
      where: { id: domainId },
      data: {
        receivingTestCode: generateCode(),
        receivingTestAddress: `connectivity@${domain.domainName}`,
        receivingConfirmedAt: null,
      },
    }));
  }

  async checkReceivingTest(userId: string, domainId: string) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');
    return {
      confirmed: !!domain.receivingConfirmedAt,
      testAddress: domain.receivingTestAddress,
      testCode: domain.receivingTestCode,
    };
  }

  async getDomains(userId: string) {
    const domains = await prisma.domain.findMany({
      where: { userId },
      include: { senders: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return domains.map(d => this.sanitize(d));
  }

  async getDomainRaw(domainId: string) {
    return prisma.domain.findUnique({ where: { id: domainId } });
  }

  getMailgunContextForDomain(domain: { mailgunApiKeyEncrypted?: string | null; mailgunRegion?: string | null }): { authHeader: string; baseUrl: string } {
    const key = tryDecrypt(domain.mailgunApiKeyEncrypted) || process.env.MAILGUN_API_KEY;
    if (!key) throw new Error('No Mailgun API key available for this domain');
    return { authHeader: this.authHeaderFor(key), baseUrl: this.baseUrlFor(domain.mailgunRegion) };
  }

  async deleteDomain(userId: string, domainId: string) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');
    await prisma.domain.delete({ where: { id: domainId } });
  }
}

export const domainService = new DomainService();