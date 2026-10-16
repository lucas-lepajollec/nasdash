import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectJellyfinLibrary, collectJellyfinNowPlaying, collectJellyfinRecent } from '@/integrations/jellyfin/collect';
import { collectPlexLibrary, collectPlexNowPlaying, collectPlexRecent } from '@/integrations/plex/collect';
import { TtlCache } from './cache';
import type { MediaItem, MediaLibraryResponse, MediaNowPlayingResponse, MediaRecentResponse } from './contracts';
import { demoMediaLibrary, demoMediaNowPlaying, demoMediaRecent, fetchCount, groupRecent, libraryCovers, mediaSelection, mediaShowUsers, proxyMediaItem, type MediaSelection, type MediaWidgetType } from './media';
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
      return NextResponse.json({ ...result, sessions: result.sessions.map(({ user, item: media, ...session }) => ({ ...session, item: item(media), ...(user && showUsers ? { user } : {}) })) }, { headers });
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
    try {
      const art = libraryCovers((await newest(instance, { kinds: ['movie', 'episode', 'album'], count: 40, group: false }, key, demo, plex)).items);
      const image = (media?: MediaItem) => { if (!media) return undefined; const proxied = item(media); return proxied.backdrop ?? proxied.poster; };
      covers = { movies: image(art.movies), series: image(art.series), music: image(art.music) };
    } catch { /* The totals do not depend on the art. */ }
    return NextResponse.json({ ...result, ...(covers ? { covers } : {}) }, { headers });
  } catch (error) {
    const response = serviceFailure(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
}
