import { addressField, baseUrl, optionalCredentialFields, portField, selfSignedField, userPasswordToken } from '../connect';
import type { DeviceIntegrationManifest } from '../types';

/** Form fields and endpoint of Glances (browser-safe; reading is in `./collect`). */
export const glancesManifest: DeviceIntegrationManifest = {
  id: 'glances',
  name: 'Glances',
  selectable: true,
  fields: [addressField(), { ...portField('61208'), placeholder: 'ex: 61208' }, ...optionalCredentialFields(1), selfSignedField],
  connect(input, previousToken) {
    return { url: baseUrl(input), token: userPasswordToken(input, previousToken) };
  },
};
