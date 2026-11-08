import type { ServiceIntegrationManifest } from '../types';

export const syncthingManifest: ServiceIntegrationManifest = {
  id: 'syncthing',
  name: 'Syncthing',
  logo: 'svg/syncthing.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.syncthing.url', placeholder: 'http://syncthing.example.com:8384' },
    // Settings → GUI → API key in Syncthing: it reads everything, so it stays on the server.
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.syncthing.apiKey' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
