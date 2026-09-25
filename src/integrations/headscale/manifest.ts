import type { ServiceIntegrationManifest } from '../types';

/** Headscale, the self-hosted Tailscale control server (API key from `headscale apikeys create`). */
export const headscaleManifest: ServiceIntegrationManifest = {
  id: 'headscale',
  name: 'Headscale',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.headscale.url', placeholder: 'https://headscale.example.com', required: true },
    { id: 'apiKey', kind: 'secret', label: 'integrations.headscale.apiKey', placeholder: 'integrations.headscale.apiKey', required: true },
  ],
};
