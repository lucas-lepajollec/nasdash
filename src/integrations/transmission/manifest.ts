import type { ServiceIntegrationManifest } from '../types';

export const transmissionManifest: ServiceIntegrationManifest = {
  id: 'transmission',
  name: 'Transmission',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.transmission.url', placeholder: 'http://transmission.example.com:9091' },
    { id: 'username', kind: 'text', label: 'integrations.transmission.username' },
    { id: 'password', kind: 'secret', label: 'integrations.transmission.password' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
