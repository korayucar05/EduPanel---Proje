import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_CURRICULUM_MIGRATION_KEY = "sqlite-relational-curriculum-v1";
export type CurriculumSourceDocument = { documentId: string; data: any; updatedAt: string };
export type CurriculumRelationalDocument = CurriculumSourceDocument & { collectionName: string };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;
type Kind = "string" | "number" | "boolean";
type Field = readonly [column: string, key: string, kind?: Kind];

const COLLECTIONS = new Set(["customCreatedCourses", "courseCurriculums", "questionBankExamArchives"]);
const CUSTOM_FIELDS: readonly Field[] = [
  ["sinif_seviyesi", "gradeLevel"], ["ders_adi", "courseName"], ["ders_kodu", "courseCode"],
  ["kisa_kod", "code"], ["haftalik_ders_saati", "weeklyHours", "number"], ["ders_turu", "courseType"],
  ["teknik_tur", "type"], ["brans", "branch"], ["ders_bransi", "courseBranch"],
  ["eski_birlesik_ders", "legacyCombinedCourse"], ["ortak_secmeli", "isCommonElective", "boolean"],
  ["ogretmen_id", "teacherId"], ["ogretmen_ad_soyad", "teacherName"],
  ["ogretmen_atamasi_temizlendi", "teacherAssignmentCleared", "boolean"], ["ders_grubu", "courseGroup"],
  ["olusturulma_zamani", "createdAt"], ["veri_guncellenme_zamani", "updatedAt"],
];
const CURRICULUM_FIELDS: readonly Field[] = [
  ["mufredat_anahtari", "curriculumKey"], ["ders_id", "courseId"], ["sinif_seviyesi", "grade"],
  ["ders_adi", "courseName"], ["parmak_izi", "fingerprint"], ["surum", "version", "number"],
  ["veri_guncellenme_zamani", "updatedAt"],
];
const ARCHIVE_FIELDS: readonly Field[] = [
  ["sinav_id", "examId"], ["sinav_adi", "examName"], ["soru_id", "questionId"],
  ["soru_kodu", "questionCode"], ["kaynak_depolama_yolu", "sourceStoragePath"],
  ["depolama_yolu", "storagePath"], ["kaynak", "source"], ["olusturulma_zamani", "createdAt"],
  ["veri_guncellenme_zamani", "updatedAt"],
];

const arrayValue = (value: unknown) => Array.isArray(value) ? value : [];
const isoDate = (raw: unknown) => {
  const parsed = raw instanceof Date ? raw : new Date(String(raw || ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};
const fieldValue = (data: any, key: string, kind: Kind = "string") => {
  const raw = data?.[key];
  if (raw === undefined || raw === null) return null;
  if (kind === "number") return Number.isFinite(Number(raw)) ? Number(raw) : null;
  if (kind === "boolean") return raw === true || raw === 1 || raw === "1" || raw === "true" ? 1 : 0;
  return String(raw);
};
const restoredValue = (raw: any, kind: Kind = "string") => kind === "number" ? Number(raw) : kind === "boolean" ? Boolean(raw) : raw;
const restoreFields = (row: any, fields: readonly Field[]) => {
  const data: Record<string, unknown> = {};
  for (const [column, key, kind] of fields) if (row[column] !== null && row[column] !== undefined) data[key] = restoredValue(row[column], kind);
  return data;
};
const insert = async (client: QueryClient, table: string, columns: string[], values: any[]) => {
  await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, values);
};

export function relationalCurriculumCollectionInfo(collectionName: string) { return COLLECTIONS.has(collectionName); }

export async function ensureRelationalCurriculumSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-curriculum-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel müfredat şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/).map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalCurriculumReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_CURRICULUM_MIGRATION_KEY]);
  return result.rowCount > 0;
}

const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error("Müfredat kayıtları için etkin okul bulunamadı.");
  return schoolId;
};

