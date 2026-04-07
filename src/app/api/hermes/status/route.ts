import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

// GET /api/hermes/status — check hermes container & API status
export async function GET() {
  try {
    const config = readConfig();
    const settings = config.settings || {};

    const dockerProxyUrl = settings.hermesDockerProxy
      || (config.dockerHosts?.[0]?.url)
      || 'http://docker-proxy:2375';

    const containerName = settings.hermesContainerName || 'hermes-agent';
    const hermesApiUrl = settings.hermesUrl || '';

    // 1. Check container status via Docker proxy
    let containerStatus: any = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `${dockerProxyUrl.replace(/\/$/, '')}/containers/${containerName}/json`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        containerStatus = {
          state: data.State?.Status || 'unknown',
          running: data.State?.Running || false,
          startedAt: data.State?.StartedAt,
          image: data.Config?.Image,
          uptime: data.State?.StartedAt
            ? Math.floor((Date.now() - new Date(data.State.StartedAt).getTime()) / 1000)
            : 0,
        };
      }
    } catch {
      containerStatus = { state: 'unreachable', running: false };
    }

    // 2. Check Hermes API if URL is configured
    let apiStatus: any = null;
    if (hermesApiUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `${hermesApiUrl.replace(/\/$/, '')}/v1/models`,
          {
            signal: controller.signal,
            headers: settings.hermesApiKey
              ? { Authorization: `Bearer ${settings.hermesApiKey}` }
              : {},
          }
        );
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          apiStatus = { online: true, models: data };
        } else {
          apiStatus = { online: false, status: res.status };
        }
      } catch {
        apiStatus = { online: false };
      }
    }

    return NextResponse.json({
      container: containerStatus,
      api: apiStatus,
      configured: !!(settings.hermesDataPath || settings.hermesUrl),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
