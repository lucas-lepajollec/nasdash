import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiter en mémoire compatible Edge Runtime
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string, limit: number = 5): boolean {
  const now = Date.now();
  const windowMs = 1000;

  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }

  const record = rateLimitMap.get(ip);
  if (!record) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
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
  if (pathName.startsWith('/api/config') || pathName.startsWith('/api/auth/login')) {
    if (isRateLimited(ip, 5)) {
      return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 });
    }
  } else if (pathName.startsWith('/api/docker')) {
    // Les actions Docker par lot (ex: démarrer/arrêter une stack) peuvent envoyer de nombreuses requêtes simultanées.
    if (isRateLimited(ip, 40)) {
      return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 });
    }
  } else if (pathName.startsWith('/api/ping') || pathName.startsWith('/api/calendar')) {
    if (isRateLimited(ip, 10)) {
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
