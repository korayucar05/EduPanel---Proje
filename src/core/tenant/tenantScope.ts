import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";

const TENANT_SCOPE_KEY = "edupanel_active_school_scope";
const DEFAULT_SCHOOL_ID = "school-main";

const sanitize = (value: string) => String(value || DEFAULT_SCHOOL_ID)
  .trim()
  .replace(/[^a-zA-Z0-9._-]+/g, "_") || DEFAULT_SCHOOL_ID;

export function setActiveSchoolScope(schoolId: string | null | undefined) {
  const normalized = sanitize(String(schoolId || DEFAULT_SCHOOL_ID));
  runtimeSessionStorage.setItem(TENANT_SCOPE_KEY, normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("edupanel-school-scope-changed", { detail: { schoolId: normalized } }));
  }
  return normalized;
}

export function getActiveSchoolScope(): string {
  return sanitize(runtimeSessionStorage.getItem(TENANT_SCOPE_KEY) || DEFAULT_SCHOOL_ID);
}

/**
 * Ordu Lisesi'nin mevcut verilerini kırmamak için school-main eski koleksiyon
 * adlarını kullanmaya devam eder. Diğer okullar ayrı namespace'e yazılır.
 */
export function tenantCollectionName(collection: string): string {
  if (!collection || collection.startsWith("school__")) return collection;
  const schoolId = getActiveSchoolScope();
  if (schoolId === DEFAULT_SCHOOL_ID) return collection;
  return `school__${schoolId}__${collection}`;
}

export function tenantTransactionCollections(collections: Record<string, unknown[]>): Record<string, unknown[]> {
  return Object.fromEntries(Object.entries(collections).map(([key, rows]) => [tenantCollectionName(key), rows]));
}
