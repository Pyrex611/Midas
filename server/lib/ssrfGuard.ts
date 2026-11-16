import dns from 'dns';
import net from 'net';

export function isPrivateIpAddress(ip: string): boolean {
  let cleanIp = ip.trim().toLowerCase();
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.slice(7);
  }

  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // Cloud metadata / link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // Multicast / reserved
    return false;
  }

  if (net.isIPv6(cleanIp)) {
    if (cleanIp === '::' || cleanIp === '::1') return true;
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return true; // ULA
    if (cleanIp.startsWith('fe80:') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) {
      return true; // Link-local
    }
    return false;
  }

  return true;
}

export function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.arpa') ||
    h === 'metadata.google.internal'
  ) {
    return true;
  }
  if (net.isIP(h)) {
    return isPrivateIpAddress(h);
  }
  return false;
}

/**
 * Validates that a user-supplied URL is strictly public HTTP/HTTPS
 * and that none of its resolved DNS A/AAAA records point to internal/private IPs.
 */
export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid URL format. Include https:// or http://');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http:// and https:// URLs are permitted');
  }

  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new Error('Private, loopback, or internal hostnames are not allowed');
  }

  try {
    const records = await dns.promises.lookup(parsed.hostname.replace(/^\[|\]$/g, ''), { all: true });
    for (const rec of records) {
      if (isPrivateIpAddress(rec.address)) {
        throw new Error('Target hostname resolves to a restricted private or metadata IP address');
      }
    }
  } catch (err: any) {
    if (err.message?.includes('restricted private')) throw err;
    throw new Error(`Could not verify public DNS for hostname "${parsed.hostname}"`);
  }

  return parsed;
}