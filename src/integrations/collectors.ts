import { collectBeszel, listBeszelSystems } from './beszel/collect';
import { collectGlances } from './glances/collect';
import { collectLhm } from './lhm/collect';
import { collectNetdata } from './netdata/collect';
import { collectPrometheus, listPrometheusInstances } from './prometheus/collect';
import { collectProxmox, listProxmoxTargets } from './proxmox/collect';
import type { DeviceCollector, TargetLister } from './types';

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

/** Servers that watch several machines: how to list them (the picker of the device form). */
export const TARGET_LISTERS: Readonly<Record<string, TargetLister>> = {
  beszel: listBeszelSystems,
  prometheus: listPrometheusInstances,
  proxmox: listProxmoxTargets,
};
