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
  const normalized = normalizePingTarget(value);
  return normalized !== null && targets.has(normalized);
}
