import React from "react";
import { BookOpen, Mic, MicOff, RotateCcw, Sparkles, Trash2, Users } from "lucide-react";
import type { Classroom, Teacher } from "../../types";

interface Props {
  viewType:"class"|"teacher"; selectedId:string; classrooms:Classroom[]; teachers:Teacher[];
  incompleteClassIds:ReadonlySet<string>; incompleteTeacherIds:ReadonlySet<string>;
  onViewTypeChange:(v:"class"|"teacher")=>void; onSelectedIdChange:(id:string)=>void;
  solverRunning:boolean; onRunGlobal:()=>void; onOpenGlobalCancel:()=>void;
  onRunClassDistribution:()=>void; onOpenClassCancel:()=>void;
  onRunTeacherDistribution:()=>void; onOpenTeacherCancel:()=>void;
  voiceListening:boolean; voiceFeedback:string; voiceTranscript:string; voiceSupported:boolean;
  onStartVoice:()=>void; onStopVoice:()=>void;
}
const normalizeFieldLabel = (value: unknown): "SAY" | "EA" | "SÖZ" | "DİL" | "" => {
 const text = String(value || "").trim().toLocaleUpperCase("tr-TR");
 if (!text || text === "ORTAK" || text === "GENEL") return "";
 if (text === "SAY" || text.includes("SAYISAL")) return "SAY";
 if (text === "EA" || text.includes("EŞİT AĞIRLIK") || text.includes("ESIT AGIRLIK")) return "EA";
 if (text === "SÖZ" || text === "SOZ" || text.includes("SÖZEL") || text.includes("SOZEL")) return "SÖZ";
 if (text === "DİL" || text === "DIL" || text.includes("YABANCI DİL") || text.includes("YABANCI DIL")) return "DİL";
 const match = text.match(/(?:^|[\s(\-])(?:SAY|EA|SÖZ|SOZ|DİL|DIL)(?:$|[\s)\-])/);
 if (!match) return "";
 const token = match[0].replace(/[\s()\-]/g, "");
 return token === "SOZ" ? "SÖZ" : token === "DIL" ? "DİL" : token as "SAY" | "EA" | "SÖZ" | "DİL";
};

const getClassDisplayName = (classroom: any) => {
 const baseName = String(classroom?.name || "").replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "").trim();
 const fields = new Set<"SAY" | "EA" | "SÖZ" | "DİL">();
 const addField = (value: unknown) => { const field = normalizeFieldLabel(value); if (field) fields.add(field); };

 (classroom?.assignedCourses || []).forEach((course: any) => {
   addField(course?.groupName);
   addField(course?.targetGroup);
   (course?.targetGroups || []).forEach(addField);
   const courseSuffix = String(course?.courseName || course?.name || "").match(/\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i);
   if (courseSuffix) addField(courseSuffix[1]);
 });

 if (fields.size === 0) {
   (classroom?.groups || []).forEach(addField);
   addField(classroom?.group1Name);
   addField(classroom?.group2Name);
 }

 return fields.size ? `${baseName} (${Array.from(fields).join("/")})` : String(classroom?.name || "");
};

