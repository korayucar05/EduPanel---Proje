import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_HOMEWORK_MIGRATION_KEY = "sqlite-relational-homework-v1";
export type HomeworkSourceDocument = { documentId: string; data: any; updatedAt: string };
export type HomeworkRelationalDocument = HomeworkSourceDocument & { collectionName: string };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;
type Kind = "string" | "number" | "boolean";
type Field = readonly [column: string, key: string, kind?: Kind];

const COLLECTIONS = new Set(["teacherHomeworkSessions", "teacherHomeworkEvaluations", "teacherTestAssignments"]);

const SESSION_FIELDS: readonly Field[] = [
  ["baglanti_anahtari", "linkToken"], ["uygulama_okul_id", "schoolId"], ["ogretmen_id", "teacherId"],
  ["ogretmen_ad_soyad", "teacherName"], ["sinif_adi", "classroom"], ["konu", "topic"],
  ["odev_tarihi", "homeworkDate"], ["olusturulma_zamani", "createdAt"],
  ["veri_guncellenme_zamani", "updatedAt"], ["degerlendirilen_ogrenci_sayisi", "evaluatedCount", "number"],
  ["toplam_ogrenci_sayisi", "totalStudents", "number"], ["tumu_degerlendirildi", "fullyEvaluated", "boolean"],
];
const EVALUATION_FIELDS: readonly Field[] = [
  ["oturum_id", "sessionId"], ["ogrenci_id", "studentId"], ["ogrenci_ad_soyad", "studentName"],
  ["ogrenci_no", "studentNumber"], ["degerlendirme_durumu", "status"],
  ["veri_guncellenme_zamani", "updatedAt"],
];
const ASSIGNMENT_FIELDS: readonly Field[] = [
  ["atama_turu", "assignmentKind"], ["is_akisi_turu", "workflowType"], ["test_id", "testId"],
  ["sinav_id", "examId"], ["sinav_kodu", "examCode"], ["test_adi", "testName"], ["sinav_adi", "examName"],
  ["test_turu", "testType"], ["sinif_seviyesi", "grade"], ["ders_id", "courseId"], ["ders_adi", "courseName"],
  ["brans", "subject"], ["unite_id", "unitId"], ["unite_adi", "unitName"], ["konu_id", "topicId"],
  ["konu_adi", "topicName"], ["kazanim_id", "outcomeId"], ["kazanim_adi", "outcomeName"],
  ["ogretmen_id", "teacherId"], ["ogretmen_ad_soyad", "teacherName"],
  ["soru_sayisi_turu", "questionCountMode"], ["gerekli_soru_sayisi", "requiredQuestionCount", "number"],
  ["azami_soru_sayisi", "maxQuestionCount", "number"], ["secim_durumu", "selectionStatus"],
  ["tamamlanma_zamani", "completedAt"], ["olusturulma_zamani", "createdAt"],
  ["veri_guncellenme_zamani", "updatedAt"], ["yeniden_atanan_ogretmen_id", "reassignedFromTeacherId"],
  ["yeniden_atanan_ogretmen_ad_soyad", "reassignedFromTeacherName"], ["yeniden_atanma_zamani", "reassignedAt"],
  ["ogretmen_baglanti_id", "teacherLinkId"], ["atama_dongu_id", "assignmentCycleId"],
  ["secim_revizyonu", "selectionRevision", "number"], ["soru_havuzu_kilitli", "questionPoolLocked", "boolean"],
  ["soru_kullanimi_kilitli", "questionUsageLocked", "boolean"],
  ["mufredat_anlik_goruntu_surumu", "curriculumSnapshotVersion", "number"],
  ["mufredat_anlik_kazanim_sayisi", "curriculumSnapshotOutcomeCount", "number"],
  ["mufredat_anlik_parmak_izi", "curriculumSnapshotFingerprint"],
  ["mufredat_anlik_guncellenme_zamani", "curriculumSnapshotUpdatedAt"],
  ["secilen_soru_sayisi", "selectedQuestionCount", "number"], ["kalan_soru_sayisi", "remainingQuestionCount", "number"],
  ["tamamlanabilir", "canComplete", "boolean"], ["secim_protokol_surumu", "selectionProtocolVersion", "number"],
  ["soru_havuzu_guncellenme_zamani", "questionPoolUpdatedAt"], ["belge_referansi", "__documentId"],
  ["baglam_eslesti", "__matchedByContext", "boolean"], ["cozumlenen_brans_adi", "__resolvedSubjectName"],
];
const SCOPE_FIELDS: readonly Field[] = [
  ["kapsam_id", "id"], ["brans", "subject"], ["ders_id", "courseId"], ["sinif_seviyesi", "grade"],
  ["unite_id", "unitId"], ["unite_adi", "unitName"], ["konu_id", "topicId"], ["konu_adi", "topicName"],
  ["kazanim_id", "outcomeId"], ["kazanim_adi", "outcomeName"], ["kapsam_turu", "scopeType"],
  ["tum_konular_dahil", "includeAllTopics", "boolean"], ["tum_kazanimlar_dahil", "includeAllOutcomes", "boolean"],
  ["soru_sayisi", "count", "number"], ["planlanan_soru_sayisi", "questionCount", "number"],
  ["gerekli_soru_sayisi", "requiredQuestionCount", "number"],
];
const QUESTION_FIELDS: readonly Field[] = [
  ["soru_anahtari", "key"], ["kapsam_seviyesi", "scopeLevel"], ["ders_id", "courseId"], ["ders_adi", "courseName"],
  ["sinif_seviyesi", "grade"], ["unite_id", "unitId"], ["unite_adi", "unitName"], ["konu_id", "topicId"],
  ["konu_adi", "topicName"], ["kazanim_id", "outcomeId"], ["kazanim_adi", "outcomeName"],
  ["soru_id", "questionId"], ["soru_sirasi", "order", "number"], ["cevap", "answer"], ["soru_kodu", "code"],
  ["dosya_adi", "fileName"], ["resim_adresi", "imageUrl"], ["kucuk_resim_adresi", "thumbnailUrl"],
  ["depolama_yolu", "storagePath"], ["sutun_genisligi", "columnSpan", "number"], ["soru_grubu_id", "questionGroupId"],
  ["soru_grubu_turu", "questionGroupMode"], ["soru_grubu_duzeni", "questionGroupLayout"],
  ["soru_grubu_sirasi", "questionGroupOrder", "number"], ["soru_grubu_buyuklugu", "questionGroupSize", "number"],
  ["soru_grubu_basligi", "questionGroupTitle"], ["soru_grubu_yonerge_metni", "questionGroupInstructionText"],
  ["soru_grubu_yonerge_resmi", "questionGroupInstructionImageUrl"],
  ["soru_grubu_yonerge_soru_id", "questionGroupInstructionQuestionId"], ["pdf_grup_lider_resmi", "pdfGroupLeaderImageUrl"],
  ["pdf_grup_yonerge_yuksekligi", "pdfGroupInstructionHeightMm", "number"],
  ["pdf_grup_soru_sayisi", "pdfGroupQuestionCount", "number"], ["pdf_grup_yonerge_gorunur", "pdfGroupInstructionVisible", "boolean"],
  ["pdf_algilanan_grup_anahtari", "pdfDetectedGroupToken"], ["pdf_algilanan_grup_sirasi", "pdfDetectedGroupOrder", "number"],
  ["pdf_cozumlenen_grup_id", "pdfResolvedGroupId"],
];
const SNAPSHOT_FIELDS: readonly Field[] = [
  ["kayit_id", "id"], ["soru_anahtari", "key"], ["soru_id", "questionId"], ["soru_kodu", "questionCode"],
  ["sinif_seviyesi", "grade"], ["ders_id", "courseId"], ["ders_adi", "courseName"], ["unite_id", "unitId"],
  ["unite_adi", "unitName"], ["konu_id", "topicId"], ["konu_adi", "topicName"], ["kazanim_id", "outcomeId"],
  ["kazanim_adi", "outcomeName"], ["soru_turu", "questionType"], ["kapsam_seviyesi", "scopeLevel"],
  ["cevap", "answer"], ["dogru_cevap", "correctAnswer"], ["soru_sirasi", "order", "number"],
  ["dosya_adi", "fileName"], ["depolama_yolu", "storagePath"], ["resim_adresi", "imageUrl"],
  ["kucuk_resim_yolu", "thumbnailPath"], ["kucuk_resim_adresi", "thumbnailUrl"], ["icerik_ozeti", "contentHash"],
  ["mime_turu", "mimeType"], ["dosya_boyutu", "sizeBytes", "number"], ["kucuk_resim_boyutu", "thumbnailSizeBytes", "number"],
  ["ice_aktarma_oturum_id", "importSessionId"], ["durum", "status"], ["olusturulma_zamani", "createdAt"],
  ["veri_guncellenme_zamani", "updatedAt"], ["asil_depolama_yolu", "originalStoragePath"], ["cop_yolu", "trashPath"],
  ["kucuk_resim_guncellenme_zamani", "thumbnailUpdatedAt"], ["kullanim_sayisi", "useCount", "number"],
  ["son_kullanilma_zamani", "lastUsedAt"], ["son_sinav_id", "lastExamId"], ["son_sinav_adi", "lastExamName"],
  ["cevap_guncellenme_zamani", "answerUpdatedAt"], ["secim_anahtari", "_selectionKey"],
  ...QUESTION_FIELDS.slice(20),
];

