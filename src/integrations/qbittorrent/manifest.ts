import type { ServiceIntegrationManifest } from '../types';

export const qbittorrentManifest: ServiceIntegrationManifest = {
  id: 'qbittorrent',
  name: 'qBittorrent',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.qbittorrent.url', placeholder: 'http://qbittorrent.example.com:8080' },
    { id: 'username', kind: 'text', label: 'integrations.qbittorrent.username', required: true },
    { id: 'password', kind: 'secret', label: 'integrations.qbittorrent.password', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
