import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_CALENDARS_MIGRATION_KEY = "sqlite-relational-calendars-v1";
export type CalendarSourceDocument = { documentId: string; data: any; updatedAt: string };
export type CalendarRelationalDocument = CalendarSourceDocument & { collectionName: string };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;
type Kind = "string" | "number" | "boolean";
type Field = readonly [column: string, key: string, kind?: Kind];

const COLLECTIONS = new Set(["education_coach_exam_calendar", "kelebekExamCalendars"]);
const COACH_FIELDS: readonly Field[] = [
  ["sinif_seviyesi", "gradeLevel"], ["sinav_adi", "examName"], ["sinav_sirasi", "examNumber", "number"],
  ["sinav_tarihi", "examDate"], ["uygulama_okul_id", "schoolId"], ["aktif", "active", "boolean"],
  ["olusturulma_zamani", "createdAt"], ["veri_guncellenme_zamani", "updatedAt"],
];
const CALENDAR_FIELDS: readonly Field[] = [
  ["donem", "selectedTerm"], ["sinav_no", "selectedExamNo"], ["baslangic_tarihi", "startDate"],
  ["gun_sayisi", "daysCount", "number"], ["gunluk_oturum_sayisi", "sessionsPerDay", "number"],
  ["veri_guncellenme_zamani", "updatedAt"],
];
const SESSION_FIELDS: readonly Field[] = [
  ["oturum_id", "id"], ["sinav_tarihi", "dateStr"], ["gun_adi", "dayName"],
  ["ders_saati", "lessonHour", "number"], ["oturum_sirasi", "sessionIndex", "number"],
  ["saat", "timeStr"], ["telafi_tarihi", "makeupDateStr"], ["telafi_gun_adi", "makeupDayName"],
  ["telafi_saati", "makeupTimeStr"],
];
const ABSENT_FIELDS: readonly Field[] = [
  ["ogrenci_id", "id"], ["ogrenci_adi", "name"], ["ogrenci_soyadi", "surname"],
  ["ogrenci_no", "studentNumber"], ["sinif_adi", "classroom"], ["katilmadigi_sinav", "missedExam"],
  ["katilmadigi_sinav_duzeltmesi", "missedExamOverride"], ["telafiye_girebilir", "canTakeMakeup", "boolean"],
];

const arrayValue = (value: unknown) => Array.isArray(value) ? value : [];
const isoDate = (raw: unknown) => {
  const parsed = raw instanceof Date ? raw : new Date(String(raw || ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};
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
const insert = async (client: QueryClient, table: string, columns: string[], values: any[]) =>
  client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, values);

export function relationalCalendarCollectionInfo(collectionName: string) { return COLLECTIONS.has(collectionName); }

export async function ensureRelationalCalendarsSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-calendars-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel sınav takvimi şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/).map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalCalendarsReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_CALENDARS_MIGRATION_KEY]);
  return result.rowCount > 0;
}

const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error("Sınav takvimleri için etkin okul bulunamadı.");
  return schoolId;
};

const upsertCoachCalendar = async (client: QueryClient, schoolId: string, row: CalendarSourceDocument) => {
  const columns = ["okul_id", "takvim_id", ...COACH_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  const values = [schoolId, row.documentId, ...COACH_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)];
  await client.query(`INSERT INTO egitim_kocu_sinav_takvimleri (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`, values);
  await client.query("DELETE FROM egitim_kocu_sinav_takvim_icerikleri WHERE okul_id=? AND takvim_id=?", [schoolId, row.documentId]);
  for (const [index, content] of arrayValue(row.data?.contents).entries())
    await insert(client, "egitim_kocu_sinav_takvim_icerikleri",
      ["okul_id", "takvim_id", "sira_no", "icerik_id", "ders_adi", "konu_aciklamasi"],
      [schoolId, row.documentId, index + 1, fieldValue(content, "id"), fieldValue(content, "subject"), fieldValue(content, "topics")]);
};

const upsertButterflyCalendar = async (client: QueryClient, schoolId: string, row: CalendarSourceDocument) => {
  const columns = ["okul_id", "takvim_id", ...CALENDAR_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  const values = [schoolId, row.documentId, ...CALENDAR_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)];
  await client.query(`INSERT INTO kelebek_sinav_takvimleri (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`, values);
  await client.query("DELETE FROM kelebek_sinav_oturumlari WHERE okul_id=? AND takvim_id=?", [schoolId, row.documentId]);
  for (const [sessionIndex, session] of arrayValue(row.data?.computedDates).entries()) {
    await insert(client, "kelebek_sinav_oturumlari",
      ["okul_id", "takvim_id", "sira_no", ...SESSION_FIELDS.map(([column]) => column)],
      [schoolId, row.documentId, sessionIndex + 1, ...SESSION_FIELDS.map(([, key, kind]) => fieldValue(session, key, kind))]);
    for (const [absentIndex, absent] of arrayValue(session?.absentStudents).entries())
      await insert(client, "kelebek_sinav_oturum_devamsizlari",
        ["okul_id", "takvim_id", "oturum_sira_no", "sira_no", ...ABSENT_FIELDS.map(([column]) => column)],
        [schoolId, row.documentId, sessionIndex + 1, absentIndex + 1, ...ABSENT_FIELDS.map(([, key, kind]) => fieldValue(absent, key, kind))]);
  }
};

