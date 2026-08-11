import { describe, expect, it, vi } from 'vitest';
import { fetchPingBatches, splitPingUrls } from './pingBatches';

describe('dashboard ping batching', () => {
  it('splits a large homelab into requests accepted by the API', () => {
    const urls = Array.from({ length: 121 }, (_, index) => `http://service-${index}.lan`);
    expect(splitPingUrls(urls).map(batch => batch.length)).toEqual([50, 50, 21]);
  });

  it('merges all batch responses without losing service statuses', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { urls: string[] };
      return Response.json(Object.fromEntries(body.urls.map(url => [url, {
        status: 'online',
        statusText: 'OK',
        latency: 5,
      }])));
    });
    const urls = Array.from({ length: 121 }, (_, index) => `http://service-${index}.lan`);

    const result = await fetchPingBatches(urls, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(Object.keys(result)).toHaveLength(121);
  });
});
