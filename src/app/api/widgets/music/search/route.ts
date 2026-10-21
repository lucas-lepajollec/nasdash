import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
import { musicResourceRoute } from '@/lib/widgetData/musicRoutes';
export const GET = (request: NextRequest) => musicResourceRoute(request, 'search');
