import { databaseGateway, type CollectionTransaction, type DatabaseGateway } from "../database";

export class TransactionManager {
  constructor(private readonly database: DatabaseGateway = databaseGateway) {}

  async run(collections: CollectionTransaction): Promise<void> {
    const entries = Object.entries(collections);
    if (entries.length === 0) return;
    for (const [name, rows] of entries) {
      if (!name.trim()) throw new Error("Transaction koleksiyon adı boş olamaz.");
      if (!Array.isArray(rows)) throw new Error(`${name} için kayıt listesi bekleniyor.`);
    }
    await this.database.transact(collections);
  }
}

export const transactionManager = new TransactionManager();
