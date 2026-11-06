import { sqliteStorage } from "../../lib/sqliteStorageBridge";
export type BranchClassroomStat={
  classroom:string;
  studentCount:number;
  averageCorrect:number;
  averageWrong:number;
  averageEmpty:number;
  averageNet:number;
  successRate:number;
};

export type BranchStudentRow={
  name:string;
  classroom:string;
  studentNumber:string;
  correct:number;
  wrong:number;
  empty:number;
  net:number;
  successRate:number;
};

export type BranchReportV2Data={
  examName:string;
  examDate?:string;
  schoolName:string;
  generatedAt:string;
  subjectName:string;
  subjectNames:string[];
  summary:{
    studentCount:number;
    classroomCount:number;
    totalQuestions:number;
    averageCorrect:number;
    averageWrong:number;
    averageEmpty:number;
    averageNet:number;
    successRate:number;
  };
  classrooms:BranchClassroomStat[];
  students:BranchStudentRow[];
  topStudents:BranchStudentRow[];
  riskStudents:BranchStudentRow[];
  scoreBands:Array<{label:string;count:number;rate:number}>;
  executiveSummary:string;
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
};

const n=(value:any)=>Number.isFinite(Number(value))?Number(value):0;
const round=(value:number,digits=2)=>Number(value.toFixed(digits));
const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const normalize=(value:any)=>String(value||"").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]/g,"");
const studentName=(item:any)=>String(item?.studentName||item?.name||item?.fullName||"Öğrenci").trim();
const classroomName=(item:any)=>String(item?.classroom||item?.className||item?.sinif||item?.sınıf||"Sınıfsız").trim();
const studentNumber=(item:any)=>String(item?.studentNumber||item?.studentNo||item?.schoolNumber||item?.number||"-");
const subjectName=(item:any)=>String(item?.subjectName||item?.name||"Ders").trim();

export function getBranchSubjectNames(results:any[]){
  return Array.from(new Set(
    (Array.isArray(results)?results:[])
      .flatMap(item=>(item?.subjects||[]).map(subjectName))
      .filter(Boolean)
  )).sort((a,b)=>a.localeCompare(b,"tr-TR"));
}

