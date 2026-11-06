import { cacheManager, type CacheManager } from "../cache";
import { eventBus, type EventBus } from "../events";
import { logger, type Logger } from "../logging";
import type { EntityWithId, Repository } from "../repository";

export abstract class BaseService<T extends EntityWithId> {
  protected constructor(
    protected readonly repository: Repository<T>,
    protected readonly serviceName: string,
    protected readonly events: EventBus = eventBus,
    protected readonly cache: CacheManager = cacheManager,
    protected readonly log: Logger = logger.child(serviceName),
  ) {}

  async list(): Promise<T[]> {
    const cacheKey = `${this.serviceName}:all`;
    const cached = this.cache.get<T[]>(cacheKey);
    if (cached) return cached;
    const rows = await this.repository.findAll();
    return this.cache.set(cacheKey, rows, 30_000);
  }

  async get(id: string | number): Promise<T | null> { return this.repository.findById(id); }

  async save(entity: T): Promise<T> {
    const saved = await this.repository.save(entity);
    this.cache.invalidatePrefix(`${this.serviceName}:`);
    await this.events.emit(`${this.serviceName}.saved`, saved);
    return saved;
  }

  async remove(id: string | number): Promise<void> {
    await this.repository.delete(id);
    this.cache.invalidatePrefix(`${this.serviceName}:`);
    await this.events.emit(`${this.serviceName}.deleted`, { id });
  }
}
