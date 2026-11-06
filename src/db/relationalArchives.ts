import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_ARCHIVES_MIGRATION_KEY = "sqlite-relational-archives-v1";

const COLLECTIONS = {
  lostDocumentDiplomaRecords: {
    tableName: "kayip_diploma_kayitlari",
    columns: [
      "tc_kimlik_no", "ad_soyad", "baba_adi", "anne_adi", "dogum_yeri", "dogum_tarihi",
      "ogretim_yili", "alani", "sinifi", "okul_numarasi", "diploma_tarihi", "diploma_no",
      "diploma_notu", "yabanci_dili", "bos_alan", "basvuran_kendisi", "basvuran_ad_soyad",
      "basvuran_yakinlik", "belge_nedeni", "belge_sayisi", "islem_yapan_kullanici",
    ],
  },
  lostDocumentTasdiknameRecords: {
    tableName: "kayip_tasdikname_kayitlari",
    columns: [
      "tc_kimlik_no", "ad_soyad", "baba_adi", "anne_adi", "dogum_yeri", "dogum_tarihi",
      "okul_numarasi", "sinifi", "tasdikname_tarihi", "tasdikname_no", "mezun_oldugu_ortaokul",
      "belge_sayisi", "islem_yapan_kullanici",
    ],
  },
} as const;

type ArchiveCollectionName = keyof typeof COLLECTIONS;
export type ArchiveSourceDocument = { documentId: string; data: any; updatedAt: string };
export type ArchiveRelationalDocument = ArchiveSourceDocument & { collectionName: ArchiveCollectionName };

const value = (data: any, key: string) => data?.[key] === undefined || data?.[key] === null ? null : String(data[key]);
const booleanValue = (data: any, key: string) => data?.[key] === undefined || data?.[key] === null
  ? null
  : (data[key] === true || data[key] === 1 || data[key] === "1" || data[key] === "true" ? 1 : 0);
const isoDate = (value: unknown) => {
  const parsed = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};
const optional = (target: Record<string, unknown>, key: string, rawValue: unknown) => {
  if (rawValue !== null && rawValue !== undefined) target[key] = rawValue;
};

export function relationalArchiveCollectionInfo(collectionName: string) {
  return COLLECTIONS[collectionName as ArchiveCollectionName] || null;
}

export async function ensureRelationalArchivesSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-archives-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel arşiv şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalArchivesReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_ARCHIVES_MIGRATION_KEY]);
  return result.rowCount > 0;
}

const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar
    WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error("Kayıp belge kayıtları için etkin okul bulunamadı.");
  return schoolId;
};

const diplomaValues = (data: any) => [
  value(data, "TC Kimlik No"), value(data, "Adı Soyadı"), value(data, "Baba Adı"), value(data, "Anne Adı"),
  value(data, "Doğum Yeri"), value(data, "Doğum Tarihi"), value(data, "Öğretim Yılı"), value(data, "Alanı"),
  value(data, "Sınıfı"), value(data, "Okul Numarası"), value(data, "Diploma Tarihi"), value(data, "Diploma No"),
  value(data, "Diploma Notu"), value(data, "Yabancı Dili"), value(data, "__EMPTY"), booleanValue(data, "__requesterIsSelf"),
  value(data, "__requesterName"), value(data, "__requesterRelationship"), value(data, "__documentReason"),
  value(data, "__documentNumber"), value(data, "__assistantPrincipal"),
];

const tasdiknameValues = (data: any) => [
  value(data, "TC No"), value(data, "Adı Soyadı"), value(data, "Baba Adı"), value(data, "Ana Adı"),
  value(data, "Doğum Yeri"), value(data, "Doğum Tarihi"), value(data, "Okul Numarası"), value(data, "Sınıfı"),
  value(data, "Tasdikname Tarihi"), value(data, "Tasdikname No"), value(data, "Mezun Olduğu Ortaokul"),
  value(data, "__documentNumber"), value(data, "__assistantPrincipal"),
];

const rowValues = (collectionName: ArchiveCollectionName, row: ArchiveSourceDocument) =>
  collectionName === "lostDocumentDiplomaRecords" ? diplomaValues(row.data) : tasdiknameValues(row.data);

const insertBatch = async (client: Awaited<ReturnType<typeof pool.connect>>, collectionName: ArchiveCollectionName,
  schoolId: string, documents: ArchiveSourceDocument[]) => {
  const info = COLLECTIONS[collectionName];
  const allColumns = ["okul_id", "kayit_id", ...info.columns, "guncellenme_zamani"];
  const updateColumns = [...info.columns, "guncellenme_zamani"];
  const batchSize = 250;
  for (let offset = 0; offset < documents.length; offset += batchSize) {
    const batch = documents.slice(offset, offset + batchSize);
    const placeholders = batch.map(() => `(${allColumns.map(() => "?").join(",")})`).join(",");
    const parameters = batch.flatMap((row) => [schoolId, row.documentId, ...rowValues(collectionName, row), isoDate(row.updatedAt)]);
    await client.query(`INSERT INTO ${info.tableName} (${allColumns.join(",")}) VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE ${updateColumns.map((column) => `${column}=VALUES(${column})`).join(",")}`, parameters);
  }
};

