import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

const RELATIONAL_MIGRATION_KEY = "sqlite-relational-core-v1";
const BASE_COLLECTIONS = new Set([
  "students", "school_students",
  "teachers", "school_teachers",
  "classrooms", "school_classrooms",
  "courses",
  "trial_club_registrations",
  "trial_club_league_groups",
]);

type CollectionInfo = { collectionName: string; baseName: string; schoolId: string };
type RelationalDocument = { collectionName: string; documentId: string; data: any; updatedAt: string };
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;

const text = (value: unknown) => String(value ?? "").trim();
const optionalText = (value: unknown) => text(value) || null;
const numberValue = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const boolValue = (value: unknown) => value === true || value === 1 || value === "1";
const arrayValue = (value: unknown) => Array.isArray(value) ? value : [];
const sqlDate = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date : new Date();
};
const isoDate = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};
const normalizeClassName = (value: unknown) => text(value).toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
const BRANCH_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function relationalClassId(value: unknown) {
  const normalized = text(value).toLocaleUpperCase("tr-TR");
  const match = normalized.match(/(\d{1,2})\s*\.?\s*(?:SINIF)?[\s\-_/]*([A-Z])(?:\b|$)/u);
  if (!match) throw new Error(`Sınıf adı kimliğe dönüştürülemedi: ${text(value) || "(boş)"}`);
  const grade = Number(match[1]);
  const branchOrder = BRANCH_ALPHABET.indexOf(match[2]) + 1;
  if (!grade || !branchOrder) throw new Error(`Sınıf adı kimliğe dönüştürülemedi: ${text(value)}`);
  return Number(`${grade}${branchOrder}`);
}

export function relationalCollectionInfo(collectionName: string): CollectionInfo | null {
  const scoped = /^school__([^_][A-Za-z0-9._-]*)__([A-Za-z0-9_-]+)$/.exec(collectionName);
  const schoolId = scoped ? scoped[1] : "school-main";
  const baseName = scoped ? scoped[2] : collectionName;
  return BASE_COLLECTIONS.has(baseName) ? { collectionName, baseName, schoolId } : null;
}

const collectionNameFor = (schoolId: string, baseName: string) =>
  schoolId === "school-main" ? baseName : `school__${schoolId}__${baseName}`;

export function relationalCollectionAliases(collectionName: string) {
  const info = relationalCollectionInfo(collectionName);
  if (!info) return [collectionName];
  const aliases = info.baseName === "students" || info.baseName === "school_students"
    ? ["students", "school_students"]
    : info.baseName === "teachers" || info.baseName === "school_teachers"
      ? ["teachers", "school_teachers"]
      : info.baseName === "classrooms" || info.baseName === "school_classrooms"
        ? ["classrooms", "school_classrooms"]
        : [info.baseName];
  return aliases.map((name) => collectionNameFor(info.schoolId, name));
}

export async function ensureRelationalCoreSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel şema dosyası bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean)
    .filter((statement) => !/^SET\s+/i.test(statement));
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalCoreReady() {
  const result = await pool.query("SELECT migration_key FROM edupanel_migrations WHERE migration_key = ?", [RELATIONAL_MIGRATION_KEY]);
  return result.rowCount > 0;
}

const databaseSchoolId = async (client: QueryClient, applicationSchoolId: string) => {
  const mapped = await client.query(`SELECT o.okul_id
    FROM okullar o
    LEFT JOIN panel_okullari p ON p.okul_kodu=o.okul_id
    WHERE p.uygulama_okul_id=? OR o.uygulama_okul_id=?
    LIMIT 1`, [applicationSchoolId, applicationSchoolId]);
  if (mapped.rowCount) return text(mapped.rows[0].okul_id);
  const direct = await client.query("SELECT okul_id FROM okullar WHERE okul_id=?", [applicationSchoolId]);
  return direct.rowCount ? text(direct.rows[0].okul_id) : "";
};

export async function configureRelationalSchool(applicationSchoolId: string, mebCode: string, schoolName: string) {
  const normalizedCode = text(mebCode);
  if (!/^\d+$/.test(normalizedCode)) throw new Error(`MEB kodu yalnızca rakamlardan oluşmalıdır: ${normalizedCode || "(boş)"}`);
  await pool.query(`INSERT INTO okullar (okul_id, uygulama_okul_id, okul_adi, aktif)
    VALUES (?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE uygulama_okul_id=VALUES(uygulama_okul_id), okul_adi=VALUES(okul_adi), aktif=1`,
  [normalizedCode, applicationSchoolId, text(schoolName) || "Okul"]);
  return normalizedCode;
}

