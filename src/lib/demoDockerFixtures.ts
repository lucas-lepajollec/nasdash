export interface DemoDockerPort {
  privatePort: number;
  publicPort?: number;
  type: 'tcp' | 'udp';
}

export interface DemoDockerMount {
  type: 'volume' | 'bind';
  name?: string;
  source: string;
  destination: string;
  rw: boolean;
}

export interface DemoDockerService {
  id: string;
  serviceId: string;
  name: string;
  image: string;
  defaultState: 'running' | 'paused' | 'exited';
  ports: DemoDockerPort[];
  mounts: DemoDockerMount[];
  imageSize: number;
}

const volume = (name: string, destination: string, rw = true): DemoDockerMount => ({
  type: 'volume',
  name: `demo-${name}`,
  source: `/var/lib/nasdash-demo/${name}`,
  destination,
  rw,
});

export const DEMO_DOCKER_SERVICES: DemoDockerService[] = [
  { id: 'demojellyfin', serviceId: 'service-jellyfin', name: 'jellyfin', image: 'jellyfin/jellyfin:latest', defaultState: 'running', ports: [{ privatePort: 8096, publicPort: 8096, type: 'tcp' }], mounts: [volume('jellyfin-config', '/config'), { type: 'bind', source: '/srv/demo-media', destination: '/media', rw: false }], imageSize: 795_000_000 },
  { id: 'demoimmich00', serviceId: 'service-immich', name: 'immich-server', image: 'ghcr.io/immich-app/immich-server:release', defaultState: 'running', ports: [{ privatePort: 2283, publicPort: 2283, type: 'tcp' }], mounts: [volume('immich-library', '/usr/src/app/upload')], imageSize: 1_180_000_000 },
  { id: 'demonavidrom', serviceId: 'service-navidrome', name: 'navidrome', image: 'deluan/navidrome:latest', defaultState: 'running', ports: [{ privatePort: 4533, publicPort: 4533, type: 'tcp' }], mounts: [volume('navidrome-data', '/data'), { type: 'bind', source: '/srv/demo-music', destination: '/music', rw: false }], imageSize: 168_000_000 },
  { id: 'demokavita00', serviceId: 'service-kavita', name: 'kavita', image: 'jvmilazz0/kavita:latest', defaultState: 'running', ports: [{ privatePort: 5000, publicPort: 5000, type: 'tcp' }], mounts: [volume('kavita-config', '/kavita/config'), { type: 'bind', source: '/srv/demo-books', destination: '/books', rw: false }], imageSize: 344_000_000 },
  { id: 'demometube00', serviceId: 'service-metube', name: 'metube', image: 'ghcr.io/alexta69/metube:latest', defaultState: 'running', ports: [{ privatePort: 8081, publicPort: 8081, type: 'tcp' }], mounts: [volume('metube-downloads', '/downloads')], imageSize: 238_000_000 },
  { id: 'demoproxmox0', serviceId: 'service-proxmox', name: 'proxmox-console', image: 'demo/proxmox-console:8', defaultState: 'running', ports: [{ privatePort: 8006, publicPort: 8006, type: 'tcp' }], mounts: [], imageSize: 92_000_000 },
  { id: 'demoportainr', serviceId: 'service-portainer', name: 'portainer', image: 'portainer/portainer-ce:latest', defaultState: 'running', ports: [{ privatePort: 9443, publicPort: 9443, type: 'tcp' }], mounts: [volume('portainer-data', '/data')], imageSize: 284_000_000 },
  { id: 'demouptime00', serviceId: 'service-uptime-kuma', name: 'uptime-kuma', image: 'louislam/uptime-kuma:latest', defaultState: 'running', ports: [{ privatePort: 3001, publicPort: 3001, type: 'tcp' }], mounts: [volume('uptime-kuma-data', '/app/data')], imageSize: 436_000_000 },
  { id: 'demoglances0', serviceId: 'service-glances', name: 'glances', image: 'nicolargo/glances:latest-full', defaultState: 'running', ports: [{ privatePort: 61208, publicPort: 61208, type: 'tcp' }], mounts: [], imageSize: 402_000_000 },
  { id: 'demopihole00', serviceId: 'service-pihole', name: 'pihole', image: 'pihole/pihole:latest', defaultState: 'running', ports: [{ privatePort: 53, publicPort: 53, type: 'udp' }, { privatePort: 80, publicPort: 8088, type: 'tcp' }], mounts: [volume('pihole-etc', '/etc/pihole')], imageSize: 356_000_000 },
  { id: 'demohomeasst', serviceId: 'service-home-assistant', name: 'home-assistant', image: 'ghcr.io/home-assistant/home-assistant:stable', defaultState: 'running', ports: [{ privatePort: 8123, publicPort: 8123, type: 'tcp' }], mounts: [volume('home-assistant-config', '/config')], imageSize: 1_120_000_000 },
  { id: 'demon8n00000', serviceId: 'service-n8n', name: 'n8n', image: 'docker.n8n.io/n8nio/n8n:latest', defaultState: 'running', ports: [{ privatePort: 5678, publicPort: 5678, type: 'tcp' }], mounts: [volume('n8n-data', '/home/node/.n8n')], imageSize: 612_000_000 },
  { id: 'demosyncthng', serviceId: 'service-syncthing', name: 'syncthing', image: 'syncthing/syncthing:latest', defaultState: 'running', ports: [{ privatePort: 8384, publicPort: 8384, type: 'tcp' }, { privatePort: 22000, publicPort: 22000, type: 'tcp' }], mounts: [volume('syncthing-config', '/var/syncthing/config')], imageSize: 184_000_000 },
  { id: 'demofilebrws', serviceId: 'service-file-browser', name: 'file-browser', image: 'filebrowser/filebrowser:latest', defaultState: 'running', ports: [{ privatePort: 80, publicPort: 8082, type: 'tcp' }], mounts: [volume('filebrowser-db', '/database'), { type: 'bind', source: '/srv/demo-files', destination: '/srv', rw: true }], imageSize: 54_000_000 },
  { id: 'demoittools0', serviceId: 'service-it-tools', name: 'it-tools', image: 'corentinth/it-tools:latest', defaultState: 'running', ports: [{ privatePort: 80, publicPort: 8083, type: 'tcp' }], mounts: [], imageSize: 68_000_000 },
  { id: 'demosonarr00', serviceId: 'service-sonarr', name: 'sonarr', image: 'lscr.io/linuxserver/sonarr:latest', defaultState: 'running', ports: [{ privatePort: 8989, publicPort: 8989, type: 'tcp' }], mounts: [volume('sonarr-config', '/config')], imageSize: 286_000_000 },
  { id: 'demoradarr00', serviceId: 'service-radarr', name: 'radarr', image: 'lscr.io/linuxserver/radarr:latest', defaultState: 'running', ports: [{ privatePort: 7878, publicPort: 7878, type: 'tcp' }], mounts: [volume('radarr-config', '/config')], imageSize: 292_000_000 },
  { id: 'demolidarr00', serviceId: 'service-lidarr', name: 'lidarr', image: 'lscr.io/linuxserver/lidarr:latest', defaultState: 'running', ports: [{ privatePort: 8686, publicPort: 8686, type: 'tcp' }], mounts: [volume('lidarr-config', '/config')], imageSize: 274_000_000 },
  { id: 'demoprowlarr', serviceId: 'service-prowlarr', name: 'prowlarr', image: 'lscr.io/linuxserver/prowlarr:latest', defaultState: 'running', ports: [{ privatePort: 9696, publicPort: 9696, type: 'tcp' }], mounts: [volume('prowlarr-config', '/config')], imageSize: 206_000_000 },
  { id: 'demoqbittorn', serviceId: 'service-qbittorrent', name: 'qbittorrent', image: 'lscr.io/linuxserver/qbittorrent:latest', defaultState: 'running', ports: [{ privatePort: 8080, publicPort: 8080, type: 'tcp' }, { privatePort: 6881, publicPort: 6881, type: 'tcp' }], mounts: [volume('qbittorrent-config', '/config'), volume('downloads', '/downloads')], imageSize: 238_000_000 },
];

