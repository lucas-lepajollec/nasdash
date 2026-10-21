import type { ServiceIntegrationManifest } from '../types';

export const delugeManifest: ServiceIntegrationManifest = {
  id: 'deluge',
  name: 'Deluge',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.deluge.url', placeholder: 'http://deluge.example.com:8112' },
    { id: 'password', kind: 'secret', label: 'integrations.deluge.password', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
