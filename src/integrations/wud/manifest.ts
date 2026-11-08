import type { ServiceIntegrationManifest } from '../types';

export const wudManifest: ServiceIntegrationManifest = {
  id: 'wud',
  name: "What's Up Docker",
  logo: 'svg/whats-up-docker.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.wud.url', placeholder: 'http://wud.example.com:3000' },
    // WUD answers without authentication unless basic authentication is turned on.
    { id: 'auth', kind: 'select', label: 'integrations.wud.auth', options: ['none', 'basic'].map(value => ({ value, label: `integrations.wud.auth.${value}` })) },
    { id: 'username', kind: 'text', label: 'integrations.wud.username', showWhen: { field: 'auth', values: ['basic'] } },
    { id: 'password', kind: 'secret', label: 'integrations.wud.password', showWhen: { field: 'auth', values: ['basic'] } },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
