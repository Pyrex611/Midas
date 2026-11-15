import { ESPProvider, EspSendPayload, EspSendResult } from './types';
import { tryDecrypt } from '../../lib/encryption';

interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export class SmtpProvider implements ESPProvider {
  readonly name = 'smtp';

  private loadNodemailer(): any {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('nodemailer');
    } catch {
      throw new Error(
        'Custom SMTP provider requires the "nodemailer" package to be installed (`npm install nodemailer`).'
      );
    }
  }

  async send(payload: EspSendPayload): Promise<EspSendResult> {
    const { domain, fromEmail, fromHeader, to, subject, html, text, inReplyTo, unsubscribeUrl, attachments } = payload;

    const rawConfig = tryDecrypt(domain.smtpConfigEncrypted);
    if (!rawConfig) {
      throw new Error('SMTP credentials missing or failed decryption for this domain');
    }

    const creds: SmtpCredentials = JSON.parse(rawConfig);
    const nodemailer = this.loadNodemailer();

    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: Number(creds.port) || 587,
      secure: Boolean(creds.secure),
      auth: {
        user: creds.user,
        pass: creds.pass,
      },
      connectionTimeout: 8_000,
      socketTimeout: 10_000,
    });

    const headers: Record<string, string> = {};
    if (unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    if (inReplyTo) {
      const cleanId = inReplyTo.replace(/^<|>$/g, '').trim();
      headers['In-Reply-To'] = `<${cleanId}>`;
      headers['References'] = `<${cleanId}>`;
    }

    const info = await transporter.sendMail({
      from: fromHeader,
      replyTo: fromEmail,
      to,
      subject,
      text,
      html,
      headers: Object.keys(headers).length ? headers : undefined,
      attachments: attachments?.length
        ? attachments.map((a) => ({ filename: a.filename, path: a.url, contentType: a.contentType }))
        : undefined,
    });

    const cleanId = (info.messageId || '').replace(/^<|>$/g, '').trim();
    return { success: true, messageId: cleanId || undefined };
  }
}