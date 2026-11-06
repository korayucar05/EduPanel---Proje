import { hasatDataStore } from "./hasatDataStore";
import { decisionTaskSyncService, type DecisionTaskSyncResult } from "./decisionTaskSync";

export type DecisionTaskStatus = "planned" | "in_progress" | "done";
export type DecisionTaskHorizon = "Şimdi" | "Bugün" | "Bu hafta";
export type DecisionTaskSyncStatus = "local" | "pending" | "synced" | "conflict";

export type DecisionTaskScope = {
  schoolId: string;
  userId: string;
  userName?: string;
};

export type DecisionTaskRecord = {
  id: string;
  decisionId: string;
  title: string;
  action: string;
  owner: string;
  horizon: DecisionTaskHorizon;
  targetTab: string;
  priority: number;
  status: DecisionTaskStatus;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  assignee: string;
  completedAt?: string;
  notes: string;
  completionEvidence: string;
  schoolId: string;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  syncStatus: DecisionTaskSyncStatus;
  serverUpdatedAt?: string;
};

export const DECISION_TASK_STORE_KEY = "management_decision_tasks";
export const LEGACY_DECISION_TASK_STORAGE_KEY = "hasat_dashboard_decision_tasks_v1";
export const DECISION_TASKS_CHANGED_EVENT = "hasat:decision-tasks-changed";

const safeScope = (scope?: Partial<DecisionTaskScope>): DecisionTaskScope => ({
  schoolId: String(scope?.schoolId || "school-main"),
  userId: String(scope?.userId || "system"),
  userName: String(scope?.userName || "Sistem"),
});

const scopedStoreKey = (scope: DecisionTaskScope) => `${DECISION_TASK_STORE_KEY}:${scope.schoolId}`;

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultDueDate = (horizon: DecisionTaskHorizon, base = new Date()) => {
  const date = new Date(base);
  if (horizon === "Bu hafta") date.setDate(date.getDate() + 7);
  return toDateInputValue(date);
};

const normalizeTask = (value: unknown, index: number, inputScope: DecisionTaskScope): DecisionTaskRecord | null => {
  if (!value || typeof value !== "object") return null;
  const task = value as Partial<DecisionTaskRecord>;
  const horizon: DecisionTaskHorizon = task.horizon === "Şimdi" || task.horizon === "Bugün" || task.horizon === "Bu hafta"
    ? task.horizon
    : "Bu hafta";
  const now = new Date().toISOString();
  return {
    id: String(task.id || `migrated-task-${index}-${Date.now()}`),
    decisionId: String(task.decisionId || task.id || `legacy-${index}`),
    title: String(task.title || "Adsız yönetim görevi"),
    action: String(task.action || ""),
    owner: String(task.owner || "Okul yönetimi"),
    horizon,
    targetTab: String(task.targetTab || "dashboard"),
    priority: Number.isFinite(Number(task.priority)) ? Number(task.priority) : 50,
    status: task.status === "in_progress" || task.status === "done" ? task.status : "planned",
    createdAt: String(task.createdAt || now),
    updatedAt: String(task.updatedAt || task.createdAt || now),
    dueDate: typeof task.dueDate === "string" && task.dueDate ? task.dueDate : defaultDueDate(horizon),
    assignee: typeof task.assignee === "string" ? task.assignee : "",
    completedAt: typeof task.completedAt === "string" && task.completedAt ? task.completedAt : undefined,
    notes: typeof task.notes === "string" ? task.notes : "",
    completionEvidence: typeof task.completionEvidence === "string" ? task.completionEvidence : "",
    schoolId: String(task.schoolId || inputScope.schoolId),
    createdBy: String(task.createdBy || inputScope.userId),
    createdByName: String(task.createdByName || inputScope.userName || "Sistem"),
    updatedBy: String(task.updatedBy || inputScope.userId),
    syncStatus: task.syncStatus === "synced" || task.syncStatus === "conflict" ? task.syncStatus : "pending",
    serverUpdatedAt: typeof task.serverUpdatedAt === "string" && task.serverUpdatedAt ? task.serverUpdatedAt : undefined,
  };
};

