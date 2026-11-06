import React, { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ClipboardList, FileDown, Loader2, Plus, Save, Search, ShieldCheck, Trash2, X } from "lucide-react";
import type { Student, Teacher } from "../types";
import { getStudentClassroom, getStudentName, getStudentNumber } from "../core/student/studentIdentity";
import { fetchCollectionFromLocalDatabase, upsertLocalDocument } from "../lib/localDatabase";
import { PdfEngine } from "../pdf/core/PdfEngine";

type Kind = "student" | "teacher";
type ScreenTab = "marking" | "list";
type Person = { id: string; name: string; detail: string; number: string; gender?: "girl" | "boy" | "unknown" };
type Duty = {
  id: string; title: string; date: string; explanation: string;
  selectedIds: string[]; attendedIds: string[]; absentIds?: string[]; completed: boolean;
  cycle: number; createdAt: string; completedAt?: string; definitionId?: string;
};
type StudentDutyStatus = "assigned" | "done" | "absent";
const dutyStatus = (duty: Duty, id: string): StudentDutyStatus => {
  if (duty.attendedIds?.includes(id)) return "done";
  if (duty.absentIds?.includes(id) || (duty.completed && !Array.isArray(duty.absentIds))) return "absent";
  return "assigned";
};
const dutyStatusText = (status: StudentDutyStatus) => status === "done" ? "Görevini yaptı" : status === "absent" ? "Göreve gelmedi" : "Görevlendirildi";
type DutyRegister = { id: Kind; cycle: number; duties: Duty[]; updatedAt?: string };
type TaskDefinition = {
  id: string; title: string; date: string; classrooms: string[];
  createdAt: string; updatedAt: string;
  // Önceden kaydedilmiş görevleri, tanım adı/tarihi düzenlense de gösterebilmek için.
  legacyTitle?: string; legacyDate?: string;
};
type TaskDefinitionsRecord = { id: "definitions"; records: TaskDefinition[]; updatedAt?: string };
const COLLECTION = "rotatingStudentTeacherDuties";
const STUDENT_DUTY_RESET_ID = "studentHistoryReset_20261029";
const STUDENT_DUTY_RESET_ALL_ID = "studentAllDutiesReset_20261029_v2";
const trCollator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
const textSort = (a: string, b: string) => trCollator.compare(a, b);
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const makeId = () => typeof crypto !== "undefined" && crypto.randomUUID
  ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const newDefinition = (classrooms: string[] = []): TaskDefinition => ({
  id: makeId(), title: "", date: today(), classrooms,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});
const emptyRegister = (kind: Kind): DutyRegister => ({ id: kind, cycle: 1, duties: [] });
const cleanRegister = (value: unknown, kind: Kind): DutyRegister => {
  if (!value || typeof value !== "object") return emptyRegister(kind);
  const row = value as Partial<DutyRegister>;
  return {
    id: kind,
    cycle: Number.isSafeInteger(row.cycle) && Number(row.cycle) > 0 ? Number(row.cycle) : 1,
    duties: Array.isArray(row.duties)
      ? row.duties.filter((duty) => Boolean(duty?.id) && Array.isArray(duty.selectedIds))
      : [],
    updatedAt: row.updatedAt,
  };
};
const readableDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};
const keyOf = (title: string, date: string) => `${title.trim().toLocaleUpperCase("tr-TR")}|${date}`;
// Eski görevlerde tanım kimliği değişmiş olabilir; aynı tarih ve başlıkla eşleştir.
const matchesTask = (duty: Duty, task: TaskDefinition) =>
  (Boolean(duty.definitionId) && duty.definitionId === task.id) ||
  keyOf(duty.title, duty.date) === keyOf(task.legacyTitle || task.title, task.legacyDate || task.date);

// Tamamlanmış görevlerde sadece gerçekten katılanlar görev sayısına eklenir (eski liste raporu).
const participationCounts = (duties: Duty[]) => {
  const result = new Map<string, number>();
  duties.forEach((duty) => {
    if (!duty.completed) return;
    new Set(duty.attendedIds || []).forEach((id) => result.set(id, (result.get(id) || 0) + 1));
  });
  return result;
};
const participationTone = (count: number) => count >= 4 ? "bg-rose-400 border-rose-400"
  : count === 3 ? "bg-rose-300 border-rose-300"
  : count === 2 ? "bg-rose-200 border-rose-200"
  : count === 1 ? "bg-rose-100 border-rose-200"
  : "bg-white border-slate-200";

// Yeni Görev Listesi ve İstatistik ekranında TÜM kaydedilmiş görevlendirmeleri say.
// Katılımın kesinleştirilmiş olması gerekmez; tamamlanmamış görevler de görevlendirmedir.
// İptal edilen kayıtlar register'dan kaldırıldığı için doğal olarak sayılmaz.
const assignmentCounts = (duties: Duty[]) => {
  const result = new Map<string, number>();
  duties.forEach((duty) => {
    new Set(duty.selectedIds || []).forEach((id) => {
      result.set(id, (result.get(id) || 0) + 1);
    });
  });
  return result;
};
const assignmentTone = (count: number) => count >= 3 ? "bg-red-600 border-red-700"
  : count === 2 ? "bg-red-200 border-red-300"
  : count === 1 ? "bg-red-50 border-red-100"
  : "bg-white border-slate-200";

