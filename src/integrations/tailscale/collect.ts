/** Reads the devices of a tailnet (server only). */

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

export interface TailscaleDevice {
  id?: string;
  hostname: string;
  os: string;
  ip: string;
  online: boolean;
  lastSeen?: string;
  isSelf: boolean;
}

export interface TailscaleCredentials {
  tailnet: string;
  clientId: string;
  clientSecret: string;
}

/** Why the tailnet could not be read; the message is shown in the widget. */
export class TailscaleError extends Error {
  constructor(message: string, readonly credentialsProblem: boolean) {
    super(message);
    this.name = 'TailscaleError';
  }
}

const API = 'https://api.tailscale.com/api/v2';
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** Devices named `localhost` or after the phone model get their Tailscale name instead. */
export function toTailscaleDevice(device: TailscaleApiDevice, now = Date.now()): TailscaleDevice {
  let hostname = device.hostname || '';
  if (!hostname || hostname.toLowerCase() === 'localhost' || hostname.includes('iPhone') || hostname.includes('iPad')) {
    hostname = device.givenName || (device.name ? device.name.split('.')[0] : 'Unknown');
  }
  let online = device.clientConnectivity?.online;
  if (online === undefined && device.lastSeen) online = now - new Date(device.lastSeen).getTime() < ONLINE_WINDOW_MS;
  return {
    id: device.nodeId || device.id,
    hostname,
    os: device.os || 'unknown',
    ip: device.addresses?.[0] || '',
    online: Boolean(online),
    lastSeen: device.lastSeen,
    isSelf: false,
  };
}

/** Online first, then by name. */
export function sortTailscaleDevices(devices: TailscaleDevice[]): TailscaleDevice[] {
  return [...devices].sort((a, b) => Number(b.online) - Number(a.online) || a.hostname.localeCompare(b.hostname));
}

export async function fetchTailscaleDevices(credentials: TailscaleCredentials): Promise<TailscaleDevice[]> {
  const tokenResponse = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, grant_type: 'client_credentials' }).toString(),
  });
  if (!tokenResponse.ok) throw new TailscaleError('Identifiants OAuth invalides', true);
  const accessToken = (await tokenResponse.json() as { access_token?: string }).access_token;
  if (!accessToken) throw new TailscaleError('Réponse OAuth Tailscale invalide', true);

  const response = await fetch(`${API}/tailnet/${credentials.tailnet}/devices`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    // Cached for 60 s to stay well below Tailscale's API limits.
    next: { revalidate: 60 },
  } as RequestInit);
  if (response.status === 401 || response.status === 403) throw new TailscaleError('Accès refusé par Tailscale', true);
  if (!response.ok) throw new Error(`Tailscale API responded with ${response.status}`);
  const data = await response.json() as { devices?: TailscaleApiDevice[] };
  return sortTailscaleDevices((data.devices ?? []).map(device => toTailscaleDevice(device)));
}
