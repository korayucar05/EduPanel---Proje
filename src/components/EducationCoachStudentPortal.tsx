import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  GraduationCap,
  HeartHandshake,
  Loader2,
  MessageCircle,
  PlayCircle,
  Send,
  Target,
  Trophy,
} from "lucide-react";
import {
  type CoachMessage,
  type CoachProfile,
  type CoachTask,
  buildStudentAcademicSnapshot,
  loadCoachProfileByToken,
  makeCoachId,
  readCoachExams,
  saveCoachProfile,
} from "./education-coach/coachStore";
import { setActiveSchoolScope } from "../core/tenant";

const tokenFromLocation = () => {
  const match = window.location.pathname.match(/^\/koc\/([^/]+)\/?$/i);
  return decodeURIComponent(match?.[1] || new URLSearchParams(window.location.search).get("token") || "");
};

const humanDate = (value?: string) => {
  if (!value) return "—";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(ms));
};

const completionRate = (profile?: CoachProfile) => {
  const tasks = profile?.tasks || [];
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.status === "completed").length / tasks.length) * 100);
};

export default function EducationCoachStudentPortal() {
  const token = useMemo(tokenFromLocation, []);
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failureTaskId, setFailureTaskId] = useState("");
  const [failureReason, setFailureReason] = useState("");

  const load = async () => {
    setLoading(true);
    const [savedProfile, savedExams] = await Promise.all([loadCoachProfileByToken(token), readCoachExams()]);
    setProfile(savedProfile);
    setExams(savedExams);
    setLoading(false);
  };

  useEffect(() => {
    const schoolId = new URLSearchParams(window.location.search).get("school") || "school-main";
    setActiveSchoolScope(schoolId);
    void load();
  }, [token]);

  const snapshot = useMemo(
    () => buildStudentAcademicSnapshot(exams, profile?.studentNumber || ""),
    [exams, profile?.studentNumber],
  );

  const persist = async (next: CoachProfile) => {
    setSaving(true);
    try {
      const saved = await saveCoachProfile(next);
      setProfile(saved);
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (task: CoachTask, status: CoachTask["status"], reason = "") => {
    if (!profile) return;
    await persist({
      ...profile,
      tasks: profile.tasks.map((item) => item.id === task.id
        ? { ...item, status, failureReason: reason, updatedAt: new Date().toISOString() }
        : item),
    });
    setFailureTaskId("");
    setFailureReason("");
  };

  const sendMessage = async (text = message, category: CoachMessage["category"] = "general") => {
    if (!profile || !text.trim()) return;
    const item: CoachMessage = {
      id: makeCoachId("student-msg"),
      direction: "student-to-coach",
      text: text.trim(),
      category,
      createdAt: new Date().toISOString(),
    };
    await persist({ ...profile, messages: [...profile.messages, item] });
    setMessage("");
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-amber-500"/><div className="mt-3 text-sm font-bold text-slate-500">Koçluk dosyanız açılıyor...</div></div></main>;

  if (!profile) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><div className="max-w-md rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-sm"><AlertCircle className="mx-auto h-10 w-10 text-rose-500"/><h1 className="mt-3 text-xl font-black text-slate-900">Bağlantı geçersiz</h1><p className="mt-2 text-sm text-slate-500">Eğitim koçunuzdan yeni öğrenci bağlantısı isteyin.</p></div></main>;

  const openTasks = profile.tasks.filter((task) => task.status !== "completed");
  const recentCoachMessage = [...profile.messages].reverse().find((item) => item.direction === "coach-to-student");
  const rate = completionRate(profile);

  return <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50 pb-24 text-slate-800">
    <div className="mx-auto max-w-xl">
      <header className="rounded-b-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 px-5 pb-7 pt-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300"><HeartHandshake className="h-4 w-4"/> e-Nstitü Eğitim Koçu</div>
        <div className="mt-5 flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">{profile.studentName}</h1><div className="mt-1 text-xs font-bold text-slate-400">{profile.classroom} • No {profile.studentNumber}</div></div><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-xl font-black text-white">{profile.studentName.split(" ").slice(0,2).map((part)=>part[0]).join("")}</div></div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between text-xs font-black"><span>Haftalık çalışma düzenim</span><span className="text-amber-300">%{rate}</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400" style={{width:`${rate}%`}}/></div></div>
      </header>

      <div className="space-y-4 px-4 pt-5">
        {recentCoachMessage ? <section className="rounded-3xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-blue-600"><MessageCircle className="h-4 w-4"/> Koçumdan Mesaj</div><div className="mt-2 text-sm font-semibold leading-6 text-slate-700">{recentCoachMessage.text}</div></section> : null}

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm"><GraduationCap className="h-5 w-5 text-emerald-600"/><div className="mt-3 text-[10px] font-black uppercase text-slate-400">Akademik Başarı</div><div className="mt-1 text-3xl font-black text-emerald-700">%{snapshot.overallSuccess}</div></div>
          <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm"><Target className="h-5 w-5 text-amber-600"/><div className="mt-3 text-[10px] font-black uppercase text-slate-400">Açık Görev</div><div className="mt-1 text-3xl font-black text-amber-700">{openTasks.length}</div></div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase text-slate-400">Hedefim</div><div className="mt-1 text-base font-black text-slate-900">{profile.targetExam || profile.targetDepartment || "Hedefimi koçumla belirleyeceğim"}</div></div><Trophy className="h-6 w-6 text-amber-500"/></div>
          {profile.shortTermGoal ? <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Bu dönem: {profile.shortTermGoal}</div> : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1"><h2 className="text-lg font-black text-slate-900">Görevlerim</h2><span className="text-xs font-bold text-slate-400">{openTasks.length} açık</span></div>
          {openTasks.length ? openTasks.map((task) => <div key={task.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-black text-slate-900">{task.title}</div><div className="mt-1 text-xs font-bold text-slate-400">{task.subject}{task.topic?` • ${task.topic}`:""}{task.questionCount?` • ${task.questionCount} soru`:""}</div></div><div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{humanDate(task.dueDate||task.plannedDate)}</div></div>{task.outcome?<div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">{task.outcome}</div>:null}<div className="mt-4 flex gap-2"><button onClick={()=>void updateTask(task,"started")} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black ${task.status==="started"?"border-blue-500 bg-blue-500 text-white":"border-blue-200 bg-blue-50 text-blue-700"}`}><PlayCircle className="mr-1 inline h-4 w-4"/> Başladım</button><button onClick={()=>void updateTask(task,"completed")} className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"><CheckCircle2 className="mr-1 inline h-4 w-4"/> Tamamladım</button><button onClick={()=>setFailureTaskId(task.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">Yapamadım</button></div>{failureTaskId===task.id?<div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 p-3"><div className="text-xs font-black text-rose-700">Neden tamamlayamadın?</div><select value={failureReason} onChange={(e)=>setFailureReason(e.target.value)} className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm"><option value="">Seçiniz</option><option>Zamanım yetmedi</option><option>Konuyu anlamadım</option><option>Materyale ulaşamadım</option><option>Unuttum</option><option>Başka bir engel oluştu</option></select><button disabled={!failureReason} onClick={()=>void updateTask(task,"could-not",failureReason)} className="mt-2 w-full rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Koçuma Bildir</button></div>:null}</div>) : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500"/><div className="mt-2 font-black text-slate-700">Açık görevin yok</div><div className="mt-1 text-xs text-slate-400">Planındaki tüm görevler tamamlanmış görünüyor.</div></div>}
        </section>

        {snapshot.priorityOutcomes.length ? <section className="rounded-3xl border border-amber-100 bg-amber-50 p-4"><div className="text-xs font-black uppercase text-amber-700">Bu hafta önceliğim</div><div className="mt-2 font-black text-slate-900">{snapshot.priorityOutcomes[0].subject} • {snapshot.priorityOutcomes[0].topic}</div><div className="mt-1 text-sm font-semibold text-slate-600">{snapshot.priorityOutcomes[0].outcome}</div></section> : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 font-black text-slate-900"><MessageCircle className="h-5 w-5 text-blue-500"/> Koçuma Yaz</div><div className="mt-3 grid grid-cols-3 gap-2">{[["Bu konuyu anlamadım","help"],["Görevi tamamlayamadım","task"],["Görüşmek istiyorum","help"]].map(([text,category])=><button key={text} onClick={()=>void sendMessage(text,category as CoachMessage["category"])} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-[10px] font-black text-slate-600">{text}</button>)}</div><div className="mt-3 flex gap-2"><input value={message} onChange={(e)=>setMessage(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")void sendMessage();}} placeholder="Mesajını yaz..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><button onClick={()=>void sendMessage()} className="rounded-xl bg-blue-600 px-4 text-white"><Send className="h-4 w-4"/></button></div></section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4"/> Sonraki koç görüşmesi: <b className="text-slate-700">{humanDate(profile.nextMeetingDate)}</b></div></section>
      </div>
    </div>
    {saving ? <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-xl"><Loader2 className="h-4 w-4 animate-spin"/> Güncelleniyor</div> : null}
  </main>;
}
