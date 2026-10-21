import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import * as jellyfin from '@/integrations/jellyfin/collect';
import * as plex from '@/integrations/plex/collect';
import * as navidrome from '@/integrations/navidrome/collect';
import { checkAdmin } from '@/lib/auth';
import { TtlCache } from './cache';
import type { MusicAlbum, MusicLibraryResponse, MusicNowPlayingResponse, MusicRecentResponse, MusicTopResponse, MusicTrack, MusicPlaylist } from './contracts';
import { mediaShowUsers } from './media';
import { MUSIC_WIDGET_TYPES, demoMusicAudio, demoMusicTracks, demoMusicPlaylists, demoMusicSearch, knownMusicTrack, rememberMusicTrack, musicContent, musicPages, musicTopPages, musicPlaylistPrivacy, demoMusicAlbums, demoMusicLibrary, demoMusicNowPlaying, demoMusicRecent, demoMusicTop, musicCount, proxyMusicItem, type MusicWidgetType } from './music';
import { boundedJson, queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity, serviceStream, ServiceError } from './services';

const nowPlaying = new TtlCache<MusicNowPlayingResponse>(10000);
const recent = new TtlCache<MusicRecentResponse>(300000);
const library = new TtlCache<MusicLibraryResponse>(300000);
const top = new TtlCache<MusicTopResponse>(300000);
const topTracks = new TtlCache<MusicTrack[]>(300000);
const history = new TtlCache<MusicAlbum[]>(300000);
const headers = { 'Cache-Control': 'private, no-store' };
const jellyfinCollectors = { now: jellyfin.collectJellyfinMusicNowPlaying, recent: jellyfin.collectJellyfinMusicRecent, library: jellyfin.collectJellyfinMusicLibrary, top: jellyfin.collectJellyfinMusicTop, topTracks: jellyfin.collectJellyfinMusicTopTracks, history: jellyfin.collectJellyfinMusicHistory, playlists: jellyfin.collectJellyfinMusicPlaylists, tracks: jellyfin.collectJellyfinMusicTracks, search: jellyfin.collectJellyfinMusicSearch };
const collectors = {
  jellyfin: jellyfinCollectors, emby: jellyfinCollectors,
  plex: { now: plex.collectPlexMusicNowPlaying, recent: plex.collectPlexMusicRecent, library: plex.collectPlexMusicLibrary, top: plex.collectPlexMusicTop, topTracks: plex.collectPlexMusicTopTracks, history: plex.collectPlexMusicHistory, playlists: plex.collectPlexMusicPlaylists, tracks: plex.collectPlexMusicTracks, search: plex.collectPlexMusicSearch },
  navidrome: { now: navidrome.collectNavidromeNowPlaying, recent: navidrome.collectNavidromeRecent, library: navidrome.collectNavidromeLibrary, top: navidrome.collectNavidromeTop, topTracks: navidrome.collectNavidromeTopTracks, history: navidrome.collectNavidromeHistory, playlists: navidrome.collectNavidromePlaylists, tracks: navidrome.collectNavidromeTracks, search: navidrome.collectNavidromeSearch },
};
export async function musicRoute(request: NextRequest, type: MusicWidgetType) {
  try {
    const url = new URL(request.url), widgetId = url.searchParams.get('widgetId'), draft = queryDraft(url);
    const resolved = resolveServiceWidget(request, widgetId, type, draft);
    if (resolved.response) { resolved.response.headers.set('Cache-Control', headers['Cache-Control']); return resolved.response; }
    const { instance, principal } = resolved;
    const settings = Object.fromEntries(Object.entries(resolved.settings).filter(([, value]) => value !== null));
    const admin = principal.role === 'admin', imageDraft = admin && draft ? settings : undefined;
    const key = serviceIdentity(instance), demo = isDemoMode(), collect = collectors[instance.type as keyof typeof collectors];
    const proxy = <T extends Parameters<typeof proxyMusicItem>[2]>(item: T) => proxyMusicItem(instance, widgetId!, item, admin, imageDraft);
    if (type === 'music-nowplaying') {
      const showUsers = mediaShowUsers(settings);
      const result = demo ? demoMusicNowPlaying(instance) : await nowPlaying.get(key, () => collect.now(instance));
      const trackProxy = (track: MusicTrack) => { rememberMusicTrack(instance, widgetId!, track.id, imageDraft); return proxy(track); };
      const sessions = result.sessions.map(({ user, track, next, canControl, ...session }) => ({ ...session, canControl: admin && canControl === true, track: trackProxy(track),
        ...(next?.length ? { next: next.map(trackProxy) } : {}), ...(showUsers && user ? { user } : {}) }));
      let albums: MusicAlbum[] | undefined;
      if (!sessions.length) {
        try { albums = demo ? demoMusicAlbums(6) : await history.get(key, () => collect.history(instance, 6)); } catch { /* Idle history is best effort. */ }
      }
      // Rebuild instead of spreading a collector's optional raw recent covers.
      return NextResponse.json({ server: result.server, name: result.name, fetchedAt: result.fetchedAt, sessions, ...(albums?.length ? { recent: albums.map(proxy) } : {}) }, { headers });
    }
    if (type === 'music-playlists') {
      const count = settings.count ?? 12;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 3 || count > 40) throw new ServiceError('widgets.error.invalidSettings', 400);
      const result = demo ? demoMusicPlaylists(instance, count) : await collect.playlists(instance, count);
      return NextResponse.json({ ...result, playlists: result.playlists.map(item => proxy(musicPlaylistPrivacy(item, mediaShowUsers(settings)))) }, { headers });
    }
    if (type === 'music-recent' && musicContent(settings) === 'pages') {
      // Every page at once, so switching inside the widget is instant; a page the server cannot give is left out.
      const count = musicCount(settings, false), pages = musicPages(settings);
      const read = (content: 'added' | 'albums' | 'tracks') => (demo ? Promise.resolve(demoMusicRecent(instance, count, content)) : recent.get(`${key}:${content}:${count}`, () => collect.recent(instance, count, content))).catch(() => undefined);
      const [added, played, heard] = await Promise.all((['added', 'albums', 'tracks'] as const).map(content => pages.includes(content) ? read(content) : Promise.resolve(undefined)));
      const base = added ?? played ?? heard;
      if (!base) throw new ServiceError('widgets.error.http');
      return NextResponse.json({ server: base.server, name: base.name, fetchedAt: base.fetchedAt, albums: (added?.albums ?? []).slice(0, count).map(proxy),
        ...(played ? { played: played.albums.slice(0, count).map(proxy) } : {}),
        ...(heard?.tracks ? { tracks: heard.tracks.slice(0, count).map(track => { rememberMusicTrack(instance, widgetId!, track.id, imageDraft); return proxy(track); }) } : {}) }, { headers });
    }
    if (type === 'music-top') {
      // Albums and/or tracks played most; a page the server cannot give (Subsonic tracks) is left out unless it is the only one.
      const count = musicCount(settings, true), pages = musicTopPages(settings);
      const [albums, tracks] = await Promise.all([
        pages.includes('albums') ? (demo ? Promise.resolve(demoMusicTop(instance, count)) : top.get(`${key}:${count}`, () => collect.top(instance, count))) : Promise.resolve(undefined),
        pages.includes('tracks') ? (demo ? Promise.resolve(demoMusicTracks(count).map((track, index) => ({ ...track, plays: 60 - index * 7 }))) : topTracks.get(`${key}:${count}`, () => collect.topTracks(instance, count))).catch(error => { if (pages.length === 1) throw error; return undefined; }) : Promise.resolve(undefined),
      ]);
      return NextResponse.json({ server: instance.type, name: instance.name, fetchedAt: Date.now(), albums: (albums?.albums ?? []).slice(0, count).map(proxy),
        ...(tracks ? { tracks: tracks.slice(0, count).map(track => { rememberMusicTrack(instance, widgetId!, track.id, imageDraft); return proxy(track); }) } : {}) }, { headers });
    }
    if (type === 'music-recent') {
      const count = musicCount(settings, false), content = musicContent(settings) as 'added' | 'albums' | 'tracks', cacheKey = `${key}:${content}:${count}`;
      const result = demo ? demoMusicRecent(instance, count, content) : await recent.get(cacheKey, () => collect.recent(instance, count, content));
      const tracks = 'tracks' in result ? result.tracks as MusicTrack[] | undefined : undefined;
      return NextResponse.json({ ...result, albums: result.albums.slice(0, count).map(proxy), ...(tracks ? { tracks: tracks.slice(0, count).map(track => { rememberMusicTrack(instance, widgetId!, track.id, imageDraft); return proxy(track); }) } : {}) }, { headers });
    }
    const result = demo ? demoMusicLibrary(instance) : await library.get(key, () => collect.library(instance));
    return NextResponse.json({ ...result, ...(result.week ? { week: result.week.slice(0, 8).map(proxy) } : {}) }, { headers });
  } catch (error) {
    const response = serviceFailure(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
}

/** Subresources resolve the saved widget and its visibility again on every request. */
export async function musicResourceRoute(request: NextRequest, resource: 'tracks' | 'search' | 'stream') {
  try {
    const url = new URL(request.url), widgetId = url.searchParams.get('widgetId'), draft = queryDraft(url);
    const resolved = resolveServiceWidget(request, widgetId, MUSIC_WIDGET_TYPES, draft);
    if (resolved.response) {
      resolved.response.headers.set('Cache-Control', headers['Cache-Control']);
      if (resource === 'stream' && resolved.response.status === 404) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 403, headers });
      return resolved.response;
    }
    const { instance, principal } = resolved;
    if (resource === 'stream' && principal.isAnonymous) throw new ServiceError('widgets.error.unauthorized', 401);
    const settings = Object.fromEntries(Object.entries(resolved.settings).filter(([, value]) => value !== null));
    const preview = principal.role === 'admin' && draft ? settings : undefined;
    const proxy = <T extends MusicTrack | MusicAlbum | MusicPlaylist>(item: T) => proxyMusicItem(instance, widgetId!, item, principal.role === 'admin', preview);
    const trackProxy = (track: MusicTrack) => { rememberMusicTrack(instance, widgetId!, track.id, preview); return proxy(track); };
    const collect = collectors[instance.type as keyof typeof collectors], demo = isDemoMode();
    if (resource === 'search') {
      const q = url.searchParams.get('q')?.trim() ?? '';
      if (q.length < 2 || q.length > 80) throw new ServiceError('widgets.error.invalidRequest', 400);
      const result = demo ? demoMusicSearch(instance, q) : await collect.search(instance, q);
      return NextResponse.json({ tracks: result.tracks.slice(0, 20).map(trackProxy), albums: result.albums.slice(0, 20).map(proxy), playlists: result.playlists.slice(0, 20).map(item => proxy(musicPlaylistPrivacy(item, mediaShowUsers(settings)))) }, { headers });
    }
    const id = url.searchParams.get('id') ?? '';
    if (!id || id === '.' || id === '..' || id.length > 512 || /[\x00-\x1f\x7f]/.test(id)) throw new ServiceError('widgets.error.invalidRequest', 400);
    if (resource === 'tracks') {
      const kind = url.searchParams.get('kind');
      if (kind !== 'album' && kind !== 'playlist') throw new ServiceError('widgets.error.invalidRequest', 400);
      const tracks = demo ? demoMusicTracks() : await collect.tracks(instance, kind, id);
      return NextResponse.json({ tracks: tracks.slice(0, 300).map(trackProxy) }, { headers });
    }
    if (!knownMusicTrack(instance, widgetId!, id, preview)) throw new ServiceError('widgets.error.notFound', 404);
    const range = request.headers.get('range');
    if (range && (!/^bytes=(?:\d+-\d*|-\d+)$/.test(range) || range.length > 128)) throw new ServiceError('widgets.error.invalidRequest', 400);
    if (demo) return demoMusicAudio(range);
    const auth = instance.type === 'plex' ? plex.plexHeaders(instance) : instance.type === 'navidrome' ? {} : jellyfin.jellyfinHeaders(instance);
    const path = instance.type === 'plex' ? await plex.plexMusicStreamPath(instance, id)
      : instance.type === 'navidrome' ? navidrome.navidromeAuthenticatedPath(instance, `/rest/stream?${new URLSearchParams({ id, format: 'raw' })}`)
      : await jellyfin.jellyfinMusicStreamPath(instance, id);
    return await serviceStream(instance, path, { ...auth, Accept: 'audio/*', ...(range ? { Range: range } : {}) }, request.signal);
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
export async function musicControlRoute(request: NextRequest) {
  if (checkAdmin(request)) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 403, headers });
  try {
    const body = await boundedJson(request);
    if (typeof body.sessionId !== 'string' || !body.sessionId || body.sessionId.length > 512 || !['playpause', 'next', 'previous'].includes(body.action as string)) throw new ServiceError('widgets.error.invalidRequest', 400);
    const resolved = resolveServiceWidget(request, body.widgetId, 'music-nowplaying');
    if (resolved.response) return NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: resolved.response.status === 401 ? 403 : resolved.response.status, headers });
    if (resolved.principal.role !== 'admin' || resolved.principal.isAnonymous) throw new ServiceError('widgets.error.unauthorized', 403);
    const { instance } = resolved;
    if (instance.type !== 'jellyfin' && instance.type !== 'emby') throw new ServiceError('widgets.music.error.controlUnavailable', 422);
    if (isDemoMode()) {
      if (!demoMusicNowPlaying(instance).sessions.some(session => session.id === body.sessionId && session.canControl)) throw new ServiceError('widgets.music.error.controlUnavailable', 403);
    } else await jellyfin.controlJellyfinMusic(instance, body.sessionId, body.action as 'playpause' | 'next' | 'previous');
    nowPlaying.delete(serviceIdentity(instance));
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
