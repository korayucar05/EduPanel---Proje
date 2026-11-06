import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_ATTENDANCE_MIGRATION_KEY = "sqlite-relational-attendance-v1";
export type AttendanceSourceDocument = { documentId: string; data: any; updatedAt: string };
export type AttendanceRelationalDocument = AttendanceSourceDocument & { collectionName: string };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;
type Kind = "string" | "number" | "boolean";
type Field = readonly [column: string, key: string, kind?: Kind];

const COLLECTIONS = new Set([
  "attendance_mobile_submissions", "attendance_absence_records", "attendance_unauthorized_records",
  "attendance_activity_records", "attendanceOpticalRecords",
]);
const MOBILE_FIELDS: readonly Field[] = [
  ["tarih", "date"], ["sinif_id", "classroomId"], ["sinif_adi", "classroomName"], ["ders_adi", "courseName"],
  ["gecerli_ders_saati", "currentLesson", "number"], ["ogretmen_id", "teacherId"], ["ogretmen_adi", "teacherName"],
  ["baglanti_id", "linkId"], ["baglanti_anahtari", "linkToken"], ["kaynak", "source"], ["durum", "status"],
  ["gonderilme_zamani", "submittedAt"], ["revizyon", "revision", "number"], ["onaylanma_zamani", "approvedAt"],
  ["onaylayan_id", "approvedById"], ["onaylayan_adi", "approvedByName"],
];
const RECORD_FIELDS: readonly Field[] = [
  ["tarih", "date"], ["sinif_id", "classroomId"], ["sinif_adi", "classroomName"],
  ["ogrenci_id", "studentId"], ["ogrenci_adi", "studentName"], ["durum", "status"],
  ["kaynak_gonderim_id", "sourceSubmissionId"], ["onaylayan_id", "approvedById"],
  ["onaylayan_adi", "approvedByName"], ["onaylanma_zamani", "approvedAt"],
];
const OPTICAL_FIELDS: readonly Field[] = [
  ["tarih", "date"], ["sinif_id", "classroomId"], ["sinif_adi", "classroomName"],
  ["kaynak_adi", "sourceName"], ["olusturulma_zamani", "createdAt"], ["gonderilme_zamani", "submittedAt"],
  ["baglanti_id", "accessLinkId"],
];
const RECORD_TABLES: Record<string, string> = {
  attendance_absence_records: "yoklama_devamsizliklari",
  attendance_unauthorized_records: "yoklama_izinsiz_ders_kayitlari",
  attendance_activity_records: "yoklama_etkinlik_kayitlari",
};

const arrayValue = (value: unknown) => Array.isArray(value) ? value : [];
const isoDate = (raw: unknown) => { const date = new Date(String(raw || "")); return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString(); };
const fieldValue = (data: any, key: string, kind: Kind = "string") => {
  const raw = data?.[key]; if (raw === undefined || raw === null) return null;
  if (kind === "number") return Number.isFinite(Number(raw)) ? Number(raw) : null;
  if (kind === "boolean") return raw === true || raw === 1 || raw === "1" || raw === "true" ? 1 : 0;
  return String(raw);
};
const restoreFields = (row: any, fields: readonly Field[]) => Object.fromEntries(fields.flatMap(([column, key, kind]) => {
  if (row[column] === null || row[column] === undefined) return [];
  return [[key, kind === "number" ? Number(row[column]) : kind === "boolean" ? Boolean(row[column]) : row[column]]];
}));

export function relationalAttendanceCollectionInfo(collectionName: string) { return COLLECTIONS.has(collectionName); }

export async function ensureRelationalAttendanceSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-attendance-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel yoklama şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/).map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}
export async function isRelationalAttendanceReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_ATTENDANCE_MIGRATION_KEY]);
  return result.rowCount > 0;
}
const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim(); if (!schoolId) throw new Error("Yoklama kayıtları için etkin okul bulunamadı."); return schoolId;
};
const insert = (client: QueryClient, table: string, columns: string[], values: any[]) =>
  client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, values);

const upsertMobile = async (client: QueryClient, schoolId: string, row: AttendanceSourceDocument) => {
  const columns = ["okul_id", "gonderim_id", ...MOBILE_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  await client.query(`INSERT INTO yoklama_mobil_gonderimleri (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`,
  [schoolId, row.documentId, ...MOBILE_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)]);
  await client.query("DELETE FROM yoklama_mobil_gonderim_dersleri WHERE okul_id=? AND gonderim_id=?", [schoolId, row.documentId]);
  await client.query("DELETE FROM yoklama_mobil_gonderim_ogrencileri WHERE okul_id=? AND gonderim_id=?", [schoolId, row.documentId]);
  for (const [index, lesson] of arrayValue(row.data?.lessons).entries())
    await insert(client, "yoklama_mobil_gonderim_dersleri", ["okul_id", "gonderim_id", "sira_no", "ders_saati"], [schoolId, row.documentId, index + 1, Number(lesson)]);
  for (const [entryIndex, entry] of arrayValue(row.data?.entries).entries()) {
    await insert(client, "yoklama_mobil_gonderim_ogrencileri", ["okul_id", "gonderim_id", "sira_no", "ogrenci_id", "ogrenci_adi", "durum"],
      [schoolId, row.documentId, entryIndex + 1, fieldValue(entry, "studentId"), fieldValue(entry, "studentName"), fieldValue(entry, "status")]);
    for (const [type, values] of [["atlanilan", entry?.skippedLessons], ["yoklama", entry?.lessons]] as const)
      for (const [lessonIndex, lesson] of arrayValue(values).entries())
        await insert(client, "yoklama_mobil_ogrenci_dersleri",
          ["okul_id", "gonderim_id", "ogrenci_sira_no", "ders_turu", "sira_no", "ders_saati"],
          [schoolId, row.documentId, entryIndex + 1, type, lessonIndex + 1, Number(lesson)]);
  }
};

