export type RecipientRole = "Veli" | "Öğrenci" | "Öğretmen" | "Manuel";
export type RecipientGroup = "" | "students" | "parents" | "teachers" | "manual" | "trial-club";
export type SendMode = "text" | "document" | "image";

export interface Recipient {
  id: string;
  name: string;
  className?: string;
  role: RecipientRole;
  number: string;
  normalized: string;
  studentNo?: string;
  studentName?: string;
  source?: unknown;
}

export interface SmartFileMatch {
  id: string;
  file: File;
  student: unknown | null;
  recipient: Recipient | null;
  status: "matched" | "unmatched" | "ambiguous" | "no-phone" | "too-large";
  detail: string;
}

export interface MessageSendResult {
  ok: boolean;
  status?: string;
  error?: string;
  raw?: unknown;
}
