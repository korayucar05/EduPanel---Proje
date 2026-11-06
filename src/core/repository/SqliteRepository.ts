import { databaseGateway, type DatabaseGateway } from "../database";
import type { EntityId, EntityWithId, Repository } from "./types";

export class SqliteRepository<T extends EntityWithId> implements Repository<T> {
  constructor(
    readonly collection: string,
    protected readonly database: DatabaseGateway = databaseGateway,
  ) {}

  async findAll(): Promise<T[]> {
    return this.database.readCollection<T>(this.collection);
  }

  async findById(id: EntityId): Promise<T | null> {
    const rows = await this.findAll();
    return rows.find((row) => String(row.id) === String(id)) ?? null;
  }

  async save(entity: T): Promise<T> {
    await this.database.upsert(this.collection, String(entity.id), entity);
    return entity;
  }

  async saveMany(entities: T[]): Promise<T[]> {
    for (const entity of entities) await this.save(entity);
    return entities;
  }

  async delete(id: EntityId): Promise<void> {
    await this.database.remove(this.collection, String(id));
  }

  async replaceAll(entities: T[]): Promise<T[]> {
    await this.database.replaceCollection(this.collection, entities);
    return entities;
  }
}
