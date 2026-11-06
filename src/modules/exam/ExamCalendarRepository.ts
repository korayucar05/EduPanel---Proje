import { SqliteRepository } from "../../core/repository";
import type { ExamCalendarRecord } from "./examTypes";

export class ExamCalendarRepository extends SqliteRepository<ExamCalendarRecord> {
  constructor() {
    super("kelebekExamCalendars");
  }
}

export const examCalendarRepository = new ExamCalendarRepository();
