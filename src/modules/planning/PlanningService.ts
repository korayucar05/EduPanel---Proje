import { cacheManager } from "../../core/cache";
import { eventBus } from "../../core/events";
import { transactionManager } from "../../core/transactions";
import {
  planningPreferenceRepository,
  planningStateRepository,
  seatingPlanRepository,
  type PlanningStateRecord,
  type SeatingPlanRecord,
} from "./PlanningRepository";

const sanitize = (value: string) => String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
const key = (term: string, examNo: string) => `${sanitize(term)}_${sanitize(examNo)}`;

export const PLANNING_EVENTS = {
  stateSaved: "planning.stateSaved",
  seatingSaved: "planning.seatingSaved",
  sessionsSaved: "planning.sessionsSaved",
} as const;

export class PlanningService {
  // Aynı dönemin sınav planını eşzamanlı kaydetmek eski ders atamalarını ezebilir.
  private stateSaveChain: Promise<unknown> = Promise.resolve();

  getStateId(term: string, examNo: string) { return `planning_${key(term, examNo)}`; }
  getSeatingId(term: string, examNo: string, sessionIndex: number) { return `seating_${key(term, examNo)}_${sessionIndex}`; }

  async getState(term: string, examNo: string): Promise<PlanningStateRecord | null> {
    const id = this.getStateId(term, examNo);
    const cacheKey = `planning:${id}`;
    const cached = cacheManager.get<PlanningStateRecord>(cacheKey);
    if (cached) return cached;
    const row = await planningStateRepository.findById(id);
    if (row) cacheManager.set(cacheKey, row, 20_000);
    return row;
  }

  saveState(term: string, examNo: string, patch: Partial<PlanningStateRecord>): Promise<PlanningStateRecord> {
    const save = async (): Promise<PlanningStateRecord> => {
      const previous = await this.getState(term, examNo);
      const record: PlanningStateRecord = {
        ...(previous || {}),
        ...patch,
        id: this.getStateId(term, examNo),
        selectedTerm: term,
        selectedExamNo: examNo,
        updatedAt: new Date().toISOString(),
      };
      const rows = await planningStateRepository.findAll();
      const next = [...rows.filter(r => r.id !== record.id), record];
      await transactionManager.run({ examPlanningStates: next });
      cacheManager.invalidatePrefix("planning:");
      await eventBus.emit(PLANNING_EVENTS.stateSaved, { id: record.id });
      return record;
    };
    const pending = this.stateSaveChain.then(save, save);
    this.stateSaveChain = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async savePlans(term: string, examNo: string, savedPlans: any[], currentPlan?: any | null) {
    return this.saveState(term, examNo, { savedPlans, currentPlan: currentPlan ?? savedPlans[0] ?? null });
  }

  async saveCourseSettings(term: string, examNo: string, difficultCourses: any, excludedCourseNames: string[]) {
    return this.saveState(term, examNo, { difficultCourses, excludedCourseNames });
  }

  async getPreference<T = any>(id: string, fallback: T | null = null): Promise<T | null> {
    const row = await planningPreferenceRepository.findById(id);
    return (row?.value as T) ?? fallback;
  }

  async savePreference(id: string, value: any): Promise<void> {
    const rows = await planningPreferenceRepository.findAll();
    const record = { id: sanitize(id), value, updatedAt: new Date().toISOString() };
    await transactionManager.run({ examPlanningPreferences: [...rows.filter(r => r.id !== record.id), record] });
  }

  async getLastSelection(): Promise<{ selectedTerm?: string; selectedExamNo?: string } | null> {
    const row = await planningPreferenceRepository.findById("lastSelection");
    return row?.value || null;
  }

  async saveLastSelection(value: { selectedTerm: string; selectedExamNo: string }) {
    const rows = await planningPreferenceRepository.findAll();
    const record = { id: "lastSelection", value, updatedAt: new Date().toISOString() };
    await transactionManager.run({ examPlanningPreferences: [...rows.filter(r => r.id !== record.id), record] });
  }

  async getSeating(term: string, examNo: string, sessionIndex: number): Promise<any | null> {
    const row = await seatingPlanRepository.findById(this.getSeatingId(term, examNo, sessionIndex));
    return row?.config ?? null;
  }

  async saveSeating(term: string, examNo: string, sessionIndex: number, config: any): Promise<void> {
    const rows = await seatingPlanRepository.findAll();
    const record: SeatingPlanRecord = {
      id: this.getSeatingId(term, examNo, sessionIndex),
      selectedTerm: term,
      selectedExamNo: examNo,
      sessionIndex,
      config,
      updatedAt: new Date().toISOString(),
    };
    await transactionManager.run({ examSeatingPlans: [...rows.filter(r => r.id !== record.id), record] });
    await eventBus.emit(PLANNING_EVENTS.seatingSaved, { id: record.id, sessionIndex });
  }

  async getExamSessions(): Promise<any[]> {
    return ((await planningPreferenceRepository.findById("examSessions"))?.value as any[]) || [];
  }

  async saveExamSessions(value: any[]): Promise<void> {
    const rows = await planningPreferenceRepository.findAll();
    const record = { id: "examSessions", value, updatedAt: new Date().toISOString() };
    await transactionManager.run({ examPlanningPreferences: [...rows.filter(r => r.id !== record.id), record] });
    await eventBus.emit(PLANNING_EVENTS.sessionsSaved, { count: value.length });
  }

  async getUploadedQuestions(term: string, examNo: string): Promise<Record<string, any>> {
    const row = await planningPreferenceRepository.findById(`questions_${key(term, examNo)}`);
    return row?.value || {};
  }

  async saveUploadedQuestions(term: string, examNo: string, value: Record<string, any>): Promise<void> {
    const rows = await planningPreferenceRepository.findAll();
    const id = `questions_${key(term, examNo)}`;
    const record = { id, value, updatedAt: new Date().toISOString() };
    await transactionManager.run({ examPlanningPreferences: [...rows.filter(r => r.id !== id), record] });
  }
}

export const planningService = new PlanningService();
