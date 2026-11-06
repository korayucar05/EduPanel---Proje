import type {BrainScoreResult} from "../brain";
import {average,clamp,rankFromScore,scoreTypeFromClassroom,sigmoid} from "./universityMath";
import type {
  StudentPlacementEstimate,
  UniversityScenario,
  UniversitySimulationInput,
  UniversitySimulationResult,
} from "./types";

const scenarioNetEffect=(scenario:UniversityScenario,scoreType:string)=>{
  const tyt=
    scenario.mathematicsNetGain*.28+
    scenario.turkishNetGain*.22+
    scenario.scienceNetGain*.18+
    scenario.socialNetGain*.12;
  const ayt=scoreType==="SAY"
    ?scenario.aytMathematicsNetGain*.42+scenario.aytScienceNetGain*.38
    :scoreType==="EA"
      ?scenario.aytMathematicsNetGain*.34+scenario.aytLiteratureNetGain*.34+scenario.aytSocialNetGain*.14
      :scoreType==="SOZ"
        ?scenario.aytLiteratureNetGain*.42+scenario.aytSocialNetGain*.34
        :scoreType==="DIL"
          ?scenario.turkishNetGain*.3+scenario.weeklyStudyMinutes/60*.08
          :0;
  const study=Math.min(4.5,scenario.weeklyStudyMinutes/60*.18);
  const attendance=Math.min(2.2,scenario.attendanceReductionDays*.22);
  return tyt+ayt+study+attendance;
};

const finiteNumber=(value:unknown,fallback=0)=>{
  const numeric=Number(value);
  return Number.isFinite(numeric)?numeric:fallback;
};

const baselineScore=(student:BrainScoreResult,scoreType:string)=>{
  const brain=finiteNumber(student.brainScore);
  const net=finiteNumber(student.currentNet);
  const potential=finiteNumber(student.potentialScore);
  const multiplier=scoreType==="TYT"?3.3:4.1;
  return clamp(100+net*multiplier+brain*.55+potential*.25,100,560);
};

const probabilityFrom=(score:number,ranking:number,targetRanking?:number)=>{
  const target=targetRanking||100_000;
  const rankRatio=Math.log10(Math.max(1,target))/Math.log10(Math.max(2,ranking));
  const scoreSignal=(score-260)/75;
  return clamp(sigmoid(scoreSignal+rankRatio-1.1)*100,2,98);
};

const primaryNeed=(student:BrainScoreResult)=>{
  const weakest=[...student.factors]
    .filter(item=>item.score<60)
    .sort((a,b)=>a.score-b.score)[0];
  return weakest?.label||student.topReasons[0]||"Düzenli deneme ve ders bazlı gelişim takibi";
};

