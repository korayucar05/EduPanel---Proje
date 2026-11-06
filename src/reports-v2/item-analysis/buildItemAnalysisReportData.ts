import { sqliteStorage } from "../../lib/sqliteStorageBridge";
export type ItemOptionStat={
  option:string;
  count:number;
  rate:number;
};

export type ItemRow={
  questionNumber:number;
  subjectName:string;
  correctAnswer:string;
  totalResponses:number;
  correctCount:number;
  wrongCount:number;
  emptyCount:number;
  correctRate:number;
  emptyRate:number;
  difficultyLabel:string;
  qualityLevel:"good"|"warning"|"risk";
  optionStats:ItemOptionStat[];
};

export type ItemAnalysisReportData={
  examName:string;
  schoolName:string;
  generatedAt:string;
  subjectNames:string[];
  selectedSubject:string;
  summary:{
    totalQuestions:number;
    studentCount:number;
    averageCorrectRate:number;
    difficultQuestionCount:number;
    easyQuestionCount:number;
    highEmptyQuestionCount:number;
  };
  items:ItemRow[];
  hardestItems:ItemRow[];
  easiestItems:ItemRow[];
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

const normalize=(value:any)=>String(value||"").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]/g,"");
const n=(value:any)=>Number.isFinite(Number(value))?Number(value):0;
const round=(value:number,digits=1)=>Number(value.toFixed(digits));
const upper=(value:any)=>String(value||"").trim().toLocaleUpperCase("tr-TR");

const extractAnswer=(student:any,subject:any,index:number)=>{
  const storedQuestion=Array.isArray(subject?.questions)?subject.questions[index]:undefined;
  if(storedQuestion)return upper(storedQuestion?.studentAns);
  const directArrays=[
    subject?.studentAnswers,
    subject?.answers,
    subject?.responses,
    student?.studentAnswers,
    student?.answers,
    student?.responses,
  ].filter(Array.isArray);
  for(const arr of directArrays){
    if(arr[index]!==undefined)return upper(arr[index]);
  }
  const keyed=[
    subject?.answerMap,
    subject?.responseMap,
    student?.answerMap,
    student?.responseMap,
  ].filter(Boolean);
  for(const map of keyed){
    const value=map[index+1]??map[String(index+1)];
    if(value!==undefined)return upper(value);
  }
  return "";
};

const extractCorrectAnswer=(subject:any,index:number)=>{
  const storedQuestion=Array.isArray(subject?.questions)?subject.questions[index]:undefined;
  if(storedQuestion)return upper(storedQuestion?.correctAns);
  const arrays=[
    subject?.correctAnswers,
    subject?.answerKey,
    subject?.correctAnswerKey,
  ].filter(Array.isArray);
  for(const arr of arrays){
    if(arr[index]!==undefined)return upper(arr[index]);
  }
  const maps=[subject?.correctAnswerMap,subject?.answerKeyMap].filter(Boolean);
  for(const map of maps){
    const value=map[index+1]??map[String(index+1)];
    if(value!==undefined)return upper(value);
  }
  return "";
};

export function getItemAnalysisSubjectNames(results:any[]){
  return Array.from(new Set(
    (Array.isArray(results)?results:[])
      .flatMap(student=>(student?.subjects||[]).map((subject:any)=>String(subject?.subjectName||subject?.name||"").trim()))
      .filter(Boolean)
  )).sort((a,b)=>a.localeCompare(b,"tr-TR"));
}

