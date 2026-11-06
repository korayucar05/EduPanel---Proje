import React, { useEffect, useState } from "react";
import { ClipboardList, Plus, Save, ArrowLeft, Trash2, Pencil, X } from "lucide-react";
import type { Classroom, Student, Teacher } from "../types";
import appStateService from "../core/state/AppStateService";
import StudentTeacherAssignmentModule from "./StudentTeacherAssignmentModule";
import ApprovalSelectionModule from "./ApprovalSelectionModule";

type Participant = "Öğrenciler" | "Öğretmenler" | "Veliler";
type ListKind = "Onay Listesi" | "Görev Listesi";
type Definition = { id: string; title: string; kind: ListKind; participants: Participant[]; createdAt: string; taskColumns?: string[] };
const STORE_KEY = "assignment_list_definitions_v1";
const approvalKey = (id: string) => `assignment_approval_variables_v1_${id}`;
type ApprovalData = { variables: string[]; marks: Record<string, string> };
const TASK_COLUMNS = ["Öğrenci Tel.", "Baba Adı", "Baba Telefon", "Anne Adı", "Anne Telefon", "İmza"] as const;
const participants: Participant[] = ["Öğrenciler", "Öğretmenler", "Veliler"];

export default function AssignmentDefinitionHub({ students, teachers, classrooms }: { students: Student[]; teachers: Teacher[]; classrooms: Classroom[] }) {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [active, setActive] = useState<Definition | null>(null);
  const [assignmentKind, setAssignmentKind] = useState<"student" | "teacher">("student");
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ListKind>("Onay Listesi");
  const [selected, setSelected] = useState<Participant[]>(["Öğrenciler"]);
  const [saving, setSaving] = useState(false);
  const [taskColumns, setTaskColumns] = useState<string[]>([]);
  const [columnToAdd, setColumnToAdd] = useState<string>(TASK_COLUMNS[0]);
  const [variables, setVariables] = useState<string[]>([]);
  const [variableInput, setVariableInput] = useState("");
  const [loadingVariables, setLoadingVariables] = useState(false);
  const [variableLoadFailed, setVariableLoadFailed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    appStateService.getItem<Definition[]>(STORE_KEY).then((saved) => {
      if (mounted && Array.isArray(saved)) setDefinitions(saved);
    }).catch(() => { if (mounted) setError("Tanımlar yüklenemedi. Kayıt yapmadan önce bağlantıyı kontrol edin."); });
    return () => { mounted = false; };
  }, []);
  const toggle = (person: Participant) => setSelected((prev) => prev.includes(person) ? prev.filter((p) => p !== person) : [...prev, person]);
  const edit = async (definition: Definition) => {
    setEditingId(definition.id);
    setTitle(definition.title);
    setKind(definition.kind);
    setSelected([...definition.participants]);
    setTaskColumns([...(definition.taskColumns || [])]);
    setVariables([]); setVariableInput(""); setLoadingVariables(true);
    setError(""); setVariableLoadFailed(false);
    if (definition.kind === "Onay Listesi") {
      try {
        const saved = await appStateService.getItem<ApprovalData>(approvalKey(definition.id));
        setVariables(Array.isArray(saved?.variables) ? saved.variables : []);
      } catch { setVariableLoadFailed(true); setError("Değişkenler yüklenemedi; güncelleme yapmadan önce tekrar deneyiniz."); }
    }
    setLoadingVariables(false);
  };
  const cancelEdit = () => {
    setEditingId(null); setTitle(""); setKind("Onay Listesi"); setSelected(["Öğrenciler"]); setVariables([]); setVariableInput(""); setTaskColumns([]); setVariableLoadFailed(false); setError("");
  };
  const addVariable = () => {
    const value = variableInput.trim();
    if (!value || variables.some(v => v.toLocaleLowerCase("tr-TR") === value.toLocaleLowerCase("tr-TR"))) return;
    setVariables(v => [...v, value]); setVariableInput("");
  };
  const save = async () => {
    if (!title.trim()) { setError("Faaliyet tanımını yazınız."); return; }
    if (!selected.length) { setError("En az bir katılımcı seçiniz."); return; }
    if (saving || loadingVariables || variableLoadFailed) return;
    setSaving(true); setError("");
    const existing = definitions.find((item) => item.id === editingId);
    const record: Definition = existing
      ? { ...existing, title: title.trim(), kind, participants: [...selected], taskColumns: kind === "Görev Listesi" ? [...taskColumns] : existing.taskColumns }
      : { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), kind, participants: [...selected], taskColumns: kind === "Görev Listesi" ? [...taskColumns] : [], createdAt: new Date().toISOString() };
    const next = existing ? definitions.map((item) => item.id === existing.id ? record : item) : [record, ...definitions];
    try {
      if (kind === "Onay Listesi") {
        const oldData = await appStateService.getItem<ApprovalData>(approvalKey(record.id));
        const marks = oldData?.marks && typeof oldData.marks === "object"
          ? Object.fromEntries(Object.entries(oldData.marks).filter(([, value]) => variables.includes(value))) : {};
        await appStateService.setItem(approvalKey(record.id), { variables: [...variables], marks });
      }
      await appStateService.setItem(STORE_KEY, next);
      setDefinitions(next);
      if (existing) cancelEdit();
      else { cancelEdit(); }
    } catch { setError("Tanım kaydedilemedi. Tekrar deneyiniz."); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Bu tanım silinsin mi?")) return;
    const next = definitions.filter((item) => item.id !== id);
    try { await appStateService.setItem(STORE_KEY, next); setDefinitions(next); }
    catch { setError("Tanım silinemedi."); }
  };
  if (active) return (
    <div className="min-h-full bg-slate-50">
      <div className={`flex flex-wrap items-center gap-3 border-b p-4 ${active.kind === "Görev Listesi" ? "border-red-700 bg-red-600" : "border-green-700 bg-green-600"}`}>
        <button type="button" onClick={() => { setStatisticsOpen(false); setActive(null); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white"><ArrowLeft className="h-4 w-4" /> Tanımlara Dön</button>
        <span className="font-black text-white">{active.title}</span>
        <span className="text-sm font-semibold text-white/90">{active.kind} · {active.participants.join(", ")}</span>
        {active.kind === "Görev Listesi" && <button type="button" onClick={() => setStatisticsOpen(true)}
          className="ml-auto rounded-xl bg-white px-4 py-2 text-sm font-black text-red-700 shadow-sm hover:bg-red-50">
          İstatistik
        </button>}
      </div>
      {active.kind === "Onay Listesi"
        ? <ApprovalSelectionModule students={students} classrooms={classrooms} definitionId={active.id} definitionTitle={active.title} />
        : <StudentTeacherAssignmentModule students={students} teachers={teachers} initialDefinition={{ id: active.id, title: active.title, taskColumns: active.taskColumns || [] }} selectedKind={assignmentKind} onSelectedKindChange={setAssignmentKind} statisticsOpen={statisticsOpen} onCloseStatistics={() => setStatisticsOpen(false)} />}
    </div>
  );
  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-900"><ClipboardList className="h-6 w-6 text-teal-700" /> {editingId ? "Tanımı Güncelle" : "Tanımlama Yap"}</h1>
          <div className="mt-4 grid gap-3">
            <label className="block text-sm font-bold text-slate-700">Liste Türü
              <select value={kind} onChange={(e) => setKind(e.target.value as ListKind)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-teal-600">
                <option>Onay Listesi</option><option>Görev Listesi</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">Faaliyet Tanımı
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Faaliyet tanımını yazınız" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600" />
            </label>
          </div>
          <div className="mt-4"><p className="mb-2 text-sm font-bold text-slate-700">Katılımcılar</p>
            <div className="flex flex-wrap gap-3">{participants.map((p) => <label key={p} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={selected.includes(p)} onChange={() => toggle(p)} className="h-5 w-5 accent-teal-600" />{p}</label>)}</div>
          </div>
          {kind === "Onay Listesi" && <div className="mt-4 border-t border-slate-200 pt-4">
            <h2 className="text-base font-black text-slate-900">Onay Değişkenleri</h2>
            <div className="mt-3 flex gap-2">
              <input value={variableInput} onChange={e => setVariableInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addVariable(); } }} placeholder="Yeni değişken adı" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <button type="button" onClick={addVariable} disabled={!variableInput.trim()} className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white disabled:opacity-40">Ekle</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">{variables.map(v => <span key={v} className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold">{v}<button type="button" onClick={() => setVariables(values => values.filter(x => x !== v))} aria-label={`${v} değişkenini kaldır`} className="text-red-600"><X className="h-4 w-4" /></button></span>)}</div>
          </div>}
          {kind === "Görev Listesi" && <div className="mt-4 border-t border-slate-200 pt-4">
            <h2 className="text-base font-black text-slate-900">Görev Listesi Sütun Başlıkları</h2>
            <div className="mt-3 flex gap-2">
              <select value={columnToAdd} onChange={e => setColumnToAdd(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">{TASK_COLUMNS.map(column => <option key={column} value={column}>{column}</option>)}</select>
              <button type="button" onClick={() => setTaskColumns(current => current.includes(columnToAdd) ? current : [...current, columnToAdd])} disabled={taskColumns.includes(columnToAdd)} className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white disabled:opacity-40">Ekle</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">{taskColumns.map(column => <span key={column} className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold">{column}<button type="button" onClick={() => setTaskColumns(current => current.filter(value => value !== column))} aria-label={`${column} sütununu kaldır`} className="text-red-600"><X className="h-4 w-4" /></button></span>)}</div>
          </div>}
          {error && <p role="alert" className="mt-4 text-sm font-bold text-red-600">{error}</p>}
          <button onClick={() => void save()} disabled={saving || loadingVariables || variableLoadFailed} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> {editingId ? "Güncelle" : "Kaydet"}</button>
          {editingId && <button type="button" onClick={cancelEdit} disabled={saving} className="ml-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-bold text-slate-700"><X className="h-4 w-4" /> İptal</button>}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900"><Plus className="h-5 w-5" /> Kayıtlı Tanımlar</h2>
          <div className="mt-3 space-y-1">{definitions.length === 0 && <p className="text-sm text-slate-500">Henüz kayıtlı tanım yok.</p>}
            {definitions.map((d) => <div key={d.id} className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-200 p-1.5">
              <button type="button" onClick={() => setActive(d)} className={`min-w-0 flex-1 rounded-lg px-2.5 py-1 text-left text-white ${d.kind === "Onay Listesi" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}><span className="block truncate font-bold">{d.title}</span><span className="text-xs text-white/90">{d.kind} · {d.participants.join(", ")}</span></button>
              <button type="button" onClick={() => edit(d)} aria-label="Tanımı düzenle" className="rounded-lg p-1.5 text-teal-700 hover:bg-teal-50"><Pencil className="h-4 w-4" /></button>
              <button type="button" onClick={() => void remove(d.id)} aria-label="Tanımı sil" className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            </div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
