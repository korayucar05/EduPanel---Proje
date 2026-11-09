import { pool } from "./index.ts";

// Legacy prepared exams and optic layouts were stored as complete JSON documents.
// Keep them intact rather than flattening questions, answers, or scoring settings.
const COLLECTIONS = new Set(["exams", "optic_templates"]);
export type ExamArchiveRow = { collectionName: string; documentId: string; data: any; updatedAt: string };
type SourceRow = { documentId: string; data: any; updatedAt: string };

export const relationalExamArchiveCollectionInfo = (name: string) => COLLECTIONS.has(name);

const schoolId = async () => {
  const rows = await pool.query(`SELECT okul_id FROM okullar
    WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const id = String(rows.rows[0]?.okul_id || "").trim();
  if (!id) throw new Error("Sınav arşivi için etkin okul bulunamadı.");
  return id;
};

export async function ensureRelationalExamArchiveSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS sinav_belge_kayitlari (
    okul_id VARCHAR(191) NOT NULL,
    koleksiyon VARCHAR(80) NOT NULL,
    belge_id VARCHAR(191) NOT NULL,
    veri LONGTEXT NOT NULL,
    guncellenme_zamani VARCHAR(40) NOT NULL,
    PRIMARY KEY (okul_id, koleksiyon, belge_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

const asTimestamp = (raw: string) => {
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};

export async function loadRelationalExamArchiveDocuments(): Promise<ExamArchiveRow[]> {
  const id = await schoolId();
  const rows = await pool.query(
    "SELECT koleksiyon,belge_id,veri,guncellenme_zamani FROM sinav_belge_kayitlari WHERE okul_id=?",
    [id],
  );
  return rows.rows.filter((row: any) => COLLECTIONS.has(String(row.koleksiyon))).map((row: any) => ({
    collectionName: String(row.koleksiyon),
    documentId: String(row.belge_id),
    data: typeof row.veri === "string" ? JSON.parse(row.veri) : row.veri,
    updatedAt: String(row.guncellenme_zamani),
  }));
}

const saveRow = async (client: Awaited<ReturnType<typeof pool.connect>>, id: string, collection: string, row: SourceRow) => {
  await client.query(`INSERT INTO sinav_belge_kayitlari (okul_id,koleksiyon,belge_id,veri,guncellenme_zamani)
    VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE veri=VALUES(veri), guncellenme_zamani=VALUES(guncellenme_zamani)`,
    [id, collection, row.documentId, JSON.stringify(row.data), asTimestamp(row.updatedAt)]);
};

export async function replaceRelationalExamArchiveCollection(collection: string, rows: SourceRow[]) {
  if (!COLLECTIONS.has(collection)) throw new Error("Desteklenmeyen sınav koleksiyonu");
  const id = await schoolId();
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await client.query("DELETE FROM sinav_belge_kayitlari WHERE okul_id=? AND koleksiyon=?", [id, collection]);
    for (const row of rows) await saveRow(client, id, collection, row);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function upsertRelationalExamArchiveDocument(collection: string, documentId: string, data: any, updatedAt: string) {
  if (!COLLECTIONS.has(collection)) throw new Error("Desteklenmeyen sınav koleksiyonu");
  const id = await schoolId();
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await saveRow(client, id, collection, { documentId, data, updatedAt });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function deleteRelationalExamArchiveDocument(collection: string, documentId: string) {
  if (!COLLECTIONS.has(collection)) throw new Error("Desteklenmeyen sınav koleksiyonu");
  await pool.query(
    "DELETE FROM sinav_belge_kayitlari WHERE okul_id=? AND koleksiyon=? AND belge_id=?",
    [await schoolId(), collection, documentId],
  );
}
