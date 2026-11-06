import React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  ChevronRight,
  Heart,
  Loader2,
  PlusCircle,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

type BehaviorMode = "positive" | "negative";
type ScopeMode = "student" | "classroom";
type StudentRow = { id:string; name:string; number:string; classroom:string };
type BehaviorRecord = {
  id:string;
  studentId:string;
  studentName:string;
  studentNumber:string;
  classroom:string;
  behaviorType:string;
  behaviorName:string;
  description?:string;
  teacherName?:string;
  date:string;
  createdAt?:string|number;
};
type BehaviorItem = { id:string; type:string; name:string };
type DashboardPayload = { students:StudentRow[]; records:BehaviorRecord[] };
type ReminderItem = {
  id:string;
  studentId:string;
  studentName:string;
  classroom:string;
  behaviorName:string;
  destination:"Uyarı Bildirimi"|"Ön İnceleme"|string;
  routedAt?:string;
};
type ReminderPayload = {
  count:number;
  warningCount:number;
  preInspectionCount:number;
  items:ReminderItem[];
};

const norm=(v:unknown)=>String(v??"").toLocaleLowerCase("tr-TR").replace(/\s+/g," ").trim();
const clsLabel=(v:string)=>String(v||"").trim().toLocaleUpperCase("tr-TR").replace(/^(\d+)[\s\-/.]*([A-ZÇĞİÖŞÜ])$/,"$1/$2");
const dayKey=(v:string|number|undefined)=>{
  if(v===undefined||v===null||v==="")return "";
  if(typeof v==="number"){const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10);}
  const s=String(v);const m=s.match(/^(\d{4}-\d{2}-\d{2})/);if(m)return m[1];
  const d=new Date(s);return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10);
};
const fmtDate=(v:string|number|undefined)=>{
  if(v===undefined||v===null||v==="")return "Tarih yok";
  const s=String(v);const d=typeof v==="number"?new Date(v):new Date(s.length<=10?`${s}T12:00:00`:s);
  return Number.isNaN(d.getTime())?s:new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
};
const cardTone=(mode:BehaviorMode,count:number)=>{
  if(mode==="negative"){if(count===1)return "border-yellow-300 bg-yellow-100 text-yellow-950";if(count===2)return "border-orange-300 bg-orange-200 text-orange-950";return "border-red-400 bg-red-500 text-white";}
  if(count===1)return "border-yellow-300 bg-yellow-100 text-yellow-950";if(count===2)return "border-emerald-200 bg-emerald-100 text-emerald-950";return "border-green-500 bg-green-600 text-white";
};
const badgeTone=(mode:BehaviorMode,count:number)=>{
  if(mode==="negative"){if(count===1)return "bg-yellow-300 text-yellow-950";if(count===2)return "bg-orange-400 text-white";return "bg-red-700 text-white";}
  if(count===1)return "bg-yellow-300 text-yellow-950";if(count===2)return "bg-emerald-300 text-emerald-950";return "bg-green-800 text-white";
};

