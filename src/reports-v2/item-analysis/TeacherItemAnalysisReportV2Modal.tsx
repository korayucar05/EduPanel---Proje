import React, { useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { ItemAnalysisReportV2 } from "./ItemAnalysisReportV2";
import { exportItemAnalysisReportV2Pdf } from "./exportItemAnalysisReportV2Pdf";
import type { ItemAnalysisReportData, ItemRow } from "./buildItemAnalysisReportData";

type TeacherItem = {
  questionNumber: number;
  correctAnswer: string;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;
  totalCount: number;
  correctRate: number;
  choiceCounts: Record<string, number>;
};

type TeacherSubject = {
  subjectName: string;
  assignedParticipantCount: number;
  items: TeacherItem[];
};

const round = (value: number) => Number(value.toFixed(1));

function buildTeacherReport(exam: { examName?: string; examDate?: string }, subject: TeacherSubject): ItemAnalysisReportData {
  const items: ItemRow[] = (subject.items || []).map((item) => {
    const totalResponses = Math.max(0, Number(item.totalCount || 0));
    const correctRate = Number.isFinite(Number(item.correctRate))
      ? Number(item.correctRate)
      : (totalResponses ? Number(item.correctCount || 0) / totalResponses * 100 : 0);
    const emptyRate = totalResponses ? Number(item.emptyCount || 0) / totalResponses * 100 : 0;
    const difficultyLabel = correctRate >= 80 ? "Çok kolay" : correctRate >= 65 ? "Kolay" : correctRate >= 45 ? "Orta" : correctRate >= 25 ? "Zor" : "Çok zor";
    return {
      questionNumber: Number(item.questionNumber || 0),
      subjectName: subject.subjectName,
      correctAnswer: String(item.correctAnswer || ""),
      totalResponses,
      correctCount: Number(item.correctCount || 0),
      wrongCount: Number(item.wrongCount || 0),
      emptyCount: Number(item.emptyCount || 0),
      correctRate: round(correctRate),
      emptyRate: round(emptyRate),
      difficultyLabel,
      qualityLevel: correctRate < 25 || emptyRate >= 30 ? "risk" : correctRate < 45 || correctRate > 90 ? "warning" : "good",
      optionStats: ["A", "B", "C", "D", "E"].map((option) => {
        const count = Number(item.choiceCounts?.[option] || 0);
        return { option, count, rate: totalResponses ? round(count / totalResponses * 100) : 0 };
      }),
    };
  }).sort((a, b) => a.questionNumber - b.questionNumber);
  const hardestItems = [...items].sort((a, b) => a.correctRate - b.correctRate).slice(0, 10);
  const easiestItems = [...items].sort((a, b) => b.correctRate - a.correctRate).slice(0, 10);
  const averageCorrectRate = items.length ? items.reduce((sum, item) => sum + item.correctRate, 0) / items.length : 0;
  const difficultQuestionCount = items.filter((item) => item.correctRate < 45).length;
  const easyQuestionCount = items.filter((item) => item.correctRate >= 80).length;
  const highEmptyQuestionCount = items.filter((item) => item.emptyRate >= 20).length;

  return {
    examName: String(exam.examName || "Sınav"),
    schoolName: "e-Nstitü",
    generatedAt: new Date().toLocaleString("tr-TR"),
    subjectNames: [subject.subjectName],
    selectedSubject: subject.subjectName,
    summary: { totalQuestions: items.length, studentCount: Number(subject.assignedParticipantCount || 0), averageCorrectRate: round(averageCorrectRate), difficultQuestionCount, easyQuestionCount, highEmptyQuestionCount },
    items,
    hardestItems,
    easiestItems,
    attentionItems: [
      hardestItems[0] ? { level: hardestItems[0].correctRate < 25 ? "risk" as const : "warning" as const, title: `${hardestItems[0].questionNumber}. soru öncelikli`, detail: `Doğru cevaplanma oranı %${hardestItems[0].correctRate.toFixed(1)} düzeyindedir.` } : null,
      { level: averageCorrectRate >= 65 ? "success" as const : "warning" as const, title: averageCorrectRate >= 65 ? "Genel madde başarısı güçlü" : "Genel madde başarısı geliştirilmeli", detail: `Öğretmenin atanmış sınıflarında ortalama doğru oranı %${averageCorrectRate.toFixed(1)}.` },
      highEmptyQuestionCount ? { level: "warning" as const, title: `${highEmptyQuestionCount} soruda yüksek boş oranı`, detail: "Süre yönetimi, soru kökü ve konu eksikliği birlikte incelenmelidir." } : null,
    ].filter(Boolean) as ItemAnalysisReportData["attentionItems"],
    actionPlan: [
      { priority: 1, title: "En zor soruları yeniden ele al", detail: hardestItems.length ? `${hardestItems.slice(0, 5).map((item) => item.questionNumber).join(", ")} numaralı sorular için kısa tekrar planlayın.` : "Analiz edilebilir soru verisi bulunamadı.", owner: "Ders öğretmeni" },
      { priority: 2, title: "Çeldirici dağılımlarını incele", detail: "Yanlış seçeneklerde yoğunlaşan maddelerde kavram yanılgılarını belirleyin.", owner: "Ders öğretmeni" },
      { priority: 3, title: "Yüksek boş oranını azalt", detail: `${highEmptyQuestionCount} soruda boş bırakma oranı %20 ve üzerindedir.`, owner: "Ders öğretmeni" },
    ],
    executiveSummary: `${subject.subjectName} dersinde öğretmenin atanmış sınıflarına ait ${items.length} soru analiz edildi. Ortalama doğru cevaplanma oranı %${averageCorrectRate.toFixed(1)}; zor/çok zor soru sayısı ${difficultQuestionCount}.`,
  };
}

export function TeacherItemAnalysisReportV2Modal({ exam, subjects, initialSubject, onClose }: { exam: { examName?: string; examDate?: string }; subjects: TeacherSubject[]; initialSubject?: string; onClose: () => void }) {
  const availableSubjects = subjects.filter((subject) => subject.subjectName);
  const [selectedSubject, setSelectedSubject] = useState(() => availableSubjects.find((subject) => subject.subjectName === initialSubject)?.subjectName || availableSubjects[0]?.subjectName || "");
  const [exporting, setExporting] = useState(false);
  const subject = availableSubjects.find((item) => item.subjectName === selectedSubject) || availableSubjects[0];
  const report = useMemo(() => buildTeacherReport(exam, subject || { subjectName: "Ders", assignedParticipantCount: 0, items: [] }), [exam, subject]);

  const exportPdf = async () => {
    setExporting(true);
    try { await exportItemAnalysisReportV2Pdf(report); }
    finally { setExporting(false); }
  };

  return <div className="fixed inset-0 z-[180] flex flex-col bg-slate-950/70 backdrop-blur-sm">
    <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900 px-5 py-3 text-white">
      <div><h3 className="font-black">Madde Analizi V2 Premium</h3><p className="mt-1 text-[11px] text-slate-300">Yalnızca size atanmış ders ve sınıfların soru analizi</p></div>
      <div className="flex items-center gap-2">
        <select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)} className="rounded-xl border border-white/20 bg-white px-3 py-2 text-xs font-bold text-slate-900">{availableSubjects.map((item) => <option key={item.subjectName}>{item.subjectName}</option>)}</select>
        <button type="button" onClick={exportPdf} disabled={exporting} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black hover:bg-violet-700 disabled:bg-slate-500"><Download className="h-4 w-4" />{exporting ? "PDF hazırlanıyor..." : "PDF indir"}</button>
        <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-white/10" aria-label="Kapat"><X className="h-5 w-5" /></button>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto"><ItemAnalysisReportV2 report={report} /></div>
  </div>;
}
