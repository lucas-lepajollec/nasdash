import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { collectImmichStats } from '@/integrations/immich/stats';
import { collectPhotoprismStats } from '@/integrations/photoprism/stats';
import { collectPiwigoStats } from '@/integrations/piwigo/collect';
import { collectLibrephotosStats } from '@/integrations/librephotos/collect';
import { TtlCache } from './cache';
import type { PhotoStatsProvider, PhotoStatsResponse } from './contracts';
import { mediaShowUsers } from './media';
import { demoPhotoStats } from './photoStatsDemo';
import { queryDraft, resolveServiceWidget, serviceFailure, serviceIdentity } from './services';
const cache = new TtlCache<PhotoStatsResponse>(600000);
const collectors = { immich: collectImmichStats, photoprism: collectPhotoprismStats, piwigo: collectPiwigoStats, librephotos: collectLibrephotosStats };
const headers = { 'Cache-Control': 'private, no-store' };
export async function photoStatsRoute(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const resolved = resolveServiceWidget(request, url.searchParams.get('widgetId'), 'photos-stats', queryDraft(url));
    if (resolved.response) { resolved.response.headers.set('Cache-Control', headers['Cache-Control']); return resolved.response; }
    const settings = Object.fromEntries(Object.entries(resolved.settings).filter(([, value]) => value !== null));
    const showUsers = mediaShowUsers(settings), { instance } = resolved;
    const result = isDemoMode() ? demoPhotoStats(instance) : await cache.get(serviceIdentity(instance), () => collectors[instance.type as PhotoStatsProvider](instance));
    // Apply privacy after the shared instance cache, for every role and preview.
    const users = result.users?.map(({ name, ...user }) => ({ ...user, ...(showUsers && name ? { name } : {}) }));
    return NextResponse.json({ ...result, ...(users ? { users } : {}) }, { headers });
  } catch (error) { const response = serviceFailure(error); response.headers.set('Cache-Control', headers['Cache-Control']); return response; }
}
