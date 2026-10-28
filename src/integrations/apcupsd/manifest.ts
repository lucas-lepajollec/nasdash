import type { ServiceIntegrationManifest } from '../types';

export const apcupsdManifest: ServiceIntegrationManifest = {
  id: 'apcupsd',
  name: 'apcupsd',
  fields: [
    // apcupsd's network information server (NISIP / NISPORT in apcupsd.conf): Unraid, Linux, APC units.
    { id: 'host', kind: 'text', required: true, label: 'integrations.apcupsd.host', placeholder: 'nas.example.com' },
    { id: 'port', kind: 'text', label: 'integrations.apcupsd.port', placeholder: '3551' },
  ],
};
