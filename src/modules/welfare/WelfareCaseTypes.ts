export type WelfareCaseStatus =
  | "behavior"
  | "warning"
  | "preliminary"
  | "guidance"
  | "discipline"
  | "decision"
  | "archived";

export interface WelfareCase {
  id: string;
  sourceRecordId: string;
  studentId?: string;
  studentName?: string;
  studentNumber?: string;
  studentClassroom?: string;
  status: WelfareCaseStatus;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
  archiveSource?: string;
}

export interface WelfareCaseTimelineEvent {
  id: string;
  caseId: string;
  from?: WelfareCaseStatus;
  to: WelfareCaseStatus;
  action: string;
  at: number;
  note?: string;
  actor?: string;
  recordId?: string;
}
