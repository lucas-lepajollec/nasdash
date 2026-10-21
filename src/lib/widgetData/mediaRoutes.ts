import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectJellyfinHistory, collectJellyfinLibrary, collectJellyfinNowPlaying, collectJellyfinRecent } from '@/integrations/jellyfin/collect';
import { collectPlexHistory, collectPlexLibrary, collectPlexNowPlaying, collectPlexRecent } from '@/integrations/plex/collect';
import { TtlCache } from './cache';
import type { MediaItem, MediaLibraryResponse, MediaNowPlayingResponse, MediaRecentResponse, MediaWatched } from './contracts';
import { coverMode, demoMediaHistory, demoMediaLibrary, demoMediaNowPlaying, demoMediaRecent, fetchCount, groupRecent, mediaSelection, mediaShowUsers, proxyMediaItem, type MediaSelection, type MediaWidgetType } from './media';
import { queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity } from './services';

const nowPlaying = new TtlCache<MediaNowPlayingResponse>(5000);
const recent = new TtlCache<MediaRecentResponse>(120000);
const library = new TtlCache<MediaLibraryResponse>(300000);
const history = new TtlCache<MediaWatched[]>(60000);
const headers = { 'Cache-Control': 'private, no-store' };
/** The newest titles, asked once per server and selection (grouping asks for more to fold). */
function newest(instance: Parameters<typeof collectPlexRecent>[0], selection: MediaSelection, key: string, demo: boolean, plex: boolean): Promise<MediaRecentResponse> {
  const ask = { ...selection, count: fetchCount(selection) };
  if (demo) return Promise.resolve(demoMediaRecent(instance, selection));
  return recent.get(JSON.stringify([key, ask.kinds, ask.count]), () => plex ? collectPlexRecent(instance, ask) : collectJellyfinRecent(instance, ask));
}
export async function mediaRoute(request: NextRequest, type: MediaWidgetType) {
  try {
    const url = new URL(request.url), widgetId = url.searchParams.get('widgetId');
    const draft = queryDraft(url);
    const resolved = resolveServiceWidget(request, widgetId, type, draft);
    if (resolved.response) { resolved.response.headers.set('Cache-Control', headers['Cache-Control']); return resolved.response; }
    const { instance, principal } = resolved;
    // `null` is how widget settings clear a value: the same as absent.
    const settings = Object.fromEntries(Object.entries(resolved.settings).filter(([, value]) => value !== null));
    const admin = principal.role === 'admin';
    const imageDraft = admin && draft ? settings : undefined;
    const key = serviceIdentity(instance), demo = isDemoMode(), plex = instance.type === 'plex';
    const item = (value: MediaItem) => proxyMediaItem(instance, widgetId!, value, admin, imageDraft);
    if (type === 'media-nowplaying') {
      // Account names only when the widget shows them, for everyone (administrators included).
      const showUsers = mediaShowUsers(settings);
      const result = demo ? demoMediaNowPlaying(instance) : await nowPlaying.get(key, () => plex ? collectPlexNowPlaying(instance) : collectJellyfinNowPlaying(instance));
      const sessions = result.sessions.map(({ user, item: media, ...session }) => ({ ...session, item: item(media), ...(user && showUsers ? { user } : {}) }));
      // What was watched lately, under what plays now; when the server cannot tell, the newest titles (best effort).
      let watched: MediaWatched[] | undefined, idle: MediaItem[] | undefined;
      try {
        const playing = new Set(result.sessions.map(session => session.item.id));
        const entries = demo ? demoMediaHistory() : await history.get(key, () => plex ? collectPlexHistory(instance, 12) : collectJellyfinHistory(instance, 12));
        watched = entries.filter(entry => !playing.has(entry.item.id)).map(({ user, item: media, ...entry }) => ({ ...entry, item: item(media), ...(user && showUsers ? { user } : {}) }));
      } catch { /* The server may not tell; fall back to the newest titles. */ }
      {
        if (!watched?.length && !sessions.length) {
          try { idle = groupRecent((await newest(instance, { kinds: ['movie', 'episode'], count: 8, group: true }, key, demo, plex)).items, 6).map(item); }
          catch { /* The idle view does without. */ }
        }
      }
      return NextResponse.json({ ...result, sessions, ...(watched?.length ? { history: watched } : idle?.length ? { recent: idle } : {}) }, { headers });
    }
    if (type === 'media-recent') {
      const selection = mediaSelection(settings);
      const result = await newest(instance, selection, key, demo, plex);
      const items = selection.group ? groupRecent(result.items, selection.count) : result.items.slice(0, selection.count);
      return NextResponse.json({ ...result, items: items.map(item) }, { headers });
    }
    const result = demo ? demoMediaLibrary(instance) : await library.get(key, () => plex ? collectPlexLibrary(instance) : collectJellyfinLibrary(instance));
    // Backgrounds: the newest titles, from the same cached read as Recently added.
    let covers: MediaLibraryResponse['covers'];
    const mode = coverMode(settings);
    if (mode !== 'none') {
      // One read per kind, so a library full of new episodes still has a movie to show.
      // Several pictures per shelf: the widget rotates them (the newest ones in order, or shuffled).
      const pick = async (kind: 'movie' | 'episode' | 'album') => {
        try {
          const list = (await newest(instance, { kinds: [kind], count: 24, group: false }, key, demo, plex)).items
            .filter(media => media.backdrop || media.poster);
          const chosen = (mode === 'random' ? [...list].sort(() => Math.random() - 0.5) : list).slice(0, 8);
          const urls = chosen.map(media => { const proxied = item(media); return kind === 'album' ? proxied.poster ?? proxied.backdrop : proxied.backdrop ?? proxied.poster; })
            .filter((url): url is string => !!url);
          return urls.length ? urls : undefined;
        } catch { return undefined; /* The totals do not depend on the art. */ }
      };
      const [movies, series, music] = await Promise.all([pick('movie'), pick('episode'), pick('album')]);
      covers = { ...(movies ? { movies } : {}), ...(series ? { series } : {}), ...(music ? { music } : {}) };
    }
    // Each library's own posters (newest first, or shuffled), proxied like any title.
    const libraries = result.libraries.map(({ art, ...entry }) => {
      const urls = mode === 'none' || !art ? [] : (mode === 'random' ? [...art].sort(() => Math.random() - 0.5) : art).map(media => item(media).poster).filter((url): url is string => !!url);
      return urls.length ? { ...entry, covers: urls } : entry;
    });
    return NextResponse.json({ ...result, libraries, ...(covers ? { covers } : {}) }, { headers });
  } catch (error) {
    const response = serviceFailure(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
}
