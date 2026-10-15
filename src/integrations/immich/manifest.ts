import type { ServiceIntegrationManifest } from '../types';

export const immichManifest: ServiceIntegrationManifest = {
  id: 'immich',
  name: 'Immich',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.immich.url', placeholder: 'https://immich.example.com', required: true },
    { id: 'apiKey', kind: 'secret', label: 'integrations.immich.apiKey', required: true },
  ],
};
