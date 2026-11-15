import { ESPProvider, EspSendPayload, EspSendResult } from './types';
import { tryDecrypt } from '../../lib/encryption';

export class ResendProvider implements ESPProvider {
  readonly name = 'resend';

  async send(payload: EspSendPayload): Promise<EspSendResult> {
    if (payload.isColdOutreach) {
      throw new Error(
        'Resend Acceptable Use Policy prohibits unsolicited cold outreach. ' +
        'Assign Mailgun or Custom SMTP to cold sequences, and reserve Resend domains for Town Crier newsletters.'
      );
    }

    const { domain, fromEmail, fromHeader, to, subject, html, text, outboundEmailId, inReplyTo, unsubscribeUrl } = payload;
    const apiKey = tryDecrypt(domain.mailgunApiKeyEncrypted);
    if (!apiKey) {
      throw new Error('Resend API key missing or could not be decrypted for this domain');
    }

    const headers: Record<string, string> = {};
    if (unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    if (inReplyTo) {
      const cleanReplyId = inReplyTo.replace(/^<|>$/g, '').trim();
      headers['In-Reply-To'] = `<${cleanReplyId}>`;
      headers['References'] = `<${cleanReplyId}>`;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [to],
        reply_to: fromEmail,
        subject,
        html,
        text,
        headers: Object.keys(headers).length ? headers : undefined,
        tags: [{ name: 'outbound_email_id', value: outboundEmailId }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Resend rejected email (HTTP ${res.status})`);
    }

    return { success: true, messageId: data.id || undefined };
  }
}