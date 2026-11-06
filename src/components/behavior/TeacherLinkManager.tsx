import React from "react";
import { getActiveSchoolScope } from "../../core/tenant";
import { CheckCircle2, Copy, Link, RefreshCw, Send, X, AlertTriangle } from "lucide-react";
import {
  isValidMhatsappNumber,
  loadMhatsappSettings,
  normalizeMhatsappNumber,
  sendTextMessage,
} from "../../lib/mhatsappApi";

type AnyRow = Record<string, any>;

type LinkRow = {
  name: string;
  teacherId: string;
  phone: string;
  url: string;
  status: "ready" | "failed";
  error?: string;
};

const text = (value: unknown) => String(value ?? "").trim();

const outboundTeacherUrl = (rawUrl: unknown) => {
  const value = text(rawUrl);
  if (!value) throw new Error("Öğretmen bağlantısı boş.");

  const parsed = new URL(value, window.location.origin);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Öğretmen bağlantısının adresi geçersiz.");
  }

  // Mesajlaşma sağlayıcısına her zaman yapılandırılmış genel alan adını gönder.
  // Böylece yerel/eksik bir origin (ör. yalnızca com.tr) öğretmene taşınmaz.
  const configuredPublicUrl = text(import.meta.env.VITE_HASAT_PUBLIC_APP_URL);
  if (configuredPublicUrl) {
    const publicBase = new URL(configuredPublicUrl);
    parsed.protocol = publicBase.protocol;
    parsed.host = publicBase.host;
  }

  return parsed.toString();
};


const FALLBACK_BEHAVIORS = [
  { id: "positive-help", type: "Olumlu" as const, name: "Arkadaşlarına yardımcı olma" },
  { id: "positive-duty", type: "Olumlu" as const, name: "Sorumluluklarını düzenli yerine getirme" },
  { id: "positive-respect", type: "Olumlu" as const, name: "Saygılı ve örnek davranış sergileme" },
  { id: "negative-disrupt", type: "Olumsuz" as const, name: "Ders düzenini bozma" },
  { id: "negative-rule", type: "Olumsuz" as const, name: "Okul kurallarına uymama" },
  { id: "negative-respect", type: "Olumsuz" as const, name: "Saygısız davranış sergileme" },
];

const studentName = (student: AnyRow) =>
  text(
    student?.name ||
      student?.fullName ||
      student?.studentName ||
      `${student?.firstName || ""} ${student?.lastName || ""}`,
  );

const normalizeStudent = (student: AnyRow) => {
  // Tanımlamalar > Öğrenciler ekranındaki "Ö.No." sütununun gerçek kaynağı student.id'dir.
  const canonicalStudentNo = text(student?.id || student?.studentId || student?.__documentId);
  return {
    id: canonicalStudentNo,
    name: studentName(student),
    classroom: text(
      student?.classroom || student?.className || student?.sinif || student?.branch,
    ),
    number: canonicalStudentNo,
  };
};

const normalizeBehavior = (item: AnyRow) => {
  const rawType = text(item?.type || item?.behaviorType).toLocaleLowerCase("tr-TR");
  const type = rawType === "olumlu" ? "Olumlu" : rawType === "olumsuz" ? "Olumsuz" : "";
  return {
    id: text(item?.id || item?.behaviorId),
    type: type as "Olumlu" | "Olumsuz" | "",
    name: text(item?.name || item?.behaviorName),
  };
};

