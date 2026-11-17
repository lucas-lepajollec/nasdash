import type { ServiceIntegrationManifest } from '../types';

export const komgaManifest: ServiceIntegrationManifest = {
  id: 'komga',
  name: 'Komga',
  logo: 'svg/komga.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.komga.url', placeholder: 'http://komga.example.com:25600' },
    // Account settings → API keys (Komga 1.17 and later).
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.komga.apiKey' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
