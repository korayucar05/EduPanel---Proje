import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_QUESTION_BANK_AUX_MIGRATION_KEY = "documents-question-bank-aux-relational-v1";
const collections = new Set(["questionBankUsage", "questionBankAudit", "questionBankGroups", "questionBankImportSessions"]);
type SourceDocument = { documentId: string; data: any; updatedAt: string };
type RelationalDocument = SourceDocument & { collectionName: string };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;

export const relationalQuestionBankAuxCollectionInfo = (name: string) => collections.has(name);
const mysqlDateTime = (value: unknown) => {
  const parsed = new Date(String(value || ""));
  return (Number.isFinite(parsed.getTime()) ? parsed : new Date()).toISOString().replace("T", " ").replace("Z", "");
};
const isoDate = (value: unknown) => {
  const parsed = new Date(String(value || ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
};

export async function ensureRelationalQuestionBankAuxSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-question-bank-aux-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`Soru bankası yardımcı şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/).map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalQuestionBankAuxReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_QUESTION_BANK_AUX_MIGRATION_KEY]);
  return result.rowCount > 0;
}

type DetailRow = { path: string; type: string; text: string | null; number: number | null; boolean: number | null };
const flattenDetails = (value: any, prefix = "", rows: DetailRow[] = []): DetailRow[] => {
  if (value === null || value === undefined) rows.push({ path: prefix, type: "null", text: null, number: null, boolean: null });
  else if (Array.isArray(value)) value.forEach((item, index) => flattenDetails(item, `${prefix}[${index}]`, rows));
  else if (typeof value === "object") Object.entries(value).forEach(([key, item]) => flattenDetails(item, prefix ? `${prefix}.${key}` : key, rows));
  else if (typeof value === "number") rows.push({ path: prefix, type: "number", text: null, number: value, boolean: null });
  else if (typeof value === "boolean") rows.push({ path: prefix, type: "boolean", text: null, number: null, boolean: value ? 1 : 0 });
  else rows.push({ path: prefix, type: "string", text: String(value), number: null, boolean: null });
  return rows;
};
const assignPath = (target: any, pathValue: string, value: any) => {
  const parts = pathValue.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cursor = target;
  parts.forEach((part, index) => {
    const last = index === parts.length - 1;
    if (last) cursor[part] = value;
    else {
      const arrayNext = /^\d+$/.test(parts[index + 1]);
      if (cursor[part] == null) cursor[part] = arrayNext ? [] : {};
      cursor = cursor[part];
    }
  });
};
const detailValue = (row: any) => row.deger_turu === "number" ? Number(row.sayi_degeri)
  : row.deger_turu === "boolean" ? Boolean(row.mantiksal_deger)
    : row.deger_turu === "null" ? null : String(row.metin_degeri ?? "");

const writeDocument = async (client: QueryClient, collectionName: string, row: SourceDocument) => {
  const data = row.data || {};
  if (collectionName === "questionBankUsage") {
    await client.query(`INSERT INTO soru_bankasi_kullanimlari
      (kullanim_id,soru_id,soru_kodu,sinav_id,sinav_adi,sinav_tarihi,kitapcik_turu,soru_numarasi,kaynak,kullanilma_zamani)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE soru_id=VALUES(soru_id),soru_kodu=VALUES(soru_kodu),
      sinav_id=VALUES(sinav_id),sinav_adi=VALUES(sinav_adi),sinav_tarihi=VALUES(sinav_tarihi),
      kitapcik_turu=VALUES(kitapcik_turu),soru_numarasi=VALUES(soru_numarasi),kaynak=VALUES(kaynak),
      kullanilma_zamani=VALUES(kullanilma_zamani)`, [row.documentId, String(data.questionId || ""), String(data.questionCode || ""),
      String(data.examId || ""), String(data.examName || ""), data.examDate || null, data.bookType || null,
      Number(data.questionNumber || 0) || null, String(data.source || ""), mysqlDateTime(data.usedAt || row.updatedAt)]);
    return;
  }
  if (collectionName === "questionBankGroups") {
    await client.query(`INSERT INTO soru_bankasi_gruplari
      (grup_belge_id,grup_id,grup_modu,yerlesim,baslik,yonerge_metni,yonerge_gorsel_adresi,yonerge_soru_id,olusturma_zamani,guncellenme_zamani)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE grup_id=VALUES(grup_id),grup_modu=VALUES(grup_modu),
      yerlesim=VALUES(yerlesim),baslik=VALUES(baslik),yonerge_metni=VALUES(yonerge_metni),
      yonerge_gorsel_adresi=VALUES(yonerge_gorsel_adresi),yonerge_soru_id=VALUES(yonerge_soru_id),guncellenme_zamani=VALUES(guncellenme_zamani)`,
      [row.documentId, String(data.id || row.documentId), String(data.mode || "required"), String(data.layout || "normal"), data.title || null,
        data.instructionText || null, data.instructionImageUrl || null, data.instructionQuestionId || null,
        mysqlDateTime(data.createdAt || row.updatedAt), mysqlDateTime(data.updatedAt || row.updatedAt)]);
    await client.query("DELETE FROM soru_bankasi_grup_sorulari WHERE grup_belge_id=?", [row.documentId]);
    for (const [index, questionId] of (Array.isArray(data.questionIds) ? data.questionIds : []).entries()) {
      await client.query("INSERT INTO soru_bankasi_grup_sorulari (grup_belge_id,soru_id,sira_no) VALUES (?,?,?)", [row.documentId, String(questionId), index]);
    }
    return;
  }
  if (collectionName === "questionBankAudit") {
    await client.query(`INSERT INTO soru_bankasi_islem_kayitlari
      (islem_id,soru_id,islem_turu,yedekten_geri_yukleme_id,olusturma_zamani) VALUES (?,?,?,?,?)
      ON DUPLICATE KEY UPDATE soru_id=VALUES(soru_id),islem_turu=VALUES(islem_turu),
      yedekten_geri_yukleme_id=VALUES(yedekten_geri_yukleme_id),olusturma_zamani=VALUES(olusturma_zamani)`,
      [row.documentId, String(data.questionId || ""), String(data.action || ""), data.restoredFromBackupId || null,
        mysqlDateTime(data.createdAt || row.updatedAt)]);
    await client.query("DELETE FROM soru_bankasi_islem_ayrintilari WHERE islem_id=?", [row.documentId]);
    for (const detail of flattenDetails(data.payload || {})) await client.query(`INSERT INTO soru_bankasi_islem_ayrintilari
      (islem_id,alan_yolu,deger_turu,metin_degeri,sayi_degeri,mantiksal_deger) VALUES (?,?,?,?,?,?)`,
      [row.documentId, detail.path, detail.type, detail.text, detail.number, detail.boolean]);
    return;
  }
  await client.query(`INSERT INTO soru_bankasi_ice_aktarma_oturumlari
    (oturum_id,etiket,kaynak,sinif_seviyesi,ders_sayisi,beklenen_dosya_sayisi,beklenen_kazanim_sayisi,
     aktarilan_dosya_sayisi,tamamlanan_kazanim_sayisi,basarisiz_grup_sayisi,geri_alinan_soru_sayisi,
     geri_alinamayan_soru_sayisi,durum,geri_alma_zamani,olusturma_zamani,guncellenme_zamani)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE etiket=VALUES(etiket),kaynak=VALUES(kaynak),
    sinif_seviyesi=VALUES(sinif_seviyesi),ders_sayisi=VALUES(ders_sayisi),beklenen_dosya_sayisi=VALUES(beklenen_dosya_sayisi),
    beklenen_kazanim_sayisi=VALUES(beklenen_kazanim_sayisi),aktarilan_dosya_sayisi=VALUES(aktarilan_dosya_sayisi),
    tamamlanan_kazanim_sayisi=VALUES(tamamlanan_kazanim_sayisi),basarisiz_grup_sayisi=VALUES(basarisiz_grup_sayisi),
    geri_alinan_soru_sayisi=VALUES(geri_alinan_soru_sayisi),geri_alinamayan_soru_sayisi=VALUES(geri_alinamayan_soru_sayisi),
    durum=VALUES(durum),geri_alma_zamani=VALUES(geri_alma_zamani),guncellenme_zamani=VALUES(guncellenme_zamani)`,
    [row.documentId, String(data.label || ""), String(data.source || ""), Number(data.grade || 0) || null,
      Number(data.courseCount || 0), Number(data.expectedFiles || 0), Number(data.expectedOutcomes || 0), Number(data.importedFiles || 0),
      Number(data.completedOutcomes || 0), Number(data.failedGroups || 0), Number(data.rolledBack || 0), Number(data.rollbackFailed || 0),
      String(data.status || "running"), data.rollbackAt ? mysqlDateTime(data.rollbackAt) : null,
      mysqlDateTime(data.createdAt || row.updatedAt), mysqlDateTime(data.updatedAt || row.updatedAt)]);
};

const tableFor = (collectionName: string) => ({
  questionBankUsage: "soru_bankasi_kullanimlari",
  questionBankAudit: "soru_bankasi_islem_kayitlari",
  questionBankGroups: "soru_bankasi_gruplari",
  questionBankImportSessions: "soru_bankasi_ice_aktarma_oturumlari",
} as Record<string, string>)[collectionName];

export async function replaceRelationalQuestionBankAuxCollection(collectionName: string, documents: SourceDocument[]) {
  if (!relationalQuestionBankAuxCollectionInfo(collectionName)) throw new Error(`Desteklenmeyen soru bankası koleksiyonu: ${collectionName}`);
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await client.query(`DELETE FROM ${tableFor(collectionName)}`);
    for (const row of documents) await writeDocument(client, collectionName, row);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function upsertRelationalQuestionBankAuxDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  if (!relationalQuestionBankAuxCollectionInfo(collectionName)) throw new Error(`Desteklenmeyen soru bankası koleksiyonu: ${collectionName}`);
  const client = await pool.connect();
  try { await client.query("START TRANSACTION"); await writeDocument(client, collectionName, { documentId, data, updatedAt }); await client.query("COMMIT"); }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function deleteRelationalQuestionBankAuxDocument(collectionName: string, documentId: string) {
  if (!relationalQuestionBankAuxCollectionInfo(collectionName)) throw new Error(`Desteklenmeyen soru bankası koleksiyonu: ${collectionName}`);
  const key = ({ questionBankUsage: "kullanim_id", questionBankAudit: "islem_id", questionBankGroups: "grup_belge_id", questionBankImportSessions: "oturum_id" } as Record<string, string>)[collectionName];
  await pool.query(`DELETE FROM ${tableFor(collectionName)} WHERE ${key}=?`, [documentId]);
}

export async function loadRelationalQuestionBankAuxDocuments(): Promise<RelationalDocument[]> {
  const output: RelationalDocument[] = [];
  const usage = await pool.query("SELECT * FROM soru_bankasi_kullanimlari ORDER BY kullanilma_zamani,kullanim_id");
  usage.rows.forEach((row: any) => output.push({ collectionName: "questionBankUsage", documentId: String(row.kullanim_id), updatedAt: isoDate(row.kullanilma_zamani), data: {
    id: String(row.kullanim_id), questionId: String(row.soru_id), questionCode: String(row.soru_kodu || ""), examId: String(row.sinav_id), examName: String(row.sinav_adi || ""),
    examDate: row.sinav_tarihi || null, bookType: row.kitapcik_turu || null, questionNumber: row.soru_numarasi == null ? null : Number(row.soru_numarasi), source: String(row.kaynak || ""), usedAt: isoDate(row.kullanilma_zamani),
  }}));
  const groups = await pool.query(`SELECT g.*,m.soru_id,m.sira_no FROM soru_bankasi_gruplari g
    LEFT JOIN soru_bankasi_grup_sorulari m ON m.grup_belge_id=g.grup_belge_id ORDER BY g.grup_belge_id,m.sira_no`);
  const groupMap = new Map<string, RelationalDocument>();
  groups.rows.forEach((row: any) => {
    const id = String(row.grup_belge_id); let item = groupMap.get(id);
    if (!item) { item = { collectionName: "questionBankGroups", documentId: id, updatedAt: isoDate(row.guncellenme_zamani), data: {
      id: String(row.grup_id), mode: String(row.grup_modu), layout: String(row.yerlesim), title: row.baslik || undefined,
      instructionText: row.yonerge_metni || undefined, instructionImageUrl: row.yonerge_gorsel_adresi || undefined,
      instructionQuestionId: row.yonerge_soru_id || undefined, questionIds: [], createdAt: isoDate(row.olusturma_zamani), updatedAt: isoDate(row.guncellenme_zamani),
    }}; groupMap.set(id, item); }
    if (row.soru_id != null) item.data.questionIds.push(String(row.soru_id));
  });
  output.push(...groupMap.values());
  const audits = await pool.query(`SELECT a.*,d.alan_yolu,d.deger_turu,d.metin_degeri,d.sayi_degeri,d.mantiksal_deger
    FROM soru_bankasi_islem_kayitlari a LEFT JOIN soru_bankasi_islem_ayrintilari d ON d.islem_id=a.islem_id
    ORDER BY a.olusturma_zamani,a.islem_id,d.alan_yolu`);
  const auditMap = new Map<string, RelationalDocument>();
  audits.rows.forEach((row: any) => {
    const id = String(row.islem_id); let item = auditMap.get(id);
    if (!item) { item = { collectionName: "questionBankAudit", documentId: id, updatedAt: isoDate(row.olusturma_zamani), data: {
      id, questionId: String(row.soru_id), action: String(row.islem_turu), payload: {}, createdAt: isoDate(row.olusturma_zamani), ...(row.yedekten_geri_yukleme_id ? { restoredFromBackupId: String(row.yedekten_geri_yukleme_id) } : {}),
    }}; auditMap.set(id, item); }
    if (row.alan_yolu != null) assignPath(item.data.payload, String(row.alan_yolu), detailValue(row));
  });
  output.push(...auditMap.values());
  const sessions = await pool.query("SELECT * FROM soru_bankasi_ice_aktarma_oturumlari ORDER BY olusturma_zamani,oturum_id");
  sessions.rows.forEach((row: any) => output.push({ collectionName: "questionBankImportSessions", documentId: String(row.oturum_id), updatedAt: isoDate(row.guncellenme_zamani), data: {
    id: String(row.oturum_id), label: String(row.etiket), source: String(row.kaynak), grade: row.sinif_seviyesi == null ? null : Number(row.sinif_seviyesi), courseCount: Number(row.ders_sayisi),
    expectedFiles: Number(row.beklenen_dosya_sayisi), expectedOutcomes: Number(row.beklenen_kazanim_sayisi), importedFiles: Number(row.aktarilan_dosya_sayisi), completedOutcomes: Number(row.tamamlanan_kazanim_sayisi), failedGroups: Number(row.basarisiz_grup_sayisi),
    rolledBack: Number(row.geri_alinan_soru_sayisi), rollbackFailed: Number(row.geri_alinamayan_soru_sayisi), status: String(row.durum), rollbackAt: row.geri_alma_zamani ? isoDate(row.geri_alma_zamani) : undefined, createdAt: isoDate(row.olusturma_zamani), updatedAt: isoDate(row.guncellenme_zamani),
  }}));
  return output;
}
