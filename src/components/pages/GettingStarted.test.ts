import { describe, expect, it } from 'vitest';
import type { DashboardConfig } from '@/lib/types';
import { isUnconfigured, startingSteps } from './GettingStarted';

const base = { categories: [], devices: [], dockerHosts: [], integrations: [], settings: {} } as unknown as DashboardConfig;

describe('first steps', () => {
  it('starts with nothing done on a new dashboard', () => {
    expect(startingSteps(base).every(step => !step.done)).toBe(true);
    expect(isUnconfigured(base)).toBe(true);
  });

  it('ticks each step from the configuration', () => {
    const config = {
      ...base,
      categories: [{ id: 'c', title: 'Apps', services: [{ id: 's', name: 'Jellyfin', logo: '' }] }],
      integrations: [{ id: 'glances-1', type: 'glances', name: 'NAS', settings: {} }],
      devices: [{ id: 'd', name: 'NAS' }],
      dockerHosts: [{ id: 'h', name: 'Docker' }],
      settings: { weatherLocations: [{ id: 'p', lat: 0, lon: 0, name: 'Paris' }], theme: 'nord' },
    } as unknown as DashboardConfig;
    expect(startingSteps(config).map(step => step.done)).toEqual([true, true, true, true, true, true]);
    expect(isUnconfigured(config)).toBe(false);
  });

  it('does not count an empty category or the default theme', () => {
    const config = { ...base, categories: [{ id: 'c', title: 'Apps', services: [] }], settings: { theme: 'nasdash' } } as unknown as DashboardConfig;
    const steps = Object.fromEntries(startingSteps(config).map(step => [step.id, step.done]));
    expect(steps.services).toBe(false);
    expect(steps.look).toBe(false);
  });
});
