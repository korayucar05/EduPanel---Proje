import { databaseGateway } from "../../core/database";
import { transactionManager } from "../../core/transactions";

export const WELFARE_COLLECTIONS = [
  "behaviorRecords",
  "behaviorRecordHistory_v1",
  "disciplineWarnings",
  "disciplineBoardRecords",
  "disciplineArchiveRecords",
  "customBehaviors",
  "sanctions",
  "rewards",
  "welfareCases",
  "welfareCaseTimeline",
] as const;

export type WelfareCollection = typeof WELFARE_COLLECTIONS[number];

export class WelfareRepository {
  async read<T>(collection: WelfareCollection): Promise<T[]> {
    return databaseGateway.readCollection<T>(collection);
  }

  async replace<T>(collection: WelfareCollection, rows: T[]): Promise<T[]> {
    await transactionManager.run({ [collection]: rows });
    return rows;
  }

  async transact(collections: Partial<Record<WelfareCollection, unknown[]>>): Promise<void> {
    await transactionManager.run(collections as Record<string, unknown[]>);
  }
}

export const welfareRepository = new WelfareRepository();