const ensureSchool = async (client: QueryClient, applicationSchoolId: string) => {
  const schoolId = await databaseSchoolId(client, applicationSchoolId);
  if (!schoolId) throw new Error(`Okulun MEB kodu eşleştirilmemiş: ${applicationSchoolId}`);
  return schoolId;
};

const loadClassMap = async (client: QueryClient, schoolId: string) => {
  const result = await client.query("SELECT sinif_id, sinif_adi FROM siniflar WHERE okul_id = ?", [schoolId]);
  return new Map(result.rows.flatMap((row: any) => [
    [text(row.sinif_id), text(row.sinif_id)],
    [normalizeClassName(row.sinif_adi), text(row.sinif_id)],
  ]));
};

const existingTeacherId = async (client: QueryClient, schoolId: string, teacherId: unknown) => {
  const id = text(teacherId);
  if (!id) return null;
  const result = await client.query("SELECT ogretmen_id FROM ogretmenler WHERE okul_id = ? AND ogretmen_id = ?", [schoolId, id]);
  return result.rowCount ? id : null;
};

const writeTeacher = async (client: QueryClient, schoolId: string, row: any) => {
  const teacherId = text(row?.id || row?.teacherId);
  if (!teacherId) throw new Error("Öğretmen kimliği boş olamaz.");
  await client.query(`INSERT INTO ogretmenler
    (okul_id, ogretmen_id, ad_soyad, brans, e_posta, telefon, haftalik_ders_saati, durum, yonetim_rolu, avatar, izin_nedeni)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE ad_soyad=VALUES(ad_soyad), brans=VALUES(brans), e_posta=VALUES(e_posta),
      telefon=VALUES(telefon), haftalik_ders_saati=VALUES(haftalik_ders_saati), durum=VALUES(durum),
      yonetim_rolu=VALUES(yonetim_rolu), avatar=VALUES(avatar), izin_nedeni=VALUES(izin_nedeni)`, [
    schoolId, teacherId, text(row?.name || row?.teacherName), text(row?.branch), optionalText(row?.email), optionalText(row?.phone),
    Math.max(0, numberValue(row?.weeklyHours)), text(row?.status || "Aktif"), optionalText(row?.adminRole), optionalText(row?.avatar), optionalText(row?.leaveReason),
  ]);
  await client.query("DELETE FROM ogretmen_komisyonlari WHERE okul_id=? AND ogretmen_id=?", [schoolId, teacherId]);
  for (const commission of arrayValue(row?.commissions).map(text).filter(Boolean)) {
    await client.query("INSERT IGNORE INTO ogretmen_komisyonlari (okul_id, ogretmen_id, komisyon_adi) VALUES (?, ?, ?)", [schoolId, teacherId, commission]);
  }
  await client.query("DELETE FROM ogretmen_izin_tarihleri WHERE okul_id=? AND ogretmen_id=?", [schoolId, teacherId]);
  for (const leaveDate of arrayValue(row?.leaveDates).map(text).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))) {
    await client.query("INSERT IGNORE INTO ogretmen_izin_tarihleri (okul_id, ogretmen_id, izin_tarihi) VALUES (?, ?, ?)", [schoolId, teacherId, leaveDate]);
  }
};

const writeClassroom = async (client: QueryClient, schoolId: string, row: any) => {
  const classroomName = text(row?.name || row?.classroom || row?.className);
  const classroomId = relationalClassId(classroomName);
  const advisor = await existingTeacherId(client, schoolId, row?.advisorTeacherId);
  const counselor = await existingTeacherId(client, schoolId, row?.counselorTeacherId);
  await client.query(`INSERT INTO siniflar
    (okul_id, sinif_id, sinif_adi, sinif_duzeyi, rehber_ogretmen_id, psikolojik_danisman_id, sorumlu_mudur_yardimcisi, aktif)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE sinif_adi=VALUES(sinif_adi), sinif_duzeyi=VALUES(sinif_duzeyi),
      rehber_ogretmen_id=VALUES(rehber_ogretmen_id), psikolojik_danisman_id=VALUES(psikolojik_danisman_id),
      sorumlu_mudur_yardimcisi=VALUES(sorumlu_mudur_yardimcisi), aktif=1`, [
    schoolId, classroomId, classroomName, text(row?.level), advisor, counselor, optionalText(row?.vicePrincipal),
  ]);
  await client.query("DELETE FROM sinif_gruplari WHERE okul_id=? AND sinif_id=?", [schoolId, classroomId]);
  for (const groupName of arrayValue(row?.groups).map(text).filter(Boolean)) {
    await client.query("INSERT IGNORE INTO sinif_gruplari (okul_id, sinif_id, grup_adi) VALUES (?, ?, ?)", [schoolId, classroomId, groupName]);
  }
};