function BehaviorSlide({
  mode,
  students,
  records,
  token,
  behaviorOptions,
  recorderName,
  onRecordsCreated,
}:{
  mode:BehaviorMode;
  students:StudentRow[];
  records:BehaviorRecord[];
  token:string;
  behaviorOptions:BehaviorItem[];
  recorderName:string;
  onRecordsCreated:(records:BehaviorRecord[])=>void;
}){
  const [scope,setScope]=React.useState<ScopeMode>("student");
  const [query,setQuery]=React.useState("");
  const [selectedStudentId,setSelectedStudentId]=React.useState("");
  const [selectedClassroom,setSelectedClassroom]=React.useState("");
  const [selectedBehaviorId,setSelectedBehaviorId]=React.useState("");
  const [studentNumberQuery,setStudentNumberQuery]=React.useState("");
  const [pendingStudents,setPendingStudents]=React.useState<StudentRow[]>([]);
  const [recordSaving,setRecordSaving]=React.useState(false);
  const [recordMessage,setRecordMessage]=React.useState("");
  const label=mode==="positive"?"Olumlu":"Olumsuz";

  const availableBehaviors=React.useMemo(()=>behaviorOptions.filter(item=>norm(item.type)===norm(label)),[behaviorOptions,label]);
  const selectedBehavior=availableBehaviors.find(item=>String(item.id)===selectedBehaviorId)||null;

  React.useEffect(()=>{
    if(selectedBehaviorId&&!availableBehaviors.some(item=>String(item.id)===selectedBehaviorId)){
      setSelectedBehaviorId("");
      setPendingStudents([]);
      setStudentNumberQuery("");
    }
  },[availableBehaviors,selectedBehaviorId]);

  const studentNumberMatch=React.useMemo(()=>{
    const wanted=String(studentNumberQuery||"").trim();
    if(!wanted)return null;
    return students.find(student=>String(student.number||"").trim()===wanted)||null;
  },[students,studentNumberQuery]);

  const addStudentToList=()=>{
    if(!studentNumberMatch)return;
    setPendingStudents(current=>current.some(item=>item.id===studentNumberMatch.id)?current:[...current,studentNumberMatch]);
    setStudentNumberQuery("");
    setRecordMessage("");
  };

  const saveSelectedBehavior=async()=>{
    if(!selectedBehavior||pendingStudents.length===0||recordSaving)return;
    setRecordSaving(true);
    setRecordMessage("");
    const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const now=Date.now();
    const newRecords:BehaviorRecord[]=pendingStudents.map((student,index)=>({
      id:`admin-mobile-${now}-${index}-${crypto.randomUUID()}`,
      studentId:student.id,
      studentName:student.name,
      studentNumber:student.number,
      classroom:student.classroom,
      behaviorType:selectedBehavior.type,
      behaviorName:selectedBehavior.name,
      description:"Yönetici mobil uygulaması üzerinden kaydedildi.",
      teacherName:recorderName||"Yönetici",
      date,
      createdAt:now+index,
    }));
    try{
      const response=await fetch(`/api/behavior/teacher-links/${encodeURIComponent(token)}/submissions`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({records:newRecords.map(record=>({
          ...record,
          studentClassroom:record.classroom,
          studentsList:[],
        }))}),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result?.error||"Davranış kaydı yapılamadı.");
      onRecordsCreated(newRecords);
      setRecordMessage(`${pendingStudents.length} öğrenci listeye göre kaydedildi.`);
      setPendingStudents([]);
      setStudentNumberQuery("");
    }catch(error:any){
      setRecordMessage(error?.message||"Davranış kaydı yapılamadı.");
    }finally{
      setRecordSaving(false);
    }
  };

  const filteredRecords=React.useMemo(()=>records.filter(r=>
    norm(r.behaviorType)===norm(label)
  ),[records,label]);

  const byStudent=React.useMemo(()=>{
    const m=new Map<string,BehaviorRecord[]>();
    for(const r of filteredRecords){if(!r.studentId)continue;const a=m.get(r.studentId)||[];a.push(r);m.set(r.studentId,a);}
    for(const a of m.values())a.sort((x,y)=>String(y.date||y.createdAt||"").localeCompare(String(x.date||x.createdAt||"")));
    return m;
  },[filteredRecords]);

  const rankedStudents=React.useMemo(()=>{
    const q=norm(query);
    return students
      .filter(s=>!q||norm(`${s.number} ${s.name}`).includes(q))
      .map(s=>({...s,count:(byStudent.get(s.id)||[]).length}))
      .filter(s=>q?true:s.count>0)
      .sort((a,b)=>q
        ? String(a.number||"").localeCompare(String(b.number||""),"tr-TR",{numeric:true})||a.name.localeCompare(b.name,"tr-TR")
        : b.count-a.count||a.name.localeCompare(b.name,"tr-TR"));
  },[students,byStudent,query]);

  const rankedClasses=React.useMemo(()=>{
    const counts=new Map<string,number>();
    for(const student of students){
      const classroom=String(student.classroom||"").trim();
      if(classroom&&!counts.has(classroom))counts.set(classroom,0);
    }
    for(const r of filteredRecords){
      const classroom=String(r.classroom||"").trim();
      if(!classroom)continue;
      counts.set(classroom,(counts.get(classroom)||0)+1);
    }
    return Array.from(counts.entries()).map(([classroom,count])=>({classroom,count}))
      .sort((a,b)=>a.classroom.localeCompare(b.classroom,"tr-TR",{numeric:true}));
  },[students,filteredRecords]);

  const classStudents=React.useMemo(()=>!selectedClassroom?[]:students
    .filter(s=>norm(s.classroom)===norm(selectedClassroom))
    .map(s=>({...s,count:(byStudent.get(s.id)||[]).length}))
    .filter(s=>s.count>0)
    .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"tr-TR")),
  [students,selectedClassroom,byStudent]);

  const renderStudent = (student:StudentRow&{count:number}) => {
    const studentRecords=byStudent.get(student.id)||[];
    const isOpen=selectedStudentId===student.id;
    const latestBehavior=studentRecords[0]?.behaviorName||`${label} davranış`;

    return <div key={student.id} className="overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={()=>setSelectedStudentId(v=>v===student.id?"":student.id)}
        className={`w-full rounded-2xl border p-3 text-left shadow-sm ${cardTone(mode,student.count)}`}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black">{student.name||"İsimsiz Öğrenci"}</div>
            <div className="mt-0.5 truncate text-[11px] font-black opacity-90">
              {latestBehavior}{studentRecords.length>1?` · +${studentRecords.length-1} kayıt`:""}
            </div>
            <div className="mt-0.5 text-[10px] font-bold opacity-70">{clsLabel(student.classroom)} · No {student.number||"-"}</div>
          </div>
          <span className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-xs font-black ${badgeTone(mode,student.count)}`}>{student.count}</span>
          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isOpen?"rotate-90":""}`}/>
        </div>
      </button>

      {isOpen?<div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm">
        <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">Davranış Kayıtları</div>
        <div className="space-y-2">
          {studentRecords.length===0?<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] font-bold text-slate-500">Bu öğrenci için {label.toLocaleLowerCase("tr-TR")} davranış kaydı bulunmuyor.</div>:null}
          {studentRecords.map(r=><article key={r.id} className={`rounded-xl border p-3 ${mode==="positive"?"border-green-100 bg-green-50":"border-red-100 bg-red-50"}`}>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-xs">{r.behaviorName||`${label} davranış`}</strong>
              <span className="shrink-0 text-[9px] font-black text-slate-500">{fmtDate(r.date||r.createdAt)}</span>
            </div>
            {r.description?<p className="mt-1 text-[11px] font-medium text-slate-600">{r.description}</p>:null}
            {r.teacherName?<div className="mt-1 text-[9px] font-bold text-slate-400">Kaydeden: {r.teacherName}</div>:null}
          </article>)}
        </div>
      </div>:null}
    </div>;
  };

  return <section className="w-full shrink-0 snap-center px-4 pb-8">
    <div className={`rounded-3xl border p-4 shadow-sm ${mode==="positive"?"border-green-200 bg-gradient-to-b from-green-50 to-white":"border-red-200 bg-gradient-to-b from-red-50 to-white"}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${mode==="positive"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>
          {mode==="positive"?<Heart className="h-5 w-5"/>:<ShieldAlert className="h-5 w-5"/>}
        </div>
        <h2 className="text-lg font-black text-slate-950">{label} Davranışlar</h2>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Davranış Çeşidi</label>
        <select
          value={selectedBehaviorId}
          onChange={event=>{setSelectedBehaviorId(event.target.value);setPendingStudents([]);setStudentNumberQuery("");setRecordMessage("");}}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-800 outline-none focus:border-orange-400"
        >
          <option value="">Davranış seçiniz…</option>
          {availableBehaviors.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {availableBehaviors.length===0?<div className="mt-2 text-[10px] font-bold text-slate-400">Bu tür için kayıtlı davranış çeşidi bulunamadı.</div>:null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
        <button type="button" onClick={()=>{setScope("student");setSelectedClassroom("")}} className={`rounded-xl px-3 py-2.5 text-xs font-black ${scope==="student"?(mode==="positive"?"bg-green-600 text-white":"bg-red-600 text-white"):"bg-slate-100 text-slate-600"}`}>Öğrenci Bazlı</button>
        <button type="button" onClick={()=>setScope("classroom")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${scope==="classroom"?(mode==="positive"?"bg-green-600 text-white":"bg-red-600 text-white"):"bg-slate-100 text-slate-600"}`}>Sınıf Bazlı</button>
      </div>

      {scope==="student"?<>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Öğrenci Numarası</label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              <input
                inputMode="numeric"
                value={studentNumberQuery}
                onChange={event=>{setStudentNumberQuery(event.target.value.replace(/\D/g,""));setRecordMessage("");}}
                onKeyDown={event=>{if(event.key==="Enter"&&studentNumberMatch){event.preventDefault();addStudentToList();}}}
                placeholder="Öğrenci numarası"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-black outline-none focus:border-orange-400"
              />
            </div>
            <button
              type="button"
              disabled={!studentNumberMatch||pendingStudents.some(item=>item.id===studentNumberMatch.id)}
              onClick={addStudentToList}
              className={`shrink-0 rounded-xl px-3 py-3 text-[10px] font-black text-white ${mode==="positive"?"bg-green-600":"bg-red-600"} disabled:bg-slate-300`}
            >
              Listeye Ekle
            </button>
          </div>
          {studentNumberQuery.trim()&&!studentNumberMatch?<div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-600">Bu numarada öğrenci bulunamadı.</div>:null}
          {studentNumberMatch?<div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-700"><strong>{studentNumberMatch.number}</strong> · {studentNumberMatch.name} · {clsLabel(studentNumberMatch.classroom)}</div>:null}
        </div>

        {pendingStudents.length>0?<div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2"><strong className="text-[10px] text-slate-700">Listeye Eklenen Öğrenciler ({pendingStudents.length})</strong><button type="button" onClick={()=>setPendingStudents([])} className="text-[9px] font-black text-rose-600">Temizle</button></div>
          <div className="divide-y divide-slate-100">
            {pendingStudents.map(student=><div key={student.id} className="flex items-center gap-2 px-3 py-2.5">
              <span className={`flex h-8 min-w-10 items-center justify-center rounded-lg px-2 text-[10px] font-black ${mode==="positive"?"bg-green-100 text-green-800":"bg-red-100 text-red-800"}`}>{student.number||"—"}</span>
              <div className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-slate-900">{student.name}</strong><span className="text-[9px] font-bold text-slate-400">{clsLabel(student.classroom)}</span></div>
              <button type="button" onClick={()=>setPendingStudents(current=>current.filter(item=>item.id!==student.id))} className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black text-rose-600">Çıkar</button>
            </div>)}
          </div>
        </div>:null}

        <button
          type="button"
          disabled={recordSaving||!selectedBehavior||pendingStudents.length===0}
          onClick={()=>void saveSelectedBehavior()}
          className={`mt-3 w-full rounded-xl px-4 py-3 text-xs font-black text-white ${mode==="positive"?"bg-green-700":"bg-red-700"} disabled:bg-slate-300`}
        >
          {recordSaving?"Kaydediliyor…":pendingStudents.length?`${pendingStudents.length} Öğrenciyi Kaydet`:"Öğrenci Listeye Ekleyin"}
        </button>
        {recordMessage?<div className={`mt-2 rounded-xl px-3 py-2 text-center text-[10px] font-bold ${recordMessage.includes("kaydedildi")?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>{recordMessage}</div>:null}

        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">Mevcut Davranış Kayıtları</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Kayıtlarda öğrenci numarası veya adı ara" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold outline-none"/>
          </div>
          <div className="mt-3 space-y-2">{rankedStudents.map(renderStudent)}</div>
        </div>
      </>:!selectedClassroom?
        <div className="mt-4 space-y-2">{rankedClasses.map((x,i)=><button key={x.classroom} type="button" onClick={()=>{setSelectedClassroom(x.classroom);setSelectedStudentId("")}} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${mode==="positive"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{i+1}</span><div className="min-w-0 flex-1"><div className="font-black text-slate-900">{clsLabel(x.classroom)}</div><div className="text-[10px] font-bold text-slate-500">{x.count} davranış</div></div><strong>{x.count}</strong><ChevronRight className="h-4 w-4 text-slate-400"/></button>)}</div>
        :<div className="mt-4">
          <button type="button" onClick={()=>{setSelectedClassroom("");setSelectedStudentId("")}} className="mb-3 text-xs font-black text-indigo-700">← Sınıflara dön</button>
          <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-slate-500"/><strong className="text-sm text-slate-900">{clsLabel(selectedClassroom)}</strong></div>
          <div className="space-y-2">{classStudents.map(renderStudent)}</div>
        </div>}
    </div>
  </section>;
}

function DateRangeSlide({records}:{records:BehaviorRecord[]}){
  const [startDate,setStartDate]=React.useState("");
  const [endDate,setEndDate]=React.useState("");

  const filtered=React.useMemo(()=>records
    .filter(record=>{
      const key=dayKey(record.date||record.createdAt);
      if(!key)return false;
      if(startDate&&key<startDate)return false;
      if(endDate&&key>endDate)return false;
      return true;
    })
    .sort((a,b)=>String(b.date||b.createdAt||"").localeCompare(String(a.date||a.createdAt||""))),
  [records,startDate,endDate]);

  const positiveCount=filtered.filter(record=>norm(record.behaviorType)===norm("Olumlu")).length;
  const negativeCount=filtered.filter(record=>norm(record.behaviorType)===norm("Olumsuz")).length;

  return <section className="w-full shrink-0 snap-center px-4 pb-8">
    <div className="rounded-3xl border border-indigo-200 bg-gradient-to-b from-indigo-50 to-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><CalendarRange className="h-5 w-5"/></div>
        <div><h2 className="text-lg font-black text-slate-950">Tarih Aralığı</h2><p className="text-[10px] font-bold text-slate-500">Belirlediğiniz tarihler arasındaki tüm davranış kayıtları</p></div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="rounded-2xl border border-slate-200 bg-white p-3"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-500">Başlangıç</span><input type="date" value={startDate} onChange={event=>setStartDate(event.target.value)} className="w-full bg-transparent text-xs font-black text-slate-800 outline-none"/></label>
        <label className="rounded-2xl border border-slate-200 bg-white p-3"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-500">Bitiş</span><input type="date" value={endDate} min={startDate||undefined} onChange={event=>setEndDate(event.target.value)} className="w-full bg-transparent text-xs font-black text-slate-800 outline-none"/></label>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white p-2.5 text-center ring-1 ring-slate-200"><div className="text-base font-black text-slate-900">{filtered.length}</div><div className="text-[8px] font-black uppercase text-slate-400">Toplam</div></div>
        <div className="rounded-xl bg-green-50 p-2.5 text-center ring-1 ring-green-100"><div className="text-base font-black text-green-700">{positiveCount}</div><div className="text-[8px] font-black uppercase text-green-600">Olumlu</div></div>
        <div className="rounded-xl bg-red-50 p-2.5 text-center ring-1 ring-red-100"><div className="text-base font-black text-red-700">{negativeCount}</div><div className="text-[8px] font-black uppercase text-red-600">Olumsuz</div></div>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs font-bold text-slate-500">Seçilen tarih aralığında davranış kaydı bulunamadı.</div>:filtered.map(record=>{
          const positive=norm(record.behaviorType)===norm("Olumlu");
          return <article key={record.id} className={`rounded-2xl border p-3 ${positive?"border-green-100 bg-green-50":"border-red-100 bg-red-50"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-950">{record.studentName||"İsimsiz Öğrenci"}</strong><span className="mt-0.5 block text-[9px] font-black text-slate-500">{clsLabel(record.classroom)} · No {record.studentNumber||"-"}</span></div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black ${positive?"bg-green-600 text-white":"bg-red-600 text-white"}`}>{record.behaviorType||"Davranış"}</span>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3"><strong className="text-[11px] text-slate-800">{record.behaviorName||"Davranış Kaydı"}</strong><span className="shrink-0 text-[9px] font-black text-slate-500">{fmtDate(record.date||record.createdAt)}</span></div>
            {record.description?<p className="mt-1 text-[10px] font-medium text-slate-600">{record.description}</p>:null}
            {record.teacherName?<div className="mt-1 text-[9px] font-bold text-slate-400">Kaydeden: {record.teacherName}</div>:null}
          </article>;
        })}
      </div>
    </div>
  </section>;
}

export default function AdminBehaviorDisciplineView({token,onBack,onRecordBehavior}:{token:string;onBack:()=>void;onRecordBehavior?:()=>void}){
  const [data,setData]=React.useState<DashboardPayload>({students:[],records:[]});
  const [behaviorOptions,setBehaviorOptions]=React.useState<BehaviorItem[]>([]);
  const [recorderName,setRecorderName]=React.useState("Yönetici");
  const [reminders,setReminders]=React.useState<ReminderPayload>({count:0,warningCount:0,preInspectionCount:0,items:[]});
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState("");
  const scroller=React.useRef<HTMLDivElement|null>(null);
  const [page,setPage]=React.useState(0);

  React.useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [dashboardResponse, reminderResponse, linkResponse] = await Promise.all([
          fetch(`/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/behavior-dashboard`,{cache:"no-store"}),
          fetch(`/api/behavior/teacher-links/${encodeURIComponent(token)}/admin/behavior-action-reminders`,{cache:"no-store"}),
          fetch(`/api/behavior/teacher-links/${encodeURIComponent(token)}`,{cache:"no-store"}),
        ]);
        const dashboard=await dashboardResponse.json().catch(()=>({}));
        const reminder=await reminderResponse.json().catch(()=>({}));
        const linkInfo=await linkResponse.json().catch(()=>({}));
        if(!dashboardResponse.ok)throw new Error(dashboard?.error||"Davranış verileri alınamadı.");
        if(active){
          setData({students:Array.isArray(dashboard?.students)?dashboard.students:[],records:Array.isArray(dashboard?.records)?dashboard.records:[]});
          const nextBehaviors=Array.isArray(linkInfo?.behaviors)
            ? linkInfo.behaviors
            : Array.isArray(dashboard?.behaviors)
              ? dashboard.behaviors
              : [];
          setBehaviorOptions(nextBehaviors.filter((item:any)=>item&&item.id&&item.name).map((item:any)=>({id:String(item.id),type:String(item.type||""),name:String(item.name||"")})));
          if(linkResponse.ok&&String(linkInfo?.teacherName||"").trim())setRecorderName(String(linkInfo.teacherName).trim());
          if(reminderResponse.ok){
            setReminders({
              count:Number(reminder?.count||0),
              warningCount:Number(reminder?.warningCount||0),
              preInspectionCount:Number(reminder?.preInspectionCount||0),
              items:Array.isArray(reminder?.items)?reminder.items:[],
            });
          }
        }
      }catch(e:any){
        if(active)setError(e?.message||"Davranış verileri alınamadı.");
      }finally{
        if(active)setLoading(false);
      }
    })();
    return()=>{active=false};
  },[token]);

  const onScroll=()=>{const el=scroller.current;if(!el)return;setPage(Math.round(el.scrollLeft/(el.clientWidth||1)));};
  const goto=(p:number)=>{const el=scroller.current;if(el)el.scrollTo({left:el.clientWidth*p,behavior:"smooth"});};

  if(loading)return <div className="min-h-screen bg-slate-50 p-5"><div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-rose-600"/></div></div>;

  return <div className="min-h-screen bg-slate-50 pb-8">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ArrowLeft className="h-5 w-5"/></button>
        <div className="min-w-0 flex-1"><h1 className="truncate text-base font-black text-slate-950">Davranış / Disiplin</h1><p className="text-[10px] font-bold text-slate-500">Yönetici davranış analiz ekranı</p></div>
      </div>
    </header>

    <div className="mx-auto max-w-xl px-4 pt-4">
      {error?<div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>:null}

      {onRecordBehavior?<button type="button" onClick={onRecordBehavior} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 text-left shadow-sm transition active:scale-[0.99]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-white"><PlusCircle className="h-5 w-5"/></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black text-slate-950">Davranış Kaydı Yap</strong><span className="mt-0.5 block text-[10px] font-bold text-slate-500">Öğretmenlerde olduğu gibi tekli veya çoklu öğrenci davranışı kaydedin.</span></span><ChevronRight className="h-5 w-5 text-orange-500"/></button>:null}

      {reminders.count>0?<section className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-800"><AlertTriangle className="h-5 w-5"/></div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-amber-950">Uyarı veya Ön İnceleme gerektiren işlemler var</div>
            <div className="mt-1 text-[10px] font-bold text-amber-800">Uyarı: {reminders.warningCount} · Ön İnceleme: {reminders.preInspectionCount}</div>
            <div className="mt-2 space-y-1.5">
              {reminders.items.slice(0,5).map(item=><div key={item.id} className="rounded-lg bg-white/80 px-2.5 py-2 text-[10px] font-semibold text-slate-700"><strong>{item.studentName}</strong> · {item.behaviorName} → <strong>{item.destination}</strong></div>)}
              {reminders.items.length>5?<div className="text-[10px] font-black text-amber-800">+{reminders.items.length-5} işlem daha</div>:null}
            </div>
          </div>
        </div>
      </section>:null}

      <div className="mt-4 flex items-center justify-center gap-2">
        <button type="button" onClick={()=>goto(0)} className={`h-2.5 rounded-full transition-all ${page===0?"w-7 bg-green-600":"w-2.5 bg-slate-300"}`}/>
        <button type="button" onClick={()=>goto(1)} className={`h-2.5 rounded-full transition-all ${page===1?"w-7 bg-red-600":"w-2.5 bg-slate-300"}`}/>
        <button type="button" onClick={()=>goto(2)} className={`h-2.5 rounded-full transition-all ${page===2?"w-7 bg-indigo-600":"w-2.5 bg-slate-300"}`}/>
      </div>
      <div className="mt-2 grid grid-cols-3 items-center text-center text-[9px] font-black text-slate-500">
        <span className={page===0?"text-green-700":""}>Olumlu Davranışlar</span>
        <span className={page===1?"text-red-700":""}>Olumsuz Davranışlar</span>
        <span className={page===2?"text-indigo-700":""}>Tarih Aralığı</span>
      </div>
      <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400">Yana kaydır <ChevronRight className="h-3.5 w-3.5"/></div>
    </div>

    <div ref={scroller} onScroll={onScroll} className="mt-3 flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <BehaviorSlide mode="positive" students={data.students} records={data.records} token={token} behaviorOptions={behaviorOptions} recorderName={recorderName} onRecordsCreated={(records)=>setData(current=>({...current,records:[...records,...current.records]}))}/>
      <BehaviorSlide mode="negative" students={data.students} records={data.records} token={token} behaviorOptions={behaviorOptions} recorderName={recorderName} onRecordsCreated={(records)=>setData(current=>({...current,records:[...records,...current.records]}))}/>
      <DateRangeSlide records={data.records}/>
    </div>
  </div>;
}
