import { addressField, baseUrl, optionalCredentialFields, portField, selfSignedField, userPasswordToken } from '../connect';
import type { DeviceIntegrationManifest } from '../types';

/**
 * Prometheus server (port 9090) scraping node_exporter: one NasDash device per
 * `instance` label (e.g. `192.168.1.10:9100`). Optional basic auth; a password
 * alone is sent as a bearer token.
 */
export const prometheusManifest: DeviceIntegrationManifest = {
  id: 'prometheus',
  name: 'Prometheus (node_exporter)',
  selectable: true,
  fields: [
    addressField(),
    portField('9090'),
    { id: 'target', kind: 'text', label: 'integrations.prometheus.instance', placeholder: 'ex: 192.168.1.10:9100', required: true, row: 1, scope: 'machine' },
    ...optionalCredentialFields(2),
    selfSignedField,
  ],
  connect(input, previousToken) {
    return { url: baseUrl(input), token: userPasswordToken(input, previousToken) };
  },
};
