import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';

export async function GET() {
  try {
    const config = readConfig();
    const { tailscaleTailnet, tailscaleClientId, tailscaleClientSecret } = config.settings;

    if (!tailscaleTailnet || !tailscaleClientId || !tailscaleClientSecret) {
      return NextResponse.json({ unconfigured: true });
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
      return NextResponse.json({ unconfigured: true, error: 'Identifiants OAuth invalides' });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

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
        return NextResponse.json({ unconfigured: true, error: 'Accès refusé par Tailscale' });
      }
      throw new Error(`Tailscale API responded with ${res.status}`);
    }

    const data = await res.json();
    const apiDevices = data.devices || [];

    const devices = apiDevices.map((device: any) => {
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

    devices.sort((a: any, b: any) => {
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      return a.hostname.localeCompare(b.hostname);
    });

    return NextResponse.json(devices);
  } catch (error) {
    console.error('Tailscale API Error:', error);
    return NextResponse.json({ error: 'Erreur lors de la connexion à Tailscale' }, { status: 500 });
  }
}
