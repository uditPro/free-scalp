import { lookup } from 'node:dns/promises';
import { safeUrl } from './validation';

export type HomepageMetadata = {
  normalizedKey: string;
  destinationUrl: string;
  displayName: string;
  description: string;
  logoUrl: string | null;
  metadataStatus: 'fetched' | 'fallback';
};

function decodeHtml(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'nbsp') return ' ';
    const numeric = lower.startsWith('#x') ? Number.parseInt(lower.slice(2), 16) : lower.startsWith('#') ? Number.parseInt(lower.slice(1), 10) : NaN;
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : '';
  });
}

function clean(value: string | undefined, max: number) {
  return decodeHtml((value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max);
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match?.[1];
}

function metadataValue(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const property = attribute(tag, 'property') ?? attribute(tag, 'name');
    if (property?.toLowerCase() === key.toLowerCase()) return attribute(tag, 'content');
  }
  return undefined;
}

function absoluteAsset(value: string | undefined, base: string) {
  if (!value) return null;
  try {
    const resolved = new URL(value, base);
    return safeUrl(resolved.toString());
  } catch { return null; }
}

function normalizeWebsite(value: string) {
  const safe = safeUrl(value);
  if (!safe) throw new Error('Use a public HTTPS website.');
  const url = new URL(safe);
  url.search = '';
  url.hash = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  const destinationUrl = url.toString();
  return { normalizedKey: `website:${destinationUrl.toLowerCase()}`, destinationUrl };
}

function normalizeX(value: string) {
  const handle = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) throw new Error('Enter a valid X username.');
  return { normalizedKey: `x:${handle}`, destinationUrl: `https://x.com/${handle}`, handle };
}

async function fetchHtml(url: string) {
  let current = url;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await assertPublicHost(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { 'user-agent': 'ReachFlow metadata preview/1.0', accept: 'text/html,application/xhtml+xml' } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        const next = location ? safeUrl(new URL(location, current).toString()) : null;
        if (!next) throw new Error('Unsafe metadata redirect.');
        current = next;
        continue;
      }
      if (!response.ok) throw new Error(`Metadata request failed with ${response.status}.`);
      const type = response.headers.get('content-type') ?? '';
      if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('Destination is not an HTML page.');
      const html = (await response.text()).slice(0, 1500000);
      return { html, finalUrl: current };
    } finally { clearTimeout(timeout); }
  }
  throw new Error('Too many metadata redirects.');
}

function privateIpv4(value: string) {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && b >= 18 && b <= 19) || a >= 224;
}

function privateIp(value: string) {
  const lower = value.toLowerCase();
  if (privateIpv4(lower)) return true;
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb') || lower.startsWith('::ffff:127.') || lower.startsWith('::ffff:10.') || lower.startsWith('::ffff:192.168.') || lower.startsWith('::ffff:172.16.') || lower.startsWith('::ffff:172.17.') || lower.startsWith('::ffff:172.18.') || lower.startsWith('::ffff:172.19.') || lower.startsWith('::ffff:172.2') || lower.startsWith('::ffff:172.3') || lower.startsWith('2001:db8:');
}

async function assertPublicHost(value: string) {
  const hostname = new URL(value).hostname;
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(address => privateIp(address.address))) throw new Error('Metadata host is not public.');
}

function fallbackMetadata(input: { normalizedKey: string; destinationUrl: string; handle?: string }): HomepageMetadata {
  const label = input.handle ? `@${input.handle}` : new URL(input.destinationUrl).hostname.replace(/^www\./, '');
  return { normalizedKey: input.normalizedKey, destinationUrl: input.destinationUrl, displayName: label, description: 'Public website submitted for homepage promotion.', logoUrl: input.handle ? `https://unavatar.io/x/${input.handle}` : `${new URL(input.destinationUrl).origin}/favicon.ico`, metadataStatus: 'fallback' };
}

export async function resolveHomepageMetadata(input: { websiteUrl?: string; xUsername?: string }): Promise<HomepageMetadata> {
  const identity = input.websiteUrl ? normalizeWebsite(input.websiteUrl) : normalizeX(input.xUsername ?? '');
  try {
    const page = await fetchHtml(identity.destinationUrl);
    const title = clean(metadataValue(page.html, 'og:title') ?? metadataValue(page.html, 'twitter:title') ?? page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1], 140);
    const description = clean(metadataValue(page.html, 'og:description') ?? metadataValue(page.html, 'twitter:description') ?? metadataValue(page.html, 'description'), 320);
    const siteName = clean(metadataValue(page.html, 'og:site_name'), 120);
    const image = absoluteAsset(metadataValue(page.html, 'og:image') ?? metadataValue(page.html, 'twitter:image') ?? metadataValue(page.html, 'twitter:image:src'), page.finalUrl);
    const iconTag = (page.html.match(/<link\b[^>]*>/gi) ?? []).find(tag => /(?:icon|apple-touch-icon)/i.test(attribute(tag, 'rel') ?? ''));
    const icon = absoluteAsset(attribute(iconTag ?? '', 'href'), page.finalUrl);
    const fallback = fallbackMetadata(identity);
    return { ...fallback, displayName: siteName || title || fallback.displayName, description: description || fallback.description, logoUrl: image || icon || fallback.logoUrl, metadataStatus: title || description || image || icon ? 'fetched' : 'fallback' };
  } catch { return fallbackMetadata(identity); }
}
