import { requireStudentResult } from "../../core/results";
import { getStudentClassroom, getStudentNumber, studentIdentityMatches } from "../../core/student";
import type { StudentReportV2Data, SubjectPerformance } from "../types";
import { loadStudentTarget } from "./buildStudentTargetAnalysis";
import { runHasatIntelligence } from "../../intelligence";
import { loadTeacherEvaluation } from "./teacherEvaluationStorage";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
const normalize=(value:any)=>String(value||"").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]/g,"");
const numberValue=(value:any,fallback=0)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;};
const clean=(value:any)=>String(value??"").trim();
export const reportStudentName=(student:any)=>clean(student?.studentName||student?.name||student?.fullName||"Öğrenci");
export const reportStudentNumber=(student:any)=>student?.studentNumber||student?.studentNo||student?.number||student?.schoolNumber||student?.id||"-";
export const reportClassroom=(student:any)=>clean(student?.classroom||student?.className||student?.sinif||student?.sınıf||"-");
const reportExamName=(exam:any)=>clean(exam?.name||exam?.title||exam?.examName||"Sınav");

const formatDate=(value:any)=>{
  if(!value)return"-";
  const date=value instanceof Date?value:new Date(value);
  return Number.isNaN(date.getTime())?clean(value):date.toLocaleDateString("tr-TR");
};

const stableCodePart=(value:any)=>clean(value).toLocaleUpperCase("tr-TR").replace(/[^A-Z0-9ÇĞİÖŞÜ]/g,"").slice(0,18)||"X";

const loadSchoolName=()=>{
  try{
    const profile=JSON.parse(sqliteStorage.getItem("school_info_a_profile")||sqliteStorage.getItem("school_info")||"{}");
    return clean(profile?.schoolName||profile?.name||profile?.institutionName)||"Ordu Lisesi";
  }catch{return"Ordu Lisesi";}
};

const subjectRate=(subject:SubjectPerformance)=>Number.isFinite(Number(subject.successRate))
  ?Number(subject.successRate)
  :subject.totalQuestions?subject.correct/subject.totalQuestions*100:0;

const suggestionFor=(subject:SubjectPerformance)=>{
  const name=normalize(subject.subjectName);
  if(name.includes("matematik")||name.includes("geometri"))return"Yanlış çıkan kazanımları belirleyin; kısa konu tekrarından sonra en az 20 yeni nesil soru çözün.";
  if(name.includes("türk")||name.includes("edebiyat"))return"Her gün paragraf çalışması yapın; yanlış sorularda ana düşünce ve çıkarım adımlarını yeniden inceleyin.";
  if(name.includes("fizik"))return"Formülleri ezberlemek yerine örnek olaylarla ilişkilendirin ve farklı soru tipleriyle pekiştirin.";
  if(name.includes("kimya"))return"Kavram haritası hazırlayın; işlem ve yorum sorularını ayrı çalışma bloklarında tekrar edin.";
  if(name.includes("biyoloji"))return"Konu şemaları ve görsel notlarla tekrar yapın; kavram yanılgılarını soru çözümüyle kontrol edin.";
  if(name.includes("tarih"))return"Olayları kronolojik sıraya yerleştirin; neden-sonuç ilişkilerini kısa notlarla tekrar edin.";
  if(name.includes("coğraf"))return"Harita ve grafik yorumlama çalışmaları yapın; temel kavramları günlük örneklerle ilişkilendirin.";
  if(name.includes("ingiliz")||name.includes("almanca")||name.includes("yabancı"))return"Kelime tekrarını kısa okuma parçalarıyla birleştirin; yanlış dil bilgisi kalıplarını yeniden çalışın.";
  if(name.includes("din")||name.includes("felsefe"))return"Kavramları kısa tanım kartlarıyla tekrar edin ve yorum sorularında seçenek eleme pratiği yapın.";
  return"Kısa konu tekrarı yapın, yanlışların nedenini belirleyin ve ardından en az 20 soru çözün.";
};

const findPhoto=(student:any)=>clean(student?.photoUrl||student?.photo||student?.imageUrl||student?.avatar||student?.profilePhoto)||undefined;

