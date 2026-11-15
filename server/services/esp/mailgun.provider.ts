import { ESPProvider, EspSendPayload, EspSendResult } from './types';
import { domainService } from '../domain.service';

export class MailgunProvider implements ESPProvider {
  readonly name = 'mailgun';

  async send(payload: EspSendPayload): Promise<EspSendResult> {
    const { domain, fromEmail, fromHeader, to, subject, html, text, outboundEmailId, inReplyTo, unsubscribeUrl, attachments } = payload;
    const { authHeader, baseUrl } = domainService.getMailgunContextForDomain(domain);

    const hasAttachments = Boolean(attachments && attachments.length > 0);
    let bodyPayload: string | FormData;
    const headers: Record<string, string> = { Authorization: authHeader };

    if (hasAttachments) {
      const form = new FormData();
      form.append('from', fromHeader);
      form.append('to', to);
      form.append('subject', subject);
      form.append('text', text);
      form.append('html', html);
      form.append('v:outbound_email_id', outboundEmailId);
      if (domain.id) form.append('v:domain_id', domain.id);
      form.append('o:tracking', 'yes');
      form.append('o:tracking-clicks', 'yes');
      form.append('o:tracking-opens', 'yes');
      form.append('h:Reply-To', fromEmail);

      if (unsubscribeUrl) {
        form.append('h:List-Unsubscribe', `<${unsubscribeUrl}>`);
        form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
      }
      if (inReplyTo) {
        const cleanReplyId = inReplyTo.replace(/^<|>$/g, '').trim();
        form.append('h:In-Reply-To', `<${cleanReplyId}>`);
        form.append('h:References', `<${cleanReplyId}>`);
      }

      for (const att of attachments!) {
        const fileRes = await fetch(att.url, { signal: AbortSignal.timeout(8_000) });
        if (fileRes.ok) {
          const buf = await fileRes.arrayBuffer();
          form.append(
            'attachment',
            new Blob([buf], { type: att.contentType || fileRes.headers.get('content-type') || 'application/octet-stream' }),
            att.filename
          );
        }
      }

      bodyPayload = form;
    } else {
      const formData = new URLSearchParams();
      formData.append('from', fromHeader);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('text', text);
      formData.append('html', html);
      formData.append('v:outbound_email_id', outboundEmailId);
      if (domain.id) formData.append('v:domain_id', domain.id);
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

      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      bodyPayload = formData.toString();
    }

    const res = await fetch(`${baseUrl}/${domain.domainName}/messages`, {
      method: 'POST',
      headers,
      body: bodyPayload,
      signal: AbortSignal.timeout(12_000),
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