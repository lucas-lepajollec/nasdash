import { NextRequest, NextResponse } from 'next/server';
import { readUsers, verifyPassword, generateToken, isSecureRequest } from '@/lib/auth';
import { RequestValidationError, readJsonObject, readString } from '@/lib/requestValidation';
import { isDemoMode } from '@/lib/demoMode';

const MAX_LOGIN_BODY_BYTES = 8 * 1024;

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: 'La connexion est désactivée sur la démonstration publique.' },
      { status: 403 },
    );
  }

  try {
    const body = await readJsonObject(req, MAX_LOGIN_BODY_BYTES);
    const username = readString(body, 'username', { required: true, maxLength: 64 });
    const password = readString(body, 'password', { required: true, maxLength: 1024, trim: false });

    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username!.toLowerCase());

    if (!user || !verifyPassword(password!, user.passwordHash)) {
      return NextResponse.json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' }, { status: 401 });
    }

    const token = generateToken({ 
      username: user.username, 
      role: user.role,
      allowedTabs: user.allowedTabs,
      allowedWidgets: user.allowedWidgets,
      sessionVersion: user.sessionVersion
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
      secure: isSecureRequest(req),
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 jours
      sameSite: 'lax'
    });

    return response;
  } catch (e) {
    if (e instanceof RequestValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('Erreur API Login:', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}
