import { dockerImageDisplayName, dockerImageMatchesContainer, isDockerImageUsed } from './dockerResources';

export interface ResourceContainer {
  names?: string[];
  name?: string;
  imageId?: string;
  image?: string;
  mounts?: Array<{ name?: string }>;
}
export interface ResourceImage {
  id: string;
  repoTags?: string[];
  repoDigests?: string[];
  labels?: Record<string, string>;
  containers?: number;
  size?: number;
  created?: number;
}
export interface ResourceVolume {
  name: string;
  driver?: string;
  mountpoint?: string;
  createdAt?: string;
  usageData?: { refCount?: number; size?: number };
}
export interface DockerResourceRow {
  id: string;
  name: string;
  used: boolean;
  highlighted: boolean;
  tags: string[];
  digests: string[];
  consumers: string[];
  size?: number;
  created?: number;
  driver?: string;
  mountpoint?: string;
}
export type ResourceFilter = 'all' | 'used' | 'unused' | 'untagged';
export type ResourceSort = 'name' | 'size' | 'created' | 'driver';

const positiveNumber = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
const consumerNames = (containers: ResourceContainer[]) => [...new Set(containers.flatMap(c => c.names ?? (c.name ? [c.name] : [])).map(name => name.replace(/^\//, '')))];

export function imageResourceRows(images: ResourceImage[], containers: ResourceContainer[], selected?: ResourceContainer): DockerResourceRow[] {
  return images.map(image => ({
    id: image.id, name: dockerImageDisplayName(image), used: isDockerImageUsed(image, containers),
    highlighted: !!selected && dockerImageMatchesContainer(image, selected),
    tags: [...new Set(image.repoTags?.filter(tag => tag && tag !== '<none>:<none>') ?? [])],
    digests: [...new Set(image.repoDigests ?? [])],
    consumers: consumerNames(containers.filter(container => dockerImageMatchesContainer(image, container))),
    size: positiveNumber(image.size), created: image.created && image.created > 0 ? positiveNumber(image.created) : undefined,
  }));
}
export function volumeResourceRows(volumes: ResourceVolume[], containers: ResourceContainer[], selected?: ResourceContainer): DockerResourceRow[] {
  return volumes.map(volume => {
    const consumers = containers.filter(container => container.mounts?.some(mount => mount.name === volume.name));
    const created = volume.createdAt ? Date.parse(volume.createdAt) / 1000 : undefined;
    return {
      id: volume.name, name: volume.name, used: (volume.usageData?.refCount ?? 0) > 0 || consumers.length > 0,
      highlighted: !!selected?.mounts?.some(mount => mount.name === volume.name),
      tags: [], digests: [], consumers: consumerNames(consumers), driver: volume.driver, mountpoint: volume.mountpoint,
      size: positiveNumber(volume.usageData?.size), created: positiveNumber(created),
    };
  });
}

/** Filter before paginating; unavailable metadata remains last in either direction. */
export function resourceList(rows: DockerResourceRow[], query: string, filter: ResourceFilter, sort: ResourceSort, descending: boolean, locale: string): DockerResourceRow[] {
  const needle = query.trim().toLocaleLowerCase(locale);
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return rows.filter(row => (filter === 'all' || (filter === 'used' ? row.used : filter === 'unused' ? !row.used : row.tags.length === 0))
    && (!needle || [row.name, row.id, row.driver, row.mountpoint, ...row.tags, ...row.digests, ...row.consumers].some(value => value?.toLocaleLowerCase(locale).includes(needle))))
    .sort((a, b) => {
      const left = a[sort], right = b[sort];
      if (left === undefined && right !== undefined) return 1;
      if (right === undefined && left !== undefined) return -1;
      const order = typeof left === 'number' && typeof right === 'number' ? left - right : collator.compare(String(left ?? ''), String(right ?? ''));
      return (descending ? -order : order) || collator.compare(a.name, b.name) || collator.compare(a.id, b.id);
    });
}
export function resourcePage(rows: DockerResourceRow[], requestedPage: number, pageSize: number) {
  const size = [10, 25, 50].includes(pageSize) ? pageSize : 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.max(1, Math.min(pageCount, Math.floor(requestedPage) || 1));
  return { page, pageCount, start: rows.length ? (page - 1) * size + 1 : 0, end: Math.min(page * size, rows.length), rows: rows.slice((page - 1) * size, page * size) };
}

/** Refreshes can remove or attach a previously selected resource. Never retain it as a deletion target. */
export function deletableSelection(ids: string[], rows: DockerResourceRow[]): string[] {
  const unused = new Set(rows.filter(row => !row.used).map(row => row.id));
  return [...new Set(ids)].filter(id => unused.has(id));
}
