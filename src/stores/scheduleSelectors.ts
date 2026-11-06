import type { ScheduleStateSnapshot } from "../types/schedule";

/** Stable, reusable selectors prevent components from subscribing to unrelated store fields. */
export const selectScheduleView = (state: ScheduleStateSnapshot) => ({
  viewType: state.viewType,
  selectedId: state.selectedId,
});

export const selectSolverStatus = (state: ScheduleStateSnapshot) => ({
  solverRunning: state.solverRunning,
  solverPaused: state.solverPaused,
  solverProgress: state.solverProgress,
  solverResult: state.solverResult,
  unplacedInfo: state.unplacedInfo,
});

export const selectSolverConfiguration = (state: ScheduleStateSnapshot) => ({
  selectedAlgorithm: state.selectedAlgorithm,
  selectedScope: state.selectedScope,
});
