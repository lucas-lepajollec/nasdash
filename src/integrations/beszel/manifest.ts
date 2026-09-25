import { addressField, baseUrl, portField, selfSignedField, userPasswordToken } from '../connect';
import type { DeviceIntegrationManifest } from '../types';

/**
 * Beszel hub (port 8090): one NasDash device per Beszel system, picked by
 * name. Uses a Beszel account (a read-only user is enough).
 */
export const beszelManifest: DeviceIntegrationManifest = {
  id: 'beszel',
  name: 'Beszel',
  selectable: true,
  fields: [
    addressField(),
    portField('8090'),
    { id: 'target', kind: 'text', label: 'integrations.beszel.system', placeholder: 'ex: nas', required: true, row: 1, scope: 'machine' },
    { id: 'username', kind: 'text', label: 'integrations.email', placeholder: 'ex: nasdash@example.com', required: true, row: 2 },
    { id: 'password', kind: 'secret', label: 'Mot de passe / Jeton', required: 'create', row: 2 },
    selfSignedField,
  ],
  connect(input, previousToken) {
    return { url: baseUrl(input), token: userPasswordToken(input, previousToken) };
  },
};
