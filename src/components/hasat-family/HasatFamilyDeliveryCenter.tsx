import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Users,
} from "lucide-react";
import type {HasatFamilyDeliveryRecord} from "../../core/messaging";

type DeliveryFilter="all"|"sent"|"unopened"|"opened"|"failed";

type Props={
  records:HasatFamilyDeliveryRecord[];
  refreshing?:boolean;
  onRefresh:()=>void;
  onRetry:(record:HasatFamilyDeliveryRecord)=>void;
};

const formatDate=(value?:string)=>{
  if(!value)return"-";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"-":date.toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"});
};

const stageLabel=(status:string)=>{
  if(status==="sent")return"Gönderildi";
  if(status==="ready")return"Hazır";
  if(status==="failed")return"Hatalı";
  return"Bekliyor";
};

const stageClass=(status:string)=>status==="sent"
  ?"border-emerald-200 bg-emerald-50 text-emerald-700"
  :status==="ready"
    ?"border-cyan-200 bg-cyan-50 text-cyan-700"
    :status==="failed"
      ?"border-rose-200 bg-rose-50 text-rose-700"
      :"border-slate-200 bg-slate-50 text-slate-600";

export default function HasatFamilyDeliveryCenter({records,refreshing=false,onRefresh,onRetry}:Props){
  const [filter,setFilter]=React.useState<DeliveryFilter>("all");
  const delivered=records.filter(item=>item.whatsappStatus==="sent").length;
  const opened=records.filter(item=>item.viewStatus==="opened").length;
  const failed=records.filter(item=>item.whatsappStatus==="failed"||item.linkStatus==="failed").length;
  const unopened=records.filter(item=>item.linkStatus==="sent"&&item.viewStatus==="unopened").length;
  const visible=records.filter(item=>{
    if(filter==="sent")return item.whatsappStatus==="sent";
    if(filter==="opened")return item.viewStatus==="opened";
    if(filter==="unopened")return item.linkStatus==="sent"&&item.viewStatus==="unopened";
    if(filter==="failed")return item.whatsappStatus==="failed"||item.linkStatus==="failed";
    return true;
  });

  const cards=[
    {label:"Toplam",value:records.length,icon:Users,className:"border-slate-200 bg-white text-slate-800"},
    {label:"Teslim Edildi",value:delivered,icon:CheckCircle2,className:"border-emerald-200 bg-emerald-50 text-emerald-800"},
    {label:"Görüntülendi",value:opened,icon:Eye,className:"border-blue-200 bg-blue-50 text-blue-800"},
    {label:"Açılmadı",value:unopened,icon:Clock3,className:"border-amber-200 bg-amber-50 text-amber-800"},
    {label:"Hatalı",value:failed,icon:AlertCircle,className:"border-rose-200 bg-rose-50 text-rose-800"},
  ];

  return <section className="mb-5 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 shadow-sm">
    <div className="flex flex-col gap-3 border-b border-emerald-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white"><MessageCircle className="h-5 w-5"/></span>
          <div><h4 className="text-sm font-black text-slate-900">e-Nstitü AİLE Teslim Merkezi</h4><p className="text-[11px] text-slate-500">Canlı bağlantı esas teslimdir; PDF yardımcı belge olarak ayrıca izlenir.</p></div>
        </div>
      </div>
      <button type="button" onClick={onRefresh} disabled={refreshing||!records.length} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing?"animate-spin":""}`}/>Görüntüleme Durumunu Yenile</button>
    </div>

    <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-5">
      {cards.map(card=>{const Icon=card.icon;return <div key={card.label} className={`rounded-xl border p-3 ${card.className}`}><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wide">{card.label}</span><Icon className="h-4 w-4"/></div><strong className="mt-2 block text-2xl leading-none">{card.value}</strong></div>;})}
    </div>

    <div className="flex flex-wrap gap-2 border-y border-emerald-100 bg-white/70 px-4 py-3">
      {([
        ["all","Hepsi"],["sent","Gönderilenler"],["unopened","Açmayanlar"],["opened","Görüntüleyenler"],["failed","Hatalılar"],
      ] as [DeliveryFilter,string][]).map(([value,label])=><button key={value} type="button" onClick={()=>setFilter(value)} className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${filter===value?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"}`}>{label}</button>)}
    </div>

    <div className="max-h-80 overflow-y-auto p-4">
      {!visible.length?<div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-xs text-slate-500">Henüz bu filtreye uygun teslim kaydı bulunmuyor. İlk gönderimden sonra öğrenci bazlı teslim durumları burada oluşacak.</div>:<div className="space-y-2">
        {visible.map(record=><article key={record.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-0 xl:w-52"><strong className="block truncate text-xs text-slate-900">{record.studentName||record.recipientName}</strong><span className="mt-0.5 block truncate text-[10px] text-slate-500">{record.classroom||"-"} · {record.phone||"Telefon yok"}</span></div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              <div className={`rounded-lg border px-2 py-1.5 ${stageClass(record.pdfStatus)}`}><span className="flex items-center gap-1 text-[9px] font-black uppercase"><FileText className="h-3 w-3"/>PDF</span><strong className="mt-0.5 block text-[10px]">{stageLabel(record.pdfStatus)}</strong></div>
              <div className={`rounded-lg border px-2 py-1.5 ${stageClass(record.linkStatus)}`}><span className="flex items-center gap-1 text-[9px] font-black uppercase"><Link2 className="h-3 w-3"/>Canlı Link</span><strong className="mt-0.5 block text-[10px]">{stageLabel(record.linkStatus)}</strong></div>
              <div className={`rounded-lg border px-2 py-1.5 ${stageClass(record.whatsappStatus)}`}><span className="flex items-center gap-1 text-[9px] font-black uppercase"><MessageCircle className="h-3 w-3"/>WhatsApp</span><strong className="mt-0.5 block text-[10px]">{stageLabel(record.whatsappStatus)}</strong></div>
              <div className={`rounded-lg border px-2 py-1.5 ${record.viewStatus==="opened"?"border-blue-200 bg-blue-50 text-blue-700":record.viewStatus==="revoked"||record.viewStatus==="expired"?"border-slate-300 bg-slate-100 text-slate-600":"border-amber-200 bg-amber-50 text-amber-700"}`}><span className="flex items-center gap-1 text-[9px] font-black uppercase"><Eye className="h-3 w-3"/>Veli</span><strong className="mt-0.5 block text-[10px]">{record.viewStatus==="opened"?`${record.viewCount} kez açtı`:record.viewStatus==="revoked"?"İptal edildi":record.viewStatus==="expired"?"Süresi doldu":"Henüz açmadı"}</strong></div>
            </div>
            <div className="flex items-center justify-end gap-2 xl:w-48">
              {record.publication?.url&&<a href={record.publication.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[10px] font-black text-blue-700 hover:bg-blue-100"><ExternalLink className="h-3.5 w-3.5"/>e-Nstitü Raporunu Gör</a>}
              {(record.whatsappStatus==="failed"||record.linkStatus==="failed"||record.pdfStatus==="failed")&&<button type="button" onClick={()=>onRetry(record)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-2 text-[10px] font-black text-white hover:bg-rose-700"><RotateCcw className="h-3.5 w-3.5"/>Tekrar Gönder</button>}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-[9px] text-slate-500"><span>Güncelleme: {formatDate(record.updatedAt)}</span>{record.firstViewedAt&&<span>İlk açılış: {formatDate(record.firstViewedAt)}</span>}{record.lastViewedAt&&<span>Son açılış: {formatDate(record.lastViewedAt)}</span>}{record.error&&<span className="font-bold text-rose-600">Hata: {record.error}</span>}</div>
        </article>)}
      </div>}
    </div>
  </section>;
}