const arrayValue = (value: unknown) => Array.isArray(value) ? value : [];
const isoDate = (raw: unknown) => {
  const parsed = raw instanceof Date ? raw : new Date(String(raw || ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};
const valueFor = (data: any, key: string, kind: Kind = "string") => {
  let raw = data?.[key];
  if (raw === undefined && key === "questionCode") raw = data?.code ?? data?.question_code;
  if (raw === undefined && key === "correctAnswer") raw = data?.correct_answer;
  if (raw === undefined || raw === null) return null;
  if (kind === "number") return Number.isFinite(Number(raw)) ? Number(raw) : null;
  if (kind === "boolean") return raw === true || raw === 1 || raw === "1" || raw === "true" ? 1 : 0;
  return String(raw);
};
const restore = (raw: any, kind: Kind = "string") => kind === "number" ? Number(raw) : kind === "boolean" ? Boolean(raw) : raw;
const mappedValues = (data: any, fields: readonly Field[]) => fields.map(([, key, kind]) => valueFor(data, key, kind));
const restoreFields = (row: any, fields: readonly Field[]) => {
  const result: Record<string, unknown> = {};
  for (const [column, key, kind] of fields) if (row[column] !== null && row[column] !== undefined) result[key] = restore(row[column], kind);
  return result;
};
const insert = async (client: QueryClient, table: string, columns: string[], values: any[]) => {
  await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, values);
};

export function relationalHomeworkCollectionInfo(collectionName: string) { return COLLECTIONS.has(collectionName); }

export async function ensureRelationalHomeworkSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-homework-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel ödev şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/).map((statement) => statement.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalHomeworkReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key=?", [RELATIONAL_HOMEWORK_MIGRATION_KEY]);
  return result.rowCount > 0;
}

