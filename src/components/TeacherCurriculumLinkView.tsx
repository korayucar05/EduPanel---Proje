import React, { useEffect, useMemo, useState } from "react";
import localforage from "../core/state/AppStateService";
import { BookOpen, CheckCircle2, Save } from "lucide-react";
import { fetchCollectionFromLocalDatabase, upsertLocalDocument } from "../lib/localDatabase";
import { getQuestionCorrectAnswer } from "../utils/questionAnswer";

const normalize = (value: unknown) => String(value || "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
const canonicalCourseId = (value: unknown) => String(value || "").replace(/^CURR-(?:9|10|11|12)-/i, "");

export default function TeacherCurriculumLinkView() {
  const params = new URLSearchParams(window.location.search);
  const examId = params.get("exam") || "";
  const subject = params.get("subject") || "";
  const teacherId = params.get("teacher") || "";
  const [exam, setExam] = useState<any>(null);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("Yükleniyor...");
  const [busy, setBusy] = useState(false);

  const plan = useMemo(() => (exam?.questionBlueprint || []).filter((row: any) => normalize(row.subject) === normalize(subject)), [exam, subject]);
  const requiredTotal = useMemo(() => plan.reduce((sum: number, row: any) => sum + Number(row.count || 0), 0), [plan]);

  useEffect(() => {
    (async () => {
      const databaseExams = await fetchCollectionFromLocalDatabase("exams").catch(() => []);
      const localExams = (await localforage.getItem<any[]>("exams")) || [];
      const exams = databaseExams.length ? databaseExams : localExams;
      const found = exams.find((item: any) => String(item.id) === examId);
      setExam(found || null);
      if (!found) { setStatus("Sınav bulunamadı."); return; }
      const rows = (found.questionBlueprint || []).filter((row: any) => normalize(row.subject) === normalize(subject));
      if (!rows.length) { setStatus("Bu ders için yönetici tarafından soru kapsamı tanımlanmamış."); return; }
      setBusy(true);
      try {
        const collected: any[] = [];
        for (const row of rows) {
          const qs = new URLSearchParams({ status: "active", grade: String(found.gradeLevel === "YKS" ? "12" : found.gradeLevel), courseId: canonicalCourseId(row.courseId), limit: "500" });
          if (row.unitId) qs.set("unitId", String(row.unitId));
          if (row.topicId) qs.set("topicId", String(row.topicId));
          if (row.outcomeId) qs.set("outcomeId", String(row.outcomeId));
          const response = await fetch(`/api/question-bank/questions?${qs.toString()}`, { cache: "no-store" });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload?.error || "Soru bankası okunamadı.");
          const data = Array.isArray(payload) ? payload : (payload.questions || payload.items || payload.rows || payload.data || []);
          data.forEach((q: any) => collected.push({ ...q, planId: row.id, planCount: Number(row.count || 0), planLabel: `${row.unitName} / ${row.topicName} / ${row.outcomeName}` }));
        }
        const unique = new Map<string, any>();
        collected.forEach((q: any, index: number) => { const key=String(q.id || q.questionId || q.question_id || q.storagePath || q.fileName || `${q.planId}-${index}`); unique.set(`${q.planId}::${key}`, { ...q, _key:key }); });
        setBankQuestions([...unique.values()]);
        setStatus("");
      } catch (error: any) { setStatus(error?.message || "Sorular yüklenemedi."); }
      finally { setBusy(false); }
    })();
  }, [examId, subject]);

  const selectedForPlan = (planId: string) => bankQuestions.filter(q => q.planId === planId && selected.has(`${planId}::${q._key}`)).length;
  const toggle = (q: any) => {
    const key=`${q.planId}::${q._key}`;
    setSelected(current => { const next=new Set(current); if(next.has(key)) next.delete(key); else { if(selectedForPlan(q.planId) >= Number(q.planCount || 0)) return current; next.add(key); } return next; });
  };

  const save = async () => {
    if (plan.some((row:any)=>selectedForPlan(row.id)!==Number(row.count||0))) { setStatus("Her kazanım için istenen soru sayısını tam olarak seçiniz."); return; }
    const chosen=bankQuestions.filter(q=>selected.has(`${q.planId}::${q._key}`));
    const localExams = (await localforage.getItem<any[]>("exams")) || [];
    const latest = localExams.find((item:any)=>String(item.id)===examId) || exam;
    const subjectQuestions:any = {};
    chosen.forEach((q:any,index:number)=>{ subjectQuestions[index]={ imageUrl:q.imageUrl||q.imageDataUrl||q.thumbnailUrl||"", fileName:q.fileName||q.code||`Soru ${index+1}`, correctAnswer:q.correctAnswer||q.answer||q.correct_answer||"", unit:q.unitName||plan.find((r:any)=>r.id===q.planId)?.unitName||"", topic:q.topicName||plan.find((r:any)=>r.id===q.planId)?.topicName||"", outcome:q.outcomeName||plan.find((r:any)=>r.id===q.planId)?.outcomeName||"", systemQuestionId:q.id||q.questionId||q.question_id||q._key, systemCourseId:q.courseId||q.course_id||"", systemUnitId:q.unitId||q.unit_id||"", systemTopicId:q.topicId||q.topic_id||"", systemOutcomeId:q.outcomeId||q.outcome_id||"" }; });
    const updated={...latest, questions:{...(latest.questions||{}),[subject]:subjectQuestions}, teacherQuestionAssignments:{...(latest.teacherQuestionAssignments||{}),[subject]:{teacherId,selectedQuestionIds:chosen.map((q:any)=>q._key),completedAt:new Date().toISOString()}}};
    const next=localExams.some((item:any)=>item.id===updated.id)?localExams.map((item:any)=>item.id===updated.id?updated:item):[...localExams,updated];
    await localforage.setItem("exams", next);
    await upsertLocalDocument("exams", String(updated.id), updated);
    setExam(updated);
    setStatus("Soru seçimi kaydedildi ve sınava aktarıldı.");
  };

  if (!exam) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-bold text-slate-600">{status}</div>;
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-6xl">
    <header className="mb-5 rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><BookOpen className="h-7 w-7 text-indigo-600"/><div><h1 className="text-xl font-black text-slate-900">{exam.examName}</h1><p className="text-sm font-bold text-indigo-700">{subject} · Yönetici tarafından belirlenen soru havuzu</p><p className="mt-1 text-xs font-semibold text-slate-500">Toplam {requiredTotal} soru seçilecektir. Bu ekran yalnız tanımlanan ünite, konu ve kazanımlara ait veri tabanı sorularını gösterir.</p></div></div></header>
    {busy && <div className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-slate-500">Sorular yükleniyor...</div>}
    {!busy && plan.map((row:any)=><section key={row.id} className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-black text-slate-900">{row.unitName} / {row.topicName}</h2><p className="mt-1 text-xs font-bold text-indigo-700">{row.outcomeName}</p></div><span className={`rounded-xl px-3 py-2 text-xs font-black ${selectedForPlan(row.id)===Number(row.count)?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-800"}`}>{selectedForPlan(row.id)} / {row.count} soru</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{bankQuestions.filter(q=>q.planId===row.id).map((q:any,index:number)=>{const key=`${q.planId}::${q._key}`;const active=selected.has(key);return <button type="button" key={key} onClick={()=>toggle(q)} className={`rounded-2xl border p-3 text-left ${active?"border-indigo-500 bg-indigo-50":"border-slate-200 bg-white"}`}><div className="mb-2 flex items-center justify-between"><b className="text-xs text-slate-800">Soru {index+1}</b>{active&&<CheckCircle2 className="h-4 w-4 text-indigo-600"/>}</div>{(q.imageUrl||q.imageDataUrl||q.thumbnailUrl)&&<img src={q.imageUrl||q.imageDataUrl||q.thumbnailUrl} className="h-44 w-full rounded-xl border border-slate-100 object-contain"/>}<div className="mt-2 text-[10px] font-black text-rose-700">Cevap: {getQuestionCorrectAnswer(q,true)||"-"}</div></button>})}</div>{bankQuestions.filter(q=>q.planId===row.id).length===0&&<div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">Bu kazanım için veri tabanında aktif soru bulunamadı.</div>}</section>)}
    <button onClick={save} disabled={busy||requiredTotal===0} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-40"><Save className="h-5 w-5"/>Seçilen Soruları Kaydet</button>
    {status&&<div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>{status}</div>}
  </div></main>;
}
