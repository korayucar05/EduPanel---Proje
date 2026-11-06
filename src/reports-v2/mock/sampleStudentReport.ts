import type { StudentReportV2Data } from "../types";

export const sampleStudentReport: StudentReportV2Data = {
  reportTitle: "Bireysel Öğrenci Karnesi",
  examName: "Ders Denemesi Sınavı - 5",
  examDate: "12 Mayıs 2026",
  reportDate: "13 Mayıs 2026",
  reportCode: "e-Nstitü-2026-0001",
  schoolName: "Ordu Lisesi",
  student: {
    name: "Ahmet YILMAZ",
    number: "202400123",
    classroom: "12",
    branch: "A",
  },
  totals: {
    correct: 125,
    wrong: 21,
    empty: 8,
    net: 119.75,
    score: 482.75,
    successRate: 82,
    classroomAverageNet: 96.4,
  },
  rankings: [
    { label: "Kurum Sırası", rank: 12, participants: 312 },
    { label: "Şube Sırası", rank: 3, participants: 26 },
    { label: "İlçe Sırası", rank: 28, participants: 812 },
    { label: "Genel Sıra", rank: 1248, participants: 48531 },
  ],
  subjects: [
    { subjectName: "Türk Dili ve Edebiyatı", shortName: "Edebiyat", correct: 28, wrong: 4, empty: 2, net: 27, totalQuestions: 34 },
    { subjectName: "Matematik", correct: 24, wrong: 5, empty: 1, net: 22.75, totalQuestions: 30 },
    { subjectName: "Fizik", correct: 20, wrong: 4, empty: 2, net: 19, totalQuestions: 26 },
    { subjectName: "Tarih", correct: 18, wrong: 5, empty: 3, net: 16.75, totalQuestions: 26 },
    { subjectName: "Din Kültürü", shortName: "Din", correct: 18, wrong: 1, empty: 1, net: 17.75, totalQuestions: 20 },
    { subjectName: "İngilizce", correct: 17, wrong: 2, empty: 1, net: 16.5, totalQuestions: 20 },
  ],
  studySuggestions: [
    { subject: "Edebiyat", suggestion: "Paragraf ve anlam bilgisi sorularına günlük 20 dakika ayır." },
    { subject: "Matematik", suggestion: "Problem çözümü ve yeni nesil soru pratiğine odaklan." },
    { subject: "Fizik", suggestion: "Konu tekrarını kısa deney videoları ve soru çözümüyle destekle." },
    { subject: "Tarih", suggestion: "Kronolojik sıralama ve kavram kartlarıyla tekrar yap." },
    { subject: "İngilizce", suggestion: "Kelime tekrarı ve kısa okuma çalışmaları planla." },
  ],
};
