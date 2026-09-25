import { collectBeszel } from './beszel/collect';
import { collectGlances } from './glances/collect';
import { collectLhm } from './lhm/collect';
import { collectNetdata } from './netdata/collect';
import { collectPrometheus } from './prometheus/collect';
import { collectProxmox } from './proxmox/collect';
import type { DeviceCollector } from './types';

/**
 * Server-only readers of the integrations listed in `registry.ts`, by id.
 * Integrations without a collector show the device's static stats.
 */
export const DEVICE_COLLECTORS: Readonly<Record<string, DeviceCollector>> = {
  glances: collectGlances,
  netdata: collectNetdata,
  beszel: collectBeszel,
  prometheus: collectPrometheus,
  proxmox: collectProxmox,
  lhm: collectLhm,
};
