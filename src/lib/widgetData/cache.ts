/**
 * Small in-memory cache for the content widgets' outbound requests (feeds,
 * quotes, DNS summaries…): one entry per key for `ttlMs`, concurrent callers
 * share the request in flight, and the oldest entries go first past `max`.
 * A failed load is not cached, but a stale value may be served while
 * `staleMs` allows (the source being down should not blank a widget).
 * With `revalidateMs`, an expired value younger than that is still answered
 * at once while it is refreshed in the background (slow, paced sources).
 */

interface Entry<T> { value?: T; storedAt: number; pending?: Promise<T> }

export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number, private readonly max = 200, private readonly staleMs = 0, private readonly revalidateMs = 0) {}

  /** A caller may require fresher data while sharing the same identity and in-flight load. */
  async get(key: string, load: () => Promise<T>, now = Date.now(), ttlMs = this.ttlMs): Promise<T> {
    const entry = this.entries.get(key);
    if (entry?.value !== undefined && now - entry.storedAt < ttlMs) return entry.value;
    if (entry?.value !== undefined && now - entry.storedAt < ttlMs + this.revalidateMs) {
      // One refresh behind; every caller meanwhile gets the value in hand.
      if (!entry.pending) this.load(key, load, ttlMs, entry).catch(() => undefined);
      return entry.value;
    }
    if (entry?.pending) return entry.pending;
    return this.load(key, load, ttlMs, entry);
  }

  private load(key: string, load: () => Promise<T>, ttlMs: number, entry: Entry<T> | undefined): Promise<T> {
    const pending: Promise<T> = load().then(value => {
      // A control action or eviction may have invalidated this in-flight read.
      if (this.entries.get(key)?.pending !== pending) return value;
      this.entries.delete(key);
      this.entries.set(key, { value, storedAt: Date.now() });
      this.trim();
      return value;
    }, error => {
      const current = this.entries.get(key);
      if (current?.pending !== pending) throw error;
      if (current?.value !== undefined && Date.now() - current.storedAt < ttlMs + Math.max(this.staleMs, this.revalidateMs)) {
        current.pending = undefined;
        return current.value;
      }
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, { ...(entry ?? { storedAt: 0 }), pending });
    this.trim();
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
