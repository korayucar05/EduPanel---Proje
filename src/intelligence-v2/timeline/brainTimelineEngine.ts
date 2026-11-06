import {buildAcademicDigitalProfileFromReports} from "../profile/profileBuilder";
import {runBrainScoreEngine} from "../brain";
import {runAcademicDnaEngine2} from "../dna";
import type {StudentReportV2Data} from "../../reports-v2/types";
import {buildInterventionMemory} from "./interventionMemory";
import {average,clamp,isoTime,slope,standardDeviation} from "./timelineMath";
import type {
  BrainTimelineCohort,
  BrainTimelineInput,
  BrainTimelinePoint,
  BrainTimelineResult,
  BrainTimelineSnapshotInput,
  BrainTimelineTrend,
} from "./timelineTypes";

const studentKey=(report:StudentReportV2Data)=>
  String(report.student.number||`${report.student.name}|${report.student.classroom||""}`);

const trendFrom=(nets:number[]):BrainTimelineTrend=>{
  if(nets.length<2)return"insufficient";
  const netSlope=slope(nets.slice(-6));
  const volatility=standardDeviation(nets.slice(-6));
  const mean=Math.max(1,Math.abs(average(nets.slice(-6))));
  if(volatility/mean>.22)return"volatile";
  if(netSlope>.55)return"rising";
  if(netSlope<-.55)return"falling";
  return"stable";
};

const pointFrom=(snapshot:BrainTimelineSnapshotInput):BrainTimelinePoint=>({
  examId:String(
    (snapshot.report as any).examId||
    snapshot.report.reportCode||
    snapshot.report.examName
  ),
  examName:snapshot.report.examName,
  examDate:String(snapshot.report.examDate||snapshot.report.reportDate||""),
  net:Number(snapshot.report.totals.net||0),
  successRate:Number(snapshot.report.totals.successRate||0),
  score:snapshot.report.totals.score,
  brainScore:snapshot.brain.brainScore,
  priorityScore:snapshot.brain.priorityScore,
  potentialScore:snapshot.brain.potentialScore,
  expectedGain:snapshot.brain.expectedGain,
  riskLevel:snapshot.brain.priorityLevel,
  academicDnaScore:snapshot.dna.overallScore,
  academicDnaConfidence:snapshot.dna.confidence,
});

export function buildBrainTimeline({
  snapshots,
}:BrainTimelineInput):BrainTimelineResult{
  if(!snapshots.length){
    throw new Error("Brain Timeline için en az bir sınav görüntüsü gerekir.");
  }

  const ordered=[...snapshots].sort((a,b)=>
    isoTime(String(a.report.examDate||a.report.reportDate||""))-
    isoTime(String(b.report.examDate||b.report.reportDate||""))
  );
  const points=ordered.map(pointFrom);
  const first=points[0];
  const last=points.at(-1)!;
  const nets=points.map(point=>point.net);
  const trend=trendFrom(nets);
  const profile=buildAcademicDigitalProfileFromReports(ordered.map(item=>item.report));
  const interventionMemory=buildInterventionMemory(profile);

  const bestPeriod=[...points].sort((a,b)=>b.net-a.net)[0];
  const criticalPeriod=[...points].sort((a,b)=>
    b.priorityScore-a.priorityScore||a.net-b.net
  )[0];

  const netChange=last.net-first.net;
  const successRateChange=last.successRate-first.successRate;
  const brainScoreChange=last.brainScore-first.brainScore;
  const priorityScoreChange=last.priorityScore-first.priorityScore;
  const confidence=clamp(
    30+
    Math.min(40,points.length*8)+
    Math.max(0,25-standardDeviation(nets)*2)
  );

  const summary=[
    `${points.length} sınav zaman çizelgesinde değerlendirildi.`,
    `Net değişimi ${netChange>=0?"+":""}${netChange.toFixed(2)}, Brain Score değişimi ${brainScoreChange>=0?"+":""}${brainScoreChange.toFixed(1)}.`,
    trend==="rising"
      ?"Akademik eğilim yükseliş yönünde."
      :trend==="falling"
        ?"Akademik eğilim düşüş yönünde."
        :trend==="volatile"
          ?"Performans dalgalı; istikrar öncelikli izlenmelidir."
          :trend==="stable"
            ?"Performans büyük ölçüde dengeli ilerliyor."
            :"Eğilim değerlendirmesi için daha fazla sınav gerekir.",
  ].join(" ");

  const recommendations=[
    trend==="falling"
      ?"Son iki sınavdaki ders bazlı düşüşler için hedefli müdahale planı oluşturun."
      :undefined,
    trend==="volatile"
      ?"Çalışma düzeni, süre yönetimi ve sınav koşullarını birlikte izleyin."
      :undefined,
    priorityScoreChange>10
      ?"Müdahale önceliği belirgin biçimde arttı; kısa süreli takip tarihi belirleyin."
      :undefined,
    interventionMemory.some(item=>item.outcome==="ineffective")
      ?"Etkisiz kalan müdahaleyi aynı biçimde sürdürmek yerine yöntem değişikliği yapın."
      :undefined,
    trend==="rising"
      ?"Yükselişi sağlayan çalışma ve müdahaleleri koruyun."
      :undefined,
  ].filter(Boolean) as string[];

  return{
    version:"1.0",
    generatedAt:new Date().toISOString(),
    student:{
      id:studentKey(ordered.at(-1)!.report),
      name:ordered.at(-1)!.report.student.name,
      number:ordered.at(-1)!.report.student.number,
      classroom:ordered.at(-1)!.report.student.classroom,
    },
    points,
    trend,
    netChange:Number(netChange.toFixed(2)),
    successRateChange:Number(successRateChange.toFixed(1)),
    brainScoreChange:Number(brainScoreChange.toFixed(1)),
    priorityScoreChange:Number(priorityScoreChange.toFixed(1)),
    bestPeriod,
    criticalPeriod,
    interventionMemory,
    summary,
    recommendations,
    confidence:Number(confidence.toFixed(0)),
  };
}

