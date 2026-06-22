import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ status: 'offline', statusText: 'Invalid URL', latency: 0 }, { status: 400 });
  }

  try {
    const start = Date.now();
    // Use AbortController for a 5-second timeout to avoid hanging requests (e.g. DNS timeouts on private IPs)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // We do a GET instead of HEAD because some minimal self-hosted servers block HEAD requests
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      // Do not follow redirects if it crosses domains, but normally follow is ok.
      // But we just want to know if it responds.
    });

    clearTimeout(timeoutId);

    const latency = Date.now() - start;

    if (response.ok || response.status < 400 || response.status === 401 || response.status === 403) {
      // 401/403 often means the service is up but requires auth (e.g. Proxmox, AdGuard)
      return NextResponse.json({ status: 'online', statusText: 'OK', latency });
    } else {
      return NextResponse.json({ status: 'offline', statusText: `Error ${response.status}`, latency });
    }
  } catch (error: any) {
    let statusText = 'Client Error';
    if (error.name === 'AbortError') {
      statusText = 'Timeout';
    } else if (error.code === 'ECONNREFUSED') {
      statusText = 'Connection Refused';
    }
    return NextResponse.json({ status: 'offline', statusText, latency: 0 });
  }
}
