export interface EspAttachment {
  filename: string;
  url: string;
  contentType?: string;
}

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
  attachments?: EspAttachment[];
  /** Disable ESP link/open tracking (essential for OTP & auth verification links). */
  disableTracking?: boolean;
  /** Optional direct Mailgun key override for platform transactional dispatches. */
  rawApiKey?: string;
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