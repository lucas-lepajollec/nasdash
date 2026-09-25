import { addressField, baseUrl, optionalCredentialFields, portField, selfSignedField, userPasswordToken } from '../connect';
import type { DeviceIntegrationManifest } from '../types';

/** Netdata Agent (port 19999, no login by default; basic auth when behind a proxy). */
export const netdataManifest: DeviceIntegrationManifest = {
  id: 'netdata',
  name: 'Netdata',
  selectable: true,
  fields: [addressField(), portField('19999'), ...optionalCredentialFields(1), selfSignedField],
  connect(input, previousToken) {
    return { url: baseUrl(input), token: userPasswordToken(input, previousToken) };
  },
};
