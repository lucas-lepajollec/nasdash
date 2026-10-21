import type { ServiceIntegrationManifest } from '../types';

export const jellyfinManifest: ServiceIntegrationManifest = {
  id: 'jellyfin',
  name: 'Jellyfin',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.jellyfin.url', placeholder: 'http://jellyfin.example.com:8096', required: true },
    { id: 'apiKey', kind: 'secret', label: 'integrations.jellyfin.apiKey', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
