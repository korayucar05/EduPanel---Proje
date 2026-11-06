import {
  buildIntelligenceCacheKey,
  getCachedIntelligence,
  setCachedIntelligence,
} from "../cache/intelligenceCache";
import {runPredictionEngine2} from "../prediction";
import {
  estimateInterventionEffects,
  totalInterventionNetEffect,
} from "./interventionEffectModel";
import type {
  DigitalTwinSimulation,
  SimulationEngineInput,
} from "./types";

const ENGINE_VERSION="1.0.0";

export function runDigitalTwinSimulation({
  profile,
  examDate,
  scenario,
}:SimulationEngineInput):DigitalTwinSimulation{
  const cacheKey=buildIntelligenceCacheKey({
    studentId:profile.student.id,
    engine:`digital-twin-${JSON.stringify(scenario)}-${examDate||""}`,
    version:ENGINE_VERSION,
  });

  const cached=getCachedIntelligence<DigitalTwinSimulation>(
    cacheKey,
    profile.metadata.updatedAt,
  );
  if(cached)return cached;

  const baseline=runPredictionEngine2({
    profile,
    horizon:"exam-day",
    examDate,
  });

  const effects=estimateInterventionEffects(scenario);
  const totalEffect=totalInterventionNetEffect(effects);
  const scenarioPrediction=runPredictionEngine2({
    profile,
    horizon:"exam-day",
    examDate,
    assumedWeeklyStudyMinutes:
      scenario.weeklyStudyMinutes+
      scenario.extraLessonMinutes,
    assumedAttendanceRisk:scenario.attendanceRiskDays,
    assumedInterventionEffect:totalEffect,
  });

  const netDifference=Number(
    (scenarioPrediction.predictedNet-baseline.predictedNet).toFixed(2),
  );
  const scoreDifference=
    scenarioPrediction.predictedScore!==undefined&&
    baseline.predictedScore!==undefined
      ?Number((scenarioPrediction.predictedScore-baseline.predictedScore).toFixed(2))
      :undefined;

  const confidence=Math.round(
    (
      baseline.confidence+
      scenarioPrediction.confidence+
      (effects.length
        ?effects.reduce((sum,item)=>sum+item.confidence,0)/effects.length
        :50)
    )/3
  );

  const status=netDifference>1
    ?"positive"
    :netDifference<-.5
      ?"risky"
      :"neutral";

  const headline=status==="positive"
    ?"Senaryo akademik gelişimi destekliyor"
    :status==="risky"
      ?"Senaryo akademik riski artırıyor"
      :"Senaryonun etkisi sınırlı";

  const detail=[
    `Temel tahmin ${baseline.predictedNet.toFixed(1)} net.`,
    `Senaryo tahmini ${scenarioPrediction.predictedNet.toFixed(1)} net.`,
    `Beklenen fark ${netDifference>=0?"+":""}${netDifference.toFixed(1)} net.`,
    "Sonuç, müdahalelerin düzenli uygulanacağı varsayımıyla hesaplanmıştır.",
  ].join(" ");

  const output:DigitalTwinSimulation={
    version:"1.0",
    generatedAt:new Date().toISOString(),
    profileUpdatedAt:profile.metadata.updatedAt,
    baseline,
    scenario:scenarioPrediction,
    scenarioInput:scenario,
    netDifference,
    scoreDifference,
    confidence,
    effects,
    recommendation:{
      status,
      headline,
      detail,
    },
  };

  return setCachedIntelligence({
    key:cacheKey,
    value:output,
    profileUpdatedAt:profile.metadata.updatedAt,
    engineVersion:ENGINE_VERSION,
    ttlMinutes:20,
  });
}

export const defaultInterventionScenario=():SimulationEngineInput["scenario"]=>({
  weeklyStudyMinutes:180,
  extraLessonMinutes:60,
  mockExamPerMonth:4,
  guidanceSessionsPerMonth:1,
  parentMeetingsPerMonth:1,
  attendanceRiskDays:0,
  dailyQuestionTarget:40,
});
