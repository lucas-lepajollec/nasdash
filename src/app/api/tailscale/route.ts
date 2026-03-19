import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const { stdout } = await execAsync('tailscale status --json');
    const data = JSON.parse(stdout);
    
    const devices = [];
    
    if (data.Self) {
      devices.push({
        id: data.Self.PublicKey || 'self',
        hostname: data.Self.HostName || 'Hôte',
        os: data.Self.OS || 'linux',
        ip: data.Self.TailscaleIPs?.[0] || '',
        online: data.Self.Online,
        lastSeen: 'Now',
        isSelf: true
      });
    }
    
    if (data.Peer) {
      for (const key in data.Peer) {
        const peer = data.Peer[key];
        const rawHost = peer.HostName || '';
        let hostname = rawHost;
        if (!rawHost || rawHost.toLowerCase() === 'localhost') {
          hostname = peer.DNSName ? peer.DNSName.split('.')[0] : 'Unknown';
        }

        devices.push({
          id: peer.PublicKey || key,
          hostname,
          os: peer.OS || 'unknown',
          ip: peer.TailscaleIPs?.[0] || '',
          online: peer.Online,
          lastSeen: peer.LastSeen,
          isSelf: false
        });
      }
    }
    
    devices.sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      // sort online first
      if (a.online && !b.online) return -1;
      if (!a.online && b.online) return 1;
      return a.hostname.localeCompare(b.hostname);
    });
    
    return NextResponse.json(devices);
  } catch (error) {
    console.error('Tailscale API Error:', error);
    return NextResponse.json({ error: 'Tailscale non disponible ou non installé' }, { status: 500 });
  }
}