export function buildItemAnalysisReportData(exam:any,results:any[],selectedSubject?:string):ItemAnalysisReportData{
  const rows=Array.isArray(results)?results:[];
  const subjectNames=getItemAnalysisSubjectNames(rows);
  const chosen=selectedSubject&&subjectNames.some(item=>normalize(item)===normalize(selectedSubject))
    ? subjectNames.find(item=>normalize(item)===normalize(selectedSubject))!
    : subjectNames[0]||"Ders";

  const selectedSubjects=rows.map(student=>{
    const subject=(student?.subjects||[]).find((item:any)=>normalize(item?.subjectName||item?.name)===normalize(chosen));
    return subject?{student,subject}:null;
  }).filter(Boolean) as Array<{student:any;subject:any}>;

  const totalQuestions=Math.max(
    0,
    ...selectedSubjects.map(({subject})=>
      Math.max(
        n(subject?.totalQuestions),
        Array.isArray(subject?.questions)?subject.questions.length:0,
        Array.isArray(subject?.studentAnswers)?subject.studentAnswers.length:0,
        Array.isArray(subject?.answers)?subject.answers.length:0,
        Array.isArray(subject?.correctAnswers)?subject.correctAnswers.length:0,
        Array.isArray(subject?.answerKey)?subject.answerKey.length:0
      )
    )
  );

  const options=["A","B","C","D","E"];
  const items:ItemRow[]=[];

  for(let index=0;index<totalQuestions;index++){
    let correctAnswer="";
    const optionCounts:Record<string,number>={A:0,B:0,C:0,D:0,E:0};
    let correctCount=0,wrongCount=0,emptyCount=0,totalResponses=0;

    for(const {student,subject} of selectedSubjects){
      const answer=extractAnswer(student,subject,index);
      const currentCorrect=extractCorrectAnswer(subject,index);
      if(currentCorrect&&!correctAnswer)correctAnswer=currentCorrect;
      if(!answer||answer==="-"||answer==="BOŞ"||answer==="BOS"){
        emptyCount++;
        totalResponses++;
        continue;
      }
      if(optionCounts[answer]!==undefined)optionCounts[answer]++;
      totalResponses++;
      if(currentCorrect&&answer===currentCorrect)correctCount++;
      else if(currentCorrect)wrongCount++;
    }

    if(!totalResponses)continue;
    const correctRate=totalResponses?correctCount/totalResponses*100:0;
    const emptyRate=totalResponses?emptyCount/totalResponses*100:0;
    const difficultyLabel=correctRate>=80?"Çok kolay":correctRate>=65?"Kolay":correctRate>=45?"Orta":correctRate>=25?"Zor":"Çok zor";
    const qualityLevel:ItemRow["qualityLevel"]=correctRate<25||emptyRate>=30?"risk":correctRate<45||correctRate>90?"warning":"good";

    items.push({
      questionNumber:index+1,
      subjectName:chosen,
      correctAnswer,
      totalResponses,
      correctCount,
      wrongCount,
      emptyCount,
      correctRate:round(correctRate),
      emptyRate:round(emptyRate),
      difficultyLabel,
      qualityLevel,
      optionStats:options.map(option=>({
        option,
        count:optionCounts[option],
        rate:totalResponses?round(optionCounts[option]/totalResponses*100):0,
      })),
    });
  }

  const hardestItems=[...items].sort((a,b)=>a.correctRate-b.correctRate).slice(0,10);
  const easiestItems=[...items].sort((a,b)=>b.correctRate-a.correctRate).slice(0,10);
  const averageCorrectRate=items.length?items.reduce((sum,item)=>sum+item.correctRate,0)/items.length:0;
  const difficultQuestionCount=items.filter(item=>item.correctRate<45).length;
  const easyQuestionCount=items.filter(item=>item.correctRate>=80).length;
  const highEmptyQuestionCount=items.filter(item=>item.emptyRate>=20).length;

  const attentionItems:ItemAnalysisReportData["attentionItems"]=[];
  if(hardestItems[0]){
    attentionItems.push({
      level:hardestItems[0].correctRate<25?"risk":"warning",
      title:`${hardestItems[0].questionNumber}. soru en zor madde`,
      detail:`Doğru cevaplanma oranı %${hardestItems[0].correctRate.toFixed(1)} düzeyindedir.`,
    });
  }
  if(highEmptyQuestionCount){
    attentionItems.push({
      level:highEmptyQuestionCount>=Math.max(3,items.length*0.2)?"risk":"warning",
      title:`${highEmptyQuestionCount} soruda yüksek boş oranı`,
      detail:"Süre yönetimi, soru kökü anlaşılabilirliği veya konu eksikliği birlikte incelenmelidir.",
    });
  }
  if(easyQuestionCount){
    attentionItems.push({
      level:"info",
      title:`${easyQuestionCount} soru çok kolay`,
      detail:"Ayırt edicilik açısından bu soruların sınav dengesi içindeki ağırlığı gözden geçirilebilir.",
    });
  }
  if(averageCorrectRate>=65){
    attentionItems.push({
      level:"success",
      title:"Genel madde başarısı güçlü",
      detail:`Ortalama doğru cevaplanma oranı %${averageCorrectRate.toFixed(1)} düzeyindedir.`,
    });
  }else{
    attentionItems.push({
      level:"warning",
      title:"Genel madde başarısı geliştirilmeli",
      detail:`Ortalama doğru cevaplanma oranı %${averageCorrectRate.toFixed(1)} düzeyindedir.`,
    });
  }

  const actionPlan:ItemAnalysisReportData["actionPlan"]=[
    {
      priority:1,
      title:"En zor soruları konu/kazanım bazında incele",
      detail:hardestItems.length?`${hardestItems.slice(0,5).map(item=>item.questionNumber).join(", ")} numaralı sorular öncelikle incelenmelidir.`:"Analiz edilebilir soru bulunmadı.",
      owner:"Branş zümresi",
    },
    {
      priority:2,
      title:"Yüksek boş oranlı soruları değerlendir",
      detail:`${highEmptyQuestionCount} soruda boş bırakma oranı %20 ve üzerindedir.`,
      owner:"Ölçme değerlendirme",
    },
    {
      priority:3,
      title:"Çeldirici dağılımlarını kontrol et",
      detail:"Yanlış seçeneklere yığılma olan maddelerde kavram yanılgısı veya soru yazım problemi araştırılmalıdır.",
      owner:"Soru hazırlama ekibi",
    },
    {
      priority:4,
      title:"Çok kolay soruların ağırlığını dengele",
      detail:`${easyQuestionCount} soru %80 ve üzeri doğru cevaplanmıştır.`,
      owner:"Branş zümresi",
    },
    {
      priority:5,
      title:"Bir sonraki sınav için madde kalite hedefi",
      detail:"Orta güçlükte ve dengeli seçenek dağılımına sahip soru oranı artırılmalıdır.",
      owner:"Ölçme değerlendirme",
    },
  ];

  const executiveSummary=items.length
    ? `${chosen} dersinde ${items.length} soru analiz edilmiştir. Ortalama doğru cevaplanma oranı %${averageCorrectRate.toFixed(1)} düzeyindedir. ${difficultQuestionCount} soru zor/çok zor, ${easyQuestionCount} soru çok kolay sınıfındadır. ${highEmptyQuestionCount} soruda yüksek boş oranı görülmüştür. En zor maddelerin konu ve seçenek dağılımları zümre tarafından incelenmelidir.`
    : `${chosen} dersi için soru bazlı cevap verisi bulunamadı. Bu raporun çalışması için öğrenci cevapları ve cevap anahtarı kayıtlarının sınav sonuçlarına eklenmesi gerekir.`;

  let schoolName="Ordu Lisesi";
  try{
    const profile=JSON.parse(sqliteStorage.getItem("school_info_a_profile")||sqliteStorage.getItem("school_info")||"{}");
    schoolName=String(profile?.schoolName||profile?.name||schoolName);
  }catch{}

  return{
    examName:String(exam?.examName||exam?.name||"Sınav"),
    schoolName,
    generatedAt:new Date().toLocaleString("tr-TR"),
    subjectNames,
    selectedSubject:chosen,
    summary:{
      totalQuestions:items.length,
      studentCount:selectedSubjects.length,
      averageCorrectRate:round(averageCorrectRate),
      difficultQuestionCount,
      easyQuestionCount,
      highEmptyQuestionCount,
    },
    items,
    hardestItems,
    easiestItems,
    attentionItems,
    actionPlan,
    executiveSummary,
  };
}
