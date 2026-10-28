import type { ServiceIntegrationManifest } from '../types';

export const gluetunManifest: ServiceIntegrationManifest = {
  id: 'gluetun',
  name: 'Gluetun',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.gluetun.url', placeholder: 'http://gluetun.example.com:8000' },
    // The control server's own roles (Gluetun 3.40+): an API key, a user and password, or no authentication.
    { id: 'auth', kind: 'select', label: 'integrations.gluetun.auth', options: ['apikey', 'basic', 'none'].map(value => ({ value, label: `integrations.gluetun.auth.${value}` })) },
    { id: 'apiKey', kind: 'secret', label: 'integrations.gluetun.apiKey', showWhen: { field: 'auth', values: ['', 'apikey'] } },
    { id: 'username', kind: 'text', label: 'integrations.gluetun.username', showWhen: { field: 'auth', values: ['basic'] } },
    { id: 'password', kind: 'secret', label: 'integrations.gluetun.password', showWhen: { field: 'auth', values: ['basic'] } },
  ],
};
