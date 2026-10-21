import { demoMediaArt } from './media';
/** Fictional data only. Demo routes never call collectors or remote image servers. */
import { upcomingPhase } from './arr';
import type { IntegrationInstance } from '@/lib/types';
import type { CatalogHit, CatalogKind, ExternalItem, ArrAppStatus, ArrType, DownloadClientStatus, DownloadClientType, ImportedItem, IndexersResponse, QueueItem, UpcomingItem } from './contracts';

/** Invented titles, different for each *arr so the demo reads like a real library. */
const SERIES = [['The Weather Cartographers', 'The Glass Orchard'], ['Harbor Lights', 'Low Tide Signals'], ['The Weather Cartographers', 'Northern Relay'], ['Paper Satellites', 'Static Bloom']] as const;
const MOVIES = ['The Clockwork Meadow', 'A Lantern for the Tide', 'Postcards from Ember Bay', 'The Quiet Orbit'] as const;
const ALBUMS = [['The Velvet Compasses', 'Small Hours'], ['Juniper Avenue', 'Coastline Radio'], ['The Velvet Compasses', 'Glass Weather'], ['Maren Holt', 'Northbound']] as const;
const RELEASES = ['digital', 'cinema', 'physical', 'digital'] as const;

/** Small changes over time, so a demo chart moves. */
const wave = (seed: number, amplitude: number) => 1 + amplitude * Math.sin(Date.now() / 9000 + seed);

export function demoArrUpcoming(instance: IntegrationInstance, start: number): UpcomingItem[] {
  const kind = instance.type === 'sonarr' ? 'episode' : instance.type === 'radarr' ? 'movie' : 'album';
  return Array.from({ length: 4 }, (_, i) => {
    const base = { id: `${instance.id}:demo-${i}`, source: instance.type as UpcomingItem['source'], sourceName: instance.name, kind,
      // Spread over the coming days at different hours.
      at: start + (kind === 'episode' ? i * 30 + 6 : kind === 'movie' ? i * 52 + 20 : i * 44 + 30) * 3_600_000,
      hasFile: kind === 'episode' && i === 0, poster: `demo:poster:${instance.id}:${i}`, backdrop: `demo:backdrop:${instance.id}:${i}` } as const;
    if (kind === 'episode') return { ...base, phase: upcomingPhase({ kind, episode: 3 + i }), title: SERIES[i][1], subtitle: SERIES[i][0], season: 1 + (i % 2), episode: 3 + i };
    if (kind === 'movie') return { ...base, phase: upcomingPhase({ kind, release: RELEASES[i] }), title: MOVIES[i], release: RELEASES[i] };
    return { ...base, phase: 'announced', title: ALBUMS[i][1], subtitle: ALBUMS[i][0] };
  });
}

export function demoArrQueue(instance: IntegrationInstance): { items: QueueItem[]; total: number } {
  const items = demoArrUpcoming(instance, Date.now()).slice(1, 3);
  const states = [{ progress: 64, status: 'downloading', etaMs: 320_000, leftBytes: 864_000_000 }, { progress: 100, status: 'importing', etaMs: 0, leftBytes: 0 }] as const;
  // One warning, on Radarr, to show how problems read.
  const warning = instance.type === 'radarr' ? { progress: 18, status: 'warning' as const, message: 'No files found are eligible for import', etaMs: undefined, leftBytes: 1_900_000_000 } : undefined;
  return { items: items.map((item, i) => ({ id: item.id, source: item.source, sourceName: item.sourceName, kind: item.kind, title: item.title, subtitle: item.subtitle, season: item.season, episode: item.episode,
    ...(warning && i === 1 ? warning : states[i]), sizeBytes: item.kind === 'album' ? 420_000_000 : 2_400_000_000, quality: item.kind === 'album' ? 'FLAC' : '1080p', protocol: i ? 'usenet' : 'torrent', client: 'Demo downloads', poster: item.poster })), total: 2 };
}

export function demoArrStatus(instance: IntegrationInstance): ArrAppStatus {
  const health = instance.type === 'lidarr' ? [{ level: 'warning' as const, message: 'Indexers unavailable due to failures for more than 6 hours: Lantern Exchange' }] : [];
  return { id: instance.id, name: instance.name, type: instance.type as ArrType, version: { sonarr: '4.0.9', radarr: '5.14.0', lidarr: '2.8.2', prowlarr: '1.24.3' }[instance.type] ?? '1.0.0', health, online: true,
    ...(instance.type === 'prowlarr' ? { indexers: 6, failingIndexers: 1 } : { queue: { sonarr: 3, radarr: 1, lidarr: 2 }[instance.type] ?? 0, missing: { sonarr: 14, radarr: 5, lidarr: 22 }[instance.type] ?? 0, freeBytes: 1_200_000_000_000 }) };
}
export function demoArrRecent(instance: IntegrationInstance): ImportedItem[] {
  return demoArrUpcoming(instance, Date.now()).slice(0, 3).map((item, n) => ({ id: `import:${item.id}`, source: item.source, kind: item.kind, title: item.title,
    subtitle: item.subtitle, season: item.season, episode: item.episode, quality: item.kind === 'album' ? 'FLAC' : '1080p', at: Date.now() - (n + 1) * 3600000, poster: item.poster }));
}

