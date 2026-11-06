import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_GUIDANCE_MIGRATION_KEY = "sqlite-relational-guidance-v1";
type Kind = "string" | "number" | "boolean";
type Field = readonly [column: string, key: string, kind?: Kind];
type Config = { tableName: string; idColumn: string; fields: readonly Field[] };
export type GuidanceSourceDocument = { documentId: string; data: any; updatedAt: string };
export type GuidanceRelationalDocument = GuidanceSourceDocument & { collectionName: string };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;

const CONFIGS: Record<string, Config> = {
  customBehaviors: { tableName: "davranis_tanimlari", idColumn: "davranis_id", fields: [
    ["davranis_turu", "type"], ["davranis_adi", "name"], ["yonetmelik_adi", "regulationName"],
    ["madde", "article"], ["fikra", "paragraph"], ["yaptirim_turu", "sanctionType"], ["aciklama", "content"],
  ] },
  behaviorRecords: { tableName: "davranis_kayitlari", idColumn: "kayit_id", fields: [
    ["ana_ogrenci_id", "studentId"], ["ogrenci_adlari", "studentName"], ["ana_sinif_adi", "studentClassroom"],
    ["ana_ogrenci_no", "studentNumber"], ["davranis_turu", "behaviorType"], ["davranis_adi", "behaviorName"],
    ["yaptirim_turu", "sanctionType"], ["kayit_tarihi", "date"], ["aciklama", "description"],
    ["ogretmen_ad_soyad", "teacherName"], ["olusturulma_zamani", "createdAt", "number"],
    ["kayit_nedeni", "recordReason"], ["vaka_id", "caseId"], ["mesaj_gonderildi", "messageSent", "boolean"],
  ] },
  behaviorTeacherLinks: { tableName: "ogretmen_davranis_baglantilari", idColumn: "baglanti_id", fields: [
    ["baglanti_anahtari", "token"], ["uygulama_okul_id", "schoolId"], ["ogretmen_id", "teacherId"],
    ["ogretmen_ad_soyad", "teacherName"], ["olusturan", "createdBy"], ["gecerlilik_gunu", "validDays", "number"],
    ["aktif", "active", "boolean"], ["olusturulma_zamani", "createdAt"],
    ["veri_guncellenme_zamani", "updatedAt"], ["sona_erme_zamani", "expiresAt"],
  ] },
  behaviorTeacherSubmissions: { tableName: "ogretmen_davranis_gonderimleri", idColumn: "gonderim_id", fields: [
    ["ana_ogrenci_id", "studentId"], ["ogrenci_adlari", "studentName"], ["ana_sinif_adi", "studentClassroom"],
    ["ana_ogrenci_no", "studentNumber"], ["davranis_turu", "behaviorType"], ["davranis_adi", "behaviorName"],
    ["kayit_tarihi", "date"], ["aciklama", "description"], ["ogretmen_ad_soyad", "teacherName"],
    ["olusturulma_zamani", "createdAt", "number"], ["baglanti_anahtari", "linkToken"],
    ["uygulama_okul_id", "schoolId"], ["ogretmen_id", "teacherId"], ["kaynak", "source"],
    ["gonderilme_zamani", "submittedAt"],
  ] },
  guidanceBehaviorRecords: { tableName: "rehberlik_davranis_kayitlari", idColumn: "kayit_id", fields: [
    ["kaynak_kayit_id", "sourceRecordId"], ["kaynak", "source"], ["ogrenci_id", "studentId"],
    ["ogrenci_ad_soyad", "studentName"], ["ogrenci_no", "studentNumber"], ["sinif_adi", "classroom"],
    ["davranis_turu", "behaviorType"], ["davranis_adi", "behaviorName"], ["aciklama", "description"],
    ["ogretmen_ad_soyad", "teacherName"], ["kayit_tarihi", "date"], ["olusturulma_zamani", "createdAt", "number"],
    ["rehberlik_durumu", "guidanceStatus"], ["rehberlik_notu", "guidanceNote"], ["gorusme_zamani", "interviewedAt"],
    ["yonlendirme_zamani", "routedAt"], ["veri_guncellenme_zamani", "updatedAt"],
    ["onceki_olumsuz_sayisi", "previousNegativeCount", "number"],
    ["ayni_davranis_onceki_sayisi", "sameBehaviorPreviousCount", "number"], ["yonlendirme_nedeni", "routingReason"],
    ["yaptirim_turu", "sanctionType"], ["rehber_ogretmen_ad_soyad", "guidanceTeacherName"],
    ["yonlendirme_hedefi", "routingDestination"], ["mevcutla_farkli_olumsuz_sayisi", "distinctNegativeCountWithCurrent", "number"],
  ] },
  welfareCases: { tableName: "ogrenci_destek_vakalari", idColumn: "vaka_id", fields: [
    ["kaynak_kayit_id", "sourceRecordId"], ["ogrenci_id", "studentId"], ["ogrenci_adlari", "studentName"],
    ["ogrenci_no", "studentNumber"], ["sinif_adi", "studentClassroom"], ["durum", "status"],
    ["olusturulma_zamani", "createdAt", "number"], ["veri_guncellenme_zamani", "updatedAt", "number"],
  ] },
  welfareCaseTimeline: { tableName: "ogrenci_destek_vaka_gecmisi", idColumn: "gecmis_id", fields: [
    ["vaka_id", "caseId"], ["onceki_durum", "from"], ["sonraki_durum", "to"],
    ["islem_aciklamasi", "action"], ["islem_zamani", "at", "number"], ["kaynak_kayit_id", "recordId"],
  ] },
};

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
const arrayValue = (raw: unknown) => Array.isArray(raw) ? raw : [];

