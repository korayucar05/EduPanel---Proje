import React from "react";
import localforage from "../../../core/state/AppStateService";
import { Activity, AlertTriangle, ArrowUpDown, Bot, Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Coins, Eye, FileText, GraduationCap, MessageCircle, RotateCcw, Search, SlidersHorizontal, Sparkles, Target, Trophy, TrendingUp, UserRound, Users } from "lucide-react";
import { exportTablePdf, type PdfSection, type ScorecardHeader } from "../../../utils/tablePdf";
import { analyzeItems } from "../item-analysis/ItemAnalysisModule";
import { buildTopicAnalysisRows, exportTopicAnalysisPdf } from "../topic-analysis/TopicAnalysisModule";
import { compareClassroomNames } from "../../../utils/classroomSort";

import { fetchAcademicCatalogFromLocalDatabase, fetchCollectionFromLocalDatabase } from "../../../core/data/LegacyDatabaseFacade";
import { urlToDataUrl } from "../../../pdf/core/PdfHelpers";
import { buildReportFamilyPdfHeader } from "../../../pdf/components/ReportFamilyHeader";
import { buildStudentReportV2Data } from "../../../reports-v2/utils/buildStudentReportV2Data";
import { buildAdminDecisionDashboard } from "../../../intelligence/admin";
import { buildTeacherCohortDecision } from "../../../intelligence/teacher";
import { runIntelligenceKernel } from "../../../intelligence-v3";
import AdditionalReportSections from "./components/AdditionalReportSections";
import ReportsOverlayLayer from "./components/ReportsOverlayLayer";
import IntelligenceReportPanels from "./components/IntelligenceReportPanels";
import { DEVELOPMENT_REPORT_TEXT, ReportsRuntimeBoundary, PdfPreviewOverlay, safeIntelligenceCompute, EMPTY_WARNING, EMPTY_EXECUTIVE, rankOnly, participationOnly, subjectResult, finiteNumber, safeFixed, averagePerformance, REPORT_QUEUE_KEY, type Props, type ReportAudience, type ReportItem, type ReportFocus } from "./reportsShared";
import { buildAcademicDigitalProfileFromReports, buildAcademicDnaCohort, buildBrainCohort, buildBrainTimelineCohort, buildEarlyWarningCenter, buildExecutiveCenter, runBrainScoreEngine, runCopilotOptimizer, runSchoolDigitalTwin, runUniversitySimulation } from "../../../intelligence-v2";

import { sqliteStorage } from "../../../core/state/SyncStateStore";
import { examAnalysisService } from "../../../modules/exam/ExamAnalysisService";

const formatScorecardDate=(value:any)=>{
  const raw=String(value||"").trim();
  if(!raw)return "-";
  const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(match)return `${match[3]}.${match[2]}.${match[1]}`;
  return raw.includes("T")?raw.split("T")[0].split("-").reverse().join("."):raw;
};
const hasatReportLogoUrl=new URL("../../../assets/branding/hasat-report-logo.png",import.meta.url).href;
const enstituReportLogoUrl=new URL("../../../assets/splash/enstitu-logo-transparent.png",import.meta.url).href;
const enstituCampusUrl=new URL("../../../assets/enstitu-login-campus.png",import.meta.url).href;
const institutionReportHeaderV24Url=new URL("../../../assets/institution-report-header-v24.png",import.meta.url).href;
const standardReportHeaderUrl=new URL("../../../assets/standard-report-header.png",import.meta.url).href;
const reportFamilySchoolLogoUrl=new URL("../../../assets/ordu-lisesi-logo.png",import.meta.url).href;
const reportFamilyCampusUrl=new URL("../../../assets/ordu-lisesi-campus-report.png",import.meta.url).href;

