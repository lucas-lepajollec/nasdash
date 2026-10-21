import type { ServiceIntegrationManifest } from '../types';

export const sabnzbdManifest: ServiceIntegrationManifest = {
  id: 'sabnzbd',
  name: 'SABnzbd',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.sabnzbd.url', placeholder: 'http://sabnzbd.example.com:8080' },
    { id: 'apiKey', kind: 'secret', label: 'integrations.sabnzbd.apiKey', required: true },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
