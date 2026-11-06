import React from 'react';
import { Archive, Check, FileText, Trash2 } from 'lucide-react';
import { DisciplineArchivePanel } from './DisciplineArchivePanel';
import { DisciplineProcessSteps } from './DisciplineProcessSteps';

export function DisciplineMainPanels(props: any) {
  const {
    activeTab, setActiveTab, tabs, onOpenBehaviorTab,
    boardRecords, selectedRecordIdsForTutanak, setToplantiBilgileriStudent, setIsToplantiBilgileriModalOpen,
    filteredWarnings, getRecordStudents, setSelectedWarningForLetter, getWarningLetterHTML,
    setWarningLetterPrintPreviewContent, toggleLetterSent, handleRevert, handleArchiveRecord,
    filteredBoardRecords, handleToggleStep, openGuidanceStep, openCallLetterStep, openWrittenStatementsStep,
    handleMoveToDisciplineProcess, handlePrintSevkYazisi, openNotificationsStep, openDecisionStep,
    archiveRecords, archiveUniqueStudentCount, archiveSanctionStats, handleRestoreFromArchive, handleDeleteArchiveRecord,
  } = props;

  return <>
    <div className="bg-white border-2 border-dashed border-teal-600 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
      <div className="flex items-center overflow-x-auto gap-1.5 bg-teal-600 bg-theme-pattern p-1.5 rounded-2xl w-full scrollbar-hide shrink-0 h-[52px]">
        <button onClick={() => onOpenBehaviorTab?.("All")} className="flex-none flex items-center justify-center px-4 text-[13.67px] font-bold rounded-xl transition-all cursor-pointer border border-white text-teal-50 hover:text-white hover:bg-teal-700/50 text-center whitespace-nowrap h-[40px]">Davranış Kaydı</button>
        <button onClick={() => onOpenBehaviorTab?.("Olumlu")} className="flex-none flex items-center justify-center px-4 text-[13.67px] font-bold rounded-xl transition-all cursor-pointer border border-white text-teal-50 hover:text-white hover:bg-teal-700/50 text-center whitespace-nowrap h-[40px]">Davranış Listesi</button>
        <div className="h-6 w-px bg-teal-800/50 self-center mx-1 shrink-0" />
        {tabs.map((type: string) => (
          <button key={type} onClick={() => setActiveTab(type)} className={`flex-none flex items-center justify-center px-4 text-[13.67px] font-bold rounded-xl transition-all cursor-pointer border text-center whitespace-nowrap h-[40px] ${activeTab === type ? "bg-white text-amber-900 shadow-sm border-transparent" : "bg-amber-800 text-amber-50 hover:text-white hover:bg-amber-900 border-white"}`}>{type}</button>
        ))}
        {activeTab === "Ön İnceleme" && (
          <button onClick={() => {
            const selectedRecords = boardRecords.filter((r: any) => selectedRecordIdsForTutanak.includes(r.id));
            if (selectedRecords.length === 0) { alert("Lütfen toplantı bilgileri için listeden en az bir kayıt seçin."); return; }
            setToplantiBilgileriStudent(selectedRecords[0].studentName);
            setIsToplantiBilgileriModalOpen(true);
          }} className="ml-auto flex-none flex items-center justify-center gap-1.5 px-4 text-[11px] font-bold rounded-xl transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border border-transparent h-[40px] whitespace-nowrap font-sans shrink-0" title="Toplantı Bilgilerini Görüntüle">
            <FileText className="w-3.5 h-3.5" /> Toplantı Bilgileri
          </button>
        )}
      </div>
    </div>

    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col flex-1 min-h-[500px]">
      {activeTab === "Uyarı Bildirimi" ? (
        <div className="p-6 h-full flex flex-col">
          {filteredWarnings.length === 0 ? <div className="flex flex-col items-center justify-center text-slate-400 font-medium h-full flex-1 min-h-[300px]"><p>Henüz gönderilmiş veya arama kriterine uygun bir uyarı bildirimi kaydı bulunmamaktadır.</p></div> : (
            <div className="space-y-3">{filteredWarnings.map((warning: any) => (
              <div key={warning.id} className="flex flex-col gap-2"><div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100/50 transition-colors gap-4">
                <div className="flex items-start gap-4 w-full md:w-auto"><div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 shadow-inner mt-1">{warning.studentName.charAt(0)}</div><div className="flex-1">
                  <div className="flex flex-col gap-1.5">{getRecordStudents(warning).map((std: any, idx: number) => <h4 key={idx} className="font-bold text-slate-800 flex items-center gap-2 flex-wrap"><span>{std.name}</span><span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{std.classroom} - {std.number}</span></h4>)}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium mt-1.5 text-slate-500"><span className={`px-2 py-0.5 rounded-md border ${warning.warningCount && warning.warningCount > 1 ? "text-rose-600 bg-rose-100 border-rose-200/50 font-semibold" : "text-amber-600 bg-amber-100 border-amber-200/50 font-semibold"}`}>{warning.warningCount && warning.warningCount > 1 ? "Uyarı (Tekrarlayan Kınama)" : "Yazılı Uyarı (İlk Kınama)"}</span><span className="text-slate-300">•</span><span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/30 font-medium">Davranış: {warning.behaviorName}</span><span className="text-slate-300">•</span><span>Tarih: {new Date(warning.date).toLocaleDateString("tr-TR")}</span></div>
                </div></div>
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center ml-auto"><div className="relative shrink-0"><button onClick={() => { setSelectedWarningForLetter(warning); setWarningLetterPrintPreviewContent(getWarningLetterHTML(warning)); }} className={`w-[90px] h-[40px] ${warning.letterSent ? "bg-[#8b5a2b] hover:bg-[#a06833] border-[#7a4e25]" : "bg-amber-800 hover:bg-amber-900 border-amber-950"} text-white text-[10px] font-bold rounded-xl flex flex-col justify-center items-center text-center leading-tight transition-colors border shadow-sm cursor-pointer`} title="Uyarı Mektubu PDF'i Görüntüle / Oluştur"><span>Uyarı</span><span>Mektubu</span></button><button onClick={() => toggleLetterSent(warning.id)} className={`absolute -top-2 -right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${warning.letterSent ? "bg-emerald-500 border-white text-white z-10 shadow-sm" : "bg-white border-slate-300 text-transparent hover:border-slate-400 z-10"}`} title={warning.letterSent ? "Gönderildi İşaretini Kaldır" : "Gönderildi Olarak İşaretle"}><Check className={`w-3.5 h-3.5 stroke-[3px] ${warning.letterSent ? "block" : "hidden"}`} /></button></div>
                  <button onClick={() => handleRevert(warning, "warnings")} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 hover:border-rose-100 h-[40px] w-[40px] flex items-center justify-center shrink-0 cursor-pointer" title="Sil ve Geri Gönder"><Trash2 className="w-5 h-5" /></button>
                  <button onClick={() => handleArchiveRecord(warning, "Uyarı Bildirimi")} className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded-xl flex flex-col justify-center items-center text-center leading-tight transition-all border border-slate-950 shadow-sm cursor-pointer h-[40px] min-w-[70px]" title="Arşive Gönder"><Archive className="w-4 h-4 mb-0.5" /><span>Arşive Gönder</span></button>
                </div>
              </div></div>
            ))}</div>
          )}
        </div>
      ) : (activeTab === "Ön İnceleme" || activeTab === "Disiplin Süreci") ? (
        <div className="p-6 h-full flex flex-col">{filteredBoardRecords.length === 0 ? <div className="flex flex-col items-center justify-center text-slate-400 font-medium h-full flex-1 min-h-[300px]"><p>{activeTab === "Ön İnceleme" ? "Henüz Ön İnceleme'ye alınmış bir kayıt bulunmamaktadır." : "Henüz Disiplin Süreci'ne aktarılmış bir kayıt bulunmamaktadır."}</p></div> : (
          <div className="space-y-3">{filteredBoardRecords.map((record: any) => <div key={record.id} className={`flex flex-col p-4 bg-slate-50 rounded-2xl hover:bg-slate-100/50 transition-colors gap-3 ${activeTab === "Ön İnceleme" ? "border-2 border-emerald-500" : "border border-slate-200"}`}>
            <div className="flex items-center justify-between w-full"><div className="flex-1"><div className="flex flex-col gap-2">{getRecordStudents(record).map((std: any, idx: number) => <div key={idx} className="flex flex-wrap items-center gap-2"><span className="font-bold text-slate-800 text-base">{std.name}</span><span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">{std.classroom} - {std.number}</span><span className="text-sm text-slate-600 font-medium italic">({record.behaviorName})</span><span className="text-xs text-slate-400 font-normal ml-auto md:ml-2">Tarih: {new Date(record.date).toLocaleDateString("tr-TR")}</span></div>)}</div></div>
              <div className="flex items-center gap-2 shrink-0 ml-4">{activeTab === "Disiplin Süreci" && <button onClick={() => handleArchiveRecord(record, "Disiplin Süreci")} className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded-xl flex flex-col justify-center items-center text-center leading-tight transition-all border border-slate-950 shadow-sm cursor-pointer h-[40px] min-w-[70px]" title="Öğrenci bazında Arşive Gönder"><Archive className="w-4 h-4 mb-0.5" /><span>Arşive Gönder</span></button>}<button onClick={() => handleRevert(record, activeTab === "Disiplin Süreci" ? "disiplin-sureci" : "board")} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 hover:border-rose-100 h-[36px] w-[36px] flex items-center justify-center shrink-0 cursor-pointer" title={activeTab === "Disiplin Süreci" ? "Disiplin Sürecinden Kaldır ve Ön İncelemeye Geri Gönder" : "Sil ve Geri Gönder"}><Trash2 className="w-4.5 h-4.5" /></button></div>
            </div>
            <DisciplineProcessSteps mode={activeTab} record={record} onToggleStep={handleToggleStep} onGuidance={openGuidanceStep} onCallLetter={openCallLetterStep} onWrittenStatements={openWrittenStatementsStep} onMoveToDiscipline={handleMoveToDisciplineProcess} onPrintReferral={handlePrintSevkYazisi} onNotifications={openNotificationsStep} onDecision={openDecisionStep} />
          </div>)}</div>
        )}</div>
      ) : activeTab === "Arşiv" ? <DisciplineArchivePanel archiveRecords={archiveRecords} archiveUniqueStudentCount={archiveUniqueStudentCount} archiveSanctionStats={archiveSanctionStats} getRecordStudents={getRecordStudents} onRestore={handleRestoreFromArchive} onDelete={handleDeleteArchiveRecord} /> : <div className="flex flex-col items-center justify-center p-12 text-slate-400 font-medium h-full flex-1"><p>{activeTab} sekmesi yapım aşamasındadır.</p></div>}
    </div>
  </>;
}