const normalizeTasks = (value: unknown, scope: DecisionTaskScope): DecisionTaskRecord[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((task, index) => normalizeTask(task, index, scope))
    .filter((task): task is DecisionTaskRecord => task !== null && task.schoolId === scope.schoolId)
    .slice(0, 500);
};

let writeQueue: Promise<unknown> = Promise.resolve();

const notifyChanged = (scope: DecisionTaskScope, count: number) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DECISION_TASKS_CHANGED_EVENT, { detail: { count, schoolId: scope.schoolId } }));
};

const writeScopedTasks = async (scope: DecisionTaskScope, tasks: DecisionTaskRecord[]) => {
  await hasatDataStore.write(scopedStoreKey(scope), tasks);
  notifyChanged(scope, tasks.length);
};

export const decisionTaskRepository = {
  async list(inputScope?: Partial<DecisionTaskScope>): Promise<DecisionTaskRecord[]> {
    const scope = safeScope(inputScope);
    const result = await hasatDataStore.read<DecisionTaskRecord[]>(scopedStoreKey(scope), {
      fallback: [],
      validate: Array.isArray,
    });
    let tasks = normalizeTasks(result.value, scope);

    // Sprint 2.11 ve daha eski sürümlerdeki global kayıtları kurum kapsamına bir kez taşır.
    if (tasks.length === 0) {
      const legacyResult = await hasatDataStore.read<DecisionTaskRecord[]>(DECISION_TASK_STORE_KEY, {
        fallback: [],
        validate: Array.isArray,
        legacyLocalStorageKey: LEGACY_DECISION_TASK_STORAGE_KEY,
        migrateLegacy: true,
      });
      tasks = normalizeTasks(legacyResult.value, scope).map((task) => ({
        ...task,
        schoolId: scope.schoolId,
        updatedBy: scope.userId,
        syncStatus: "pending" as const,
      }));
      if (tasks.length > 0) await hasatDataStore.write(scopedStoreKey(scope), tasks);
    }
    return tasks;
  },

  async replaceAll(tasks: DecisionTaskRecord[], inputScope?: Partial<DecisionTaskScope>): Promise<DecisionTaskRecord[]> {
    const scope = safeScope(inputScope);
    const now = new Date().toISOString();
    const normalized = normalizeTasks(tasks, scope).map((task) => ({
      ...task,
      schoolId: scope.schoolId,
      updatedBy: scope.userId,
      updatedAt: task.updatedAt || now,
      syncStatus: task.syncStatus === "synced" ? "pending" as const : task.syncStatus,
    }));
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(() => writeScopedTasks(scope, normalized));
    await writeQueue;
    return normalized;
  },

  async sync(inputScope?: Partial<DecisionTaskScope>): Promise<DecisionTaskSyncResult> {
    const scope = safeScope(inputScope);
    const localTasks = await this.list(scope);
    const result = await decisionTaskSyncService.sync(scope, localTasks);
    const normalized = normalizeTasks(result.tasks, scope).map((task) => ({ ...task, syncStatus: "synced" as const }));
    await writeScopedTasks(scope, normalized);
    return { ...result, tasks: normalized };
  },

  async remove(taskId: string, inputScope?: Partial<DecisionTaskScope>): Promise<void> {
    const scope = safeScope(inputScope);
    const current = await this.list(scope);
    const next = current.filter((task) => task.id !== taskId);
    await writeScopedTasks(scope, next);
    await decisionTaskSyncService.remove(scope, taskId);
  },

  subscribeRemote(inputScope: Partial<DecisionTaskScope> | undefined, listener: () => void, onError?: (error: Error) => void): () => void {
    return decisionTaskSyncService.subscribe(safeScope(inputScope), listener, onError);
  },

  subscribe(inputScope: Partial<DecisionTaskScope> | undefined, listener: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;
    const scope = safeScope(inputScope);
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ schoolId?: string }>).detail;
      if (!detail?.schoolId || detail.schoolId === scope.schoolId) listener();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LEGACY_DECISION_TASK_STORAGE_KEY) listener();
    };
    window.addEventListener(DECISION_TASKS_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DECISION_TASKS_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  },
};
