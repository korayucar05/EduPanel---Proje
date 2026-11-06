import React from "react";
import { Copy, Download, ExternalLink, FilePenLine, Link2, Loader2, MessageCircle, Printer, Smartphone, Target, Trash2, X } from "lucide-react";
import { StudentReportV2 } from "./components/StudentReportV2";
import { buildStudentReportV2Data, reportClassroom, reportStudentName, reportStudentNumber } from "./utils/buildStudentReportV2Data";
import { downloadStudentReportV2Pdf } from "./utils/exportStudentReportV2Pdf";
import { loadStudentTarget, saveStudentTarget } from "./utils/buildStudentTargetAnalysis";
import type { StudentTargetDefinition, TeacherEvaluation } from "./types";
import { loadTeacherEvaluation, saveTeacherEvaluation } from "./utils/teacherEvaluationStorage";
import { publishIndependentLiveReport, revokeIndependentLiveReport, type IndependentLiveReportPublication } from "./live/independentLiveReportApi";

export default function StudentReportV2Modal({exam,results,initialStudent,onClose}:{exam:any;results:any[];initialStudent?:any|null;onClose:()=>void}){
  const foundIndex=results.findIndex(item=>initialStudent&&(item===initialStudent||String(reportStudentNumber(item))===String(reportStudentNumber(initialStudent))));
  const initialIndex=foundIndex>=0?foundIndex:0;
  const [selectedIndex,setSelectedIndex]=React.useState(initialIndex);
  const [exporting,setExporting]=React.useState(false);
  const [showTargetEditor,setShowTargetEditor]=React.useState(false);
  const [showTeacherEditor,setShowTeacherEditor]=React.useState(false);
  const [targetRevision,setTargetRevision]=React.useState(0);
  const [teacherRevision,setTeacherRevision]=React.useState(0);
  const [liveLink,setLiveLink]=React.useState<IndependentLiveReportPublication|null>(null);
  const [publishingLive,setPublishingLive]=React.useState(false);
  const student=results[selectedIndex]||results[0];
  const studentNumber=reportStudentNumber(student);
  const [targetDraft,setTargetDraft]=React.useState<StudentTargetDefinition>(()=>loadStudentTarget(studentNumber));
  const [teacherDraft,setTeacherDraft]=React.useState<TeacherEvaluation>(()=>loadTeacherEvaluation(studentNumber));
  React.useEffect(()=>{
    const currentNumber=reportStudentNumber(results[selectedIndex]||results[0]);
    setTargetDraft(loadStudentTarget(currentNumber));
    setTeacherDraft(loadTeacherEvaluation(currentNumber));
    setLiveLink(null);
  },[selectedIndex,results]);
  const report=React.useMemo(()=>buildStudentReportV2Data(exam,results,student),[exam,results,student,targetRevision,teacherRevision]);
  const liveLinkAccess=React.useMemo(()=>{
    if(!liveLink?.url)return{isLocal:false,label:""};
    try{
      const url=new URL(liveLink.url);
      const host=url.hostname.toLowerCase();
      const isLocal=host==="localhost"||host==="127.0.0.1"||host.endsWith(".local")||
        /^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host);
      return{
        isLocal,
        label:isLocal
          ?"Bu bağlantı yalnızca okulun aynı Wi-Fi/ağındaki telefonlarda açılır."
          :"Bu bağlantı internet üzerinden farklı cihazlarda açılabilir.",
      };
    }catch{
      return{isLocal:false,label:"Bağlantı adresi doğrulanamadı."};
    }
  },[liveLink?.url]);
  const saveTarget=()=>{
    saveStudentTarget(studentNumber,targetDraft);
    setTargetRevision(value=>value+1);
    setShowTargetEditor(false);
  };
  const saveTeacherNote=()=>{
    saveTeacherEvaluation(studentNumber,teacherDraft);
    setTeacherRevision(value=>value+1);
    setShowTeacherEditor(false);
  };
  const publishReport=async()=>{
    setPublishingLive(true);
    try{
      const result=await publishIndependentLiveReport(report,30);
      setLiveLink(result);
    }catch(error:any){
      window.alert(error?.message||"Canlı rapor yayımlanamadı.");
    }finally{
      setPublishingLive(false);
    }
  };
  const copyLiveLink=async()=>{
    if(!liveLink)return;
    try{
      await navigator.clipboard.writeText(liveLink.url);
      window.alert("Canlı rapor bağlantısı kopyalandı.");
    }catch{
      window.prompt("Bağlantıyı kopyalayın:",liveLink.url);
    }
  };
  const shareLiveLink=(channel:"whatsapp"|"sms")=>{
    if(!liveLink)return;
    const message=`Merhaba Sayın Veli,

${report.student.name} adlı öğrencimizin ${report.examName} sınavına ait e-Nstitü AİLE canlı akademik dosyası hazırlanmıştır.

Raporu telefonunuzda uygulama görünümünde açmak için aşağıdaki bağlantıya dokunun:

${liveLink.url}

Bağlantı 30 gün boyunca geçerlidir.`;
    const url=channel==="whatsapp"
      ? `https://wa.me/?text=${encodeURIComponent(message)}`
      : `sms:?&body=${encodeURIComponent(message)}`;
    window.open(url,"_blank","noopener,noreferrer");
  };
  const removeLiveLink=async()=>{
    if(!liveLink)return;
    try{
      await revokeIndependentLiveReport(liveLink);
      setLiveLink(null);
    }catch(error:any){
      window.alert(error?.message||"Canlı rapor kaldırılamadı.");
    }
  };
  const print=()=>window.print();
  const downloadPdf=async()=>{
    setExporting(true);
    try{
      await downloadStudentReportV2Pdf(report,`${reportStudentName(student).replace(/\s+/g,"_")}_HASAT_Karne_V2.pdf`);
    }catch(error:any){
      window.alert(error?.message||"Karne PDF oluşturulamadı.");
    }finally{
      setExporting(false);
    }
  };
  if(!student)return null;
  return <div className="fixed inset-0 z-[180] flex flex-col bg-slate-950/80 backdrop-blur-sm">
    <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-5 py-3 text-white print:hidden">
      <div><h2 className="text-sm font-black">Bireysel Öğrenci Karnesi V2</h2><p className="text-[11px] text-slate-400">Ekran, indirilen PDF ve WhatsApp belgesi aynı tasarımı kullanır · {selectedIndex+1}/{results.length}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={selectedIndex} onChange={event=>setSelectedIndex(Number(event.target.value))} className="max-w-72 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white">
          {results.map((item,index)=><option key={`${reportStudentNumber(item)}-${index}`} value={index}>{reportStudentNumber(item)} · {reportStudentName(item)} · {reportClassroom(item)}</option>)}
        </select>
        <button onClick={publishReport} disabled={publishingLive} title="Canlı rapor bağlantısı oluştur" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold hover:bg-emerald-500 disabled:opacity-60">{publishingLive?<Loader2 className="h-4 w-4 animate-spin"/>:<Link2 className="h-4 w-4"/>}{publishingLive?"Yayımlanıyor":"Canlı Rapor"}</button>
        <button onClick={()=>setShowTeacherEditor(value=>!value)} title="Öğretmen değerlendirmesini gir" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold hover:bg-violet-500"><FilePenLine className="h-4 w-4"/>Öğretmen Notu</button>
        <button onClick={()=>setShowTargetEditor(value=>!value)} title="Öğrenci hedefini tanımla" className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold hover:bg-orange-500"><Target className="h-4 w-4"/>Hedef Tanımla</button>
        <button onClick={downloadPdf} disabled={exporting} title="Tasarımlı PDF indir" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold hover:bg-blue-500 disabled:opacity-60">{exporting?<Loader2 className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>}{exporting?"PDF hazırlanıyor":"PDF indir"}</button>
        <button onClick={print} title="Yazdır / PDF kaydet" className="rounded-lg p-2 hover:bg-emerald-600"><Printer className="h-5 w-5"/></button>
        <button onClick={onClose} title="Kapat" className="rounded-lg p-2 hover:bg-rose-600"><X className="h-5 w-5"/></button>
      </div>
    </header>


    {liveLink&&<section className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-5 py-4 print:hidden">
      <div className="mx-auto flex max-w-[1250px] flex-wrap items-center gap-3">
        {liveLink.qrDataUrl&&<img src={liveLink.qrDataUrl} alt="Canlı rapor QR kodu" className="h-24 w-24 rounded-xl border border-emerald-200 bg-white p-1 shadow-sm"/>}
        <div className="min-w-0 flex-1">
          <strong className="block text-xs text-emerald-900">Canlı rapor bağlantısı oluşturuldu</strong>
          <a
            href={liveLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all text-[11px] font-bold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
          >
            {liveLink.url}
          </a>
          <p className={`mt-2 rounded-lg px-2.5 py-2 text-[9px] font-bold ${liveLinkAccess.isLocal?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>
            {liveLinkAccess.label} Rapor 30 gün sonra geçersiz olur.
          </p>
        </div>
        <button onClick={()=>shareLiveLink("whatsapp")} className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-black text-white"><MessageCircle className="h-4 w-4"/>WhatsApp</button>
        <button onClick={()=>shareLiveLink("sms")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"><Smartphone className="h-4 w-4"/>SMS</button>
        <button onClick={copyLiveLink} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm"><Copy className="h-4 w-4"/>Kopyala</button>
        <button onClick={()=>window.open(liveLink.url,"_blank","noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white"><ExternalLink className="h-4 w-4"/>Aç</button>
        <button onClick={removeLiveLink} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white"><Trash2 className="h-4 w-4"/>Kaldır</button>
      </div>
    </section>}

    {showTeacherEditor&&<section className="shrink-0 border-b border-slate-300 bg-white px-5 py-4 print:hidden">
      <div className="mx-auto max-w-[1250px]">
        <div className="grid grid-cols-6 gap-3">
          <label className="col-span-2 text-[10px] font-black text-slate-600">Öğretmen adı
            <input value={teacherDraft.teacherName||""} onChange={event=>setTeacherDraft({...teacherDraft,teacherName:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"/>
          </label>
          <label className="text-[10px] font-black text-slate-600">Görevi / branşı
            <input value={teacherDraft.teacherTitle||""} onChange={event=>setTeacherDraft({...teacherDraft,teacherTitle:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"/>
          </label>
          <label className="text-[10px] font-black text-slate-600">Değerlendirme tarihi
            <input type="date" value={teacherDraft.evaluationDate||""} onChange={event=>setTeacherDraft({...teacherDraft,evaluationDate:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"/>
          </label>
          <label className="text-[10px] font-black text-slate-600">Sonraki kontrol
            <input type="date" value={teacherDraft.nextReviewDate||""} onChange={event=>setTeacherDraft({...teacherDraft,nextReviewDate:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"/>
          </label>
          <label className="text-[10px] font-black text-slate-600">Takip durumu
            <select value={teacherDraft.followUpStatus||"not-started"} onChange={event=>setTeacherDraft({...teacherDraft,followUpStatus:event.target.value as TeacherEvaluation["followUpStatus"]})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs">
              <option value="not-started">Başlamadı</option>
              <option value="in-progress">Takipte</option>
              <option value="completed">Tamamlandı</option>
            </select>
          </label>
          <label className="col-span-3 text-[10px] font-black text-slate-600">Öğretmen gözlemi
            <textarea rows={3} value={teacherDraft.observation||""} onChange={event=>setTeacherDraft({...teacherDraft,observation:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"/>
          </label>
          <label className="col-span-3 text-[10px] font-black text-slate-600">Öğretmen önerisi
            <textarea rows={3} value={teacherDraft.recommendation||""} onChange={event=>setTeacherDraft({...teacherDraft,recommendation:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"/>
          </label>
          <label className="col-span-3 text-[10px] font-black text-slate-600">Öğrenci taahhüdü
            <textarea rows={2} value={teacherDraft.studentCommitment||""} onChange={event=>setTeacherDraft({...teacherDraft,studentCommitment:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"/>
          </label>
          <label className="col-span-3 text-[10px] font-black text-slate-600">Veli iletişim notu
            <textarea rows={2} value={teacherDraft.parentContactNote||""} onChange={event=>setTeacherDraft({...teacherDraft,parentContactNote:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"/>
          </label>
          <label className="col-span-4 text-[10px] font-black text-slate-600">İmza / onay metni
            <input value={teacherDraft.signatureText||""} onChange={event=>setTeacherDraft({...teacherDraft,signatureText:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" placeholder="Örn. Görüşülmüştür"/>
          </label>
          <div className="col-span-2 flex items-end">
            <button onClick={saveTeacherNote} className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-700">Öğretmen Notunu Kaydet</button>
          </div>
        </div>
      </div>
    </section>}

    {showTargetEditor&&<section className="shrink-0 border-b border-slate-300 bg-white px-5 py-4 print:hidden">
      <div className="mx-auto grid max-w-[1250px] grid-cols-8 gap-3">
        <label className="col-span-2 text-[10px] font-black text-slate-600">Üniversite
          <input value={targetDraft.university||""} onChange={event=>setTargetDraft({...targetDraft,university:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium" placeholder="Örn. ODTÜ"/>
        </label>
        <label className="col-span-2 text-[10px] font-black text-slate-600">Program / Bölüm
          <input value={targetDraft.program||""} onChange={event=>setTargetDraft({...targetDraft,program:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium" placeholder="Örn. Bilgisayar Mühendisliği"/>
        </label>
        <label className="text-[10px] font-black text-slate-600">Puan Türü
          <input value={targetDraft.scoreType||""} onChange={event=>setTargetDraft({...targetDraft,scoreType:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium" placeholder="SAY"/>
        </label>
        <label className="text-[10px] font-black text-slate-600">Hedef Puan
          <input type="number" value={targetDraft.targetScore??""} onChange={event=>setTargetDraft({...targetDraft,targetScore:event.target.value===""?undefined:Number(event.target.value)})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"/>
        </label>
        <label className="text-[10px] font-black text-slate-600">Hedef Net
          <input type="number" step="0.25" value={targetDraft.targetNet??""} onChange={event=>setTargetDraft({...targetDraft,targetNet:event.target.value===""?undefined:Number(event.target.value)})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"/>
        </label>
        <label className="text-[10px] font-black text-slate-600">Hedef Sıralama
          <input type="number" min="1" value={targetDraft.targetRank??""} onChange={event=>setTargetDraft({...targetDraft,targetRank:event.target.value===""?undefined:Number(event.target.value)})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium" placeholder="Örn. 25000"/>
        </label>
        <label className="col-span-2 text-[10px] font-black text-slate-600">Hedef yılı
          <input type="number" value={targetDraft.targetYear??""} onChange={event=>setTargetDraft({...targetDraft,targetYear:event.target.value===""?undefined:Number(event.target.value)})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"/>
        </label>
        <label className="col-span-5 text-[10px] font-black text-slate-600">Kaynak / açıklama
          <input value={targetDraft.sourceNote||""} onChange={event=>setTargetDraft({...targetDraft,sourceNote:event.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium" placeholder="Örn. Öğrenci tarafından belirlenen kişisel hedef"/>
        </label>
        <div className="col-span-1 flex items-end">
          <button onClick={saveTarget} className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-black text-white hover:bg-orange-700">Hedefi Kaydet</button>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-[1250px] text-[9px] text-slate-500">Girilen hedef değerleri öğrenci numarasıyla bu tarayıcıda saklanır. Sistem üniversite taban puanını kendiliğinden varsaymaz.</p>
    </section>}
    <main className="min-h-0 flex-1 overflow-auto bg-slate-200 p-6 print:overflow-visible print:bg-white print:p-0"><StudentReportV2 report={report}/></main>
  </div>;
}
