type CacheEntry<T> = { value: T; expiresAt: number | null; lastAccessedAt: number };

export type CacheStats = {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
};

export class CacheManager {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private readonly maxEntries = 500) {}

  set<T>(key: string, value: T, ttlMs?: number): T {
    const now = Date.now();
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: ttlMs ? now + ttlMs : null, lastAccessedAt: now });
    this.enforceLimit();
    return value;
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    entry.lastAccessedAt = Date.now();
    // Map insertion order is used as a cheap LRU queue.
    this.entries.delete(key);
    this.entries.set(key, entry as CacheEntry<unknown>);
    return entry.value;
  }

  has(key: string): boolean { return this.get(key) !== undefined; }
  delete(key: string): void { this.entries.delete(key); }
  clear(): void { this.entries.clear(); }
  invalidatePrefix(prefix: string): void {
    for (const key of Array.from(this.entries.keys())) if (key.startsWith(prefix)) this.entries.delete(key);
  }

  pruneExpired(now = Date.now()): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: total ? this.hits / total : 0,
    };
  }

  get size(): number { return this.entries.size; }

  private enforceLimit(): void {
    this.pruneExpired();
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
      this.evictions += 1;
    }
  }
}

export const cacheManager = new CacheManager();
