/**
 * e-Nstitü Öğretmen Davranış Bağlantısı
 *
 * Firebase kullanılmaz.
 * Öğretmen linkleri ve öğretmen tarafından girilen davranış kayıtları
 * merkezi e-Nstitü / SQLite API üzerinden çalışır.
 */

const resolveApiBase = (): string => {
  // Yerel geliştirmede doğrudan 8787 API'sini kullan.
  // .env içindeki üretim adresi localhost testini ezmesin.
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8787/api";
    }
  }

  // e-Nstitü personel PWA'sı dersbende.com.tr üzerinde daima aynı-origin /api kullanır.
  // Böylece eski bir VITE_HASAT_LIVE_REPORT_API değeri öğretmen/personel linkini başka API'ye yönlendiremez.
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "dersbende.com.tr" || host.endsWith(".dersbende.com.tr")) {
      return "/api";
    }
  }

  const configured = String(
    import.meta.env.VITE_HASAT_LIVE_REPORT_API || ""
  ).trim();

  if (configured) return configured.replace(/\/+$/, "");

  return "/api";
};

const API_BASE = resolveApiBase();

const readLocalSchoolId = (): string => {
  const candidates = [
    "schoolId",
    "school_id",
    "institutionId",
    "institution_id",
    "currentSchoolId",
    "hasat_school_id",
  ];

  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      })();

      const value =
        typeof parsed === "string"
          ? parsed
          : parsed?.id || parsed?.schoolId || parsed?.institutionId;

      if (value && String(value).trim()) {
        return String(value).trim();
      }
    } catch {}
  }

  return "school-main";
};

const requestJson = async <T>(
  url: string,
  init?: RequestInit,
): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : String(error);

    throw new Error(
      `e-Nstitü merkezi sunucusuna ulaşılamadı. API: ${API_BASE}. (${detail})`,
    );
  }

  if (!response.ok) {
    let message = `Sunucu hatası (${response.status})`;

    try {
      const body = await response.json();
      if (body?.error) message = String(body.error);
    } catch {}

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export type TeacherBehaviorStudent = {
  id: string;
  name: string;
  classroom: string;
  number: string;
};

export type TeacherBehaviorItem = {
  id: string;
  type: "Olumlu" | "Olumsuz";
  name: string;
};

export type TeacherBehaviorLinkDocument = {
  schoolId: string;
  teacherId: string;
  teacherName: string;
  role?: "ADMIN" | "GUIDANCE" | "TEACHER" | string;
  staffRole?: "ADMIN" | "GUIDANCE" | "TEACHER" | string;
  position?: string;
  branch?: string;
  duties?: string[];
  permissions?: unknown;
  staffProfileVersion?: string;
  createdBy?: string;
  students: TeacherBehaviorStudent[];
  behaviors: TeacherBehaviorItem[];
  studentIds?: string[];
  behaviorNames?: string[];
  active?: boolean;
  createdAt?: string;
  expiresAt?: string;
};

export type TeacherBehaviorPublishInput = {
  teacherId: string;
  teacherName: string;
  students: TeacherBehaviorStudent[];
  behaviors: TeacherBehaviorItem[];
  validDays?: number;
  createdBy?: string;
};

export type TeacherBehaviorSubmission = Record<string, any> & {
  id: string;
};

/**
 * Yönetici tarafında her öğretmen için kalıcı davranış linki üretir.
 */
export const publishTeacherBehaviorLink = async (
  input: TeacherBehaviorPublishInput,
): Promise<{ token: string; url: string; expiresAt: string }> => {
  return requestJson(
    `${API_BASE}/behavior/teacher-links`,
    {
      method: "POST",
      body: JSON.stringify({
        schoolId: readLocalSchoolId(),
        teacherId: String(input.teacherId || "").trim(),
        teacherName: String(input.teacherName || "").trim(),
        createdBy: String(input.createdBy || ""),
        students: input.students || [],
        behaviors: input.behaviors || [],
        validDays: input.validDays ?? 180,
      }),
    },
  );
};

/**
 * /t/:token öğretmen ekranı açılırken öğretmenin öğrenci ve davranış listesini getirir.
 */
export const fetchTeacherBehaviorLink = async (
  token: string,
): Promise<TeacherBehaviorLinkDocument | null> => {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return null;

  try {
    const result = await requestJson<TeacherBehaviorLinkDocument>(
      `${API_BASE}/behavior/teacher-links/${encodeURIComponent(cleanToken)}`,
      { method: "GET" },
    );

    if (!result) return null;

    return {
      ...result,
      students: (Array.isArray(result.students) ? result.students : []).map((student) => ({
        ...student,
        // Ö.No. = Tanımlamalar > Öğrenciler kaydındaki student.id
        number: String(student?.id || student?.number || "").trim(),
      })),
    };
  } catch (error: any) {
    // Geçersiz / süresi dolmuş linkleri ekranın kontrollü biçimde ele almasına izin ver.
    const message = String(error?.message || "");
    if (
      message.includes("(404)") ||
      message.toLocaleLowerCase("tr-TR").includes("bulunamadı")
    ) {
      return null;
    }
    throw error;
  }
};

/**
 * Öğretmenin telefondan oluşturduğu tekli/çoklu davranış kayıtlarını merkezi SQLite'a yollar.
 */
export const submitTeacherBehaviorRecords = async (
  token: string,
  records: Array<Record<string, any>>,
): Promise<{ ok: boolean; count: number }> => {
  const cleanToken = String(token || "").trim();

  if (!cleanToken) {
    throw new Error("Öğretmen bağlantı anahtarı bulunamadı.");
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Kaydedilecek davranış bulunamadı.");
  }

  return requestJson(
    `${API_BASE}/behavior/teacher-links/${encodeURIComponent(cleanToken)}/submissions`,
    {
      method: "POST",
      body: JSON.stringify({ records }),
    },
  );
};

/**
 * Yönetici Davranış modülü öğretmenlerden gelen merkezi kayıtları çeker.
 */
export const listTeacherBehaviorSubmissions = async (): Promise<
  TeacherBehaviorSubmission[]
> => {
  const schoolId = encodeURIComponent(readLocalSchoolId());

  const result = await requestJson<{
    items?: TeacherBehaviorSubmission[];
  }>(
    `${API_BASE}/behavior/teacher-submissions?schoolId=${schoolId}`,
    { method: "GET" },
  );

  return Array.isArray(result?.items) ? result.items : [];
};

/**
 * Yönetici ekranına alınan uzak kaydı kuyruktan temizler.
 */
export const deleteTeacherBehaviorSubmission = async (
  id: string,
): Promise<void> => {
  await requestJson<void>(
    `${API_BASE}/behavior/teacher-submissions/${encodeURIComponent(
      String(id || ""),
    )}`,
    { method: "DELETE" },
  );
};