export function buildStudentReportV2Data(exam:any,results:any[],student:any):StudentReportV2Data{
  const safeResults=Array.isArray(results)?results:[];
  const resolvedStudent=requireStudentResult(
    safeResults,
    student,
    "Bireysel karne için öğrenci sınav sonucu",
  );
  student=resolvedStudent;
  const ranked=[...safeResults].sort((a,b)=>numberValue(b?.totals?.net)-numberValue(a?.totals?.net));
  const classRows=ranked.filter(item=>normalize(getStudentClassroom(item))===normalize(getStudentClassroom(student)));
  const same=(item:any)=>item===student||studentIdentityMatches(item,student);
  const institutionIndex=ranked.findIndex(same);
  const classroomIndex=classRows.findIndex(same);
  const institutionRank=institutionIndex>=0?institutionIndex+1:"-";
  const classroomRank=classroomIndex>=0?classroomIndex+1:"-";
  const subjects:SubjectPerformance[]=(student?.subjects||[]).map((subject:any)=>({
    subjectName:clean(subject?.subjectName||subject?.name||"Ders"),
    shortName:clean(subject?.shortName||subject?.subjectName||subject?.name||"Ders").slice(0,14),
    correct:numberValue(subject?.correct),wrong:numberValue(subject?.wrong),empty:numberValue(subject?.empty),net:numberValue(subject?.net),
    totalQuestions:numberValue(subject?.totalQuestions,numberValue(subject?.correct)+numberValue(subject?.wrong)+numberValue(subject?.empty)),
    successRate:Number.isFinite(Number(subject?.successRate))?Number(subject.successRate):undefined,
    averageRate:Number.isFinite(Number(subject?.averageRate))?Number(subject.averageRate):undefined,
  }));
  const totalQuestions=subjects.reduce((sum,subject)=>sum+subject.totalQuestions,0);
  const totals=student?.totals||{};
  const correct=numberValue(totals.correct,subjects.reduce((sum,s)=>sum+s.correct,0));
  const wrong=numberValue(totals.wrong,subjects.reduce((sum,s)=>sum+s.wrong,0));
  const empty=numberValue(totals.empty,subjects.reduce((sum,s)=>sum+s.empty,0));
  const net=numberValue(totals.net,subjects.reduce((sum,s)=>sum+s.net,0));
  const score=numberValue(student?.score,numberValue(totals.score,totalQuestions?Math.max(0,net/totalQuestions*500):0));
  const classAverage=classRows.length?classRows.reduce((sum,item)=>sum+numberValue(item?.totals?.net),0)/classRows.length:0;
  const strongest=[...subjects].sort((a,b)=>subjectRate(b)-subjectRate(a))[0];
  const weakest=[...subjects].sort((a,b)=>subjectRate(a)-subjectRate(b))[0];
  const aboveAverage=subjects.filter(subject=>Number.isFinite(Number(subject.averageRate))&&subjectRate(subject)>Number(subject.averageRate));
  const examId=exam?.id||exam?.examId||reportExamName(exam);
  const reportCode=`e-Nstitü-${stableCodePart(examId)}-${stableCodePart(reportStudentNumber(student))}`;
  const comments:string[]=[];
  if(strongest)comments.push(`${strongest.subjectName} dersinde %${Math.round(subjectRate(strongest))} başarıyla güçlü bir performans sergilenmiştir.`);
  if(weakest&&weakest.subjectName!==strongest?.subjectName)comments.push(`${weakest.subjectName} dersi öncelikli gelişim alanıdır; planlı tekrar ve düzenli soru çözümü önerilir.`);
  comments.push(net>=classAverage?`Toplam net, sınıf ortalamasının ${(net-classAverage).toFixed(2)} net üzerindedir.`:`Toplam net, sınıf ortalamasının ${(classAverage-net).toFixed(2)} net altındadır; öncelikli derslere odaklanılmalıdır.`);
  if(aboveAverage.length)comments.push(`${aboveAverage.slice(0,3).map(item=>item.subjectName).join(", ")} derslerinde bildirilen ortalama başarının üzerine çıkılmıştır.`);
  if(correct+wrong+empty>0&&empty/(correct+wrong+empty)>.12)comments.push("Boş bırakılan soru oranı yüksektir; süre yönetimi ve kontrollü tahmin çalışmaları fayda sağlayabilir.");

  const prioritySubjects=subjects.slice().sort((a,b)=>subjectRate(a)-subjectRate(b)).slice(0,4).map(subject=>({
    subject:subject.subjectName,
    successRate:subjectRate(subject),
    averageRate:Number.isFinite(Number(subject.averageRate))?Number(subject.averageRate):undefined,
    gap:Number.isFinite(Number(subject.averageRate))?subjectRate(subject)-Number(subject.averageRate):undefined,
  }));
  const dayNames=["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  const weeklyPlan=dayNames.map((day,index)=>{
    const first=prioritySubjects[index%Math.max(1,prioritySubjects.length)];
    const second=prioritySubjects[(index+1)%Math.max(1,prioritySubjects.length)];
    const tasks:string[]=[];
    if(first)tasks.push(`${first.subject}: 15 dk konu tekrarı + 20 soru`);
    if(second&&second.subject!==first?.subject)tasks.push(`${second.subject}: yanlış soruları yeniden çöz`);
    tasks.push(index%2===0?"10 dakika okuma/paragraf çalışması":"Sınav yanlışlarını kısa notlara dönüştür");
    return{day,tasks,estimatedMinutes:index===5?60:45};
  });
  const potentialGain=prioritySubjects.reduce((sum,item)=>sum+Math.max(0,(70-item.successRate)/100*10),0);
  const targetNet=Math.max(net,Math.round((net+potentialGain)*4)/4);
  const parentSummary=net>=classAverage
    ?`Öğrencimiz sınıf ortalamasının ${(net-classAverage).toFixed(2)} net üzerindedir. Güçlü derslerde mevcut düzen korunmalı; öncelikli gelişim alanlarında kısa ve düzenli tekrarlar yapılmalıdır.`
    :`Öğrencimiz sınıf ortalamasının ${(classAverage-net).toFixed(2)} net altındadır. Öncelikli derslerde haftalık planın uygulanması ve gelişimin sonraki sınavda yeniden değerlendirilmesi önerilir.`;

