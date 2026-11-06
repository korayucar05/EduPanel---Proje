export interface BehaviorRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentClassroom: string;
  studentNumber: string;
  behaviorType: "Olumlu" | "Olumsuz" | "Gözlem";
  behaviorName: string;
  sanctionType?: string;
  date: string;
  description: string;
  teacherName: string;
  notePrepared?: boolean;
  messageSent?: boolean;
  warningCount?: number;
  boardReason?: string;
  createdAt?: number;
  sentTo?: string;
  sourceRecordId?: string;
  historyRecord?: boolean;
  disciplineStatus?: string;
  archiveSource?: "Uyarı Bildirimi" | "Disiplin Süreci";
  archiveGroupId?: string;
  archivedAt?: number;
  originalSanctionType?: string;
  letterSent?: boolean;
  studentsList?: {
    id: string;
    name: string;
    classroom: string;
    number: string;
  }[];
  completedSteps?: Record<string, boolean>;
  recordReason?: "Tutanak" | "Şikayet";
  complainantStudents?: {
    id: string;
    name: string;
    classroom: string;
    number: string;
  }[];
  complaintRegulationArticle?: string;
  cagriData?: any;
  ifadeData?: any;
  kararData?: any;
  rehberlikData?: any;
  yaziliIfadeData?: any;
  tebligData?: any;
}