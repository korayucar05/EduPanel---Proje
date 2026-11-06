import React from "react";
import {
  Bell, BookOpen, BrainCircuit, CalendarDays, CheckCircle2, ChevronLeft,
  ChevronRight, ClipboardList, Download, FileText, GraduationCap, Home,
  LayoutGrid, LineChart, Menu, MessageCircle, MoreHorizontal, Clock3, Dna, Smartphone,
  School, Send, Settings, Share2, ShieldCheck, Sparkles, Star, Target,
  TrendingUp, Trophy, User, Users, X
} from "lucide-react";
import type { StudentReportV2Data } from "../reports-v2/types";
import {
  HasatBottomNavigation,
  HasatCard,
  HasatEmptyState,
  HasatPageHeader,
  HasatPageIntro,
  HasatStatStrip,
  type HasatNavItem,
} from "../design-system";
import "../design-system/hasat-theme.css";
import { FamilyAcademicDNACard, FamilyHeroCard, FamilyPriorityCard, FamilyPulseCard, FamilyRiskCard, FamilyRiskDetail, FamilySubjectCarousel, FamilyTargetCard, FamilyTeacherDecisionCard } from "./components";
import {buildTeacherDecision} from "../intelligence/teacher";
import {buildAcademicDigitalProfileFromReports} from "../intelligence-v2";
import {DigitalTwinSimulator} from "../components/intelligence-v2";

export type FamilySection =
  | "home" | "exams" | "analysis" | "dna" | "target" | "teacher"
  | "plan" | "notifications" | "messages" | "report-cards" | "profile"
  | "children" | "settings" | "install" | "risks" | "digital-twin";

type Props = {
  report: StudentReportV2Data;
  token?: string;
};

type FamilyServerMessage = {
  receiptId: string;
  messageId: string;
  title: string;
  body: string;
  teacherName: string;
  classroom?: string;
  studentName?: string;
  sentAt?: string;
  pushedAt?: string;
  deliveredAt?: string;
  clickedAt?: string;
  openedAt?: string;
  reminderCount?: number;
};

const familyRequest = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  if (!response.ok) {
    let message = `Sunucu hatası (${response.status})`;
    try { const body = await response.json(); if (body?.error) message = String(body.error); } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

const base64UrlToUint8Array = (value: string) => {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
};

const playFamilyMessageSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.20, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.85);
    gain.connect(context.destination);
    [0, 0.24, 0.48].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = [660, 880, 1046][index] || 880;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.13);
    });
    window.setTimeout(() => void context.close(), 1200);
  } catch {}
};

const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const subjectRate = (subject: StudentReportV2Data["subjects"][number]) =>
  Number.isFinite(Number(subject.successRate))
    ? Number(subject.successRate)
    : subject.totalQuestions
      ? subject.correct / subject.totalQuestions * 100
      : 0;

const colorFor = (index: number) => ["#14a36d", "#3277d5", "#7855d9", "#f97316", "#0f9f9a", "#e85688"][index % 6];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase("tr-TR");

function Card({children, className="", onClick}:{children:React.ReactNode; className?:string; onClick?:()=>void}){
  return <HasatCard onClick={onClick} className={className}>{children}</HasatCard>;
}

function Header({title, onBack, actions}:{title:string; onBack?:()=>void; actions?:React.ReactNode}){
  return <HasatPageHeader title={title} onBack={onBack} actions={actions}/>;
}

function MiniLine({values, color="#13a66d"}:{values:number[]; color?:string}){
  const safe=values.length?values:[2,4,3,6,5,8];
  const max=Math.max(...safe,1); const min=Math.min(...safe,0); const range=Math.max(1,max-min);
  const points=safe.map((value,index)=>`${index/(safe.length-1||1)*100},${36-(value-min)/range*30}`).join(" ");
  return <svg viewBox="0 0 100 40" className="h-12 w-full overflow-visible">
    <polyline fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" points={points}/>
    {safe.map((value,index)=>{const x=index/(safe.length-1||1)*100; const y=36-(value-min)/range*30; return <circle key={index} cx={x} cy={y} r="2.2" fill={color} stroke="white" strokeWidth="1.4"/>})}
  </svg>;
}

function Ring({value, label, color="#13a66d"}:{value:number; label?:string; color?:string}){
  const normalized=Math.max(0,Math.min(100,value));
  return <div className="relative flex h-28 w-28 items-center justify-center rounded-full" style={{background:`conic-gradient(${color} ${normalized*3.6}deg,#e9eef4 0deg)`}}>
    <div className="flex h-[82px] w-[82px] flex-col items-center justify-center rounded-full bg-white">
      <strong className="text-2xl font-black text-emerald-700">%{Math.round(normalized)}</strong>
      {label&&<span className="text-[8px] font-bold text-slate-400">{label}</span>}
    </div>
  </div>;
}

function BottomNav({active, go}:{active:FamilySection; go:(value:FamilySection)=>void}){
  const items:HasatNavItem<FamilySection>[]=[
    {key:"home",icon:Home,label:"Ana Sayfa"},
    {key:"exams",icon:FileText,label:"Sınavlar"},
    {key:"analysis",icon:LineChart,label:"Analiz"},
    {key:"plan",icon:CalendarDays,label:"Planım"},
    {key:"messages",icon:MessageCircle,label:"Mesajlar"},
  ];
  return <HasatBottomNavigation
    active={active}
    items={items}
    onChange={go}
    isActive={(item,current)=>item.key===current||(item.key==="analysis"&&["dna","target"].includes(current))}
  />;
}

