import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, Download, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { decodeTurkishTextFile } from "../utils/textEncoding";

import { sqliteStorage } from "../core/state/SyncStateStore";
type CurriculumOutcome = { id: string; name: string };
type CurriculumTopic = { id: string; name: string; outcomes: CurriculumOutcome[] };
type CurriculumUnit = { id: string; name: string; topics: CurriculumTopic[] };
type CurriculumData = { units: CurriculumUnit[] };

type CourseItem = {
  id: string;
  gradeLevel: string;
  courseName: string;
  courseType?: string;
  weeklyHours?: number;
  courseGroup?: string;
};

type EditorState =
  | { mode: "unit"; unitId?: string; item?: CurriculumUnit }
  | { mode: "topic"; unitId: string; topicId?: string; item?: CurriculumTopic }
  | { mode: "outcome"; unitId: string; topicId: string; outcomeId?: string; item?: CurriculumOutcome }
  | null;

interface CurriculumManagerProps {
  customCreatedCourses: CourseItem[];
  activeGrade: string;
  deletedCurriculumCourses: string[];
  setDeletedCurriculumCourses: React.Dispatch<React.SetStateAction<string[]>>;
}

const STORAGE_KEY = "rota_curriculum_store_v1";

const emptyCurriculum = (): CurriculumData => ({ units: [] });

