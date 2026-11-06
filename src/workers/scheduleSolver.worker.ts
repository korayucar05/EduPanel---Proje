/// <reference lib="webworker" />
import { runOptimizationSolver } from "../utils/schedulingSolvers";
let paused = false;
let cancelled = false;
self.onmessage = async (event: MessageEvent<any>) => {
  const message = event.data || {};
  if (message.type === "pause") { paused = true; return; }
  if (message.type === "resume") { paused = false; return; }
  if (message.type === "cancel") { cancelled = true; paused = false; return; }
  if (message.type !== "start") return;
  paused = false; cancelled = false;
  const { requestId, payload } = message;
  try {
    // Worker'ın gerçekten başladığını ana ekrana anında bildir.
    self.postMessage({
      type: "progress",
      requestId,
      progress: 0,
      unplacedCount: 0,
      unplacedDetails: [],
      partialSchedule: payload.currentSchedule,
    });

    const result = await runOptimizationSolver(payload.config, payload.currentSchedule, payload.classrooms, payload.teachers, payload.courses, payload.unwantedTeacherDays, {
      onProgress: (progress, unplacedCount, unplacedDetails, partialSchedule) =>
        self.postMessage({
          type: "progress",
          requestId,
          progress,
          unplacedCount,
          unplacedDetails,
          partialSchedule,
        }),
      shouldPause: () => paused,
      shouldCancel: () => cancelled,
    });
    self.postMessage({ type: "result", requestId, result });
  } catch (error: any) {
    self.postMessage({ type: "error", requestId, error: error?.message || String(error) });
  }
};
export {};
