import { NextRequest, NextResponse } from 'next/server';
import { readUsers, verifyPassword, generateToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Identifiants incomplets.' }, { status: 400 });
    }

    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' }, { status: 401 });
    }

    const token = generateToken({ 
      username: user.username, 
      role: user.role,
      allowedTabs: user.allowedTabs,
      allowedWidgets: user.allowedWidgets
    });

    const response = NextResponse.json({
      success: true,
      username: user.username,
      role: user.role,
      allowedTabs: user.allowedTabs,
      allowedWidgets: user.allowedWidgets
    });

    // Poser le cookie HTTP-Only pour 30 jours
    response.cookies.set({
      name: 'nasdash_session',
      value: token,
      httpOnly: true,
      secure: false,
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 jours
      sameSite: 'lax'
    });

    return response;
  } catch (e) {
    console.error('Erreur API Login:', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}