const primarySchoolId = async () => {
  const result = await pool.query(`SELECT okul_id FROM okullar WHERE uygulama_okul_id='school-main' OR aktif=1
    ORDER BY (uygulama_okul_id='school-main') DESC, okul_id LIMIT 1`);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error("Ödev kayıtları için etkin okul bulunamadı.");
  return schoolId;
};

const upsertSimple = async (client: QueryClient, schoolId: string, collectionName: string, row: HomeworkSourceDocument) => {
  const session = collectionName === "teacherHomeworkSessions";
  const table = session ? "ogretmen_odev_oturumlari" : "ogretmen_odev_degerlendirmeleri";
  const idColumn = session ? "oturum_id" : "degerlendirme_id";
  const fields = session ? SESSION_FIELDS : EVALUATION_FIELDS;
  const columns = ["okul_id", idColumn, ...fields.map(([column]) => column), "guncellenme_zamani"];
  const values = [schoolId, row.documentId, ...mappedValues(row.data, fields), isoDate(row.updatedAt)];
  await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`, values);
};

const clearAssignmentChildren = async (client: QueryClient, schoolId: string, assignmentId: string) => {
  for (const table of ["ogretmen_test_atama_pdf_grup_soru_anahtarlari", "ogretmen_test_atama_soru_goruntuleri",
    "ogretmen_test_atama_soru_anahtarlari", "ogretmen_test_atama_agac_uniteleri", "ogretmen_test_atama_kapsamlari"]) {
    await client.query(`DELETE FROM ${table} WHERE okul_id=? AND atama_id=?`, [schoolId, assignmentId]);
  }
};

const writePdfKeys = async (client: QueryClient, schoolId: string, assignmentId: string, sourceType: string, sourceOrder: number, question: any) => {
  for (const [index, key] of arrayValue(question?.pdfGroupQuestionKeys).entries()) {
    await insert(client, "ogretmen_test_atama_pdf_grup_soru_anahtarlari",
      ["okul_id", "atama_id", "kaynak_turu", "kaynak_sira_no", "sira_no", "soru_anahtari"],
      [schoolId, assignmentId, sourceType, sourceOrder, index + 1, String(key)]);
  }
};

const writeAssignmentChildren = async (client: QueryClient, schoolId: string, row: HomeworkSourceDocument) => {
  const assignmentId = row.documentId; const data = row.data || {};
  await clearAssignmentChildren(client, schoolId, assignmentId);
  for (const listType of ["scopes", "selectionScopes", "questionScopes", "questionPlan", "plan", "requirements"]) {
    for (const [index, scope] of arrayValue(data[listType]).entries()) {
      await insert(client, "ogretmen_test_atama_kapsamlari",
        ["okul_id", "atama_id", "liste_turu", "sira_no", ...SCOPE_FIELDS.map(([column]) => column)],
        [schoolId, assignmentId, listType, index + 1, ...mappedValues(scope, SCOPE_FIELDS)]);
    }
  }
  for (const treeType of ["scopeTree", "curriculumScopeTree", "fullScopeTree"]) {
    for (const [unitIndex, unit] of arrayValue(data[treeType]).entries()) {
      await insert(client, "ogretmen_test_atama_agac_uniteleri",
        ["okul_id", "atama_id", "agac_turu", "unite_sira_no", "unite_id", "unite_adi"],
        [schoolId, assignmentId, treeType, unitIndex + 1, valueFor(unit, "id"), valueFor(unit, "name")]);
      for (const [topicIndex, topic] of arrayValue(unit?.topics).entries()) {
        await insert(client, "ogretmen_test_atama_agac_konulari",
          ["okul_id", "atama_id", "agac_turu", "unite_sira_no", "konu_sira_no", "konu_id", "konu_adi"],
          [schoolId, assignmentId, treeType, unitIndex + 1, topicIndex + 1, valueFor(topic, "id"), valueFor(topic, "name")]);
        for (const [outcomeIndex, outcome] of arrayValue(topic?.outcomes).entries()) {
          await insert(client, "ogretmen_test_atama_agac_kazanimlari",
            ["okul_id", "atama_id", "agac_turu", "unite_sira_no", "konu_sira_no", "kazanim_sira_no", "kazanim_id", "kazanim_adi"],
            [schoolId, assignmentId, treeType, unitIndex + 1, topicIndex + 1, outcomeIndex + 1, valueFor(outcome, "id"), valueFor(outcome, "name")]);
          const sourceType = `agac:${treeType}:${unitIndex + 1}:${topicIndex + 1}:${outcomeIndex + 1}`;
          for (const [questionIndex, question] of arrayValue(outcome?.questions).entries()) {
            await insert(client, "ogretmen_test_atama_agac_sorulari",
              ["okul_id", "atama_id", "agac_turu", "unite_sira_no", "konu_sira_no", "kazanim_sira_no", "soru_sira_no",
                ...QUESTION_FIELDS.map(([column]) => column)],
              [schoolId, assignmentId, treeType, unitIndex + 1, topicIndex + 1, outcomeIndex + 1, questionIndex + 1,
                ...mappedValues(question, QUESTION_FIELDS)]);
            await writePdfKeys(client, schoolId, assignmentId, sourceType, questionIndex + 1, question);
          }
        }
      }
    }
  }
  for (const listType of ["selectedQuestionKeys", "committedQuestionKeys"]) {
    for (const [index, key] of arrayValue(data[listType]).entries()) {
      await insert(client, "ogretmen_test_atama_soru_anahtarlari",
        ["okul_id", "atama_id", "liste_turu", "sira_no", "soru_anahtari"],
        [schoolId, assignmentId, listType, index + 1, String(key)]);
    }
  }
  for (const listType of ["availableQuestionSnapshots", "selectedQuestionSnapshots"]) {
    for (const [index, question] of arrayValue(data[listType]).entries()) {
      await insert(client, "ogretmen_test_atama_soru_goruntuleri",
        ["okul_id", "atama_id", "liste_turu", "sira_no", ...SNAPSHOT_FIELDS.map(([column]) => column)],
        [schoolId, assignmentId, listType, index + 1, ...mappedValues(question, SNAPSHOT_FIELDS)]);
      await writePdfKeys(client, schoolId, assignmentId, `goruntu:${listType}`, index + 1, question);
    }
  }
};

const upsertAssignment = async (client: QueryClient, schoolId: string, row: HomeworkSourceDocument) => {
  const columns = ["okul_id", "atama_id", ...ASSIGNMENT_FIELDS.map(([column]) => column), "guncellenme_zamani"];
  const values = [schoolId, row.documentId, ...mappedValues(row.data, ASSIGNMENT_FIELDS), isoDate(row.updatedAt)];
  await client.query(`INSERT INTO ogretmen_test_atamalari (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
    ON DUPLICATE KEY UPDATE ${columns.slice(2).map((column) => `${column}=VALUES(${column})`).join(",")}`, values);
  await writeAssignmentChildren(client, schoolId, row);
};

export async function replaceRelationalHomeworkCollection(collectionName: string, documents: HomeworkSourceDocument[]) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel ödev koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    const table = collectionName === "teacherHomeworkSessions" ? "ogretmen_odev_oturumlari"
      : collectionName === "teacherHomeworkEvaluations" ? "ogretmen_odev_degerlendirmeleri" : "ogretmen_test_atamalari";
    await client.query(`DELETE FROM ${table} WHERE okul_id=?`, [schoolId]);
    for (const row of documents) {
      if (collectionName === "teacherTestAssignments") await upsertAssignment(client, schoolId, row);
      else await upsertSimple(client, schoolId, collectionName, row);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function upsertRelationalHomeworkDocument(collectionName: string, documentId: string, data: any, updatedAt: string) {
  if (!COLLECTIONS.has(collectionName)) throw new Error(`İlişkisel ödev koleksiyonu desteklenmiyor: ${collectionName}`);
  const schoolId = await primarySchoolId(); const client = await pool.connect();
  try {
    await client.query("START TRANSACTION"); const row = { documentId, data, updatedAt };
    if (collectionName === "teacherTestAssignments") await upsertAssignment(client, schoolId, row);
    else await upsertSimple(client, schoolId, collectionName, row);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function deleteRelationalHomeworkDocument(collectionName: string, documentId: string) {
  const schoolId = await primarySchoolId();
  const config = collectionName === "teacherHomeworkSessions" ? ["ogretmen_odev_oturumlari", "oturum_id"]
    : collectionName === "teacherHomeworkEvaluations" ? ["ogretmen_odev_degerlendirmeleri", "degerlendirme_id"]
      : collectionName === "teacherTestAssignments" ? ["ogretmen_test_atamalari", "atama_id"] : null;
  if (!config) throw new Error(`İlişkisel ödev koleksiyonu desteklenmiyor: ${collectionName}`);
  await pool.query(`DELETE FROM ${config[0]} WHERE okul_id=? AND ${config[1]}=?`, [schoolId, documentId]);
}

const grouped = (rows: any[], id: string, mapper: (row: any) => any) => {
  const result = new Map<string, any[]>();
  for (const row of rows) { const key = String(row[id]); result.set(key, [...(result.get(key) || []), mapper(row)]); }
  return result;
};

export async function loadRelationalHomeworkDocuments(): Promise<HomeworkRelationalDocument[]> {
  const schoolId = await primarySchoolId(); const result: HomeworkRelationalDocument[] = [];
  for (const config of [
    ["teacherHomeworkSessions", "ogretmen_odev_oturumlari", "oturum_id", SESSION_FIELDS],
    ["teacherHomeworkEvaluations", "ogretmen_odev_degerlendirmeleri", "degerlendirme_id", EVALUATION_FIELDS],
  ] as const) {
    const rows = await pool.query(`SELECT * FROM ${config[1]} WHERE okul_id=? ORDER BY guncellenme_zamani, ${config[2]}`, [schoolId]);
    for (const row of rows.rows) result.push({ collectionName: config[0], documentId: String(row[config[2]]),
      data: { id: String(row[config[2]]), ...restoreFields(row, config[3]) }, updatedAt: String(row.guncellenme_zamani) });
  }

  const [assignments, scopes, units, topics, outcomes, questions, keys, snapshots, pdfKeys] = await Promise.all([
    pool.query("SELECT * FROM ogretmen_test_atamalari WHERE okul_id=? ORDER BY guncellenme_zamani, atama_id", [schoolId]),
    pool.query("SELECT * FROM ogretmen_test_atama_kapsamlari WHERE okul_id=? ORDER BY atama_id,liste_turu,sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_test_atama_agac_uniteleri WHERE okul_id=? ORDER BY atama_id,agac_turu,unite_sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_test_atama_agac_konulari WHERE okul_id=? ORDER BY atama_id,agac_turu,unite_sira_no,konu_sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_test_atama_agac_kazanimlari WHERE okul_id=? ORDER BY atama_id,agac_turu,unite_sira_no,konu_sira_no,kazanim_sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_test_atama_agac_sorulari WHERE okul_id=? ORDER BY atama_id,agac_turu,unite_sira_no,konu_sira_no,kazanim_sira_no,soru_sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_test_atama_soru_anahtarlari WHERE okul_id=? ORDER BY atama_id,liste_turu,sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_test_atama_soru_goruntuleri WHERE okul_id=? ORDER BY atama_id,liste_turu,sira_no", [schoolId]),
    pool.query("SELECT * FROM ogretmen_test_atama_pdf_grup_soru_anahtarlari WHERE okul_id=? ORDER BY atama_id,kaynak_turu,kaynak_sira_no,sira_no", [schoolId]),
  ]);
  const pdfMap = new Map<string, string[]>();
  for (const row of pdfKeys.rows) {
    const key = `${row.atama_id}|${row.kaynak_turu}|${row.kaynak_sira_no}`;
    pdfMap.set(key, [...(pdfMap.get(key) || []), String(row.soru_anahtari)]);
  }
  const scopeMap = grouped(scopes.rows, "atama_id", (row) => ({ liste_turu: row.liste_turu, data: restoreFields(row, SCOPE_FIELDS) }));
  const keyMap = grouped(keys.rows, "atama_id", (row) => ({ liste_turu: row.liste_turu, value: String(row.soru_anahtari) }));
  const snapshotMap = grouped(snapshots.rows, "atama_id", (row) => {
    const data = restoreFields(row, SNAPSHOT_FIELDS); const pdf = pdfMap.get(`${row.atama_id}|goruntu:${row.liste_turu}|${row.sira_no}`);
    if (data.questionCode !== undefined && data.code === undefined) data.code = data.questionCode;
    if (data.correctAnswer !== undefined && data.correct_answer === undefined) data.correct_answer = data.correctAnswer;
    if (pdf?.length) data.pdfGroupQuestionKeys = pdf; return { liste_turu: row.liste_turu, data };
  });
  const treeMap = new Map<string, any[]>();
  for (const row of units.rows) {
    const key = `${row.atama_id}|${row.agac_turu}`; const list = treeMap.get(key) || [];
    list[Number(row.unite_sira_no) - 1] = { id: row.unite_id, name: row.unite_adi, topics: [] }; treeMap.set(key, list);
  }
  for (const row of topics.rows) {
    const unit = treeMap.get(`${row.atama_id}|${row.agac_turu}`)?.[Number(row.unite_sira_no) - 1];
    if (unit) unit.topics[Number(row.konu_sira_no) - 1] = { id: row.konu_id, name: row.konu_adi, outcomes: [] };
  }
  for (const row of outcomes.rows) {
    const topic = treeMap.get(`${row.atama_id}|${row.agac_turu}`)?.[Number(row.unite_sira_no) - 1]?.topics?.[Number(row.konu_sira_no) - 1];
    if (topic) topic.outcomes[Number(row.kazanim_sira_no) - 1] = { id: row.kazanim_id, name: row.kazanim_adi, questions: [] };
  }
  for (const row of questions.rows) {
    const outcome = treeMap.get(`${row.atama_id}|${row.agac_turu}`)?.[Number(row.unite_sira_no) - 1]?.topics?.[Number(row.konu_sira_no) - 1]?.outcomes?.[Number(row.kazanim_sira_no) - 1];
    if (!outcome) continue; const data = restoreFields(row, QUESTION_FIELDS);
    const source = `agac:${row.agac_turu}:${row.unite_sira_no}:${row.konu_sira_no}:${row.kazanim_sira_no}`;
    const pdf = pdfMap.get(`${row.atama_id}|${source}|${row.soru_sira_no}`); if (pdf?.length) data.pdfGroupQuestionKeys = pdf;
    outcome.questions[Number(row.soru_sira_no) - 1] = data;
  }
  for (const row of assignments.rows) {
    const documentId = String(row.atama_id); const data: Record<string, any> = { id: documentId, ...restoreFields(row, ASSIGNMENT_FIELDS) };
    for (const listType of ["scopes", "selectionScopes", "questionScopes", "questionPlan", "plan", "requirements"])
      data[listType] = (scopeMap.get(documentId) || []).filter((item) => item.liste_turu === listType).map((item) => item.data);
    for (const treeType of ["scopeTree", "curriculumScopeTree", "fullScopeTree"]) data[treeType] = treeMap.get(`${documentId}|${treeType}`) || [];
    for (const listType of ["selectedQuestionKeys", "committedQuestionKeys"])
      data[listType] = (keyMap.get(documentId) || []).filter((item) => item.liste_turu === listType).map((item) => item.value);
    for (const listType of ["availableQuestionSnapshots", "selectedQuestionSnapshots"])
      data[listType] = (snapshotMap.get(documentId) || []).filter((item) => item.liste_turu === listType).map((item) => item.data);
    result.push({ collectionName: "teacherTestAssignments", documentId, data, updatedAt: String(row.guncellenme_zamani) });
  }
  return result;
}
