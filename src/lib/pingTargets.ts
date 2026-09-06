import type { DashboardConfig } from './types';

export function normalizePingTarget(value: string): string | null {
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `http://${value}`;
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
    parsed.hash = '';
    return parsed.href;
  } catch {
    return null;
  }
}

export function collectConfiguredPingTargets(config: DashboardConfig): Set<string> {
  const targets = new Set<string>();
  const add = (value?: string) => {
    if (!value) return;
    const normalized = normalizePingTarget(value);
    if (normalized) targets.add(normalized);
  };

  config.devices?.forEach(device => {
    add(device.host);
    add(device.api?.url);
    add(device.api?.ip);
  });

  config.categories.forEach(category => {
    category.services.forEach(service => {
      add(service.localUrl);
      add(service.secondaryUrl);
      add(service.tailscaleUrl);
    });
  });

  return targets;
}

export function isConfiguredPingTarget(value: string, targets: Set<string>): boolean {
  return resolveConfiguredPingTarget(value, targets) !== null;
}

export function resolveConfiguredPingTarget(value: string, targets: Set<string>): string | null {
  const normalized = normalizePingTarget(value);
  if (!normalized) return null;

  // Return the value owned by the trusted configuration set. This keeps the
  // untrusted request parameter out of the network sink even when both strings
  // happen to be equal.
  return Array.from(targets).find(target => target === normalized) ?? null;
}
