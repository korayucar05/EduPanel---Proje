import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_EXAM_PLANNING_MIGRATION_KEY = "sqlite-relational-exam-planning-v1";
export type ExamPlanningSourceDocument = { documentId: string; data: any; updatedAt: string };
export type ExamPlanningRelationalDocument = ExamPlanningSourceDocument & { collectionName: string };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;
type Kind = "string" | "number" | "boolean";
type Field = readonly [column: string, key: string, kind?: Kind];

const JOINT_EXAM_COLLECTIONS = new Set(["examPlanningStates", "examPlanningPreferences", "examSeatingPlans"]);
const COLLECTIONS = new Set(["education_coach_exam_contents", "trial_exam_dates", ...JOINT_EXAM_COLLECTIONS]);
const PLAN_FIELDS: readonly Field[] = [
  ["takvim_id", "calendarId"], ["sinif_seviyesi", "gradeLevel"], ["sinav_adi", "examName"],
  ["sinav_sirasi", "examNumber", "number"], ["sinav_tarihi", "examDate"],
  ["olusturulan_sinav_id", "createdExamId"], ["olusturulan_sinav_zamani", "createdExamAt"],
  ["olusturulma_zamani", "createdAt"], ["veri_guncellenme_zamani", "updatedAt"],
];
const SCOPE_FIELDS: readonly Field[] = [
  ["kapsam_id", "id"], ["ders_id", "courseId"], ["ders_adi", "subject"],
  ["sinif_seviyesi", "grade"], ["unite_id", "unitId"], ["unite_adi", "unitName"],
  ["konu_id", "topicId"], ["konu_adi", "topicName"], ["kazanim_id", "outcomeId"],
  ["kazanim_adi", "outcomeName"], ["kapsam_turu", "scopeType"],
  ["tum_konular", "includeAllTopics", "boolean"], ["tum_kazanimlar", "includeAllOutcomes", "boolean"],
  ["soru_sayisi", "count", "number"],
];
const DATE_FIELDS: readonly Field[] = [
  ["sinif_seviyesi", "gradeLevel"], ["sinav_tarihi", "date"], ["sinav_turu", "kind"],
  ["aciklama", "description"], ["veri_guncellenme_zamani", "updatedAt"],
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

export function relationalExamPlanningCollectionInfo(collectionName: string) { return COLLECTIONS.has(collectionName); }

export async function ensureRelationalExamPlanningSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-exam-planning-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel sınav planlama şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/).map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalExamPlanningReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_EXAM_PLANNING_MIGRATION_KEY]);
  return result.rowCount > 0;
}

const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error("Sınav planları için etkin okul bulunamadı.");
  return schoolId;
};

const upsertContentPlan = async (client: QueryClient, schoolId: string, row: ExamPlanningSourceDocument) => {
  const columns = ["okul_id", "plan_id", ...PLAN_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  const values = [schoolId, row.documentId, ...PLAN_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)];
  await client.query(`INSERT INTO egitim_kocu_sinav_icerik_planlari (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`, values);
  await client.query("DELETE FROM egitim_kocu_sinav_icerik_kapsamlari WHERE okul_id=? AND plan_id=?", [schoolId, row.documentId]);
  for (const [index, scope] of arrayValue(row.data?.questionBlueprint).entries()) {
    const scopeColumns = ["okul_id", "plan_id", "sira_no", ...SCOPE_FIELDS.map(([column]) => column)];
    await client.query(`INSERT INTO egitim_kocu_sinav_icerik_kapsamlari (${scopeColumns.join(",")}) VALUES (${scopeColumns.map(() => "?").join(",")})`,
      [schoolId, row.documentId, index + 1, ...SCOPE_FIELDS.map(([, key, kind]) => fieldValue(scope, key, kind))]);
  }
};

const upsertTrialDate = async (client: QueryClient, schoolId: string, row: ExamPlanningSourceDocument) => {
  const columns = ["okul_id", "kayit_id", ...DATE_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  const values = [schoolId, row.documentId, ...DATE_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)];
  await client.query(`INSERT INTO deneme_sinavi_tarihleri (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`, values);
};

const writeDocument = async (client: QueryClient, schoolId: string, collectionName: string, row: ExamPlanningSourceDocument) => {
  if (JOINT_EXAM_COLLECTIONS.has(collectionName)) {
    await client.query(`INSERT INTO kelebek_planlama_kayitlari
      (okul_id, koleksiyon, belge_id, veri, guncellenme_zamani) VALUES (?,?,?,?,?)
      ON DUPLICATE KEY UPDATE veri=VALUES(veri), guncellenme_zamani=VALUES(guncellenme_zamani)`,
      [schoolId, collectionName, row.documentId, JSON.stringify(row.data), isoDate(row.updatedAt)]);
    return;
  }
  return collectionName === "education_coach_exam_contents"
    ? upsertContentPlan(client, schoolId, row) : upsertTrialDate(client, schoolId, row);
};

