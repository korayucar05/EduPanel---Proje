import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_COMMUNICATIONS_MIGRATION_KEY = "sqlite-relational-communications-v1";

type Kind = "string" | "number" | "boolean";
type Field = readonly [column: string, key: string, kind?: Kind];
type Config = { tableName: string; fields: readonly Field[] };
type SourceDocument = { documentId: string; data: any; updatedAt: string };
type RelationalDocument = SourceDocument & { collectionName: string };

const CONFIGS: Record<string, Config> = {
  messageEvidenceRecords: { tableName: "mesaj_kanitlari", fields: [
    ["token_ozeti", "tokenHash"], ["alici_ad_soyad", "recipientName"], ["alici_telefon", "recipientPhone"],
    ["alici_rolu", "recipientRole"], ["ogrenci_ad_soyad", "studentName"], ["ogrenci_no", "studentNo"],
    ["sinif_adi", "className"], ["kaynak", "source"], ["mesaj_turu", "messageType"], ["mesaj", "message"],
    ["mesaj_ozeti", "messageHash"], ["olusturulma_zamani", "createdAt"], ["sona_erme_zamani", "expiresAt"],
    ["acilma_sayisi", "openCount", "number"], ["onay_sayisi", "acknowledgementCount", "number"],
    ["saglayici_durumu", "providerStatus"], ["saglayici_hata_zamani", "providerFailedAt"],
    ["saglayici_mesaj_id", "providerMessageId"], ["saglayici_kabul_zamani", "providerAcceptedAt"], ["ek_adi", "attachmentName"],
  ] },
  studentAppAnnouncements: { tableName: "ogrenci_duyurulari", fields: [
    ["baslik", "title"], ["icerik", "content"], ["duyuru_tarihi", "date"], ["etiket", "tag"],
    ["kaynak", "source"], ["duyuru_turu", "announcementType"], ["alici_turu", "recipientType"],
    ["alici_ogrenci_id", "recipientStudentId"], ["alici_ogrenci_no", "recipientStudentNumber"],
    ["alici_ogrenci_ad_soyad", "recipientStudentName"], ["sinif_adi", "classroom"], ["sinav_adi", "examName"],
    ["ders_adi", "courseName"], ["sinav_tarihi", "examDate"], ["sinav_saati", "examTime"],
    ["dugme_basligi", "buttonTitle"], ["dugme_alt_basligi", "buttonSubtitle"], ["bina_adi", "buildingName"],
    ["salon_adi", "roomName"], ["sira_no", "seatNumber", "number"], ["gozetmen_ad_soyad", "supervisorName"],
    ["oturum_sirasi", "sessionIndex", "number"], ["kat_adi", "floorName"], ["plan_anahtari", "planKey"],
    ["kilitlenince_yayinlandi", "publishedOnLock", "boolean"], ["olusturulma_zamani", "createdAt"],
    ["veri_guncellenme_zamani", "updatedAt"], ["sona_erme_zamani", "expiresAt"],
  ] },
  surveyInvitations: { tableName: "anket_davetleri", fields: [
    ["anket_anahtari", "surveyToken"], ["davet_anahtari", "inviteToken"], ["alici_id", "recipientId"],
    ["alici_ad_soyad", "recipientName"], ["alici_rolu", "role"], ["sinif_adi", "classroom"],
    ["telefon", "phone"], ["baglanti", "url"], ["olusturulma_zamani", "createdAt"],
  ] },
  teacherAppMessages: { tableName: "ogretmen_mesajlari", fields: [
    ["baglanti_anahtari", "linkToken"], ["uygulama_okul_id", "schoolId"], ["ogretmen_id", "teacherId"],
    ["ogretmen_ad_soyad", "teacherName"], ["baslik", "title"], ["mesaj", "body"], ["alici_turu", "recipientType"],
    ["alici_sayisi", "recipientCount", "number"], ["olusturulma_zamani", "createdAt"], ["durum", "status"],
    ["kaynak", "source"], ["sinav_adi", "examName"], ["sinav_tarihi", "examDate"], ["oturum_sirasi", "sessionIndex", "number"],
  ] },
  teacherAppMessageReceipts: { tableName: "ogretmen_mesaj_okumalari", fields: [
    ["mesaj_id", "messageId"], ["ogrenci_id", "studentId"], ["ogrenci_ad_soyad", "studentName"],
    ["ogrenci_no", "studentNumber"], ["sinif_adi", "classroom"], ["alici_turu", "recipientType"],
    ["ilk_acilma_zamani", "openedAt"], ["son_acilma_zamani", "lastOpenedAt"], ["acilma_sayisi", "openCount", "number"],
    ["baglanti_anahtari", "linkToken"], ["uygulama_okul_id", "schoolId"], ["ogretmen_id", "teacherId"],
    ["ogretmen_ad_soyad", "teacherName"], ["gonderilme_zamani", "sentAt"], ["hatirlatma_sayisi", "reminderCount", "number"],
    ["kaynak", "source"],
  ] },
  publicPortalLinks: { tableName: "portal_baglantilari", fields: [
    ["portal_turu", "kind"], ["ogrenci_id", "studentId"], ["token_ozeti", "tokenHash"],
    ["kurtarma_anahtari", "recoverableToken"], ["ogrenci_ad_soyad", "studentName"], ["ogrenci_no", "studentNumber"],
    ["sinif_adi", "classroom"], ["telefon", "phone"], ["olusturulma_zamani", "createdAt"],
    ["veri_guncellenme_zamani", "updatedAt"], ["iptal_zamani", "revokedAt"], ["uygulama_okul_id", "schoolId"],
  ] },
  publishedEducationNews: { tableName: "egitim_haberleri", fields: [
    ["dis_kaynak_id", "externalId"], ["uygulama_okul_id", "schoolId"], ["kaynak", "source"],
    ["baslik", "title"], ["baglanti", "url"], ["icerik", "content"], ["yayinlanma_zamani", "publishedAt"],
    ["haber_tarihi", "date"], ["haber_saati", "time"], ["yayinlayan", "publishedBy"],
    ["secilme_zamani", "selectedAt"], ["aktif", "active", "boolean"],
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

export function relationalCommunicationCollectionInfo(collectionName: string) {
  return CONFIGS[collectionName] || null;
}

export async function ensureRelationalCommunicationsSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-communications-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel iletişim şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/).map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalCommunicationsReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_COMMUNICATIONS_MIGRATION_KEY]);
  return result.rowCount > 0;
}