const upsertCustomCourse = async (client: QueryClient, schoolId: string, row: CurriculumSourceDocument) => {
  const columns = ["okul_id", "ders_tanim_id", ...CUSTOM_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  const values = [schoolId, row.documentId, ...CUSTOM_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)];
  await client.query(`INSERT INTO ozel_ders_tanimlari (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`, values);
  for (const table of ["ozel_ders_hedef_gruplari", "ozel_ders_secili_siniflari", "ozel_ders_sinif_gruplari"])
    await client.query(`DELETE FROM ${table} WHERE okul_id=? AND ders_tanim_id=?`, [schoolId, row.documentId]);
  for (const [index, group] of arrayValue(row.data?.targetGroups).entries())
    await insert(client, "ozel_ders_hedef_gruplari", ["okul_id", "ders_tanim_id", "sira_no", "grup_adi"], [schoolId, row.documentId, index + 1, String(group)]);
  for (const [index, classroom] of arrayValue(row.data?.selectedClassrooms).entries())
    await insert(client, "ozel_ders_secili_siniflari", ["okul_id", "ders_tanim_id", "sira_no", "sinif_id"], [schoolId, row.documentId, index + 1, String(classroom)]);
  const classGroups = row.data?.classGroups && typeof row.data.classGroups === "object" && !Array.isArray(row.data.classGroups) ? row.data.classGroups : {};
  for (const [classroomId, groups] of Object.entries(classGroups)) {
    for (const [index, group] of arrayValue(groups).entries())
      await insert(client, "ozel_ders_sinif_gruplari", ["okul_id", "ders_tanim_id", "sinif_id", "sira_no", "grup_adi"],
        [schoolId, row.documentId, classroomId, index + 1, String(group)]);
  }
};

const upsertCurriculum = async (client: QueryClient, schoolId: string, row: CurriculumSourceDocument) => {
  const curriculum = row.data?.curriculum && typeof row.data.curriculum === "object" ? row.data.curriculum : {};
  const columns = ["okul_id", "mufredat_id", ...CURRICULUM_FIELDS.map(([column]) => column),
    "kaynak_sinif_seviyesi", "kaynak_ders_id", "kaynak_ders_kodu", "kaynak_ders_adi", "guncellenme_zamani"];
  const values = [schoolId, row.documentId, ...CURRICULUM_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)),
    fieldValue(curriculum, "grade", "number"), fieldValue(curriculum, "courseId", "number"),
    fieldValue(curriculum, "courseCode", "number"), fieldValue(curriculum, "courseName"), isoDate(row.updatedAt)];
  await client.query(`INSERT INTO ders_mufredatlari (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`, values);
  await client.query("DELETE FROM mufredat_uniteleri WHERE okul_id=? AND mufredat_id=?", [schoolId, row.documentId]);
  for (const [unitIndex, unit] of arrayValue(curriculum?.units).entries()) {
    await insert(client, "mufredat_uniteleri", ["okul_id", "mufredat_id", "sira_no", "unite_id", "unite_no", "unite_adi"],
      [schoolId, row.documentId, unitIndex + 1, fieldValue(unit, "id"), fieldValue(unit, "number", "number"), fieldValue(unit, "name")]);
    for (const [topicIndex, topic] of arrayValue(unit?.topics).entries()) {
      await insert(client, "mufredat_konulari",
        ["okul_id", "mufredat_id", "unite_sira_no", "konu_sira_no", "konu_id", "konu_no", "konu_adi"],
        [schoolId, row.documentId, unitIndex + 1, topicIndex + 1, fieldValue(topic, "id"), fieldValue(topic, "number", "number"), fieldValue(topic, "name")]);
      for (const [outcomeIndex, outcome] of arrayValue(topic?.outcomes).entries())
        await insert(client, "mufredat_kazanimlari",
          ["okul_id", "mufredat_id", "unite_sira_no", "konu_sira_no", "kazanim_sira_no", "kazanim_id", "kazanim_kodu", "kazanim_no", "kazanim_adi"],
          [schoolId, row.documentId, unitIndex + 1, topicIndex + 1, outcomeIndex + 1, fieldValue(outcome, "id"),
            fieldValue(outcome, "code"), fieldValue(outcome, "number", "number"), fieldValue(outcome, "name")]);
    }
  }
};

