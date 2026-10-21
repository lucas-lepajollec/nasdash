import { NextRequest } from 'next/server';
import { arrRoute } from '@/lib/widgetData/arrRoutes';
export const dynamic = 'force-dynamic';
export const GET = (request: NextRequest) => arrRoute(request, 'media-arr');
