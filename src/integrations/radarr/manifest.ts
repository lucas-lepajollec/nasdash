import type { ServiceIntegrationManifest } from '../types';

export const radarrManifest: ServiceIntegrationManifest = {
  id: 'radarr',
  name: 'Radarr',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.radarr.url', placeholder: 'http://radarr.example.com:7878' },
    { id: 'apiKey', kind: 'secret', label: 'integrations.radarr.apiKey', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
