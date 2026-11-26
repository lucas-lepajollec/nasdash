import type { IntegrationInstance } from '@/lib/types';
import type { RetroGame, RetroLibrarySummary } from '@/lib/widgetData/contracts';
import { array, date, number, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';
import { coverBytes } from '../reading/shared';

/**
 * RomM (`backend/endpoints`, docs.romm.app › API authentication, checked
 * 2026-11-26): a client API token (`rmm_…`) as `Authorization: Bearer`, or
 * HTTP Basic with the account. `GET /api/stats` (`PLATFORMS`, `ROMS`, `SAVES`,
 * `STATES`, `SCREENSHOTS`, `TOTAL_FILESIZE_BYTES`), `GET /api/platforms`
 * (`id`, `name`, `custom_name`, `rom_count`) and the latest games
 * `GET /api/roms?order_by=created_at&order_dir=desc&limit=` (`items[]`: `id`,
 * `name`, `fs_name`, `platform_display_name`, `path_cover_small`,
 * `created_at`). Covers are files under `/assets/romm/resources/`, served by
 * RomM's own web server.
 */
const RESOURCES = '/assets/romm/resources/';
const headers = (instance: IntegrationInstance): Record<string, string> => instance.settings.auth === 'login'
  ? { Authorization: `Basic ${Buffer.from(`${instance.settings.username ?? ''}:${instance.secrets?.password ?? ''}`).toString('base64')}` }
  : { Authorization: `Bearer ${instance.secrets?.apiKey ?? ''}` };
export const rommRequest = <T = unknown>(instance: IntegrationInstance, path: string) => serviceJson<T>(instance, path, { headers: headers(instance) });

/** Cover ids → the RomM file each one is, for this connection: only covers RomM listed are served (a day, bounded). */
const covers = new Map<string, { path: string; at: number }>();
const coverKey = (instance: IntegrationInstance, id: string) => `${instance.id}\u0000${id}`;
/** A resources path RomM gave (`roms/…/cover/small.png?ts=…`, or already under /assets/romm/resources/), kept inside that folder. */
export function coverPath(value: unknown): string | undefined {
  const raw = string(value).trim();
  if (!raw) return undefined;
  const path = raw.startsWith(RESOURCES) ? raw : raw.startsWith('/') ? undefined : `${RESOURCES}${raw}`;
  if (!path) return undefined;
  const [file] = path.split('?');
  if (file.includes('..') || file.includes('\\') || !/\.(png|jpe?g|webp|gif|avif)$/i.test(file)) return undefined;
  return path;
}

export function toRetroLibrary(instance: IntegrationInstance, stats: unknown, platforms: unknown, roms: unknown, now = Date.now()): RetroLibrarySummary {
  const totals = object(stats), page = object(roms);
  if (!Array.isArray(platforms) || !Array.isArray(page.items)) throw new ServiceError('widgets.error.parse');
  const recent: RetroGame[] = [];
  for (const raw of array(page.items).slice(0, 24)) {
    const rom = object(raw), id = number(rom.id);
    if (!id) continue;
    const path = coverPath(rom.path_cover_small) ?? coverPath(rom.path_cover_large);
    const cover = path ? `romm-${id}` : undefined;
    if (cover && path) { covers.delete(coverKey(instance, cover)); covers.set(coverKey(instance, cover), { path, at: now }); }
    recent.push({
      id: String(id), name: (string(rom.name) || string(rom.fs_name)).slice(0, 160) || `#${id}`,
      platform: string(rom.platform_display_name).slice(0, 80),
      ...(cover ? { cover } : {}),
      ...(date(rom.created_at) ? { addedAt: date(rom.created_at) } : {}),
    });
  }
  while (covers.size > 5000) covers.delete(covers.keys().next().value!);
  const list = array(platforms).map(object).map(platform => ({ id: String(number(platform.id)), name: (string(platform.custom_name) || string(platform.name)).slice(0, 80), games: number(platform.rom_count) }))
    .filter(platform => platform.games > 0).sort((a, b) => b.games - a.games);
  const optional = (key: string) => typeof totals[key] === 'number' ? { [key.toLowerCase()]: number(totals[key]) } : {};
  return {
    provider: 'romm', name: instance.name,
    totals: {
      platforms: typeof totals.PLATFORMS === 'number' ? number(totals.PLATFORMS) : list.length,
      games: typeof totals.ROMS === 'number' ? number(totals.ROMS) : list.reduce((sum, platform) => sum + platform.games, 0),
      ...optional('SAVES'), ...optional('STATES'), ...optional('SCREENSHOTS'),
      ...(typeof totals.TOTAL_FILESIZE_BYTES === 'number' ? { sizeBytes: number(totals.TOTAL_FILESIZE_BYTES) } : {}),
    },
    platforms: list.slice(0, 40), recent, fetchedAt: now,
  };
}

export async function collectRomm(instance: IntegrationInstance): Promise<RetroLibrarySummary> {
  const [stats, platforms, roms] = await Promise.all([
    rommRequest(instance, '/api/stats').catch(() => ({})),
    rommRequest(instance, '/api/platforms'),
    rommRequest(instance, '/api/roms?order_by=created_at&order_dir=desc&limit=24&with_provider_metadata=false&with_char_index=false&with_filter_values=false&with_rom_id_index=false'),
  ]);
  return toRetroLibrary(instance, stats, platforms, roms);
}

/** The public demo: free games and homebrew, no cover (none is bundled for them). */
export function demoRetro(instance: IntegrationInstance): RetroLibrarySummary {
  const day = 86_400_000, now = Date.now();
  const games: [string, string][] = [['Micro Mages', 'NES'], ['Tobu Tobu Girl', 'Game Boy'], ['Celeste Classic', 'PICO-8'], ['Anguna', 'Game Boy Advance'], ['Blade Buster', 'NES'], ['Deadeus', 'Game Boy']];
  return {
    provider: 'romm', name: instance.name,
    totals: { platforms: 6, games: 214, saves: 38, states: 12, screenshots: 57, sizeBytes: 18.4 * 1024 ** 3 },
    platforms: [{ id: '1', name: 'Game Boy', games: 61 }, { id: '2', name: 'NES', games: 54 }, { id: '3', name: 'Super Nintendo', games: 41 }, { id: '4', name: 'Game Boy Advance', games: 33 }, { id: '5', name: 'PICO-8', games: 17 }, { id: '6', name: 'Mega Drive', games: 8 }],
    recent: games.map(([name, platform], index) => ({ id: String(index + 1), name, platform, addedAt: now - (index + 1) * day })),
    fetchedAt: now,
  };
}

export const rommKit: KitServer<RetroLibrarySummary> = {
  ttlMs: 120_000,
  collect: collectRomm,
  test: async instance => { const platforms = await rommRequest(instance, '/api/platforms'); if (!Array.isArray(platforms)) throw new ServiceError('widgets.error.parse'); },
  demo: demoRetro,
  image: async (instance, id) => {
    const known = covers.get(coverKey(instance, id));
    if (!known || Date.now() - known.at > 86_400_000) throw new ServiceError('widgets.error.notFound', 404);
    return coverBytes(instance, known.path, headers(instance));
  },
};
