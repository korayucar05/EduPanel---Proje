import { cacheManager } from "../cache";
import { databaseGateway } from "../database";
import { eventBus } from "../events";
import { performanceMonitor, type PerformanceSummary } from "../performance";

export type SystemHealthSnapshot = {
  checkedAt: string;
  database: { ok: boolean; engine: string };
  cache: ReturnType<typeof cacheManager.stats>;
  events: { listeners: number; eventTypes: number };
  performance: { slowest: PerformanceSummary[] };
  memory?: { usedMB: number; totalMB: number; limitMB: number };
};

class SystemHealthService {
  async snapshot(): Promise<SystemHealthSnapshot> {
    const database = await databaseGateway.health();
    return {
      checkedAt: new Date().toISOString(),
      database: { ok: database.ok, engine: database.engine },
      cache: cacheManager.stats(),
      events: { listeners: eventBus.listenerCount(), eventTypes: eventBus.eventCount() },
      performance: { slowest: performanceMonitor.slowest(10) },
      memory: this.browserMemory(),
    };
  }

  prune(): void {
    cacheManager.pruneExpired();
  }

  private browserMemory(): SystemHealthSnapshot["memory"] {
    if (typeof performance === "undefined") return undefined;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (!memory) return undefined;
    const mb = 1024 * 1024;
    return {
      usedMB: memory.usedJSHeapSize / mb,
      totalMB: memory.totalJSHeapSize / mb,
      limitMB: memory.jsHeapSizeLimit / mb,
    };
  }
}

export const systemHealthService = new SystemHealthService();
