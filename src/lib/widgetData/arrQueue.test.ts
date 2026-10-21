import { describe, expect, it, vi } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import type { ArrQueueData } from '@/integrations/arr/collect';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
vi.mock('@/integrations/arr/collect', () => ({ collectArrQueue: vi.fn() }));
import { collectArrQueue } from '@/integrations/arr/collect';
import { arrQueue, invalidateArrQueue } from './arrQueue';

it('does not let a pre-action read replace the refreshed queue or its private id map', async () => {
  const instance: IntegrationInstance = { id: 'queue-revision', name: 'Fictional Sonarr', type: 'sonarr', settings: { url: 'https://sonarr.example.com' } };
  const before: ArrQueueData = { items: [], total: 1, downloads: new Map() };
  const after: ArrQueueData = { items: [], total: 2, downloads: new Map() };
  let release!: (data: ArrQueueData) => void;
  vi.mocked(collectArrQueue).mockReturnValueOnce(new Promise(resolve => { release = resolve; })).mockResolvedValue(after);
  const old = arrQueue(instance);
  invalidateArrQueue(instance);
  expect(await arrQueue(instance)).toBe(after);
  release(before); await old;
  expect(await arrQueue(instance)).toBe(after);
  expect(collectArrQueue).toHaveBeenCalledTimes(2);
});

describe('queue items with the download client state', () => {
  it('lets the client\'s live state win over the *arr\'s older one', async () => {
    const { withLiveState } = await import('./arrRoutes');
    const item = { id: 'radarr-1:7', source: 'radarr', sourceName: 'Radarr', kind: 'movie', title: 'Fictional', progress: 25, status: 'warning', message: 'Stalled', sizeBytes: 1000 } as const;
    expect(withLiveState({ ...item }, { id: 'abc', name: 'Fictional', progress: 32, state: 'paused', sizeBytes: 1000 })).toMatchObject({ progress: 32, status: 'paused', message: undefined, leftBytes: 680 });
    expect(withLiveState({ ...item }, { id: 'abc', name: 'Fictional', progress: 40, state: 'downloading', etaMs: 60000 })).toMatchObject({ status: 'downloading', etaMs: 60000 });
    expect(withLiveState({ ...item }, undefined)).toMatchObject({ status: 'warning', progress: 25 });
  });
});
