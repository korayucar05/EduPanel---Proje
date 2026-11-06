import React, { useEffect, useMemo, useState } from "react";
import { CheckSquare, Edit3, Save, Search, Trash2 } from "lucide-react";
import { fetchCollectionFromLocalDatabase, syncCollectionToLocalDatabase } from "../core/data/LegacyDatabaseFacade";

import { sqliteStorage } from "../core/state/SyncStateStore";
type MentorStudent = { id: string; name: string; classroom: string; number: string };
type MentorTeacher = { id: string; name: string; branch: string };
type MentorGroup = {
  id: string;
  name: string;
  teacherId: string;
  studentIds: string[];
  createdAt: string;
  updatedAt: string;
};

const identity = (record: any, kind: "student" | "teacher") => String(
  record?.id || record?.[`${kind}Id`] || record?.studentNumber || record?.schoolNumber || record?.email || record?.name || "",
);
const personName = (record: any) => String(
  record?.studentName
    || record?.teacherName
    || record?.fullName
    || record?.name
    || `${record?.firstName || record?.first_name || record?.adi || ""} ${record?.lastName || record?.last_name || record?.surname || record?.soyadi || ""}`,
).replace(/\s+/g, " ").trim();
const studentNumber = (record: any) => String(
  record?.studentNumber
    || record?.schoolNumber
    || record?.schoolNo
    || record?.studentNo
    || record?.okulNo
    || record?.okul_no
    || record?.number
    || record?.id
    || "",
).trim();
const gradeOf = (classroom: unknown) => String(classroom || "").match(/\b(9|10|11|12)\b/)?.[1] || "";
const normalizeSearchText = (value: unknown) => String(value || "")
  .toLocaleLowerCase("tr-TR")
  .replace(/ı/g, "i")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

