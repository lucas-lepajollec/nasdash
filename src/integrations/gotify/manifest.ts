import type { ServiceIntegrationManifest } from '../types';

export const gotifyManifest: ServiceIntegrationManifest = {
  id: 'gotify',
  name: 'Gotify',
  logo: 'png/gotify.png',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.gotify.url', placeholder: 'http://gotify.example.com' },
    // A client token (Clients → Create client): it reads messages; an application token only sends.
    { id: 'token', kind: 'secret', required: true, label: 'integrations.gotify.token' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