export async function replaceRelationalArchiveCollection(collectionName: string, documents: ArchiveSourceDocument[]) {
  const info = relationalArchiveCollectionInfo(collectionName);
  if (!info) throw new Error(`İlişkisel arşiv koleksiyonu desteklenmiyor: ${collectionName}`);
  const typedName = collectionName as ArchiveCollectionName;
  const schoolId = await primarySchoolId();
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await client.query(`DELETE FROM ${info.tableName} WHERE okul_id=?`, [schoolId]);
    await insertBatch(client, typedName, schoolId, documents);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function upsertRelationalArchiveDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  if (!relationalArchiveCollectionInfo(collectionName)) throw new Error(`İlişkisel arşiv koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  const client = await pool.connect();
  try {
    await insertBatch(client, collectionName as ArchiveCollectionName, schoolId, [{ documentId, data, updatedAt }]);
  } finally { client.release(); }
}

export async function deleteRelationalArchiveDocument(collectionName: string, documentId: string) {
  const info = relationalArchiveCollectionInfo(collectionName);
  if (!info) throw new Error(`İlişkisel arşiv koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  await pool.query(`DELETE FROM ${info.tableName} WHERE okul_id=? AND kayit_id=?`, [schoolId, documentId]);
}

const diplomaData = (row: any) => {
  const data: Record<string, unknown> = {
    "TC Kimlik No": row.tc_kimlik_no, "Adı Soyadı": row.ad_soyad, "Baba Adı": row.baba_adi,
    "Anne Adı": row.anne_adi, "Doğum Yeri": row.dogum_yeri, "Doğum Tarihi": row.dogum_tarihi,
    "Öğretim Yılı": row.ogretim_yili, "Alanı": row.alani, "Sınıfı": row.sinifi,
    "Okul Numarası": row.okul_numarasi, "Diploma Tarihi": row.diploma_tarihi, "Diploma No": row.diploma_no,
    "Diploma Notu": row.diploma_notu, "Yabancı Dili": row.yabanci_dili,
  };
  optional(data, "__EMPTY", row.bos_alan);
  optional(data, "__requesterIsSelf", row.basvuran_kendisi === null ? null : Boolean(row.basvuran_kendisi));
  optional(data, "__requesterName", row.basvuran_ad_soyad);
  optional(data, "__requesterRelationship", row.basvuran_yakinlik);
  optional(data, "__documentReason", row.belge_nedeni);
  optional(data, "__documentNumber", row.belge_sayisi);
  optional(data, "__assistantPrincipal", row.islem_yapan_kullanici);
  return data;
};

const tasdiknameData = (row: any) => {
  const data: Record<string, unknown> = {
    "TC No": row.tc_kimlik_no, "Adı Soyadı": row.ad_soyad, "Baba Adı": row.baba_adi,
    "Ana Adı": row.anne_adi, "Doğum Yeri": row.dogum_yeri, "Doğum Tarihi": row.dogum_tarihi,
    "Okul Numarası": row.okul_numarasi, "Sınıfı": row.sinifi, "Tasdikname Tarihi": row.tasdikname_tarihi,
    "Tasdikname No": row.tasdikname_no, "Mezun Olduğu Ortaokul": row.mezun_oldugu_ortaokul,
  };
  optional(data, "__documentNumber", row.belge_sayisi);
  optional(data, "__assistantPrincipal", row.islem_yapan_kullanici);
  return data;
};

export async function loadRelationalArchiveDocuments(): Promise<ArchiveRelationalDocument[]> {
  const schoolId = await primarySchoolId();
  const [diplomaResult, tasdiknameResult] = await Promise.all([
    pool.query("SELECT * FROM kayip_diploma_kayitlari WHERE okul_id=? ORDER BY guncellenme_zamani, kayit_id", [schoolId]),
    pool.query("SELECT * FROM kayip_tasdikname_kayitlari WHERE okul_id=? ORDER BY guncellenme_zamani, kayit_id", [schoolId]),
  ]);
  return [
    ...diplomaResult.rows.map((row: any) => ({
      collectionName: "lostDocumentDiplomaRecords" as const, documentId: String(row.kayit_id),
      data: diplomaData(row), updatedAt: String(row.guncellenme_zamani),
    })),
    ...tasdiknameResult.rows.map((row: any) => ({
      collectionName: "lostDocumentTasdiknameRecords" as const, documentId: String(row.kayit_id),
      data: tasdiknameData(row), updatedAt: String(row.guncellenme_zamani),
    })),
  ];
}
