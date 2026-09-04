import {
  JsonObject,
  RequestValidationError,
  assertSafeIdentifier,
  isJsonObject,
  readBoolean,
  readEnum,
  readObject,
  readString,
  readStringArray,
} from './requestValidation';
import { validateDockerHostUrl } from './dockerClient';

const CATEGORY_LAYOUTS = [
  'standard',
  'compact',
  'bento',
  'grid', // legacy value migrated by the current UI
  'bento-logo-large',
  'bento-logo-medium',
  'bento-logo-small',
] as const;
const DEVICE_API_TYPES = ['homeassistant', 'proxmox', 'custom', 'glances', 'lhm'] as const;
const DEVICE_STAT_STYLES = ['horizontal', 'vertical', 'graph', 'circle'] as const;
const DOCKER_ACTION_TYPES = ['start', 'stop', 'switch'] as const;
const NETWORK_NODE_TYPES = ['infra', 'device', 'netsvc', 'stdsvc'] as const;
const CONNECTION_TYPES = ['directional', 'bidirectional'] as const;
const CONNECTION_PORTS = ['auto', 'top', 'bottom', 'left', 'right'] as const;
const HEADER_DESKTOP_ELEMENTS = ['title', 'search', 'menu', 'none'] as const;
const HEADER_MOBILE_ELEMENTS = ['title', 'search', 'none'] as const;

const SETTINGS_BOOLEAN_KEYS = [
  'showMonitor', 'hideDock', 'hideWidgetTitles', 'hideCategoryTitles',
  'enablePerfMonitor', 'dockerContainersAutoScroll', 'allowDockerActions',
  'hideHeaderTitle', 'hideHeaderSearch', 'hideHeaderMenu', 'showHeaderMenuIcons',
  'showPingDetails',
] as const;

const SETTINGS_STRING_KEYS: ReadonlyArray<readonly [string, number]> = [
  ['title', 200], ['titleMobile', 200], ['tailscaleTailnet', 512],
  ['tailscaleClientId', 2_048], ['tailscaleClientSecret', 8_192],
  ['theme', 128], ['calendarUrl', 4_096], ['clockTimezone', 256],
  ['globalFont', 128], ['emojiTheme', 128], ['mobileTheme', 128],
  ['mobileGlobalFont', 128], ['mobileTitleAnimation', 128],
  ['activeWeatherLocationId', 128],
] as const;

const SETTINGS_LARGE_STRING_KEYS: ReadonlyArray<readonly [string, number]> = [
  ['titleLogo', 1_900_000], ['backgroundImage', 1_900_000],
  ['mobileWallpaper', 1_900_000], ['customCss', 1_000_000],
] as const;

type MutationMethod = 'POST' | 'PUT';

interface NumberOptions {
  min: number;
  max: number;
  integer?: boolean;
}

function readNumber(object: JsonObject, key: string, options: NumberOptions): number | undefined {
  const value = object[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RequestValidationError(`Le champ « ${key} » doit être un nombre fini.`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new RequestValidationError(`Le champ « ${key} » doit être un nombre entier.`);
  }
  if (value < options.min || value > options.max) {
    throw new RequestValidationError(`Le champ « ${key} » dépasse les limites autorisées.`);
  }
  return value;
}

function readArray(object: JsonObject, key: string, maxItems: number, required = false): unknown[] | undefined {
  const value = object[key];
  if (value === undefined || value === null) {
    if (required) throw new RequestValidationError(`Le champ « ${key} » est requis.`);
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new RequestValidationError(`Le champ « ${key} » doit être une liste.`);
  }
  if (value.length > maxItems) {
    throw new RequestValidationError(`Le champ « ${key} » contient trop d’éléments.`, 413);
  }
  return value;
}

function readIdentifier(object: JsonObject, key = 'id', required = true): string | undefined {
  const value = readString(object, key, { required, maxLength: 128 });
  return value === undefined ? undefined : assertSafeIdentifier(value);
}

function assertBoundedJson(value: unknown, label: string, depth = 0): void {
  if (depth > 8) throw new RequestValidationError(`Le champ « ${label} » est trop profondément imbriqué.`);
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RequestValidationError(`Le champ « ${label} » contient un nombre invalide.`);
    return;
  }
  if (typeof value === 'string') {
    if (value.length > 16_384) throw new RequestValidationError(`Le champ « ${label} » contient un texte trop long.`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 1_000) throw new RequestValidationError(`Le champ « ${label} » contient trop d’éléments.`, 413);
    value.forEach(item => assertBoundedJson(item, label, depth + 1));
    return;
  }
  if (!isJsonObject(value)) {
    throw new RequestValidationError(`Le champ « ${label} » contient une valeur invalide.`);
  }

  const entries = Object.entries(value);
  if (entries.length > 500) throw new RequestValidationError(`Le champ « ${label} » contient trop de propriétés.`, 413);
  for (const [key, nestedValue] of entries) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor' || key.length > 128) {
      throw new RequestValidationError(`Le champ « ${label} » contient une propriété invalide.`);
    }
    assertBoundedJson(nestedValue, label, depth + 1);
  }
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!isJsonObject(value)) throw new RequestValidationError(`Le champ « ${label} » doit être un objet.`);
  return value;
}