const targetDefinition=loadStudentTarget(reportStudentNumber(student));
const totalResponses=Math.max(1,correct+wrong+empty);
const previousNets:Array<number>=Array.isArray(student?.history)
  ? student.history.map((item:any)=>numberValue(item?.net,item?.totals?.net)).filter((value:number)=>Number.isFinite(value))
  : Array.isArray(student?.examHistory)
    ? student.examHistory.map((item:any)=>numberValue(item?.net,item?.totals?.net)).filter((value:number)=>Number.isFinite(value))
    : [];

const intelligence=runHasatIntelligence({
  studentName:reportStudentName(student),
  studentNumber:reportStudentNumber(student),
  subjects,
  totals:{
    correct,
    wrong,
    empty,
    net,
    score,
    successRate:totalQuestions?correct/totalQuestions*100:0,
  },
  classroomAverageNet:classAverage,
  previousNets,
  targetDefinition,
  currentRank:numberValue(student?.generalRank||student?.genelSirasi,institutionIndex>=0?institutionIndex+1:0)||undefined,
});

const {
  academicDna,
  targetAnalysis,
  aiEvaluation,
  parentSupport,
  successPrediction,
}=intelligence;
  const teacherEvaluation=loadTeacherEvaluation(reportStudentNumber(student));

  return{
    reportTitle:"Bireysel Öğrenci Karnesi V2",
    examName:reportExamName(exam),
    examDate:formatDate(exam?.date||exam?.examDate||exam?.applicationDate),
    reportDate:new Date().toLocaleDateString("tr-TR"),
    reportCode,
    schoolName:loadSchoolName(),
    student:{name:reportStudentName(student),number:reportStudentNumber(student),classroom:reportClassroom(student),branch:student?.branch||student?.subClass||"",photoUrl:findPhoto(student)},
    totals:{correct,wrong,empty,net,score,successRate:totalQuestions?correct/totalQuestions*100:0,classroomAverageNet:classAverage},
    rankings:[
      {label:"Kurum Sırası",rank:institutionRank,participants:ranked.length||"-"},
      {label:"Şube Sırası",rank:classroomRank,participants:classRows.length||"-"},
      {label:"İlçe Sırası",rank:student?.districtRank||student?.ilceSirasi||"-",participants:student?.districtParticipants||student?.ilceKatilim||"-"},
      {label:"Genel Sıra",rank:student?.generalRank||student?.genelSirasi||"-",participants:student?.generalParticipants||student?.genelKatilim||"-"},
    ],
    subjects,
    academicComments:comments,
    studySuggestions:subjects.slice().sort((a,b)=>subjectRate(a)-subjectRate(b)).slice(0,5).map(subject=>({subject:subject.subjectName,suggestion:suggestionFor(subject)})),
    motto:net>=classAverage?"Güçlü yönlerini koru, gelişim alanlarını planlı çalışmayla büyüt.":"Her doğru analiz, bir sonraki başarı için yol gösterir.",
    metadata:{booklet:clean(student?.booklet||student?.bookletType||student?.kitapcik),examType:clean(exam?.type||exam?.examType)},
    premium:{prioritySubjects,weeklyPlan,parentSummary,targetNet,currentNet:net,potentialGain:Number(potentialGain.toFixed(2))},
    academicDna,
    targetAnalysis,
    aiEvaluation,
    parentSupport,
    successPrediction,
    teacherEvaluation,
    intelligence:{
      version:intelligence.version,
      generatedAt:intelligence.generatedAt,
      dataScope:intelligence.dataScope,
      risks:intelligence.risks,
      subjectPriorities:intelligence.subjectPriorities,
      summary:intelligence.summary,
    },
  };
}
