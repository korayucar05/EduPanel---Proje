import type { Teacher } from "../../types";

export const normalizeScheduleText = (value: unknown): string =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");

export function normalizeGroups(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeScheduleText).filter(Boolean))].sort();
  }
  return [...new Set(
    String(value ?? "")
      .split(/[,/+]+/)
      .map(normalizeScheduleText)
      .filter(Boolean),
  )].sort();
}


/**
 * Ders kaydında öğrenci bazlı atama varsa onu kanonik kimliğe çevirir.
 * Bu bilgi SAY/EA etiketi olmayan fakat öğrenci tikleriyle oluşturulmuş
 * paralel derslerin gerçek çakışma kaynağıdır.
 */
export function getExplicitCourseStudentIds(course: any): string[] {
  if (!Array.isArray(course?.studentIds)) return [];
  return [...new Set(
    course.studentIds
      .map((id: unknown) => String(id ?? "").trim())
      .filter(Boolean),
  )].sort();
}

export function courseStudentAudiencesOverlap(a: any, b: any): boolean | null {
  const aStudents = getExplicitCourseStudentIds(a);
  const bStudents = getExplicitCourseStudentIds(b);
  if (!aStudents.length || !bStudents.length) return null;

  const bSet = new Set(bStudents);
  return aStudents.some((studentId) => bSet.has(studentId));
}

/** Aynı fiziksel şubenin grup kopyalarını tek kimliğe indirger. */
export function getPhysicalClassIdentity(classroomOrName: any): string {
  const raw = typeof classroomOrName === "string"
    ? classroomOrName
    : classroomOrName?.name || classroomOrName?.className || "";
  const normalized = normalizeScheduleText(raw)
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^(9|10|11|12)\s*[-/.]?\s*([A-ZÇĞİÖŞÜ])/);
  if (match) return `${match[1]}${match[2]}`;
  return normalized
    .replace(/\b(GENEL|ORTAK|SAY|SAYISAL|EA|EŞİT AĞIRLIK|ESIT AGIRLIK|SÖZ|SOZ|SÖZEL|SOZEL|DİL|DIL|YABANCI DİL|YABANCI DIL)\b/g, "")
    .replace(/[^0-9A-ZÇĞİÖŞÜ]/g, "");
}


/**
 * Dersin HEDEF GRUPLARINI döndürür.
 *
 * Önemli ayrım:
 * - classroom.groups => sınıfta hangi grup türlerinin bulunduğunu anlatır.
 * - course.targetGroups / course.groupName => BU DERSİN hangi öğrenci grubuna ait olduğunu anlatır.
 *
 * Paralellik kararı yalnız dersin hedef gruplarına göre verilmelidir.
 */
export function getCourseTargetGroups(course: any): string[] {
  const raw =
    Array.isArray(course?.targetGroups) && course.targetGroups.length
      ? course.targetGroups
      : course?.groupName;

  const explicitGroups = normalizeGroups(raw).filter(
    (group) => group !== "GENEL" && group !== "ORTAK",
  );
  if (explicitGroups.length) return explicitGroups;

  // Sınıfı ikiye bölen derslerde (örn. Kur'an-ı Kerim / Peygamberimizin Hayatı)
  // eski kayıtlarda groupName boş kalabiliyor. splitGroupId varsa bu ders ORTAK
  // değildir; aynı split kümesindeki her üye kendi öğrenci alt grubunu temsil eder.
  // Üyeleri birbirinden ayırmak için kararlı, sentetik bir hedef grup kimliği üret.
  const splitGroupId = normalizeScheduleText(course?.splitGroupId || "");
  if (splitGroupId) {
    const courseName = normalizeScheduleText(getScheduleCourseName(course));
    const teacherKey = normalizeScheduleText(course?.teacherId || course?.teacherName || course?.teacherId2 || course?.teacherName2 || "");
    const studentKey = Array.isArray(course?.studentIds)
      ? course.studentIds.map((id: unknown) => String(id)).sort().join("-")
      : "";
    return [`SPLIT:${splitGroupId}:${courseName}:${teacherKey}:${studentKey}`];
  }

  return [];
}

/**
 * Hedef grup listesi boşsa ders GENEL/ORTAK kabul edilir ve bütün sınıfı kapatır.
 */
export function isCommonCourseForClass(course: any): boolean {
  // Öğrenci bazlı tikle oluşturulmuş bir ders, groupName boş olsa bile
  // "bütün sınıf" değildir. Bu ayrım paralel alan/seçmeli derslerinin
  // gereksiz yere ortak ders sayılmasını engeller.
  return getCourseTargetGroups(course).length === 0 && getExplicitCourseStudentIds(course).length === 0;
}

