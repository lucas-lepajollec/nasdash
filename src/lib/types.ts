export interface Service {
  id: string;
  name: string;
  logo: string;
  localUrl: string;
  secondaryUrl?: string;
  secondaryLogo?: string;
  tailscaleUrl?: string; // Kept for backwards compatibility
}

export interface Category {
  id: string;
  title: string;
  emoji: string;
  order: number;
  isSecret?: boolean;
  services: Service[];
  layout?: 'standard' | 'compact' | 'bento' | 'grid' | 'bento-logo-large' | 'bento-logo-medium' | 'bento-logo-small';
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
  statStyle?: 'horizontal' | 'vertical' | 'graph';
  hideValues?: boolean;
  colsDesktop?: number;
  colsMobile?: number;
  enableAlerts?: boolean;
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

export interface DockerActionConfig {
  id: string;
  name: string;
  icon: string;
  actionType: 'start' | 'stop' | 'switch';
  targets: { hostId: string; containerName: string }[];
}

export interface AppearanceProfile {
  id: string;
  name: string;
  settings: Partial<DashboardConfig['settings']>;
}

export interface LocalCalendarEvent {
  id: string;
  title: string;
  start: string; // ISO string
  end?: string; // ISO string
  description?: string;
  isAllDay?: boolean;
}

export type HeaderElementDesktop = 'title' | 'search' | 'menu' | 'none';
export type HeaderElementMobile = 'title' | 'search' | 'none';

export interface HeaderLayoutDesktop {
  left?: HeaderElementDesktop;
  center?: HeaderElementDesktop;
  right?: HeaderElementDesktop;
  splitMenuAround?: 'title' | 'search' | 'none';
}

export interface HeaderLayoutMobile {
  left?: HeaderElementMobile;
  center?: HeaderElementMobile;
}


export interface DashboardConfig {
  version: number;
  categories: Category[];
  devices?: Device[];
  dockerHosts?: DockerHost[];
  dockerActions?: DockerActionConfig[];
  appearanceProfiles?: AppearanceProfile[];
  localEvents?: LocalCalendarEvent[];
  settings: {
    title: string;
    titleMobile?: string;
    titleLogo?: string;
    titleFont?: 'outfit' | 'space-grotesk' | 'syne' | 'righteous' | 'montserrat';
    titleAnimation?: 'none' | 'spotlight-silver';

    hideHeaderTitle?: boolean;
    hideHeaderSearch?: boolean;
    hideHeaderMenu?: boolean;
    headerLayoutDesktop?: HeaderLayoutDesktop;
    headerLayoutMobile?: HeaderLayoutMobile;
    showHeaderMenuIcons?: boolean;
    showPingDetails?: boolean;
    pingIndicatorMode?: 'none' | 'standard_only' | 'all';

    showMonitor: boolean;
    totalSlots?: number;
    dockPosition?: 'left' | 'right';
    tailscaleTailnet?: string;
    tailscaleClientId?: string;
    tailscaleClientSecret?: string;

    theme?: string;
    // Tab customization
    tabOrder?: string[];
    hiddenTabs?: string[];
    tabIcons?: Record<string, string>;
    // Tabs visibility overrides
    tabs?: {
      home?: {
        hideDockerActions?: boolean;
        hideTailscaleStatus?: boolean;
        hideDevices?: boolean;
        hideQuickStats?: boolean;
        hideClock?: boolean;
        hideCalendar?: boolean;
        hideWeather?: boolean;
        hideNetworkGraph?: boolean;
        hideDockerContainers?: boolean;
        hideLeftSidebar?: boolean;
        hideRightSidebar?: boolean;
        hideBottomPanel?: boolean;
        bottomPanelTitle?: string;
        leftSidebarPosition?: 'left' | 'right';
        rightSidebarPosition?: 'left' | 'right';
      };
      widgets?: {
        hideDockerActions?: boolean;
        hideTailscaleStatus?: boolean;
        hideDevices?: boolean;
        hideQuickStats?: boolean;
        hideClock?: boolean;
        hideCalendar?: boolean;
        hideWeather?: boolean;
        hideNetworkGraph?: boolean;
        hideDockerContainers?: boolean;
      };
      docker?: {
        hideDockerActions?: boolean;
        hideTailscaleStatus?: boolean;
        hideDevices?: boolean;
        hideQuickStats?: boolean;
        hideClock?: boolean;
        hideCalendar?: boolean;
        hideWeather?: boolean;
        hideNetworkGraph?: boolean;
        hideDockerContainers?: boolean;
        hideWidgetsSidebar?: boolean;
        widgetsSidebarPosition?: 'left' | 'right';
        dockerPanelPosition?: 'left' | 'right';
      };
      networks?: {
        hideDockerActions?: boolean;
        hideTailscaleStatus?: boolean;
        hideDevices?: boolean;
        hideQuickStats?: boolean;
        hideClock?: boolean;
        hideCalendar?: boolean;
        hideWeather?: boolean;
        hideNetworkGraph?: boolean;
        hideDockerContainers?: boolean;
        hideWidgetsSidebar?: boolean;
        widgetsSidebarPosition?: 'left' | 'right';
        networksPanelPosition?: 'left' | 'right';
      };
    };
    widgetsOrder?: string[];
    widgetsTotalSlots?: number;
    homeWidgets?: (CustomTabWidgetInfo & { id: string, order: number })[];
    networkTopology?: NetworkTopology;
    // Advanced Customization
    hideDockerActions?: boolean;
    hideTailscaleStatus?: boolean;
    hideDevices?: boolean;
    hideQuickStats?: boolean;
    hideClock?: boolean;
    hideCalendar?: boolean;
    hideWeather?: boolean;
    hideNetworkGraph?: boolean;
    hideDockerContainers?: boolean;
    hideWidgetTitles?: boolean;
    weatherLocation?: { lat: number; lon: number; name: string };
    weatherLocations?: { id: string; lat: number; lon: number; name: string }[];
    weatherWidgetStyle?: 'default' | 'currentOnly' | 'minimal' | 'extended';
    activeWeatherLocationId?: string;
    hideDock?: boolean;
    calendarUrl?: string;
    clockDesign?: 'default' | 'minimal' | 'glow' | 'split';
    dockerContainersStyle?: 'standard' | 'extended' | 'minimalist';
    dockerContainersAutoScroll?: boolean;
    allowDockerActions?: boolean;
    clockTimezone?: string;
    customCss?: string;
    backgroundImage?: string;
    mobileWallpaper?: string;
    mobileTheme?: string;
    mobileGlobalFont?: string;
    mobileBorderRadius?: number;
    mobileCardOpacity?: number;
    mobileTitleAnimation?: string;
    mobileAppearanceProfiles?: AppearanceProfile[];
    // Developer options
    enablePerfMonitor?: boolean;
    // Sidebar widget alignment positions
    devicesSidebar?: 'left' | 'right' | 'bottom';
    quickStatsSidebar?: 'left' | 'right' | 'bottom';
    tailscaleSidebar?: 'left' | 'right' | 'bottom';
    dockerActionsSidebar?: 'left' | 'right' | 'bottom';
    clockSidebar?: 'left' | 'right' | 'bottom';
    calendarSidebar?: 'left' | 'right' | 'bottom';
    weatherSidebar?: 'left' | 'right' | 'bottom';
    networkGraphSidebar?: 'left' | 'right' | 'bottom';
    dockerContainersSidebar?: 'left' | 'right' | 'bottom';
    // Sidebar widget order preferences
    devicesOrder?: number;
    quickStatsOrder?: number;
    tailscaleOrder?: number;
    dockerActionsOrder?: number;
    clockOrder?: number;
    calendarOrder?: number;
    weatherOrder?: number;
    networkGraphOrder?: number;
    dockerContainersOrder?: number;
    // Premium Design options
    globalFont?: string;
    borderRadius?: number;
    cardOpacity?: number;
    emojiTheme?: string;
  };
}

export interface SystemStats {
  network?: {
    latency: number;
  };
}

// ==================== CUSTOM TABS ====================

export type CustomTabRowType = '1-col' | '50-50' | '25-75' | '75-25' | '3-col';

export interface CustomTabWidgetInfo {
  type: string; // 'clock', 'weather', 'quickstats', 'spacer'
  height?: number; // For spacer widgets
  props?: Record<string, any>;
}

export interface CustomTabColumn {
  id: string;
  width: string; // '100%', '50%', '25%', '75%', '33%'
  content: CustomTabWidgetInfo | CustomTabRow | null; // legacy or nested row
  widgets?: CustomTabWidgetInfo[]; // new array-based multiple widgets
}

export interface CustomTabRow {
  id: string;
  type: CustomTabRowType;
  columns: CustomTabColumn[];
}

export interface CustomTabLayout {
  id: string; // matches the TabDef id
  rows: CustomTabRow[];
}

// ==================== NETWORKS ====================

export interface NetworkNode {
  id: string;
  name: string;
  type: 'infra' | 'device' | 'netsvc' | 'stdsvc';
  icon: string;
  ip?: string;
  ports?: number[];
  groupId?: string;
  linkedServiceId?: string;
  linkedDeviceId?: string;
  linkedContainerId?: string;
}

export interface NetworkGroup {
  id: string;
  name: string;
  type: 'infra' | 'device' | 'netsvc' | 'stdsvc';
}

export interface NetworkConnection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  type?: 'directional' | 'bidirectional';
  fromPort?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  toPort?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
}

export interface NetworkTopology {
  nodes: NetworkNode[];
  groups: NetworkGroup[];
  connections: NetworkConnection[];
}