export function relationalGuidanceCollectionInfo(collectionName: string) { return CONFIGS[collectionName] || null; }

export async function ensureRelationalGuidanceSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-guidance-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel rehberlik şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/).map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalGuidanceReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_GUIDANCE_MIGRATION_KEY]);
  return result.rowCount > 0;
}

const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error("Rehberlik kayıtları için etkin okul bulunamadı.");
  return schoolId;
};

const writeBase = async (client: QueryClient, schoolId: string, collectionName: string, row: GuidanceSourceDocument) => {
  const config = CONFIGS[collectionName];
  const columns = ["okul_id", config.idColumn, ...config.fields.map(([column]) => column), "guncellenme_zamani"];
  const parameters = [schoolId, row.documentId, ...config.fields.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)];
  if (collectionName === "guidanceBehaviorRecords") {
    const submittedAt = row.data?.submittedAt;
    const extraColumns = ["gonderilme_zamani", "gonderilme_turu", "gonderilme_saniyesi", "gonderilme_nanosaniyesi"];
    columns.splice(columns.length - 1, 0, ...extraColumns);
    parameters.splice(parameters.length - 1, 0,
      typeof submittedAt === "string" ? submittedAt : null,
      submittedAt && typeof submittedAt === "object" ? fieldValue(submittedAt, "type") : null,
      submittedAt && typeof submittedAt === "object" ? fieldValue(submittedAt, "seconds", "number") : null,
      submittedAt && typeof submittedAt === "object" ? fieldValue(submittedAt, "nanoseconds", "number") : null);
  }
  const updateColumns = columns.slice(2);
  await client.query(`INSERT INTO ${config.tableName} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${updateColumns.map((column) => `${column}=VALUES(${column})`).join(",")}`, parameters);
};

const writeStudentChildren = async (client: QueryClient, schoolId: string, parentId: string, tableName: string, students: any[], includeDescription: boolean) => {
  for (const [index, student] of students.entries()) {
    const columns = includeDescription
      ? "okul_id, kayit_id, sira_no, ogrenci_id, ogrenci_ad_soyad, sinif_adi, ogrenci_no, aciklama"
      : "okul_id, kayit_id, sira_no, ogrenci_id, ogrenci_ad_soyad, sinif_adi, ogrenci_no";
    const values = [schoolId, parentId, index + 1, fieldValue(student, "id"), fieldValue(student, "name"),
      fieldValue(student, "classroom"), fieldValue(student, "number")];
    if (includeDescription) values.push(fieldValue(student, "description"));
    await client.query(`INSERT INTO ${tableName} (${columns}) VALUES (${values.map(() => "?").join(",")})`, values);
  }
};

