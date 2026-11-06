/**
 * e-Nstitü müfredat tek-kaynak servisi
 *
 * Amaç:
 * - Müfredatın localStorage / farklı SQLite köprüleri / öğretmen görev snapshot'ları
 *   arasında ayrı ayrı "ana kayıt" olarak yaşamasını engellemek.
 * - Sunucudaki `courseCurriculums` koleksiyonunu tek otorite yapmak.
 * - Eski kurulumlarda yalnızca ilk geçişte `course_curriculums_v1` verisini sunucuya
 *   taşımak; sonrasında bütün ekranların aynı sunucu kaydını okumasını sağlamak.
 */

export const CURRICULUM_COLLECTION = "courseCurriculums";
export const LEGACY_CURRICULUM_KEY = "course_curriculums_v1";
export const CURRICULUM_UPDATED_EVENT = "enstitu:curriculum-updated";
export const CURRICULUM_ARCHITECTURE_VERSION = 9;
export const CURRICULUM_V9_MIGRATION_MARKER = "enstitu_curriculum_v9_server_authority_migrated";

export type CurriculumStore = Record<string, any>;

export type CurriculumRecord = {
  id: string;
  curriculumKey: string;
  courseId: string;
  grade?: string;
  courseName?: string;
  curriculum: any;
  fingerprint: string;
  version: number;
  updatedAt: string;
};

export type CurriculumCourseQuery = {
  courseId?: unknown;
  grade?: unknown;
  courseName?: unknown;
  subject?: unknown;
};

export type CurriculumScopeOutcome = {
  id: string;
  name: string;
  questions?: any[];
};

export type CurriculumScopeTopic = {
  id: string;
  name: string;
  outcomes: CurriculumScopeOutcome[];
};

export type CurriculumScopeUnit = {
  id: string;
  name: string;
  topics: CurriculumScopeTopic[];
};

const CORE_COURSES: Array<{ id: string; name: string }> = [
  { id: "1", name: "Türk Dili ve Edebiyatı" },
  { id: "2", name: "Tarih" },
  { id: "3", name: "Coğrafya" },
  { id: "4", name: "Felsefe" },
  { id: "5", name: "Din Kültürü ve Ahlak Bilgisi" },
  { id: "7", name: "Matematik" },
  { id: "8", name: "Fizik" },
  { id: "9", name: "Kimya" },
  { id: "10", name: "Biyoloji" },
  { id: "11", name: "İngilizce" },
  { id: "12", name: "Almanca" },
];

export const normalizeCurriculumText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(dersi|ders)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

export const curriculumGrade = (value: unknown) => {
  const matched = String(value ?? "").match(/\d{1,2}/)?.[0];
  if (matched) return matched;
  return String(value ?? "").toLocaleUpperCase("tr-TR") === "YKS" ? "12" : "";
};

export const curriculumStorageKey = (courseId: unknown) => {
  const raw = String(courseId ?? "").trim();
  if (!raw) return "";
  return raw.startsWith("curriculum_") ? raw : `curriculum_${raw}`;
};

export const courseIdFromCurriculumKey = (key: unknown) =>
  String(key ?? "").trim().replace(/^curriculum_/, "");

const stableClone = (value: any): any => {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = stableClone(value[key]);
        return acc;
      }, {});
  }
  return value;
};

export const curriculumFingerprint = (value: any) => {
  try {
    return JSON.stringify(stableClone(value ?? {}));
  } catch {
    return String(value ?? "");
  }
};

