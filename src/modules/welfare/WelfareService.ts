import { cacheManager } from "../../core/cache";
import { eventBus } from "../../core/events";
import { logger } from "../../core/logging";
import { WELFARE_EVENTS } from "./welfareEvents";
import { WELFARE_COLLECTIONS, type WelfareCollection, WelfareRepository, welfareRepository } from "./WelfareRepository";
import type { WelfareCase, WelfareCaseStatus, WelfareCaseTimelineEvent } from "./WelfareCaseTypes";

type Entity = { id: string | number; caseId?: string; sourceRecordId?: string | number; [key: string]: unknown };
const keySet = new Set<string>(WELFARE_COLLECTIONS);
const uniqueById = <T extends Entity>(rows: T[]) => rows.filter((row, index) => rows.findIndex(x => String(x.id) === String(row.id)) === index);
const safeToken = (value: unknown) => String(value ?? "unknown").replace(/[^a-zA-Z0-9_-]+/g, "-");
const allowedTransitions: Record<WelfareCaseStatus, WelfareCaseStatus[]> = {
  behavior: ["warning", "preliminary", "archived"],
  warning: ["behavior", "archived"],
  preliminary: ["behavior", "guidance", "discipline", "archived"],
  guidance: ["preliminary", "discipline", "archived"],
  discipline: ["preliminary", "decision", "archived"],
  decision: ["discipline", "archived"],
  archived: ["warning", "discipline"],
};

export class WelfareService {
  private readonly log = logger.child("welfare");
  constructor(private readonly repo: WelfareRepository = welfareRepository) {}

  isDomainCollection(key: string): key is WelfareCollection { return keySet.has(key); }

  async readCollection<T>(collection: WelfareCollection): Promise<T[]> {
    const key = `welfare:${collection}`;
    const cached = cacheManager.get<T[]>(key);
    if (cached) return cached;
    return cacheManager.set(key, await this.repo.read<T>(collection), 15_000);
  }

  async writeCollection<T>(collection: WelfareCollection, rows: T[]): Promise<T[]> {
    if (collection === "behaviorRecords") {
      const [cases, timeline] = await Promise.all([
        this.repo.read<WelfareCase>("welfareCases"),
        this.repo.read<WelfareCaseTimelineEvent>("welfareCaseTimeline"),
      ]);
      const nextCases = [...cases];
      const nextTimeline = [...timeline];
      const normalized = (rows as Entity[]).map(row => {
        const caseId = this.resolveCaseId(row);
        if (!nextCases.some(item => item.id === caseId)) {
          const now = Date.now();
          nextCases.unshift({
            id: caseId, sourceRecordId: String(row.sourceRecordId || row.id),
            studentId: String(row.studentId || "") || undefined, studentName: String(row.studentName || "") || undefined,
            studentNumber: String(row.studentNumber || "") || undefined, studentClassroom: String(row.studentClassroom || "") || undefined,
            status: "behavior", createdAt: now, updatedAt: now,
          });
          nextTimeline.unshift({ id: `${caseId}-${now}-created`, caseId, to: "behavior", action: "Davranış kaydı oluşturuldu", at: now, recordId: String(row.id) });
        }
        return this.withCase(row, caseId);
      });
      await this.repo.transact({ behaviorRecords: normalized, welfareCases: nextCases, welfareCaseTimeline: nextTimeline });
      cacheManager.invalidatePrefix("welfare:");
      await eventBus.emit(WELFARE_EVENTS.collectionChanged, { collection, count: rows.length });
      return normalized as T[];
    }
    const saved = await this.repo.replace(collection, rows);
    cacheManager.invalidatePrefix("welfare:");
    await eventBus.emit(WELFARE_EVENTS.collectionChanged, { collection, count: rows.length });
    return saved;
  }

  private resolveCaseId(record: Entity): string {
    return record.caseId || `CASE-${safeToken(record.sourceRecordId || record.id)}`;
  }

