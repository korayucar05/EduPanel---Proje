import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { isFirebaseConfigured } from "../../lib/firebaseApp";
import { getHasatFirestore } from "../../lib/firestoreClient";
import { firebaseAuthSession, getCurrentSchoolMembership } from "../../core/auth";
import type { StudentReportV2Data } from "../types";

const COLLECTION = "hasatLiveReports";
const SHORT_LINK_COLLECTION = "hasatShortLinks";
const STUDENT_PROFILE_COLLECTION = "hasatStudentProfiles";
const STUDENT_PROFILE_INDEX_COLLECTION = "hasatStudentProfileIndex";
const MAX_REPORT_BYTES = 900_000;
const firestoreDb = () => {
  if (!isFirebaseConfigured) throw new Error("Firebase yapılandırması eksik veya geçersiz.");
  return getHasatFirestore();
};

export type FirestoreLiveReportPublication = {
  token: string;
  shortCode: string;
  permanentCode: string;
  url: string;
  longUrl: string;
  createdAt: string;
  expiresAt: string;
  ownerId: string;
  schoolId: string;
};

export type FirestoreLiveReportDocument = {
  schemaVersion: 2;
  ownerId: string;
  schoolId: string;
  reportCode: string;
  schoolName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  revoked: boolean;
  report: StudentReportV2Data;
};

const createToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

const SHORT_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const createShortCode = (length = 7) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => SHORT_ALPHABET[value % SHORT_ALPHABET.length]).join("");
};