export default function StudentTeacherAssignmentModule({ students, teachers, initialDefinition, selectedKind, onSelectedKindChange, statisticsOpen = false, onCloseStatistics }: { students: Student[]; teachers: Teacher[]; initialDefinition?: { id: string; title: string; taskColumns?: string[] }; selectedKind?: Kind; onSelectedKindChange?: (next: Kind) => void; statisticsOpen?: boolean; onCloseStatistics?: () => void }) {
  const [kind, setKind] = useState<Kind>("student");
  const [tab, setTab] = useState<ScreenTab>("marking");
  useEffect(() => { if (selectedKind) { setKind(selectedKind); setQuery(""); setGroup(""); setEnterFeedback(""); setSelectedDutyId(""); } }, [selectedKind]);
  const [registers, setRegisters] = useState<Record<Kind, DutyRegister>>({
    student: emptyRegister("student"), teacher: emptyRegister("teacher"),
  });
  const [definitions, setDefinitions] = useState<TaskDefinition[]>([]);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState<TaskDefinition>(() => newDefinition());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message || message.startsWith("Kayıt yapılamadı") || message.startsWith("PDF oluşturulamadı") || message.startsWith("Excel oluşturulamadı") || message.includes("temizlenemedi")) return;
    const timer = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<Record<Kind, string[]>>({ student: [], teacher: [] });
  const [draftStudentStatuses, setDraftStudentStatuses] = useState<Record<string, StudentDutyStatus>>({});
  const [query, setQuery] = useState("");
  const [enterFeedback, setEnterFeedback] = useState("");
  const [group, setGroup] = useState("");
  const [selectedDutyId, setSelectedDutyId] = useState("");
  const [attendanceModalId, setAttendanceModalId] = useState("");
  const [attendanceChoices, setAttendanceChoices] = useState<Record<string, string[]>>({});
  const [studentStatusDraft, setStudentStatusDraft] = useState<Record<string, StudentDutyStatus>>({});
  const [showClearSelectionConfirm, setShowClearSelectionConfirm] = useState(false);
  const choosePersonKind = (next: Kind) => {
    setKind(next); setGroup(""); setQuery(""); setEnterFeedback(""); setSelectedDutyId("");
    onSelectedKindChange?.(next);
  };

  const roster = useMemo<Record<Kind, Person[]>>(() => {
    const studentRows = new Map<string, Person>();
    students.forEach((student) => {
      if (!student || String(student.status || "Aktif").toLocaleLowerCase("tr-TR") === "pasif") return;
      const number = getStudentNumber(student);
      const id = String(student.id || number || "").trim();
      if (!id || studentRows.has(id)) return;
      const name = getStudentName(student) || String(student.name || "").trim();
      if (!name) return;
      const genderText = String(student.gender || student.cinsiyet || "").trim().toLocaleUpperCase("tr-TR");
      const gender = ["K", "KIZ", "KADIN", "F", "FEMALE"].includes(genderText) ? "girl"
        : ["E", "ERKEK", "M", "MALE"].includes(genderText) ? "boy" : "unknown";
      studentRows.set(id, { id, name, number, detail: getStudentClassroom(student) || String(student.classId || ""), gender });
    });
    const teacherRows = new Map<string, Person>();
    teachers.forEach((teacher) => {
      if (!teacher || String(teacher.status || "Aktif").toLocaleLowerCase("tr-TR") !== "aktif") return;
      const id = String(teacher.id || "").trim();
      if (!id || teacherRows.has(id)) return;
      teacherRows.set(id, { id, name: teacher.name, number: "", detail: teacher.branch || "" });
    });
    const sort = (a: Person, b: Person) => textSort(a.detail, b.detail) || textSort(a.number, b.number) || textSort(a.name, b.name);
    return { student: [...studentRows.values()].sort(sort), teacher: [...teacherRows.values()].sort(sort) };
  }, [students, teachers]);

  const classNames = useMemo(() => [...new Set(roster.student.map((p) => p.detail).filter(Boolean))].sort(textSort), [roster.student]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError("");
    fetchCollectionFromLocalDatabase(COLLECTION).then(async (rows) => {
      if (!mounted) return;
      let student = cleanRegister(rows.find((row) => row?.id === "student"), "student");
      let teacher = cleanRegister(rows.find((row) => row?.id === "teacher"), "teacher");
      // Kaydedilmiş öğrenci görevleri hiçbir zaman ekran açılışında otomatik silinmez.
      if (!mounted) return;
      const record = rows.find((row) => row?.id === "definitions") as TaskDefinitionsRecord | undefined;
      const saved = Array.isArray(record?.records) ? record.records.filter((entry) => Boolean(entry?.id && entry.title)) : [];
      const known = new Set(saved.map((entry) => keyOf(entry.legacyTitle || entry.title, entry.legacyDate || entry.date)));
      // Eski ekrandaki görev kayıtları silinmez: kendileri için otomatik bir tanım gösterilir.
      const legacy: TaskDefinition[] = [];
      for (const duty of [...student.duties, ...teacher.duties]) {
        if (!duty.title || known.has(keyOf(duty.title, duty.date))) continue;
        known.add(keyOf(duty.title, duty.date));
        legacy.push({ id: duty.definitionId || `legacy-${duty.id}`, title: duty.title, date: duty.date,
          legacyTitle: duty.title, legacyDate: duty.date, classrooms: [...classNames],
          createdAt: duty.createdAt, updatedAt: duty.createdAt });
      }
      const linked: TaskDefinition[] = initialDefinition && ![...saved, ...legacy].some((item) => item.id === initialDefinition.id)
        ? [{ id: initialDefinition.id, title: initialDefinition.title, date: today(), classrooms: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
        : [];
      const result = [...linked, ...saved, ...legacy].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRegisters({ student, teacher });
      setDefinitions(result);
      setActiveId(initialDefinition?.id || result[0]?.id || "");
      setDraft(result[0] ? { ...result[0], classrooms: [...(result[0].classrooms || [])] } : newDefinition([...classNames]));
    }).catch((error) => {
      if (mounted) setLoadError(error instanceof Error ? error.message : "Görev kayıtlarına erişilemedi.");
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [reloadToken, initialDefinition?.id, initialDefinition?.title]);

  const register = registers[kind];
  const people = roster[kind];
  const task = definitions.find((item) => item.id === activeId) || null;
  const taskDuties = useMemo(() => task ? register.duties.filter((duty) => matchesTask(duty, task)) : [], [register.duties, task]);
  const counts = useMemo(() => participationCounts(register.duties), [register.duties]);
  const previousAssignmentCounts = useMemo(() => assignmentCounts(register.duties), [register.duties]);
  const studentDutyHistory = useMemo(() => {
    const byId = new Map<string, Duty[]>();
    registers.student.duties.forEach((duty) => {
      new Set(duty.selectedIds || []).forEach((personId) => {
        const history = byId.get(personId) || [];
        history.push(duty);
        byId.set(personId, history);
      });
    });
    return byId;
  }, [registers.student.duties]);
  const studentStatisticGroups = useMemo(() => {
    const grouped = new Map<number, Person[]>();
    roster.student.forEach((person) => {
      const count = studentDutyHistory.get(person.id)?.length || 0;
      const list = grouped.get(count) || [];
      list.push(person);
      grouped.set(count, list);
    });
    return [...grouped.entries()]
      .sort(([countA], [countB]) => countB - countA)
      .map(([count, persons]) => ({
        count,
        persons: persons.sort((a, b) => textSort(a.detail, b.detail) || textSort(a.number, b.number) || textSort(a.name, b.name)),
      }));
  }, [roster.student, studentDutyHistory]);
  // Yeni Görev Listesi'nde okulun bütün mevcut öğrencileri görülebilir ve seçilebilir.
  // Önceki bir görev tanımındaki sınıf kapsamı yeni görevlendirmeyi sınırlamaz.
  const availableIds = useMemo(() => new Set(people.map((person) => person.id)), [people]);
  const selectedIds = selected[kind].filter((id) => availableIds.has(id));
  const selectedIdSet = new Set(selectedIds);
  const filteredPeople = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    return people.filter((person) => (!group || group === person.detail) &&
      (!needle || `${person.name} ${person.detail} ${person.number}`.toLocaleLowerCase("tr-TR").includes(needle)));
  }, [people, query, group]);
  const historyByPerson = useMemo(() => {
    const result = new Map<string, { duty: Duty; status: string }[]>();
    register.duties.forEach((duty) => duty.selectedIds.forEach((id) => {
      const status = kind === "student" ? dutyStatusText(dutyStatus(duty, id)) : !duty.completed ? "Bekliyor" : duty.attendedIds?.includes(id) ? "Katıldı" : "Katılmadı";
      const previous = result.get(id) || [];
      previous.push({ duty, status });
      result.set(id, previous);
    }));
    return result;
  }, [register.duties, kind]);
  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const selectedPeople = selectedIds.map((id) => personById.get(id)).filter((person): person is Person => Boolean(person));
  const savedStudentAssignments = useMemo(() => {
    const byStudent = new Map<string, { id: string; duty: Duty }>();
    for (const duty of [...taskDuties].reverse()) {
      for (const id of duty.selectedIds) byStudent.set(id, { id, duty });
    }
    return [...byStudent.values()];
  }, [taskDuties]);
  const allVisibleStudents = kind === "student" ? [...savedStudentAssignments.map(({ id }) => personById.get(id)).filter((p): p is Person => Boolean(p)), ...selectedPeople] : selectedPeople;
  const selectedGirls = allVisibleStudents.filter((person) => person.gender === "girl").length;
  const selectedBoys = allVisibleStudents.filter((person) => person.gender === "boy").length;
  const selectedUnknown = allVisibleStudents.length - selectedGirls - selectedBoys;
  const savedStudentIdSet = useMemo(() => new Set(savedStudentAssignments.map((item) => item.id)), [savedStudentAssignments]);
  const selectedDuty = taskDuties.find((duty) => duty.id === selectedDutyId) || null;
  const attendanceDuty = taskDuties.find((duty) => duty.id === attendanceModalId) || null;
  const isDisabled = Boolean(loading || saving || loadError);

  const saveRegister = async (target: Kind, next: DutyRegister, successText: string) => {
    setSaving(true);
    setMessage("");
    try {
      await upsertLocalDocument(COLLECTION, target, { ...next, updatedAt: new Date().toISOString() });
      setRegisters((previous) => ({ ...previous, [target]: next }));
      setMessage(successText);
      return true;
    } catch (error) {
      setMessage(`Kayıt yapılamadı: ${error instanceof Error ? error.message : "Veritabanı hatası"}`);
      return false;
    } finally { setSaving(false); }
  };

  const saveDefinitions = async (next: TaskDefinition[], text: string) => {
    setSaving(true);
    setMessage("");
    try {
      await upsertLocalDocument(COLLECTION, "definitions", { id: "definitions", records: next, updatedAt: new Date().toISOString() });
      setDefinitions(next);
      setMessage(text);
      return true;
    } catch (error) {
      setMessage(`Kayıt yapılamadı: ${error instanceof Error ? error.message : "Veritabanı hatası"}`);
      return false;
    } finally { setSaving(false); }
  };

  const chooseTask = (id: string) => {
    const record = definitions.find((entry) => entry.id === id);
    setActiveId(id);
    setDraft(record ? { ...record, classrooms: [...(record.classrooms || [])] } : newDefinition([...classNames]));
    setSelectedDutyId(""); setAttendanceModalId(""); setGroup(""); setQuery(""); setMessage("");
    setSelected({ student: [], teacher: [] }); setDraftStudentStatuses({}); setEnterFeedback("");
  };
  const removeDraftStudent = (id: string) => {
    setSelected((previous) => ({ ...previous, student: previous.student.filter((value) => value !== id) }));
    setDraftStudentStatuses((previous) => { const next = { ...previous }; delete next[id]; return next; });
  };
  const toggleSelected = (id: string) => {
    if (!availableIds.has(id) || (kind === "student" && savedStudentIdSet.has(id))) return;
    setSelected((previous) => ({ ...previous, [kind]: previous[kind].includes(id)
      ? previous[kind].filter((value) => value !== id) : [...previous[kind], id] }));
  };
  const addStudentOnEnter = () => {
    if (kind !== "student" || isDisabled) return;
    const needle = query.trim();
    if (!needle) return;
    const normalized = needle.toLocaleLowerCase("tr-TR");
    const candidates = filteredPeople.filter((person) => availableIds.has(person.id) && !savedStudentIdSet.has(person.id));
    const exactNumber = candidates.filter((person) => person.number.trim() === needle);
    const exactName = candidates.filter((person) => person.name.trim().toLocaleLowerCase("tr-TR") === normalized);
    const matches = exactNumber.length ? exactNumber : exactName.length ? exactName : candidates;
    if (matches.length !== 1) {
      setEnterFeedback(matches.length ? "Birden fazla öğrenci bulundu. Numarayı yazın veya soldaki listeden seçin." : "Bu aramayla seçilebilir öğrenci bulunamadı.");
      return;
    }
    const studentId = matches[0].id;
    setSelected((previous) => ({ ...previous, student: previous.student.includes(studentId) ? previous.student : [...previous.student, studentId] }));
    setQuery("");
    setEnterFeedback("");
  };
  const confirmClearSelection = () => {
    setSelected((previous) => ({ ...previous, [kind]: [] }));
    if (kind === "student") setDraftStudentStatuses({});
    setShowClearSelectionConfirm(false);
    setMessage("Henüz kaydedilmemiş seçimler temizlendi. Kayıtlı görevlendirmeler korundu.");
  };
  const createDuty = async () => {
    if (isDisabled) return;
    if (!task) { setMessage("Önce bir görev seçin."); return; }
    if (!selectedIds.length) { setMessage("Kaydedilecek yeni öğrenci seçimi bulunmuyor. Kayıtlı öğrenciler korunuyor."); return; }
    const now = new Date().toISOString();
    const duty: Duty = { id: makeId(), title: task.title, date: task.date, explanation: "",
      selectedIds, attendedIds: kind === "student" ? selectedIds.filter((id) => draftStudentStatuses[id] === "done") : [],
      absentIds: kind === "student" ? selectedIds.filter((id) => draftStudentStatuses[id] === "absent") : undefined,
      completed: kind === "student" && selectedIds.some((id) => draftStudentStatuses[id] === "done" || draftStudentStatuses[id] === "absent"), cycle: register.cycle,
      definitionId: task.id, createdAt: now };
    if (await saveRegister(kind, { ...register, duties: [duty, ...register.duties] }, "Görevlendirme kaydedildi. Faaliyetten sonra katılımı işleyebilirsiniz.")) {
      setSelectedDutyId(duty.id);
      if (kind === "student") { setSelected((previous) => ({ ...previous, student: [] })); setDraftStudentStatuses({}); }
      setAttendanceChoices((previous) => ({ ...previous, [duty.id]: [] }));
    }
  };
  const setSavedStudentStatus = async (duty: Duty, studentId: string, status: StudentDutyStatus) => {
    if (isDisabled) return;
    const next = register.duties.map((entry) => {
      if (entry.id !== duty.id) return entry;
      const attendedIds = (entry.attendedIds || []).filter((id) => id !== studentId);
      const absentIds = (entry.absentIds || []).filter((id) => id !== studentId);
      if (status === "done") attendedIds.push(studentId);
      if (status === "absent") absentIds.push(studentId);
      return { ...entry, attendedIds, absentIds, completed: attendedIds.length + absentIds.length > 0 };
    });
    await saveRegister("student", { ...register, duties: next }, "Öğrenci görev durumu kaydedildi.");
  };
  const removeSavedStudent = async (duty: Duty, studentId: string, name: string) => {
    if (isDisabled || !window.confirm(`${name} adlı öğrencinin kaydedilmiş görevlendirmesi silinecek. Bu işlem geri alınamaz. Onaylıyor musunuz?`)) return;
    const next = register.duties.map((entry) => entry.id !== duty.id ? entry : {
      ...entry, selectedIds: entry.selectedIds.filter((id) => id !== studentId),
      attendedIds: entry.attendedIds.filter((id) => id !== studentId),
      absentIds: (entry.absentIds || []).filter((id) => id !== studentId),
    }).filter((entry) => entry.selectedIds.length > 0);
    await saveRegister("student", { ...register, duties: next }, "Öğrenci görevlendirmesi onayla kaldırıldı.");
  };
  const openStudentDutyStatuses = (duty: Duty) => {
    const draft: Record<string, StudentDutyStatus> = {};
    duty.selectedIds.forEach((id) => { draft[id] = dutyStatus(duty, id); });
    setStudentStatusDraft(draft);
    setAttendanceModalId(duty.id);
  };
  const saveStudentDutyStatuses = async (duty: Duty) => {
    if (isDisabled || kind !== "student") return;
    const attendedIds = duty.selectedIds.filter((id) => studentStatusDraft[id] === "done");
    const absentIds = duty.selectedIds.filter((id) => studentStatusDraft[id] === "absent");
    const nextDuties = register.duties.map((item) => item.id === duty.id ? {
      ...item, attendedIds, absentIds, completed: true, completedAt: item.completedAt || new Date().toISOString(),
    } : item);
    if (await saveRegister("student", { ...register, duties: nextDuties }, "Öğrencilerin görev durumları kaydedildi.")) {
      setAttendanceModalId("");
    }
  };
  const completeDuty = async (duty: Duty) => {
    if (duty.completed || isDisabled) return;
    const confirmedIds = (attendanceChoices[duty.id] || []).filter((id) => duty.selectedIds.includes(id));
    if (!window.confirm(`${duty.title}\nKatılan: ${confirmedIds.length}\nKatılmayan: ${duty.selectedIds.length - confirmedIds.length}\n\nKatılım kesinleştirilsin mi?`)) return;
    const nextDuties = register.duties.map((item) => item.id === duty.id
      ? { ...item, attendedIds: confirmedIds, completed: true, completedAt: new Date().toISOString() }
      : item);
    if (await saveRegister(kind, { ...register, duties: nextDuties }, "Katılım kaydedildi. Herkes yeniden görevlendirilebilir.")) {
      setAttendanceModalId("");
      setAttendanceChoices((previous) => { const next = { ...previous }; delete next[duty.id]; return next; });
    }
  };
  const clearAllDutyHistory = async () => {
    if (loading || saving || loadError) return;
    const total = registers.student.duties.length + registers.teacher.duties.length;
    if (!total) { setMessage("Temizlenecek geçmiş görevlendirme bulunamadı."); return; }
    if (!window.confirm(`Öğrenci ve öğretmenlere ait ${total} geçmiş görevlendirme kalıcı olarak silinecek. Liste tanımları ve öğrenci bilgileri korunacak. Bu işlem geri alınamaz. Devam edilsin mi?`)) return;
    setSaving(true);
    setMessage("");
    try {
      const timestamp = new Date().toISOString();
      // Her iki görev kaydını da boşalt; kaydedilen liste tanımları korunur.
      await upsertLocalDocument(COLLECTION, "student", { id: "student", cycle: 1, duties: [], updatedAt: timestamp });
      await upsertLocalDocument(COLLECTION, "teacher", { id: "teacher", cycle: 1, duties: [], updatedAt: timestamp });
      setRegisters({ student: emptyRegister("student"), teacher: emptyRegister("teacher") });
      setSelected({ student: [], teacher: [] });
      setSelectedDutyId("");
      setAttendanceModalId("");
      setAttendanceChoices({});
      setMessage("Öğrenci ve öğretmenlerin geçmiş görevlendirme kayıtları temizlendi. Liste tanımları korundu.");
      setReloadToken((token) => token + 1);
    } catch (error) {
      // Bir kayıt yazılıp diğeri yazılamamış olabilir; gerçek durumu tekrar veritabanından al.
      setMessage(`Görev kayıtları tamamen temizlenemedi: ${error instanceof Error ? error.message : "Veritabanı hatası"}. Kayıtlar yeniden okunuyor.`);
      setReloadToken((token) => token + 1);
    } finally {
      setSaving(false);
    }
  };

  const discardPending = async (duty: Duty) => {
    if (isDisabled || !window.confirm(`${duty.title} (${readableDate(duty.date)})\n\nKaydedilmiş görevlendirme ve öğrencilerin görev durumları veritabanından silinecektir. Bu işlem geri alınamaz.\n\nSilme işlemini onaylıyor musunuz?`)) return;
    if (await saveRegister(kind, { ...register, duties: register.duties.filter((item) => item.id !== duty.id) }, "Görevlendirme iptal edildi.")) {
      setSelectedDutyId(""); setAttendanceModalId("");
    }
  };

  const exportSelectedExcel = async () => {
    if (loading || loadError || !task) return;
    const ids = new Set([...selectedIds, ...taskDuties.flatMap(duty => duty.selectedIds)]);
    const rows = people.filter(person => ids.has(person.id)).sort((a,b) => textSort(a.detail,b.detail) || textSort(a.number,b.number) || textSort(a.name,b.name));
    if (!rows.length) return;
    try {
      const XLSX = await import("xlsx");
      const studentMode = kind === "student";
      const extras = studentMode ? (initialDefinition?.taskColumns || []) : [];
      const keys: Record<string,string[]> = {"Öğrenci Tel.":["phone","phoneNumber","studentPhone","student_phone","telefon","telefonNo","mobilePhone","mobile"],"Baba Adı":["fatherName","father_name","babaAdi"],"Baba Telefon":["fatherPhone","father_phone","babaTelefon"],"Anne Adı":["motherName","mother_name","anneAdi"],"Anne Telefon":["motherPhone","mother_phone","anneTelefon"]};
      const header = ["S.",studentMode ? "Sınıf" : "Branş",...(studentMode ? ["No."] : []),"Adı Soyadı",...extras];
      const body = rows.map((p,i) => {
        const student = students.find(item => String(item.id || getStudentNumber(item)) === p.id) as unknown as Record<string,unknown> | undefined;
        return [i+1,p.detail,...(studentMode ? [p.number] : []),p.name,...extras.map(col => col === "İmza" ? "" : String((keys[col]||[]).map(key => student?.[key]).find(v => v != null && String(v).trim()) || ""))];
      });
      const sheet = XLSX.utils.aoa_to_sheet([header,...body]);
      sheet["!cols"] = header.map((col,i) => ({wch: i === (studentMode ? 3 : 2) ? 32 : col === "S." ? 5 : 16}));
      sheet["!margins"] = {left:.2,right:.2,top:.4,bottom:.4,header:.2,footer:.2};
      sheet["!pageSetup"] = {paperSize:9,orientation:"portrait",fitToWidth:1,fitToHeight:0};
      const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,"Görev Listesi");
      XLSX.writeFile(book,`Gorev_Listesi_${today()}.xlsx`);
    } catch(err) { setMessage(`Excel oluşturulamadı: ${err instanceof Error ? err.message : "Excel hatası"}`); }
  };

  const exportSelectedPdf = async () => {
    if (generatingPdf || loading || loadError || !task) return;
    const ids = new Set([...selectedIds, ...taskDuties.flatMap(duty => duty.selectedIds)]);
    const rows = people.filter(person => ids.has(person.id)).sort((a, b) => textSort(a.detail, b.detail) || textSort(a.number, b.number) || textSort(a.name, b.name));
    if (!rows.length) { setMessage("PDF için seçilmiş kişi bulunamadı."); return; }
    setGeneratingPdf(true);
    try {
      const studentMode = kind === "student";
      const extraColumns = studentMode ? (initialDefinition?.taskColumns || []) : [];
      const header = ["S.", studentMode ? "Sınıf" : "Branş", ...(studentMode ? ["No."] : []), "Adı Soyadı", ...extraColumns];
      const body = [header.map(text => ({ text, bold: true, color: "#ffffff", fillColor: "#174067", fontSize: 9, margin: [4, 5, 4, 5] })),
        ...rows.map((p, i) => [String(i + 1), p.detail || "—", ...(studentMode ? [p.number || "—"] : []), p.name, ...extraColumns.map(column => {
          if (column === "İmza") return "";
          const student = students.find(item => String(item.id || getStudentNumber(item)) === p.id) as unknown as Record<string, unknown> | undefined;
          const keys: Record<string, string[]> = { "Öğrenci Tel.": ["phone", "phoneNumber", "studentPhone", "student_phone", "telefon", "telefonNo", "mobilePhone", "mobile"], "Baba Adı": ["fatherName", "father_name", "babaAdi"], "Baba Telefon": ["fatherPhone", "father_phone", "babaTelefon"], "Anne Adı": ["motherName", "mother_name", "anneAdi"], "Anne Telefon": ["motherPhone", "mother_phone", "anneTelefon"] };
          return String((keys[column] || []).map(key => student?.[key]).find(value => value != null && String(value).trim()) || "");
        })].map(text => ({ text, fontSize: 8.5, margin: [4, 4, 4, 4], fillColor: i % 2 ? "#f1f5f9" : "#ffffff" })))];
      await PdfEngine.generate({ pageSize: "A4", pageOrientation: "portrait", pageMargins: [32, 56, 32, 36],
        header: { text: task.title || "GÖREV LİSTESİ", alignment: "center", bold: true, fontSize: 13, margin: [0, 18, 0, 0] },
        content: [{ text: `${rows.length} ${studentMode ? "öğrenci" : "öğretmen"}`, fontSize: 9, margin: [0, 0, 0, 10] },
          { table: { headerRows: 1, widths: studentMode ? [20, 42, 32, "*", ...extraColumns.map(() => "auto")] : [25, 130, "*"], body }, layout: "lightHorizontalLines" }],
        footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: "right", margin: [0, 4, 30, 0], fontSize: 8 })
      }, { filename: `Gorev_Listesi_${today()}.pdf` });
    } catch (err) { setMessage(`PDF oluşturulamadı: ${err instanceof Error ? err.message : "PDF hatası"}`); }
    finally { setGeneratingPdf(false); }
  };

  const exportTaskListPdf = async () => {
    if (generatingPdf || loading || loadError) return;
    setGeneratingPdf(true);
    try {
      const isStudent = kind === "student";
      const title = isStudent ? "ÖĞRENCİ GÖREV LİSTESİ" : "ÖĞRETMEN GÖREV LİSTESİ";
      const personHistory = (id: string) => (historyByPerson.get(id) || [])
        .map(({ duty, status }) => `${readableDate(duty.date)} ${duty.title} (${status})`).join("\n") || "—";
      const columnNames = ["S.", isStudent ? "Sınıf" : "Branş", ...(isStudent ? ["No."] : []), "Adı Soyadı", "Katıldığı\nGörev", "Görevlendirme Geçmişi"];
      const body: any[][] = [
        columnNames.map((text) => ({ text, bold: true, color: "#ffffff", fillColor: "#174067", fontSize: 8, margin: [3, 5, 3, 5] })),
        ...filteredPeople.map((person, index) => {
          const count = counts.get(person.id) || 0;
          const rowColor = isStudent && count ? (count >= 4 ? "#fb7185" : count === 3 ? "#fda4af" : count === 2 ? "#fecdd3" : "#ffe4e6") : (index % 2 ? "#f8fafc" : "#ffffff");
          return [String(index + 1), person.detail || "—", ...(isStudent ? [person.number || "—"] : []), person.name, String(count), personHistory(person.id)]
            .map((text) => ({ text, fontSize: 7.4, fillColor: rowColor, margin: [3, 3, 3, 3] }));
        }),
      ];
      await PdfEngine.generate({
        pageSize: "A4", pageOrientation: "landscape", pageMargins: [28, 48, 28, 35],
        header: { text: title, alignment: "center", bold: true, fontSize: 12, color: "#174067", margin: [0, 18, 0, 0] },
        content: [
          { text: `Tarih: ${readableDate(today())}    •    ${filteredPeople.length} kişi    •    Katıldığı görev sayısına göre renklendirilmiştir.`, margin: [0, 0, 0, 10], fontSize: 8, color: "#475569" },
          { table: { headerRows: 1, widths: isStudent ? [21, 62, 45, 132, 47, "*"] : [21, 82, 180, 47, "*"], body }, layout: { hLineColor: () => "#dbe4ee", vLineColor: () => "#dbe4ee", hLineWidth: () => 0.45, vLineWidth: () => 0.35, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 } },
        ],
        footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: "right", margin: [0, 4, 32, 0], color: "#64748b", fontSize: 8 }),
      }, { filename: `${isStudent ? "Ogrenci" : "Ogretmen"}_Gorev_Listesi_${today()}.pdf` });
    } catch (error) {
      setMessage(`PDF oluşturulamadı: ${error instanceof Error ? error.message : "PDF hatası"}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {loadError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
          Görevlendirme kayıtları yüklenemedi: {loadError}. Kayıt işlemi kapatıldı.
          <button type="button" className="ml-3 underline" onClick={() => setReloadToken((n) => n + 1)}>Yeniden dene</button>
        </div>}
        {loading && <div className="flex items-center gap-2 rounded-2xl bg-white p-6 text-sm font-bold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Görevler yükleniyor...</div>}
        {message && (message.startsWith("Kayıt yapılamadı") || message.startsWith("PDF oluşturulamadı") || message.startsWith("Excel oluşturulamadı") || message.includes("temizlenemedi")) && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{message}</div>}
        {message && !(message.startsWith("Kayıt yapılamadı") || message.startsWith("PDF oluşturulamadı") || message.startsWith("Excel oluşturulamadı") || message.includes("temizlenemedi")) && <div role="status" className="fixed left-1/2 top-20 z-[100] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-200 bg-white px-6 py-4 text-sm font-bold text-emerald-800 shadow-2xl"><Check className="h-5 w-5 shrink-0" />Kayıt tamamlandı.</div>}

        {!loading && !loadError && (tab === "list" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => void exportTaskListPdf()} disabled={isDisabled || generatingPdf}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-800 disabled:opacity-40">
                {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF Liste Al
              </button>
            </div>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-black text-slate-900">{kind === "student" ? "Öğrenci Görev Listesi" : "Öğretmen Görev Listesi"}</h2>
                <span className="text-xs font-bold text-slate-500">{filteredPeople.length} kişi</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                <select value={kind} onChange={(e) => choosePersonKind(e.target.value as Kind)}
                  aria-label="Liste türü" className="min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">
                  <option value="student">Öğrenci</option>
                  <option value="teacher">Öğretmen</option>
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={kind === "student" ? "Öğrenci adı veya numarası ara..." : "Öğretmen adı veya branş ara..."}
                    className="w-full rounded-xl border border-yellow-400 bg-yellow-200 py-2.5 pl-10 pr-3 text-sm font-bold outline-none focus:border-yellow-600" />
                </div>
              </div>
              <div className="mt-3 text-xs font-bold text-slate-500">Pembe tonlar kesinleşmiş katılım sayısını gösterir. Katılmadığı veya henüz sonuçlanmayan görevler sayıya eklenmez. PDF, ekranda filtrelenmiş listeyi içerir.</div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[750px] border-collapse text-sm">
                  <thead className="bg-slate-800 text-left text-xs font-black text-white"><tr>
                    <th className="px-3 py-3">S.</th><th className="px-3 py-3">{kind === "student" ? "Sınıf" : "Branş"}</th>
                    {kind === "student" && <th className="px-3 py-3">No.</th>}
                    <th className="px-3 py-3">Adı Soyadı</th><th className="px-3 py-3">Katıldığı Görev</th><th className="px-3 py-3">Görevlendirme Geçmişi</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredPeople.map((person, index) => {
                      const count = counts.get(person.id) || 0;
                      const history = historyByPerson.get(person.id) || [];
                      return <tr key={person.id} className={kind === "student" ? participationTone(count).split(" ")[0] : "bg-white"}>
                        <td className="px-3 py-3 font-bold">{index + 1}</td><td className="px-3 py-3 font-bold">{person.detail}</td>
                        {kind === "student" && <td className="px-3 py-3">{person.number}</td>}
                        <td className="px-3 py-3 font-black">{person.name}</td>
                        <td className="px-3 py-3 font-black">{count}</td>
                        <td className="px-3 py-3 text-xs">{history.length ? history.map(({ duty, status }) =>
                          <div key={duty.id} className="py-0.5">{readableDate(duty.date)} · {duty.title} · {status}</div>) : "—"}</td>
                      </tr>;
                    })}
                    {!filteredPeople.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Kişi bulunamadı.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            {!task ? <section className="rounded-3xl border border-slate-200 bg-white p-7 text-sm font-bold text-slate-500">
              Görevlendirme yapabilmek için üstteki Tanımlama Yap ekranından bir Görev Listesi oluşturun veya kayıtlı bir görevi seçin.
            </section> : <>
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="min-w-0">
                      <h2 className="text-base font-black text-slate-900">{kind === "student" ? "Öğrenci Seçimi" : "Öğretmen Seçimi"}</h2>
                      <div className="mt-4 grid gap-3 md:grid-cols-[150px_minmax(0,1fr)]">
                        <select value={kind} onChange={(e) => choosePersonKind(e.target.value as Kind)}
                          aria-label="Kişi türü" className="min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">
                          <option value="student">Öğrenci</option>
                          <option value="teacher">Öğretmen</option>
                        </select>
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                          <input value={query} onChange={(e) => { setQuery(e.target.value); setEnterFeedback(""); }}
                            onKeyDown={(e) => { if (e.key === "Enter" && kind === "student") { e.preventDefault(); addStudentOnEnter(); } }}
                            placeholder={kind === "student" ? "Ad veya numara yazıp Enter'a basın" : "Öğretmen adı veya branş..."}
                            className="w-full rounded-xl border border-yellow-400 bg-yellow-200 py-2.5 pl-10 pr-3 text-sm font-bold outline-none focus:border-yellow-600" />
                        </div>
                      </div>
                      {enterFeedback && <p role="status" className="mt-2 text-xs font-bold text-amber-700">{enterFeedback}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-black">
                        <button type="button" disabled={isDisabled} onClick={() => {
                          const add = filteredPeople.filter((person) => availableIds.has(person.id) && (kind !== "student" || !savedStudentIdSet.has(person.id))).map((person) => person.id);
                          setSelected((current) => ({ ...current, [kind]: [...new Set([...selectedIds, ...add])] }));
                        }} className="text-teal-700 disabled:opacity-40">Uygun olanları seç</button>
                        <button type="button" disabled={isDisabled} onClick={() => setSelected((current) => ({ ...current, [kind]: [] }))}
                          className="text-slate-500 disabled:opacity-40">Seçimi temizle</button>
                        <span className="ml-auto text-slate-500">{filteredPeople.length} kişi</span>
                      </div>
                      <div className="mt-3 max-h-[500px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                        {filteredPeople.map((person) => {
                          const count = kind === "student" ? (previousAssignmentCounts.get(person.id) || 0) : 0;
                          const canSelect = availableIds.has(person.id) && !(kind === "student" && savedStudentIdSet.has(person.id));
                          const previouslyAssignedThreeOrMore = kind === "student" && count >= 3;
                          const previousDuties = kind === "student" ? (studentDutyHistory.get(person.id) || []) : [];
                          const lastMarkedDuty = [...previousDuties].reverse().find((duty) => dutyStatus(duty, person.id) !== "assigned");
                          const didNotAttend = Boolean(lastMarkedDuty && dutyStatus(lastMarkedDuty, person.id) === "absent");
                          return <label key={person.id} className={`flex items-center gap-3 border-l-4 px-3 py-2 text-sm ${didNotAttend ? "border-slate-400 bg-slate-200" : kind === "student" ? assignmentTone(count) : "border-transparent bg-white"} ${canSelect ? "cursor-pointer hover:brightness-95" : "opacity-60"}`}>
                            <input type="checkbox" checked={selectedIdSet.has(person.id)} disabled={!canSelect || isDisabled}
                              onChange={() => toggleSelected(person.id)} className="h-4 w-4 accent-teal-600" />
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate font-black ${previouslyAssignedThreeOrMore && !didNotAttend ? "text-white" : "text-slate-900"}`}>{person.name}</span>
                              <span className={`text-xs font-bold ${previouslyAssignedThreeOrMore && !didNotAttend ? "text-white/90" : "text-slate-600"}`}>{person.detail}{person.number ? ` · No: ${person.number}` : ""}</span>
                            </span>
                            <span className={`text-xs font-black ${previouslyAssignedThreeOrMore && !didNotAttend ? "text-white" : canSelect ? "text-teal-800" : "text-slate-500"}`}>
                              {count ? `${count} görev · Seçilebilir` : "Seçilebilir"}
                            </span>
                          </label>;
                        })}
                        {!filteredPeople.length && <div className="p-5 text-center text-sm text-slate-400">Kişi bulunamadı.</div>}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-base font-black text-slate-900">{kind === "student" ? "Seçilen Öğrenciler" : "Seçilen Öğretmenler"}</h2>
                        <div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => void exportSelectedPdf()} disabled={generatingPdf || isDisabled || (!selectedIds.length && !taskDuties.some(duty => duty.selectedIds.length))} className="rounded-lg bg-rose-700 px-2.5 py-2 text-xs font-black text-white disabled:opacity-40">PDF</button><button type="button" onClick={() => void exportSelectedExcel()} disabled={isDisabled || (!selectedIds.length && !taskDuties.some(duty => duty.selectedIds.length))} className="rounded-lg bg-emerald-700 px-2.5 py-2 text-xs font-black text-white disabled:opacity-40">Excel</button><button type="button" onClick={() => void createDuty()} disabled={isDisabled} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-2 text-xs font-black text-white disabled:opacity-40"><Save className="h-4 w-4" />Kaydet</button><button type="button" onClick={() => setShowClearSelectionConfirm(true)} disabled={isDisabled} className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-2 text-xs font-black text-white hover:bg-orange-600 disabled:opacity-40">Seçimi Temizle</button></div>
                      </div>
                      {kind === "student" && <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-md bg-pink-100 px-2 py-1 text-xs font-black text-pink-800">Kız: {selectedGirls}</span>
                        <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-black text-sky-800">Erkek: {selectedBoys}</span>
                        {selectedUnknown > 0 && <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">Belirtilmemiş: {selectedUnknown}</span>}
                      </div>}
                      <div className="mt-3 max-h-[500px] overflow-y-auto rounded-lg bg-white px-3 py-2" aria-label={kind === "student" ? "Seçilen öğrenciler listesi" : "Seçilen öğretmenler listesi"}>
                        {kind === "student" && savedStudentAssignments.map(({ id, duty }, index) => {
                          const person = personById.get(id);
                          const status = dutyStatus(duty, id);
                          return <div key={`${duty.id}-${id}`} className={`flex min-w-0 items-center gap-2 border-b border-slate-100 px-2 py-2 text-sm ${status === "absent" ? "rounded-md bg-slate-200" : ""}`}>
                            <span className="w-6 shrink-0 text-right text-xs text-slate-400">{index + 1}.</span>
                            <span className="min-w-0 flex-1"><strong className="block truncate">{person?.name || `Öğrenci kaydı: ${id}`}</strong><span className="text-xs text-slate-500">{person ? `${person.detail} · No: ${person.number}` : "Öğrenci bilgisi mevcut listede bulunamadı"} · Kaydedildi</span></span>
                            <button type="button" disabled={isDisabled} aria-pressed={status === "done"} onClick={() => void setSavedStudentStatus(duty, id, status === "done" ? "assigned" : "done")}
                              className={`rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-40 ${status === "done" ? "bg-emerald-700 text-white" : "bg-white text-emerald-800 border-emerald-200"}`}><Check className="mr-1 inline h-3.5 w-3.5"/>Geldi</button>
                            <button type="button" disabled={isDisabled} aria-pressed={status === "absent"} onClick={() => void setSavedStudentStatus(duty, id, status === "absent" ? "assigned" : "absent")}
                              className={`rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-40 ${status === "absent" ? "bg-rose-700 text-white" : "bg-white text-rose-800 border-rose-200"}`}><Check className="mr-1 inline h-3.5 w-3.5"/>Gelmedi</button>
                            <button type="button" disabled={isDisabled} title="Kayıtlı öğrenciyi onayla sil" aria-label={`${person?.name || id} görevlendirmesini sil`} onClick={() => void removeSavedStudent(duty, id, person?.name || id)} className="rounded-md p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"><X className="h-4 w-4"/></button>
                          </div>;
                        })}
                        {selectedPeople.map((person, index) => <div key={person.id} title={`${person.detail}${person.number ? ` · No: ${person.number}` : ""}`}
                          className="flex min-w-0 items-baseline gap-2 py-0.5 text-sm leading-5 text-slate-800">
                          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-400">{index + 1}.</span>
                          <span className="min-w-0 flex-1 truncate font-semibold">{person.name}</span>
                          {kind === "student" && <div className="ml-auto flex shrink-0 items-center gap-1">
                            <button type="button" disabled={isDisabled} onClick={() => setDraftStudentStatuses((previous) => ({ ...previous, [person.id]: previous[person.id] === "done" ? "assigned" : "done" }))}
                              aria-pressed={draftStudentStatuses[person.id] === "done"} title="Göreve geldi"
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-40 ${draftStudentStatuses[person.id] === "done" ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-200 bg-white text-emerald-800"}`}>
                              <Check className="h-4 w-4" /> Geldi
                            </button>
                            <button type="button" disabled={isDisabled} onClick={() => setDraftStudentStatuses((previous) => ({ ...previous, [person.id]: previous[person.id] === "absent" ? "assigned" : "absent" }))}
                              aria-pressed={draftStudentStatuses[person.id] === "absent"} title="Göreve gelmedi"
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-40 ${draftStudentStatuses[person.id] === "absent" ? "border-rose-700 bg-rose-700 text-white" : "border-rose-200 bg-white text-rose-800"}`}>
                              <Check className="h-4 w-4" /> Gelmedi
                            </button>
                            <button type="button" onClick={() => removeDraftStudent(person.id)} disabled={isDisabled}
                              aria-label={`${person.name} seçimini kaldır`} title="Seçimden çıkar"
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40">
                              <X className="h-4 w-4" />
                            </button>
                          </div>}
                        </div>)}
                        {!selectedPeople.length && !(kind === "student" && savedStudentAssignments.length) && <p className="py-3 text-sm text-slate-500">Bu görev için kaydedilmiş öğrenci bulunamadı. Daha önce alınmış PDF, silinmiş bir görev kaydını kendiliğinden geri getirmez.</p>}
                      </div>
                    </div>
                  </div>

                </section>
            </>}
          </div>
        ))}
      </div>

      {showClearSelectionConfirm && <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
        <div role="alertdialog" aria-modal="true" aria-labelledby="student-clear-confirm-title" aria-describedby="student-clear-confirm-description" className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl">
          <h3 id="student-clear-confirm-title" className="text-lg font-black text-slate-900">Seçimi temizlemek istiyor musunuz?</h3>
          <p id="student-clear-confirm-description" className="mt-3 text-sm leading-6 text-slate-700">
            Henüz kaydedilmemiş {kind === "student" ? "öğrenci" : "öğretmen"} seçimleri ({selectedIds.length} kişi) kaldırılacaktır. Bu işlem geri alınamaz. <strong>Önceden kaydedilmiş görevlendirmeler ve öğrencilerin Geldi/Gelmedi durumları silinmeyecektir.</strong>
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setShowClearSelectionConfirm(false)} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Hayır</button>
            <button type="button" onClick={confirmClearSelection} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700">Evet, Temizle</button>
          </div>
        </div>
      </div>}

      {statisticsOpen && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4"
        onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseStatistics?.(); }}>
        <section role="dialog" aria-modal="true" aria-label="Görev İstatistikleri"
          className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Görev İstatistikleri</h2>
              <p className="text-xs font-medium text-slate-500">Okuldaki tüm aktif öğrenciler · Kaydedilmiş görevlendirmeler</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onCloseStatistics} aria-label="İstatistikleri kapat" className="rounded-lg p-2 text-slate-600 hover:bg-slate-200"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {loading && <p className="text-sm font-semibold text-slate-500">Geçmiş görevlendirmeler yükleniyor...</p>}
            {loadError && <p className="text-sm font-bold text-red-700">Görev kayıtları okunamadı: {loadError}</p>}
            {!loading && !loadError && studentStatisticGroups.map(({ count, persons }) => (
              <section key={count} className="overflow-hidden rounded-xl border border-slate-200">
                <div className={`flex items-center justify-between px-4 py-3 ${count === 0 ? "bg-slate-200 text-slate-900" : count >= 3 ? "bg-red-600 text-white" : count === 2 ? "bg-pink-300 text-slate-900" : "bg-pink-100 text-slate-900"}`}>
                  <h3 className="text-sm font-black">{count === 0 ? "HİÇ GÖREV ALMAYANLAR" : `${count} GÖREV ALANLAR`}</h3>
                  <span className="text-xs font-bold">{persons.length} öğrenci</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[580px] border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-xs font-black text-slate-700"><tr>
                      <th className="w-14 px-3 py-2">S.</th><th className="w-20 px-3 py-2">Sınıf</th><th className="w-24 px-3 py-2">No.</th>
                      <th className="px-3 py-2">Adı Soyadı</th><th className="px-3 py-2">Görev Aldığı Tanımlamalar</th>
                    </tr></thead>
                    <tbody>{persons.map((person, index) => (
                      <tr key={person.id} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                        <td className="px-3 py-2 text-xs text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2 font-bold">{person.detail || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{person.number || "—"}</td>
                        <td className="px-3 py-2 font-bold">{person.name}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">
                          {(studentDutyHistory.get(person.id) || []).length
                            ? studentDutyHistory.get(person.id)!.map((duty) => (
                              <div key={duty.id} className="py-0.5">{duty.title || "Görev"} <span className="text-slate-500">({readableDate(duty.date)}) · {dutyStatusText(dutyStatus(duty, person.id))}</span></div>
                            )) : "—"}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>
            ))}
            {!loading && !loadError && !studentStatisticGroups.length && <p className="py-6 text-center text-sm text-slate-500">Listelenecek öğrenci bulunamadı.</p>}
          </div>
        </section>
      </div>}

      {attendanceDuty && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4"
        onMouseDown={(e) => { if (e.target === e.currentTarget) setAttendanceModalId(""); }}>
        <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><h2 className="text-lg font-black text-slate-900">{attendanceDuty.title}</h2>
              <p className="text-sm font-medium text-slate-500">{readableDate(attendanceDuty.date)} · Katılım kaydı</p></div>
            <button type="button" onClick={() => setAttendanceModalId("")} className="rounded-xl bg-slate-100 p-2 text-slate-600"><X className="h-5 w-5" /></button>
          </div>
          <div className="max-h-[62vh] overflow-y-auto p-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {attendanceDuty.selectedIds.map((id) => {
                const person = personById.get(id);
                if (kind === "student") {
                  const status = studentStatusDraft[id] || "assigned";
                  return <div key={id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                    <div className="min-w-0 flex-1"><span className="block truncate font-black text-slate-800">{person?.name || `Kayıt ID: ${id}`}</span>
                      <span className="text-xs font-bold text-slate-400">{person?.detail || ""}</span></div>
                    <select aria-label={`${person?.name || id} görev durumu`} value={status} disabled={isDisabled}
                      onChange={(event) => setStudentStatusDraft((previous) => ({ ...previous, [id]: event.target.value as StudentDutyStatus }))}
                      className={`max-w-full rounded-lg border px-3 py-2 text-xs font-bold ${status === "absent" ? "border-rose-300 bg-rose-50 text-rose-800" : status === "done" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"}`}>
                      <option value="assigned">Görevlendirildi</option>
                      <option value="done">Göreve geldi / Görevini yaptı</option>
                      <option value="absent">Göreve gelmedi</option>
                    </select>
                  </div>;
                }
                const choices = attendanceDuty.completed ? attendanceDuty.attendedIds : (attendanceChoices[attendanceDuty.id] || []);
                const checked = choices.includes(id);
                return <label key={id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={checked}
                    disabled={attendanceDuty.completed || isDisabled}
                    onChange={(event) => setAttendanceChoices((previous) => ({ ...previous,
                      [attendanceDuty.id]: event.target.checked
                        ? [...(previous[attendanceDuty.id] || []), id]
                        : (previous[attendanceDuty.id] || []).filter((value) => value !== id),
                    }))} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-black text-slate-800">{person?.name || `Kayıt ID: ${id}`}</span>
                    <span className="text-xs font-bold text-slate-400">{person?.detail || ""}</span></span>
                  <span className={`text-xs font-black ${checked ? "text-emerald-700" : "text-rose-600"}`}>{checked ? "Katıldı" : "Katılmadı"}</span>
                </label>;
              })}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button type="button" onClick={() => setAttendanceModalId("")} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700">Kapat</button>
            {kind === "student" && <button type="button" disabled={isDisabled} onClick={() => void saveStudentDutyStatuses(attendanceDuty)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"><Save className="h-4 w-4" /> Durumları Kaydet</button>}
            {kind !== "student" && !attendanceDuty.completed && <button type="button" disabled={isDisabled} onClick={() => void completeDuty(attendanceDuty)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">
              <ShieldCheck className="h-4 w-4" /> Katılımı Kesinleştir
            </button>}
          </div>
        </div>
      </div>}
    </div>
  );
}
