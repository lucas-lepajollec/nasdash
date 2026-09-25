import type { DashboardConfig, IntegrationInstance } from '@/lib/types';

/**
 * Integration instances: one saved connection to an external service (a
 * tailnet, later a Docker engine, a Jellyfin server…), stored in
 * `config.integrations` with its settings and, separately, its secrets.
 * Secrets are encrypted on disk (`config.ts`), masked for admins and removed
 * for everyone else (`configAccess.ts`). Pure functions, shared by the server.
 */

export const MASKED_SECRET = '********';

export function findInstance(config: Pick<DashboardConfig, 'integrations'>, type: string): IntegrationInstance | undefined {
  return config.integrations?.find(instance => instance.type === type);
}

/** Among connections of these types, the one saved last (e.g. Tailscale or Headscale for the mesh widget). */
export function latestInstance(config: Pick<DashboardConfig, 'integrations'>, types: readonly string[]): IntegrationInstance | undefined {
  return (config.integrations ?? [])
    .filter(instance => types.includes(instance.type))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
}

/** Applies `transform` to every stored secret (encryption, decryption). */
export function mapInstanceSecrets(config: Pick<DashboardConfig, 'integrations'>, transform: (value: string) => string): void {
  for (const instance of config.integrations ?? []) {
    if (!instance.secrets) continue;
    for (const [key, value] of Object.entries(instance.secrets)) {
      if (value && value !== MASKED_SECRET) instance.secrets[key] = transform(value);
    }
  }
}

/** Admin view: secrets are replaced by a mask, so the form can show "already set". */
export function maskInstanceSecrets(config: Pick<DashboardConfig, 'integrations'>): void {
  for (const instance of config.integrations ?? []) {
    if (!instance.secrets) continue;
    for (const key of Object.keys(instance.secrets)) {
      if (instance.secrets[key]) instance.secrets[key] = MASKED_SECRET;
    }
  }
}

/** Non-admin view: no secret leaves the server. */
export function stripInstanceSecrets(config: Pick<DashboardConfig, 'integrations'>): void {
  for (const instance of config.integrations ?? []) delete instance.secrets;
}

/**
 * Creates or updates an instance. A secret sent back masked (or empty while
 * one is stored) keeps the stored value; `null` clears it explicitly.
 */
export function upsertInstance(
  config: Pick<DashboardConfig, 'integrations'>,
  update: { id?: string; type: string; name?: string; settings?: Record<string, string>; secrets?: Record<string, string | null> },
): IntegrationInstance {
  config.integrations ??= [];
  const existing = config.integrations.find(instance => update.id ? instance.id === update.id : instance.type === update.type);
  const instance: IntegrationInstance = existing ?? { id: update.id || `${update.type}-main`, type: update.type, name: update.name || update.type, settings: {} };
  if (update.name !== undefined) instance.name = update.name;
  if (update.settings) instance.settings = { ...instance.settings, ...update.settings };
  if (update.secrets) {
    const secrets = { ...(instance.secrets ?? {}) };
    for (const [key, value] of Object.entries(update.secrets)) {
      if (value === null) delete secrets[key];
      else if (value !== MASKED_SECRET && value !== '') secrets[key] = value;
    }
    instance.secrets = secrets;
  }
  instance.updatedAt = new Date().toISOString();
  if (!existing) config.integrations.push(instance);
  return instance;
}

interface LegacyTailscaleSettings {
  tailscaleTailnet?: string;
  tailscaleClientId?: string;
  tailscaleClientSecret?: string;
}

/**
 * Before integration instances, Tailscale credentials lived in `settings`.
 * Moves them into a `tailscale-main` instance (the secret keeps whatever form
 * it had on disk, encrypted or not). Returns true when something moved.
 */
export function migrateLegacyIntegrations(config: Pick<DashboardConfig, 'integrations'> & { settings?: object }): boolean {
  const settings = config.settings as LegacyTailscaleSettings | undefined;
  if (!settings) return false;
  const { tailscaleTailnet, tailscaleClientId, tailscaleClientSecret } = settings;
  const hadKeys = 'tailscaleTailnet' in settings || 'tailscaleClientId' in settings || 'tailscaleClientSecret' in settings;
  if (!hadKeys) return false;
  if ((tailscaleTailnet || tailscaleClientId || tailscaleClientSecret) && !findInstance(config, 'tailscale')) {
    config.integrations ??= [];
    config.integrations.push({
      id: 'tailscale-main',
      type: 'tailscale',
      name: 'Tailscale',
      settings: { tailnet: tailscaleTailnet ?? '', clientId: tailscaleClientId ?? '' },
      ...(tailscaleClientSecret ? { secrets: { clientSecret: tailscaleClientSecret } } : {}),
    });
  }
  delete settings.tailscaleTailnet;
  delete settings.tailscaleClientId;
  delete settings.tailscaleClientSecret;
  return true;
}
