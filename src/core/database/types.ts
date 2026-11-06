export type DatabaseHealth = {
  ok: boolean;
  engine: string;
  path?: string;
  checkedAt: string;
};

export type CollectionTransaction = Record<string, unknown[]>;

export interface DatabaseGateway {
  health(): Promise<DatabaseHealth>;
  readCollection<T>(collection: string): Promise<T[]>;
  replaceCollection<T>(collection: string, rows: T[]): Promise<void>;
  upsert<T>(collection: string, id: string, value: T): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
  transact(collections: CollectionTransaction): Promise<void>;
  flush(): Promise<void>;
  backup(): Promise<unknown>;
}
