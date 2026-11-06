import React from "react";
import { AlertCircle, CheckCircle2, Loader2, PackageX, X } from "lucide-react";

interface DistributionProgressModalProps {
  open: boolean;
  solverRunning: boolean;
  solverProgress: number;
  solverStats: {
    totalBlocks: number;
    placedBlocks: number;
    remainingBlocks: number;
    stage: string;
  };
  unplacedInfo: { count: number; details: any[] };
  solverResult: { success: boolean; courseName?: string; reasons?: string[] } | null;
  onClose: () => void;
}

function DistributionProgressModal({
  open,
  solverRunning,
  solverProgress,
  solverStats,
  unplacedInfo,
  solverResult,
  onClose,
}: DistributionProgressModalProps) {
  if (!open) return null;

  const unplacedBlocks = unplacedInfo.details || [];
  const placementPercent = solverStats.totalBlocks > 0
    ? (solverStats.placedBlocks / solverStats.totalBlocks) * 100
    : 0;
  const displayedPercent = solverRunning
    ? (solverStats.totalBlocks > 0 ? Math.max(0, Math.min(100, solverProgress)) : 0)
    : Math.max(0, Math.min(100, placementPercent));
  // İşlem sonucu gelmediyse yeşil başarı simgesi göstermeyelim.
  const unfinished = !solverRunning && !solverResult && solverStats.totalBlocks > 0;
  const failed = !solverRunning && solverResult?.success === false;
  const displayedPercentLabel = Number.isInteger(displayedPercent)
    ? String(Math.round(displayedPercent))
    : displayedPercent.toFixed(1).replace(".", ",");
  const getTeacherNames = (item: any) => [
    item?.teacherName,
    item?.teacherName2,
    item?.course?.teacherName,
    item?.course?.teacherName2,
  ].map((name) => String(name || "").trim()).filter(Boolean).filter((name, index, names) => names.indexOf(name) === index);

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Dağıtım penceresini kapat"
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-slate-100 px-6 py-5 pr-14">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${solverRunning ? "bg-blue-50 text-blue-600" : unfinished ? "bg-amber-50 text-amber-700" : failed ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              {solverRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : unfinished || failed ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {solverRunning ? "Program dağıtımı sürüyor" : unfinished ? "Dağıtım sonucu henüz oluşmadı" : failed ? "Program dağıtımı tamamlanamadı" : "Program dağıtımı sonucu"}
              </h3>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {solverRunning ? solverStats.stage || "Ders blokları yerleştiriliyor..." : unfinished ? "Henüz tamamlanmış bir dağıtım sonucu yok; yeniden başlatmadan önce işlemin durumunu kontrol ediniz." : failed ? solverResult?.courseName || "Dağıtım hatası" : "Yerleşmeyen bloklar aşağıda listelenir."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600">
              <span>{solverStats.stage || "Dağıtım hazırlanıyor..."}</span>
              <span>%{displayedPercentLabel}{!solverRunning ? " yerleşti" : ""}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-200" style={{ width: `${displayedPercent}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[["Toplam blok", solverStats.totalBlocks, "text-slate-800"], ["Yerleştirilen", solverStats.placedBlocks, "text-emerald-700"], ["Kalan", solverStats.remainingBlocks, "text-amber-700"]].map(([label, value, color]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
                <div className={`mt-1 text-lg font-black ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {!solverRunning && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-800"><PackageX className="h-4 w-4 text-rose-600" />{solverStats.totalBlocks === 0 && failed ? "Dağıtım başlatılamadı" : "Dağıtılamayan bloklar"}</div>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700">{unplacedInfo.count}</span>
              </div>
              {unplacedBlocks.length > 0 ? (
                <div className="mt-3 max-h-60 space-y-2 overflow-auto pr-1">
                  {unplacedBlocks.map((item, index) => {
                    const teacherNames = getTeacherNames(item);
                    return (
                    <div key={`${item.courseName || item?.course?.courseName || "ders"}-${item.className || "sınıf"}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800">{item.courseName || item?.course?.courseName || "Ders"}</div>
                          {item?.reason ? <div className="mt-1 text-[10px] font-semibold text-rose-700">{item.reason}</div> : null}
                          {Array.isArray(item?.suggestedActions) && item.suggestedActions.length > 0 ? (
                            <div className="mt-1 text-[10px] text-slate-500">Öneri: {item.suggestedActions[0]}</div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right text-[10px] text-slate-500">
                          <div>{item.className || item?.course?.className || "Sınıf bilgisi yok"}</div>
                          <div className="mt-0.5 font-semibold text-slate-600">{teacherNames.length ? teacherNames.join(" / ") : "Öğretmen atanmamış"}</div>
                          {Number.isFinite(Number(item?.legalCandidateSlots)) ? (
                            <div className="mt-0.5">Uygun hücre: {Number(item.legalCandidateSlots)} / {Number(item?.totalCandidateSlots || 0)}</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                !failed ? <p className="mt-3 text-xs font-medium text-slate-500">Dağıtılamayan ders bloğu yok.</p> : null
              )}
              {solverResult?.reasons?.length ? (
                <div className="mt-3 space-y-1 text-xs font-semibold text-rose-700">
                  {solverResult.reasons.map((reason, index) => <p key={index}>{reason}</p>)}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(DistributionProgressModal);
