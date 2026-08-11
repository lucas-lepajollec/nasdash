import fs from 'fs';

export interface LegacyConfigData {
  categories?: unknown[];
  localEvents?: unknown[];
  settings?: Record<string, unknown> & { networkTopology?: unknown };
  [key: string]: unknown;
}

export interface SplitConfigPaths {
  services: { target: string; example: string };
  topology: { target: string; example: string };
  calendar: { target: string; example: string };
}

type AtomicWriter = (filePath: string, data: string) => void;

function isExamplePlaceholder(targetPath: string, examplePath: string): boolean {
  if (!fs.existsSync(targetPath)) return true;
  if (!fs.existsSync(examplePath)) return false;

  try {
    return fs.readFileSync(targetPath).equals(fs.readFileSync(examplePath));
  } catch {
    return false;
  }
}

export function migrateLegacySplitFiles(
  config: LegacyConfigData,
  paths: SplitConfigPaths,
  writeFile: AtomicWriter,
): boolean {
  let migrated = false;

  if (Array.isArray(config.categories) && config.categories.length > 0) {
    if (isExamplePlaceholder(paths.services.target, paths.services.example)) {
      writeFile(paths.services.target, JSON.stringify(config.categories, null, 2));
    }
    delete config.categories;
    migrated = true;
  }

  const legacyTopology = config.settings?.networkTopology;
  if (legacyTopology !== undefined) {
    if (isExamplePlaceholder(paths.topology.target, paths.topology.example)) {
      writeFile(paths.topology.target, JSON.stringify(legacyTopology, null, 2));
    }
    delete config.settings!.networkTopology;
    migrated = true;
  }

  if (Array.isArray(config.localEvents) && config.localEvents.length > 0) {
    if (isExamplePlaceholder(paths.calendar.target, paths.calendar.example)) {
      writeFile(paths.calendar.target, JSON.stringify(config.localEvents, null, 2));
    }
    delete config.localEvents;
    migrated = true;
  }

  return migrated;
}
