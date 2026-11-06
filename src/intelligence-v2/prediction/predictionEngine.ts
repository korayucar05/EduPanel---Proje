import {
  buildIntelligenceCacheKey,
  getCachedIntelligence,
  setCachedIntelligence,
} from "../cache/intelligenceCache";
import type {AcademicDigitalProfile} from "../core/types";
import {clamp,linearSlope,standardDeviation} from "../shared/statistics";
import {buildPredictionFactors} from "./buildPredictionFactors";
import {
  confidenceFromHistory,
  horizonDays,
  predictSeriesValue,
  trendLabel,
} from "./predictionMath";
import type {
  AcademicPrediction,
  PredictionEngineInput,
  SubjectPrediction,
} from "./types";

const ENGINE_VERSION="2.0.0";

const subjectPredictions=({
  profile,
  days,
  assumedWeeklyStudyMinutes,
  assumedAttendanceRisk,
  assumedInterventionEffect,
}:{
  profile:AcademicDigitalProfile;
  days:number;
  assumedWeeklyStudyMinutes:number;
  assumedAttendanceRisk:number;
  assumedInterventionEffect:number;
}):SubjectPrediction[]=>{
  const subjects=new Set(
    profile.examHistory.flatMap(exam=>exam.subjects.map(subject=>subject.subject)),
  );

  return [...subjects].map(subject=>{
    const values=profile.examHistory
      .map(exam=>exam.subjects.find(item=>item.subject===subject)?.net)
      .filter((value):value is number=>Number.isFinite(value));
    const currentNet=values.at(-1)||0;
    const predictedNet=predictSeriesValue({
      values,
      days,
      assumedWeeklyStudyMinutes:assumedWeeklyStudyMinutes/Math.max(1,subjects.size),
      assumedAttendanceRisk,
      assumedInterventionEffect:assumedInterventionEffect/Math.max(1,subjects.size),
    });
    const confidence=confidenceFromHistory(values);
    const uncertainty=Math.max(.5,(100-confidence)/100*Math.max(2,Math.abs(predictedNet)*.18));
    const slope=linearSlope(values);
    const trend:SubjectPrediction["trend"]=values.length<2
      ?"insufficient"
      :slope>.35
        ?"up"
        :slope<-.35
          ?"down"
          :"stable";
    return{
      subject,
      currentNet:Number(currentNet.toFixed(2)),
      predictedNet:Number(predictedNet.toFixed(2)),
      lowerNet:Number(Math.max(0,predictedNet-uncertainty).toFixed(2)),
      upperNet:Number((predictedNet+uncertainty).toFixed(2)),
      trend,
      confidence:Number(confidence.toFixed(0)),
    };
  }).sort((a,b)=>b.predictedNet-a.predictedNet);
};

