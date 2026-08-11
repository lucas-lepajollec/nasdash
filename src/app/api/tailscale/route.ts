import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { isDemoMode } from '@/lib/demoMode';

interface TailscaleApiDevice {
  nodeId?: string;
  id?: string;
  hostname?: string;
  givenName?: string;
  name?: string;
  os?: string;
  addresses?: string[];
  lastSeen?: string;
  clientConnectivity?: { online?: boolean };
}

interface TailscaleDeviceView {
  id?: string;
  hostname: string;
  os: string;
  ip: string;
  online: boolean;
  lastSeen?: string;
  isSelf: boolean;
}

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

    const { tailscaleTailnet, tailscaleClientId, tailscaleClientSecret } = config.settings;

    if (!tailscaleTailnet || !tailscaleClientId || !tailscaleClientSecret) {
      return NextResponse.json({ unconfigured: true, tailnet: tailscaleTailnet || '', clientId: tailscaleClientId || '' });
    }

    // OAuth flow to get access token
    const tokenRes = await fetch('https://api.tailscale.com/api/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: tailscaleClientId,
        client_secret: tailscaleClientSecret,
        grant_type: 'client_credentials'
      }).toString()
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ unconfigured: true, error: 'Identifiants OAuth invalides', tailnet: tailscaleTailnet, clientId: tailscaleClientId });
    }

    const tokenData = await tokenRes.json() as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.json({ unconfigured: true, error: 'Réponse OAuth Tailscale invalide', tailnet: tailscaleTailnet, clientId: tailscaleClientId });
    }

    // Get devices list using the access token
    const res = await fetch(`https://api.tailscale.com/api/v2/tailnet/${tailscaleTailnet}/devices`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      next: { revalidate: 60 } // Cache for 60 seconds to avoid hitting API limits
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ unconfigured: true, error: 'Accès refusé par Tailscale', tailnet: tailscaleTailnet, clientId: tailscaleClientId });
      }
      throw new Error(`Tailscale API responded with ${res.status}`);
    }

    const data = await res.json() as { devices?: TailscaleApiDevice[] };
    const apiDevices = data.devices || [];

    const devices: TailscaleDeviceView[] = apiDevices.map(device => {
      let hostname = device.hostname || '';
      if (!hostname || hostname.toLowerCase() === 'localhost' || hostname.includes('iPhone') || hostname.includes('iPad')) {
        if (device.givenName) {
          hostname = device.givenName;
        } else if (device.name) {
          hostname = device.name.split('.')[0];
        } else {
          hostname = 'Unknown';
        }
      }

      let online = device.clientConnectivity?.online;
      if (online === undefined && device.lastSeen) {
        const lastSeenDate = new Date(device.lastSeen);
        const now = new Date();
        const diffMs = now.getTime() - lastSeenDate.getTime();
        online = diffMs < 5 * 60 * 1000; // 5 minutes
      }

      return {
        id: device.nodeId || device.id,
        hostname: hostname,
        os: device.os || 'unknown',
        ip: device.addresses?.[0] || '',
        online: !!online,
        lastSeen: device.lastSeen,
        isSelf: false
      };
    });

    devices.sort((a, b) => {
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      return a.hostname.localeCompare(b.hostname);
    });

    return NextResponse.json({ devices, tailnet: tailscaleTailnet, clientId: tailscaleClientId });
  } catch (error) {
    console.error('Tailscale API Error:', error);
    return NextResponse.json({ error: 'Erreur lors de la connexion à Tailscale' }, { status: 500 });
  }
}
