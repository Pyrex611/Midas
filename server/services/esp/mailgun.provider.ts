import { ESPProvider, EspSendPayload, EspSendResult } from './types';
import { domainService } from '../domain.service';

export class MailgunProvider implements ESPProvider {
  readonly name = 'mailgun';

  async send(payload: EspSendPayload): Promise<EspSendResult> {
    const { domain, fromEmail, fromHeader, to, subject, html, text, outboundEmailId, inReplyTo, unsubscribeUrl } = payload;
    const { authHeader, baseUrl } = domainService.getMailgunContextForDomain(domain);

    const formData = new URLSearchParams();
    formData.append('from', fromHeader);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('text', text);
    formData.append('html', html);
    formData.append('v:outbound_email_id', outboundEmailId);
    if (domain.id) {
      formData.append('v:domain_id', domain.id);
    }
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
        Authorization: authHeader,
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
    return { success: true, messageId: cleanMessageId };
  }
}