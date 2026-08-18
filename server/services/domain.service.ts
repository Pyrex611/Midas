import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export class DomainService {
  private readonly baseUrl = 'https://api.mailgun.net/v3';
  
  private get authHeader() {
    if (!process.env.MAILGUN_API_KEY) throw new Error('MAILGUN_API_KEY is not set in .env');
    return `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`;
  }

  async addDomain(userId: string, domainName: string, senderLocalPart: string = 'hello') {
    const cleanDomain = domainName.toLowerCase().trim();
    const apiKey = process.env.MAILGUN_API_KEY;

    // Sandbox/Mock Fallback Mode if keys are not live or set to 'mock'
    if (!apiKey || apiKey === 'mock') {
      logger.info({ domainName }, 'Mailgun API key is unconfigured or mock. Simulating domain addition.');

      return prisma.domain.create({
        data: {
          userId,
          domainName: cleanDomain,
          senderLocalPart: senderLocalPart || 'hello',
          status: 'unverified',
          dnsRecords: JSON.stringify({
            receiving: [
              { record_type: 'MX', name: cleanDomain, value: 'mxa.mailgun.org', valid: 'unverified' },
              { record_type: 'MX', name: cleanDomain, value: 'mxb.mailgun.org', valid: 'unverified' }
            ],
            sending: [
              { record_type: 'TXT', name: cleanDomain, value: 'v=spf1 include:mailgun.org ~all', valid: 'unverified' },
              { record_type: 'TXT', name: `krs._domainkey.${cleanDomain}`, value: 'k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3S...', valid: 'unverified' },
              { record_type: 'CNAME', name: `email.${cleanDomain}`, value: 'mailgun.org', valid: 'unverified' }
            ]
          }),
          dailyLimit: 20,
          warmupDay: 1
        }
      });
    }
    
    const formData = new URLSearchParams();
    formData.append('name', cleanDomain);
    formData.append('spam_action', 'tag');
    formData.append('wildcard', 'false');

    try {
      const mgRes = await fetch(`${this.baseUrl}/domains`, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const mgData = await mgRes.json();
      if (!mgRes.ok) throw new Error(mgData.message || 'Failed to register domain with Mailgun');

      const domain = await prisma.domain.create({
        data: {
          userId,
          domainName: cleanDomain,
          senderLocalPart: senderLocalPart || 'hello',
          status: 'unverified',
          dnsRecords: JSON.stringify({
            receiving: mgData.receiving_dns_records || [],
            sending: mgData.sending_dns_records || []
          }),
          dailyLimit: 20,
          warmupDay: 1
        }
      });

      return domain;
    } catch (error: any) {
      logger.error({ error: error.message, domainName }, 'Failed to add domain');
      throw error;
    }
  }

  async verifyDomain(userId: string, domainId: string) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');

    const apiKey = process.env.MAILGUN_API_KEY;

    if (!apiKey || apiKey === 'mock') {
      logger.info({ domainId }, 'Simulating DNS verification.');
      
      const records = domain.dnsRecords ? JSON.parse(domain.dnsRecords) : { receiving: [], sending: [] };
      const verifiedReceiving = (records.receiving || []).map((r: any) => ({ ...r, valid: 'valid' }));
      const verifiedSending = (records.sending || []).map((r: any) => ({ ...r, valid: 'valid' }));

      return prisma.domain.update({
        where: { id: domainId },
        data: {
          status: 'active',
          spfStatus: true,
          dkimStatus: true,
          mxStatus: true,
          trackingStatus: true,
          dnsRecords: JSON.stringify({
            receiving: verifiedReceiving,
            sending: verifiedSending
          })
        }
      });
    }

    try {
      const mgRes = await fetch(`${this.baseUrl}/domains/${domain.domainName}/verify`, {
        method: 'PUT',
        headers: { 'Authorization': this.authHeader }
      });

      const mgData = await mgRes.json();
      if (!mgRes.ok) throw new Error('Failed to verify domain with Mailgun');

      const isActive = mgData.domain.state === 'active';
      const spfState = mgData.receiving_dns_records?.find((r: any) => r.record_type === 'TXT' && r.value.includes('v=spf1'))?.valid === 'valid';
      const dkimState = mgData.sending_dns_records?.find((r: any) => r.record_type === 'TXT' && r.name.includes('domainkey'))?.valid === 'valid';
      const mxState = mgData.receiving_dns_records?.find((r: any) => r.record_type === 'MX')?.valid === 'valid';
      const trackingState = mgData.sending_dns_records?.find((r: any) => r.record_type === 'CNAME')?.valid === 'valid';

      return prisma.domain.update({
        where: { id: domainId },
        data: {
          status: isActive ? 'active' : 'unverified',
          spfStatus: !!spfState,
          dkimStatus: !!dkimState,
          mxStatus: !!mxState,
          trackingStatus: !!trackingState,
          dnsRecords: JSON.stringify({
            receiving: mgData.receiving_dns_records || [],
            sending: mgData.sending_dns_records || []
          })
        }
      });
    } catch (error: any) {
      logger.error({ error: error.message, domainId }, 'Failed to verify domain');
      throw error;
    }
  }

  async getDomains(userId: string) {
    return prisma.domain.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteDomain(userId: string, domainId: string) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId } });
    if (!domain) throw new Error('Domain not found');

    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey || apiKey === 'mock') {
      await prisma.domain.delete({ where: { id: domainId } });
      return;
    }

    try {
      await fetch(`${this.baseUrl}/domains/${domain.domainName}`, {
        method: 'DELETE',
        headers: { 'Authorization': this.authHeader }
      });

      await prisma.domain.delete({ where: { id: domainId } });
    } catch (error: any) {
      logger.error({ error: error.message, domainId }, 'Failed to delete domain');
      throw error;
    }
  }
}

export const domainService = new DomainService();