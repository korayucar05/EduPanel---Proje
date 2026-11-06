export type ScheduleViewType = "class" | "teacher";
export type ScheduleAlgorithm =
  | "smart-full"
  | "hybrid"
  | "ortools"
  | "backtracking"
  | "korayucar"
  | "korayucarv3"
  | "korayucardraft";
export type ScheduleScope = "local" | "global";
export type ScheduleData = Record<string, unknown>;

export interface SolverResult {
  success: boolean;
  reasons?: string[];
  courseName?: string;
  details?: string;
}

export interface UnplacedInfo {
  count: number;
  details: any[];
}

/** Read-only state shape used by reusable Zustand selectors. */
export interface ScheduleStateSnapshot {
  scheduleData: ScheduleData;
  viewType: ScheduleViewType;
  selectedId: string;
  selectedAlgorithm: ScheduleAlgorithm;
  selectedScope: ScheduleScope;
  solverRunning: boolean;
  solverPaused: boolean;
  solverProgress: number;
  solverResult: SolverResult | null;
  unplacedInfo: UnplacedInfo;
}
