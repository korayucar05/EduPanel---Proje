import type { EntityWithId } from "../../core/repository";

export interface ExamRecord extends EntityWithId {
  id: string;
  examName?: string;
  name?: string;
  publisherName?: string;
  examCode?: string;
  examDate?: string;
  examType?: string;
  gradeLevel?: string;
  examStatus?: string;
  targetClassrooms?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ExamCalendarRecord extends EntityWithId {
  id: string;
  selectedTerm: string;
  selectedExamNo: string;
  startDate?: string;
  daysCount?: number;
  sessionsPerDay?: number;
  computedDates: unknown[];
  updatedAt?: string;
  [key: string]: unknown;
}