async function readCollection(collection: string): Promise<AnyRow[]> {
  try {
    const response = await fetch(
      `/api/database/collections/${encodeURIComponent(collection)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return [];
    const body = await response.json().catch(() => []);
    return Array.isArray(body) ? body : [];
  } catch {
    return [];
  }
}

const teacherPhone = (teacher: AnyRow) =>
  text(
    teacher?.phone ||
      teacher?.teacherPhone ||
      teacher?.telefon ||
      teacher?.gsm ||
      teacher?.mobile ||
      "",
  );

const schoolIdFromRuntime = () => {
  try {
    return getActiveSchoolScope();
  } catch {
    return "school-main";
  }
};

async function requestWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 12000,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        text(body?.error || `Sunucu hatası (${response.status})`),
      );
    }
    return body;
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function TeacherLinkManager({
  open,
  onClose,
  teachers,
  students,
  behaviors,
}: {
  open: boolean;
  onClose: () => void;
  teachers: AnyRow[];
  students: AnyRow[];
  behaviors: AnyRow[];
}) {
  const [rows, setRows] = React.useState<LinkRow[]>([]);
  const [resolvedTeachers, setResolvedTeachers] = React.useState<AnyRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [teachersReady, setTeachersReady] = React.useState(false);
  const [progress, setProgress] = React.useState("");
  const [sendBusy, setSendBusy] = React.useState("");
  const [generalError, setGeneralError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setTeachersReady(false);
    const load = async () => {
      const merged = new Map<string, AnyRow>();

      const add = (row: AnyRow) => {
        const id = text(row?.id || row?.teacherId || "");
        const name = text(
          row?.name ||
            row?.teacherName ||
            row?.fullName ||
            `${row?.firstName || ""} ${row?.lastName || ""}`,
        );
        if (!id && !name) return;
        const key = id || name.toLocaleLowerCase("tr-TR");
        const previous = merged.get(key);
        if (!previous || (!teacherPhone(previous) && teacherPhone(row))) {
          merged.set(key, {
            ...previous,
            ...row,
            id: id || previous?.id || name,
            name,
          });
        }
      };

      (teachers || []).forEach(add);

      for (const collection of ["school_teachers", "teachers"]) {
        try {
          const response = await fetch(
            `/api/database/collections/${collection}`,
            { cache: "no-store" },
          );
          if (!response.ok) continue;
          const body = await response.json().catch(() => []);
          if (Array.isArray(body)) body.forEach(add);
        } catch {
          // Bir koleksiyon okunamazsa diğer kaynaklarla devam edilir.
        }
      }

      if (!cancelled) {
        setResolvedTeachers(
          Array.from(merged.values()).sort((a, b) =>
            text(a?.name).localeCompare(text(b?.name), "tr-TR"),
          ),
        );
        setTeachersReady(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, teachers]);

  const createLinks = React.useCallback(async () => {
    if (!open || busy) return;

    const usableTeachers = (resolvedTeachers.length
      ? resolvedTeachers
      : teachers || []
    ).filter((item) => text(item?.id) && text(item?.name));
    if (!usableTeachers.length) {
      setRows([]);
      setGeneralError("Link oluşturulacak öğretmen bulunamadı.");
      return;
    }

    // Component props henüz dolmamış olsa bile linki boş veriyle üretme.
    // SQLite koleksiyonlarını da okuyup tekilleştiriyoruz.
    const [schoolStudents, canonicalStudents, storedBehaviors] = await Promise.all([
      readCollection("school_students"),
      readCollection("students"),
      readCollection("customBehaviors"),
    ]);

    const studentMap = new Map<string, ReturnType<typeof normalizeStudent>>();
    for (const raw of [...(students || []), ...canonicalStudents, ...schoolStudents]) {
      if (text(raw?.status).toLocaleLowerCase("tr-TR") === "pasif") continue;
      const normalized = normalizeStudent(raw);
      if (!normalized.id || !normalized.name) continue;
      const previous = studentMap.get(normalized.id);
      studentMap.set(normalized.id, {
        ...previous,
        ...normalized,
        classroom: normalized.classroom || previous?.classroom || "",
        number: normalized.number || previous?.number || "",
      });
    }
    const validStudents = Array.from(studentMap.values()).sort((a, b) =>
      a.classroom.localeCompare(b.classroom, "tr-TR", { numeric: true }) ||
      Number(a.number || 999999) - Number(b.number || 999999) ||
      a.name.localeCompare(b.name, "tr-TR"),
    );

    const behaviorMap = new Map<
      string,
      { id: string; type: "Olumlu" | "Olumsuz"; name: string }
    >();
    for (const raw of [...(behaviors || []), ...storedBehaviors]) {
      const normalized = normalizeBehavior(raw);
      if (!normalized.id || !normalized.name || !normalized.type) continue;
      behaviorMap.set(normalized.id, {
        id: normalized.id,
        type: normalized.type,
        name: normalized.name,
      });
    }
    if (!behaviorMap.size) {
      FALLBACK_BEHAVIORS.forEach((item) => behaviorMap.set(item.id, item));
    }
    const validBehaviors = Array.from(behaviorMap.values());

    if (!validStudents.length) {
      setRows([]);
      setGeneralError(
        "Öğrenci listesi SQLite veritabanından okunamadı. Boş öğrenci listeli öğretmen bağlantısı oluşturulmadı.",
      );
      return;
    }

    setBusy(true);
    setGeneralError("");
    setRows([]);
    setProgress(`0 / ${usableTeachers.length}`);

    const results: LinkRow[] = [];
    for (let index = 0; index < usableTeachers.length; index += 1) {
      const teacher = usableTeachers[index];
      setProgress(`${index + 1} / ${usableTeachers.length} · ${text(teacher.name)}`);

      try {
        const created = await requestWithTimeout(
          "/api/behavior/teacher-links",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              schoolId: schoolIdFromRuntime(),
              teacherId: text(teacher.id),
              teacherName: text(teacher.name),
              createdBy: "e-Nstitü Yönetici",
              students: validStudents,
              behaviors: validBehaviors,
              validDays: 365,
            }),
          },
        );

        const url =
          text(created?.url) ||
          (created?.token
            ? `${window.location.origin}/t/${encodeURIComponent(
                text(created.token),
              )}`
            : "");

        if (!url) throw new Error("Sunucu bağlantı adresi döndürmedi.");

        results.push({
          name: text(teacher.name),
          teacherId: text(teacher.id),
          phone: teacherPhone(teacher),
          url,
          status: "ready",
        });
      } catch (error: any) {
        results.push({
          name: text(teacher.name),
          teacherId: text(teacher.id),
          phone: teacherPhone(teacher),
          url: "",
          status: "failed",
          error:
            error?.name === "AbortError"
              ? "Sunucu 12 saniye içinde yanıt vermedi."
              : text(error?.message || "Link oluşturulamadı."),
        });
      }

      // Each teacher is surfaced immediately; no endless "preparing" screen.
      setRows([...results]);
    }

    setProgress("");
    setBusy(false);
  }, [open, resolvedTeachers, teachers, students, behaviors, busy]);

  React.useEffect(() => {
    if (!open || !teachersReady || rows.length || busy) return;
    void createLinks();
  }, [open, teachersReady, rows.length, busy, createLinks]);

  if (!open) return null;

  const readyCount = rows.filter((item) => item.status === "ready").length;
  const failedCount = rows.filter((item) => item.status === "failed").length;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-black text-slate-900">
              <Link className="h-5 w-5 text-teal-600" />
              Öğretmen Uygulama Linkleri
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Davranış, ödev, faaliyet ve soru işlemleri aynı kişisel bağlantıda açılır.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {busy && (
            <div className="mb-4 rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-teal-800">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Linkler hazırlanıyor
              </div>
              <div className="mt-1 text-xs font-semibold text-teal-700">
                {progress || "Sunucu bağlantısı kuruluyor…"}
              </div>
              <div className="mt-2 text-[10px] font-semibold text-teal-600">
                Her öğretmen için en fazla 12 saniye beklenir; başarısız kayıtlar ayrıca gösterilir.
              </div>
            </div>
          )}

          {generalError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
              {generalError}
            </div>
          )}

          {!busy && rows.length > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-600">
              <span>{readyCount} hazır</span>
              <span>{failedCount ? `${failedCount} başarısız` : "Tüm linkler hazır"}</span>
            </div>
          )}

          <div className="space-y-2">
            {rows.map((item) => (
              <div
                key={item.teacherId}
                className={`rounded-2xl border p-3 ${
                  item.status === "ready"
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-rose-200 bg-rose-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.status === "ready" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-rose-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-slate-900">
                      {item.name}
                    </div>

                    {item.status === "ready" ? (
                      <>
                        <input
                          readOnly
                          value={item.url}
                          className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-2 py-2 text-[10px] text-slate-600"
                        />
                        <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-sky-800">
                          Mobil not: WhatsApp içi tarayıcı bağlantıyı açmazsa sağ üst menüden <b>Tarayıcıda aç / Chrome&apos;da aç</b> seçeneğini kullanın.
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard.writeText(item.url)
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-[10px] font-black text-slate-700 shadow-sm"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Kopyala
                          </button>
                          <button
                            type="button"
                            disabled={sendBusy === item.teacherId}
                            onClick={async () => {
                              const phone = normalizeMhatsappNumber(item.phone);
                              if (!isValidMhatsappNumber(phone)) {
                                alert(`${item.name} için geçerli telefon numarası bulunamadı.`);
                                return;
                              }
                              const settings = loadMhatsappSettings();
                              if (!settings.token?.trim()) {
                                alert("WhatsApp API tokenı Mesaj Araçları alanından kaydedilmelidir.");
                                return;
                              }
                              setSendBusy(item.teacherId);
                              try {
                                const safeUrl = outboundTeacherUrl(item.url);
                                const message = `Sayın ${item.name},\n\ne-Nstitü Öğretmen uygulamanız için kişisel bağlantınız aşağıdadır. Davranış, ödev, faaliyet ve size atanmış soru seçimi görevlerine bu bağlantıdan ulaşabilirsiniz.\n\nBağlantı:\n${safeUrl}\n\nNot: Bağlantı WhatsApp içi tarayıcıda açılmazsa sağ üst menüden “Tarayıcıda aç / Chrome'da aç” seçeneğini kullanınız.`;
                                const delivery = await sendTextMessage(
                                  settings,
                                  [phone],
                                  message,
                                );
                                if (!delivery.ok) {
                                  const useDirectWhatsapp = window.confirm(
                                    `${delivery.error || "Mhatsapp bağlantısı kurulamadı."}\n\nMesajı doğrudan WhatsApp üzerinden göndermek ister misiniz?`,
                                  );
                                  if (useDirectWhatsapp) {
                                    window.open(
                                      `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  }
                                  return;
                                }
                                alert(`Bağlantı ${item.name} öğretmenine gönderildi.`);
                              } catch (error: any) {
                                alert(error?.message || "Bağlantı gönderilemedi.");
                              } finally {
                                setSendBusy("");
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {sendBusy === item.teacherId ? "Gönderiliyor…" : "WhatsApp"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-xs font-bold text-rose-700">
                        {item.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!busy && failedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setRows([]);
                void createLinks();
              }}
              className="mt-4 w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-xs font-black text-rose-700"
            >
              Başarısız Linkleri Yeniden Dene
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