export function buildFirestoreLongReportUrl(token: string) {
  const url = new URL(publicStudentReportBaseUrl());
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  url.searchParams.set("mode", "family-report");
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildFirestoreShortReportUrl(shortCode: string) {
  const url = new URL(publicStudentReportBaseUrl());
  url.pathname = `/r/${encodeURIComponent(shortCode)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}



const normalizeIdentityPart = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9ÇĞİÖŞÜ]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};

const buildStudentIdentityKey = async (schoolId: string, report: StudentReportV2Data) => {
  const number = normalizeIdentityPart(report.student?.number);
  const name = normalizeIdentityPart(report.student?.name);
  const classroom = normalizeIdentityPart(report.student?.classroom);
  const raw = number
    ? `${schoolId}|student-number:${number}`
    : `${schoolId}|student-fallback:${name}|${classroom}`;
  return sha256Hex(raw);
};

const createPermanentCode = (length = 8) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => SHORT_ALPHABET[value % SHORT_ALPHABET.length]).join("");
};

export function buildPermanentStudentUrl(permanentCode: string) {
  const url = new URL(publicStudentReportBaseUrl());
  url.pathname = `/s/${encodeURIComponent(permanentCode)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

const cleanForFirestore = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const reportSizeBytes = (report: StudentReportV2Data) => new TextEncoder().encode(JSON.stringify(report)).byteLength;

export function publicStudentReportBaseUrl() {
  const configured = String(import.meta.env.VITE_HASAT_PUBLIC_APP_URL || import.meta.env.VITE_PUBLIC_APP_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim();
  if (projectId) return `https://${projectId}.web.app`;

  return window.location.origin.replace(/\/+$/, "");
}

export function buildFirestoreLiveReportUrl(token: string) {
  return buildFirestoreLongReportUrl(token);
}


async function resolveOrCreatePermanentStudentCode(
  ownerId: string,
  schoolId: string,
  report: StudentReportV2Data,
) {
  const identityHash = await buildStudentIdentityKey(schoolId, report);
  const indexRef = doc(firestoreDb(), STUDENT_PROFILE_INDEX_COLLECTION, identityHash);
  const existingIndex = await getDoc(indexRef);
  if (existingIndex.exists()) {
    const existingCode = String(existingIndex.data()?.permanentCode || "").toUpperCase();
    if (/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(existingCode)) {
      return { identityHash, permanentCode: existingCode, isNew: false };
    }
  }

  let permanentCode = "";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = createPermanentCode();
    const existingProfile = await getDoc(doc(firestoreDb(), STUDENT_PROFILE_COLLECTION, candidate));
    if (!existingProfile.exists()) { permanentCode = candidate; break; }
  }
  if (!permanentCode) throw new Error("Öğrenciye kalıcı e-Nstitü AİLE adresi üretilemedi.");

  await setDoc(indexRef, {
    schemaVersion: 1,
    permanentCode,
    ownerId,
    schoolId,
    studentNumber: String(report.student?.number || ""),
    studentName: String(report.student?.name || ""),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { identityHash, permanentCode, isNew: true };
}

export async function publishFirestoreLiveReport(
  report: StudentReportV2Data,
  validDays = 30,
): Promise<FirestoreLiveReportPublication> {
  const size = reportSizeBytes(report);
  if (size > MAX_REPORT_BYTES) {
    throw new Error(`Canlı rapor verisi çok büyük (${Math.ceil(size / 1024)} KB). En fazla yaklaşık 900 KB yayımlanabilir.`);
  }

  const user = firebaseAuthSession.requireUser();
  const membership = await getCurrentSchoolMembership();
  const token = createToken();
  const permanent = await resolveOrCreatePermanentStudentCode(user.uid, membership.schoolId, report);
  let shortCode = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = createShortCode();
    const existing = await getDoc(doc(firestoreDb(), SHORT_LINK_COLLECTION, candidate));
    if (!existing.exists()) { shortCode = candidate; break; }
  }
  if (!shortCode) throw new Error("Kısa rapor bağlantısı üretilemedi. Lütfen yeniden deneyin.");
  const now = new Date();
  const expires = new Date(now.getTime() + Math.max(1, Math.min(validDays, 90)) * 86_400_000);

  const payload: Omit<FirestoreLiveReportDocument, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    schemaVersion: 2,
    ownerId: user.uid,
    schoolId: membership.schoolId,
    reportCode: String(report.reportCode || ""),
    schoolName: String(report.schoolName || ""),
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expires),
    revoked: false,
    report: cleanForFirestore(report),
  };

  await setDoc(doc(firestoreDb(), COLLECTION, token), payload);
  await setDoc(doc(firestoreDb(), SHORT_LINK_COLLECTION, shortCode), {
    schemaVersion: 1,
    token,
    ownerId: user.uid,
    schoolId: membership.schoolId,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expires),
    revoked: false,
  });

  const profileRef = doc(firestoreDb(), STUDENT_PROFILE_COLLECTION, permanent.permanentCode);
  const currentProfile = await getDoc(profileRef);
  await setDoc(profileRef, {
    schemaVersion: 1,
    permanentCode: permanent.permanentCode,
    ownerId: user.uid,
    schoolId: membership.schoolId,
    studentNumber: String(report.student?.number || ""),
    studentName: String(report.student?.name || ""),
    active: true,
    createdAt: currentProfile.exists() ? currentProfile.data()?.createdAt || serverTimestamp() : serverTimestamp(),
    updatedAt: serverTimestamp(),
    latestReportToken: token,
    latestExamName: String(report.examName || ""),
    latestExamDate: String(report.examDate || ""),
    report: cleanForFirestore(report),
  }, { merge: true });

  if (!permanent.isNew) {
    await setDoc(doc(firestoreDb(), STUDENT_PROFILE_INDEX_COLLECTION, permanent.identityHash), {
      ownerId: user.uid,
      schoolId: membership.schoolId,
      studentNumber: String(report.student?.number || ""),
      studentName: String(report.student?.name || ""),
      permanentCode: permanent.permanentCode,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return {
    token,
    shortCode,
    permanentCode: permanent.permanentCode,
    url: buildPermanentStudentUrl(permanent.permanentCode),
    longUrl: buildFirestoreLongReportUrl(token),
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    ownerId: user.uid,
    schoolId: membership.schoolId,
  };
}


export async function fetchPermanentStudentProfile(permanentCode: string): Promise<StudentReportV2Data | null> {
  const code = String(permanentCode || "").trim().toUpperCase();
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) return null;
  const snapshot = await getDoc(doc(firestoreDb(), STUDENT_PROFILE_COLLECTION, code));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as { active?: boolean; report?: StudentReportV2Data };
  if (data.active === false) return null;
  return data.report || null;
}

export async function revokePermanentStudentProfile(permanentCode: string) {
  const user = firebaseAuthSession.requireUser();
  const code = String(permanentCode || "").trim().toUpperCase();
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) return;
  const profileRef = doc(firestoreDb(), STUDENT_PROFILE_COLLECTION, code);
  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) return;
  if (String(snapshot.data()?.ownerId || "") !== user.uid) throw new Error("Bu kalıcı öğrenci bağlantısını iptal etme yetkiniz yok.");
  await setDoc(profileRef, { active: false, updatedAt: serverTimestamp() }, { merge: true });
}

export async function resolveFirestoreShortCode(shortCode: string): Promise<string | null> {
  const code=String(shortCode||"").trim().toUpperCase();
  if(!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{7}$/.test(code))return null;
  const snapshot=await getDoc(doc(firestoreDb(),SHORT_LINK_COLLECTION,code));
  if(!snapshot.exists())return null;
  const data=snapshot.data() as {token?:string;revoked?:boolean;expiresAt?:Timestamp};
  if(data.revoked)return null;
  const expiresAt=data.expiresAt?.toDate?.();
  if(!expiresAt||expiresAt.getTime()<=Date.now())return null;
  const token=String(data.token||"");
  return /^[a-f0-9]{48}$/i.test(token)?token:null;
}

export async function fetchFirestoreLiveReport(token: string): Promise<StudentReportV2Data | null> {
  if (!/^[a-f0-9]{48}$/i.test(token)) return null;
  const snapshot = await getDoc(doc(firestoreDb(), COLLECTION, token));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as FirestoreLiveReportDocument;
  if (data.revoked) return null;
  const expiresAt = data.expiresAt?.toDate?.();
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return null;
  return data.report || null;
}

export async function revokeFirestoreLiveReport(token: string) {
  firebaseAuthSession.requireUser();
  await deleteDoc(doc(firestoreDb(), COLLECTION, token));
}
