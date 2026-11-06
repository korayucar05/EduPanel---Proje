import React from "react";
import { CalendarDays, FileDown, MessageCircle, Search } from "lucide-react";
import schoolLogo from "../assets/ordu-lisesi-logo.png";
import { createHomeworkNotificationCardBase64 } from "../lib/parentNotificationCards";
import { sqliteStorage } from "../core/state/SyncStateStore";
import {
  loadMhatsappSettings,
  sendMediaMessage,
} from "../lib/mhatsappApi";


type Props = { students?: any[]; teachers?: any[] };
type TabKey = "records" | "reports" | "c";
type HomeworkRow = {
  id:string; studentId:string; studentName:string; studentNumber:string; classroom:string;
  courseName:string; teacherName:string; homeworkTitle:string; checkDate:string; status:string;
  createdAt:number; raw:any;
};
type WorkflowState = Record<string,{
  messageStatus?:"pending"|"sent"|"no_parent_contact"|"manual_archive";
  messageSentAt?:string; reportStatus?:"active"|"archived"; reportMovedAt?:string;
}>;

const WORKFLOW_KEY="homework_control_workflow_v1";
const norm=(v:unknown)=>String(v??"").toLocaleLowerCase("tr-TR").replace(/\s+/g," ").trim();
const txt=(v:unknown)=>String(v??"").trim();
const first=(...v:unknown[])=>{for(const x of v){const s=txt(x);if(s)return s;}return ""};
const dateKey=(v:unknown)=>{if(!v)return "";const d=typeof v==="number"?new Date(v):/^\d+$/.test(String(v))?new Date(Number(v)):new Date(String(v));return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10)};
const today=()=>new Intl.DateTimeFormat("en-CA",{
  timeZone:"Europe/Istanbul",
  year:"numeric",
  month:"2-digit",
  day:"2-digit",
}).format(new Date());

