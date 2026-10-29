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

      // RFC 8058 One-Click List-Unsubscribe
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