import { logger } from '../config/logger';
import { domainService } from './domain.service';
import { encodeOpenToken, encodeClickToken } from '../lib/tracking';

export class EmailService {
  private appBaseUrl(): string {
    const configured = process.env.APP_URL;
    if (configured) return configured.replace(/\/$/, '');
    return 'https://midas-aem.vercel.app';
  }

  private instrumentHtmlTracking(
    html: string,
    outboundEmailId: string,
    leadId: string,
    campaignId?: string | null
  ): string {
    const baseUrl = this.appBaseUrl();

    // 1. Rewrite hyperlinks (exclude mailto:, tel:, #, and unsubscribe links)
    const trackedHtml = html.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
      (match, quote, originalUrl) => {
        const cleanUrl = originalUrl.trim();
        if (
          cleanUrl.startsWith('mailto:') ||
          cleanUrl.startsWith('tel:') ||
          cleanUrl.startsWith('#') ||
          cleanUrl.includes('/api/unsubscribe/')
        ) {
          return match;
        }

        const clickToken = encodeClickToken({
          outboundEmailId,
          leadId,
          campaignId,
          targetUrl: cleanUrl,
        });

        const trackingRedirectUrl = `${baseUrl}/api/track/click/${clickToken}`;
        return match.replace(originalUrl, trackingRedirectUrl);
      }
    );

    // 2. Append Open Tracking Pixel
    const openToken = encodeOpenToken({
      outboundEmailId,
      leadId,
      campaignId,
    });
    const pixelUrl = `${baseUrl}/api/track/open/${openToken}`;
    const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none!important;max-height:0;max-width:0;opacity:0;overflow:hidden" alt="" />`;

    return `${trackedHtml}\n${pixelTag}`;
  }

  async sendEmailNow(
    domain: any,
    to: string,
    subject: string,
    html: string,
    text: string,
    outboundEmailId: string,
    senderName?: string | null,
    inReplyTo?: string | null,
    unsubscribeUrl?: string | null,
    trackingContext?: { leadId: string; campaignId?: string | null }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const localPart = domain.senderLocalPart || 'hello';
      const fromEmail = `${localPart}@${domain.domainName}`;
      const fromHeader = senderName ? `"${senderName}" <${fromEmail}>` : fromEmail;

      const { authHeader, baseUrl } = domainService.getMailgunContextForDomain(domain);

      let finalHtml = html;
      if (trackingContext?.leadId) {
        finalHtml = this.instrumentHtmlTracking(
          html,
          outboundEmailId,
          trackingContext.leadId,
          trackingContext.campaignId
        );
      }

      const formData = new URLSearchParams();
      formData.append('from', fromHeader);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('text', text);
      formData.append('html', finalHtml);
      formData.append('v:outbound_email_id', outboundEmailId);
      formData.append('o:tracking', 'yes');
      formData.append('o:tracking-clicks', 'yes');
      formData.append('o:tracking-opens', 'yes');
      formData.append('h:Reply-To', fromEmail);

      if (unsubscribeUrl) {
        formData.append('h:List-Unsubscribe', `<${unsubscribeUrl}>`);
        formData.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
      }

      if (inReplyTo) {
        const cleanReplyId = inReplyTo.replace(/^<|>$/g, '').trim();
        formData.append('h:In-Reply-To', `<${cleanReplyId}>`);
        formData.append('h:References', `<${cleanReplyId}>`);
      }

      const res = await fetch(`${baseUrl}/${domain.domainName}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      const rawText = await res.text();
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { data = { message: rawText }; }

      if (!res.ok) {
        throw new Error(data.message || `Mailgun rejected sending (HTTP ${res.status})`);
      }

      const cleanMessageId = (data.id || '').replace(/^<|>$/g, '').trim();
      logger.info({ messageId: cleanMessageId, to, domain: domain.domainName }, 'Email sent via Mailgun');
      return { success: true, messageId: cleanMessageId };
    } catch (error: any) {
      logger.error({ error: error.message, to, domain: domain.domainName }, 'Mailgun API Error');
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();