export function runUniversitySimulation({
  cohort,
  scenario,
}:UniversitySimulationInput):UniversitySimulationResult{
  const students:StudentPlacementEstimate[]=cohort.ranking.map(student=>{
    const scoreType=scoreTypeFromClassroom(student.student.classroom);
    const currentScore=baselineScore(student,scoreType);
    const netEffect=scenarioNetEffect(scenario,scoreType);
    const currentNet=finiteNumber(student.currentNet);
    const predictedNet=currentNet+netEffect;
    const predictedScore=clamp(
      currentScore+
      netEffect*(scoreType==="TYT"?3.2:4.4)+
      finiteNumber(student.expectedGain)*.9,
      100,
      560,
    );
    const currentRanking=rankFromScore(currentScore,scoreType);
    const predictedRanking=rankFromScore(predictedScore,scoreType);
    const currentProbability=probabilityFrom(currentScore,currentRanking);
    const predictedProbability=probabilityFrom(predictedScore,predictedRanking);
    const probabilityChange=predictedProbability-currentProbability;

    return{
      studentId:student.student.id,
      studentName:student.student.name,
      studentNumber:student.student.number,
      classroom:student.student.classroom,
      scoreType,
      currentNet:Number(currentNet.toFixed(2)),
      predictedNet:Number(predictedNet.toFixed(2)),
      currentScore:Number(currentScore.toFixed(1)),
      predictedScore:Number(predictedScore.toFixed(1)),
      currentRanking,
      predictedRanking,
      currentProbability:Number(currentProbability.toFixed(1)),
      predictedProbability:Number(predictedProbability.toFixed(1)),
      probabilityChange:Number(probabilityChange.toFixed(1)),
      status:predictedProbability>=72
        ?"reachable"
        :predictedProbability>=45
          ?"borderline"
          :predictedProbability>=15
            ?"distant"
            :"undefined",
      confidence:Math.round(clamp(
        finiteNumber(student.confidence,35)*.7+
        (cohort.totalStudents>=20?18:10)
      )),
      primaryNeed:primaryNeed(student),
    };
  });

  const placed=students.filter(item=>item.currentProbability>=60).length;
  const placedAfter=students.filter(item=>item.predictedProbability>=60).length;
  const first100k=students.filter(item=>(item.currentRanking||Infinity)<=100_000).length;
  const first100kAfter=students.filter(item=>item.predictedRanking<=100_000).length;

  const scoreTypes=["TYT","SAY","EA","SOZ","DIL"] as const;
  const scoreTypeSummary=scoreTypes.map(scoreType=>{
    const group=students.filter(item=>item.scoreType===scoreType);
    return{
      scoreType,
      studentCount:group.length,
      averageProbability:Number(average(group.map(item=>item.currentProbability)).toFixed(1)),
      averageProbabilityAfterScenario:Number(average(group.map(item=>item.predictedProbability)).toFixed(1)),
      placementGain:group.filter(item=>item.predictedProbability>=60).length-
        group.filter(item=>item.currentProbability>=60).length,
    };
  }).filter(item=>item.studentCount>0);

  const highImpactStudents=[...students]
    .sort((a,b)=>b.probabilityChange-a.probabilityChange)
    .slice(0,20);

  const recommendations=[
    highImpactStudents[0]
      ?`${highImpactStudents[0].studentName} ve benzer profildeki öğrenciler senaryodan en yüksek faydayı görüyor.`
      :undefined,
    scoreTypeSummary.sort((a,b)=>b.placementGain-a.placementGain)[0]
      ?`${scoreTypeSummary.sort((a,b)=>b.placementGain-a.placementGain)[0].scoreType} grubuna öncelikli kaynak ayrılması en yüksek yerleşme artışını sağlayabilir.`
      :undefined,
    scenario.aytMathematicsNetGain>0
      ?"AYT Matematik artışının özellikle SAY ve EA gruplarında etkisini iki deneme sonra yeniden ölçün."
      :undefined,
    "Simülasyonu gerçek YKS katsayıları ve güncel başarı sırası verileriyle kalibre ederek kullanın.",
  ].filter(Boolean) as string[];

  const averageScoreGain=average(students.map(item=>item.predictedScore-(item.currentScore||0)));
  const rankingImprovement=average(students.map(item=>(item.currentRanking||item.predictedRanking)-item.predictedRanking));

  return{
    version:"1.0",
    generatedAt:new Date().toISOString(),
    scenario,
    totalStudents:students.length,
    estimatedPlacedStudents:placed,
    estimatedPlacedStudentsAfterScenario:placedAfter,
    placementGain:placedAfter-placed,
    first100kCount:first100k,
    first100kCountAfterScenario:first100kAfter,
    first100kGain:first100kAfter-first100k,
    averageProbability:Number(average(students.map(item=>item.currentProbability)).toFixed(1)),
    averageProbabilityAfterScenario:Number(average(students.map(item=>item.predictedProbability)).toFixed(1)),
    averageScoreGain:Number(averageScoreGain.toFixed(1)),
    averageRankingImprovement:Math.round(rankingImprovement),
    students,
    highImpactStudents,
    scoreTypeSummary,
    recommendations,
    summary:`${students.length} öğrenci simüle edildi. Yerleşme eşiğini aşan öğrenci sayısının ${placed} seviyesinden ${placedAfter} seviyesine çıkması; ilk 100 bine giren öğrenci sayısında ${first100kAfter-first100k>=0?"+":""}${first100kAfter-first100k} değişim bekleniyor.`,
    confidence:Math.round(clamp(58+Math.min(24,students.length/4))),
  };
}
