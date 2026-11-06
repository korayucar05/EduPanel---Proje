import React from "react";

type JointStudentDetail = {
  studentName: string;
  classroom?: string;
  number?: string;
  hasPriorKinama?: boolean;
  priorKinamaCount?: number;
  hasWarnings?: boolean;
  warningCount?: number;
  isRepeatingThis?: boolean;
  specificCount?: number;
};

type Props = {
  isWarningOpen: boolean;
  isBoardOpen: boolean;
  isDeleteOpen: boolean;
  hasRecordToDiscipline: boolean;
  warningKinamaCount: number;
  boardReason: string;
  jointStudentsDetails: JointStudentDetail[];
  onCancelWarning: () => void;
  onConfirmWarning: () => void;
  onCancelBoard: () => void;
  onConfirmBoard: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
};

function JointStudentsSummary({ details }: { details: JointStudentDetail[] }) {
  if (!details.length) return null;
  return (
    <div className="mt-2 mb-6 space-y-3">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
        Birlikte İşlenen Suç - Katılımcı Öğrencilerin Durum Özeti
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
        {details.map((detail, idx) => (
          <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 hover:bg-slate-100/50 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1">
              <span className="font-bold text-slate-800 text-xs truncate max-w-[150px]">{detail.studentName}</span>
              <span className="text-[10px] font-semibold text-slate-500 shrink-0 bg-slate-200 px-1.5 py-0.5 rounded-md">{detail.classroom} - {detail.number}</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Önceki Kınama Cezası:</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${detail.hasPriorKinama ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {detail.hasPriorKinama ? `Evet (${detail.priorKinamaCount || 0} Adet)` : "Hayır (0)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Uyarı Yazısı Almış mı:</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${detail.hasWarnings ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {detail.hasWarnings ? `Evet (${detail.warningCount || 0} Adet)` : "Hayır (0)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Davranışın Tekrarı:</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${detail.isRepeatingThis ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {detail.isRepeatingThis ? `Evet (${detail.specificCount || 0} Kez)` : "İlk Defa"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BehaviorDisciplineModals(props: Props) {
  const {
    isWarningOpen, isBoardOpen, isDeleteOpen, hasRecordToDiscipline,
    warningKinamaCount, boardReason, jointStudentsDetails,
    onCancelWarning, onConfirmWarning, onCancelBoard, onConfirmBoard,
    onCancelDelete, onConfirmDelete,
  } = props;

  return (
    <>
      {isWarningOpen && hasRecordToDiscipline && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`bg-white rounded-3xl w-full ${jointStudentsDetails.length > 0 ? "max-w-2xl" : "max-w-md"} shadow-2xl flex flex-col p-6 border-l-4 border-amber-500 max-h-[90vh] overflow-y-auto`}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {warningKinamaCount === 1 ? "İlk Uyarı Bildirimi" : "Tekrarlayan Kınama Davranışı"}
            </h3>
            <p className="text-slate-600 text-sm mb-4 leading-relaxed">
              {warningKinamaCount === 1 ? (
                <>Öğrencinin sergilediği bu davranış <span className="font-bold text-slate-800">Kınama</span> cezası yaptırımı gerektirmektedir. Fakat öğrenci bu fiili ilk defa işlediği için <span className="font-bold text-slate-800">Yazılı Uyarı</span> ile uyarılacaktır. Onaylıyor musunuz?</>
              ) : (
                <>Öğrencinin sergilediği bu davranış <span className="font-bold text-slate-800">Kınama</span> cezası yaptırımı gerektirmektedir. Öğrenci daha önce de Kınama gerektiren bir davranışta bulunduğu için <span className="font-bold text-slate-800">Uyarı Bildirimi</span> alanına yönlendirilecektir. Onaylıyor musunuz?</>
              )}
            </p>
            <JointStudentsSummary details={jointStudentsDetails} />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={onCancelWarning} className="px-4 py-2 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors">İptal</button>
              <button onClick={onConfirmWarning} className="px-4 py-2 rounded-xl font-bold text-[16.67px] bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all">Gönder</button>
            </div>
          </div>
        </div>
      )}

      {isBoardOpen && hasRecordToDiscipline && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`bg-white rounded-3xl w-full ${jointStudentsDetails.length > 0 ? "max-w-2xl" : "max-w-md"} shadow-2xl flex flex-col p-6 border-l-4 border-rose-500 max-h-[90vh] overflow-y-auto`}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Ön İnceleme</h3>
            <p className="text-slate-600 text-sm mb-4 leading-relaxed">
              Öğrenci, <span className="font-bold text-slate-800">{boardReason.toLowerCase()}</span> sebebiyle ön incelemeye sevk edilecektir. Bu davranış kaydı Ön İnceleme alanına aktarılacaktır. Onaylıyor musunuz?
            </p>
            <JointStudentsSummary details={jointStudentsDetails} />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={onCancelBoard} className="px-4 py-2 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors">İptal</button>
              <button onClick={onConfirmBoard} className="px-4 py-2 rounded-xl font-bold text-[16.67px] bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 transition-all flex items-center gap-2">Ön İnceleme</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Davranış Kaydını Sil</h3>
            <p className="text-slate-600 text-sm mb-6">Bu davranış kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={onCancelDelete} className="px-4 py-2 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors">İptal</button>
              <button onClick={onConfirmDelete} className="px-4 py-2 rounded-xl font-bold text-[16.67px] bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 transition-all">Sil</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
