import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  FileDown,
  ListChecks,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { Classroom, Student } from "../types";
import appStateService from "../core/state/AppStateService";
import { getStudentClassroom, getStudentName, getStudentNumber } from "../core/student";

interface ListTrackingModuleProps {
  students: Student[];
  classrooms: Classroom[];
}

type TrackingRecord = {
  id: string;
  title: string;
  description: string;
  classrooms: string[];
  variables: string[];
  assignments: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

const STORE_KEY = "list_tracking_records_v1";
const trCollator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

const normalize = (value: unknown) => String(value ?? "").trim();
const normalizeUpper = (value: unknown) => normalize(value).toLocaleUpperCase("tr-TR");
const safeFileName = (value: string) =>
  normalizeUpper(value || "LISTE_TAKIP")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 90) || "LISTE_TAKIP";

const classSortKey = (value: string) => {
  const text = normalizeUpper(value);
  const match = text.match(/^(\d{1,2})\s*[-./ ]?\s*(.*)$/);
  return { level: match ? Number(match[1]) : 999, branch: match ? match[2] : text };
};

const sortClassNames = (a: string, b: string) => {
  const aa = classSortKey(a);
  const bb = classSortKey(b);
  return aa.level - bb.level || trCollator.compare(aa.branch, bb.branch) || trCollator.compare(a, b);
};

const resolveStudentClassroom = (student: Student, classrooms: Classroom[]) => {
  const direct = normalize(getStudentClassroom(student));
  if (direct) return direct;
  const classId = normalize((student as any).classroomId || (student as any).classId);
  if (!classId) return "";
  const matched = classrooms.find((classroom) => normalize(classroom.id) === classId);
  return normalize(matched?.name);
};

const sortStudents = (a: Student, b: Student) => {
  const classCompare = sortClassNames(normalize(getStudentClassroom(a)), normalize(getStudentClassroom(b)));
  if (classCompare) return classCompare;
  const aNo = Number(getStudentNumber(a));
  const bNo = Number(getStudentNumber(b));
  if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) return aNo - bNo;
  return trCollator.compare(normalize(a.name), normalize(b.name));
};

