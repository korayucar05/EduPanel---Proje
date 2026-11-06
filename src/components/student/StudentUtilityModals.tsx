import React from "react";
import { Check, Copy, ExternalLink, Plus, QrCode, Search, Trash2, UserMinus, Users, X } from "lucide-react";
import type { Classroom, Student } from "../../types";

interface StudentUtilityModalsProps {
  isQrModalOpen: boolean;
  setIsQrModalOpen: (open: boolean) => void;
  linkCopied: boolean;
  setLinkCopied: (copied: boolean) => void;
  studentToDelete: string | null;
  setStudentToDelete: (id: string | null) => void;
  onConfirmDelete: (id: string) => Promise<void> | void;
  isBulkDeleteConfirmOpen: boolean;
  setIsBulkDeleteConfirmOpen: (open: boolean) => void;
  selectedStudentIds: string[];
  confirmBulkDelete: () => Promise<void> | void;
  isGroupAssignmentModalOpen: boolean;
  setIsGroupAssignmentModalOpen: (open: boolean) => void;
  systemClassrooms: Classroom[];
  students: Student[];
  activeAssignClassroom: string;
  setAssignClassroom: (value: string) => void;
  assignGroup: string;
  setAssignGroup: (value: string) => void;
  availableGroups: string[];
  assignCustomGroup: string;
  setAssignCustomGroup: (value: string) => void;
  assignSearchQuery: string;
  setAssignSearchQuery: (value: string) => void;
  searchedStudentsForAssignment: Student[];
  activeAssignGroup: string;
  addStudentToSelectedGroup: (studentId: string) => Promise<void> | void;
  currentGroupMembers: Student[];
  removeStudentFromSelectedGroup: (studentId: string) => Promise<void> | void;
}

