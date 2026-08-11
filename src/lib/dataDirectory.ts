import path from 'path';
import { isDemoMode } from './demoMode';

/**
 * Returns the persistent data directory used by the server.
 *
 * Production and existing local installs keep using `<project>/data`. Tests and
 * advanced self-hosted deployments can opt into another directory without
 * moving or mutating the real instance data.
 */
export function getDataDirectory(): string {
  // Demo mode always wins so a stale NASDASH_DATA_DIR can never expose a real
  // installation through the public showcase.
  if (isDemoMode()) return path.join(process.cwd(), 'demo', 'fixtures');
  const configuredDirectory = process.env.NASDASH_DATA_DIR?.trim();
  if (configuredDirectory) return path.resolve(configuredDirectory);
  return path.join(process.cwd(), 'data');
}

export function getDataPath(...segments: string[]): string {
  // Runtime data is mounted in production; demo fixtures are included
  // explicitly through next.config.ts. Do not make Turbopack trace the whole
  // repository because NASDASH_DATA_DIR is intentionally runtime-configurable.
  return path.join(/* turbopackIgnore: true */ getDataDirectory(), ...segments);
}
