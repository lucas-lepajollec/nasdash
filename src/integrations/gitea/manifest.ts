import type { ServiceIntegrationManifest } from '../types';

export const giteaManifest: ServiceIntegrationManifest = {
  id: 'gitea',
  name: 'Gitea',
  // A logo of the dashboard-icons collection (svg/…svg or png/…png), checked to exist.
  logo: 'svg/gitea.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.gitea.url', placeholder: 'https://gitea.example.com' },
    // An access token (Settings › Applications) with read access to user, repository, issue and notification.
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.gitea.apiKey' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
