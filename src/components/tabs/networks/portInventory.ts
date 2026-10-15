import type { Category } from '@/lib/types';

export interface DockerPortContainer {
  id: string;
  names?: string[];
  state?: string;
  hostName?: string;
  hostUrl?: string;
  ports?: {
    ip?: string;
    privatePort?: number;
    publicPort?: number;
    type?: string;
  }[];
}

export interface PortEntry {
  port: number;
  serviceName: string;
  ip: string;
  type: 'HTTP' | 'HTTPS' | 'TCP' | 'UDP';
  status?: string;
  origins: ('service' | 'docker')[];
  category?: string;
  secondary?: boolean;
  dockerHost?: string;
  containerName?: string;
  stopped: boolean;
}

const normalizeHost = (host: string) => host.trim().toLowerCase().replace(/^\[|\]$/g, '');
const normalizeName = (name: string) => name.toLowerCase().replace(/^\//, '').replace(/[^a-z0-9]/g, '');
const transport = (type: PortEntry['type']) => type === 'UDP' ? 'UDP' : 'TCP';

function parseUrl(urlString: string) {
  if (!urlString) return null;
  try {
    const urlWithProto = urlString.match(/^https?:\/\//i) ? urlString : `http://${urlString}`;
    const urlObj = new URL(urlWithProto);
    return {
      ip: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port, 10) : (urlObj.protocol === 'https:' ? 443 : 80),
    };
  } catch {
    const match = urlString.match(/^(?:https?:\/\/)?([^:\/]+):(\d+)/i);
    return match ? { ip: match[1], port: parseInt(match[2], 10) } : null;
  }
}

export function buildPortInventory({ categories, containers, showSecretSections }: {
  categories: Category[];
  containers: DockerPortContainer[];
  showSecretSections: boolean;
}): PortEntry[] {
  // Keep host identity separately: redacted/local host URLs can be identical.
  const inventory: { entry: PortEntry; dockerHostKey?: string }[] = [];
  const secretServiceNames = new Set<string>();
  if (!showSecretSections) {
    categories.filter(cat => cat.isSecret).forEach(cat => {
      cat.services.forEach(svc => secretServiceNames.add(svc.name.toLowerCase().trim()));
    });
  }

  const addEntry = (item: PortEntry, dockerHostKey?: string, localNames: string[] = []) => {
    const existing = inventory.find(candidate => {
      const entry = candidate.entry;
      if (entry.port !== item.port || transport(entry.type) !== transport(item.type)) return false;
      if (candidate.dockerHostKey !== undefined && dockerHostKey !== undefined &&
          candidate.dockerHostKey !== dockerHostKey) return false;
      return normalizeHost(entry.ip) === normalizeHost(item.ip) ||
        (entry.origins.includes('service') && localNames.includes(normalizeName(entry.serviceName)));
    });

    if (!existing) {
      inventory.push({ entry: item, dockerHostKey });
      return;
    }

    if (item.origins.includes('docker')) {
      const entry = existing.entry;
      if (!entry.origins.includes('docker')) entry.origins.push('docker');
      entry.dockerHost = item.dockerHost;
      entry.containerName = item.containerName;
      // A running binding takes precedence over a stopped duplicate binding.
      if (entry.status !== 'running') entry.status = item.status;
      entry.stopped = !entry.origins.includes('service') && entry.status !== 'running';
      existing.dockerHostKey = dockerHostKey;
    }
  };

  categories.forEach(cat => {
    if (!showSecretSections && cat.isSecret) return;
    cat.services.forEach(svc => {
      const addServiceUrl = (url: string, secondary = false) => {
        const parsed = parseUrl(url);
        if (!parsed) return;
        addEntry({
          port: parsed.port,
          serviceName: svc.name,
          ip: parsed.ip,
          type: url.startsWith('https') ? 'HTTPS' : 'HTTP',
          origins: ['service'],
          category: cat.title,
          ...(secondary ? { secondary: true } : {}),
          stopped: false,
        });
      };
      if (svc.localUrl) addServiceUrl(svc.localUrl);
      if (svc.secondaryUrl) addServiceUrl(svc.secondaryUrl, true);
    });
  });

  containers.forEach(container => {
    if (!showSecretSections && (container.names || []).some(name =>
      secretServiceNames.has(name.replace(/^\//, '').toLowerCase().trim()))) return;

    const containerName = container.names?.[0] || container.id;
    const hostIp = (() => {
      try {
        return new URL(container.hostUrl || '').hostname;
      } catch {
        return 'localhost';
      }
    })();
    const host = normalizeHost(hostIp);
    const localHost = !host || host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
      (container.hostUrl || '').trim().toLowerCase().startsWith('unix:');
    const localNames = localHost ? (container.names?.length ? container.names : [container.id])
      .map(normalizeName).filter(Boolean) : [];
    const dockerHostKey = JSON.stringify([container.hostName || '', (container.hostUrl || '').trim().toLowerCase()]);

    container.ports?.forEach(port => {
      if (!port.publicPort) return;
      const ip = normalizeHost(port.ip || '');
      const resolvedIp = !ip || ip === '0.0.0.0' || ip === '::' ? hostIp : port.ip!;
      addEntry({
        port: port.publicPort,
        serviceName: containerName,
        ip: resolvedIp,
        type: (port.type?.toUpperCase() || 'TCP') as PortEntry['type'],
        status: container.state,
        origins: ['docker'],
        dockerHost: container.hostName,
        containerName,
        stopped: container.state !== 'running',
      }, dockerHostKey, localNames);
    });
  });

  return inventory.map(({ entry }) => entry)
    .sort((a, b) => Number(a.stopped) - Number(b.stopped) || a.port - b.port);
}
