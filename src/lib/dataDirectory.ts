import path from 'path';

/**
 * Returns the persistent data directory used by the server.
 *
 * Production and existing local installs keep using `<project>/data`. Tests and
 * advanced self-hosted deployments can opt into another directory without
 * moving or mutating the real instance data.
 */
export function getDataDirectory(): string {
  const configuredDirectory = process.env.NASDASH_DATA_DIR?.trim();
  return configuredDirectory
    ? path.resolve(configuredDirectory)
    : path.join(process.cwd(), 'data');
}

export function getDataPath(...segments: string[]): string {
  return path.join(getDataDirectory(), ...segments);
}
