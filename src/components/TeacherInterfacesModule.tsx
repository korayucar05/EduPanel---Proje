import React from "react";
import { ExternalLink, Loader2, Search, Smartphone, UserRound } from "lucide-react";

type AnyRow = Record<string, any>;

type Props = {
  teachers: AnyRow[];
  students: AnyRow[];
  schoolId?: string;
};

const FALLBACK_BEHAVIORS = [
  { id: "positive-help", type: "Olumlu" as const, name: "Arkadaşlarına yardımcı olma" },
  { id: "positive-duty", type: "Olumlu" as const, name: "Sorumluluklarını düzenli yerine getirme" },
  { id: "positive-respect", type: "Olumlu" as const, name: "Saygılı ve örnek davranış sergileme" },
  { id: "negative-disrupt", type: "Olumsuz" as const, name: "Ders düzenini bozma" },
  { id: "negative-rule", type: "Olumsuz" as const, name: "Okul kurallarına uymama" },
  { id: "negative-respect", type: "Olumsuz" as const, name: "Saygısız davranış sergileme" },
];

const text = (value: unknown) => String(value ?? "").trim();

const normalizeStudent = (student: AnyRow) => {
  const id = text(student?.id || student?.studentId || student?.__documentId || student?.number || student?.studentNumber);
  return {
    id,
    name: text(student?.name || student?.fullName || student?.studentName || `${student?.firstName || ""} ${student?.lastName || ""}`),
    classroom: text(student?.classroom || student?.className || student?.sinif || student?.branch),
    number: text(student?.number || student?.studentNumber || student?.studentNo || id),
  };
};

const behaviorType = (value: unknown) => {
  const normalized = text(value).toLocaleLowerCase("tr-TR");
  if (normalized === "olumlu") return "Olumlu" as const;
  if (normalized === "olumsuz") return "Olumsuz" as const;
  return null;
};

async function readBehaviors(schoolId: string) {
  const collectionNames = schoolId && schoolId !== "school-main"
    ? [`school__${schoolId.replace(/[^a-zA-Z0-9._-]+/g, "_")}__customBehaviors`, "customBehaviors"]
    : ["customBehaviors"];

  for (const collectionName of collectionNames) {
    try {
      const response = await fetch(`/api/database/collections/${encodeURIComponent(collectionName)}`, {
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) continue;
      const rows = await response.json().catch(() => []);
      if (!Array.isArray(rows) || !rows.length) continue;
      const normalized = rows
        .map((item: AnyRow) => ({
          id: text(item?.id || item?.behaviorId),
          type: behaviorType(item?.type || item?.behaviorType),
          name: text(item?.name || item?.behaviorName),
        }))
        .filter((item) => item.id && item.name && item.type)
        .map((item) => ({ id: item.id, type: item.type!, name: item.name }));
      if (normalized.length) return normalized;
    } catch {}
  }
  return FALLBACK_BEHAVIORS;
}

export default function TeacherInterfacesModule({ teachers, students, schoolId = "school-main" }: Props) {
  const [query, setQuery] = React.useState("");
  const [busyTeacherId, setBusyTeacherId] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [lastUrl, setLastUrl] = React.useState("");

  const rows = React.useMemo(() => {
    const seen = new Set<string>();
    return (Array.isArray(teachers) ? teachers : [])
      .map((teacher) => ({
        ...teacher,
        id: text(teacher?.id || teacher?.teacherId || teacher?.personnelId),
        name: text(teacher?.name || teacher?.fullName || teacher?.teacherName),
        branch: text(teacher?.branch || teacher?.branchName || teacher?.subjectName),
      }))
      .filter((teacher) => {
        const key = teacher.id || teacher.name.toLocaleLowerCase("tr-TR");
        if (!key || !teacher.name || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
  }, [teachers]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return rows;
    return rows.filter((teacher) => `${teacher.name} ${teacher.branch}`.toLocaleLowerCase("tr-TR").includes(needle));
  }, [query, rows]);

  const openTeacher = async (teacher: AnyRow) => {
    const teacherId = text(teacher.id);
    if (!teacherId) return;

    // Kullanıcı tıklaması sırasında boş pencereyi açarak tarayıcının popup engeline
    // takılmadan API yanıtından sonra öğretmen mobil ekranına yönlendiriyoruz.
    const previewWindow = window.open("about:blank", "_blank");
    setBusyTeacherId(teacherId);
    setMessage("");
    setLastUrl("");

    try {
      const normalizedStudents = (Array.isArray(students) ? students : [])
        .filter((student) => text(student?.status).toLocaleLowerCase("tr-TR") !== "pasif")
        .map(normalizeStudent)
        .filter((student) => student.id && student.name);
      const behaviors = await readBehaviors(schoolId);

      const response = await fetch("/api/behavior/teacher-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: schoolId || "school-main",
          teacherId,
          teacherName: text(teacher.name),
          createdBy: "e-Nstitü Öğretmen Arayüzleri",
          students: normalizedStudents,
          behaviors,
          validDays: 365,
        }),
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(text(body?.error) || `Sunucu hatası (${response.status})`);
      const url = text(body?.url) || (body?.token ? `${window.location.origin}/t/${encodeURIComponent(text(body.token))}` : "");
      if (!url) throw new Error("Öğretmen mobil bağlantısı oluşturulamadı.");

      setLastUrl(url);
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.replace(url);
      } else {
        setMessage("Tarayıcı yeni pencereyi engelledi. Aşağıdaki 'Mobil Arayüze Gir' düğmesini kullanın.");
      }
    } catch (error: any) {
      try { previewWindow?.close(); } catch {}
      setMessage(error?.message || "Öğretmen mobil arayüzü açılamadı.");
    } finally {
      setBusyTeacherId("");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sky-700">
              <Smartphone className="h-5 w-5" />
              <h2 className="text-lg font-black">Öğretmen Arayüzleri</h2>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">Bir öğretmene tıklayarak öğretmenin gerçek mobil arayüzünü yönetici olarak kontrol edin.</p>
          </div>
          <span className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">{rows.length} öğretmen</span>
        </div>

        <label className="relative mt-4 block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Öğretmen adı veya branş ara..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-bold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>
      </div>

      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{message}</div> : null}
      {lastUrl ? (
        <button type="button" onClick={() => window.open(lastUrl, "_blank", "noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-black text-white">
          <ExternalLink className="h-4 w-4" /> Mobil Arayüze Gir
        </button>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((teacher) => {
          const busy = busyTeacherId === teacher.id;
          return (
            <button
              key={teacher.id || teacher.name}
              type="button"
              disabled={Boolean(busyTeacherId)}
              onClick={() => void openTeacher(teacher)}
              className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserRound className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-black text-slate-900">{teacher.name}</strong>
                <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-500">{teacher.branch || "Branş bilgisi yok"}</span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          );
        })}
      </div>

      {!filtered.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-400">Öğretmen bulunamadı.</div> : null}
    </div>
  );
}
