import { logger } from '../config/logger';

export class EmailService {
  private readonly baseUrl = 'https://api.mailgun.net/v3';

  private get authHeader() {
    if (!process.env.MAILGUN_API_KEY) throw new Error('MAILGUN_API_KEY is not set in environment');
    return `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`;
  }

  async sendEmailNow(
    domain: any, 
    to: string,
    subject: string,
    html: string,
    text: string,
    outboundEmailId: string,
    senderName?: string | null,
    inReplyTo?: string | null
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const localPart = domain.senderLocalPart || 'hello';
      const fromEmail = `${localPart}@${domain.domainName}`;
      const fromHeader = senderName ? `"${senderName}" <${fromEmail}>` : fromEmail;

      const apiKey = process.env.MAILGUN_API_KEY;

      // Sandbox Mock Sending
      if (!apiKey || apiKey === 'mock') {
        logger.info({ to, from: fromHeader }, 'Mailgun Key is mock. Simulating email dispatch.');
        return { success: true, messageId: `mock-msg-${Date.now()}@${domain.domainName}` };
      }

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

      // RFC 8058 One-Click List-Unsubscribe Headers (Deliverability Compliance)
      formData.append('h:List-Unsubscribe', `<mailto:unsubscribe@${domain.domainName}?subject=unsubscribe>`);
      formData.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

      if (inReplyTo) {
        const cleanReplyId = inReplyTo.replace(/^<|>$/g, '').trim();
        formData.append('h:In-Reply-To', `<${cleanReplyId}>`);
        formData.append('h:References', `<${cleanReplyId}>`);
      }

      const res = await fetch(`${this.baseUrl}/${domain.domainName}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
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