export function buildBrainTimelineFromReports(
  reports:StudentReportV2Data[],
):BrainTimelineResult{
  const ordered=[...reports].sort((a,b)=>
    isoTime(String(a.examDate||a.reportDate||""))-
    isoTime(String(b.examDate||b.reportDate||""))
  );
  const snapshots=ordered.map((report,index)=>{
    const history=ordered.slice(0,index+1);
    const profile=buildAcademicDigitalProfileFromReports(history);
    const brain=runBrainScoreEngine({report,profile});
    const dna=runAcademicDnaEngine2({report,profile,brain});
    return{report,brain,dna};
  });
  return buildBrainTimeline({snapshots});
}

export function buildBrainTimelineCohort(
  groupedReports:StudentReportV2Data[][],
):BrainTimelineCohort{
  const timelines=groupedReports
    .filter(group=>group.length>0)
    .map(buildBrainTimelineFromReports);

  const validChanges=timelines
    .filter(item=>item.points.length>=2)
    .map(item=>item.netChange);
  const brainChanges=timelines
    .filter(item=>item.points.length>=2)
    .map(item=>item.brainScoreChange);

  const interventions=timelines.flatMap(item=>item.interventionMemory);
  const interventionMap=new Map<string,typeof interventions>();

  for(const item of interventions){
    const current=interventionMap.get(item.type)||[];
    current.push(item);
    interventionMap.set(item.type,current);
  }

  const interventionSummary=[...interventionMap.entries()].map(([type,items])=>{
    const completed=items.filter(item=>item.outcome!=="pending");
    const effective=completed.filter(item=>item.outcome==="effective");
    const observed=completed
      .map(item=>item.observedNetGain)
      .filter((value):value is number=>Number.isFinite(value));
    return{
      type,
      count:items.length,
      effectiveCount:effective.length,
      averageObservedGain:Number(average(observed).toFixed(2)),
      effectivenessRate:completed.length
        ?Number((effective.length/completed.length*100).toFixed(1))
        :0,
    };
  }).sort((a,b)=>b.effectivenessRate-a.effectivenessRate);

  return{
    generatedAt:new Date().toISOString(),
    totalStudents:timelines.length,
    sufficientHistoryCount:timelines.filter(item=>item.points.length>=2).length,
    risingCount:timelines.filter(item=>item.trend==="rising").length,
    stableCount:timelines.filter(item=>item.trend==="stable").length,
    fallingCount:timelines.filter(item=>item.trend==="falling").length,
    volatileCount:timelines.filter(item=>item.trend==="volatile").length,
    averageNetChange:Number(average(validChanges).toFixed(2)),
    averageBrainChange:Number(average(brainChanges).toFixed(1)),
    timelines:timelines.sort((a,b)=>
      b.priorityScoreChange-a.priorityScoreChange||
      b.points.at(-1)!.priorityScore-a.points.at(-1)!.priorityScore
    ),
    interventionSummary,
  };
}
