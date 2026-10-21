import type { ServiceIntegrationManifest } from '../types';

export const nzbgetManifest: ServiceIntegrationManifest = {
  id: 'nzbget',
  name: 'NZBGet',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.nzbget.url', placeholder: 'http://nzbget.example.com:6789' },
    { id: 'username', kind: 'text', label: 'integrations.nzbget.username', required: true },
    { id: 'password', kind: 'secret', label: 'integrations.nzbget.password', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
