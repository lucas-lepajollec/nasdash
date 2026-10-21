import type { ServiceIntegrationManifest } from '../types';

export const prowlarrManifest: ServiceIntegrationManifest = {
  id: 'prowlarr',
  name: 'Prowlarr',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.prowlarr.url', placeholder: 'http://prowlarr.example.com:9696' },
    { id: 'apiKey', kind: 'secret', label: 'integrations.prowlarr.apiKey', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
