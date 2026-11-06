import { cacheManager } from "../../core/cache";
import { eventBus } from "../../core/events";
import { examCalendarRepository, ExamCalendarRepository } from "./ExamCalendarRepository";
import { EXAM_EVENTS } from "./examEvents";
import { assertValidExamCalendar } from "./examValidation";
import type { ExamCalendarRecord } from "./examTypes";

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export interface SaveExamCalendarInput {
  id?: string;
  selectedTerm: string;
  selectedExamNo: string;
  startDate?: string;
  daysCount?: number;
  sessionsPerDay?: number;
  computedDates: unknown[];
  [key: string]: unknown;
}

export class ExamCalendarService {
  constructor(private readonly calendars: ExamCalendarRepository = examCalendarRepository) {}

  getId(term: string, examNo: string): string {
    const suffix = `${String(term || "").trim()}_${String(examNo || "").trim()}`;
    return sanitize(`calendar_${suffix}`);
  }

  async get(term: string, examNo: string): Promise<ExamCalendarRecord | null> {
    const id = this.getId(term, examNo);
    const key = `exam-calendar:${id}`;
    const cached = cacheManager.get<ExamCalendarRecord>(key);
    if (cached) return cached;
    const row = await this.calendars.findById(id);
    if (row) cacheManager.set(key, row, 30_000);
    return row;
  }

  async save(input: SaveExamCalendarInput): Promise<ExamCalendarRecord> {
    const record: ExamCalendarRecord = {
      ...input,
      id: input.id || this.getId(input.selectedTerm, input.selectedExamNo),
      selectedTerm: input.selectedTerm,
      selectedExamNo: input.selectedExamNo,
      computedDates: input.computedDates,
      updatedAt: new Date().toISOString(),
    };
    assertValidExamCalendar(record);
    await this.calendars.save(record);
    cacheManager.invalidatePrefix("exam-calendar:");
    await eventBus.emit(EXAM_EVENTS.calendarSaved, { id: record.id, sessionCount: record.computedDates.length });
    return record;
  }
}

export const examCalendarService = new ExamCalendarService();
