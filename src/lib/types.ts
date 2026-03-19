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
  type: 'homeassistant' | 'proxmox' | 'custom' | 'glances';
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

export interface DashboardConfig {
  categories: Category[];
  devices: Device[];
  settings: {
    title: string;
    showMonitor: boolean;
    totalSlots?: number;
  };
}

export interface SystemStats {
  cpu: {
    load: number;
    speed: number;
    model: string;
    cores: number;
  };
  ram: {
    used: number;
    total: number;
    percent: number;
  };
  disk: {
    mount?: string;
    used: number;
    total: number;
    percent: number;
    temp?: number;
  }[];
  gpu?: {
    model: string;
    vram: number;
    usage?: number;
    temp?: number;
  }[];
  temp: {
    main: number;
  };
  network?: {
    latency: number;
  };
  uptime: number;
}
