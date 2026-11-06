import React from "react";
import QuestionWriterView from "./examPrepare/QuestionWriterView";
import OCRAutoSplitPanel from "./questionCropper/OCRAutoSplitPanel";
import DocumentQuestionDetector from "./soru-hazirla/DocumentQuestionDetector";

export default function QuestionCropperModule() {
  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <QuestionWriterView />
        <DocumentQuestionDetector />
        <OCRAutoSplitPanel />
      </div>
    </div>
  );
}
