import { logger } from '../config/logger';
import { encodeOpenToken, encodeClickToken } from '../lib/tracking';
import { emailTemplateService, BrandEnvelopeOptions } from './emailTemplate.service';
import { espRouter } from './esp';
import { EspAttachment } from './esp/types';

export class EmailService {
  private trackingBaseUrl(domain?: any): string {
    if (domain?.trackingDomain && domain?.trackingHostnameStatus === 'active') {
      return `https://${domain.trackingDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
    }
    const configured = process.env.APP_URL;
    if (configured) return configured.replace(/\/$/, '');
    return 'https://midas-aem.vercel.app';
  }

  private instrumentHtmlTracking(
    html: string,
    outboundEmailId: string,
    leadId: string,
    campaignId?: string | null,
    domain?: any
  ): string {
    const baseUrl = this.trackingBaseUrl(domain);

    const parts = html.split(/(<[^>]+>)/g);
    let insideAnchor = false;
    const autoLinkedHtml = parts
      .map((part) => {
        if (part.startsWith('<')) {
          if (/^<a\b/i.test(part)) insideAnchor = true;
          else if (/^<\/a>/i.test(part)) insideAnchor = false;
          return part;
        }
        if (insideAnchor) return part;
        return part.replace(/https?:\/\/[^\s<>"')]+/gi, (rawUrl) => {
          const match = rawUrl.match(/^(.*?)([.,;:!?]+)?$/);
          const cleanUrl = match?.[1] || rawUrl;
          const trailing = match?.[2] || '';
          if (
            cleanUrl.includes('/api/unsubscribe/') ||
            cleanUrl.includes('/api/public/town-crier/recipients/')
          ) {
            return rawUrl;
          }
          return `<a href="${cleanUrl}">${cleanUrl}</a>${trailing}`;
        });
      })
      .join('');

    const trackedHtml = autoLinkedHtml.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
      (match, _quote, originalUrl) => {
        const cleanUrl = originalUrl.trim();
        if (
          cleanUrl.startsWith('mailto:') ||
          cleanUrl.startsWith('tel:') ||
          cleanUrl.startsWith('#') ||
          cleanUrl.includes('/api/unsubscribe/') ||
          cleanUrl.includes('/api/public/town-crier/recipients/')
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

    const openToken = encodeOpenToken({
      outboundEmailId,
      leadId,
      campaignId,
    });
    const pixelUrl = `${baseUrl}/api/track/open/${openToken}`;
    const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none!important;max-height:0;max-width:0;opacity:0;overflow:hidden" alt="" />`;

    if (trackedHtml.includes('</body>')) {
      return trackedHtml.replace('</body>', `${pixelTag}\n</body>`);
    }

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
    trackingContext?: { leadId: string; campaignId?: string | null },
    brandOptions?: BrandEnvelopeOptions,
    attachments?: EspAttachment[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const localPart = domain.senderLocalPart || 'hello';
      const fromEmail = `${localPart}@${domain.domainName}`;
      const fromHeader = senderName ? `"${senderName}" <${fromEmail}>` : fromEmail;

      let finalHtml = html;
      if (brandOptions?.brandingEnabled || brandOptions?.templateStyle) {
        finalHtml = emailTemplateService.wrapInBrandTemplate(html, brandOptions);
      }

      if (trackingContext?.leadId) {
        finalHtml = this.instrumentHtmlTracking(
          finalHtml,
          outboundEmailId,
          trackingContext.leadId,
          trackingContext.campaignId,
          domain
        );
      }

      const isColdOutreach = !outboundEmailId.startsWith('tc_');

      const result = await espRouter.send({
        domain,
        fromEmail,
        fromHeader,
        to,
        subject,
        html: finalHtml,
        text,
        outboundEmailId,
        inReplyTo,
        unsubscribeUrl,
        isColdOutreach,
        attachments,
      });

      if (result.success) {
        logger.info(
          { messageId: result.messageId, to, domain: domain.domainName, esp: domain.espProvider || 'mailgun' },
          'Email sent via ESP router'
        );
      }
      return result;
    } catch (error: any) {
      logger.error({ error: error.message, to, domain: domain.domainName }, 'ESP Dispatch Error');
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();