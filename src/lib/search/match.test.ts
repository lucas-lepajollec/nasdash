import { describe, expect, it } from 'vitest';
import { prepareSearchText, searchTerms, textMatches } from './match';

const matches = (query: string, text: string) => textMatches(searchTerms(query), prepareSearchText(text));

describe('dashboard search', () => {
  it('ignores case and accents and finds words anywhere, in any order', () => {
    expect(matches('debit', 'Débit montant 12 Mb/s')).toBe(true);
    expect(matches('MONTANT débit', 'Débit montant')).toBe(true);
    expect(matches('plex films', 'Plex · 1 240 films')).toBe(true);
    expect(matches('plex séries', 'Plex · 1 240 films')).toBe(false);
  });

  it('forgives one typo in a longer word', () => {
    expect(matches('jellyfn', 'Jellyfin is running')).toBe(true);
    expect(matches('promethues', 'prometheus-node exporter')).toBe(true);
    expect(matches('radrar', 'Radarr queue')).toBe(true);
    expect(matches('sab', 'Radarr queue')).toBe(false);
  });

  it('finds addresses and names with dots and dashes', () => {
    expect(matches('192.168.1.20', 'NAS 192.168.1.20 online')).toBe(true);
    expect(matches('home-assistant', 'home-assistant:8123')).toBe(true);
  });

  it('looks for nothing when the query is empty', () => {
    expect(searchTerms('   ')).toEqual([]);
  });
});
