import { SqliteRepository } from "../../core/repository";

export interface PlanningStateRecord {
  id: string;
  selectedTerm: string;
  selectedExamNo: string;
  savedPlans?: any[];
  difficultCourses?: any;
  excludedCourseNames?: string[];
  currentPlan?: any | null;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SeatingPlanRecord {
  id: string;
  selectedTerm: string;
  selectedExamNo: string;
  sessionIndex: number;
  config: any;
  updatedAt?: string;
}

export interface PlanningPreferenceRecord {
  id: string;
  value: any;
  updatedAt?: string;
}

export class PlanningStateRepository extends SqliteRepository<PlanningStateRecord> {
  constructor() { super("examPlanningStates"); }
}
export class SeatingPlanRepository extends SqliteRepository<SeatingPlanRecord> {
  constructor() { super("examSeatingPlans"); }
}
export class PlanningPreferenceRepository extends SqliteRepository<PlanningPreferenceRecord> {
  constructor() { super("examPlanningPreferences"); }
}

export const planningStateRepository = new PlanningStateRepository();
export const seatingPlanRepository = new SeatingPlanRepository();
export const planningPreferenceRepository = new PlanningPreferenceRepository();