const upsertArchive = async (client: QueryClient, schoolId: string, row: CurriculumSourceDocument) => {
  const columns = ["okul_id", "arsiv_id", ...ARCHIVE_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  const values = [schoolId, row.documentId, ...ARCHIVE_FIELDS.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)];
  await client.query(`INSERT INTO soru_bankasi_sinav_arsivi (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`, values);
};

const writeDocument = async (client: QueryClient, schoolId: string, collectionName: string, row: CurriculumSourceDocument) => {
  if (collectionName === "customCreatedCourses") return upsertCustomCourse(client, schoolId, row);
  if (collectionName === "courseCurriculums") return upsertCurriculum(client, schoolId, row);
  return upsertArchive(client, schoolId, row);
};

export async function replaceRelationalCurriculumCollection(collectionName: string, documents: CurriculumSourceDocument[]) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel müfredat koleksiyonu desteklenmiyor: ${collectionName}`);
  const table = collectionName === "customCreatedCourses" ? "ozel_ders_tanimlari"
    : collectionName === "courseCurriculums" ? "ders_mufredatlari" : "soru_bankasi_sinav_arsivi";
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION"); await client.query(`DELETE FROM ${table} WHERE okul_id=?`, [schoolId]);
    for (const row of documents) await writeDocument(client, schoolId, collectionName, row);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function upsertRelationalCurriculumDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel müfredat koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION"); await writeDocument(client, schoolId, collectionName, { documentId, data, updatedAt });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function deleteRelationalCurriculumDocument(collectionName: string, documentId: string) {
  const config = collectionName === "customCreatedCourses" ? ["ozel_ders_tanimlari", "ders_tanim_id"]
    : collectionName === "courseCurriculums" ? ["ders_mufredatlari", "mufredat_id"]
      : collectionName === "questionBankExamArchives" ? ["soru_bankasi_sinav_arsivi", "arsiv_id"] : null;
  if (!config) throw new Error(`İlişkisel müfredat koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  await pool.query(`DELETE FROM ${config[0]} WHERE okul_id=? AND ${config[1]}=?`, [schoolId, documentId]);
}

const grouped = (rows: any[], idColumn: string, mapper: (row: any) => any) => {
  const result = new Map<string, any[]>();
  for (const row of rows) { const id = String(row[idColumn]); result.set(id, [...(result.get(id) || []), mapper(row)]); }
  return result;
};

