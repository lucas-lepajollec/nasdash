import type { ServiceIntegrationManifest } from '../types';

export const customapiManifest: ServiceIntegrationManifest = {
  id: 'customapi',
  name: 'Custom API',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.customapi.url', required: true, placeholder: 'https://service.example.com/api/status' },
    { id: 'authType', kind: 'select', label: 'integrations.customapi.authType', options: ['none', 'bearer', 'header', 'basic', 'query'].map(value => ({ value, label: `integrations.customapi.auth.${value}` })) },
    { id: 'authName', kind: 'text', label: 'integrations.customapi.authName', showWhen: { field: 'authType', values: ['header', 'basic', 'query'] } },
    { id: 'authValue', kind: 'secret', label: 'integrations.customapi.authValue', showWhen: { field: 'authType', values: ['bearer', 'header', 'basic', 'query'] } },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
