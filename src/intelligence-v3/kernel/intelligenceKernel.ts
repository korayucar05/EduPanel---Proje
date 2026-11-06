import {getKernelCache,setKernelCache} from "./cacheManager";
import {intelligenceEventBus} from "./eventBus";
import {buildKernelRecommendations} from "./recommendationEngine";
import type {
  IntelligenceKernelInput,
  IntelligenceKernelResult,
} from "./types";

export function runIntelligenceKernel(
  input:IntelligenceKernelInput,
):IntelligenceKernelResult{
  const cached=getKernelCache(input.cacheKey);
  if(cached)return cached;

  const started=performance.now();
  intelligenceEventBus.clear();
  intelligenceEventBus.emit(
    "kernel:start",
    "e-Nstitü Intelligence Kernel başlatıldı",
    `${input.brain.totalStudents} öğrenci için ortak zekâ akışı çalıştırılıyor.`,
  );

  intelligenceEventBus.emit(
    "brain:completed",
    "Brain verileri hazır",
    `${input.brain.criticalCount} kritik ve ${input.brain.highCount} yüksek öncelikli öğrenci bulundu.`,
  );

  if(input.timeline){
    intelligenceEventBus.emit(
      "timeline:completed",
      "Brain Timeline hazır",
      `${input.timeline.sufficientHistoryCount} öğrencide yeterli sınav geçmişi değerlendirildi.`,
    );
  }

  intelligenceEventBus.emit(
    "warning:completed",
    "Erken uyarı analizi tamamlandı",
    `${input.warning.projectedCritical} öğrenci kısa vadede kritik risk gösterebilir.`,
  );

  intelligenceEventBus.emit(
    "school-twin:completed",
    "Okul dijital ikizi güncellendi",
    `Beklenen toplam net etkisi +${input.schoolTwin.scenarioImpact.expectedTotalNetGain.toFixed(1)}.`,
  );

  intelligenceEventBus.emit(
    "university:completed",
    "Üniversite simülasyonu tamamlandı",
    `Tahmini yerleşme artışı +${input.university.placementGain}.`,
  );

  intelligenceEventBus.emit(
    "executive:completed",
    "Executive Center güncellendi",
    input.executive.summary.headline,
  );

  const recommendations=buildKernelRecommendations(input);
  intelligenceEventBus.emit(
    "recommendations:completed",
    "Merkezi öneriler üretildi",
    `${recommendations.length} öncelikli öneri sıralandı.`,
  );

  const critical=input.warning.projectedCritical;
  const total=Math.max(1,input.brain.totalStudents);
  const status=critical/total>=.18
    ?"critical"
    :critical/total>=.08||input.warning.worseningStudentCount/total>=.2
      ?"attention"
      :"stable";

  const processingMs=Math.round(performance.now()-started);
  intelligenceEventBus.emit(
    "kernel:completed",
    "e-Nstitü Intelligence Kernel tamamlandı",
    `${processingMs} ms içinde ortak karar çıktısı üretildi.`,
    undefined,
    processingMs,
  );

  const result:IntelligenceKernelResult={
    version:"1.0",
    generatedAt:new Date().toISOString(),
    cacheKey:input.cacheKey,
    brain:input.brain,
    timeline:input.timeline,
    warning:input.warning,
    schoolTwin:input.schoolTwin,
    university:input.university,
    executive:input.executive,
    recommendations,
    events:intelligenceEventBus.snapshot(),
    summary:{
      status,
      headline:status==="critical"
        ?"Bugün kritik yönetim müdahaleleri gerekiyor"
        :status==="attention"
          ?"Yakın izleme ve hedefli müdahale gerekiyor"
          :"Okul akademik görünümü dengeli",
      detail:`${input.brain.totalStudents} öğrenci tek çekirdekte değerlendirildi. ${critical} yaklaşan kritik risk, +${input.schoolTwin.scenarioImpact.expectedTotalNetGain.toFixed(1)} beklenen net etkisi ve +${input.university.placementGain} tahmini yerleşme artışı hesaplandı.`,
    },
    metrics:{
      totalStudents:input.brain.totalStudents,
      brainIndex:input.executive.brainIndex,
      criticalStudents:input.brain.criticalCount,
      projectedCriticalStudents:input.warning.projectedCritical,
      expectedNetGain:input.schoolTwin.scenarioImpact.expectedTotalNetGain,
      expectedPlacementGain:input.university.placementGain,
      recommendationCount:recommendations.length,
      processingMs,
    },
  };

  return setKernelCache(input.cacheKey,result);
}