function validateStringRecord(value: unknown, label: string, maxEntries: number, maxValueLength: number): void {
  const record = requireObject(value, label);
  const entries = Object.entries(record);
  if (entries.length > maxEntries) throw new RequestValidationError(`Le champ « ${label} » contient trop de propriétés.`, 413);
  for (const [key, entryValue] of entries) {
    assertSafeIdentifier(key);
    if (typeof entryValue !== 'string' || entryValue.length > maxValueLength) {
      throw new RequestValidationError(`Le champ « ${label} » contient une valeur invalide.`);
    }
  }
}

function validateHeaderLayouts(body: JsonObject): void {
  if (body.headerLayoutDesktop !== undefined) {
    const layout = requireObject(body.headerLayoutDesktop, 'headerLayoutDesktop');
    readEnum(layout, 'left', HEADER_DESKTOP_ELEMENTS);
    readEnum(layout, 'center', HEADER_DESKTOP_ELEMENTS);
    readEnum(layout, 'right', HEADER_DESKTOP_ELEMENTS);
    readEnum(layout, 'splitMenuAround', ['title', 'search', 'none'] as const);
  }
  if (body.headerLayoutMobile !== undefined) {
    const layout = requireObject(body.headerLayoutMobile, 'headerLayoutMobile');
    readEnum(layout, 'left', HEADER_MOBILE_ELEMENTS);
    readEnum(layout, 'center', HEADER_MOBILE_ELEMENTS);
  }
}

const TAB_WIDGET_BOOLEAN_KEYS = [
  'hideDockerActions', 'hideTailscaleStatus', 'hideDevices', 'hideQuickStats',
  'hideClock', 'hideCalendar', 'hideWeather', 'hideNetworkGraph',
  'hideDockerContainers', 'hideWidgetsSidebar', 'hideLeftSidebar',
  'hideRightSidebar', 'hideBottomPanel',
] as const;

function validateTabs(value: unknown): void {
  const tabs = requireObject(value, 'tabs');
  if (Object.keys(tabs).length > 32) throw new RequestValidationError('Le champ « tabs » contient trop de propriétés.');

  for (const [tabId, rawTab] of Object.entries(tabs)) {
    assertSafeIdentifier(tabId);
    const tab = requireObject(rawTab, `tabs.${tabId}`);
    assertBoundedJson(tab, `tabs.${tabId}`);
    for (const key of TAB_WIDGET_BOOLEAN_KEYS) readBoolean(tab, key);
    readEnum(tab, 'leftSidebarPosition', ['left', 'right'] as const);
    readEnum(tab, 'rightSidebarPosition', ['left', 'right'] as const);
    readEnum(tab, 'widgetsSidebarPosition', ['left', 'right'] as const);
    readEnum(tab, 'dockerPanelPosition', ['left', 'right'] as const);
    readEnum(tab, 'networksPanelPosition', ['left', 'right'] as const);
    readEnum(tab, 'cardSize', ['auto', 'standard', 'compact', 'mini'] as const);
    readString(tab, 'bottomPanelTitle', { maxLength: 200, trim: false });
  }
}

