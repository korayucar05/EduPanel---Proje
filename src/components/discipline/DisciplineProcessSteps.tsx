import React from "react";
import { Check } from "lucide-react";
import type { BehaviorRecord } from "../behavior/behaviorTypes";

interface DisciplineProcessStepsProps {
  mode: "Ön İnceleme" | "Disiplin Süreci";
  record: BehaviorRecord;
  onToggleStep: (recordId: string, step: string) => void;
  onGuidance: (record: BehaviorRecord) => void;
  onCallLetter: (record: BehaviorRecord, disciplineCall: boolean) => void;
  onWrittenStatements: (record: BehaviorRecord) => void;
  onMoveToDiscipline: (record: BehaviorRecord) => void;
  onPrintReferral: (record: BehaviorRecord) => void;
  onNotifications: (record: BehaviorRecord) => void;
  onDecision: (record: BehaviorRecord) => void;
}

export function DisciplineProcessSteps({
  mode,
  record,
  onToggleStep,
  onGuidance,
  onCallLetter,
  onWrittenStatements,
  onMoveToDiscipline,
  onPrintReferral,
  onNotifications,
  onDecision,
}: DisciplineProcessStepsProps) {
  const steps = mode === "Ön İnceleme"
    ? ["Rehberlik Servisi Raporu", "Çağrı Yazısı", "Yazılı İfadeler", "Disiplin Kuruluna Sevk"]
    : ["Disipline Sevk Dilekçesi", "Disiplin Kurulu Çağrı Yazısı", "Tebliğler", "Karar"];

  const runStep = (step: string) => {
    if (step === "Rehberlik Servisi Raporu") onGuidance(record);
    else if (step === "Çağrı Yazısı") onCallLetter(record, false);
    else if (step === "Yazılı İfadeler") onWrittenStatements(record);
    else if (step === "Disiplin Kuruluna Sevk") onMoveToDiscipline(record);
    else if (step === "Disipline Sevk Dilekçesi") onPrintReferral(record);
    else if (step === "Disiplin Kurulu Çağrı Yazısı") onCallLetter(record, true);
    else if (step === "Tebliğler") onNotifications(record);
    else if (step === "Karar") onDecision(record);
  };

  return (
    <div className="pt-2 border-t border-slate-200/60 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 w-full">
        {steps.map((step) => {
          const isCompleted = !!record.completedSteps?.[step];
          const isSevk = step === "Disiplin Kuruluna Sevk";
          return (
            <button
              key={step}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                runStep(step);
              }}
              onDoubleClick={mode === "Ön İnceleme" ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                runStep(step);
              } : undefined}
              className={`relative flex items-center ${isSevk ? "justify-center px-4" : "justify-between pl-3 pr-1.5"} p-1.5 rounded-lg border${mode === "Ön İnceleme" ? "-2" : ""} text-left transition-all duration-200 select-none ${
                isSevk
                  ? (isCompleted ? "bg-red-700 border-red-800 text-white shadow-sm" : "bg-red-600 border-red-700 text-white hover:bg-red-700 hover:border-red-800 cursor-pointer")
                  : (isCompleted ? "bg-emerald-600 border-emerald-700 text-white shadow-sm" : mode === "Ön İnceleme" ? "bg-white border-emerald-500 text-slate-700 hover:border-emerald-600 hover:bg-emerald-50/40 cursor-pointer" : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 cursor-pointer")
              }`}
            >
              <span className={`text-[12px] font-bold leading-tight select-none ${isSevk ? "" : "pr-2"}`}>{step}</span>
              {!isSevk && (
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleStep(record.id, step);
                  }}
                  className={`w-7 h-7 rounded-md border flex items-center justify-center transition-all shrink-0 ${isCompleted ? "bg-yellow-400 border-yellow-500 text-yellow-950 cursor-pointer" : "bg-yellow-100 border-yellow-300 text-transparent group-hover:text-yellow-500/40 cursor-pointer"}`}
                  title={isCompleted ? "İptal et" : "Tamamlandı olarak işaretle"}
                >
                  <Check className={`w-4 h-4 stroke-[3px] ${isCompleted ? "text-yellow-950" : "text-yellow-500"}`} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
