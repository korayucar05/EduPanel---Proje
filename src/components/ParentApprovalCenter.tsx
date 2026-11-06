import React from "react";
import { CheckCircle2, Clock3, FileCheck2, RefreshCw, Search, XCircle } from "lucide-react";

type Target = { id: string; name: string; number: string; classroom: string; parentPhone: string; parentName?: string };
type Row = Target & { campaignId?: string; studentName?: string; studentNumber?: string; status: "pending"|"approved"|"rejected"; respondedAt?: string|null; responseIp?: string|null; responseUserAgent?: string|null; parentDisplayName?: string };
type Campaign = { id:string; title:string; description:string; principalName:string; eventDate?:string; expiresAt?:string; createdAt:string; createdBy:string; rows:Row[]; targets?:Row[] };

const fmt=(value?:string|null)=>value ? new Intl.DateTimeFormat("tr-TR",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Istanbul"}).format(new Date(value)) : "—";
const norm=(v:string)=>v.toLocaleUpperCase("tr-TR").replace(/\s+/g,"").replace(/[\/_.]+/g,"-");

const normalizeCampaigns = (items: any[]): Campaign[] =>
  items.map((campaign: any) => {
    const sourceRows = Array.isArray(campaign?.rows)
      ? campaign.rows
      : Array.isArray(campaign?.targets)
        ? campaign.targets
        : [];

    const rows: Row[] = sourceRows.map((row: any) => ({
      ...row,
      id: String(row?.id || ""),
      name: String(row?.name || row?.studentName || ""),
      number: String(row?.number || row?.studentNumber || ""),
      studentName: String(row?.studentName || row?.name || ""),
      studentNumber: String(row?.studentNumber || row?.number || ""),
      classroom: String(row?.classroom || ""),
      parentPhone: String(row?.parentPhone || ""),
      parentName: String(row?.parentName || ""),
      campaignId: String(row?.campaignId || campaign?.id || ""),
      status:
        row?.status === "approved" || row?.status === "rejected"
          ? row.status
          : "pending",
    }));

    return {
      ...campaign,
      rows,
    };
  });

export default function ParentApprovalCenter({
  currentUserName = "Yonetici",
}: {
  currentUserName?: string;
  settings?: unknown;
}) {
  const [targets,setTargets]=React.useState<Target[]>([]);
  const [campaigns,setCampaigns]=React.useState<Campaign[]>([]);
  const [title,setTitle]=React.useState("");
  const [description,setDescription]=React.useState("");
  const [principalName,setPrincipalName]=React.useState("");
  const [eventDate,setEventDate]=React.useState("");
  const [expiresAt,setExpiresAt]=React.useState("");
  const [classroom,setClassroom]=React.useState("");
  const [selected,setSelected]=React.useState<string[]>([]);
  const [activeId,setActiveId]=React.useState("");
  const [detail,setDetail]=React.useState<Row|null>(null);
  const [busy,setBusy]=React.useState(false);
  const [message,setMessage]=React.useState("");
  const [view,setView]=React.useState<"prepare"|"operations">("prepare");
  const [statusFilter,setStatusFilter]=React.useState<"approved"|"pending"|"rejected"|"all">("approved");

  const load=React.useCallback(async()=>{
    const [t,c]=await Promise.all([
      fetch("/api/parent-consents/targets",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/parent-consents",{cache:"no-store"}).then(r=>r.json()),
    ]);
    setTargets(Array.isArray(t.items)?t.items:[]);
    const next=normalizeCampaigns(Array.isArray(c.items)?c.items:[]);
    setCampaigns(next);
    setActiveId(prev=>prev || next[0]?.id || "");
  },[]);

  React.useEffect(()=>{ void load().catch(()=>setMessage("Veli onay bilgileri yüklenemedi.")); },[load]);
  React.useEffect(()=>{
    const id=window.setInterval(()=>void load().catch(()=>undefined),3000);
    return()=>window.clearInterval(id);
  },[load]);

  const classrooms=React.useMemo<string[]>(()=>Array.from(new Set<string>(targets.map(x=>norm(x.classroom)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"tr-TR",{numeric:true})),[targets]);
  const visible=React.useMemo(()=>targets.filter(x=>norm(x.classroom)===norm(classroom)),[targets,classroom]);
  const active=campaigns.find(x=>x.id===activeId)||campaigns[0]||null;

  const create=async()=>{
    if(!title.trim()||!description.trim()||!principalName.trim()||!selected.length){setMessage("İşlem adı, onay yazısı, okul müdürü ve öğrenci seçimi zorunludur.");return;}
    setBusy(true); setMessage("");
    try{
      const chosen=targets.filter(x=>selected.includes(x.id));
      const r=await fetch("/api/parent-consents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,principalName,eventDate,expiresAt,createdBy:currentUserName,targets:chosen})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||"Onay belgesi oluşturulamadı.");

      const campaignId = String(j?.campaign?.id || "").trim();

      if (!campaignId) {
        throw new Error("Onay kaydinin kimligi alinamadi.");
      }

      const notifyResponse = await fetch(
        `/api/parent-consents/${encodeURIComponent(campaignId)}/notify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const notifyData = await notifyResponse.json().catch(() => ({}));

      if (!notifyResponse.ok) {
        throw new Error(
          notifyData?.error ||
            "Onay kaydi olusturuldu ancak veli bildirimi gonderilemedi."
        );
      }

      const sentCount = Number(notifyData?.sent || 0);
      const failedCount = Number(notifyData?.failed || 0);
      setTitle("");setDescription("");setEventDate("");setExpiresAt("");setSelected([]);
      setActiveId(campaignId);
      setMessage(failedCount > 0 ? `${chosen.length} kay\u0131t olu\u015fturuldu ? ${sentCount} g\u00f6nderildi ? ${failedCount} g\u00f6nderilemedi.` : `${chosen.length} kay\u0131t olu\u015fturuldu ? ${sentCount} veliye g\u00f6nderildi.`);
      await load();
    }catch(e:any){setMessage(e?.message||"İşlem başarısız.");}finally{setBusy(false);}
  };

  return <div className="h-full overflow-y-auto bg-slate-50 p-5 text-slate-800">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-600">Yönetici Merkezi</p><h1 className="mt-1 text-2xl font-black">Veli Onay Bilgisi</h1><p className="mt-1 text-sm font-semibold text-slate-500">Veli onay taleplerini hazırlayın ve sonuçları tek ekrandan takip edin.</p></div>
          <button onClick={()=>void load()} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black"><RefreshCw className="h-4 w-4"/>Yenile</button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
        <button type="button" onClick={()=>setView("prepare")} className={view==="prepare"?"rounded-xl bg-white px-4 py-3 text-sm font-black text-violet-700 shadow-sm":"rounded-xl px-4 py-3 text-sm font-black text-slate-500"}>Onay Hazırla</button>
        <button type="button" onClick={()=>{setView("operations");setStatusFilter("approved");}} className={view==="operations"?"rounded-xl bg-white px-4 py-3 text-sm font-black text-violet-700 shadow-sm":"rounded-xl px-4 py-3 text-sm font-black text-slate-500"}>Onay İşlemleri</button>
      </div>

      <div className="block">
        <section className={`${view==="prepare"?"block":"hidden"} mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm`}>
          <h2 className="flex items-center gap-2 text-base font-black"><FileCheck2 className="h-5 w-5 text-violet-600"/>Yeni Onay İşlemi</h2>
          <div className="mt-4 space-y-3">
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder='İşlem adı — ör. "Ankara Gezisi"' className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold"/>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={6} placeholder="Velinin okuyacağı onay yazısını yazınız…" className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"/>
            <input value={principalName} onChange={e=>setPrincipalName(e.target.value)} placeholder="Okul Müdürünün Adı Soyadı" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold"/>
            <div className="grid grid-cols-2 gap-2"><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold"/><input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold"/></div>
            <select value={classroom} onChange={e=>{setClassroom(e.target.value);setSelected([])}} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold"><option value="">Sınıf seçiniz</option>{classrooms.map(c=><option key={c}>{c}</option>)}</select>
            {visible.length>0&&<div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200">
              <button onClick={()=>setSelected(visible.every(x=>selected.includes(x.id))?[]:visible.map(x=>x.id))} className="w-full border-b bg-slate-50 px-3 py-2 text-left text-xs font-black">Tümünü seç / kaldır</button>
              {visible.map(x=><label key={x.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-0"><input type="checkbox" checked={selected.includes(x.id)} onChange={()=>setSelected(p=>p.includes(x.id)?p.filter(id=>id!==x.id):[...p,x.id])}/><span className="min-w-0 flex-1"><b className="block truncate text-xs">{x.name}</b><small className="text-slate-500">{x.number||"—"} · {x.classroom}</small></span></label>)}
            </div>}
            <button disabled={busy} onClick={()=>void create()} className="w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">{busy?"Oluşturuluyor…":`Onay Talebi Oluştur ve Gönder (${selected.length})`}</button>
            {message&&<p className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600">{message}</p>}
          </div>
        </section>

        <section className={`${view==="operations"?"block":"hidden"} space-y-4`}>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3">{campaigns.map(c=>{const a=c.rows.filter(r=>r.status==="approved").length,p=c.rows.filter(r=>r.status==="pending").length,rj=c.rows.filter(r=>r.status==="rejected").length;return <button key={c.id} onClick={()=>{setActiveId(c.id);setStatusFilter("approved");}} className={`w-[82vw] max-w-[330px] shrink-0 snap-start rounded-2xl border p-4 text-left shadow-sm ${active?.id===c.id?"border-violet-600 bg-violet-600 text-white":"border-slate-200 bg-white"}`}><span className="text-[10px] font-black uppercase tracking-[.16em]">Onay Konusu</span><b className="mt-2 block text-base">{c.title}</b><div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-black"><span>Onay {a}</span><span>Bekleyen {p}</span><span>Red {rj}</span></div></button>})}</div>
          {!active?<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm font-bold text-slate-400">Henüz veli onay işlemi oluşturulmadı.</div>:<>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">{active.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{active.description}</p>
              <div className="mt-5 border-t pt-4 text-right"><b className="block text-sm">{active.principalName}</b><span className="text-xs font-semibold text-slate-500">Okul Müdürü</span></div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500"><span>Oluşturan: {active.createdBy}</span><span>•</span><span>{fmt(active.createdAt)}</span>{active.eventDate&&<><span>•</span><span>Etkinlik: {active.eventDate}</span></>}</div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" onClick={()=>setStatusFilter("approved")} className={statusFilter==="approved"?"rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white":"rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700"}>Onaylayanlar</button>
              <button type="button" onClick={()=>setStatusFilter("pending")} className={statusFilter==="pending"?"rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white":"rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-700"}>Bekleyenler</button>
              <button type="button" onClick={()=>setStatusFilter("rejected")} className={statusFilter==="rejected"?"rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white":"rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700"}>Reddedenler</button>
              <button type="button" onClick={()=>setStatusFilter("all")} className={statusFilter==="all"?"rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-white":"rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"}>Tümü</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {active.rows.filter(row=>statusFilter==="all"||row.status===statusFilter).map(row=>{const approved=row.status==="approved", rejected=row.status==="rejected"; return <button key={row.id} onClick={()=>setDetail(row)} className={`rounded-2xl border-2 p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${approved?"border-emerald-300 bg-emerald-50":rejected?"border-rose-400 bg-rose-100":"border-rose-200 bg-rose-50"}`}>
                <div className="flex items-start gap-3">{approved?<CheckCircle2 className="h-6 w-6 text-emerald-700"/>:rejected?<XCircle className="h-6 w-6 text-rose-700"/>:<Clock3 className="h-6 w-6 text-rose-600"/>}<div className="min-w-0"><b className="block truncate text-sm">{row.studentName}</b><span className="text-xs font-semibold text-slate-600">{row.studentNumber||"—"} · {row.classroom}</span><span className={`mt-2 block text-[10px] font-black uppercase ${approved?"text-emerald-700":"text-rose-700"}`}>{approved?"Veli onayladı":rejected?"Veli reddetti":"Veli henüz onaylamadı"}</span></div></div>
              </button>})}
            </div>
          </>}
        </section>
      </div>
    </div>
    {detail&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" onClick={()=>setDetail(null)}><div onClick={e=>e.stopPropagation()} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><h3 className="text-lg font-black">{detail.studentName}</h3><p className="text-xs font-bold text-slate-500">{detail.studentNumber} · {detail.classroom}</p></div><button onClick={()=>setDetail(null)} className="rounded-xl border px-3 py-2 text-xs font-black">Kapat</button></div>
      <div className="mt-5 grid gap-2 text-xs"><p><b>Durum:</b> {detail.status==="approved"?"Onaylandı":detail.status==="rejected"?"Reddedildi":"Bekliyor"}</p><p><b>Veli:</b> {detail.parentDisplayName||"—"}</p><p><b>Veli telefonu:</b> {detail.parentPhone||"—"}</p><p><b>Karar zamanı:</b> {fmt(detail.respondedAt)}</p><p><b>IP:</b> {detail.responseIp||"—"}</p><p className="break-all"><b>Cihaz/Tarayıcı:</b> {detail.responseUserAgent||"—"}</p></div>
    </div></div>}
  </div>;
}
