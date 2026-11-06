import type {HasatLiveSnapshot} from "../live";
import type {DigitalSchoolTwinSnapshot,DigitalTwinMetric,GradeTwin} from "./types";

const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:0));
const numberFrom=(value:unknown):number|undefined=>{
  if(typeof value==="number"&&Number.isFinite(value))return value;
  if(typeof value==="string"){
    const parsed=Number(value.replace(",","."));
    return Number.isFinite(parsed)?parsed:undefined;
  }
  return undefined;
};
const pickNumber=(item:any,keys:string[])=>{
  for(const key of keys){
    const value=numberFrom(item?.[key]);
    if(value!==undefined)return value;
  }
  return undefined;
};
const average=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:undefined;
const toneFor=(score:number):DigitalTwinMetric["tone"]=>score>=80?"emerald":score>=65?"blue":score>=50?"amber":"rose";
const normalizeAcademic=(value:number)=>value<=5?value*20:value<=10?value*10:clamp(value);
const studentGrade=(student:any)=>{
  const raw=String(student?.grade??student?.classLevel??student?.className??student?.classroom??student?.sinif??"");
  const match=raw.match(/(?:^|\D)(9|10|11|12)(?:\D|$)/);
  return match?.[1]||"Diğer";
};
const isRiskStudent=(student:any)=>{
  const explicit=student?.riskLevel??student?.risk??student?.statusRisk;
  if(typeof explicit==="string"&&/(yüksek|kritik|high|critical)/i.test(explicit))return true;
  const score=pickNumber(student,["riskScore","academicRiskScore","earlyRiskScore"]);
  return score!==undefined&&score>=65;
};

