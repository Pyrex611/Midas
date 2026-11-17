import crypto from 'crypto';

export interface OpenTrackingPayload {
  outboundEmailId: string;
  leadId: string;
  campaignId?: string | null;
}

export interface ClickTrackingPayload extends OpenTrackingPayload {
  targetUrl: string;
}

export const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const EPHEMERAL_FALLBACK = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  const configured =
    process.env.ENCRYPTION_KEY ||
    process.env.CRON_SECRET ||
    process.env.CLERK_SECRET_KEY;

  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }

  if (process.env.DATABASE_URL) {
    return crypto.createHash('sha256').update(`tracking:${process.env.DATABASE_URL}`).digest('hex');
  }

  return EPHEMERAL_FALLBACK;
}

function signPayload(dataB64: string): string {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(dataB64)
    .digest('base64url');
}

function encodeSignedToken(payload: object): string {
  const jsonB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signPayload(jsonB64);
  return `${jsonB64}.${sig}`;
}

function decodeSignedToken<T>(token: string): T | null {
  try {
    const [jsonB64, sig] = token.split('.');
    if (!jsonB64 || !sig) return null;
    const expected = signPayload(jsonB64);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    return JSON.parse(Buffer.from(jsonB64, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function encodeOpenToken(payload: OpenTrackingPayload): string {
  return encodeSignedToken(payload);
}

export function decodeOpenToken(token: string): OpenTrackingPayload | null {
  return decodeSignedToken<OpenTrackingPayload>(token);
}

export function encodeClickToken(payload: ClickTrackingPayload): string {
  return encodeSignedToken(payload);
}

export function decodeClickToken(token: string): ClickTrackingPayload | null {
  return decodeSignedToken<ClickTrackingPayload>(token);
}

/**
 * Filters known security gateway scanners, image proxy pre-fetchers,
 * Apple Mail Privacy Protection (MPP) proxies (`17.0.0.0/8` + AppleWebKit),
 * and sub-4-second post-send automated gateway bursts.
 */
export function isBotScanner(
  userAgent: string = '',
  ip: string = '',
  sentAt?: Date | null
): boolean {
  const ua = userAgent.toLowerCase();
  const cleanIp = ip.trim();

  if (
    ua.includes('googleimageproxy') ||
    ua.includes('proofpoint') ||
    ua.includes('mimecast') ||
    ua.includes('barracuda') ||
    ua.includes('symantec') ||
    ua.includes('slackbot') ||
    ua.includes('facebookexternalhit') ||
    ua.includes('linkedinbot') ||
    ua.includes('whatsapp') ||
    ua.includes('headless') ||
    ua.includes('python-requests') ||
    ua.includes('curl/') ||
    ua.includes('wget/')
  ) {
    return true;
  }

  // Apple Mail Privacy Protection proxy pre-fetch detection (Apple AS714 17.0.0.0/8 block)
  if (cleanIp.startsWith('17.') && (ua.includes('mozilla/5.0') || ua.includes('applewebkit') || ua === '')) {
    return true;
  }

  // Immediate (< 4s) pre-fetch bursts triggered by corporate link/image scanners
  if (sentAt) {
    const elapsedMs = Date.now() - new Date(sentAt).getTime();
    if (elapsedMs >= 0 && elapsedMs < 4000) {
      return true;
    }
  }

  return false;
}