import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { clearDemoSession, DEMO_SESSION_COOKIE } from '@/lib/demoSession';

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: 'Route unavailable' }, { status: 404 });
  }

  clearDemoSession(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DEMO_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
    maxAge: 0,
  });
  return response;
}
