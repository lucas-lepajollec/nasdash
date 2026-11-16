import type { ServiceIntegrationManifest } from '../types';

/** Seerr, and Overseerr or Jellyseerr before it: the same API. */
export const seerrManifest: ServiceIntegrationManifest = {
  id: 'seerr',
  name: 'Seerr',
  logo: 'svg/jellyseerr.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.seerr.url', placeholder: 'http://seerr.example.com:5055' },
    // Settings → General → API key: it acts as the administrator, to see every request and approve them.
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.seerr.apiKey' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
