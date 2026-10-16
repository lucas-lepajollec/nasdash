import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectJellyfinLibrary, collectJellyfinNowPlaying, collectJellyfinRecent } from '@/integrations/jellyfin/collect';
import { collectPlexLibrary, collectPlexNowPlaying, collectPlexRecent } from '@/integrations/plex/collect';
import { TtlCache } from './cache';
import type { MediaItem, MediaLibraryResponse, MediaNowPlayingResponse, MediaRecentResponse } from './contracts';
import { coverMode, demoMediaLibrary, demoMediaNowPlaying, demoMediaRecent, fetchCount, groupRecent, mediaSelection, mediaShowUsers, proxyMediaItem, type MediaSelection, type MediaWidgetType } from './media';
import { queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity } from './services';

const nowPlaying = new TtlCache<MediaNowPlayingResponse>(5000);
const recent = new TtlCache<MediaRecentResponse>(120000);
const library = new TtlCache<MediaLibraryResponse>(300000);
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
    const { instance, settings, principal } = resolved;
    const admin = principal.role === 'admin';
    const imageDraft = admin && draft ? settings : undefined;
    const key = serviceIdentity(instance), demo = isDemoMode(), plex = instance.type === 'plex';
    const item = (value: MediaItem) => proxyMediaItem(instance, widgetId!, value, admin, imageDraft);
    if (type === 'media-nowplaying') {
      // Account names only when the widget shows them, for everyone (administrators included).
      const showUsers = mediaShowUsers(settings);
      const result = demo ? demoMediaNowPlaying(instance) : await nowPlaying.get(key, () => plex ? collectPlexNowPlaying(instance) : collectJellyfinNowPlaying(instance));
      const sessions = result.sessions.map(({ user, item: media, ...session }) => ({ ...session, item: item(media), ...(user && showUsers ? { user } : {}) }));
      // Nothing playing: the newest titles, so the widget still shows the library (best effort).
      let idle: MediaItem[] | undefined;
      if (!sessions.length) {
        try { idle = groupRecent((await newest(instance, { kinds: ['movie', 'episode'], count: 8, group: true }, key, demo, plex)).items, 6).map(item); }
        catch { /* The idle view does without. */ }
      }
      return NextResponse.json({ ...result, sessions, ...(idle?.length ? { recent: idle } : {}) }, { headers });
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
      const pick = async (kind: 'movie' | 'episode' | 'album') => {
        try {
          const list = (await newest(instance, { kinds: [kind], count: mode === 'random' ? 24 : 4, group: false }, key, demo, plex)).items
            .filter(media => media.backdrop || media.poster);
          const chosen = mode === 'random' ? list[Math.floor(Math.random() * list.length)] : list[0];
          if (!chosen) return undefined;
          const proxied = item(chosen);
          return kind === 'album' ? proxied.poster ?? proxied.backdrop : proxied.backdrop ?? proxied.poster;
        } catch { return undefined; /* The totals do not depend on the art. */ }
      };
      const [movies, series, music] = await Promise.all([pick('movie'), pick('episode'), pick('album')]);
      covers = { ...(movies ? { movies } : {}), ...(series ? { series } : {}), ...(music ? { music } : {}) };
    }
    return NextResponse.json({ ...result, ...(covers ? { covers } : {}) }, { headers });
  } catch (error) {
    const response = serviceFailure(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
}
