import dns from 'dns';
import prisma from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { planGuardService } from './billing/planGuard.service';

export interface DnsInspectionReport {
  domainName: string;
  spf: { verified: boolean; record: string | null };
  dkim: { verified: boolean; matchedSelector: string | null; record: string | null };
  mx: { verified: boolean; records: { exchange: string; priority: number }[] };
  dmarc: { verified: boolean; policy: 'none' | 'quarantine' | 'reject' | 'missing'; record: string | null };
  tracking: {
    configuredHostname: string | null;
    verified: boolean;
    cnameTarget: string | null;
  };
}

const COMMON_DKIM_SELECTORS = [
  'pic',
  'k1',
  'k2',
  'mailo',
  'smtp',
  'mx',
  's1',
  's2',
  'resend',
  'google',
  'selector1',
  'default',
];

export class DnsService {
  private expectedTrackingTarget(): string {
    if (env.CLOUDFLARE_SAAS_FALLBACK_ORIGIN) {
      return env.CLOUDFLARE_SAAS_FALLBACK_ORIGIN.trim().toLowerCase();
    }
    try {
      return new URL(env.APP_URL || 'https://midas-aem.vercel.app').hostname.toLowerCase();
    } catch {
      return 'midas-aem.vercel.app';
    }
  }

  async inspectDomainDns(userId: string, domainId: string, customDkimSelector?: string): Promise<DnsInspectionReport> {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');

    const cleanDomain = domain.domainName.trim().toLowerCase();

    // 1. SPF TXT Inspection
    let spfRecord: string | null = null;
    try {
      const txts = await dns.promises.resolveTxt(cleanDomain);
      const flatRecords = txts.map((chunks) => chunks.join(''));
      spfRecord = flatRecords.find((r) => r.toLowerCase().startsWith('v=spf1')) || null;
    } catch {}
    const spfVerified = Boolean(spfRecord);

    // 2. MX Inspection
    let mxRecords: { exchange: string; priority: number }[] = [];
    try {
      mxRecords = await dns.promises.resolveMx(cleanDomain);
    } catch {}
    const mxVerified = mxRecords.length > 0;

    // 3. DKIM Inspection across common ESP selectors
    const selectorsToProbe = customDkimSelector
      ? [customDkimSelector.trim(), ...COMMON_DKIM_SELECTORS]
      : COMMON_DKIM_SELECTORS;

    let dkimVerified = false;
    let matchedSelector: string | null = null;
    let dkimRecord: string | null = null;

    for (const selector of selectorsToProbe) {
      try {
        const fqdn = `${selector}._domainkey.${cleanDomain}`;
        const txts = await dns.promises.resolveTxt(fqdn);
        const flat = txts.map((c) => c.join('')).join(' ');
        if (flat.includes('p=') || flat.toLowerCase().includes('v=dkim1')) {
          dkimVerified = true;
          matchedSelector = selector;
          dkimRecord = flat;
          break;
        }
      } catch {
        try {
          const fqdn = `${selector}._domainkey.${cleanDomain}`;
          const cnames = await dns.promises.resolveCname(fqdn);
          if (cnames.length > 0) {
            dkimVerified = true;
            matchedSelector = selector;
            dkimRecord = `CNAME -> ${cnames[0]}`;
            break;
          }
        } catch {}
      }
    }

    // 4. DMARC Inspection (subdomain then root fallback)
    let dmarcRecord: string | null = null;
    let dmarcPolicy: 'none' | 'quarantine' | 'reject' | 'missing' = 'missing';
    const checkDmarcHost = async (host: string) => {
      const txts = await dns.promises.resolveTxt(`_dmarc.${host}`);
      const flat = txts.map((c) => c.join('')).join(' ');
      const match = flat.match(/p=(none|quarantine|reject)/i);
      return { flat, policy: match ? (match[1].toLowerCase() as any) : 'none' };
    };

    try {
      const res = await checkDmarcHost(cleanDomain);
      dmarcRecord = res.flat;
      dmarcPolicy = res.policy;
    } catch {
      const parts = cleanDomain.split('.');
      if (parts.length > 2) {
        try {
          const root = parts.slice(-2).join('.');
          const res = await checkDmarcHost(root);
          dmarcRecord = res.flat;
          dmarcPolicy = res.policy;
        } catch {}
      }
    }

    // 5. Tracking CNAME Inspection
    const configuredHostname = domain.trackingDomain || `track.${cleanDomain}`;
    let cnameTarget: string | null = null;
    let trackingVerified = false;
    try {
      const cnames = await dns.promises.resolveCname(configuredHostname);
      if (cnames.length > 0) {
        cnameTarget = cnames[0].toLowerCase();
        const expected = this.expectedTrackingTarget();
        trackingVerified =
          cnameTarget === expected ||
          cnameTarget.endsWith('.mailgun.org') ||
          cnameTarget.endsWith('.vercel-dns.com') ||
          cnameTarget.includes('midas');
      }
    } catch {}

    await prisma.domain.update({
      where: { id: domain.id },
      data: {
        spfStatus: spfVerified,
        dkimStatus: dkimVerified,
        mxStatus: mxVerified,
        dmarcPolicy,
        trackingStatus: trackingVerified,
        ...(domain.trackingDomain && trackingVerified ? { trackingHostnameStatus: 'active' } : {}),
      },
    });

    return {
      domainName: cleanDomain,
      spf: { verified: spfVerified, record: spfRecord },
      dkim: { verified: dkimVerified, matchedSelector, record: dkimRecord },
      mx: { verified: mxVerified, records: mxRecords },
      dmarc: { verified: dmarcPolicy !== 'missing', policy: dmarcPolicy, record: dmarcRecord },
      tracking: {
        configuredHostname: domain.trackingDomain || null,
        verified: trackingVerified,
        cnameTarget,
      },
    };
  }

