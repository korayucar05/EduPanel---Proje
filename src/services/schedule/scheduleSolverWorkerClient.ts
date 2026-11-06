import { runOptimizationSolver, type SolverConfig, type SolverResult } from "../../utils/schedulingSolvers";
import type { Classroom, Course, Teacher } from "../../types";
export interface WorkerSolverPayload { config: SolverConfig; currentSchedule: Record<string, any>; classrooms: Classroom[]; teachers: Teacher[]; courses: Course[]; unwantedTeacherDays: Record<string, string[]>; }
export interface WorkerProgress {
  progress: number;
  unplacedCount: number;
  unplacedDetails: any[];
  partialSchedule?: Record<string, any>;
}
export class ScheduleSolverWorkerClient {
  private worker: Worker | null = null;
  private activeRequestId = "";
  constructor() { if (typeof Worker !== "undefined") this.worker = new Worker(new URL("../../workers/scheduleSolver.worker.ts", import.meta.url), { type: "module" }); }
  async run(payload: WorkerSolverPayload, onProgress?: (value: WorkerProgress) => void): Promise<SolverResult> {
    if (!this.worker) return runOptimizationSolver(payload.config, payload.currentSchedule, payload.classrooms, payload.teachers, payload.courses, payload.unwantedTeacherDays, {
      onProgress: (progress, unplacedCount, unplacedDetails, partialSchedule) =>
        onProgress?.({ progress, unplacedCount, unplacedDetails, partialSchedule }),
    });
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`; this.activeRequestId = requestId;
    return new Promise<SolverResult>((resolve, reject) => {
      const worker = this.worker!;

      const cleanup = () => {
        worker.removeEventListener("message", handler);
        worker.removeEventListener("error", errorHandler);
        worker.removeEventListener("messageerror", messageErrorHandler);
      };

      const fallbackToMainThread = (reason: string) => {
        cleanup();
        try { worker.terminate(); } catch {}
        this.worker = null;

        // Instant mod küçük sınıf problemleri için event-loop'a düzenli nefes verir;
        // worker çökerse ana thread'de güvenli fallback çalıştırılabilir.
        runOptimizationSolver(
          payload.config,
          payload.currentSchedule,
          payload.classrooms,
          payload.teachers,
          payload.courses,
          payload.unwantedTeacherDays,
          {
            onProgress: (progress, unplacedCount, unplacedDetails, partialSchedule) =>
              onProgress?.({ progress, unplacedCount, unplacedDetails, partialSchedule }),
          },
        ).then(resolve).catch((error) =>
          reject(new Error(`${reason} Ana-thread fallback da başarısız: ${error?.message || error}`)),
        );
      };

      const errorHandler = (event: ErrorEvent) => {
        fallbackToMainThread(`Web Worker çalıştırılamadı: ${event.message || "bilinmeyen hata"}.`);
      };

      const messageErrorHandler = () => {
        fallbackToMainThread("Web Worker mesajı okunamadı.");
      };

      const handler = (event: MessageEvent<any>) => {
        const message = event.data || {};
        if (message.requestId !== requestId) return;

        if (message.type === "progress") {
          onProgress?.({
            progress: message.progress,
            unplacedCount: message.unplacedCount,
            unplacedDetails: message.unplacedDetails || [],
            partialSchedule: message.partialSchedule,
          });
          return;
        }

        cleanup();
        if (message.type === "result") resolve(message.result);
        else reject(new Error(message.error || "Web Worker çözücü hatası"));
      };

      worker.addEventListener("message", handler);
      worker.addEventListener("error", errorHandler);
      worker.addEventListener("messageerror", messageErrorHandler);
      worker.postMessage({ type: "start", requestId, payload });
    });
  }
  pause() { this.worker?.postMessage({ type: "pause", requestId: this.activeRequestId }); }
  resume() { this.worker?.postMessage({ type: "resume", requestId: this.activeRequestId }); }
  cancel() { this.worker?.postMessage({ type: "cancel", requestId: this.activeRequestId }); }
  terminate() { this.worker?.terminate(); this.worker = null; }
}
