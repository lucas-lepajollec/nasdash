import type { ServiceIntegrationManifest } from '../types';

export const navidromeManifest: ServiceIntegrationManifest = {
  id: 'navidrome', name: 'Navidrome / Subsonic', section: 'media',
  fields: [
    { id: 'url', kind: 'text', label: 'integrations.navidrome.url', placeholder: 'https://music.example.com', required: true },
    { id: 'username', kind: 'text', label: 'integrations.navidrome.username', required: true },
    { id: 'password', kind: 'secret', label: 'integrations.navidrome.password', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
