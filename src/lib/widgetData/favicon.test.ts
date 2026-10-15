import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/dataDirectory', () => ({ getDataDirectory: vi.fn() }));
import { getDataDirectory } from '@/lib/dataDirectory';
import { iconLinks, loadFavicon, sniffIcon } from './favicon';
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const svg = (text: string) => new TextEncoder().encode(text);
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('ranks SVG then large PNG and resolves base and manifest links', () => {
  const links = iconLinks(`<base href="/assets/"><link rel="shortcut icon" href="small.ico"><link rel="apple-touch-icon" href="small.png" sizes="32x32"><link rel="icon" href="big.png" sizes="128x128"><link rel="icon" href="vector.svg"><link rel="manifest" href="site.webmanifest"><link rel="icon" href="javascript:bad">`, 'https://example.com/');
  expect(links.icons).toEqual(['https://example.com/assets/vector.svg', 'https://example.com/assets/big.png', 'https://example.com/assets/small.png', 'https://example.com/assets/small.ico']);
  expect(links.manifest).toBe('https://example.com/assets/site.webmanifest');
});
it('sniffs supported formats, enforces type and size and rejects active/external SVG', () => {
  expect(sniffIcon(png, 'image/png')?.ext).toBe('png');
  expect(sniffIcon(new Uint8Array([0, 0, 1, 0, 1, 0]), 'image/vnd.microsoft.icon')?.ext).toBe('ico');
  expect(sniffIcon(new Uint8Array([255, 216, 255]), 'image/jpeg')?.ext).toBe('jpg');
  expect(sniffIcon(svg('GIF89a'), 'image/gif')?.ext).toBe('gif');
  expect(sniffIcon(svg('RIFFxxxxWEBP'), 'image/webp')?.ext).toBe('webp');
  expect(sniffIcon(png, 'text/html')).toBeUndefined();
  expect(sniffIcon(new Uint8Array(256 * 1024 + 1), 'image/png')).toBeUndefined();
  expect(sniffIcon(svg('<svg xmlns="http://www.w3.org/2000/svg"><use href="#icon"/></svg>'), 'image/svg+xml')?.ext).toBe('svg');
  for (const text of ['<svg><script>alert(1)</script></svg>', '<svg onload="x"/>', '<svg><image href="https://example.com/x"/></svg>', '<svg><use xlink:href="//example.com/x"/></svg>', '<svg><style>@import "x"</style></svg>', '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///x">]><svg/>', '<svg><foreignObject/></svg>']) expect(sniffIcon(svg(text), 'image/svg+xml')).toBeUndefined();
});
it('stores a validated icon and a JSON index, uses disk cache and refreshes after 30 days', async () => {
  const directory = await mkdtemp('/tmp/nasdash-favicon-test-');
  vi.mocked(getDataDirectory).mockReturnValue(directory);
  vi.useFakeTimers(); vi.setSystemTime(2000000000);
  const fetch = vi.fn(async (url: URL) => url.pathname === '/' ? new Response('<link rel="icon" href="/icon.png">', { headers: { 'content-type': 'text/html' } }) : new Response(png, { headers: { 'content-type': 'image/png' } }));
  vi.stubGlobal('fetch', fetch);
  try {
    expect((await loadFavicon('https://example.com/some/path'))?.ext).toBe('png');
    const files = await readdir(path.join(directory, 'favicons'));
    const index = JSON.parse(await readFile(path.join(directory, 'favicons', files.find(f => f.endsWith('.json'))!), 'utf8'));
    expect(index).toMatchObject({ contentType: 'image/png', fetchedAt: 2000000000 });
    vi.advanceTimersByTime(61000);
    await loadFavicon('https://example.com/another'); expect(fetch).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30 * 86400000);
    await loadFavicon('https://example.com/'); expect(fetch).toHaveBeenCalledTimes(4);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
it('falls back through manifest and conventional icon, caches misses for one day', async () => {
  const directory = await mkdtemp('/tmp/nasdash-favicon-negative-');
  vi.mocked(getDataDirectory).mockReturnValue(directory);
  vi.useFakeTimers(); vi.setSystemTime(2000000000);
  const fetch = vi.fn(async (url: URL) => url.pathname === '/' ? new Response('<link rel="manifest" href="/manifest.json">', { headers: { 'content-type': 'text/html' } }) : url.pathname === '/manifest.json' ? new Response('{"icons":[{"src":"/missing.png","sizes":"64x64"}]}') : new Response('', { status: 404 }));
  vi.stubGlobal('fetch', fetch);
  try {
    expect(await loadFavicon('http://example.com/')).toBeNull(); expect(fetch).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(61000); expect(await loadFavicon('http://example.com/')).toBeNull(); expect(fetch).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(86400000); await loadFavicon('http://example.com/'); expect(fetch).toHaveBeenCalledTimes(8);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
