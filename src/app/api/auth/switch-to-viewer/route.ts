import { NextRequest, NextResponse } from 'next/server';
import { readUsers, getSessionFromRequest, generateToken, isSecureRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = getSessionFromRequest(req);
    if (payload?.role !== 'admin') {
      return NextResponse.json({ error: 'Seul un administrateur peut basculer en mode spectateur.' }, { status: 403 });
    }

    // Récupérer le compte viewer dans les utilisateurs
    const users = readUsers();
    const viewerUser = users.find(u => u.username.toLowerCase() === 'viewer');
    if (!viewerUser) {
      return NextResponse.json({ error: 'Compte viewer non trouvé.' }, { status: 404 });
    }

    // Générer un nouveau token pour le viewer
    const newToken = generateToken({
      username: viewerUser.username,
      role: viewerUser.role,
      allowedTabs: viewerUser.allowedTabs || [],
      allowedWidgets: viewerUser.allowedWidgets || [],
      sessionVersion: viewerUser.sessionVersion
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: 'nasdash_session',
      value: newToken,
      httpOnly: true,
      secure: isSecureRequest(req),
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 jours
      sameSite: 'lax'
    });

    return response;
  } catch (e) {
    console.error('Erreur API switch-to-viewer:', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}
