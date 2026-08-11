import { NextRequest, NextResponse } from 'next/server';
import { isSecureRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Supprimer le cookie de session
  response.cookies.set({
    name: 'nasdash_session',
    value: '',
    httpOnly: true,
    secure: isSecureRequest(req),
    path: '/',
    maxAge: 0, // Expirer immédiatement
    sameSite: 'lax'
  });

  return response;
}
