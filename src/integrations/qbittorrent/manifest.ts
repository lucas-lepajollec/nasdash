import type { ServiceIntegrationManifest } from '../types';

export const qbittorrentManifest: ServiceIntegrationManifest = {
  id: 'qbittorrent',
  name: 'qBittorrent',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.qbittorrent.url', placeholder: 'http://qbittorrent.example.com:8080' },
    { id: 'auth', kind: 'select', label: 'integrations.qbittorrent.auth', options: ['login', 'apikey'].map(value => ({ value, label: `integrations.qbittorrent.auth.${value}` })) },
    // qBittorrent 5.2+ issues API keys (Web UI options); older versions only log in.
    { id: 'apiKey', kind: 'secret', label: 'integrations.qbittorrent.apiKey', required: true, showWhen: { field: 'auth', values: ['apikey'] } },
    { id: 'username', kind: 'text', label: 'integrations.qbittorrent.username', required: true, showWhen: { field: 'auth', values: ['', 'login'] } },
    { id: 'password', kind: 'secret', label: 'integrations.qbittorrent.password', required: true, showWhen: { field: 'auth', values: ['', 'login'] } },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
