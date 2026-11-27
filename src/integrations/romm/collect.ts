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
 * `created_at`); for the biggest platforms, their latest covers with the same
 * request filtered by platform (`platform_ids`, `platform_id` before RomM 4).
 * Covers are files under `/assets/romm/resources/`, served by RomM's own web
 * server.
 */
const PICTURED = 4;
const ROM_QUERY = 'order_by=created_at&order_dir=desc&with_provider_metadata=false&with_char_index=false&with_filter_values=false&with_rom_id_index=false';
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

/** A rom's cover, remembered for this connection so the image route may serve it. */
function rememberCover(instance: IntegrationInstance, rom: Record<string, unknown>, now: number): string | undefined {
  const id = number(rom.id);
  const path = coverPath(rom.path_cover_small) ?? coverPath(rom.path_cover_large);
  if (!id || !path) return undefined;
  const cover = `romm-${id}`;
  covers.delete(coverKey(instance, cover));
  covers.set(coverKey(instance, cover), { path, at: now });
  return cover;
}

export function toRetroLibrary(instance: IntegrationInstance, stats: unknown, platforms: unknown, roms: unknown, now = Date.now(), platformRoms: Record<string, unknown> = {}): RetroLibrarySummary {
  const totals = object(stats), page = object(roms);
  if (!Array.isArray(platforms) || !Array.isArray(page.items)) throw new ServiceError('widgets.error.parse');
  const recent: RetroGame[] = [];
  for (const raw of array(page.items).slice(0, 24)) {
    const rom = object(raw), id = number(rom.id);
    if (!id) continue;
    const cover = rememberCover(instance, rom, now);
    recent.push({
      id: String(id), name: (string(rom.name) || string(rom.fs_name)).slice(0, 160) || `#${id}`,
      platform: string(rom.platform_display_name).slice(0, 80),
      ...(cover ? { cover } : {}),
      ...(date(rom.created_at) ? { addedAt: date(rom.created_at) } : {}),
    });
  }
  const list = array(platforms).map(object).map(platform => ({ id: String(number(platform.id)), name: (string(platform.custom_name) || string(platform.name)).slice(0, 80), games: number(platform.rom_count) }))
    .filter(platform => platform.games > 0).sort((a, b) => b.games - a.games)
    .map(platform => {
      const pictured = array(object(platformRoms[platform.id]).items).map(object).map(rom => rememberCover(instance, rom, now)).filter((cover): cover is string => !!cover).slice(0, 3);
      return pictured.length ? { ...platform, covers: pictured } : platform;
    });
  while (covers.size > 5000) covers.delete(covers.keys().next().value!);
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
    rommRequest(instance, `/api/roms?${ROM_QUERY}&limit=24`),
  ]);
  // The biggest platforms' latest covers, for their shelves; a refusal only leaves a shelf without pictures.
  const biggest = Array.isArray(platforms) ? array(platforms).map(object).filter(platform => number(platform.rom_count) > 0).sort((a, b) => number(b.rom_count) - number(a.rom_count)).slice(0, PICTURED).map(platform => String(number(platform.id))) : [];
  const platformRoms = Object.fromEntries(await Promise.all(biggest.map(async id => [id, await rommRequest(instance, `/api/roms?${ROM_QUERY}&limit=3&platform_ids=${encodeURIComponent(id)}&platform_id=${encodeURIComponent(id)}`).catch(() => undefined)] as const)));
  return toRetroLibrary(instance, stats, platforms, roms, Date.now(), platformRoms);
}

/** The public demo: free games and homebrew, with drawn covers (the demo's image route draws any id it does not ship). */
export function demoRetro(instance: IntegrationInstance): RetroLibrarySummary {
  const day = 86_400_000, now = Date.now();
  const games: [string, string][] = [['Micro Mages', 'NES'], ['Tobu Tobu Girl', 'Game Boy'], ['Celeste Classic', 'PICO-8'], ['Anguna', 'Game Boy Advance'], ['Blade Buster', 'NES'], ['Deadeus', 'Game Boy'], ['Super Bat Puncher', 'NES'], ['Gelatinous', 'Game Boy']];
  const platform = (id: string, name: string, count: number, picture: boolean) => ({ id, name, games: count, ...(picture ? { covers: [1, 2, 3].map(step => `romm-demo-${id}-${step}`) } : {}) });
  return {
    provider: 'romm', name: instance.name,
    totals: { platforms: 6, games: 214, saves: 38, states: 12, screenshots: 57, sizeBytes: 18.4 * 1024 ** 3 },
    platforms: [platform('1', 'Game Boy', 61, true), platform('2', 'NES', 54, true), platform('3', 'Super Nintendo', 41, true), platform('4', 'Game Boy Advance', 33, true), platform('5', 'PICO-8', 17, false), platform('6', 'Mega Drive', 8, false)],
    recent: games.map(([name, game], index) => ({ id: String(index + 1), name, platform: game, cover: `romm-demo-game-${index + 1}`, addedAt: now - (index + 1) * day })),
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
