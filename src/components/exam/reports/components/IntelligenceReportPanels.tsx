import React from "react";
import { Activity, AlertTriangle, BarChart3, Bot, Building2, FileText, GraduationCap, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { AdminDecisionDashboard, TeacherDecisionDashboard } from "../../../intelligence";
import { AcademicDnaDashboard, BrainDashboard, BrainTimelineDashboard, CopilotOptimizerDashboard, EarlyWarningCenterDashboard, ExecutiveIntelligenceCenter, HasatAiAdvisor, SchoolDigitalTwinDashboard, UniversityIntelligenceDashboard } from "../../../intelligence-v2";
import { IntelligenceKernelDashboard } from "../../../intelligence-v3";

type Props={ctx:any};
export default function IntelligenceReportPanels({ctx}:Props){
  const {activeReportView,results,selectedStudent,showBrainDashboard,setShowBrainDashboard,showAcademicDnaDashboard,setShowAcademicDnaDashboard,showBrainTimeline,setShowBrainTimeline,showCopilotOptimizer,setShowCopilotOptimizer,reportCategory,showSchoolDigitalTwin,setShowSchoolDigitalTwin,showExecutiveCenter,setShowExecutiveCenter,showUniversityIntelligence,setShowUniversityIntelligence,showEarlyWarningCenter,setShowEarlyWarningCenter,showIntelligenceKernel,setShowIntelligenceKernel,showHasatAdvisor,setShowHasatAdvisor,showTeacherDecisionCenter,setShowTeacherDecisionCenter,showAdminDecisionCenter,setShowAdminDecisionCenter,setShowInstitutionReportV2,setShowBranchReportV2,setShowItemAnalysisReportV2,setShowStudentReportV2,setShowWhatsAppModal,brainData,academicDnaData,brainTimelineData,intelligenceKernelData,adminStudentReports,adminDecisionData,teacherDecisionData}=ctx;
  const advisorReports=activeReportView==="student"&&selectedStudent
    ?adminStudentReports.filter((report:any)=>String(report.student?.number||"")===String(selectedStudent.studentNumber||selectedStudent.schoolNumber||selectedStudent.studentNo||""))
    :adminStudentReports;
  return <>
{/* Hızlı erişim şeridi rapor kartlarını tekrar ettiği için kaldırıldı. */}
{false&&activeReportView!=="admin"&&(
      <div className="flex flex-wrap justify-end gap-2">
        {["admin","teacher"].includes(activeReportView)&&results.length>0&&(<button type="button" onClick={()=>setShowBrainDashboard(current=>!current)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${showBrainDashboard?"border-slate-900 bg-slate-900":"border-violet-700 bg-violet-700 hover:bg-violet-800"}`}><Activity className="h-4 w-4"/>Akademik Beyin</button>)}
        {["admin","teacher"].includes(activeReportView)&&results.length>0&&(<button type="button" onClick={()=>setShowAcademicDnaDashboard(current=>!current)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${showAcademicDnaDashboard?"border-slate-900 bg-slate-900":"border-indigo-700 bg-indigo-700 hover:bg-indigo-800"}`}><Activity className="h-4 w-4"/>Akademik DNA</button>)}
        {["admin","teacher"].includes(activeReportView)&&results.length>0&&(<button type="button" onClick={()=>setShowBrainTimeline(current=>!current)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${showBrainTimeline?"border-slate-900 bg-slate-900":"border-cyan-700 bg-cyan-700 hover:bg-cyan-800"}`}><TrendingUp className="h-4 w-4"/>Gelişim Zaman Çizelgesi</button>)}
        {["admin","teacher"].includes(activeReportView)&&results.length>0&&(<button type="button" onClick={()=>setShowCopilotOptimizer(current=>!current)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${showCopilotOptimizer?"border-slate-900 bg-slate-900":"border-violet-700 bg-violet-700 hover:bg-violet-800"}`}><Bot className="h-4 w-4"/>Akıllı İyileştirme Merkezi</button>)}
        {(String(activeReportView)==="admin"||String(reportCategory)==="admin")&&results.length>0&&(<button type="button" onClick={()=>setShowSchoolDigitalTwin(current=>!current)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${showSchoolDigitalTwin?"border-slate-900 bg-slate-900":"border-emerald-800 bg-emerald-800 hover:bg-emerald-900"}`}><Building2 className="h-4 w-4"/>Akademik Karar Merkezi</button>)}
        {(String(activeReportView)==="admin"||String(reportCategory)==="admin")&&results.length>0&&(<button type="button" onClick={()=>setShowExecutiveCenter(current=>!current)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${showExecutiveCenter?"border-slate-900 bg-slate-900":"border-blue-950 bg-blue-950 hover:bg-slate-900"}`}><Sparkles className="h-4 w-4"/>Yönetici Karar Merkezi</button>)}
        {(["admin","guidance"].includes(activeReportView)||String(reportCategory)==="admin")&&results.length>0&&(<button type="button" onClick={()=>setShowEarlyWarningCenter(current=>!current)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${showEarlyWarningCenter?"border-slate-900 bg-slate-900":"border-rose-800 bg-rose-800 hover:bg-rose-900"}`}><AlertTriangle className="h-4 w-4"/>Erken Risk Uyarıları</button>)}
        {(String(activeReportView)==="admin"||String(reportCategory)==="admin")&&results.length>0&&(<button type="button" onClick={()=>setShowIntelligenceKernel(current=>!current)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${showIntelligenceKernel?"border-slate-900 bg-slate-900":"border-black bg-black hover:bg-slate-900"}`}><Activity className="h-4 w-4"/>Akıllı Analiz Merkezi</button>)}
        {["admin","teacher","student"].includes(activeReportView)&&results.length>0&&(<button
          type="button"
          onClick={()=>setShowHasatAdvisor(current=>!current)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${
            showHasatAdvisor
              ?"border-slate-900 bg-slate-900 hover:bg-slate-800"
              :"border-violet-700 bg-violet-700 hover:bg-violet-800"
          }`}
          title="e-Nstitü verilerine doğal dille soru sorun"
        >
          <Bot className="h-4 w-4"/>
          Yapay Zekâ Danışmanı
        </button>)}
        {(activeReportView==="teacher"||reportCategory==="teacher")&&results.length>0&&(<button
          type="button"
          onClick={()=>setShowTeacherDecisionCenter(current=>!current)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black text-white shadow-sm transition ${
            showTeacherDecisionCenter
              ?"border-slate-900 bg-slate-900 hover:bg-slate-800"
              :"border-emerald-700 bg-emerald-700 hover:bg-emerald-800"
          }`}
          title="Seçili sınav için öğrenci müdahale gruplarını ve ortak ders risklerini aç"
        >
          <GraduationCap className="h-4 w-4"/>
          Öğretmen Akademik Önerileri
        </button>)}
        {(activeReportView==="teacher"||reportCategory==="teacher")&&results.length>0&&(<button
          type="button"
          onClick={()=>setShowItemAnalysisReportV2(true)}
          className="flex items-center gap-2 rounded-xl border border-violet-700 bg-violet-700 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-violet-800"
          title="Madde Analizi V2 Premium'u gerçek sınav verileriyle aç"
        >
          <BarChart3 className="h-4 w-4"/>
          Madde Analizi V2 Premium
        </button>)}
        {(activeReportView==="teacher"||reportCategory==="teacher")&&results.length>0&&(<button
          type="button"
          onClick={()=>setShowBranchReportV2(true)}
          className="flex items-center gap-2 rounded-xl border border-amber-700 bg-amber-700 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-amber-800"
          title="Branş Raporu V2 Premium'u gerçek sınav verileriyle aç"
        >
          <GraduationCap className="h-4 w-4"/>
          Branş Raporu V2 Premium
        </button>)}
        <button
          type="button"
          onClick={()=>setShowWhatsAppModal(true)}
          className="flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-800"
          title="Hazırlanan sınav raporlarını WhatsApp ile gönder"
        >
          <MessageCircle className="h-4 w-4"/>
          WhatsApp Gönder
        </button>
      </div>
      )}

      {showBrainDashboard&&["admin","teacher"].includes(activeReportView)&&(<div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"><BrainDashboard data={brainData}/></div>)}
      {showAcademicDnaDashboard&&["admin","teacher"].includes(activeReportView)&&(<div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"><AcademicDnaDashboard data={academicDnaData}/></div>)}
      {showBrainTimeline&&["admin","teacher"].includes(activeReportView)&&(<div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"><BrainTimelineDashboard data={brainTimelineData}/></div>)}
      {showCopilotOptimizer&&["admin","teacher"].includes(activeReportView)&&(<div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"><CopilotOptimizerDashboard cohort={brainData}/></div>)}
      {showSchoolDigitalTwin&&(activeReportView==="admin"||reportCategory==="admin")&&(<div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"><SchoolDigitalTwinDashboard cohort={brainData}/></div>)}
      {showExecutiveCenter&&(activeReportView==="admin"||reportCategory==="admin")&&(<div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"><ExecutiveIntelligenceCenter cohort={brainData}/></div>)}
      {showUniversityIntelligence&&(["admin","student"].includes(activeReportView)||["admin","student"].includes(String(reportCategory)))&&(<div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"><UniversityIntelligenceDashboard cohort={brainData}/></div>)}
      {showEarlyWarningCenter&&(["admin","guidance"].includes(activeReportView)||reportCategory==="admin")&&(<div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"><EarlyWarningCenterDashboard cohort={brainData} timeline={brainTimelineData}/></div>)}
      {showIntelligenceKernel&&(activeReportView==="admin"||reportCategory==="admin")&&(<div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"><IntelligenceKernelDashboard data={intelligenceKernelData}/></div>)}

      {showHasatAdvisor&&["admin","teacher","student"].includes(activeReportView)&&(
        <div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
          <HasatAiAdvisor
            audience={activeReportView==="admin"?"admin":activeReportView==="student"?"student":"teacher"}
            sources={{
              reports:advisorReports,
              admin:adminDecisionData,
              teacher:teacherDecisionData,
            }}
          />
        </div>
      )}

      {showTeacherDecisionCenter&&(activeReportView==="teacher"||reportCategory==="teacher")&&(
        <div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
          {adminStudentReports.length?(
            <TeacherDecisionDashboard data={teacherDecisionData}/>
          ):(
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
              <GraduationCap className="mx-auto h-9 w-9 text-amber-600"/>
              <h3 className="mt-3 text-sm font-black text-amber-900">Öğretmen karar verisi oluşturulamadı</h3>
              <p className="mt-2 text-xs leading-6 text-amber-700">Seçili sınavda değerlendirilebilir öğrenci sonucu bulunmuyor.</p>
            </div>
          )}
        </div>
      )}

      {showAdminDecisionCenter&&(activeReportView==="admin"||reportCategory==="admin")&&(
        <div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
          {adminStudentReports.length?(
            <AdminDecisionDashboard data={adminDecisionData}/>
          ):(
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
              <Activity className="mx-auto h-9 w-9 text-amber-600"/>
              <h3 className="mt-3 text-sm font-black text-amber-900">
                Yönetici karar verisi oluşturulamadı
              </h3>
              <p className="mt-2 text-xs leading-6 text-amber-700">
                Seçili sınavda değerlendirilebilir öğrenci sonucu bulunmuyor.
              </p>
            </div>
          )}
        </div>
      )}
  </>;
}
