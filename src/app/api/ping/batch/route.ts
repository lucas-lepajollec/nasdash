import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getHostAndPort(urlStr: string): string | null {
  try {
    let clean = urlStr;
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    const parsed = new URL(clean);
    return parsed.host;
  } catch {
    return null;
  }
}

async function pingOne(url: string, allowedHosts: Set<string>) {
  const requestedHost = getHostAndPort(url);
  if (!requestedHost || !allowedHosts.has(requestedHost)) {
    return { url, status: 'offline', statusText: 'Accès interdit', latency: 0 };
  }

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Connection': 'close',
      }
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    if (response.ok || response.status < 400 || response.status === 401 || response.status === 403) {
      return { url, status: 'online', statusText: 'OK', latency };
    } else {
      return { url, status: 'offline', statusText: `Error ${response.status}`, latency };
    }
  } catch (error: any) {
    let statusText = 'Offline';
    if (error.name === 'AbortError') {
      statusText = 'Timeout';
    } else if (error.code === 'ECONNREFUSED') {
      statusText = 'Refusé';
    } else if (error.code === 'ECONNRESET') {
      statusText = 'Offline';
    }
    return { url, status: 'offline', statusText, latency: 0 };
  }
}

export async function POST(request: Request) {
  const config = readConfig();

  // Bloquer l'accès en mode privé si non authentifié
  if (config.settings?.securityMode === 'private') {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const urls: string[] = body.urls || [];

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({});
    }

    // SSRF Prevention: Collect all configured allowed hosts
    const allowedHosts = new Set<string>();
    if (config.devices) {
      config.devices.forEach((d: any) => {
        if (d.host) { const h = getHostAndPort(d.host); if (h) allowedHosts.add(h); }
        if (d.api?.url) { const h = getHostAndPort(d.api.url); if (h) allowedHosts.add(h); }
        if (d.api?.ip) { const h = getHostAndPort(d.api.ip); if (h) allowedHosts.add(h); }
      });
    }
    if (config.categories) {
      config.categories.forEach((cat: any) => {
        if (cat.services) {
          cat.services.forEach((svc: any) => {
            if (svc.localUrl) { const h = getHostAndPort(svc.localUrl); if (h) allowedHosts.add(h); }
            if (svc.secondaryUrl) { const h = getHostAndPort(svc.secondaryUrl); if (h) allowedHosts.add(h); }
            if (svc.tailscaleUrl) { const h = getHostAndPort(svc.tailscaleUrl); if (h) allowedHosts.add(h); }
          });
        }
      });
    }

    // Ping all hosts concurrently on the server
    const pingPromises = urls.map(url => pingOne(url, allowedHosts));
    const results = await Promise.all(pingPromises);

    // Format as a map: { [url]: { status, statusText, latency } }
    const resultMap = results.reduce((acc, r) => {
      acc[r.url] = { status: r.status, statusText: r.statusText, latency: r.latency };
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json(resultMap);
  } catch (err: any) {
    console.error('Erreur Batch Ping:', err);
    return NextResponse.json({ error: 'Une erreur est survenue.' }, { status: 500 });
  }
}