function validateWidget(value: unknown, label: string, requireOrder: boolean): void {
  const widget = requireObject(value, label);
  readIdentifier(widget);
  readString(widget, 'type', { required: true, maxLength: 128 });
  readNumber(widget, 'height', { min: 0, max: 100_000 });
  const order = readNumber(widget, 'order', { min: -10_000, max: 10_000, integer: true });
  if (requireOrder && order === undefined) {
    throw new RequestValidationError(`Le champ « ${label}.order » est requis.`);
  }
  if (widget.props !== undefined) assertBoundedJson(widget.props, `${label}.props`);
}

function validateHomeWidgets(value: unknown): void {
  if (!Array.isArray(value)) throw new RequestValidationError('Le champ « homeWidgets » doit être une liste.');
  if (value.length > 500) throw new RequestValidationError('Le champ « homeWidgets » contient trop d’éléments.', 413);
  value.forEach((widget, index) => validateWidget(widget, `homeWidgets.${index}`, true));
}

function validatePanels(value: unknown): void {
  const panels = requireObject(value, 'panels');
  const entries = Object.entries(panels);
  if (entries.length > 100) throw new RequestValidationError('Le champ « panels » contient trop de panneaux.', 413);
  for (const [panelId, rawPanel] of entries) {
    assertSafeIdentifier(panelId);
    const panel = requireObject(rawPanel, `panels.${panelId}`);
    const widgets = readArray(panel, 'widgets', 500, true)!;
    widgets.forEach((widget, index) => validateWidget(widget, `panels.${panelId}.widgets.${index}`, false));
  }
}

function validateNetworkTopology(value: unknown): void {
  const topology = requireObject(value, 'networkTopology');
  const nodes = readArray(topology, 'nodes', 2_000, true)!;
  const groups = readArray(topology, 'groups', 500, true)!;
  const connections = readArray(topology, 'connections', 10_000, true)!;

  nodes.forEach((rawNode, index) => {
    const node = requireObject(rawNode, `networkTopology.nodes.${index}`);
    readIdentifier(node);
    readString(node, 'name', { required: true, maxLength: 200 });
    readEnum(node, 'type', NETWORK_NODE_TYPES, true);
    readString(node, 'icon', { maxLength: 128, trim: false });
    readString(node, 'ip', { maxLength: 2_048, trim: false });
    for (const key of ['groupId', 'linkedServiceId', 'linkedDeviceId', 'linkedContainerId'] as const) {
      if (node[key] !== undefined) readIdentifier(node, key);
    }
    const ports = readArray(node, 'ports', 1_000);
    ports?.forEach(port => {
      if (typeof port !== 'number' || !Number.isInteger(port) || port < 0 || port > 65_535) {
        throw new RequestValidationError('La topologie contient un port invalide.');
      }
    });
  });

  groups.forEach((rawGroup, index) => {
    const group = requireObject(rawGroup, `networkTopology.groups.${index}`);
    readIdentifier(group);
    readString(group, 'name', { required: true, maxLength: 200 });
    readEnum(group, 'type', NETWORK_NODE_TYPES, true);
    readBoolean(group, 'mergeIncomingLinks');
  });

  connections.forEach((rawConnection, index) => {
    const connection = requireObject(rawConnection, `networkTopology.connections.${index}`);
    readIdentifier(connection);
    readIdentifier(connection, 'fromId');
    readIdentifier(connection, 'toId');
    readString(connection, 'label', { maxLength: 500, trim: false });
    readEnum(connection, 'type', CONNECTION_TYPES);
    readEnum(connection, 'fromPort', CONNECTION_PORTS);
    readEnum(connection, 'toPort', CONNECTION_PORTS);
  });
}

function validateWeatherLocation(value: unknown, requireId: boolean, label: string): void {
  const location = requireObject(value, label);
  if (requireId) readIdentifier(location);
  const latitude = readNumber(location, 'lat', { min: -90, max: 90 });
  const longitude = readNumber(location, 'lon', { min: -180, max: 180 });
  if (latitude === undefined || longitude === undefined) {
    throw new RequestValidationError(`Les coordonnées du champ « ${label} » sont requises.`);
  }
  readString(location, 'name', { required: true, maxLength: 200 });
}

