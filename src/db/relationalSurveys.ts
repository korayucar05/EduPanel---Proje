import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_SURVEYS_MIGRATION_KEY = "sqlite-relational-surveys-v1";
const COLLECTIONS = new Set([
  "surveys", "publishedSurveys", "surveyResponses", "surveySubmissions",
  "parentConsentCampaigns", "parentConsentRows", "parentConsents",
]);

export type SurveySourceDocument = { documentId: string; data: any; updatedAt: string };
export type SurveyRelationalDocument = SurveySourceDocument & { collectionName: string };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;

const stringValue = (value: unknown) => value === undefined || value === null ? null : String(value);
const numberValue = (value: unknown) => value === undefined || value === null || !Number.isFinite(Number(value)) ? null : Number(value);
const booleanValue = (value: unknown) => value === undefined || value === null ? null
  : (value === true || value === 1 || value === "1" || value === "true" ? 1 : 0);
const arrayValue = (value: unknown) => Array.isArray(value) ? value : [];
const isoDate = (raw: unknown) => {
  const parsed = raw instanceof Date ? raw : new Date(String(raw || ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};
const assign = (target: Record<string, unknown>, key: string, value: unknown, kind: "string" | "number" | "boolean" = "string") => {
  if (value === null || value === undefined) return;
  target[key] = kind === "number" ? Number(value) : kind === "boolean" ? Boolean(value) : value;
};

export function relationalSurveyCollectionInfo(collectionName: string) {
  return COLLECTIONS.has(collectionName) ? collectionName : null;
}

export async function ensureRelationalSurveysSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-surveys-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel anket şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/).map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalSurveysReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_SURVEYS_MIGRATION_KEY]);
  return result.rowCount > 0;
}

const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error("Anket kayıtları için etkin okul bulunamadı.");
  return schoolId;
};

