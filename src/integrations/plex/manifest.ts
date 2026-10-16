import type { ServiceIntegrationManifest } from '../types';

export const plexManifest: ServiceIntegrationManifest = {
  id: 'plex',
  name: 'Plex',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.plex.url', placeholder: 'http://plex.example.com:32400', required: true },
    { id: 'token', kind: 'secret', label: 'integrations.plex.token', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
