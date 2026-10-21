/**
 * Small in-memory cache for the content widgets' outbound requests (feeds,
 * quotes, DNS summaries…): one entry per key for `ttlMs`, concurrent callers
 * share the request in flight, and the oldest entries go first past `max`.
 * A failed load is not cached, but a stale value may be served while
 * `staleMs` allows (the source being down should not blank a widget).
 */

interface Entry<T> { value?: T; storedAt: number; pending?: Promise<T> }

export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number, private readonly max = 200, private readonly staleMs = 0) {}

  /** A caller may require fresher data while sharing the same identity and in-flight load. */
  async get(key: string, load: () => Promise<T>, now = Date.now(), ttlMs = this.ttlMs): Promise<T> {
    const entry = this.entries.get(key);
    if (entry?.value !== undefined && now - entry.storedAt < ttlMs) return entry.value;
    if (entry?.pending) return entry.pending;
    const pending = load().then(value => {
      this.entries.delete(key);
      this.entries.set(key, { value, storedAt: Date.now() });
      this.trim();
      return value;
    }, error => {
      const current = this.entries.get(key);
      if (current?.value !== undefined && Date.now() - current.storedAt < ttlMs + this.staleMs) {
        current.pending = undefined;
        return current.value;
      }
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, { ...(entry ?? { storedAt: 0 }), pending });
    return pending;
  }

  /** Forget one entry (after a change made through NasDash, e.g. a DNS toggle). */
  delete(key: string): void { this.entries.delete(key); }

  clear(): void { this.entries.clear(); }

  private trim() {
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
