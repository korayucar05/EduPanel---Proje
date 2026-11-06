import QRCode from "qrcode";
import type { StudentReportV2Data } from "../types";
import { fetchLiveReportByToken } from "../../core/report-context";
import {
  fetchFirestoreLiveReport,
  fetchPermanentStudentProfile,
  publishFirestoreLiveReport,
  resolveFirestoreShortCode,
  revokePermanentStudentProfile,
  revokeFirestoreLiveReport,
} from "./firestoreLiveReport";

export type IndependentLiveReportPublication = {
  token: string;
  shortCode: string;
  permanentCode: string;
  revokeSecret: string;
  url: string;
  longUrl: string;
  qrDataUrl?: string;
  createdAt: string;
  expiresAt: string;
};

export async function publishIndependentLiveReport(
  report: StudentReportV2Data,
  validDays = 30,
): Promise<IndependentLiveReportPublication> {
  const publication = await publishFirestoreLiveReport(report, validDays);
  const qrDataUrl = await QRCode.toDataURL(publication.url, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return {
    token: publication.token,
    shortCode: publication.shortCode,
    permanentCode: publication.permanentCode,
    revokeSecret: "firestore",
    url: publication.url,
    longUrl: publication.longUrl,
    qrDataUrl,
    createdAt: publication.createdAt,
    expiresAt: publication.expiresAt,
  };
}

export async function fetchIndependentLiveReport(
  token: string,
): Promise<StudentReportV2Data | null> {
  // Yeni e-Nstitü AİLE bağlantıları Node.js/SQLite canlı rapor API'sinden okunur.
  // Eski Firestore tokenları için geriye dönük uyumluluk korunur.
  try {
    const live = await fetchLiveReportByToken<StudentReportV2Data>(token);
    if (live?.report) return live.report;
  } catch (error) {
    console.warn("Canlı rapor API'si okunamadı; eski Firestore bağlantısı deneniyor.", error);
  }
  return fetchFirestoreLiveReport(token);
}

export async function resolveIndependentShortCode(shortCode:string):Promise<string|null>{
  return resolveFirestoreShortCode(shortCode);
}

export async function fetchIndependentPermanentStudentProfile(permanentCode:string):Promise<StudentReportV2Data|null>{
  return fetchPermanentStudentProfile(permanentCode);
}

export async function revokeIndependentLiveReport(
  publication: IndependentLiveReportPublication,
): Promise<void> {
  if (publication.permanentCode) {
    await revokePermanentStudentProfile(publication.permanentCode);
  }
  await revokeFirestoreLiveReport(publication.token);
}
