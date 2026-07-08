import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

// ponytail: hand-rolled range check, add ipaddr.js if IPv6 CIDR coverage needs to grow
function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 0) return true; // "this" network
    return false;
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true; // loopback
    if (normalized === '::') return true;
    if (normalized.startsWith('fe80:')) return true; // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
    if (normalized.startsWith('::ffff:')) return isPrivateIp(normalized.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // not a resolvable IP literal — reject
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`Blocked private address: ${hostname}`);
    return;
  }
  const records = await lookup(hostname, { all: true });
  for (const { address } of records) {
    if (isPrivateIp(address)) throw new Error(`Blocked private address: ${hostname} -> ${address}`);
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50_000);
}

export async function fetchPageContent(
  url: string
): Promise<{ markdown?: string; html?: string } | null> {
  try {
    let currentUrl = url.startsWith('http') ? url : `https://${url}`;

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const parsed = new URL(currentUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      await assertPublicHost(parsed.hostname);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(parsed, {
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SuperEnrich/1.0)' },
        });
      } finally {
        clearTimeout(timer);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return null;
        currentUrl = new URL(location, parsed).toString();
        continue;
      }

      if (!response.ok) return null;

      const html = await response.text();
      const markdown = htmlToText(html);
      return { markdown, html: html.substring(0, 100_000) };
    }

    return null;
  } catch {
    return null;
  }
}
