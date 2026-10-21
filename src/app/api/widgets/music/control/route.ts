import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
import { musicControlRoute } from '@/lib/widgetData/musicRoutes';
export const POST = (request: NextRequest) => musicControlRoute(request);
