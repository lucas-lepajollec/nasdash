import { AccessPrincipal, canAccessTab, canAccessWidget } from './access';
import { DashboardConfig } from './types';
import { maskInstanceSecrets, stripInstanceSecrets } from '@/integrations/instances';

type SerializableConfig = DashboardConfig & {
  slots?: Array<Record<string, unknown>>;
};

function cloneConfig(config: DashboardConfig): SerializableConfig {
  return JSON.parse(JSON.stringify(config)) as SerializableConfig;
}

function maskSecrets(config: SerializableConfig): void {
  for (const device of config.devices || []) {
    if (device.api?.token) device.api.token = '********';
  }
  for (const host of config.dockerHosts || []) {
    if (host.token) host.token = '********';
  }

  maskInstanceSecrets(config);
}

function filterSecretCategories(config: SerializableConfig): void {
  const visibleCategoryIds = new Set(
    (config.categories || [])
      .filter(category => category.isSecret !== true)
      .map(category => category.id)
  );

  config.categories = (config.categories || []).filter(category => visibleCategoryIds.has(category.id));

  if (Array.isArray(config.slots)) {
    config.slots = config.slots.filter(slot => {
      if (slot.type !== 'category') return true;
      const category = slot.category as { id?: string; isSecret?: boolean } | undefined;
      if (category?.isSecret === true) return false;
      return !category?.id || visibleCategoryIds.has(category.id);
    });
  }
}

export function buildConfigForPrincipal(
  config: DashboardConfig,
  principal: AccessPrincipal
): DashboardConfig {
  const safeConfig = cloneConfig(config);
  safeConfig.devices ||= [];
  safeConfig.dockerHosts ||= [];
  safeConfig.dockerActions ||= [];
  safeConfig.localEvents ||= [];

  maskSecrets(safeConfig);

  if (principal.role === 'admin') return safeConfig;

  filterSecretCategories(safeConfig);

  for (const host of safeConfig.dockerHosts) {
    // The browser only needs the stable host id/name. The daemon address stays server-side.
    host.url = '';
    delete host.socketPath;
    delete host.target;
    delete host.token;
  }
  for (const device of safeConfig.devices) {
    if (device.api) delete device.api.token;
  }
  stripInstanceSecrets(safeConfig);

  const canReadDocker =
    canAccessTab(principal, 'docker') ||
    canAccessWidget(principal, 'dockercontainers') ||
    canAccessWidget(principal, 'dockeractions');
  if (!canReadDocker) {
    safeConfig.dockerHosts = [];
    safeConfig.dockerActions = [];
  }

  const canReadDevices =
    canAccessTab(principal, 'dashboard') ||
    canAccessWidget(principal, 'devices') ||
    canAccessWidget(principal, 'quickstats');
  if (!canReadDevices) safeConfig.devices = [];

  if (!canAccessWidget(principal, 'calendar')) {
    safeConfig.localEvents = [];
    delete safeConfig.settings.calendarUrl;
  }

  const canReadNetwork =
    canAccessTab(principal, 'networks') ||
    canAccessWidget(principal, 'networkgraph');
  if (!canReadNetwork) delete safeConfig.settings.networkTopology;

  const canReadTailscale =
    canAccessTab(principal, 'networks') ||
    canAccessWidget(principal, 'tailscale');
  if (!canReadTailscale) {
    safeConfig.integrations = (safeConfig.integrations ?? []).filter(instance => instance.type !== 'tailscale' && instance.type !== 'headscale');
  }

  return safeConfig;
}
