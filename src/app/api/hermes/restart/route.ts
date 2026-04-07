import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

// POST /api/hermes/restart — restart the hermes container via docker socket proxy
export async function POST() {
  try {
    const config = readConfig();
    const settings = config.settings || {};

    // Use Hermes-specific docker proxy URL, or fallback to first docker host, or default
    const dockerProxyUrl = settings.hermesDockerProxy
      || (config.dockerHosts?.[0]?.url)
      || 'http://docker-proxy:2375';

    const containerName = settings.hermesContainerName || 'hermes-agent';

    const url = `${dockerProxyUrl.replace(/\/$/, '')}/containers/${containerName}/restart`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 204 || res.status === 200) {
        return NextResponse.json({ ok: true, message: `Container "${containerName}" restarted` });
      }

      const text = await res.text();
      return NextResponse.json(
        { error: `Docker API returned ${res.status}: ${text}` },
        { status: res.status }
      );
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: 'Restart timed out (15s)' }, { status: 504 });
      }
      throw fetchErr;
    }
  } catch (e: any) {
    console.error('Hermes restart error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
