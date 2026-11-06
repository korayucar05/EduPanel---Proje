import { sqliteStorage } from "../../lib/sqliteStorageBridge";
export type InstitutionSubjectStat={
  subjectName:string;
  studentCount:number;
  averageCorrect:number;
  averageWrong:number;
  averageEmpty:number;
  averageNet:number;
  successRate:number;
};

export type InstitutionClassroomStat={
  classroom:string;
  studentCount:number;
  averageNet:number;
  averageScore:number;
  successRate:number;
  topStudent?:string;
};

export type InstitutionReportV2Data={
  examName:string;
  examDate?:string;
  schoolName:string;
  generatedAt:string;
  summary:{
    studentCount:number;
    classroomCount:number;
    subjectCount:number;
    averageNet:number;
    averageScore:number;
    successRate:number;
    highestNet:number;
    lowestNet:number;
  };
  classrooms:InstitutionClassroomStat[];
  subjects:InstitutionSubjectStat[];
  scoreBands:Array<{label:string;count:number;rate:number}>;
  topStudents:Array<{name:string;classroom:string;net:number;score:number}>;
  insights:string[];
  attentionItems:Array<{
    level:"risk"|"warning"|"success"|"info";
    title:string;
    detail:string;
  }>;
  actionPlan:Array<{
    priority:number;
    title:string;
    detail:string;
    owner:string;
  }>;
  executiveSummary:string;
};

const n=(value:any)=>Number.isFinite(Number(value))?Number(value):0;
const round=(value:number,digits=2)=>Number(value.toFixed(digits));
const studentName=(item:any)=>String(item?.studentName||item?.name||item?.fullName||"Öğrenci").trim();
const classroomName=(item:any)=>String(item?.classroom||item?.className||item?.sinif||item?.sınıf||"Sınıfsız").trim();
const subjectName=(item:any)=>String(item?.subjectName||item?.name||"Ders").trim();
const scoreOf=(item:any)=>{
  const explicit=Number(item?.score);
  if(Number.isFinite(explicit))return explicit;
  const totalQuestions=(item?.subjects||[]).reduce((sum:number,subject:any)=>sum+n(subject?.totalQuestions),0);
  return totalQuestions?Math.max(0,n(item?.totals?.net)/totalQuestions*500):0;
};
const successOf=(item:any)=>{
  const totalQuestions=(item?.subjects||[]).reduce((sum:number,subject:any)=>sum+n(subject?.totalQuestions),0);
  return totalQuestions?Math.max(0,Math.min(100,n(item?.totals?.net)/totalQuestions*100)):0;
};

