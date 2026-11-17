import crypto from 'crypto';
import dns from 'dns';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';
import { encrypt, tryDecrypt } from '../lib/encryption';
import { planGuardService } from './billing/planGuard.service';

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

  private sanitize(domain: any) {
    if (!domain) return domain;
    const { mailgunApiKeyEncrypted, smtpConfigEncrypted, ...rest } = domain;
    const keyDecryptionFailed =
      (Boolean(mailgunApiKeyEncrypted) && !tryDecrypt(mailgunApiKeyEncrypted)) ||
      (Boolean(smtpConfigEncrypted) && !tryDecrypt(smtpConfigEncrypted));
    return {
      ...rest,
      hasMailgunKey: !!mailgunApiKeyEncrypted,
      hasSmtpConfig: !!smtpConfigEncrypted,
      keyDecryptionFailed,
    };
  }

  async checkDmarcPolicy(domainName: string): Promise<{
    policy: 'none' | 'quarantine' | 'reject' | 'missing';
    record?: string;
    bimiReady: boolean;
  }> {
    const cleanDomain = domainName.trim().toLowerCase();
    try {
      const records = await dns.promises.resolveTxt(`_dmarc.${cleanDomain}`);
      const flat = records.map((chunk) => chunk.join('')).join(' ');
      const match = flat.match(/p=(none|quarantine|reject)/i);
      const policy = match ? (match[1].toLowerCase() as any) : 'none';
      const bimiReady = policy === 'quarantine' || policy === 'reject';
      return { policy, record: flat, bimiReady };
    } catch {
      const parts = cleanDomain.split('.');
      if (parts.length > 2) {
        const rootDomain = parts.slice(-2).join('.');
        try {
          const rootRecords = await dns.promises.resolveTxt(`_dmarc.${rootDomain}`);
          const flat = rootRecords.map((chunk) => chunk.join('')).join(' ');
          const match = flat.match(/p=(none|quarantine|reject)/i);
          const policy = match ? (match[1].toLowerCase() as any) : 'none';
          const bimiReady = policy === 'quarantine' || policy === 'reject';
          return { policy, record: flat, bimiReady };
        } catch {}
      }
      return { policy: 'missing', bimiReady: false };
    }
  }

  async updateBimiSettings(
    userId: string,
    domainId: string,
    data: { bimiEnabled: boolean; bimiSvgUrl?: string; bimiVmcUrl?: string }
  ) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');

    const dmarcResult = await this.checkDmarcPolicy(domain.domainName);

    if (data.bimiEnabled && !dmarcResult.bimiReady) {
      throw new Error(
        `Cannot enable BIMI: DMARC policy for ${domain.domainName} is "${dmarcResult.policy}". ` +
        `BIMI requires DMARC to be enforced at p=quarantine or p=reject.`
      );
    }

    const updated = await prisma.domain.update({
      where: { id: domainId },
      data: {
        bimiEnabled: data.bimiEnabled,
        bimiSvgUrl: data.bimiSvgUrl?.trim() || null,
        bimiVmcUrl: data.bimiVmcUrl?.trim() || null,
        dmarcPolicy: dmarcResult.policy,
      },
    });

    return this.sanitize(updated);
  }

  private async sendTestEmail(domainName: string, mailgunApiKey: string, region: string | null, toEmail: string) {
    const cleanTo = (toEmail || '').trim().toLowerCase();
    if (!cleanTo || !cleanTo.includes('@')) {
      throw new Error(`Invalid test recipient email address: "${toEmail}". Please provide a valid email.`);
    }

    const cleanDomain = domainName.trim().toLowerCase();
    const cleanKey = mailgunApiKey.trim();
    const url = `${this.baseUrlFor(region)}/${cleanDomain}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeaderFor(cleanKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        from: `Midas Connectivity Test <postmaster@${cleanDomain}>`,
        to: cleanTo,
        subject: 'Midas: your domain is connected',
        text: `This confirms ${cleanDomain} can send email through your Mailgun account via Midas.`,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });

    const rawText = await res.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = { message: rawText }; }

    if (!res.ok) {
      const errorMsg = data.message || rawText || `HTTP ${res.status}`;
      throw new Error(`Mailgun rejected the test send (${res.status}): ${errorMsg}`);
    }

    return data;
  }

  private async verifyResendKey(apiKey: string) {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: AbortSignal.timeout(8_000),
    });

    if (res.ok) return;

    const data: any = await res.json().catch(() => ({}));
    // Resend send-only restricted keys legitimately return 401 with name === 'restricted_api_key'
    if (data?.name === 'restricted_api_key') return;

    throw new Error(`Resend API key rejected (${res.status}): ${data?.message || 'Invalid API key'}`);
  }

  private async verifySmtpCredentials(creds: { host: string; port: number; secure: boolean; user: string; pass: string }) {
    let nodemailer: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      nodemailer = require('nodemailer');
    } catch {
      throw new Error('Custom SMTP provider requires the "nodemailer" package to be installed.');
    }

    const transporter = nodemailer.createTransport({
      host: creds.host.trim(),
      port: Number(creds.port) || 587,
      secure: Boolean(creds.secure),
      auth: {
        user: creds.user.trim(),
        pass: creds.pass,
      },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 8_000,
    });

    try {
      await transporter.verify();
    } catch (err: any) {
      throw new Error(`SMTP handshake failed: ${err?.message || 'Could not authenticate with SMTP host'}`);
    }
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
      } catch {}
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
    await planGuardService.assertDomainCapacity(userId);

    const cleanDomain = domainName.toLowerCase().trim();
    const cleanKey = mailgunApiKey.trim();

    const existing = await prisma.domain.findFirst({ where: { userId, domainName: cleanDomain } });
    if (existing) throw new Error('This domain is already connected to your account');

    const dmarcCheck = await this.checkDmarcPolicy(cleanDomain);

    const domain = await prisma.domain.create({
      data: {
        userId,
        domainName: cleanDomain,
        espProvider: 'mailgun',
        status: 'pending_setup',
        mailgunApiKeyEncrypted: encrypt(cleanKey),
        mailgunRegion: region || null,
        dmarcPolicy: dmarcCheck.policy,
      },
    });

    const updated = await this.runSendTest(userId, domain.id, testRecipientEmail);
    return this.sanitize(updated);
  }

  /** Connects a Resend (for Town Crier) or Custom SMTP domain with immediate credential verification. */
  async connectEspDomain(
    userId: string,
    input: {
      domainName: string;
      espProvider: 'resend' | 'smtp';
      apiKey?: string;
      smtpConfig?: { host: string; port: number; secure: boolean; user: string; pass: string };
    }
  ) {
    await planGuardService.assertDomainCapacity(userId);

    const cleanDomain = input.domainName.toLowerCase().trim();
    const existing = await prisma.domain.findFirst({ where: { userId, domainName: cleanDomain } });
    if (existing) throw new Error('This domain is already connected to your account');

    if (input.espProvider === 'resend') {
      if (!input.apiKey?.trim()) throw new Error('Resend API Key is required');
      await this.verifyResendKey(input.apiKey.trim());
    }

    if (input.espProvider === 'smtp') {
      if (!input.smtpConfig?.host || !input.smtpConfig?.user || !input.smtpConfig?.pass) {
        throw new Error('SMTP host, user, and password are required');
      }
      await this.verifySmtpCredentials(input.smtpConfig);
    }

    const dmarcCheck = await this.checkDmarcPolicy(cleanDomain);

    const domain = await prisma.domain.create({
      data: {
        userId,
        domainName: cleanDomain,
        espProvider: input.espProvider,
        status: 'active',
        sendTestPassedAt: new Date(),
        dmarcPolicy: dmarcCheck.policy,
        mailgunApiKeyEncrypted: input.apiKey?.trim() ? encrypt(input.apiKey.trim()) : null,
        smtpConfigEncrypted: input.smtpConfig ? encrypt(JSON.stringify(input.smtpConfig)) : null,
      },
    });

    return this.sanitize(domain);
  }

  async runSendTest(userId: string, domainId: string, testRecipientEmail: string) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');
    if (!domain.mailgunApiKeyEncrypted) throw new Error('No Mailgun API key is set for this domain');

    const key = tryDecrypt(domain.mailgunApiKeyEncrypted);
    if (!key) throw new Error('Could not decrypt the stored Mailgun key (ENCRYPTION_KEY may have changed) — please reconnect this domain.');

    await this.sendTestEmail(domain.domainName, key, domain.mailgunRegion, testRecipientEmail);

    const receivingTestCode = generateCode();
    const receivingTestAddress = `connectivity@${domain.domainName}`;

    let routeId = domain.routeId ?? undefined;
    try {
      routeId = await this.ensureInboundRoute(domain.id, domain.domainName, key, domain.mailgunRegion);
    } catch (err: any) {
      logger.warn({ err: err.message, domainId: domain.id }, 'Automatic Mailgun inbound route setup failed');
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
    return domains.map((d) => this.sanitize(d));
  }

  async getDomainRaw(domainId: string) {
    return prisma.domain.findUnique({ where: { id: domainId } });
  }

  getMailgunContextForDomain(domain: { mailgunApiKeyEncrypted?: string | null; mailgunRegion?: string | null }): { authHeader: string; baseUrl: string } {
    if (domain.mailgunApiKeyEncrypted) {
      const decrypted = tryDecrypt(domain.mailgunApiKeyEncrypted);
      if (!decrypted) {
        throw new Error('Stored Mailgun key could not be decrypted (ENCRYPTION_KEY mismatch) — reconnect the domain.');
      }
      return { authHeader: this.authHeaderFor(decrypted), baseUrl: this.baseUrlFor(domain.mailgunRegion) };
    }
    const key = process.env.MAILGUN_API_KEY;
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