const rowsFromPayload = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  for (const key of ["rows", "items", "records", "data", "documents"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

const safeJson = (raw: string | null | undefined, fallback: any) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Sadece ilk geçiş ve sunucu erişilemezse geçici UI fallback'i için kullanılır.
 * `rota_curriculum_store_v1` bilinçli olarak okunmaz; çift başlılığı tekrar üretmemek
 * için legacy tarafta bile tek ana anahtar kabul edilir.
 */
export const readLegacyCurriculumStore = (): CurriculumStore => {
  if (typeof window === "undefined") return {};
  try {
    const value = safeJson(window.localStorage?.getItem(LEGACY_CURRICULUM_KEY), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

export const mirrorCurriculumStoreToLegacy = (store: CurriculumStore) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(LEGACY_CURRICULUM_KEY, JSON.stringify(store || {}));
  } catch {
    // Yerel kopya yalnızca hızlı açılış/cache amaçlıdır; sunucu kaydı ana kaynaktır.
  }
};

const inferCoreCourse = (courseId: string, grade: string, name: string) => {
  const currMatch = courseId.match(/^CURR-(9|10|11|12)-(.+)$/i);
  if (currMatch) {
    const core = CORE_COURSES.find((item) => item.id === currMatch[2]);
    return {
      grade: grade || currMatch[1],
      courseName: name || core?.name || "",
    };
  }
  const byName = CORE_COURSES.find((item) => normalizeCurriculumText(item.name) === normalizeCurriculumText(name));
  return {
    grade,
    courseName: name || byName?.name || "",
  };
};

const metadataForCourse = (
  courseId: string,
  curriculum: any,
  courseSources: any[] = [],
) => {
  const source = courseSources.find((item: any) =>
    String(item?.id || item?.courseId || "") === String(courseId),
  );
  let grade = curriculumGrade(
    curriculum?.grade ||
      curriculum?.gradeLevel ||
      source?.grade ||
      source?.gradeLevel ||
      source?.level,
  );
  let courseName = String(
    curriculum?.courseName ||
      source?.courseName ||
      source?.name ||
      "",
  ).trim();

  const inferred = inferCoreCourse(courseId, grade, courseName);
  grade = inferred.grade;
  courseName = inferred.courseName;

  return { grade, courseName };
};

export const curriculumStoreToRecords = (
  store: CurriculumStore,
  courseSources: any[] = [],
  previousRecords: CurriculumRecord[] = [],
): CurriculumRecord[] => {
  const now = new Date().toISOString();
  const previousById = new Map(previousRecords.map((row) => [String(row.id), row]));
  const records = new Map<string, CurriculumRecord>();

  for (const [key, rawCurriculum] of Object.entries(store || {})) {
    if (!key || !rawCurriculum || typeof rawCurriculum !== "object") continue;
    const curriculum = { ...(rawCurriculum as any) };
    delete (curriculum as any).__curriculumMeta;
    const sourceCourseId = String((rawCurriculum as any)?.__curriculumMeta?.courseId || courseIdFromCurriculumKey(key));
    const meta = metadataForCourse(sourceCourseId, rawCurriculum, courseSources);
    const id = canonicalCurriculumRecordId({
      courseId: sourceCourseId,
      grade: meta.grade,
      courseName: meta.courseName,
    }) || key;
    const fingerprint = curriculumFingerprint(curriculum);
    const previous = previousById.get(id) || previousById.get(key);
    const unchanged = previous?.fingerprint === fingerprint;
    records.set(id, {
      id,
      curriculumKey: id,
      courseId: sourceCourseId,
      grade: meta.grade,
      courseName: meta.courseName,
      curriculum,
      fingerprint,
      version: unchanged
        ? Number(previous?.version || 1)
        : Math.max(Number(previous?.version || 0) + 1, Date.now()),
      updatedAt: unchanged ? String(previous?.updatedAt || now) : now,
    });
  }

  return [...records.values()];
};


export const curriculumRecordsToStore = (rows: any[]): CurriculumStore => {
  const store: CurriculumStore = {};
  const put = (key: string, curriculum: any, row: any) => {
    if (!key || !curriculum || typeof curriculum !== "object") return;
    // Record metadata is carried into the in-memory object so callers that only
    // receive CurriculumStore can still resolve grade/course identity correctly.
    // These fields are repository metadata, not curriculum nodes.
    const enriched = {
      ...curriculum,
      __curriculumMeta: {
        recordId: String(row?.id || key),
        curriculumKey: String(row?.curriculumKey || key),
        courseId: String(row?.courseId || courseIdFromCurriculumKey(key)),
        grade: curriculumGrade(row?.grade),
        courseName: String(row?.courseName || "").trim(),
        version: Number(row?.version || 0),
        updatedAt: String(row?.updatedAt || ""),
      },
    };
    store[key] = enriched;
  };

  [...(Array.isArray(rows) ? rows : [])]
    .sort((a: any, b: any) => {
      const av = Number(a?.version || 0);
      const bv = Number(b?.version || 0);
      if (av !== bv) return av - bv;
      return (Date.parse(String(a?.updatedAt || "")) || 0) - (Date.parse(String(b?.updatedAt || "")) || 0);
    })
    .forEach((row: any) => {
    const key = String(
      row?.curriculumKey || row?.id || curriculumStorageKey(row?.courseId),
    ).trim();
    const curriculum = row?.curriculum ?? row?.data ?? row?.value;
    if (!key || !curriculum || typeof curriculum !== "object") return;

    put(key, curriculum, row);

    // Core courses also get a deterministic grade/course alias. This removes the
    // old dependence on random customCreatedCourses ids (cc-..., CRS-...).
    const grade = curriculumGrade(row?.grade);
    const courseName = String(row?.courseName || "").trim();
    const core = CORE_COURSES.find(
      (item) => normalizeCurriculumText(item.name) === normalizeCurriculumText(courseName),
    );
    if (grade && core) {
      put(`curriculum_CURR-${grade}-${core.id}`, curriculum, row);
    }
  });
  return store;
};


export const fetchCurriculumRecords = async (): Promise<CurriculumRecord[]> => {
  const response = await fetch(`/api/database/collections/${encodeURIComponent(CURRICULUM_COLLECTION)}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(String(body?.error || `Müfredat verisi okunamadı (${response.status}).`));
  }
  const payload = await response.json().catch(() => []);
  return rowsFromPayload(payload) as CurriculumRecord[];
};

export const saveAuthoritativeCurriculumStore = async (
  store: CurriculumStore,
  options: { courseSources?: any[] } = {},
): Promise<CurriculumRecord[]> => {
  let previous: CurriculumRecord[] = [];
  try {
    previous = await fetchCurriculumRecords();
  } catch {
    previous = [];
  }

  const records = curriculumStoreToRecords(
    store,
    Array.isArray(options.courseSources) ? options.courseSources : [],
    previous,
  );

  const response = await fetch(`/api/database/collections/${encodeURIComponent(CURRICULUM_COLLECTION)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(records),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(String(body?.error || `Müfredat verisi kaydedilemedi (${response.status}).`));
  }

  mirrorCurriculumStoreToLegacy(store);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CURRICULUM_UPDATED_EVENT, {
        detail: {
          collection: CURRICULUM_COLLECTION,
          updatedAt: new Date().toISOString(),
          fingerprints: records.map((row) => [row.id, row.fingerprint]),
        },
      }),
    );
  }
  return records;
};

/**
 * Ana okuma noktası.
 *
 * Sunucu doluysa HER ZAMAN sunucu kazanır.
 * Sunucu ilk kez boşsa ve migrateLegacy=true ise yalnız `course_curriculums_v1`
 * bir kez sunucuya taşınır. Sonraki tüm okumalar sunucudan yapılır.
 */
export const loadAuthoritativeCurriculumStore = async (
  options: { migrateLegacy?: boolean; courseSources?: any[] } = {},
): Promise<CurriculumStore> => {
  try {
    const rows = await fetchCurriculumRecords();
    const remote = curriculumRecordsToStore(rows);
    if (Object.keys(remote).length > 0) {
      mirrorCurriculumStoreToLegacy(remote);
      return remote;
    }

    if (options.migrateLegacy) {
      const legacy = readLegacyCurriculumStore();
      if (Object.keys(legacy).length > 0) {
        await saveAuthoritativeCurriculumStore(legacy, {
          courseSources: options.courseSources,
        });
        return legacy;
      }
    }

    return {};
  } catch (error) {
    // Ağ geçici olarak yoksa admin ekranını tamamen kilitleme; son bilinen yerel
    // kopyayı göster. Ancak bu fallback hiçbir zaman sunucu kaydını gölgelemez.
    const legacy = readLegacyCurriculumStore();
    if (Object.keys(legacy).length > 0) return legacy;
    throw error;
  }
};

const sameNode = (
  wantedId: unknown,
  wantedName: unknown,
  nodeId: unknown,
  nodeName: unknown,
) => {
  const wi = String(wantedId ?? "").trim();
  const ni = String(nodeId ?? "").trim();
  if (wi && ni && wi === ni) return true;
  const wn = normalizeCurriculumText(wantedName);
  const nn = normalizeCurriculumText(nodeName);
  return Boolean(wn && nn && wn === nn);
};

export const resolveCurriculumEntry = (
  store: CurriculumStore,
  query: CurriculumCourseQuery,
): { key: string; courseId: string; curriculum: any } | null => {
  const courseId = String(query?.courseId ?? "").trim();
  const grade = curriculumGrade(query?.grade);
  const courseName = String(query?.courseName || query?.subject || "").trim();

  const candidateKeys: string[] = [];
  const push = (value: string) => {
    if (value && !candidateKeys.includes(value)) candidateKeys.push(value);
  };

  if (courseId) {
    push(curriculumStorageKey(courseId));
    const virtual = courseId.match(/^CURR-(9|10|11|12)-(.+)$/i);
    if (virtual) push(`curriculum_CURR-${virtual[1]}-${virtual[2]}`);
    if (/^\d+$/.test(courseId) && grade) push(`curriculum_CURR-${grade}-${courseId}`);
  }

  const core = CORE_COURSES.find(
    (item) => normalizeCurriculumText(item.name) === normalizeCurriculumText(courseName),
  );
  if (core && grade) push(`curriculum_CURR-${grade}-${core.id}`);

  for (const key of candidateKeys) {
    const curriculum = store?.[key];
    if (curriculum && typeof curriculum === "object") {
      return { key, courseId: courseIdFromCurriculumKey(key), curriculum };
    }
  }

  const matches: Array<{ key: string; curriculum: any; score: number; version: number; updatedAt: number }> = [];
  for (const [key, curriculum] of Object.entries(store || {})) {
    if (!curriculum || typeof curriculum !== "object") continue;
    const meta = (curriculum as any)?.__curriculumMeta || {};
    const currentGrade = curriculumGrade(
      meta?.grade || (curriculum as any)?.grade || (curriculum as any)?.gradeLevel,
    );
    const currentName = String(
      meta?.courseName || (curriculum as any)?.courseName || (curriculum as any)?.name || "",
    );
    const currentCourseId = String(meta?.courseId || courseIdFromCurriculumKey(key));

    let score = 0;
    if (courseId && currentCourseId === courseId) score += 1000;
    if (grade && currentGrade === grade) score += 300;
    if (courseName && currentName && normalizeCurriculumText(courseName) === normalizeCurriculumText(currentName)) score += 700;
    if (core && currentName && normalizeCurriculumText(core.name) === normalizeCurriculumText(currentName)) score += 250;
    if (grade && currentGrade && currentGrade !== grade) score -= 1000;
    if (courseName && currentName && normalizeCurriculumText(courseName) !== normalizeCurriculumText(currentName)) score -= 500;

    if (score > 0) {
      matches.push({
        key,
        curriculum,
        score,
        version: Number(meta?.version || 0),
        updatedAt: Date.parse(String(meta?.updatedAt || "")) || 0,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score || b.version - a.version || b.updatedAt - a.updatedAt);
  const best = matches[0];
  return best ? { key: best.key, courseId: courseIdFromCurriculumKey(best.key), curriculum: best.curriculum } : null;
};

export const canonicalCurriculumRecordId = (query: CurriculumCourseQuery) => {
  const grade = curriculumGrade(query?.grade);
  const courseName = String(query?.courseName || query?.subject || "").trim();
  const rawCourseId = String(query?.courseId || "").trim();
  const virtual = rawCourseId.match(/^CURR-(9|10|11|12)-(.+)$/i);
  if (virtual) return `curriculum_CURR-${virtual[1]}-${virtual[2]}`;
  const core = CORE_COURSES.find(
    (item) => normalizeCurriculumText(item.name) === normalizeCurriculumText(courseName),
  );
  if (grade && core) return `curriculum_CURR-${grade}-${core.id}`;
  return curriculumStorageKey(rawCourseId || normalizeCurriculumText(courseName));
};

const scoreCurriculumRecord = (row: any, query: CurriculumCourseQuery) => {
  const wantedGrade = curriculumGrade(query?.grade);
  const wantedName = String(query?.courseName || query?.subject || "").trim();
  const wantedId = String(query?.courseId || "").trim();
  const rowGrade = curriculumGrade(row?.grade || row?.curriculum?.grade || row?.curriculum?.gradeLevel);
  const rowName = String(row?.courseName || row?.curriculum?.courseName || "").trim();
  const rowId = String(row?.courseId || courseIdFromCurriculumKey(row?.curriculumKey || row?.id || ""));
  const canonical = canonicalCurriculumRecordId(query);
  let score = 0;
  if (canonical && String(row?.id || row?.curriculumKey || "") === canonical) score += 2000;
  if (wantedId && rowId === wantedId) score += 1200;
  if (wantedGrade && rowGrade === wantedGrade) score += 400;
  if (wantedName && rowName && normalizeCurriculumText(wantedName) === normalizeCurriculumText(rowName)) score += 1000;
  if (wantedGrade && rowGrade && wantedGrade !== rowGrade) score -= 3000;
  if (wantedName && rowName && normalizeCurriculumText(wantedName) !== normalizeCurriculumText(rowName)) score -= 1500;
  return score;
};

export const resolveCurriculumRecord = (
  rows: CurriculumRecord[] | any[],
  query: CurriculumCourseQuery,
): CurriculumRecord | null => {
  const wantedGrade = curriculumGrade(query?.grade);
  const wantedName = normalizeCurriculumText(query?.courseName || query?.subject || "");
  const wantedId = String(query?.courseId || "").trim();
  const canonical = canonicalCurriculumRecordId(query);

  const candidates = (Array.isArray(rows) ? rows : []).map((row: any) => {
    const rowGrade = curriculumGrade(row?.grade || row?.curriculum?.grade || row?.curriculum?.gradeLevel);
    const rowName = normalizeCurriculumText(row?.courseName || row?.curriculum?.courseName || "");
    const rowId = String(row?.courseId || courseIdFromCurriculumKey(row?.curriculumKey || row?.id || ""));
    const nameMatch = Boolean(wantedName && rowName && wantedName === rowName);
    const gradeMatch = Boolean(wantedGrade && rowGrade && wantedGrade === rowGrade);
    const idMatch = Boolean(wantedId && rowId === wantedId);
    const canonicalMatch = Boolean(canonical && String(row?.id || row?.curriculumKey || "") === canonical);

    // Identity tier is intentionally independent of freshness. Once two records
    // refer to the same grade/course, the newest version wins; an older canonical
    // id must never override a newer legacy alias.
    let tier = 0;
    if (nameMatch && gradeMatch) tier = 5;
    else if (idMatch && gradeMatch) tier = 4;
    else if (nameMatch && !wantedGrade) tier = 3;
    else if (idMatch) tier = 2;
    else if (canonicalMatch) tier = 1;

    return {
      row,
      tier,
      canonicalMatch,
      version: Number(row?.version || 0),
      updatedAt: Date.parse(String(row?.updatedAt || "")) || 0,
    };
  }).filter((item) => item.tier > 0);

  candidates.sort((a, b) =>
    b.tier - a.tier ||
    b.version - a.version ||
    b.updatedAt - a.updatedAt ||
    Number(b.canonicalMatch) - Number(a.canonicalMatch),
  );
  return (candidates[0]?.row || null) as CurriculumRecord | null;
};


export const fetchResolvedCurriculumEntry = async (
  query: CurriculumCourseQuery,
): Promise<{ key: string; courseId: string; curriculum: any; record: CurriculumRecord } | null> => {
  const rows = await fetchCurriculumRecords();
  const record = resolveCurriculumRecord(rows, query);
  if (!record) return null;
  const key = String(record.curriculumKey || record.id || curriculumStorageKey(record.courseId));
  return {
    key,
    courseId: String(record.courseId || courseIdFromCurriculumKey(key)),
    curriculum: record.curriculum,
    record,
  };
};

export const saveAuthoritativeCurriculumEntry = async (
  query: CurriculumCourseQuery,
  curriculum: any,
): Promise<CurriculumRecord> => {
  const rows = await fetchCurriculumRecords().catch(() => [] as CurriculumRecord[]);
  const existingMatches = (Array.isArray(rows) ? rows : []).filter((row: any) => scoreCurriculumRecord(row, query) > 0);
  const latest = resolveCurriculumRecord(existingMatches, query);
  const id = canonicalCurriculumRecordId(query);
  if (!id) throw new Error("Müfredat için ders kimliği oluşturulamadı.");
  const now = new Date().toISOString();
  const fingerprint = curriculumFingerprint(curriculum);
  const unchanged = latest?.fingerprint === fingerprint && String(latest?.id || "") === id;
  const courseName = String(query?.courseName || query?.subject || latest?.courseName || "").trim();
  const grade = curriculumGrade(query?.grade || latest?.grade);
  const record: CurriculumRecord = {
    id,
    curriculumKey: id,
    courseId: String(query?.courseId || latest?.courseId || courseIdFromCurriculumKey(id)),
    grade,
    courseName,
    curriculum,
    fingerprint,
    version: unchanged ? Number(latest?.version || 1) : Math.max(Number(latest?.version || 0) + 1, Date.now()),
    updatedAt: unchanged ? String(latest?.updatedAt || now) : now,
  };

  const response = await fetch(`/api/database/collections/${encodeURIComponent(CURRICULUM_COLLECTION)}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(String(body?.error || `Müfredat kaydedilemedi (${response.status}).`));
  }

  // The same grade/course may have legacy records under random ids. Delete them
  // after canonical save so there is physically one server-side authority.
  await Promise.all(
    existingMatches
      .filter((row: any) => String(row?.id || "") && String(row.id) !== id)
      .map(async (row: any) => {
        try {
          await fetch(`/api/database/collections/${encodeURIComponent(CURRICULUM_COLLECTION)}/${encodeURIComponent(String(row.id))}`, {
            method: "DELETE",
            cache: "no-store",
          });
        } catch { /* canonical record is already saved; duplicate cleanup is best effort */ }
      }),
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CURRICULUM_UPDATED_EVENT, { detail: { id, version: record.version, updatedAt: record.updatedAt } }));
  }
  return record;
};


export const mapCurriculumToScopeTree = (curriculum: any): CurriculumScopeUnit[] =>
  (Array.isArray(curriculum?.units) ? curriculum.units : []).map((unit: any, unitIndex: number) => ({
    id: String(unit?.id || `unit-${unitIndex}`),
    name: String(unit?.name || unit?.id || `Ünite ${unitIndex + 1}`),
    topics: (Array.isArray(unit?.topics) ? unit.topics : []).map((topic: any, topicIndex: number) => ({
      id: String(topic?.id || `topic-${unitIndex}-${topicIndex}`),
      name: String(topic?.name || topic?.id || `Konu ${topicIndex + 1}`),
      outcomes: (Array.isArray(topic?.outcomes) ? topic.outcomes : []).map((outcome: any, outcomeIndex: number) => ({
        id: String(
          typeof outcome === "string"
            ? outcome
            : outcome?.id || `outcome-${unitIndex}-${topicIndex}-${outcomeIndex}`,
        ),
        name: String(
          typeof outcome === "string"
            ? outcome
            : outcome?.name || outcome?.id || `Kazanım ${outcomeIndex + 1}`,
        ),
        questions: [],
      })),
    })),
  }));

const scopeRowsOf = (assignment: any): any[] => {
  for (const candidate of [
    assignment?.scopes,
    assignment?.selectionScopes,
    assignment?.questionScopes,
    assignment?.questionPlan,
    assignment?.plan,
    assignment?.requirements,
  ]) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  return [];
};

const filterTreeWithScopeRow = (
  tree: CurriculumScopeUnit[],
  row: any,
): CurriculumScopeUnit[] => {
  const result: CurriculumScopeUnit[] = [];
  for (const unit of tree) {
    const unitWanted = row?.unitId || row?.unit_id || row?.unitName || row?.unit_name || row?.unit;
    if (unitWanted && !sameNode(row?.unitId || row?.unit_id, row?.unitName || row?.unit_name || row?.unit, unit.id, unit.name)) {
      continue;
    }

    const nextUnit: CurriculumScopeUnit = { ...unit, topics: [] };
    for (const topic of unit.topics || []) {
      const hasTopicScope = Boolean(
        row?.topicId || row?.topic_id || row?.topicName || row?.topic_name || row?.topic,
      );
      if (
        hasTopicScope &&
        !sameNode(
          row?.topicId || row?.topic_id,
          row?.topicName || row?.topic_name || row?.topic,
          topic.id,
          topic.name,
        )
      ) {
        continue;
      }

      const nextTopic: CurriculumScopeTopic = { ...topic, outcomes: [] };
      const hasOutcomeScope = Boolean(
        row?.outcomeId || row?.outcome_id || row?.outcomeName || row?.outcome_name || row?.outcome,
      );
      for (const outcome of topic.outcomes || []) {
        if (
          hasOutcomeScope &&
          !sameNode(
            row?.outcomeId || row?.outcome_id,
            row?.outcomeName || row?.outcome_name || row?.outcome,
            outcome.id,
            outcome.name,
          )
        ) {
          continue;
        }
        nextTopic.outcomes.push({ ...outcome, questions: [] });
      }

      if (!hasOutcomeScope || nextTopic.outcomes.length > 0) nextUnit.topics.push(nextTopic);
    }

    if (nextUnit.topics.length > 0) result.push(nextUnit);
  }
  return result;
};

const mergeScopeTrees = (trees: CurriculumScopeUnit[][]): CurriculumScopeUnit[] => {
  const unitMap = new Map<string, CurriculumScopeUnit>();
  for (const tree of trees) {
    for (const unit of tree) {
      const unitKey = `${unit.id}::${normalizeCurriculumText(unit.name)}`;
      if (!unitMap.has(unitKey)) unitMap.set(unitKey, { ...unit, topics: [] });
      const targetUnit = unitMap.get(unitKey)!;
      const topicMap = new Map(
        (targetUnit.topics || []).map((topic) => [`${topic.id}::${normalizeCurriculumText(topic.name)}`, topic]),
      );
      for (const topic of unit.topics || []) {
        const topicKey = `${topic.id}::${normalizeCurriculumText(topic.name)}`;
        if (!topicMap.has(topicKey)) {
          const cloned = { ...topic, outcomes: [...(topic.outcomes || [])] };
          targetUnit.topics.push(cloned);
          topicMap.set(topicKey, cloned);
          continue;
        }
        const targetTopic = topicMap.get(topicKey)!;
        const outcomeKeys = new Set(
          (targetTopic.outcomes || []).map((outcome) => `${outcome.id}::${normalizeCurriculumText(outcome.name)}`),
        );
        for (const outcome of topic.outcomes || []) {
          const outcomeKey = `${outcome.id}::${normalizeCurriculumText(outcome.name)}`;
          if (!outcomeKeys.has(outcomeKey)) {
            targetTopic.outcomes.push({ ...outcome, questions: [] });
            outcomeKeys.add(outcomeKey);
          }
        }
      }
    }
  }
  return [...unitMap.values()];
};

/**
 * Öğretmen ekranında kullanılacak ağaç HER AÇILIŞTA canlı müfredattan üretilir.
 * Görevdeki scopeTree sadece hangi ünite/konu/kazanımın kapsama alındığını anlamak
 * için geriye dönük yardımcı olabilir; kazanım isimlerinin kaynağı değildir.
 */
export const buildCurrentAssignmentCurriculumTree = (
  store: CurriculumStore,
  assignment: any,
): CurriculumScopeUnit[] => {
  const entry = resolveCurriculumEntry(store, {
    courseId: assignment?.courseId,
    grade: assignment?.grade || assignment?.gradeLevel,
    courseName: assignment?.courseName || assignment?.subject || assignment?.lessonName,
  });
  if (!entry) return [];

  const fullTree = mapCurriculumToScopeTree(entry.curriculum);
  if (fullTree.length === 0) return [];

  const rows = scopeRowsOf(assignment);
  const directScope = {
    unitId: assignment?.unitId || assignment?.unit_id,
    unitName: assignment?.unitName || assignment?.unit_name,
    topicId: assignment?.topicId || assignment?.topic_id,
    topicName: assignment?.topicName || assignment?.topic_name,
    outcomeId: assignment?.outcomeId || assignment?.outcome_id,
    outcomeName: assignment?.outcomeName || assignment?.outcome_name,
  };
  const hasDirectScope = Boolean(
    directScope.unitId || directScope.unitName ||
    directScope.topicId || directScope.topicName ||
    directScope.outcomeId || directScope.outcomeName
  );
  const isTestAssignment =
    String(assignment?.assignmentKind || "").toLowerCase() === "test" ||
    String(assignment?.workflowType || "").toLowerCase().includes("test-question") ||
    Boolean(assignment?.testId && !assignment?.examId);

  // Testte yönetici bir KONU seçmişse o konunun TÜM GÜNCEL kazanımları görünür.
  // Eski snapshot/scopes içindeki tek tek kazanım satırları yeni müfredatı
  // daraltmamalıdır. Bu nedenle testlerde doğrudan scope önce uygulanır.
  if (isTestAssignment && hasDirectScope) {
    const scoped = filterTreeWithScopeRow(fullTree, directScope);
    if (scoped.length > 0) return scoped;
  }

  // Çok kapsamlı sınav görevlerinde yönetici dağılım satırları esas alınır.
  if (rows.length > 0) {
    const scoped = mergeScopeTrees(rows.map((row) => filterTreeWithScopeRow(fullTree, row)));
    if (scoped.length > 0) return scoped;
  }

  if (hasDirectScope) {
    const scoped = filterTreeWithScopeRow(fullTree, directScope);
    if (scoped.length > 0) return scoped;
  }

  // Eski görevlerde ID alanı eksikse mevcut snapshot sadece KAPSAM İPUCU olarak
  // kullanılır; isimlerin kendisi yine canlı müfredattan alınır.
  const oldTree = Array.isArray(assignment?.curriculumScopeTree)
    ? assignment.curriculumScopeTree
    : Array.isArray(assignment?.scopeTree)
      ? assignment.scopeTree
      : [];
  if (oldTree.length > 0) {
    const hints: any[] = [];
    oldTree.forEach((unit: any) => {
      const topics = Array.isArray(unit?.topics) ? unit.topics : [];
      if (topics.length === 0) {
        hints.push({ unitId: unit?.id, unitName: unit?.name });
        return;
      }
      topics.forEach((topic: any) => {
        const outcomes = Array.isArray(topic?.outcomes) ? topic.outcomes : [];
        if (outcomes.length === 0) {
          hints.push({ unitId: unit?.id, unitName: unit?.name, topicId: topic?.id, topicName: topic?.name });
          return;
        }
        // Eski snapshot'taki kazanımların kendisini scope ipucu yapma; müfredat
        // değiştiğinde silinen eski kazanımlar yeni ağacı daraltmasın. Konu düzeyi
        // yeterlidir ve o konunun TÜM güncel kazanımları gösterilir.
        hints.push({ unitId: unit?.id, unitName: unit?.name, topicId: topic?.id, topicName: topic?.name });
      });
    });
    const scoped = mergeScopeTrees(hints.map((row) => filterTreeWithScopeRow(fullTree, row)));
    if (scoped.length > 0) return scoped;
  }

  return fullTree;
};


/**
 * Teacher/mobile authoritative path. Never falls back to assignment snapshots.
 * If the live server curriculum cannot be resolved, callers should show an error
 * instead of resurrecting old outcomes from teacherTestAssignments.
 */
export const fetchCurrentAssignmentCurriculumTree = async (
  assignment: any,
): Promise<CurriculumScopeUnit[]> => {
  const entry = await fetchResolvedCurriculumEntry({
    courseId: assignment?.courseId,
    grade: assignment?.grade || assignment?.gradeLevel,
    courseName: assignment?.courseName || assignment?.subject || assignment?.lessonName,
  });
  if (!entry) return [];
  const singleStore: CurriculumStore = {
    [entry.key]: {
      ...entry.curriculum,
      __curriculumMeta: {
        recordId: entry.record.id,
        curriculumKey: entry.key,
        courseId: entry.record.courseId,
        grade: entry.record.grade,
        courseName: entry.record.courseName,
        version: entry.record.version,
        updatedAt: entry.record.updatedAt,
      },
    },
  };
  return buildCurrentAssignmentCurriculumTree(singleStore, assignment);
};