export function demoContainerStatus(state: string): string {
  if (state === 'running') return 'Up 3 hours (healthy)';
  if (state === 'paused') return 'Paused';
  return 'Exited (0) 10 minutes ago';
}

export function demoStartedAt(index: number): string {
  return new Date(Date.UTC(2026, 7, 11, 12, index * 7)).toISOString();
}

export const DEMO_DOCKER_IMAGES = DEMO_DOCKER_SERVICES.map((service, index) => ({
  id: `${service.id}-image`,
  repoTags: [service.image],
  size: service.imageSize,
  created: 1_780_517_682 - index * 86_400,
  containers: 1,
}));

const uniqueVolumes = new Map<string, DemoDockerMount>();
for (const service of DEMO_DOCKER_SERVICES) {
  for (const mount of service.mounts) {
    if (mount.type === 'volume' && mount.name) uniqueVolumes.set(mount.name, mount);
  }
}

export const DEMO_DOCKER_VOLUMES = Array.from(uniqueVolumes.values()).map((mount, index) => ({
  name: mount.name!,
  driver: 'local',
  mountpoint: `/var/lib/docker/volumes/${mount.name}/_data`,
  createdAt: demoStartedAt(index),
  usageData: { size: 8_000_000 + index * 11_500_000, refCount: 1 },
}));

export function getDemoDockerService(id: string): DemoDockerService | undefined {
  return DEMO_DOCKER_SERVICES.find(service => service.id === id.slice(0, 12));
}

export function getDemoDockerLogs(service: DemoDockerService): string[] {
  const mainPort = service.ports[0]?.privatePort;
  return [
    `2026-08-11T16:00:00.100Z INFO ${service.name} container starting`,
    `2026-08-11T16:00:00.420Z INFO image=${service.image}`,
    `2026-08-11T16:00:01.050Z INFO configuration loaded successfully`,
    ...(mainPort ? [`2026-08-11T16:00:01.480Z INFO listening on 0.0.0.0:${mainPort}`] : []),
    `2026-08-11T16:00:02.100Z INFO ${service.name} is ready`,
    `2026-08-11T16:05:00.000Z DEBUG health check passed`,
  ];
}
