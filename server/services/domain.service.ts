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
    return `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`;
  }

  /** Never return the encrypted key or the receiving test code to the client. */
  private sanitize(domain: any) {
    if (!domain) return domain;
    const { mailgunApiKeyEncrypted, ...rest } = domain;
    return { ...rest, hasMailgunKey: !!mailgunApiKeyEncrypted };
  }

  /**
   * Sends one real test email through the given domain+key. This is the
   * actual functional proof that "sending works" — far more reliable than
   * asking Mailgun's API whether DNS records look valid, which (a) several
   * Mailgun plans restrict access to and (b) doesn't prove YOUR specific
   * setup (route wiring, correct key, correct domain name) is right, only
   * that Mailgun's own DNS crawler is satisfied.
   */
  private async sendTestEmail(domainName: string, mailgunApiKey: string, region: string | null, toEmail: string) {
    const res = await fetch(`${this.baseUrlFor(region)}/${domainName}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeaderFor(mailgunApiKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        from: `Midas Connectivity Test <postmaster@${domainName}>`,
        to: toEmail,
        subject: 'Midas: your domain is connected',
        text: `This confirms ${domainName} can send email through your Mailgun account via Midas.\n\nNext step: confirm receiving — check the Domains page for a one-time code and test address.`,
      }).toString(),
      // Same lesson as the Prisma/Neon incident: no external fetch runs
      // unbounded. requestTimeoutGuard (15s, app.ts) is a backstop, not a
      // substitute — this fails fast and specifically for a slow Mailgun
      // response instead of tripping the generic whole-request guard.
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Mailgun rejected the test send (HTTP ${res.status})`);
    }
    return data;
  }

  /** Resolves this deployment's own public URL for building the Mailgun inbound-Route webhook target. */
  private appUrl(): string {
    const configured = process.env.APP_URL;
    if (configured) return configured.replace(/\/$/, '');
    logger.warn(
      'APP_URL is not set — falling back to the default Vercel deployment URL for the Mailgun ' +
      'inbound route. Set APP_URL once you have a stable production/custom domain, or inbound ' +
      'routes created before that point will keep forwarding to the fallback URL.'
    );
    return 'https://midas-aem.vercel.app';
  }

  /**
   * Mailgun Routes are ACCOUNT-global, not per-domain — a bare catchall()
   * filter would intercept inbound mail for every domain on the same
   * Mailgun account (including any other domain connected with the same
   * key), not just this one. Scoping the expression to this exact domain
   * keeps route matching isolated to the domain actually being connected.
   */
  private routeExpressionFor(domainName: string): string {
    return `match_recipient('.*@${domainName.replace(/\./g, '\\.')}')`;
  }

  private async listRoutes(mailgunApiKey: string, region: string | null): Promise<{ items: any[] }> {
    const res = await fetch(`${this.baseUrlFor(region)}/routes?limit=100`, {
      headers: { Authorization: this.authHeaderFor(mailgunApiKey) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Failed to list Mailgun routes (HTTP ${res.status})`);
    return res.json();
  }

  /**
   * Ensures an inbound Route exists for this domain, forwarding to Midas's
   * webhook — without this, Mailgun has nowhere to send inbound mail
   * regardless of how correctly DNS/MX is set up, and the receiving-test
   * code sent to connectivity@domain would never arrive. Idempotent: checks
   * the domain's stored routeId first (verifying it still exists remotely,
   * in case it was deleted manually in Mailgun's UI), then falls back to
   * matching by expression, before creating a new one — so retrying
   * connectWithKey/runSendTest never stacks duplicate routes.
   *
   * Best-effort by design: called from runSendTest wrapped in a try/catch
   * that does NOT fail the send test if this throws (e.g. a Mailgun plan
   * that restricts Routes API access) — sending and receiving are tracked
   * independently, and the Domains page keeps its manual-setup fallback
   * guidance for exactly this case.
   */
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
        // Remote check failed/timed out — fall through and re-resolve below
        // rather than trusting a stale id we can't currently verify.
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Failed to create Mailgun inbound route (HTTP ${res.status})`);
    }
    return data.route.id;
  }

  /**
   * The default way to connect a domain: paste the Mailgun API key you
   * already use to send from this domain (the same one that works with a
   * plain `curl --user "api:KEY" .../messages` call), we immediately prove
   * it works with one real test send, then hand you a one-time code to
   * prove receiving works too. No dependency on Mailgun's domain-creation
   * or domain-state API at all.
   */
  async connectWithKey(userId: string, domainName: string, mailgunApiKey: string, region: string | null, testRecipientEmail: string) {
    const cleanDomain = domainName.toLowerCase().trim();

    const existing = await prisma.domain.findFirst({ where: { userId, domainName: cleanDomain } });
    if (existing) throw new Error('This domain is already connected to your account');

    const domain = await prisma.domain.create({
      data: {
        userId,
        domainName: cleanDomain,
        status: 'pending_setup',
        mailgunApiKeyEncrypted: encrypt(mailgunApiKey),
        mailgunRegion: region || null,
      },
    });

    // Keep the domain row (with its key) even if the test fails, so the
    // user can fix whatever was wrong (bad key, wrong domain/region) and
    // retry via runSendTest, instead of losing the entry on a typo.
    const updated = await this.runSendTest(userId, domain.id, testRecipientEmail);
    return this.sanitize(updated);
  }

  /** Re-runs the send test for an already-connected domain (e.g. after fixing a typo'd key). */
  async runSendTest(userId: string, domainId: string, testRecipientEmail: string) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');
    if (!domain.mailgunApiKeyEncrypted) throw new Error('No Mailgun API key is set for this domain');

    const key = tryDecrypt(domain.mailgunApiKeyEncrypted);
    if (!key) throw new Error('Could not decrypt the stored Mailgun key — please reconnect this domain with the key again');

    await this.sendTestEmail(domain.domainName, key, domain.mailgunRegion, testRecipientEmail);

    const receivingTestCode = generateCode();
    const receivingTestAddress = `connectivity@${domain.domainName}`;

    // Best-effort: automatically wire up the inbound route so the
    // receiving test above actually has somewhere to land — see
    // ensureInboundRoute()'s docstring for why a failure here does not
    // fail the send test itself.
    let routeId = domain.routeId ?? undefined;
    try {
      routeId = await this.ensureInboundRoute(domain.id, domain.domainName, key, domain.mailgunRegion);
    } catch (err: any) {
      logger.error(
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

  /** Resets the receiving test with a fresh code — use if the first attempt expired or the user wants to retry. */
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

  /** Frontend polls this after asking the user to send the test email — the actual confirmation is set by the inbound webhook, see webhooks.service.ts. */
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

  /** Internal use only (e.g. by emailQueue/webhooks services) — includes the encrypted key. Never expose this to a client. */
  async getDomainRaw(domainId: string) {
    return prisma.domain.findUnique({ where: { id: domainId } });
  }

  /** Resolves the Authorization header + base URL to use for a given domain's Mailgun calls. */
  getMailgunContextForDomain(domain: { mailgunApiKeyEncrypted?: string | null; mailgunRegion?: string | null }): { authHeader: string; baseUrl: string } {
    const key = tryDecrypt(domain.mailgunApiKeyEncrypted) || process.env.MAILGUN_API_KEY;
    if (!key) throw new Error('No Mailgun API key available for this domain');
    return { authHeader: this.authHeaderFor(key), baseUrl: this.baseUrlFor(domain.mailgunRegion) };
  }

  async deleteDomain(userId: string, domainId: string) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');
    // Senders + CampaignSender links cascade-delete via the schema's onDelete: Cascade.
    await prisma.domain.delete({ where: { id: domainId } });
  }
}

export const domainService = new DomainService();