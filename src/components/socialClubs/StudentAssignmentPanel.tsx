import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, History, Loader2, Plus, Save, Search } from "lucide-react";
import type { Student } from "../../types";
import { fetchCollectionFromLocalDatabase, upsertLocalDocument } from "../../lib/localDatabase";
import { sqliteStorage } from "../../core/state/SyncStateStore";

type AssignedStudent = { id: string; name: string; classroom: string; number: string };
type AssignmentActivity = {
  id: string;
  name: string;
  date: string;
  round: number;
  assignedStudents: AssignedStudent[];
  participatedStudentIds: string[];
  status: "planned" | "completed";
  createdAt: string;
};
type AssignmentData = {
  id: string;
  schoolId: string;
  round: number;
  activities: AssignmentActivity[];
  updatedAt: string;
};

const COLLECTION = "socialStudentAssignments";
const DOCUMENT_ID = "student-assignment-rotation";
const makeDefault = (schoolId: string): AssignmentData => ({
  id: DOCUMENT_ID, schoolId, round: 1, activities: [], updatedAt: "",
});
const asId = (value: unknown) => String(value ?? "").trim();
const numberOf = (student: Student) => asId(student.number ?? student.studentNumber ?? student.id);
const toAssigned = (student: Student): AssignedStudent => ({
  id: asId(student.id), name: asId(student.name), classroom: asId(student.classroom), number: numberOf(student),
});
const validIds = (values: unknown): string[] => Array.isArray(values)
  ? Array.from(new Set(values.map(asId).filter(Boolean))) : [];
const normalizeData = (source: unknown, schoolId: string): AssignmentData => {
  if (!source || typeof source !== "object") return makeDefault(schoolId);
  const data = source as Partial<AssignmentData>;
  if (asId(data.schoolId) !== schoolId) return makeDefault(schoolId);
  return {
    id: DOCUMENT_ID, schoolId,
    round: Math.max(1, Math.floor(Number(data.round) || 1)),
    activities: Array.isArray(data.activities) ? data.activities.filter((row) => row && row.id && Array.isArray(row.assignedStudents)).map((row) => ({
      ...row,
      assignedStudents: row.assignedStudents.filter((student) => student && student.id).map((student) => ({
        id: asId(student.id), name: asId(student.name), classroom: asId(student.classroom), number: asId(student.number),
      })),
      participatedStudentIds: validIds(row.participatedStudentIds),
      round: Math.max(1, Math.floor(Number(row.round) || 1)),
      status: row.status === "completed" ? "completed" : "planned",
    })) : [],
    updatedAt: asId(data.updatedAt),
  };
};
const enrolled = (student: Student) => {
  const status = asId(student.status).toLocaleUpperCase("tr-TR");
  return !!asId(student.id) && !!asId(student.name) && status !== "PASİF" && status !== "SİLİNDİ" && status !== "SILINDI";
};
const getCompletedIds = (state: AssignmentData): Set<string> => new Set(
  state.activities.filter((activity) => activity.round === state.round && activity.status === "completed")
    .flatMap((activity) => activity.participatedStudentIds),
);

