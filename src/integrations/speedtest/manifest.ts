import type { ServiceIntegrationManifest } from '../types';

export const speedtestManifest: ServiceIntegrationManifest = {
  id: 'speedtest',
  name: 'Speedtest Tracker',
  logo: 'png/speedtest-tracker.png',
  fields: [
    { id: 'url', kind: 'text', required: true, label: 'integrations.speedtest.url', placeholder: 'http://speedtest.example.com:8080' },
    // An API token (Speedtest Tracker → API tokens) that reads results; "run speedtest" lets admins start one.
    { id: 'token', kind: 'secret', required: true, label: 'integrations.speedtest.token' },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ],
};
