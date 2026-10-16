import { NextRequest } from 'next/server';
import { mediaRoute } from '@/lib/widgetData/mediaRoutes';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { return mediaRoute(request, 'media-library'); }
