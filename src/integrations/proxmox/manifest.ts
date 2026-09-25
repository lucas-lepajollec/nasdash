import type { DeviceIntegrationManifest } from '../types';

/** Form fields and endpoint of Proxmox VE (browser-safe; reading is in `./collect`). */
export const proxmoxManifest: DeviceIntegrationManifest = {
  id: 'proxmox',
  name: 'Proxmox VE',
  selectable: true,
  fields: [
    { id: 'ip', kind: 'address', label: 'IP (Hôte)', placeholder: 'ex: 192.168.1.10', required: true, row: 0, flex: 3 },
    { id: 'port', kind: 'text', label: 'Port', required: true, defaultValue: '8006', row: 0 },
    { id: 'nodeName', kind: 'text', label: 'Nom du Nœud (Datacenter)', placeholder: 'ex: pve', required: true, defaultValue: 'pve', row: 1, panel: true },
    { id: 'vmid', kind: 'text', label: 'ID VM/LXC (Optionnel)', placeholder: 'ex: 104', row: 2, panel: true },
    {
      id: 'vmType', kind: 'select', label: 'Type', defaultValue: 'qemu', showWhen: 'vmid', row: 2, panel: true,
      options: [{ value: 'qemu', label: 'VM (QEMU)' }, { value: 'lxc', label: 'Conteneur (LXC)' }],
    },
    { id: 'username', kind: 'text', label: 'Token ID (ex: root@pam!token_name)', placeholder: 'root@pam!token', required: true, row: 3 },
    { id: 'password', kind: 'secret', label: 'Token Secret (UUID)', required: 'create', row: 3 },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned', hint: 'integrations.allowSelfSignedHint', row: 9 },
  ],

  connect(input, previousToken) {
    const node = `https://${input.ip}:${input.port || 8006}/api2/json/nodes/${input.nodeName || 'pve'}`;
    const url = input.vmid ? `${node}/${input.vmType || 'qemu'}/${input.vmid}/status/current` : `${node}/status`;
    // The token is `tokenId=secret`; an empty secret keeps the stored one.
    const equals = previousToken?.indexOf('=') ?? -1;
    const secret = input.password || (equals !== -1 ? previousToken!.substring(equals + 1) : '');
    return { url, token: input.username && secret ? `${input.username}=${secret}` : undefined };
  },
};