  private async caseTransition(record: Entity, to: WelfareCaseStatus, action: string, note?: string): Promise<{ caseRecord: WelfareCase; timeline: WelfareCaseTimelineEvent[] }> {
    const [cases, timeline] = await Promise.all([
      this.readCollection<WelfareCase>("welfareCases"),
      this.readCollection<WelfareCaseTimelineEvent>("welfareCaseTimeline"),
    ]);
    const now = Date.now();
    const caseId = this.resolveCaseId(record);
    const existing = cases.find(row => row.id === caseId);
    const from = existing?.status;
    if (from && from !== to && !allowedTransitions[from].includes(to)) {
      throw new Error(`Geçersiz vaka geçişi: ${from} → ${to}`);
    }
    const caseRecord: WelfareCase = {
      id: caseId,
      sourceRecordId: String(record.sourceRecordId || record.id),
      studentId: String(record.studentId || "") || undefined,
      studentName: String(record.studentName || "") || undefined,
      studentNumber: String(record.studentNumber || "") || undefined,
      studentClassroom: String(record.studentClassroom || "") || undefined,
      status: to,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      ...(to === "archived" ? { closedAt: now, archiveSource: String(record.archiveSource || "") || undefined } : {}),
    };
    const event: WelfareCaseTimelineEvent = {
      id: `${caseId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      caseId,
      from,
      to,
      action,
      at: now,
      note,
      recordId: String(record.id),
    };
    return {
      caseRecord,
      timeline: [event, ...timeline],
    };
  }

  private withCase<T extends Entity>(record: T, caseId: string): T {
    return { ...record, caseId };
  }

  private async emitTransition(caseRecord: WelfareCase, action: string) {
    cacheManager.invalidatePrefix("welfare:");
    await eventBus.emit(WELFARE_EVENTS.caseTransitioned, { caseId: caseRecord.id, status: caseRecord.status, action });
  }

  async sendBehaviorToDiscipline(record: Entity, destination: "Uyarı Bildirimi" | "Ön İnceleme", extra: Record<string, unknown> = {}): Promise<void> {
    const [active, history, warnings, board, cases] = await Promise.all([
      this.readCollection<Entity>("behaviorRecords"),
      this.readCollection<Entity>("behaviorRecordHistory_v1"),
      this.readCollection<Entity>("disciplineWarnings"),
      this.readCollection<Entity>("disciplineBoardRecords"),
      this.readCollection<WelfareCase>("welfareCases"),
    ]);
    const status: WelfareCaseStatus = destination === "Uyarı Bildirimi" ? "warning" : "preliminary";
    const transition = await this.caseTransition(record, status, destination === "Uyarı Bildirimi" ? "Davranıştan uyarı bildirimine sevk" : "Davranıştan ön incelemeye sevk");
    const caseId = transition.caseRecord.id;
    const sent = this.withCase({ ...record, ...extra, notePrepared: true, sentTo: destination }, caseId);
    const nextActive = active.filter(row => String(row.id) !== String(record.id));
    const historyCopy = this.withCase({ ...sent, id: `${record.id}::${destination}`, sourceRecordId: record.id, historyDestination: destination }, caseId);
    const nextHistory = uniqueById([historyCopy, ...history] as Entity[]);
    const nextWarnings = destination === "Uyarı Bildirimi" ? uniqueById([sent, ...warnings]) : warnings;
    const nextBoard = destination === "Ön İnceleme" ? uniqueById([sent, ...board]) : board;
    const nextCases = [transition.caseRecord, ...cases.filter(row => row.id !== caseId)];
    await this.repo.transact({
      behaviorRecords: nextActive,
      behaviorRecordHistory_v1: nextHistory,
      disciplineWarnings: nextWarnings,
      disciplineBoardRecords: nextBoard,
      welfareCases: nextCases,
      welfareCaseTimeline: transition.timeline,
    });
    await this.emitTransition(transition.caseRecord, "sendBehaviorToDiscipline");
    await eventBus.emit(destination === "Ön İnceleme" ? WELFARE_EVENTS.sentToBoard : WELFARE_EVENTS.sentToWarning, sent);
  }

  async saveGuidance(recordId: string | number, guidanceData: Record<string, unknown>): Promise<Entity> {
    const [board, cases] = await Promise.all([
      this.readCollection<Entity>("disciplineBoardRecords"),
      this.readCollection<WelfareCase>("welfareCases"),
    ]);
    const index = board.findIndex(row => String(row.id) === String(recordId));
    if (index < 0) throw new Error("Rehberlik kaydı için disiplin vakası bulunamadı.");
    const current = board[index];
    const transition = await this.caseTransition(current, "guidance", "Rehberlik görüşmesi/raporu kaydedildi");
    const completedSteps = { ...((current.completedSteps as Record<string, boolean> | undefined) ?? {}), "Rehberlik Servisi Raporu": true };
    const updated = this.withCase({ ...current, completedSteps, rehberlikData: { ...((current.rehberlikData as Record<string, unknown> | undefined) ?? {}), ...guidanceData } }, transition.caseRecord.id);
    const next = board.slice(); next[index] = updated;
    const nextCases = [transition.caseRecord, ...cases.filter(row => row.id !== transition.caseRecord.id)];
    await this.repo.transact({ disciplineBoardRecords: next, welfareCases: nextCases, welfareCaseTimeline: transition.timeline });
    await this.emitTransition(transition.caseRecord, "saveGuidance");
    await eventBus.emit(WELFARE_EVENTS.guidanceSaved, updated);
    return updated;
  }

  async moveToDisciplineProcess(record: Entity): Promise<Entity> {
    const [board, cases] = await Promise.all([
      this.readCollection<Entity>("disciplineBoardRecords"),
      this.readCollection<WelfareCase>("welfareCases"),
    ]);
    const index = board.findIndex(row => String(row.id) === String(record.id));
    if (index < 0) throw new Error("Ön inceleme kaydı bulunamadı.");
    const transition = await this.caseTransition(board[index], "discipline", "Disiplin kuruluna sevk edildi");
    const completedSteps = { ...((board[index].completedSteps as Record<string, boolean> | undefined) ?? {}), "Disiplin Kuruluna Sevk": true };
    const updated = this.withCase({ ...board[index], completedSteps, disciplineStatus: "Disiplin Süreci" }, transition.caseRecord.id);
    const nextBoard = board.slice(); nextBoard[index] = updated;
    const nextCases = [transition.caseRecord, ...cases.filter(row => row.id !== transition.caseRecord.id)];
    await this.repo.transact({ disciplineBoardRecords: nextBoard, welfareCases: nextCases, welfareCaseTimeline: transition.timeline });
    await this.emitTransition(transition.caseRecord, "moveToDisciplineProcess");
    return updated;
  }

  async revertDisciplineProcess(record: Entity): Promise<Entity> {
    const [board, cases] = await Promise.all([
      this.readCollection<Entity>("disciplineBoardRecords"),
      this.readCollection<WelfareCase>("welfareCases"),
    ]);
    const index = board.findIndex(row => String(row.id) === String(record.id));
    if (index < 0) throw new Error("Disiplin süreci kaydı bulunamadı.");
    const current = { ...board[index] };
    delete current.disciplineStatus;
    const transition = await this.caseTransition(current, "preliminary", "Disiplin sürecinden ön incelemeye geri alındı");
    const updated = this.withCase(current, transition.caseRecord.id);
    const nextBoard = board.slice(); nextBoard[index] = updated;
    const nextCases = [transition.caseRecord, ...cases.filter(row => row.id !== transition.caseRecord.id)];
    await this.repo.transact({ disciplineBoardRecords: nextBoard, welfareCases: nextCases, welfareCaseTimeline: transition.timeline });
    await this.emitTransition(transition.caseRecord, "revertDisciplineProcess");
    return updated;
  }

  async saveDecision(recordId: string | number, studentKey: string, decisionData: Record<string, unknown>): Promise<Entity> {
    const [board, cases] = await Promise.all([
      this.readCollection<Entity>("disciplineBoardRecords"),
      this.readCollection<WelfareCase>("welfareCases"),
    ]);
    const index = board.findIndex(row => String(row.id) === String(recordId));
    if (index < 0) throw new Error("Disiplin kararı için vaka bulunamadı.");
    const current = board[index];
    const transition = await this.caseTransition(current, "decision", "Disiplin kurulu kararı kaydedildi");
    const completedSteps = { ...((current.completedSteps as Record<string, boolean> | undefined) ?? {}), "Karar": true };
    const kararData = { ...((current.kararData as Record<string, unknown> | undefined) ?? {}), [studentKey]: decisionData };
    const updated = this.withCase({ ...current, completedSteps, kararData }, transition.caseRecord.id);
    const nextBoard = board.slice(); nextBoard[index] = updated;
    const nextCases = [transition.caseRecord, ...cases.filter(row => row.id !== transition.caseRecord.id)];
    await this.repo.transact({ disciplineBoardRecords: nextBoard, welfareCases: nextCases, welfareCaseTimeline: transition.timeline });
    await this.emitTransition(transition.caseRecord, "saveDecision");
    await eventBus.emit(WELFARE_EVENTS.disciplineUpdated, updated);
    return updated;
  }

  async archiveCase(record: Entity, archiveSource: "Uyarı Bildirimi" | "Disiplin Süreci", archiveEntries: Entity[]): Promise<Entity[]> {
    const source: WelfareCollection = archiveSource === "Uyarı Bildirimi" ? "disciplineWarnings" : "disciplineBoardRecords";
    const [sourceRows, archiveRows, cases] = await Promise.all([
      this.readCollection<Entity>(source),
      this.readCollection<Entity>("disciplineArchiveRecords"),
      this.readCollection<WelfareCase>("welfareCases"),
    ]);
    const transition = await this.caseTransition({ ...record, archiveSource }, "archived", `${archiveSource} kaydı arşivlendi`);
    const entries = archiveEntries.map(row => this.withCase({ ...row, archiveSource }, transition.caseRecord.id));
    const nextSource = sourceRows.filter(row => String(row.id) !== String(record.id));
    const nextArchive = uniqueById([...entries, ...archiveRows]);
    const nextCases = [transition.caseRecord, ...cases.filter(row => row.id !== transition.caseRecord.id)];
    await this.repo.transact({ [source]: nextSource, disciplineArchiveRecords: nextArchive, welfareCases: nextCases, welfareCaseTimeline: transition.timeline });
    await this.emitTransition(transition.caseRecord, "archiveCase");
    return entries;
  }

  async restoreFromArchive(record: Entity, destination: "disciplineWarnings" | "disciplineBoardRecords", restoredRecord: Entity): Promise<Entity> {
    const [archiveRows, targetRows, cases] = await Promise.all([
      this.readCollection<Entity>("disciplineArchiveRecords"),
      this.readCollection<Entity>(destination),
      this.readCollection<WelfareCase>("welfareCases"),
    ]);
    const targetStatus: WelfareCaseStatus = destination === "disciplineWarnings" ? "warning" : "discipline";
    const transition = await this.caseTransition(record, targetStatus, "Arşivden aktif sürece geri yüklendi");
    const restored = this.withCase(restoredRecord, transition.caseRecord.id);
    const nextArchive = archiveRows.filter(row => String(row.id) !== String(record.id));
    const nextTarget = uniqueById([restored, ...targetRows]);
    const nextCases = [transition.caseRecord, ...cases.filter(row => row.id !== transition.caseRecord.id)];
    await this.repo.transact({ disciplineArchiveRecords: nextArchive, [destination]: nextTarget, welfareCases: nextCases, welfareCaseTimeline: transition.timeline });
    await this.emitTransition(transition.caseRecord, "restoreFromArchive");
    return restored;
  }

  async revertToBehavior(record: Entity, source: "disciplineWarnings" | "disciplineBoardRecords"): Promise<Entity> {
    const [sourceRows, active, cases] = await Promise.all([
      this.readCollection<Entity>(source),
      this.readCollection<Entity>("behaviorRecords"),
      this.readCollection<WelfareCase>("welfareCases"),
    ]);
    const restored: Entity = { ...record, notePrepared: false, messageSent: false };
    delete restored.boardReason; delete restored.warningCount; delete restored.sentTo; delete restored.disciplineStatus;
    const transition = await this.caseTransition(restored, "behavior", "Vaka davranış kayıtlarına geri gönderildi");
    const restoredWithCase = this.withCase(restored, transition.caseRecord.id);
    const nextSource = sourceRows.filter(row => String(row.id) !== String(record.id));
    const nextActive = uniqueById([restoredWithCase, ...active.filter(row => String(row.id) !== String(record.id))]);
    const nextCases = [transition.caseRecord, ...cases.filter(row => row.id !== transition.caseRecord.id)];
    await this.repo.transact({ [source]: nextSource, behaviorRecords: nextActive, welfareCases: nextCases, welfareCaseTimeline: transition.timeline });
    await this.emitTransition(transition.caseRecord, "revertToBehavior");
    await eventBus.emit(WELFARE_EVENTS.reverted, { id: record.id, source, caseId: transition.caseRecord.id });
    return restoredWithCase;
  }

  async getCaseTimeline(caseId: string): Promise<WelfareCaseTimelineEvent[]> {
    const rows = await this.readCollection<WelfareCaseTimelineEvent>("welfareCaseTimeline");
    return rows.filter(row => row.caseId === caseId).sort((a, b) => b.at - a.at);
  }
}

export const welfareService = new WelfareService();
