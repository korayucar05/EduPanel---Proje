import React from "react";
import { Upload, X } from "lucide-react";

type SmartFolderPreviewModalProps = {
  open: boolean;
  preview: any;
  excludedOutcomes: Record<string, boolean>;
  setExcludedOutcomes: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  routeOverrides: Record<string, string>;
  setRouteOverrides: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  outcomeOptions: any[];
  selectedGroups: any[];
  selectedFileCount: number;
  importRunning: boolean;
  groupKey: (group: any) => string;
  toggleOutcome: (group: any) => void;
  onCancel: () => void;
  onImport: () => void | Promise<void>;
};

export default function SmartFolderPreviewModal({
  open,
  preview,
  excludedOutcomes,
  setExcludedOutcomes,
  routeOverrides,
  setRouteOverrides,
  outcomeOptions,
  selectedGroups,
  selectedFileCount,
  importRunning,
  groupKey,
  toggleOutcome,
  onCancel,
  onImport,
}: SmartFolderPreviewModalProps) {
  if (!open || !preview) return null;

  return (
    <div className="fixed inset-0 z-[242] flex items-center justify-center bg-slate-950/75 p-5 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Akıllı klasör önizlemesini kapat"
        onClick={onCancel}
      />

      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-emerald-800 px-5 py-4 text-white">
          <div>
            <div className="text-base font-black">
              Akıllı Klasör İçe Aktarma • Önizleme
            </div>
            <div className="mt-1 text-[10px] font-semibold text-emerald-100">
              Yükleme başlamadan önce kazanım eşleşmelerini kontrol edin.
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-white/10 p-2 hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[9px] font-black uppercase text-slate-400">
              Toplam Görsel
            </div>
            <div className="mt-1 text-xl font-black text-slate-900">
              {Number(preview.totalImages || 0).toLocaleString("tr-TR")}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-[9px] font-black uppercase text-emerald-600">
              Eşleşen
            </div>
            <div className="mt-1 text-xl font-black text-emerald-900">
              {Number(preview.matchedCount || 0).toLocaleString("tr-TR")}
            </div>

            {Number(preview.duplicateCount || 0) > 0 && (
              <div className="mt-1 text-[8px] font-black text-amber-700">
                {preview.duplicateCount} tekrarlı dosya dışlandı
              </div>
            )}
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="text-[9px] font-black uppercase text-blue-600">
              Hedef Kazanım
            </div>
            <div className="mt-1 text-xl font-black text-blue-900">
              {Number(preview.matchedGroups?.length || 0)}
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              Number(preview.invalidAnswerCount || 0) > 0
                ? "border-orange-200 bg-orange-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div
              className={`text-[9px] font-black uppercase ${
                Number(preview.invalidAnswerCount || 0) > 0
                  ? "text-orange-600"
                  : "text-emerald-600"
              }`}
            >
              Cevap Hatalı
            </div>

            <div
              className={`mt-1 text-xl font-black ${
                Number(preview.invalidAnswerCount || 0) > 0
                  ? "text-orange-900"
                  : "text-emerald-900"
              }`}
            >
              {Number(preview.invalidAnswerCount || 0)}
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              Number(preview.unmatchedCount || 0) > 0
                ? "border-rose-200 bg-rose-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div
              className={`text-[9px] font-black uppercase ${
                Number(preview.unmatchedCount || 0) > 0
                  ? "text-rose-600"
                  : "text-emerald-600"
              }`}
            >
              Eşleşmeyen
            </div>

            <div
              className={`mt-1 text-xl font-black ${
                Number(preview.unmatchedCount || 0) > 0
                  ? "text-rose-900"
                  : "text-emerald-900"
              }`}
            >
              {Number(preview.unmatchedCount || 0)}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <section className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-black text-slate-900">
                  Kazanım Eşleşmeleri
                </div>

                <div className="mt-0.5 text-[9px] font-semibold text-slate-500">
                  Her satır gerçek yüklemede kullanılacak hedefi gösterir.
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setExcludedOutcomes({})}
                    className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[8px] font-black text-emerald-800"
                  >
                    Tümünü Seç
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const excluded: Record<string, boolean> = {};

                      (preview.matchedGroups || []).forEach((group: any) => {
                        excluded[groupKey(group)] = true;
                      });

                      setExcludedOutcomes(excluded);
                    }}
                    className="rounded-lg bg-slate-200 px-2.5 py-1 text-[8px] font-black text-slate-700"
                  >
                    Tümünü Kaldır
                  </button>
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                {(preview.matchedGroups || []).map((group: any) => (
                  <details
                    key={`${group.route.courseId}-${group.route.outcomeId}`}
                    className={`border-b last:border-0 ${
                      excludedOutcomes[groupKey(group)]
                        ? "border-slate-100 bg-slate-50 opacity-60"
                        : "border-emerald-100"
                    }`}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-emerald-50">
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleOutcome(group);
                          }}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-black ${
                            excludedOutcomes[groupKey(group)]
                              ? "border-slate-300 bg-white text-transparent"
                              : "border-emerald-600 bg-emerald-600 text-white"
                          }`}
                          title="Bu kazanımı içe aktarmaya dahil et / çıkar"
                        >
                          ✓
                        </button>

                        <div className="min-w-0">
                          <div className="font-mono text-[10px] font-black text-emerald-900">
                            {group.route.outcomeId}
                          </div>

                          <div className="mt-0.5 truncate text-[9px] font-semibold text-slate-500">
                            {group.route.courseName}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {routeOverrides[groupKey(group)] &&
                          routeOverrides[groupKey(group)] !==
                            group.route.outcomeId && (
                            <span className="rounded-lg bg-amber-100 px-2 py-1 text-[8px] font-black text-amber-800">
                              → {routeOverrides[groupKey(group)]}
                            </span>
                          )}

                        <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[9px] font-black text-emerald-800">
                          {group.fileCount} soru
                        </span>

                        <span className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-600 md:inline">
                          {["A", "B", "C", "D", "E"]
                            .filter(
                              (answer) =>
                                Number(group.answerDistribution?.[answer] || 0) >
                                0,
                            )
                            .map(
                              (answer) =>
                                `${answer}:${group.answerDistribution[answer]}`,
                            )
                            .join(" • ")}
                        </span>
                      </div>
                    </summary>

                    <div className="bg-slate-50 px-4 py-3">
                      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-2.5">
                        <div className="mb-1.5 text-[8px] font-black uppercase text-slate-500">
                          Hedef kazanımı düzelt
                        </div>

                        <select
                          value={
                            routeOverrides[groupKey(group)] ||
                            group.route.outcomeId
                          }
                          onChange={(event) => {
                            const value = event.target.value;

                            setRouteOverrides((prev) => ({
                              ...prev,
                              [groupKey(group)]: value,
                            }));
                          }}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-black text-slate-700 outline-none focus:border-emerald-400"
                        >
                          {outcomeOptions.map((option) => (
                            <option
                              key={`${option.courseId}-${option.outcomeId}`}
                              value={option.outcomeId}
                            >
                              {option.outcomeId} • {option.courseName} •{" "}
                              {option.unitName} • {option.topicName}
                            </option>
                          ))}
                        </select>

                        {routeOverrides[groupKey(group)] &&
                          routeOverrides[groupKey(group)] !==
                            group.route.outcomeId && (
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="text-[8px] font-black text-amber-700">
                                Hedef değiştirildi: {group.route.outcomeId} →{" "}
                                {routeOverrides[groupKey(group)]}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  setRouteOverrides((prev) => {
                                    const next = { ...prev };
                                    delete next[groupKey(group)];
                                    return next;
                                  })
                                }
                                className="rounded bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-600"
                              >
                                Geri Al
                              </button>
                            </div>
                          )}
                      </div>

                      <div className="space-y-1 font-mono text-[8px] leading-4 text-slate-500">
                        {(group.sampleFiles || []).map((file: any) => (
                          <div
                            key={file.path || file.name}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="truncate">
                              {file.path || file.name}
                            </span>

                            {file.answer && (
                              <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[8px] font-black text-emerald-800">
                                {file.answer}
                              </span>
                            )}
                          </div>
                        ))}

                        {group.fileCount > 5 && (
                          <div className="font-bold text-slate-400">
                            + {group.fileCount - 5} dosya daha
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>

            <section
              className={`overflow-hidden rounded-2xl border ${
                Number(preview.unmatchedCount || 0) > 0
                  ? "border-rose-200"
                  : "border-emerald-200"
              }`}
            >
              <div
                className={`border-b px-4 py-3 ${
                  Number(preview.unmatchedCount || 0) > 0
                    ? "border-rose-100 bg-rose-50"
                    : "border-emerald-100 bg-emerald-50"
                }`}
              >
                <div
                  className={`text-sm font-black ${
                    Number(preview.unmatchedCount || 0) > 0
                      ? "text-rose-900"
                      : "text-emerald-900"
                  }`}
                >
                  İçe Aktarılmayacak Dosyalar
                </div>

                <div className="mt-0.5 text-[9px] font-semibold text-slate-500">
                  Kazanımı bulunamayan, cevap harfi hatalı veya tekrarlı
                  dosyalar.
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto p-3">
                {Number(preview.rejectedCount || 0) === 0 ? (
                  <div className="p-6 text-center text-[10px] font-black text-emerald-700">
                    Tüm soru görselleri bir kazanımla eşleşti.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {(preview.unmatched || []).map((item: any) => (
                      <div
                        key={item.path || item.name}
                        className="rounded-lg bg-rose-50 px-2.5 py-2 font-mono text-[8px] leading-4 text-rose-700"
                      >
                        {item.path || item.name}
                      </div>
                    ))}

                    {(preview.invalidAnswer || []).map((item: any) => (
                      <div
                        key={`answer-${item.path || item.name}`}
                        className="rounded-lg bg-orange-50 px-2.5 py-2 font-mono text-[8px] leading-4 text-orange-700"
                      >
                        CEVAP HARFİ YOK • {item.path || item.name}
                      </div>
                    ))}

                    {(preview.duplicates || []).map((item: any) => (
                      <div
                        key={`duplicate-${item.path || item.name}`}
                        className="rounded-lg bg-amber-50 px-2.5 py-2 font-mono text-[8px] leading-4 text-amber-700"
                      >
                        TEKRARLI • {item.path || item.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="text-[9px] font-semibold text-slate-500">
            <span>
              {selectedGroups.length} kazanım • {selectedFileCount} soru
              seçildi.
              {Number(preview.rejectedCount || 0) > 0
                ? ` Ayrıca ${preview.rejectedCount} dosya ön kontrolden geçemedi.`
                : ""}
              {Object.keys(routeOverrides).length > 0
                ? ` ${Object.keys(routeOverrides).length} kazanım hedefi elle düzeltildi.`
                : ""}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={importRunning}
              onClick={onCancel}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black text-slate-600 hover:bg-slate-100"
            >
              Vazgeç
            </button>

            <button
              type="button"
              disabled={importRunning || selectedFileCount <= 0}
              onClick={() => void onImport()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-[10px] font-black text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              <Upload
                className={`h-4 w-4 ${
                  importRunning ? "animate-pulse" : ""
                }`}
              />

              {importRunning
                ? "İçe Aktarılıyor…"
                : `Seçilenleri İçe Aktar (${selectedFileCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}