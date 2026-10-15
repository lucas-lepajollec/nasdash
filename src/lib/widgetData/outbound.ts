import { readBoundedResponseBytes, ResponseTooLargeError } from '@/lib/boundedResponse';
import type { SourceError } from './contracts';

/** No upstream error messages/URLs escape into logs or responses. */
export class WidgetFetchError extends Error {
  constructor(readonly key: string, readonly parameters?: Record<string, string | number>) {
    super(key);
  }
}
export function httpUrl(value: string, base?: string): URL {
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url;
  } catch { throw new WidgetFetchError('widgets.error.parse'); }
}
export function sourceError(source: string, error: unknown): SourceError {
  if (error instanceof WidgetFetchError) return { source, error: error.key, ...(error.parameters ? { parameters: error.parameters } : {}) };
  return { source, error: 'widgets.error.network' };
}

/** One deadline covers redirects AND streamed body reads. Never sends cookies/auth. */
export async function fetchBytes(value: string, maxBytes: number, maxRedirects = 3, truncate = false): Promise<{ bytes: Uint8Array; contentType: string; url: string }> {
  let url = httpUrl(value);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new WidgetFetchError('widgets.error.timeout'));
    }, 8000);
  });
  try {
    return await Promise.race([deadline, (async () => {
      for (let redirects = 0; ; redirects++) {
        const response = await fetch(url, {
          signal: controller.signal, redirect: 'manual', credentials: 'omit', cache: 'no-store',
          headers: { 'User-Agent': 'NasDash/1.0 (content widgets)', Accept: '*/*' },
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          await response.body?.cancel();
          const location = response.headers.get('location');
          if (!location || redirects >= maxRedirects) throw new WidgetFetchError('widgets.error.http', { status: response.status });
          url = httpUrl(location, url.href);
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new WidgetFetchError(response.status === 404 ? 'widgets.error.notFound' : 'widgets.error.http', { status: response.status });
        }
        return { bytes: await readBoundedResponseBytes(response, maxBytes, truncate), contentType: (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase(), url: url.href };
      }
    })()]);
  } catch (error) {
    if (error instanceof WidgetFetchError) throw error;
    if (error instanceof ResponseTooLargeError) throw new WidgetFetchError('widgets.error.tooLarge', { maxBytes });
    throw new WidgetFetchError(controller.signal.aborted ? 'widgets.error.timeout' : 'widgets.error.network');
  } finally { clearTimeout(timer); }
}
export async function fetchJson(value: string, maxBytes = 2 * 1024 * 1024): Promise<unknown> {
  const result = await fetchBytes(value, maxBytes);
  try { return JSON.parse(new TextDecoder().decode(result.bytes)); }
  catch { throw new WidgetFetchError('widgets.error.parse'); }
}
