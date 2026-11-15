export interface EspSendPayload {
  domain: any;
  fromEmail: string;
  fromHeader: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  outboundEmailId: string;
  inReplyTo?: string | null;
  unsubscribeUrl?: string | null;
  isColdOutreach: boolean;
}

export interface EspSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ESPProvider {
  readonly name: string;
  send(payload: EspSendPayload): Promise<EspSendResult>;
}