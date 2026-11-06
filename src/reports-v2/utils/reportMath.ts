import type { StudentReportV2Data, SubjectPerformance } from "../types";

export const subjectSuccessRate = (subject: SubjectPerformance) => {
  if (Number.isFinite(subject.successRate)) return Number(subject.successRate);
  return subject.totalQuestions > 0
    ? Math.max(0, Math.min(100, (subject.correct / subject.totalQuestions) * 100))
    : 0;
};

export const strongestSubject = (report: StudentReportV2Data) =>
  [...report.subjects].sort((a, b) => subjectSuccessRate(b) - subjectSuccessRate(a))[0];

export const supportSubject = (report: StudentReportV2Data) =>
  [...report.subjects].sort((a, b) => subjectSuccessRate(a) - subjectSuccessRate(b))[0];

export const defaultAcademicComments = (report: StudentReportV2Data) => {
  const strongest = strongestSubject(report);
  const support = supportSubject(report);
  const comments: string[] = [];

  if (strongest) {
    comments.push(`${strongest.subjectName} dersinde güçlü bir performans sergilenmiştir.`);
  }
  if (support && strongest?.subjectName !== support.subjectName) {
    comments.push(`${support.subjectName} dersinde düzenli konu tekrarı ve soru çözümü önerilir.`);
  }
  if (report.totals.successRate >= 80) {
    comments.push("Genel başarı düzeyi oldukça güçlüdür; mevcut çalışma düzeni korunmalıdır.");
  } else if (report.totals.successRate >= 60) {
    comments.push("Genel başarı düzeyi iyi görünmektedir; zayıf alanlara odaklanmak hızlı gelişim sağlayacaktır.");
  } else {
    comments.push("Kısa, düzenli ve ölçülebilir çalışma hedefleriyle gelişim desteklenmelidir.");
  }
  return comments;
};
