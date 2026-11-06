import React from "react";
import { X } from "lucide-react";
import ExamResultsWhatsAppModal from "../../../ExamResultsWhatsAppModal";
import StudentReportV2Modal from "../../../../reports-v2/StudentReportV2Modal";
import InstitutionReportV2Modal from "../../../../reports-v2/institution/InstitutionReportV2Modal";
import { BranchReportV2Modal } from "../../../../reports-v2/branch/BranchReportV2Modal";
import { ItemAnalysisReportV2Modal } from "../../../../reports-v2/item-analysis/ItemAnalysisReportV2Modal";
import DetailedRankingTable from "../ranking/DetailedRankingTable";
import RankingStudentPanel from "../ranking/RankingStudentPanel";
import RankingFullscreenToolbar from "../ranking/RankingFullscreenToolbar";

type Props={ctx:any};
export default function ReportsOverlayLayer({ctx}:Props){
  const {showInstitutionReportV2,results,exam,setShowInstitutionReportV2,showItemAnalysisReportV2,setShowItemAnalysisReportV2,showBranchReportV2,setShowBranchReportV2,showStudentReportV2,adminRankingSelected,selectedStudent,setShowStudentReportV2,showAdminRankingFullscreen,setShowAdminRankingFullscreen,examName,adminDetailedRankingRows,adminRankingSubjects,adminRankingMode,setAdminRankingMode,adminRankingClassrooms,adminRankingClassroom,setAdminRankingClassroom,adminRankingSubject,setAdminRankingSubject,adminRankingSearch,setAdminRankingSearch,adminRankingLimit,setAdminRankingLimit,adminRankingSort,setAdminRankingSort,adminRankingOnlyBelowAverage,setAdminRankingOnlyBelowAverage,adminRankingDensity,setAdminRankingDensity,adminRankingShowHeatmap,setAdminRankingShowHeatmap,adminRankingZoom,setAdminRankingZoom,setAdminRankingSelected,exportCurrentAdminRankingView,generating,adminRankingFilteredRows,adminRankingAverageNet,adminRankingHighestNet,adminRankingSelectedIndex,moveAdminRankingSelection,safeFixed,adminRankingSelectedHistory,adminRankingSelectedTrend,adminRankingSelectedInsight,adminRankingSelectedBenchmarks,adminRankingSelectedActionPlan,adminRankingPlanChecks,adminRankingPlanProgress,adminRankingPlanCompleted,resetAdminRankingPlanChecks,toggleAdminRankingPlanCheck,setShowWhatsAppModal,exportSelectedStudentActionPlan,copyAdminRankingStudentSummary,showWhatsAppModal,activeReportView,reportCategory,showDevelopmentText,setShowDevelopmentText,developmentReportText}=ctx;
  return <>
{showInstitutionReportV2&&results.length>0&&(<InstitutionReportV2Modal
        exam={exam}
        results={results}
        onClose={()=>setShowInstitutionReportV2(false)}
      />)}

      {showItemAnalysisReportV2&&results.length>0&&(<ItemAnalysisReportV2Modal
        exam={exam}
        results={results}
        onClose={()=>setShowItemAnalysisReportV2(false)}
      />)}

      {showBranchReportV2&&results.length>0&&(<BranchReportV2Modal
        exam={exam}
        results={results}
        onClose={()=>setShowBranchReportV2(false)}
      />)}

      {showStudentReportV2&&results.length>0&&(<StudentReportV2Modal
        exam={exam}
        results={results}
        initialStudent={adminRankingSelected?.rawStudent||selectedStudent}
        onClose={()=>setShowStudentReportV2(false)}
      />)}

      {showAdminRankingFullscreen&&<div className="fixed inset-0 z-[150] bg-slate-950/75 p-2 backdrop-blur-sm" onMouseDown={()=>setShowAdminRankingFullscreen(false)}>
        <section className="flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-slate-700 bg-white shadow-2xl" onMouseDown={event=>event.stopPropagation()}>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-5 py-4 text-white">
            <div><span className="text-[9px] font-black uppercase tracking-[.16em] text-indigo-300">Tam Ekran İnceleme</span><h2 className="mt-1 text-base font-black">{examName} · Sınav Sıralı Listeleri</h2><p className="mt-1 text-[9px] text-slate-400">{adminDetailedRankingRows.length} öğrenci · {adminRankingSubjects.length} ders · Esc veya dış alana tıklayarak kapatın.</p></div>
            <RankingFullscreenToolbar
              mode={adminRankingMode}
              setMode={setAdminRankingMode}
              classrooms={adminRankingClassrooms}
              classroom={adminRankingClassroom}
              setClassroom={setAdminRankingClassroom}
              subjects={adminRankingSubjects}
              subject={adminRankingSubject}
              setSubject={setAdminRankingSubject}
              search={adminRankingSearch}
              setSearch={setAdminRankingSearch}
              limit={adminRankingLimit}
              setLimit={setAdminRankingLimit}
              sort={adminRankingSort}
              setSort={setAdminRankingSort}
              onlyBelowAverage={adminRankingOnlyBelowAverage}
              setOnlyBelowAverage={setAdminRankingOnlyBelowAverage}
              density={adminRankingDensity}
              setDensity={setAdminRankingDensity}
              showHeatmap={adminRankingShowHeatmap}
              setShowHeatmap={setAdminRankingShowHeatmap}
              zoom={adminRankingZoom}
              setZoom={setAdminRankingZoom}
              clearFilters={()=>{
                setAdminRankingSearch("");
                setAdminRankingLimit(100);
                setAdminRankingSort("ranking");
                setAdminRankingOnlyBelowAverage(false);
                setAdminRankingClassroom("all");
                setAdminRankingSubject("all");
                setAdminRankingSelected(null);
              }}
              exportPdf={exportCurrentAdminRankingView}
              generating={Boolean(generating)}
              close={()=>setShowAdminRankingFullscreen(false)}
            />
          </header>
          <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 p-2">
            <div className="mb-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
              {[["Öğrenci",adminDetailedRankingRows.length],["Gösterilen",adminRankingFilteredRows.length],["Ortalama Net",safeFixed(adminRankingAverageNet,2)],["En Yüksek Net",safeFixed(adminRankingHighestNet,2)],["Ders",adminRankingSubjects.length],["Sütun Ölçeği",`%${adminRankingZoom}`]].map(([label,value])=><div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><span className="text-[8px] font-black uppercase tracking-[.12em] text-slate-400">{label}</span><strong className="mt-1 block text-lg font-black text-slate-900">{value}</strong></div>)}
            </div>
            <div className={`grid h-[calc(100%-82px)] min-h-0 gap-2 ${adminRankingSelected?'xl:grid-cols-[minmax(0,1fr)_330px]':'grid-cols-1'}`}>
              <div className="min-h-0 overflow-auto rounded-xl border border-slate-300 bg-white">
                <DetailedRankingTable rows={adminRankingFilteredRows} subjects={adminRankingSubjects} rankingMode={adminRankingMode} onSelect={setAdminRankingSelected} selectedId={adminRankingSelected?.id} density={adminRankingDensity} showHeatmap={adminRankingShowHeatmap} zoom={adminRankingZoom}/>
                {!adminRankingFilteredRows.length&&<div className="p-12 text-center text-xs font-bold text-slate-400">Seçime uygun öğrenci sonucu bulunamadı.</div>}
              </div>
              {adminRankingSelected&&<RankingStudentPanel
                adminRankingSelected={adminRankingSelected}
                adminRankingSelectedIndex={adminRankingSelectedIndex}
                adminRankingFilteredRows={adminRankingFilteredRows}
                moveAdminRankingSelection={moveAdminRankingSelection}
                setAdminRankingSelected={setAdminRankingSelected}
                safeFixed={safeFixed}
                adminRankingSelectedHistory={adminRankingSelectedHistory}
                adminRankingSelectedTrend={adminRankingSelectedTrend}
                adminRankingSelectedInsight={adminRankingSelectedInsight}
                adminRankingSelectedBenchmarks={adminRankingSelectedBenchmarks}
                adminRankingSelectedActionPlan={adminRankingSelectedActionPlan}
                adminRankingPlanChecks={adminRankingPlanChecks}
                adminRankingPlanProgress={adminRankingPlanProgress}
                adminRankingPlanCompleted={adminRankingPlanCompleted}
                resetAdminRankingPlanChecks={resetAdminRankingPlanChecks}
                toggleAdminRankingPlanCheck={toggleAdminRankingPlanCheck}
                adminRankingMode={adminRankingMode}
                setShowStudentReportV2={setShowStudentReportV2}
                setShowWhatsAppModal={setShowWhatsAppModal}
                exportSelectedStudentActionPlan={exportSelectedStudentActionPlan}
                copyAdminRankingStudentSummary={copyAdminRankingStudentSummary}
              />}
            </div>
          </div>
        </section>
      </div>}

      {showWhatsAppModal && (
        <ExamResultsWhatsAppModal
          onClose={()=>setShowWhatsAppModal(false)}
          selectedExam={{
            examId:exam?.id,
            examName,
            reportCategory:activeReportView==="admin"||activeReportView==="teacher"||activeReportView==="student"?activeReportView:activeReportView==="parent"?"student":activeReportView==="guidance"?"teacher":reportCategory,
            results,
          }}
        />
      )}

      {showDevelopmentText && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onClick={() => setShowDevelopmentText(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-4 border-b bg-indigo-700 px-5 py-4 text-white">
              <div>
                <h3 className="font-black">Mentörler İçin Öğrenci Gelişim Raporları - Metin</h3>
                <p className="mt-1 text-[11px] text-indigo-100">
                  e-Nstitü Gelişim Analizi öneri metni
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDevelopmentText(false)}
                className="rounded-xl p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                title="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 font-sans text-sm font-medium leading-7 text-slate-700">
                {developmentReportText}
              </pre>
            </div>
          </div>
        </div>
      )}
  </>;
}
