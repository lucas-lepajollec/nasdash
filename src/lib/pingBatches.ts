export const PING_BATCH_SIZE = 50;
const PING_BATCH_CONCURRENCY = 2;

export interface PingStatus {
  status: string;
  statusText: string;
  latency: number;
}

type PingResultMap = Record<string, PingStatus>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function splitPingUrls(urls: string[]): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < urls.length; index += PING_BATCH_SIZE) {
    batches.push(urls.slice(index, index + PING_BATCH_SIZE));
  }
  return batches;
}

export async function fetchPingBatches(urls: string[], fetcher: Fetcher = fetch): Promise<PingResultMap> {
  const batches = splitPingUrls(urls);
  const merged: PingResultMap = {};

  for (let index = 0; index < batches.length; index += PING_BATCH_CONCURRENCY) {
    const wave = batches.slice(index, index + PING_BATCH_CONCURRENCY);
    const responses = await Promise.all(wave.map(batch => fetcher('/api/ping/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: batch }),
    })));

    for (const response of responses) {
      if (!response.ok) {
        throw new Error(`Batch ping failed with status ${response.status}`);
      }
      Object.assign(merged, await response.json() as PingResultMap);
    }
  }

  return merged;
}
