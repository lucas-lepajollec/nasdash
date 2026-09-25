/**
 * Contracts shared by every integration.
 *
 * An integration turns an external system (Glances, Proxmox, LHM…) into
 * structured metrics. Its manifest knows its connection fields and how to
 * build its endpoint from them; its collector reads that endpoint. The rest
 * of NasDash (poller, API routes, settings form, widgets) only goes through
 * these types.
 */

/** What a metric measures; widgets pick colours and icons from it. */
export type MetricKind = 'cpu' | 'memory' | 'disk' | 'gpu';

/**
 * One measurement, as numbers. Formatting (units, locale, labels) is the
 * interface's job, never the integration's.
 */
export interface Metric {
  /** Stable identifier, e.g. `cpu.usage`, `disk.usage:/data`, `gpu.usage:RTX 4070`. */
  key: string;
  kind: MetricKind;
  /** Name of the measured part when there can be several (disk, GPU). */
  name?: string;
  /** Usage, 0–100. */
  percent: number;
  /** Capacity of the measured part, in bytes. */
  totalBytes?: number;
  /** Used part of that capacity, in bytes, when the source reports it. */
  usedBytes?: number;
  /** Temperature of the measured part, in °C. */
  temperatureC?: number;
}

/**
 * Figures of a machine that are not a usage gauge: uptime, load and network
 * throughput. All optional: each source reports what it knows.
 */
export interface DeviceVitals {
  uptimeSeconds?: number;
  /** Load average over 1, 5 and 15 minutes. */
  load?: number[];
  /** Logical CPU count, to read the load against. */
  cores?: number;
  /** Network throughput over all interfaces, in bytes per second. */
  netRxBps?: number;
  netTxBps?: number;
  /** Only the sum is known (Beszel). */
  netTotalBps?: number;
}

/** What a collector returns: metrics alone, or metrics and vitals. */
export type CollectResult = Metric[] | { metrics: Metric[]; vitals?: DeviceVitals };

/** Connection values entered in the device form (the password is write-only). */
export interface ConnectionInput {
  ip?: string;
  port?: string;
  username?: string;
  password?: string;
  nodeName?: string;
  vmid?: string;
  vmType?: 'qemu' | 'lxc';
  /** HTTPS with a self-signed certificate (Proxmox's default): skip the certificate check. */
  allowSelfSigned?: boolean;
  /** Which machine to read on a server that watches several (Beszel system, Prometheus instance). */
  target?: string;
}

export type ConnectionFieldId = keyof ConnectionInput;

/** One field of the device form, described by the integration. */
export interface ConnectionField {
  id: ConnectionFieldId;
  /** Source strings, translated by the form. */
  label: string;
  placeholder?: string;
  /** `address` is hidden like other private values; `secret` is never read back; `toggle` is a yes/no switch. */
  kind: 'address' | 'text' | 'secret' | 'select' | 'toggle';
  /** Short explanation under a toggle. */
  hint?: string;
  /** `create`: required only when the device is created (secrets are kept on edit). */
  required?: boolean | 'create';
  defaultValue?: string;
  options?: { value: string; label: string }[];
  /** Shown only when this other field has a value. */
  showWhen?: ConnectionFieldId;
  /** Fields with the same row are shown side by side. */
  row: number;
  /** Relative width inside its row (default 1). */
  flex?: number;
  /** Fields of the same panel are grouped in a framed box. */
  panel?: boolean;
  /**
   * `machine`: belongs to one monitored machine (Beszel system, Prometheus
   * instance, Proxmox node or VM), set on the device; otherwise it belongs to
   * the saved connection (address, port, credentials), set on the
   * Integrations page.
   */
  scope?: 'machine';
}

/** Stored endpoint of a device (`DeviceApiConfig.url` / `token`). */
export interface Connection {
  url: string;
  token?: string;
}

/** Endpoint and options handed to `collect`, with `${ENV}` references resolved. */
export interface ResolvedConnection extends Connection {
  vmid?: string;
  vmType?: 'qemu' | 'lxc';
  allowSelfSigned?: boolean;
  target?: string;
}

export interface CollectContext {
  /** Per-device memory kept between polls (e.g. the API version that answered). */
  memory: Record<string, string>;
  /** Reports a partial failure without failing the whole collection. */
  warn(context: string, error: unknown): void;
  clearWarning(context: string): void;
}

/**
 * Browser-safe description of an integration: its form fields and how they
 * become a stored endpoint. Reading the endpoint is a separate server-only
 * `DeviceCollector` (see `collectors.ts`).
 */
export interface DeviceIntegrationManifest {
  id: string;
  name: string;
  /** Offered in the device form. Legacy types stay readable but not selectable. */
  selectable: boolean;
  fields: readonly ConnectionField[];
  /** Builds the stored endpoint. `previousToken` is the stored token when editing the same type. */
  connect(input: ConnectionInput, previousToken?: string): Connection;
}

/** A machine a multi-machine server offers (Beszel system, Prometheus instance, Proxmox node or VM). */
export interface SourceTarget {
  /** Values to store on the device (`target`, or `nodeName` + `vmid` + `vmType`). */
  values: Record<string, string>;
  label: string;
  /** Second line (state, type). */
  detail?: string;
}

/** Lists the machines of a server (server only); throws `CollectError` on failure. */
export type TargetLister = (connection: ResolvedConnection, context: CollectContext) => Promise<SourceTarget[]>;

/** Reads an endpoint (server only); throws `CollectError` with a message for the interface. */
export type DeviceCollector = (connection: ResolvedConnection, context: CollectContext) => Promise<CollectResult>;

/**
 * Failure shown on the device card. `reason` is what gets logged (classified by
 * `classifyMonitoringError`); `silent` skips the log for expected states.
 */
export class CollectError extends Error {
  constructor(message: string, readonly reason?: unknown, readonly silent = false) {
    super(message);
    this.name = 'CollectError';
  }
}

/** `http://` prefix for addresses typed without a scheme. */
export function withScheme(address: string | undefined, scheme = 'http'): string {
  const value = address ?? '';
  return value && !/^https?:\/\//.test(value) ? `${scheme}://${value}` : value;
}

/**
 * Field of a service connection (Tailscale…). `hidden` values are shown
 * masked while typing but are not secrets; `secret` values go to
 * `IntegrationInstance.secrets` and are never read back.
 */
export interface ServiceField {
  id: string;
  label: string;
  placeholder?: string;
  kind: 'text' | 'hidden' | 'secret';
  required?: boolean;
}

/** Browser-safe description of a service integration (one saved connection per instance). */
export interface ServiceIntegrationManifest {
  id: string;
  name: string;
  fields: readonly ServiceField[];
}