const safeParse = (value: string | null): Record<string, CurriculumData> => {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const curriculumKey = (courseId: string) => `curriculum_${courseId}`;

const countItems = (curriculum: CurriculumData) => {
  const units = curriculum.units?.length || 0;
  const topics = (curriculum.units || []).reduce((sum, unit) => sum + (unit.topics?.length || 0), 0);
  const outcomes = (curriculum.units || []).reduce(
    (sum, unit) => sum + (unit.topics || []).reduce((inner, topic) => inner + (topic.outcomes?.length || 0), 0),
    0,
  );
  return { units, topics, outcomes };
};

const splitCsvLine = (line: string) => {
  const separator = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === separator && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
};

const parseCurriculumCsv = (text: string, activeGrade: string): CurriculumData => {
  const gradeNumber = activeGrade.replace(/\.\s*Sınıf/i, "").trim();
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const dataLines = lines.length > 0 && /SINIF|SINIF_SEVIYESI|ÜNITE|UNITE/i.test(lines[0]) ? lines.slice(1) : lines;
  const unitsMap = new Map<string, CurriculumUnit>();

  dataLines.forEach((line) => {
    const [grade, unitId, unitName, topicId, topicName, outcomeId, outcomeName] = splitCsvLine(line);
    if (grade && String(grade).replace(/\.\s*Sınıf/i, "").trim() !== gradeNumber) return;
    if (!unitId || !unitName) return;

    if (!unitsMap.has(unitId)) {
      unitsMap.set(unitId, { id: unitId, name: unitName, topics: [] });
    }

    const unit = unitsMap.get(unitId)!;
    if (!topicId || !topicName) return;

    let topic = unit.topics.find((item) => item.id === topicId);
    if (!topic) {
      topic = { id: topicId, name: topicName, outcomes: [] };
      unit.topics.push(topic);
    }

    if (outcomeId && outcomeName && !topic.outcomes.some((item) => item.id === outcomeId)) {
      topic.outcomes.push({ id: outcomeId, name: outcomeName });
    }
  });

  return { units: Array.from(unitsMap.values()) };
};

export default function CurriculumManager({
  customCreatedCourses,
  activeGrade,
  deletedCurriculumCourses,
  setDeletedCurriculumCourses,
}: CurriculumManagerProps) {
  const [store, setStore] = useState<Record<string, CurriculumData>>(() => safeParse(sqliteStorage.getItem(STORAGE_KEY)));
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState({ id: "", name: "" });

  useEffect(() => {
    try {
      sqliteStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      console.warn("Müfredat sqliteStorage'a kaydedilemedi", error);
    }
  }, [store]);

  const courses = useMemo(
    () =>
      (customCreatedCourses || [])
        .filter((course) => course.gradeLevel === activeGrade && !deletedCurriculumCourses.includes(course.id))
        .sort((a, b) => String(a.courseName || "").localeCompare(String(b.courseName || ""), "tr-TR")),
    [customCreatedCourses, activeGrade, deletedCurriculumCourses],
  );

  useEffect(() => {
    if (courses.length === 0) {
      setSelectedCourseId("");
      return;
    }
    if (!selectedCourseId || !courses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || null;
  const selectedKey = selectedCourse ? curriculumKey(selectedCourse.id) : "";
  const curriculum = selectedKey ? store[selectedKey] || emptyCurriculum() : emptyCurriculum();
  const selectedCounts = countItems(curriculum);

  const setCurriculum = (next: CurriculumData) => {
    if (!selectedKey) return;
    setStore((prev) => ({ ...prev, [selectedKey]: next }));
  };

  const hasCurriculum = (courseId: string) => {
    const counts = countItems(store[curriculumKey(courseId)] || emptyCurriculum());
    return counts.units + counts.topics + counts.outcomes > 0;
  };

  const openEditor = (nextEditor: EditorState) => {
    setEditor(nextEditor);
    const item = nextEditor?.item as any;
    setForm({ id: item?.id || "", name: item?.name || "" });
  };

  const closeEditor = () => {
    setEditor(null);
    setForm({ id: "", name: "" });
  };

  const saveEditor = () => {
    if (!editor || !form.id.trim() || !form.name.trim()) return;
    const next = JSON.parse(JSON.stringify(curriculum)) as CurriculumData;

    if (editor.mode === "unit") {
      const index = next.units.findIndex((unit) => unit.id === editor.unitId);
      const item: CurriculumUnit = { id: form.id.trim(), name: form.name.trim(), topics: index >= 0 ? next.units[index].topics || [] : [] };
      if (index >= 0) next.units[index] = item;
      else next.units.push(item);
      setExpandedUnits((prev) => ({ ...prev, [item.id]: true }));
    }

    if (editor.mode === "topic") {
      const unit = next.units.find((item) => item.id === editor.unitId);
      if (!unit) return;
      const index = unit.topics.findIndex((topic) => topic.id === editor.topicId);
      const item: CurriculumTopic = { id: form.id.trim(), name: form.name.trim(), outcomes: index >= 0 ? unit.topics[index].outcomes || [] : [] };
      if (index >= 0) unit.topics[index] = item;
      else unit.topics.push(item);
      setExpandedUnits((prev) => ({ ...prev, [unit.id]: true }));
      setExpandedTopics((prev) => ({ ...prev, [item.id]: true }));
    }

    if (editor.mode === "outcome") {
      const unit = next.units.find((item) => item.id === editor.unitId);
      const topic = unit?.topics.find((item) => item.id === editor.topicId);
      if (!topic) return;
      const index = topic.outcomes.findIndex((outcome) => outcome.id === editor.outcomeId);
      const item: CurriculumOutcome = { id: form.id.trim(), name: form.name.trim() };
      if (index >= 0) topic.outcomes[index] = item;
      else topic.outcomes.push(item);
      setExpandedUnits((prev) => ({ ...prev, [unit!.id]: true }));
      setExpandedTopics((prev) => ({ ...prev, [topic.id]: true }));
    }

    setCurriculum(next);
    closeEditor();
  };

  const deleteItem = (type: "unit" | "topic" | "outcome", unitId: string, topicId?: string, outcomeId?: string) => {
    const next = JSON.parse(JSON.stringify(curriculum)) as CurriculumData;
    if (type === "unit") next.units = next.units.filter((unit) => unit.id !== unitId);
    if (type === "topic") {
      const unit = next.units.find((item) => item.id === unitId);
      if (unit) unit.topics = unit.topics.filter((topic) => topic.id !== topicId);
    }
    if (type === "outcome") {
      const unit = next.units.find((item) => item.id === unitId);
      const topic = unit?.topics.find((item) => item.id === topicId);
      if (topic) topic.outcomes = topic.outcomes.filter((outcome) => outcome.id !== outcomeId);
    }
    setCurriculum(next);
  };

  const clearCurriculum = () => {
    if (!selectedKey || !confirm("Bu dersin müfredatı tamamen silinsin mi?")) return;
    setStore((prev) => ({ ...prev, [selectedKey]: emptyCurriculum() }));
  };

  const downloadTemplate = () => {
    const header = "SINIF_SEVIYESI;UNITE_ID;UNITE_ADI;KONU_ID;KONU_ADI;KAZANIM_ID;KAZANIM_ADI";
    const gradeNumber = activeGrade.replace(". Sınıf", "");
    const sample = `${gradeNumber};7;GEÇMİŞİN İNŞA SÜRECİNDE TARİH;31;Tarih Öğrenmenin Faydaları;201;K. Tarih Öğrenmenin Faydaları`;
    const blob = new Blob([`\ufeff${header}\n${sample}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mufredat_sablonu_${activeGrade.replace(/\s+/g, "_")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const uploadFile = async (file: File | null) => {
    if (!file || !selectedCourse) return;
    const fileName = file.name.toLocaleLowerCase("tr-TR");
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      alert("Bu güvenli sürüm CSV yüklemeyi destekler. Excel dosyanızı 'CSV UTF-8' olarak kaydedip yükleyin.");
      return;
    }
    const text = await decodeTurkishTextFile(file);
    const parsed = parseCurriculumCsv(text, activeGrade);
    setCurriculum(parsed);
    setExpandedUnits(Object.fromEntries(parsed.units.map((unit) => [unit.id, true])));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <BookOpen className="h-5 w-5 text-purple-700" /> Müfredat Yönetimi
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Ders → Ünite → Konu → Kazanım yapısını manuel oluşturun veya Excel uyumlu CSV ile toplu yükleyin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-700 hover:bg-emerald-100">
              <Download className="h-4 w-4" /> Şablon İndir
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100">
              <Upload className="h-4 w-4" /> Excel/CSV Yükle
              <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(event) => uploadFile(event.target.files?.[0] || null)} />
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">{activeGrade} Dersleri</h4>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{courses.length} ders</span>
          </div>
          <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
            {courses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-400">Bu sınıf seviyesinde ders yok.</div>
            ) : (
              courses.map((course) => {
                const loaded = hasCurriculum(course.id);
                const counts = countItems(store[curriculumKey(course.id)] || emptyCurriculum());
                const selected = selectedCourseId === course.id;
                return (
                  <button
                    key={course.id}
                    onClick={() => setSelectedCourseId(course.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-all ${selected ? "border-purple-500 bg-purple-50 shadow-sm" : loaded ? "border-rose-300 bg-rose-50" : "border-slate-100 bg-slate-50 hover:bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-black ${loaded ? "text-rose-900" : "text-slate-800"}`}>{course.courseName}</p>
                        <p className="mt-0.5 text-[10px] font-bold text-slate-400">{course.courseType || "Ders"} • {course.weeklyHours || "-"} saat</p>
                      </div>
                      {loaded && <span className="rounded-full bg-rose-600 px-2 py-1 text-[9px] font-black text-white">YÜKLÜ</span>}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                      <span className="rounded-xl bg-white/70 px-2 py-1 text-[10px] font-black text-slate-600">{counts.units} Ü</span>
                      <span className="rounded-xl bg-white/70 px-2 py-1 text-[10px] font-black text-slate-600">{counts.topics} K</span>
                      <span className="rounded-xl bg-white/70 px-2 py-1 text-[10px] font-black text-slate-600">{counts.outcomes} Kaz.</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:col-span-8 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          {!selectedCourse ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-200 text-sm font-bold text-slate-400">Ders seçiniz.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-3xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-purple-600">Seçili Ders</p>
                  <h4 className="text-lg font-black text-slate-900">{selectedCourse.courseName}</h4>
                  <p className="text-xs font-bold text-slate-500">{selectedCounts.units} ünite • {selectedCounts.topics} konu • {selectedCounts.outcomes} kazanım</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => openEditor({ mode: "unit" })} className="inline-flex items-center gap-2 rounded-2xl bg-purple-950 px-4 py-2.5 text-xs font-black text-white hover:bg-purple-900">
                    <Plus className="h-4 w-4" /> Ünite Ekle
                  </button>
                  <button onClick={clearCurriculum} className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-100">
                    <Trash2 className="h-4 w-4" /> Müfredatı Temizle
                  </button>
                  <button onClick={() => setDeletedCurriculumCourses((prev) => [...prev, selectedCourse.id])} className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-200">
                    <X className="h-4 w-4" /> Dersi Gizle
                  </button>
                </div>
              </div>

              <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {curriculum.units.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center">
                    <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm font-black text-slate-700">Bu derse ait müfredat henüz oluşturulmadı.</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">Ünite ekleyerek başlayabilir veya CSV dosyası yükleyebilirsiniz.</p>
                  </div>
                ) : (
                  curriculum.units.map((unit) => {
                    const unitOpen = expandedUnits[unit.id] ?? true;
                    return (
                      <div key={unit.id} className="overflow-hidden rounded-3xl border border-indigo-100 bg-indigo-50/40">
                        <div className="flex items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-3">
                          <button onClick={() => setExpandedUnits((prev) => ({ ...prev, [unit.id]: !unitOpen }))} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                            <ChevronDown className={`h-4 w-4 shrink-0 text-indigo-700 transition-transform ${unitOpen ? "" : "-rotate-90"}`} />
                            <span className="truncate text-sm font-black text-indigo-950">{unit.id} - {unit.name}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditor({ mode: "topic", unitId: unit.id })} className="rounded-xl bg-white px-2 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"><Plus className="inline h-3 w-3" /> Konu</button>
                            <button onClick={() => openEditor({ mode: "unit", unitId: unit.id, item: unit })} className="rounded-xl bg-white p-2 text-slate-500 hover:text-indigo-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => deleteItem("unit", unit.id)} className="rounded-xl bg-white p-2 text-slate-500 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>

                        {unitOpen && (
                          <div className="space-y-3 p-4">
                            {unit.topics.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-indigo-100 bg-white p-4 text-xs font-bold text-slate-400">Bu ünitede konu yok.</div>
                            ) : (
                              unit.topics.map((topic) => {
                                const topicOpen = expandedTopics[topic.id] ?? true;
                                return (
                                  <div key={topic.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                                    <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-2.5">
                                      <button onClick={() => setExpandedTopics((prev) => ({ ...prev, [topic.id]: !topicOpen }))} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${topicOpen ? "" : "-rotate-90"}`} />
                                        <span className="truncate text-xs font-black text-slate-800">{topic.id} - {topic.name}</span>
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => openEditor({ mode: "outcome", unitId: unit.id, topicId: topic.id })} className="rounded-lg bg-emerald-50 px-2 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-100"><Plus className="inline h-3 w-3" /> Kazanım</button>
                                        <button onClick={() => openEditor({ mode: "topic", unitId: unit.id, topicId: topic.id, item: topic })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-700"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => deleteItem("topic", unit.id, topic.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    </div>

                                    {topicOpen && (
                                      <div className="divide-y divide-slate-50 p-3">
                                        {topic.outcomes.length === 0 ? (
                                          <div className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-400">Bu konuda kazanım yok.</div>
                                        ) : (
                                          topic.outcomes.map((outcome) => (
                                            <div key={outcome.id} className="flex items-start justify-between gap-3 py-2">
                                              <div className="min-w-0 text-xs font-semibold text-slate-700">
                                                <span className="mr-2 rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">{outcome.id}</span>
                                                {outcome.name}
                                              </div>
                                              <div className="flex shrink-0 items-center gap-1">
                                                <button onClick={() => openEditor({ mode: "outcome", unitId: unit.id, topicId: topic.id, outcomeId: outcome.id, item: outcome })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-700"><Pencil className="h-3.5 w-3.5" /></button>
                                                <button onClick={() => deleteItem("outcome", unit.id, topic.id, outcome.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {editor && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-black text-slate-900">
                {editor.mode === "unit" ? "Ünite" : editor.mode === "topic" ? "Konu" : "Kazanım"} {editor.item ? "Düzenle" : "Ekle"}
              </h4>
              <button onClick={closeEditor} className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">ID</label>
                <input value={form.id} onChange={(event) => setForm((prev) => ({ ...prev, id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-purple-100" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Ad</label>
                <textarea value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-purple-100" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={closeEditor} className="rounded-2xl bg-slate-100 px-5 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-200">İptal</button>
              <button onClick={saveEditor} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700"><Save className="h-4 w-4" /> Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
