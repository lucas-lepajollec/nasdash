import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { isDemoMode } from '@/lib/demoMode';
import { latestInstance } from '@/integrations/instances';
import { fetchHeadscaleDevices } from '@/integrations/headscale/collect';
import { fetchTailscaleDevices, TailscaleError } from '@/integrations/tailscale/collect';

export async function GET(request: Request) {
  try {
    const config = readConfig();
    const access = checkReadAccess(
      request,
      config.settings?.securityMode || 'public',
      READ_ACCESS.tailscale
    );
    if (access.error) return access.error;

    if (isDemoMode()) {
      return NextResponse.json({
        simulated: true,
        tailnet: 'nasdash-demo',
        clientId: '',
        devices: [
          { id: 'demo-ts-1', hostname: 'atlas-nas', os: 'linux', ip: '100.64.0.10', online: true, isSelf: true },
          { id: 'demo-ts-2', hostname: 'orion-compute', os: 'linux', ip: '100.64.0.20', online: true, isSelf: false },
          { id: 'demo-ts-3', hostname: 'travel-laptop', os: 'windows', ip: '100.64.0.30', online: false, lastSeen: '2026-08-10T18:20:00.000Z', isSelf: false },
        ],
      });
    }

    // The mesh connection saved last (Tailscale or Headscale), secrets decrypted server-side.
    const instance = latestInstance(config, ['tailscale', 'headscale']);
    try {
      if (instance?.type === 'headscale') {
        const url = instance.settings.url ?? '';
        const apiKey = instance.secrets?.apiKey ?? '';
        const tailnet = url ? new URL(url).host : '';
        if (!url || !apiKey) return NextResponse.json({ unconfigured: true, provider: 'headscale', tailnet, clientId: '' });
        const devices = await fetchHeadscaleDevices({ url, apiKey });
        return NextResponse.json({ provider: 'headscale', devices, tailnet, clientId: '' });
      }
      const tailnet = instance?.settings.tailnet ?? '';
      const clientId = instance?.settings.clientId ?? '';
      const clientSecret = instance?.secrets?.clientSecret ?? '';
      if (!tailnet || !clientId || !clientSecret) {
        return NextResponse.json({ unconfigured: true, provider: 'tailscale', tailnet, clientId });
      }
      const devices = await fetchTailscaleDevices({ tailnet, clientId, clientSecret });
      return NextResponse.json({ provider: 'tailscale', devices, tailnet, clientId });
    } catch (error) {
      if (error instanceof TailscaleError && error.credentialsProblem) {
        return NextResponse.json({ unconfigured: true, error: error.message, provider: instance?.type ?? 'tailscale', tailnet: instance?.settings.tailnet ?? '', clientId: instance?.settings.clientId ?? '' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Tailscale API Error:', error);
    return NextResponse.json({ error: 'Erreur lors de la connexion à Tailscale' }, { status: 500 });
  }
}
