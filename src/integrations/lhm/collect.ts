import { httpGet } from '../http';
import { CollectError, type DeviceCollector, type DeviceVitals, type Metric } from '../types';

/** Libre Hardware Monitor web server (`/data.json`, a tree of sensors). */

interface LhmNode {
  Text?: string;
  Value?: string;
  Children?: LhmNode[];
}

const GIB = 1024 ** 3;

function find(node: LhmNode, match: (candidate: LhmNode) => boolean): LhmNode | null {
  if (match(node)) return node;
  for (const child of node.Children ?? []) {
    const found = find(child, match);
    if (found) return found;
  }
  return null;
}

/** `"42,5 %"` → 42.5 */
function number(value: string | undefined): number {
  return Number.parseFloat((value ?? '').replace(',', '.'));
}

/** `"12,3 GB"` / `"800 MB"` → gigabytes */
function gigabytes(value: string): number {
  const amount = number(value);
  return value.includes('MB') ? amount / 1024 : amount;
}

const isPercent = (node: LhmNode) => Boolean(node.Value?.includes('%'));
const isCelsius = (node: LhmNode) => Boolean(node.Value?.includes('°C'));

export function lhmMetrics(data: LhmNode): Metric[] {
  const cpu: Metric[] = [];
  const memory: Metric[] = [];
  const disks: Metric[] = [];
  const gpus: Metric[] = [];

  for (const hw of data.Children?.[0]?.Children ?? []) {
    const cpuLoad = find(hw, node => node.Text === 'CPU Total' && isPercent(node));
    if (cpuLoad) {
      const temp = find(hw, node => (node.Text === 'CPU Package' || Boolean(node.Text?.includes('Core (Tctl/Tdie)'))) && isCelsius(node))
        ?? find(hw, node => node.Text === 'Core Max' && isCelsius(node));
      cpu.push({ key: 'cpu.usage', kind: 'cpu', percent: number(cpuLoad.Value), ...(temp ? { temperatureC: number(temp.Value) } : {}) });
    }

    if (hw.Text === 'Total Memory' || hw.Text === 'Generic Memory' || hw.Text === 'System Memory') {
      const load = find(hw, node => node.Text === 'Memory' && isPercent(node));
      if (load) {
        const used = find(hw, node => node.Text === 'Memory Used');
        const available = find(hw, node => node.Text === 'Memory Available');
        const totalGb = used?.Value && available?.Value ? gigabytes(used.Value) + gigabytes(available.Value) : 0;
        memory.push({ key: 'memory.usage', kind: 'memory', percent: number(load.Value), ...(totalGb ? { totalBytes: totalGb * GIB } : {}) });
      }
    }

    const gpuLoad = find(hw, node => node.Text === 'GPU Core' && isPercent(node));
    if (gpuLoad) {
      const name = (hw.Text ?? 'GPU').replace('NVIDIA ', '').replace('AMD ', '');
      const temp = find(hw, node => node.Text === 'GPU Core' && isCelsius(node))
        ?? find(hw, node => Boolean(node.Text?.startsWith('GPU')) && isCelsius(node));
      gpus.push({ key: `gpu.usage:${name}`, kind: 'gpu', name, percent: number(gpuLoad.Value), ...(temp ? { temperatureC: number(temp.Value) } : {}) });
    }

    const diskLoad = find(hw, node => node.Text === 'Used Space' && isPercent(node));
    if (diskLoad) {
      const temp = find(hw, node => Boolean(node.Text?.startsWith('Temperature')) && isCelsius(node));
      const total = find(hw, node => node.Text === 'Total Space');
      disks.push({
        key: `disk.usage:${hw.Text}`, kind: 'disk', name: hw.Text, percent: number(diskLoad.Value),
        ...(temp ? { temperatureC: number(temp.Value) } : {}),
        ...(total?.Value ? { totalBytes: gigabytes(total.Value) * GIB } : {}),
      });
    }
  }
  return [...cpu, ...memory, ...disks, ...gpus];
}

/** Virtual adapters (Hyper-V, WSL, VPNs, loopback) repeat or never leave the machine. */
const VIRTUAL_ADAPTER = /(vEthernet|Loopback|Bluetooth|Hyper-V|VirtualBox|VMware|WSL|TAP|Tailscale|WireGuard|ZeroTier)/i;

/** `"12,3 KB/s"` / `"1,2 MB/s"` → bytes per second. */
function bytesPerSecond(value: string): number {
  const amount = number(value);
  if (/GB\/s/i.test(value)) return amount * 1024 ** 3;
  if (/MB\/s/i.test(value)) return amount * 1024 ** 2;
  if (/KB\/s/i.test(value)) return amount * 1024;
  return amount;
}

/** Network throughput of the physical adapters (`Download Speed` / `Upload Speed` sensors). */
export function lhmVitals(data: LhmNode): DeviceVitals {
  let rx = 0, tx = 0, known = false;
  const walk = (node: LhmNode, adapter: string) => {
    if (node.Text === 'Download Speed' && node.Value && !VIRTUAL_ADAPTER.test(adapter)) { rx += bytesPerSecond(node.Value); known = true; }
    if (node.Text === 'Upload Speed' && node.Value && !VIRTUAL_ADAPTER.test(adapter)) { tx += bytesPerSecond(node.Value); known = true; }
    // A hardware entry names the adapter its sensors belong to.
    const named = node.Children?.some(child => child.Text === 'Throughput' || child.Text === 'Data') ? node.Text ?? adapter : adapter;
    for (const child of node.Children ?? []) walk(child, named);
  };
  walk(data, '');
  return known ? { netRxBps: Math.round(rx), netTxBps: Math.round(tx) } : {};
}

export const collectLhm: DeviceCollector = async connection => {
  if (!connection.url) throw new CollectError('URL LHM manquante.', undefined, true);
  let data: LhmNode;
  try {
    const response = await httpGet(connection.url, { allowSelfSigned: connection.allowSelfSigned });
    if (!response.ok) throw new Error(`HTTP: ${response.status}`);
    data = JSON.parse(await response.text()) as LhmNode;
  } catch (error) {
    throw new CollectError((error instanceof Error && error.message) || 'Impossible de joindre LHM', error);
  }
  return { metrics: lhmMetrics(data), vitals: lhmVitals(data) };
};
