import { cacheManager } from "../cache";
import { databaseGateway } from "../database";
import { logger } from "../logging";
import { performanceMonitor } from "../performance";

export type RuntimeStatus = "idle" | "starting" | "ready" | "degraded";

class HasatRuntime {
  private status: RuntimeStatus = "idle";
  private maintenanceTimer: ReturnType<typeof setInterval> | null = null;

  get currentStatus(): RuntimeStatus { return this.status; }

  async start(): Promise<RuntimeStatus> {
    if (this.status === "ready") return this.status;
    this.status = "starting";
    return performanceMonitor.measure("runtime.start", async () => {
      const health = await databaseGateway.health();
      this.status = health.ok ? "ready" : "degraded";
      this.startMaintenance();
      logger.info("Çekirdek çalışma zamanı başlatıldı.", { database: health.engine, status: this.status });
      return this.status;
    });
  }

  async flush(): Promise<void> {
    await performanceMonitor.measure("runtime.flush", () => databaseGateway.flush());
  }

  stop(): void {
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
    this.maintenanceTimer = null;
  }

  private startMaintenance(): void {
    if (this.maintenanceTimer || typeof window === "undefined") return;
    this.maintenanceTimer = setInterval(() => cacheManager.pruneExpired(), 60_000);
  }
}

export const hasatRuntime = new HasatRuntime();
