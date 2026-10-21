import type { ServiceIntegrationManifest } from '../types';

export const sonarrManifest: ServiceIntegrationManifest = {
  id: 'sonarr',
  name: 'Sonarr',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.sonarr.url', placeholder: 'http://sonarr.example.com:8989' },
    { id: 'apiKey', kind: 'secret', label: 'integrations.sonarr.apiKey', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
