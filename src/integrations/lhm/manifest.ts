import { withScheme, type DeviceIntegrationManifest } from '../types';

/** Form fields and endpoint of Libre Hardware Monitor (browser-safe; reading is in `./collect`). */
export const lhmManifest: DeviceIntegrationManifest = {
  id: 'lhm',
  name: 'Libre Hardware Monitor',
  selectable: true,
  fields: [
    { id: 'ip', kind: 'address', label: 'IP (Hôte)', placeholder: 'ex: 192.168.1.10', required: true, row: 0, flex: 3 },
    { id: 'port', kind: 'text', label: 'Port', required: true, defaultValue: '9001', row: 0 },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned', hint: 'integrations.allowSelfSignedHint', row: 9 },
  ],

  connect(input) {
    return { url: `${withScheme(input.ip)}:${input.port || 9001}/data.json` };
  },
};
