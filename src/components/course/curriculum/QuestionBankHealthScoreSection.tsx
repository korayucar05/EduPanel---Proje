import React from "react";
import { RefreshCw } from "lucide-react";

type Props = {
  questionBankHealthScore: any;
  healthScoreHistory: any;
  healthScoreTrend: any;
  healthScoreRecording: boolean;
  refreshHealthScoreHistory: (recordNow?: boolean) => void | Promise<void>;
};

export default function QuestionBankHealthScoreSection({
  questionBankHealthScore,
  healthScoreHistory,
  healthScoreTrend,
  healthScoreRecording,
  refreshHealthScoreHistory,
}: Props) {
  if (!questionBankHealthScore) return null;

  return (
                <div
                  className={`mt-5 rounded-2xl border p-4 ${
                    questionBankHealthScore.status === "healthy"
                      ? "border-emerald-200 bg-emerald-50/60"
                      : questionBankHealthScore.status === "warning"
                        ? "border-amber-200 bg-amber-50/60"
                        : "border-rose-200 bg-rose-50/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        Soru Bankası Sağlık Puanı
                      </div>
                      <div className="mt-1 text-[10px] font-semibold text-slate-500">
                        Dosya, metadata, indeks ve güvenli yazma katmanlarının ortak sağlık göstergesi.
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {healthScoreHistory?.latest?.id && (
                        <div
                          className={`rounded-xl px-3 py-2 text-[9px] font-black ${
                            healthScoreHistory.trend === "up"
                              ? "bg-emerald-100 text-emerald-700"
                              : healthScoreHistory.trend === "down"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {healthScoreHistory.trend === "up"
                            ? `↑ +${Number(healthScoreHistory.delta || 0)} puan`
                            : healthScoreHistory.trend === "down"
                              ? `↓ ${Number(healthScoreHistory.delta || 0)} puan`
                              : healthScoreHistory.trend === "stable"
                                ? "→ Puan değişmedi"
                                : "İlk kayıt"}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={healthScoreRecording}
                        onClick={() => void refreshHealthScoreHistory(true)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${
                            healthScoreRecording ? "animate-spin" : ""
                          }`}
                        />
                        {healthScoreRecording
                          ? "Puan kaydediliyor…"
                          : "Yeni Sağlık Kaydı"}
                      </button>

                      <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div
                          className={`text-4xl font-black ${
                            questionBankHealthScore.status === "healthy"
                              ? "text-emerald-700"
                              : questionBankHealthScore.status === "warning"
                                ? "text-amber-700"
                                : "text-rose-700"
                          }`}
                        >
                          {Number(questionBankHealthScore.score || 0)}
                        </div>
                        <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                          / 100
                        </div>
                      </div>
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-white ${
                          questionBankHealthScore.status === "healthy"
                            ? "bg-emerald-700"
                            : questionBankHealthScore.status === "warning"
                              ? "bg-amber-600"
                              : "bg-rose-700"
                        }`}
                      >
                        {questionBankHealthScore.grade}
                      </div>
                    </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Aktif Soru
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(questionBankHealthScore.metrics?.activeRecords || 0)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Eksik Dosya
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(questionBankHealthScore.metrics?.missingFiles || 0)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Sahipsiz
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(questionBankHealthScore.metrics?.orphanFiles || 0)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Yazma Sorunu
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(questionBankHealthScore.metrics?.pendingWrites || 0) +
                          Number(questionBankHealthScore.metrics?.failedWrites || 0)}
                      </div>
                    </div>
                  </div>

                  {Array.isArray(questionBankHealthScore.deductions) &&
                    questionBankHealthScore.deductions.length > 0 && (
                      <div className="mt-3 rounded-xl border border-white bg-white/70 p-3">
                        <div className="text-[8px] font-black uppercase text-slate-500">
                          Puan Kesintileri
                        </div>
                        <div className="mt-2 space-y-1">
                          {questionBankHealthScore.deductions.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 text-[8px] font-semibold text-slate-600"
                            >
                              <span>
                                {item.label} ({Number(item.count || 0)})
                              </span>
                              <span className="font-black text-rose-700">
                                -{Number(item.points || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  {Array.isArray(healthScoreHistory?.items) &&
                    healthScoreHistory.items.length > 1 && (
                      <div className="mt-3 rounded-xl border border-white bg-white/70 p-3">
                        <div className="text-[8px] font-black uppercase text-slate-500">
                          Son Sağlık Puanları
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {healthScoreHistory.items
                            .slice(0, 8)
                            .map((item: any) => (
                              <div
                                key={item.id}
                                className="rounded-lg border border-slate-100 bg-white px-2.5 py-2"
                              >
                                <div className={`text-[12px] font-black ${
                                  Number(item.score || 0) >= 90
                                    ? "text-emerald-700"
                                    : Number(item.score || 0) >= 70
                                      ? "text-amber-700"
                                      : "text-rose-700"
                                }`}>
                                  {Number(item.score || 0)}
                                </div>
                                <div className="text-[7px] font-black text-slate-400">
                                  {item.grade}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  {Array.isArray(healthScoreTrend?.points) &&
                    healthScoreTrend.points.length > 1 && (
                      <div className="mt-3 rounded-xl border border-white bg-white/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[8px] font-black uppercase text-slate-500">
                              Sağlık Puanı Trendi
                            </div>
                            <div className="mt-0.5 text-[7px] font-semibold text-slate-400">
                              Son {healthScoreTrend.points.length} sağlık kaydı
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="rounded-lg bg-white px-2 py-1 text-[8px] font-black text-slate-700">
                              Ort. {healthScoreTrend.average}
                            </span>
                            <span className="rounded-lg bg-white px-2 py-1 text-[8px] font-black text-slate-700">
                              Min {healthScoreTrend.min}
                            </span>
                            <span className="rounded-lg bg-white px-2 py-1 text-[8px] font-black text-slate-700">
                              Maks. {healthScoreTrend.max}
                            </span>
                            <span
                              className={`rounded-lg px-2 py-1 text-[8px] font-black ${
                                Number(healthScoreTrend.changeFromFirst || 0) > 0
                                  ? "bg-emerald-100 text-emerald-700"
                                  : Number(healthScoreTrend.changeFromFirst || 0) < 0
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              İlk kayda göre{" "}
                              {Number(healthScoreTrend.changeFromFirst || 0) > 0
                                ? "+"
                                : ""}
                              {Number(healthScoreTrend.changeFromFirst || 0)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex h-28 items-end gap-1 overflow-hidden rounded-xl bg-white/80 px-2 pb-2 pt-3">
                          {healthScoreTrend.points.map((point: any) => {
                            const score = Math.max(
                              0,
                              Math.min(100, Number(point.score || 0)),
                            );
                            return (
                              <div
                                key={point.id}
                                className="group flex min-w-[8px] flex-1 flex-col items-center justify-end"
                                title={`${point.calculatedAt} • ${score}/100 • ${point.grade}`}
                              >
                                <div
                                  className={`w-full max-w-5 rounded-t ${
                                    score >= 90
                                      ? "bg-emerald-500"
                                      : score >= 70
                                        ? "bg-amber-500"
                                        : "bg-rose-500"
                                  }`}
                                  style={{
                                    height: `${Math.max(5, score)}%`,
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-[7px] font-semibold text-slate-400">
                            Eski
                          </div>
                          <div
                            className={`text-[8px] font-black ${
                              healthScoreTrend.trend === "up"
                                ? "text-emerald-700"
                                : healthScoreTrend.trend === "down"
                                  ? "text-rose-700"
                                  : "text-slate-600"
                            }`}
                          >
                            {healthScoreTrend.trend === "up"
                              ? `Son 5 kayıtta yükseliş (+${Number(
                                  healthScoreTrend.recentDelta || 0,
                                )})`
                              : healthScoreTrend.trend === "down"
                                ? `Son 5 kayıtta düşüş (${Number(
                                    healthScoreTrend.recentDelta || 0,
                                  )})`
                                : "Son 5 kayıtta sabit"}
                          </div>
                          <div className="text-[7px] font-semibold text-slate-400">
                            Yeni
                          </div>
                        </div>
                      </div>
                    )}
                </div>
  );
}