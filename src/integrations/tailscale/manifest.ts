import type { ServiceIntegrationManifest } from '../types';

/** Tailscale API with an OAuth client (read access to devices is enough). */
export const tailscaleManifest: ServiceIntegrationManifest = {
  id: 'tailscale',
  name: 'Tailscale',
  fields: [
    { id: 'tailnet', kind: 'text', label: 'Nom du Tailnet', placeholder: 'Nom du Tailnet (ex: email@domaine.com)', required: true },
    { id: 'clientId', kind: 'hidden', label: 'OAuth Client ID Tailscale', placeholder: 'OAuth Client ID (kxxxx...)', required: true },
    { id: 'clientSecret', kind: 'secret', label: 'OAuth Client Secret Tailscale', placeholder: 'OAuth Client Secret (tskey-client-...)', required: true },
  ],
};
