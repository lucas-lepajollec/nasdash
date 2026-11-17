import type { ServiceIntegrationManifest } from '../types';

export const uptimekumaManifest: ServiceIntegrationManifest = {
  id: 'uptimekuma',
  name: 'Uptime Kuma',
  logo: 'svg/uptime-kuma.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.uptimekuma.url', placeholder: 'http://uptime.example.com:3001' },
    // A status page's address name (Status pages → its slug): Uptime Kuma serves it without an account.
    { id: 'slug', kind: 'text', required: true, label: 'integrations.uptimekuma.slug', placeholder: 'homelab' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
