import type { ServiceIntegrationManifest } from '../types';

export const ntfyManifest: ServiceIntegrationManifest = {
  id: 'ntfy',
  name: 'ntfy',
  logo: 'svg/ntfy.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.ntfy.url', placeholder: 'https://ntfy.example.com' },
    // One or more topics, separated by commas.
    { id: 'topics', kind: 'text', required: true, label: 'integrations.ntfy.topics', placeholder: 'backups, alerts' },
    // For protected topics: an access token (tk_…), from the account page or `ntfy token add`.
    { id: 'token', kind: 'secret', label: 'integrations.ntfy.token' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
