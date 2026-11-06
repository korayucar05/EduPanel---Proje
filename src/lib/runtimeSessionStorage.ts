/** Browser runtimeSessionStorage yerine kullanılan süreç içi oturum deposu. */
const memory = new Map<string, string>();
export const runtimeSessionStorage = {
  get length(): number { return memory.size; },
  getItem(key: string): string | null { const k=String(key); return memory.has(k) ? memory.get(k)! : null; },
  setItem(key: string, value: string): void { memory.set(String(key), String(value)); },
  removeItem(key: string): void { memory.delete(String(key)); },
  clear(): void { memory.clear(); },
  key(index: number): string | null { return Array.from(memory.keys())[index] ?? null; },
};

