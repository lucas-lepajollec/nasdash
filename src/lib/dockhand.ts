/**
 * Dockhand (github.com/Finsys/dockhand) speaks its own API rather than the
 * Docker Engine API. NasDash's Docker routes ask for Docker endpoints; this
 * adapter maps each of them to Dockhand's (`Authorization: Bearer dh_…`,
 * environment chosen with `?env=`) and turns the answer back into the Docker
 * shape the routes already read. Endpoints from Dockhand's OpenAPI spec.
 */

interface DockhandContainer { id: string; name: string; image: string; imageId?: string; state: string; status: string; created?: number; ports?: unknown[]; mounts?: Array<{ type: string; name?: string; source: string; destination: string; rw: boolean }>; labels?: Record<string, string> }
interface DockhandStats {
  cpuPercent?: number; memoryRaw?: number; memoryUsage?: number; memoryCache?: number; memoryLimit?: number;
  networkRx?: number; networkTx?: number; blockRead?: number; blockWrite?: number;
}

export interface DockhandCall {
  method: 'GET' | 'POST' | 'DELETE';
  /** Dockhand path, with `env` and any passed query. */
  path: string;
  /** Converts Dockhand's JSON into the Docker answer the routes expect (status 200 unless said). */
  convert: (body: unknown) => { status?: number; json?: unknown; text?: string };
}

const json = (value: unknown) => ({ json: value });
function array(body: unknown): Record<string, unknown>[] {
  if (!Array.isArray(body) || body.some(item => !item || typeof item !== 'object')) throw new SyntaxError('Invalid Dockhand list response');
  return body;
}


/** Maps one Docker Engine endpoint to Dockhand; `undefined` when Dockhand has no equivalent. */
export function dockhandCall(endpoint: string, method: string, environment: string): DockhandCall | undefined {
  const url = new URL(endpoint, 'http://docker');
  const env = encodeURIComponent(environment);
  const verb = (method || 'GET').toUpperCase();
  let match: RegExpMatchArray | null;

  if (verb === 'GET' && url.pathname === '/containers/json') {
    return {
      method: 'GET', path: `/api/containers?env=${env}&all=${url.searchParams.get('all') ?? 'true'}`,
      // Dockhand lists id, name, image, state and status only.
      convert: body => json((array(body) as unknown as DockhandContainer[]).map(container => ({
        Id: container.id, ImageID: container.imageId, Names: [`/${container.name}`], Image: container.image, State: container.state, Status: container.status,
        Ports: container.ports || [], Mounts: (container.mounts || []).map(m => ({ Type: m.type, Name: m.name, Source: m.source, Destination: m.destination, RW: m.rw })), Labels: container.labels || {}, Created: container.created || 0,
      }))),
    };
  }
  if ((match = url.pathname.match(/^\/containers\/([^/]+)\/json$/)) && verb === 'GET') {
    return { method: 'GET', path: `/api/containers/${match[1]}/inspect?env=${env}`, convert: json };
  }
  if ((match = url.pathname.match(/^\/containers\/([^/]+)\/stats$/)) && verb === 'GET') {
    return {
      method: 'GET', path: `/api/containers/${match[1]}/stats?env=${env}`,
      // Dockhand already computes the CPU percentage: expressed as a one-CPU delta out of 100.
      convert: body => {
        if (!body || typeof body !== 'object' || typeof (body as DockhandStats).cpuPercent !== 'number') throw new SyntaxError('Invalid Dockhand stats response');
        const stats = body as DockhandStats;
        return json({
          cpu_stats: { cpu_usage: { total_usage: stats.cpuPercent ?? 0 }, system_cpu_usage: 100, online_cpus: 1 },
          precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
          memory_stats: { usage: stats.memoryUsage ?? stats.memoryRaw ?? 0, limit: stats.memoryLimit ?? 0, stats: { cache: stats.memoryCache ?? 0 } },
          networks: { eth0: { rx_bytes: stats.networkRx ?? 0, tx_bytes: stats.networkTx ?? 0 } },
          blkio_stats: { io_service_bytes_recursive: [{ op: 'read', value: stats.blockRead ?? 0 }, { op: 'write', value: stats.blockWrite ?? 0 }] },
        });
      },
    };
  }
  if ((match = url.pathname.match(/^\/containers\/([^/]+)\/logs$/)) && verb === 'GET') {
    const tail = url.searchParams.get('tail');
    return {
      method: 'GET', path: `/api/containers/${match[1]}/logs?env=${env}${tail ? `&tail=${encodeURIComponent(tail)}` : ''}`,
      convert: body => ({ text: typeof (body as { logs?: unknown })?.logs === 'string' ? (body as { logs: string }).logs : '' }),
    };
  }
  if ((match = url.pathname.match(/^\/containers\/([^/]+)\/(start|stop|restart|pause|unpause)$/)) && verb === 'POST') {
    return { method: 'POST', path: `/api/containers/${match[1]}/${match[2]}?env=${env}`, convert: () => ({ status: 204 }) };
  }
  if ((match = url.pathname.match(/^\/containers\/([^/]+)$/)) && verb === 'DELETE') {
    return { method: 'DELETE', path: `/api/containers/${match[1]}?env=${env}&force=${url.searchParams.get('force') ?? 'false'}`, convert: () => ({ status: 204 }) };
  }
  if (verb === 'GET' && url.pathname === '/images/json') return { method: 'GET', path: `/api/images?env=${env}`, convert: body => json(array(body).map(image => ({
    Id: image.id ?? image.Id, RepoTags: image.repoTags ?? image.RepoTags ?? [], RepoDigests: image.repoDigests ?? image.RepoDigests ?? [], Labels: image.labels ?? image.Labels ?? {},
    Size: image.size ?? image.Size, Created: image.created ?? image.Created, Containers: image.containers ?? image.Containers,
  }))) };
  if ((match = url.pathname.match(/^\/images\/(.+)$/)) && verb === 'DELETE') {
    return { method: 'DELETE', path: `/api/images/${match[1]}?env=${env}`, convert: () => ({ json: [] }) };
  }
  if (verb === 'GET' && url.pathname === '/volumes') {
    return { method: 'GET', path: `/api/volumes?env=${env}`, convert: body => json({ Volumes: array(body).map(volume => ({
      Name: volume.name ?? volume.Name, Driver: volume.driver ?? volume.Driver, Mountpoint: volume.mountpoint ?? volume.Mountpoint,
      CreatedAt: volume.created ?? volume.CreatedAt, Labels: volume.labels ?? volume.Labels ?? {},
      UsageData: volume.UsageData ?? (Array.isArray(volume.usedBy) ? { RefCount: volume.usedBy.length } : undefined),
    })), Warnings: null }) };
  }
  if ((match = url.pathname.match(/^\/volumes\/([^/]+)$/)) && verb === 'DELETE') {
    return { method: 'DELETE', path: `/api/volumes/${match[1]}?env=${env}`, convert: () => ({ status: 204 }) };
  }
  return undefined;
}
