import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
import { musicRoute } from '@/lib/widgetData/musicRoutes';
export const GET = (request: NextRequest) => musicRoute(request, 'music-playlists');
