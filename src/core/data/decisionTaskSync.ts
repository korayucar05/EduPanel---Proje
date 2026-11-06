import type { DecisionTaskRecord, DecisionTaskScope } from "./decisionTaskRepository";

export type DecisionTaskSyncResult = {
  tasks: DecisionTaskRecord[];
  uploaded: number;
  downloaded: number;
  conflicts: number;
  syncedAt: string;
};

const timestamp = (value?: string) => {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * e-Nstitü yerel-öncelikli çalışma modu.
 * Karar görevlerinde Firestore arka plan senkronizasyonu ve onSnapshot dinleyicileri
 * uygulama kararlılığı için devre dışıdır. SQLite/yerel depo tek çalışma kaynağıdır.
 */
export const decisionTaskSyncService = {
  async sync(scope: DecisionTaskScope, localTasks: DecisionTaskRecord[]): Promise<DecisionTaskSyncResult> {
    const syncedAt = new Date().toISOString();
    const tasks = localTasks
      .map((task) => ({
        ...task,
        schoolId: scope.schoolId,
        syncStatus: "synced" as const,
        serverUpdatedAt: task.serverUpdatedAt || syncedAt,
      }))
      .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt));

    return {
      tasks,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      syncedAt,
    };
  },

  async remove(_scope: DecisionTaskScope, _taskId: string): Promise<void> {
    // Yerel kayıt decisionTaskRepository tarafından silinir.
  },

  subscribe(
    _scope: DecisionTaskScope,
    _listener: () => void,
    _onError?: (error: Error) => void,
  ): () => void {
    // Firestore onSnapshot bilinçli olarak kapalıdır.
    return () => undefined;
  },
};
