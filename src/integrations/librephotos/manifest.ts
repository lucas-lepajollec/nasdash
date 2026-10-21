import type { ServiceIntegrationManifest } from '../types';
export const librephotosManifest: ServiceIntegrationManifest = {
  id: 'librephotos', name: 'LibrePhotos', section: 'photos',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.librephotos.url', placeholder: 'https://librephotos.example.com', required: true },
    { id: 'username', kind: 'text', label: 'integrations.librephotos.username', required: true },
    { id: 'password', kind: 'secret', label: 'integrations.librephotos.password', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