const emptyRecord = (): TrackingRecord => ({
  id: `tracking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  description: "",
  classrooms: [],
  variables: [],
  assignments: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function ListTrackingModule({ students, classrooms }: ListTrackingModuleProps) {
  const [records, setRecords] = useState<TrackingRecord[]>([]);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState<TrackingRecord>(() => emptyRecord());
  const [tab, setTab] = useState<"setup" | "marking">("setup");
  const [variableInput, setVariableInput] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedVariable, setSelectedVariable] = useState("");
  const [missingClass, setMissingClass] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const studentSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    appStateService.getItem<TrackingRecord[]>(STORE_KEY)
      .then((saved) => {
        if (!mounted) return;
        const next = Array.isArray(saved) ? saved : [];
        setRecords(next);
        if (next[0]) {
          setActiveId(next[0].id);
          setDraft({ ...next[0], assignments: { ...(next[0].assignments || {}) } });
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const persistRecords = async (next: TrackingRecord[]) => {
    setRecords(next);
    await appStateService.setItem(STORE_KEY, next);
  };

  const classNames = useMemo(() => {
    const values = new Set<string>();
    classrooms.forEach((classroom) => {
      const name = normalize(classroom.name);
      if (name) values.add(name);
    });
    students.forEach((student) => {
      const name = resolveStudentClassroom(student, classrooms);
      if (name) values.add(name);
    });
    return [...values].sort(sortClassNames);
  }, [classrooms, students]);

  const activeStudents = useMemo(
    () => students.filter((student) => normalizeUpper((student as any).status) !== "PASİF" && normalizeUpper((student as any).status) !== "INACTIVE"),
    [students],
  );

  const trackedStudents = useMemo(() => {
    const classSet = new Set(draft.classrooms.map(normalizeUpper));
    return activeStudents
      .filter((student) => classSet.has(normalizeUpper(resolveStudentClassroom(student, classrooms))))
      .sort((a, b) => {
        const classCompare = sortClassNames(resolveStudentClassroom(a, classrooms), resolveStudentClassroom(b, classrooms));
        if (classCompare) return classCompare;
        const aNo = Number(getStudentNumber(a));
        const bNo = Number(getStudentNumber(b));
        if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) return aNo - bNo;
        return trCollator.compare(normalize(getStudentName(a)), normalize(getStudentName(b)));
      });
  }, [activeStudents, classrooms, draft.classrooms]);

  const filteredStudents = useMemo(() => {
    const q = normalizeUpper(studentQuery);
    if (!q) return trackedStudents.slice(0, 80);
    const numericQuery = /^\d+$/.test(q);
    return trackedStudents
      .filter((student) => {
        const number = normalizeUpper(getStudentNumber(student));
        if (numericQuery) return number === q;
        const haystack = `${normalizeUpper(getStudentName(student))} ${number} ${normalizeUpper(resolveStudentClassroom(student, classrooms))}`;
        return haystack.includes(q);
      })
      .slice(0, 80);
  }, [classrooms, studentQuery, trackedStudents]);

  const selectedStudent = useMemo(
    () => trackedStudents.find((student) => student.id === selectedStudentId) || null,
    [trackedStudents, selectedStudentId],
  );

  const selectStudentForMarking = (student: Student) => {
    const currentValue = draft.assignments[student.id];
    setSelectedStudentId(student.id);
    setSelectedVariable(currentValue || "");
    setStudentQuery(`${normalizeUpper(getStudentName(student))} · ${resolveStudentClassroom(student, classrooms)} · No: ${getStudentNumber(student) || "-"}`);
  };

  const handleStudentSearchEnter = () => {
    const q = normalizeUpper(studentQuery);
    if (!q) return;
    const numericQuery = /^\d+$/.test(q);
    const exactStudent = numericQuery
      ? trackedStudents.find((student) => normalizeUpper(getStudentNumber(student)) === q)
      : trackedStudents.find((student) => normalizeUpper(getStudentName(student)) === q);
    const student = exactStudent || (filteredStudents.length === 1 ? filteredStudents[0] : null);
    if (student) selectStudentForMarking(student);
  };

  const setDraftField = <K extends keyof TrackingRecord>(key: K, value: TrackingRecord[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const chooseRecord = (id: string) => {
    const record = records.find((item) => item.id === id);
    if (!record) return;
    setActiveId(id);
    setDraft({ ...record, assignments: { ...(record.assignments || {}) } });
    setSelectedStudentId("");
    setSelectedVariable("");
    setStudentQuery("");
  };

  const newRecord = () => {
    const next = emptyRecord();
    setActiveId("");
    setDraft(next);
    setTab("setup");
    setVariableInput("");
    setSelectedStudentId("");
    setSelectedVariable("");
    setStudentQuery("");
    setStatus("");
  };

  const saveDefinition = async () => {
    const title = normalize(draft.title);
    if (!title) return window.alert("Takip konusunu yazınız.");
    if (!draft.classrooms.length) return window.alert("Takip edilecek en az bir sınıf seçiniz.");
    if (!draft.variables.length) return window.alert("En az bir takip değişkeni ekleyiniz.");

    const now = new Date().toISOString();
    const normalizedRecord: TrackingRecord = {
      ...draft,
      title,
      description: normalize(draft.description),
      variables: draft.variables.map(normalize).filter(Boolean),
      updatedAt: now,
      createdAt: draft.createdAt || now,
    };
    const exists = records.some((item) => item.id === normalizedRecord.id);
    const next = exists
      ? records.map((item) => item.id === normalizedRecord.id ? normalizedRecord : item)
      : [normalizedRecord, ...records];
    await persistRecords(next);
    setActiveId(normalizedRecord.id);
    setDraft(normalizedRecord);
    setStatus("Takip tanımı kaydedildi.");
  };

  const deleteRecord = async () => {
    if (!records.some((item) => item.id === draft.id)) return;
    if (!window.confirm(`“${draft.title}” takip kaydı silinsin mi?`)) return;
    const next = records.filter((item) => item.id !== draft.id);
    await persistRecords(next);
    if (next[0]) {
      setActiveId(next[0].id);
      setDraft({ ...next[0], assignments: { ...(next[0].assignments || {}) } });
    } else {
      newRecord();
    }
  };

  const addVariable = () => {
    const value = normalize(variableInput);
    if (!value) return;
    if (draft.variables.some((item) => normalizeUpper(item) === normalizeUpper(value))) {
      setVariableInput("");
      return;
    }
    setDraftField("variables", [...draft.variables, value]);
    setVariableInput("");
  };

  const removeVariable = (value: string) => {
    setDraft((current) => {
      const assignments = { ...current.assignments };
      Object.keys(assignments).forEach((studentId) => {
        if (assignments[studentId] === value) delete assignments[studentId];
      });
      return {
        ...current,
        variables: current.variables.filter((item) => item !== value),
        assignments,
      };
    });
  };

  const toggleClassroom = (classroomName: string) => {
    setDraft((current) => {
      const selected = current.classrooms.includes(classroomName);
      const nextClassrooms = selected
        ? current.classrooms.filter((item) => item !== classroomName)
        : [...current.classrooms, classroomName].sort(sortClassNames);
      const allowed = new Set(nextClassrooms.map(normalizeUpper));
      const assignments = { ...current.assignments };
      Object.keys(assignments).forEach((studentId) => {
        const student = students.find((item) => item.id === studentId);
        if (student && !allowed.has(normalizeUpper(resolveStudentClassroom(student, classrooms)))) delete assignments[studentId];
      });
      return { ...current, classrooms: nextClassrooms, assignments };
    });
  };

  const assignVariable = async () => {
    if (!selectedStudent) return window.alert("Öğrenci seçiniz.");
    if (!selectedVariable) return window.alert("Öğrenciye atanacak değişkeni seçiniz.");
    const nextRecord: TrackingRecord = {
      ...draft,
      assignments: { ...draft.assignments, [selectedStudent.id]: selectedVariable },
      updatedAt: new Date().toISOString(),
    };
    const exists = records.some((item) => item.id === nextRecord.id);
    const next = exists
      ? records.map((item) => item.id === nextRecord.id ? nextRecord : item)
      : [nextRecord, ...records];
    await persistRecords(next);
    setDraft(nextRecord);
    setActiveId(nextRecord.id);
    setStatus(`${getStudentName(selectedStudent)} için “${selectedVariable}” kaydedildi.`);
    setSelectedStudentId("");
    setSelectedVariable("");
    setStudentQuery("");
    requestAnimationFrame(() => studentSearchRef.current?.focus());
  };

  const removeStudentAssignment = async () => {
    if (!selectedStudent) return;
    if (!normalize(draft.assignments[selectedStudent.id])) return;
    const assignments = { ...draft.assignments };
    delete assignments[selectedStudent.id];
    const nextRecord: TrackingRecord = {
      ...draft,
      assignments,
      updatedAt: new Date().toISOString(),
    };
    const exists = records.some((item) => item.id === nextRecord.id);
    const next = exists
      ? records.map((item) => item.id === nextRecord.id ? nextRecord : item)
      : [nextRecord, ...records];
    await persistRecords(next);
    setDraft(nextRecord);
    setActiveId(nextRecord.id);
    setStatus(`${getStudentName(selectedStudent)} için yapılan işaretleme silindi.`);
    setSelectedVariable("");
  };

  const classStudents = (classroomName: string) =>
    trackedStudents.filter((student) => normalizeUpper(resolveStudentClassroom(student, classrooms)) === normalizeUpper(classroomName));

  const missingStudents = (classroomName: string) =>
    classStudents(classroomName).filter((student) => !normalize(draft.assignments[student.id]));

  const assignedCount = trackedStudents.filter((student) => normalize(draft.assignments[student.id])).length;

  const downloadPdf = async (mode: "class" | "all", classroomName?: string) => {
    if (!normalize(draft.title)) return window.alert("Önce takip konusunu kaydediniz.");
    const targetClasses = mode === "class" && classroomName
      ? [classroomName]
      : [...draft.classrooms].sort(sortClassNames);
    if (!targetClasses.length) return window.alert("PDF için sınıf seçimi bulunamadı.");

    const { PdfEngine } = await import("../pdf");
    const content: any[] = [];

    targetClasses.forEach((className, classIndex) => {
      const rows = classStudents(className);
      content.push(
        {
          text: className,
          alignment: "center",
          bold: true,
          fontSize: 16,
          color: "#0f172a",
          margin: [0, 0, 0, 3],
        },
        {
          text: normalizeUpper(draft.title),
          alignment: "center",
          bold: true,
          fontSize: 13,
          color: "#0f766e",
          margin: [0, 0, 0, draft.description ? 2 : 10],
        },
      );
      if (draft.description) {
        content.push({
          text: draft.description,
          alignment: "center",
          fontSize: 9,
          color: "#475569",
          margin: [18, 0, 18, 10],
        });
      }
      const body: any[][] = [[
        { text: "SIRA", bold: true, color: "#ffffff", fillColor: "#0f172a", alignment: "center" },
        { text: "ÖĞRENCİ NUMARASI", bold: true, color: "#ffffff", fillColor: "#0f172a", alignment: "center" },
        { text: "ADI SOYADI", bold: true, color: "#ffffff", fillColor: "#0f172a" },
        { text: "DEĞİŞKEN", bold: true, color: "#ffffff", fillColor: "#0f172a" },
      ]];
      rows.forEach((student, index) => {
        const fillColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";
        body.push([
          { text: String(index + 1), alignment: "center", fillColor },
          { text: String(getStudentNumber(student) || ""), alignment: "center", fillColor },
          { text: normalizeUpper(getStudentName(student)), fillColor },
          { text: normalize(draft.assignments[student.id]) || "", fillColor },
        ]);
      });
      content.push({
        table: { headerRows: 1, widths: [32, 82, "*", 115], body },
        layout: {
          hLineColor: () => "#94a3b8",
          vLineColor: () => "#94a3b8",
          hLineWidth: () => 0.45,
          vLineWidth: () => 0.45,
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        fontSize: 9,
      });
      if (classIndex < targetClasses.length - 1) content.push({ text: "", pageBreak: "after" });
    });

    const filename = mode === "class" && classroomName
      ? `${safeFileName(draft.title)}_${safeFileName(classroomName)}.pdf`
      : `${safeFileName(draft.title)}_TUM_SINIFLAR.pdf`;

    await PdfEngine.generate({
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [34, 32, 34, 28],
      info: { title: draft.title },
      content,
      footer: (currentPage: number, pageCount: number) => ({
        text: `${currentPage} / ${pageCount}`,
        alignment: "center",
        fontSize: 7,
        color: "#94a3b8",
        margin: [0, 8, 0, 0],
      }),
    }, { mode: "download", filename });
  };

  if (loading) {
    return <div className="p-8 text-sm font-bold text-slate-500">Liste takip kayıtları yükleniyor...</div>;
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {status && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            <Check className="h-4 w-4" /> {status}
          </div>
        )}

        {tab === "setup" ? (
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-900">Takip Konusu</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Takip konusu</label>
                  <input value={draft.title} onChange={(e) => setDraftField("title", e.target.value)} placeholder="Örn. Öğle arası okul dışına çıkış izni" className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold outline-none focus:border-teal-500" />
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">Takip edilecek sınıflar</label>
                  <span className="text-xs font-bold text-slate-400">{draft.classrooms.length} sınıf seçili</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {classNames.map((className) => {
                    const selected = draft.classrooms.includes(className);
                    return (
                      <button key={className} onClick={() => toggleClassroom(className)} className={`rounded-xl border px-3 py-2.5 text-sm font-black ${selected ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                        {selected ? "✓ " : ""}{className}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-900">Takip Değişkenleri</h2>
              <p className="mt-1 text-sm text-slate-500">Örn. “İzin verildi”, “İzin verilmedi”. İstediğiniz kadar değişken oluşturabilirsiniz.</p>
              <div className="mt-4 flex gap-2">
                <input
                  value={variableInput}
                  onChange={(e) => setVariableInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariable(); } }}
                  placeholder="Yeni değişken"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold outline-none focus:border-teal-500"
                />
                <button onClick={addVariable} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white hover:bg-teal-700">Ekle</button>
              </div>
              <div className="mt-4 space-y-2">
                {draft.variables.length === 0 && <div className="rounded-xl bg-slate-50 px-4 py-4 text-sm font-medium text-slate-400">Henüz değişken eklenmedi.</div>}
                {draft.variables.map((variable) => (
                  <div key={variable} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="text-sm font-black text-slate-700">{variable}</span>
                    <button onClick={() => removeVariable(variable)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50" title="Değişkeni sil"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                {records.some((item) => item.id === draft.id) && (
                  <button onClick={deleteRecord} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" /> Sil
                  </button>
                )}
                <button onClick={() => void saveDefinition()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700">
                  <Save className="h-4 w-4" /> Kaydet
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.35fr_0.9fr_auto] lg:items-end">
                <div className="relative">
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Öğrenci</label>
                  <Search className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
                  <input
                    ref={studentSearchRef}
                    value={studentQuery}
                    onChange={(e) => { setStudentQuery(e.target.value); setSelectedStudentId(""); setSelectedVariable(""); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleStudentSearchEnter();
                      }
                    }}
                    placeholder="Ad Soyad veya öğrenci numarası..."
                    className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm font-bold outline-none focus:border-teal-500"
                  />
                  {normalize(studentQuery) && !selectedStudent && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                      {filteredStudents.slice(0, 20).map((student) => {
                        const currentValue = draft.assignments[student.id];
                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => selectStudentForMarking(student)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-slate-800">{normalizeUpper(getStudentName(student))}</span>
                              <span className="block text-xs font-bold text-slate-400">{resolveStudentClassroom(student, classrooms)} · No: {getStudentNumber(student) || "-"}</span>
                            </span>
                            {currentValue && <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-700">{currentValue}</span>}
                          </button>
                        );
                      })}
                      {filteredStudents.length === 0 && <div className="px-3 py-4 text-center text-sm font-bold text-slate-400">Öğrenci bulunamadı.</div>}
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Değişken</label>
                  <select
                    value={selectedVariable}
                    onChange={(e) => setSelectedVariable(e.target.value)}
                    disabled={!selectedStudent}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black outline-none focus:border-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">Değişken seçiniz</option>
                    {draft.variables.map((variable) => <option key={variable} value={variable}>{variable}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void assignVariable()}
                    disabled={!selectedStudent || !selectedVariable}
                    className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <Save className="h-4 w-4" /> {selectedStudent && normalize(draft.assignments[selectedStudent.id]) ? "Güncelle" : "Kaydet"}
                  </button>
                  {selectedStudent && normalize(draft.assignments[selectedStudent.id]) && (
                    <button onClick={() => void removeStudentAssignment()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-50">
                      <Trash2 className="h-4 w-4" /> Sil
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">Aktif takip konusu</div>
                  <div className="mt-1 text-xl font-black text-slate-900">{draft.title || "Takip konusu seçilmedi"}</div>
                  {draft.description && <div className="mt-1 text-sm font-medium text-slate-500">{draft.description}</div>}
                </div>
                <button onClick={() => void downloadPdf("all")} disabled={!draft.classrooms.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">
                  <FileDown className="h-4 w-4" /> Tüm Sınıfları PDF Kaydet
                </button>
              </div>

              <div className="mt-5 space-y-2">
                {[...draft.classrooms].sort(sortClassNames).map((className) => {
                  const total = classStudents(className).length;
                  const missing = missingStudents(className).length;
                  const answered = total - missing;
                  return (
                    <div key={className} className="flex min-h-[58px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
                      <button onClick={() => setMissingClass(className)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="w-20 shrink-0 text-base font-black text-slate-900">{className}</div>
                          <div className={`text-xs font-black ${missing ? "text-rose-600" : "text-emerald-600"}`}>{missing ? `${missing} öğrenci işaretlenmedi` : "Tüm öğrenciler işaretlendi"}</div>
                          <div className="text-xs font-black text-slate-500">Cevap veren: {answered} / {total}</div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                      </button>
                      <button onClick={() => void downloadPdf("class", className)} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100">
                        <span className="inline-flex items-center gap-1.5"><FileDown className="h-3.5 w-3.5" /> Sınıf PDF</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      {missingClass && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setMissingClass(null); }}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-lg font-black text-slate-900">{missingClass}</div>
                <div className="text-sm font-bold text-rose-600">Sınıf öğrenci durumu</div>
              </div>
              <button onClick={() => setMissingClass(null)} className="rounded-xl bg-slate-100 p-2 text-slate-500"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              <div className="space-y-2">
                {classStudents(missingClass).map((student, index) => {
                  const value = normalize(draft.assignments[student.id]);
                  return (
                    <div key={student.id} className="grid grid-cols-[42px_90px_1fr_160px] items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                      <div className="text-center text-xs font-black text-slate-400">{index + 1}</div>
                      <div className="text-xs font-black text-slate-600">No: {getStudentNumber(student) || "-"}</div>
                      <div className="text-sm font-black text-slate-800">{normalizeUpper(getStudentName(student))}</div>
                      <div className={`rounded-lg px-3 py-2 text-center text-xs font-black ${value ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                        {value || "Kayıt yok"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