const writeStudent = async (client: QueryClient, schoolId: string, row: any) => {
  const studentId = text(row?.id || row?.studentId || row?.studentNumber || row?.number);
  if (!studentId) throw new Error("Öğrenci kimliği boş olamaz.");
  const classMap = await loadClassMap(client, schoolId);
  const classroomId = classMap.get(text(row?.classroomId || row?.classId)) || classMap.get(normalizeClassName(row?.classroom)) || null;
  const schoolNumber = text(row?.studentNumber ?? row?.number ?? studentId) || studentId;
  await client.query(`INSERT INTO ogrenciler
    (okul_id, ogrenci_id, okul_numarasi, ad_soyad, sinif_id, alan_grubu, telefon, veli_ad_soyad, veli_telefon,
     dogum_tarihi, dogum_yeri, adres, okul_disinda, durum, kayit_tarihi, avatar, not_ortalamasi, devamsizlik, e_posta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE okul_numarasi=VALUES(okul_numarasi), ad_soyad=VALUES(ad_soyad), sinif_id=VALUES(sinif_id),
      alan_grubu=VALUES(alan_grubu), telefon=VALUES(telefon), veli_ad_soyad=VALUES(veli_ad_soyad), veli_telefon=VALUES(veli_telefon),
      dogum_tarihi=VALUES(dogum_tarihi), dogum_yeri=VALUES(dogum_yeri), adres=VALUES(adres), okul_disinda=VALUES(okul_disinda),
      durum=VALUES(durum), kayit_tarihi=VALUES(kayit_tarihi), avatar=VALUES(avatar), not_ortalamasi=VALUES(not_ortalamasi),
      devamsizlik=VALUES(devamsizlik), e_posta=VALUES(e_posta)`, [
    schoolId, studentId, schoolNumber, text(row?.name || row?.studentName), classroomId, optionalText(row?.group), optionalText(row?.phone),
    optionalText(row?.parentName), optionalText(row?.parentPhone), optionalText(row?.dob), optionalText(row?.pob), optionalText(row?.address),
    boolValue(row?.oob) ? 1 : 0, text(row?.status || "Aktif"), optionalText(row?.registerDate), optionalText(row?.avatar),
    row?.gpa == null ? null : numberValue(row.gpa), row?.absences == null ? null : numberValue(row.absences), optionalText(row?.email),
  ]);
};

const writeCourse = async (client: QueryClient, schoolId: string, row: any) => {
  const courseId = text(row?.id || row?.courseId);
  if (!courseId) throw new Error("Ders kimliği boş olamaz.");
  const classMap = await loadClassMap(client, schoolId);
  const classroomId = classMap.get(text(row?.classroomId)) || classMap.get(normalizeClassName(row?.classroom)) || null;
  const teacher1 = await existingTeacherId(client, schoolId, row?.teacherId);
  const teacher2 = await existingTeacherId(client, schoolId, row?.teacherId2);
  await client.query(`INSERT INTO dersler
    (okul_id, ders_id, ders_adi, ders_kodu, sinif_id, birinci_ogretmen_id, ikinci_ogretmen_id,
     ogretmen_atamasi_temizlendi, program_aciklamasi, ogrenci_sayisi, haftalik_ders_saati, ders_turu,
     brans, eski_birlesik_ders, paralel_grup_id, ortak_secmeli)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE ders_adi=VALUES(ders_adi), ders_kodu=VALUES(ders_kodu), sinif_id=VALUES(sinif_id),
      birinci_ogretmen_id=VALUES(birinci_ogretmen_id), ikinci_ogretmen_id=VALUES(ikinci_ogretmen_id),
      ogretmen_atamasi_temizlendi=VALUES(ogretmen_atamasi_temizlendi), program_aciklamasi=VALUES(program_aciklamasi),
      ogrenci_sayisi=VALUES(ogrenci_sayisi), haftalik_ders_saati=VALUES(haftalik_ders_saati), ders_turu=VALUES(ders_turu),
      brans=VALUES(brans), eski_birlesik_ders=VALUES(eski_birlesik_ders), paralel_grup_id=VALUES(paralel_grup_id), ortak_secmeli=VALUES(ortak_secmeli)`, [
    schoolId, courseId, text(row?.name || row?.courseName), text(row?.code), classroomId, teacher1, teacher2,
    boolValue(row?.teacherAssignmentCleared) ? 1 : 0, optionalText(row?.schedule), Math.max(0, numberValue(row?.studentCount)),
    Math.max(0, numberValue(row?.weeklyHours)), optionalText(row?.type), optionalText(row?.branch || row?.courseBranch),
    optionalText(row?.legacyCombinedCourse), optionalText(row?.splitGroupId), boolValue(row?.isCommonElective) ? 1 : 0,
  ]);
  await client.query("DELETE FROM ders_hedef_gruplari WHERE okul_id=? AND ders_id=?", [schoolId, courseId]);
  for (const groupName of arrayValue(row?.targetGroups).map(text).filter(Boolean)) {
    await client.query("INSERT IGNORE INTO ders_hedef_gruplari (okul_id, ders_id, grup_adi) VALUES (?, ?, ?)", [schoolId, courseId, groupName]);
  }
};