function HomePage({report,go,installable,onInstall}:{report:StudentReportV2Data;go:(s:FamilySection)=>void;installable:boolean;onInstall:()=>void}){
  const subjects=[...report.subjects].sort((a,b)=>subjectRate(b)-subjectRate(a));
  const strongest=subjects[0];
  const weakest=subjects[subjects.length-1];
  const score=Math.round(report.totals.successRate||0);
  const prediction=report.successPrediction;
  const trend=prediction&&Number.isFinite(prediction.expectedNet-prediction.currentNet)
    ?prediction.expectedNet-prediction.currentNet
    :0;

  const ai=report.aiEvaluation?.parentMessage
    ||report.parentSupport?.summary
    ||report.academicDna?.summary
    ||report.targetAnalysis?.summary
    ||"Bu rapor için kişiselleştirilmiş veli değerlendirmesi henüz oluşturulmadı.";

  const subjectMetrics=subjects.map((subject:any)=>({
    name:String(subject?.subjectName||subject?.name||"Ders"),
    score:Number(subject?.successRate??subjectRate(subject)??0),
    net:Number(subject?.net??0),
    trend:0,
  }));

  const dnaItems=(report.academicDna?.dimensions||[]).map(dimension=>({
    label:dimension.label,
    value:dimension.score,
  }));

  const target=report.targetAnalysis;
  const intelligence=report.intelligence;
  const risks=intelligence?.risks||[];
  const priorities=intelligence?.subjectPriorities||[];
  const targetDefinition=target?.definition;
  const targetName=[
    targetDefinition?.university,
    targetDefinition?.program,
  ].filter(Boolean).join(" · ");

  const pulsePositive=prediction?.summary
    ||report.academicDna?.summary
    ||(strongest?`${strongest.subjectName} dersindeki başarı oranı bu sınavın en güçlü göstergesidir.`:"Genel akademik performans değerlendirildi.");

  const pulseWarning=report.parentSupport?.developmentAreas?.[0]
    ||report.academicDna?.priorities?.[0]
    ||(weakest&&weakest!==strongest?`${weakest.subjectName} için düzenli tekrar önerilir.`:undefined);

  return <div className="space-y-4 px-4 pb-28 pt-4">
    <div className="flex items-center justify-between px-1 py-2">
      <div className="flex items-center gap-3"><img src="/enstitu-logo-color.png" alt="e-Nstitü" className="h-12 w-12 rounded-2xl object-cover shadow-sm"/><div><strong className="block text-2xl font-black tracking-[.06em] text-[#10283f]">e-Nstitü</strong><span className="text-[8px] font-bold uppercase text-slate-400">Hedefli Akademik Süreç Analiz Takibi</span></div></div>
      <button onClick={()=>go("notifications")} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><Bell className="h-5 w-5"/></button>
    </div>

    {<button onClick={onInstall} className="hasat-pressable flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-[#082f58] to-emerald-600 px-4 py-3 text-left text-white shadow-lg"><span><strong className="block text-sm">e-Nstitü AİLE’yi ana ekrana ekleyin</strong><span className="text-[10px] text-white/75">Uygulama gibi tek dokunuşla açın.</span></span><Download className="h-5 w-5"/></button>}

    <FamilyHeroCard
      studentName={report.student.name}
      schoolName={report.schoolName}
      classroom={report.student.classroom||"-"}
      score={score}
      trend={trend}
      examName={report.examName}
    />

    <FamilyPulseCard
      status={prediction?.trendLabel||report.academicDna?.strengths?.[0]||"Akademik durum değerlendirildi"}
      positive={pulsePositive}
      warning={pulseWarning}
    />

    <FamilySubjectCarousel subjects={subjectMetrics} onOpen={()=>go("analysis")}/>

    <FamilyRiskCard risks={risks} onOpen={()=>go("risks")}/>

    <FamilyPriorityCard priorities={priorities} onOpen={()=>go("analysis")}/>

    <div className="grid gap-4 sm:grid-cols-2">
      <FamilyAcademicDNACard items={dnaItems} onOpen={()=>go("dna")}/>
      <FamilyTargetCard
        targetName={targetName}
        progress={Number(target?.completionRate??0)}
        currentNet={Number(target?.currentNet??report.totals.net??0)}
        targetNet={Number(targetDefinition?.targetNet??0)}
        isDefined={Boolean(target?.isDefined)}
        onOpen={()=>go("target")}
      />
    </div>

    <Card className="overflow-hidden p-0" onClick={()=>go("digital-twin")}>
      <div className="bg-gradient-to-r from-cyan-600 to-blue-700 p-5 text-white">
        <span className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100">e-Nstitü Digital Twin</span>
        <h3 className="mt-1 text-base font-black">Dijital İkiz & Müdahale Simülatörü</h3>
        <p className="mt-2 text-[10px] leading-5 text-cyan-100">Çalışma, etüt, devamsızlık ve deneme senaryolarının tahmini etkisini görün.</p>
      </div>
    </Card>

    <Card className="p-5" onClick={()=>go("analysis")}><div className="flex gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600"><BrainCircuit className="h-7 w-7"/></div><div className="min-w-0"><span className="text-xs font-black uppercase text-violet-600">e-Nstitü AI</span><p className="mt-2 line-clamp-4 text-[13px] leading-6 text-slate-700">{ai}</p></div><ChevronRight className="ml-auto h-5 w-5 shrink-0 text-slate-300"/></div></Card>
  </div>;
}
function ExamsPage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  const examDate=report.examDate||report.reportDate||"Tarih bilgisi yok";
  return <><Header title="Sınavlar" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <HasatPageIntro
      eyebrow="Akademik Geçmiş"
      title="Sınav Sonuçları"
      description="Bu ekranda yalnızca canlı akademik dosyada bulunan gerçek sınav sonuçları gösterilir."
    />
    <HasatStatStrip items={[
      {label:"Toplam Net",value:report.totals.net.toFixed(2)},
      {label:"Başarı",value:`%${Math.round(report.totals.successRate)}`},
      {label:"Puan",value:report.totals.score!==undefined?number(report.totals.score).toFixed(2):"—"},
    ]}/>
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-5 text-white">
        <span className="text-[9px] font-black uppercase tracking-[.14em] text-blue-100">Son Sınav</span>
        <h3 className="mt-1 text-lg font-black">{report.examName}</h3>
        <p className="mt-1 text-[10px] text-blue-100">{examDate}</p>
        <div className="mt-5 flex items-end justify-between">
          <div><strong className="text-5xl font-black">{report.totals.net.toFixed(2)}</strong><span className="ml-2 text-xs text-blue-100">net</span></div>
          <div className="text-right"><span className="block text-[9px] text-blue-100">Başarı</span><strong className="text-xl">%{Math.round(report.totals.successRate)}</strong></div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-100 bg-white">
        <div className="p-3 text-center"><span className="text-[9px] text-slate-400">Doğru</span><strong className="mt-1 block text-lg text-emerald-600">{report.totals.correct}</strong></div>
        <div className="p-3 text-center"><span className="text-[9px] text-slate-400">Yanlış</span><strong className="mt-1 block text-lg text-rose-600">{report.totals.wrong}</strong></div>
        <div className="p-3 text-center"><span className="text-[9px] text-slate-400">Boş</span><strong className="mt-1 block text-lg text-slate-600">{report.totals.empty}</strong></div>
      </div>
    </Card>
    <HasatEmptyState
      title="Geçmiş sınavlar henüz bu canlı dosyada yok"
      description="Yeni sınavlar aynı öğrenci dosyasına bağlandığında gelişim geçmişi burada kronolojik olarak gösterilecektir."
      icon={FileText}
    />
  </div></>;
}
function AnalysisPage({report,back,go}:{report:StudentReportV2Data;back:()=>void;go:(s:FamilySection)=>void}){
  const sorted=[...report.subjects].sort((a,b)=>b.net-a.net);
  const strongest=sorted[0];
  const weakest=sorted[sorted.length-1];
  return <><Header title="Ders Analizi" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <HasatPageIntro eyebrow="Performans" title="Ders Bazlı Analiz" description="Net, başarı oranı ve soru dağılımları mevcut sınav sonucundan hesaplanır."/>
    <HasatStatStrip items={[
      {label:"Ders Sayısı",value:sorted.length},
      {label:"Toplam Net",value:report.totals.net.toFixed(2)},
      {label:"Genel Başarı",value:`%${Math.round(report.totals.successRate)}`},
    ]}/>
    {sorted.length?<Card className="p-5"><h3 className="mb-5 text-sm font-black text-slate-900">Derslere Göre Net</h3><div className="space-y-5">{sorted.map((subject,index)=>{const width=Math.max(0,Math.min(100,subjectRate(subject)));return <div key={subject.subjectName}><div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-bold text-slate-700">{subject.subjectName}</span><strong className="text-xs">{subject.net.toFixed(2)} net</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-700" style={{width:`${width}%`,backgroundColor:colorFor(index)}}/></div><div className="mt-1 flex justify-between text-[9px] text-slate-400"><span>{subject.correct} D · {subject.wrong} Y · {subject.empty} B</span><span>%{Math.round(subjectRate(subject))}</span></div></div>})}</div></Card>:<HasatEmptyState title="Ders analizi bulunamadı" description="Bu sınav raporunda ders bazlı sonuç verisi yok." icon={LineChart}/>}
    {strongest&&<div className="grid gap-3 sm:grid-cols-2">
      <Card className="flex items-center gap-3 bg-emerald-50 p-4" onClick={()=>go("dna")}><Star className="h-6 w-6 text-emerald-600"/><div className="flex-1"><span className="text-[10px] font-black text-slate-500">En Güçlü Ders</span><strong className="block text-sm">{strongest.subjectName}</strong></div><strong>{strongest.net.toFixed(2)} Net</strong><ChevronRight/></Card>
      {weakest&&<Card className="flex items-center gap-3 bg-orange-50 p-4" onClick={()=>go("target")}><Target className="h-6 w-6 text-orange-600"/><div className="flex-1"><span className="text-[10px] font-black text-slate-500">Öncelikli Alan</span><strong className="block text-sm">{weakest.subjectName}</strong></div><strong>{weakest.net.toFixed(2)} Net</strong><ChevronRight/></Card>}
    </div>}
  </div></>;
}
function DnaPage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  const profile=report.academicDna;
  const dims=profile?.dimensions||[];

  return <><Header title="Akademik DNA" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <HasatPageIntro
      eyebrow="Öğrenme Profili"
      title="Akademik DNA"
      description="Bu profil, sınav performansından hesaplanan güçlü yönleri ve gelişim önceliklerini gösterir."
    />

    {profile&&dims.length?<>
      <HasatStatStrip items={[
        {label:"Genel DNA",value:`%${Math.round(profile.overallScore)}`},
        {label:"Güven",value:`%${Math.round(profile.overallConfidence)}`},
        {label:"Boyut",value:dims.length},
      ]}/>

      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 p-5 text-white">
          <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-100">Profil Özeti</span>
          <p className="mt-3 text-xs leading-6 text-white/90">{profile.summary}</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-emerald-50 p-3">
            <span className="text-[9px] font-black uppercase tracking-[.12em] text-emerald-600">Güçlü Yönler</span>
            <div className="mt-2 space-y-2">{profile.strengths.length?profile.strengths.map((item,index)=><div key={index} className="flex gap-2 text-[10px] leading-5 text-emerald-800"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span>{item}</span></div>):<span className="text-[10px] text-emerald-700">Henüz belirlenmedi.</span>}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3">
            <span className="text-[9px] font-black uppercase tracking-[.12em] text-amber-600">Öncelikler</span>
            <div className="mt-2 space-y-2">{profile.priorities.length?profile.priorities.map((item,index)=><div key={index} className="flex gap-2 text-[10px] leading-5 text-amber-800"><Target className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span>{item}</span></div>):<span className="text-[10px] text-amber-700">Henüz belirlenmedi.</span>}</div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-black text-slate-900">DNA Boyutları</h3>
        <div className="mt-5 space-y-5">{dims.map((item,index)=><div key={item.key}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <strong className="block truncate text-xs text-slate-800">{item.label}</strong>
              <span className="mt-1 block text-[9px] text-slate-400">{item.confidenceLabel} güven · {item.status==="strong"?"Güçlü":item.status==="priority"?"Öncelikli":"Gelişiyor"}</span>
            </div>
            <strong className="text-sm text-slate-900">%{Math.round(item.score)}</strong>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all duration-700" style={{width:`${Math.max(0,Math.min(100,item.score))}%`,backgroundColor:colorFor(index)}}/>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">{item.evidence}</p>
        </div>)}</div>
      </Card>
    </>:<HasatEmptyState
      title="Akademik DNA henüz oluşmadı"
      description="Ders ve soru bazlı analiz verileri yeterli olduğunda öğrencinin öğrenme profili burada gösterilecektir."
      icon={Dna}
    />}
  </div></>;
}
function TargetPage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  const target=report.targetAnalysis;
  const definition=target?.definition;
  const isDefined=Boolean(target?.isDefined);
  const targetName=[definition?.university,definition?.program].filter(Boolean).join(" · ");

  return <><Header title="Hedef & İlerleme" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <HasatPageIntro
      eyebrow="Hedef Yolculuğu"
      title="Hedef & İlerleme"
      description="Mevcut performans ile hedef net ve puan arasındaki farkı gerçek rapor verisiyle izleyin."
    />

    {isDefined&&target?<>
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6 text-white">
          <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-100">Hedef</span>
          <h2 className="mt-2 text-xl font-black">{targetName||"Tanımlı Hedef"}</h2>
          {definition?.scoreType&&<p className="mt-1 text-[10px] text-violet-100">{definition.scoreType}</p>}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div><span className="text-[9px] text-white/70">Mevcut Net</span><strong className="mt-1 block text-xl">{target.currentNet.toFixed(1)}</strong></div>
            <div><span className="text-[9px] text-white/70">Hedef Net</span><strong className="mt-1 block text-xl">{definition?.targetNet!==undefined?definition.targetNet.toFixed(1):"—"}</strong></div>
            <div><span className="text-[9px] text-white/70">Tamamlama</span><strong className="mt-1 block text-xl">%{Math.round(target.completionRate||0)}</strong></div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-white transition-all duration-700" style={{width:`${Math.max(0,Math.min(100,target.completionRate||0))}%`}}/></div>
        </div>
      </Card>

      <HasatStatStrip items={[
        {label:"Net Farkı",value:target.netGap!==undefined?target.netGap.toFixed(1):"—"},
        {label:"Mevcut Puan",value:target.currentScore?target.currentScore.toFixed(1):"—"},
        {label:"Hedef Puan",value:definition?.targetScore!==undefined?definition.targetScore.toFixed(1):"—"},
      ]}/>

      {target.opportunities.length>0&&<Card className="p-5">
        <h3 className="text-sm font-black text-slate-900">Net Artış Fırsatları</h3>
        <div className="mt-4 space-y-3">{target.opportunities.map((item,index)=><div key={`${item.subject}-${index}`} className="rounded-2xl bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3"><strong className="text-xs text-slate-800">{item.subject}</strong><span className="text-[10px] font-black text-emerald-600">+{item.suggestedGain.toFixed(1)} net</span></div>
          <div className="mt-2 flex justify-between text-[9px] text-slate-400"><span>Mevcut {item.currentNet.toFixed(1)}</span><span>Hedef {item.targetNet.toFixed(1)}</span></div>
        </div>)}</div>
      </Card>}

      {target.weeklyHours.length>0&&<Card className="p-5">
        <h3 className="text-sm font-black text-slate-900">Önerilen Haftalık Çalışma</h3>
        <div className="mt-4 space-y-3">{target.weeklyHours.map((item,index)=><div key={`${item.subject}-${index}`} className="flex items-start gap-3 rounded-2xl bg-blue-50 p-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"/>
          <div className="flex-1"><div className="flex justify-between gap-3"><strong className="text-xs text-blue-900">{item.subject}</strong><span className="text-[10px] font-black text-blue-700">{item.hours} saat</span></div><p className="mt-1 text-[10px] leading-5 text-blue-700">{item.reason}</p></div>
        </div>)}</div>
      </Card>}

      <Card className="p-5">
        <div className="flex gap-3"><BrainCircuit className="h-7 w-7 shrink-0 text-violet-600"/><div><span className="text-xs font-black text-violet-600">e-Nstitü AI Hedef Yorumu</span><p className="mt-2 text-xs leading-6 text-slate-600">{target.summary||report.successPrediction?.summary||"Hedef analizi hazır."}</p></div></div>
      </Card>
    </>:<HasatEmptyState
      title="Hedef henüz tanımlanmadı"
      description="Öğrencinin hedef üniversite, program, puan veya net bilgisi tanımlandığında ilerleme analizi burada gösterilecektir."
      icon={Target}
    />}
  </div></>;
}
function RiskPage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  return <><Header title="Akademik Riskler" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <FamilyRiskDetail risks={report.intelligence?.risks||[]}/>
  </div></>;
}
function DigitalTwinPage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  const profile=React.useMemo(
    ()=>buildAcademicDigitalProfileFromReports([report]),
    [report],
  );
  return <><Header title="Dijital İkiz" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <DigitalTwinSimulator profile={profile} examDate={report.examDate}/>
  </div></>;
}
function TeacherPage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  const teacher=report.teacherEvaluation;
  const decision=buildTeacherDecision(report);
  const hasTeacherNote=Boolean(
    teacher?.observation||
    teacher?.recommendation||
    teacher?.studentCommitment||
    report.aiEvaluation?.teacherMessage
  );

  return <><Header title="Öğretmen Karar Merkezi" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <HasatPageIntro
      eyebrow="Karar Desteği"
      title={report.student.name}
      description="Risk, ders önceliği ve performans verilerinden seçili öğrenci için öğretmen müdahale önerisi oluşturulur."
    />

    <FamilyTeacherDecisionCard decision={decision}/>

    {hasTeacherNote?<Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><User className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1">
          <span className="text-[9px] font-black uppercase tracking-[.14em] text-violet-600">Kayıtlı Öğretmen Notu</span>
          <h3 className="mt-1 text-sm font-black text-slate-900">{teacher?.teacherName||"Öğretmen Değerlendirmesi"}</h3>
          {teacher?.observation&&<p className="mt-3 text-[10px] leading-5 text-slate-600">{teacher.observation}</p>}
          {teacher?.recommendation&&<div className="mt-3 rounded-2xl bg-violet-50 p-3 text-[10px] leading-5 text-violet-800">{teacher.recommendation}</div>}
          {report.aiEvaluation?.teacherMessage&&<div className="mt-3 rounded-2xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-600">{report.aiEvaluation.teacherMessage}</div>}
        </div>
      </div>
    </Card>:<HasatEmptyState
      title="Kayıtlı öğretmen notu yok"
      description="Öğretmen gözlemi veya önerisi girildiğinde karar motorunun yanında bu alanda gösterilecektir."
      icon={User}
    />}
  </div></>;
}
function PlanPage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  const weeklyPlan=report.premium?.weeklyPlan||[];
  const suggestions=report.studySuggestions||[];
  const hasPlan=weeklyPlan.length>0||suggestions.length>0;
  return <><Header title="Çalışma Planı" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <HasatPageIntro eyebrow="Haftalık Yol Haritası" title="Çalışma Planım" description="Plan, sınav analizi ve gelişim alanlarına göre oluşturulan gerçek görevlerden oluşur."/>
    {hasPlan?<div className="space-y-4">
      {weeklyPlan.map((day,dayIndex)=><Card key={`${day.day}-${dayIndex}`} className="overflow-hidden p-0">
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white"><div><span className="text-[9px] font-bold text-emerald-100">Gün</span><strong className="block text-sm">{day.day}</strong></div><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold">{day.estimatedMinutes} dk</span></div>
        <div className="divide-y divide-slate-100">{day.tasks.map((task,index)=><div key={index} className="flex items-center gap-3 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{backgroundColor:colorFor(index)}}><BookOpen className="h-4 w-4"/></span><span className="flex-1 text-xs font-semibold text-slate-700">{task}</span><CheckCircle2 className="h-5 w-5 text-slate-300"/></div>)}</div>
      </Card>)}
      {!weeklyPlan.length&&suggestions.length>0&&<Card className="divide-y divide-slate-100 overflow-hidden">{suggestions.map((item,index)=><div key={index} className="flex items-start gap-3 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{backgroundColor:colorFor(index)}}><BookOpen className="h-4 w-4"/></span><div><strong className="block text-xs text-slate-900">{item.subject}</strong><p className="mt-1 text-[10px] leading-5 text-slate-500">{item.suggestion}</p></div></div>)}</Card>}
    </div>:<HasatEmptyState title="Çalışma planı henüz oluşturulmadı" description="Sınav analizi tamamlandığında kişiselleştirilmiş görevler bu alanda gösterilecektir." icon={CalendarDays}/>}
  </div></>;
}
function NotificationsPage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  const strongest=[...report.subjects].sort((a,b)=>subjectRate(b)-subjectRate(a))[0];
  const items=[
    {
      text:`${report.examName} raporu hazırlandı.`,
      date:report.reportDate||report.examDate||"Yeni",
      icon:FileText,
      tone:"text-violet-600 bg-violet-100",
    },
    strongest?{
      text:`${strongest.subjectName} bu sınavın en güçlü dersi oldu.`,
      date:"Sınav analizi",
      icon:TrendingUp,
      tone:"text-blue-600 bg-blue-100",
    }:null,
    report.academicDna?.priorities?.[0]?{
      text:report.academicDna.priorities[0],
      date:"Akademik DNA",
      icon:Dna,
      tone:"text-orange-600 bg-orange-100",
    }:null,
    report.teacherEvaluation?.observation?{
      text:"Öğretmen değerlendirmesi eklendi.",
      date:report.teacherEvaluation.evaluationDate||"Yeni",
      icon:User,
      tone:"text-emerald-600 bg-emerald-100",
    }:null,
    report.targetAnalysis?.isDefined?{
      text:`Hedef ilerleme oranı %${Math.round(report.targetAnalysis.completionRate||0)}.`,
      date:"Hedef analizi",
      icon:Target,
      tone:"text-rose-600 bg-rose-100",
    }:null,
  ].filter(Boolean) as Array<{text:string;date:string;icon:React.ElementType;tone:string}>;

  return <><Header title="Bildirimler" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <HasatPageIntro eyebrow="Güncellemeler" title="Bildirim Merkezi" description="Yalnızca bu canlı akademik dosyaya ait gerçek gelişmeler gösterilir."/>
    {items.length?items.map((item,index)=>{const Icon=item.icon;return <Card key={index} className="flex items-start gap-3 p-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}><Icon className="h-5 w-5"/></span><div className="flex-1"><strong className="text-xs leading-5 text-slate-800">{item.text}</strong><span className="mt-1 block text-[9px] text-slate-400">{item.date}</span></div></Card>}):<HasatEmptyState title="Yeni bildirim yok" description="Yeni sınav, hedef veya öğretmen değerlendirmesi eklendiğinde burada gösterilecektir." icon={Bell}/>}
  </div></>;
}
function MessagesPage({report,token,back}:{report:StudentReportV2Data;token?:string;back:()=>void}){
  const [messages,setMessages]=React.useState<FamilyServerMessage[]>([]);
  const [loading,setLoading]=React.useState(true);
  const [info,setInfo]=React.useState("");
  const [pushEnabled,setPushEnabled]=React.useState(false);

  const load=React.useCallback(async(markOpened=true)=>{
    if(!token){setLoading(false);setInfo("Bu cihazda canlı veli bağlantısı bulunmadığı için mesaj eşitlemesi kullanılamıyor.");return;}
    try{
      const result=await familyRequest<{items:FamilyServerMessage[]}>(`/api/family-messages/${encodeURIComponent(token)}`);
      const rows=Array.isArray(result.items)?result.items:[];
      setMessages(rows);
      if(markOpened){
        const unread=rows.filter(item=>!item.openedAt);
        await Promise.allSettled(unread.map(item=>familyRequest(`/api/family-messages/${encodeURIComponent(token)}/${encodeURIComponent(item.receiptId)}/opened`,{method:"POST",body:"{}"})));
        if(unread.length)setMessages(current=>current.map(item=>unread.some(row=>row.receiptId===item.receiptId)?{...item,openedAt:new Date().toISOString()}:item));
      }
    }catch(reason:any){setInfo(reason?.message||"Mesajlar yüklenemedi.");}
    finally{setLoading(false);}
  },[token]);

  React.useEffect(()=>{void load(true);},[load]);

  const enablePush=async()=>{
    if(!token){setInfo("Push bildirimleri için güncel canlı veli bağlantısı gerekir.");return;}
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){setInfo("Bu cihaz Web Push bildirimini desteklemiyor.");return;}
    try{
      const permission=await Notification.requestPermission();
      if(permission!=="granted"){setInfo("Bildirim izni verilmedi.");return;}
      const registration=await navigator.serviceWorker.ready;
      const key=await familyRequest<{publicKey:string}>("/api/push/public-key");
      let subscription=await registration.pushManager.getSubscription();
      if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(key.publicKey)});}
      await familyRequest(`/api/family-push/${encodeURIComponent(token)}/subscribe`,{method:"POST",body:JSON.stringify({subscription:subscription.toJSON(),startUrl:window.location.href,userAgent:navigator.userAgent})});
      setPushEnabled(true);setInfo("Sesli push bildirimleri etkinleştirildi.");
    }catch(reason:any){setInfo(reason?.message||"Push bildirimi etkinleştirilemedi.");}
  };

  return <><Header title="Mesajlar" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <HasatPageIntro eyebrow="Okul–Veli İletişimi" title="Bilgilendirmeler" description="Öğretmenlerinizin gönderdiği bilgilendirmeler burada saklanır. Açtığınız mesajın okundu bilgisi öğretmene iletilir."/>
    <Card className="p-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Bell className="h-5 w-5"/></span><div className="min-w-0 flex-1"><strong className="block text-xs text-slate-900">Sesli bildirim</strong><span className="mt-1 block text-[10px] leading-4 text-slate-400">Uygulama kapalıyken Android sistem bildirim sesi; uygulama açıkken e-Nstitü özel kısa uyarı sesi kullanılır.</span></div><button type="button" onClick={()=>void enablePush()} className={`rounded-xl px-3 py-2 text-[10px] font-black ${pushEnabled?"bg-emerald-100 text-emerald-700":"bg-emerald-600 text-white"}`}>{pushEnabled?"Açık":"Etkinleştir"}</button></div></Card>
    {info&&<div className="rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600">{info}</div>}
    {loading?<Card className="p-5 text-center text-xs font-bold text-slate-500">Mesajlar yükleniyor…</Card>:messages.length?messages.map(message=><Card key={message.receiptId} className="p-4"><div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-blue-100 font-black text-emerald-700">{initials(message.teacherName)}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><strong className="block text-xs text-slate-900">{message.title}</strong><span className="mt-0.5 block text-[9px] font-bold text-emerald-700">{message.teacherName}</span></div><span className="shrink-0 text-[9px] text-slate-400">{String(message.sentAt||"").replace("T"," ").slice(0,16)}</span></div><p className="mt-3 whitespace-pre-wrap text-[11px] leading-5 text-slate-600">{message.body}</p><div className="mt-3 flex flex-wrap gap-1.5"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-700">Okundu</span>{message.reminderCount? <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black text-amber-700">{message.reminderCount} hatırlatma</span>:null}</div></div></div></Card>):<HasatEmptyState title="Henüz bilgilendirme yok" description="Öğretmeniniz uygulama üzerinden bilgilendirme gönderdiğinde burada görüntülenecektir." icon={MessageCircle}/>} 
  </div></>;
}

function ReportCardsPage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  const subjects=[...report.subjects].sort((a,b)=>subjectRate(b)-subjectRate(a));
  return <div className="space-y-4">
    <Header title="Öğrenci Karnesi" onBack={back}/>
    <Card className="p-5">
      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">e-Nstitü AİLE</span>
      <h2 className="mt-1 text-xl font-black text-slate-900">Ders Bazlı Öğrenci Karnesi</h2>
      <p className="mt-2 text-xs text-slate-500">Genel başarı %{Math.round(report.totals.successRate||0)} · Toplam net {number(report.totals.net).toFixed(2)}</p>
    </Card>
    <div className="space-y-3">{subjects.map((subject,index)=><Card key={`${subject.subjectName}-${index}`} className="p-4">
      <div className="flex items-center justify-between gap-4"><div className="min-w-0"><strong className="block truncate text-sm text-slate-900">{subject.subjectName}</strong><span className="mt-1 block text-[10px] text-slate-400">{subject.correct} doğru · {subject.wrong} yanlış · {subject.empty} boş · {number(subject.net).toFixed(2)} net</span></div><span className="shrink-0 text-lg font-black text-emerald-700">%{Math.round(subjectRate(subject))}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:`${Math.max(0,Math.min(100,subjectRate(subject)))}%`}}/></div>
    </Card>)}</div>
  </div>;
}

function ProfilePage({report,back}:{report:StudentReportV2Data;back:()=>void}){
  const profileRows=[
    ["Öğrenci No",report.student.number||"—"],
    ["Sınıf",report.student.classroom||report.student.branch||"—"],
    ["Son Sınav",report.examName],
    ["Rapor Tarihi",report.reportDate||report.examDate||"—"],
    ["Rapor Kodu",report.reportCode||"—"],
  ];
  return <><Header title="Profilim" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-[#082f58] to-[#13a66d] px-6 py-8 text-center text-white">
        <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white/15 text-3xl font-black ring-4 ring-white/15">{report.student.photoUrl?<img src={report.student.photoUrl} className="h-full w-full object-cover"/>:initials(report.student.name)}</div>
        <h2 className="mt-4 text-xl font-black">{report.student.name}</h2>
        <p className="mt-1 text-sm text-emerald-100">{report.schoolName}</p>
      </div>
      <div className="divide-y divide-slate-100 bg-white">{profileRows.map(([label,value])=><div key={String(label)} className="flex items-center justify-between gap-4 p-4 text-xs"><span className="text-slate-400">{label}</span><strong className="max-w-[65%] text-right text-slate-900">{value}</strong></div>)}</div>
    </Card>
  </div></>;
}
function SettingsPage({back}:{back:()=>void}){
  const settings=[
    {label:"Bildirimler",detail:"Yeni sınav ve değerlendirme bildirimleri",icon:Bell},
    {label:"Görünüm",detail:"Telefonun sistem temasını kullanır",icon:Smartphone},
    {label:"Gizlilik",detail:"Canlı rapor bağlantısı kişiye özeldir",icon:ShieldCheck},
    {label:"Ana Ekrana Ekle",detail:"e-Nstitü AİLE’yi uygulama gibi kullanın",icon:Download},
  ];

  return <><Header title="Ayarlar" onBack={back}/><div className="space-y-4 p-4 pb-28">
    <HasatPageIntro eyebrow="Uygulama" title="Ayarlar" description="e-Nstitü AİLE’nin kullanım ve güvenlik tercihlerini görüntüleyin."/>
    <Card className="divide-y divide-slate-100 overflow-hidden">{settings.map(({label,detail,icon:Icon})=><div key={label} className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><Icon className="h-5 w-5"/></div>
      <div className="flex-1"><strong className="block text-xs text-slate-900">{label}</strong><span className="mt-1 block text-[10px] text-slate-400">{detail}</span></div>
    </div>)}</Card>
    <Card className="p-4">
      <span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-600">e-Nstitü AİLE</span>
      <h3 className="mt-1 text-sm font-black text-slate-900">Sürüm 4.0 RC1</h3>
      <p className="mt-2 text-[10px] leading-5 text-slate-500">Canlı akademik dosya, yalnızca özel bağlantıya sahip kullanıcılar tarafından görüntülenebilir.</p>
    </Card>
  </div></>;
}
function GenericPage({section,report,token,back}:{section:FamilySection;report:StudentReportV2Data;token?:string;back:()=>void}){
  if(section==="teacher") return <TeacherPage report={report} back={back}/>;
  if(section==="notifications") return <NotificationsPage report={report} back={back}/>;
  if(section==="messages") return <MessagesPage report={report} token={token} back={back}/>;
  if(section==="report-cards") return <ReportCardsPage report={report} back={back}/>;
  if(section==="profile") return <ProfilePage report={report} back={back}/>;
  if(section==="children") return <><Header title="Çocuklarım" onBack={back}/><div className="p-4 pb-28"><Card className="flex items-center gap-4 p-4"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">{initials(report.student.name)}</div><div className="flex-1"><strong className="block">{report.student.name}</strong><span className="text-xs text-slate-400">{report.student.classroom} · {report.schoolName}</span></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-700">Aktif</span></Card></div></>;
  if(section==="install"){
    const ua=typeof navigator!=="undefined"?navigator.userAgent:"";
    const ios=/iphone|ipad|ipod/i.test(ua);
    const steps=ios
      ? ["Safari’de Paylaş simgesine dokunun.","Ana Ekrana Ekle seçeneğine dokunun.","Ekle düğmesine dokunun."]
      : ["Chrome’un sağ üst köşesindeki ⋮ menüsüne dokunun.","Yükle ve kısayol oluştur seçeneğine dokunun.","Uygulamayı yükle seçeneğini seçin."];
    return <><Header title="e-Nstitü AİLE’yi Ana Ekrana Ekleyin" onBack={back}/><div className="p-6 pb-28 text-center"><Download className="mx-auto h-20 w-20 text-emerald-600"/><h2 className="mt-6 text-xl font-black">Uygulama gibi kullanın</h2><p className="mx-auto mt-3 max-w-sm text-xs leading-6 text-slate-500">Kurulum penceresi otomatik açılmazsa aşağıdaki adımları kullanın.</p><div className="mt-8 space-y-4 text-left">{steps.map((text,index)=><Card key={text} className="flex items-center gap-4 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-black text-white">{index+1}</span><span className="text-sm font-bold">{text}</span></Card>)}</div></div></>;
  }
  return <><Header title="e-Nstitü AİLE" onBack={back}/><div className="p-4 pb-28"><Card className="p-8 text-center"><Sparkles className="mx-auto h-12 w-12 text-emerald-600"/><h2 className="mt-4 text-lg font-black">Bu bölüm hazırlanıyor</h2></Card></div></>;
}

export default function HasatFamilyApp({report,token}:Props){
  const [section,setSection]=React.useState<FamilySection>("home");
  const [history,setHistory]=React.useState<FamilySection[]>([]);
  const [deferredPrompt,setDeferredPrompt]=React.useState<any>(()=>(window as any).__hasatPwaInstallPrompt||null);
  const lastFamilyMessageIds=React.useRef<Set<string>|null>(null);

  React.useEffect(()=>{
    if(!token)return;
    let active=true;
    const check=async()=>{
      try{
        const result=await familyRequest<{items:FamilyServerMessage[]}>(`/api/family-messages/${encodeURIComponent(token)}`);
        if(!active)return;
        const ids=new Set((result.items||[]).map(item=>item.messageId));
        if(lastFamilyMessageIds.current){
          const hasNew=[...ids].some(id=>!lastFamilyMessageIds.current?.has(id));
          if(hasNew){playFamilyMessageSound(); if(navigator.vibrate)navigator.vibrate([180,90,260]);}
        }
        lastFamilyMessageIds.current=ids;
      }catch{}
    };
    void check();
    const timer=window.setInterval(()=>void check(),15000);
    return()=>{active=false;window.clearInterval(timer);};
  },[token]);

  React.useEffect(()=>{
    const syncPrompt=()=>setDeferredPrompt((window as any).__hasatPwaInstallPrompt||null);
    const handler=(event:any)=>{event.preventDefault();(window as any).__hasatPwaInstallPrompt=event;setDeferredPrompt(event);};
    const installed=()=>setDeferredPrompt(null);
    syncPrompt();
    window.addEventListener("beforeinstallprompt",handler);
    window.addEventListener("hasat:pwa-install-ready",syncPrompt);
    window.addEventListener("hasat:pwa-installed",installed);
    return()=>{
      window.removeEventListener("beforeinstallprompt",handler);
      window.removeEventListener("hasat:pwa-install-ready",syncPrompt);
      window.removeEventListener("hasat:pwa-installed",installed);
    };
  },[]);

  React.useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("familyMessage"))setSection("messages");
  },[]);

  const go=(next:FamilySection)=>{if(next!==section)setHistory(value=>[...value,section]);setSection(next);window.scrollTo({top:0,behavior:"smooth"});};
  const back=()=>{const copy=[...history];const previous=copy.pop()||"home";setHistory(copy);setSection(previous);window.scrollTo({top:0,behavior:"smooth"});};
  const install=async()=>{
    const prompt=deferredPrompt||(window as any).__hasatPwaInstallPrompt;
    if(prompt){
      await prompt.prompt();
      await prompt.userChoice;
      (window as any).__hasatPwaInstallPrompt=null;
      setDeferredPrompt(null);
      return;
    }
    go("install");
  };

  let content:React.ReactNode;
  if(section==="home") content=<HomePage report={report} go={go} installable={Boolean(deferredPrompt)} onInstall={install}/>;
  else if(section==="exams") content=<ExamsPage report={report} back={back}/>;
  else if(section==="analysis") content=<AnalysisPage report={report} back={back} go={go}/>;
  else if(section==="dna") content=<DnaPage report={report} back={back}/>;
  else if(section==="target") content=<TargetPage report={report} back={back}/>;
  else if(section==="risks") content=<RiskPage report={report} back={back}/>;
  else if(section==="digital-twin") content=<DigitalTwinPage report={report} back={back}/>;
  else if(section==="plan") content=<PlanPage report={report} back={back}/>;
  else if(section==="settings") content=<SettingsPage back={back}/>;
  else content=<GenericPage section={section} report={report} token={token} back={back}/>;

  return <div className="min-h-screen bg-[#f3f7fb] text-slate-800"><div className="mx-auto min-h-screen max-w-[560px] bg-[#f7f9fc] shadow-[0_0_80px_rgba(15,42,72,.12)]">{content}<BottomNav active={section} go={go}/></div></div>;
}
