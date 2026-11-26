import type { ServiceIntegrationManifest } from '../types';

export const craftyManifest: ServiceIntegrationManifest = {
  id: 'crafty',
  name: 'Crafty Controller',
  // A logo of the dashboard-icons collection (svg/…svg or png/…png), checked to exist.
  logo: 'svg/crafty-controller.svg',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.crafty.url', placeholder: 'https://crafty.example.com:8443' },
    // An API key made in Crafty's panel (Users › API keys); Commands on a server lets the widget start, stop and restart it.
    { id: 'apiKey', kind: 'secret', required: true, label: 'integrations.crafty.apiKey' },
    // Crafty serves HTTPS with its own certificate by default.
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
