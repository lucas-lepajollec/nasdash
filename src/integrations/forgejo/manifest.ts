import type { ServiceIntegrationManifest } from '../types';

export const forgejoManifest: ServiceIntegrationManifest = {
  id: 'forgejo',
  name: 'Forgejo',
  // A logo of the dashboard-icons collection (svg/…svg or png/…png), checked to exist.
  logo: 'svg/forgejo.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.forgejo.url', placeholder: 'https://forgejo.example.com' },
    // An access token (Settings › Applications) with read access to user, repository, issue and notification.
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.forgejo.apiKey' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
