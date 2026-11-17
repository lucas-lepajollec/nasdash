import type { ServiceIntegrationManifest } from '../types';

export const kavitaManifest: ServiceIntegrationManifest = {
  id: 'kavita',
  name: 'Kavita',
  logo: 'svg/kavita.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.kavita.url', placeholder: 'http://kavita.example.com:5000' },
    // User settings → 3rd Party Clients → API key (OPDS).
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.kavita.apiKey' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
