import type { StudentTargetAnalysis, StudentTargetDefinition, SubjectPerformance } from "../types";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const rate=(subject:SubjectPerformance)=>Number.isFinite(Number(subject.successRate))
  ? Number(subject.successRate)
  : subject.totalQuestions?subject.correct/subject.totalQuestions*100:0;

export function studentTargetStorageKey(studentNumber:any){return `hasat_student_target_${String(studentNumber||"unknown")}`;}
export function loadStudentTarget(studentNumber:any):StudentTargetDefinition{
  try{const raw=sqliteStorage.getItem(studentTargetStorageKey(studentNumber));return raw?JSON.parse(raw):{};}catch{return{};}
}
export function saveStudentTarget(studentNumber:any,target:StudentTargetDefinition){
  sqliteStorage.setItem(studentTargetStorageKey(studentNumber),JSON.stringify({...target,updatedAt:new Date().toISOString()}));
}

const efficiencyLabel=(score:number):"Düşük"|"Orta"|"Yüksek"|"Çok yüksek"=>score>=82?"Çok yüksek":score>=68?"Yüksek":score>=48?"Orta":"Düşük";
const projectedRank=(currentRank:number|undefined,targetRank:number|undefined,gain:number,totalGain:number)=>{
  if(!currentRank||!targetRank||currentRank<=targetRank||totalGain<=0)return undefined;
  const progress=clamp(gain/totalGain,0,1);
  return Math.max(targetRank,Math.round(currentRank-(currentRank-targetRank)*progress));
};

export function buildStudentTargetAnalysis({definition,subjects,currentNet,currentScore,currentRank}:{
  definition:StudentTargetDefinition;subjects:SubjectPerformance[];currentNet:number;currentScore:number;currentRank?:number;
}):StudentTargetAnalysis{
  const targetNet=Number.isFinite(Number(definition.targetNet))?Number(definition.targetNet):undefined;
  const targetScore=Number.isFinite(Number(definition.targetScore))?Number(definition.targetScore):undefined;
  const targetRank=Number.isFinite(Number(definition.targetRank))?Number(definition.targetRank):undefined;
  const isDefined=Boolean(definition.university||definition.program||targetNet!==undefined||targetScore!==undefined||targetRank!==undefined);
  const netGap=targetNet!==undefined?Math.max(0,targetNet-currentNet):undefined;
  const scoreGap=targetScore!==undefined?Math.max(0,targetScore-currentScore):undefined;
  const rankGap=currentRank&&targetRank?Math.max(0,currentRank-targetRank):undefined;
  const completionRate=targetNet&&targetNet>0?clamp(currentNet/targetNet*100):targetScore&&targetScore>0?clamp(currentScore/targetScore*100):undefined;
  const rankProximity=currentRank&&targetRank?clamp(targetRank/currentRank*100):undefined;

  const sorted=[...subjects].sort((a,b)=>rate(a)-rate(b));
  const requestedGain=Math.max(0,netGap||0);
  const baseGain=requestedGain>0?requestedGain:sorted.reduce((sum,s)=>sum+Math.max(0,(70-rate(s))/100*s.totalQuestions),0);
  let remaining=baseGain;
  const raw=sorted.slice(0,6).map(subject=>{
    const success=rate(subject);
    const capacity=Math.max(.25,Math.min(subject.totalQuestions*.25,Math.max(0,(78-success)/100*subject.totalQuestions)));
    const suggestedGain=Math.min(capacity,Math.max(.25,remaining));
    remaining=Math.max(0,remaining-suggestedGain);
    const efficiencyScore=clamp((100-success)*.62+(subject.totalQuestions?Math.min(25,subject.totalQuestions):10)+suggestedGain*6);
    return {subject:subject.subjectName,currentNet:Number(subject.net.toFixed(2)),successRate:Number(success.toFixed(1)),suggestedGain:Number(suggestedGain.toFixed(2)),targetNet:Number((subject.net+suggestedGain).toFixed(2)),efficiencyScore:Number(efficiencyScore.toFixed(0)),efficiencyLabel:efficiencyLabel(efficiencyScore)};
  }).filter(x=>x.suggestedGain>0);
  const totalSuggested=raw.reduce((sum,x)=>sum+x.suggestedGain,0)||1;
  const opportunities=raw.map(x=>({...x,projectedRank:projectedRank(currentRank,targetRank,x.suggestedGain,totalSuggested)}));

  const finalNet=targetNet!==undefined?targetNet:currentNet+totalSuggested;
  const distance=Math.max(0,finalNet-currentNet);
  const labels=["1. Kontrol","2. Kontrol","3. Kontrol","Hedef"];
  const milestones=labels.map((label,index)=>{const ratio=(index+1)/4;return {label,targetNet:Number((currentNet+distance*ratio).toFixed(2)),targetScore:targetScore!==undefined?Number((currentScore+Math.max(0,targetScore-currentScore)*ratio).toFixed(1)):undefined};});
  const totalWeeklyHours=Math.max(5,Math.min(18,Math.ceil((netGap||opportunities.length*1.2)*.65)));
  const weeklyHours=opportunities.slice(0,5).map(x=>({subject:x.subject,hours:Number(Math.max(1,totalWeeklyHours*x.suggestedGain/totalSuggested).toFixed(1)),reason:`${x.suggestedGain.toFixed(2)} net fırsatı · yatırım verimi ${x.efficiencyLabel.toLocaleLowerCase("tr-TR")}.`}));

  const baseCompletion=completionRate??rankProximity??45;
  const currentProbability=clamp(baseCompletion*.72-12,5,92);
  const probability={current:Math.round(currentProbability),steady:Math.round(clamp(currentProbability+12)),plusTwoHours:Math.round(clamp(currentProbability+24)),plusFiveHours:Math.round(clamp(currentProbability+38))};
  const targetName=[definition.university,definition.program].filter(Boolean).join(" · ");
  const summary=isDefined
    ? `${targetName||"Tanımlanan hedef"} için mevcut performans ${currentNet.toFixed(2)} net${currentRank?` ve yaklaşık ${currentRank.toLocaleString("tr-TR")}. sıra` : ""} düzeyindedir. ${netGap!==undefined?`Hedef nete ${netGap.toFixed(2)} net kalmıştır. `:""}${rankGap!==undefined?`Hedef sıralama farkı ${rankGap.toLocaleString("tr-TR")} kişidir. `:""}En yüksek getirili dersler aşağıda önceliklendirilmiştir.`
    : "Öğrenci için henüz üniversite, bölüm, hedef net, puan veya sıralama tanımlanmamıştır.";
  return {isDefined,definition,currentScore,currentNet,scoreGap,netGap,completionRate,currentRank,rankGap,rankProximity,probability,opportunities,milestones,weeklyHours,summary,disclaimer:"Olasılık ve sıralama projeksiyonları e-Nstitü'ın sınav performansına dayalı eğitimsel senaryolarıdır; yerleşme garantisi değildir. Resmî taban sıralamalar hedef alanına kullanıcı tarafından girilmelidir."};
}
