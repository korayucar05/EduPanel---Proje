export type EntityId = string | number;

export interface EntityWithId {
  id: EntityId;
}

export interface Repository<T extends EntityWithId> {
  findAll(): Promise<T[]>;
  findById(id: EntityId): Promise<T | null>;
  save(entity: T): Promise<T>;
  saveMany(entities: T[]): Promise<T[]>;
  delete(id: EntityId): Promise<void>;
  replaceAll(entities: T[]): Promise<T[]>;
}
