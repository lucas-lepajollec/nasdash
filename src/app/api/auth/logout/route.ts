import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Supprimer le cookie de session
  response.cookies.set({
    name: 'nasdash_session',
    value: '',
    httpOnly: true,
    secure: false,
    path: '/',
    maxAge: 0, // Expirer immédiatement
    sameSite: 'lax'
  });

  return response;
}
