import {
  createLocalDatabaseBackup,
  deleteLocalDocument,
  fetchCollectionFromLocalDatabase,
  flushLocalDatabaseWrites,
  syncCollectionToLocalDatabase,
  testLocalDatabaseConnection,
  transactLocalCollections,
  upsertLocalDocument,
} from "../../lib/localDatabase";
import { flushSqliteStorageBridge } from "../../lib/sqliteStorageBridge";
import type { CollectionTransaction, DatabaseGateway, DatabaseHealth } from "./types";
import { performanceMonitor } from "../performance";
import { tenantCollectionName, tenantTransactionCollections } from "../tenant";

export class LocalDatabaseGateway implements DatabaseGateway {
  private readonly inflightReads = new Map<string, Promise<unknown[]>>();
  async health(): Promise<DatabaseHealth> {
    return performanceMonitor.measure("database.health", async () => {
      const ok = await testLocalDatabaseConnection();
      return { ok, engine: "sqlite", checkedAt: new Date().toISOString() };
    });
  }

  async readCollection<T>(collection: string): Promise<T[]> {
    const scoped = tenantCollectionName(collection);
    const existing = this.inflightReads.get(scoped);
    if (existing) return (await existing) as T[];

    const read = performanceMonitor.measure(`database.read:${scoped}`, async () =>
      (await fetchCollectionFromLocalDatabase(scoped)) as T[]
    );
    this.inflightReads.set(scoped, read as Promise<unknown[]>);
    try { return await read; }
    finally {
      if (this.inflightReads.get(scoped) === read) this.inflightReads.delete(scoped);
    }
  }

  async replaceCollection<T>(collection: string, rows: T[]): Promise<void> {
    const scoped = tenantCollectionName(collection);
    await performanceMonitor.measure(`database.replace:${scoped}`, () => syncCollectionToLocalDatabase(scoped, rows));
  }

  async upsert<T>(collection: string, id: string, value: T): Promise<void> {
    const scoped = tenantCollectionName(collection);
    await performanceMonitor.measure(`database.upsert:${scoped}`, () => upsertLocalDocument(scoped, id, value));
  }

  async remove(collection: string, id: string): Promise<void> {
    const scoped = tenantCollectionName(collection);
    await performanceMonitor.measure(`database.remove:${scoped}`, () => deleteLocalDocument(scoped, id));
  }

  async transact(collections: CollectionTransaction): Promise<void> {
    await performanceMonitor.measure("database.transaction", () => transactLocalCollections(tenantTransactionCollections(collections)));
  }

  async flush(): Promise<void> {
    await Promise.all([flushLocalDatabaseWrites(), flushSqliteStorageBridge()]);
  }

  backup(): Promise<unknown> {
    return createLocalDatabaseBackup();
  }
}

export const databaseGateway = new LocalDatabaseGateway();
