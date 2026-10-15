import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { getDataDirectory } from '@/lib/dataDirectory';
import { TtlCache } from './cache';
import { decodeEntities } from './rss';
import { fetchBytes, fetchJson, httpUrl } from './outbound';

export interface Favicon { bytes: Uint8Array; contentType: string; ext: string }
export function sniffIcon(bytes: Uint8Array, contentType: string): Favicon | undefined {
  if (bytes.length > 256 * 1024 || !contentType.startsWith('image/')) return undefined;
  const starts = (...values: number[]) => values.every((v, i) => bytes[i] === v);
  const ascii = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  let ext: string | undefined, type: string | undefined;
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) { ext = 'png'; type = 'image/png'; }
  else if (starts(0, 0, 1, 0) && bytes.length >= 6) { ext = 'ico'; type = 'image/x-icon'; }
  else if (starts(255, 216, 255)) { ext = 'jpg'; type = 'image/jpeg'; }
  else if (/^GIF8[79]a$/.test(ascii(0, 6))) { ext = 'gif'; type = 'image/gif'; }
  else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') { ext = 'webp'; type = 'image/webp'; }
  else {
    const svg = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^\uFEFF/, '').trim();
    // Entities/DTDs are unnecessary for icons and can hide external references.
    if (!/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|\/?>)/i.test(svg) || /<!DOCTYPE|<!ENTITY|<\s*(?:[\w.-]+:)?(?:script|foreignObject|iframe|object|embed)\b|\bon[\w:-]+\s*=/i.test(svg)) return undefined;
    if (/\b(?:[\w.-]+:)?href\s*=\s*(?!["']#)["'][^"']*["']/i.test(svg) || /\b(?:[\w.-]+:)?href\s*=\s*[^\s"'>]/i.test(svg)) return undefined;
    if (/@import|url\s*\(\s*(?!["']?#)/i.test(svg)) return undefined;
    ext = 'svg'; type = 'image/svg+xml';
  }
  return { bytes, ext, contentType: type! };
}
function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]);
  return attrs;
}
export function iconLinks(html: string, pageUrl: string): { icons: string[]; manifest?: string } {
  const candidates: { url: string; score: number }[] = [];
  let manifest: string | undefined;
  const baseTag = /<base\b[^>]*>/i.exec(html);
  let base = pageUrl;
  try { if (baseTag) base = httpUrl(attributes(baseTag[0]).href, pageUrl).href; } catch { /* invalid base */ }
  for (const match of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<link\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
    const attrs = attributes(match[0]), rel = (attrs.rel ?? '').toLowerCase().split(/\s+/);
    if (!attrs.href) continue;
    try {
      const url = httpUrl(attrs.href, base).href;
      if (rel.includes('manifest')) { manifest ??= url; continue; }
      if (!rel.includes('icon') && !rel.includes('apple-touch-icon')) continue;
      const sizes = [...(attrs.sizes ?? '').matchAll(/(\d+)x(\d+)/gi)].map(m => Math.min(Number(m[1]), Number(m[2])));
      const size = Math.max(0, ...sizes);
      const svg = attrs.type === 'image/svg+xml' || /\.svg(?:[?#]|$)/i.test(url);
      const png = attrs.type === 'image/png' || /\.png(?:[?#]|$)/i.test(url);
      candidates.push({ url, score: svg ? 100000 : png && size >= 32 ? 1000 + Math.min(90000, size) : size });
    } catch { /* Ignore unsafe protocols/userinfo. */ }
  }
  return { icons: candidates.sort((a, b) => b.score - a.score).map(c => c.url), manifest };
}
interface Index { fetchedAt: number; ext?: string; contentType?: string }
const cachedIcons = new TtlCache<Favicon | null>(60000, 200);
const DAY = 86400000;
export async function loadFavicon(value: string): Promise<Favicon | null> {
  const origin = httpUrl(value).origin;
  const directory = path.join(getDataDirectory(), 'favicons');
  const key = createHash('sha256').update(origin).digest('hex');
  return cachedIcons.get(`${directory}:${key}`, async () => {
    const indexPath = path.join(directory, `${key}.json`);
    try {
      const index = JSON.parse(await readFile(indexPath, 'utf8')) as Index;
      if (Number.isFinite(index.fetchedAt) && Date.now() - index.fetchedAt < (index.ext ? 30 * DAY : DAY)) {
        if (!index.ext) return null;
        if (/^(png|ico|jpg|webp|gif|svg)$/.test(index.ext)) {
          const bytes = await readFile(path.join(directory, `${key}.${index.ext}`));
          const icon = sniffIcon(bytes, index.contentType ?? '');
          if (icon) return icon;
        }
      }
    } catch { /* First fetch or damaged index: refresh. */ }
    let found: Favicon | null = null;
    let links: ReturnType<typeof iconLinks> = { icons: [] };
    try {
      const page = await fetchBytes(`${origin}/`, 512 * 1024, 3);
      if (['text/html', 'application/xhtml+xml'].includes(page.contentType)) links = iconLinks(new TextDecoder().decode(page.bytes), page.url);
    } catch { /* The root page may require login; try the conventional icon. */ }
    const tryIcons = async (urls: string[]) => {
      for (const url of [...new Set(urls)].slice(0, 8)) {
        try {
          const result = await fetchBytes(url, 256 * 1024, 3);
          const icon = sniffIcon(result.bytes, result.contentType);
          if (icon) return icon;
        } catch { /* Try next candidate. */ }
      }
      return null;
    };
    found = await tryIcons(links.icons);
    if (!found && links.manifest) {
      try {
        const manifest = await fetchJson(links.manifest, 512 * 1024) as { icons?: { src?: string; sizes?: string; type?: string }[] };
        if (Array.isArray(manifest.icons)) {
          const html = manifest.icons.slice(0, 30).map(icon => {
            // Reuse HTML ranking without interpolating untrusted markup.
            const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            return typeof icon.src === 'string' ? `<link rel="icon" href="${escape(icon.src)}" sizes="${escape(icon.sizes ?? '')}" type="${escape(icon.type ?? '')}">` : '';
          }).join('');
          found = await tryIcons(iconLinks(html, links.manifest).icons);
        }
      } catch { /* Missing/malformed manifest. */ }
    }
    found ??= await tryIcons([`${origin}/favicon.ico`]);
    await mkdir(directory, { recursive: true });
    const atomicWrite = async (file: string, data: string | Uint8Array) => {
      const temp = `${file}.${randomUUID()}.tmp`;
      try { await writeFile(temp, data, { mode: 0o600 }); await rename(temp, file); }
      finally { await unlink(temp).catch(() => {}); }
    };
    if (found) await atomicWrite(path.join(directory, `${key}.${found.ext}`), found.bytes);
    await atomicWrite(indexPath, JSON.stringify({ fetchedAt: Date.now(), ...(found ? { ext: found.ext, contentType: found.contentType } : {}) } satisfies Index));
    return found;
  });
}
