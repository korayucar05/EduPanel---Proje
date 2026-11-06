export type EventPayload = unknown;
export type EventHandler<T = EventPayload> = (payload: T) => void | Promise<void>;

export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    const set = this.handlers.get(event) ?? new Set<EventHandler>();
    set.add(handler as EventHandler);
    this.handlers.set(event, set);
    return () => this.off(event, handler);
  }

  once<T>(event: string, handler: EventHandler<T>): () => void {
    const unsubscribe = this.on<T>(event, async (payload) => {
      unsubscribe();
      await handler(payload);
    });
    return unsubscribe;
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    const set = this.handlers.get(event);
    set?.delete(handler as EventHandler);
    if (set?.size === 0) this.handlers.delete(event);
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    const handlers = Array.from(this.handlers.get(event) ?? []);
    await Promise.all(handlers.map((handler) => Promise.resolve(handler(payload))));
  }

  async emitSafe<T>(event: string, payload: T, onError?: (error: unknown) => void): Promise<void> {
    const handlers = Array.from(this.handlers.get(event) ?? []);
    const results = await Promise.allSettled(handlers.map((handler) => Promise.resolve(handler(payload))));
    for (const result of results) if (result.status === "rejected") onError?.(result.reason);
  }

  listenerCount(event?: string): number {
    if (event) return this.handlers.get(event)?.size ?? 0;
    let count = 0;
    for (const handlers of this.handlers.values()) count += handlers.size;
    return count;
  }

  eventCount(): number { return this.handlers.size; }

  clear(event?: string): void {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
  }
}

export const eventBus = new EventBus();
