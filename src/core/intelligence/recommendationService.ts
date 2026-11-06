import type { IntelligenceContext, HasatRecommendation } from "./types";
import { clamp, round } from "./math";

const subjectRate = (subject: IntelligenceContext["current"]["subjects"][number]) =>
  Number.isFinite(Number(subject.successRate))
    ? clamp(Number(subject.successRate))
    : subject.totalQuestions ? clamp(subject.correct / subject.totalQuestions * 100) : 0;

export const generateRecommendations = ({ current }: IntelligenceContext): HasatRecommendation[] => {
  const ordered = [...current.subjects].sort((a, b) => subjectRate(a) - subjectRate(b));
  const recommendations: HasatRecommendation[] = ordered.slice(0, 3).map((subject, index) => {
    const rate = subjectRate(subject);
    const weeklyMinutes = Math.round(180 - rate * 1.1 + index * 15);
    return {
      id: `subject-${subject.subjectName.toLocaleLowerCase("tr-TR").replace(/\s+/g, "-")}`,
      title: `${subject.subjectName} gelişim planı`,
      detail: rate < 45
        ? "Konu tekrarı, örnek çözüm ve kısa kazanım testi birlikte uygulanmalı."
        : "Yanlış sorular sınıflandırılarak hedefli soru çözümü yapılmalı.",
      subject: subject.subjectName,
      category: "academic",
      priority: Math.min(5, index + 1) as 1|2|3|4|5,
      weeklyMinutes: Math.max(60, weeklyMinutes),
      evidence: [`Başarı oranı %${round(rate)}`, `${subject.wrong} yanlış`, `${subject.empty} boş`],
    };
  });

  if (current.totals.empty > current.totals.wrong) recommendations.push({
    id: "time-management",
    title: "Süre yönetimi çalışması",
    detail: "Haftada en az bir süreli deneme ve son 10 dakika kontrol rutini uygulanmalı.",
    category: "habit",
    priority: 2,
    weeklyMinutes: 90,
    evidence: [`${current.totals.empty} boş cevap`, `${current.totals.wrong} yanlış cevap`],
  });

  if (current.targetAnalysis?.isDefined && Number(current.targetAnalysis.netGap || 0) > 0) recommendations.push({
    id: "target-gap",
    title: "Hedef net farkını kapatma",
    detail: `Öncelikli derslere dağıtılmış kademeli net artışı planlanmalı.`,
    category: "target",
    priority: 1,
    weeklyMinutes: Math.min(420, Math.max(120, Number(current.targetAnalysis.netGap) * 12)),
    evidence: [`Net farkı ${round(Number(current.targetAnalysis.netGap), 1)}`, current.targetAnalysis.summary].filter(Boolean),
  });

  recommendations.push({
    id: "family-checkin",
    title: "Haftalık veli kontrolü",
    detail: "Sonuç yerine çalışma düzeni, tamamlanan görevler ve öğrencinin zorlandığı alanlar konuşulmalı.",
    category: "family",
    priority: 4,
    weeklyMinutes: 20,
    evidence: ["Sürdürülebilir takip için kısa ve düzenli görüşme"],
  });

  return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 7);
};
