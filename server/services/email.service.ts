import { logger } from '../config/logger';
import { domainService } from './domain.service';

export class EmailService {
  async sendEmailNow(
    domain: any, // a Domain row, with `senderLocalPart` set by the caller to the chosen Sender's local part
    to: string,
    subject: string,
    html: string,
    text: string,
    outboundEmailId: string,
    senderName?: string | null,
    inReplyTo?: string | null,
    unsubscribeUrl?: string | null
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const localPart = domain.senderLocalPart || 'hello';
      const fromEmail = `${localPart}@${domain.domainName}`;
      const fromHeader = senderName ? `"${senderName}" <${fromEmail}>` : fromEmail;

      const { authHeader, baseUrl } = domainService.getMailgunContextForDomain(domain);

      const formData = new URLSearchParams();
      formData.append('from', fromHeader);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('text', text);
      formData.append('html', html);
      formData.append('v:outbound_email_id', outboundEmailId);
      formData.append('o:tracking', 'yes');
      formData.append('o:tracking-clicks', 'yes');
      formData.append('o:tracking-opens', 'yes');
      formData.append('h:Reply-To', fromEmail);

      // RFC 8058 One-Click List-Unsubscribe. Previously this pointed at a
      // `mailto:unsubscribe@domain` address that nothing ever processed —
      // an inbound "unsubscribe" email would just sit there unread. Now it
      // points at a real HTTPS endpoint (server/routes/unsubscribe.routes.ts)
      // that actually marks the lead unsubscribed, which is what the
      // `List-Unsubscribe-Post: One-Click` header promises mail clients
      // (Gmail/Yahoo/etc. POST to this URL with no user confirmation when
      // the user clicks "Unsubscribe" in their own UI).
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
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
        // This is the send path every queued email and every auto-reply
        // goes through. Without a bound here, one stalled Mailgun call
        // doesn't just fail slowly — inside emailQueue.service.ts's batch
        // loop it stalls the REST of that invocation's up-to-15-email
        // batch too (eventually caught by requestTimeoutGuard/maxDuration,
        // but only after burning the whole window on a single send).
        signal: AbortSignal.timeout(10_000),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Mailgun sending failed');
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