const writeChildren = async (client: QueryClient, schoolId: string, collectionName: string, row: GuidanceSourceDocument) => {
  if (collectionName === "behaviorRecords") {
    await client.query("DELETE FROM davranis_kayit_ogrencileri WHERE okul_id=? AND kayit_id=?", [schoolId, row.documentId]);
    await client.query("DELETE FROM davranis_kayit_sikayetci_ogrencileri WHERE okul_id=? AND kayit_id=?", [schoolId, row.documentId]);
    await writeStudentChildren(client, schoolId, row.documentId, "davranis_kayit_ogrencileri", arrayValue(row.data?.studentsList), true);
    await writeStudentChildren(client, schoolId, row.documentId, "davranis_kayit_sikayetci_ogrencileri", arrayValue(row.data?.complainantStudents), false);
  } else if (collectionName === "behaviorTeacherLinks") {
    await client.query("DELETE FROM ogretmen_davranis_baglanti_ogrencileri WHERE okul_id=? AND baglanti_id=?", [schoolId, row.documentId]);
    await client.query("DELETE FROM ogretmen_davranis_baglanti_tanimlari WHERE okul_id=? AND baglanti_id=?", [schoolId, row.documentId]);
    for (const [index, student] of arrayValue(row.data?.students).entries()) {
      await client.query(`INSERT INTO ogretmen_davranis_baglanti_ogrencileri
        (okul_id, baglanti_id, sira_no, ogrenci_id, ogrenci_ad_soyad, sinif_adi, ogrenci_no) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, row.documentId, index + 1, fieldValue(student, "id"), fieldValue(student, "name"),
        fieldValue(student, "classroom"), fieldValue(student, "number")]);
    }
    for (const [index, behavior] of arrayValue(row.data?.behaviors).entries()) {
      await client.query(`INSERT INTO ogretmen_davranis_baglanti_tanimlari
        (okul_id, baglanti_id, sira_no, davranis_id, davranis_turu, davranis_adi) VALUES (?, ?, ?, ?, ?, ?)`,
      [schoolId, row.documentId, index + 1, fieldValue(behavior, "id"), fieldValue(behavior, "type"), fieldValue(behavior, "name")]);
    }
  } else if (collectionName === "behaviorTeacherSubmissions") {
    await client.query("DELETE FROM ogretmen_davranis_gonderim_ogrencileri WHERE okul_id=? AND gonderim_id=?", [schoolId, row.documentId]);
    const students = arrayValue(row.data?.studentsList);
    for (const [index, student] of students.entries()) {
      await client.query(`INSERT INTO ogretmen_davranis_gonderim_ogrencileri
        (okul_id, gonderim_id, sira_no, ogrenci_id, ogrenci_ad_soyad, sinif_adi, ogrenci_no, aciklama)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [schoolId, row.documentId, index + 1, fieldValue(student, "id"),
        fieldValue(student, "name"), fieldValue(student, "classroom"), fieldValue(student, "number"), fieldValue(student, "description")]);
    }
  }
};