export function runPredictionEngine2(
  input:PredictionEngineInput,
):AcademicPrediction{
  const {
    profile,
    horizon,
    examDate,
    assumedWeeklyStudyMinutes=0,
    assumedAttendanceRisk=0,
    assumedInterventionEffect=0,
  }=input;

  const days=horizonDays(horizon,examDate);
  const cacheKey=buildIntelligenceCacheKey({
    studentId:profile.student.id,
    engine:`prediction-${horizon}-${days}-${assumedWeeklyStudyMinutes}-${assumedAttendanceRisk}-${assumedInterventionEffect}`,
    version:ENGINE_VERSION,
  });

  const cached=getCachedIntelligence<AcademicPrediction>(
    cacheKey,
    profile.metadata.updatedAt,
  );
  if(cached)return cached;

  const nets=profile.examHistory.map(item=>item.totalNet);
  const scores=profile.examHistory
    .map(item=>item.totalScore)
    .filter((value):value is number=>Number.isFinite(value));
  const currentNet=nets.at(-1)||0;
  const predictedNet=predictSeriesValue({
    values:nets,
    days,
    assumedWeeklyStudyMinutes,
    assumedAttendanceRisk,
    assumedInterventionEffect,
  });
  const confidence=confidenceFromHistory(nets);
  const volatility=standardDeviation(nets.slice(-6));
  const uncertainty=Math.max(
    1.5,
    volatility*.8+(100-confidence)/100*Math.max(3,Math.abs(predictedNet)*.15),
  );

  const scorePerNet=scores.length&&nets.length
    ?scores.at(-1)!/Math.max(1,nets.at(-1)!)
    :undefined;
  const predictedScore=scorePerNet?predictedNet*scorePerNet:undefined;

  const factors=buildPredictionFactors({
    profile,
    assumedWeeklyStudyMinutes,
    assumedAttendanceRisk,
    assumedInterventionEffect,
  });
  const trend=trendLabel(nets);
  const subjectForecasts=subjectPredictions({
    profile,
    days,
    assumedWeeklyStudyMinutes,
    assumedAttendanceRisk,
    assumedInterventionEffect,
  });

  const summary=[
    `${days} günlük tahminde netin ${predictedNet.toFixed(1)} düzeyine ulaşması bekleniyor.`,
    `Güven aralığı ${Math.max(0,predictedNet-uncertainty).toFixed(1)}–${(predictedNet+uncertainty).toFixed(1)} net.`,
    trend==="rising"
      ?"Son sınav eğilimi yükseliş yönünde."
      :trend==="falling"
        ?"Son sınav eğilimi düşüş yönünde."
        :trend==="volatile"
          ?"Sonuçlar dalgalı; tahmin aralığı geniş tutuldu."
          :trend==="insufficient"
            ?"Geçmiş veri sınırlı; tahmin güveni düşüktür."
            :"Sonuçlar büyük ölçüde dengeli.",
  ].join(" ");

  const prediction:AcademicPrediction={
    version:"2.0",
    generatedAt:new Date().toISOString(),
    horizon,
    horizonDays:days,
    dataScope:nets.length>=2?"multi-exam":"single-exam",
    currentNet:Number(currentNet.toFixed(2)),
    predictedNet:Number(predictedNet.toFixed(2)),
    lowerNet:Number(Math.max(0,predictedNet-uncertainty).toFixed(2)),
    upperNet:Number((predictedNet+uncertainty).toFixed(2)),
    currentScore:scores.at(-1),
    predictedScore:predictedScore!==undefined?Number(predictedScore.toFixed(2)):undefined,
    confidence:Number(clamp(confidence,20,95).toFixed(0)),
    trend,
    subjectPredictions:subjectForecasts,
    factors,
    summary,
    disclaimer:"Bu tahmin karar desteği amacıyla üretilmiştir; kesin sonuç garantisi değildir.",
  };

  return setCachedIntelligence({
    key:cacheKey,
    value:prediction,
    profileUpdatedAt:profile.metadata.updatedAt,
    engineVersion:ENGINE_VERSION,
    ttlMinutes:30,
  });
}

export function buildStandardPredictions({
  profile,
  examDate,
  assumedWeeklyStudyMinutes=0,
  assumedAttendanceRisk=0,
  assumedInterventionEffect=0,
}:Omit<PredictionEngineInput,"horizon">){
  return{
    twoWeeks:runPredictionEngine2({
      profile,
      horizon:"14d",
      examDate,
      assumedWeeklyStudyMinutes,
      assumedAttendanceRisk,
      assumedInterventionEffect,
    }),
    oneMonth:runPredictionEngine2({
      profile,
      horizon:"30d",
      examDate,
      assumedWeeklyStudyMinutes,
      assumedAttendanceRisk,
      assumedInterventionEffect,
    }),
    examDay:runPredictionEngine2({
      profile,
      horizon:"exam-day",
      examDate,
      assumedWeeklyStudyMinutes,
      assumedAttendanceRisk,
      assumedInterventionEffect,
    }),
  };
}