export default function StudentAssignmentPanel({ students, schoolId }: { students: Student[]; schoolId: string }) {
  const [state, setState] = useState<AssignmentData>(() => makeDefault(schoolId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState("");
  const [activityName, setActivityName] = useState("");
  const [activityDate, setActivityDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [openedId, setOpenedId] = useState("");
  const [participated, setParticipated] = useState<string[]>([]);
  const localKey = `enstitu_${schoolId}_student_assignment_rotation`;

  const eligibleStudents = useMemo(() => {
    const byId = new Map<string, Student>();
    students.filter(enrolled).forEach((student) => byId.set(asId(student.id), student));
    return Array.from(byId.values()).sort((a, b) =>
      asId(a.classroom).localeCompare(asId(b.classroom), "tr", { numeric: true }) ||
      Number(numberOf(a)) - Number(numberOf(b)) || a.name.localeCompare(b.name, "tr"),
    );
  }, [students]);
  const availableIds = useMemo(() => new Set(eligibleStudents.map((student) => asId(student.id))), [eligibleStudents]);
  const completedIds = useMemo(() => getCompletedIds(state), [state]);
  const availableStudents = useMemo(() => eligibleStudents.filter((student) => !completedIds.has(asId(student.id))), [eligibleStudents, completedIds]);
  const classrooms = useMemo(() => Array.from(new Set(eligibleStudents.map((student) => asId(student.classroom)))).filter(Boolean).sort((a, b) => a.localeCompare(b, "tr", { numeric: true })), [eligibleStudents]);
  const filtered = useMemo(() => availableStudents.filter((student) => {
    if (classFilter !== "all" && asId(student.classroom) !== classFilter) return false;
    const query = search.trim().toLocaleUpperCase("tr-TR");
    return !query || (/^\d+$/.test(query)
      ? numberOf(student) === query
      : student.name.toLocaleUpperCase("tr-TR").includes(query));
  }), [availableStudents, classFilter, search]);
  const currentActivities = state.activities.filter((activity) => activity.round === state.round);
  const opened = state.activities.find((activity) => activity.id === openedId);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setState(makeDefault(schoolId));
    setSelected([]);
    setOpenedId("");
    setParticipated([]);
    setNotice("");
    const hydrate = async () => {
      try {
        const rows = await fetchCollectionFromLocalDatabase(COLLECTION);
        if (!alive) return;
        const own = rows.find((row) => row?.id === DOCUMENT_ID && asId(row?.schoolId) === schoolId);
        setState(normalizeData(own, schoolId));
      } catch {
        if (!alive) return;
        try {
          const cached = sqliteStorage.getItem(localKey);
          if (cached) setState(normalizeData(JSON.parse(cached), schoolId));
          setNotice("Sunucuya ulaşılamıyor. Son yerel kayıt gösteriliyor; yeni kayıt için bağlantı gerekli.");
        } catch { setNotice("Görevlendirme kayıtları okunamadı. Yeni kayıt için sunucu bağlantısı gerekli."); }
      } finally { if (alive) setLoading(false); }
    };
    void hydrate();
    return () => { alive = false; };
  }, [schoolId, localKey]);

  const persist = async (next: AssignmentData, success: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setSaving(true);
    setNotice("");
    try {
      const updated = { ...next, updatedAt: new Date().toISOString() };
      await upsertLocalDocument(COLLECTION, DOCUMENT_ID, updated);
      setState(updated);
      try { sqliteStorage.setItem(localKey, JSON.stringify(updated)); } catch { /* Sunucu kaydı zaten tamamlandı. */ }
      setNotice(success);
      return true;
    } catch (error) {
      setNotice(`Kayıt tamamlanamadı. Veriler değiştirilmedi: ${error instanceof Error ? error.message : "Sunucu hatası"}`);
      return false;
    } finally { busyRef.current = false; setSaving(false); }
  };

  const createActivity = async () => {
    const name = activityName.trim();
    if (!name || !activityDate) { setNotice("Görev adı ve tarihini giriniz."); return; }
    if (selected.length === 0) { setNotice("Önce görevlendirilecek öğrencileri seçiniz."); return; }
    const currentCompleted = getCompletedIds(state);
    const assignedStudents = eligibleStudents.filter((student) => selected.includes(asId(student.id)) && !currentCompleted.has(asId(student.id))).map(toAssigned);
    if (assignedStudents.length !== selected.length) { setNotice("Seçilen öğrencilerin durumu değişmiş. Lütfen listeyi yeniden kontrol ediniz."); return; }
    const id = `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const activity: AssignmentActivity = {
      id, name, date: activityDate, round: state.round, assignedStudents,
      participatedStudentIds: [], status: "planned", createdAt: new Date().toISOString(),
    };
    const success = await persist({ ...state, activities: [activity, ...state.activities] }, "Görev kaydedildi. Etkinlik sonrasında gerçekten katılan öğrencileri işaretleyiniz.");
    if (success) {
      setActivityName(""); setSelected([]); setOpenedId(id); setParticipated([]);
    }
  };

  const openActivity = (activity: AssignmentActivity) => {
    if (openedId === activity.id) { setOpenedId(""); return; }
    setOpenedId(activity.id);
    setParticipated([...activity.participatedStudentIds]);
  };

  const saveAttendance = async () => {
    if (!opened || opened.round !== state.round) return;
    const assignedIds = new Set(opened.assignedStudents.map((student) => student.id));
    const recorded = validIds(participated).filter((id) => assignedIds.has(id));
    const nextActivities = state.activities.map((activity) => activity.id === opened.id
      ? { ...activity, status: "completed" as const, participatedStudentIds: recorded }
      : activity);
    const nextData: AssignmentData = { ...state, activities: nextActivities };
    const completed = getCompletedIds(nextData);
    const roundFinished = availableIds.size > 0 && [...availableIds].every((id) => completed.has(id));
    if (roundFinished) nextData.round += 1;
    const success = await persist(nextData, roundFinished
      ? "Bütün aktif öğrenciler en az bir etkinliğe katıldı. Yeni görevlendirme turu başladı; öğrenciler yeniden aktif."
      : "Katılım kaydedildi. Yalnız gerçekten katılan öğrenciler bu turda yeni görevlendirmeye kapatıldı.");
    if (success && roundFinished) { setOpenedId(""); setParticipated([]); }
  };

  const badge = (count: number, label: string, tone: string) => (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="text-2xl font-black">{count}</div>
      <div className="mt-1 text-xs font-bold">{label}</div>
    </div>
  );

  if (loading) return <div className="flex items-center gap-2 rounded-2xl bg-white p-6 text-sm font-bold text-slate-600"><Loader2 className="h-5 w-5 animate-spin" /> Görevlendirme kayıtları yükleniyor...</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {badge(state.round, "Görevlendirme turu", "border-indigo-200 bg-indigo-50 text-indigo-900")}
        {badge(eligibleStudents.length, "Aktif öğrenci", "border-slate-200 bg-white text-slate-800")}
        {badge(completedIds.size, "Bu tur katılan", "border-emerald-200 bg-emerald-50 text-emerald-800")}
        {badge(availableStudents.length, "Sırası gelen öğrenci", "border-amber-200 bg-amber-50 text-amber-800")}
      </div>
      {notice && <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-bold text-sky-900">{notice}</div>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-black text-slate-900"><Plus className="h-5 w-5 text-indigo-600" /> Yeni Görev Tanımla</h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_155px]">
            <label className="text-xs font-bold text-slate-700">Görev / faaliyet adı
              <input className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500" value={activityName} maxLength={150} onChange={(event) => setActivityName(event.target.value)} placeholder="Ör. 29 Ekim Tören Görevi" />
            </label>
            <label className="text-xs font-bold text-slate-700">Faaliyet tarihi
              <input type="date" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-2 text-sm outline-none focus:border-indigo-500" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} />
            </label>
          </div>
          <div className="text-xs font-semibold text-slate-500">Yalnız bu turda henüz katılmamış öğrenciler seçilebilir. Görevlendirmek tek başına katılmış sayılmaz.</div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Sınıfa göre filtrele" value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="h-10 min-w-[140px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
              <option value="all">Tüm sınıflar</option>
              {classrooms.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <div className="relative min-w-[170px] flex-[2]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Öğrenci no / adı soyadı" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-2 text-xs outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div className="max-h-[360px] space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
            {filtered.length ? filtered.map((student) => {
              const id = asId(student.id);
              const checked = selected.includes(id);
              return (
                <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-xs ${checked ? "border-indigo-300 bg-indigo-50" : "border-transparent bg-white"}`}>
                  <input type="checkbox" checked={checked} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, id] : previous.filter((item) => item !== id))} className="h-4 w-4 accent-indigo-600" />
                  <span className="min-w-0 flex-1 font-bold text-slate-900">{student.name}</span>
                  <span className="shrink-0 text-slate-500">{student.classroom} · No {numberOf(student)}</span>
                </label>
              );
            }) : <p className="py-8 text-center text-xs font-bold text-slate-400">Bu filtreye uygun görevlendirilebilir öğrenci bulunmuyor.</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-bold text-slate-600">{selected.length} öğrenci seçildi</div>
            <button type="button" disabled={saving || selected.length === 0 || !activityName.trim()} onClick={() => void createActivity()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Görevi Kaydet
            </button>
          </div>
        </section>
        <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-black text-slate-900"><ClipboardCheck className="h-5 w-5 text-emerald-600" /> Katılım ve Görev Kayıtları</h3>
          <p className="text-xs font-semibold text-slate-500">Görev tamamlandıktan sonra gerçekten katılanları tikleyip kaydediniz. Katılmayan öğrenciler görevlendirme havuzunda kalır.</p>
          {state.activities.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-semibold text-slate-500">Henüz görev kaydı bulunmuyor.</div> : (
            <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
              {state.activities.map((activity) => {
                const isOpen = openedId === activity.id;
                const sameRound = activity.round === state.round;
                return (
                  <div key={activity.id} className="overflow-hidden rounded-xl border border-slate-200">
                    <button type="button" className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100" onClick={() => openActivity(activity)}>
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-900">{activity.name}</span><span className="text-[11px] font-semibold text-slate-500">{activity.date} · Tur {activity.round} · {activity.assignedStudents.length} görevli</span></span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${activity.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{activity.status === "completed" ? `${activity.participatedStudentIds.length} katıldı` : "Katılım bekliyor"}</span>
                    </button>
                    {isOpen && <div className="space-y-3 border-t border-slate-100 p-3">
                      {activity.assignedStudents.map((student) => (
                        <label key={student.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-xs font-bold text-slate-800">
                          <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={sameRound ? participated.includes(student.id) : activity.participatedStudentIds.includes(student.id)} disabled={!sameRound || saving} onChange={(event) => setParticipated((previous) => event.target.checked ? [...previous, student.id] : previous.filter((id) => id !== student.id))} />
                          <span className="flex-1">{student.name}</span>
                          <span className="text-slate-500">{student.classroom} · No {student.number}</span>
                        </label>
                      ))}
                      {sameRound ? <button type="button" disabled={saving} onClick={() => void saveAttendance()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Katılımı Kaydet</button>
                        : <p className="text-xs font-semibold text-slate-500">Önceki tura ait kayıt; katılım geçmişi korunur.</p>}
                    </div>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600"><History className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> Tüm aktif öğrenciler en az bir faaliyete katılınca yeni tur otomatik açılır. Önceki görevler ve katılım kayıtları silinmez.</div>
        </section>
      </div>
    </div>
  );
}
