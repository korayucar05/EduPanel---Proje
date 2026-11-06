import { hasatDataStore } from './hasatDataStore';

export type ManagementDecisionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type ManagementDecisionParticipant = {
  id: string;
  name: string;
  role: string;
};
export type ManagementDecisionSignature = {
  userId: string;
  userName: string;
  signedAt: string;
};
export type ManagementDecisionRecipient = {
  id: string;
  userId?: string;
  name: string;
  role: string;
  deliveredAt: string;
  viewedAt?: string;
  acknowledgedAt?: string;
  acknowledgementDueAt?: string;
  lastReminderAt?: string;
  reminderCount?: number;
  escalatedAt?: string;
  escalationLevel?: 0 | 1 | 2;
  escalationNote?: string;
};
export type ManagementDecisionItem = {
  id: string;
  title: string;
  decision: string;
  owner: string;
  dueDate: string;
  notificationId?: string;
  taskId?: string;
};
export type ManagementDecisionRecord = {
  id: string;
  schoolId: string;
  period: 'daily' | 'weekly';
  meetingDate: string;
  title: string;
  items: ManagementDecisionItem[];
  notes: string;
  status: ManagementDecisionStatus;
  revision: number;
  rootRecordId: string;
  revisedFromId?: string;
  supersededById?: string;
  participants: ManagementDecisionParticipant[];
  signatures: ManagementDecisionSignature[];
  recipients: ManagementDecisionRecipient[];
  distributedAt?: string;
  distributedBy?: string;
  distributedByName?: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  lockedAt?: string;
  rejectionNote?: string;
};

const key = (schoolId: string) => `management_decision_minutes_v1:${schoolId || 'school-main'}`;
export const MANAGEMENT_DECISIONS_CHANGED_EVENT = 'hasat:management-decisions-changed';
const notify = (schoolId: string) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MANAGEMENT_DECISIONS_CHANGED_EVENT, { detail: { schoolId } }));
};

const normalize = (item: ManagementDecisionRecord): ManagementDecisionRecord => ({
  ...item,
  revision: Math.max(1, Number(item.revision || 1)),
  rootRecordId: item.rootRecordId || item.id,
  participants: Array.isArray(item.participants) ? item.participants : [],
  signatures: Array.isArray(item.signatures) ? item.signatures : [],
  recipients: Array.isArray(item.recipients) ? item.recipients.map((recipient) => ({
    ...recipient,
    reminderCount: Math.max(0, Number(recipient.reminderCount || 0)),
    escalationLevel: (Number(recipient.escalationLevel || 0) >= 2 ? 2 : Number(recipient.escalationLevel || 0) >= 1 ? 1 : 0) as 0 | 1 | 2,
    acknowledgementDueAt: recipient.acknowledgementDueAt || new Date(new Date(recipient.deliveredAt || item.distributedAt || item.createdAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  })) : [],
  lockedAt: item.lockedAt || (item.status === 'approved' ? item.approvedAt : undefined),
});

const immutableSnapshot = (record: ManagementDecisionRecord) => JSON.stringify({
  schoolId: record.schoolId,
  period: record.period,
  meetingDate: record.meetingDate,
  title: record.title,
  items: record.items,
  notes: record.notes,
  status: record.status,
  revision: record.revision,
  rootRecordId: record.rootRecordId,
  revisedFromId: record.revisedFromId,
  createdAt: record.createdAt,
  createdBy: record.createdBy,
  createdByName: record.createdByName,
  submittedAt: record.submittedAt,
  approvedAt: record.approvedAt,
  approvedBy: record.approvedBy,
  approvedByName: record.approvedByName,
  lockedAt: record.lockedAt,
  rejectionNote: record.rejectionNote,
  participants: record.participants,
});

export const managementDecisionRepository = {
  async list(schoolId: string): Promise<ManagementDecisionRecord[]> {
    const result = await hasatDataStore.readArray<ManagementDecisionRecord>(key(schoolId), []);
    return result.value
      .filter((item) => item && item.schoolId === schoolId)
      .map(normalize)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 250);
  },
  async replaceAll(schoolId: string, records: ManagementDecisionRecord[]): Promise<void> {
    await hasatDataStore.write(key(schoolId), records.filter((item) => item.schoolId === schoolId).map(normalize).slice(0, 250));
    notify(schoolId);
  },
  async save(record: ManagementDecisionRecord): Promise<void> {
    const normalized = normalize(record);
    const current = await this.list(normalized.schoolId);
    const existing = current.find((item) => item.id === normalized.id);
    if (existing?.status === 'approved' && immutableSnapshot(existing) !== immutableSnapshot(normalized)) {
      throw new Error('Onaylanmış karar tutanağı değiştirilemez. Yeni revizyon oluşturun.');
    }
    await this.replaceAll(normalized.schoolId, [normalized, ...current.filter((item) => item.id !== normalized.id)]);
  },
  async createRevision(record: ManagementDecisionRecord, actor: { userId: string; userName: string }): Promise<ManagementDecisionRecord> {
    if (record.status !== 'approved') throw new Error('Yalnızca onaylanmış tutanak için yeni revizyon açılabilir.');
    const nowIso = new Date().toISOString();
    const revision: ManagementDecisionRecord = {
      ...record,
      id: `decision-minutes-${Date.now()}`,
      status: 'draft',
      revision: record.revision + 1,
      rootRecordId: record.rootRecordId || record.id,
      revisedFromId: record.id,
      supersededById: undefined,
      items: record.items.map((item, index) => ({ ...item, id: `item-${index + 1}`, taskId: undefined })),
      signatures: [],
      recipients: [],
      distributedAt: undefined,
      distributedBy: undefined,
      distributedByName: undefined,
      createdAt: nowIso,
      createdBy: actor.userId,
      createdByName: actor.userName,
      submittedAt: undefined,
      approvedAt: undefined,
      approvedBy: undefined,
      approvedByName: undefined,
      lockedAt: undefined,
      rejectionNote: undefined,
      title: record.title.replace(/ \(Rev\. \d+\)$/i, '') + ` (Rev. ${record.revision + 1})`,
    };
    const current = await this.list(record.schoolId);
    const old = { ...record, supersededById: revision.id };
    await this.replaceAll(record.schoolId, [revision, old, ...current.filter((item) => item.id !== record.id)]);
    return revision;
  },
  subscribe(schoolId: string, listener: () => void): () => void {
    if (typeof window === 'undefined') return () => undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ schoolId?: string }>).detail;
      if (!detail?.schoolId || detail.schoolId === schoolId) listener();
    };
    window.addEventListener(MANAGEMENT_DECISIONS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MANAGEMENT_DECISIONS_CHANGED_EVENT, handler);
  },
};
