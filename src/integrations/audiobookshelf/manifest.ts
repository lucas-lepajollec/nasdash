import type { ServiceIntegrationManifest } from '../types';

export const audiobookshelfManifest: ServiceIntegrationManifest = {
  id: 'audiobookshelf',
  name: 'Audiobookshelf',
  logo: 'svg/audiobookshelf.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.audiobookshelf.url', placeholder: 'http://audiobooks.example.com:13378' },
    // Settings → Users → the account → API token (or an API key on recent versions).
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.audiobookshelf.apiKey' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
