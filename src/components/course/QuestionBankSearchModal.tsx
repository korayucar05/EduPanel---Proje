import React from "react";
import {
  Image as ImageIcon,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

type QuestionBankSearchModalProps = {
  open: boolean;
  loading: boolean;
  filters: any;
  results: any[];
  total: number;
  offset: number;

  curriculumMoveCatalog: any[];
  gradeEntry: any;
  course: any;
  unit: any;
  topic: any;

  onClose: () => void;
  onFilterChange: (key: string, value: string) => void;
  onSearch: (offset?: number) => void | Promise<void>;
  onReset: () => void;
  onPreview: (question: any) => void;
};

export default function QuestionBankSearchModal({
  open,
  loading,
  filters,
  results,
  total,
  offset,
  curriculumMoveCatalog,
  gradeEntry,
  course,
  unit,
  topic,
  onClose,
  onFilterChange,
  onSearch,
  onReset,
  onPreview,
}: QuestionBankSearchModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[244] flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Soru bankası arama penceresini kapat"
        onClick={onClose}
      />

      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-purple-950 px-5 py-4 text-white">
          <div>
            <div className="flex items-center gap-2 text-base font-black">
              <Search className="h-5 w-5" />
              Soru Bankasında Ara
            </div>

            <div className="mt-1 text-[10px] font-semibold text-purple-200">
              Sınıf, ders, ünite, konu, kazanım, cevap veya soru koduna göre filtreleyin.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-8">
            <select
              value={filters.grade}
              onChange={(e) => onFilterChange("grade", e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700"
            >
              <option value="">Tüm Sınıflar</option>

              {curriculumMoveCatalog.map((entry: any) => (
                <option key={entry.grade} value={entry.grade}>
                  {entry.label}
                </option>
              ))}
            </select>

            <select
              value={filters.courseId}
              onChange={(e) => onFilterChange("courseId", e.target.value)}
              disabled={!filters.grade}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 disabled:opacity-40"
            >
              <option value="">Tüm Dersler</option>

              {(gradeEntry?.courses || []).map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select
              value={filters.unitId}
              onChange={(e) => onFilterChange("unitId", e.target.value)}
              disabled={!filters.courseId}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 disabled:opacity-40"
            >
              <option value="">Tüm Üniteler</option>

              {(course?.curriculum?.units || []).map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select
              value={filters.topicId}
              onChange={(e) => onFilterChange("topicId", e.target.value)}
              disabled={!filters.unitId}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 disabled:opacity-40"
            >
              <option value="">Tüm Konular</option>

              {(unit?.topics || []).map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select
              value={filters.outcomeId}
              onChange={(e) => onFilterChange("outcomeId", e.target.value)}
              disabled={!filters.topicId}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 disabled:opacity-40"
            >
              <option value="">Tüm Kazanımlar</option>

              {(topic?.outcomes || []).map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.code || item.id}
                </option>
              ))}
            </select>

            <select
              value={filters.answer}
              onChange={(e) => onFilterChange("answer", e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700"
            >
              <option value="">Tüm Cevaplar</option>
              {["A", "B", "C", "D", "E"].map((answer) => (
                <option key={answer} value={answer}>
                  {answer}
                </option>
              ))}
            </select>

            <select
              value={filters.usage}
              onChange={(e) => onFilterChange("usage", e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700"
            >
              <option value="">Tüm Kullanımlar</option>
              <option value="unused">Kullanılmamış</option>
              <option value="used">Kullanılmış</option>
            </select>

            <input
              value={filters.q}
              onChange={(e) => onFilterChange("q", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSearch(0);
              }}
              placeholder="Kod / metin ara"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 outline-none focus:border-purple-400"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[10px] font-bold text-slate-500">
              {total.toLocaleString("tr-TR")} soru bulundu
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onReset}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-600 hover:bg-slate-100"
              >
                Temizle
              </button>

              <button
                type="button"
                onClick={() => void onSearch(0)}
                disabled={loading}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-purple-950 px-4 text-[10px] font-black text-white hover:bg-purple-900 disabled:opacity-50"
              >
                <Search className="h-3.5 w-3.5" />
                Ara
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
              <Search className="h-10 w-10 text-slate-200" />
              <div className="mt-3 text-sm font-black text-slate-500">
                Sonuç bulunamadı
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {results.map((question: any) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => onPreview(question)}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md"
                >
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
                    {question.imageUrl ? (
                      <img
                        src={question.imageUrl}
                        alt={question.questionCode || "Soru"}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-slate-300" />
                    )}
                  </div>

                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[10px] font-black text-slate-900">
                          {question.questionCode || question.id}
                        </div>

                        <div className="mt-1 truncate text-[9px] font-bold text-slate-500">
                          {question.courseName || question.courseId}
                        </div>
                      </div>

                      <span className="shrink-0 rounded-lg bg-purple-50 px-2 py-1 text-[8px] font-black text-purple-700">
                        {question.grade}. Sınıf
                      </span>
                    </div>

                    <div className="mt-2 truncate text-[9px] font-bold text-slate-500">
                      {question.unitName || question.unitId}
                    </div>

                    <div className="mt-1 truncate text-[9px] font-bold text-slate-400">
                      {question.topicName || question.topicId}
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 text-[9px] font-bold text-slate-400">
                      <span className="truncate">{question.outcomeId}</span>

                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-black text-emerald-700">
                        {question.answer}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[8px] font-bold">
                      <span
                        className={
                          Number(question.useCount || 0) > 0
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }
                      >
                        {Number(question.useCount || 0) > 0
                          ? `${question.useCount} kez kullanıldı`
                          : "Henüz kullanılmadı"}
                      </span>

                      {question.lastUsedAt && (
                        <span className="text-slate-400">
                          {new Date(question.lastUsedAt).toLocaleDateString("tr-TR")}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[9px] font-bold text-slate-400">
            {total > 0
              ? `${offset + 1}–${Math.min(offset + 24, total)} / ${total}`
              : "0 sonuç"}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset <= 0 || loading}
              onClick={() => void onSearch(Math.max(0, offset - 24))}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 disabled:opacity-40"
            >
              ← Önceki
            </button>

            <button
              type="button"
              disabled={offset + 24 >= total || loading}
              onClick={() => void onSearch(offset + 24)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 disabled:opacity-40"
            >
              Sonraki →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