const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error("İletişim kayıtları için etkin okul bulunamadı.");
  return schoolId;
};

const insertBatch = async (client: Awaited<ReturnType<typeof pool.connect>>, collectionName: string,
  schoolId: string, documents: SourceDocument[]) => {
  const config = CONFIGS[collectionName];
  const columns = ["okul_id", "kayit_id", ...config.fields.map(([column]) => column), "guncellenme_zamani"];
  const updateColumns = [...config.fields.map(([column]) => column), "guncellenme_zamani"];
  for (let offset = 0; offset < documents.length; offset += 200) {
    const batch = documents.slice(offset, offset + 200);
    const placeholders = batch.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    const parameters = batch.flatMap((row) => [schoolId, row.documentId,
      ...config.fields.map(([, key, kind]) => fieldValue(row.data, key, kind)), isoDate(row.updatedAt)]);
    await client.query(`INSERT INTO ${config.tableName} (${columns.join(",")}) VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE ${updateColumns.map((column) => `${column}=VALUES(${column})`).join(",")}`, parameters);
  }
};

const replaceAnnouncementChildren = async (client: Awaited<ReturnType<typeof pool.connect>>, schoolId: string, row: SourceDocument) => {
  const exams = Array.isArray(row.data?.exams) ? row.data.exams : [];
  const roomAssignments = Array.isArray(row.data?.roomAssignments) ? row.data.roomAssignments : [];
  for (const [examIndex, exam] of exams.entries()) {
    await client.query(`INSERT INTO ogrenci_duyuru_sinavlari
      (okul_id, duyuru_id, sinav_sirasi, sinif_duzeyi, ders_adi) VALUES (?, ?, ?, ?, ?)`,
    [schoolId, row.documentId, examIndex + 1, fieldValue(exam, "gradeLevel"), fieldValue(exam, "courseName")]);
    const classrooms = Array.isArray(exam?.classrooms) ? exam.classrooms : [];
    for (const [classIndex, classroom] of classrooms.entries()) {
      await client.query(`INSERT INTO ogrenci_duyuru_siniflari
        (okul_id, duyuru_id, sinav_sirasi, sinif_sirasi, sinif_adi) VALUES (?, ?, ?, ?, ?)`,
      [schoolId, row.documentId, examIndex + 1, classIndex + 1, String(classroom)]);
    }
  }
  for (const [roomIndex, room] of roomAssignments.entries()) {
    await client.query(`INSERT INTO ogrenci_duyuru_salonlari
      (okul_id, duyuru_id, salon_sirasi, salon_adi, bina_adi, kat_adi, ogretmen_ad_soyad) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, row.documentId, roomIndex + 1, fieldValue(room, "roomName"), fieldValue(room, "buildingName"),
      fieldValue(room, "floorName"), fieldValue(room, "teacherName")]);
  }
};

export async function replaceRelationalCommunicationCollection(collectionName: string, documents: SourceDocument[]) {
  const config = CONFIGS[collectionName];
  if (!config) throw new Error(`İlişkisel iletişim koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await client.query(`DELETE FROM ${config.tableName} WHERE okul_id=?`, [schoolId]);
    await insertBatch(client, collectionName, schoolId, documents);
    if (collectionName === "studentAppAnnouncements") {
      for (const row of documents) await replaceAnnouncementChildren(client, schoolId, row);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function upsertRelationalCommunicationDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  const config = CONFIGS[collectionName];
  if (!config) throw new Error(`İlişkisel iletişim koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await insertBatch(client, collectionName, schoolId, [{ documentId, data, updatedAt }]);
    if (collectionName === "studentAppAnnouncements") {
      await client.query("DELETE FROM ogrenci_duyuru_sinavlari WHERE okul_id=? AND duyuru_id=?", [schoolId, documentId]);
      await client.query("DELETE FROM ogrenci_duyuru_salonlari WHERE okul_id=? AND duyuru_id=?", [schoolId, documentId]);
      await replaceAnnouncementChildren(client, schoolId, { documentId, data, updatedAt });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function deleteRelationalCommunicationDocument(collectionName: string, documentId: string) {
  const config = CONFIGS[collectionName];
  if (!config) throw new Error(`İlişkisel iletişim koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  await pool.query(`DELETE FROM ${config.tableName} WHERE okul_id=? AND kayit_id=?`, [schoolId, documentId]);
}

export async function loadRelationalCommunicationDocuments(): Promise<RelationalDocument[]> {
  const schoolId = await primarySchoolId();
  const result: RelationalDocument[] = [];
  const announcementRows = new Map<string, any>();
  for (const [collectionName, config] of Object.entries(CONFIGS)) {
    const query = await pool.query(`SELECT * FROM ${config.tableName} WHERE okul_id=? ORDER BY guncellenme_zamani, kayit_id`, [schoolId]);
    for (const row of query.rows) {
      const data: Record<string, unknown> = { id: String(row.kayit_id) };
      for (const [column, key, kind] of config.fields) {
        if (row[column] !== null && row[column] !== undefined) data[key] = restoredValue(row[column], kind);
      }
      result.push({ collectionName, documentId: String(row.kayit_id), data, updatedAt: String(row.guncellenme_zamani) });
      if (collectionName === "studentAppAnnouncements") announcementRows.set(String(row.kayit_id), data);
    }
  }
  if (announcementRows.size) {
    const [exams, classes, rooms] = await Promise.all([
      pool.query("SELECT * FROM ogrenci_duyuru_sinavlari WHERE okul_id=? ORDER BY duyuru_id, sinav_sirasi", [schoolId]),
      pool.query("SELECT * FROM ogrenci_duyuru_siniflari WHERE okul_id=? ORDER BY duyuru_id, sinav_sirasi, sinif_sirasi", [schoolId]),
      pool.query("SELECT * FROM ogrenci_duyuru_salonlari WHERE okul_id=? ORDER BY duyuru_id, salon_sirasi", [schoolId]),
    ]);
    const classesByExam = new Map<string, string[]>();
    for (const row of classes.rows) {
      const key = `${row.duyuru_id}\u0000${row.sinav_sirasi}`;
      classesByExam.set(key, [...(classesByExam.get(key) || []), String(row.sinif_adi)]);
    }
    for (const row of exams.rows) {
      const data = announcementRows.get(String(row.duyuru_id));
      if (!data) continue;
      const exam = { gradeLevel: row.sinif_duzeyi, courseName: row.ders_adi,
        classrooms: classesByExam.get(`${row.duyuru_id}\u0000${row.sinav_sirasi}`) || [] };
      data.exams = [...(data.exams || []), exam];
    }
    for (const row of rooms.rows) {
      const data = announcementRows.get(String(row.duyuru_id));
      if (!data) continue;
      data.roomAssignments = [...(data.roomAssignments || []), {
        roomName: row.salon_adi, buildingName: row.bina_adi, floorName: row.kat_adi, teacherName: row.ogretmen_ad_soyad,
      }];
    }
  }
  return result;
}