async function loadLegacyCollection(key: "school_students" | "school_teachers") {
  try {
    const localforage = (await import("../core/state/AppStateService")).default;
    const cached = await localforage.getItem(key);
    if (Array.isArray(cached) && cached.length) return cached;
  } catch {
    // sqliteStorage yedeğine geçilir.
  }
  try {
    const cached = JSON.parse(sqliteStorage.getItem(key) || "[]");
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
}

export default function MentorGroupsModule() {
  const [students, setStudents] = useState<MentorStudent[]>([]);
  const [teachers, setTeachers] = useState<MentorTeacher[]>([]);
  const [groups, setGroups] = useState<MentorGroup[]>([]);
  const [groupName, setGroupName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [gradeLevel, setGradeLevel] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCollectionFromLocalDatabase("students").catch(() => []),
      fetchCollectionFromLocalDatabase("teachers").catch(() => []),
      fetchCollectionFromLocalDatabase("mentor_groups").catch(() => []),
    ]).then(async ([studentRecords, teacherRecords, groupRecords]) => {
      if (!active) return;
      const sourceStudents = studentRecords.length ? studentRecords : await loadLegacyCollection("school_students");
      const sourceTeachers = teacherRecords.length ? teacherRecords : await loadLegacyCollection("school_teachers");
      let sourceGroups = groupRecords;
      if (!sourceGroups.length) {
        try { sourceGroups = JSON.parse(sqliteStorage.getItem("mentor_groups") || "[]"); } catch { sourceGroups = []; }
      }

      setStudents(sourceStudents
        .filter((student: any) => student && student.status !== "Pasif")
        .map((student: any) => ({
          id: identity(student, "student"),
          name: personName(student) || "İsimsiz Öğrenci",
          classroom: String(student?.classroom || student?.className || student?.gradeLevel || "").trim(),
          number: studentNumber(student),
        }))
        .filter((student: MentorStudent) => student.id)
        .sort((a: MentorStudent, b: MentorStudent) => a.classroom.localeCompare(b.classroom, "tr-TR", { numeric: true }) || a.name.localeCompare(b.name, "tr-TR")));
      setTeachers(sourceTeachers
        .filter((teacher: any) => teacher && teacher.status !== "İzinli" && teacher.status !== "Pasif")
        .map((teacher: any) => ({ id: identity(teacher, "teacher"), name: personName(teacher) || "İsimsiz Öğretmen", branch: String(teacher?.branch || teacher?.subject || "").trim() }))
        .filter((teacher: MentorTeacher) => teacher.id)
        .sort((a: MentorTeacher, b: MentorTeacher) => a.name.localeCompare(b.name, "tr-TR")));
      setGroups(Array.isArray(sourceGroups) ? sourceGroups : []);
    }).catch(() => {
      if (active) setNotice("Öğretmen, öğrenci veya mentör grubu bilgileri yüklenemedi.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const visibleStudents = useMemo(() => {
    const queryTerms = normalizeSearchText(searchText).split(" ").filter(Boolean);
    return students.filter((student) => {
      // Arama yapıldığında okulun tamamını tara; seviye düğmeleri yalnızca
      // arama alanı boşken listeyi daraltır.
      if (queryTerms.length === 0 && gradeLevel !== "all" && gradeOf(student.classroom) !== gradeLevel) return false;
      const searchIndex = normalizeSearchText(`${student.number} ${student.name}`);
      return queryTerms.every((term) => searchIndex.includes(term));
    });
  }, [gradeLevel, searchText, students]);
  const selectedStudents = useMemo(() => students.filter((student) => selectedStudentIds.includes(student.id)), [students, selectedStudentIds]);
  const allVisibleSelected = visibleStudents.length > 0 && visibleStudents.every((student) => selectedStudentIds.includes(student.id));

  const persist = async (nextGroups: MentorGroup[]) => {
    await syncCollectionToLocalDatabase("mentor_groups", nextGroups);
    setGroups(nextGroups);
    try { sqliteStorage.setItem("mentor_groups", JSON.stringify(nextGroups)); } catch { /* SQLite ana kayıttır. */ }
  };
  const resetForm = () => { setGroupName(""); setTeacherId(""); setSelectedStudentIds([]); setEditingGroupId(null); };
  const saveGroup = async () => {
    const name = groupName.trim();
    if (!name) return setNotice("Mentör grubu için bir ad giriniz.");
    if (!teacherId) return setNotice("Bir öğretmen seçiniz.");
    if (!selectedStudentIds.length) return setNotice("En az bir öğrenci seçiniz.");
    const current = groups.find((group) => group.id === editingGroupId);
    const now = new Date().toISOString();
    const record: MentorGroup = { id: current?.id || `mentor-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, teacherId, studentIds: [...selectedStudentIds], createdAt: current?.createdAt || now, updatedAt: now };
    const next = current ? groups.map((group) => group.id === current.id ? record : group) : [...groups, record];
    try { await persist(next); setNotice(current ? "Mentör grubu güncellendi." : "Mentör grubu oluşturuldu."); resetForm(); } catch { setNotice("Mentör grubu kaydedilemedi."); }
  };
  const editGroup = (group: MentorGroup) => { setEditingGroupId(group.id); setGroupName(group.name); setTeacherId(group.teacherId); setSelectedStudentIds([...group.studentIds]); setNotice("Mentör grubu düzenleme için açıldı."); };
  const deleteGroup = async (id: string) => {
    if (!window.confirm("Bu mentör grubunu silmek istiyor musunuz?")) return;
    try { await persist(groups.filter((group) => group.id !== id)); if (editingGroupId === id) resetForm(); setNotice("Mentör grubu silindi."); } catch { setNotice("Mentör grubu silinemedi."); }
  };
  const toggleStudent = (id: string) => setSelectedStudentIds((current) => current.includes(id) ? current.filter((studentId) => studentId !== id) : [...current, id]);
  const toggleAllVisible = () => {
    const visibleIds = visibleStudents.map((student) => student.id);
    setSelectedStudentIds((current) => allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])));
  };

  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="flex flex-wrap gap-2">{[{ id: "all", label: "Tüm Seviyeler" }, ...["9", "10", "11", "12"].map((level) => ({ id: level, label: `${level}. Sınıf` }))].map((level) => <button key={level.id} type="button" onClick={() => setGradeLevel(level.id)} className={`rounded-xl border px-3 py-2 text-xs font-black ${gradeLevel === level.id ? "border-indigo-700 bg-indigo-700 text-white" : "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"}`}>{level.label}</button>)}</div>
          <div className="flex flex-col gap-3 md:flex-row"><form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setSearchText(searchDraft); }}><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" name="mentor-student-search" aria-label="Mentör öğrencisi ara" autoComplete="off" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Okul no, öğrenci adı veya soyadı ara..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs font-bold outline-none focus:border-indigo-400" /></div><button type="submit" className="rounded-xl bg-indigo-700 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-800">Ara</button>{(searchDraft || searchText) && <button type="button" onClick={() => { setSearchDraft(""); setSearchText(""); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Temizle</button>}</form><button type="button" onClick={toggleAllVisible} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700"><CheckSquare className="h-4 w-4" />{allVisibleSelected ? "Görünenleri Kaldır" : "Görünenleri Seç"}</button></div>
          <p className="text-[10px] font-bold text-slate-500">{searchText.trim() ? `Okul genelinde ${visibleStudents.length} sonuç` : `${visibleStudents.length} öğrenci görüntüleniyor`} • {selectedStudentIds.length} seçili</p>
        </div>
        <div className="max-h-[560px] overflow-y-auto">{loading ? <div className="p-10 text-center text-sm font-bold text-slate-400">Kayıtlar yükleniyor...</div> : visibleStudents.length ? <div className="divide-y divide-slate-100">{visibleStudents.map((student) => { const selected = selectedStudentIds.includes(student.id); return <button key={student.id} type="button" onClick={() => toggleStudent(student.id)} className={`grid w-full grid-cols-[36px_90px_1fr_100px] items-center gap-2 px-4 py-3 text-left ${selected ? "bg-indigo-50" : "hover:bg-slate-50"}`}><span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-indigo-700 bg-indigo-700 text-white" : "border-slate-300"}`}>{selected ? "✓" : ""}</span><span className="text-xs font-black text-slate-700">{student.number || "-"}</span><span className="truncate text-xs font-black text-slate-900">{student.name}</span><span className="text-right text-[10px] font-black text-slate-500">{student.classroom || "-"}</span></button>; })}</div> : <div className="p-10 text-center text-sm font-bold text-slate-400">Seçilen ölçütlere uygun öğrenci bulunamadı.</div>}</div>
      </section>
      <div className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-900">{editingGroupId ? "Mentör Grubunu Güncelle" : "Yeni Mentör Grubu"}</h3>
          <label className="mt-4 block text-[10px] font-black uppercase text-slate-500">Grup adı</label><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Örnek: Üniversite Hazırlık Mentörlüğü" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-400" />
          <label className="mt-4 block text-[10px] font-black uppercase text-slate-500">Mentör öğretmen</label><select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-400"><option value="">Öğretmen seçiniz</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.branch ? ` • ${teacher.branch}` : ""}</option>)}</select>
          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-3"><div className="text-[10px] font-black uppercase text-indigo-700">Seçilen öğrenciler</div><div className="mt-1 text-2xl font-black text-indigo-900">{selectedStudents.length}</div><div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-[10px] font-bold text-indigo-800">{selectedStudents.slice(0, 8).map((student) => <div key={student.id}>{student.name} • {student.classroom}</div>)}{selectedStudents.length > 8 && <div>+{selectedStudents.length - 8} öğrenci daha</div>}</div></div>
          <button type="button" onClick={saveGroup} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-black text-white"><Save className="h-4 w-4" />{editingGroupId ? "Grubu Güncelle" : "Grubu Kaydet"}</button>{editingGroupId && <button type="button" onClick={resetForm} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-600">Düzenlemeyi İptal Et</button>}{notice && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{notice}</p>}
        </section>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-black text-slate-900">Kayıtlı Mentör Grupları</h3></div><div className="max-h-[340px] divide-y divide-slate-100 overflow-y-auto">{groups.length ? [...groups].sort((a, b) => a.name.localeCompare(b.name, "tr-TR")).map((group) => { const teacher = teachers.find((item) => item.id === group.teacherId); return <div key={group.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black text-slate-900">{group.name}</div><div className="mt-1 text-[10px] font-bold text-indigo-700">{teacher?.name || "Öğretmen kaydı bulunamadı"}</div><div className="mt-1 text-[10px] font-bold text-slate-500">{group.studentIds.length} öğrenci</div></div><div className="flex gap-1.5"><button type="button" onClick={() => editGroup(group)} className="rounded-lg bg-amber-100 p-2 text-amber-700" title="Düzenle"><Edit3 className="h-3.5 w-3.5" /></button><button type="button" onClick={() => deleteGroup(group.id)} className="rounded-lg bg-rose-100 p-2 text-rose-700" title="Sil"><Trash2 className="h-3.5 w-3.5" /></button></div></div></div>; }) : <div className="p-8 text-center text-xs font-bold text-slate-400">Henüz mentör grubu oluşturulmadı.</div>}</div></section>
      </div>
    </div>
  </div>;
}
