import type { ServiceIntegrationManifest } from '../types';

export const piholeManifest: ServiceIntegrationManifest = {
  id: 'pihole',
  name: 'Pi-hole',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.pihole.url', placeholder: 'http://pi.hole', required: true },
    { id: 'password', kind: 'secret', label: 'integrations.pihole.password', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
