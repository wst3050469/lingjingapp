export class NotificationDeduplicator {
  private cache = new Map<string, { count: number; timer: NodeJS.Timeout }>();
  private windowMs;

  constructor(windowMs = 30000) {
    this.windowMs = windowMs;
  }

  check(key: string): boolean {
    const existing = this.cache.get(key);
    if (existing) {
      existing.count++;
      return true;
    }

    const timer = setTimeout(() => {
      this.cache.delete(key);
    }, this.windowMs);

    this.cache.set(key, { count: 1, timer });
    return false;
  }

  getStats(key: string): { deduped: boolean; count: number } {
    const entry = this.cache.get(key);
    return { deduped: !!entry && entry.count > 1, count: entry?.count ?? 0 };
  }

  clear(): void {
    for (const [, entry] of this.cache) {
      clearTimeout(entry.timer);
    }
    this.cache.clear();
  }
}