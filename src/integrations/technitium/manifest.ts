import type { ServiceIntegrationManifest } from '../types';

export const technitiumManifest: ServiceIntegrationManifest = {
  id: 'technitium',
  name: 'Technitium DNS',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.technitium.url', placeholder: 'http://dns.example.com:5380', required: true },
    { id: 'token', kind: 'secret', label: 'integrations.technitium.token', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
