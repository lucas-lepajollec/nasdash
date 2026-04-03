export interface Service {
  id: string;
  name: string;
  logo: string;
  localUrl: string;
  tailscaleUrl: string;
}

export interface Category {
  id: string;
  title: string;
  emoji: string;
  order: number;
  isSecret?: boolean;
  services: Service[];
}

export interface DeviceStat {
  label: string;
  value: string;
  percent?: number; // 0-100, for progress bars
  color?: string; // custom Tailwind/CSS class e.g., 'bg-blue-500'
}

export interface DeviceApiMapping {
  cpu?: string;
  ram?: string;
  disk?: { name: string; sensor: string; tempSensor?: string }[];
  gpu?: { name: string; sensor: string; tempSensor?: string }[];
  temp?: string;
}

export interface DeviceApiConfig {
  type: 'homeassistant' | 'proxmox' | 'custom' | 'glances' | 'lhm';
  url: string;
  token?: string;
  ip?: string;
  port?: string;
  username?: string;
  nodeName?: string; // For Proxmox
  vmid?: string; // For Proxmox VMs
  vmType?: 'qemu' | 'lxc'; // For Proxmox VMs
  mapping?: DeviceApiMapping;
}

export interface Device {
  id: string;
  name: string;
  host: string;
  icon: string;
  api?: DeviceApiConfig;
  stats?: DeviceStat[];
}

// ==================== DOCKER ====================
export interface DockerHost {
  id: string;
  name: string;
  icon: string;
  type: 'tcp';        // TCP API (http://ip:port)
  url: string;        // e.g. "http://192.168.0.200:2375"
}

export interface DockerContainerPort {
  ip?: string;
  privatePort: number;
  publicPort?: number;
  type: string;
}

export interface DockerContainerMount {
  type: string;
  name?: string;
  source: string;
  destination: string;
  rw: boolean;
}

export interface DockerContainer {
  id: string;
  names: string[];
  image: string;
  imageId: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'created' | 'dead';
  status: string;
  created: number;
  ports: DockerContainerPort[];
  mounts: DockerContainerMount[];
  labels: Record<string, string>;
  // Stats (populated separately)
  stats?: {
    cpuPercent: number;
    memUsage: number;
    memLimit: number;
    memPercent: number;
    netInput: number;
    netOutput: number;
  };
}

export interface DockerImage {
  id: string;
  repoTags: string[];
  size: number;
  created: number;
  containers: number;
}

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: string;
  labels: Record<string, string>;
  usageData?: { size: number; refCount: number };
}

// ==================== CONFIG ====================
export interface DashboardConfig {
  categories: Category[];
  devices: Device[];
  dockerHosts?: DockerHost[];
  settings: {
    title: string;
    showMonitor: boolean;
    totalSlots?: number;
    dockPosition?: 'left' | 'right';
    tailscaleTailnet?: string;
    tailscaleClientId?: string;
    tailscaleClientSecret?: string;
  };
}

export interface SystemStats {
  network?: {
    latency: number;
  };
}
