import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Image as ImageIcon,
  Save,
} from "lucide-react";

type QuestionBankViewerModalProps = {
  questionViewer: any;
  viewerContext: any;
  moveDraft: any;
  viewerZoom: number;
  selectedMoveCourse: any;
  expandedMoveUnitId: string;
  questionCountForTarget: (courseId: unknown, unitId: unknown, topicId: unknown, outcomeId?: unknown) => number;

  setViewerZoom: React.Dispatch<React.SetStateAction<number>>;
  setQuestionViewer: React.Dispatch<React.SetStateAction<any>>;
  setMoveDraft: React.Dispatch<React.SetStateAction<any>>;
  setExpandedMoveUnitId: React.Dispatch<React.SetStateAction<string>>;

  navigateViewer: (direction: number) => void;
  saveQuestionMove: () => void | Promise<void>;
};

export default function QuestionBankViewerModal({
  questionViewer,
  viewerContext,
  moveDraft,
  viewerZoom,
  selectedMoveCourse,
  expandedMoveUnitId,
  questionCountForTarget,
  setViewerZoom,
  setQuestionViewer,
  setMoveDraft,
  setExpandedMoveUnitId,
  navigateViewer,
  saveQuestionMove,
}: QuestionBankViewerModalProps) {
  if (!questionViewer || !viewerContext?.question || !moveDraft) {
    return null;
  }

  return (
<div
  className="fixed inset-0 z-[250] flex bg-slate-900/90 p-4 sm:p-8 backdrop-blur-sm"
  onMouseDown={() => setQuestionViewer(null)}
>
  <div
    className="flex h-full w-full max-w-[1600px] mx-auto overflow-hidden rounded-3xl bg-white shadow-2xl"
    onMouseDown={(event) => event.stopPropagation()}
  >
  <div className="flex min-w-0 flex-1 flex-col bg-slate-100">
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 text-slate-800">
      <div className="min-w-0">
        <div className="truncate font-mono text-[12px] font-black">
          {viewerContext.question.fileName || viewerContext.question.code}
        </div>
        <div className="mt-0.5 text-[10px] font-bold text-slate-400">
          {Math.max(0, viewerContext.index) + 1} / {viewerContext.questions.length}
          {" • "}Cevap {viewerContext.question.answer || "—"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewerZoom((value) => Math.max(0.5, value - 0.25))}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black hover:bg-slate-200"
        >−</button>
        <button
          type="button"
          onClick={() => setViewerZoom(1)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-black hover:bg-slate-200"
        >%100</button>
        <button
          type="button"
          onClick={() => setViewerZoom((value) => Math.min(3, value + 0.25))}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black hover:bg-slate-200"
        >+</button>
      </div>
    </div>

    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-2">
      <button
        type="button"
        onClick={() => navigateViewer(-1)}
        className="absolute left-5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-4 text-slate-800 shadow-xl backdrop-blur hover:bg-white"
        title="Önceki soru (←)"
      >
        <ArrowLeft className="h-7 w-7" />
      </button>

      {(viewerContext.question.imageUrl || viewerContext.question.imageDataUrl) ? (
        <img
          src={viewerContext.question.imageUrl || viewerContext.question.imageDataUrl}
          alt={viewerContext.question.fileName || viewerContext.question.code}
          style={{ transform: `scale(${viewerZoom})`, transformOrigin: "center center" }}
          className="h-full w-full max-h-full max-w-full rounded-xl bg-white object-contain shadow-2xl transition-transform"
        />
      ) : (
        <div className="flex h-96 w-2/3 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
          <ImageIcon className="h-16 w-16" />
        </div>
      )}

      <button
        type="button"
        onClick={() => navigateViewer(1)}
        className="absolute right-5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-4 text-slate-800 shadow-xl backdrop-blur hover:bg-white"
        title="Sonraki soru (→)"
      >
        <ArrowRight className="h-7 w-7" />
      </button>
    </div>
  </div>

  <aside className="flex w-[400px] shrink-0 flex-col border-l border-slate-200 bg-white">
    <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
      <div className="text-lg font-extrabold text-slate-800">Soru Bilgileri</div>
      <div className="mt-1 text-xs font-medium text-slate-500">Görsel ve müfredat eşleştirmesi</div>
      <div className="mt-3 truncate text-xs font-black text-purple-900">
        {questionViewer.courseName || selectedMoveCourse?.courseName || "Ders"}
      </div>
    </div>

    <div className="flex-1 overflow-y-auto p-5">
      <div className="space-y-5">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Ünite • Konu • Kazanım
            </div>
            <div className="text-[9px] font-bold text-slate-400">
              Üniteye tıklayın
            </div>
          </div>

          <div className="space-y-2">
            {(selectedMoveCourse?.curriculum?.units || []).map((unit: any) => {
              const unitOpen = String(expandedMoveUnitId) === String(unit.id);
              const containsCurrent = String(moveDraft.unitId) === String(unit.id);
              return (
                <div
                  key={unit.id}
                  className={`overflow-hidden rounded-xl border ${
                    containsCurrent
                      ? "border-red-200 bg-red-50/30"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMoveUnitId((current) =>
                        String(current) === String(unit.id) ? "" : String(unit.id),
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="min-w-0 text-[11px] font-black text-red-900">
                      {unit.id} • {unit.name}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-red-800 transition-transform ${
                        unitOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {unitOpen && (
                    <div className="border-t border-red-100 bg-white px-3 py-2.5">
                      {(unit.topics || []).length === 0 ? (
                        <div className="py-2 text-[10px] font-semibold text-slate-400">
                          Bu ünitede konu bulunmuyor.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(unit.topics || []).map((topic: any) => {
                            const topicSelected =
                              String(moveDraft.unitId) === String(unit.id) &&
                              String(moveDraft.topicId) === String(topic.id);
                            const directTopicCount = questionCountForTarget(
                              selectedMoveCourse?.id,
                              unit.id,
                              topic.id,
                              "",
                            );
                            const outcomeTotal = (topic.outcomes || []).reduce(
                              (sum: number, outcome: any) =>
                                sum + questionCountForTarget(
                                  selectedMoveCourse?.id,
                                  unit.id,
                                  topic.id,
                                  outcome.id,
                                ),
                              0,
                            );
                            const topicTotal = directTopicCount + outcomeTotal;
                            return (
                              <div key={topic.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMoveDraft((prev: any) => ({
                                      ...prev,
                                      unitId: unit.id,
                                      topicId: topic.id,
                                      outcomeId: "",
                                    }));
                                  }}
                                  className={`w-full rounded-lg px-2 py-1.5 text-left text-[10px] text-black transition hover:bg-slate-100 ${
                                    topicSelected && !moveDraft.outcomeId
                                      ? "bg-amber-50 font-black ring-1 ring-amber-200"
                                      : topicSelected
                                        ? "font-bold"
                                        : "font-semibold"
                                  }`}
                                >
                                  {topic.id} • {topic.name} <span className="font-black text-black">({topicTotal})</span>
                                </button>

                                <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-2.5">
                                  {(topic.outcomes || []).map((outcome: any) => {
                                    const selected =
                                      String(moveDraft.unitId) === String(unit.id) &&
                                      String(moveDraft.topicId) === String(topic.id) &&
                                      String(moveDraft.outcomeId) === String(outcome.id);
                                    const outcomeCount = questionCountForTarget(
                                      selectedMoveCourse?.id,
                                      unit.id,
                                      topic.id,
                                      outcome.id,
                                    );
                                    return (
                                      <button
                                        key={outcome.id}
                                        type="button"
                                        onClick={() =>
                                          setMoveDraft((prev: any) => ({
                                            ...prev,
                                            unitId: unit.id,
                                            topicId: topic.id,
                                            outcomeId: outcome.id,
                                          }))
                                        }
                                        className={`block w-full rounded-lg px-2 py-1.5 text-left text-[10px] leading-4 text-black transition ${
                                          selected
                                            ? "bg-amber-50 font-black ring-1 ring-amber-200"
                                            : "font-normal hover:bg-slate-50"
                                        }`}
                                      >
                                        <span className={selected ? "font-black text-black" : "text-black"}>
                                          {outcome.id} • {outcome.name || outcome.text} <span className="font-black text-black">({outcomeCount})</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
            Doğru Cevap
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {["A", "B", "C", "D", "E"].map((answer) => (
              <button
                key={answer}
                type="button"
                onClick={() => setMoveDraft((prev: any) => ({ ...prev, answer }))}
                className={`h-9 rounded-xl border text-[11px] font-black transition ${
                  moveDraft.answer === answer
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                }`}
              >
                {answer}
              </button>
            ))}
          </div>
        </section>

      <div className="rounded-2xl border border-purple-100 bg-purple-50 p-3">
        <div className="text-[9px] font-black uppercase tracking-wide text-purple-500">Yeni kod</div>
        <div className="mt-1 font-mono text-[11px] font-black text-purple-950">
          {moveDraft.outcomeId || moveDraft.topicId || "Konu/Kazanım seçiniz"}_XXX_{moveDraft.answer}
        </div>
        <div className="mt-1 text-[9px] font-semibold leading-4 text-purple-600">
          Hedef klasörün sıradaki kalıcı sıra numarası otomatik verilir.
        </div>
      </div>
      </div>
    </div>

    <div className="border-t border-slate-200 bg-slate-50 p-4">
      <button
        type="button"
        onClick={saveQuestionMove}
        disabled={!moveDraft.courseId || !moveDraft.unitId || !moveDraft.topicId}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-purple-950 text-xs font-black text-white shadow-lg transition hover:bg-purple-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Save className="h-4 w-4" /> Yeni Yerine Taşı ve Kaydet
      </button>
      <div className="mt-2 text-center text-[9px] font-bold text-slate-400">
        Klavye: ← önceki • → sonraki • Esc kapat
      </div>
    </div>
  </aside>
  </div>
</div>
  );
}
