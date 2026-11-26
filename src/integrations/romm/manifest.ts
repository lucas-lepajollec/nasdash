import type { ServiceIntegrationManifest } from '../types';

export const rommManifest: ServiceIntegrationManifest = {
  id: 'romm',
  name: 'RomM',
  // A logo of the dashboard-icons collection (svg/…svg or png/…png), checked to exist.
  logo: 'svg/romm.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.romm.url', placeholder: 'https://romm.example.com' },
    { id: 'auth', kind: 'select', label: 'integrations.romm.auth', options: ['token', 'login'].map(value => ({ value, label: `integrations.romm.auth.${value}` })) },
    // A client API token (Administration › Client API tokens, read only is enough), or the account's sign-in.
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.romm.apiKey', showWhen: { field: 'auth', values: ['', 'token'] } },
    { id: 'username', kind: 'text', required: true, label: 'integrations.romm.username', showWhen: { field: 'auth', values: ['login'] } },
    { id: 'password', kind: 'secret', required: true, label: 'integrations.romm.password', showWhen: { field: 'auth', values: ['login'] } },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
