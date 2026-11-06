import React from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronRight,
  Clock3,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";
import type {TeacherCohortDecision} from "../../intelligence/teacher";

export function TeacherDecisionDashboard({
  data,
  onStudentSelect,
}:{
  data:TeacherCohortDecision;
  onStudentSelect?:(studentNumber:string|number|undefined)=>void;
}){
  return <section className="space-y-4">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-blue-700 p-5 text-white shadow-lg">
      <span className="text-[10px] font-black uppercase tracking-[.15em] text-white/70">e-Nstitü Öğretmen Karar Merkezi</span>
      <h2 className="mt-2 text-xl font-black">Öğrenci müdahale ve takip görünümü</h2>
      <p className="mt-2 max-w-3xl text-xs leading-6 text-white/85">
        {data.totalStudents} öğrenci değerlendirildi. {data.urgentStudents.length} acil,
        {" "}{data.supportStudents.length} destek ve {data.monitorStudents.length} izleme grubunda.
      </p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Toplam Öğrenci",data.totalStudents,Users,"text-slate-700 bg-slate-100"],
        ["Acil Müdahale",data.urgentStudents.length,AlertTriangle,"text-rose-700 bg-rose-50"],
        ["Destek Grubu",data.supportStudents.length,BookOpenCheck,"text-amber-700 bg-amber-50"],
        ["İzleme Grubu",data.monitorStudents.length,ShieldCheck,"text-emerald-700 bg-emerald-50"],
      ].map(([label,value,Icon,tone]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5"/></div>
        <span className="mt-3 block text-[10px] font-bold text-slate-400">{label}</span>
        <strong className="mt-1 block text-2xl font-black text-slate-900">{value}</strong>
      </div>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><span className="text-[9px] font-black uppercase tracking-[.13em] text-rose-600">Öncelikli Liste</span><h3 className="mt-1 text-sm font-black text-slate-900">Acil Müdahale Gereken Öğrenciler</h3></div>
          <AlertTriangle className="h-5 w-5 text-rose-600"/>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {data.urgentStudents.length?data.urgentStudents.slice(0,12).map(student=><button
            key={`${student.studentNumber}-${student.studentName}`}
            type="button"
            onClick={()=>onStudentSelect?.(student.studentNumber)}
            className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-xs font-black text-rose-700">{student.score}</div>
            <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{student.studentName}</strong><span className="mt-1 block truncate text-[10px] text-slate-400">{student.classroom||"Sınıf yok"} · {student.primaryRisk?.title||student.headline}</span></div>
            <span className="rounded-full bg-rose-50 px-2 py-1 text-[9px] font-black text-rose-700">{student.nextReviewDays} gün</span>
            <ChevronRight className="h-4 w-4 text-slate-300"/>
          </button>):<p className="py-8 text-center text-xs text-slate-400">Acil müdahale grubunda öğrenci yok.</p>}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><span className="text-[9px] font-black uppercase tracking-[.13em] text-amber-600">Planlı Destek</span><h3 className="mt-1 text-sm font-black text-slate-900">Destek Grubundaki Öğrenciler</h3></div>
          <BookOpenCheck className="h-5 w-5 text-amber-600"/>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {data.supportStudents.length?data.supportStudents.slice(0,12).map(student=><button
            key={`${student.studentNumber}-${student.studentName}`}
            type="button"
            onClick={()=>onStudentSelect?.(student.studentNumber)}
            className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-xs font-black text-amber-700">{student.score}</div>
            <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{student.studentName}</strong><span className="mt-1 block truncate text-[10px] text-slate-400">{student.classroom||"Sınıf yok"} · {student.primaryPriority?.subject||student.headline}</span></div>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">{student.nextReviewDays} gün</span>
            <ChevronRight className="h-4 w-4 text-slate-300"/>
          </button>):<p className="py-8 text-center text-xs text-slate-400">Destek grubunda öğrenci yok.</p>}
        </div>
      </div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><span className="text-[9px] font-black uppercase tracking-[.13em] text-blue-600">Ortak Müdahale Alanları</span><h3 className="mt-1 text-sm font-black text-slate-900">Ders Bazlı Öğrenci Yoğunluğu</h3></div>
        <GraduationCap className="h-5 w-5 text-blue-600"/>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.subjectHotspots.length?data.subjectHotspots.map(item=><div key={item.subject} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3"><div><strong className="text-xs text-slate-900">{item.subject}</strong><span className="mt-1 block text-[10px] text-slate-400">{item.studentCount} öğrenci için öncelikli</span></div><span className="rounded-full bg-blue-100 px-2 py-1 text-[9px] font-black text-blue-700">%{item.averageSuccessRate}</span></div>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-500"><Clock3 className="h-4 w-4 text-blue-600"/>Öğrenci başına {item.suggestedWeeklyMinutes} dk/hafta</div>
        </div>):<p className="text-xs text-slate-400">Ortak ders önceliği bulunamadı.</p>}
      </div>
    </div>
  </section>;
}