export function demoIndexers(instance: IntegrationInstance): IndexersResponse {
  const indexers = [
    { id: 'demo-indexer-1', name: 'Ember Bay Archive', protocol: 'usenet', enabled: true, healthy: true, queries: 84, grabs: 12, failures: 0, averageMs: 120 },
    { id: 'demo-indexer-2', name: 'Lantern Exchange', protocol: 'torrent', enabled: true, healthy: false, retryAt: Date.now() + 1_800_000, queries: 42, grabs: 6, failures: 9, averageMs: 240 },
    { id: 'demo-indexer-3', name: 'Northern Relay', protocol: 'torrent', enabled: true, healthy: true, queries: 61, grabs: 9, failures: 0, averageMs: 180 },
    { id: 'demo-indexer-4', name: 'Paper Satellites Index', protocol: 'usenet', enabled: true, healthy: true, queries: 37, grabs: 4, failures: 1, averageMs: 95 },
    { id: 'demo-indexer-5', name: 'Quiet Orbit Tracker', protocol: 'torrent', enabled: false, healthy: true, queries: 0, grabs: 0, failures: 0 },
  ] as IndexersResponse['indexers'];
  return { name: instance.name, indexers, totals: { queries: 224, grabs: 31, failures: 10 }, hourly: Array.from({ length: 24 }, (_, n) => 3 + (n * 7) % 19), lastQueryAt: Date.now() - 120000, fetchedAt: Date.now() };
}

export function demoDownloadClient(instance: IntegrationInstance): DownloadClientStatus {
  const torrent = instance.type !== 'sabnzbd' && instance.type !== 'nzbget';
  const down = Math.round((torrent ? 8_400_000 : 23_000_000) * wave(torrent ? 0 : 2, 0.35));
  return { id: instance.id, name: instance.name, type: instance.type as DownloadClientType, downloadBps: down, ...(torrent ? { uploadBps: Math.round(1_150_000 * wave(1, 0.4)) } : {}),
    sessionDownloaded: 48_600_000_000, ...(torrent ? { sessionUploaded: 12_400_000_000, seeding: 1 } : {}),
    completed: ['The Glass Orchard S01E02', 'A Lantern for the Tide', 'Coastline Radio FLAC'].map((name, n) => ({ id: `demo-finished-${n}`, name, sizeBytes: (n + 1) * 840_000_000, at: Date.now() - (n + 1) * 3600000 })),
    active: torrent ? 3 : 1, paused: torrent ? 1 : 0, queued: torrent ? 0 : 4, freeBytes: torrent ? 1_200_000_000_000 : 860_000_000_000, altSpeed: false,
    items: torrent ? [
      { id: 'demo-download-1', name: 'Low Tide Signals S01E04 1080p', progress: 64, state: 'downloading', downloadBps: Math.round(down * 0.7), etaMs: 320_000, sizeBytes: 2_400_000_000 },
      { id: 'demo-download-2', name: 'The Clockwork Meadow 2160p', progress: 31, state: 'downloading', downloadBps: Math.round(down * 0.3), etaMs: 2_700_000, sizeBytes: 18_000_000_000 },
      { id: 'demo-download-3', name: 'Small Hours (FLAC)', progress: 100, state: 'seeding', sizeBytes: 420_000_000 },
      { id: 'demo-download-4', name: 'Northern Relay S02E01', progress: 12, state: 'paused', sizeBytes: 1_800_000_000 },
    ] : [
      { id: 'demo-download-5', name: 'Postcards.from.Ember.Bay.1080p', progress: 82, state: 'downloading', downloadBps: down, etaMs: 140_000, sizeBytes: 9_200_000_000 },
      { id: 'demo-download-6', name: 'Glass.Weather.FLAC', progress: 0, state: 'queued', sizeBytes: 610_000_000 },
    ] };
}

/** Demo catalogue art uses the existing local media artwork, never a public CDN. */
export function demoExternalUpcoming(): ExternalItem[] {
  return ['The Cloud Observatory', 'Lanterns Beyond the Lake', 'A Small Constellation', 'The Silver Tram', 'The Last Paper Moon'].map((title, n) => ({
    id: `demo-external-${n}`, provider: n % 2 ? 'kitsu' : 'tvmaze', kind: n % 2 ? 'anime' : 'series', title,
    status: (['airing', 'upcoming', 'announced', 'upcoming', 'ended'] as const)[n], phase: n === 0 ? 'current' : 'announced',
    ...(n < 2 || n === 3 ? { at: Date.now() + (n + 1) * 86400000, season: 2, episode: n === 0 ? 4 : 1 } : {}),
    poster: `data:image/svg+xml,${encodeURIComponent(demoMediaArt(`demo:poster:external:${n}`, 'poster'))}`, backdrop: `data:image/svg+xml,${encodeURIComponent(demoMediaArt(`demo:backdrop:external:${n}`, 'backdrop'))}`,
  }));
}
export function demoCatalogHits(kinds: CatalogKind[]): CatalogHit[] {
  return [...demoExternalUpcoming().map(({ provider, kind, title, status, poster }, n) => ({ provider, kind, title, status, poster, id: `demo-${n}` })),
    { provider: 'tmdb' as const, kind: 'movie' as const, title: 'The Clockwork Aurora', id: 'demo-movie', status: 'Planned' }].filter(hit => kinds.includes(hit.kind));
}
