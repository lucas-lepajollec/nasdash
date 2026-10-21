import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectJellyfinMusicHistory, collectJellyfinMusicLibrary, collectJellyfinMusicNowPlaying, collectJellyfinMusicRecent, collectJellyfinMusicTop } from '@/integrations/jellyfin/collect';
import { collectPlexMusicHistory, collectPlexMusicLibrary, collectPlexMusicNowPlaying, collectPlexMusicRecent, collectPlexMusicTop } from '@/integrations/plex/collect';
import { collectNavidromeHistory, collectNavidromeLibrary, collectNavidromeNowPlaying, collectNavidromeRecent, collectNavidromeTop } from '@/integrations/navidrome/collect';
import { TtlCache } from './cache';
import type { MusicAlbum, MusicLibraryResponse, MusicNowPlayingResponse, MusicRecentResponse, MusicTopResponse } from './contracts';
import { mediaShowUsers } from './media';
import { demoMusicAlbums, demoMusicLibrary, demoMusicNowPlaying, demoMusicRecent, demoMusicTop, musicCount, proxyMusicItem, type MusicWidgetType } from './music';
import { queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity } from './services';

const nowPlaying = new TtlCache<MusicNowPlayingResponse>(10000);
const recent = new TtlCache<MusicRecentResponse>(300000);
const library = new TtlCache<MusicLibraryResponse>(300000);
const top = new TtlCache<MusicTopResponse>(300000);
const history = new TtlCache<MusicAlbum[]>(300000);
const headers = { 'Cache-Control': 'private, no-store' };
const collectors = {
  jellyfin: { now: collectJellyfinMusicNowPlaying, recent: collectJellyfinMusicRecent, library: collectJellyfinMusicLibrary, top: collectJellyfinMusicTop, history: collectJellyfinMusicHistory },
  emby: { now: collectJellyfinMusicNowPlaying, recent: collectJellyfinMusicRecent, library: collectJellyfinMusicLibrary, top: collectJellyfinMusicTop, history: collectJellyfinMusicHistory },
  plex: { now: collectPlexMusicNowPlaying, recent: collectPlexMusicRecent, library: collectPlexMusicLibrary, top: collectPlexMusicTop, history: collectPlexMusicHistory },
  navidrome: { now: collectNavidromeNowPlaying, recent: collectNavidromeRecent, library: collectNavidromeLibrary, top: collectNavidromeTop, history: collectNavidromeHistory },
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
      const sessions = result.sessions.map(({ user, track, next, ...session }) => ({ ...session, track: proxy(track),
        ...(next?.length ? { next: next.map(proxy) } : {}), ...(showUsers && user ? { user } : {}) }));
      let albums: MusicAlbum[] | undefined;
      if (!sessions.length) {
        try { albums = demo ? demoMusicAlbums(6) : await history.get(key, () => collect.history(instance, 6)); } catch { /* Idle history is best effort. */ }
      }
      // Rebuild instead of spreading a collector's optional raw recent covers.
      return NextResponse.json({ server: result.server, name: result.name, fetchedAt: result.fetchedAt, sessions, ...(albums?.length ? { recent: albums.map(proxy) } : {}) }, { headers });
    }
    if (type === 'music-recent' || type === 'music-top') {
      const count = musicCount(settings, type === 'music-top'), cacheKey = `${key}:${count}`;
      const result = type === 'music-top'
        ? demo ? demoMusicTop(instance, count) : await top.get(cacheKey, () => collect.top(instance, count))
        : demo ? demoMusicRecent(instance, count) : await recent.get(cacheKey, () => collect.recent(instance, count));
      return NextResponse.json({ ...result, albums: result.albums.slice(0, count).map(proxy) }, { headers });
    }
    const result = demo ? demoMusicLibrary(instance) : await library.get(key, () => collect.library(instance));
    return NextResponse.json({ ...result, ...(result.week ? { week: result.week.slice(0, 8).map(proxy) } : {}) }, { headers });
  } catch (error) {
    const response = serviceFailure(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
}
