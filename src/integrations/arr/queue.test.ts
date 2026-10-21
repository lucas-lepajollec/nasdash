import { describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
import { toArrQueue } from './collect';

describe('private arr queue download metadata', () => {
  const instance: IntegrationInstance = { id: 'sonarr', type: 'sonarr', name: 'Fictional Sonarr', settings: {} };
  it.each([
    ['qBittorrent', 'torrent', 'ABCDEF0123'.repeat(4)],
    ['Transmission', 'torrent', 'ABCDEF0123'.repeat(4)],
    ['Deluge', 'torrent', 'ABCDEF0123'.repeat(4)],
    ['SABnzbd', 'usenet', 'SABnzbd_nzo_71'],
    ['NZBGet', 'usenet', 71],
  ])('keeps the %s download id in a separate server-only map', (clientName, protocol, downloadId) => {
    const data = toArrQueue(instance, { records: [{ id: 4, protocol, downloadId, downloadClient: clientName, status: 'paused' }] });
    expect(data.downloads.get('sonarr:4')).toEqual({ downloadId: String(downloadId), protocol, clientName });
    expect(data.items[0]).toMatchObject({ id: 'sonarr:4', status: 'paused', client: clientName, protocol });
    expect(data.items[0]).not.toHaveProperty('downloadId');
    expect(data.items[0]).not.toHaveProperty('clientName');
  });
  it('omits incomplete or oversized private metadata', () => {
    for (const item of [{}, { downloadId: 'x', protocol: 'other' }, { downloadId: 'x'.repeat(129), protocol: 'torrent' }]) {
      expect(toArrQueue(instance, { records: [{ id: 4, ...item }] }).downloads.size).toBe(0);
    }
  });
});