const writeSurvey = async (client: QueryClient, schoolId: string, collectionName: string, row: SurveySourceDocument) => {
  const data = row.data || {};
  const recordType = collectionName === "publishedSurveys" ? "yayin" : "taslak";
  await client.query(`INSERT INTO anketler
    (okul_id, kayit_turu, anket_id, baslik, aciklama, sona_erme_zamani, coklu_cevaba_izin,
     son_yayin_anahtari, veri_guncellenme_zamani, aktif_anket_id, yayin_anahtari, yayinlanma_zamani,
     durum, guncellenme_zamani)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE baslik=VALUES(baslik), aciklama=VALUES(aciklama), sona_erme_zamani=VALUES(sona_erme_zamani),
      coklu_cevaba_izin=VALUES(coklu_cevaba_izin), son_yayin_anahtari=VALUES(son_yayin_anahtari),
      veri_guncellenme_zamani=VALUES(veri_guncellenme_zamani), aktif_anket_id=VALUES(aktif_anket_id),
      yayin_anahtari=VALUES(yayin_anahtari), yayinlanma_zamani=VALUES(yayinlanma_zamani),
      durum=VALUES(durum), guncellenme_zamani=VALUES(guncellenme_zamani)`, [
    schoolId, recordType, row.documentId, stringValue(data.title), stringValue(data.description), stringValue(data.expiresAt),
    booleanValue(data.allowMultipleResponses) ?? 0, stringValue(data.lastPublishedToken), stringValue(data.updatedAt),
    stringValue(data.activeSurveyId), stringValue(data.token), stringValue(data.publishedAt), stringValue(data.status), isoDate(row.updatedAt),
  ]);
  await client.query("DELETE FROM anket_hedef_kitleleri WHERE okul_id=? AND kayit_turu=? AND anket_id=?", [schoolId, recordType, row.documentId]);
  await client.query("DELETE FROM anket_secili_alicilari WHERE okul_id=? AND kayit_turu=? AND anket_id=?", [schoolId, recordType, row.documentId]);
  await client.query("DELETE FROM anket_secili_siniflari WHERE okul_id=? AND kayit_turu=? AND anket_id=?", [schoolId, recordType, row.documentId]);
  await client.query("DELETE FROM anket_sorulari WHERE okul_id=? AND kayit_turu=? AND anket_id=?", [schoolId, recordType, row.documentId]);
  for (const [index, audience] of arrayValue(data.audiences).entries()) {
    await client.query("INSERT INTO anket_hedef_kitleleri VALUES (?, ?, ?, ?, ?)", [schoolId, recordType, row.documentId, index + 1, String(audience)]);
  }
  for (const [index, recipientId] of arrayValue(data.selectedRecipientIds).entries()) {
    await client.query("INSERT INTO anket_secili_alicilari VALUES (?, ?, ?, ?, ?)", [schoolId, recordType, row.documentId, index + 1, String(recipientId)]);
  }
  for (const [index, classroom] of arrayValue(data.selectedClassrooms).entries()) {
    await client.query("INSERT INTO anket_secili_siniflari VALUES (?, ?, ?, ?, ?)", [schoolId, recordType, row.documentId, index + 1, String(classroom)]);
  }
  for (const [questionIndex, question] of arrayValue(data.questions).entries()) {
    const questionId = String(question?.id || `soru-${questionIndex + 1}`);
    await client.query(`INSERT INTO anket_sorulari
      (okul_id, kayit_turu, anket_id, soru_id, sira_no, soru_metni, cevap_turu, zorunlu)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [schoolId, recordType, row.documentId, questionId, questionIndex + 1,
      stringValue(question?.text), stringValue(question?.answerType), booleanValue(question?.required) ?? 0]);
    for (const [optionIndex, option] of arrayValue(question?.options).entries()) {
      await client.query(`INSERT INTO anket_soru_secenekleri
        (okul_id, kayit_turu, anket_id, soru_id, sira_no, secenek_metni) VALUES (?, ?, ?, ?, ?, ?)`,
      [schoolId, recordType, row.documentId, questionId, optionIndex + 1, String(option)]);
    }
  }
};

const writeSurveyResponse = async (client: QueryClient, schoolId: string, row: SurveySourceDocument) => {
  await client.query(`INSERT INTO anket_soru_toplu_cevap_kayitlari (okul_id, kayit_id, soru_id, guncellenme_zamani)
    VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE soru_id=VALUES(soru_id), guncellenme_zamani=VALUES(guncellenme_zamani)`,
  [schoolId, row.documentId, stringValue(row.data?.questionId || row.data?.id) || row.documentId, isoDate(row.updatedAt)]);
  await client.query("DELETE FROM anket_soru_toplu_cevaplari WHERE okul_id=? AND kayit_id=?", [schoolId, row.documentId]);
  for (const [index, answer] of arrayValue(row.data?.answers).entries()) {
    await client.query("INSERT INTO anket_soru_toplu_cevaplari VALUES (?, ?, ?, ?)", [schoolId, row.documentId, index + 1, stringValue(answer)]);
  }
};

const writeSurveySubmission = async (client: QueryClient, schoolId: string, row: SurveySourceDocument) => {
  const data = row.data || {};
  await client.query(`INSERT INTO anket_gonderimleri
    (okul_id, gonderim_id, anket_anahtari, cevaplayan_anahtari, davet_anahtari, alici_id,
     alici_ad_soyad, alici_rolu, sinif_adi, gonderilme_zamani, guncellenme_zamani)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE anket_anahtari=VALUES(anket_anahtari), cevaplayan_anahtari=VALUES(cevaplayan_anahtari),
      davet_anahtari=VALUES(davet_anahtari), alici_id=VALUES(alici_id), alici_ad_soyad=VALUES(alici_ad_soyad),
      alici_rolu=VALUES(alici_rolu), sinif_adi=VALUES(sinif_adi), gonderilme_zamani=VALUES(gonderilme_zamani),
      guncellenme_zamani=VALUES(guncellenme_zamani)`, [schoolId, row.documentId, stringValue(data.token),
    stringValue(data.respondentKey), stringValue(data.invitationToken), stringValue(data.recipientId),
    stringValue(data.recipientName), stringValue(data.role), stringValue(data.classroom), stringValue(data.submittedAt), isoDate(row.updatedAt)]);
  await client.query("DELETE FROM anket_gonderim_cevaplari WHERE okul_id=? AND gonderim_id=?", [schoolId, row.documentId]);
  for (const [questionId, rawAnswers] of Object.entries(data.answers || {})) {
    const answers = Array.isArray(rawAnswers) ? rawAnswers : [rawAnswers];
    for (const [index, answer] of answers.entries()) {
      await client.query("INSERT INTO anket_gonderim_cevaplari VALUES (?, ?, ?, ?, ?)",
        [schoolId, row.documentId, questionId, index + 1, stringValue(answer)]);
    }
  }
};

const writeCampaign = async (client: QueryClient, schoolId: string, row: SurveySourceDocument) => {
  const data = row.data || {};
  const summary = data.notificationSummary || {};
  await client.query(`INSERT INTO veli_onay_kampanyalari
    (okul_id, kampanya_id, baslik, aciklama, mudur_ad_soyad, etkinlik_tarihi, sona_erme_zamani,
     olusturulma_zamani, olusturan, veri_guncellenme_zamani, durum, son_bildirim_zamani,
     bildirim_toplam, bildirim_gonderilen, bildirim_basarisiz, guncellenme_zamani)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE baslik=VALUES(baslik), aciklama=VALUES(aciklama), mudur_ad_soyad=VALUES(mudur_ad_soyad),
      etkinlik_tarihi=VALUES(etkinlik_tarihi), sona_erme_zamani=VALUES(sona_erme_zamani),
      olusturulma_zamani=VALUES(olusturulma_zamani), olusturan=VALUES(olusturan),
      veri_guncellenme_zamani=VALUES(veri_guncellenme_zamani), durum=VALUES(durum),
      son_bildirim_zamani=VALUES(son_bildirim_zamani), bildirim_toplam=VALUES(bildirim_toplam),
      bildirim_gonderilen=VALUES(bildirim_gonderilen), bildirim_basarisiz=VALUES(bildirim_basarisiz),
      guncellenme_zamani=VALUES(guncellenme_zamani)`, [schoolId, row.documentId, stringValue(data.title),
    stringValue(data.description), stringValue(data.principalName), stringValue(data.eventDate), stringValue(data.expiresAt),
    stringValue(data.createdAt), stringValue(data.createdBy), stringValue(data.updatedAt), stringValue(data.status),
    stringValue(data.lastNotificationAt), numberValue(summary.total), numberValue(summary.sent), numberValue(summary.failed), isoDate(row.updatedAt)]);
  await client.query("DELETE FROM veli_onay_kampanya_hedefleri WHERE okul_id=? AND kampanya_id=?", [schoolId, row.documentId]);
  for (const [index, target] of arrayValue(data.targets).entries()) {
    await client.query(`INSERT INTO veli_onay_kampanya_hedefleri
      (okul_id, kampanya_id, hedef_id, ogrenci_ad_soyad, ogrenci_no, sinif_adi, veli_ad_soyad,
       veli_telefon, durum, cevap_zamani, cevaplayan_adi, cevap_ip, cevap_tarayici, sira_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [schoolId, row.documentId,
      String(target?.id || `hedef-${index + 1}`), stringValue(target?.name), stringValue(target?.number),
      stringValue(target?.classroom), stringValue(target?.parentName), stringValue(target?.parentPhone),
      stringValue(target?.status), stringValue(target?.respondedAt), stringValue(target?.parentDisplayName),
      stringValue(target?.responseIp), stringValue(target?.responseUserAgent), index + 1]);
  }
};

const writeConsentRow = async (client: QueryClient, schoolId: string, row: SurveySourceDocument) => {
  const data = row.data || {};
  await client.query(`INSERT INTO veli_onay_satirlari
    (okul_id, kayit_id, kampanya_id, ogrenci_id, ogrenci_ad_soyad, ogrenci_no, sinif_adi,
     veli_telefon, durum, olusturulma_zamani, cevap_zamani, cevap_ip, cevap_tarayici, guncellenme_zamani)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE kampanya_id=VALUES(kampanya_id), ogrenci_id=VALUES(ogrenci_id),
      ogrenci_ad_soyad=VALUES(ogrenci_ad_soyad), ogrenci_no=VALUES(ogrenci_no), sinif_adi=VALUES(sinif_adi),
      veli_telefon=VALUES(veli_telefon), durum=VALUES(durum), olusturulma_zamani=VALUES(olusturulma_zamani),
      cevap_zamani=VALUES(cevap_zamani), cevap_ip=VALUES(cevap_ip), cevap_tarayici=VALUES(cevap_tarayici),
      guncellenme_zamani=VALUES(guncellenme_zamani)`, [schoolId, row.documentId, stringValue(data.campaignId),
    stringValue(data.studentId), stringValue(data.studentName), stringValue(data.studentNumber), stringValue(data.classroom),
    stringValue(data.parentPhone), stringValue(data.status), stringValue(data.createdAt), stringValue(data.respondedAt),
    stringValue(data.responseIp), stringValue(data.responseUserAgent), isoDate(row.updatedAt)]);
};

const writeConsent = async (client: QueryClient, schoolId: string, row: SurveySourceDocument) => {
  const data = row.data || {};
  await client.query(`INSERT INTO veli_onaylari
    (okul_id, onay_id, genel_anahtar_ozeti, kurtarma_anahtari, ogrenci_id, ogrenci_ad_soyad,
     ogrenci_no, sinif_adi, veli_telefon, baslik, aciklama, etkinlik_tarihi, sona_erme_zamani,
     durum, olusturulma_zamani, portal_baglantisi, tek_kullanimlik_sifre_ozeti,
     sifre_sona_erme_zamani, sifre_deneme_sayisi, son_bildirim_zamani, son_bildirim_basarili,
     son_bildirim_hatasi, sifre_istenme_zamani, karar, cevap_zamani, makbuz_no, kanit_ozeti, guncellenme_zamani)
    VALUES (${Array(28).fill("?").join(",")})
    ON DUPLICATE KEY UPDATE genel_anahtar_ozeti=VALUES(genel_anahtar_ozeti), kurtarma_anahtari=VALUES(kurtarma_anahtari),
      ogrenci_id=VALUES(ogrenci_id), ogrenci_ad_soyad=VALUES(ogrenci_ad_soyad), ogrenci_no=VALUES(ogrenci_no),
      sinif_adi=VALUES(sinif_adi), veli_telefon=VALUES(veli_telefon), baslik=VALUES(baslik), aciklama=VALUES(aciklama),
      etkinlik_tarihi=VALUES(etkinlik_tarihi), sona_erme_zamani=VALUES(sona_erme_zamani), durum=VALUES(durum),
      olusturulma_zamani=VALUES(olusturulma_zamani), portal_baglantisi=VALUES(portal_baglantisi),
      tek_kullanimlik_sifre_ozeti=VALUES(tek_kullanimlik_sifre_ozeti), sifre_sona_erme_zamani=VALUES(sifre_sona_erme_zamani),
      sifre_deneme_sayisi=VALUES(sifre_deneme_sayisi), son_bildirim_zamani=VALUES(son_bildirim_zamani),
      son_bildirim_basarili=VALUES(son_bildirim_basarili), son_bildirim_hatasi=VALUES(son_bildirim_hatasi),
      sifre_istenme_zamani=VALUES(sifre_istenme_zamani), karar=VALUES(karar), cevap_zamani=VALUES(cevap_zamani),
      makbuz_no=VALUES(makbuz_no), kanit_ozeti=VALUES(kanit_ozeti), guncellenme_zamani=VALUES(guncellenme_zamani)`, [
    schoolId, row.documentId, stringValue(data.publicTokenHash), stringValue(data.recoverablePublicToken),
    stringValue(data.studentId), stringValue(data.studentName), stringValue(data.studentNumber), stringValue(data.classroom),
    stringValue(data.parentPhone), stringValue(data.title), stringValue(data.description), stringValue(data.eventDate),
    stringValue(data.expiresAt), stringValue(data.status), stringValue(data.createdAt), stringValue(data.portalUrl),
    stringValue(data.otpHash), stringValue(data.otpExpiresAt), numberValue(data.otpAttempts), stringValue(data.lastNotificationAt),
    booleanValue(data.lastNotificationOk), stringValue(data.lastNotificationError), stringValue(data.otpRequestedAt),
    stringValue(data.decision), stringValue(data.respondedAt), stringValue(data.receiptNo), stringValue(data.evidenceHash), isoDate(row.updatedAt),
  ]);
};

const writer = (collectionName: string) => {
  if (collectionName === "surveys" || collectionName === "publishedSurveys") return writeSurvey;
  if (collectionName === "surveyResponses") return (_client: QueryClient, schoolId: string, _name: string, row: SurveySourceDocument) => writeSurveyResponse(_client, schoolId, row);
  if (collectionName === "surveySubmissions") return (_client: QueryClient, schoolId: string, _name: string, row: SurveySourceDocument) => writeSurveySubmission(_client, schoolId, row);
  if (collectionName === "parentConsentCampaigns") return (_client: QueryClient, schoolId: string, _name: string, row: SurveySourceDocument) => writeCampaign(_client, schoolId, row);
  if (collectionName === "parentConsentRows") return (_client: QueryClient, schoolId: string, _name: string, row: SurveySourceDocument) => writeConsentRow(_client, schoolId, row);
  return (_client: QueryClient, schoolId: string, _name: string, row: SurveySourceDocument) => writeConsent(_client, schoolId, row);
};

const deleteCollection = async (client: QueryClient, schoolId: string, collectionName: string) => {
  if (collectionName === "surveys" || collectionName === "publishedSurveys") {
    await client.query("DELETE FROM anketler WHERE okul_id=? AND kayit_turu=?", [schoolId, collectionName === "surveys" ? "taslak" : "yayin"]);
  } else {
    const table = collectionName === "surveyResponses" ? "anket_soru_toplu_cevap_kayitlari"
      : collectionName === "surveySubmissions" ? "anket_gonderimleri"
        : collectionName === "parentConsentCampaigns" ? "veli_onay_kampanyalari"
          : collectionName === "parentConsentRows" ? "veli_onay_satirlari" : "veli_onaylari";
    await client.query(`DELETE FROM ${table} WHERE okul_id=?`, [schoolId]);
  }
};

export async function replaceRelationalSurveyCollection(collectionName: string, documents: SurveySourceDocument[]) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel anket koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await deleteCollection(client, schoolId, collectionName);
    const write = writer(collectionName);
    for (const row of documents) await write(client, schoolId, collectionName, row);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function upsertRelationalSurveyDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel anket koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await writer(collectionName)(client, schoolId, collectionName, { documentId, data, updatedAt });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function deleteRelationalSurveyDocument(collectionName: string, documentId: string) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel anket koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId();
  if (collectionName === "surveys" || collectionName === "publishedSurveys") {
    await pool.query("DELETE FROM anketler WHERE okul_id=? AND kayit_turu=? AND anket_id=?",
      [schoolId, collectionName === "surveys" ? "taslak" : "yayin", documentId]);
  } else {
    const table = collectionName === "surveyResponses" ? "anket_soru_toplu_cevap_kayitlari"
      : collectionName === "surveySubmissions" ? "anket_gonderimleri"
        : collectionName === "parentConsentCampaigns" ? "veli_onay_kampanyalari"
          : collectionName === "parentConsentRows" ? "veli_onay_satirlari" : "veli_onaylari";
    const idColumn = collectionName === "surveySubmissions" ? "gonderim_id"
      : collectionName === "parentConsentCampaigns" ? "kampanya_id"
        : collectionName === "parentConsents" ? "onay_id" : "kayit_id";
    await pool.query(`DELETE FROM ${table} WHERE okul_id=? AND ${idColumn}=?`, [schoolId, documentId]);
  }
}

