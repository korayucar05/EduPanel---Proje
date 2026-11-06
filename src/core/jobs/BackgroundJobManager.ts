export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobRecord = {
  id: string;
  name: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};

export class BackgroundJobManager {
  private readonly jobs = new Map<string, JobRecord>();
  private chain: Promise<void> = Promise.resolve();

  enqueue<T>(name: string, task: () => Promise<T>): { id: string; result: Promise<T> } {
    const id = `JOB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
    const record: JobRecord = { id, name, status: "queued", createdAt: new Date().toISOString() };
    this.jobs.set(id, record);

    let resolveResult!: (value: T) => void;
    let rejectResult!: (reason?: unknown) => void;
    const result = new Promise<T>((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });

    this.chain = this.chain.catch(() => undefined).then(async () => {
      record.status = "running";
      record.startedAt = new Date().toISOString();
      try {
        const value = await task();
        record.status = "completed";
        record.finishedAt = new Date().toISOString();
        resolveResult(value);
      } catch (error) {
        record.status = "failed";
        record.finishedAt = new Date().toISOString();
        record.error = error instanceof Error ? error.message : String(error);
        rejectResult(error);
      }
    });

    return { id, result };
  }

  get(id: string): JobRecord | undefined { return this.jobs.get(id); }
  list(): JobRecord[] { return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async flush(): Promise<void> { await this.chain.catch(() => undefined); }
  clearCompleted(): void {
    for (const [id, job] of this.jobs) if (job.status === "completed" || job.status === "failed") this.jobs.delete(id);
  }
}

export const backgroundJobs = new BackgroundJobManager();
