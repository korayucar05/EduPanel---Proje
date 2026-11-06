import { BaseService } from "../../core/services";
import { examRepository, ExamRepository } from "./ExamRepository";
import { EXAM_EVENTS } from "./examEvents";
import { assertValidExamCollection } from "./examValidation";
import type { ExamRecord } from "./examTypes";

export class ExamService extends BaseService<ExamRecord> {
  constructor(private readonly exams: ExamRepository = examRepository) {
    super(exams, "exam");
  }

  async replaceAll(exams: ExamRecord[]): Promise<ExamRecord[]> {
    assertValidExamCollection(exams);
    const saved = await this.exams.replaceAllAtomic(exams);
    this.cache.invalidatePrefix("exam:");
    await this.events.emit(EXAM_EVENTS.collectionReplaced, { count: saved.length });
    return saved;
  }

  async upsertIntoSnapshot(snapshot: ExamRecord[], exam: ExamRecord): Promise<ExamRecord[]> {
    const next = snapshot.some((item) => String(item.id) === String(exam.id))
      ? snapshot.map((item) => String(item.id) === String(exam.id) ? exam : item)
      : [...snapshot, exam];
    return this.replaceAll(next);
  }

  async removeFromSnapshot(snapshot: ExamRecord[], id: string): Promise<ExamRecord[]> {
    const next = snapshot.filter((item) => String(item.id) !== String(id));
    await this.replaceAll(next);
    await this.events.emit(EXAM_EVENTS.deleted, { id });
    return next;
  }
}

export const examService = new ExamService();
