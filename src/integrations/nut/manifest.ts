import type { ServiceIntegrationManifest } from '../types';

export const nutManifest: ServiceIntegrationManifest = {
  id: 'nut',
  name: 'Network UPS Tools',
  fields: [
    // upsd's own address: the NAS, Proxmox, a Synology or QNAP "network UPS server", or a NUT container. Reading
    // needs no account (upsd only checks one for commands); servers allow readers by address (LISTEN, Synology's list).
    { id: 'host', kind: 'text', required: true, label: 'integrations.nut.host', placeholder: 'nas.example.com' },
    { id: 'port', kind: 'text', label: 'integrations.nut.port', placeholder: '3493' },
  ],
};
