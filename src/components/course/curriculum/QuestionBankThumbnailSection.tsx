import React from "react";
import { RefreshCw } from "lucide-react";

type ThumbnailProgress = {
  completed: number;
  failed: number;
  total: number;
};

type Props = {
  thumbnailBatchRunning: boolean;
  thumbnailStatus: any;
  thumbnailProgress: ThumbnailProgress | null;
  bankStatus: any;
  buildMissingThumbnails: () => void | Promise<void>;
  formatBankBytes: (bytes: unknown) => string;
};

export default function QuestionBankThumbnailSection({
  thumbnailBatchRunning,
  thumbnailStatus,
  thumbnailProgress,
  bankStatus,
  buildMissingThumbnails,
  formatBankBytes,
}: Props) {
  return (
<>
              <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Thumbnail Performans Katmanı</div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-500">
                      Eski sorularda eksik küçük önizlemeleri toplu olarak oluşturur.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={thumbnailBatchRunning || Number(thumbnailStatus?.missingCount || 0) <= 0}
                    onClick={() => void buildMissingThumbnails()}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-700 px-4 text-[10px] font-black text-white hover:bg-cyan-800 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${thumbnailBatchRunning ? "animate-spin" : ""}`} />
                    {thumbnailBatchRunning ? "Thumbnail oluşturuluyor…" : "Eksik Thumbnail’ları Oluştur"}
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/80 p-3">
                    <div className="text-[9px] font-black uppercase text-slate-400">Hazır</div>
                    <div className="mt-1 text-lg font-black text-emerald-800">
                      {Number(thumbnailStatus?.readyCount || 0).toLocaleString("tr-TR")}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <div className="text-[9px] font-black uppercase text-slate-400">Eksik</div>
                    <div className="mt-1 text-lg font-black text-rose-800">
                      {Number(thumbnailStatus?.missingCount || 0).toLocaleString("tr-TR")}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <div className="text-[9px] font-black uppercase text-slate-400">Thumbnail Alanı</div>
                    <div className="mt-1 text-lg font-black text-cyan-900">
                      {formatBankBytes(bankStatus?.thumbnailBytes || 0)}
                    </div>
                  </div>
                </div>

                {thumbnailProgress && thumbnailBatchRunning && (
                  <div className="mt-3 rounded-xl border border-cyan-100 bg-white p-3">
                    <div className="flex items-center justify-between gap-3 text-[9px] font-black text-slate-600">
                      <span>
                        {thumbnailProgress.completed.toLocaleString("tr-TR")} tamamlandı
                        {thumbnailProgress.failed > 0
                          ? ` • ${thumbnailProgress.failed} başarısız`
                          : ""}
                      </span>
                      <span>
                        {thumbnailProgress.total > 0
                          ? `%${Math.min(
                              100,
                              Math.round(
                                ((thumbnailProgress.completed +
                                  thumbnailProgress.failed) /
                                  thumbnailProgress.total) *
                                  100,
                              ),
                            )}`
                          : "%0"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-cyan-600 transition-all"
                        style={{
                          width: `${
                            thumbnailProgress.total > 0
                              ? Math.min(
                                  100,
                                  ((thumbnailProgress.completed +
                                    thumbnailProgress.failed) /
                                    thumbnailProgress.total) *
                                    100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {!thumbnailBatchRunning &&
                  thumbnailStatus &&
                  Number(thumbnailStatus.missingCount || 0) === 0 && (
                    <div className="mt-3 text-[9px] font-black text-emerald-700">
                      Tüm aktif soruların thumbnail önizlemesi hazır.
                    </div>
                  )}
              </div>
</>
  );
}