export function buildDigitalSchoolTwin({
  students,
  teachers,
  classrooms,
  live,
}:{students:any[];teachers:any[];classrooms:any[];live:HasatLiveSnapshot}):DigitalSchoolTwinSnapshot{
  const safeStudents=Array.isArray(students)?students.filter(Boolean):[];
  const academicValues=safeStudents.map(student=>pickNumber(student,["gpa","oob","average","averageScore","examAverage","successScore"])).filter((v):v is number=>v!==undefined).map(normalizeAcademic);
  const absenceValues=safeStudents.map(student=>pickNumber(student,["absenceDays","absentDays","devamsizlik","totalAbsence","attendanceAbsent"])).filter((v):v is number=>v!==undefined);
  const behaviorValues=safeStudents.map(student=>pickNumber(student,["behaviorScore","disciplineScore","conductScore"])).filter((v):v is number=>v!==undefined).map(value=>clamp(value));
  const riskCount=safeStudents.filter(isRiskStudent).length;

  const academicScore=average(academicValues)??live.schoolHealthScore;
  const avgAbsence=average(absenceValues);
  const attendanceScore=avgAbsence===undefined?Math.max(55,live.schoolHealthScore-3):clamp(100-avgAbsence*4.5);
  const behaviorScore=average(behaviorValues)??clamp(96-live.criticalEventCount*12-live.warningEventCount*4);
  const riskScore=safeStudents.length?clamp(100-(riskCount/safeStudents.length)*180):live.schoolHealthScore;
  const operationScore=clamp(100-live.criticalEventCount*14-live.warningEventCount*5);
  const staffingScore=classrooms.length?clamp((teachers.length/classrooms.length)*55,45,100):teachers.length?75:50;

  const metricDefs:Array<Omit<DigitalTwinMetric,"tone">>=[
    {key:"academic",label:"Akademik Sağlık",score:Math.round(academicScore),value:academicValues.length?`${academicScore.toFixed(1)}/100`:"Canlı tahmin",detail:academicValues.length?`${academicValues.length} öğrenci verisiyle hesaplandı`:"Not/deneme ortalaması geldikçe kesinleşir",weight:30,confidence:academicValues.length?safeStudents.length?Math.round(academicValues.length/safeStudents.length*100):0:35},
    {key:"attendance",label:"Devam Sağlığı",score:Math.round(attendanceScore),value:avgAbsence===undefined?"Veri bekleniyor":`${avgAbsence.toFixed(1)} gün`,detail:avgAbsence===undefined?"Devamsızlık kayıtları henüz yeterli değil":"Öğrenci başına ortalama devamsızlık",weight:20,confidence:absenceValues.length?safeStudents.length?Math.round(absenceValues.length/safeStudents.length*100):0:20},
    {key:"behavior",label:"Davranış İklimi",score:Math.round(behaviorScore),value:`${live.criticalEventCount} kritik`,detail:`${live.warningEventCount} uyarı canlı olay motorunda izleniyor`,weight:15,confidence:live.recentEvents.length?85:45},
    {key:"risk",label:"Öğrenci Risk Dengesi",score:Math.round(riskScore),value:`${riskCount} öğrenci`,detail:"Yüksek veya kritik risk işareti taşıyan öğrenci",weight:15,confidence:safeStudents.length?70:20},
    {key:"operation",label:"Operasyon Sağlığı",score:Math.round(operationScore),value:`${live.recentEvents.length} olay`,detail:"Canlı uyarı ve işlem yoğunluğu",weight:10,confidence:75},
    {key:"staffing",label:"Kadro Dengesi",score:Math.round(staffingScore),value:`${teachers.length}/${classrooms.length}`,detail:"Öğretmen / sınıf kapsama görünümü",weight:10,confidence:teachers.length&&classrooms.length?90:30},
  ];
  const metrics=metricDefs.map(item=>({...item,tone:toneFor(item.score)}));
  const weightTotal=metrics.reduce((sum,item)=>sum+item.weight,0);
  const schoolHealthScore=Math.round(metrics.reduce((sum,item)=>sum+item.score*item.weight,0)/weightTotal);
  const confidence=Math.round(metrics.reduce((sum,item)=>sum+item.confidence*item.weight,0)/weightTotal);

  const grades:GradeTwin[]=["9","10","11","12"].map(grade=>{
    const group=safeStudents.filter(student=>studentGrade(student)===grade);
    const groupAcademic=group.map(student=>pickNumber(student,["gpa","oob","average","averageScore","examAverage","successScore"])).filter((v):v is number=>v!==undefined).map(normalizeAcademic);
    const groupAbsence=group.map(student=>pickNumber(student,["absenceDays","absentDays","devamsizlik","totalAbsence","attendanceAbsent"])).filter((v):v is number=>v!==undefined);
    const groupRisk=group.filter(isRiskStudent).length;
    const academic=average(groupAcademic)??academicScore;
    const attendance=groupAbsence.length?clamp(100-(average(groupAbsence)??0)*4.5):attendanceScore;
    const riskHealth=group.length?clamp(100-(groupRisk/group.length)*180):riskScore;
    const health=Math.round(academic*.5+attendance*.25+riskHealth*.25);
    return{grade:`${grade}. Sınıf`,studentCount:group.length,healthScore:health,academicScore:Math.round(academic),attendanceScore:Math.round(attendance),riskCount:groupRisk,status:health<55?"critical":health<72?"attention":"stable"};
  });

  const alerts:DigitalSchoolTwinSnapshot["alerts"]=[];
  metrics.filter(item=>item.score<65).sort((a,b)=>a.score-b.score).slice(0,3).forEach(item=>alerts.push({
    id:`metric-${item.key}`,title:`${item.label} yakından izlenmeli`,detail:`Gösterge ${item.score}/100 düzeyinde. ${item.detail}.`,severity:item.score<50?"critical":"warning",action:item.key==="attendance"?"Devamsızlık kayıtlarını sınıf bazında inceleyin.":item.key==="academic"?"Düşük kazanım ve dersleri zümre bazında inceleyin.":item.key==="risk"?"Riskli öğrencileri rehberlik eylem kuyruğuna alın.":"İlgili veri kaynağını ve açık işlemleri kontrol edin.",
  }));
  if(!alerts.length)alerts.push({id:"stable",title:"Okul dengeli görünümde",detail:"Kritik eşik altında bir ana gösterge bulunmuyor.",severity:"info",action:"Haftalık eğilimleri izlemeye devam edin."});

  const available=metrics.filter(item=>item.confidence>=50).length;
  const status=schoolHealthScore<55?"critical":schoolHealthScore<72?"attention":"stable";
  return{
    generatedAt:new Date().toISOString(),schoolHealthScore,status,confidence,
    summary:status==="critical"?"Okul ikizinde acil yönetim müdahalesi gerektiren alanlar var.":status==="attention"?"Genel görünüm çalışıyor; bazı göstergeler yakın izleme istiyor.":"Okulun bütünsel sağlık görünümü dengeli ve sürdürülebilir.",
    metrics,grades,alerts,dataCoverage:{available,expected:metrics.length,percentage:Math.round(available/metrics.length*100)},
  };
}
