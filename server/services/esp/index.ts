import { ESPProvider, EspSendPayload, EspSendResult } from './types';
import { MailgunProvider } from './mailgun.provider';
import { ResendProvider } from './resend.provider';
import { SmtpProvider } from './smtp.provider';

const PROVIDERS: Record<string, ESPProvider> = {
  mailgun: new MailgunProvider(),
  resend: new ResendProvider(),
  smtp: new SmtpProvider(),
};

export class EspRouterService {
  getProvider(espName?: string | null): ESPProvider {
    const key = (espName || 'mailgun').toLowerCase();
    return PROVIDERS[key] || PROVIDERS.mailgun;
  }

  async send(payload: EspSendPayload): Promise<EspSendResult> {
    const provider = this.getProvider(payload.domain?.espProvider);
    return provider.send(payload);
  }
}

export const espRouter = new EspRouterService();