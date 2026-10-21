import { NextRequest } from 'next/server';
import { musicRoute } from '@/lib/widgetData/musicRoutes';
export const dynamic = 'force-dynamic';
export const GET = (request: NextRequest) => musicRoute(request, 'music-library');
