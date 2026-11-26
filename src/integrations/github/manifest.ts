import type { ServiceIntegrationManifest } from '../types';

export const githubManifest: ServiceIntegrationManifest = {
  id: 'github',
  name: 'GitHub',
  // A logo of the dashboard-icons collection (svg/…svg or png/…png), checked to exist.
  logo: 'svg/github.svg',
  fields: [
    // Empty: github.com. GitHub Enterprise Server: its API address (https://github.example.com/api/v3).
    { id: 'url', kind: 'text', label: 'integrations.github.url', placeholder: 'https://api.github.com' },
    // A personal access token. Classic with `repo` and `notifications` shows everything; a fine-grained one shows no notifications.
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.github.apiKey' },
  ],
};