const fetchHomeworkRows = async ():Promise<HomeworkRow[]> => {
  const response = await fetch("/api/behavior/homework-records?schoolId=school-main", {
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Ödev kayıtları alınamadı (${response.status}).`;
    try {
      const body = await response.json();
      if (body?.error) message = String(body.error);
    } catch {}
    throw new Error(message);
  }

  const body = await response.json();
  const items = Array.isArray(body?.items) ? body.items : [];

  return items
    .filter((r:any)=>String(r?.studentId||"").trim())
    .map((r:any)=>({
      id: String(r.id || `${r.sessionId}:${r.studentId}`),
      studentId: String(r.studentId || ""),
      studentName: String(r.studentName || ""),
      studentNumber: String(r.studentNumber || ""),
      classroom: String(r.classroom || ""),
      courseName: String(r.courseName || ""),
      teacherName: String(r.teacherName || ""),
      homeworkTitle: String(r.homeworkTitle || r.homeworkTopic || "Ödev"),
      checkDate: String(r.checkDate || ""),
      status: String(r.homeworkStatus || r.status || ""),
      createdAt: Number(r.createdAt || Date.now()),
      raw: r,
    }))
    .sort((a:HomeworkRow,b:HomeworkRow)=>b.createdAt-a.createdAt);
};
const isHomework=(r:any)=>{
  const d=norm(first(r?.recordType,r?.entryType,r?.kind,r?.module,r?.sourceType,r?.category));
  const s=norm(first(r?.homeworkStatus,r?.assignmentStatus,r?.evaluation,r?.status,r?.result));
  const t=first(r?.homeworkTitle,r?.homeworkTopic,r?.assignmentTitle,r?.assignmentTopic,r?.topic,r?.subject);
  return d.includes("homework")||d.includes("ödev")||d.includes("odev")||!!t||
    ["tam","kısmi eksik","kismi eksik","geliştirilmeli","gelistirilmeli","teslim edilmedi"].includes(s);
};

const flatten=(records:any[]):HomeworkRow[]=>{
  const out:HomeworkRow[]=[];
  for(const r of records||[]){
    if(!isHomework(r))continue;
    const shared={
      teacherName:first(r.teacherName,r.teacher,r.teacherFullName),
      courseName:first(r.courseName,r.course,r.lessonName,r.lesson),
      homeworkTitle:first(r.homeworkTitle,r.homeworkTopic,r.assignmentTitle,r.assignmentTopic,r.topic,r.subject,"Ödev"),
      checkDate:dateKey(first(r.checkDate,r.controlDate,r.date,r.createdAt,r.submittedAt))||today(),
      createdAt:Number(r.createdAt||Date.now())
    };
    const embedded=Array.isArray(r.students)?r.students:Array.isArray(r.records)?r.records:Array.isArray(r.evaluations)?r.evaluations:null;
    if(embedded?.length){
      embedded.forEach((x:any,i:number)=>out.push({
        id:first(x.id,x.studentId,`${r.id||"homework"}-${i}`), studentId:first(x.studentId,x.id),
        studentName:first(x.studentName,x.name), studentNumber:first(x.studentNumber,x.number),
        classroom:first(x.classroom,x.className,x.class,r.classroom), courseName:first(x.courseName,shared.courseName),
        teacherName:first(x.teacherName,shared.teacherName), homeworkTitle:first(x.homeworkTitle,x.homeworkTopic,shared.homeworkTitle),
        checkDate:dateKey(first(x.checkDate,x.date,shared.checkDate))||shared.checkDate,
        status:first(x.homeworkStatus,x.assignmentStatus,x.evaluation,x.status,x.result),
        createdAt:Number(x.createdAt||shared.createdAt), raw:{...r,...x}
      }));
    } else {
      out.push({
        id:first(r.id,`homework-${shared.createdAt}`), studentId:first(r.studentId,r.student?.id),
        studentName:first(r.studentName,r.student?.name,r.name), studentNumber:first(r.studentNumber,r.student?.number,r.number),
        classroom:first(r.classroom,r.className,r.student?.classroom), courseName:shared.courseName, teacherName:shared.teacherName,
        homeworkTitle:shared.homeworkTitle, checkDate:shared.checkDate,
        status:first(r.homeworkStatus,r.assignmentStatus,r.evaluation,r.status,r.result), createdAt:shared.createdAt, raw:r
      });
    }
  }
  return out.sort((a,b)=>b.createdAt-a.createdAt);
};

const readFlow=():WorkflowState=>{try{const raw=sqliteStorage.getItem(WORKFLOW_KEY);return raw?JSON.parse(raw):{}}catch{return {}}};
const saveFlow=(s:WorkflowState)=>sqliteStorage.setItem(WORKFLOW_KEY,JSON.stringify(s));
const parentPhone=(s:any)=>{
  const sources=[s,s?.contact,s?.contactInfo,s?.guardian,s?.parent,s?.mother,s?.father].filter(Boolean);
  const keys=["parentPhone","guardianPhone","veliTelefon","veliTelefonu","guardianMobile","motherPhone","fatherPhone","anneTelefon","babaTelefon","phone","mobile","gsm"];
  for(const src of sources)for(const k of keys){const v=txt(src?.[k]);if(v)return v}return "";
};
const phone90=(p:string)=>{const d=p.replace(/\D/g,"");if(!d)return "";if(d.startsWith("90"))return d;if(d.startsWith("0"))return `90${d.slice(1)}`;if(d.length===10)return `90${d}`;return d};
const fmt=(d:string)=>{if(!d)return "-";const x=new Date(`${d}T12:00:00`);return Number.isNaN(x.getTime())?d:x.toLocaleDateString("tr-TR")};

export default function HomeworkControlModule({students=[]}:Props){
  const [tab,setTab]=React.useState<TabKey>("records");
  const [rows,setRows]=React.useState<HomeworkRow[]>([]);
  const [flow,setFlow]=React.useState<WorkflowState>(()=>readFlow());
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState("");
  const [dateFilter,setDateFilter]=React.useState(today());
  const [teacherFilter,setTeacherFilter]=React.useState("");
  const [classFilter,setClassFilter]=React.useState("");
  const [studentQuery,setStudentQuery]=React.useState("");
  const [statusFilter,setStatusFilter]=React.useState("");
  const [selected,setSelected]=React.useState("");
  const [messageBusyId,setMessageBusyId]=React.useState("");
  const [bulkSendingKey,setBulkSendingKey]=React.useState("");
  const [messageFeedback,setMessageFeedback]=React.useState("");

  const refresh=React.useCallback(async()=>{setLoading(true);setError("");try{setRows(await fetchHomeworkRows());setFlow(readFlow())}catch(e:any){setError(e?.message||"Ödev kayıtları yüklenemedi.")}finally{setLoading(false)}},[]);
  React.useEffect(()=>{void refresh();let es:EventSource|null=null;try{es=new EventSource("/api/behavior/teacher-submissions/events");es.onmessage=()=>void refresh();es.addEventListener("submission",()=>void refresh())}catch{}return()=>es?.close()},[refresh]);

  const studentMap=React.useMemo(()=>{const m=new Map<string,any>();for(const s of students||[]){m.set(String(s?.id||""),s);if(s?.number!=null)m.set(`number:${s.number}`,s)}return m},[students]);
  const resolve=(r:HomeworkRow)=>studentMap.get(r.studentId)||studentMap.get(`number:${r.studentNumber}`)||students.find((s:any)=>norm(s?.name)===norm(r.studentName));
  const patch=(id:string,p:WorkflowState[string])=>{const n={...flow,[id]:{...(flow[id]||{}),...p}};setFlow(n);saveFlow(n)};
  const patchMany=(ids:string[],p:WorkflowState[string])=>{
    const n={...flow};
    for(const id of ids)n[id]={...(n[id]||{}),...p};
    setFlow(n);
    saveFlow(n);
  };
  const buildHomeworkMessage=(r:HomeworkRow)=>
    `Sayın Velimiz, ${r.studentName} öğrencimizin ${r.courseName||"ders"} dersi "${r.homeworkTitle}" ödevi ${fmt(r.checkDate)} tarihinde kontrol edilmiştir.${r.status?` Değerlendirme: ${r.status}.`:""} Bilginize sunarız.`;

  const send=async(r:HomeworkRow)=>{
    const phone=parentPhone(resolve(r));
    if(!phone){
      patch(r.id,{messageStatus:"no_parent_contact"});
      setMessageFeedback(`${r.studentName}: veli telefon bilgisi bulunamadı.`);
      return;
    }

    const settings=loadMhatsappSettings();
    if(!settings.token?.trim()){
      setMessageFeedback("Mesaj sistemi API tokenı tanımlı değil.");
      return;
    }

    setMessageBusyId(r.id);
    setMessageFeedback("PNG kart hazırlanıyor…");

    try{
      const card=await createHomeworkNotificationCardBase64({
        schoolName:"Ordu Lisesi",
        schoolLogoUrl:schoolLogo,
        studentName:r.studentName,
        classroom:r.classroom,
        courseName:r.courseName,
        homeworkTitle:r.homeworkTitle,
        checkDate:r.checkDate,
        status:r.status,
      });

      const result=await sendMediaMessage(
        settings,
        "image",
        [phone90(phone)],
        `${r.studentName} • Ödev Bilgilendirmesi`,
        `Odev_Bildirimi_${r.studentNumber || r.studentId}.png`,
        card,
      );

      if(!result.ok){
        throw new Error(result.error || result.status || "mHatsapp görseli kabul etmedi.");
      }

      const now=new Date().toISOString();
      patch(r.id,{
        messageStatus:"sent",
        messageSentAt:now,
        reportStatus:"archived",
        reportMovedAt:now,
      });

      setMessageFeedback(`${r.studentName} için PNG ödev kartı gönderildi.`);
    }catch(error:any){
      setMessageFeedback(`Kart gönderilemedi: ${error?.message || "Bilinmeyen hata"}`);
    }finally{
      setMessageBusyId("");
    }
  };

  const sendGroup=async(groupKey:string,items:HomeworkRow[])=>{
    const settings=loadMhatsappSettings();
    if(!settings.token?.trim()){
      setMessageFeedback("Mesaj sistemi API tokenı tanımlı değil.");
      return;
    }

    const prepared=items
      .map(r=>({r,phone:parentPhone(resolve(r))}))
      .filter(x=>Boolean(x.phone));

    if(!prepared.length){
      setMessageFeedback("Bu grupta kayıtlı veli telefonu bulunamadı.");
      return;
    }

    if(!window.confirm(`${prepared.length} veliye kişiselleştirilmiş PNG ödev kartı gönderilecek. Devam edilsin mi?`)){
      return;
    }

    setBulkSendingKey(groupKey);
    let success=0;
    const failures:string[]=[];

    try{
      for(let index=0; index<prepared.length; index++){
        const {r,phone}=prepared[index];
        setMessageFeedback(`${index+1}/${prepared.length} • ${r.studentName} kartı hazırlanıyor…`);

        try{
          const card=await createHomeworkNotificationCardBase64({
            schoolName:"Ordu Lisesi",
            schoolLogoUrl:schoolLogo,
            studentName:r.studentName,
            classroom:r.classroom,
            courseName:r.courseName,
            homeworkTitle:r.homeworkTitle,
            checkDate:r.checkDate,
            status:r.status,
          });

          const result=await sendMediaMessage(
            settings,
            "image",
            [phone90(phone)],
            `${r.studentName} • Ödev Bilgilendirmesi`,
            `Odev_Bildirimi_${r.studentNumber || r.studentId}.png`,
            card,
          );

          if(result.ok){
            const now=new Date().toISOString();
            patch(r.id,{
              messageStatus:"sent",
              messageSentAt:now,
              reportStatus:"archived",
              reportMovedAt:now,
            });
            success++;
          }
        }catch(error:any){
          failures.push(
            `${r.studentName}: ${error?.message || "Görsel kart gönderilemedi."}`
          );
        }
        if(index<prepared.length-1){
          await new Promise(resolve=>window.setTimeout(resolve,Math.max(1200,settings.delayMs || 1500)));
        }
      }

      setMessageFeedback(failures.length ? `${success}/${prepared.length} PNG kart gönderildi. Hata: ${failures[0]}` : `${success}/${prepared.length} veliye PNG ödev kartı gönderildi.`);
    }finally{
      setBulkSendingKey("");
    }
  };
  const move=(r:HomeworkRow)=>patch(r.id,{messageStatus:"manual_archive",reportStatus:"archived",reportMovedAt:new Date().toISOString()});

  const todayK=today();
  const pending=rows.filter(r=>{const s=flow[r.id];if(s?.reportStatus==="archived"||s?.messageStatus==="sent"||s?.messageStatus==="manual_archive")return false;const unsent=!s?.messageStatus||s.messageStatus==="pending"||s.messageStatus==="no_parent_contact";return (r.checkDate===todayK||unsent)&&(!dateFilter||r.checkDate===dateFilter)});
  const reports=rows.filter(r=>{const s=flow[r.id];return s?.reportStatus==="archived"||s?.messageStatus==="sent"||s?.messageStatus==="manual_archive"});
  const teachers=Array.from(new Set(reports.map(r=>r.teacherName).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr"));
  const classes=Array.from(new Set(reports.map(r=>r.classroom).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr",{numeric:true}));
  const filtered=reports.filter(r=>(!dateFilter||r.checkDate===dateFilter)&&(!teacherFilter||r.teacherName===teacherFilter)&&(!classFilter||r.classroom===classFilter)&&(!studentQuery||norm(`${r.studentName} ${r.studentNumber}`).includes(norm(studentQuery))));
  const grouped=React.useMemo(()=>{const m=new Map<string,HomeworkRow[]>();for(const r of filtered){const k=r.studentId||`${r.studentNumber}|${r.studentName}`;if(!m.has(k))m.set(k,[]);m.get(k)!.push(r)}return [...m.entries()]},[filtered]);
  React.useEffect(()=>{if(!selected&&grouped[0])setSelected(grouped[0][0]);if(selected&&!grouped.some(([id])=>id===selected))setSelected(grouped[0]?.[0]||"")},[grouped,selected]);
  const selectedRows=grouped.find(([id])=>id===selected)?.[1]||[];

  const recordTeachers=Array.from(new Set(rows.map(r=>r.teacherName).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr"));
  const recordClasses=Array.from(new Set(rows.map(r=>r.classroom).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr",{numeric:true}));
  const recordStatuses=Array.from(new Set(rows.map(r=>r.status).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr"));

  const recordFiltered=pending.filter(r=>
    (!teacherFilter||r.teacherName===teacherFilter)&&
    (!classFilter||r.classroom===classFilter)&&
    (!statusFilter||r.status===statusFilter)
  );

  const recordGroups=React.useMemo(()=>{
    const m=new Map<string,HomeworkRow[]>();
    for(const r of recordFiltered){
      const key=[r.checkDate||"",r.teacherName||"",r.classroom||"",r.courseName||"",r.homeworkTitle||""].join("|");
      if(!m.has(key))m.set(key,[]);
      m.get(key)!.push(r);
    }
    return [...m.entries()].map(([key,items])=>({
      key,
      items,
      first:items[0],
      total:items.length,
      tam:items.filter(x=>norm(x.status)==="tam").length,
      partial:items.filter(x=>norm(x.status)==="kısmi eksik"||norm(x.status)==="kismi eksik").length,
      improve:items.filter(x=>norm(x.status)==="geliştirilmeli"||norm(x.status)==="gelistirilmeli").length,
      missing:items.filter(x=>norm(x.status)==="teslim edilmedi").length,
    })).sort((a,b)=>b.first.createdAt-a.first.createdAt);
  },[recordFiltered]);

  const recordSummary={
    groups:recordGroups.length,
    students:recordFiltered.length,
    attention:recordFiltered.filter(r=>{
      const s=norm(r.status);
      return s==="kısmi eksik"||s==="kismi eksik"||s==="geliştirilmeli"||s==="gelistirilmeli";
    }).length,
    missing:recordFiltered.filter(r=>norm(r.status)==="teslim edilmedi").length,
  };

  const printReport=()=>{if(!selectedRows.length)return;const st=selectedRows[0];const w=window.open("","_blank","width=900,height=700");if(!w)return;
    w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Ödev Takip Raporu</title><style>body{font-family:Arial;padding:28px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:12px}</style></head><body><h2>e-Nstitü · Öğrenci Ödev Takip Raporu</h2><div>${st.studentName} · ${st.studentNumber||"-"} · ${st.classroom||"-"}</div><table><thead><tr><th>Tarih</th><th>Ders</th><th>Öğretmen</th><th>Ödev</th><th>Durum</th></tr></thead><tbody>${selectedRows.map(r=>`<tr><td>${fmt(r.checkDate)}</td><td>${r.courseName}</td><td>${r.teacherName}</td><td>${r.homeworkTitle}</td><td>${r.status||"-"}</td></tr>`).join("")}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);w.document.close()
  };

  const summary={today:rows.filter(r=>r.checkDate===todayK).length,pending:rows.filter(r=>{const s=flow[r.id];return !s?.messageStatus||s.messageStatus==="pending"||s.messageStatus==="no_parent_contact"}).length,noParent:rows.filter(r=>flow[r.id]?.messageStatus==="no_parent_contact").length,completed:reports.length};

  return <div className="min-h-full bg-slate-50 p-4 md:p-6 xl:p-8 text-slate-900"><div className="mx-auto max-w-[1500px] space-y-5">
    <div className="rounded-[28px] bg-gradient-to-r from-teal-950 via-teal-800 to-emerald-600 px-6 py-6 text-white shadow-xl"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Davranış Takip Merkezi</div><h1 className="mt-1 text-2xl md:text-3xl font-black">Ödev Kontrolü</h1><p className="mt-1 text-sm text-emerald-50/80">Öğretmen bağlantısından gelen ödev kayıtlarını yönetin, veliyi bilgilendirin ve öğrenci raporlarını oluşturun.</p></div><button onClick={()=>void refresh()} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">Yenile</button></div></div>

    <div className="rounded-[26px] border-2 border-dashed border-slate-300 bg-white p-3 shadow-sm"><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[
      ["records","A","Ödev Kaydı","Günlük ve mesaj bekleyen kayıtlar"],["reports","B","Raporlar","Öğrenci ve sınıf bazlı geçmiş"],["c","C","C","Yeni özellik için hazır alan"]
    ].map(([k,l,t,s])=><button key={k} onClick={()=>setTab(k as TabKey)} className={`rounded-2xl border-2 border-dashed p-4 text-left transition ${tab===k?"border-teal-500 bg-teal-50":"border-slate-200 hover:bg-slate-50"}`}><div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black ${tab===k?"bg-teal-600 text-white":"bg-slate-100 text-slate-600"}`}>{l}</div><div><div className="font-black">{t}</div><div className="text-xs text-slate-500">{s}</div></div></div></button>)}</div></div>

    {error&&<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
    {messageFeedback&&<div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">{messageFeedback}</div>}

    {tab==="records"&&<div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          ["Ödev Kontrolü",recordSummary.groups,"Öğretmen + sınıf + konu"],
          ["Değerlendirilen",recordSummary.students,"Öğrenci kaydı"],
          ["Dikkat Gereken",recordSummary.attention,"Kısmi eksik / geliştirilmeli"],
          ["Teslim Edilmeyen",recordSummary.missing,"Veli bilgilendirmesi öncelikli"],
        ].map(([label,value,sub])=>
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
            <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/>
            <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"/>
          </label>
          <select value={teacherFilter} onChange={e=>setTeacherFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="">Tüm öğretmenler</option>{recordTeachers.map(x=><option key={x}>{x}</option>)}
          </select>
          <select value={classFilter} onChange={e=>setClassFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="">Tüm sınıflar</option>{recordClasses.map(x=><option key={x}>{x}</option>)}
          </select>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="">Tüm durumlar</option>{recordStatuses.map(x=><option key={x}>{x}</option>)}
          </select>
          <button type="button" onClick={()=>{setDateFilter(today());setTeacherFilter("");setClassFilter("");setStatusFilter("")}} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-100">
            Filtreleri Temizle
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-black text-slate-900">Ödev Kontrol Merkezi</h2>
            <p className="text-xs text-slate-500">Kayıtlar öğretmen, sınıf, tarih ve ödev konusuna göre gruplanır. Kartı açarak öğrenci ayrıntılarını görebilirsiniz.</p>
          </div>
          <button onClick={()=>void refresh()} className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-black text-white hover:bg-teal-800">Yenile</button>
        </div>

        <div className="divide-y divide-slate-100">
          {recordGroups.map(group=>{
            const r=group.first;
            return (
              <details key={group.key} className="group p-4 open:bg-slate-50/70">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-teal-50 px-2 py-1 text-[10px] font-black text-teal-700">{r.classroom||"-"}</span>
                        <span className="text-[10px] font-black text-slate-400">{fmt(r.checkDate)}</span>
                        <span className="text-[10px] font-bold text-slate-500">{r.teacherName||"-"}</span>
                      </div>
                      <div className="mt-2 truncate text-base font-black text-slate-900">{r.homeworkTitle||"Ödev"}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{r.courseName||"Ders belirtilmedi"} · {group.total} öğrenci</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[470px]">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center"><div className="text-[9px] font-black uppercase text-emerald-700">Tam</div><div className="text-lg font-black text-emerald-800">{group.tam}</div></div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center"><div className="text-[9px] font-black uppercase text-amber-700">Kısmi Eksik</div><div className="text-lg font-black text-amber-800">{group.partial}</div></div>
                      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-center"><div className="text-[9px] font-black uppercase text-sky-700">Geliştirilmeli</div><div className="text-lg font-black text-sky-800">{group.improve}</div></div>
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center"><div className="text-[9px] font-black uppercase text-rose-700">Teslim Edilmedi</div><div className="text-lg font-black text-rose-800">{group.missing}</div></div>
                    </div>
                  </div>
                </summary>

                <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
                  <div className="text-xs font-black text-teal-900">
                    Toplu Veli Bilgilendirmesi
                  </div>
                  <div className="mt-0.5 text-[10px] text-teal-700">
                    Bu ödevde görünen öğrencilerin velilerine kişiselleştirilmiş mesajlar uygulama içinden gönderilir.
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(bulkSendingKey)}
                    onClick={(event)=>{
                      event.preventDefault();
                      void sendGroup(group.key,group.items);
                    }}
                    className="mt-3 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-black text-white shadow-sm transition enabled:hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkSendingKey===group.key
                      ? "Mesajlar Gönderiliyor…"
                      : `Toplu Mesaj Gönder (${group.items.length})`}
                  </button>
                </div>

                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[850px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="px-4 py-3">Öğrenci</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3">Ders</th><th className="px-4 py-3 text-right">Veli Bilgisi</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map(item=>{
                        const noPhone=!parentPhone(resolve(item));
                        const st=norm(item.status);
                        const needsAttention=st!=="tam";
                        return (
                          <tr key={item.id} className={needsAttention?"bg-amber-50/20":""}>
                            <td className="px-4 py-3"><div className="font-black text-slate-900">{item.studentNumber?`${item.studentNumber} · `:""}{item.studentName||"-"}</div></td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-black ${st==="tam"?"bg-emerald-50 text-emerald-700":st==="teslim edilmedi"?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700"}`}>{item.status||"-"}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{item.courseName||"-"}</td>
                            <td className="px-4 py-3 text-right">
                              {noPhone
                                ? <div className="inline-flex items-center gap-2"><span className="rounded-lg bg-amber-50 px-2 py-1 font-bold text-amber-700">Veli Bilgisi Yok</span><button onClick={()=>move(item)} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white">Raporlara Aktar</button></div>
                                : <button
  type="button"
  disabled={messageBusyId === item.id}
  onClick={async () => {
    setMessageFeedback(`${item.studentName} için kart hazırlanıyor…`);
    await send(item);
  }}
  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 font-black text-white transition ${
    messageBusyId === item.id
      ? "cursor-wait bg-slate-400"
      : needsAttention
        ? "bg-rose-600 hover:bg-rose-700"
        : "bg-emerald-600 hover:bg-emerald-700"
  }`}
>
  <MessageCircle className="h-4 w-4"/>
  {messageBusyId === item.id ? "Kart Hazırlanıyor…" : "Veliye Bildir"}
</button>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}

          {!loading&&!recordGroups.length&&<div className="px-4 py-14 text-center"><div className="text-sm font-black text-slate-600">Bu filtrelere uygun ödev kaydı bulunmuyor.</div><div className="mt-1 text-xs text-slate-400">Tarih veya diğer filtreleri değiştirerek tekrar deneyebilirsiniz.</div></div>}
          {loading&&<div className="px-4 py-14 text-center text-sm font-bold text-slate-400">Kayıtlar yükleniyor...</div>}
        </div>
      </div>
    </div>}
    {tab==="reports"&&<div className="space-y-4"><div className="rounded-3xl border border-slate-200 bg-white p-4"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/>
      <select value={teacherFilter} onChange={e=>setTeacherFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Tüm öğretmenler</option>{teachers.map(x=><option key={x}>{x}</option>)}</select>
      <select value={classFilter} onChange={e=>setClassFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Tüm sınıflar</option>{classes.map(x=><option key={x}>{x}</option>)}</select>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={studentQuery} onChange={e=>setStudentQuery(e.target.value)} placeholder="Ad, soyad veya okul no" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"/></div>
    </div><div className="mt-3 flex justify-end"><button onClick={()=>{setDateFilter("");setTeacherFilter("");setClassFilter("");setStudentQuery("")}} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Filtreleri Temizle</button></div></div>
    <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4"><div className="rounded-3xl border border-slate-200 bg-white overflow-hidden"><div className="border-b p-4 font-black">Öğrenciler</div><div className="max-h-[650px] overflow-y-auto divide-y">{grouped.map(([id,it])=>{const r=it[0];return <button key={id} onClick={()=>setSelected(id)} className={`w-full p-4 text-left ${selected===id?"bg-teal-50":""}`}><div className="text-[11px] font-black text-teal-700">{r.classroom||"-"}</div><div className="font-black">{r.studentNumber?`${r.studentNumber} · `:""}{r.studentName}</div><div className="text-xs text-slate-500">{it.length} ödev kaydı</div></button>})}</div></div>
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden"><div className="flex items-center justify-between border-b p-4"><div><div className="font-black text-lg">{selectedRows[0]?.studentName||"Öğrenci seçin"}</div><div className="text-xs text-slate-500">{selectedRows[0]?`${selectedRows[0].studentNumber} · ${selectedRows[0].classroom}`:""}</div></div><button disabled={!selectedRows.length} onClick={printReport} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><FileDown className="h-4 w-4"/>PDF Oluştur</button></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="px-4 py-3">Tarih</th><th className="px-4 py-3">Ders</th><th className="px-4 py-3">Öğretmen</th><th className="px-4 py-3">Ödev</th><th className="px-4 py-3">Durum</th></tr></thead><tbody>{selectedRows.map(r=><tr key={r.id}><td className="px-4 py-3">{fmt(r.checkDate)}</td><td className="px-4 py-3">{r.courseName}</td><td className="px-4 py-3">{r.teacherName}</td><td className="px-4 py-3 font-semibold">{r.homeworkTitle}</td><td className="px-4 py-3">{r.status||"-"}</td></tr>)}</tbody></table></div></div></div>
    </div>}

    {tab==="c"&&<div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl font-black">C</div><h2 className="mt-4 text-lg font-black">C Alanı</h2><p className="mt-1 text-sm text-slate-500">Bu alan sonraki geliştirme için hazır bırakıldı.</p></div>}
  </div></div>;
}

