export function buildInstitutionReportV2Data(exam:any,results:any[]):InstitutionReportV2Data{
  const rows=Array.isArray(results)?results:[];
  const classroomNames=Array.from(new Set(rows.map(classroomName))).sort((a,b)=>a.localeCompare(b,"tr-TR",{numeric:true}));
  const subjectNames=Array.from(new Set(rows.flatMap(item=>(item?.subjects||[]).map(subjectName)))).sort((a,b)=>a.localeCompare(b,"tr-TR"));
  const netValues=rows.map(item=>n(item?.totals?.net));
  const scoreValues=rows.map(scoreOf);
  const successValues=rows.map(successOf);
  const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;

  const classrooms=classroomNames.map(classroom=>{
    const students=rows.filter(item=>classroomName(item)===classroom);
    const ranked=[...students].sort((a,b)=>n(b?.totals?.net)-n(a?.totals?.net));
    return{
      classroom,
      studentCount:students.length,
      averageNet:round(average(students.map(item=>n(item?.totals?.net)))),
      averageScore:round(average(students.map(scoreOf))),
      successRate:round(average(students.map(successOf)),1),
      topStudent:ranked[0]?studentName(ranked[0]):undefined,
    };
  }).sort((a,b)=>b.averageNet-a.averageNet);

  const subjects=subjectNames.map(name=>{
    const values=rows.map(student=>(student?.subjects||[]).find((subject:any)=>subjectName(subject)===name)).filter(Boolean);
    const totalQuestions=n(values.find((item:any)=>n(item?.totalQuestions)>0)?.totalQuestions);
    const averageNet=average(values.map((item:any)=>n(item?.net)));
    return{
      subjectName:name,
      studentCount:values.length,
      averageCorrect:round(average(values.map((item:any)=>n(item?.correct)))),
      averageWrong:round(average(values.map((item:any)=>n(item?.wrong)))),
      averageEmpty:round(average(values.map((item:any)=>n(item?.empty)))),
      averageNet:round(averageNet),
      successRate:round(totalQuestions?Math.max(0,Math.min(100,averageNet/totalQuestions*100)):0,1),
    };
  }).sort((a,b)=>b.successRate-a.successRate);

  const scoreCeiling=Math.max(0,...scoreValues)>100?500:100;
  const scoreBands=Array.from({length:5},(_,index)=>{
    const lower=index*scoreCeiling/5;
    const upper=(index+1)*scoreCeiling/5;
    const count=scoreValues.filter(value=>value>=lower&&(index===4?value<=upper:value<upper)).length;
    return{
      label:`${Math.round(lower)}–${Math.round(upper)}`,
      count,
      rate:rows.length?round(count/rows.length*100,1):0,
    };
  });

  const topStudents=[...rows]
    .sort((a,b)=>n(b?.totals?.net)-n(a?.totals?.net))
    .slice(0,10)
    .map(item=>({name:studentName(item),classroom:classroomName(item),net:round(n(item?.totals?.net)),score:round(scoreOf(item))}));

  const bestClass=classrooms[0];
  const weakestClass=classrooms[classrooms.length-1];
  const bestSubject=subjects[0];
  const weakestSubject=subjects[subjects.length-1];
  const insights:string[]=[];
  if(bestClass)insights.push(`${bestClass.classroom} şubesi ${bestClass.averageNet.toFixed(2)} net ortalamasıyla kurumda ilk sıradadır.`);
  if(weakestClass&&bestClass&&weakestClass.classroom!==bestClass.classroom)insights.push(`${weakestClass.classroom} şubesi için ders bazlı destek planı hazırlanması önerilir.`);
  if(bestSubject)insights.push(`En güçlü ders alanı %${bestSubject.successRate.toFixed(1)} başarıyla ${bestSubject.subjectName} dersidir.`);
  if(weakestSubject&&bestSubject&&weakestSubject.subjectName!==bestSubject.subjectName)insights.push(`En yüksek gelişim potansiyeli ${weakestSubject.subjectName} dersinde görülmektedir.`);
  const lowRate=successValues.filter(value=>value<50).length;
  if(lowRate)insights.push(`${lowRate} öğrenci genel başarıda %50 seviyesinin altındadır; bireysel izleme önerilir.`);
  if(!insights.length)insights.push("Analiz için yeterli sınav sonucu bulunmamaktadır.");

  const institutionAverageNet=average(netValues);
  const attentionItems:InstitutionReportV2Data["attentionItems"]=[];
  if(weakestSubject){
    attentionItems.push({
      level:weakestSubject.successRate<45?"risk":"warning",
      title:`${weakestSubject.subjectName} öncelikli ders alanı`,
      detail:`Kurum başarısı %${weakestSubject.successRate.toFixed(1)} ve ortalama net ${weakestSubject.averageNet.toFixed(2)} düzeyindedir.`,
    });
  }
  if(weakestClass){
    const difference=institutionAverageNet-weakestClass.averageNet;
    attentionItems.push({
      level:difference>=5?"risk":"warning",
      title:`${weakestClass.classroom} şubesi yakından izlenmeli`,
      detail:`Kurum net ortalamasının ${Math.abs(difference).toFixed(2)} net ${difference>=0?"altındadır":"üzerindedir"}.`,
    });
  }
  if(lowRate>0){
    attentionItems.push({
      level:lowRate/Math.max(rows.length,1)>=0.2?"risk":"warning",
      title:`${lowRate} öğrenci bireysel destek grubunda`,
      detail:"Genel başarı düzeyi %50'nin altında olan öğrenciler için rehberlik ve ders destek planı önerilir.",
    });
  }
  if(bestClass){
    attentionItems.push({
      level:"success",
      title:`${bestClass.classroom} örnek şube performansı`,
      detail:`${bestClass.averageNet.toFixed(2)} net ortalamasıyla iyi uygulamaların paylaşılması önerilir.`,
    });
  }
  if(bestSubject){
    attentionItems.push({
      level:"success",
      title:`${bestSubject.subjectName} güçlü kurum alanı`,
      detail:`%${bestSubject.successRate.toFixed(1)} başarı oranı diğer branşlar için iyi uygulama örneği olabilir.`,
    });
  }

  const actionPlan:InstitutionReportV2Data["actionPlan"]=[];
  if(weakestSubject){
    actionPlan.push({
      priority:1,
      title:`${weakestSubject.subjectName} branş iyileştirme toplantısı`,
      detail:"Yanlış ve boş oranları incelenerek konu/kazanım bazlı kısa destek planı hazırlanmalıdır.",
      owner:"Branş öğretmenleri",
    });
  }
  if(weakestClass){
    actionPlan.push({
      priority:2,
      title:`${weakestClass.classroom} şubesi için hedefli destek`,
      detail:"Şubenin ders bazlı düşük alanları belirlenmeli ve iki haftalık takip hedefi oluşturulmalıdır.",
      owner:"Sınıf rehber öğretmeni",
    });
  }
  if(lowRate>0){
    actionPlan.push({
      priority:3,
      title:"Bireysel risk öğrencileriyle görüşme",
      detail:`Başarısı %50'nin altında olan ${lowRate} öğrenci için kısa rehberlik görüşmesi ve çalışma planı uygulanmalıdır.`,
      owner:"Rehberlik servisi",
    });
  }
  if(bestClass&&weakestClass&&bestClass.classroom!==weakestClass.classroom){
    actionPlan.push({
      priority:4,
      title:"Şubeler arası iyi uygulama paylaşımı",
      detail:`${bestClass.classroom} şubesindeki etkili çalışma ve takip uygulamaları diğer şubelerle paylaşılmalıdır.`,
      owner:"Okul yönetimi",
    });
  }
  actionPlan.push({
    priority:5,
    title:"Bir sonraki sınav için ölçülebilir hedef",
    detail:`Kurum net ortalamasında en az ${(Math.max(1,institutionAverageNet*0.05)).toFixed(2)} net artış hedeflenmelidir.`,
    owner:"Ölçme değerlendirme ekibi",
  });

  const executiveSummary=rows.length
    ? `${rows.length} öğrencinin katıldığı sınavda kurum net ortalaması ${institutionAverageNet.toFixed(2)} olmuştur. ${bestClass?`${bestClass.classroom} en yüksek şube performansını göstermiştir. `:""}${weakestSubject?`Öncelikli gelişim alanı ${weakestSubject.subjectName} dersidir. `:""}Yönetimin öncelikle risk öğrencileri, düşük şube ve düşük ders alanlarını birlikte izlemesi önerilir.`
    : "Karşılaştırmalı kurum analizi için yeterli öğrenci sonucu bulunmamaktadır.";

  let schoolName="Ordu Lisesi";
  try{
    const profile=JSON.parse(sqliteStorage.getItem("school_info_a_profile")||sqliteStorage.getItem("school_info")||"{}");
    schoolName=String(profile?.schoolName||profile?.name||schoolName);
  }catch{}

  return{
    examName:String(exam?.examName||exam?.name||"Sınav"),
    examDate:String(exam?.examDate||exam?.date||""),
    schoolName,
    generatedAt:new Date().toISOString(),
    summary:{
      studentCount:rows.length,
      classroomCount:classrooms.length,
      subjectCount:subjects.length,
      averageNet:round(average(netValues)),
      averageScore:round(average(scoreValues)),
      successRate:round(average(successValues),1),
      highestNet:round(netValues.length?Math.max(...netValues):0),
      lowestNet:round(netValues.length?Math.min(...netValues):0),
    },
    classrooms,
    subjects,
    scoreBands,
    topStudents,
    insights,
    attentionItems,
    actionPlan,
    executiveSummary,
  };
}
