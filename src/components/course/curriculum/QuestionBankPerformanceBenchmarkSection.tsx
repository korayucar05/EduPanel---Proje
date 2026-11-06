import React from "react";
import { RefreshCw } from "lucide-react";

type Props = {
  performanceBenchmark: any;
  performanceBenchmarkRunning: boolean;
  runPerformanceBenchmark: () => void | Promise<void>;

  performanceHistory: any;
  performanceHistoryRecording: boolean;
  refreshPerformanceHistory: (recordNow?: boolean) => void | Promise<void>;
};

export default function QuestionBankPerformanceBenchmarkSection({
  performanceBenchmark,
  performanceBenchmarkRunning,
  runPerformanceBenchmark,

  performanceHistory,
  performanceHistoryRecording,
  refreshPerformanceHistory,
}: Props) {
  if (!performanceBenchmark) return null;

  return (
                <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        Kapasite ve Performans Stres Testi
                      </div>
                      <div className="mt-1 text-[10px] font-semibold text-slate-500">
                        SQLite indeksli sorguların ve fiziksel dosya erişiminin gerçek gecikmesini ölçer.
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-xl bg-white px-3 py-2 text-center">
                        <div className="text-[8px] font-black uppercase text-slate-400">
                          Performans
                        </div>
                        <div
                          className={`text-xl font-black ${
                            performanceBenchmark.performanceGrade === "A+" ||
                            performanceBenchmark.performanceGrade === "A"
                              ? "text-emerald-700"
                              : performanceBenchmark.performanceGrade === "B"
                                ? "text-amber-700"
                                : "text-rose-700"
                          }`}
                        >
                          {performanceBenchmark.performanceGrade}
                        </div>
                      </div>

                      {performanceHistory?.latest?.id && (
                        <div
                          className={`rounded-xl px-3 py-2 text-[9px] font-black ${
                            performanceHistory.regression
                              ? "bg-rose-100 text-rose-700"
                              : performanceHistory.improvement
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {performanceHistory.regression
                            ? `Yavaşlama +${Number(performanceHistory.averageDelta || 0)} ms`
                            : performanceHistory.improvement
                              ? `İyileşme ${Number(performanceHistory.averageDelta || 0)} ms`
                              : "Performans sabit"}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={performanceHistoryRecording}
                        onClick={() => void refreshPerformanceHistory(true)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-[9px] font-black text-violet-800 hover:bg-violet-50 disabled:opacity-40"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${
                            performanceHistoryRecording ? "animate-spin" : ""
                          }`}
                        />
                        {performanceHistoryRecording
                          ? "Kaydediliyor…"
                          : "Performans Kaydı Al"}
                      </button>

                      <button
                        type="button"
                        disabled={performanceBenchmarkRunning}
                        onClick={() => void runPerformanceBenchmark()}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-violet-700 px-3 text-[9px] font-black text-white hover:bg-violet-800 disabled:opacity-40"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${
                            performanceBenchmarkRunning ? "animate-spin" : ""
                          }`}
                        />
                        {performanceBenchmarkRunning
                          ? "Test çalışıyor…"
                          : "Tekrar Test Et"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Aktif Soru
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(performanceBenchmark.activeQuestions || 0)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Kapasite Sınıfı
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {performanceBenchmark.capacityClass === "small"
                          ? "Küçük"
                          : performanceBenchmark.capacityClass === "medium"
                            ? "Orta"
                            : performanceBenchmark.capacityClass === "large"
                              ? "Büyük"
                              : "Çok Büyük"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Ortalama Gecikme
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(performanceBenchmark.averageLatencyMs || 0)} ms
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        En Yavaş Test
                      </div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Number(performanceBenchmark.slowestLatencyMs || 0)} ms
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {(performanceBenchmark.tests || []).map((test: any) => (
                      <div
                        key={test.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white bg-white/80 px-3 py-2"
                      >
                        <div>
                          <div className="text-[9px] font-black text-slate-800">
                            {test.label}
                          </div>
                          {test.error && (
                            <div className="mt-0.5 text-[8px] font-semibold text-rose-700">
                              {test.error}
                            </div>
                          )}
                        </div>
                        <div
                          className={`rounded-lg px-2 py-1 text-[8px] font-black ${
                            test.status === "excellent" ||
                            test.status === "good"
                              ? "bg-emerald-100 text-emerald-700"
                              : test.status === "warning"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {Number(test.durationMs || 0)} ms
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-[9px] font-semibold text-violet-800">
                    {performanceBenchmark.recommendation}
                  </div>

                  {Array.isArray(performanceHistory?.items) &&
                    performanceHistory.items.length > 1 && (
                      <div className="mt-3 rounded-xl border border-white bg-white/70 p-3">
                        <div className="text-[8px] font-black uppercase text-slate-500">
                          Son Performans Ölçümleri
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {performanceHistory.items
                            .slice(0, 8)
                            .map((item: any) => (
                              <div
                                key={item.id}
                                className="rounded-lg border border-slate-100 bg-white px-2.5 py-2"
                              >
                                <div
                                  className={`text-[11px] font-black ${
                                    Number(item.averageLatencyMs || 0) <= 300
                                      ? "text-emerald-700"
                                      : Number(item.averageLatencyMs || 0) <= 800
                                        ? "text-amber-700"
                                        : "text-rose-700"
                                  }`}
                                >
                                  {Number(item.averageLatencyMs || 0)} ms
                                </div>
                                <div className="text-[7px] font-black text-slate-400">
                                  {item.performanceGrade}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                </div>
  );
}