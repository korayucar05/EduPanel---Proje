import fs from "node:fs";
import path from "node:path";
import { pool } from "./index.ts";

export const RELATIONAL_SCHEDULE_MIGRATION_KEY = "documents-relational-schedule-v1";
type QueryClient = Awaited<ReturnType<typeof pool.connect>>;

const STATE_DOCUMENT_ID = "scheduleData";
const ASSIGNMENT_FIELDS = new Set([
  "id", "courseId", "courseName", "name", "subject",
  "teacherId", "teacherId2", "teacherName", "teacherName2",
  "originalTeacherId", "originalTeacherId2", "originalTeacherName", "originalTeacherName2",
  "classId", "className", "type", "groupName", "targetGroups", "weeklyHours",
  "splitGroupId", "studentIds", "blockId", "commonCourseKey", "lessonNo",
  "isManual", "isLocked", "isCommonCourse", "isCommonElective",
  "blockDuration", "blockIndex", "indivisibleTwoHourBlock", "engine", "isDraftSchedule", "draftMode",
]);
const DERIVED_COURSE_FIELDS = new Set([
  "code", "classroom", "schedule", "studentCount", "teacherAssignmentCleared",
  "selectedClassrooms", "classGroups", "preferredBlocks", "blockPattern",
  "preferredBlockPattern", "isGrouped", "originalCourses", "courseType",
  "__originalTeacherId", "__originalTeacherId2", "__originalTeacherName",
  "__originalTeacherName2", "__draftWithoutTeachers",
]);

export function relationalScheduleDocumentInfo(collectionName: string, documentId = STATE_DOCUMENT_ID) {
  return documentId === STATE_DOCUMENT_ID
    && (collectionName === "app_state" || /^school__.+__app_state$/.test(collectionName));
}

export async function ensureRelationalScheduleSchema() {
  const schemaPath = path.join(process.cwd(), "database", "schema", "edupanel-relational-schedule-schema.sql");
  if (!fs.existsSync(schemaPath)) throw new Error(`İlişkisel ders programı şeması bulunamadı: ${schemaPath}`);
  const statements = fs.readFileSync(schemaPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  for (const statement of statements) await pool.query(statement);
}

export async function isRelationalScheduleReady() {
  const result = await pool.query(
    "SELECT migration_key FROM edupanel_migrations WHERE migration_key=?",
    [RELATIONAL_SCHEDULE_MIGRATION_KEY],
  );
  return result.rowCount > 0;
}

const applicationSchoolIdFromCollection = (collectionName: string) => {
  if (collectionName === "app_state") return "school-main";
  return collectionName.match(/^school__(.+)__app_state$/)?.[1] || "school-main";
};

const collectionFromApplicationSchoolId = (schoolId: string) =>
  schoolId === "school-main" ? "app_state" : `school__${schoolId}__app_state`;

const resolveDatabaseSchoolId = async (applicationSchoolId: string) => {
  const result = await pool.query(`SELECT okul_id FROM okullar
    WHERE uygulama_okul_id=? OR okul_id=?
    ORDER BY (uygulama_okul_id=?) DESC, aktif DESC, okul_id LIMIT 1`,
  [applicationSchoolId, applicationSchoolId, applicationSchoolId]);
  const schoolId = String(result.rows[0]?.okul_id || "").trim();
  if (!schoolId) throw new Error(`Ders programı için okul bulunamadı: ${applicationSchoolId}`);
  return schoolId;
};

const mysqlDateTime = (value: unknown) => {
  const parsed = new Date(String(value || ""));
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return date.toISOString().replace("T", " ").replace("Z", "");
};

const parseScheduleKey = (key: string) => {
  const blocked = key.match(/^blocked_(class|teacher)_(.+)_([^_]+)_(\d+)$/);
  if (blocked) return { kind: "blocked" as const, viewType: blocked[1], targetId: blocked[2], day: blocked[3], hour: Number(blocked[4]) };
  const assignment = key.match(/^(class|teacher)_(.+)_([^_]+)_(\d+)$/);
  if (assignment) return { kind: "assignment" as const, viewType: assignment[1], targetId: assignment[2], day: assignment[3], hour: Number(assignment[4]) };
  return null;
};

const optionalText = (value: unknown) => value === undefined || value === null ? null : String(value);
const optionalNumber = (value: unknown) => value === undefined || value === null || value === "" ? null : Number(value);
const optionalBoolean = (value: unknown) => value === undefined || value === null ? null : (value ? 1 : 0);

const validateAssignment = (assignment: any, key: string) => {
  if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) {
    throw new Error(`Ders programındaki atama nesne değil: ${key}`);
  }
  const unsupported = Object.keys(assignment).filter((field) => !ASSIGNMENT_FIELDS.has(field) && !DERIVED_COURSE_FIELDS.has(field));
  if (unsupported.length) throw new Error(`Ders programında desteklenmeyen alanlar var (${key}): ${unsupported.join(", ")}`);
};

