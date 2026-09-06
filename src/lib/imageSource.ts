const LOCAL_ORIGIN = 'http://nasdash.local';

/**
 * Accept image sources that a browser may safely load from an <img> element.
 * Scriptable and opaque schemes (javascript:, data:, blob:, file:, …) are
 * rejected. Local paths stay local and remote URLs must use HTTP(S).
 */
export function safeImageSource(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (value.startsWith('//')) return undefined;

  try {
    const parsed = new URL(value, LOCAL_ORIGIN);
    if (parsed.username || parsed.password) return undefined;

    if (parsed.origin === LOCAL_ORIGIN) {
      if (!value.startsWith('/') || value.startsWith('//')) return undefined;
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
