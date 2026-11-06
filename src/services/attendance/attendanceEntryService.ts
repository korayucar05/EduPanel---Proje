import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";

export interface AttendanceLessonEntry {
  studentId: string;
  studentName: string;
  studentNumber?: string;
  lessons: number[];
}
export interface AttendanceSubmission {
  id: string;
  date: string;
  classroomId: string;
  classroomName: string;
  entries: AttendanceLessonEntry[];
  status: "pending" | "approved";
  submittedAt: string;
  revision: number;
  source?: "phone-link";
  recipientStudentId?: string;
  recipientStudentName?: string;
}
export interface AttendanceOpticalReviewRecord {
  id: string;
  date: string;
  classroomId: string;
  classroomName: string;
  absentStudents: AttendanceLessonEntry[];
  sourceName?: string;
  submittedAt?: string;
  createdAt?: string;
  status?: string;
  source?: "scanned-slip";
}
export interface AttendanceDayRecord {
  id: string;
  date: string;
  classroomId: string;
  classroomName: string;
  absentStudents: AttendanceLessonEntry[];
  sources?: string[];
  updatedAt?: string;
  updatedByName?: string;
}
export interface AttendanceReviewPayload {
  mobile: AttendanceSubmission[];
  optical: AttendanceOpticalReviewRecord[];
  finalRecords: AttendanceDayRecord[];
}
export interface ApprovedAttendanceRecord { id: string; date: string; classroomId: string; classroomName: string; studentId: string; studentName: string; status?: string; skippedLessons?: number[]; approvedAt: string; approvedByName: string }

const request = async (url: string, init?: RequestInit) => {
  const token = runtimeSessionStorage.getItem("edupanel_auth_token");
  if (!token) throw new Error("Geçerli yönetim oturumu bulunamadı.");
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(`Yoklama sunucusuna ulaşılamadı: ${error instanceof Error ? error.message : "bağlantı hatası"}`);
  }
  const raw = await response.text();
  let result: any = {};
  if (raw) {
    try { result = JSON.parse(raw); }
    catch { result = { error: raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) }; }
  }
  if (!response.ok) {
    throw new Error(result.error || `Yoklama işlemi başarısız. HTTP ${response.status} ${response.statusText}`.trim());
  }
  return result;
};

export const createAttendanceEntryLink = (date: string, recipientStudentId: string) => request("/api/attendance-entry/share-link", { method: "POST", body: JSON.stringify({ date, recipientStudentId }) }) as Promise<{ url: string; linkId: string; expiresAt: string; isPublic: boolean; recipientStudentName: string; classroomName: string }>;
export const loadAttendanceSubmissions = async (date: string) => (await request(`/api/attendance-entry/submissions?date=${encodeURIComponent(date)}`)).submissions as AttendanceSubmission[];
export const loadAttendanceReview = (date: string) => request(`/api/attendance-entry/review?date=${encodeURIComponent(date)}`) as Promise<AttendanceReviewPayload>;
export const saveAttendanceDayReview = (date: string, classrooms: Array<{ classroomId: string; classroomName: string; absentStudents: AttendanceLessonEntry[]; sources?: string[] }>) => request("/api/attendance-entry/day-review", { method: "PUT", body: JSON.stringify({ date, classrooms }) }) as Promise<{ success: boolean; classroomCount: number }>;
export const approveAttendanceDay = (date: string) => request("/api/attendance-entry/approve-day", { method: "POST", body: JSON.stringify({ date }) }) as Promise<{ submissionCount: number; savedCount: number }>;
export const loadApprovedAttendanceRecords = async (category: "absences" | "unauthorized" | "activities", date: string) => (await request(`/api/attendance-entry/records/${category}?date=${encodeURIComponent(date)}`)).records as ApprovedAttendanceRecord[];
