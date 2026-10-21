import { expect, it, vi } from 'vitest';
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
