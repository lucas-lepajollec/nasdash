import { httpGet } from '../http';
import { sortTailscaleDevices, TailscaleError, type TailscaleDevice } from '../tailscale/collect';

/**
 * Headscale API: `GET /api/v1/node` with `Authorization: Bearer <api key>` →
 * `{ nodes: [{ id, name, givenName, ipAddresses, online, lastSeen, user }] }`.
 * Mapped to the same device list as Tailscale, so the widget shows both alike.
 */

interface HeadscaleNode {
  id?: string;
  name?: string;
  givenName?: string;
  ipAddresses?: string[];
  online?: boolean;
  lastSeen?: string | null;
}

export function toHeadscaleDevices(nodes: HeadscaleNode[]): TailscaleDevice[] {
  return sortTailscaleDevices(nodes.map(node => ({
    id: node.id,
    hostname: node.givenName || node.name || 'Unknown',
    // Headscale does not report the operating system.
    os: 'unknown',
    ip: node.ipAddresses?.find(address => !address.includes(':')) ?? node.ipAddresses?.[0] ?? '',
    online: node.online === true,
    lastSeen: node.lastSeen ?? undefined,
    isSelf: false,
  })));
}

export async function fetchHeadscaleDevices(credentials: { url: string; apiKey: string }): Promise<TailscaleDevice[]> {
  const answer = await httpGet(`${credentials.url.replace(/\/$/, '')}/api/v1/node`, {
    headers: { Authorization: `Bearer ${credentials.apiKey}`, Accept: 'application/json' },
    timeoutMs: 6000,
  });
  if (answer.status === 401 || answer.status === 403) throw new TailscaleError('Clé API Headscale refusée', true);
  if (!answer.ok) throw new Error(`Headscale API responded with ${answer.status}`);
  const body = JSON.parse(await answer.text()) as { nodes?: HeadscaleNode[] };
  return toHeadscaleDevices(body.nodes ?? []);
}
