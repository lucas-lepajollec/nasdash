import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiter en mémoire compatible Edge Runtime
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(key: string, limit: number, windowMs: number = 1000): boolean {
  const now = Date.now();

  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }

  const record = rateLimitMap.get(key);
  if (!record) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  record.count++;
  return record.count > limit;
}

export function proxy(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const url = req.nextUrl;
  const pathName = url.pathname;

  // Rate Limiting sur les routes d'API critiques
  if (pathName.startsWith('/api/auth/login')) {
    // Keep brute-force attempts in their own, slower bucket. Normal config
    // reads must never consume the login allowance.
    if (isRateLimited(`login:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 });
    }
  } else if (pathName.startsWith('/api/config')) {
    // React development checks can legitimately replay read effects. Writes
    // remain more constrained and are also protected by server-side auth.
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    const bucket = isRead ? 'config-read' : 'config-write';
    const limit = isRead ? 30 : 10;
    if (isRateLimited(`${bucket}:${ip}`, limit)) {
      return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 });
    }
  } else if (pathName.startsWith('/api/docker')) {
    // Les actions Docker par lot (ex: démarrer/arrêter une stack) peuvent envoyer de nombreuses requêtes simultanées.
    if (isRateLimited(`docker:${ip}`, 40)) {
      return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 });
    }
  } else if (pathName.startsWith('/api/ping') || pathName.startsWith('/api/calendar')) {
    if (isRateLimited(`network-read:${ip}`, 10)) {
      return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 });
    }
  }

  // La validation de session et redirection en mode privé s'effectuent côté serveur complet
  // dans les routes d'API et au montage de l'interface client (ConfigProvider) pour éviter
  // d'utiliser des modules Node.js incompatibles dans l'Edge Runtime.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/config/:path*',
    '/api/docker/:path*',
    '/api/ping/:path*',
    '/api/calendar',
    '/api/auth/login'
  ],
};
