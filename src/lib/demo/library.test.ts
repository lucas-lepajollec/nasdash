import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_ART } from './art';
import { DEMO_ALBUMS, DEMO_BOOKS, DEMO_COMICS, DEMO_FILMS, DEMO_PHOTOS, DEMO_SERIALS, demoArtFor, demoArtId } from './library';

const ART = join(process.cwd(), 'public/demo/art');

describe('demo library', () => {
  it('has a picture, and its credit, for everything the demo shows', () => {
    const needed = [
      ...[...DEMO_FILMS, ...DEMO_SERIALS].flatMap(work => [work.slug, `${work.slug}-wide`]),
      ...DEMO_ALBUMS.flatMap(album => [album.slug, `${album.film}-wide`]),
      ...[...DEMO_BOOKS, ...DEMO_COMICS].map(work => work.slug),
      ...DEMO_PHOTOS.flatMap(photo => [`${photo.slug}-wide`, `${photo.slug}-tall`]),
    ];
    const credits = readFileSync(join(ART, 'CREDITS.md'), 'utf8');
    for (const name of needed) {
      expect(DEMO_ART.has(name), name).toBe(true);
      expect(existsSync(join(ART, `${name}.webp`)), name).toBe(true);
      expect(credits, name).toContain(`\`${name}.webp\``);
    }
  });

  it('turns demo picture ids into the shipped files only', () => {
    expect(demoArtFor(demoArtId('sintel'))).toBe('/demo/art/sintel.webp');
    expect(demoArtFor(demoArtId('sintel', 'wide'))).toBe('/demo/art/sintel-wide.webp');
    expect(demoArtFor('demo:art:unknown')).toBeUndefined();
    expect(demoArtFor('demo:art:../secret')).toBeUndefined();
    expect(demoArtFor('https://example.com/x.webp')).toBeUndefined();
  });
});
