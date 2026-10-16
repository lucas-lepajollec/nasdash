import { AccessPrincipal, canAccessTab, canAccessWidget } from './access';
import { DashboardConfig } from './types';
import { NO_ACCESS } from './permissions';
import { maskInstanceSecrets, stripInstanceSecrets } from '@/integrations/instances';
import { isMonitoringType } from '@/integrations/sources';
import { CUSTOM_API_TYPES, DNS_TYPES, PHOTO_TYPES } from './widgetData/contracts';

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

/** Service connections whose address stays server-side for visitors (the widget only needs id, name, type). */
const SERVICE_ADDRESS_TYPES = new Set<string>([...DNS_TYPES, ...PHOTO_TYPES, ...CUSTOM_API_TYPES]);

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
  if (principal.allowedTabs.includes(NO_ACCESS)) {
    // No page can expose a category; do not ship service addresses in bootstrap data.
    safeConfig.categories = [];
    if (Array.isArray(safeConfig.slots)) safeConfig.slots = [];
    // Nor the bookmarks library: links are shown only by widgets on a visible page.
    delete safeConfig.settings.bookmarks;
  }
  safeConfig.settings.calendarConfigured = Boolean(safeConfig.settings.calendarUrl);
  delete safeConfig.settings.calendarUrl;

  for (const host of safeConfig.dockerHosts) {
    // The browser only needs the stable host id/name. The daemon address stays server-side.
    host.url = '';
    delete host.socketPath;
    delete host.target;
    delete host.token;
  }
  for (const device of safeConfig.devices) {
    // Like saved connections: the type is enough, the address and account stay server-side.
    if (device.api) device.api = { type: device.api.type, url: '' };
  }
  stripInstanceSecrets(safeConfig);
  // Monitoring connections: their address stays server-side too (name and type are enough).
  for (const instance of safeConfig.integrations ?? []) {
    if (isMonitoringType(instance.type) || SERVICE_ADDRESS_TYPES.has(instance.type)) instance.settings = {};
  }
  // Feed addresses can carry private tokens: visitors get each feed's id and title only.
  if (safeConfig.settings.rssFeeds) safeConfig.settings.rssFeeds = safeConfig.settings.rssFeeds.map(({ id, title }) => ({ id, url: '', ...(title ? { title } : {}) }));

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
    safeConfig.settings.calendarConfigured = false;
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
