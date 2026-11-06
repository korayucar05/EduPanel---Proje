import React from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Heart,
  Loader2,
  MessageCircle,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

type BehaviorMode = "positive" | "negative";
type ScopeMode = "student" | "classroom";

type StudentRow = {
  id: string;
  name: string;
  number: string;
  classroom: string;
};

type GuidanceRecord = {
  id: string;
  sourceRecordId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  classroom: string;
  behaviorType: string;
  behaviorName: string;
  description?: string;
  teacherName?: string;
  date: string;
  createdAt?: string | number;
  guidanceStatus?: "pending-interview" | "interviewed" | "positive-archive" | "routed-warning" | "routed-pre-inspection";
  guidanceNote?: string;
  interviewedAt?: string;
  previousNegativeCount?: number;
  sameBehaviorPreviousCount?: number;
  routingReason?: string;
  guidanceTeacherName?: string;
  routingDestination?: string;
  distinctNegativeCountWithCurrent?: number;
};

type GuidancePayload = {
  students: StudentRow[];
  records: GuidanceRecord[];
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();

const classroomLabel = (value: string) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/^(\d+)[\s\-/.]*([A-ZÇĞİÖŞÜ])$/, "$1/$2");

const toDayKey = (value: string | number | undefined) => {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  const text = String(value);
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const formatDate = (value?: string | number) => {
  if (value === undefined || value === null || value === "") return "Tarih yok";
  const date = typeof value === "number"
    ? new Date(value)
    : new Date(String(value).length <= 10 ? `${value}T12:00:00` : String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const rowTone = (mode: BehaviorMode, count: number) => {
  if (mode === "positive") {
    if (count >= 3) return "border-green-200 bg-green-50";
    if (count === 2) return "border-emerald-200 bg-emerald-50";
    return "border-yellow-200 bg-yellow-50";
  }
  if (count >= 3) return "border-red-200 bg-red-50";
  if (count === 2) return "border-orange-200 bg-orange-50";
  return "border-yellow-200 bg-yellow-50";
};

function GuidanceBehaviorSlide({
  mode,
  students,
  records,
  startDate,
  endDate,
  onRecordUpdated,
}: {
  mode: BehaviorMode;
  students: StudentRow[];
  records: GuidanceRecord[];
  startDate: string;
  endDate: string;
  onRecordUpdated: () => Promise<void>;
}) {
  const [scope, setScope] = React.useState<ScopeMode>("student");
  const [query, setQuery] = React.useState("");
  const [selectedStudentId, setSelectedStudentId] = React.useState("");
  const [selectedClassroom, setSelectedClassroom] = React.useState("");
  const [savingId, setSavingId] = React.useState("");
  const [noteById, setNoteById] = React.useState<Record<string, string>>({});
  const [historyOpenId, setHistoryOpenId] = React.useState("");
  const [guidanceTeacherName, setGuidanceTeacherName] = React.useState("");

  const typeLabel = mode === "positive" ? "Olumlu" : "Olumsuz";

  React.useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active || !payload?.user) return;
        const user = payload.user;
        const name = String(
          user?.name ||
          user?.fullName ||
          user?.displayName ||
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
          "",
        ).trim();
        if (name) setGuidanceTeacherName(name);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);


  const filteredRecords = React.useMemo(
    () =>
      records.filter((record) => {
        if (normalize(record.behaviorType) !== normalize(typeLabel)) return false;
        const day = toDayKey(record.date || record.createdAt);
        if (startDate && (!day || day < startDate)) return false;
        if (endDate && (!day || day > endDate)) return false;
        return true;
      }),
    [records, typeLabel, startDate, endDate],
  );

  const recordsByStudent = React.useMemo(() => {
    const map = new Map<string, GuidanceRecord[]>();
    for (const record of filteredRecords) {
      const id = String(record.studentId || "");
      if (!id) continue;
      const current = map.get(id) || [];
      current.push(record);
      map.set(id, current);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) =>
        String(b.date || b.createdAt || "").localeCompare(
          String(a.date || a.createdAt || ""),
        ),
      );
    }
    return map;
  }, [filteredRecords]);

  const rankedStudents = React.useMemo(() => {
    const q = normalize(query);
    return students
      .map((student) => ({
        ...student,
        count: (recordsByStudent.get(student.id) || []).length,
      }))
      .filter((student) => student.count > 0)
      .filter((student) =>
        !q ? true : normalize(`${student.name} ${student.number}`).includes(q),
      )
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base" }),
      );
  }, [students, recordsByStudent, query]);

  const rankedClassrooms = React.useMemo(() => {
    const countMap = new Map<string, number>();
    for (const record of filteredRecords) {
      const classroom = String(record.classroom || "").trim();
      if (!classroom) continue;
      countMap.set(classroom, (countMap.get(classroom) || 0) + 1);
    }
    return [...countMap.entries()]
      .map(([classroom, count]) => ({ classroom, count }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.classroom.localeCompare(b.classroom, "tr-TR", { numeric: true }),
      );
  }, [filteredRecords]);

  const selectedClassStudents = React.useMemo(() => {
    if (!selectedClassroom) return [];
    return students
      .filter(
        (student) => normalize(student.classroom) === normalize(selectedClassroom),
      )
      .map((student) => ({
        ...student,
        count: (recordsByStudent.get(student.id) || []).length,
      }))
      .filter((student) => student.count > 0)
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base" }),
      );
  }, [students, selectedClassroom, recordsByStudent]);


  const previousNegativeRecordsFor = (record: GuidanceRecord) => {
    const currentTime = new Date(String(record.date || record.createdAt || 0)).getTime();
    return records
      .filter((item) =>
        item.id !== record.id &&
        String(item.studentId || "") === String(record.studentId || "") &&
        normalize(item.behaviorType) === normalize("Olumsuz"),
      )
      .filter((item) => {
        const itemTime = new Date(String(item.date || item.createdAt || 0)).getTime();
        if (!Number.isFinite(currentTime) || !Number.isFinite(itemTime)) return true;
        return itemTime <= currentTime;
      })
      .sort((a, b) =>
        String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")),
      );
  };

  const markInterviewed = async (record: GuidanceRecord) => {
    const note = String(noteById[record.id] ?? record.guidanceNote ?? "").trim();
    const counselor = String(guidanceTeacherName || record.guidanceTeacherName || "").trim();

    if (!note) {
      window.alert("Rehber öğretmen görüşünü yazınız.");
      return;
    }
    if (!counselor) {
      window.alert("Görüşmeyi yapan rehber öğretmenin adını yazınız.");
      return;
    }

    setSavingId(record.id);
    try {
      const response = await fetch(`/api/guidance/behavior-records/${encodeURIComponent(record.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completeInterview: true,
          guidanceNote: note,
          guidanceTeacherName: counselor,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Görüşme kaydı güncellenemedi.");
      window.alert(
        data?.destination
          ? `Görüşme kaydedildi. Öğrenci ${data.destination} alanına yönlendirildi.`
          : "Görüşme kaydedildi.",
      );
      await onRecordUpdated();
    } catch (error: any) {
      window.alert(error?.message || "Görüşme kaydı güncellenemedi.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <section className="w-full shrink-0 snap-center px-1 pb-8">
      <div className={`rounded-3xl border p-4 shadow-sm ${mode === "positive" ? "border-green-200 bg-gradient-to-b from-green-50 to-white" : "border-red-200 bg-gradient-to-b from-red-50 to-white"}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${mode === "positive" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {mode === "positive" ? <Heart className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-950">{typeLabel} Davranışlar</h2>
            <p className="text-xs font-bold text-slate-500">
              {mode === "negative" ? "Rehberlik görüşmesi için bekleyen ve görüşülen kayıtlar" : "Rehberlik olumlu davranış arşivi"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
          <button type="button" onClick={() => { setScope("student"); setSelectedClassroom(""); }} className={`rounded-xl px-3 py-2.5 text-xs font-black ${scope === "student" ? (mode === "positive" ? "bg-green-600 text-white" : "bg-red-600 text-white") : "bg-slate-100 text-slate-600"}`}>
            Öğrenci Bazlı
          </button>
          <button type="button" onClick={() => setScope("classroom")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${scope === "classroom" ? (mode === "positive" ? "bg-green-600 text-white" : "bg-red-600 text-white") : "bg-slate-100 text-slate-600"}`}>
            Sınıf Bazlı
          </button>
        </div>

        {scope === "student" ? (
          <>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Öğrenci adı veya okul numarası" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold outline-none" />
            </div>
            <div className="mt-3 space-y-2">
              {rankedStudents.map((student) => {
                const studentRecords = recordsByStudent.get(student.id) || [];
                const latestBehavior = studentRecords[0]?.behaviorName || "Davranış kaydı";
                const isOpen = selectedStudentId === student.id;
                return (
                  <div key={student.id} className="overflow-hidden rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId((current) => current === student.id ? "" : student.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm ${rowTone(mode, student.count)}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-slate-950">{student.name}</div>
                        <div className="mt-0.5 truncate text-[11px] font-black text-slate-700">
                          {latestBehavior}
                          {studentRecords.length > 1 ? ` · +${studentRecords.length - 1} kayıt` : ""}
                        </div>
                        <div className="mt-0.5 text-[10px] font-bold text-slate-500">
                          {classroomLabel(student.classroom)} · No {student.number || "-"}
                        </div>
                      </div>
                      <span className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-xs font-black ${mode === "positive" ? "bg-green-700 text-white" : "bg-red-700 text-white"}`}>{student.count}</span>
                      <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </button>

                    {isOpen ? (
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                          {student.name} · Davranış Geçmişi
                        </div>
                        <div className="space-y-2">
                          {studentRecords.map((record) => (
                            <article
                              key={record.id}
                              className={`rounded-xl border p-3 ${mode === "positive" ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <strong className="text-xs text-slate-900">{record.behaviorName}</strong>
                                <span className="shrink-0 text-[9px] font-black text-slate-500">{formatDate(record.date || record.createdAt)}</span>
                              </div>
                              {record.description ? <p className="mt-1.5 text-[11px] font-medium text-slate-600">{record.description}</p> : null}
                              {record.teacherName ? <div className="mt-1.5 text-[9px] font-bold text-slate-400">Kaydeden: {record.teacherName}</div> : null}
                              {mode === "negative" ? (
                                <div className="mt-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2 py-1 text-[9px] font-black ${
                                      record.guidanceStatus === "routed-pre-inspection"
                                        ? "bg-red-100 text-red-700"
                                        : record.guidanceStatus === "routed-warning"
                                          ? "bg-blue-100 text-blue-700"
                                          : record.guidanceStatus === "interviewed"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-amber-100 text-amber-700"
                                    }`}>
                                      {record.guidanceStatus === "routed-pre-inspection"
                                        ? "Ön İncelemeye Gönderildi"
                                        : record.guidanceStatus === "routed-warning"
                                          ? "Uyarı Bildirimine Gönderildi"
                                          : record.guidanceStatus === "interviewed"
                                            ? "Görüşüldü"
                                            : "Görüşme Bekliyor"}
                                    </span>
                                  </div>

                                  {(record.guidanceStatus === "pending-interview" || !record.guidanceStatus) ? (
                                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                        Öğrenci ile Görüşme
                                      </div>
                                      <textarea
                                        value={noteById[record.id] ?? record.guidanceNote ?? ""}
                                        onChange={(event) => setNoteById((current) => ({ ...current, [record.id]: event.target.value }))}
                                        rows={3}
                                        placeholder="Rehber öğretmen görüşünü yazınız..."
                                        className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal-400"
                                      />
                                      <input
                                        value={guidanceTeacherName || record.guidanceTeacherName || ""}
                                        onChange={(event) => setGuidanceTeacherName(event.target.value)}
                                        placeholder="Görüşmeyi yapan rehber öğretmen"
                                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-teal-400"
                                      />
                                      <button
                                        type="button"
                                        disabled={savingId === record.id}
                                        onClick={() => void markInterviewed(record)}
                                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                      >
                                        {savingId === record.id
                                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          : <CheckCircle2 className="h-3.5 w-3.5" />}
                                        Görüşme Yapıldı
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-[10px] font-semibold text-slate-600">
                                      {record.guidanceNote ? <div><strong>Rehberlik Görüşü:</strong> {record.guidanceNote}</div> : null}
                                      {record.guidanceTeacherName ? <div className="mt-1"><strong>Rehber Öğretmen:</strong> {record.guidanceTeacherName}</div> : null}
                                      {record.routingDestination ? <div className="mt-1"><strong>Yönlendirme:</strong> {record.routingDestination}</div> : null}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : !selectedClassroom ? (
          <div className="mt-4 space-y-2">
            {rankedClassrooms.map((item, index) => (
              <button key={item.classroom} type="button" onClick={() => { setSelectedClassroom(item.classroom); setSelectedStudentId(""); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${mode === "positive" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{index + 1}</span>
                <div className="min-w-0 flex-1"><div className="font-black text-slate-900">{classroomLabel(item.classroom)}</div><div className="text-[10px] font-bold text-slate-500">{item.count} davranış kaydı</div></div>
                <strong className={mode === "positive" ? "text-green-700" : "text-red-700"}>{item.count}</strong>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <button type="button" onClick={() => { setSelectedClassroom(""); setSelectedStudentId(""); }} className="mb-3 text-xs font-black text-indigo-700">← Sınıflara dön</button>
            <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-slate-500" /><strong className="text-sm text-slate-900">{classroomLabel(selectedClassroom)}</strong></div>
            <div className="space-y-2">
              {selectedClassStudents.map((student) => {
                const studentRecords = recordsByStudent.get(student.id) || [];
                const latestBehavior = studentRecords[0]?.behaviorName || "Davranış kaydı";
                const isOpen = selectedStudentId === student.id;
                return (
                  <div key={student.id} className="overflow-hidden rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId((current) => current === student.id ? "" : student.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm ${rowTone(mode, student.count)}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-slate-950">{student.name}</div>
                        <div className="mt-0.5 truncate text-[11px] font-black text-slate-700">
                          {latestBehavior}
                          {studentRecords.length > 1 ? ` · +${studentRecords.length - 1} kayıt` : ""}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500">No {student.number || "-"}</div>
                      </div>
                      <span className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-xs font-black ${mode === "positive" ? "bg-green-700 text-white" : "bg-red-700 text-white"}`}>{student.count}</span>
                    </button>
                    {isOpen ? (
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="space-y-2">
                          {studentRecords.map((record) => (
                            <article key={record.id} className={`rounded-xl border p-3 ${mode === "positive" ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"}`}>
                              <div className="flex items-start justify-between gap-2">
                                <strong className="text-xs text-slate-900">{record.behaviorName}</strong>
                                <span className="shrink-0 text-[9px] font-black text-slate-500">{formatDate(record.date || record.createdAt)}</span>
                              </div>
                              {record.description ? <p className="mt-1.5 text-[11px] font-medium text-slate-600">{record.description}</p> : null}
                              {record.teacherName ? <div className="mt-1.5 text-[9px] font-bold text-slate-400">Kaydeden: {record.teacherName}</div> : null}
                              {mode === "negative" && (record.guidanceStatus === "pending-interview" || !record.guidanceStatus) ? (
                                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                                  <textarea
                                    value={noteById[record.id] ?? record.guidanceNote ?? ""}
                                    onChange={(event) => setNoteById((current) => ({ ...current, [record.id]: event.target.value }))}
                                    rows={3}
                                    placeholder="Rehber öğretmen görüşünü yazınız..."
                                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"
                                  />
                                  <input
                                    value={guidanceTeacherName || record.guidanceTeacherName || ""}
                                    onChange={(event) => setGuidanceTeacherName(event.target.value)}
                                    placeholder="Görüşmeyi yapan rehber öğretmen"
                                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={savingId === record.id}
                                    onClick={() => void markInterviewed(record)}
                                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                  >
                                    Görüşme Yapıldı
                                  </button>
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

export default function GuidanceModule() {
  const [data, setData] = React.useState<GuidancePayload>({ students: [], records: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [page, setPage] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/guidance/behavior-records", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Rehberlik davranış kayıtları alınamadı.");
      setData({
        students: Array.isArray(payload?.students) ? payload.students : [],
        records: Array.isArray(payload?.records) ? payload.records : [],
      });
    } catch (error: any) {
      setError(error?.message || "Rehberlik davranış kayıtları alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const onScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    setPage(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)));
  };

  const goToPage = (next: number) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ left: element.clientWidth * next, behavior: "smooth" });
  };

  const pendingCount = data.records.filter((record) => normalize(record.behaviorType) === normalize("Olumsuz") && (!record.guidanceStatus || record.guidanceStatus === "pending-interview")).length;
  const positiveCount = data.records.filter((record) => normalize(record.behaviorType) === normalize("Olumlu")).length;

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700"><MessageCircle className="h-6 w-6" /></div>
            <div><h1 className="text-xl font-black text-slate-950">Rehberlik · Davranış Takibi</h1><p className="text-sm font-semibold text-slate-500">Olumsuz kayıtlar görüşme kuyruğuna, olumlu kayıtlar doğrudan rehberlik arşivine alınır.</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center"><div className="text-[9px] font-black uppercase text-amber-700">Görüşme Bekliyor</div><strong className="text-xl text-amber-800">{pendingCount}</strong></div>
            <div className="rounded-2xl bg-green-50 px-4 py-3 text-center"><div className="text-[9px] font-black uppercase text-green-700">Olumlu Kayıt</div><strong className="text-xl text-green-800">{positiveCount}</strong></div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm font-black text-slate-900"><CalendarDays className="h-4 w-4 text-indigo-600" />Tarih Aralığı</div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:max-w-xl">
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold" />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold" />
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}

      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={() => goToPage(0)} className={`h-2.5 rounded-full transition-all ${page === 0 ? "w-8 bg-green-600" : "w-2.5 bg-slate-300"}`} />
        <button type="button" onClick={() => goToPage(1)} className={`h-2.5 rounded-full transition-all ${page === 1 ? "w-8 bg-red-600" : "w-2.5 bg-slate-300"}`} />
      </div>
      <div className="flex items-center justify-between px-2 text-[10px] font-black text-slate-500"><span className={page === 0 ? "text-green-700" : ""}>Olumlu Davranışlar</span><span>Yana kaydır →</span><span className={page === 1 ? "text-red-700" : ""}>Olumsuz Davranışlar</span></div>

      <div ref={scrollRef} onScroll={onScroll} className="flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <GuidanceBehaviorSlide mode="positive" students={data.students} records={data.records} startDate={startDate} endDate={endDate} onRecordUpdated={load} />
        <GuidanceBehaviorSlide mode="negative" students={data.students} records={data.records} startDate={startDate} endDate={endDate} onRecordUpdated={load} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-500">
        <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-slate-400" />Öğrenci ve sınıf sıralamaları seçilen tarih aralığındaki davranış kayıt sayısına göre otomatik hesaplanır.</div>
      </section>
    </div>
  );
}
