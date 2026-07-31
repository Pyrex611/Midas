import { logger } from '../config/logger';

export class EmailService {
  private readonly baseUrl = 'https://api.mailgun.net/v3';

  private get authHeader() {
    if (!process.env.MAILGUN_API_KEY) throw new Error('MAILGUN_API_KEY is not set');
    return `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`;
  }

  async sendEmailNow(
    domain: any, 
    to: string,
    subject: string,
    html: string,
    text: string,
    outboundEmailId: string, // Used to map webhooks back to our DB
    senderName?: string | null,
    inReplyTo?: string | null
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const fromEmail = `hello@${domain.domainName}`;
      const fromHeader = senderName ? `"${senderName}" <${fromEmail}>` : fromEmail;

      const formData = new URLSearchParams();
      formData.append('from', fromHeader);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('text', text);
      formData.append('html', html);
      
      // Crucial: Pass our DB ID to Mailgun so it returns it in Webhooks
      formData.append('v:outbound_email_id', outboundEmailId);
      
      // Strict Tracking via Custom Domain (requires CNAME setup in Phase 2)
      formData.append('o:tracking', 'yes');
      formData.append('o:tracking-clicks', 'yes');
      formData.append('o:tracking-opens', 'yes');

      // Threading & RFC Compliance
      formData.append('h:Reply-To', fromEmail);
      if (inReplyTo) {
        formData.append('h:In-Reply-To', inReplyTo);
        formData.append('h:References', inReplyTo);
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

      logger.info({ messageId: data.id, to, domain: domain.domainName }, 'Email sent via Mailgun');
      return { success: true, messageId: data.id };
    } catch (error: any) {
      logger.error({ error: error.message, to, domain: domain.domainName }, 'Mailgun API Error');
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();