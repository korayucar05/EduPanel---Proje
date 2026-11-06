import React from "react";
import { RefreshCw, X } from "lucide-react";

type Props = {
  bankCapacity: any;
  bankCapacityLoading: boolean;

  bankCapacityGrade: string;
  bankCapacityCourseId: string;
  bankMinimumStock: number;

  curriculumMoveCatalog: any[];
  curriculumCoverage: any;

  setBankCapacityGrade: React.Dispatch<React.SetStateAction<string>>;
  setBankCapacityCourseId: React.Dispatch<React.SetStateAction<string>>;
  setBankMinimumStock: React.Dispatch<React.SetStateAction<number>>;

  loadQuestionBankCapacity: () => void | Promise<void>;
  focusCapacityOutcomeForUpload: (item: any) => void | Promise<void>;

  onClose: () => void;
};

export default function QuestionBankCapacityModal({
  bankCapacity,
  bankCapacityLoading,
  bankCapacityGrade,
  bankCapacityCourseId,
  bankMinimumStock,
  curriculumMoveCatalog,
  curriculumCoverage,
  setBankCapacityGrade,
  setBankCapacityCourseId,
  setBankMinimumStock,
  loadQuestionBankCapacity,
  focusCapacityOutcomeForUpload,
  onClose,
}: Props) {
  return (
<div className="fixed inset-0 z-[243] flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm">
  <button
    type="button"
    className="absolute inset-0 cursor-default"
    aria-label="Soru havuzu doluluk penceresini kapat"
    onClick={() => onClose()}
  />
  <div
    className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
    onClick={(event) => event.stopPropagation()}
  >
    <div className="flex items-center justify-between border-b border-slate-200 bg-amber-700 px-5 py-4 text-white">
      <div>
        <div className="text-base font-black">Soru Havuzu Doluluk ve Kapasite</div>
        <div className="mt-1 text-[10px] font-semibold text-amber-100">
          Ders ve kazanım bazında kullanılabilir soru stokunu gösterir.
        </div>
      </div>
      <button
        type="button"
        onClick={() => onClose()}
        className="rounded-xl bg-white/10 p-2 hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
    </div>

    <div className="border-b border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-2 md:grid-cols-4">
        <select
          value={bankCapacityGrade}
          onChange={(e) => {
            setBankCapacityGrade(e.target.value);
            setBankCapacityCourseId("");
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700"
        >
          <option value="">Tüm Sınıflar</option>
          {[9, 10, 11, 12].map((grade) => (
            <option key={grade} value={grade}>{grade}. Sınıf</option>
          ))}
        </select>

        <select
          value={bankCapacityCourseId}
          onChange={(e) => setBankCapacityCourseId(e.target.value)}
          disabled={!bankCapacityGrade}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 disabled:opacity-40"
        >
          <option value="">Tüm Dersler</option>
          {(curriculumMoveCatalog.find((entry: any) => String(entry.grade) === String(bankCapacityGrade))?.courses || []).map((course: any) => (
            <option key={course.id} value={course.id}>{course.courseName}</option>
          ))}
        </select>

        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <span className="text-[10px] font-black text-slate-500">Minimum stok</span>
          <input
            type="number"
            min="0"
            max="500"
            value={bankMinimumStock}
            onChange={(e) => setBankMinimumStock(Math.max(0, Number(e.target.value || 0)))}
            className="min-w-0 flex-1 text-right text-[11px] font-black text-slate-800 outline-none"
          />
        </label>

        <button
          type="button"
          disabled={bankCapacityLoading}
          onClick={() => void loadQuestionBankCapacity()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-[10px] font-black text-white hover:bg-amber-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${bankCapacityLoading ? "animate-spin" : ""}`} />
          Analizi Yenile
        </button>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[9px] font-black uppercase text-slate-400">Toplam Soru</div>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {Number(bankCapacity?.totals?.totalQuestions || 0).toLocaleString("tr-TR")}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-[9px] font-black uppercase text-emerald-600">Kullanılmamış</div>
          <div className="mt-1 text-2xl font-black text-emerald-900">
            {Number(bankCapacity?.totals?.unusedQuestions || 0).toLocaleString("tr-TR")}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-[9px] font-black uppercase text-amber-600">Kullanılmış</div>
          <div className="mt-1 text-2xl font-black text-amber-900">
            {Number(bankCapacity?.totals?.usedQuestions || 0).toLocaleString("tr-TR")}
          </div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-[9px] font-black uppercase text-blue-600">Ders</div>
          <div className="mt-1 text-2xl font-black text-blue-900">
            {Number(bankCapacity?.totals?.courseCount || 0)}
          </div>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="text-[9px] font-black uppercase text-violet-600">Kazanım</div>
          <div className="mt-1 text-2xl font-black text-violet-900">
            {Number(bankCapacity?.totals?.outcomeCount || 0)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-[9px] font-black uppercase text-indigo-600">
            Müfredat Kazanımı
          </div>
          <div className="mt-1 text-2xl font-black text-indigo-900">
            {curriculumCoverage.totalCurriculumOutcomes.toLocaleString("tr-TR")}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-[9px] font-black uppercase text-rose-600">
            0 Sorulu Kazanım
          </div>
          <div className="mt-1 text-2xl font-black text-rose-900">
            {curriculumCoverage.emptyOutcomes.length.toLocaleString("tr-TR")}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-[9px] font-black uppercase text-amber-600">
            Düşük Stoklu
          </div>
          <div className="mt-1 text-2xl font-black text-amber-900">
            {curriculumCoverage.lowOutcomes.length.toLocaleString("tr-TR")}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-[9px] font-black uppercase text-emerald-600">
            Yeterli Stoklu
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-900">
            {curriculumCoverage.healthyOutcomes.length.toLocaleString("tr-TR")}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-black text-slate-900">Ders Bazlı Müfredat Kapsaması</div>
            <div className="mt-0.5 text-[9px] font-semibold text-slate-500">
              Her dersin kazanım kapsaması ve soru havuzu doluluk durumu.
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {curriculumCoverage.courses.length === 0 ? (
              <div className="p-8 text-center text-[10px] font-bold text-slate-400">
                Soru verisi bulunamadı.
              </div>
            ) : (
              curriculumCoverage.courses.map((course: any) => {
                const gradeEntry = curriculumMoveCatalog.find((entry: any) => Number(entry.grade) === Number(course.grade));
                const courseMeta = gradeEntry?.courses?.find((item: any) => String(item.id) === String(course.courseId));
                return (
                  <div key={`${course.grade}-${course.courseId}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-black text-slate-800">
                        {course.grade}. Sınıf • {courseMeta?.courseName || course.courseId}
                      </div>
                      <div className="mt-1 text-[9px] font-semibold text-slate-400">
                        {course.totalOutcomes} kazanım • {course.totalQuestions} soru
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[8px] font-black">
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">
                          {course.emptyOutcomes} boş
                        </span>
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                          {course.lowOutcomes} düşük
                        </span>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                          {course.healthyOutcomes} yeterli
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-black text-slate-900">
                        {course.unusedQuestions} kullanılmamış
                      </div>
                      <div className="text-[9px] font-semibold text-slate-400">
                        {course.totalQuestions} toplam soru
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-rose-200">
          <div className="border-b border-rose-100 bg-rose-50 px-4 py-3">
            <div className="text-sm font-black text-rose-900">Eksik ve Düşük Stoklu Kazanımlar</div>
            <div className="mt-0.5 text-[9px] font-semibold text-rose-500">
              Müfredatta olup hiç sorusu olmayan veya kullanılmamış soru stoku minimumun altında kalan kazanımlar.
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {(curriculumCoverage.emptyOutcomes.length + curriculumCoverage.lowOutcomes.length) === 0 ? (
              <div className="p-8 text-center text-[10px] font-bold text-emerald-700">
                Seçili filtrede düşük stoklu kazanım yok.
              </div>
            ) : (
              [...curriculumCoverage.emptyOutcomes, ...curriculumCoverage.lowOutcomes].map((item: any) => (
                <div
                  key={`${item.grade}-${item.courseId}-${item.outcomeId}`}
                  className="block w-full border-b border-rose-100 px-4 py-3 text-left last:border-0"
                >
                  <div className="font-mono text-[10px] font-black text-rose-900">
                    {item.outcomeId}
                  </div>
                  <div className="mt-0.5 text-[9px] font-semibold text-slate-600">
                    {item.outcomeName || "Kazanım"}
                  </div>
                  <div className="mt-1 text-[8px] font-semibold text-slate-400">
                    {item.courseName || item.courseId} • {item.unitName || item.unitId} • {item.topicName || item.topicId}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[9px] font-bold">
                    {item.status === "empty" ? (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800">
                        Hiç soru yok
                      </span>
                    ) : (
                      <>
                        <span className="text-slate-500">{item.totalQuestions} toplam</span>
                        <span className="text-emerald-700">{item.unusedQuestions} kullanılmamış</span>
                      </>
                    )}
                    <span className="text-rose-700">{item.shortage} soru eksik</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  </div>
</div>
  );
}
