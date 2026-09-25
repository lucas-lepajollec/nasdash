import { RequestValidationError } from '../requestValidation';
import { SPACER_HEIGHT } from '../widgets/catalog';
import {
  GRID_COLUMNS,
  OFFICIAL_PAGE_IDS,
  PAGES_SCHEMA_VERSION,
  type JsonValue,
  type Page,
  type PagesDocument,
  type WidgetInstance,
  type WidgetSettings,
} from './types';

export const PAGE_LIMITS = {
  pages: 100,
  gridRows: 20_000,
  widgetsPerPage: 300,
  settingsBytes: 64 * 1024,
  settingsDepth: 10,
  nameLength: 100,
  iconLength: 64,
  descriptionLength: 500,
} as const;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const TYPE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function fail(path: string, message: string, status = 400): never {
  throw new RequestValidationError(`${path} : ${message}`, status);
}

function plainObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'objet attendu');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'JSON simple attendu');
  return value as Record<string, unknown>;
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(path, `champ inconnu « ${key} »`);
  }
}

function identifier(value: unknown, path: string): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail(path, 'identifiant invalide');
  return value;
}

function text(value: unknown, path: string, maxLength: number, required: boolean): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') fail(path, 'texte attendu');
  const trimmed = value.trim();
  if (required && !trimmed) fail(path, 'texte requis');
  if (value.length > maxLength) fail(path, 'texte trop long', 413);
  return value;
}

function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    fail(path, `entier entre ${min} et ${max} attendu`);
  }
  return value;
}

/** Deep-copies settings while refusing non-JSON values, prototype keys and excessive nesting. */
export function sanitizeSettings(value: unknown, path: string): WidgetSettings {
  let bytes = 0;
  const copy = (entry: unknown, entryPath: string, depth: number): JsonValue => {
    if (depth > PAGE_LIMITS.settingsDepth) fail(entryPath, 'réglages trop imbriqués');
    if (entry === null || typeof entry === 'boolean') { bytes += 5; return entry; }
    if (typeof entry === 'number') {
      if (!Number.isFinite(entry)) fail(entryPath, 'nombre invalide');
      bytes += 8;
      return entry;
    }
    if (typeof entry === 'string') { bytes += entry.length + 2; return entry; }
    if (Array.isArray(entry)) {
      if (entry.length > 1000) fail(entryPath, 'liste trop longue', 413);
      return entry.map((item, index) => copy(item, `${entryPath}[${index}]`, depth + 1));
    }
    const object = plainObject(entry, entryPath);
    const result: { [key: string]: JsonValue } = {};
    for (const [key, item] of Object.entries(object)) {
      if (UNSAFE_KEYS.has(key)) fail(entryPath, 'clé interdite');
      if (key.length > 128) fail(entryPath, 'clé trop longue');
      bytes += key.length + 3;
      result[key] = copy(item, `${entryPath}.${key}`, depth + 1);
    }
    return result;
  };
  const result = copy(value === undefined ? {} : value, path, 0);
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail(path, 'objet attendu');
  if (bytes > PAGE_LIMITS.settingsBytes) fail(path, 'réglages trop volumineux', 413);
  return result;
}

function validateWidgetSettings(type: string, settings: WidgetSettings, path: string) {
  if (type === 'service-category') {
    if (typeof settings.categoryId !== 'string' || !ID_PATTERN.test(settings.categoryId)) {
      fail(`${path}.categoryId`, 'catégorie requise');
    }
  }
  // Height chosen with the resize handles (px); the content can still grow past it.
  if (settings.minHeight !== undefined) integer(settings.minHeight, `${path}.minHeight`, 0, 4000);
  if (type === 'spacer' && settings.height !== undefined) {
    integer(settings.height, `${path}.height`, SPACER_HEIGHT.min, SPACER_HEIGHT.max);
  }
}

