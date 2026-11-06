import React from "react";
import { AlertTriangle, BarChart3, Bot, Building2, ChevronDown, Search, Trophy } from "lucide-react";
import DetailedRankingTable from "../ranking/DetailedRankingTable";

type Props={ctx:any};
export default function AdminDecisionSection({ctx}:Props){
  const {activeReportView,results,adminTodayPriority,setAdminDecisionCard,setShowAdminDecisionCenter,adminStatusTone,adminStatusLabel,adminClassroomCount,adminRankingSubjects,kernelExecutive,adminAverageNet,kernelWarning,setOpenReportSections,columns,safeFixed,setShowSchoolDigitalTwin,adminDetailedRankingRows,adminRankingFilteredRows,adminRankingMode,setAdminRankingSelected,setShowAdminRankingFullscreen,createPdf,generating,adminInterventionClassroom,adminInterventionClassrooms,setAdminInterventionClassroom,adminInterventionLevel,setAdminInterventionLevel,adminInterventionSearch,setAdminInterventionSearch,adminInterventionSummary,adminInterventionRows,adminInterventionExpandedId,setAdminInterventionExpandedId,setShowEarlyWarningCenter,setShowBrainDashboard,adminDecisionCard,adminRankingClassroom,adminRankingClassrooms,adminRankingLimit,adminRankingSearch,adminRankingSubject,setAdminRankingClassroom,setAdminRankingLimit,setAdminRankingMode,setAdminRankingSearch,setAdminRankingSubject}=ctx;
  return <>
{activeReportView==="admin"&&results.length>0&&(
        <section className="space-y-4 rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 p-5 shadow-sm">
          <div className="rounded-[26px] border border-indigo-200 bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-900 p-5 text-white shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-4xl">
                <span className="text-[9px] font-black uppercase tracking-[.18em] text-white/60">Bugünün Önceliği</span>
                <h2 className="mt-2 text-xl font-black">{adminTodayPriority.title}</h2>
                <p className="mt-2 text-xs leading-6 text-white/75">{adminTodayPriority.detail}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={()=>{
                      setAdminDecisionCard(adminTodayPriority.target);
                      requestAnimationFrame(()=>document.getElementById("admin-decision-detail")?.scrollIntoView({behavior:"smooth",block:"start"}));
                    }}
                    className="rounded-xl bg-white px-4 py-2.5 text-[10px] font-black text-slate-950 transition hover:bg-indigo-50"
                  >
                    {adminTodayPriority.actionLabel}
                  </button>
                  <button
                    type="button"
                    onClick={()=>setShowAdminDecisionCenter(true)}
                    className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-[10px] font-black text-white transition hover:bg-white/20"
                  >
                    Yönetici kararlarını aç
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${adminStatusTone}`}>{adminStatusLabel}</span>
                <span className="text-[9px] font-bold text-white/55">{results.length} öğrenci · {adminClassroomCount} şube · {adminRankingSubjects.length} ders</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <button type="button" onClick={()=>setAdminDecisionCard("overview")} className={`group min-h-48 rounded-[26px] border border-blue-200 bg-blue-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md ${adminDecisionCard==="overview"?"ring-2 ring-blue-500 ring-offset-2":""}`}>
              <div className="flex items-start justify-between gap-3"><span className="rounded-2xl bg-blue-700 p-3 text-white"><Building2 className="h-6 w-6"/></span><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-blue-700">{kernelExecutive.schoolHealthScore}/100</span></div>
              <h3 className="mt-5 text-sm font-black text-slate-900">Okulum Bugün Nasıl?</h3>
              <p className="mt-2 text-[10px] leading-5 text-slate-600">Kurum başarısı, şubeler ve genel akademik görünümü tek ekranda inceleyin.</p>
              <div className="mt-4 text-[10px] font-black text-blue-700">Ort. net {adminAverageNet} · {adminClassroomCount} şube</div>
            </button>

            <button type="button" onClick={()=>setAdminDecisionCard("interventions")} className={`group min-h-48 rounded-[26px] border border-rose-200 bg-rose-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-md ${adminDecisionCard==="interventions"?"ring-2 ring-rose-500 ring-offset-2":""}`}>
              <div className="flex items-start justify-between gap-3"><span className="rounded-2xl bg-rose-700 p-3 text-white"><AlertTriangle className="h-6 w-6"/></span><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-rose-700">{kernelWarning.projectedCritical}</span></div>
              <h3 className="mt-5 text-sm font-black text-slate-900">Öncelikli Müdahaleler</h3>
              <p className="mt-2 text-[10px] leading-5 text-slate-600">Acil destek, yakın takip veya rehberlik gerektiren öğrenci ve sınıfları görün.</p>
              <div className="mt-4 text-[10px] font-black text-rose-700">{kernelWarning.criticalNow} kritik · {kernelWarning.worseningStudentCount} düşüş eğiliminde</div>
            </button>

            <button type="button" onClick={()=>setAdminDecisionCard("strengths")} className={`group min-h-48 rounded-[26px] border border-emerald-200 bg-emerald-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md ${adminDecisionCard==="strengths"?"ring-2 ring-emerald-500 ring-offset-2":""}`}>
              <div className="flex items-start justify-between gap-3"><span className="rounded-2xl bg-emerald-700 p-3 text-white"><Trophy className="h-6 w-6"/></span><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-emerald-700">Güçlü</span></div>
              <h3 className="mt-5 text-sm font-black text-slate-900">Güçlü Yönlerimiz</h3>
              <p className="mt-2 text-[10px] leading-5 text-slate-600">Başarılı sınıfları, güçlü dersleri ve örnek uygulamaları belirleyin.</p>
              <div className="mt-4 text-[10px] font-black text-emerald-700">{kernelExecutive.leadingClassroom||"Şube verisi yok"} · {kernelExecutive.leadingSubject||"Ders verisi yok"}</div>
            </button>

            <button type="button" onClick={()=>{setOpenReportSections(current=>({...current,"Yönetici Raporları":true}));requestAnimationFrame(()=>document.getElementById("admin-detailed-analyses")?.scrollIntoView({behavior:"smooth",block:"start"}));}} className="group min-h-48 rounded-[26px] border border-amber-200 bg-amber-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md">
              <div className="flex items-start justify-between gap-3"><span className="rounded-2xl bg-amber-600 p-3 text-white"><BarChart3 className="h-6 w-6"/></span><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-amber-700">{columns[0].items.length} analiz</span></div>
              <h3 className="mt-5 text-sm font-black text-slate-900">Ayrıntılı Analizler</h3>
              <p className="mt-2 text-[10px] leading-5 text-slate-600">Okul performansı, şube karşılaştırmaları ve PDF çıktılarına ulaşın.</p>
              <div className="mt-4 text-[10px] font-black text-amber-700">Analiz listesini aç</div>
            </button>

            <button type="button" onClick={()=>setAdminDecisionCard("recommendations")} className={`group min-h-48 rounded-[26px] border border-violet-200 bg-violet-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md ${adminDecisionCard==="recommendations"?"ring-2 ring-violet-500 ring-offset-2":""}`}>
              <div className="flex items-start justify-between gap-3"><span className="rounded-2xl bg-violet-700 p-3 text-white"><Bot className="h-6 w-6"/></span><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-violet-700">{kernelExecutive.tasks.length} öneri</span></div>
              <h3 className="mt-5 text-sm font-black text-slate-900">e-Nstitü Ne Öneriyor?</h3>
              <p className="mt-2 text-[10px] leading-5 text-slate-600">Veriye dayalı akademik önerileri ve yönetim önceliklerini inceleyin.</p>
              <div className="mt-4 text-[10px] font-black text-violet-700">Beklenen toplam etki +{safeFixed(kernelExecutive.expectedTotalNetGain,1)} net</div>
            </button>
          </div>

          <div id="admin-decision-detail" className="scroll-mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            {adminDecisionCard==="overview"&&(<div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-blue-600">Okulun Akademik Özeti</span><h3 className="mt-1 text-base font-black text-slate-900">Okulum Bugün Nasıl?</h3></div><button type="button" onClick={()=>setShowSchoolDigitalTwin(true)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-[10px] font-black text-white hover:bg-blue-800">Ayrıntılı görünümü aç</button></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Okul sağlık puanı",`${kernelExecutive.schoolHealthScore}/100`],
                  ["Kurum ortalama neti",String(adminAverageNet)],
                  ["Değerlendirilen öğrenci",String(results.length)],
                  ["Şube sayısı",String(adminClassroomCount)],
                ].map(([label,value])=><div key={label} className="rounded-2xl bg-slate-50 p-4"><span className="text-[9px] font-bold text-slate-400">{label}</span><strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong></div>)}
              </div>
              <p className="rounded-2xl bg-blue-50 p-4 text-[10px] leading-5 text-blue-900">{kernelExecutive.summary.detail}</p>

              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[.14em] text-indigo-600">Sınav Sonuçları</span>
                    <h4 className="mt-1 text-sm font-black text-slate-900">Sınav Sıralı Listeleri</h4>
                    <p className="mt-1 text-[10px] text-slate-500">Kurum, şube veya ders bazında öğrenci sıralamalarını anlık inceleyin.</p>
                  </div>
                  <button
                    type="button"
                    onClick={()=>createPdf(columns[0].items[0])}
                    disabled={Boolean(generating)}
                    className="rounded-xl bg-indigo-700 px-4 py-2.5 text-[10px] font-black text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generating===columns[0].items[0].title?"PDF hazırlanıyor…":"Sıralı Liste PDF"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
                  {([
                    ["institution","Kurum Geneli"],
                    ["classroom","Şube Bazında"],
                    ["subject","Ders Bazında"],
                  ] as const).map(([mode,label])=><button
                    key={mode}
                    type="button"
                    onClick={()=>setAdminRankingMode(mode)}
                    className={`rounded-xl border px-3 py-2 text-[10px] font-black transition ${adminRankingMode===mode?"border-indigo-700 bg-indigo-700 text-white":"border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"}`}
                  >{label}</button>)}

                  {adminRankingMode==="classroom"&&<select
                    value={adminRankingClassroom}
                    onChange={event=>setAdminRankingClassroom(event.target.value)}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400"
                  >
                    <option value="all">Tüm şubeler</option>
                    {adminRankingClassrooms.map(classroom=><option key={classroom} value={classroom}>{classroom}</option>)}
                  </select>}

                  {adminRankingMode==="subject"&&<select
                    value={adminRankingSubject}
                    onChange={event=>setAdminRankingSubject(event.target.value)}
                    className="h-9 min-w-48 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400"
                  >
                    <option value="all">Ders seçin</option>
                    {adminRankingSubjects.map(subject=><option key={subject} value={subject}>{subject}</option>)}
                  </select>}
                  <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search className="h-3.5 w-3.5 text-slate-400"/><input value={adminRankingSearch} onChange={event=>setAdminRankingSearch(event.target.value)} placeholder="Öğrenci ara" className="w-36 bg-transparent text-[10px] font-bold text-slate-700 outline-none placeholder:text-slate-400"/></label>
                  <select value={adminRankingLimit} onChange={event=>setAdminRankingLimit(Number(event.target.value) as 10|50|100|0)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700"><option value={10}>İlk 10</option><option value={50}>İlk 50</option><option value={100}>İlk 100</option><option value={0}>Tümü</option></select>
                </div>

                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                  <p className="text-[9px] leading-4 text-slate-500">Derslerin D-Y-B-Net ve ders sırası ile toplam sonuç ve tüm sıralamalar birlikte gösterilir.</p>
                  <button type="button" onClick={()=>setShowAdminRankingFullscreen(true)} className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-[10px] font-black text-white hover:bg-slate-800">Tam Ekran İncele</button>
                </div>
                <div className="max-h-[500px] overflow-auto">
                  <DetailedRankingTable rows={adminRankingFilteredRows} subjects={adminRankingSubjects} rankingMode={adminRankingMode} onSelect={(student)=>{setAdminRankingSelected(student);setShowAdminRankingFullscreen(true);}}/>
                  {!adminDetailedRankingRows.length&&<div className="p-8 text-center text-xs font-bold text-slate-400">Seçime uygun öğrenci sonucu bulunamadı.</div>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-[9px] text-slate-500">
                  <span>{adminRankingFilteredRows.length} / {adminDetailedRankingRows.length} öğrenci listelendi.</span>
                  <span>{adminRankingMode==="subject"&&adminRankingSubject!=="all"?`${adminRankingSubject} netine göre`:adminRankingMode==="classroom"&&adminRankingClassroom!=="all"?`${adminRankingClassroom} genel puanına göre`:"Kurum genel puanına göre"} sıralandı.</span>
                </div>
              </div>
            </div>)}

            {adminDecisionCard==="interventions"&&(<div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[.14em] text-rose-600">Bugün Önce Bunlara Bakın</span>
                  <h3 className="mt-1 text-base font-black text-slate-900">Öncelikli Müdahaleler</h3>
                  <p className="mt-1 text-[10px] text-slate-500">Öğrencileri risk düzeyi, şube ve nedenlere göre süzerek müdahale sırasını belirleyin.</p>
                </div>
                <button type="button" onClick={()=>setShowEarlyWarningCenter(true)} className="rounded-xl bg-rose-700 px-4 py-2.5 text-[10px] font-black text-white hover:bg-rose-800">Tam ekran risk merkezini aç</button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {label:"Acil",value:adminInterventionSummary.critical,tone:"border-rose-200 bg-rose-50 text-rose-800"},
                  {label:"Yüksek Risk",value:adminInterventionSummary.high,tone:"border-orange-200 bg-orange-50 text-orange-800"},
                  {label:"Kötüleşen",value:adminInterventionSummary.worsening,tone:"border-amber-200 bg-amber-50 text-amber-800"},
                  {label:"Tahmini Kritik",value:adminInterventionSummary.projectedCritical,tone:"border-violet-200 bg-violet-50 text-violet-800"},
                ].map(item=><div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}><span className="text-[9px] font-black uppercase tracking-[.1em] opacity-65">{item.label}</span><strong className="mt-2 block text-2xl font-black">{item.value}</strong></div>)}
              </div>

              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.2fr_.75fr_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                  <input value={adminInterventionSearch} onChange={event=>setAdminInterventionSearch(event.target.value)} placeholder="Öğrenci, numara, şube veya neden ara..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[10px] font-bold outline-none focus:border-rose-400"/>
                </label>
                <select value={adminInterventionClassroom} onChange={event=>setAdminInterventionClassroom(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 outline-none focus:border-rose-400">
                  <option value="all">Tüm şubeler</option>
                  {adminInterventionClassrooms.map(classroom=><option key={classroom} value={classroom}>{classroom}</option>)}
                </select>
                <div className="flex flex-wrap gap-1">
                  {[
                    {id:"all",label:"Tümü"},
                    {id:"critical",label:"Acil"},
                    {id:"high",label:"Yüksek"},
                    {id:"medium",label:"Orta"},
                  ].map(item=><button key={item.id} type="button" onClick={()=>setAdminInterventionLevel(item.id as typeof adminInterventionLevel)} className={`rounded-lg px-3 py-2 text-[9px] font-black transition ${adminInterventionLevel===item.id?"bg-rose-700 text-white":"bg-white text-slate-600 hover:bg-rose-50"}`}>{item.label}</button>)}
                </div>
              </div>

              <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                {adminInterventionRows.map(item=>{
                  const expanded=adminInterventionExpandedId===item.id;
                  const levelTone=item.predictedWarningLevel==="critical"?"border-rose-200 bg-rose-50 text-rose-800":item.predictedWarningLevel==="high"?"border-orange-200 bg-orange-50 text-orange-800":item.predictedWarningLevel==="medium"?"border-amber-200 bg-amber-50 text-amber-800":"border-emerald-200 bg-emerald-50 text-emerald-800";
                  return <div key={item.id} className={`overflow-hidden rounded-2xl border ${expanded?"border-rose-300 bg-white shadow-sm":"border-slate-200 bg-white"}`}>
                    <button type="button" onClick={()=>setAdminInterventionExpandedId(current=>current===item.id?null:item.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black ${levelTone}`}>{Math.round(Number(item.warningScore||0))}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-xs text-slate-900">{item.studentName}</strong>
                          <span className="text-[9px] font-bold text-slate-400">{item.studentNumber||"No yok"} · {item.classroomLabel}</span>
                          <span className={`rounded-full border px-2 py-1 text-[8px] font-black ${levelTone}`}>{item.levelLabel}</span>
                          <span className={`rounded-full px-2 py-1 text-[8px] font-black ${item.trend==="worsening"?"bg-rose-100 text-rose-700":item.trend==="improving"?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-600"}`}>{item.trendLabel}</span>
                        </div>
                        <p className="mt-1 truncate text-[10px] text-slate-600">{item.reasons?.[0]||"Yakın takip öneriliyor."}</p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <span className="block text-[8px] font-bold text-slate-400">Güven</span>
                        <strong className="text-[10px] text-slate-700">%{item.confidence}</strong>
                      </div>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${expanded?"rotate-180":""}`}/>
                    </button>
                    {expanded&&<div className="grid gap-4 border-t border-slate-100 bg-slate-50/70 p-4 lg:grid-cols-2">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-[.1em] text-slate-400">Risk nedenleri</span>
                        <div className="mt-2 space-y-2">{(item.reasons||[]).map((reason:string,index:number)=><div key={index} className="rounded-xl bg-white p-3 text-[10px] leading-5 text-slate-600">• {reason}</div>)}</div>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-[.1em] text-slate-400">Önerilen işlem</span>
                        <div className="mt-2 space-y-2">{(item.recommendedActions||[]).map((action:string,index:number)=><div key={index} className="rounded-xl border border-rose-100 bg-white p-3 text-[10px] leading-5 text-slate-700"><strong className="mr-2 text-rose-700">{index+1}.</strong>{action}</div>)}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={()=>setShowEarlyWarningCenter(true)} className="rounded-xl bg-rose-700 px-3 py-2 text-[9px] font-black text-white">Ayrıntılı incele</button>
                          <span className="rounded-xl bg-white px-3 py-2 text-[9px] font-bold text-slate-500">Risk artışı: {safeFixed(item?.riskIncrease,1)}</span>
                          <span className="rounded-xl bg-white px-3 py-2 text-[9px] font-bold text-slate-500">Kritik tahmini: {item.estimatedCriticalInExams===0?"Şimdi":item.estimatedCriticalInExams?`${item.estimatedCriticalInExams} sınav`:"Belirsiz"}</span>
                        </div>
                      </div>
                    </div>}
                  </div>;
                })}
                {!adminInterventionRows.length&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><strong className="text-sm text-emerald-900">Seçili filtrelerde müdahale kaydı bulunmuyor.</strong><p className="mt-2 text-[10px] text-emerald-700">Filtreleri temizleyebilir veya tam ekran risk merkezini inceleyebilirsiniz.</p></div>}
              </div>
            </div>)}

            {adminDecisionCard==="strengths"&&(<div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-600">Başarılı Uygulamaları Yaygınlaştırın</span><h3 className="mt-1 text-base font-black text-slate-900">Güçlü Yönlerimiz</h3></div><button type="button" onClick={()=>setShowBrainDashboard(true)} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-[10px] font-black text-white hover:bg-emerald-800">Akademik Beyni aç</button></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-emerald-50 p-4"><span className="text-[9px] font-bold text-emerald-600">Öne çıkan şube</span><strong className="mt-2 block text-lg font-black text-emerald-950">{kernelExecutive.leadingClassroom||"Henüz belirlenmedi"}</strong></div>
                <div className="rounded-2xl bg-emerald-50 p-4"><span className="text-[9px] font-bold text-emerald-600">Öne çıkan ders</span><strong className="mt-2 block text-lg font-black text-emerald-950">{kernelExecutive.leadingSubject||"Henüz belirlenmedi"}</strong></div>
                <div className="rounded-2xl bg-emerald-50 p-4"><span className="text-[9px] font-bold text-emerald-600">Akademik beyin endeksi</span><strong className="mt-2 block text-lg font-black text-emerald-950">{safeFixed(kernelExecutive.brainIndex,1)}</strong></div>
              </div>
              <p className="rounded-2xl bg-slate-50 p-4 text-[10px] leading-5 text-slate-600">Başarılı sınıf ve derslerde kullanılan yöntemleri diğer şubelerle paylaşmak için zümre ve sınıf rehber öğretmeni değerlendirmesi önerilir.</p>
            </div>)}

            {adminDecisionCard==="recommendations"&&(<div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Veriden Eyleme</span><h3 className="mt-1 text-base font-black text-slate-900">e-Nstitü Ne Öneriyor?</h3></div><button type="button" onClick={()=>setShowAdminDecisionCenter(true)} className="rounded-xl bg-violet-700 px-4 py-2.5 text-[10px] font-black text-white hover:bg-violet-800">Karar merkezini aç</button></div>
              <div className="space-y-3">
                {kernelExecutive.tasks.slice(0,3).map((task,index)=><div key={task.id||index} className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-[10px] font-black text-white">{index+1}</span><div><strong className="text-xs text-slate-900">{task.title}</strong><p className="mt-1 text-[10px] leading-5 text-slate-600">{task.detail}</p><span className="mt-2 inline-block text-[9px] font-black text-violet-700">{task.dueDays} gün içinde · Öncelik {task.priority}/5</span></div></div>)}
                {!kernelExecutive.tasks.length&&<p className="rounded-2xl bg-emerald-50 p-5 text-xs font-bold text-emerald-800">Şu anda ek yönetim önerisi bulunmuyor.</p>}
              </div>
            </div>)}
          </div>
        </section>
      )}
  </>;
}