const upsertStatusRecord = async (client: QueryClient, schoolId: string, collectionName: string, row: AttendanceSourceDocument) => {
  const table = RECORD_TABLES[collectionName]; const columns = ["okul_id", "kayit_id", ...RECORD_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`,
  [schoolId, row.documentId, ...RECORD_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)]);
  if (collectionName === "attendance_unauthorized_records") {
    await client.query("DELETE FROM yoklama_izinsiz_ders_saatleri WHERE okul_id=? AND kayit_id=?", [schoolId, row.documentId]);
    for (const [index, lesson] of arrayValue(row.data?.skippedLessons).entries())
      await insert(client, "yoklama_izinsiz_ders_saatleri", ["okul_id", "kayit_id", "sira_no", "ders_saati"], [schoolId, row.documentId, index + 1, Number(lesson)]);
  }
};

const upsertOptical = async (client: QueryClient, schoolId: string, row: AttendanceSourceDocument) => {
  const columns = ["okul_id", "kayit_id", ...OPTICAL_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  await client.query(`INSERT INTO optik_yoklama_kayitlari (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`,
  [schoolId, row.documentId, ...OPTICAL_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)]);
  await client.query("DELETE FROM optik_yoklama_ogrencileri WHERE okul_id=? AND kayit_id=?", [schoolId, row.documentId]);
  for (const [studentIndex, student] of arrayValue(row.data?.absentStudents).entries()) {
    await insert(client, "optik_yoklama_ogrencileri", ["okul_id", "kayit_id", "sira_no", "ogrenci_id", "ogrenci_adi", "okul_numarasi"],
      [schoolId, row.documentId, studentIndex + 1, fieldValue(student, "studentId"), fieldValue(student, "studentName"), fieldValue(student, "studentNumber")]);
    for (const [lessonIndex, lesson] of arrayValue(student?.lessons).entries())
      await insert(client, "optik_yoklama_ogrenci_dersleri", ["okul_id", "kayit_id", "ogrenci_sira_no", "sira_no", "ders_saati"],
        [schoolId, row.documentId, studentIndex + 1, lessonIndex + 1, Number(lesson)]);
  }
};

const writeDocument = (client: QueryClient, schoolId: string, collectionName: string, row: AttendanceSourceDocument) =>
  collectionName === "attendance_mobile_submissions" ? upsertMobile(client, schoolId, row)
    : collectionName === "attendanceOpticalRecords" ? upsertOptical(client, schoolId, row)
      : upsertStatusRecord(client, schoolId, collectionName, row);
const tableFor = (collectionName: string) => collectionName === "attendance_mobile_submissions" ? "yoklama_mobil_gonderimleri"
  : collectionName === "attendanceOpticalRecords" ? "optik_yoklama_kayitlari" : RECORD_TABLES[collectionName];
const idColumnFor = (collectionName: string) => collectionName === "attendance_mobile_submissions" ? "gonderim_id" : "kayit_id";

export async function replaceRelationalAttendanceCollection(collectionName: string, documents: AttendanceSourceDocument[]) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel yoklama koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try { await client.query("START TRANSACTION"); await client.query(`DELETE FROM ${tableFor(collectionName)} WHERE okul_id=?`, [schoolId]);
    for (const row of documents) await writeDocument(client, schoolId, collectionName, row); await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
export async function upsertRelationalAttendanceDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel yoklama koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try { await client.query("START TRANSACTION"); await writeDocument(client, schoolId, collectionName, { documentId, data, updatedAt }); await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
export async function deleteRelationalAttendanceDocument(collectionName: string, documentId: string) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel yoklama koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); await pool.query(`DELETE FROM ${tableFor(collectionName)} WHERE okul_id=? AND ${idColumnFor(collectionName)}=?`, [schoolId, documentId]);
}

const groupedNumbers = (rows: any[], key: (row: any) => string) => { const map = new Map<string, number[]>(); for (const row of rows) map.set(key(row), [...(map.get(key(row)) || []), Number(row.ders_saati)]); return map; };
export async function loadRelationalAttendanceDocuments(): Promise<AttendanceRelationalDocument[]> {
  const schoolId = await primarySchoolId(); const result: AttendanceRelationalDocument[] = [];
  const [mobile, mobileLessons, entries, entryLessons, absence, unauthorized, skipped, activity, optical, opticalStudents, opticalLessons] = await Promise.all([
    pool.query("SELECT * FROM yoklama_mobil_gonderimleri WHERE okul_id=? ORDER BY guncellenme_zamani,gonderim_id", [schoolId]),
    pool.query("SELECT * FROM yoklama_mobil_gonderim_dersleri WHERE okul_id=? ORDER BY gonderim_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM yoklama_mobil_gonderim_ogrencileri WHERE okul_id=? ORDER BY gonderim_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM yoklama_mobil_ogrenci_dersleri WHERE okul_id=? ORDER BY gonderim_id,ogrenci_sira_no,ders_turu,sira_no", [schoolId]),
    pool.query("SELECT * FROM yoklama_devamsizliklari WHERE okul_id=? ORDER BY guncellenme_zamani,kayit_id", [schoolId]),
    pool.query("SELECT * FROM yoklama_izinsiz_ders_kayitlari WHERE okul_id=? ORDER BY guncellenme_zamani,kayit_id", [schoolId]),
    pool.query("SELECT * FROM yoklama_izinsiz_ders_saatleri WHERE okul_id=? ORDER BY kayit_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM yoklama_etkinlik_kayitlari WHERE okul_id=? ORDER BY guncellenme_zamani,kayit_id", [schoolId]),
    pool.query("SELECT * FROM optik_yoklama_kayitlari WHERE okul_id=? ORDER BY guncellenme_zamani,kayit_id", [schoolId]),
    pool.query("SELECT * FROM optik_yoklama_ogrencileri WHERE okul_id=? ORDER BY kayit_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM optik_yoklama_ogrenci_dersleri WHERE okul_id=? ORDER BY kayit_id,ogrenci_sira_no,sira_no", [schoolId]),
  ]);
  const topLessonMap = groupedNumbers(mobileLessons.rows, (row) => String(row.gonderim_id));
  const entryLessonMap = groupedNumbers(entryLessons.rows, (row) => `${row.gonderim_id}|${row.ogrenci_sira_no}|${row.ders_turu}`);
  const entryMap = new Map<string, any[]>();
  for (const row of entries.rows) { const id = String(row.gonderim_id); const data: any = { studentId: row.ogrenci_id, studentName: row.ogrenci_adi };
    if (row.durum !== null) data.status = row.durum;
    const skippedLessons = entryLessonMap.get(`${id}|${row.sira_no}|atlanilan`) || []; const lessons = entryLessonMap.get(`${id}|${row.sira_no}|yoklama`) || [];
    if (skippedLessons.length) data.skippedLessons = skippedLessons; if (lessons.length) data.lessons = lessons; entryMap.set(id, [...(entryMap.get(id) || []), data]); }
  for (const row of mobile.rows) { const documentId = String(row.gonderim_id); result.push({ collectionName: "attendance_mobile_submissions", documentId,
    data: { id: documentId, ...restoreFields(row, MOBILE_FIELDS), lessons: topLessonMap.get(documentId) || [], entries: entryMap.get(documentId) || [] }, updatedAt: String(row.guncellenme_zamani) }); }
  const pushSimple = (rows: any[], collectionName: string) => rows.forEach((row) => { const documentId = String(row.kayit_id); result.push({ collectionName, documentId,
    data: { id: documentId, ...restoreFields(row, RECORD_FIELDS) }, updatedAt: String(row.guncellenme_zamani) }); });
  pushSimple(absence.rows, "attendance_absence_records"); pushSimple(activity.rows, "attendance_activity_records");
  const skippedMap = groupedNumbers(skipped.rows, (row) => String(row.kayit_id));
  for (const row of unauthorized.rows) { const documentId = String(row.kayit_id); result.push({ collectionName: "attendance_unauthorized_records", documentId,
    data: { id: documentId, ...restoreFields(row, RECORD_FIELDS), skippedLessons: skippedMap.get(documentId) || [] }, updatedAt: String(row.guncellenme_zamani) }); }
  const opticalLessonMap = groupedNumbers(opticalLessons.rows, (row) => `${row.kayit_id}|${row.ogrenci_sira_no}`); const opticalStudentMap = new Map<string, any[]>();
  for (const row of opticalStudents.rows) { const id = String(row.kayit_id); opticalStudentMap.set(id, [...(opticalStudentMap.get(id) || []), {
    studentId: row.ogrenci_id, studentName: row.ogrenci_adi, studentNumber: row.okul_numarasi, lessons: opticalLessonMap.get(`${id}|${row.sira_no}`) || [],
  }]); }
  for (const row of optical.rows) { const documentId = String(row.kayit_id); result.push({ collectionName: "attendanceOpticalRecords", documentId,
    data: { id: documentId, ...restoreFields(row, OPTICAL_FIELDS), absentStudents: opticalStudentMap.get(documentId) || [] }, updatedAt: String(row.guncellenme_zamani) }); }
  return result;
}