export async function replaceRelationalExamPlanningCollection(collectionName: string, documents: ExamPlanningSourceDocument[]) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel sınav planlama koleksiyonu desteklenmiyor: ${collectionName}`);
  const table = collectionName === "education_coach_exam_contents" ? "egitim_kocu_sinav_icerik_planlari" : "deneme_sinavi_tarihleri";
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    if (JOINT_EXAM_COLLECTIONS.has(collectionName)) {
      await client.query("DELETE FROM kelebek_planlama_kayitlari WHERE okul_id=? AND koleksiyon=?", [schoolId, collectionName]);
    } else {
      await client.query(`DELETE FROM ${table} WHERE okul_id=?`, [schoolId]);
    }
    for (const row of documents) await writeDocument(client, schoolId, collectionName, row);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function upsertRelationalExamPlanningDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel sınav planlama koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION"); await writeDocument(client, schoolId, collectionName, { documentId, data, updatedAt });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function deleteRelationalExamPlanningDocument(collectionName: string, documentId: string) {
  const schoolId = await primarySchoolId();
  if (JOINT_EXAM_COLLECTIONS.has(collectionName)) {
    await pool.query("DELETE FROM kelebek_planlama_kayitlari WHERE okul_id=? AND koleksiyon=? AND belge_id=?",
      [schoolId, collectionName, documentId]);
    return;
  }
  const table = collectionName === "education_coach_exam_contents" ? "egitim_kocu_sinav_icerik_planlari"
    : collectionName === "trial_exam_dates" ? "deneme_sinavi_tarihleri" : "";
  const idColumn = collectionName === "education_coach_exam_contents" ? "plan_id" : "kayit_id";
  if (!table) throw new Error(`İlişkisel sınav planlama koleksiyonu desteklenmiyor: ${collectionName}`);
  await pool.query(`DELETE FROM ${table} WHERE okul_id=? AND ${idColumn}=?`, [schoolId, documentId]);
}

export async function loadRelationalExamPlanningDocuments(): Promise<ExamPlanningRelationalDocument[]> {
  const schoolId = await primarySchoolId(); const result: ExamPlanningRelationalDocument[] = [];
  const [plans, scopes, dates, jointRecords] = await Promise.all([
    pool.query("SELECT * FROM egitim_kocu_sinav_icerik_planlari WHERE okul_id=? ORDER BY guncellenme_zamani,plan_id", [schoolId]),
    pool.query("SELECT * FROM egitim_kocu_sinav_icerik_kapsamlari WHERE okul_id=? ORDER BY plan_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM deneme_sinavi_tarihleri WHERE okul_id=? ORDER BY sinav_tarihi,kayit_id", [schoolId]),
    pool.query("SELECT koleksiyon, belge_id, veri, guncellenme_zamani FROM kelebek_planlama_kayitlari WHERE okul_id=? ORDER BY guncellenme_zamani, belge_id", [schoolId]),
  ]);
  const scopeMap = new Map<string, any[]>();
  for (const row of scopes.rows) {
    const id = String(row.plan_id); scopeMap.set(id, [...(scopeMap.get(id) || []), restoreFields(row, SCOPE_FIELDS)]);
  }
  for (const row of plans.rows) {
    const documentId = String(row.plan_id);
    result.push({ collectionName: "education_coach_exam_contents", documentId,
      data: { id: documentId, ...restoreFields(row, PLAN_FIELDS), questionBlueprint: scopeMap.get(documentId) || [] },
      updatedAt: String(row.guncellenme_zamani) });
  }
  for (const row of dates.rows) {
    const documentId = String(row.kayit_id);
    result.push({ collectionName: "trial_exam_dates", documentId,
      data: { id: documentId, ...restoreFields(row, DATE_FIELDS) }, updatedAt: String(row.guncellenme_zamani) });
  }
  for (const row of jointRecords.rows) {
    const data = typeof row.veri === "string" ? JSON.parse(row.veri) : row.veri;
    result.push({ collectionName: String(row.koleksiyon), documentId: String(row.belge_id),
      data, updatedAt: String(row.guncellenme_zamani) });
  }
  return result;
}