function AssignedCoursesPanel(p:Props){
 const list:any[]=p.viewType==="class"?p.classrooms:p.teachers;
 const incomplete=p.viewType==="class"?p.incompleteClassIds:p.incompleteTeacherIds;
 const selectedDisabled=p.solverRunning||!p.selectedId;
 return <aside className="w-full rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,.10)]">
  <div className="grid grid-cols-2 gap-2">
   <button onClick={()=>{p.onViewTypeChange("class");p.onSelectedIdChange("")}} className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-black ${p.viewType==="class"?"bg-rose-500 text-white shadow-md":"bg-rose-50 text-rose-700"}`}><BookOpen className="h-4 w-4"/>Sınıf Planı</button>
   <button onClick={()=>{p.onViewTypeChange("teacher");p.onSelectedIdChange("")}} className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-black ${p.viewType==="teacher"?"bg-indigo-600 text-white shadow-md":"bg-indigo-50 text-indigo-700"}`}><Users className="h-4 w-4"/>Öğretmen Planı</button>
  </div>
  <select value={p.selectedId} onChange={e=>p.onSelectedIdChange(e.target.value)} className={`mt-2 h-11 w-full rounded-xl border px-3 text-[11px] font-bold text-slate-700 outline-none ${incomplete.has(p.selectedId)?"border-slate-300 bg-slate-200":"border-slate-200 bg-slate-100"}`}><option value="">{p.viewType==="class"?"-- Sınıf Seç --":"-- Öğretmen Seç --"}</option>{list.map(x=><option key={x.id} value={x.id}>{p.viewType === "class" ? getClassDisplayName(x) : x.name}</option>)}</select>
  <div className="mt-2 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 p-2.5">
   <div className="mb-2 flex items-center justify-between gap-2"><span className="rounded-md bg-amber-300 px-2 py-1 text-[9px] font-black text-amber-950">HIZLI SES MODU</span><span className="text-right text-[7.5px] font-bold text-cyan-900">Günü 1 kez söyle · sonra saat + ders</span></div>
   <button disabled={!p.voiceListening&&!p.selectedId} onClick={p.voiceListening?p.onStopVoice:p.onStartVoice} className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[11px] font-black text-white shadow-sm disabled:opacity-40 ${p.voiceListening?"bg-rose-600":"bg-cyan-700"}`}>{p.voiceListening?<MicOff className="h-4 w-4"/>:<Mic className="h-4 w-4"/>}{p.voiceListening?"Sesli Yerleştirmeyi Kapat":"Sesli Yerleştirmeyi Aç"}</button>
   <div className="mt-2 text-[8.5px] font-bold leading-4 text-cyan-950">{p.voiceFeedback}</div>{p.voiceTranscript&&<div className="mt-1 rounded-md bg-white/80 px-2 py-1 text-[8px] text-slate-500">Algılanan: “{p.voiceTranscript}”</div>}
   <div className="mt-1 rounded-md border border-cyan-100 bg-white/75 px-2 py-1.5 text-[7.5px] font-semibold leading-3.5 text-cyan-950">Örnek: “Pazartesi 3 Matematik 4 Fizik 5 Kimya” · Sonra: “6 Almanca”, “7 Biyoloji”</div>
   {!p.voiceSupported&&<div className="mt-1 text-[8px] text-amber-700">Ses tanıma için Chrome veya Edge kullanın.</div>}
  </div>
  <div className="my-4 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"/>
  <div className="space-y-2">
   <button disabled={p.solverRunning} onClick={p.onRunGlobal} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-[11px] font-black text-white shadow-md disabled:opacity-50"><Sparkles className="h-4 w-4"/>{p.solverRunning?"Dağıtım Yapılıyor...":"Genel Dağıtım Yap"}</button>
   <button disabled={p.solverRunning} onClick={p.onOpenGlobalCancel} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-[10px] font-black text-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4"/>Genel Dağıtımı İptal Et</button>
  </div>
  <div className="my-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"/>
  <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
   <div className="text-[8px] font-black uppercase tracking-[.14em] text-slate-400">{p.viewType==="class"?"Seçili Sınıf İşlemleri":"Seçili Öğretmen İşlemleri"}</div>
   {p.viewType==="class"?<><button disabled={selectedDisabled} onClick={p.onRunClassDistribution} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 text-[11px] font-black text-white disabled:bg-violet-300"><Sparkles className="h-4 w-4"/>Sınıf Dağıtımı</button><button disabled={selectedDisabled} onClick={p.onOpenClassCancel} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white text-[10px] font-black text-violet-700 disabled:opacity-40"><RotateCcw className="h-4 w-4"/>Sınıf Dağıtımını İptal Et</button></>:<><button disabled={selectedDisabled} onClick={p.onRunTeacherDistribution} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[11px] font-black text-white disabled:bg-blue-300"><Sparkles className="h-4 w-4"/>Öğretmen Dağıtımını Yap</button><button disabled={selectedDisabled} onClick={p.onOpenTeacherCancel} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white text-[10px] font-black text-blue-700 disabled:opacity-40"><RotateCcw className="h-4 w-4"/>Öğretmen Dağıtımını İptal Et</button></>}
  </div>
 </aside>
}
export default React.memo(AssignedCoursesPanel);