async function generatePdf(
  documentDefinition: Record<string, any>,
  options: any = {}
): Promise<any> {
  const { PdfEngine } = await import("../../../pdf/core/PdfEngine");
  return PdfEngine.generate(documentDefinition, options);
}
function ReportsModuleInner({exam,results,selectedStudent,availableExams=[],evaluateExam,reportCategory="admin",showAllCategories=false,focusedReport:controlledFocusedReport,onFocusedReportChange}:Props){
  const storedResultsForExam=(targetExam:any)=>examAnalysisService.resultsForExam(targetExam);

  // Sınav Raporları ekranının kullandığı sonuç kümesini öğrenci uygulamasına
  // kanonik snapshot olarak aktar. Böylece rapordaki değerler telefonda birebir görünür.
  const studentPortalSnapshotSignature = exam?.id
    ? `${exam.id}|${exam.examDate || ""}|${Array.isArray(results) ? results.length : 0}|${(Array.isArray(results) ? results : [])
        .map((row:any)=>`${row?.recordId || row?.studentNumber || row?.id || ""}:${Number(row?.totals?.net || 0).toFixed(4)}`)
        .join("|")}`
    : "";

  React.useEffect(()=>{
    if(!exam?.id || !Array.isArray(results) || results.length===0) return;
    const controller=new AbortController();
    const sync=async()=>{
      try{
        const response=await fetch(
          `/api/student-portal/exam-results/snapshot/${encodeURIComponent(String(exam.id))}`,
          {
            method:"PUT",
            cache:"no-store",
            signal:controller.signal,
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
              source:"exam-reports",
              exam:{
                id:exam.id,
                examName:exam.examName,
                examDate:exam.examDate,
                gradeLevel:exam.gradeLevel,
                publisherName:exam.publisherName,
                examType:exam.examType,
              },
              results,
            }),
          },
        );
        if(!response.ok){
          const data=await response.json().catch(()=>({}));
          console.warn("Öğrenci uygulaması rapor sonucu eşitlenemedi:",data?.error||response.status);
        }
      }catch(error:any){
        if(error?.name!=="AbortError") console.warn("Öğrenci uygulaması rapor eşitleme uyarısı:",error);
      }
    };
    void sync();
    return()=>controller.abort();
  },[studentPortalSnapshotSignature]);
  const [showDevelopmentText,setShowDevelopmentText]=React.useState(false);
  const [showWhatsAppModal,setShowWhatsAppModal]=React.useState(false);
  const [showStudentReportV2,setShowStudentReportV2]=React.useState(false);
  const [showInstitutionReportV2,setShowInstitutionReportV2]=React.useState(false);
  const [showBranchReportV2,setShowBranchReportV2]=React.useState(false);
  const [showItemAnalysisReportV2,setShowItemAnalysisReportV2]=React.useState(false);
  const [showAdminDecisionCenter,setShowAdminDecisionCenter]=React.useState(false);
  const [showTeacherDecisionCenter,setShowTeacherDecisionCenter]=React.useState(false);
  const [showHasatAdvisor,setShowHasatAdvisor]=React.useState(false);
  const [showBrainDashboard,setShowBrainDashboard]=React.useState(false);
  const [showAcademicDnaDashboard,setShowAcademicDnaDashboard]=React.useState(false);
  const [showBrainTimeline,setShowBrainTimeline]=React.useState(false);
  const [showCopilotOptimizer,setShowCopilotOptimizer]=React.useState(false);
  const [showSchoolDigitalTwin,setShowSchoolDigitalTwin]=React.useState(false);
  const [showExecutiveCenter,setShowExecutiveCenter]=React.useState(false);
  const [showUniversityIntelligence,setShowUniversityIntelligence]=React.useState(false);
  const [showEarlyWarningCenter,setShowEarlyWarningCenter]=React.useState(false);
  const [showIntelligenceKernel,setShowIntelligenceKernel]=React.useState(false);
  const [activeReportView,setActiveReportView]=React.useState<"admin"|"teacher"|"student"|"parent"|"guidance"|"mentor"|"champions"|"points">(reportCategory);
  const [adminDecisionCard,setAdminDecisionCard]=React.useState<"overview"|"interventions"|"strengths"|"recommendations">("overview");
  const [adminInterventionLevel,setAdminInterventionLevel]=React.useState<"all"|"critical"|"high"|"medium">("all");
  const [adminInterventionClassroom,setAdminInterventionClassroom]=React.useState("all");
  const [adminInterventionSearch,setAdminInterventionSearch]=React.useState("");
  const [adminInterventionExpandedId,setAdminInterventionExpandedId]=React.useState<string|null>(null);
  const [adminRankingMode,setAdminRankingMode]=React.useState<"institution"|"classroom"|"subject">("institution");
  const [adminRankingClassroom,setAdminRankingClassroom]=React.useState("all");
  const [adminRankingSubject,setAdminRankingSubject]=React.useState("all");
  const [adminRankingSearch,setAdminRankingSearch]=React.useState("");
  const [adminRankingLimit,setAdminRankingLimit]=React.useState<10|50|100|0>(100);
  const [adminRankingSort,setAdminRankingSort]=React.useState<"ranking"|"net"|"score"|"name"|"wrong">("ranking");
  const [adminRankingOnlyBelowAverage,setAdminRankingOnlyBelowAverage]=React.useState(false);
  const [adminRankingDensity,setAdminRankingDensity]=React.useState<"compact"|"comfortable">("compact");
  const [adminRankingShowHeatmap,setAdminRankingShowHeatmap]=React.useState(true);
  const [adminRankingZoom,setAdminRankingZoom]=React.useState<70|85|100>(85);
  const [adminRankingSelected,setAdminRankingSelected]=React.useState<any|null>(null);
  const [adminRankingPlanChecks,setAdminRankingPlanChecks]=React.useState<Record<string,boolean>>({});
  const [showAdminRankingFullscreen,setShowAdminRankingFullscreen]=React.useState(false);
  const [openReportSections,setOpenReportSections]=React.useState<Record<string,boolean>>({
    "Yönetici Raporları":showAllCategories,
    "Öğretmen Raporları":false,
    "Rehberlik Raporları":false,
    "Öğrenci Raporları":false,
    "Veli Raporları":false,
    "Mentörler İçin Öğrenci Gelişim Raporları":false,
    "Şampiyonlar Ligi":false,
    "Kazanılabilir Puanlar":false,
  });
  const toggleReportSection=(sectionTitle:string)=>{
    setOpenReportSections((current)=>({
      ...current,
      [sectionTitle]:!current[sectionTitle],
    }));
  };
  React.useEffect(()=>{
    setActiveReportView(showAllCategories?"admin":reportCategory);
    setShowAdminDecisionCenter(false);
    setShowTeacherDecisionCenter(false);
    setShowHasatAdvisor(false);
    setShowBrainDashboard(false);
    setShowAcademicDnaDashboard(false);
    setShowBrainTimeline(false);
    setShowCopilotOptimizer(false);
    setShowSchoolDigitalTwin(false);
    setShowExecutiveCenter(false);
    setShowUniversityIntelligence(false);
    setShowEarlyWarningCenter(false);
    setShowIntelligenceKernel(false);
    setAdminDecisionCard("overview");
    setOpenReportSections({
      "Yönetici Raporları":showAllCategories,
      "Öğretmen Raporları":false,
      "Rehberlik Raporları":false,
      "Öğrenci Raporları":false,
      "Veli Raporları":false,
      "Mentörler İçin Öğrenci Gelişim Raporları":false,
      "Şampiyonlar Ligi":false,
      "Kazanılabilir Puanlar":false,
    });
  },[exam?.id,reportCategory,showAllCategories]);
  const developmentReportText = DEVELOPMENT_REPORT_TEXT;



  const developmentStudentIdentity=(student:any)=>String(
    student?.recordId||student?.id||student?.studentNumber||
    student?.schoolNumber||student?.studentNo||""
  ).trim();

  const developmentStudentNumber=(student:any)=>String(
    student?.studentNumber||student?.schoolNumber||student?.studentNo||""
  ).trim();

  const selectedDevelopmentIdentity=developmentStudentIdentity(selectedStudent);
  const selectedDevelopmentNumber=developmentStudentNumber(selectedStudent);

  const developmentHistory=React.useMemo(()=>{
    if(!selectedStudent||!evaluateExam)return [];

    return (availableExams||[])
      .map((historyExam:any)=>{
        try{
          const evaluatedResult=storedResultsForExam(historyExam);
          const evaluated=Array.isArray(evaluatedResult)?evaluatedResult:[];

          const studentResult=evaluated.find((candidate:any)=>{
            const candidateIdentity=developmentStudentIdentity(candidate);
            const candidateNumber=developmentStudentNumber(candidate);
            return (
              (selectedDevelopmentIdentity&&candidateIdentity===selectedDevelopmentIdentity)||
              (selectedDevelopmentNumber&&candidateNumber===selectedDevelopmentNumber)
            );
          });
          if(!studentResult)return null;

          const ranked=[...evaluated].sort(
            (a:any,b:any)=>Number(b?.totals?.net||b?.net||0)-Number(a?.totals?.net||a?.net||0)
          );
          const institutionRank=ranked.findIndex((candidate:any)=>{
            const candidateIdentity=developmentStudentIdentity(candidate);
            const candidateNumber=developmentStudentNumber(candidate);
            return (
              (selectedDevelopmentIdentity&&candidateIdentity===selectedDevelopmentIdentity)||
              (selectedDevelopmentNumber&&candidateNumber===selectedDevelopmentNumber)
            );
          })+1;

          const institutionAverage=evaluated.length
            ? evaluated.reduce(
                (sum:number,candidate:any)=>sum+Number(candidate?.totals?.net||candidate?.net||0),
                0
              )/evaluated.length
            : 0;

          return {
            examName:String(historyExam?.examName||historyExam?.name||"Sınav"),
            examDate:String(historyExam?.examDate||historyExam?.date||historyExam?.createdAt||""),
            net:Number(studentResult?.totals?.net||(studentResult as any)?.net||0),
            institutionRank:institutionRank>0?institutionRank:null,
            institutionAverage:Number(institutionAverage.toFixed(2)),
          };
        }catch(error){
          console.error("Gelişim geçmişi hesaplanamadı:",error);
          return null;
        }
      })
      .filter(Boolean)
      .sort((a:any,b:any)=>{
        const aDate=new Date(a.examDate||0).getTime();
        const bDate=new Date(b.examDate||0).getTime();
        return aDate!==bDate
          ? aDate-bDate
          : a.examName.localeCompare(b.examName,"tr-TR",{numeric:true,sensitivity:"base"});
      });
  },[
    availableExams,
    evaluateExam,
    selectedDevelopmentIdentity,
    selectedDevelopmentNumber,
    selectedStudent,
  ]);

  const lastFiveDevelopmentExams=developmentHistory.slice(-5);
  const developmentExamCount=developmentHistory.length;

  const developmentReliability=
    developmentExamCount>=8
      ? {label:"Çok Güvenilir Analiz",detail:`${developmentExamCount} deneme bulundu.`,tone:"border-blue-200 bg-blue-50 text-blue-800"}
      : developmentExamCount>=5
        ? {label:"Güvenilir Analiz",detail:"Son 5 deneme tam olarak değerlendirilebilir.",tone:"border-emerald-200 bg-emerald-50 text-emerald-800"}
        : developmentExamCount>=3
          ? {label:"Gelişim İzleniyor",detail:`${developmentExamCount} deneme bulundu; bazı analizler ön değerlendirme düzeyindedir.`,tone:"border-amber-200 bg-amber-50 text-amber-800"}
          : developmentExamCount>=2
            ? {label:"Ön Değerlendirme",detail:"İki deneme ile temel değişim görülebilir.",tone:"border-orange-200 bg-orange-50 text-orange-800"}
            : {label:"Yeterli Veri Yok",detail:"Gelişim analizi için en az iki deneme gereklidir.",tone:"border-slate-200 bg-slate-50 text-slate-600"};

  const netSeries=lastFiveDevelopmentExams.map((entry:any)=>entry.net);
  const firstNet=netSeries[0]??0;
  const lastNet=netSeries[netSeries.length-1]??0;
  const netChangePercent=
    netSeries.length>=2
      ? firstNet===0
        ? lastNet>0?100:0
        : Number((((lastNet-firstNet)/Math.abs(firstNet))*100).toFixed(1))
      : 0;

  const netTrendLabel=
    netSeries.length<2?"Yeterli veri yok":
    netChangePercent>=15?"Çok Güçlü Gelişim":
    netChangePercent>=8?"Güçlü Gelişim":
    netChangePercent>=3?"Düzenli Gelişim":
    netChangePercent>=-3?"İstikrarlı":
    netChangePercent>=-8?"Düşüş Eğilimi":"Kritik Düşüş";

  const netRange=netSeries.length
    ? Number((Math.max(...netSeries)-Math.min(...netSeries)).toFixed(2))
    : 0;

  const rankSeries=lastFiveDevelopmentExams
    .map((entry:any)=>entry.institutionRank)
    .filter((value:any)=>Number.isFinite(value));

  const rankDevelopmentLabel=
    rankSeries.length<2?"Yeterli veri yok":
    rankSeries[rankSeries.length-1]<rankSeries[0]?"Sıralama Yükseliyor":
    rankSeries[rankSeries.length-1]>rankSeries[0]?"Sıralama Geriliyor":
    "Sıralama Sabit";

  const aboveAverageCount=lastFiveDevelopmentExams.filter(
    (entry:any)=>entry.net>entry.institutionAverage
  ).length;

  const developmentCards=[
    {title:"Değişim-Durum",minimum:2,description:"Son 5 deneme sınavındaki puan veya netlerin eğimi hesaplanır.",result:developmentExamCount>=2?`${netTrendLabel} (${netChangePercent>=0?"+":""}%${netChangePercent})`:""},
    {title:"Kazanım Gelişim Endeksi",minimum:2,description:"Sıralamaya göre başarı yüzdesinin artışı, düşüşü veya aynı düzeyde kalması izlenir.",result:developmentExamCount>=2?"Kazanım karşılaştırması için veri hazır":""},
    {title:"Zor Sorulardaki Başarı",minimum:3,description:"Orta ve zor sorulardaki başarının son denemelerdeki eğilimi değerlendirilir.",result:developmentExamCount>=3?"Zor soru eğilimi analiz edilebilir":""},
    {title:"Dikkatsizlik Endeksi",minimum:3,description:"Katılımcıların %70 ve üzerinin doğru yaptığı sorulardaki yanlışlar takip edilir.",result:developmentExamCount>=3?"Kolay soru hataları izlenebilir":""},
    {title:"Risk Alma Başarısı",minimum:3,description:"Daha önce boş bırakılan kazanım sorularının sonraki sınavlarda doğru cevaplanıp cevaplanmadığı incelenir.",result:developmentExamCount>=3?"Boş cevap dönüşümü izlenebilir":""},
    {title:"Net İstikrarı",minimum:5,description:"Son beş denemedeki en yüksek ve en düşük net arasındaki fark değerlendirilir.",result:developmentExamCount>=5?`${netRange<=10?"İstikrarlı":"Dalgalı"} • Net farkı: ${netRange}`:""},
    {title:"Ders Bazlı Gelişim",minimum:2,description:"Her ders için başarı yüzdesi sınava giren öğrenciler arasındaki sıralamaya göre belirlenir.",result:developmentExamCount>=2?"Ders sıralama yüzdeleri karşılaştırılabilir":""},
    {title:"Kalıcı Öğrenme",minimum:5,description:"Kazanım başarısının aynı kalması, yükselmesi veya %30 üzeri dalgalanması incelenir.",result:developmentExamCount>=5?"Kazanım kalıcılığı değerlendirilebilir":""},
    {title:"Sıralama Gelişimi",minimum:2,description:"Sınıf, okul ve genel sıralamadaki değişim takip edilir.",result:developmentExamCount>=2?rankDevelopmentLabel:""},
    {title:"Ortalama Üzeri Başarı",minimum:2,description:"Öğrencinin ders ve genel sınav başarısının sınıf ve kurum ortalamalarına göre seyri izlenir.",result:developmentExamCount>=2?`Son ${lastFiveDevelopmentExams.length} sınavın ${aboveAverageCount} tanesinde kurum ortalamasının üzerinde`:""},
    {title:"Hedefe Yaklaşma Endeksi",minimum:2,description:"Genel ve ders bazlı hedeflere yaklaşma oranı takip edilir.",result:developmentExamCount>=2?"Hedef tanımlandığında ilerleme hesaplanabilir":""},
    {title:"Gelişim Puanı",minimum:5,description:"Tüm gelişim kriterlerinin ağırlıklı ortalamasından 0–100 arası gelişim puanı oluşturulur.",result:developmentExamCount>=5?"Tüm gelişim bileşenleri hesaplamaya hazır":""},
  ];

  const [generating,setGenerating]=React.useState<string|null>(null);
  const [preview,setPreview]=React.useState<{blob:Blob;filename:string;title:string}|null>(null);
  const [localFocusedReport,setLocalFocusedReport]=React.useState<ReportFocus|null>(null);
  const focusedReport=onFocusedReportChange?controlledFocusedReport??null:localFocusedReport;
  const setFocusedReport=(report:ReportFocus|null)=>{
    if(onFocusedReportChange)onFocusedReportChange(report);
    else setLocalFocusedReport(report);
  };
  const [combinedExamIds,setCombinedExamIds]=React.useState<string[]>(exam?.id?[exam.id]:[]);
  const examName=exam?.examName||"Sınav";
  const closeActiveReport=()=>{
    setPreview(null);setShowStudentReportV2(false);setShowInstitutionReportV2(false);setShowBranchReportV2(false);setShowItemAnalysisReportV2(false);setShowAdminDecisionCenter(false);setShowTeacherDecisionCenter(false);setShowHasatAdvisor(false);setShowUniversityIntelligence(false);setShowBrainDashboard(false);setShowAcademicDnaDashboard(false);setShowBrainTimeline(false);setShowCopilotOptimizer(false);setShowSchoolDigitalTwin(false);setShowExecutiveCenter(false);setShowEarlyWarningCenter(false);setShowIntelligenceKernel(false);
  };
  const previousFocusedReport=React.useRef<ReportFocus|null>(focusedReport);
  React.useEffect(()=>{
    if(previousFocusedReport.current&&!focusedReport)closeActiveReport();
    previousFocusedReport.current=focusedReport;
  },[focusedReport]);
  const createPdf=async(item:ReportItem)=>{
    if(generating||!item.action)return;
    closeActiveReport();
    setGenerating(item.title);
    try{
      if(!item.action)throw new Error("Bu görünüm için indirilebilir rapor bulunmuyor.");
      const blob=await item.action();
      const queue=(await localforage.getItem<any[]>(REPORT_QUEUE_KEY))||[];
      const student=selectedStudent?{recordId:selectedStudent.recordId,id:selectedStudent.id,name:selectedStudent.studentName,studentNumber:selectedStudent.studentNumber,classroom:selectedStudent.classroom}:null;
      const audiences:ReportAudience[]=item.audiences||(item.title.includes("Veli")?["parent"]:item.title.includes("Bireysel")||item.title.includes("Gelişim")||item.title.includes("Birleşik")?["student","parent"]:["teacher"]);
      const reportRecord={id:crypto.randomUUID(),examId:exam?.id,title:item.title,examName,filename:`${examName}-${item.title}.pdf`,createdAt:new Date().toISOString(),audiences,student,blob,status:"pending",results};
      await localforage.setItem(REPORT_QUEUE_KEY,[reportRecord,...queue.filter(existing=>existing.examId!==exam?.id||existing.title!==item.title)].slice(0,30));
      window.dispatchEvent(new CustomEvent("exam-whatsapp-report-added"));
      setPreview({blob,filename:reportRecord.filename,title:item.title});
    }catch(error:any){console.error("PDF oluşturulamadı",error);window.alert(error?.message||"PDF oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.");}finally{setGenerating(null);}
  };
  const openReport=(section:string,tone:string,item:ReportItem)=>{
    if(generating&&item.action)return;
    setFocusedReport({section,title:item.title,tone});
    closeActiveReport();
    if(item.primaryViewAction)item.primaryViewAction();
    else void createPdf(item);
  };
  const itemQualityReport=async()=>{
    const letters=["A","B","C","D","E"];
    const items=analyzeItems(exam,"Tümü","Tümü");
    const grouped=items.reduce((map:Record<string,typeof items>,row)=>{map[row.subject]||=[];map[row.subject].push(row);return map},{});
    const sections:PdfSection[]=Object.entries(grouped).map(([subjectName,subjectRows])=>({
      title:subjectName,
      subtitle:`${subjectRows.length} soru`,
      headers:["A/B Soru","Kazanım","Doğru","Yanlış","Boş","A","B","C","D","E","Durum"],
      widths:[8,30,6,6,6,5,5,5,5,5,19],
      rows:subjectRows.map(row=>{
        const questionNumber=row.bookletNumbers.B?`A:${row.bookletNumbers.A}  B:${row.bookletNumbers.B}`:`A:${row.bookletNumbers.A}`;
        const choices=letters.map(letter=>{const correct=letter===row.answer;return{text:row.choiceCounts[letter]||0,background:!correct?"#f8fafc":row.correct<20?"#ffe4e6":row.correct<40?"#ffedd5":row.correct<60?"#ecfccb":row.correct<80?"#d1fae5":"#a7f3d0",color:!correct?"#475569":row.correct<20?"#be123c":row.correct<40?"#c2410c":row.correct<60?"#4d7c0f":row.correct<80?"#047857":"#065f46",bold:correct,boxed:true}});
        const status={text:row.status,background:row.status==="Uygun"?"#d1fae5":row.status.includes("İptal")?"#ffe4e6":"#ffedd5",color:row.status==="Uygun"?"#047857":row.status.includes("İptal")?"#be123c":"#c2410c",bold:true};
        return[questionNumber,row.outcome,row.correct,row.wrong,row.blank,...choices,status];
      }),
    }));
    return await exportTablePdf(`${examName}-madde-analizi.pdf`,"Madde Analizi",sections,{orientation:"portrait",rowsPerPage:16,download:false,designedHeader:{variant:"analysis",accent:"item",schoolName:exam?.schoolName||exam?.institutionName||"ORDU LİSESİ",examName,examDate:exam?.examDate,reportName:"MADDE ANALİZİ",meta:[{label:"DERS",value:"Tümü"},{label:"SORU",value:items.length},{label:"KATILIM",value:results.length}]}});
  };
  const topicAnalysisReport=async()=>{
    const topicRows=buildTopicAnalysisRows(results,"Tümü","Tümü");
    if(!topicRows.length)throw new Error("Konu ve kazanım raporu için analiz verisi bulunamadı.");
    return await exportTopicAnalysisPdf(exam,topicRows,false);
  };
  const adminReport=async(kind:string)=>{
    const sections:PdfSection[]=[{title:examName,subtitle:`${results.length} öğrenci`,headers:["Sınıf","Öğrenci","Doğru","Yanlış","Boş","Net"],widths:[12,34,12,12,12,18],rows:results.map(r=>[r.classroom,r.studentName,r.totals.correct,r.totals.wrong,r.totals.empty,r.totals.net])}];
    return await exportTablePdf(`${examName}-${kind}.pdf`,kind,sections,{orientation:"landscape",rowsPerPage:14,download:false});
  };
  const institutionGeneralResultsReport=async()=>{
    const ranked=[...results].sort((a,b)=>Number(b?.totals?.net||0)-Number(a?.totals?.net||0));
    if(!ranked.length) throw new Error("Karşılaştırmalı kurum raporu için sınav sonucu bulunamadı.");

    const subjects=Array.from(new Set(ranked.flatMap(student=>(student.subjects||[]).map((subject:any)=>String(subject?.subjectName||"").trim())).filter(Boolean))) as string[];
    const classrooms=Array.from(new Set(ranked.map(student=>String(student.classroom||"Sınıfsız")))).sort(compareClassroomNames);
    const scoreOf=(student:any)=>{
      const explicit=Number(student?.score);
      if(Number.isFinite(explicit)&&explicit>0)return explicit;
      const questions=(student.subjects||[]).reduce((sum:number,subject:any)=>sum+Number(subject?.totalQuestions||0),0);
      return questions?Math.max(0,Number(student?.totals?.net||0)/questions*500):0;
    };
    const scores=ranked.map(scoreOf).filter(Number.isFinite);
    const scoreCeiling=Math.max(0,...scores)>100?500:100;
    const mean=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
    const meanScore=mean(scores);
    const nets=ranked.map(student=>Number(student?.totals?.net||0)).filter(Number.isFinite);
    const meanNet=mean(nets);
    const totalQuestionCount=ranked.reduce((sum,student)=>sum+(student.subjects||[]).reduce((s:number,subject:any)=>s+Number(subject?.totalQuestions||0),0),0);
    const institutionSuccessPercentage=totalQuestionCount?Math.max(0,Math.min(100,nets.reduce((sum,value)=>sum+value,0)/totalQuestionCount*100)):0;

    const normalizeClassroom=(value:any)=>String(value||"").toLocaleUpperCase("tr-TR").replace(/[\s\-_/]+/g,"");
    let registeredStudents:any[]=[];
    try{registeredStudents=await fetchCollectionFromLocalDatabase("students");}catch{registeredStudents=[];}
    if(!registeredStudents.length){const legacy=await localforage.getItem<any[]>("school_students");registeredStudents=Array.isArray(legacy)?legacy:[];}
    const participation=classrooms.map(classroom=>{
      const entered=ranked.filter(student=>String(student.classroom||"Sınıfsız")===classroom).length;
      const enrolled=registeredStudents.filter(student=>normalizeClassroom(student.classroom)===normalizeClassroom(classroom)).length;
      return{classroom,entered,enrolled,rate:enrolled?Math.min(100,entered/enrolled*100):null};
    });
    const participationRates=participation.map(item=>item.rate).filter((value):value is number=>typeof value==="number");
    const participationRate=participationRates.length?mean(participationRates):100;

    const subjectAverages=subjects.map(subject=>{
      const values=ranked.map(student=>subjectResult(student,subject)).filter(Boolean);
      const avg=(key:string)=>values.length?values.reduce((sum,item)=>sum+Number(item?.[key]||0),0)/values.length:0;
      const questionCount=Number(values.find(item=>Number(item?.totalQuestions)>0)?.totalQuestions||0);
      const net=avg("net");
      return{subject,correct:avg("correct"),wrong:avg("wrong"),empty:avg("empty"),net,success:questionCount?Math.max(0,Math.min(100,net/questionCount*100)):0};
    });
    const classroomOverview=classrooms.map(classroom=>{
      const students=ranked.filter(student=>String(student.classroom||"Sınıfsız")===classroom);
      const classNet=mean(students.map(student=>Number(student?.totals?.net||0)));
      const classScore=mean(students.map(scoreOf));
      const qCount=students.reduce((sum,student)=>sum+(student.subjects||[]).reduce((s:number,subject:any)=>s+Number(subject?.totalQuestions||0),0),0);
      const nSum=students.reduce((sum,student)=>sum+Number(student?.totals?.net||0),0);
      return{classroom,studentCount:students.length,averageNet:classNet,averageScore:classScore,successRate:qCount?Math.max(0,Math.min(100,nSum/qCount*100)):0};
    }).sort((a,b)=>b.averageNet-a.averageNet||b.averageScore-a.averageScore||compareClassroomNames(a.classroom,b.classroom));

    const fixedScoreBands=scoreCeiling>100?[
      {label:"450 - 500",min:450,max:500,color:"#ef4d42"},
      {label:"400 - 449",min:400,max:449.999,color:"#ff833f"},
      {label:"350 - 399",min:350,max:399.999,color:"#ffc53d"},
      {label:"300 - 349",min:300,max:349.999,color:"#2ebbb5"},
      {label:"0 - 299",min:0,max:299.999,color:"#087c78"},
    ]:[
      {label:"80 - 100",min:80,max:100,color:"#ef4d42"},
      {label:"60 - 79",min:60,max:79.999,color:"#ff833f"},
      {label:"40 - 59",min:40,max:59.999,color:"#ffc53d"},
      {label:"20 - 39",min:20,max:39.999,color:"#2ebbb5"},
      {label:"0 - 19",min:0,max:19.999,color:"#087c78"},
    ];
    const scoreBands=fixedScoreBands.map(band=>{
      const count=scores.filter(score=>score>=band.min&&score<=band.max).length;
      return{...band,count,rate:ranked.length?count/ranked.length*100:0};
    });
    const threshold=scoreCeiling>100?350:60;
    const aboveThresholdCount=scores.filter(score=>score>=threshold).length;

    const topicMap=new Map<string,{wrong:number;empty:number;questions:Set<string>}>();
    ranked.forEach(student=>(student.subjects||[]).forEach((subject:any)=>(subject.questions||[]).forEach((question:any)=>{
      const topic=String(question.topic||question.unit||"Konu belirtilmemiş").trim()||"Konu belirtilmemiş";
      const current=topicMap.get(topic)||{wrong:0,empty:0,questions:new Set<string>()};
      current.questions.add(`${subject.subjectName||"Ders"}:${question.originalIndex??question.qNum??"?"}`);
      if(question.isEmpty)current.empty+=1;else if(!question.isCorrect)current.wrong+=1;
      topicMap.set(topic,current);
    })));
    const topWrong=[...topicMap.entries()].filter(([,value])=>value.wrong>0).sort((a,b)=>b[1].wrong-a[1].wrong).slice(0,6);
    const topEmpty=[...topicMap.entries()].filter(([,value])=>value.empty>0).sort((a,b)=>b[1].empty-a[1].empty).slice(0,6);
    const topStudents=ranked.slice(0,10).map((student,index)=>({rank:index+1,name:String(student.studentName||"-"),classroom:String(student.classroom||"Sınıfsız"),net:Number(student?.totals?.net||0),score:scoreOf(student)}));
    const bestClassroom=classroomOverview[0]||null;

    const fmt=(value:number,digits=1)=>Number.isFinite(value)?value.toLocaleString("tr-TR",{minimumFractionDigits:digits,maximumFractionDigits:digits}):"-";
    const int=(value:number)=>Number.isFinite(value)?Math.round(value).toLocaleString("tr-TR"):"-";
    const esc=(value:any)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]||char));
    const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
    const logo=await urlToDataUrl(enstituReportLogoUrl).catch(()=>"");
    const campus=await urlToDataUrl(enstituCampusUrl).catch(()=>"");
    const examDate=exam?.examDate?new Date(exam.examDate).toLocaleDateString("tr-TR"):"-";
    const generatedDate=new Date().toLocaleDateString("tr-TR");
    const reportNo=`ENS-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-001`;

    const classRows=classroomOverview.slice(0,5).map(item=>{
      const maxNet=Math.max(1,...classroomOverview.map(row=>row.averageNet));
      return `<tr><td class="strong">${esc(item.classroom)}</td><td><div class="bar"><i style="width:${clamp(item.averageNet/maxNet*100)}%"></i></div></td><td class="num strong">${fmt(item.averageNet,1)}</td><td class="num">${fmt(item.averageScore,1)}</td><td class="num strong">%${fmt(item.successRate,1)}</td></tr>`;
    }).join("");
    const subjectScoreBands=[
      {label:"80 - 100",min:80,max:100,color:"#ef5b52"},
      {label:"60 - 79",min:60,max:79.999,color:"#ff8b32"},
      {label:"40 - 59",min:40,max:59.999,color:"#f7bd2b"},
      {label:"20 - 39",min:20,max:39.999,color:"#2db7b4"},
      {label:"0 - 19",min:0,max:19.999,color:"#0b8582"},
    ];
    const subjectDistributionCards=subjects.map(subject=>{
      const scoreRows=ranked.map(student=>{
        const result=subjectResult(student,subject);
        const questionCount=Number(result?.totalQuestions||0);
        if(!result||questionCount<=0)return null;
        return{score:clamp(Number(result.net||0)/questionCount*100),net:Number(result.net||0),questionCount};
      }).filter((value):value is {score:number;net:number;questionCount:number}=>!!value);
      const scoresForSubject=scoreRows.map(item=>item.score);
      const averageSubjectScore=scoresForSubject.length?mean(scoresForSubject):0;
      const averageNet=scoreRows.length?mean(scoreRows.map(item=>item.net)):0;
      const questionCount=scoreRows.length?Math.max(...scoreRows.map(item=>item.questionCount)):0;
      const bands=subjectScoreBands.map(band=>{
        const count=scoresForSubject.filter(score=>score>=band.min&&score<=band.max).length;
        const rate=scoresForSubject.length?count/scoresForSubject.length*100:0;
        return{...band,count,rate};
      });
      const maxBandRate=Math.max(1,...bands.map(band=>band.rate));
      const distributionBars=bands.map(band=>`<div class="score-column"><div class="score-value">%${int(band.rate)}</div><div class="score-track"><i style="height:${Math.max(5,band.rate/maxBandRate*100).toFixed(1)}%;background:${band.color}"></i></div><div class="score-range">${band.label}</div><div class="score-count">${int(band.count)} öğr.</div></div>`).join("");
      const classSubjectRows=classrooms.map(classroom=>{
        const values=ranked.map(student=>String(student.classroom||"Sınıfsız")===classroom?subjectResult(student,subject):null).filter(Boolean) as any[];
        if(!values.length)return null;
        const avg=(key:"correct"|"wrong"|"empty"|"net")=>mean(values.map(value=>Number(value?.[key]||0)));
        const classNet=avg("net");
        const classQuestionCount=Math.max(1,...values.map(value=>Number(value?.totalQuestions||questionCount||1)));
        const classScore=clamp(classNet/classQuestionCount*100);
        const studentScores=values.map(value=>clamp(Number(value?.net||0)/Math.max(1,Number(value?.totalQuestions||questionCount||1))*100)).sort((a,b)=>a-b);
        const qCount=Math.max(1,Math.ceil(studentScores.length*.25));
        return{classroom,correct:avg("correct"),wrong:avg("wrong"),empty:avg("empty"),net:classNet,score:classScore,lower25:mean(studentScores.slice(0,qCount)),upper25:mean(studentScores.slice(-qCount))};
      }).filter((value):value is {classroom:string;correct:number;wrong:number;empty:number;net:number;score:number;lower25:number;upper25:number}=>!!value).sort((a,b)=>b.net-a.net||compareClassroomNames(a.classroom,b.classroom));
      const institutionAverage=averageSubjectScore;
      const classAnalysis=classSubjectRows.map(row=>{
        const diff=row.score-institutionAverage, low=row.lower25-institutionAverage, high=row.upper25-institutionAverage;
        let diagnosis="Dengeli";
        if(diff<=-5&&high<=-3) diagnosis="Sınıf Geneli";
        else if(low<=-5&&high>-3) diagnosis="Alt Grup";
        else if(high>=8&&low<-8) diagnosis="Belirli Grup";
        else if(diff>=5&&low>=-3) diagnosis="Genel Güçlü";
        return{...row,diff,diagnosis};
      });
      const classTableRows=classAnalysis.map((row,index)=>`<tr><td><span class="mini-rank">${index+1}</span>${esc(row.classroom)}</td><td>${fmt(row.correct,1)}</td><td>${fmt(row.wrong,1)}</td><td>${fmt(row.empty,1)}</td><td class="mini-net">${fmt(row.net,1)}</td><td>${fmt(row.score,1)}</td><td class="${row.diff<0?"diff-neg":"diff-pos"}">${row.diff>=0?"+":""}${fmt(row.diff,1)}</td><td>${fmt(row.lower25,1)}</td><td>${fmt(row.upper25,1)}</td><td class="diagnosis">${esc(row.diagnosis)}</td></tr>`).join("");
      const bestSubjectClass=classAnalysis[0], weakestSubjectClass=classAnalysis[classAnalysis.length-1];
      const lowBandCount=bands.filter(b=>b.max<40).reduce((sum,b)=>sum+b.count,0);
      const diagnosisFindings=classAnalysis.filter(r=>r.diagnosis!=="Dengeli").slice(0,4).map(r=>{
        if(r.diagnosis==="Sınıf Geneli")return`${r.classroom}: kurum ortalamasının ${fmt(Math.abs(r.diff),1)} puan altında; alt ve üst %25 birlikte düşük, sorun sınıf geneline yayılıyor.`;
        if(r.diagnosis==="Alt Grup")return`${r.classroom}: başarı kaybı özellikle alt %25 öğrenci grubunda yoğunlaşıyor; üst %25 daha güçlü.`;
        if(r.diagnosis==="Belirli Grup")return`${r.classroom}: üst %25 güçlü kalırken alt %25 belirgin geride; sorun belirli öğrenci grubunda yoğunlaşıyor.`;
        return`${r.classroom}: başarı sınıf geneline yayılmış güçlü görünüm gösteriyor.`;
      });
      const subjectFindings=[...diagnosisFindings,
        bestSubjectClass?`${bestSubjectClass.classroom} ${fmt(bestSubjectClass.net,1)} net ile dersin en yüksek sınıf ortalamasına sahip.`:`Sınıf karşılaştırması için veri yok.`,
        weakestSubjectClass&&weakestSubjectClass!==bestSubjectClass?`${weakestSubjectClass.classroom} sınıfında ortalama ${fmt(weakestSubjectClass.net,1)} net.`:`Ders ortalaması ${fmt(averageSubjectScore,1)} puan.`,
        scoresForSubject.length?`40 puan altında ${int(lowBandCount)} öğrenci (%${int(lowBandCount/scoresForSubject.length*100)}).`:`Puan dağılımı verisi yok.`
      ].filter(Boolean);
      return `<div class="subject-donut-card"><div class="subject-donut-head"><h4>${esc(subject)}</h4><span>Soru Sayısı: ${int(questionCount)} &nbsp; | &nbsp; Katılan: ${int(scoresForSubject.length)}</span></div><div class="subject-card-main"><div class="subject-class-table-wrap"><div class="mini-table-title"><strong>Sınıf Ortalamaları</strong><span>Net'e Göre Sıralama</span></div><table class="subject-class-table"><thead><tr><th># / Sınıf</th><th>D</th><th>Y</th><th>B</th><th>Net</th><th>Ort.</th><th>Kurum Farkı</th><th>Alt %25</th><th>Üst %25</th><th>Tanı</th></tr></thead><tbody>${classTableRows}</tbody></table><div class="class-summary"><span>Ders Ortalaması: <b>${fmt(averageSubjectScore,1)}</b></span><i></i><span>Genel Net: <b>${fmt(averageNet,1)} / ${int(questionCount)}</b></span><i></i><span>Katılım: <b>%${scoresForSubject.length?100:0}</b></span></div></div><div class="subject-visual"><div class="chart-head"><div class="subject-chart-title">PUAN DAĞILIMI</div><span>Toplam Öğrenci: <b>${int(scoresForSubject.length)}</b></span></div><div class="score-column-chart">${distributionBars}</div></div></div><div class="subject-findings"><div class="findings-title">ÖNEMLİ TESPİTLER</div><div class="findings-list">${subjectFindings.map(item=>`<div class="finding-item">${esc(item)}</div>`).join("")}</div></div></div>`;
    }).join("");
    const scoreLegend=scoreBands.map(band=>`<div class="legend-row"><span class="dot" style="background:${band.color}"></span><span>${band.label}</span><b>%${int(band.rate)}</b><em>(${int(band.count)})</em></div>`).join("");
    let conicOffset=0;
    const conicParts=scoreBands.map(band=>{const start=conicOffset;const end=start+band.rate;conicOffset=end;return`${band.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;}).join(",");
    const donutBackground=conicParts||"#dce8e9 0% 100%";
    const insights=[
      `Genel başarı oranı %${fmt(institutionSuccessPercentage,1)} düzeyindedir.`,
      bestClassroom?`En başarılı şube ${bestClassroom.classroom}; ortalama ${fmt(bestClassroom.averageNet,1)} net.`:"Şube karşılaştırması hesaplandı.",
      `Kurum net ortalaması ${fmt(meanNet,1)}, puan ortalaması ${fmt(meanScore,1)} olarak hesaplandı.`,
      `${int(aboveThresholdCount)} öğrenci ${threshold} ve üzeri puan aralığına ulaşmıştır.`,
    ];
    const actionPlans=[
      {n:1,icon:"◎",title:"Matematik destek oturumu",text:"Temel kazanım eksiklerine yönelik hafta içi ek çalışma grupları düzenlensin."},
      {n:2,icon:"♟",title:"Şube bazlı geri bildirim",text:"Her şube için detaylı analiz toplantıları yapılarak öğrenci ve öğretmenlere özel geri bildirim verilsin."},
      {n:3,icon:"▥",title:"Riskli öğrenci takibi",text:`${scoreCeiling>100?"300 puan":"40 puan"} altı öğrenciler için bireysel gelişim planı hazırlansın.`},
    ];

    const pageStyle=`
      *{box-sizing:border-box} .page{width:1123px;height:1588px;background:#fff;color:#133b4a;font-family:Arial,'Segoe UI',sans-serif;position:relative;overflow:hidden;padding:24px 24px 78px}
      .header{height:228px;display:grid;grid-template-columns:170px 1fr 278px;gap:16px;position:relative;overflow:hidden;padding:16px;background:linear-gradient(135deg,#f7fbfb 0%,#f0f8f8 52%,#ffffff 100%);border:1px solid #d8ecee;border-radius:24px;box-shadow:0 12px 28px rgba(19,59,74,.08)}
      .header:before{content:"";position:absolute;left:182px;right:18px;top:18px;bottom:18px;background:linear-gradient(95deg,rgba(255,255,255,.96) 0%,rgba(255,255,255,.92) 42%,rgba(255,255,255,.55) 72%,rgba(255,255,255,.20) 100%),url('${campus}');background-size:cover;background-position:center;border-radius:18px;opacity:.92}
      .header:after{content:"";position:absolute;left:196px;right:310px;top:34px;height:10px;background:linear-gradient(90deg,#0f6f79,#23b8bb);border-radius:999px;opacity:.92}
      .brand{position:relative;z-index:2;display:flex;align-items:flex-end;justify-content:center;padding:0 0 8px}.brand .logo-wrap{width:136px;height:136px;border-radius:30px;background:#ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(17,70,82,.10), inset 0 0 0 1px #d6eaec}.brand img{max-width:124px;max-height:124px;object-fit:contain;filter:drop-shadow(0 6px 10px rgba(16,72,86,.12))}
      .hero{position:relative;z-index:2;padding:18px 6px 12px 8px;display:flex;align-items:flex-end}.hero-shell{width:100%;display:grid;grid-template-columns:1fr;gap:10px}.hero-topline{display:flex;align-items:center;justify-content:space-between}.hero-mini{font-size:12px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#0f7777}.hero-school{display:inline-flex;align-items:center;justify-content:center;padding:6px 12px;border-radius:999px;background:#ffffff;color:#0f3b48;border:1px solid #cfe6e8;font-size:11px;font-weight:900;letter-spacing:.5px;box-shadow:0 5px 10px rgba(17,70,82,.06)}
      .hero-titlebox{max-width:510px;background:rgba(255,255,255,.90);border:1px solid rgba(203,228,230,.96);border-radius:22px;padding:18px 22px 16px;box-shadow:0 10px 20px rgba(17,70,82,.06)}.hero-titlebox h1{font-size:41px;line-height:.96;margin:0 0 8px;font-weight:900;color:#103947;letter-spacing:-1.6px}.hero-titlebox .sub{font-size:16px;font-weight:700;color:#4f7681;margin:0 0 12px}.hero-titlebox .accent{display:flex;align-items:center;gap:10px}.hero-titlebox .accent i{display:block;width:118px;height:4px;border-radius:999px;background:linear-gradient(90deg,#1dbdb8,#0f7677)}.hero-titlebox .accent span{font-size:12px;font-weight:800;letter-spacing:.7px;color:#0f7677;text-transform:uppercase}
      .meta{position:relative;z-index:2;background:linear-gradient(160deg,#10858e,#084c55);color:#fff;border-radius:28px;padding:22px 18px 18px 20px;box-shadow:0 12px 24px rgba(7,90,99,.17)}.meta .quote{text-align:right;font:italic 18px Georgia,serif;line-height:1.12;margin:0 0 22px}.meta-grid{font-size:12.4px;display:grid;grid-template-columns:106px 1fr;gap:10px 8px}.meta-grid span{color:#dffbfd}.meta-grid b{text-align:right;color:#ffffff}

      .generated-report-header{height:228px;border:1px solid #d8ecee;border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 12px 28px rgba(19,59,74,.08);margin-bottom:0}.generated-report-header img{width:100%;height:100%;display:block;object-fit:cover;object-position:center center}.institution-family-header{height:228px;position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(110deg,#f4efff 0%,#fff 33%,#fff 62%,#fff4c8 100%);box-shadow:0 12px 28px rgba(62,30,109,.12);display:grid;grid-template-columns:29% 49% 22%;align-items:stretch}.institution-family-header:before{content:"";position:absolute;left:310px;top:88px;width:560px;height:82px;border-radius:26px;transform:skewX(-13deg);background:linear-gradient(90deg,#233fba,#6a2c91);box-shadow:0 11px 0 #f5b91f}.institution-family-header:after{content:"";position:absolute;right:-110px;bottom:-100px;width:390px;height:330px;border-radius:45%;transform:rotate(-8deg);background:linear-gradient(145deg,#ffd33f,#efa51b)}.if-left,.if-mid,.if-right{position:relative;z-index:2}.if-left{padding:40px 26px 24px 40px;color:#2f1658}.if-kicker{font-size:11px;font-weight:900;letter-spacing:2px}.if-school{font-size:24px;font-weight:900;margin-top:7px}.if-meta{display:flex;gap:24px;margin-top:15px;font-size:12px;font-weight:700}.if-meta b{display:block;font-size:22px}.if-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.if-title{font-size:30px;font-weight:900;color:#27164f}.if-sub{font-size:12px;font-weight:800;color:#6f5c91;margin-top:2px}.if-exam{margin-top:27px;width:91%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;font-size:29px;font-weight:900}.if-date{margin-top:21px;border-radius:999px;background:#fff;padding:8px 18px;font-size:12px;font-weight:900;color:#3b246d;box-shadow:0 3px 9px rgba(62,30,109,.15)}.if-right{display:flex;align-items:center;justify-content:center;text-align:center;padding:22px;color:#2f2151;font-size:24px;font-weight:900;line-height:1.0;text-transform:uppercase}
      .metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:2px 0 16px}.metric{height:132px;border:1px solid #d4e7ea;border-radius:10px;background:#fff;box-shadow:0 1px 7px rgba(19,59,74,.06);padding:13px;position:relative}.metric-head{display:flex;align-items:flex-start;gap:11px}.metric-icon{width:45px;height:45px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#173b4c;font-weight:900;font-size:22px;background:#b9eff0}.metric-title{font-weight:800;font-size:14px;line-height:1.1;margin-top:6px}.metric-value{text-align:center;font-weight:900;font-size:33px;margin-top:7px;color:#123d4c}.metric-detail{text-align:center;font-size:11px;color:#6c8290;margin-top:1px}
      .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #d6e7ea;border-radius:9px;background:#fff;box-shadow:0 1px 8px rgba(19,59,74,.055);overflow:hidden}.card-pad{padding:13px 14px}.section-title{display:flex;align-items:center;gap:9px;font-size:22px;font-weight:900;color:#143e4e;margin:0}.section-title .ico{color:#0b7d7c;font-size:26px}.subtitle{font-size:12px;color:#6b8290;margin:2px 0 10px 34px}
      table{width:100%;border-collapse:collapse}.compare th,.compare td{border:1px solid #dfeaec;padding:7px 7px;font-size:12px}.compare th{background:#edf6f7;color:#173f50;font-weight:800}.compare td.num{text-align:center}.compare tr:nth-child(even) td{background:#fbfdfd}.strong{font-weight:900}.bar{height:16px;background:#edf2f3;border-radius:0;overflow:hidden}.bar i{height:100%;display:block;background:linear-gradient(90deg,#11a0a6,#087775)}.bar.soft{height:11px;border-radius:5px}.winner{margin:9px 0 0;border-radius:8px;background:#f2f8f8;padding:9px 10px;display:flex;gap:11px;align-items:center}.winner .cup{font-size:28px;color:#e7a915}.winner b{font-size:13px}.winner small{display:block;color:#5e7985;margin-top:2px}
      .distribution{display:grid;grid-template-columns:55% 45%;align-items:center;min-height:240px}.donut{width:190px;height:190px;border-radius:50%;margin:5px auto;position:relative;background:conic-gradient(${donutBackground})}.donut:after{content:'';position:absolute;inset:45px;background:#fff;border-radius:50%}.donut-center{position:absolute;z-index:2;left:0;right:0;top:71px;text-align:center;font-weight:900;font-size:28px;color:#153f50}.donut-center span{display:block;font-size:15px;margin-top:2px}.legend{border-left:1px solid #d8e8ea;padding-left:15px}.legend-row{display:grid;grid-template-columns:14px 70px 30px 38px;align-items:center;gap:4px;font-size:12px;margin:10px 0;color:#173f50}.legend-row .dot{width:11px;height:11px;border-radius:50%}.legend-row b{text-align:right}.legend-row em{font-style:normal;color:#6d8390;text-align:right}.threshold{margin:5px 10px 10px;background:#edf8f8;border-radius:8px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;font-size:12px}.threshold b{font-size:13px}
      .subject-block{margin-top:12px;padding-bottom:14mm}.subject-map{padding:12px 14px}.subject-map-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.subject-map-head .map-note{font-size:10px;color:#0b7180;text-align:center;font-weight:800;background:#e8f7fa;border-radius:999px;padding:7px 13px}.subject-score-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:start}.subject-donut-card{border:1px solid #cfe4e8;border-radius:14px;background:#fff;padding:8px;box-shadow:0 4px 12px rgba(20,66,78,.06);break-inside:avoid;page-break-inside:avoid;margin-bottom:5px}.subject-donut-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;padding:8px 12px;border-radius:10px;background:linear-gradient(90deg,#e8f7fb,#f8fcfd)}.subject-donut-head h4{font-size:15px;line-height:1;margin:0;color:#123e4d;font-weight:900}.subject-donut-head span{font-size:8px;color:#315f70;white-space:nowrap;font-weight:700}.subject-card-main{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(0,.82fr);gap:8px;align-items:stretch}.subject-class-table-wrap,.subject-visual{min-width:0;height:198px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1px #d7e9ec}.subject-class-table-wrap{display:flex;flex-direction:column}.mini-table-title{height:36px;display:flex;justify-content:space-between;align-items:center;color:#fff;padding:0 10px;background:linear-gradient(90deg,#078a94,#31a7b2)}.mini-table-title strong{font-size:9px;font-weight:900}.mini-table-title span{font-size:7px;color:#eaffff;font-weight:700}.subject-class-table{width:100%;border-collapse:collapse;table-layout:fixed}.subject-class-table th,.subject-class-table td{border-right:1px solid #dbeaed;border-bottom:1px solid #dbeaed;padding:3.5px 1px;font-size:5.15px;text-align:center;line-height:1.05}.subject-class-table th{height:25px;background:#e8f6fa;color:#153f55;font-weight:900}.subject-class-table th:first-child,.subject-class-table td:first-child{width:17%;text-align:left;padding-left:7px}.subject-class-table th:nth-last-child(1){width:14%}.subject-class-table td:first-child{font-weight:900;color:#173f50;white-space:nowrap}.subject-class-table tr:nth-child(even) td{background:#f7fbfc}.subject-class-table .mini-net{font-weight:900;color:#073e5a;background:#dff3f6}.mini-rank{display:inline-flex;width:13px;height:13px;border-radius:50%;align-items:center;justify-content:center;margin-right:4px;background:#0e8990;color:#fff;font-size:5.8px;font-weight:900}.mini-success{position:relative;overflow:hidden;background:#eef6f8}.mini-success span{position:absolute;left:3px;top:5px;bottom:5px;border-radius:5px;background:linear-gradient(90deg,#ffd45c,#58d2d1);opacity:.78}.mini-success b{position:relative;z-index:2;font-size:6.4px;color:#103f55}.diff-neg{font-weight:900;color:#b4233f;background:#fff0f3}.diff-pos{font-weight:900;color:#087b67;background:#edf9f5}.diagnosis{font-weight:900;color:#6e2840;background:#fff4f7;white-space:nowrap}.class-summary{margin:auto 8px 8px;min-height:31px;border-radius:9px;background:#e8f7fb;display:flex;align-items:center;justify-content:center;gap:8px;padding:5px 7px;font-size:6.5px;color:#1b6072}.class-summary i{width:1px;height:13px;background:#6fb9c5}.class-summary b{font-size:7.2px;color:#0b5270}.subject-visual{display:flex;flex-direction:column;padding:0 10px 9px;background:#fffdfb;border:1px solid #f1dfc9}.chart-head{height:36px;margin:0 -10px 4px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,#fff1dc,#fff8ee)}.subject-chart-title{font-size:9px;font-weight:900;color:#173f55;letter-spacing:.3px}.chart-head span{font-size:7px;color:#315f70}.score-column-chart{flex:1;min-height:0;display:grid;grid-template-columns:repeat(5,1fr);gap:7px;align-items:end;padding:7px 5px 4px;border-bottom:1px solid #9fbcc5;background:repeating-linear-gradient(to top,transparent 0,transparent 31px,rgba(195,218,224,.45) 32px)}.score-column{height:135px;display:grid;grid-template-rows:16px 1fr 18px 14px;align-items:end;text-align:center;min-width:0}.score-value{font-size:7.5px;font-weight:900;color:#143f50;align-self:center}.score-track{height:88px;display:flex;align-items:flex-end;justify-content:center}.score-track i{display:block;width:30px;min-height:5px;border-radius:7px 7px 2px 2px;box-shadow:0 2px 5px rgba(20,84,94,.10)}.score-range{font-size:6.5px;font-weight:900;color:#214e63;white-space:nowrap;align-self:end}.score-count{font-size:6px;color:#647f8a;white-space:nowrap;align-self:start}.subject-findings{break-inside:avoid;page-break-inside:avoid;margin-top:10px;border-radius:11px;background:linear-gradient(90deg,#fff0f5,#fff7fa);border:1px solid #f3cbd9;padding:8px 10px;display:grid;grid-template-columns:118px 1fr;gap:10px;align-items:stretch}.findings-title{display:flex;align-items:center;font-size:8.8px;font-weight:900;color:#c9144e;border-right:2px solid #8b1538;padding-right:10px}.findings-list{display:grid;grid-template-columns:1fr;gap:0}.finding-item{font-size:7px;line-height:1.3;color:#294a5b;padding:5px 3px}.finding-item+.finding-item{border-top:3px solid #7f1734}.subject-map-legend{display:none}
      .bottom{margin-top:12px}.actions{padding:12px 14px;background:linear-gradient(135deg,#ffe6f0,#fff2f7);border-color:#f5c5d7}.actions .section-title{color:#c81659}.action-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.action{border:1px solid #f2c7d7;border-radius:10px;padding:10px 10px 10px 38px;min-height:112px;position:relative;background:rgba(255,255,255,.55)}.action .badge{position:absolute;left:9px;top:9px;background:linear-gradient(135deg,#e82c73,#bd0e55);color:#fff;border-radius:50%;width:24px;height:24px;text-align:center;padding-top:4px;font-weight:900}.action .aicon{display:none}.action h4{font-size:11px;line-height:1.05;margin:3px 0 7px;color:#c51659;text-transform:uppercase}.action p{font-size:8px;line-height:1.3;color:#51404a;margin:0}
      .footer-wave{position:absolute;left:0;right:0;bottom:0;height:80px;background:#0c6970;clip-path:polygon(0 35%,37% 58%,66% 34%,100% 46%,100% 100%,0 100%);color:white;display:flex;align-items:flex-end;justify-content:space-between;padding:0 34px 17px;font-size:12px}.footer-wave .script{font:italic 16px Georgia,serif}.footer-wave b{font-size:12px}.footer-wave2{position:absolute;left:0;right:0;bottom:54px;height:20px;background:#18a4a5;clip-path:polygon(0 65%,34% 38%,63% 72%,100% 24%,100% 44%,62% 89%,34% 53%,0 82%)}
      .page2-title{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #21aaa9;padding-bottom:10px;margin-bottom:14px}.page2-title h1{font-size:28px;margin:0;color:#123e4d}.page2-title p{margin:4px 0 0;color:#667e8c}.detail-grid{display:grid;grid-template-columns:56% 44%;gap:12px}.toplist .person{display:grid;grid-template-columns:34px 1fr 70px;gap:9px;align-items:center;border:1px solid #e0eaec;border-radius:7px;padding:7px;margin:5px 0}.rank{background:#0f766e;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:900}.person b{font-size:12px}.person small{color:#738995}.person .score{text-align:right;font-weight:900;color:#0f766e}.topic-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.topic-table th,.topic-table td{border:1px solid #dce8ea;padding:7px;font-size:11px}.topic-table th{background:#0f766e;color:#fff}.page2-subjects th,.page2-subjects td{border:1px solid #dce8ea;padding:6px;font-size:11px}.page2-subjects th{background:#0f766e;color:#fff}
    `;

    const page1=`<div class="page">
      <style>${pageStyle}
      /* V35 — Kurumsal özet kartları: daha renkli, ancak baskıda temiz */
      .metric-grid,.summary-grid,.stats-grid{gap:10px}
      .metric-card,.summary-card,.stat-card{position:relative;overflow:hidden;border-radius:14px!important;border:1px solid rgba(24,93,111,.14)!important;box-shadow:0 5px 14px rgba(19,69,83,.08)!important;background:#fff!important}
      .metric-card:before,.summary-card:before,.stat-card:before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:var(--accent,#20b9b3)}
      .metric-card:after,.summary-card:after,.stat-card:after{content:"";position:absolute;width:110px;height:110px;border-radius:50%;right:-46px;top:-48px;background:var(--wash,rgba(32,185,179,.12));pointer-events:none}
      .metric-card:nth-child(1),.summary-card:nth-child(1),.stat-card:nth-child(1){--accent:#17b9b4;--wash:rgba(23,185,180,.16);background:linear-gradient(145deg,#ffffff 55%,#e9fbfa)!important}
      .metric-card:nth-child(2),.summary-card:nth-child(2),.stat-card:nth-child(2){--accent:#348fd1;--wash:rgba(52,143,209,.15);background:linear-gradient(145deg,#ffffff 55%,#edf7ff)!important}
      .metric-card:nth-child(3),.summary-card:nth-child(3),.stat-card:nth-child(3){--accent:#8b67c7;--wash:rgba(139,103,199,.15);background:linear-gradient(145deg,#ffffff 55%,#f5efff)!important}
      .metric-card:nth-child(4),.summary-card:nth-child(4),.stat-card:nth-child(4){--accent:#ef9346;--wash:rgba(239,147,70,.16);background:linear-gradient(145deg,#ffffff 55%,#fff3e8)!important}
      .metric-card:nth-child(5),.summary-card:nth-child(5),.stat-card:nth-child(5){--accent:#e3ad2f;--wash:rgba(227,173,47,.18);background:linear-gradient(145deg,#ffffff 55%,#fff8df)!important}
      .metric-card .icon,.summary-card .icon,.stat-card .icon,.metric-icon,.summary-icon,.stat-icon{background:var(--wash,rgba(32,185,179,.16))!important;color:var(--accent,#118b91)!important;border:1px solid color-mix(in srgb,var(--accent,#118b91) 25%,transparent)!important}
      .metric-card .value,.summary-card .value,.stat-card .value,.metric-value,.summary-value,.stat-value{position:relative;z-index:1;color:#0b3545!important;font-weight:900!important;text-shadow:0 1px 0 #fff}
      .metric-card small,.summary-card small,.stat-card small,.metric-sub,.summary-sub,.stat-sub{position:relative;z-index:1;display:inline-block;border-radius:999px;padding:2px 7px;background:var(--wash,rgba(32,185,179,.12));color:#486b77!important;font-weight:700}
</style>
      <div class="institution-family-header"><div class="if-left"><div class="if-kicker">KURUM</div><div class="if-school">ORDU LİSESİ</div><div class="if-meta"><span>Öğrenci<b>${int(ranked.length)}</b></span><span>Şube<b>${int(classrooms.length)}</b></span></div></div><div class="if-mid"><div class="if-title">ORDU LİSESİ</div><div class="if-sub">KARŞILAŞTIRMALI SINAV ANALİZİ</div><div class="if-exam">${esc(exam?.examName||"Sınav")}</div><div class="if-date">▣ ${examDate}</div></div><div class="if-right">KARŞILAŞTIRMALI<br/>KURUM SINAV<br/>RAPORU</div></div>
      <div class="metrics">
        <div class="metric"><div class="metric-head"><div class="metric-icon">👥</div><div class="metric-title">Katılan Öğrenci</div></div><div class="metric-value">${int(ranked.length)}</div><div class="metric-detail">%${fmt(participationRate,0)} Katılım Oranı</div></div>
        <div class="metric"><div class="metric-head"><div class="metric-icon">▣</div><div class="metric-title">Şube Sayısı</div></div><div class="metric-value">${int(classrooms.length)}</div><div class="metric-detail">Kurum genel dağılımı</div></div>
        <div class="metric"><div class="metric-head"><div class="metric-icon">▥</div><div class="metric-title">Kurum Net<br/>Ortalaması</div></div><div class="metric-value">${fmt(meanNet,1)}</div><div class="metric-detail">Sınav geneli</div></div>
        <div class="metric"><div class="metric-head"><div class="metric-icon" style="background:#ffe1a0">🏆</div><div class="metric-title">Kurum Puan<br/>Ortalaması</div></div><div class="metric-value">${fmt(meanScore,1)}</div><div class="metric-detail">${scoreCeiling>100?"TYT Puanı":"100'lük ölçek"}</div></div>
        <div class="metric"><div class="metric-head"><div class="metric-icon" style="background:#ffe1a0">★</div><div class="metric-title">Genel Başarı</div></div><div class="metric-value">%${fmt(institutionSuccessPercentage,1)}</div><div class="metric-detail">Kurumsal başarı göstergesi</div></div>
      </div>
      <div class="row2">
        <div class="card card-pad"><h3 class="section-title"><span class="ico">▥</span>Şube Karşılaştırması</h3><p class="subtitle">Şubelerin performanslarını karşılaştırmalı olarak inceleyin.</p><table class="compare"><thead><tr><th>Şube</th><th></th><th>Ortalama Net</th><th>Ortalama Puan</th><th>Başarı Oranı</th></tr></thead><tbody>${classRows}</tbody></table><div class="winner"><div class="cup">🏆</div><div><b>En başarılı şube: ${esc(bestClassroom?.classroom||"-")}</b><small>${bestClassroom?`Ortalama ${fmt(bestClassroom.averageNet,1)} net ile kurum ortalamasının ${fmt(bestClassroom.averageNet-meanNet,1)} net üzerindedir.`:"Karşılaştırma verisi yok."}</small></div></div></div>
        <div class="card card-pad"><h3 class="section-title"><span class="ico">◕</span>Puan Dağılımı</h3><p class="subtitle">Öğrencilerin puan aralıklarına göre dağılımı</p><div class="distribution"><div class="donut"><div class="donut-center">${int(ranked.length)}<span>Öğrenci</span></div></div><div class="legend">${scoreLegend}</div></div><div class="threshold"><span>▥ &nbsp; <b>Öğrencilerin %${int(ranked.length?aboveThresholdCount/ranked.length*100:0)}'ü</b><br/>&nbsp;&nbsp;&nbsp;&nbsp;${threshold} ve üzeri puan almıştır.</span><b>◎ Hedef<br/>%60+</b></div></div>
      </div>
      <div class="subject-block">
        <div class="card subject-map"><div class="subject-map-head"><div><h3 class="section-title"><span class="ico">◉</span>Ders Başarı Haritası</h3><p class="subtitle">Her dersteki başarı dağılımı ve genel değerlendirme</p></div></div><div class="subject-score-grid">${subjectDistributionCards}</div></div>
      </div>
      <div class="bottom">
        <div class="card actions"><h3 class="section-title"><span class="ico">◎</span>EYLEM PLANI <span style="font-size:11px;font-weight:500;color:#b14a72">Verilerden eyleme, daha güçlü yarınlara...</span></h3><div class="action-grid">${[...actionPlans,{n:4,icon:"★",title:"Hedef",text:"Bir sonraki sınavda ders bazlı kurum ortalamalarını en az %5 artırmaya yönelik izleme yapılacaktır."}].map(item=>`<div class="action"><div class="badge">${item.n}</div><div class="aicon">${item.icon}</div><h4>${esc(item.title)}</h4><p>${esc(item.text)}</p></div>`).join("")}</div></div>
      </div>
      <div class="footer-wave2"></div><div class="footer-wave"><span class="script">Daha iyi bir gelecek, nitelikli eğitimle mümkün.</span><b>🏫 &nbsp; e-Nstitü • Yönetici Analiz Raporu &nbsp; | &nbsp; Bilgi. Analiz. Gelişim.</b></div>
    </div>`;

    const classTable2=classroomOverview.map(item=>`<tr><td class="strong">${esc(item.classroom)}</td><td>${int(item.studentCount)}</td><td class="strong">${fmt(item.averageNet,1)}</td><td>${fmt(item.averageScore,1)}</td><td class="strong">%${fmt(item.successRate,1)}</td></tr>`).join("");
    const topListHtml=topStudents.map(item=>`<div class="person"><div class="rank">${item.rank}</div><div><b>${esc(item.name)}</b><small>${esc(item.classroom)}</small></div><div class="score">${fmt(item.net,1)}<small>${fmt(item.score,1)} puan</small></div></div>`).join("");
    const subjectTable2=subjectAverages.map(item=>`<tr><td class="strong">${esc(item.subject)}</td><td>${int(ranked.length)}</td><td>${fmt(item.correct,1)}</td><td>${fmt(item.wrong,1)}</td><td>${fmt(item.empty,1)}</td><td class="strong">${fmt(item.net,1)}</td><td class="strong">%${fmt(item.success,1)}</td></tr>`).join("");
    const wrongRows=topWrong.length?topWrong.map(([topic,value],index)=>`<tr><td>${index+1}</td><td class="strong">${esc(topic)}</td><td>${int(value.questions.size)}</td><td class="strong" style="color:#dc2626">${int(value.wrong)}</td></tr>`).join(""):`<tr><td colspan="4">Veri yok</td></tr>`;
    const emptyRows=topEmpty.length?topEmpty.map(([topic,value],index)=>`<tr><td>${index+1}</td><td class="strong">${esc(topic)}</td><td>${int(value.questions.size)}</td><td class="strong" style="color:#0f766e">${int(value.empty)}</td></tr>`).join(""):`<tr><td colspan="4">Veri yok</td></tr>`;
    const page2=`<div class="page"><style>${pageStyle}</style><div class="page2-title"><div><h1>Karşılaştırmalı Kurum Sınav Raporu</h1><p>${esc(exam?.examName||"Sınav")} • Ayrıntılı Analiz</p></div><div style="text-align:right;color:#6a8190;font-size:13px">Sınav: ${examDate}<br/>Rapor: ${generatedDate}<br/>Sayfa 2 / 2</div></div>
      <div class="detail-grid"><div class="card card-pad"><h3 class="section-title">Şube Karşılaştırma Tablosu</h3><p class="subtitle">Şubelerin genel performans özeti</p><table class="page2-subjects"><thead><tr><th>Şube</th><th>Katılım</th><th>Ort. Net</th><th>Ort. Puan</th><th>Başarı</th></tr></thead><tbody>${classTable2}</tbody></table></div><div class="card card-pad toplist"><h3 class="section-title">İlk 10 Öğrenci</h3><p class="subtitle">En yüksek nete göre sıralama</p>${topListHtml}</div></div>
      <div class="card card-pad" style="margin-top:12px"><h3 class="section-title">Ders Bazlı Kurum Ortalamaları</h3><p class="subtitle">Kurum genelinde ders performans özeti</p><table class="page2-subjects"><thead><tr><th>Ders</th><th>Öğrenci</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Net</th><th>Başarı</th></tr></thead><tbody>${subjectTable2}</tbody></table></div>
      <div class="topic-grid"><div class="card card-pad"><h3 class="section-title">En Çok Hata Yapılan Konular</h3><p class="subtitle">Sınıf dağılımına göre en çok yanlış yapılan başlıklar</p><table class="topic-table"><thead><tr><th>#</th><th>Konu</th><th>Soru</th><th>Yanlış</th></tr></thead><tbody>${wrongRows}</tbody></table></div><div class="card card-pad"><h3 class="section-title">En Çok Boş Bırakılan Konular</h3><p class="subtitle">Boş bırakma eğiliminin yüksek olduğu başlıklar</p><table class="topic-table"><thead><tr><th>#</th><th>Konu</th><th>Soru</th><th>Boş</th></tr></thead><tbody>${emptyRows}</tbody></table></div></div>
      <div class="card actions" style="margin-top:12px"><h3 class="section-title">Eylem Planı</h3><div class="action-grid" style="margin-top:10px">${actionPlans.map(item=>`<div class="action"><div class="badge">${item.n}</div><div class="aicon">${item.icon}</div><h4>${esc(item.title)}</h4><p>${esc(item.text)}</p></div>`).join("")}</div></div>
      <div class="footer-wave2"></div><div class="footer-wave"><span class="script">Daha iyi bir gelecek, nitelikli eğitimle mümkün.</span><b>🏫 &nbsp; e-Nstitü • Yönetici Analiz Raporu &nbsp; | &nbsp; Bilgi. Analiz. Gelişim.</b></div></div>`;

    const mount=document.createElement("div");
    mount.setAttribute("aria-hidden","true");
    mount.style.position="fixed";
    mount.style.left="-20000px";
    mount.style.top="0";
    mount.style.width="1123px";
    mount.style.background="#ffffff";
    mount.innerHTML=page1+page2;
    document.body.appendChild(mount);
    try{
      await document.fonts?.ready;
      const {toPng}=await import("html-to-image");
      const pages=Array.from(mount.querySelectorAll<HTMLElement>(".page"));
      const pageImages:string[]=[];
      for(const page of pages){
        pageImages.push(await toPng(page,{backgroundColor:"#ffffff",cacheBust:true,pixelRatio:1.65,width:1123,height:1588,style:{margin:"0",boxShadow:"none"}}));
      }
      const content=pageImages.map((image,index)=>({image,width:595.28,height:841.89,pageBreak:index<pageImages.length-1?"after":undefined,margin:[0,0,0,0]}));
      return await generatePdf({pageSize:"A4",pageOrientation:"portrait",pageMargins:[0,0,0,0],content},{mode:"blob",filename:`${exam?.examName||"sinav"}-karsilastirmali-kurum-sinav-raporu.pdf`}) as Blob;
    }finally{
      mount.remove();
    }
  };
  const classroomComparisonReport=async()=>{
    const fixedSubjects=Array.from(new Set(results.flatMap(student=>(student.subjects||[]).map((subject:any)=>String(subject.subjectName||"").trim())).filter(Boolean))).slice(0,9) as string[];
    const fixedClassrooms=Array.from(new Set(results.map(student=>String(student.classroom||"Sınıfsız")))).sort(compareClassroomNames);
    const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
    const metric=(classroom:string,subject:string,key:"correct"|"wrong"|"empty"|"net")=>average(results.filter(student=>String(student.classroom||"Sınıfsız")===classroom).map(student=>Number(subjectResult(student,subject)?.[key]||0)));
    const netRank=(classroom:string,subject:string)=>1+fixedClassrooms.filter(item=>metric(item,subject,"net")>metric(classroom,subject,"net")).length;
    const fixedRows=fixedClassrooms.map((classroom,index)=>[index+1,classroom,...fixedSubjects.flatMap(subject=>[metric(classroom,subject,"correct").toFixed(1),metric(classroom,subject,"wrong").toFixed(1),metric(classroom,subject,"empty").toFixed(1),metric(classroom,subject,"net").toFixed(1),netRank(classroom,subject)]),1+fixedClassrooms.filter(item=>average(results.filter(student=>String(student.classroom||"Sınıfsız")===item).map(student=>Number(student.totals?.net||0)))>average(results.filter(student=>String(student.classroom||"Sınıfsız")===classroom).map(student=>Number(student.totals?.net||0)))).length]);
    const fixedWidths=[15,40,...fixedSubjects.flatMap(()=>[14,14,14,14,14]),30];
    const fixedWidth=fixedWidths.reduce((sum,width)=>sum+width,0), minimumMargin=14.17, portraitAvailable=595.28-minimumMargin*2;
    const fixedOrientation=fixedWidth<=portraitAvailable?"portrait":"landscape";
    const fixedPageWidth=fixedOrientation==="portrait"?595.28:841.89;
    const fixedSideMargin=Math.max(minimumMargin,(fixedPageWidth-fixedWidth)/2);
    return await generatePdf({pageSize:"A4",pageOrientation:fixedOrientation,pageMargins:[fixedSideMargin,14.17,fixedSideMargin,14.17],content:[
      {table:{widths:[150,"*",88,92],body:[[
        {text:"ŞUBE KARŞILAŞTIRMA RAPORU",fontSize:16,bold:true,color:"#e40045",margin:[0,5,0,0]},
        {stack:[{text:"SINAVIN ADI",fontSize:6,bold:true,color:"#64748b"},{text:examName,fontSize:9,bold:true,color:"#111827",margin:[0,2,0,0]}],alignment:"left",margin:[4,2,4,0]},
        {stack:[{text:"SINIF DÜZEYİ",fontSize:6,bold:true,color:"#64748b"},{text:Array.from(new Set(fixedClassrooms.map(item=>String(item).match(/\d+/)?.[0]).filter(Boolean))).join(", ")||"-",fontSize:9,bold:true,margin:[0,2,0,0]}],margin:[4,2,4,0]},
        {stack:[{text:"SINAV TARİHİ",fontSize:6,bold:true,color:"#64748b"},{text:String(exam?.examDate||"-"),fontSize:9,bold:true,margin:[0,2,0,0]}],alignment:"right",margin:[4,2,0,0]},
      ]]},layout:{hLineWidth:()=>0,vLineWidth:(index:number)=>index===1?1:0,vLineColor:()=>"#e2e8f0",paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0},margin:[0,0,0,8]},
      {table:{headerRows:2,widths:fixedWidths,body:[
        [{text:"Sıra",rowSpan:2,bold:true,color:"#fff",fillColor:"#5ea476",alignment:"center"},{text:"SINIF",rowSpan:2,bold:true,color:"#fff",fillColor:"#5ea476",alignment:"center"},...fixedSubjects.flatMap(subject=>[{text:subject.toLocaleUpperCase("tr-TR"),colSpan:5,bold:true,color:"#fff",fillColor:"#5ea476",alignment:"center"},{},{},{},{}]),{text:"S.",rowSpan:2,bold:true,color:"#fff",fillColor:"#e40045",alignment:"center"}],
        [{},{},...fixedSubjects.flatMap(()=>["D","Y","B","Net","Sıra"].map(text=>({text,bold:true,fontSize:6,fillColor:"#dce583",alignment:"center"}))),{}],
        ...fixedRows.map((row,rowIndex)=>row.map((text,columnIndex)=>({text:String(text),fontSize:5.5,alignment:columnIndex===1?"left":"center",fillColor:rowIndex%2?"#fff":"#eeeeee"}))),
      ]},layout:{hLineWidth:()=>0.35,vLineWidth:()=>0.35,hLineColor:()=>"#475569",vLineColor:()=>"#64748b",paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>2,paddingBottom:()=>2}},
    ]},{mode:"blob",filename:`${examName}-sube-karsilastirma-raporu.pdf`}) as Blob;
    const subjects=Array.from(new Set(results.flatMap(student=>(student.subjects||[]).map((subject:any)=>subject.subjectName)))) as string[];
    const classrooms=Array.from(new Set(results.map(student=>student.classroom||"Sınıfsız"))).sort((a,b)=>String(a).localeCompare(String(b),"tr-TR",{numeric:true}));
    const subjectQuestions=subjects.map(subjectName=>results.map(student=>subjectResult(student,subjectName)?.totalQuestions).find(value=>typeof value==="number")||0);
    const totalQuestions=subjectQuestions.reduce((sum,count)=>sum+count,0);
    const averageNet=(students:any[],subjectName?:string)=>{if(!students.length)return 0;const total=students.reduce((sum,student)=>sum+(subjectName?(subjectResult(student,subjectName)?.net||0):(student.totals?.net||0)),0);return Number((total/students.length).toFixed(2));};
    const classroomStats=classrooms.map(classroom=>{const students=results.filter(student=>(student.classroom||"Sınıfsız")===classroom);return{classroom,students,subjectNets:subjects.map(subject=>averageNet(students,subject)),totalNet:averageNet(students)}});
    const rankFor=(value:number,values:number[])=>1+values.filter(candidate=>candidate>value).length;
    const institutionSubjectAverages=subjects.map(subject=>averageNet(results,subject));
    const institutionTotalAverage=averageNet(results);
    const subjectWidths=subjects.map(()=>72/Math.max(subjects.length,1));
    const rawWidths=[8,...subjectWidths,9,5];
    const widthTotal=rawWidths.reduce((sum,value)=>sum+value,0);
    const widths=rawWidths.map(value=>Number((value/widthTotal*100).toFixed(2)));
    const subjectHeaders=subjects.map(subject=>subject.toLocaleUpperCase("tr-TR"));
    const rows:any[][]=[
      [{text:"Soru Sayısı",background:"#d9e77f",bold:true},...subjectQuestions.map(count=>({text:count,bold:true})),{text:totalQuestions,bold:true},{text:results.length,bold:true}],
      [{text:"Net Ortalaması",background:"#d9e77f",bold:true},...institutionSubjectAverages.map(value=>({text:value,bold:true})),{text:institutionTotalAverage,bold:true},{text:results.length,bold:true}],
      [{text:"ŞUBELER",background:"#4f9461",color:"#ffffff",bold:true},...subjects.map(()=>({subcells:[{text:"Net",bold:true},{text:"Sıra",bold:true}],background:"#d9e77f"})),{subcells:[{text:"Net",bold:true},{text:"Sıra",bold:true}],background:"#d9e77f"},{text:"Şube Katılım",background:"#e40046",color:"#ffffff",bold:true}],
      ...classroomStats.map(stat=>[
        {text:stat.classroom,background:"#d9e77f",bold:true},
        ...stat.subjectNets.map((net,index)=>({subcells:[{text:net},{text:rankFor(net,classroomStats.map(item=>item.subjectNets[index])),bold:true}]})),
        {subcells:[{text:stat.totalNet,color:"#dc2626",bold:true},{text:rankFor(stat.totalNet,classroomStats.map(item=>item.totalNet)),bold:true}]},
        {text:stat.students.length,bold:true},
      ]),
    ];
    const gradeLevels=Array.from(new Set(classrooms.map(classroom=>String(classroom).match(/\d+/)?.[0]).filter(Boolean))).join(", ");
    const historicalResults=evaluateExam?availableExams.filter(item=>item.id!==exam?.id).flatMap(item=>storedResultsForExam(item)):[];
    const historicalNetFor=(classroom:string,subjectName:string)=>{const values=historicalResults.filter(student=>(student.classroom||"Sınıfsız")===classroom).map(student=>subjectResult(student,subjectName)?.net).filter((value:any)=>typeof value==="number") as number[];return values.length?Number((values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2)):null;};
    const comparisonSubjects=subjects.map((subject,index)=>({subject,rankings:classroomStats.map(stat=>{const rank=rankFor(stat.subjectNets[index],classroomStats.map(item=>item.subjectNets[index]));const historicalNet=historicalNetFor(stat.classroom,subject);return{classroom:stat.classroom,rank,currentNet:stat.subjectNets[index],historicalNet,delta:historicalNet===null?null:Number((stat.subjectNets[index]-historicalNet).toFixed(2))};}).sort((a,b)=>a.rank-b.rank||b.currentNet-a.currentNet)}));
    const alerts=classroomStats.flatMap(stat=>{const belowSubjects=subjects.filter((_,index)=>stat.subjectNets[index]<institutionSubjectAverages[index]);const topSubjects=subjects.filter((_,index)=>rankFor(stat.subjectNets[index],classroomStats.map(item=>item.subjectNets[index]))<=2);return belowSubjects.length>=4&&topSubjects.length?`${stat.classroom}, ${belowSubjects.length} derste kurum ortalamasının altında olmasına rağmen ${topSubjects.join(", ")} derslerinde ilk iki şube arasındadır.`:[];});
    const sections:PdfSection[]=[{title:"OKUL ŞUBE KARŞILAŞTIRMA LİSTESİ",subtitle:`Sınavın Adı: ${examName} • Sınıf Düzeyi: ${gradeLevels||"Tümü"} • Tarih: ${exam?.examDate||"-"}`,headers:["",...subjectHeaders,"TOPLAM","Okul\nKatılım"],widths,rows,comparisonAnalysis:{subjects:comparisonSubjects,alerts}}];
    return exportTablePdf(`${examName}-sube-karsilastirma-raporu.pdf`,"Şube Karşılaştırma Raporu",sections,{orientation:"landscape",rowsPerPage:18,download:false,fullWidth:true,horizontalMarginMm:5,centerCells:true,columnBorderColor:"#166534",stripedRows:true,bodyRowHeightPx:28,headBackgroundColor:"#4f9461",headTextColor:"#ffffff",headerBandBorderColor:"#111827",reportTitleColor:"#dc2626",tableTopMarginPx:55});
  };
  const courseSuccessReport=async()=>{
    const subjectNames=Array.from(new Set(
      results.flatMap((student:any)=>(student?.subjects||[]).map((subject:any)=>String(subject?.subjectName||"").trim())).filter(Boolean)
    )) as string[];
    if(!subjectNames.length) throw new Error("Ders başarı raporu için ders sonucu bulunamadı.");

    const [courseHeaderLogo,courseHeaderCampus]=await Promise.all([
      urlToDataUrl(reportFamilySchoolLogoUrl).catch(()=>undefined),
      urlToDataUrl(reportFamilyCampusUrl).catch(()=>undefined),
    ]);
    const mean=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
    const clamp=(value:number)=>Math.max(0,Math.min(100,value));
    const classrooms=Array.from(new Set(results.map((student:any)=>String(student?.classroom||"Sınıfsız")))).sort(compareClassroomNames);
    const content:any[]=[];

    subjectNames.forEach((subjectName,subjectIndex)=>{
      const subjectRows=results.map((student:any)=>({student,subject:subjectResult(student,subjectName)})).filter((row:any)=>row.subject);
      const questionCount=Math.max(1,...subjectRows.map((row:any)=>Number(row.subject?.totalQuestions||0)));
      const scores=subjectRows.map((row:any)=>clamp(Number(row.subject?.net||0)/questionCount*100));
      const institutionAverage=mean(scores);
      const avgCorrect=mean(subjectRows.map((row:any)=>Number(row.subject?.correct||0)));
      const avgWrong=mean(subjectRows.map((row:any)=>Number(row.subject?.wrong||0)));
      const avgEmpty=mean(subjectRows.map((row:any)=>Number(row.subject?.empty||0)));
      const avgNet=mean(subjectRows.map((row:any)=>Number(row.subject?.net||0)));

      const classData=classrooms.map(classroom=>{
        const rows=subjectRows.filter((row:any)=>String(row.student?.classroom||"Sınıfsız")===classroom);
        if(!rows.length)return null;
        const classScores=rows.map((row:any)=>clamp(Number(row.subject?.net||0)/questionCount*100)).sort((a:number,b:number)=>a-b);
        const q=Math.max(1,Math.ceil(classScores.length*.25));
        const score=mean(classScores), lower25=mean(classScores.slice(0,q)), upper25=mean(classScores.slice(-q));
        const diff=score-institutionAverage;
        let diagnosis="Dengeli";
        if(diff<=-5&&upper25<=institutionAverage-3)diagnosis="Sınıf Geneli";
        else if(lower25<=institutionAverage-5&&upper25>institutionAverage-3)diagnosis="Alt Grup";
        else if(diff>=5&&lower25>=institutionAverage-3)diagnosis="Genel Güçlü";
        else if(upper25-lower25>=20)diagnosis="Belirli Grup";
        return{classroom,count:rows.length,score,lower25,upper25,diff,diagnosis};
      }).filter(Boolean) as any[];
      classData.sort((a,b)=>b.score-a.score||compareClassroomNames(a.classroom,b.classroom));

      const strongest=classData[0], weakest=classData[classData.length-1];
      const findings=[
        strongest?`${strongest.classroom}, %${strongest.score.toFixed(1)} başarı ile dersin en yüksek şube ortalamasına sahiptir.`:"",
        weakest?`${weakest.classroom}, kurum ortalamasından ${Math.abs(weakest.diff).toFixed(1)} puan ${weakest.diff<0?"düşük":"yüksek"} düzeydedir.`:"",
        weakest?.diagnosis==="Sınıf Geneli"?`${weakest.classroom} için başarı sorunu sınıf geneline yayılmış görünmektedir.`:
        weakest?.diagnosis==="Alt Grup"?`${weakest?.classroom||""} için temel risk alt %25 öğrenci grubunda yoğunlaşmaktadır.`:"",
      ].filter(Boolean);

      if(subjectIndex>0)content.push({text:"",pageBreak:"before"});
      content.push(
        buildReportFamilyPdfHeader({
          variant:"analysis",
          accent:"subject",
          schoolName:exam?.schoolName||exam?.institutionName||"ORDU LİSESİ",
          examName,
          examDate:exam?.examDate,
          reportName:"DERS BAŞARI RAPORU",
          sectionTitle:subjectName,
          sectionSubtitle:`${subjectRows.length} öğrenci`,
          meta:[
            {label:"DERS",value:subjectName},
            {label:"ÖĞRENCİ",value:subjectRows.length},
            {label:"BAŞARI",value:`%${institutionAverage.toFixed(1)}`},
          ],
        },courseHeaderLogo,courseHeaderCampus),
        {columns:[
          {width:"20%",table:{widths:["*"],body:[[{stack:[{text:"BAŞARI",fontSize:7,bold:true,color:"#64748b"},{text:`%${institutionAverage.toFixed(1)}`,fontSize:19,bold:true,color:"#0f766e"}],fillColor:"#ecfeff",margin:7}]]},layout:"noBorders"},
          {width:"20%",table:{widths:["*"],body:[[{stack:[{text:"ORT. NET",fontSize:7,bold:true,color:"#64748b"},{text:avgNet.toFixed(2),fontSize:19,bold:true,color:"#1d4ed8"}],fillColor:"#eff6ff",margin:7}]]},layout:"noBorders"},
          {width:"20%",table:{widths:["*"],body:[[{stack:[{text:"ORT. DOĞRU",fontSize:7,bold:true,color:"#64748b"},{text:avgCorrect.toFixed(1),fontSize:19,bold:true,color:"#15803d"}],fillColor:"#f0fdf4",margin:7}]]},layout:"noBorders"},
          {width:"20%",table:{widths:["*"],body:[[{stack:[{text:"ORT. YANLIŞ",fontSize:7,bold:true,color:"#64748b"},{text:avgWrong.toFixed(1),fontSize:19,bold:true,color:"#b45309"}],fillColor:"#fff7ed",margin:7}]]},layout:"noBorders"},
          {width:"20%",table:{widths:["*"],body:[[{stack:[{text:"ORT. BOŞ",fontSize:7,bold:true,color:"#64748b"},{text:avgEmpty.toFixed(1),fontSize:19,bold:true,color:"#be123c"}],fillColor:"#fff1f2",margin:7}]]},layout:"noBorders"}
        ],columnGap:5,margin:[0,0,0,12]},
        {text:"ŞUBELER ARASI BAŞARI KARŞILAŞTIRMASI",fontSize:11,bold:true,color:"#7f1d1d",margin:[0,3,0,5]},
        {table:{headerRows:1,widths:[24,55,45,55,55,50,70,"*"],body:[
          ["Sıra","Şube","Öğrenci","Başarı %","Kurum Fark","Alt %25","Üst %25","Tespit"].map(x=>({text:x,bold:true,color:"#fff",fillColor:"#0f6674",fontSize:7,alignment:"center",margin:[2,5]})),
          ...classData.map((row,index)=>[
            {text:String(index+1),alignment:"center",bold:true},
            {text:row.classroom,bold:true},
            {text:String(row.count),alignment:"center"},
            {text:row.score.toFixed(1),alignment:"center",bold:true},
            {text:`${row.diff>=0?"+":""}${row.diff.toFixed(1)}`,alignment:"center",color:row.diff<0?"#b91c1c":"#047857",bold:true},
            {text:row.lower25.toFixed(1),alignment:"center"},
            {text:row.upper25.toFixed(1),alignment:"center"},
            {text:row.diagnosis,bold:true,color:"#7c2d12"}
          ])
        ]},layout:{fillColor:(rowIndex:number)=>rowIndex>0&&rowIndex%2===0?"#f8fafc":null,hLineColor:()=>"#cbd5e1",vLineColor:()=>"#e2e8f0"},fontSize:7,margin:[0,0,0,10]},
        {text:"ÖNEMLİ TESPİTLER",fontSize:11,bold:true,color:"#7f1d1d",margin:[0,2,0,4]},
        {stack:findings.map((finding,index)=>({
          table:{widths:[18,"*"],body:[[
            {text:String(index+1),bold:true,color:"#fff",fillColor:"#8b1e2d",alignment:"center",margin:[0,4]},
            {text:finding,fontSize:8,bold:true,color:"#334155",fillColor:"#fff7ed",margin:[6,4]}
          ]]},layout:{hLineColor:()=>"#8b1e2d",vLineColor:()=>"#8b1e2d"},margin:[0,0,0,4]
        }))},
        {text:"MÜDAHALE ODAĞI",fontSize:11,bold:true,color:"#0f6674",margin:[0,7,0,4]},
        {table:{widths:["*"],body:[[{text:
          weakest?.diagnosis==="Sınıf Geneli"
            ?`${weakest.classroom}: sınıf geneline yönelik konu tekrarı, kısa kazanım taraması ve ardından yeniden ölçme önerilir.`
            :weakest?.diagnosis==="Alt Grup"
              ?`${weakest.classroom}: alt %25 öğrenci grubu için hedefli destek çalışması ve kısa aralıklı izleme önerilir.`
              :"Şube bazlı kazanım sonuçları izlenerek düşük performanslı öğrenci gruplarına hedefli çalışma planlanmalıdır.",
          fontSize:8,bold:true,color:"#0f4c5c",fillColor:"#ecfeff",margin:[8,7]
        }]]},layout:{hLineColor:()=>"#14b8a6",vLineColor:()=>"#14b8a6"}}
      );
    });

    return await generatePdf({
      pageSize:"A4",
      pageOrientation:"portrait",
      pageMargins:[20,18,20,20],
      defaultStyle:{fontSize:8,color:"#334155"},
      content
    },{fileName:`${examName}-ders-basari-raporu.pdf`,download:false});
  };

  const rankedListsReport=async()=>{
    const ranked=[...results].sort((a,b)=>Number(b?.totals?.net||0)-Number(a?.totals?.net||0));
    const subjects=Array.from(new Set(ranked.flatMap(student=>(student?.subjects||[]).map((subject:any)=>String(subject?.subjectName||"").trim())).filter(Boolean))) as string[];
    // Sıralı listelerde ders alt sütunları bulunduğu için yatay A4 her zaman
    // okunabilir ve sabit bir yerleşim sağlar.
    const identity=(student:any)=>String(student?.recordId||student?.id||student?.studentNumber||student?.studentName||"");
    const rankMap=(students:any[],score:(student:any)=>number)=>new Map(
      [...students]
        .sort((a,b)=>score(b)-score(a))
        .map((student,index)=>[identity(student),index+1]),
    );
    const classroomRanks=new Map<string,number>();
    const byClassroom=new Map<string,any[]>();
    ranked.forEach((student:any)=>{
      const classroom=String(student?.classroom||"Sınıfsız");
      const group=byClassroom.get(classroom)||[];
      group.push(student);
      byClassroom.set(classroom,group);
    });
    byClassroom.forEach(group=>rankMap(group,student=>Number(student?.totals?.net||0)).forEach((rank,key)=>classroomRanks.set(key,rank)));
    const subjectInstitutionRanks=new Map<string,Map<string,number>>(
      subjects.map(subjectName=>[
        subjectName,
        rankMap(ranked,student=>Number(subjectResult(student,subjectName)?.net||0)),
      ]),
    );
    const headers:any[]=["Sıra","No","Şube","Adı Soyadı",...subjects.map(subject=>({text:subject,subcells:[{text:"D"},{text:"Y"},{text:"B"},{text:"Net"},{text:"Kurum Sıra"}]})),{text:"Genel Sonuç",subcells:[{text:"Top. D"},{text:"Top. Y"},{text:"Top. B"},{text:"Top. Net"},{text:"Puan"},{text:"Şube Sıra"},{text:"Kurum Sıra"},{text:"Genel Sıra"},{text:"Akademik Durum"}]}];
    const rawWidths=[4,5,6,14,...subjects.map(()=>Math.max(7,52/Math.max(1,subjects.length))),24];
    const total=rawWidths.reduce((sum,value)=>sum+value,0);
    const widths=rawWidths.map(value=>Number((value/total*100).toFixed(2)));
    const rows=ranked.map((student,index)=>{
      const classRank=classroomRanks.get(identity(student))||index+1;
      const totalQuestions=(student?.subjects||[]).reduce(
        (sum:number,subject:any)=>sum+Number(subject?.totalQuestions||0),
        0,
      );
      const score=Number(
        student?.score??
        (totalQuestions
          ? Math.max(0,Number(student?.totals?.net||0)/totalQuestions*500)
          : 0),
      );
      const subjectCells=subjects.map(subjectName=>{const subject=subjectResult(student,subjectName);return{subcells:[{text:Number(subject?.correct||0)},{text:Number(subject?.wrong||0)},{text:Number(subject?.empty||0)},{text:Number(subject?.net||0).toFixed(2),bold:true,color:"#1d4ed8"},{text:subjectInstitutionRanks.get(subjectName)?.get(identity(student))||"-",bold:true,color:"#4338ca"}]};});
      return[{text:index+1,bold:true,color:index<3?"#b45309":"#334155"},student?.studentNumber||"-",student?.classroom||"-",{text:student?.studentName||"Öğrenci",bold:true},...subjectCells,{subcells:[{text:Number(student?.totals?.correct||0)},{text:Number(student?.totals?.wrong||0)},{text:Number(student?.totals?.empty||0)},{text:Number(student?.totals?.net||0).toFixed(2),bold:true,color:"#1d4ed8"},{text:score.toFixed(2),bold:true,color:"#6d28d9"},{text:classRank,bold:true},{text:index+1,bold:true},{text:rankOnly(student?.generalRank??student?.overallRank,index+1),bold:true,color:"#be123c"}] }];
    });
    // Sıralı liste şablonunun sütun ölçüleri sınavdan bağımsızdır: en fazla
    // dokuz ders, ders başına D-Y-B-Net için dört sabit sütun kullanılır.
    const reportSubjects=subjects.slice(0,9);
    // Genel sıralama (G) yalnızca sınav birden fazla okulun katıldığı ortak sınav verisi içeriyorsa gösterilir.
    const showGeneralRank=results.some((student:any)=>{
      const schoolParticipants=Number(student?.institutionParticipants??student?.schoolParticipants??results.length)||results.length;
      const generalParticipants=Number(student?.generalParticipants??student?.overallParticipants??student?.nationalParticipants??schoolParticipants)||schoolParticipants;
      const schoolCount=Number(student?.schoolCount??student?.institutionCount??student?.participatingSchoolCount??0);
      return schoolCount>1||generalParticipants>schoolParticipants;
    });
    const scoreFor=(student:any)=>{
      const questions=(student?.subjects||[]).reduce((sum:number,subject:any)=>sum+Number(subject?.totalQuestions||0),0);
      const score=Number(student?.score??(questions?Number(student?.totals?.net||0)/questions*500:0));
      return Number.isFinite(score)?score:0;
    };
    const scoreRanks=new Map<string,number>([...ranked].sort((a,b)=>scoreFor(b)-scoreFor(a)).map((student,index)=>[identity(student),index+1]));
    const classroomScoreRanks=new Map<string,number>();
    byClassroom.forEach(group=>[...group].sort((a,b)=>scoreFor(b)-scoreFor(a)).forEach((student,index)=>classroomScoreRanks.set(identity(student),index+1)));
    const subjectClassroomRanks=new Map<string,Map<string,number>>(
      reportSubjects.map(subject=>{
        const ranks=new Map<string,number>();
        byClassroom.forEach(group=>{
          rankMap(group,student=>Number(subjectResult(student,subject)?.net||0)).forEach((rank,key)=>ranks.set(key,rank));
        });
        return [subject,ranks];
      }),
    );
    const countText=(value:any)=>String(Math.round(Number(value||0)));
    const listRows=ranked.map((student,index)=>[
      index+1,student?.studentNumber||"-",student?.classroom||"-",student?.studentName||"Öğrenci",
      ...reportSubjects.flatMap(subject=>{const result=subjectResult(student,subject);return[countText(result?.correct),countText(result?.wrong),countText(result?.empty),Number(result?.net||0).toFixed(1),subjectClassroomRanks.get(subject)?.get(identity(student))||"-",subjectInstitutionRanks.get(subject)?.get(identity(student))||"-"];}),
      Number(student?.totals?.net||0).toFixed(1),scoreFor(student).toFixed(1),classroomScoreRanks.get(identity(student))||"-",scoreRanks.get(identity(student))||"-",
      ...(showGeneralRank?[rankOnly(student?.generalRank??student?.overallRank??student?.nationalRank,scoreRanks.get(identity(student))||index+1)]:[]),
    ]);
    // Ders metrikleri her raporda aynı, sabit genişlikle gösterilir.
    const listWidths=[14,22,18,73,...reportSubjects.flatMap(()=>[15,15,15,15,15,15]),26,26,26,26,...(showGeneralRank?[26]:[])];
    const tableWidth=listWidths.reduce((sum,width)=>sum+width,0);
    const minimumMargin=14.17;
    const portraitPageWidth=595.28;
    const portraitAvailable=portraitPageWidth-minimumMargin*2;
    const a4LandscapePageWidth=841.89;
    const a4LandscapeAvailable=a4LandscapePageWidth-minimumMargin*2;
    const pageSize=tableWidth<=a4LandscapeAvailable?"A4":"A3";
    const orientation=tableWidth<=portraitAvailable?"portrait":"landscape";
    const pageWidth=orientation==="portrait"?portraitPageWidth:pageSize==="A3"?1190.55:a4LandscapePageWidth;
    const sideMargin=Math.max(minimumMargin,(pageWidth-tableWidth)/2);
    const bodyFontSize=5.4;
    const headerFontSize=6;
    const formatListDate=(value:any)=>{
      const raw=String(value||"").trim();
      if(!raw)return"-";
      const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(iso)return`${iso[3]}.${iso[2]}.${iso[1]}`;
      const tr=raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
      if(tr)return`${String(tr[1]).padStart(2,"0")}.${String(tr[2]).padStart(2,"0")}.${tr[3]}`;
      const parsed=new Date(raw);
      return Number.isNaN(parsed.getTime())?raw.split(/[ T]/)[0]:parsed.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});
    };
    const formattedExamDate=formatListDate(exam?.examDate);
    const documentDefinition={
      pageSize,pageOrientation:orientation,pageMargins:[sideMargin,42.52,sideMargin,28.35],
      content:[
        {table:{widths:[150,"*",88,92],body:[[
          {text:"OKUL SIRALI LİSTE",fontSize:11.5,bold:true,color:"#14532d",characterSpacing:0.65,margin:[0,6,0,0]},
          {stack:[{text:"SINAVIN ADI",fontSize:6,bold:true,color:"#64748b"},{text:examName,fontSize:9,bold:true,color:"#111827",margin:[0,2,0,0]}],alignment:"left",margin:[4,2,4,0]},
          {stack:[{text:"SINIF DÜZEYİ",fontSize:6,bold:true,color:"#64748b"},{text:String(exam?.gradeLevel||exam?.classLevel||"-"),fontSize:9,bold:true,margin:[0,2,0,0]}],margin:[4,2,4,0]},
          {stack:[{text:"SINAV TARİHİ",fontSize:6,bold:true,color:"#64748b"},{text:formattedExamDate,fontSize:9,bold:true,margin:[0,2,0,0]}],alignment:"right",margin:[4,2,0,0]},
        ]]},layout:{hLineWidth:()=>0,vLineWidth:(index:number)=>index===1?1:0,vLineColor:()=>"#e2e8f0",paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0},margin:[0,0,0,8]},
        {table:{headerRows:2,widths:listWidths,body:[
          [{text:"S.",rowSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,7,0,0]},{text:"No.",rowSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,7,0,0]},{text:"S.Ş.",rowSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,7,0,0]},{text:"ADI SOYADI",rowSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,7,0,0]},...reportSubjects.flatMap(subject=>[{text:subject.toLocaleUpperCase("tr-TR"),colSpan:6,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,2,0,2]},{},{},{},{},{}]),{text:"TOPLAM",colSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e40045",color:"#ffffff",margin:[0,2,0,2]},{},{text:"SIRALAMA",colSpan:showGeneralRank?3:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,2,0,2]},{},...(showGeneralRank?[{}]:[])],
          [{},{},{},{},...reportSubjects.flatMap(()=>["D","Y","B","Net","S","K"].map(text=>({text,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:text==="S"||text==="K"?"#e5e7eb":"#dce583",color:text==="S"||text==="K"?"#111827":undefined,margin:[0,1,0,1]})),),{text:"Net",alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e40045",color:"#ffffff",margin:[0,1,0,1]},{text:"Puan",alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e40045",color:"#ffffff",margin:[0,1,0,1]},{text:"S",alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e5e7eb",color:"#111827",margin:[0,1,0,1]},{text:"K",alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e5e7eb",color:"#111827",margin:[0,1,0,1]},...(showGeneralRank?[{text:"G",alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e5e7eb",color:"#111827",margin:[0,1,0,1]}]:[])],
          ...listRows.map((row,rowIndex)=>row.map((text,columnIndex)=>{
            const subjectOffset=columnIndex-4;
            const isSubjectColumn=subjectOffset>=0&&subjectOffset<reportSubjects.length*6;
            const subjectSubColumn=isSubjectColumn?subjectOffset%6:-1;
            const totalsStart=4+reportSubjects.length*6;
            const isRankColumn=columnIndex===2||(isSubjectColumn&&(subjectSubColumn===4||subjectSubColumn===5))||columnIndex===totalsStart+2||columnIndex===totalsStart+3||(showGeneralRank&&columnIndex===totalsStart+4);
            const isNetColumn=(isSubjectColumn&&subjectSubColumn===3)||columnIndex===totalsStart;
            return {text:String(text),alignment:columnIndex===3?"left":"center",margin:columnIndex===3?[2.83,0,0,0]:undefined,fontSize:bodyFontSize,fillColor:isRankColumn?"#e5e7eb":rowIndex%2?"#ffffff":"#eeeeee",bold:isNetColumn?true:undefined,color:isNetColumn?"#111111":undefined};
          })),
        ]},layout:{
          hLineWidth:()=>0.35,
          vLineWidth:(index:number)=>{const firstSubjectBoundary=4;const lastSubjectBoundary=4+reportSubjects.length*6;return index>=firstSubjectBoundary&&index<=lastSubjectBoundary&&(index-firstSubjectBoundary)%6===0?0.9:0.35;},
          hLineColor:()=>"#475569",
          vLineColor:(index:number)=>{const firstSubjectBoundary=4;const lastSubjectBoundary=4+reportSubjects.length*6;return index>=firstSubjectBoundary&&index<=lastSubjectBoundary&&(index-firstSubjectBoundary)%6===0?"#dc2626":"#64748b";},
          paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>2,paddingBottom:()=>2}},
      ],defaultStyle:{font:"Roboto"},
    };
    return await generatePdf(documentDefinition,{mode:"blob",filename:`${examName}-kurum-geneli-sirali-liste.pdf`}) as Blob;
  };

  const classroomRankedListsReport=async()=>{
    const classroomNames=Array.from(new Set(results.map(student=>String(student?.classroom||"Sınıfsız")))).sort(compareClassroomNames);
    if(!classroomNames.length)throw new Error("Şube sıralı listesi için öğrenci sonucu bulunamadı.");
    const subjects=Array.from(new Set(results.flatMap(student=>(student?.subjects||[]).map((subject:any)=>String(subject?.subjectName||"").trim())).filter(Boolean))) as string[];
    const reportSubjects=subjects.slice(0,9);
    const identity=(student:any)=>String(student?.recordId||student?.id||student?.studentNumber||student?.studentName||"");
    const rankMap=(students:any[],score:(student:any)=>number)=>new Map([...students].sort((a,b)=>score(b)-score(a)).map((student,index)=>[identity(student),index+1]));
    const scoreFor=(student:any)=>{const questions=(student?.subjects||[]).reduce((sum:number,subject:any)=>sum+Number(subject?.totalQuestions||0),0);const score=Number(student?.score??(questions?Number(student?.totals?.net||0)/questions*500:0));return Number.isFinite(score)?score:0;};
    const countText=(value:any)=>String(Math.round(Number(value||0)));
    const formatListDate=(value:any)=>{const raw=String(value||"").trim();if(!raw)return"-";const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);if(iso)return`${iso[3]}.${iso[2]}.${iso[1]}`;const tr=raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);if(tr)return`${String(tr[1]).padStart(2,"0")}.${String(tr[2]).padStart(2,"0")}.${tr[3]}`;const parsed=new Date(raw);return Number.isNaN(parsed.getTime())?raw.split(/[ T]/)[0]:parsed.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});};
    const formattedExamDate=formatListDate(exam?.examDate);
    const listWidths=[14,22,18,73,...reportSubjects.flatMap(()=>[15,15,15,15,15,15]),26,26,26,26];
    const tableWidth=listWidths.reduce((sum,width)=>sum+width,0),minimumMargin=14.17,portraitPageWidth=595.28,portraitAvailable=portraitPageWidth-minimumMargin*2,a4LandscapePageWidth=841.89,a4LandscapeAvailable=a4LandscapePageWidth-minimumMargin*2;
    const pageSize=tableWidth<=a4LandscapeAvailable?"A4":"A3",orientation=tableWidth<=portraitAvailable?"portrait":"landscape",pageWidth=orientation==="portrait"?portraitPageWidth:pageSize==="A3"?1190.55:a4LandscapePageWidth,sideMargin=Math.max(minimumMargin,(pageWidth-tableWidth)/2),bodyFontSize=5.4,headerFontSize=6;
    const content:any[]=[];
    classroomNames.forEach((classroom,classIndex)=>{
      const ranked=results.filter(student=>String(student?.classroom||"Sınıfsız")===classroom).sort((a,b)=>Number(b?.totals?.net||0)-Number(a?.totals?.net||0));
      const subjectClassroomRanks=new Map<string,Map<string,number>>(reportSubjects.map(subject=>[subject,rankMap(ranked,student=>Number(subjectResult(student,subject)?.net||0))]));
      const scoreRanks=rankMap(ranked,scoreFor);
      const listRows=ranked.map((student,index)=>[index+1,student?.studentNumber||"-",classroom,student?.studentName||"Öğrenci",...reportSubjects.flatMap(subject=>{const result=subjectResult(student,subject);return[countText(result?.correct),countText(result?.wrong),countText(result?.empty),Number(result?.net||0).toFixed(1),subjectClassroomRanks.get(subject)?.get(identity(student))||"-",subjectClassroomRanks.get(subject)?.get(identity(student))||"-"];}),Number(student?.totals?.net||0).toFixed(1),scoreFor(student).toFixed(1),scoreRanks.get(identity(student))||index+1,scoreRanks.get(identity(student))||index+1]);
      if(classIndex>0)content.push({text:"",pageBreak:"before"});
      content.push(
        {table:{widths:[150,"*",88,92],body:[[{text:"ŞUBE SIRALI LİSTE",fontSize:11.5,bold:true,color:"#14532d",characterSpacing:0.65,margin:[0,6,0,0]},{stack:[{text:"SINAVIN ADI",fontSize:6,bold:true,color:"#64748b"},{text:examName,fontSize:9,bold:true,color:"#111827",margin:[0,2,0,0]}],alignment:"left",margin:[4,2,4,0]},{stack:[{text:"SINIF / ŞUBE",fontSize:6,bold:true,color:"#64748b"},{text:classroom,fontSize:9,bold:true,margin:[0,2,0,0]}],margin:[4,2,4,0]},{stack:[{text:"SINAV TARİHİ",fontSize:6,bold:true,color:"#64748b"},{text:formattedExamDate,fontSize:9,bold:true,margin:[0,2,0,0]}],alignment:"right",margin:[4,2,0,0]}]]},layout:{hLineWidth:()=>0,vLineWidth:(index:number)=>index===1?1:0,vLineColor:()=>"#e2e8f0",paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0},margin:[0,0,0,8]},
        {table:{headerRows:2,widths:listWidths,body:[[{text:"S.",rowSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,7,0,0]},{text:"No.",rowSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,7,0,0]},{text:"S.Ş.",rowSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,7,0,0]},{text:"ADI SOYADI",rowSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,7,0,0]},...reportSubjects.flatMap(subject=>[{text:subject.toLocaleUpperCase("tr-TR"),colSpan:6,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,2,0,2]},{},{},{},{},{}]),{text:"TOPLAM",colSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e40045",color:"#ffffff",margin:[0,2,0,2]},{},{text:"SIRALAMA",colSpan:2,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#5ea476",color:"#ffffff",margin:[0,2,0,2]},{}],[{},{},{},{},...reportSubjects.flatMap(()=>["D","Y","B","Net","S","K"].map(text=>({text,alignment:"center",bold:true,fontSize:headerFontSize,fillColor:text==="S"||text==="K"?"#e5e7eb":"#dce583",color:text==="S"||text==="K"?"#111827":undefined,margin:[0,1,0,1]}))),{text:"Net",alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e40045",color:"#ffffff",margin:[0,1,0,1]},{text:"Puan",alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e40045",color:"#ffffff",margin:[0,1,0,1]},{text:"S",alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e5e7eb",color:"#111827",margin:[0,1,0,1]},{text:"K",alignment:"center",bold:true,fontSize:headerFontSize,fillColor:"#e5e7eb",color:"#111827",margin:[0,1,0,1]}],...listRows.map((row,rowIndex)=>row.map((text,columnIndex)=>{const subjectOffset=columnIndex-4,isSubjectColumn=subjectOffset>=0&&subjectOffset<reportSubjects.length*6,subjectSubColumn=isSubjectColumn?subjectOffset%6:-1,totalsStart=4+reportSubjects.length*6,isRankColumn=columnIndex===2||(isSubjectColumn&&(subjectSubColumn===4||subjectSubColumn===5))||columnIndex===totalsStart+2||columnIndex===totalsStart+3,isNetColumn=(isSubjectColumn&&subjectSubColumn===3)||columnIndex===totalsStart;return{text:String(text),alignment:columnIndex===3?"left":"center",margin:columnIndex===3?[2.83,0,0,0]:undefined,fontSize:bodyFontSize,fillColor:isRankColumn?"#e5e7eb":rowIndex%2?"#ffffff":"#eeeeee",bold:isNetColumn?true:undefined,color:isNetColumn?"#111111":undefined};}))]},layout:{hLineWidth:()=>0.35,vLineWidth:(index:number)=>{const firstSubjectBoundary=4,lastSubjectBoundary=4+reportSubjects.length*6;return index>=firstSubjectBoundary&&index<=lastSubjectBoundary&&(index-firstSubjectBoundary)%6===0?0.9:0.35;},hLineColor:()=>"#475569",vLineColor:(index:number)=>{const firstSubjectBoundary=4,lastSubjectBoundary=4+reportSubjects.length*6;return index>=firstSubjectBoundary&&index<=lastSubjectBoundary&&(index-firstSubjectBoundary)%6===0?"#dc2626":"#64748b";},paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>2,paddingBottom:()=>2}}
      );
    });
    const documentDefinition={pageSize,pageOrientation:orientation,pageMargins:[sideMargin,42.52,sideMargin,28.35],content,defaultStyle:{font:"Roboto"}};
    return await generatePdf(documentDefinition,{mode:"blob",filename:`${examName}-sube-sirali-listeleri.pdf`}) as Blob;
  };
  const teacherReport=async(kind:string)=>{
    const subjects=Array.from(new Set(results.flatMap(r=>(r.subjects||[]).map((s:any)=>s.subjectName)))) as string[];
    if(kind!=="Ders-Başarı"){
      const sections:PdfSection[]=subjects.map(name=>{const entries=results.map(r=>({student:r.studentName,classroom:r.classroom,result:r.subjects.find((s:any)=>s.subjectName===name)})).filter(x=>x.result);return{title:name,subtitle:`${entries.length} öğrenci`,headers:["Sınıf","Öğrenci","Doğru","Yanlış","Boş","Net"],widths:[12,34,12,12,12,18],rows:entries.map(x=>[x.classroom,x.student,x.result.correct,x.result.wrong,x.result.empty,x.result.net])}});
      return await exportTablePdf(`${examName}-${kind}.pdf`,kind,sections,{orientation:"landscape",rowsPerPage:14,download:false});
    }
    if(!subjects.length)throw new Error("Ders başarı raporu için sınav sonucu bulunamadı.");
    const avg=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
    const fmt=(v:number,d=1)=>Number(v||0).toFixed(d);
    const esc=(v:any)=>String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]||m));
    const pagesHtml=subjects.map((subjectName,subjectIndex)=>{
      const entries=results.map(student=>({student,result:subjectResult(student,subjectName)})).filter(x=>x.result);
      if(!entries.length)return"";
      const qCount=Math.max(...entries.map(x=>Number(x.result?.totalQuestions||0)),0);
      const cAvg=avg(entries.map(x=>Number(x.result?.correct||0))),wAvg=avg(entries.map(x=>Number(x.result?.wrong||0))),eAvg=avg(entries.map(x=>Number(x.result?.empty||0))),nAvg=avg(entries.map(x=>Number(x.result?.net||0)));
      const success=qCount?cAvg/qCount*100:0;
      const sorted=[...entries].sort((a,b)=>Number(b.result?.net||0)-Number(a.result?.net||0));
      const quart=Math.max(1,Math.ceil(sorted.length*.25)),topAvg=avg(sorted.slice(0,quart).map(x=>Number(x.result?.net||0))),bottomAvg=avg(sorted.slice(-quart).map(x=>Number(x.result?.net||0)));
      const classrooms=Array.from(new Set(entries.map(x=>String(x.student?.classroom||"Sınıfsız")))).sort(compareClassroomNames);
      const stats=classrooms.map(classroom=>{const g=entries.filter(x=>String(x.student?.classroom||"Sınıfsız")===classroom).sort((a,b)=>Number(b.result?.net||0)-Number(a.result?.net||0));const cq=Math.max(1,Math.ceil(g.length*.25));const mean=avg(g.map(x=>Number(x.result?.net||0)));return{classroom,count:g.length,mean,top:avg(g.slice(0,cq).map(x=>Number(x.result?.net||0))),bottom:avg(g.slice(-cq).map(x=>Number(x.result?.net||0)))};});
      const best=[...stats].sort((a,b)=>b.mean-a.mean)[0],weak=[...stats].sort((a,b)=>a.mean-b.mean)[0];
      const bands=[{l:"80–100",a:80,b:101},{l:"60–79",a:60,b:80},{l:"40–59",a:40,b:60},{l:"20–39",a:20,b:40},{l:"0–19",a:0,b:20}].map(x=>({...x,count:entries.filter(e=>{const p=qCount?Number(e.result?.correct||0)/qCount*100:0;return p>=x.a&&p<x.b}).length}));
      const rows=stats.map((x,i)=>`<tr><td><b>${esc(x.classroom)}</b></td><td>${x.count}</td><td><b>${fmt(x.mean)}</b></td><td class="${x.mean>=nAvg?'up':'down'}">${x.mean>=nAvg?'+':''}${fmt(x.mean-nAvg)}</td><td>${fmt(x.top)}</td><td>${fmt(x.bottom)}</td><td>${qCount?fmt(x.mean/qCount*100):'0.0'}%</td></tr>`).join('');
      const bars=bands.map((b,i)=>{const pct=entries.length?b.count/entries.length*100:0;return`<div class="barrow"><span>${b.l}</span><div class="track"><i style="width:${pct}%"></i></div><b>${b.count} (%${Math.round(pct)})</b></div>`}).join('');
      return `<div class="page"><style>${`*{box-sizing:border-box}body{margin:0}.page{width:1123px;height:1588px;background:#f7faf9;color:#18313b;font-family:Arial,sans-serif;position:relative;overflow:hidden;padding:0 54px 86px}.hero{height:255px;margin:0 -54px 22px;position:relative;overflow:hidden;background:linear-gradient(112deg,#eaf8fb 0%,#fff 34%,#fff 62%,#eaf8fb 100%);display:grid;grid-template-columns:30% 48% 22%;align-items:stretch;box-shadow:0 12px 26px rgba(8,51,68,.10)}.hero:before{content:"";position:absolute;left:300px;top:88px;width:560px;height:86px;border-radius:28px;transform:skewX(-12deg);background:linear-gradient(90deg,#075b84,#0b869e);box-shadow:0 12px 0 #ffc32c}.hero:after{content:"";position:absolute;right:-90px;bottom:-100px;width:360px;height:320px;border-radius:48%;transform:rotate(-8deg);background:linear-gradient(145deg,#0b869e,#075b84)}.fh-left,.fh-mid,.fh-right{position:relative;z-index:2}.fh-left{padding:42px 28px 24px 54px;display:flex;flex-direction:column;justify-content:center}.fh-kicker{font-size:12px;font-weight:900;letter-spacing:2px;color:#0b607a}.fh-subject{font-size:27px;font-weight:900;color:#083344;line-height:1.05;margin-top:6px}.fh-detail{font-size:13px;font-weight:700;color:#5b7480;margin-top:12px}.fh-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.fh-school{font-size:30px;font-weight:900;color:#083344;letter-spacing:-1px}.fh-year{font-size:11px;font-weight:800;letter-spacing:1.8px;color:#68818b;margin-top:2px}.fh-exam{margin-top:26px;width:92%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:31px;font-weight:900;color:#fff;line-height:1}.fh-date{margin-top:22px;border-radius:999px;background:#fff;padding:8px 18px;font-size:12px;font-weight:900;color:#083344;box-shadow:0 3px 9px rgba(8,51,68,.13)}.fh-right{display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;padding:24px;font-size:24px;font-weight:900;line-height:1.02;text-transform:uppercase}.meta{font-size:14px;color:#657a82}.grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}.metric,.card{background:#fff;border:1px solid #dce8e4;border-radius:18px;box-shadow:0 5px 14px #21483a12}.metric{padding:16px;text-align:center;border-top:6px solid #0f766e}.metric small{display:block;color:#6b7e85;font-weight:700}.metric b{display:block;font-size:27px;margin-top:5px}.section{font-size:20px;color:#0f6b61;margin:16px 0 8px}.two{display:grid;grid-template-columns:1.05fr .95fr;gap:14px}.card{padding:16px}.card h3{margin:0 0 5px;color:#244b55;font-size:18px}.sub{color:#819198;font-size:13px;margin-bottom:12px}.snapshot{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.snap{background:#f1f7f4;border-radius:12px;padding:13px;text-align:center}.snap b{font-size:23px;display:block}.barrow{display:grid;grid-template-columns:70px 1fr 80px;gap:8px;align-items:center;margin:9px 0;font-size:13px}.track{height:12px;background:#e8efec;border-radius:10px;overflow:hidden}.track i{display:block;height:100%;background:#df9a32;border-radius:10px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#0f766e;color:#fff;padding:10px 7px}td{padding:9px 7px;border-bottom:1px solid #e1e9e6;text-align:center}tr:nth-child(even) td{background:#f7faf9}.up{color:#087f5b;font-weight:700}.down{color:#c2413b;font-weight:700}.findings{display:grid;grid-template-columns:1fr 1fr;gap:12px}.note{border-left:7px solid #8d2335;background:#fff8f1;padding:14px 16px;border-radius:12px;font-size:14px;line-height:1.45}.action{border-left:7px solid #0f766e;background:#eef8f5;padding:14px 16px;border-radius:12px;font-size:14px;line-height:1.45}.footer{position:absolute;bottom:0;left:0;right:0;height:66px;background:#0f766e;color:#fff;padding:23px 55px;font-weight:700}.footer span{float:right;font-weight:400}`}</style><div class="hero"><div class="fh-left"><div class="fh-kicker">DERS</div><div class="fh-subject">${esc(subjectName)}</div><div class="fh-detail">${entries.length} öğrenci • ${qCount} soru</div></div><div class="fh-mid"><div class="fh-school">ORDU LİSESİ</div><div class="fh-year">AKADEMİK SINAV ANALİZİ</div><div class="fh-exam">${esc(examName)}</div><div class="fh-date">▣ ${esc(exam?.examDate||'-')}</div></div><div class="fh-right">DERS<br/>BAŞARI<br/>RAPORU</div></div>
      <div class="grid5"><div class="metric"><small>SORU SAYISI</small><b>${qCount}</b></div><div class="metric"><small>ORTALAMA NET</small><b>${fmt(nAvg)}</b></div><div class="metric"><small>BAŞARI</small><b>%${fmt(success)}</b></div><div class="metric"><small>ÜST %25</small><b>${fmt(topAvg)}</b></div><div class="metric"><small>ALT %25</small><b>${fmt(bottomAvg)}</b></div></div>
      <div class="two"><div class="card"><h3>Dersin Fotoğrafı</h3><div class="sub">Kurum genelindeki temel performans göstergeleri</div><div class="snapshot"><div class="snap">Doğru<b>${fmt(cAvg)}</b></div><div class="snap">Yanlış<b>${fmt(wAvg)}</b></div><div class="snap">Boş<b>${fmt(eAvg)}</b></div><div class="snap">Net<b>${fmt(nAvg)}</b></div></div></div><div class="card"><h3>Başarı Dağılımı</h3><div class="sub">Öğrencilerin başarı yüzdesi dilimleri</div>${bars}</div></div>
      <h3 class="section">Şubeler Arası Karşılaştırma</h3><div class="card"><table><thead><tr><th>Şube</th><th>Öğrenci</th><th>Ort. Net</th><th>Kurum Farkı</th><th>Üst %25</th><th>Alt %25</th><th>Başarı</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h3 class="section">Önemli Tespitler ve Müdahale</h3><div class="findings"><div class="note"><b>ÖNEMLİ TESPİTLER</b><br>• ${best?`${esc(best.classroom)} en yüksek şube ortalamasına sahip (${fmt(best.mean)} net).`:'Şube verisi yok.'}<br>• ${weak?`${esc(weak.classroom)} en düşük şube ortalamasında (${fmt(weak.mean)} net).`:''}<br>• Üst %25 ile alt %25 arasında <b>${fmt(topAvg-bottomAvg)} net</b> fark var.<br>• ${topAvg-bottomAvg>Math.max(3,qCount*.25)?'Başarı farkı özellikle alt %25 grubunda yoğunlaşıyor.':'Başarı daha dengeli; ortak kazanım eksikleri incelenmeli.'}</div><div class="action"><b>ÖNERİLEN MÜDAHALE</b><br>• Alt %25 için yanlış/boş sorulara dayalı hedef çalışma.<br>• ${weak?esc(weak.classroom):'Düşük şube'} için kısa konu tekrarı ve mini ölçme.<br>• Üst %25 için zenginleştirilmiş üst düzey soru setleri.<br>• Bir sonraki sınavda aynı göstergelerle gelişim karşılaştırması.</div></div>
      <div class="footer">e-Nstitü • HASAT Akademik Analiz Merkezi <span>${subjectIndex+1} / ${subjects.length}</span></div></div>`;
    }).join('');
    const mount=document.createElement("div");mount.setAttribute("aria-hidden","true");mount.style.position="fixed";mount.style.left="-20000px";mount.style.top="0";mount.style.width="1123px";mount.innerHTML=pagesHtml;document.body.appendChild(mount);
    try{await document.fonts?.ready;const {toPng}=await import("html-to-image");const pages=Array.from(mount.querySelectorAll<HTMLElement>(".page"));const imgs:string[]=[];for(const page of pages)imgs.push(await toPng(page,{backgroundColor:"#ffffff",cacheBust:true,pixelRatio:1.65,width:1123,height:1588,style:{margin:"0",boxShadow:"none"}}));return await generatePdf({pageSize:"A4",pageOrientation:"portrait",pageMargins:[0,0,0,0],content:imgs.map((image,index)=>({image,width:595.28,height:841.89,pageBreak:index<imgs.length-1?"after":undefined}))},{mode:"blob",filename:`${examName}-ders-basari-raporu.pdf`}) as Blob;}finally{mount.remove();}
  };
  const familyReport=async(kind:string)=>{
    const sections:PdfSection[]=results.map(student=>({title:student.studentName,subtitle:`${student.classroom} • ${examName}`,headers:["Ders","Doğru","Yanlış","Boş","Net","Başarı"],widths:[34,12,12,12,15,15],rows:student.subjects.map((s:any)=>[s.subjectName,s.correct,s.wrong,s.empty,s.net,`%${s.totalQuestions?Math.round(s.correct/s.totalQuestions*100):0}`])}));
    return await exportTablePdf(`${examName}-${kind}.pdf`,kind,sections,{orientation:"portrait",rowsPerPage:16,download:false});
  };
  const combinedScorecardReport=async()=>{
    const options=availableExams.map((item,index)=>`${index+1}. ${item.examName||"Sınav"}`).join("\n");
    const answer=window.prompt(`Birleşik karneye eklenecek sınavların numaralarını virgülle ayırarak yazın:\n\n${options}`,combinedExamIds.map(id=>availableExams.findIndex(item=>item.id===id)+1).filter(index=>index>0).join(","));
    if(answer===null)throw new Error("Sınav seçimi iptal edildi.");
    const selectedIds=Array.from(new Set(answer.split(/[,;\s]+/).map(value=>Number(value)-1).filter(index=>index>=0&&index<availableExams.length).map(index=>availableExams[index].id)));
    if(selectedIds.length<2)throw new Error("Birleşik karne için en az iki sınav seçin.");
    setCombinedExamIds(selectedIds);
    if(!selectedStudent||!evaluateExam)throw new Error("Birleşik karne için bir öğrenci seçin.");
    const studentNumber=String(selectedStudent.studentNumber||"");
    const selected=availableExams.filter(item=>selectedIds.includes(item.id)).map(selectedExam=>({exam:selectedExam,record:storedResultsForExam(selectedExam).find(record=>String(record.studentNumber)===studentNumber)})).filter((item): item is { exam: any; record: any } => Boolean(item.record));
    if(selected.length<2)throw new Error("Öğrencinin seçilen sınavlardan en az ikisinde sonucu bulunmalıdır.");
    const merged:Record<string,{correct:number;wrong:number;empty:number;net:number;questions:number}>={};
    selected.forEach(({record})=>record.subjects.forEach((subject:any)=>{const current=merged[subject.subjectName]||{correct:0,wrong:0,empty:0,net:0,questions:0};current.correct+=subject.correct||0;current.wrong+=subject.wrong||0;current.empty+=subject.empty||0;current.net+=subject.net||0;current.questions+=subject.totalQuestions||0;merged[subject.subjectName]=current;}));
    const combinedTotals=selected.reduce((total,{record})=>({correct:total.correct+(record.totals.correct||0),wrong:total.wrong+(record.totals.wrong||0),empty:total.empty+(record.totals.empty||0),net:total.net+(record.totals.net||0)}),{correct:0,wrong:0,empty:0,net:0});
    const combinedQuestions=Object.values(merged).reduce((sum,value)=>sum+value.questions,0);
    const combinedScore=combinedQuestions?Number((combinedTotals.net/combinedQuestions*500).toFixed(2)):0;
    const candidateMap=new Map<string,{classroom:string;totals:{correct:number;wrong:number;empty:number;net:number};subjects:any[]}>();
    availableExams.filter(item=>selectedIds.includes(item.id)).forEach(selectedExam=>storedResultsForExam(selectedExam).forEach(record=>{const key=String(record.studentNumber||record.recordId||(record as any).id);const current=candidateMap.get(key)||{classroom:record.classroom||"-",totals:{correct:0,wrong:0,empty:0,net:0},subjects:[]};current.totals.correct+=record.totals?.correct||0;current.totals.wrong+=record.totals?.wrong||0;current.totals.empty+=record.totals?.empty||0;current.totals.net+=record.totals?.net||0;current.subjects.push(...(record.subjects||[]));candidateMap.set(key,current);}));
    const selectedKey=String(selectedStudent.studentNumber||selectedStudent.recordId||selectedStudent.id);
    const targetNet=candidateMap.get(selectedKey)?.totals.net??combinedTotals.net;
    const institutionCandidates=Array.from(candidateMap.values());
    const classCandidates=institutionCandidates.filter(candidate=>candidate.classroom===selectedStudent.classroom);
    const combinedInstitutionRank=1+institutionCandidates.filter(candidate=>candidate.totals.net>targetNet).length;
    const combinedClassRank=1+classCandidates.filter(candidate=>candidate.totals.net>targetNet).length;
    const registeredStudents=(await localforage.getItem<any[]>("school_students"))||[];
    const studentProfile=registeredStudents.find(item=>String(item.id||item.studentNumber)===String(selectedStudent.studentNumber)||item.name===selectedStudent.studentName);
    const combinedHeader:ScorecardHeader={studentName:selectedStudent.studentName,reportLabel:"BİRLEŞİK KARNE",examLabel:selected.map(item=>item.exam.examName).join(" + "),classroom:selectedStudent.classroom,studentNumber:selectedStudent.studentNumber,photoUrl:studentProfile?.avatar,performance:[{label:"Şube",...averagePerformance(classCandidates)},{label:"Kurum",...averagePerformance(institutionCandidates)},{label:"Genel",questions:combinedQuestions,correct:combinedTotals.correct,wrong:combinedTotals.wrong,empty:combinedTotals.empty,net:Number(combinedTotals.net.toFixed(2)),score:combinedScore}],rankings:[{label:"Şube",rank:combinedClassRank,participants:classCandidates.length},{label:"Kurum",rank:combinedInstitutionRank,participants:institutionCandidates.length},{label:"Genel",rank:combinedInstitutionRank,participants:institutionCandidates.length}]};
    const sections:PdfSection[]=[{
      title:selectedStudent.studentName,
      subtitle:`${selectedStudent.classroom||"-"} · ${selected.length} sınav birleşimi`,
      headers:["Sınav","Doğru","Yanlış","Boş","Net"],widths:[48,13,13,13,13],
      rows:selected.map(({exam:selectedExam,record})=>[selectedExam.examName||"Sınav",record.totals.correct,record.totals.wrong,record.totals.empty,record.totals.net]),
    },{
      title:"Birleşik Ders Sonuçları",
      subtitle:selected.map(item=>item.exam.examName).join(" · "),
      headers:["Ders","Doğru","Yanlış","Boş","Net","Başarı"],widths:[35,11,11,11,14,18],
      rows:Object.entries(merged).map(([subject,value])=>[subject,value.correct,value.wrong,value.empty,Number(value.net.toFixed(2)),`%${value.questions?Math.round(value.correct/value.questions*100):0}`]),
    }];
    return exportTablePdf(`${selectedStudent.studentName}-birlesik-karne.pdf`,"Birleşik Karne",sections,{orientation:"portrait",rowsPerPage:16,download:false,scorecardHeader:combinedHeader});
  };
  const individualScorecardReport=async()=>{
    const [reportFamilySchoolLogo,reportFamilyCampus]=await Promise.all([
      urlToDataUrl(reportFamilySchoolLogoUrl).catch(()=>undefined),
      urlToDataUrl(reportFamilyCampusUrl).catch(()=>undefined),
    ]);
    const ranked=[...results].sort((a,b)=>(b.totals?.net||0)-(a.totals?.net||0));
    if(!ranked.length)throw new Error("Bireysel karne oluşturmak için sınav sonucu bulunamadı.");

    const reportStudents=selectedStudent
      ? ranked.filter(student=>
          student.recordId===selectedStudent.recordId||
          student.id===selectedStudent.id||
          (
            String(student.studentNumber||"")===String(selectedStudent.studentNumber||"")&&
            String(student.classroom||"")===String(selectedStudent.classroom||"")
          )
        )
      : [ranked[0]];

    if(!reportStudents.length)throw new Error("Seçili öğrenciye ait sınav sonucu bulunamadı.");

    const navy="#082f49";
    const blue="#0f5f99";
    const sky="#eaf5fb";
    const cyan="#d9f0f7";
    const gold="#d6a33d";
    const cream="#fffaf0";
    const green="#0f766e";
    const greenSoft="#dff5ef";
    const rose="#be123c";
    const roseSoft="#ffe7ee";
    const amber="#a16207";
    const amberSoft="#fef3c7";
    const slate="#334155";
    const muted="#64748b";
    const line="#cbd5e1";
    const white="#ffffff";

    const summaryCardWidth=50;
    const summaryCardHeight=50;
    const badge=(label:string,value:any,color:string,background:string)=>({
      width:"*",
      stack:[
        {
          canvas:[
            {type:"rect",x:3,y:4,w:summaryCardWidth,h:summaryCardHeight,r:9,color:"#c8d3df"},
            {type:"rect",x:0,y:0,w:summaryCardWidth,h:summaryCardHeight,r:9,color:background},
            {type:"rect",x:0,y:0,w:summaryCardWidth,h:17,r:9,color},
            {type:"rect",x:0,y:10,w:summaryCardWidth,h:7,color},
            {type:"rect",x:0,y:0,w:summaryCardWidth,h:summaryCardHeight,r:9,lineColor:"#bfd0dd",lineWidth:.65},
          ],
        },
        {
          stack:[
            {
              text:label,
              fontSize:5.4,
              bold:true,
              color:white,
              alignment:"center",
              characterSpacing:.45,
              margin:[1,0,1,0],
            },
            {
              text:String(value??"-"),
              fontSize:9.4,
              bold:false,
              color:"#0f4c81",
              alignment:"center",
              margin:[1,13,1,0],
            },
          ],
          margin:[0,-45,0,0],
        },
      ],
    });

    const gridCard=(label:string,value:any,color:string,background:string)=>({
      stack:[
        {
          canvas:[
            {type:"rect",x:3,y:4,w:48,h:50,r:8,color:"#c8d3df"},
            {type:"rect",x:0,y:0,w:48,h:50,r:8,color:background},
            {type:"rect",x:0,y:0,w:48,h:17,r:8,color},
            {type:"rect",x:0,y:10,w:48,h:7,color},
            {type:"rect",x:0,y:0,w:48,h:50,r:8,lineColor:"#bfd0dd",lineWidth:.65},
          ],
        },
        {
          stack:[
            {
              text:label,
              fontSize:4.65,
              bold:true,
              color:white,
              alignment:"center",
              characterSpacing:.25,
              margin:[1,0,1,0],
              noWrap:true,
            },
            {
              text:String(value??"-"),
              fontSize:8.8,
              bold:false,
              color:"#0f4c81",
              alignment:"center",
              margin:[1,13,1,0],
              noWrap:true,
            },
          ],
          margin:[0,-45,0,0],
        },
      ],
    });


    const summaryTimelineNode=(label:string,value:any,color:string,symbol:string)=>{
      const display=String(value??"-");
      const valueFont=display.length>18?5.1:display.length>12?5.9:display.length>8?7.0:8.8;
      return {
        stack:[
          {
            canvas:[
              {type:"rect",x:4,y:0,w:48,h:12,r:6,color},
              {type:"ellipse",x:28,y:28,r1:20.5,r2:20.5,lineColor:color,lineWidth:2.4,color:"#ffffff"},
              {type:"ellipse",x:28,y:28,r1:14.8,r2:14.8,color},
              {type:"ellipse",x:28,y:59,r1:1.45,r2:1.45,color},
              {type:"ellipse",x:28,y:65,r1:1.45,r2:1.45,color},
              {type:"ellipse",x:28,y:71,r1:1.45,r2:1.45,color},
              {type:"ellipse",x:28,y:81,r1:5.2,r2:5.2,color:"#ffffff",lineColor:color,lineWidth:1.5},
              {type:"ellipse",x:28,y:81,r1:1.7,r2:1.7,color},
            ],
          },
          {
            stack:[
              {
                text:label,
                fontSize:4.5,
                bold:true,
                color:"#ffffff",
                alignment:"center",
                lineHeight:.95,
                margin:[2,2.4,2,0],
              },
              {
                text:display,
                fontSize:valueFont,
                bold:true,
                color:"#ffffff",
                alignment:"center",
                lineHeight:.95,
                margin:[1,15.3,1,0],
              },
            ],
            margin:[0,-84,0,0],
          },
        ],
      };
    };

    const buildSummaryTimeline=(items:{label:string;value:any;color:string;symbol:string}[])=>({
      stack:[
        {
          canvas:[
            {type:"line",x1:28,y1:81,x2:Math.max(28,items.length*57-29),y2:81,lineColor:"#bcc9d7",lineWidth:1.5},
          ],
          margin:[0,0,0,-86],
        },
        {
          table:{
            widths:Array.from({length:items.length},()=>57),
            body:[[...items.map(item=>summaryTimelineNode(item.label,item.value,item.color,item.symbol))]],
          },
          layout:{
            hLineWidth:()=>0,
            vLineWidth:()=>0,
            paddingLeft:()=>0,
            paddingRight:()=>0,
            paddingTop:()=>0,
            paddingBottom:()=>0,
          },
        },
      ],
      margin:[0,0,0,8],
    });

    const tableLayout={
      hLineColor:()=>line,
      vLineColor:()=>line,
      hLineWidth:()=>.55,
      vLineWidth:()=>.55,
      paddingLeft:()=>5,
      paddingRight:()=>5,
      paddingTop:()=>5,
      paddingBottom:()=>5,
    };

    let registeredStudents:any[]=[];
    try{
      registeredStudents=await fetchCollectionFromLocalDatabase("students");
    }catch{
      registeredStudents=[];
    }
    if(!registeredStudents.length){
      const legacyStudents=await localforage.getItem<any[]>("school_students");
      registeredStudents=Array.isArray(legacyStudents)?legacyStudents:[];
    }

    const resolveStudentProfile=(student:any)=>{
      const number=String(student.studentNumber||"").trim();
      const name=String(student.studentName||"").trim().toLocaleLowerCase("tr-TR");
      return registeredStudents.find((item:any)=>{
        const itemNumber=String(
          item.studentNumber??item.schoolNumber??item.number??item.no??item.id??""
        ).trim();
        const itemName=String(
          item.studentName??item.fullName??item.name??
          `${item.firstName??""} ${item.lastName??""}`
        ).replace(/\s+/g," ").trim().toLocaleLowerCase("tr-TR");
        return (number&&itemNumber===number)||(name&&itemName===name);
      });
    };

    const normalizePhoto=(profile:any)=>{
      const candidate=
        profile?.avatar??
        profile?.photoUrl??
        profile?.photo??
        profile?.profilePhoto??
        profile?.profileImage??
        profile?.imageData??
        "";
      const value=String(candidate||"").trim();
      return value.startsWith("data:image/")?value:"";
    };

    const buildCodeScorecardHeader=(student:any,studentPhoto:string)=>{
      const schoolName=String(exam?.schoolName||exam?.institutionName||exam?.school?.name||"ORDU LİSESİ").toLocaleUpperCase("tr-TR");
      return buildReportFamilyPdfHeader({
        variant:"individual",
        schoolName,
        examName:String(examName||"Sınav"),
        examDate:exam?.examDate||exam?.date||exam?.createdAt,
        reportName:"BİREYSEL SINAV KARNESİ",
        student:{
          name:String(student?.studentName||"-"),
          classroom:String(student?.classroom||"-"),
          number:String(student?.studentNumber||"-"),
          photoDataUrl:studentPhoto||undefined,
        },
      },reportFamilySchoolLogo,reportFamilyCampus);
    };

    const content:any[]=[];

    reportStudents.forEach((student:any,studentIndex:number)=>{
      const classStudents=ranked.filter(item=>(item.classroom||"Sınıfsız")===(student.classroom||"Sınıfsız"));
      const institutionRank=ranked.findIndex(item=>item.recordId===student.recordId)+1;
      const classRank=classStudents.findIndex(item=>item.recordId===student.recordId)+1;
      const totalQuestions=(student.subjects||[]).reduce((sum:number,subject:any)=>sum+Number(subject.totalQuestions||0),0);
      const success=totalQuestions?Number((Number(student.totals?.correct||0)/totalQuestions*100).toFixed(1)):0;
      const totalNet=Number(student.totals?.net||0);
      const institutionAverage=ranked.length
        ? Number((ranked.reduce((sum:number,item:any)=>sum+Number(item.totals?.net||0),0)/ranked.length).toFixed(2))
        : 0;
      const classAverage=classStudents.length
        ? Number((classStudents.reduce((sum:number,item:any)=>sum+Number(item.totals?.net||0),0)/classStudents.length).toFixed(2))
        : 0;
      const score=Number(student.score??student.points??student.totals?.score??(totalNet*4));
      const rankPercent=ranked.length?Number(((institutionRank/ranked.length)*100).toFixed(1)):0;
      const generalParticipants=Number(
        student.generalParticipants??
        student.overallParticipants??
        student.nationalParticipants??
        ranked.length
      )||ranked.length;
      const generalRank=Number(
        student.generalRank??
        student.overallRank??
        student.nationalRank??
        institutionRank
      )||institutionRank;
      const schoolParticipants=Number(
        student.institutionParticipants??
        student.schoolParticipants??
        ranked.length
      )||ranked.length;
      const schoolRank=Number(
        student.institutionRank??
        student.schoolRank??
        institutionRank
      )||institutionRank;
      const generalAverage=Number(
        student.generalAverage??
        student.overallAverage??
        student.nationalAverage??
        institutionAverage
      );
      const studentProfile=resolveStudentProfile(student);
      const studentPhoto=normalizePhoto(studentProfile);
      const studentInitial=String(student.studentName||"?").trim().charAt(0).toLocaleUpperCase("tr-TR")||"?";

      const subjects=(student.subjects||[]).map((subject:any)=>{
        const subjectName=subject.subjectName||subject.name||"Ders";
        const total=Number(subject.totalQuestions||0);
        const subjectSuccess=total?Number((Number(subject.correct||0)/total*100).toFixed(1)):0;
        const allSubjectNets=ranked.map(item=>Number(subjectResult(item,subjectName)?.net||0));
        const classSubjectNets=classStudents.map(item=>Number(subjectResult(item,subjectName)?.net||0));
        const institutionSubjectAverage=allSubjectNets.length
          ? Number((allSubjectNets.reduce((sum,value)=>sum+value,0)/allSubjectNets.length).toFixed(2))
          : 0;
        const classSubjectAverage=classSubjectNets.length
          ? Number((classSubjectNets.reduce((sum,value)=>sum+value,0)/classSubjectNets.length).toFixed(2))
          : 0;
        const allSubjectScores=ranked.map(item=>{
          const result=subjectResult(item,subjectName);
          return Number(
            result?.score??
            result?.points??
            result?.puan??
            (Number(result?.net||0)*4)
          );
        });
        const classSubjectScores=classStudents.map(item=>{
          const result=subjectResult(item,subjectName);
          return Number(
            result?.score??
            result?.points??
            result?.puan??
            (Number(result?.net||0)*4)
          );
        });
        const institutionSubjectScoreAverage=allSubjectScores.length
          ? Number((allSubjectScores.reduce((sum,value)=>sum+value,0)/allSubjectScores.length).toFixed(2))
          : 0;
        const classSubjectScoreAverage=classSubjectScores.length
          ? Number((classSubjectScores.reduce((sum,value)=>sum+value,0)/classSubjectScores.length).toFixed(2))
          : 0;
        const allSubjectSuccesses=ranked.map(item=>{
          const result=subjectResult(item,subjectName);
          const q=Number(result?.totalQuestions||0);
          return q?Number(result?.correct||0)/q*100:0;
        });
        const classSubjectSuccesses=classStudents.map(item=>{
          const result=subjectResult(item,subjectName);
          const q=Number(result?.totalQuestions||0);
          return q?Number(result?.correct||0)/q*100:0;
        });
        const institutionSubjectSuccessAverage=allSubjectSuccesses.length
          ? Number((allSubjectSuccesses.reduce((sum,value)=>sum+value,0)/allSubjectSuccesses.length).toFixed(2))
          : 0;
        const classSubjectSuccessAverage=classSubjectSuccesses.length
          ? Number((classSubjectSuccesses.reduce((sum,value)=>sum+value,0)/classSubjectSuccesses.length).toFixed(2))
          : 0;
        const classSubjectRank=[...classStudents]
          .sort((a,b)=>Number(subjectResult(b,subjectName)?.net||0)-Number(subjectResult(a,subjectName)?.net||0))
          .findIndex(item=>item.recordId===student.recordId)+1;
        const institutionSubjectRank=[...ranked]
          .sort((a,b)=>Number(subjectResult(b,subjectName)?.net||0)-Number(subjectResult(a,subjectName)?.net||0))
          .findIndex(item=>item.recordId===student.recordId)+1;

        const subjectScore=Number(
          subject.score??
          subject.points??
          subject.puan??
          (Number(subject.net||0)*4)
        );
        const subjectGeneralRank=Number(
          subject.generalRank??
          subject.overallRank??
          subject.nationalRank??
          institutionSubjectRank
        )||institutionSubjectRank;
        const subjectGeneralParticipants=Number(
          subject.generalParticipants??
          subject.overallParticipants??
          subject.nationalParticipants??
          ranked.length
        )||ranked.length;

        return{
          name:subjectName,
          correct:Number(subject.correct||0),
          wrong:Number(subject.wrong||0),
          empty:Number(subject.empty||0),
          net:Number(subject.net||0),
          score:Number(subjectScore.toFixed(1)),
          success:subjectSuccess,
          classAverage:classSubjectAverage,
          institutionAverage:institutionSubjectAverage,
          classScoreAverage:classSubjectScoreAverage,
          institutionScoreAverage:institutionSubjectScoreAverage,
          classSuccessAverage:classSubjectSuccessAverage,
          institutionSuccessAverage:institutionSubjectSuccessAverage,
          classRank:classSubjectRank,
          institutionRank:institutionSubjectRank,
          generalRank:subjectGeneralRank,
          generalParticipants:subjectGeneralParticipants,
          questions:Array.isArray(subject.questions)?subject.questions:[],
        };
      });

      const strongest=[...subjects].sort((a,b)=>b.success-a.success)[0];
      const development=[...subjects].sort((a,b)=>a.success-b.success)[0];
      const aboveInstitution=totalNet>=institutionAverage;
      const shortComment=subjects.length
        ? `${strongest?.name||"En güçlü ders"} dersindeki performans öğrencinin öne çıkan alanıdır. ${development&&development.name!==strongest?.name?`${development.name} dersinde düzenli tekrar ve kazanım odaklı çalışma önerilir.`:"Mevcut performansın korunması için düzenli tekrar önerilir."}`
        : "Ders bazlı sonuçlar sisteme kaydedildikçe ayrıntılı değerlendirme oluşturulacaktır.";

      if(studentIndex>0)content.push({text:"",pageBreak:"before"});

      content.push(
        buildCodeScorecardHeader(student,studentPhoto),
        {
          columns:[
            {
              width:"*",
              stack:[
                buildSummaryTimeline([
                  {label:"DOĞRU",value:student.totals?.correct||0,color:"#ff5b45",symbol:""},
                  {label:"YANLIŞ",value:student.totals?.wrong||0,color:"#ff2d92",symbol:""},
                  {label:"BOŞ",value:student.totals?.empty||0,color:"#8b5cf6",symbol:""},
                  {label:"NET",value:safeFixed(totalNet,2),color:"#2f7dff",symbol:""},
                  {label:"PUAN",value:score.toFixed(1),color:"#00a6ff",symbol:""},
                  {label:"BAŞARI",value:`%${success}`,color:"#00c4d6",symbol:""},
                  {label:"GENEL",value:`${generalRank}/${generalParticipants}`,color:"#ff8a00",symbol:""},
                  {label:"OKUL",value:`${schoolRank}/${schoolParticipants}`,color:"#ff4fa3",symbol:""},
                  {label:"SINIF",value:`${classRank}/${classStudents.length}`,color:"#7c4dff",symbol:""},
                ]),
              ],
              margin:[28,28,28,0],
            },
          ],
          margin:[0,0,0,12],
        },

        {
          table:{
            widths:["*"],
            body:[[
              {
                stack:[
                  {
                    text:"DERS BAZLI BAŞARI ANALİZİ",
                    fontSize:10,
                    bold:true,
                    color:"#dc2626",
                    alignment:"center",
                    characterSpacing:.7,
                    margin:[0,0,0,7],
                  },
                  {
                    table:{
                      headerRows:2,
                      widths:[88,25,25,25,36,38,42,49,49,49],
                      body:[
                        [
                          {text:"Ders",rowSpan:2,bold:true,color:navy,fillColor:"#f8fafc",alignment:"center",margin:[1,7,1,1]},
                          {text:"D",rowSpan:2,bold:true,color:navy,fillColor:"#f8fafc",alignment:"center",margin:[1,7,1,1]},
                          {text:"Y",rowSpan:2,bold:true,color:navy,fillColor:"#f8fafc",alignment:"center",margin:[1,7,1,1]},
                          {text:"B",rowSpan:2,bold:true,color:navy,fillColor:"#f8fafc",alignment:"center",margin:[1,7,1,1]},
                          {text:"BAŞARI",colSpan:3,bold:true,color:"#dc2626",fillColor:"#fff5f5",alignment:"center"},
                          {},
                          {},
                          {text:"SIRALAMA",colSpan:3,bold:true,color:navy,fillColor:"#f1f5f9",alignment:"center",characterSpacing:.5},
                          {},
                          {},
                        ],
                        [
                          {},
                          {},
                          {},
                          {},
                          {text:"Net",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Puan",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Başarı",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Genel",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Okul",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Sınıf",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                        ],
                      ...subjects.map((subject,index)=>{
                          const rowFill=index%2===0?"#ffffff":"#f8fafc";
                          const mark=(show:boolean)=>show
                            ? {text:"✓",fontSize:8,bold:true,color:"#0f766e",alignment:"right",margin:[0,-1,0,0]}
                            : {text:""};
                          const valueWithMark=(value:string,show:boolean)=>({
                            columns:[
                              {text:value,width:"*",alignment:"center"},
                              {width:10,...mark(show)},
                            ],
                            columnGap:0,
                          });

                          const netAbove=
                            subject.net>subject.institutionAverage;
                          const scoreAbove=
                            subject.score>subject.institutionScoreAverage;
                          const successAbove=
                            subject.success>subject.institutionSuccessAverage;
                          const generalAbove=
                            subject.generalRank<=Math.max(1,Math.ceil(subject.generalParticipants/2));
                          const schoolAbove=
                            subject.institutionRank<=Math.max(1,Math.ceil(ranked.length/2));
                          const classAbove=
                            subject.classRank<=Math.max(1,Math.ceil(classStudents.length/2));

                          return[
                            {text:subject.name,bold:true,color:slate,fillColor:rowFill},
                            {text:subject.correct,alignment:"center",fillColor:rowFill},
                            {text:subject.wrong,alignment:"center",fillColor:rowFill},
                            {text:subject.empty,alignment:"center",fillColor:rowFill},
                            {stack:[valueWithMark(safeFixed(subject?.net,2),netAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(subject.score.toFixed(1),scoreAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(`%${subject.success}`,successAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(`${subject.generalRank}/${subject.generalParticipants}`,generalAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(`${subject.institutionRank}/${ranked.length}`,schoolAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(`${subject.classRank}/${classStudents.length}`,classAbove)],fillColor:rowFill},
                          ];
                        }),
                      ],
                    },
                    layout:{
                      hLineColor:()=>"#dc2626",
                      vLineColor:(index:number)=>index===7?"#94a3b8":"#d8e1e8",
                      hLineWidth:()=>.45,
                      vLineWidth:(index:number)=>index===7?1:.4,
                      paddingLeft:()=>4,
                      paddingRight:()=>4,
                      paddingTop:()=>5,
                      paddingBottom:()=>5,
                    },
                  },
                ],
                margin:[12,10,12,10],
              },
            ]],
          },
          layout:{
            hLineColor:()=>"#dc2626",
            vLineColor:()=>"#dc2626",
            hLineWidth:()=>.8,
            vLineWidth:()=>.8,
            paddingLeft:()=>0,
            paddingRight:()=>0,
            paddingTop:()=>0,
            paddingBottom:()=>0,
          },
          margin:[0,28,0,12],
        },
        {
          stack:[
            {
              text:"DOĞRU CEVAPLAR VE ÖĞRENCİ CEVAPLARI",
              fontSize:10,
              bold:true,
              color:navy,
              alignment:"center",
              characterSpacing:.7,
              margin:[0,0,0,10],
            },
            ...Array.from(
              {length:Math.ceil(subjects.length/2)},
              (_,rowIndex)=>{
                const leftSubject=subjects[rowIndex*2];
                const rightSubject=subjects[rowIndex*2+1];

                const buildSubjectAnswerBlock=(subject:any)=>({
                  width:"49%",
                  stack:[
                    {
                      text:subject?.name||"-",
                      fontSize:8,
                      bold:true,
                      color:navy,
                      alignment:"left",
                      margin:[0,0,0,5],
                    },
                    ...Array.from(
                      {length:Math.max(1,Math.ceil((subject?.questions?.length||0)/10))},
                      (_,questionRowIndex)=>({
                        columns:Array.from({length:10},(_,columnIndex)=>{
                          const questionIndex=questionRowIndex*10+columnIndex;
                          const question=subject?.questions?.[questionIndex];

                          if(!question){
                            return{width:"*",text:""};
                          }

                          const rawStudentAnswer=
                            question.studentAnswer??
                            question.givenAnswer??
                            question.response??
                            question.selectedAnswer??
                            question.selectedOption??
                            question.studentChoice??
                            question.markedAnswer??
                            question.markedOption??
                            question.choice??
                            question.userAnswer??
                            "";

                          const rawCorrectAnswer=
                            question.correctAnswer??
                            question.answerKey??
                            question.key??
                            question.correctOption??
                            question.answer??
                            "";

                          const studentAnswer=String(rawStudentAnswer||"").trim();
                          const correctAnswer=String(rawCorrectAnswer||"").trim();

                          const isEmpty=Boolean(
                            question.isEmpty||
                            question.blank||
                            !studentAnswer
                          );

                          const isCorrect=Boolean(
                            question.isCorrect??
                            question.correct??
                            (
                              studentAnswer&&
                              correctAnswer&&
                              studentAnswer.toLocaleUpperCase("tr-TR")===
                              correctAnswer.toLocaleUpperCase("tr-TR")
                            )
                          );

                          const questionNo=question.originalIndex!=null
                            ? Number(question.originalIndex)+1
                            : question.qNum??
                              question.questionNumber??
                              questionIndex+1;

                          const shownCorrect=correctAnswer
                            ? correctAnswer.toLocaleUpperCase("tr-TR")
                            : "-";
                          const shownStudent=isEmpty
                            ? "-"
                            : studentAnswer.toLocaleUpperCase("tr-TR");

                          return{
                            width:"*",
                            stack:[
                              {text:String(questionNo),fontSize:4.8,color:muted,alignment:"center"},
                              {
                                text:[
                                  {text:"D: ",color:navy,bold:true},
                                  {text:shownCorrect,color:navy,bold:true},
                                ],
                                fontSize:6.9,
                                alignment:"center",
                                margin:[0,2,0,0],
                              },
                              {
                                text:[
                                  {text:"Ö: ",color:isCorrect||isEmpty?"#111827":"#dc2626",bold:true},
                                  {text:shownStudent,color:isCorrect||isEmpty?"#111827":"#dc2626",bold:true},
                                ],
                                fontSize:6.9,
                                alignment:"center",
                                margin:[0,1,0,0],
                              },
                            ],
                            margin:[1,0,1,4],
                          };
                        }),
                        columnGap:2,
                        margin:[0,0,0,3],
                      })
                    ),
                  ],
                });

                return{
                  columns:[
                    buildSubjectAnswerBlock(leftSubject),
                    rightSubject
                      ? buildSubjectAnswerBlock(rightSubject)
                      : {width:"49%",text:""},
                  ],
                  columnGap:18,
                  margin:[0,0,0,10],
                };
              }
            ),
          ],
          margin:[12,0,12,12],
        },
        {
          columns:[
            {
              width:"*",
              text:"",
              fontSize:6.5,
              color:muted,
            },
            {
              width:150,
              text:"",
              fontSize:6.5,
              bold:true,
              color:navy,
              alignment:"right",
            },
          ],
        },
      );
    });

    const definition:any={
      pageSize:"A4",
      pageOrientation:"portrait",
      pageMargins:[24,22,24,22],
      background:(_page:number,size:any)=>({
        canvas:[
          {type:"rect",x:0,y:0,w:size.width,h:size.height,color:"#f7fbfd"},
          {type:"rect",x:0,y:0,w:size.width,h:14,color:navy},
          {type:"rect",x:0,y:size.height-10,w:size.width,h:10,color:gold},
          {type:"rect",x:14,y:14,w:size.width-28,h:size.height-28,lineColor:"#d7e7ef",lineWidth:1},
          {type:"rect",x:18,y:18,w:size.width-36,h:size.height-36,lineColor:"#eef5f8",lineWidth:.7},
          {type:"ellipse",x:size.width-45,y:55,r1:65,r2:65,color:"#edf7fb"},
          {type:"ellipse",x:35,y:size.height-55,r1:50,r2:50,color:"#fff8e8"},
        ],
      }),
      content,
      defaultStyle:{fontSize:7.5,color:slate},
      footer:(page:number,pages:number)=>({
        columns:[
          {text:`${examName} • Bireysel Sınav Karnesi`,fontSize:6,color:muted,margin:[24,0,0,0]},
          {text:`Sayfa ${page} / ${pages}`,fontSize:6,color:muted,alignment:"right",margin:[0,0,24,0]},
        ],
      }),
    };

    const studentName=reportStudents[0]?.studentName||"ogrenci";
    return await generatePdf(
      definition,
      {
        mode:"blob",
        filename:`${examName}-${studentName}-bireysel-sinav-karnesi.pdf`,
      },
    ) as Blob;
  };


const adminStudentReports=React.useMemo(()=>{
  if(!results.length)return[];
  return results.flatMap((student)=>{
    try{
      return[buildStudentReportV2Data(exam,results,student)];
    }catch(error){
      console.warn("Yönetici karar merkezi için öğrenci raporu oluşturulamadı.",{
        studentNumber:student?.studentNumber||student?.number,
        studentName:student?.studentName||student?.name,
        error,
      });
      return[];
    }
  });
},[exam,results]);

const adminDecisionData=React.useMemo(
  ()=>buildAdminDecisionDashboard(adminStudentReports),
  [adminStudentReports],
);

const teacherDecisionData=React.useMemo(
  ()=>buildTeacherCohortDecision(adminStudentReports),
  [adminStudentReports],
);

const timelineStudentReportGroups=React.useMemo(()=>{
  const exams=(availableExams||[]).slice(-8);
  const groups=new Map<string,ReturnType<typeof buildStudentReportV2Data>[]>();

  for(const historyExam of exams){
    try{
      const evaluated=storedResultsForExam(historyExam);
      if(!Array.isArray(evaluated)||!evaluated.length)continue;

      for(const student of evaluated){
        try{
          const report=buildStudentReportV2Data(historyExam,evaluated,student);
          const key=String(
            report.student.number||
            `${report.student.name}|${report.student.classroom||""}`
          );
          const current=groups.get(key)||[];
          current.push(report);
          groups.set(key,current);
        }catch(error){
          console.warn("Brain Timeline öğrenci raporu oluşturulamadı.",error);
        }
      }
    }catch(error){
      console.warn("Brain Timeline sınav geçmişi değerlendirilemedi.",error);
    }
  }

  if(!groups.size&&adminStudentReports.length){
    for(const report of adminStudentReports){
      const key=String(
        report.student.number||
        `${report.student.name}|${report.student.classroom||""}`
      );
      groups.set(key,[report]);
    }
  }

  return[...groups.values()];
},[availableExams,evaluateExam,exam?.id,results,adminStudentReports]);

const intelligencePanelsActive=activeReportView==="admin"||showBrainDashboard||showAcademicDnaDashboard||showBrainTimeline||showCopilotOptimizer||showSchoolDigitalTwin||showExecutiveCenter||showUniversityIntelligence||showEarlyWarningCenter||showIntelligenceKernel;

const brainTimelineData=React.useMemo(
  ()=>intelligencePanelsActive
    ?safeIntelligenceCompute(
      "Brain Timeline",
      ()=>buildBrainTimelineCohort(timelineStudentReportGroups),
      buildBrainTimelineCohort([]),
    )
    :buildBrainTimelineCohort([]),
  [timelineStudentReportGroups,intelligencePanelsActive],
);

// Intelligence çekirdeğinin tüm alt hesaplamaları brainData'ya bağlıdır.
// brainData tanımı bu hesaplamalardan önce olmalıdır; aksi halde rapor ekranı
// ilk render sırasında "Cannot access 'brainData' before initialization"
// hatasıyla çöker.
const brainData=React.useMemo(
  ()=>intelligencePanelsActive
    ?safeIntelligenceCompute(
    "Akademik Beyin",
    ()=>buildBrainCohort(
      adminStudentReports.map(report=>({
        report,
        profile:buildAcademicDigitalProfileFromReports([report]),
      })),
    ),
    buildBrainCohort([]),
  )
    :buildBrainCohort([]),
  [adminStudentReports,intelligencePanelsActive],
);

const academicDnaData=React.useMemo(
  ()=>showAcademicDnaDashboard
    ?safeIntelligenceCompute(
    "Akademik DNA",
    ()=>buildAcademicDnaCohort(
      adminStudentReports.map(report=>{
        const profile=buildAcademicDigitalProfileFromReports([report]);
        return{report,profile,brain:runBrainScoreEngine({report,profile})};
      }),
    ),
    buildAcademicDnaCohort([]),
  )
    :buildAcademicDnaCohort([]),
  [adminStudentReports,showAcademicDnaDashboard],
);

const kernelOptimizer=React.useMemo(
  ()=>safeIntelligenceCompute("Akıllı İyileştirme",()=>runCopilotOptimizer({
    cohort:brainData,
    config:{
      totalMinutes:360,
      minimumSessionMinutes:20,
      maximumSessionMinutes:60,
      sessionStepMinutes:10,
      resourceType:"teacher-support",
      includePriorityLevels:["critical","high","medium"],
      maximumStudents:24,
    },
  }),null as any),
  [brainData],
);

const kernelSchoolTwin=React.useMemo(
  ()=>safeIntelligenceCompute("Okul Dijital İkizi",()=>runSchoolDigitalTwin({
    cohort:brainData,
    optimizer:kernelOptimizer,
    scenario:{
      weeklyExtraLessonMinutes:120,
      mockExamPerMonth:4,
      guidanceSessionsPerMonth:1,
      parentMeetingsPerMonth:1,
      attendanceReductionDays:1,
    },
  }),null as any),
  [brainData,kernelOptimizer],
);

const kernelWarningResult=React.useMemo(
  ()=>safeIntelligenceCompute("Erken Uyarı",()=>buildEarlyWarningCenter({
    cohort:brainData,
    timeline:brainTimelineData,
  }),EMPTY_WARNING),
  [brainData,brainTimelineData],
);
const kernelWarning=kernelWarningResult&&typeof kernelWarningResult==="object"
  ?{...EMPTY_WARNING,...kernelWarningResult,summary:{...EMPTY_WARNING.summary,...(kernelWarningResult.summary||{})},topWarnings:Array.isArray(kernelWarningResult.topWarnings)?kernelWarningResult.topWarnings:[]}
  :EMPTY_WARNING;

const kernelUniversity=React.useMemo(
  ()=>safeIntelligenceCompute("Üniversite Simülasyonu",()=>runUniversitySimulation({
    cohort:brainData,
    scenario:{
      mathematicsNetGain:2,
      turkishNetGain:1,
      scienceNetGain:1,
      socialNetGain:0,
      aytMathematicsNetGain:2,
      aytScienceNetGain:1,
      aytLiteratureNetGain:1,
      aytSocialNetGain:0,
      weeklyStudyMinutes:240,
      attendanceReductionDays:1,
    },
  }),null as any),
  [brainData],
);

const kernelExecutiveResult=React.useMemo(
  ()=>safeIntelligenceCompute("Yönetici Karar Merkezi",()=>buildExecutiveCenter({
    cohort:brainData,
    schoolTwin:kernelSchoolTwin,
  }),EMPTY_EXECUTIVE),
  [brainData,kernelSchoolTwin],
);
const kernelExecutive=kernelExecutiveResult&&typeof kernelExecutiveResult==="object"
  ?{...EMPTY_EXECUTIVE,...kernelExecutiveResult,summary:{...EMPTY_EXECUTIVE.summary,...(kernelExecutiveResult.summary||{})},alerts:Array.isArray(kernelExecutiveResult.alerts)?kernelExecutiveResult.alerts:[],tasks:Array.isArray(kernelExecutiveResult.tasks)?kernelExecutiveResult.tasks:[],classroomMap:Array.isArray(kernelExecutiveResult.classroomMap)?kernelExecutiveResult.classroomMap:[]}
  :EMPTY_EXECUTIVE;

const intelligenceKernelData=React.useMemo(
  ()=>safeIntelligenceCompute("Akıllı Analiz Merkezi",()=>runIntelligenceKernel({
    brain:brainData,
    timeline:brainTimelineData,
    warning:kernelWarning,
    schoolTwin:kernelSchoolTwin,
    university:kernelUniversity,
    executive:kernelExecutive,
    cacheKey:String(exam?.id||exam?.name||"exam"),
  }),null as any),
  [
    brainData,
    brainTimelineData,
    kernelWarning,
    kernelSchoolTwin,
    kernelUniversity,
    kernelExecutive,
    exam?.id,
    exam?.name,
  ],
);

  const columns:{title:string;subtitle:string;icon:any;tone:string;cardTone:string;buttonTone:string;items:ReportItem[]}[]=[
    {title:"Yönetici Raporları",subtitle:"Kurum ve şube düzeyinde yönetim özeti",icon:Building2,tone:"bg-orange-800",cardTone:"border-orange-200 bg-orange-50/60",buttonTone:"border-orange-700 bg-orange-700 hover:bg-orange-800",items:[
      {title:"Sıralı Listeler",description:"Tüm öğrencilerin toplam nete göre yatay A4 kurum genel sıralaması.",action:rankedListsReport,pdfReady:true,audiences:["admin"]},
      {title:"Karşılaştırmalı Kurum Sınav Raporu",description:"Tüm öğrenciler, şubeler ve genel sınav sonuçları.",action:institutionGeneralResultsReport,pdfReady:true,audiences:["admin"]},
      {title:"Şube Karşılaştırma Raporu",description:"Şubelerin ders bazlı net, başarı, sıralama ve katılım sonuçlarını karşılaştırır.",action:classroomComparisonReport,pdfReady:true,audiences:["admin"]},
      {title:"Kritik Alanlar / Risk ve İzleme Raporu",description:"Düşük başarı ve yüksek boş oranı görülen sonuçlar.",action:()=>adminReport("Risk-ve-İzleme"),pdfReady:true,audiences:["admin"],primaryViewAction:()=>{closeActiveReport();setShowAdminDecisionCenter(true)}},
      {title:"e-Nstitü AI Danışman",description:"Mevcut sınav, risk ve karar verileri hakkında doğal dille yanıt alın.",pdfReady:true,audiences:["admin"],primaryViewAction:()=>{closeActiveReport();setShowHasatAdvisor(true)}},
    ]},
    {title:"Öğretmen Raporları",subtitle:"Ders, konu ve kazanım odaklı sonuçlar",icon:GraduationCap,tone:"bg-amber-600",cardTone:"border-amber-200 bg-amber-50/70",buttonTone:"border-amber-600 bg-amber-600 hover:bg-amber-700",items:[
      {title:"Genel Sıralı Listeler",description:"İdareci görünümündeki kurum genel sıralı listeler tablosunu öğretmen ekranında açar.",action:rankedListsReport,pdfReady:true,audiences:["teacher"]},
      {title:"Şube Sıralı Listesi",description:"Sıralı listelerin şubelere göre süzülmüş öğretmen görünümü.",action:classroomRankedListsReport,pdfReady:true},
      {title:"Ders Başarı Raporu",description:"Ders bazında öğrenci doğru, yanlış, boş ve netleri.",action:()=>teacherReport("Ders-Başarı"),pdfReady:true},
      {title:"Madde Analizi",description:"Her sorunun doğru, yanlış, boş, cevap dağılımı ve kalite durumunu gösterir.",action:itemQualityReport,pdfReady:true},
      {title:"Konu ve Kazanım Raporu",description:"Konu analizindeki ders, ünite, kazanım, bağlı sorular ve başarı sonuçları.",action:topicAnalysisReport,pdfReady:true},
    ]},
    {title:"Öğrenci Raporları",subtitle:"Öğrencinin kendi başarısını ve gelişimini izleyeceği raporlar",icon:Users,tone:"bg-emerald-700",cardTone:"border-emerald-200 bg-emerald-50/60",buttonTone:"border-emerald-700 bg-emerald-700 hover:bg-emerald-800",items:[
      {title:"Bireysel Sınav Karnesi",description:"Genel sonuç, ders bazlı başarı, puan, net ve sıralama bilgilerini gösterir.",action:individualScorecardReport,pdfReady:true,audiences:["student"],openPremiumView:()=>setShowStudentReportV2(true),premiumViewLabel:"Yeni Karne V2'yi Aç",premiumViewIcon:FileText},
      {title:"Gelişim ve Eksik Konu Raporu",description:"Güçlü alanları, eksik konuları ve öncelikli çalışma başlıklarını gösterir.",action:()=>familyReport("Gelişim-Eksik-Konu"),pdfReady:true,audiences:["student"]},
      {title:"Üniversite Başarı Simülasyonu",description:"Mevcut sınav sonuçlarından üniversite hedefi, başarı olasılığı ve gelişim senaryolarını inceleyin.",action:()=>familyReport("Üniversite-Başarı-Simülasyonu"),pdfReady:true,audiences:["student"],openPremiumView:()=>setShowUniversityIntelligence(true),premiumViewLabel:"Üniversite Başarı Simülasyonunu Aç",premiumViewIcon:GraduationCap},
      {title:"e-Nstitü AI Danışman",description:"Kişisel sınav verisi, öncelikler ve riskler hakkında soru sorun.",pdfReady:true,audiences:["student"],primaryViewAction:()=>setShowHasatAdvisor(true)},
    ]},
    {title:"Veli Raporları",subtitle:"Velinin çocuğunun durumunu sade ve anlaşılır biçimde izleyeceği bilgiler",icon:MessageCircle,tone:"bg-sky-700",cardTone:"border-sky-200 bg-sky-50/60",buttonTone:"border-sky-700 bg-sky-700 hover:bg-sky-800",items:[
      {title:"Veli Sınav Sonuç Özeti",description:"Çocuğun genel sonucu, ders başarıları, netleri ve sıralamasını veli dilinde sunar.",action:individualScorecardReport,pdfReady:true,audiences:["parent"]},
      {title:"Gelişim ve Destek Alanları",description:"Güçlü yönleri, geliştirilmesi gereken konuları ve destek önceliklerini gösterir.",action:()=>familyReport("Gelişim-Eksik-Konu"),pdfReady:true,audiences:["parent"]},
      {title:"Veli Bilgilendirme Özeti",description:"Başarı durumu, dikkat edilmesi gereken alanlar ve çalışma önerilerini sade biçimde sunar.",action:()=>familyReport("Veli-Bilgilendirme"),pdfReady:true,audiences:["parent"]},
    ]},
    {title:"Rehberlik Raporları",subtitle:"Öğrenci risklerini, gelişim eğilimlerini ve müdahale önceliklerini izleyin",icon:AlertTriangle,tone:"bg-rose-700",cardTone:"border-rose-200 bg-rose-50/60",buttonTone:"border-rose-700 bg-rose-700 hover:bg-rose-800",items:[
      {title:"Erken Risk İzleme Raporu",description:"Başarı düşüşü, yüksek boş oranı ve dikkat gerektiren öğrenci sonuçlarını önceliklendirir.",action:()=>adminReport("Erken-Risk-Izleme"),pdfReady:true,audiences:["admin"]},
      {title:"Öğrenci Gelişim Takip Raporu",description:"Öğrencinin güçlü yönlerini, eksik konularını ve gelişim ihtiyacını görüşme öncesinde özetler.",action:()=>familyReport("Rehberlik-Gelisim-Takibi"),pdfReady:true,audiences:["teacher"]},
      {title:"Müdahale Öncelikleri Raporu",description:"Öncelikli destek verilmesi gereken öğrenci ve akademik alanları rehberlik çalışmaları için sıralar.",action:()=>adminReport("Rehberlik-Mudahale-Oncelikleri"),pdfReady:true,audiences:["admin"]},
      {title:"Öğrenci Görüşme Hazırlık Özeti",description:"Bireysel görüşme öncesinde sınav sonucu, gelişim alanları ve çalışma önerilerini bir araya getirir.",action:()=>familyReport("Rehberlik-Gorusme-Hazirlik"),pdfReady:true,audiences:["teacher"]},
    ]},
  ];

  const activeColumn=columns[reportCategory==="admin"?0:reportCategory==="teacher"?1:2];
  const allCategoryColumn=activeReportView==="admin"?columns[0]:activeReportView==="teacher"?columns[1]:activeReportView==="student"?columns[2]:activeReportView==="parent"?columns[3]:activeReportView==="guidance"?columns[4]:null;
  const visibleColumns=showAllCategories?(allCategoryColumn?[allCategoryColumn]:[]):[activeColumn];
  const reportViews=[
    {id:"admin" as const,label:"Yönetici",section:"Yönetici Raporları",icon:Building2,tone:"border-orange-700 bg-orange-700 text-white"},
    {id:"teacher" as const,label:"Öğretmen",section:"Öğretmen Raporları",icon:GraduationCap,tone:"border-amber-600 bg-amber-600 text-white"},
    {id:"student" as const,label:"Öğrenciler",section:"Öğrenci Raporları",icon:Users,tone:"border-emerald-700 bg-emerald-700 text-white"},
    {id:"parent" as const,label:"Veliler",section:"Veli Raporları",icon:MessageCircle,tone:"border-sky-700 bg-sky-700 text-white"},
    {id:"guidance" as const,label:"Rehberlik",section:"Rehberlik Raporları",icon:AlertTriangle,tone:"border-rose-700 bg-rose-700 text-white"},
    {id:"mentor" as const,label:"Mentörler",section:"Mentörler İçin Öğrenci Gelişim Raporları",icon:TrendingUp,tone:"border-indigo-700 bg-indigo-700 text-white"},
    {id:"champions" as const,label:"Şampiyonlar Ligi",section:"Şampiyonlar Ligi",icon:Trophy,tone:"border-amber-700 bg-amber-700 text-white"},
    {id:"points" as const,label:"Kazanılabilir Puanlar",section:"Kazanılabilir Puanlar",icon:Coins,tone:"border-rose-700 bg-rose-700 text-white"},
  ];
  const selectReportView=(view:(typeof reportViews)[number])=>{
    // Rapor türü değişirken önceki türün PDF'si ya da özel görünümü ekranda kalmasın.
    closeActiveReport();
    setFocusedReport(null);
    setActiveReportView(view.id);
    setOpenReportSections(Object.fromEntries(reportViews.map(item=>[item.section,item.id===view.id])));
  };

  const adminAverageNet=results.length
    ?Number((results.reduce((sum,student)=>sum+Number(student?.totals?.net||0),0)/results.length).toFixed(2))
    :0;
  const adminClassroomCount=new Set(results.map(student=>String(student?.classroom||"Sınıfsız"))).size;
  const adminWeakestSubject=React.useMemo(()=>{
    const subjects=Array.from(new Set(results.flatMap(student=>(student?.subjects||[]).map((subject:any)=>String(subject?.subjectName||"").trim())).filter(Boolean)));
    return subjects
      .map(subjectName=>{
        const values=results.map(student=>subjectResult(student,subjectName)).filter(Boolean);
        const averageNet=values.length?values.reduce((sum,item)=>sum+Number(item?.net||0),0)/values.length:0;
        return{subjectName,averageNet:Number(averageNet.toFixed(2))};
      })
      .sort((a,b)=>a.averageNet-b.averageNet)[0]||null;
  },[results]);
  const adminWeakestClassroom=React.useMemo(()=>{
    const classrooms=Array.from(new Set(results.map(student=>String(student?.classroom||"Sınıfsız"))));
    return classrooms
      .map(classroom=>{
        const students=results.filter(student=>String(student?.classroom||"Sınıfsız")===classroom);
        const averageNet=students.length?students.reduce((sum,student)=>sum+Number(student?.totals?.net||0),0)/students.length:0;
        return{classroom,averageNet:Number(averageNet.toFixed(2)),studentCount:students.length};
      })
      .sort((a,b)=>a.averageNet-b.averageNet)[0]||null;
  },[results]);
  const adminPriorityAlert=kernelExecutive.alerts[0];
  const adminTodayPriority=React.useMemo(()=>{
    const topWarning=kernelWarning.topWarnings?.[0];
    if(topWarning&&Number(topWarning.warningScore||0)>=70){
      return{
        title:`${topWarning.studentName} için öncelikli akademik inceleme`,
        detail:`${topWarning.classroom||"Sınıf bilgisi yok"} · Risk puanı ${topWarning.warningScore}. ${topWarning.reasons?.[0]||"Yakın takip öneriliyor."}`,
        target:"interventions" as const,
        actionLabel:"Öğrenciyi incele",
      };
    }
    if(adminPriorityAlert){
      return{
        title:adminPriorityAlert.title,
        detail:adminPriorityAlert.detail,
        target:"interventions" as const,
        actionLabel:"Önceliği incele",
      };
    }
    if(adminWeakestClassroom&&adminWeakestSubject){
      return{
        title:`${adminWeakestClassroom.classroom} ve ${adminWeakestSubject.subjectName} yakından izlenmeli`,
        detail:`En düşük şube ortalaması ${adminWeakestClassroom.classroom} için ${adminWeakestClassroom.averageNet} net; en düşük ders ortalaması ${adminWeakestSubject.subjectName} için ${adminWeakestSubject.averageNet} net olarak hesaplandı.`,
        target:"overview" as const,
        actionLabel:"Akademik özeti incele",
      };
    }
    return{
      title:kernelExecutive.summary.headline,
      detail:kernelExecutive.summary.detail,
      target:"overview" as const,
      actionLabel:"Okul özetini aç",
    };
  },[kernelWarning.topWarnings,adminPriorityAlert,adminWeakestClassroom,adminWeakestSubject,kernelExecutive.summary]);
  const adminStatusLabel=kernelExecutive.summary.status==="critical"?"Acil":kernelExecutive.summary.status==="attention"?"Dikkat":"Normal";
  const adminStatusTone=kernelExecutive.summary.status==="critical"
    ?"border-rose-200 bg-rose-50 text-rose-700"
    :kernelExecutive.summary.status==="attention"
      ?"border-amber-200 bg-amber-50 text-amber-700"
      :"border-emerald-200 bg-emerald-50 text-emerald-700";

  const adminInterventionClassrooms=React.useMemo<string[]>(
    ()=>Array.from(new Set<string>((kernelWarning.topWarnings||[]).map(item=>String(item.classroom||"Sınıf yok"))))
      .sort(compareClassroomNames),
    [kernelWarning.topWarnings],
  );
  const adminInterventionRows=React.useMemo(()=>{
    const levelOrder={critical:4,high:3,medium:2,low:1} as const;
    const query=adminInterventionSearch.trim().toLocaleLowerCase("tr-TR");
    return (kernelWarning.topWarnings||[])
      .map(item=>({
        ...item,
        id:String(item.studentId||`${item.studentName}-${item.classroom||""}`),
        classroomLabel:String(item.classroom||"Sınıf yok"),
        levelLabel:item.predictedWarningLevel==="critical"?"Acil":item.predictedWarningLevel==="high"?"Yüksek":item.predictedWarningLevel==="medium"?"Orta":"Düşük",
        trendLabel:item.trend==="worsening"?"Kötüleşiyor":item.trend==="improving"?"İyileşiyor":item.trend==="stable"?"Durağan":"Yetersiz veri",
      }))
      .filter(item=>adminInterventionLevel==="all"||item.predictedWarningLevel===adminInterventionLevel)
      .filter(item=>adminInterventionClassroom==="all"||item.classroomLabel===adminInterventionClassroom)
      .filter(item=>!query||`${item.studentName} ${item.studentNumber||""} ${item.classroomLabel} ${(item.reasons||[]).join(" ")}`.toLocaleLowerCase("tr-TR").includes(query))
      .sort((a,b)=>
        (levelOrder[b.predictedWarningLevel as keyof typeof levelOrder]||0)-(levelOrder[a.predictedWarningLevel as keyof typeof levelOrder]||0)||
        Number(b.warningScore||0)-Number(a.warningScore||0)
      );
  },[kernelWarning.topWarnings,adminInterventionLevel,adminInterventionClassroom,adminInterventionSearch]);
  const adminInterventionSummary=React.useMemo(()=>({
    critical:(kernelWarning.topWarnings||[]).filter(item=>item.predictedWarningLevel==="critical").length,
    high:(kernelWarning.topWarnings||[]).filter(item=>item.predictedWarningLevel==="high").length,
    worsening:(kernelWarning.topWarnings||[]).filter(item=>item.trend==="worsening").length,
    projectedCritical:Number(kernelWarning.projectedCritical||0),
  }),[kernelWarning.topWarnings,kernelWarning.projectedCritical]);

  const adminRankingClassrooms=React.useMemo(
    ()=>Array.from(new Set(results.map(student=>String(student?.classroom||"Sınıfsız"))))
      .sort(compareClassroomNames),
    [results],
  );
  const adminRankingSubjects=React.useMemo(
    ()=>Array.from(new Set(results.flatMap(student=>(student?.subjects||[]).map((subject:any)=>String(subject?.subjectName||"").trim())).filter(Boolean)))
      .sort((a,b)=>a.localeCompare(b,"tr-TR",{numeric:true,sensitivity:"base"})),
    [results],
  );
  const adminDetailedRankingRows=React.useMemo(()=>{
    const identity=(student:any)=>String(student?.recordId||student?.id||student?.studentNumber||student?.studentName||"");
    const totalQuestionCount=(student:any)=>(student?.subjects||[]).reduce((sum:number,subject:any)=>sum+Number(subject?.totalQuestions||0),0);
    const scoreOf=(student:any)=>{
      const questions=totalQuestionCount(student);
      const score=Number(student?.score??(questions?Math.max(0,Number(student?.totals?.net||0)/questions*500):0));
      return Number.isFinite(score)?score:0;
    };
    const createCompetitionRankMap=(students:any[],valueOf:(student:any)=>number)=>{
      const sorted=[...students].sort((a,b)=>valueOf(b)-valueOf(a)||String(a?.studentName||a?.name||"").localeCompare(String(b?.studentName||b?.name||""),"tr-TR",{sensitivity:"base"}));
      const rankMap=new Map<string,number>();
      let previousValue:number|undefined;
      let currentRank=0;
      sorted.forEach((student,index)=>{
        const value=Number(valueOf(student)||0);
        if(previousValue===undefined||Math.abs(value-Number(previousValue))>0.000001)currentRank=index+1;
        rankMap.set(identity(student),currentRank);
        previousValue=value;
      });
      return{sorted,rankMap};
    };
    const institutionRanking=createCompetitionRankMap(results,scoreOf);
    const institutionSorted=institutionRanking.sorted;
    const institutionRankMap=institutionRanking.rankMap;
    const classroomRankMap=new Map<string,number>();
    adminRankingClassrooms.forEach(classroom=>{
      const classroomStudents=results.filter(student=>String(student?.classroom||"Sınıfsız")===classroom);
      const ranking=createCompetitionRankMap(classroomStudents,scoreOf);
      ranking.rankMap.forEach((rank,id)=>classroomRankMap.set(id,rank));
    });
    const subjectInstitutionRanks=new Map<string,Map<string,number>>();
    const subjectClassroomRanks=new Map<string,Map<string,number>>();
    adminRankingSubjects.forEach(subjectName=>{
      const institutionMap=createCompetitionRankMap(results,student=>Number(subjectResult(student,subjectName)?.net||0)).rankMap;
      subjectInstitutionRanks.set(subjectName,institutionMap);
      const classroomMap=new Map<string,number>();
      adminRankingClassrooms.forEach(classroom=>{
        const classroomStudents=results.filter(student=>String(student?.classroom||"Sınıfsız")===classroom);
        const ranking=createCompetitionRankMap(classroomStudents,student=>Number(subjectResult(student,subjectName)?.net||0));
        ranking.rankMap.forEach((rank,id)=>classroomMap.set(id,rank));
      });
      subjectClassroomRanks.set(subjectName,classroomMap);
    });
    let candidates=[...institutionSorted];
    if(adminRankingMode==="classroom"&&adminRankingClassroom!=="all")candidates=candidates.filter(student=>String(student?.classroom||"Sınıfsız")===adminRankingClassroom);
    if(adminRankingMode==="subject"&&adminRankingSubject!=="all")candidates.sort((a,b)=>Number(subjectResult(b,adminRankingSubject)?.net||0)-Number(subjectResult(a,adminRankingSubject)?.net||0));
    if(adminRankingSort==="net")candidates.sort((a,b)=>Number(b?.totals?.net||0)-Number(a?.totals?.net||0));
    if(adminRankingSort==="score")candidates.sort((a,b)=>Number(b?.score||0)-Number(a?.score||0));
    if(adminRankingSort==="wrong")candidates.sort((a,b)=>Number(a?.totals?.wrong||0)-Number(b?.totals?.wrong||0));
    if(adminRankingSort==="name")candidates.sort((a,b)=>String(a?.studentName||a?.name||"").localeCompare(String(b?.studentName||b?.name||""),"tr-TR",{sensitivity:"base"}));
    return candidates.map((student,index)=>{
      const id=identity(student);
      const totalQuestions=(student?.subjects||[]).reduce((sum:number,subject:any)=>sum+Number(subject?.totalQuestions||0),0);
      const score=Number(student?.score??(totalQuestions?Math.max(0,Number(student?.totals?.net||0)/totalQuestions*500):0));
      const classroomRank=classroomRankMap.get(id)||0;
      const institutionRank=institutionRankMap.get(id)||0;
      const selectedSubjectRank=adminRankingSubject!=="all"
        ?subjectInstitutionRanks.get(adminRankingSubject)?.get(id)||0
        :institutionRank;
      const displayRank=adminRankingMode==="classroom"
        ?classroomRank
        :adminRankingMode==="subject"
          ?selectedSubjectRank
          :institutionRank;
      const totalCorrect=Number(student?.totals?.correct||0);
      const totalWrong=Number(student?.totals?.wrong||0);
      const totalEmpty=Number(student?.totals?.empty||0);
      const totalNet=Number(student?.totals?.net||0);
      const successRate=totalQuestions?Math.max(0,Math.min(100,totalNet/totalQuestions*100)):0;
      const wrongRate=totalQuestions?Math.max(0,Math.min(100,totalWrong/totalQuestions*100)):0;
      const emptyRate=totalQuestions?Math.max(0,Math.min(100,totalEmpty/totalQuestions*100)):0;
      const rankRisk=results.length?Math.max(0,Math.min(100,institutionRank/results.length*100)):0;
      const riskScore=Math.round(Math.max(0,Math.min(100,(100-successRate)*.45+rankRisk*.25+wrongRate*.2+emptyRate*.1)));
      const academicStatus=riskScore>=65
        ?{key:"priority",label:"Öncelikli Müdahale",shortLabel:"Öncelikli",tone:"rose"}
        :riskScore>=45
          ?{key:"watch",label:"Takip Edilmeli",shortLabel:"Takip",tone:"amber"}
          :riskScore>=25
            ?{key:"stable",label:"İstikrarlı",shortLabel:"İstikrarlı",tone:"blue"}
            :{key:"strong",label:"Beklenenin Üzerinde",shortLabel:"Güçlü",tone:"emerald"};
      return{id,rawStudent:student,displayRank:displayRank||index+1,studentName:String(student?.studentName||student?.name||"Öğrenci"),studentNumber:String(student?.studentNumber||student?.schoolNumber||student?.studentNo||"-"),classroom:String(student?.classroom||"Sınıfsız"),subjects:adminRankingSubjects.map(subjectName=>{const subject=subjectResult(student,subjectName);return{name:subjectName,correct:Number(subject?.correct||0),wrong:Number(subject?.wrong||0),empty:Number(subject?.empty||0),net:Number(subject?.net||0),totalQuestions:Number(subject?.totalQuestions||0),institutionRank:subjectInstitutionRanks.get(subjectName)?.get(id)||0,classroomRank:subjectClassroomRanks.get(subjectName)?.get(id)||0};}),totalQuestions,totalCorrect,totalWrong,totalEmpty,totalNet,score:Number.isFinite(score)?score:0,classroomRank,institutionRank,generalRank:rankOnly(student?.generalRank??student?.overallRank,institutionRank||index+1),successRate:Number(successRate.toFixed(1)),riskScore,academicStatus};
    });
  },[results,adminRankingMode,adminRankingClassroom,adminRankingSubject,adminRankingSort,adminRankingClassrooms,adminRankingSubjects]);
  const adminRankingHighestNet=adminDetailedRankingRows.length?Math.max(...adminDetailedRankingRows.map(student=>student.totalNet)):0;
  const adminRankingAverageNet=adminDetailedRankingRows.length?adminDetailedRankingRows.reduce((sum,student)=>sum+student.totalNet,0)/adminDetailedRankingRows.length:0;
  const adminRankingFilteredRows=React.useMemo(()=>{
    const query=adminRankingSearch.trim().toLocaleLowerCase("tr-TR");
    let filtered=query
      ?adminDetailedRankingRows.filter(student=>`${student.studentName} ${student.studentNumber} ${student.classroom}`.toLocaleLowerCase("tr-TR").includes(query))
      :adminDetailedRankingRows;
    if(adminRankingOnlyBelowAverage)filtered=filtered.filter(student=>student.totalNet<adminRankingAverageNet);
    return adminRankingLimit===0?filtered:filtered.slice(0,adminRankingLimit);
  },[adminDetailedRankingRows,adminRankingSearch,adminRankingLimit,adminRankingOnlyBelowAverage,adminRankingAverageNet]);
  const adminRankingRows=adminRankingFilteredRows;
  const adminRankingSelectedIndex=adminRankingSelected?adminRankingFilteredRows.findIndex(student=>student.id===adminRankingSelected.id):-1;
  const adminRankingSelectedInsight=React.useMemo(()=>{
    if(!adminRankingSelected)return null;
    const ordered=[...adminRankingSelected.subjects].sort((a:any,b:any)=>b.net-a.net);
    const strongest=ordered[0];
    const support=ordered[ordered.length-1];
    const percentile=adminDetailedRankingRows.length?Math.max(1,Math.round((1-adminRankingSelected.institutionRank/adminDetailedRankingRows.length)*100)):0;
    const status=adminRankingSelected.totalNet>=adminRankingAverageNet?"Kurum ortalamasının üzerinde":"Kurum ortalamasının altında";
    const recommendations:string[]=[];
    if(adminRankingSelected.academicStatus?.key==="priority")recommendations.push("Öğrenci için kısa süreli akademik müdahale planı oluşturun.");
    if(adminRankingSelected.academicStatus?.key==="watch")recommendations.push("Öğrenciyi sonraki iki sınav boyunca yakın izlemeye alın.");
    if(Number(adminRankingSelected.totalEmpty||0)>Number(adminRankingSelected.totalWrong||0))recommendations.push("Boş bırakılan sorular için zaman yönetimi ve soru seçimi çalışması planlayın.");
    if(support&&support.totalQuestions&&support.net/support.totalQuestions<.4)recommendations.push(`${support.name} dersi için hedefli konu tekrarı ve kısa etüt önerilir.`);
    if(!recommendations.length)recommendations.push("Mevcut çalışma düzeninin sürdürülmesi ve gelişimin ödüllendirilmesi önerilir.");
    return{strongest,support,percentile,status,recommendations};
  },[adminRankingSelected,adminDetailedRankingRows.length,adminRankingAverageNet]);
  const adminRankingSelectedBenchmarks=React.useMemo(()=>{
    if(!adminRankingSelected)return[];
    return (Array.isArray(adminRankingSelected.subjects)?adminRankingSelected.subjects:[]).map((subject:any)=>{
      const institutionValues=adminDetailedRankingRows
        .map((student:any)=>student.subjects.find((item:any)=>item.name===subject.name)?.net)
        .filter((value:any)=>Number.isFinite(value)) as number[];
      const classroomValues=adminDetailedRankingRows
        .filter((student:any)=>student.classroom===adminRankingSelected.classroom)
        .map((student:any)=>student.subjects.find((item:any)=>item.name===subject.name)?.net)
        .filter((value:any)=>Number.isFinite(value)) as number[];
      const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
      const institutionAverage=average(institutionValues);
      const classroomAverage=average(classroomValues);
      return{
        name:subject.name,
        net:Number(subject.net||0),
        institutionAverage:Number(institutionAverage.toFixed(2)),
        classroomAverage:Number(classroomAverage.toFixed(2)),
        institutionDelta:Number((Number(subject.net||0)-institutionAverage).toFixed(2)),
        classroomDelta:Number((Number(subject.net||0)-classroomAverage).toFixed(2)),
      };
    }).sort((a:any,b:any)=>b.institutionDelta-a.institutionDelta);
  },[adminRankingSelected,adminDetailedRankingRows]);
  const adminRankingSelectedActionPlan=React.useMemo(()=>{
    if(!adminRankingSelected)return[];
    const benchmarkMap=new Map(adminRankingSelectedBenchmarks.map((item:any)=>[item.name,item]));
    return [...adminRankingSelected.subjects]
      .map((subject:any)=>{
        const benchmark:any=benchmarkMap.get(subject.name);
        const questionCount=Math.max(1,Number(subject.totalQuestions||0));
        const success=Math.max(0,Math.min(100,Number(subject.net||0)/questionCount*100));
        const institutionDelta=Number(benchmark?.institutionDelta||0);
        const classroomDelta=Number(benchmark?.classroomDelta||0);
        const priorityScore=(100-success)*.55+Math.max(0,-institutionDelta)*5+Math.max(0,-classroomDelta)*3;
        const priority=priorityScore>=55?"high":priorityScore>=32?"medium":"maintain";
        const focus=Number(subject.empty||0)>Number(subject.wrong||0)
          ?"Zaman yönetimi ve boş bırakılan sorular"
          :Number(subject.wrong||0)>0
            ?"Yanlış yapılan soruların kazanım analizi"
            :"Başarıyı koruma ve ileri düzey soru çözümü";
        const weeklyAction=priority==="high"
          ?"Haftada 2 kısa etüt + yanlış soru defteri"
          :priority==="medium"
            ?"Haftada 1 konu tekrarı + 20 hedef soru"
            :"Haftada 1 karma tekrar + seçici zor sorular";
        return{
          name:subject.name,
          net:Number(subject.net||0),
          success:Number(success.toFixed(1)),
          institutionDelta,
          classroomDelta,
          priority,
          priorityScore:Number(priorityScore.toFixed(1)),
          focus,
          weeklyAction,
        };
      })
      .sort((a:any,b:any)=>b.priorityScore-a.priorityScore)
      .slice(0,3);
  },[adminRankingSelected,adminRankingSelectedBenchmarks]);
  const adminRankingPlanStorageKey=React.useMemo(()=>{
    if(!adminRankingSelected)return"";
    const examIdentity=String(exam?.id||exam?.examId||examName||"exam");
    return `hasat-ranking-plan:${examIdentity}:${adminRankingSelected.id}`;
  },[adminRankingSelected,exam?.id,exam?.examId,examName]);
  React.useEffect(()=>{
    if(!adminRankingPlanStorageKey){
      setAdminRankingPlanChecks({});
      return;
    }
    try{
      const saved=sqliteStorage.getItem(adminRankingPlanStorageKey);
      const parsed=saved?JSON.parse(saved):{};
      setAdminRankingPlanChecks(parsed&&typeof parsed==="object"?parsed:{});
    }catch(error){
      console.error("Çalışma planı ilerlemesi okunamadı:",error);
      setAdminRankingPlanChecks({});
    }
  },[adminRankingPlanStorageKey]);
  const toggleAdminRankingPlanCheck=React.useCallback((subjectName:string)=>{
    if(!adminRankingPlanStorageKey)return;
    setAdminRankingPlanChecks(current=>{
      const next={...current,[subjectName]:!current[subjectName]};
      try{sqliteStorage.setItem(adminRankingPlanStorageKey,JSON.stringify(next));}
      catch(error){console.error("Çalışma planı ilerlemesi kaydedilemedi:",error);}
      return next;
    });
  },[adminRankingPlanStorageKey]);
  const resetAdminRankingPlanChecks=React.useCallback(()=>{
    setAdminRankingPlanChecks({});
    if(!adminRankingPlanStorageKey)return;
    try{sqliteStorage.removeItem(adminRankingPlanStorageKey);}
    catch(error){console.error("Çalışma planı ilerlemesi temizlenemedi:",error);}
  },[adminRankingPlanStorageKey]);
  const adminRankingPlanCompleted=adminRankingSelectedActionPlan.filter((item:any)=>adminRankingPlanChecks[item.name]).length;
  const adminRankingPlanProgress=adminRankingSelectedActionPlan.length
    ?Math.round(adminRankingPlanCompleted/adminRankingSelectedActionPlan.length*100)
    :0;
  const adminRankingSelectedHistory=React.useMemo(()=>{
    if(!adminRankingSelected||!evaluateExam)return[];
    const selectedIdentity=String(
      adminRankingSelected.rawStudent?.recordId||
      adminRankingSelected.rawStudent?.id||
      adminRankingSelected.studentNumber||
      adminRankingSelected.studentName||
      ""
    ).trim();
    const selectedNumber=String(adminRankingSelected.studentNumber||"").trim();
    const history=(availableExams||[]).map((historyExam:any)=>{
      try{
        const evaluatedResult=storedResultsForExam(historyExam);
        const evaluated=Array.isArray(evaluatedResult)?evaluatedResult:[];
        const student=evaluated.find((candidate:any)=>{
          const candidateIdentity=String(
            candidate?.recordId||candidate?.id||candidate?.studentNumber||candidate?.studentName||""
          ).trim();
          const candidateNumber=String(candidate?.studentNumber||candidate?.schoolNumber||candidate?.studentNo||"").trim();
          return Boolean(
            (selectedIdentity&&candidateIdentity===selectedIdentity)||
            (selectedNumber&&candidateNumber===selectedNumber)
          );
        });
        if(!student)return null;
        const totalQuestions=(student?.subjects||[]).reduce(
          (sum:number,subject:any)=>sum+Number(subject?.totalQuestions||0),
          0,
        );
        const score=Number(student?.score??(totalQuestions?Math.max(0,Number(student?.totals?.net||(student as any)?.net||0)/totalQuestions*500):0));
        const ranked=[...evaluated].sort((a:any,b:any)=>{
          const scoreOf=(item:any)=>{
            const questions=(item?.subjects||[]).reduce((sum:number,subject:any)=>sum+Number(subject?.totalQuestions||0),0);
            return Number(item?.score??(questions?Math.max(0,Number(item?.totals?.net||item?.net||0)/questions*500):0))||0;
          };
          return scoreOf(b)-scoreOf(a);
        });
        const institutionRank=ranked.findIndex((candidate:any)=>{
          const candidateIdentity=String(candidate?.recordId||candidate?.id||candidate?.studentNumber||candidate?.studentName||"").trim();
          const candidateNumber=String(candidate?.studentNumber||candidate?.schoolNumber||candidate?.studentNo||"").trim();
          return Boolean(
            (selectedIdentity&&candidateIdentity===selectedIdentity)||
            (selectedNumber&&candidateNumber===selectedNumber)
          );
        })+1;
        return{
          id:String(historyExam?.id||historyExam?.examId||historyExam?.examName||Math.random()),
          examName:String(historyExam?.examName||historyExam?.name||"Sınav"),
          examDate:String(historyExam?.examDate||historyExam?.date||historyExam?.createdAt||""),
          net:Number(student?.totals?.net||(student as any)?.net||0),
          score:Number.isFinite(score)?score:0,
          institutionRank:institutionRank>0?institutionRank:null,
        };
      }catch(error){
        console.error("Sıralı liste öğrenci geçmişi hesaplanamadı:",error);
        return null;
      }
    }).filter(Boolean) as Array<{id:string;examName:string;examDate:string;net:number;score:number;institutionRank:number|null}>;
    return history.sort((a,b)=>{
      const aTime=new Date(a.examDate||0).getTime();
      const bTime=new Date(b.examDate||0).getTime();
      return aTime!==bTime?aTime-bTime:a.examName.localeCompare(b.examName,"tr-TR",{numeric:true,sensitivity:"base"});
    }).slice(-5);
  },[adminRankingSelected,availableExams,evaluateExam]);
  const adminRankingSelectedTrend=React.useMemo(()=>{
    if(!adminRankingSelectedHistory.length)return null;
    const nets=adminRankingSelectedHistory.map(item=>Number(item.net||0));
    const min=Math.min(...nets);
    const max=Math.max(...nets);
    const first=nets[0]||0;
    const last=nets[nets.length-1]||0;
    const change=Number((last-first).toFixed(2));
    const direction=change>0.25?"up":change<-.25?"down":"stable";
    return{min,max,first,last,change,direction};
  },[adminRankingSelectedHistory]);
  const moveAdminRankingSelection=React.useCallback((direction:-1|1)=>{
    if(!adminRankingFilteredRows.length)return;
    const current=adminRankingSelected?adminRankingFilteredRows.findIndex(student=>student.id===adminRankingSelected.id):-1;
    const next=current<0?(direction>0?0:adminRankingFilteredRows.length-1):Math.max(0,Math.min(adminRankingFilteredRows.length-1,current+direction));
    setAdminRankingSelected(adminRankingFilteredRows[next]);
  },[adminRankingFilteredRows,adminRankingSelected]);
  const copyAdminRankingStudentSummary=React.useCallback(async()=>{
    if(!adminRankingSelected)return;
    const strongest=adminRankingSelectedInsight?.strongest;
    const support=adminRankingSelectedInsight?.support;
    const lines=[
      `${adminRankingSelected.studentName} (${adminRankingSelected.studentNumber})`,
      `Şube: ${adminRankingSelected.classroom}`,
      `Toplam Net: ${safeFixed(adminRankingSelected.totalNet,2)}`,
      `Genel Puan: ${safeFixed(adminRankingSelected.score,2)}`,
      `Şube Sırası: ${adminRankingSelected.classroomRank}`,
      `Kurum Sırası: ${adminRankingSelected.institutionRank}`,
      `Genel Sıra: ${adminRankingSelected.generalRank}`,
      strongest?`Güçlü Ders: ${strongest.name} (${strongest.net.toFixed(2)} net)`:null,
      support?`Destek Alanı: ${support.name} (${support.net.toFixed(2)} net)`:null,
      adminRankingSelectedTrend?`Net Eğilimi: ${adminRankingSelectedTrend.direction==="up"?"Yükseliyor":adminRankingSelectedTrend.direction==="down"?"Düşüyor":"Dengeli"} (${adminRankingSelectedTrend.change>0?"+":""}${safeFixed(adminRankingSelectedTrend.change,2)})`:null,
      ...(adminRankingSelectedInsight?.recommendations||[]).map((item:string,index:number)=>`Öneri ${index+1}: ${item}`),
      `Çalışma Planı İlerlemesi: %${adminRankingPlanProgress} (${adminRankingPlanCompleted}/${adminRankingSelectedActionPlan.length})`,
      ...adminRankingSelectedActionPlan.map((item:any,index:number)=>`Çalışma Önceliği ${index+1}: ${item.name} — ${item.weeklyAction} (${item.focus}) [${adminRankingPlanChecks[item.name]?"Tamamlandı":"Bekliyor"}]`),
    ].filter(Boolean).join("\n");
    try{
      await navigator.clipboard.writeText(lines);
      window.alert("Öğrenci akademik özeti panoya kopyalandı.");
    }catch(error){
      console.error("Öğrenci özeti kopyalanamadı:",error);
      window.alert("Öğrenci özeti kopyalanamadı.");
    }
  },[adminRankingSelected,adminRankingSelectedInsight,adminRankingSelectedTrend,adminRankingSelectedActionPlan,adminRankingPlanProgress,adminRankingPlanCompleted,adminRankingPlanChecks]);
  const exportSelectedStudentActionPlan=React.useCallback(async()=>{
    if(!adminRankingSelected||!adminRankingSelectedInsight)return;
    const planRows=adminRankingSelectedActionPlan.length
      ?adminRankingSelectedActionPlan.map((item:any,index:number)=>[
          index+1,
          item.name,
          item.priority==="high"?"Yüksek Öncelik":item.priority==="medium"?"Orta Öncelik":"Başarıyı Koru",
          item.focus,
          item.weeklyAction,
          adminRankingPlanChecks[item.name]?"Tamamlandı":"Bekliyor",
        ])
      :[["-","Çalışma planı oluşturulamadı","-","-","-","-"]];
    const subjectRows=(adminRankingSelectedBenchmarks||[]).map((item:any)=>[
      item.name,
      Number(item.studentNet||0).toFixed(2),
      Number(item.classroomAverage||0).toFixed(2),
      Number(item.institutionAverage||0).toFixed(2),
      `${Number(item.institutionDelta||0)>0?"+":""}${Number(item.institutionDelta||0).toFixed(2)}`,
    ]);
    const definition:any={
      pageSize:"A4",
      pageOrientation:"portrait",
      pageMargins:[34,30,34,32],
      content:[
        {text:"e-Nstitü KİŞİSELLEŞTİRİLMİŞ ÇALIŞMA PLANI",fontSize:17,bold:true,color:"#312e81",alignment:"center",margin:[0,0,0,4]},
        {text:examName,fontSize:10,bold:true,color:"#475569",alignment:"center",margin:[0,0,0,14]},
        {columns:[
          {width:"*",stack:[{text:"ÖĞRENCİ",fontSize:7,bold:true,color:"#64748b"},{text:adminRankingSelected.studentName,fontSize:13,bold:true,color:"#0f172a",margin:[0,2,0,0]},{text:`${adminRankingSelected.studentNumber} • ${adminRankingSelected.classroom}`,fontSize:8,color:"#64748b",margin:[0,2,0,0]}]},
          {width:155,table:{widths:["*","*"],body:[
            [{text:"Toplam Net",fontSize:7,bold:true,color:"#64748b"},{text:"Genel Puan",fontSize:7,bold:true,color:"#64748b"}],
            [{text:safeFixed(adminRankingSelected.totalNet,2),fontSize:12,bold:true,color:"#1d4ed8"},{text:safeFixed(adminRankingSelected.score,2),fontSize:12,bold:true,color:"#6d28d9"}],
            [{text:`Şube ${adminRankingSelected.classroomRank}.`,fontSize:7,color:"#475569"},{text:`Kurum ${adminRankingSelected.institutionRank}.`,fontSize:7,color:"#475569"}],
          ]},layout:"lightHorizontalLines"},
        ],columnGap:14,margin:[0,0,0,14]},
        {table:{widths:["*","*","*"],body:[
          [{text:"Akademik Durum",fontSize:7,bold:true,color:"#64748b",fillColor:"#f8fafc"},{text:"Risk Puanı",fontSize:7,bold:true,color:"#64748b",fillColor:"#f8fafc"},{text:"Plan İlerlemesi",fontSize:7,bold:true,color:"#64748b",fillColor:"#f8fafc"}],
          [{text:adminRankingSelected.academicStatus?.label||"-",fontSize:10,bold:true,color:"#0f172a"},{text:String(adminRankingSelected.academicStatus?.riskScore??"-"),fontSize:10,bold:true,color:"#be123c"},{text:`%${adminRankingPlanProgress} (${adminRankingPlanCompleted}/${adminRankingSelectedActionPlan.length})`,fontSize:10,bold:true,color:"#7c3aed"}],
        ]},layout:"lightHorizontalLines",margin:[0,0,0,14]},
        {text:"e-Nstitü AKADEMİK YORUMU",fontSize:9,bold:true,color:"#4338ca",margin:[0,0,0,5]},
        {text:`${adminRankingSelectedInsight.status}. Kurum içinde yaklaşık üst %${adminRankingSelectedInsight.percentile} dilimde. En güçlü ders ${adminRankingSelectedInsight.strongest?.name||"-"}; öncelikli destek alanı ${adminRankingSelectedInsight.support?.name||"-"}.`,fontSize:8.5,lineHeight:1.35,color:"#334155",margin:[0,0,0,12]},
        {text:"DERS KARŞILAŞTIRMASI",fontSize:9,bold:true,color:"#0f766e",margin:[0,0,0,5]},
        {table:{headerRows:1,widths:["*",48,48,48,48],body:[
          ["Ders","Öğrenci","Şube Ort.","Kurum Ort.","Kurum Farkı"].map(text=>({text,fontSize:7,bold:true,color:"#ffffff",fillColor:"#0f766e",alignment:"center"})),
          ...(subjectRows.length?subjectRows:[["-","-","-","-","-"]]).map(row=>row.map((value:any,index:number)=>({text:String(value),fontSize:7,alignment:index?"center":"left"}))),
        ]},layout:"lightHorizontalLines",margin:[0,0,0,14]},
        {text:"7 GÜNLÜK ÇALIŞMA PLANI",fontSize:9,bold:true,color:"#7c3aed",margin:[0,0,0,5]},
        {table:{headerRows:1,widths:[18,55,58,"*","*",52],body:[
          ["#","Ders","Öncelik","Çalışma Odağı","Haftalık Görev","Durum"].map(text=>({text,fontSize:6.5,bold:true,color:"#ffffff",fillColor:"#7c3aed",alignment:"center"})),
          ...planRows.map((row:any[])=>row.map((value:any,index:number)=>({text:String(value),fontSize:6.5,alignment:[0,2,5].includes(index)?"center":"left",color:index===5&&value==="Tamamlandı"?"#047857":"#334155"}))),
        ]},layout:"lightHorizontalLines"},
      ],
      footer:(currentPage:number,pageCount:number)=>({columns:[{text:`${adminRankingSelected.studentName} • e-Nstitü`,fontSize:6,color:"#94a3b8",margin:[34,0,0,0]},{text:`Sayfa ${currentPage} / ${pageCount}`,fontSize:6,color:"#94a3b8",alignment:"right",margin:[0,0,34,0]}]}),
    };
    try{
      const blob=await generatePdf(definition,{mode:"blob",filename:`${adminRankingSelected.studentName}-calisma-plani.pdf`}) as Blob;
      setPreview({blob,filename:`${adminRankingSelected.studentName}-calisma-plani.pdf`,title:`${adminRankingSelected.studentName} • Çalışma Planı`});
    }catch(error){
      console.error("Çalışma planı PDF oluşturulamadı:",error);
      window.alert("Çalışma planı PDF oluşturulamadı.");
    }
  },[adminRankingSelected,adminRankingSelectedInsight,adminRankingSelectedActionPlan,adminRankingPlanChecks,adminRankingPlanProgress,adminRankingPlanCompleted,adminRankingSelectedBenchmarks,examName]);

  const exportCurrentAdminRankingView=async()=>{
    if(generating)return;
    setGenerating("Sınav Sıralı Listeleri");
    try{
      const orientation=adminRankingSubjects.length>3?"landscape":"portrait";
      const rankHeader=adminRankingMode==="classroom"?"Şube Sıra":"Kurum Sıra";
      const headers:any[]=["Sıra","No","Adı Soyadı","Şube",...adminRankingSubjects.map(subject=>({text:subject,subcells:[{text:"D"},{text:"Y"},{text:"B"},{text:"Net"},{text:rankHeader}]})),{text:"Genel Sonuç",subcells:[{text:"Top. D"},{text:"Top. Y"},{text:"Top. B"},{text:"Top. Net"},{text:"Puan"},{text:"Şube Sıra"},{text:"Kurum Sıra"},{text:"Genel Sıra"}]}];
      const rawWidths=[4,5,14,6,...adminRankingSubjects.map(()=>Math.max(7,52/Math.max(1,adminRankingSubjects.length))),24];
      const widthTotal=rawWidths.reduce((sum,value)=>sum+value,0);
      const widths=rawWidths.map(value=>Number((value/widthTotal*100).toFixed(2)));
      const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
      const averageRow:any[]=[
        {text:"Ort.",bold:true,color:"#0f172a",background:"#cffafe"},
        "—",
        {text:"Gösterilen öğrenciler",bold:true,color:"#0f172a",background:"#cffafe"},
        {text:String(adminRankingFilteredRows.length),bold:true,color:"#0f172a",background:"#cffafe"},
        ...adminRankingSubjects.map((_subject,subjectIndex)=>({subcells:[
          {text:average(adminRankingFilteredRows.map(student=>Number(student.subjects?.[subjectIndex]?.correct||0))).toFixed(1),bold:true,color:"#047857"},
          {text:average(adminRankingFilteredRows.map(student=>Number(student.subjects?.[subjectIndex]?.wrong||0))).toFixed(1),bold:true,color:"#be123c"},
          {text:average(adminRankingFilteredRows.map(student=>Number(student.subjects?.[subjectIndex]?.empty||0))).toFixed(1),bold:true,color:"#475569"},
          {text:average(adminRankingFilteredRows.map(student=>Number(student.subjects?.[subjectIndex]?.net||0))).toFixed(2),bold:true,color:"#1d4ed8"},
          {text:"—",bold:true,color:"#4338ca"},
        ],background:"#ecfeff"})),
        {subcells:[
          {text:average(adminRankingFilteredRows.map(student=>student.totalCorrect)).toFixed(1),bold:true,color:"#047857"},
          {text:average(adminRankingFilteredRows.map(student=>student.totalWrong)).toFixed(1),bold:true,color:"#be123c"},
          {text:average(adminRankingFilteredRows.map(student=>student.totalEmpty)).toFixed(1),bold:true,color:"#475569"},
          {text:average(adminRankingFilteredRows.map(student=>student.totalNet)).toFixed(2),bold:true,color:"#1d4ed8"},
          {text:average(adminRankingFilteredRows.map(student=>student.score)).toFixed(2),bold:true,color:"#6d28d9"},
          {text:"—"},{text:"—"},{text:"—"},{text:"—"},
        ],background:"#ecfeff"},
      ];
      const studentRows=adminRankingFilteredRows.map(student=>[student.displayRank,student.studentNumber,{text:student.studentName,bold:true},student.classroom,...student.subjects.map((subject:any)=>({subcells:[{text:subject.correct},{text:subject.wrong},{text:subject.empty},{text:safeFixed(subject?.net,2),bold:true,color:"#1d4ed8"},{text:adminRankingMode==="classroom"?subject.classroomRank:subject.institutionRank,bold:true,color:"#4338ca"}]})),{subcells:[{text:student.totalCorrect},{text:student.totalWrong},{text:student.totalEmpty},{text:student.totalNet.toFixed(2),bold:true,color:"#1d4ed8"},{text:student.score.toFixed(2),bold:true,color:"#6d28d9"},{text:student.classroomRank,bold:true},{text:student.institutionRank,bold:true},{text:student.generalRank,bold:true,color:"#be123c"},{text:student.academicStatus?.label||"-",bold:true,color:student.academicStatus?.tone==="rose"?"#be123c":student.academicStatus?.tone==="amber"?"#b45309":student.academicStatus?.tone==="blue"?"#1d4ed8":"#047857"}]}]);
      const rows=[averageRow,...studentRows];
      const modeLabel=adminRankingMode==="classroom"?`Şube: ${adminRankingClassroom==="all"?"Tümü":adminRankingClassroom}`:adminRankingMode==="subject"?`Ders: ${adminRankingSubject==="all"?"Tümü":adminRankingSubject}`:"Kurum Geneli";
      const filterLabels=[
        adminRankingSearch.trim()?`Arama: ${adminRankingSearch.trim()}`:null,
        adminRankingOnlyBelowAverage?"Kurum ortalamasının altı":null,
        adminRankingLimit===0?"Tüm öğrenciler":`İlk ${adminRankingLimit}`,
      ].filter(Boolean).join(" · ");
      const blob=await exportTablePdf(`${examName}-filtrelenmis-sirali-liste.pdf`,"Sınav Sıralı Listeleri",[{title:"FİLTRELENMİŞ SINAV SIRALI LİSTESİ",subtitle:`${examName} · ${modeLabel} · ${adminRankingFilteredRows.length} öğrenci${filterLabels?` · ${filterLabels}`:""}`,headers,widths,rows}],{orientation,rowsPerPage:orientation==="landscape"?32:25,download:false,fullWidth:true,stripedRows:true,centerCells:true,horizontalMarginMm:4,columnBorderColor:"#1e3a8a",bodyRowHeightPx:22});
      setPreview({blob,filename:`${examName}-filtrelenmis-sirali-liste.pdf`,title:"Sınav Sıralı Listeleri"});
    }catch(error:any){console.error("Sıralı liste PDF oluşturulamadı",error);window.alert(error?.message||"PDF oluşturulamadı.");}
    finally{setGenerating(null);}
  };

  React.useEffect(()=>{
    setAdminRankingSelected(null);
  },[adminRankingMode,adminRankingClassroom,adminRankingSubject]);

  React.useEffect(()=>{
    if(!showAdminRankingFullscreen)return;
    const navigate=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target?.matches("input,select,textarea,[contenteditable='true']"))return;
      if(event.key==="Escape")setShowAdminRankingFullscreen(false);
      if(event.key==="ArrowDown"){event.preventDefault();moveAdminRankingSelection(1);}
      if(event.key==="ArrowUp"){event.preventDefault();moveAdminRankingSelection(-1);}
    };
    window.addEventListener("keydown",navigate);
    return()=>window.removeEventListener("keydown",navigate);
  },[showAdminRankingFullscreen,moveAdminRankingSelection]);

  return (
    <div className="space-y-5">


      {!focusedReport&&showAllCategories && (
        <nav className="rounded-[28px] bg-white p-3" aria-label="Sınav raporu türleri">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
            {reportViews.map((view)=>{
              const ViewIcon=view.icon;
              const active=activeReportView===view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={()=>selectReportView(view)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-black transition ${active?view.tone:"border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"}`}
                  aria-pressed={active}
                >
                  <ViewIcon className="h-4 w-4 shrink-0" />
                  <span>{view.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {!focusedReport&&visibleColumns.map((column) => {
        const Icon=column.icon;
        return (
          <section key={column.title} id={column.title==="Yönetici Raporları"?"admin-detailed-analyses":undefined} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={()=>toggleReportSection(column.title)}
              className={`${column.tone} flex w-full items-center justify-between gap-4 p-5 text-left text-white transition hover:brightness-105`}
              aria-expanded={Boolean(openReportSections[column.title])}
            >
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-white/15 p-3">
                  <Icon className="h-6 w-6"/>
                </span>
                <div>
                  <h2 className="font-black">{column.title}</h2>
                  <p className="mt-1 text-[11px] text-white/75">{column.subtitle}</p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 transition-transform ${
                  openReportSections[column.title] ? "rotate-180" : ""
                }`}
              />
            </button>

            {openReportSections[column.title] && (
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
              {column.items.map(item=>{
                const busy=generating===item.title;
                const canOpen=Boolean(item.action||item.primaryViewAction);
                return (
                  <article key={`${column.title}-${item.title}`} className={`flex min-h-32 flex-col rounded-2xl border p-4 ${canOpen?column.cardTone:"border-slate-200 bg-slate-100"}`}>
                    <button
                      type="button"
                      onClick={()=>openReport(column.title,column.tone,item)}
                      disabled={Boolean(generating)||!canOpen}
                      title={canOpen?`${item.title} aç`:"Rapor eylemi tanımlı değil"}
                      className={`flex min-h-20 flex-1 flex-col rounded-xl text-left transition ${canOpen?"cursor-pointer hover:brightness-95 focus:outline-none":"cursor-not-allowed opacity-60"}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-xs font-black text-slate-800">{item.title}</span>
                        <FileText className={`h-4 w-4 shrink-0 ${busy?"animate-pulse":"text-slate-500"}`}/>
                      </span>
                      <span className="mt-1 text-[10px] leading-relaxed text-slate-500">{item.description}</span>
                    </button>
                    {item.openPremiumView ? (
                      (()=>{
                        const PremiumIcon=item.premiumViewIcon||Building2;
                        return <button
                        type="button"
                        onClick={item.openPremiumView}
                        disabled={!results.length}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-700 bg-violet-700 px-3 py-2.5 text-[10px] font-black text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <PremiumIcon className="h-4 w-4"/>
                        {item.premiumViewLabel||"Premium Görünümü Aç"}
                      </button>;
                      })()
                    ) : null}
                  </article>
                );
              })}
            </div>
            )}
          </section>
        );
      })}

      {preview&&<PdfPreviewOverlay {...preview} onClose={()=>setPreview(null)}/>} 

      {!focusedReport&&<AdditionalReportSections
        showAllCategories={showAllCategories}
        activeReportView={activeReportView}
        openReportSections={openReportSections}
        toggleReportSection={toggleReportSection}
        setShowDevelopmentText={setShowDevelopmentText}
        developmentCards={developmentCards}
        developmentExamCount={developmentExamCount}
        developmentReliability={developmentReliability}
        exam={exam}
        results={results}
        selectedStudent={selectedStudent}
      />}

      <IntelligenceReportPanels ctx={{activeReportView,results,selectedStudent,showBrainDashboard,setShowBrainDashboard,showAcademicDnaDashboard,setShowAcademicDnaDashboard,showBrainTimeline,setShowBrainTimeline,showCopilotOptimizer,setShowCopilotOptimizer,reportCategory,showSchoolDigitalTwin,setShowSchoolDigitalTwin,showExecutiveCenter,setShowExecutiveCenter,showUniversityIntelligence,setShowUniversityIntelligence,showEarlyWarningCenter,setShowEarlyWarningCenter,showIntelligenceKernel,setShowIntelligenceKernel,showHasatAdvisor,setShowHasatAdvisor,showTeacherDecisionCenter,setShowTeacherDecisionCenter,showAdminDecisionCenter,setShowAdminDecisionCenter,setShowInstitutionReportV2,setShowBranchReportV2,setShowItemAnalysisReportV2,setShowStudentReportV2,setShowWhatsAppModal,brainData,academicDnaData,brainTimelineData,intelligenceKernelData,adminStudentReports,adminDecisionData,teacherDecisionData}}/>

      <ReportsOverlayLayer ctx={{showInstitutionReportV2,results,exam,setShowInstitutionReportV2,showItemAnalysisReportV2,setShowItemAnalysisReportV2,showBranchReportV2,setShowBranchReportV2,showStudentReportV2,adminRankingSelected,selectedStudent,setShowStudentReportV2,showAdminRankingFullscreen,setShowAdminRankingFullscreen,examName,adminDetailedRankingRows,adminRankingSubjects,adminRankingMode,setAdminRankingMode,adminRankingClassrooms,adminRankingClassroom,setAdminRankingClassroom,adminRankingSubject,setAdminRankingSubject,adminRankingSearch,setAdminRankingSearch,adminRankingLimit,setAdminRankingLimit,adminRankingSort,setAdminRankingSort,adminRankingOnlyBelowAverage,setAdminRankingOnlyBelowAverage,adminRankingDensity,setAdminRankingDensity,adminRankingShowHeatmap,setAdminRankingShowHeatmap,adminRankingZoom,setAdminRankingZoom,setAdminRankingSelected,exportCurrentAdminRankingView,generating,adminRankingFilteredRows,adminRankingAverageNet,adminRankingHighestNet,adminRankingSelectedIndex,moveAdminRankingSelection,safeFixed,adminRankingSelectedHistory,adminRankingSelectedTrend,adminRankingSelectedInsight,adminRankingSelectedBenchmarks,adminRankingSelectedActionPlan,adminRankingPlanChecks,adminRankingPlanProgress,adminRankingPlanCompleted,resetAdminRankingPlanChecks,toggleAdminRankingPlanCheck,setShowWhatsAppModal,exportSelectedStudentActionPlan,copyAdminRankingStudentSummary,showWhatsAppModal,activeReportView,reportCategory,showDevelopmentText,setShowDevelopmentText,developmentReportText}}/>
    </div>
  );
}

export default function ReportsModule(props:Props){
  return <ReportsRuntimeBoundary><ReportsModuleInner {...props}/></ReportsRuntimeBoundary>;
}
