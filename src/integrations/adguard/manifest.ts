import type { ServiceIntegrationManifest } from '../types';

export const adguardManifest: ServiceIntegrationManifest = {
  id: 'adguard',
  name: 'AdGuard Home',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.adguard.url', placeholder: 'http://adguard.example.com', required: true },
    { id: 'username', kind: 'text', label: 'integrations.adguard.username', required: true },
    { id: 'password', kind: 'secret', label: 'integrations.adguard.password', required: true },
  ],
};