const groupValues = (rows: any[], idColumn: string, valueColumn: string) => {
  const map = new Map<string, any[]>();
  for (const row of rows) map.set(String(row[idColumn]), [...(map.get(String(row[idColumn])) || []), row[valueColumn]]);
  return map;
};

export async function loadRelationalSurveyDocuments(): Promise<SurveyRelationalDocument[]> {
  const schoolId = await primarySchoolId();
  const [surveys, audiences, recipients, classrooms, questions, options, responseParents, responseAnswers,
    submissions, submissionAnswers, campaigns, targets, consentRows, consents] = await Promise.all([
    pool.query("SELECT * FROM anketler WHERE okul_id=? ORDER BY guncellenme_zamani, anket_id", [schoolId]),
    pool.query("SELECT * FROM anket_hedef_kitleleri WHERE okul_id=? ORDER BY kayit_turu, anket_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM anket_secili_alicilari WHERE okul_id=? ORDER BY kayit_turu, anket_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM anket_secili_siniflari WHERE okul_id=? ORDER BY kayit_turu, anket_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM anket_sorulari WHERE okul_id=? ORDER BY kayit_turu, anket_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM anket_soru_secenekleri WHERE okul_id=? ORDER BY kayit_turu, anket_id, soru_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM anket_soru_toplu_cevap_kayitlari WHERE okul_id=? ORDER BY guncellenme_zamani, kayit_id", [schoolId]),
    pool.query("SELECT * FROM anket_soru_toplu_cevaplari WHERE okul_id=? ORDER BY kayit_id, cevap_sirasi", [schoolId]),
    pool.query("SELECT * FROM anket_gonderimleri WHERE okul_id=? ORDER BY guncellenme_zamani, gonderim_id", [schoolId]),
    pool.query("SELECT * FROM anket_gonderim_cevaplari WHERE okul_id=? ORDER BY gonderim_id, soru_id, cevap_sirasi", [schoolId]),
    pool.query("SELECT * FROM veli_onay_kampanyalari WHERE okul_id=? ORDER BY guncellenme_zamani, kampanya_id", [schoolId]),
    pool.query("SELECT * FROM veli_onay_kampanya_hedefleri WHERE okul_id=? ORDER BY kampanya_id, sira_no", [schoolId]),
    pool.query("SELECT * FROM veli_onay_satirlari WHERE okul_id=? ORDER BY guncellenme_zamani, kayit_id", [schoolId]),
    pool.query("SELECT * FROM veli_onaylari WHERE okul_id=? ORDER BY guncellenme_zamani, onay_id", [schoolId]),
  ]);
  const result: SurveyRelationalDocument[] = [];
  const surveyKey = (type: unknown, id: unknown) => `${type}\u0000${id}`;
  const audienceMap = new Map<string, string[]>(), recipientMap = new Map<string, string[]>(), classroomMap = new Map<string, string[]>();
  for (const row of audiences.rows) audienceMap.set(surveyKey(row.kayit_turu, row.anket_id), [...(audienceMap.get(surveyKey(row.kayit_turu, row.anket_id)) || []), row.hedef_kitle]);
  for (const row of recipients.rows) recipientMap.set(surveyKey(row.kayit_turu, row.anket_id), [...(recipientMap.get(surveyKey(row.kayit_turu, row.anket_id)) || []), row.alici_id]);
  for (const row of classrooms.rows) classroomMap.set(surveyKey(row.kayit_turu, row.anket_id), [...(classroomMap.get(surveyKey(row.kayit_turu, row.anket_id)) || []), row.sinif_adi]);
  const optionMap = new Map<string, string[]>();
  for (const row of options.rows) {
    const key = `${surveyKey(row.kayit_turu, row.anket_id)}\u0000${row.soru_id}`;
    optionMap.set(key, [...(optionMap.get(key) || []), row.secenek_metni]);
  }
  const questionMap = new Map<string, any[]>();
  for (const row of questions.rows) {
    const key = surveyKey(row.kayit_turu, row.anket_id);
    questionMap.set(key, [...(questionMap.get(key) || []), { id: row.soru_id, text: row.soru_metni,
      answerType: row.cevap_turu, options: optionMap.get(`${key}\u0000${row.soru_id}`) || [], required: Boolean(row.zorunlu) }]);
  }
  for (const row of surveys.rows) {
    const key = surveyKey(row.kayit_turu, row.anket_id);
    const data: Record<string, unknown> = { id: row.anket_id, audiences: audienceMap.get(key) || [],
      selectedRecipientIds: recipientMap.get(key) || [], selectedClassrooms: classroomMap.get(key) || [], questions: questionMap.get(key) || [] };
    assign(data, "title", row.baslik); assign(data, "description", row.aciklama); assign(data, "expiresAt", row.sona_erme_zamani);
    data.allowMultipleResponses = Boolean(row.coklu_cevaba_izin);
    assign(data, "lastPublishedToken", row.son_yayin_anahtari); assign(data, "updatedAt", row.veri_guncellenme_zamani);
    assign(data, "activeSurveyId", row.aktif_anket_id); assign(data, "token", row.yayin_anahtari);
    assign(data, "publishedAt", row.yayinlanma_zamani); assign(data, "status", row.durum);
    result.push({ collectionName: row.kayit_turu === "yayin" ? "publishedSurveys" : "surveys",
      documentId: String(row.anket_id), data, updatedAt: String(row.guncellenme_zamani) });
  }
  const responseAnswerMap = groupValues(responseAnswers.rows, "kayit_id", "cevap_metni");
  for (const row of responseParents.rows) result.push({ collectionName: "surveyResponses", documentId: String(row.kayit_id),
    data: { id: row.kayit_id, questionId: row.soru_id, answers: responseAnswerMap.get(String(row.kayit_id)) || [] },
    updatedAt: String(row.guncellenme_zamani) });
  const submissionAnswerMap = new Map<string, Record<string, any>>();
  for (const row of submissionAnswers.rows) {
    const answers = submissionAnswerMap.get(String(row.gonderim_id)) || {};
    const current = answers[row.soru_id];
    answers[row.soru_id] = current === undefined ? row.cevap_metni : Array.isArray(current) ? [...current, row.cevap_metni] : [current, row.cevap_metni];
    submissionAnswerMap.set(String(row.gonderim_id), answers);
  }
  for (const row of submissions.rows) {
    const data: Record<string, unknown> = { id: row.gonderim_id, answers: submissionAnswerMap.get(String(row.gonderim_id)) || {} };
    assign(data, "token", row.anket_anahtari); assign(data, "respondentKey", row.cevaplayan_anahtari);
    assign(data, "invitationToken", row.davet_anahtari); assign(data, "recipientId", row.alici_id);
    assign(data, "recipientName", row.alici_ad_soyad); assign(data, "role", row.alici_rolu);
    assign(data, "classroom", row.sinif_adi); assign(data, "submittedAt", row.gonderilme_zamani);
    result.push({ collectionName: "surveySubmissions", documentId: String(row.gonderim_id), data, updatedAt: String(row.guncellenme_zamani) });
  }
  const targetsByCampaign = new Map<string, any[]>();
  for (const row of targets.rows) targetsByCampaign.set(String(row.kampanya_id), [...(targetsByCampaign.get(String(row.kampanya_id)) || []), {
    id: row.hedef_id, name: row.ogrenci_ad_soyad, number: row.ogrenci_no, classroom: row.sinif_adi,
    parentName: row.veli_ad_soyad, parentPhone: row.veli_telefon, status: row.durum,
    respondedAt: row.cevap_zamani, parentDisplayName: row.cevaplayan_adi, responseIp: row.cevap_ip,
    responseUserAgent: row.cevap_tarayici,
  }]);
  for (const row of campaigns.rows) {
    const data: Record<string, unknown> = { id: row.kampanya_id };
    for (const [key, value] of [["title", row.baslik], ["description", row.aciklama], ["principalName", row.mudur_ad_soyad],
      ["eventDate", row.etkinlik_tarihi], ["expiresAt", row.sona_erme_zamani], ["createdAt", row.olusturulma_zamani],
      ["createdBy", row.olusturan], ["updatedAt", row.veri_guncellenme_zamani], ["status", row.durum],
      ["lastNotificationAt", row.son_bildirim_zamani]] as const) assign(data, key, value);
    const campaignTargets = targetsByCampaign.get(String(row.kampanya_id)); if (campaignTargets?.length) data.targets = campaignTargets;
    if (row.bildirim_toplam !== null) data.notificationSummary = { total: Number(row.bildirim_toplam), sent: Number(row.bildirim_gonderilen || 0), failed: Number(row.bildirim_basarisiz || 0) };
    result.push({ collectionName: "parentConsentCampaigns", documentId: String(row.kampanya_id), data, updatedAt: String(row.guncellenme_zamani) });
  }
  for (const row of consentRows.rows) {
    const data: Record<string, unknown> = { id: row.kayit_id };
    for (const [key, value] of [["campaignId", row.kampanya_id], ["studentId", row.ogrenci_id], ["studentName", row.ogrenci_ad_soyad],
      ["studentNumber", row.ogrenci_no], ["classroom", row.sinif_adi], ["parentPhone", row.veli_telefon],
      ["status", row.durum], ["createdAt", row.olusturulma_zamani], ["respondedAt", row.cevap_zamani],
      ["responseIp", row.cevap_ip], ["responseUserAgent", row.cevap_tarayici]] as const) assign(data, key, value);
    result.push({ collectionName: "parentConsentRows", documentId: String(row.kayit_id), data, updatedAt: String(row.guncellenme_zamani) });
  }
  for (const row of consents.rows) {
    const data: Record<string, unknown> = { id: row.onay_id };
    const fields: Array<[string, any, "string" | "number" | "boolean"?]> = [
      ["publicTokenHash", row.genel_anahtar_ozeti], ["recoverablePublicToken", row.kurtarma_anahtari], ["studentId", row.ogrenci_id],
      ["studentName", row.ogrenci_ad_soyad], ["studentNumber", row.ogrenci_no], ["classroom", row.sinif_adi],
      ["parentPhone", row.veli_telefon], ["title", row.baslik], ["description", row.aciklama], ["eventDate", row.etkinlik_tarihi],
      ["expiresAt", row.sona_erme_zamani], ["status", row.durum], ["createdAt", row.olusturulma_zamani],
      ["portalUrl", row.portal_baglantisi], ["otpHash", row.tek_kullanimlik_sifre_ozeti], ["otpExpiresAt", row.sifre_sona_erme_zamani],
      ["otpAttempts", row.sifre_deneme_sayisi, "number"], ["lastNotificationAt", row.son_bildirim_zamani],
      ["lastNotificationOk", row.son_bildirim_basarili, "boolean"], ["lastNotificationError", row.son_bildirim_hatasi],
      ["otpRequestedAt", row.sifre_istenme_zamani], ["decision", row.karar], ["respondedAt", row.cevap_zamani],
      ["receiptNo", row.makbuz_no], ["evidenceHash", row.kanit_ozeti],
    ];
    for (const [key, value, kind] of fields) assign(data, key, value, kind);
    result.push({ collectionName: "parentConsents", documentId: String(row.onay_id), data, updatedAt: String(row.guncellenme_zamani) });
  }
  return result;
}
