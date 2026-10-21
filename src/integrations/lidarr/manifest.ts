import type { ServiceIntegrationManifest } from '../types';

export const lidarrManifest: ServiceIntegrationManifest = {
  id: 'lidarr',
  name: 'Lidarr',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.lidarr.url', placeholder: 'http://lidarr.example.com:8686' },
    { id: 'apiKey', kind: 'secret', label: 'integrations.lidarr.apiKey', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