function validateAppearanceProfiles(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new RequestValidationError(`Le champ « ${label} » doit être une liste.`);
  if (value.length > 100) throw new RequestValidationError(`Le champ « ${label} » contient trop d’éléments.`, 413);
  value.forEach((rawProfile, index) => {
    const profile = requireObject(rawProfile, `${label}.${index}`);
    readIdentifier(profile);
    readString(profile, 'name', { required: true, maxLength: 200 });
    const settings = requireObject(profile.settings, `${label}.${index}.settings`);
    assertBoundedJson(settings, `${label}.${index}.settings`);
    validateSettingsPayload(settings, false);
  });
}

function validateDynamicWidgetSetting(key: string, value: unknown): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    throw new RequestValidationError(`Le réglage dynamique « ${key} » est invalide.`);
  }
  if (key.startsWith('hide')) {
    if (typeof value !== 'boolean') throw new RequestValidationError(`Le champ « ${key} » doit être un booléen.`);
  } else if (key.endsWith('Sidebar')) {
    if (typeof value !== 'boolean' && (typeof value !== 'string' || value.length > 32)) {
      throw new RequestValidationError(`Le champ « ${key} » contient une position invalide.`);
    }
  } else if (key.endsWith('Order')) {
    if (typeof value === 'number') {
      if (!Number.isInteger(value) || value < -10_000 || value > 10_000) {
        throw new RequestValidationError(`Le champ « ${key} » contient un ordre invalide.`);
      }
    } else if (Array.isArray(value)) {
      if (value.length > 1_000 || value.some(item =>
        (typeof item !== 'string' && typeof item !== 'number')
        || (typeof item === 'string' && item.length > 128)
        || (typeof item === 'number' && !Number.isFinite(item)))) {
        throw new RequestValidationError(`Le champ « ${key} » contient un ordre invalide.`);
      }
    } else {
      throw new RequestValidationError(`Le champ « ${key} » contient un ordre invalide.`);
    }
  } else if (key.endsWith('Props')) {
    assertBoundedJson(value, key);
  }
}

function validateSettingsPayload(body: JsonObject, allowProfiles = true): void {
  for (const [key, maxLength] of SETTINGS_STRING_KEYS) readString(body, key, { maxLength, trim: false });
  for (const [key, maxLength] of SETTINGS_LARGE_STRING_KEYS) readString(body, key, { maxLength, trim: false });
  for (const key of SETTINGS_BOOLEAN_KEYS) readBoolean(body, key);

  readEnum(body, 'titleFont', ['outfit', 'space-grotesk', 'syne', 'righteous', 'montserrat'] as const);
  readEnum(body, 'titleAnimation', ['none', 'spotlight-silver'] as const);
  readEnum(body, 'mode', ['light', 'dark'] as const);
  readEnum(body, 'dockPosition', ['left', 'right'] as const);
  readEnum(body, 'categoryTitlePosition', ['inside', 'above'] as const);
  readEnum(body, 'clockDesign', ['default', 'minimal', 'glow', 'split'] as const);
  readEnum(body, 'weatherWidgetStyle', ['default', 'currentOnly', 'minimal', 'extended'] as const);
  readEnum(body, 'dockerContainersStyle', ['standard', 'extended', 'minimalist', 'grid'] as const);
  readEnum(body, 'pingIndicatorMode', ['none', 'standard_only', 'all'] as const);
  readEnum(body, 'securityMode', ['public', 'private'] as const);
  readEnum(body, 'uiLanguage', ['en', 'fr', 'es', 'de'] as const);

  readNumber(body, 'totalSlots', { min: 0, max: 10_000, integer: true });
  readNumber(body, 'widgetsTotalSlots', { min: 0, max: 10_000, integer: true });
  readNumber(body, 'borderRadius', { min: 0, max: 100 });
  readNumber(body, 'cardOpacity', { min: 0, max: 1 });
  readNumber(body, 'mobileBorderRadius', { min: 0, max: 100 });
  readNumber(body, 'mobileCardOpacity', { min: 0, max: 1 });

  for (const key of ['tabOrder', 'extensionOrder', 'widgetsOrder', 'hiddenTabs', 'hiddenExtensions'] as const) {
    readStringArray(body, key, { maxItems: 1_000, maxItemLength: 128 });
  }

  if (body.tabIcons !== undefined) validateStringRecord(body.tabIcons, 'tabIcons', 500, 128);
  if (body.tabs !== undefined) validateTabs(body.tabs);
  if (body.panels !== undefined) validatePanels(body.panels);
  if (body.homeWidgets !== undefined) validateHomeWidgets(body.homeWidgets);
  if (body.networkTopology !== undefined) validateNetworkTopology(body.networkTopology);
  validateHeaderLayouts(body);

  if (body.weatherLocation !== undefined) validateWeatherLocation(body.weatherLocation, false, 'weatherLocation');
  if (body.weatherLocations !== undefined) {
    if (!Array.isArray(body.weatherLocations)) throw new RequestValidationError('Le champ « weatherLocations » doit être une liste.');
    if (body.weatherLocations.length > 100) throw new RequestValidationError('Le champ « weatherLocations » contient trop d’éléments.');
    body.weatherLocations.forEach((location, index) => validateWeatherLocation(location, true, `weatherLocations.${index}`));
  }

  if (allowProfiles && body.appearanceProfiles !== undefined) validateAppearanceProfiles(body.appearanceProfiles, 'appearanceProfiles');
  if (allowProfiles && body.mobileAppearanceProfiles !== undefined) validateAppearanceProfiles(body.mobileAppearanceProfiles, 'mobileAppearanceProfiles');

  for (const [key, value] of Object.entries(body)) {
    const isDynamicHide = key.startsWith('hide') && key !== 'hiddenTabs' && key !== 'hiddenExtensions';
    if (isDynamicHide || key.endsWith('Sidebar') || key.endsWith('Order') || key.endsWith('Props')) {
      validateDynamicWidgetSetting(key, value);
    }
  }
}