const resolveStudentId = async (client: QueryClient, schoolId: string, row: any) => {
  const candidate = text(row?.studentId || row?.id);
  let result = candidate ? await client.query("SELECT ogrenci_id FROM ogrenciler WHERE okul_id=? AND ogrenci_id=?", [schoolId, candidate]) : { rowCount: 0, rows: [] };
  if (!result.rowCount) {
    result = await client.query("SELECT ogrenci_id FROM ogrenciler WHERE okul_id=? AND okul_numarasi=?", [schoolId, text(row?.studentNumber)]);
  }
  return result.rowCount ? text(result.rows[0].ogrenci_id) : "";
};

const writeTrialRegistration = async (client: QueryClient, schoolId: string, row: any) => {
  const studentId = await resolveStudentId(client, schoolId, row);
  if (!studentId) throw new Error(`Deneme Kulübü öğrencisi bulunamadı: ${text(row?.studentId || row?.studentNumber)}`);
  const membershipId = text(row?.id) || `trial-club-${studentId}`;
  await client.query(`INSERT INTO deneme_kulubu_uyeleri
    (okul_id, uyelik_id, ogrenci_id, aktif, kayit_zamani, guncellenme_zamani)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE ogrenci_id=VALUES(ogrenci_id), aktif=VALUES(aktif), guncellenme_zamani=VALUES(guncellenme_zamani)`, [
    schoolId, membershipId, studentId, row?.active === false ? 0 : 1, sqlDate(row?.createdAt), sqlDate(row?.updatedAt || row?.createdAt),
  ]);
  await client.query("DELETE FROM deneme_kulubu_uye_ogretmenleri WHERE okul_id=? AND uyelik_id=?", [schoolId, membershipId]);
  for (const teacherId of arrayValue(row?.teacherIds).map(text).filter(Boolean)) {
    if (await existingTeacherId(client, schoolId, teacherId)) {
      await client.query("INSERT IGNORE INTO deneme_kulubu_uye_ogretmenleri (okul_id, uyelik_id, ogretmen_id) VALUES (?, ?, ?)", [schoolId, membershipId, teacherId]);
    }
  }
};

