import React from "react";
import { RotateCcw } from "lucide-react";

type Props = {
  deletedQuestions: any[];
  restoringQuestionId: string | null;
  restoreDeletedQuestion: (questionId: string) => void | Promise<void>;
};

export default function QuestionBankTrashSection({
  deletedQuestions,
  restoringQuestionId,
  restoreDeletedQuestion,
}: Props) {
  return (
<div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
    <div>
      <div className="text-sm font-black text-slate-900">Çöp Kutusu</div>
      <div className="mt-0.5 text-[9px] font-semibold text-slate-500">
        Silinen soru dosyaları geri alınabilir.
      </div>
    </div>
    <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm">
      {deletedQuestions.length} kayıt
    </span>
  </div>

  <div className="max-h-72 overflow-y-auto">
    {deletedQuestions.length === 0 ? (
      <div className="p-8 text-center text-[11px] font-bold text-slate-400">
        Çöp kutusunda soru bulunmuyor.
      </div>
    ) : (
      deletedQuestions.map((question: any) => (
        <div
          key={question.id}
          className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
        >
          <div className="min-w-0">
            <div className="truncate font-mono text-[11px] font-black text-slate-800">
              {question.questionCode || question.fileName || question.id}
            </div>
            <div className="mt-1 truncate text-[9px] font-semibold text-slate-400">
              {question.outcomeId || "Kazanım yok"}
              {question.deletedAt
                ? ` • ${new Date(question.deletedAt).toLocaleString("tr-TR")}`
                : ""}
            </div>
          </div>
          <button
            type="button"
            disabled={restoringQuestionId === question.id}
            onClick={() => void restoreDeletedQuestion(question.id)}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 ${
                restoringQuestionId === question.id ? "animate-spin" : ""
              }`}
            />
            Geri Al
          </button>
        </div>
      ))
    )}
  </div>
</div>
  );
}
