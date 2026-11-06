import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_ANNOUNCEMENTS_MIGRATION_KEY = "documents-relational-announcements-v1";
export type AnnouncementSourceDocument = { documentId: string; data: any; updatedAt: string };
export type AnnouncementRelationalDocument = AnnouncementSourceDocument & { collectionName: "announcements" };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;

export function relationalAnnouncementCollectionInfo(collectionName: string) {
  return collectionName === "announcements";
}

export async function ensureRelationalAnnouncementsSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-announcements-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel duyuru şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalAnnouncementsReady() {
  const result = await pool.query(
    "SELECT migration_key FROM edupanel_migrations WHERE migration_key=?",
    [RELATIONAL_ANNOUNCEMENTS_MIGRATION_KEY],
  );
  return result.rowCount > 0;
}

const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error("Duyurular için etkin okul bulunamadı.");
  return schoolId;
};

const dateValue = (value: unknown) => {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const mysqlDateTime = (value: unknown) => {
  const parsed = new Date(String(value || ""));
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return date.toISOString().replace("T", " ").replace("Z", "");
};

const writeAnnouncement = async (client: QueryClient, schoolId: string, row: AnnouncementSourceDocument) => {
  await client.query(`INSERT INTO duyurular
    (okul_id, duyuru_id, baslik, icerik, duyuru_tarihi, etiket, guncellenme_zamani)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE baslik=VALUES(baslik), icerik=VALUES(icerik),
      duyuru_tarihi=VALUES(duyuru_tarihi), etiket=VALUES(etiket),
      guncellenme_zamani=VALUES(guncellenme_zamani)`, [
    schoolId,
    row.documentId,
    String(row.data?.title || ""),
    String(row.data?.content || ""),
    dateValue(row.data?.date),
    String(row.data?.tag || "Genel"),
    mysqlDateTime(row.updatedAt),
  ]);
};

export async function replaceRelationalAnnouncementCollection(
  collectionName: string,
  documents: AnnouncementSourceDocument[],
) {
  if (!relationalAnnouncementCollectionInfo(collectionName)) {
    throw new Error(`İlişkisel duyuru koleksiyonu desteklenmiyor: ${collectionName}`);
  }
  const schoolId = await primarySchoolId();
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await client.query("DELETE FROM duyurular WHERE okul_id=?", [schoolId]);
    for (const row of documents) await writeAnnouncement(client, schoolId, row);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertRelationalAnnouncementDocument(
  collectionName: string,
  documentId: string,
  data: any,
  updatedAt: string,
) {
  if (!relationalAnnouncementCollectionInfo(collectionName)) {
    throw new Error(`İlişkisel duyuru koleksiyonu desteklenmiyor: ${collectionName}`);
  }
  const schoolId = await primarySchoolId();
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await writeAnnouncement(client, schoolId, { documentId, data, updatedAt });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRelationalAnnouncementDocument(collectionName: string, documentId: string) {
  if (!relationalAnnouncementCollectionInfo(collectionName)) {
    throw new Error(`İlişkisel duyuru koleksiyonu desteklenmiyor: ${collectionName}`);
  }
  const schoolId = await primarySchoolId();
  await pool.query("DELETE FROM duyurular WHERE okul_id=? AND duyuru_id=?", [schoolId, documentId]);
}

export async function loadRelationalAnnouncementDocuments(): Promise<AnnouncementRelationalDocument[]> {
  const schoolId = await primarySchoolId();
  const result = await pool.query(
    "SELECT * FROM duyurular WHERE okul_id=? ORDER BY duyuru_tarihi, guncellenme_zamani, duyuru_id",
    [schoolId],
  );
  return result.rows.map((row: any) => {
    const documentId = String(row.duyuru_id);
    const updatedAt = row.guncellenme_zamani instanceof Date
      ? row.guncellenme_zamani.toISOString()
      : String(row.guncellenme_zamani);
    return {
      collectionName: "announcements" as const,
      documentId,
      data: {
        id: documentId,
        title: String(row.baslik || ""),
        content: String(row.icerik || ""),
        date: row.duyuru_tarihi instanceof Date
          ? row.duyuru_tarihi.toISOString().slice(0, 10)
          : String(row.duyuru_tarihi || ""),
        tag: String(row.etiket || "Genel"),
      },
      updatedAt,
    };
  });
}