export default function StudentUtilityModals(props: StudentUtilityModalsProps) {
  const {
    isQrModalOpen, setIsQrModalOpen, linkCopied, setLinkCopied,
    studentToDelete, setStudentToDelete, onConfirmDelete,
    isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen, selectedStudentIds, confirmBulkDelete,
    isGroupAssignmentModalOpen, setIsGroupAssignmentModalOpen, systemClassrooms, students,
    activeAssignClassroom, setAssignClassroom, assignGroup, setAssignGroup, availableGroups,
    assignCustomGroup, setAssignCustomGroup, assignSearchQuery, setAssignSearchQuery,
    searchedStudentsForAssignment, activeAssignGroup, addStudentToSelectedGroup,
    currentGroupMembers, removeStudentFromSelectedGroup,
  } = props;

  const registrationUrl = typeof window !== "undefined"
    ? window.location.origin.replace("ais-dev-", "ais-pre-") + window.location.pathname + "?mode=student-register"
    : "?mode=student-register";

  return <>
    {isQrModalOpen && (
      <div onClick={(e) => e.target === e.currentTarget && setIsQrModalOpen(false)} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 shadow-2xl relative space-y-5 animate-scaleUp">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="space-y-0.5"><h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2"><QrCode className="w-5 h-5 text-emerald-600" /><span>Kendi Kendine Kayıt QR Kodu</span></h3><p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Hızlı Öğrenci Başvuru Sistemi</p></div>
            <button onClick={() => setIsQrModalOpen(false)} className="p-1 px-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg border border-slate-200 cursor-pointer text-xs">Kapat</button>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">Aşağıdaki <strong className="text-slate-800">QR KODU</strong> öğrencilerinize veya velilerinize okutarak, cep telefonlarından hızlıca kendi kayıt formunu doldurmalarını sağlayabilirsiniz.</p>
          <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-150 rounded-2xl p-6 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-lg relative shrink-0"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(registrationUrl)}`} alt="Öğrenci Kayıt QR" className="w-44 h-44 object-contain" /><div className="absolute inset-x-0 -bottom-2 flex justify-center"><span className="bg-emerald-500 text-white font-extrabold text-[8px] px-2.5 py-1 rounded-full border border-white shadow-xs uppercase tracking-widest animate-pulse">TARATINIZ</span></div></div>
            <p className="text-[10px] text-slate-400 font-extrabold text-center font-mono break-all">{registrationUrl}</p>
          </div>
          <div className="space-y-1.5"><label className="block text-[10px] font-bold text-slate-500 uppercase">Açık Kayıt Bağlantısı (Link)</label><div className="flex items-center gap-2"><input type="text" readOnly value={registrationUrl} className="bg-slate-50 border border-slate-200 text-slate-600 font-semibold font-mono text-[10px] px-3 py-2.5 rounded-xl flex-1 focus:outline-none" /><button onClick={() => { navigator.clipboard.writeText(registrationUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }} className="bg-slate-900 text-white font-semibold text-[11px] p-2.5 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0">{linkCopied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span>Kopyalandı</span></> : <><Copy className="w-3.5 h-3.5" /><span>Kopyala</span></>}</button></div></div>
          <div className="pt-3 border-t border-slate-100 flex items-center gap-3"><a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"><ExternalLink className="w-3.5 h-3.5" /><span>Formu Yeni Sekmede Aç</span></a></div>
        </div>
      </div>
    )}

    {studentToDelete && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"><div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center p-8 text-center animate-in zoom-in-95 duration-200"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-6"><Trash2 className="w-8 h-8" /></div><h3 className="font-extrabold justify-center text-slate-800 text-xl mb-2">Öğrenci Kaydını Sil?</h3><p className="text-slate-500 font-medium text-sm mb-8">Bu öğrenci kaydı kalıcı olarak silinecektir ve geri alınamaz. Onaylıyor musunuz?</p><div className="flex w-full gap-3"><button onClick={() => setStudentToDelete(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer">Vazgeç</button><button onClick={() => onConfirmDelete(studentToDelete)} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm shadow-red-200 cursor-pointer">Sil</button></div></div></div>
    )}

    {isBulkDeleteConfirmOpen && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"><div className="flex w-full max-w-md flex-col items-center rounded-3xl bg-white p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200"><div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500"><Trash2 className="h-8 w-8" /></div><h3 className="mb-2 text-xl font-extrabold text-slate-800">Seçili Öğrencileri Sil?</h3><p className="mb-2 text-sm font-medium text-slate-500"><strong className="text-rose-600">{selectedStudentIds.length}</strong> öğrenci kaydı kalıcı olarak silinecektir.</p><p className="mb-8 text-xs text-slate-400">Bu işlem geri alınamaz. Devam etmek istediğinizden emin misiniz?</p><div className="flex w-full gap-3"><button type="button" onClick={() => setIsBulkDeleteConfirmOpen(false)} className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200">Vazgeç</button><button type="button" onClick={confirmBulkDelete} className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white shadow-sm shadow-red-200 transition-colors hover:bg-red-700">{selectedStudentIds.length} Öğrenciyi Sil</button></div></div></div>
    )}

    {isGroupAssignmentModalOpen && (
      <div onClick={(e) => e.target === e.currentTarget && setIsGroupAssignmentModalOpen(false)} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-[32px] border border-slate-100 max-w-2xl w-full p-6 md:p-8 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden space-y-6 animate-scaleUp">
          <button onClick={() => setIsGroupAssignmentModalOpen(false)} className="absolute top-6 right-6 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all cursor-pointer"><X className="w-5 h-5" /></button>
          <div className="space-y-1 shrink-0"><h3 className="text-lg font-black text-slate-800 flex items-center gap-2.5"><Users className="w-6 h-6 text-violet-600 animate-pulse" /><span>Gruplara Öğrenci Atama</span></h3><p className="text-xs text-slate-500 font-medium">Sınıf şubesi ve grup seçerek öğrencileri hızlıca gruplara dahil edin veya çıkarın.</p></div>
          <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shrink-0">
              <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sınıf Şubesi Seçin</label><select value={activeAssignClassroom} onChange={(e) => setAssignClassroom(e.target.value)} className="w-full h-11 px-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-100 focus:outline-none cursor-pointer shadow-xs">{Array.from(new Set([...systemClassrooms.map(c => c.name), ...students.map(s => s.classroom)])).filter(Boolean).sort((a, b) => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" })).map((cls) => <option key={cls} value={cls}>{cls} Sınıfı</option>)}</select></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sınıf İçi Grup Seçin</label><div className="flex flex-col gap-2"><select value={assignGroup} onChange={(e) => setAssignGroup(e.target.value)} className="w-full h-11 px-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-100 focus:outline-none cursor-pointer shadow-xs"><option value="">Grupsuz</option>{availableGroups.map(group => <option key={group} value={group}>{group}</option>)}<option value="Özel">Özel Grup...</option></select>{assignGroup === "Özel" && <input value={assignCustomGroup} onChange={(e) => setAssignCustomGroup(e.target.value)} placeholder="Grup adını yazın" className="w-full h-10 px-3 bg-white border border-violet-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-100" />}</div></div>
            </div>
            <div className="space-y-3"><div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Öğrenci Bul ve Gruba Ekle</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" value={assignSearchQuery} onChange={(e) => setAssignSearchQuery(e.target.value)} placeholder="Eklenecek öğrencinin adı, soyadı veya okul numarası..." className="w-full h-11 pl-10 pr-4 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-medium transition-all focus:ring-2 focus:ring-indigo-100 focus:outline-none shadow-xs" /></div></div>
              {assignSearchQuery.trim() !== "" && <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 p-2 space-y-2 animate-fadeIn max-h-52 overflow-y-auto scrollbar-thin"><div className="px-2 pt-1 pb-1 flex justify-between items-center shrink-0"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Arama Sonuçları ({searchedStudentsForAssignment.length})</span></div>{searchedStudentsForAssignment.length > 0 ? <div className="divide-y divide-slate-100 bg-white border border-slate-100 rounded-xl overflow-hidden">{searchedStudentsForAssignment.map((student) => { const isInSelectedGroup = student.classroom === activeAssignClassroom && student.group === activeAssignGroup; return <div key={student.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/80 transition-colors"><div className="space-y-0.5"><span className="font-extrabold text-slate-800">{student.name}</span><div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold"><span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">No: {student.id}</span><span>•</span><span>{student.classroom || "Sınıfsız"}</span>{student.group && <><span>•</span><span className="text-violet-600">{student.group}</span></>}</div></div><button onClick={() => addStudentToSelectedGroup(student.id)} disabled={isInSelectedGroup} className={`h-8 px-3 rounded-xl text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${isInSelectedGroup ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"}`}>{isInSelectedGroup ? <><Check className="w-3.5 h-3.5 text-emerald-500" /><span>Grupta</span></> : <><Plus className="w-3.5 h-3.5" /><span>Gruba Ekle</span></>}</button></div>; })}</div> : <p className="text-[11px] text-slate-400 italic text-center py-4">Öğrenci bulunamadı.</p>}</div>}
            </div>
            <div className="space-y-3"><div className="flex items-center justify-between"><span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Gruptaki Öğrenci Listesi ({currentGroupMembers.length})</span><span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full uppercase">{activeAssignClassroom} • {activeAssignGroup || "Grup Yok"}</span></div>{currentGroupMembers.length > 0 ? <div className="border border-slate-150/60 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto scrollbar-thin shadow-xs">{currentGroupMembers.map((student) => <div key={student.id} className="p-3 bg-white hover:bg-slate-50/50 flex items-center justify-between text-xs transition-all"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold font-mono">{student.avatar ? <img src={student.avatar} className="w-full h-full rounded-full object-cover" /> : student.name.charAt(0)}</div><div className="space-y-0.5"><span className="font-extrabold text-slate-800">{student.name}</span><p className="text-[10px] text-slate-400 font-medium">Okul No: {student.id}</p></div></div><button onClick={() => removeStudentFromSelectedGroup(student.id)} className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer" title="Gruptan Çıkar"><UserMinus className="w-4 h-4" /></button></div>)}</div> : <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 text-center"><p className="text-xs text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">Seçilen <strong className="text-slate-600">{activeAssignClassroom}</strong> sınıfı <strong className="text-slate-600">{activeAssignGroup || "Grupsuz"}</strong> grubunda şu an kayıtlı öğrenci bulunmuyor.</p></div>}</div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end shrink-0"><button onClick={() => setIsGroupAssignmentModalOpen(false)} className="h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm">Tamamla</button></div>
        </div>
      </div>
    )}
  </>;
}
