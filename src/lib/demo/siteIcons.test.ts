import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_SITE_ICON_HOSTS, demoSiteIcon } from './siteIcons';

describe('demo site icons', () => {
  it('ships an icon for every listed host', () => {
    for (const host of DEMO_SITE_ICON_HOSTS) expect(fs.existsSync(path.join(process.cwd(), 'public/demo/sites', `${host}.png`)), host).toBe(true);
  });
  it('serves listed hosts only', () => {
    expect(demoSiteIcon('https://en.wikipedia.org/wiki/Home')).toBe('/demo/sites/en.wikipedia.org.png');
    expect(demoSiteIcon('https://evil.example/')).toBeNull();
    expect(demoSiteIcon('not a url')).toBeNull();
    expect(demoSiteIcon(null)).toBeNull();
  });
  it('covers every bookmark of the demo', () => {
    const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'demo/fixtures/config.json'), 'utf8'));
    const links = (config.settings.bookmarks as { kind: string; url?: string }[]).filter(item => item.kind === 'link');
    expect(links.filter(item => !demoSiteIcon(item.url ?? null)).map(item => item.url)).toEqual([]);
  });
});