function validateService(value: unknown, requireId: boolean): void {
  if (!isJsonObject(value)) throw new RequestValidationError('Chaque service doit être un objet.');
  readIdentifier(value, 'id', requireId);
  readString(value, 'name', { maxLength: 200 });
  readString(value, 'logo', { maxLength: 4_096, trim: false });
  readString(value, 'localUrl', { maxLength: 4_096, trim: false });
  readString(value, 'secondaryUrl', { maxLength: 4_096, trim: false });
  readString(value, 'secondaryLogo', { maxLength: 4_096, trim: false });
  readString(value, 'tailscaleUrl', { maxLength: 4_096, trim: false });
}

function validateServices(object: JsonObject, required = false): void {
  const services = readArray(object, 'services', 1_000, required);
  services?.forEach(service => validateService(service, true));
}

function validateCategory(value: unknown): void {
  if (!isJsonObject(value)) throw new RequestValidationError('Chaque catégorie doit être un objet.');
  readIdentifier(value);
  readString(value, 'title', { maxLength: 200 });
  readString(value, 'emoji', { maxLength: 64, trim: false });
  readBoolean(value, 'isSecret');
  readNumber(value, 'order', { min: 0, max: 10_000, integer: true });
  readEnum(value, 'layout', CATEGORY_LAYOUTS);
  validateServices(value, true);
}

function validateDeviceApi(value: unknown): void {
  if (!isJsonObject(value)) throw new RequestValidationError('Le champ « api » doit être un objet.');
  readEnum(value, 'type', DEVICE_API_TYPES, true);
  readString(value, 'url', { maxLength: 4_096, trim: false });
  readString(value, 'ip', { maxLength: 2_048, trim: false });
  readString(value, 'port', { maxLength: 16 });
  readString(value, 'username', { maxLength: 256, trim: false });
  readString(value, 'password', { maxLength: 8_192, trim: false });
  readString(value, 'token', { maxLength: 8_192, trim: false });
  readString(value, 'nodeName', { maxLength: 256 });
  readString(value, 'vmid', { maxLength: 64 });
  readEnum(value, 'vmType', ['qemu', 'lxc'] as const);
  if (value.mapping !== undefined) assertBoundedJson(value.mapping, 'api.mapping');
}

function validateDevice(value: unknown, requireId: boolean): void {
  if (!isJsonObject(value)) throw new RequestValidationError('Chaque appareil doit être un objet.');
  readIdentifier(value, 'id', requireId);
  readString(value, 'name', { maxLength: 200 });
  readString(value, 'host', { maxLength: 2_048, trim: false });
  readString(value, 'system', { maxLength: 200 });
  readString(value, 'icon', { maxLength: 64, trim: false });
  readEnum(value, 'statStyle', DEVICE_STAT_STYLES);
  readBoolean(value, 'hideValues');
  readBoolean(value, 'enableAlerts');
  readNumber(value, 'colsDesktop', { min: 1, max: 6, integer: true });
  readNumber(value, 'colsMobile', { min: 1, max: 6, integer: true });
  if (value.api !== undefined && value.api !== null) validateDeviceApi(value.api);
  if (value.stats !== undefined) assertBoundedJson(value.stats, 'stats');
}

