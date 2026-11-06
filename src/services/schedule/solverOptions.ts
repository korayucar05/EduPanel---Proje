import type { ScheduleAlgorithm } from "../../types/schedule";

export interface SolverOption {
  value: ScheduleAlgorithm;
  label: string;
}

export const SOLVER_OPTIONS: SolverOption[] = [
  { value: "smart-full", label: "Akıllı Tam Dağıtım" },
];

export function getSolverLabel(algorithm: ScheduleAlgorithm): string {
  return SOLVER_OPTIONS.find((option) => option.value === algorithm)?.label ?? algorithm;
}