const writeTrialGroup = async (client: QueryClient, schoolId: string, row: any) => {
  const groupId = text(row?.id);
  if (!groupId) throw new Error("Deneme Kulübü grup kimliği boş olamaz.");
  await client.query(`INSERT INTO deneme_kulubu_gruplari
    (okul_id, grup_id, grup_adi, sinif_duzeyi, aktif, olusturulma_zamani, guncellenme_zamani)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE grup_adi=VALUES(grup_adi), sinif_duzeyi=VALUES(sinif_duzeyi), aktif=VALUES(aktif), guncellenme_zamani=VALUES(guncellenme_zamani)`, [
    schoolId, groupId, text(row?.name), text(row?.gradeLevel), row?.active === false ? 0 : 1, sqlDate(row?.createdAt), sqlDate(row?.updatedAt || row?.createdAt),
  ]);
  await client.query("DELETE FROM deneme_kulubu_grup_uyeleri WHERE okul_id=? AND grup_id=?", [schoolId, groupId]);
  for (const rawStudentId of arrayValue(row?.studentIds).map(text).filter(Boolean)) {
    const studentId = await resolveStudentId(client, schoolId, { studentId: rawStudentId });
    if (studentId) await client.query("INSERT IGNORE INTO deneme_kulubu_grup_uyeleri (okul_id, grup_id, ogrenci_id) VALUES (?, ?, ?)", [schoolId, groupId, studentId]);
  }
  await client.query("DELETE FROM deneme_kulubu_grup_ogretmenleri WHERE okul_id=? AND grup_id=?", [schoolId, groupId]);
  for (const teacherId of arrayValue(row?.teacherIds).map(text).filter(Boolean)) {
    if (await existingTeacherId(client, schoolId, teacherId)) await client.query("INSERT IGNORE INTO deneme_kulubu_grup_ogretmenleri (okul_id, grup_id, ogretmen_id) VALUES (?, ?, ?)", [schoolId, groupId, teacherId]);
  }
};

const writerFor = (baseName: string) => {
  if (baseName === "teachers" || baseName === "school_teachers") return writeTeacher;
  if (baseName === "classrooms" || baseName === "school_classrooms") return writeClassroom;
  if (baseName === "students" || baseName === "school_students") return writeStudent;
  if (baseName === "courses") return writeCourse;
  if (baseName === "trial_club_registrations") return writeTrialRegistration;
  if (baseName === "trial_club_league_groups") return writeTrialGroup;
  throw new Error(`İlişkisel koleksiyon desteklenmiyor: ${baseName}`);
};

const tableFor = (baseName: string) => {
  if (baseName === "teachers" || baseName === "school_teachers") return ["ogretmenler", "ogretmen_id"];
  if (baseName === "classrooms" || baseName === "school_classrooms") return ["siniflar", "sinif_id"];
  if (baseName === "students" || baseName === "school_students") return ["ogrenciler", "ogrenci_id"];
  if (baseName === "courses") return ["dersler", "ders_id"];
  if (baseName === "trial_club_registrations") return ["deneme_kulubu_uyeleri", "uyelik_id"];
  return ["deneme_kulubu_gruplari", "grup_id"];
};

