import type { ServiceIntegrationManifest } from '../types';
export const piwigoManifest: ServiceIntegrationManifest = {
  id: 'piwigo', name: 'Piwigo', section: 'photos',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.piwigo.url', placeholder: 'https://piwigo.example.com', required: true },
    { id: 'username', kind: 'text', label: 'integrations.piwigo.username', required: true },
    { id: 'password', kind: 'secret', label: 'integrations.piwigo.password', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