export function buildBranchReportV2Data(exam:any,results:any[],selectedSubject?:string):BranchReportV2Data{
  const rows=Array.isArray(results)?results:[];
  const subjectNames=getBranchSubjectNames(rows);
  const chosen=selectedSubject&&subjectNames.some(item=>normalize(item)===normalize(selectedSubject))
    ? subjectNames.find(item=>normalize(item)===normalize(selectedSubject))!
    : subjectNames[0]||"Ders";

  const students:BranchStudentRow[]=rows.map(student=>{
    const subject=(student?.subjects||[]).find((item:any)=>normalize(subjectName(item))===normalize(chosen));
    if(!subject)return null;
    const totalQuestions=Math.max(0,n(subject?.totalQuestions));
    const net=n(subject?.net);
    const successRate=totalQuestions?Math.max(0,Math.min(100,net/totalQuestions*100)):0;
    return{
      name:studentName(student),
      classroom:classroomName(student),
      studentNumber:studentNumber(student),
      correct:round(n(subject?.correct)),
      wrong:round(n(subject?.wrong)),
      empty:round(n(subject?.empty)),
      net:round(net),
      successRate:round(successRate,1),
    };
  }).filter(Boolean) as BranchStudentRow[];

  const classroomNames=Array.from(new Set(students.map(item=>item.classroom))).sort((a,b)=>a.localeCompare(b,"tr-TR",{numeric:true}));
  const classrooms=classroomNames.map(classroom=>{
    const group=students.filter(item=>item.classroom===classroom);
    return{
      classroom,
      studentCount:group.length,
      averageCorrect:round(average(group.map(item=>item.correct))),
      averageWrong:round(average(group.map(item=>item.wrong))),
      averageEmpty:round(average(group.map(item=>item.empty))),
      averageNet:round(average(group.map(item=>item.net))),
      successRate:round(average(group.map(item=>item.successRate)),1),
    };
  }).sort((a,b)=>b.averageNet-a.averageNet);

  const totalQuestions=Math.max(0,...rows.flatMap(student=>(student?.subjects||[])
    .filter((item:any)=>normalize(subjectName(item))===normalize(chosen))
    .map((item:any)=>n(item?.totalQuestions))));
  const successValues=students.map(item=>item.successRate);
  const summary={
    studentCount:students.length,
    classroomCount:classrooms.length,
    totalQuestions,
    averageCorrect:round(average(students.map(item=>item.correct))),
    averageWrong:round(average(students.map(item=>item.wrong))),
    averageEmpty:round(average(students.map(item=>item.empty))),
    averageNet:round(average(students.map(item=>item.net))),
    successRate:round(average(successValues),1),
  };

  const topStudents=[...students].sort((a,b)=>b.net-a.net).slice(0,10);
  const riskStudents=[...students]
    .filter(item=>item.successRate<50||item.empty>=Math.max(2,totalQuestions*0.2))
    .sort((a,b)=>a.successRate-b.successRate)
    .slice(0,15);

  const scoreBands=[
    {label:"0–24",min:0,max:25},
    {label:"25–49",min:25,max:50},
    {label:"50–69",min:50,max:70},
    {label:"70–84",min:70,max:85},
    {label:"85–100",min:85,max:101},
  ].map(band=>{
    const count=students.filter(item=>item.successRate>=band.min&&item.successRate<band.max).length;
    return{label:band.label,count,rate:students.length?round(count/students.length*100,1):0};
  });

  const bestClass=classrooms[0];
  const weakestClass=classrooms[classrooms.length-1];
  const attentionItems:BranchReportV2Data["attentionItems"]=[];
  if(summary.successRate<50){
    attentionItems.push({level:"risk",title:"Ders başarısı kritik eşikte",detail:`Kurum genelinde ${chosen} başarısı %${summary.successRate.toFixed(1)} düzeyindedir.`});
  }else if(summary.successRate<65){
    attentionItems.push({level:"warning",title:"Ders başarısı geliştirilmeli",detail:`Kurum genelinde ${chosen} başarısı %${summary.successRate.toFixed(1)} düzeyindedir.`});
  }else{
    attentionItems.push({level:"success",title:"Ders başarısı güçlü",detail:`Kurum genelinde ${chosen} başarısı %${summary.successRate.toFixed(1)} düzeyindedir.`});
  }
  if(weakestClass){
    attentionItems.push({
      level:bestClass&&bestClass.averageNet-weakestClass.averageNet>=3?"risk":"warning",
      title:`${weakestClass.classroom} şubesi öncelikli izleme alanı`,
      detail:`Şubenin ortalama neti ${weakestClass.averageNet.toFixed(2)}, başarı oranı %${weakestClass.successRate.toFixed(1)} düzeyindedir.`,
    });
  }
  if(riskStudents.length){
    attentionItems.push({
      level:riskStudents.length/Math.max(students.length,1)>=0.25?"risk":"warning",
      title:`${riskStudents.length} öğrenci destek grubunda`,
      detail:"Düşük başarı veya yüksek boş oranı nedeniyle bireysel takip önerilir.",
    });
  }
  if(bestClass){
    attentionItems.push({
      level:"success",
      title:`${bestClass.classroom} örnek sınıf performansı`,
      detail:`${bestClass.averageNet.toFixed(2)} net ortalamasıyla en yüksek şube performansını göstermiştir.`,
    });
  }

  const actionPlan:BranchReportV2Data["actionPlan"]=[
    {
      priority:1,
      title:"Yanlış ve boş kaynaklarını incele",
      detail:`${summary.averageWrong.toFixed(2)} yanlış ve ${summary.averageEmpty.toFixed(2)} boş ortalamasının konu/kazanım dağılımını belirleyin.`,
      owner:"Branş öğretmeni",
    },
    ...(weakestClass?[{
      priority:2,
      title:`${weakestClass.classroom} için hedefli destek`,
      detail:"İki haftalık kısa konu tekrarı ve ölçülebilir soru hedefi uygulayın.",
      owner:"Ders öğretmeni",
    }]:[]),
    ...(riskStudents.length?[{
      priority:3,
      title:"Risk öğrencileriyle mikro çalışma planı",
      detail:`${riskStudents.length} öğrenciye haftalık soru ve net hedefi tanımlayın.`,
      owner:"Ders + rehberlik",
    }]:[]),
    ...(bestClass&&weakestClass&&bestClass.classroom!==weakestClass.classroom?[{
      priority:4,
      title:"İyi uygulama paylaşımı",
      detail:`${bestClass.classroom} şubesindeki etkili uygulamaları ${weakestClass.classroom} ile karşılaştırın.`,
      owner:"Zümre başkanı",
    }]:[]),
    {
      priority:5,
      title:"Sonraki sınav hedefi",
      detail:`Ders ortalama netinde en az ${Math.max(0.5,summary.averageNet*0.08).toFixed(2)} net artış hedefleyin.`,
      owner:"Branş zümresi",
    },
  ];

  const executiveSummary=students.length
    ? `${chosen} dersinde ${students.length} öğrenci analiz edilmiştir. Kurum ortalama neti ${summary.averageNet.toFixed(2)}, başarı oranı %${summary.successRate.toFixed(1)} düzeyindedir. ${bestClass?`${bestClass.classroom} en güçlü şube performansını göstermiştir. `:""}${riskStudents.length?`${riskStudents.length} öğrenci öncelikli destek grubundadır. `:""}Bir sonraki uygulamada yanlış ve boş kaynaklarının konu bazında izlenmesi önerilir.`
    : `${chosen} dersi için analiz edilebilir öğrenci sonucu bulunmamaktadır.`;

  let schoolName="Ordu Lisesi";
  try{
    const profile=JSON.parse(sqliteStorage.getItem("school_info_a_profile")||sqliteStorage.getItem("school_info")||"{}");
    schoolName=String(profile?.schoolName||profile?.name||schoolName);
  }catch{}

  return{
    examName:String(exam?.examName||exam?.name||"Sınav"),
    examDate:String(exam?.examDate||exam?.date||exam?.createdAt||""),
    schoolName,
    generatedAt:new Date().toLocaleString("tr-TR"),
    subjectName:chosen,
    subjectNames,
    summary,
    classrooms,
    students,
    topStudents,
    riskStudents,
    scoreBands,
    executiveSummary,
    attentionItems,
    actionPlan,
  };
}
