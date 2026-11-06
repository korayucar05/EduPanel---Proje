export type PerformanceSample = { name: string; durationMs: number; timestamp: string };
export type PerformanceSummary = {
  name: string;
  count: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
};

export class PerformanceMonitor {
  private readonly samples: PerformanceSample[] = [];
  constructor(private readonly maxSamples = 500) {}

  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = this.now();
    try { return await operation(); }
    finally { this.record(name, this.now() - start); }
  }

  measureSync<T>(name: string, operation: () => T): T {
    const start = this.now();
    try { return operation(); }
    finally { this.record(name, this.now() - start); }
  }

  record(name: string, durationMs: number): void {
    this.samples.unshift({ name, durationMs: Math.max(0, durationMs), timestamp: new Date().toISOString() });
    if (this.samples.length > this.maxSamples) this.samples.length = this.maxSamples;
  }

  history(name?: string): readonly PerformanceSample[] {
    return name ? this.samples.filter((sample) => sample.name === name) : [...this.samples];
  }

  average(name: string): number { return this.summary(name).averageMs; }

  summary(name: string): PerformanceSummary {
    const values = this.samples.filter((sample) => sample.name === name).map((sample) => sample.durationMs);
    if (!values.length) return { name, count: 0, averageMs: 0, p95Ms: 0, maxMs: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return {
      name,
      count: values.length,
      averageMs: values.reduce((sum, value) => sum + value, 0) / values.length,
      p95Ms: sorted[p95Index] ?? 0,
      maxMs: sorted[sorted.length - 1] ?? 0,
    };
  }

  slowest(limit = 10): PerformanceSummary[] {
    const names = Array.from(new Set(this.samples.map((sample) => sample.name)));
    return names.map((name) => this.summary(name)).sort((a, b) => b.p95Ms - a.p95Ms).slice(0, limit);
  }

  clear(): void { this.samples.length = 0; }

  private now(): number {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }
}

export const performanceMonitor = new PerformanceMonitor();