  /**
   * Configures a custom branded tracking CNAME (e.g. `track.clientdomain.com`),
   * gated by PlanGuard and optionally registering via Cloudflare for SaaS Custom Hostnames.
   */
  async configureTrackingDomain(userId: string, domainId: string, rawHostname: string) {
    await planGuardService.assertFeatureAccess(userId, 'allowCustomTrackingDomain');

    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');

    const cleanHost = rawHostname.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!cleanHost || !cleanHost.includes('.')) {
      throw new Error('Provide a valid subdomain hostname, e.g. track.yourdomain.com');
    }

    let cfStatus: string = 'pending';
    let cfWarning: string | null = null;

    if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ZONE_ID) {
      try {
        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              hostname: cleanHost,
              ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
            }),
            signal: AbortSignal.timeout(10_000),
          }
        );
        const cfData: any = await cfRes.json().catch(() => ({}));
        if (cfRes.ok && cfData.success) {
          cfStatus = cfData.result?.status === 'active' ? 'active' : 'pending';
        } else {
          cfWarning = cfData.errors?.[0]?.message || 'Cloudflare custom hostname queued manually';
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, cleanHost }, 'Cloudflare SaaS custom hostname API call failed');
        cfWarning = err?.message;
      }
    }

    const expectedTarget = this.expectedTrackingTarget();
    let cnameResolved = false;
    try {
      const cnames = await dns.promises.resolveCname(cleanHost);
      if (cnames.some((c) => c.toLowerCase().includes(expectedTarget) || c.toLowerCase().includes('vercel'))) {
        cnameResolved = true;
        cfStatus = 'active';
      }
    } catch {}

    await prisma.domain.update({
      where: { id: domain.id },
      data: {
        trackingDomain: cleanHost,
        trackingHostnameStatus: cfStatus,
        trackingStatus: cnameResolved,
      },
    });

    return {
      trackingDomain: cleanHost,
      expectedCnameTarget: expectedTarget,
      status: cfStatus,
      cnameVerified: cnameResolved,
      warning: cfWarning,
    };
  }
}

export const dnsService = new DnsService();