function validateWidget(value: unknown, path: string): WidgetInstance {
  const widget = plainObject(value, path);
  onlyKeys(widget, ['id', 'type', 'hidden', 'settings', 'x', 'y', 'w', 'h'], path);
  const id = identifier(widget.id, `${path}.id`);
  if (typeof widget.type !== 'string' || !TYPE_PATTERN.test(widget.type)) fail(`${path}.type`, 'type invalide');
  if (widget.hidden !== undefined && typeof widget.hidden !== 'boolean') fail(`${path}.hidden`, 'booléen attendu');
  const settings = sanitizeSettings(widget.settings, `${path}.settings`);
  validateWidgetSettings(widget.type, settings, `${path}.settings`);
  const w = integer(widget.w, `${path}.w`, 1, GRID_COLUMNS);
  const x = integer(widget.x, `${path}.x`, 0, GRID_COLUMNS - w);
  const y = integer(widget.y, `${path}.y`, 0, PAGE_LIMITS.gridRows);
  const h = integer(widget.h, `${path}.h`, 1, PAGE_LIMITS.gridRows);
  return { id, type: widget.type, ...(widget.hidden ? { hidden: true } : {}), settings, x, y, w, h };
}

/** Validates an untrusted page: bounded grid placements, unique widget ids, safe settings. */
export function validatePage(value: unknown, path = 'page'): Page {
  const page = plainObject(value, path);
  // `fitPending` was written by a short-lived development version; it is ignored.
  onlyKeys(page, ['id', 'name', 'icon', 'description', 'preset', 'revision', 'fitPending', 'widgets'], path);
  const id = identifier(page.id, `${path}.id`);
  const name = text(page.name, `${path}.name`, PAGE_LIMITS.nameLength, true)!;
  const icon = text(page.icon, `${path}.icon`, PAGE_LIMITS.iconLength, false) ?? '';
  const description = text(page.description, `${path}.description`, PAGE_LIMITS.descriptionLength, false);
  if (page.preset !== undefined && !(OFFICIAL_PAGE_IDS as readonly unknown[]).includes(page.preset)) {
    fail(`${path}.preset`, 'modèle inconnu');
  }
  const revision = integer(page.revision, `${path}.revision`, 0, Number.MAX_SAFE_INTEGER);
  if (!Array.isArray(page.widgets)) fail(`${path}.widgets`, 'liste attendue');
  if (page.widgets.length > PAGE_LIMITS.widgetsPerPage) fail(`${path}.widgets`, 'trop de widgets', 413);
  const widgets = page.widgets.map((widget, index) => validateWidget(widget, `${path}.widgets[${index}]`));
  const ids = new Set<string>();
  for (const widget of widgets) {
    if (ids.has(widget.id)) fail(path, `widget dupliqué « ${widget.id} »`);
    ids.add(widget.id);
  }
  return {
    id, name, icon,
    ...(description ? { description } : {}),
    ...(page.preset ? { preset: page.preset as Page['preset'] } : {}),
    revision,
    widgets,
  };
}

export function validatePagesDocument(value: unknown): PagesDocument {
  const document = plainObject(value, 'pages');
  onlyKeys(document, ['schemaVersion', 'pages', 'migration'], 'pages');
  if (document.schemaVersion !== PAGES_SCHEMA_VERSION) {
    fail('pages.schemaVersion', 'version de schéma non prise en charge');
  }
  if (!Array.isArray(document.pages)) fail('pages.pages', 'liste attendue');
  if (document.pages.length > PAGE_LIMITS.pages) fail('pages.pages', 'trop de pages', 413);
  const pages = document.pages.map((page, index) => validatePage(page, `pages.pages[${index}]`));
  const ids = new Set<string>();
  for (const page of pages) {
    if (ids.has(page.id)) fail('pages', `page dupliquée « ${page.id} »`);
    ids.add(page.id);
  }
  const result: PagesDocument = { schemaVersion: PAGES_SCHEMA_VERSION, pages };
  if (document.migration !== undefined) {
    const migration = plainObject(document.migration, 'pages.migration');
    const notes = Array.isArray(migration.notes)
      ? migration.notes.filter((note): note is string => typeof note === 'string').slice(0, 200)
      : [];
    result.migration = { from: migration.from === 'sections' ? 'sections' : 'legacy', at: typeof migration.at === 'string' ? migration.at : '', notes };
  }
  return result;
}
