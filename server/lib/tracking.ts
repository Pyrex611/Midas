import crypto from 'crypto';

const SIGNING_SECRET = process.env.ENCRYPTION_KEY || process.env.CRON_SECRET || 'midas_default_telemetry_secret_32';

export interface OpenTrackingPayload {
  outboundEmailId: string;
  leadId: string;
  campaignId?: string | null;
}

export interface ClickTrackingPayload {
  outboundEmailId: string;
  leadId: string;
  campaignId?: string | null;
  targetUrl: string;
}

// RFC compliant 43-byte 1x1 transparent GIF
export const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function sign(data: string): string {
  return crypto.createHmac('sha256', SIGNING_SECRET).update(data).digest('hex').substring(0, 16);
}

export function encodeOpenToken(payload: OpenTrackingPayload): string {
  const jsonStr = JSON.stringify(payload);
  const base64 = Buffer.from(jsonStr).toString('base64url');
  const signature = sign(base64);
  return `${base64}.${signature}`;
}

export function decodeOpenToken(token: string): OpenTrackingPayload | null {
  try {
    const [base64, signature] = token.split('.');
    if (!base64 || !signature || sign(base64) !== signature) return null;
    const jsonStr = Buffer.from(base64, 'base64url').toString('utf8');
    return JSON.parse(jsonStr) as OpenTrackingPayload;
  } catch {
    return null;
  }
}

export function encodeClickToken(payload: ClickTrackingPayload): string {
  const jsonStr = JSON.stringify(payload);
  const base64 = Buffer.from(jsonStr).toString('base64url');
  const signature = sign(base64);
  return `${base64}.${signature}`;
}

export function decodeClickToken(token: string): ClickTrackingPayload | null {
  try {
    const [base64, signature] = token.split('.');
    if (!base64 || !signature || sign(base64) !== signature) return null;
    const jsonStr = Buffer.from(base64, 'base64url').toString('utf8');
    return JSON.parse(jsonStr) as ClickTrackingPayload;
  } catch {
    return null;
  }
}

export function isBotScanner(userAgent?: string): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return (
    ua.includes('googleimageproxy') ||
    ua.includes('barracuda') ||
    ua.includes('proofpoint') ||
    ua.includes('mimecast') ||
    ua.includes('virustotal') ||
    ua.includes('mailprefetch') ||
    ua.includes('crawler')
  );
}