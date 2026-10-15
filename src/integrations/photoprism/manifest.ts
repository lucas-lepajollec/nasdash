import type { ServiceIntegrationManifest } from '../types';

export const photoprismManifest: ServiceIntegrationManifest = {
  id: 'photoprism',
  name: 'PhotoPrism',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.photoprism.url', placeholder: 'https://photos.example.com', required: true },
    { id: 'token', kind: 'secret', label: 'integrations.photoprism.token', required: true },
  ],
};
