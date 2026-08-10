import {
  JsonObject,
  RequestValidationError,
  assertSafeIdentifier,
  isJsonObject,
  readBoolean,
  readEnum,
  readObject,
  readString,
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