export async function replaceRelationalGuidanceCollection(collectionName: string, documents: GuidanceSourceDocument[]) {
  const config = CONFIGS[collectionName];
  if (!config) throw new Error(`İlişkisel rehberlik koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await client.query(`DELETE FROM ${config.tableName} WHERE okul_id=?`, [schoolId]);
    for (const row of documents) { await writeBase(client, schoolId, collectionName, row); await writeChildren(client, schoolId, collectionName, row); }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function upsertRelationalGuidanceDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  if (!CONFIGS[collectionName]) throw new Error(`İlişkisel rehberlik koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    const row = { documentId, data, updatedAt }; await writeBase(client, schoolId, collectionName, row); await writeChildren(client, schoolId, collectionName, row);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function deleteRelationalGuidanceDocument(collectionName: string, documentId: string) {
  const config = CONFIGS[collectionName]; if (!config) throw new Error(`İlişkisel rehberlik koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  await pool.query(`DELETE FROM ${config.tableName} WHERE okul_id=? AND ${config.idColumn}=?`, [schoolId, documentId]);
}

const groupedRows = (rows: any[], idColumn: string, mapper: (row: any) => any) => {
  const map = new Map<string, any[]>();
  for (const row of rows) map.set(String(row[idColumn]), [...(map.get(String(row[idColumn])) || []), mapper(row)]);
  return map;
};

export async function loadRelationalGuidanceDocuments(): Promise<GuidanceRelationalDocument[]> {
  const schoolId = await primarySchoolId(); const result: GuidanceRelationalDocument[] = [];
  const [recordStudents, complainants, linkStudents, linkBehaviors, submissionStudents] = await Promise.all([
    pool.query("SELECT * FROM davranis_kayit_ogrencileri WHERE okul_id=? ORDER BY kayit_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM davranis_kayit_sikayetci_ogrencileri WHERE okul_id=? ORDER BY kayit_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_davranis_baglanti_ogrencileri WHERE okul_id=? ORDER BY baglanti_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_davranis_baglanti_tanimlari WHERE okul_id=? ORDER BY baglanti_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_davranis_gonderim_ogrencileri WHERE okul_id=? ORDER BY gonderim_id, sira_no", [schoolId]),
  ]);
  const student = (row: any, withDescription = false) => ({ id: row.ogrenci_id, name: row.ogrenci_ad_soyad,
    classroom: row.sinif_adi, number: row.ogrenci_no, ...(withDescription ? { description: row.aciklama } : {}) });
  const recordStudentMap = groupedRows(recordStudents.rows, "kayit_id", (row) => student(row, true));
  const complainantMap = groupedRows(complainants.rows, "kayit_id", (row) => student(row));
  const linkStudentMap = groupedRows(linkStudents.rows, "baglanti_id", (row) => student(row));
  const linkBehaviorMap = groupedRows(linkBehaviors.rows, "baglanti_id", (row) => ({ id: row.davranis_id, type: row.davranis_turu, name: row.davranis_adi }));
  const submissionStudentMap = groupedRows(submissionStudents.rows, "gonderim_id", (row) => student(row, true));
  for (const [collectionName, config] of Object.entries(CONFIGS)) {
    const rows = await pool.query(`SELECT * FROM ${config.tableName} WHERE okul_id=? ORDER BY guncellenme_zamani, ${config.idColumn}`, [schoolId]);
    for (const row of rows.rows) {
      const documentId = String(row[config.idColumn]); const data: Record<string, unknown> = { id: documentId };
      for (const [column, key, kind] of config.fields) if (row[column] !== null && row[column] !== undefined) data[key] = restoredValue(row[column], kind);
      if (collectionName === "behaviorRecords") {
        data.studentsList = recordStudentMap.get(documentId) || []; data.complainantStudents = complainantMap.get(documentId) || [];
      } else if (collectionName === "behaviorTeacherLinks") {
        const students = linkStudentMap.get(documentId) || [], behaviors = linkBehaviorMap.get(documentId) || [];
        data.students = students; data.studentIds = students.map((item) => item.id);
        data.behaviors = behaviors; data.behaviorNames = behaviors.map((item) => item.name);
      } else if (collectionName === "behaviorTeacherSubmissions") {
        data.studentsList = submissionStudentMap.get(documentId) || [];
      } else if (collectionName === "guidanceBehaviorRecords") {
        if (row.gonderilme_turu) data.submittedAt = { type: row.gonderilme_turu,
          seconds: Number(row.gonderilme_saniyesi || 0), nanoseconds: Number(row.gonderilme_nanosaniyesi || 0) };
        else if (row.gonderilme_zamani !== null) data.submittedAt = row.gonderilme_zamani;
      }
      result.push({ collectionName, documentId, data, updatedAt: String(row.guncellenme_zamani) });
    }
  }
  return result;
}
