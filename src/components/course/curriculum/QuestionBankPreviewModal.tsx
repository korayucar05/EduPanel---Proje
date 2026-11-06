import React from "react";
import { X } from "lucide-react";

type QuestionBankPreviewModalProps = {
  preview: any;
  onClose: () => void;
};

export default function QuestionBankPreviewModal({
  preview,
  onClose,
}: QuestionBankPreviewModalProps) {
  if (!preview) return null;

  return (
    <div
      className="fixed inset-0 z-[246] flex items-center justify-center bg-slate-950/90 p-6"
      onClick={onClose}
    >
      <div
        className="relative max-h-full max-w-6xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 rounded-full bg-white p-2 text-slate-900 shadow-xl"
          aria-label="Soru önizlemesini kapat"
        >
          <X className="h-5 w-5" />
        </button>

        <img
          src={preview.imageUrl}
          alt={preview.fileName || preview.questionCode}
          className="max-h-[82vh] max-w-[90vw] rounded-xl bg-white object-contain shadow-2xl"
        />

        <div className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-white backdrop-blur">
          <div className="font-mono text-[12px] font-black">
            {preview.questionCode}
          </div>

          <div className="mt-1 text-[10px] font-semibold text-slate-300">
            {preview.outcomeId} • Cevap {preview.answer}
            {" • "}
            {Number(preview.useCount || 0) > 0
              ? `${preview.useCount} kez kullanıldı`
              : "Henüz kullanılmadı"}

            {preview.lastUsedAt
              ? ` • Son kullanım ${new Date(
                  preview.lastUsedAt,
                ).toLocaleDateString("tr-TR")}`
              : ""}
          </div>
        </div>
      </div>
    </div>
  );
}