export async function replaceRelationalCollection(collectionName: string, documents: any[]) {
  const info = relationalCollectionInfo(collectionName);
  if (!info) throw new Error("İlişkisel koleksiyon bulunamadı.");
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    const schoolId = await ensureSchool(client, info.schoolId);
    const writer = writerFor(info.baseName);
    const ids: string[] = [];
    for (const document of documents) {
      await writer(client, schoolId, document);
      const writtenId = info.baseName === "classrooms" || info.baseName === "school_classrooms"
        ? relationalClassId(document?.name || document?.classroom || document?.className)
        : document?.id || document?.studentId || document?.teacherId;
      ids.push(text(writtenId));
    }
    const [tableName, idColumn] = tableFor(info.baseName);
    const validIds = [...new Set(ids.filter(Boolean))];
    if (validIds.length) {
      await client.query(`DELETE FROM ${tableName} WHERE okul_id=? AND ${idColumn} NOT IN (${validIds.map(() => "?").join(",")})`, [schoolId, ...validIds]);
    } else {
      await client.query(`DELETE FROM ${tableName} WHERE okul_id=?`, [schoolId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function upsertRelationalDocument(collectionName: string, data: any) {
  const info = relationalCollectionInfo(collectionName);
  if (!info) throw new Error("İlişkisel koleksiyon bulunamadı.");
  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    const schoolId = await ensureSchool(client, info.schoolId);
    await writerFor(info.baseName)(client, schoolId, data);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function deleteRelationalDocument(collectionName: string, documentId: string) {
  const info = relationalCollectionInfo(collectionName);
  if (!info) throw new Error("İlişkisel koleksiyon bulunamadı.");
  const [tableName, idColumn] = tableFor(info.baseName);
  const client = await pool.connect();
  try {
    const schoolId = await ensureSchool(client, info.schoolId);
    await client.query(`DELETE FROM ${tableName} WHERE okul_id=? AND ${idColumn}=?`, [schoolId, documentId]);
  } finally { client.release(); }
}

export async function loadRelationalCoreDocuments(): Promise<RelationalDocument[]> {
  const [schoolsResult, teachersResult, classesResult, studentsResult, coursesResult, membershipsResult, groupsResult,
    classGroupsResult, teacherClassesResult, commissionsResult, leavesResult, courseTargetsResult,
    membershipTeachersResult, groupStudentsResult, groupTeachersResult] = await Promise.all([
    pool.query(`SELECT o.*,
      COALESCE(NULLIF(p.uygulama_okul_id, ''), o.uygulama_okul_id) AS etkin_uygulama_okul_id
      FROM okullar o
      LEFT JOIN panel_okullari p ON p.okul_kodu=o.okul_id
      WHERE o.aktif=1`),
    pool.query("SELECT * FROM ogretmenler"),
    pool.query(`SELECT s.*, r.ad_soyad rehber_ogretmen_adi, p.ad_soyad psikolojik_danisman_adi
      FROM siniflar s LEFT JOIN ogretmenler r ON r.okul_id=s.okul_id AND r.ogretmen_id=s.rehber_ogretmen_id
      LEFT JOIN ogretmenler p ON p.okul_id=s.okul_id AND p.ogretmen_id=s.psikolojik_danisman_id WHERE s.aktif=1`),
    pool.query(`SELECT o.*, s.sinif_adi FROM ogrenciler o LEFT JOIN siniflar s ON s.okul_id=o.okul_id AND s.sinif_id=o.sinif_id`),
    pool.query(`SELECT d.*, s.sinif_adi, t1.ad_soyad birinci_ogretmen_adi, t2.ad_soyad ikinci_ogretmen_adi
      FROM dersler d LEFT JOIN siniflar s ON s.okul_id=d.okul_id AND s.sinif_id=d.sinif_id
      LEFT JOIN ogretmenler t1 ON t1.okul_id=d.okul_id AND t1.ogretmen_id=d.birinci_ogretmen_id
      LEFT JOIN ogretmenler t2 ON t2.okul_id=d.okul_id AND t2.ogretmen_id=d.ikinci_ogretmen_id`),
    pool.query(`SELECT u.*, o.okul_numarasi, o.ad_soyad ogrenci_adi, s.sinif_adi, s.sinif_duzeyi
      FROM deneme_kulubu_uyeleri u JOIN ogrenciler o ON o.okul_id=u.okul_id AND o.ogrenci_id=u.ogrenci_id
      LEFT JOIN siniflar s ON s.okul_id=o.okul_id AND s.sinif_id=o.sinif_id`),
    pool.query("SELECT * FROM deneme_kulubu_gruplari WHERE aktif=1"),
    pool.query("SELECT * FROM sinif_gruplari"), pool.query("SELECT * FROM ogretmen_siniflari"),
    pool.query("SELECT * FROM ogretmen_komisyonlari"), pool.query("SELECT * FROM ogretmen_izin_tarihleri"),
    pool.query("SELECT * FROM ders_hedef_gruplari"),
    pool.query(`SELECT b.*, o.ad_soyad ogretmen_adi FROM deneme_kulubu_uye_ogretmenleri b
      JOIN ogretmenler o ON o.okul_id=b.okul_id AND o.ogretmen_id=b.ogretmen_id`),
    pool.query(`SELECT b.*, o.okul_numarasi, o.ad_soyad ogrenci_adi FROM deneme_kulubu_grup_uyeleri b
      JOIN ogrenciler o ON o.okul_id=b.okul_id AND o.ogrenci_id=b.ogrenci_id`),
    pool.query(`SELECT b.*, o.ad_soyad ogretmen_adi FROM deneme_kulubu_grup_ogretmenleri b
      JOIN ogretmenler o ON o.okul_id=b.okul_id AND o.ogretmen_id=b.ogretmen_id`),
  ]);
  const applicationSchoolIds = new Map(schoolsResult.rows.map((row: any) => [
    text(row.okul_id),
    text(row.etkin_uygulama_okul_id) || text(row.uygulama_okul_id),
  ]));
  const applicationSchoolId = (databaseId: unknown) => applicationSchoolIds.get(text(databaseId)) || text(databaseId);
  const grouped = (rows: any[], keys: string[], value: (row: any) => any) => {
    const map = new Map<string, any[]>();
    for (const row of rows) {
      const key = keys.map((name) => text(row[name])).join("\u0000");
      map.set(key, [...(map.get(key) || []), value(row)]);
    }
    return map;
  };
  const key = (schoolId: unknown, id: unknown) => `${text(schoolId)}\u0000${text(id)}`;
  const classGroups = grouped(classGroupsResult.rows, ["okul_id", "sinif_id"], (row) => text(row.grup_adi));
  const teacherClasses = grouped(teacherClassesResult.rows, ["okul_id", "ogretmen_id"], (row) => text(row.sinif_id));
  const commissions = grouped(commissionsResult.rows, ["okul_id", "ogretmen_id"], (row) => text(row.komisyon_adi));
  const leaves = grouped(leavesResult.rows, ["okul_id", "ogretmen_id"], (row) => String(row.izin_tarihi).slice(0, 10));
  const courseTargets = grouped(courseTargetsResult.rows, ["okul_id", "ders_id"], (row) => text(row.grup_adi));
  const membershipTeachers = grouped(membershipTeachersResult.rows, ["okul_id", "uyelik_id"], (row) => ({ id: text(row.ogretmen_id), name: text(row.ogretmen_adi) }));
  const groupStudents = grouped(groupStudentsResult.rows, ["okul_id", "grup_id"], (row) => ({ id: text(row.ogrenci_id), number: text(row.okul_numarasi), name: text(row.ogrenci_adi) }));
  const groupTeachers = grouped(groupTeachersResult.rows, ["okul_id", "grup_id"], (row) => ({ id: text(row.ogretmen_id), name: text(row.ogretmen_adi) }));
  const classNames = new Map(classesResult.rows.map((row: any) => [key(row.okul_id, row.sinif_id), text(row.sinif_adi)]));

  const courseData = coursesResult.rows.map((row: any) => ({
    schoolId: text(row.okul_id), id: text(row.ders_id), name: text(row.ders_adi), code: text(row.ders_kodu),
    classroom: text(row.sinif_adi), classroomId: text(row.sinif_id), teacherId: text(row.birinci_ogretmen_id),
    teacherName: text(row.birinci_ogretmen_adi), teacherId2: text(row.ikinci_ogretmen_id), teacherName2: text(row.ikinci_ogretmen_adi),
    teacherAssignmentCleared: boolValue(row.ogretmen_atamasi_temizlendi), schedule: text(row.program_aciklamasi),
    studentCount: numberValue(row.ogrenci_sayisi), weeklyHours: numberValue(row.haftalik_ders_saati), type: text(row.ders_turu),
    branch: text(row.brans), legacyCombinedCourse: text(row.eski_birlesik_ders), splitGroupId: text(row.paralel_grup_id),
    isCommonElective: boolValue(row.ortak_secmeli), targetGroups: courseTargets.get(key(row.okul_id, row.ders_id)) || [],
    updatedAt: isoDate(row.guncellenme_zamani),
  }));
  const coursesByClass = new Map<string, any[]>();
  for (const course of courseData) {
    const classKey = key(course.schoolId, course.classroomId);
    coursesByClass.set(classKey, [...(coursesByClass.get(classKey) || []), {
      id: course.id, courseName: course.name, courseId: course.id, weeklyHours: course.weeklyHours,
      teacherId: course.teacherId, teacherName: course.teacherName, teacherId2: course.teacherId2, teacherName2: course.teacherName2,
      teacherAssignmentCleared: course.teacherAssignmentCleared, type: course.type, branch: course.branch,
      targetGroups: course.targetGroups, splitGroupId: course.splitGroupId,
    }]);
  }
  const documents: RelationalDocument[] = [];
  const pushAliases = (schoolId: string, aliases: string[], id: string, data: any, updatedAt: string) => {
    const logicalSchoolId = applicationSchoolId(schoolId);
    for (const alias of aliases) documents.push({ collectionName: collectionNameFor(logicalSchoolId, alias), documentId: id, data, updatedAt });
  };
  for (const row of teachersResult.rows as any[]) {
    const schoolId = text(row.okul_id); const id = text(row.ogretmen_id);
    const assignedClassrooms = (teacherClasses.get(key(schoolId, id)) || []).map((classId) => classNames.get(key(schoolId, classId)) || classId);
    const data = { id, name: text(row.ad_soyad), branch: text(row.brans), email: text(row.e_posta), phone: text(row.telefon),
      weeklyHours: numberValue(row.haftalik_ders_saati), assignedClassrooms, status: text(row.durum), adminRole: text(row.yonetim_rolu),
      commissions: commissions.get(key(schoolId, id)) || [], avatar: text(row.avatar), leaveReason: text(row.izin_nedeni), leaveDates: leaves.get(key(schoolId, id)) || [] };
    pushAliases(schoolId, ["teachers", "school_teachers"], id, data, isoDate(row.guncellenme_zamani));
  }
  for (const row of classesResult.rows as any[]) {
    const schoolId = text(row.okul_id); const id = text(row.sinif_id);
    const data = { id, name: text(row.sinif_adi), level: text(row.sinif_duzeyi), groups: classGroups.get(key(schoolId, id)) || [],
      advisorTeacherId: text(row.rehber_ogretmen_id), advisorTeacherName: text(row.rehber_ogretmen_adi),
      counselorTeacherId: text(row.psikolojik_danisman_id), counselorTeacherName: text(row.psikolojik_danisman_adi),
      vicePrincipal: text(row.sorumlu_mudur_yardimcisi), assignedCourses: coursesByClass.get(key(schoolId, id)) || [] };
    pushAliases(schoolId, ["classrooms", "school_classrooms"], id, data, isoDate(row.guncellenme_zamani));
  }
  for (const row of studentsResult.rows as any[]) {
    const schoolId = text(row.okul_id); const id = text(row.ogrenci_id); const schoolNumber = text(row.okul_numarasi);
    const data = { id, name: text(row.ad_soyad), classroom: text(row.sinif_adi), classId: text(row.sinif_id), classroomId: text(row.sinif_id),
      group: text(row.alan_grubu), phone: text(row.telefon), parentName: text(row.veli_ad_soyad), parentPhone: text(row.veli_telefon),
      dob: text(row.dogum_tarihi), pob: text(row.dogum_yeri), address: text(row.adres), oob: numberValue(row.okul_disinda),
      status: text(row.durum), registerDate: text(row.kayit_tarihi), avatar: text(row.avatar), gpa: row.not_ortalamasi == null ? undefined : Number(row.not_ortalamasi),
      absences: row.devamsizlik == null ? undefined : Number(row.devamsizlik), email: text(row.e_posta), number: schoolNumber, studentNumber: schoolNumber };
    pushAliases(schoolId, ["students", "school_students"], id, data, isoDate(row.guncellenme_zamani));
  }
  for (const course of courseData) {
    const { schoolId, updatedAt, ...data } = course;
    documents.push({ collectionName: collectionNameFor(applicationSchoolId(schoolId), "courses"), documentId: data.id, data, updatedAt });
  }
  for (const row of membershipsResult.rows as any[]) {
    const schoolId = text(row.okul_id); const id = text(row.uyelik_id); const teachers = membershipTeachers.get(key(schoolId, id)) || [];
    const data = { id, studentId: text(row.ogrenci_id), studentNumber: text(row.okul_numarasi), studentName: text(row.ogrenci_adi),
      classroom: text(row.sinif_adi), gradeLevel: text(row.sinif_duzeyi).match(/\d+/)?.[0] || text(row.sinif_adi).match(/\d+/)?.[0] || "",
      teacherIds: teachers.map((item) => item.id), teacherNames: teachers.map((item) => item.name), schoolId: applicationSchoolId(schoolId), active: boolValue(row.aktif),
      createdAt: isoDate(row.kayit_zamani), updatedAt: isoDate(row.guncellenme_zamani) };
    documents.push({ collectionName: collectionNameFor(applicationSchoolId(schoolId), "trial_club_registrations"), documentId: id, data, updatedAt: data.updatedAt });
  }
  for (const row of groupsResult.rows as any[]) {
    const schoolId = text(row.okul_id); const id = text(row.grup_id); const students = groupStudents.get(key(schoolId, id)) || []; const teachers = groupTeachers.get(key(schoolId, id)) || [];
    const data = { id, name: text(row.grup_adi), gradeLevel: text(row.sinif_duzeyi), studentIds: students.map((item) => item.id),
      studentNumbers: students.map((item) => item.number), studentNames: students.map((item) => item.name), teacherIds: teachers.map((item) => item.id),
      teacherNames: teachers.map((item) => item.name), schoolId: applicationSchoolId(schoolId), active: boolValue(row.aktif), createdAt: isoDate(row.olusturulma_zamani), updatedAt: isoDate(row.guncellenme_zamani) };
    documents.push({ collectionName: collectionNameFor(applicationSchoolId(schoolId), "trial_club_league_groups"), documentId: id, data, updatedAt: data.updatedAt });
  }
  return documents;
}

export { RELATIONAL_MIGRATION_KEY };