const writeDocument = (client: QueryClient, schoolId: string, collectionName: string, row: CalendarSourceDocument) =>
  collectionName === "education_coach_exam_calendar" ? upsertCoachCalendar(client, schoolId, row) : upsertButterflyCalendar(client, schoolId, row);

export async function replaceRelationalCalendarCollection(collectionName: string, documents: CalendarSourceDocument[]) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel takvim koleksiyonu desteklenmiyor: ${collectionName}`);
  const table = collectionName === "education_coach_exam_calendar" ? "egitim_kocu_sinav_takvimleri" : "kelebek_sinav_takvimleri";
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION"); await client.query(`DELETE FROM ${table} WHERE okul_id=?`, [schoolId]);
    for (const row of documents) await writeDocument(client, schoolId, collectionName, row);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function upsertRelationalCalendarDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel takvim koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION"); await writeDocument(client, schoolId, collectionName, { documentId, data, updatedAt });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function deleteRelationalCalendarDocument(collectionName: string, documentId: string) {
  const table = collectionName === "education_coach_exam_calendar" ? "egitim_kocu_sinav_takvimleri"
    : collectionName === "kelebekExamCalendars" ? "kelebek_sinav_takvimleri" : "";
  if (!table) throw new Error(`İlişkisel takvim koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); await pool.query(`DELETE FROM ${table} WHERE okul_id=? AND takvim_id=?`, [schoolId, documentId]);
}

const grouped = (rows: any[], idColumn: string, mapper: (row: any) => any) => {
  const result = new Map<string, any[]>();
  for (const row of rows) { const id = String(row[idColumn]); result.set(id, [...(result.get(id) || []), mapper(row)]); }
  return result;
};

export async function loadRelationalCalendarDocuments(): Promise<CalendarRelationalDocument[]> {
  const schoolId = await primarySchoolId(); const result: CalendarRelationalDocument[] = [];
  const [coach, contents, calendars, sessions, absents] = await Promise.all([
    pool.query("SELECT * FROM egitim_kocu_sinav_takvimleri WHERE okul_id=? ORDER BY guncellenme_zamani,takvim_id", [schoolId]),
    pool.query("SELECT * FROM egitim_kocu_sinav_takvim_icerikleri WHERE okul_id=? ORDER BY takvim_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM kelebek_sinav_takvimleri WHERE okul_id=? ORDER BY guncellenme_zamani,takvim_id", [schoolId]),
    pool.query("SELECT * FROM kelebek_sinav_oturumlari WHERE okul_id=? ORDER BY takvim_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM kelebek_sinav_oturum_devamsizlari WHERE okul_id=? ORDER BY takvim_id,oturum_sira_no,sira_no", [schoolId]),
  ]);
  const contentMap = grouped(contents.rows, "takvim_id", (row) => ({ id: row.icerik_id, subject: row.ders_adi, topics: row.konu_aciklamasi }));
  for (const row of coach.rows) {
    const documentId = String(row.takvim_id);
    result.push({ collectionName: "education_coach_exam_calendar", documentId,
      data: { id: documentId, ...restoreFields(row, COACH_FIELDS), contents: contentMap.get(documentId) || [] },
      updatedAt: String(row.guncellenme_zamani) });
  }
  const absentMap = new Map<string, any[]>();
  for (const row of absents.rows) {
    const key = `${row.takvim_id}|${row.oturum_sira_no}`;
    absentMap.set(key, [...(absentMap.get(key) || []), restoreFields(row, ABSENT_FIELDS)]);
  }
  const sessionMap = grouped(sessions.rows, "takvim_id", (row) => ({ ...restoreFields(row, SESSION_FIELDS),
    absentStudents: absentMap.get(`${row.takvim_id}|${row.sira_no}`) || [] }));
  for (const row of calendars.rows) {
    const documentId = String(row.takvim_id);
    result.push({ collectionName: "kelebekExamCalendars", documentId,
      data: { id: documentId, ...restoreFields(row, CALENDAR_FIELDS), computedDates: sessionMap.get(documentId) || [] },
      updatedAt: String(row.guncellenme_zamani) });
  }
  return result;
}