/**
 * Aynı sınıftaki iki dersin aynı anda yapılıp yapılamayacağını belirleyen TEK merkezi kural.
 *
 * - GENEL/ORTAK ders bütün sınıfı kapatır -> her dersle çatışır.
 * - İki grup dersi yalnız hedef grup kümeleri kesişiyorsa çatışır.
 *
 * Örnek:
 *   SAY       vs EA       => çakışmaz
 *   SAY       vs SAY+EA   => çakışır
 *   GENEL     vs EA       => çakışır
 *
 * Sınıfın kendisinde SAY+EA tanımlı olması tek başına paralellik vermez.
 */
export function coursesConflictInSameClass(a: any, b: any): boolean {
  // İki derste de öğrenci listesi varsa en güvenilir kaynak öğrenci kümesidir.
  // Kümeler ayrık ise aynı fiziksel saatte paralel yürüyebilir; tek bir öğrenci
  // bile ortaksa çakışma vardır.
  const studentOverlap = courseStudentAudiencesOverlap(a, b);
  if (studentOverlap !== null) return studentOverlap;

  const groupsA = getCourseTargetGroups(a);
  const groupsB = getCourseTargetGroups(b);

  // Öğrenci/grup hedefi bulunmayan ders tüm sınıfı kapatır.
  if (isCommonCourseForClass(a) || isCommonCourseForClass(b)) return true;

  // Bir tarafta yalnız öğrenci bazlı hedef var, diğer tarafta yalnız grup etiketi
  // varsa güvenli tarafta kalıp çakışma kabul edilir. İki tarafın da öğrenci
  // listesi olduğunda yukarıdaki kesin kontrol zaten uygulanmıştır.
  if (groupsA.length === 0 || groupsB.length === 0) return true;

  return groupsA.some((group) => groupsB.includes(group));
}

export function getScheduleCourseName(course: any): string {
  return String(course?.courseName || course?.name || course?.subject || "Ders").trim();
}

export function getScheduleWeeklyHours(course: any): number {
  if (Number.isFinite(Number(course?.weeklyHours))) return Math.max(0, Number(course.weeklyHours));
  const match = String(course?.schedule || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Dersin kalıcı/solver kimliği. Aynı isimli derslerin farklı saat veya gruplarda
 * birbirini ezmesini önler.
 */
export function createCourseIdentity(course: any, classId = ""): string {
  const groups = getCourseTargetGroups(course).join("+");
  const studentIds = getExplicitCourseStudentIds(course);
  const audience = studentIds.length
    ? `STUDENTS:${studentIds.join("-")}`
    : (groups || "GENEL");

  return [
    normalizeScheduleText(classId || course?.classId || course?.classroom || course?.className),
    normalizeScheduleText(getScheduleCourseName(course)),
    String(getScheduleWeeklyHours(course)),
    audience,
    normalizeScheduleText(course?.splitGroupId || ""),
  ].join("__");
}

export function sameCourseIdentity(a: any, b: any, classId = ""): boolean {
  return createCourseIdentity(a, classId) === createCourseIdentity(b, classId);
}

/** ID varsa ID, yoksa isim fallback. */
export function getTeacherIdentityKeys(course: any): string[] {
  const keys: string[] = [];
  const pairs = [
    [course?.teacherId, course?.teacherName],
    [course?.teacherId2, course?.teacherName2],
  ];
  for (const [id, name] of pairs) {
    if (id !== undefined && id !== null && String(id).trim()) keys.push(`ID:${String(id).trim()}`);
    else if (name && !["Öğretmen Atanmadı", "Belirtilmedi"].includes(String(name).trim())) {
      keys.push(`NAME:${normalizeScheduleText(name)}`);
    }
  }
  return [...new Set(keys)];
}

export function resolveTeacherIdentityKeys(course: any, teachers: Teacher[]): string[] {
  const hydrated = { ...course };
  if (!hydrated.teacherId && hydrated.teacherName) {
    const teacher = (teachers as any[]).find((item) => normalizeScheduleText(item?.name) === normalizeScheduleText(hydrated.teacherName));
    if (teacher) hydrated.teacherId = teacher.id;
  }
  if (!hydrated.teacherId2 && hydrated.teacherName2) {
    const teacher = (teachers as any[]).find((item) => normalizeScheduleText(item?.name) === normalizeScheduleText(hydrated.teacherName2));
    if (teacher) hydrated.teacherId2 = teacher.id;
  }
  return getTeacherIdentityKeys(hydrated);
}