export async function loadRelationalCurriculumDocuments(): Promise<CurriculumRelationalDocument[]> {
  const schoolId = await primarySchoolId(); const result: CurriculumRelationalDocument[] = [];
  const [custom, targets, classrooms, classGroups, curricula, units, topics, outcomes, archives] = await Promise.all([
    pool.query("SELECT * FROM ozel_ders_tanimlari WHERE okul_id=? ORDER BY guncellenme_zamani,ders_tanim_id", [schoolId]),
    pool.query("SELECT * FROM ozel_ders_hedef_gruplari WHERE okul_id=? ORDER BY ders_tanim_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM ozel_ders_secili_siniflari WHERE okul_id=? ORDER BY ders_tanim_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM ozel_ders_sinif_gruplari WHERE okul_id=? ORDER BY ders_tanim_id,sinif_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM ders_mufredatlari WHERE okul_id=? ORDER BY guncellenme_zamani,mufredat_id", [schoolId]),
    pool.query("SELECT * FROM mufredat_uniteleri WHERE okul_id=? ORDER BY mufredat_id,sira_no", [schoolId]),
    pool.query("SELECT * FROM mufredat_konulari WHERE okul_id=? ORDER BY mufredat_id,unite_sira_no,konu_sira_no", [schoolId]),
    pool.query("SELECT * FROM mufredat_kazanimlari WHERE okul_id=? ORDER BY mufredat_id,unite_sira_no,konu_sira_no,kazanim_sira_no", [schoolId]),
    pool.query("SELECT * FROM soru_bankasi_sinav_arsivi WHERE okul_id=? ORDER BY guncellenme_zamani,arsiv_id", [schoolId]),
  ]);
  const targetMap = grouped(targets.rows, "ders_tanim_id", (row) => String(row.grup_adi));
  const classroomMap = grouped(classrooms.rows, "ders_tanim_id", (row) => String(row.sinif_id));
  const classGroupMap = grouped(classGroups.rows, "ders_tanim_id", (row) => ({ classroomId: String(row.sinif_id), group: String(row.grup_adi) }));
  for (const row of custom.rows) {
    const documentId = String(row.ders_tanim_id); const groups: Record<string, string[]> = {};
    for (const item of classGroupMap.get(documentId) || []) groups[item.classroomId] = [...(groups[item.classroomId] || []), item.group];
    result.push({ collectionName: "customCreatedCourses", documentId,
      data: { id: documentId, ...restoreFields(row, CUSTOM_FIELDS), targetGroups: targetMap.get(documentId) || [],
        selectedClassrooms: classroomMap.get(documentId) || [], classGroups: groups }, updatedAt: String(row.guncellenme_zamani) });
  }
  const curriculumMap = new Map<string, any[]>();
  for (const row of units.rows) {
    const list = curriculumMap.get(String(row.mufredat_id)) || [];
    list[Number(row.sira_no) - 1] = { id: row.unite_id, number: row.unite_no === null ? undefined : Number(row.unite_no), name: row.unite_adi, topics: [] };
    curriculumMap.set(String(row.mufredat_id), list);
  }
  for (const row of topics.rows) {
    const unit = curriculumMap.get(String(row.mufredat_id))?.[Number(row.unite_sira_no) - 1];
    if (unit) unit.topics[Number(row.konu_sira_no) - 1] = { id: row.konu_id, number: row.konu_no === null ? undefined : Number(row.konu_no), name: row.konu_adi, outcomes: [] };
  }
  for (const row of outcomes.rows) {
    const topic = curriculumMap.get(String(row.mufredat_id))?.[Number(row.unite_sira_no) - 1]?.topics?.[Number(row.konu_sira_no) - 1];
    if (topic) topic.outcomes[Number(row.kazanim_sira_no) - 1] = { id: row.kazanim_id, code: row.kazanim_kodu,
      number: row.kazanim_no === null ? undefined : Number(row.kazanim_no), name: row.kazanim_adi };
  }
  for (const row of curricula.rows) {
    const documentId = String(row.mufredat_id); const curriculum: Record<string, unknown> = { units: curriculumMap.get(documentId) || [] };
    if (row.kaynak_sinif_seviyesi !== null) curriculum.grade = Number(row.kaynak_sinif_seviyesi);
    if (row.kaynak_ders_id !== null) curriculum.courseId = Number(row.kaynak_ders_id);
    if (row.kaynak_ders_kodu !== null) curriculum.courseCode = Number(row.kaynak_ders_kodu);
    if (row.kaynak_ders_adi !== null) curriculum.courseName = row.kaynak_ders_adi;
    result.push({ collectionName: "courseCurriculums", documentId,
      data: { id: documentId, ...restoreFields(row, CURRICULUM_FIELDS), curriculum }, updatedAt: String(row.guncellenme_zamani) });
  }
  for (const row of archives.rows) {
    const documentId = String(row.arsiv_id);
    result.push({ collectionName: "questionBankExamArchives", documentId,
      data: { id: documentId, ...restoreFields(row, ARCHIVE_FIELDS) }, updatedAt: String(row.guncellenme_zamani) });
  }
  return result;
}
