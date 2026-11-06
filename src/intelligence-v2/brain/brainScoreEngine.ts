import type {BrainCohortResult,BrainEngineInput,BrainPriorityLevel,BrainScoreResult} from "./brainTypes";
import {buildBrainFactors} from "./brainFactors";
import {average,clamp,weighted} from "./brainScoring";
const level=(s:number):BrainPriorityLevel=>s>=75?"critical":s>=58?"high":s>=38?"medium":"low";
const stars=(s:number)=>(s>=80?5:s>=65?4:s>=48?3:s>=28?2:1) as 1|2|3|4|5;
export function runBrainScoreEngine(input:BrainEngineInput):BrainScoreResult{
 const f=buildBrainFactors(input), priority=f.filter(x=>x.direction==="priority"), strength=f.filter(x=>x.direction==="strength");
 const risk=weighted(priority), potential=weighted(strength), readiness=f.find(x=>x.key==="interventionReadiness")?.score||50;
 const priorityScore=clamp(risk*.58+potential*.22+readiness*.20), expectedGain=Number(Math.max(0,(input.report.intelligence?.subjectPriorities||[]).slice(0,3).reduce((s,x)=>s+x.suggestedGain,0)).toFixed(2));
 const brainScore=Number((priorityScore*.72+potential*.28).toFixed(1)); const p=level(priorityScore);
 const currentNet=Number.isFinite(Number(input.report.totals?.net))?Number(input.report.totals.net):0;
 const confidence=Number.isFinite(Number(input.report.successPrediction?.confidence))?Number(input.report.successPrediction?.confidence):(input.report.successPrediction?.dataScope==="multi-exam"?70:35);
 const top=[...f].sort((a,b)=>(b.score*b.weight)-(a.score*a.weight)).slice(0,4);
 return{version:"5.1",generatedAt:new Date().toISOString(),student:{id:String(input.report.student.number||`${input.report.student.name}|${input.report.student.classroom||""}`),name:input.report.student.name,number:input.report.student.number,classroom:input.report.student.classroom||input.report.student.branch},currentNet,confidence,brainScore,priorityScore:Number(priorityScore.toFixed(1)),potentialScore:Number(potential.toFixed(1)),expectedGain,priorityLevel:p,stars:stars(priorityScore),headline:p==="critical"?"Bugün müdahale önceliği çok yüksek":p==="high"?"Planlı akademik müdahale gerekli":p==="medium"?"Yakın izleme ve hedefli destek öneriliyor":"Düzenli izleme yeterli",summary:`Öncelik ${priorityScore.toFixed(1)}/100, gelişim potansiyeli ${potential.toFixed(1)}/100, beklenen kazanç +${expectedGain.toFixed(1)} net.`,factors:f,topReasons:top.map(x=>`${x.label}: ${x.evidence}`),recommendedActions:(input.report.intelligence?.risks||[]).slice(0,2).map(x=>x.action).concat((input.report.intelligence?.subjectPriorities||[]).slice(0,2).map(x=>`${x.subject} için haftada ${x.weeklyMinutes} dakika hedefli çalışma.`)).slice(0,4)};
}
export function buildBrainCohort(items:BrainEngineInput[]):BrainCohortResult{
 const ranking=items.map(runBrainScoreEngine).sort((a,b)=>b.priorityScore-a.priorityScore); const groups=new Map<string,BrainScoreResult[]>();
 ranking.forEach(x=>{const c=x.student.classroom||"Sınıf Yok";groups.set(c,[...(groups.get(c)||[]),x]);});
 const classroomSummary=[...groups.entries()].map(([classroom,v])=>({classroom,studentCount:v.length,brainIndex:Number(average(v.map(x=>x.brainScore)).toFixed(1)),criticalCount:v.filter(x=>x.priorityLevel==="critical").length,expectedGain:Number(v.reduce((s,x)=>s+x.expectedGain,0).toFixed(1))})).sort((a,b)=>b.brainIndex-a.brainIndex);
 return{generatedAt:new Date().toISOString(),totalStudents:ranking.length,brainIndex:Number(average(ranking.map(x=>x.brainScore)).toFixed(1)),criticalCount:ranking.filter(x=>x.priorityLevel==="critical").length,highCount:ranking.filter(x=>x.priorityLevel==="high").length,mediumCount:ranking.filter(x=>x.priorityLevel==="medium").length,lowCount:ranking.filter(x=>x.priorityLevel==="low").length,ranking,classroomSummary,todayAgenda:ranking.slice(0,10).map((x,i)=>({rank:i+1,title:x.student.name,detail:`${x.student.classroom||""} · ${x.headline} · +${x.expectedGain.toFixed(1)} net fırsatı`,score:x.priorityScore,level:x.priorityLevel}))};
}
