import type { ServiceIntegrationManifest } from '../types';

export const gitlabManifest: ServiceIntegrationManifest = {
  id: 'gitlab',
  name: 'GitLab',
  // A logo of the dashboard-icons collection (svg/…svg or png/…png), checked to exist.
  logo: 'svg/gitlab.svg',
  fields: [
    // Empty: gitlab.com. A self-managed GitLab: its address.
    { id: 'url', kind: 'text', label: 'integrations.gitlab.url', placeholder: 'https://gitlab.com' },
    // A personal access token with the read_api scope.
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.gitlab.apiKey' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
