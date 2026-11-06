import { SqliteRepository } from "../../core/repository";
import { transactionManager, type TransactionManager } from "../../core/transactions";
import type { ExamRecord } from "./examTypes";

export class ExamRepository extends SqliteRepository<ExamRecord> {
  constructor(private readonly transactions: TransactionManager = transactionManager) {
    super("exams");
  }

  async replaceAllAtomic(exams: ExamRecord[]): Promise<ExamRecord[]> {
    await this.transactions.run({ exams });
    return exams;
  }
}

export const examRepository = new ExamRepository();
