import { ServiceError } from './services';

/** Bound decompressed public API bodies before parsing, including chunked responses. */
export async function publicJson(response: Response, maxBytes = 2 * 1024 * 1024): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new ServiceError('widgets.error.parse');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ServiceError('widgets.error.tooLarge'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ServiceError('widgets.error.parse'); }
}