function validateDockerTarget(value: unknown): void {
  if (!isJsonObject(value)) throw new RequestValidationError('Chaque cible Docker doit être un objet.');
  readIdentifier(value, 'hostId');
  readString(value, 'containerName', { required: true, maxLength: 512, trim: false });
}

function validateDockerAction(value: unknown, requireId: boolean): void {
  if (!isJsonObject(value)) throw new RequestValidationError('Chaque action Docker doit être un objet.');
  readIdentifier(value, 'id', requireId);
  readString(value, 'name', { maxLength: 200 });
  readString(value, 'icon', { maxLength: 64, trim: false });
  readEnum(value, 'actionType', DOCKER_ACTION_TYPES);
  const targets = readArray(value, 'targets', 1_000);
  targets?.forEach(validateDockerTarget);
}

function validateCalendarMutation(body: JsonObject, method: MutationMethod): void {
  if (method === 'PUT') readIdentifier(body);
  readString(body, 'title', { maxLength: 200 });
  readString(body, 'start', { maxLength: 64 });
  readString(body, 'end', { maxLength: 64 });
  readString(body, 'description', { maxLength: 4_000, trim: false });
  readBoolean(body, 'isAllDay');
}

export function validateConfigMutationBody(
  body: JsonObject,
  type: string,
  method: MutationMethod,
): void {
  if (type === 'settings') {
    validateSettingsPayload(body);
    return;
  }

  if (type === 'reorder') {
    const categories = readArray(body, 'categories', 500, true)!;
    categories.forEach(validateCategory);
    return;
  }

  if (type === 'reorderDevices') {
    const devices = readArray(body, 'devices', 500, true)!;
    devices.forEach(device => validateDevice(device, true));
    return;
  }

  if (type === 'category') {
    if (method === 'PUT') readIdentifier(body);
    readString(body, 'title', { maxLength: 200 });
    readString(body, 'emoji', { maxLength: 64, trim: false });
    readBoolean(body, 'isSecret');
    readEnum(body, 'layout', CATEGORY_LAYOUTS);
    validateServices(body);
    return;
  }

  if (type === 'service') {
    if (method === 'POST') readIdentifier(body, 'categoryId');
    else readIdentifier(body);
    readString(body, 'name', { maxLength: 200 });
    readString(body, 'logo', { maxLength: 4_096, trim: false });
    readString(body, 'localUrl', { maxLength: 4_096, trim: false });
    readString(body, 'secondaryUrl', { maxLength: 4_096, trim: false });
    readString(body, 'secondaryLogo', { maxLength: 4_096, trim: false });
    readString(body, 'tailscaleUrl', { maxLength: 4_096, trim: false });
    return;
  }

  if (type === 'device') {
    validateDevice(body, method === 'PUT');
    return;
  }

  if (type === 'dockerHost') {
    readString(body, 'name', { maxLength: 200 });
    readString(body, 'icon', { maxLength: 64, trim: false });
    const url = readString(body, 'url', { maxLength: 4_096, trim: false });
    try {
      validateDockerHostUrl(url || '');
    } catch {
      throw new RequestValidationError('L’adresse Docker doit être une URL complète en http:// ou https:// avec le bon port.');
    }
    return;
  }

  if (type === 'dockerAction') {
    validateDockerAction(body, method === 'PUT');
    return;
  }

  if (type === 'reorderDockerActions') {
    const actions = readArray(body, 'dockerActions', 500, true)!;
    actions.forEach(action => validateDockerAction(action, true));
    return;
  }

  if (type === 'homeWidgetProps') {
    readIdentifier(body);
    const props = readObject(body, 'props');
    if (!props) throw new RequestValidationError('Le champ « props » est requis.');
    assertBoundedJson(props, 'props');
    return;
  }

  if (type === 'localEvent') validateCalendarMutation(body, method);
}
