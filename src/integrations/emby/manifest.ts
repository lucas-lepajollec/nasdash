import type { ServiceIntegrationManifest } from '../types';

export const embyManifest: ServiceIntegrationManifest = {
  id: 'emby',
  name: 'Emby',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.emby.url', placeholder: 'http://emby.example.com:8096', required: true },
    { id: 'apiKey', kind: 'secret', label: 'integrations.emby.apiKey', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
