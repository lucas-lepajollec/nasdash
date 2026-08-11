import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, readUsers, isSecureRequest } from '@/lib/auth';
import { readConfig } from '@/lib/config';
import { isDemoMode } from '@/lib/demoMode';

interface SessionUserView {
  username: string;
  role: 'admin' | 'viewer';
  allowedTabs: string[];
  allowedWidgets: string[];
  isAnonymous: boolean;
}

function jsonNoCache(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

export async function GET(req: NextRequest) {
  if (isDemoMode()) {
    return jsonNoCache({
      user: {
        username: 'demo',
        role: 'admin',
        allowedTabs: [],
        allowedWidgets: [],
        isAnonymous: false,
      },
    });
  }

  const token = req.cookies.get('nasdash_session')?.value;

  if (!token) {
    const config = readConfig();
    if (config?.settings?.securityMode === 'public') {
      const users = readUsers();
      const viewerUser = users.find(u => u.username.toLowerCase() === 'viewer');
      if (viewerUser) {
        return jsonNoCache({
          user: {
            username: 'viewer',
            role: 'viewer',
            allowedTabs: viewerUser.allowedTabs || [],
            allowedWidgets: viewerUser.allowedWidgets || [],
            isAnonymous: true
          }
        });
      }
    }
    return jsonNoCache({ user: null });
  }

  const payload = getSessionFromRequest(req);

  if (!payload) {
    // Session invalide ou expirée, effacer le cookie et renvoyer le viewer si public
    let fallbackUser: SessionUserView | null = null;
    const config = readConfig();
    if (config?.settings?.securityMode === 'public') {
      const users = readUsers();
      const viewerUser = users.find(u => u.username.toLowerCase() === 'viewer');
      if (viewerUser) {
        fallbackUser = {
          username: 'viewer',
          role: 'viewer',
          allowedTabs: viewerUser.allowedTabs || [],
          allowedWidgets: viewerUser.allowedWidgets || [],
          isAnonymous: true
        };
      }
    }
    
    const response = jsonNoCache({ user: fallbackUser });
    response.cookies.set({
      name: 'nasdash_session',
      value: '',
      httpOnly: true,
      secure: isSecureRequest(req),
      path: '/',
      maxAge: 0,
      sameSite: 'lax'
    });
    return response;
  }

  return jsonNoCache({
    user: {
      username: payload.username,
      role: payload.role,
      allowedTabs: payload.allowedTabs || [],
      allowedWidgets: payload.allowedWidgets || [],
      isAnonymous: false
    }
  });
}