const insertAssignment = async (
  client: QueryClient,
  programId: number,
  keyInfo: Exclude<ReturnType<typeof parseScheduleKey>, null> & { kind: "assignment" },
  assignment: any,
  order: number,
) => {
  validateAssignment(assignment, `${keyInfo.viewType}_${keyInfo.targetId}_${keyInfo.day}_${keyInfo.hour}`);
  const result = await client.query(`INSERT INTO ders_programi_atamalari
    (program_id, gorunum_turu, hedef_id, gun, ders_saati, sira_no,
     kayit_id, ders_id, ders_adi, ad, konu, ogretmen_id, ikinci_ogretmen_id,
     ogretmen_adi, ikinci_ogretmen_adi, orijinal_ogretmen_id,
     orijinal_ikinci_ogretmen_id, orijinal_ogretmen_adi,
     orijinal_ikinci_ogretmen_adi, sinif_id, sinif_adi, kayit_turu, grup_adi,
     haftalik_saat, bolunmus_grup_id, blok_id, blok_suresi, blok_sirasi,
     bolunemez_iki_saat, program_motoru, taslak_program, taslak_modu,
     ortak_ders_anahtari, ders_sirasi, elle_eklendi, kilitli, ortak_ders, ortak_secmeli)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    programId, keyInfo.viewType, keyInfo.targetId, keyInfo.day, keyInfo.hour, order,
    optionalText(assignment.id), optionalText(assignment.courseId), optionalText(assignment.courseName),
    optionalText(assignment.name), optionalText(assignment.subject), optionalText(assignment.teacherId),
    optionalText(assignment.teacherId2), optionalText(assignment.teacherName), optionalText(assignment.teacherName2),
    optionalText(assignment.originalTeacherId ?? assignment.__originalTeacherId),
    optionalText(assignment.originalTeacherId2 ?? assignment.__originalTeacherId2),
    optionalText(assignment.originalTeacherName ?? assignment.__originalTeacherName),
    optionalText(assignment.originalTeacherName2 ?? assignment.__originalTeacherName2),
    optionalText(assignment.classId), optionalText(assignment.className), optionalText(assignment.type),
    optionalText(assignment.groupName), optionalNumber(assignment.weeklyHours), optionalText(assignment.splitGroupId),
    optionalText(assignment.blockId), optionalNumber(assignment.blockDuration), optionalNumber(assignment.blockIndex),
    optionalBoolean(assignment.indivisibleTwoHourBlock), optionalText(assignment.engine),
    optionalBoolean(assignment.isDraftSchedule ?? assignment.__draftWithoutTeachers), optionalText(assignment.draftMode),
    optionalText(assignment.commonCourseKey), optionalNumber(assignment.lessonNo),
    optionalBoolean(assignment.isManual), optionalBoolean(assignment.isLocked),
    optionalBoolean(assignment.isCommonCourse), optionalBoolean(assignment.isCommonElective),
  ]);
  const assignmentId = Number(result.insertId || 0);
  for (const [index, group] of (Array.isArray(assignment.targetGroups) ? assignment.targetGroups : []).entries()) {
    await client.query("INSERT INTO ders_programi_hedef_gruplari (atama_id, sira_no, hedef_grup) VALUES (?, ?, ?)",
      [assignmentId, index, String(group)]);
  }
  for (const [index, studentId] of (Array.isArray(assignment.studentIds) ? assignment.studentIds : []).entries()) {
    await client.query("INSERT INTO ders_programi_ogrencileri (atama_id, sira_no, ogrenci_id) VALUES (?, ?, ?)",
      [assignmentId, index, String(studentId)]);
  }
};

export async function replaceRelationalScheduleDocument(
  collectionName: string,
  data: any,
  updatedAt: string,
) {
  if (!relationalScheduleDocumentInfo(collectionName)) throw new Error(`İlişkisel ders programı adresi desteklenmiyor: ${collectionName}`);
  const applicationSchoolId = applicationSchoolIdFromCollection(collectionName);
  const schoolId = await resolveDatabaseSchoolId(applicationSchoolId);
  const schedule = data?.value && typeof data.value === "object" ? data.value : data;
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) throw new Error("Ders programı nesne biçiminde olmalıdır.");
  const unknownKeys = Object.keys(schedule).filter((key) => !parseScheduleKey(key));
  if (unknownKeys.length) throw new Error(`Ders programında desteklenmeyen anahtarlar var: ${unknownKeys.slice(0, 10).join(", ")}`);

  const client = await pool.connect();
  try {
    await client.query("START TRANSACTION");
    await client.query(`INSERT INTO ders_programlari (okul_id, uygulama_okul_id, guncellenme_zamani)
      VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE uygulama_okul_id=VALUES(uygulama_okul_id),
      guncellenme_zamani=VALUES(guncellenme_zamani)`, [schoolId, applicationSchoolId, mysqlDateTime(updatedAt)]);
    const header = await client.query("SELECT program_id FROM ders_programlari WHERE okul_id=? LIMIT 1", [schoolId]);
    const programId = Number(header.rows[0]?.program_id || 0);
    if (!programId) throw new Error("Ders programı üst kaydı oluşturulamadı.");
    await client.query("DELETE FROM ders_programi_kapali_saatleri WHERE program_id=?", [programId]);
    await client.query("DELETE FROM ders_programi_atamalari WHERE program_id=?", [programId]);

    for (const [key, raw] of Object.entries(schedule)) {
      const keyInfo = parseScheduleKey(key)!;
      if (keyInfo.kind === "blocked") {
        if (raw) await client.query(`INSERT INTO ders_programi_kapali_saatleri
          (program_id, hedef_turu, hedef_id, gun, ders_saati) VALUES (?, ?, ?, ?, ?)`,
        [programId, keyInfo.viewType, keyInfo.targetId, keyInfo.day, keyInfo.hour]);
        continue;
      }
      const assignments = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const [index, assignment] of assignments.entries()) {
        await insertAssignment(client, programId, keyInfo, assignment, index);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRelationalScheduleDocument(collectionName: string) {
  const applicationSchoolId = applicationSchoolIdFromCollection(collectionName);
  await pool.query("DELETE FROM ders_programlari WHERE uygulama_okul_id=?", [applicationSchoolId]);
}

const addText = (target: any, key: string, value: unknown) => { if (value !== null && value !== undefined) target[key] = String(value); };
const addNumber = (target: any, key: string, value: unknown) => { if (value !== null && value !== undefined) target[key] = Number(value); };
const addBoolean = (target: any, key: string, value: unknown) => { if (value !== null && value !== undefined) target[key] = Boolean(value); };

export async function loadRelationalScheduleDocuments() {
  const programs = await pool.query("SELECT * FROM ders_programlari ORDER BY program_id");
  const documents: Array<{ collectionName: string; documentId: string; data: any; updatedAt: string }> = [];
  for (const program of programs.rows as any[]) {
    const schedule: Record<string, any> = {};
    const assignments = await pool.query("SELECT * FROM ders_programi_atamalari WHERE program_id=? ORDER BY atama_id", [program.program_id]);
    const groupRows = await pool.query(`SELECT g.atama_id, g.hedef_grup
      FROM ders_programi_hedef_gruplari g
      INNER JOIN ders_programi_atamalari a ON a.atama_id=g.atama_id
      WHERE a.program_id=? ORDER BY g.atama_id, g.sira_no`, [program.program_id]);
    const studentRows = await pool.query(`SELECT o.atama_id, o.ogrenci_id
      FROM ders_programi_ogrencileri o
      INNER JOIN ders_programi_atamalari a ON a.atama_id=o.atama_id
      WHERE a.program_id=? ORDER BY o.atama_id, o.sira_no`, [program.program_id]);
    const groupsByAssignment = new Map<number, string[]>();
    const studentsByAssignment = new Map<number, string[]>();
    for (const row of groupRows.rows as any[]) {
      const id = Number(row.atama_id);
      const values = groupsByAssignment.get(id) || [];
      values.push(String(row.hedef_grup));
      groupsByAssignment.set(id, values);
    }
    for (const row of studentRows.rows as any[]) {
      const id = Number(row.atama_id);
      const values = studentsByAssignment.get(id) || [];
      values.push(String(row.ogrenci_id));
      studentsByAssignment.set(id, values);
    }
    for (const row of assignments.rows as any[]) {
      const item: any = {};
      addText(item, "id", row.kayit_id); addText(item, "courseId", row.ders_id);
      addText(item, "courseName", row.ders_adi); addText(item, "name", row.ad); addText(item, "subject", row.konu);
      addText(item, "teacherId", row.ogretmen_id); addText(item, "teacherId2", row.ikinci_ogretmen_id);
      addText(item, "teacherName", row.ogretmen_adi); addText(item, "teacherName2", row.ikinci_ogretmen_adi);
      addText(item, "originalTeacherId", row.orijinal_ogretmen_id); addText(item, "originalTeacherId2", row.orijinal_ikinci_ogretmen_id);
      addText(item, "originalTeacherName", row.orijinal_ogretmen_adi); addText(item, "originalTeacherName2", row.orijinal_ikinci_ogretmen_adi);
      addText(item, "classId", row.sinif_id); addText(item, "className", row.sinif_adi);
      addText(item, "type", row.kayit_turu); addText(item, "groupName", row.grup_adi);
      addNumber(item, "weeklyHours", row.haftalik_saat); addText(item, "splitGroupId", row.bolunmus_grup_id);
      addText(item, "blockId", row.blok_id); addText(item, "commonCourseKey", row.ortak_ders_anahtari);
      addNumber(item, "blockDuration", row.blok_suresi); addNumber(item, "blockIndex", row.blok_sirasi);
      addBoolean(item, "indivisibleTwoHourBlock", row.bolunemez_iki_saat); addText(item, "engine", row.program_motoru);
      addBoolean(item, "isDraftSchedule", row.taslak_program); addText(item, "draftMode", row.taslak_modu);
      addNumber(item, "lessonNo", row.ders_sirasi); addBoolean(item, "isManual", row.elle_eklendi);
      addBoolean(item, "isLocked", row.kilitli); addBoolean(item, "isCommonCourse", row.ortak_ders);
      addBoolean(item, "isCommonElective", row.ortak_secmeli);
      const groups = groupsByAssignment.get(Number(row.atama_id));
      const students = studentsByAssignment.get(Number(row.atama_id));
      if (groups?.length) item.targetGroups = groups;
      if (students?.length) item.studentIds = students;
      const key = `${row.gorunum_turu}_${row.hedef_id}_${row.gun}_${row.ders_saati}`;
      (schedule[key] ||= []).push(item);
    }
    const blocked = await pool.query("SELECT * FROM ders_programi_kapali_saatleri WHERE program_id=?", [program.program_id]);
    for (const row of blocked.rows as any[]) {
      schedule[`blocked_${row.hedef_turu}_${row.hedef_id}_${row.gun}_${row.ders_saati}`] = true;
    }
    const updatedAt = program.guncellenme_zamani instanceof Date
      ? program.guncellenme_zamani.toISOString()
      : String(program.guncellenme_zamani || new Date().toISOString());
    documents.push({
      collectionName: collectionFromApplicationSchoolId(String(program.uygulama_okul_id || "school-main")),
      documentId: STATE_DOCUMENT_ID,
      data: { id: STATE_DOCUMENT_ID, value: schedule, updatedAt },
      updatedAt,
    });
  }
  return documents;
}
