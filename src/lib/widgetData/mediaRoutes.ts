import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectJellyfinLibrary, collectJellyfinNowPlaying, collectJellyfinRecent } from '@/integrations/jellyfin/collect';
import { collectPlexLibrary, collectPlexNowPlaying, collectPlexRecent } from '@/integrations/plex/collect';
import { TtlCache } from './cache';
import type { MediaItem, MediaLibraryResponse, MediaNowPlayingResponse, MediaRecentResponse } from './contracts';
import { demoMediaLibrary, demoMediaNowPlaying, demoMediaRecent, mediaSelection, mediaShowUsers, proxyMediaItem, type MediaWidgetType } from './media';
import { queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity } from './services';

const nowPlaying = new TtlCache<MediaNowPlayingResponse>(5000);
const recent = new TtlCache<MediaRecentResponse>(120000);
const library = new TtlCache<MediaLibraryResponse>(300000);
const headers = { 'Cache-Control': 'private, no-store' };
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
      const showUsers = mediaShowUsers(settings);
      const result = demo ? demoMediaNowPlaying(instance) : await nowPlaying.get(key, () => plex ? collectPlexNowPlaying(instance) : collectJellyfinNowPlaying(instance));
      return NextResponse.json({ ...result, sessions: result.sessions.map(({ user, item: media, ...session }) => ({ ...session, item: item(media), ...(user && (admin || showUsers) ? { user } : {}) })) }, { headers });
    }
    if (type === 'media-recent') {
      const selection = mediaSelection(settings);
      const result = demo ? demoMediaRecent(instance, selection) : await recent.get(JSON.stringify([key, selection]), () => plex ? collectPlexRecent(instance, selection) : collectJellyfinRecent(instance, selection));
      return NextResponse.json({ ...result, items: result.items.map(item) }, { headers });
    }
    const result = demo ? demoMediaLibrary(instance) : await library.get(key, () => plex ? collectPlexLibrary(instance) : collectJellyfinLibrary(instance));
    return NextResponse.json(result, { headers });
  } catch (error) {
    const response = serviceFailure(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
}
