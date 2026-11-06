export type CommonExamStatus = "draft" | "open" | "closed";

export interface CommonExamDefinition {
  id: string;
  code: string;
  name: string;
  examDate: string;
  gradeLevel: string;
  publisherName?: string;
  status: CommonExamStatus;
  allowedSchoolIds?: string[];
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkSubjectResult {
  subjectName: string;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  score?: number;
}

export interface NetworkStudentResult {
  studentId: string;
  studentNumber: string;
  studentName: string;
  classroom: string;
  schoolId: string;
  schoolName: string;
  net: number;
  score: number;
  subjects: NetworkSubjectResult[];
}

export interface NetworkExamSubmission {
  id: string;
  commonExamId: string;
  schoolId: string;
  schoolName: string;
  localExamId: string;
  localExamName: string;
  publishedAt: string;
  students: NetworkStudentResult[];
}

export interface NetworkStudentRankingRow extends NetworkStudentResult {
  networkRank: number;
  schoolRank: number;
}

export interface NetworkSchoolRankingRow {
  schoolId: string;
  schoolName: string;
  participantCount: number;
  averageNet: number;
  averageScore: number;
  rank: number;
}

export interface NetworkSubjectSchoolRankingRow {
  subjectName: string;
  schoolId: string;
  schoolName: string;
  participantCount: number;
  averageNet: number;
  averageScore: number;
  networkAverageNet: number;
  networkAverageScore: number;
  rank: number;
}

export interface NetworkExamAnalyticsSnapshot {
  exam: CommonExamDefinition;
  schoolCount: number;
  participantCount: number;
  networkAverageNet: number;
  networkAverageScore: number;
  students: NetworkStudentRankingRow[];
  schools: NetworkSchoolRankingRow[];
  subjects: NetworkSubjectSchoolRankingRow[];
  updatedAt: string;
}
