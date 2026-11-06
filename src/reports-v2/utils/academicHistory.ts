import { buildExamResultSources, resolveStudentHistoryRows } from "../../core/results";
import { findStudentMatch, getStudentClassroom, getStudentName, getStudentNumber, normalizeStudentText } from "../../core/student";

export type HistoryPoint={
  examId:string;
  examName:string;
  examDate:string;
  timestamp:number;
  net:number;
  score?:number;
  institutionRank?:number;
  classroomRank?:number;
  subjects:Record<string,{net:number;successRate:number}>;
};

export type AcademicHistoryAnalysis={
  points:HistoryPoint[];
  trend:"rising"|"falling"|"stable"|"fluctuating"|"insufficient";
  trendLabel:string;
  netChange:number|null;
  averageNet:number|null;
  volatility:number|null;
  riskScore:number;
  riskLevel:"low"|"medium"|"high"|"unknown";
  forecast?:{low:number;center:number;high:number;confidence:"low"|"medium"};
  subjectTrends:Array<{subject:string;change:number;latestNet:number;direction:"up"|"down"|"stable"}>;
  riskReasons:string[];
  consistencyScore:number|null;
  dataQuality:"insufficient"|"limited"|"adequate";
};

const normalize=normalizeStudentText;
const number=(value:any,fallback=0)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;};
const studentNumber=getStudentNumber;
const studentName=(item:any)=>normalize(getStudentName(item));
const classroom=(item:any)=>normalize(getStudentClassroom(item));
const examName=(exam:any)=>String(exam?.examName||exam?.name||exam?.title||"Sınav").trim();
const examDate=(exam:any)=>String(exam?.examDate||exam?.date||exam?.applicationDate||exam?.createdAt||"").trim();
const timestamp=(exam:any)=>{const parsed=new Date(examDate(exam)).getTime();return Number.isFinite(parsed)?parsed:0;};

const standardDeviation=(values:number[])=>{
  if(values.length<2)return 0;
  const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
  return Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/values.length);
};

const linearForecast=(values:number[])=>{
  const count=values.length;
  if(count<3)return undefined;
  const xMean=(count-1)/2;
  const yMean=values.reduce((sum,value)=>sum+value,0)/count;
  let numerator=0,denominator=0;
  values.forEach((value,index)=>{numerator+=(index-xMean)*(value-yMean);denominator+=(index-xMean)**2;});
  const slope=denominator?numerator/denominator:0;
  const center=Math.max(0,yMean+slope*(count-xMean));
  const residuals=values.map((value,index)=>value-(yMean+slope*(index-xMean)));
  const spread=Math.max(1,standardDeviation(residuals)*1.5);
  return{low:Math.max(0,center-spread),center,high:center+spread,confidence:count>=5?"medium" as const:"low" as const};
};

export function buildAcademicHistoryAnalysis({
  selectedExam,
  currentResults,
  selectedStudent,
  availableExams,
  evaluateExam,
}:{
  selectedExam:any;
  currentResults:any[];
  selectedStudent:any;
  availableExams:any[];
  evaluateExam?:(exam:any)=>any[];
}):AcademicHistoryAnalysis{
  const sources=buildExamResultSources({
    selectedExam,
    currentResults,
    availableExams,
    evaluateExam,
  });
  const studentSources=resolveStudentHistoryRows({
    selectedStudent,
    sources,
  });
  const points:HistoryPoint[]=[];

  for(const source of studentSources){
    const exam=source.exam;
    const results=source.results;
    const result=source.studentResult;
    if(!result)continue;

    const ranked=[...results].sort((a,b)=>number(b?.totals?.net)-number(a?.totals?.net));
    const classRows=ranked.filter(item=>classroom(item)===classroom(result));
    const subjects:Record<string,{net:number;successRate:number}>={};
    (result?.subjects||[]).forEach((subject:any)=>{
      const name=String(subject?.subjectName||subject?.name||"Ders").trim();
      const total=number(subject?.totalQuestions,number(subject?.correct)+number(subject?.wrong)+number(subject?.empty));
      subjects[name]={net:number(subject?.net),successRate:total?number(subject?.correct)/total*100:0};
    });

    points.push({
      examId:String(exam?.id||exam?.examId||examName(exam)),
      examName:examName(exam),
      examDate:examDate(exam),
      timestamp:timestamp(exam),
      net:number(result?.totals?.net),
      score:Number.isFinite(Number(result?.score??result?.totals?.score))?Number(result?.score??result?.totals?.score):undefined,
      institutionRank:Math.max(1,ranked.findIndex(item=>item===result)+1),
      classroomRank:Math.max(1,classRows.findIndex(item=>item===result)+1),
      subjects,
    });
  }

  const unique=Array.from(new Map(points.map(point=>[point.examId,point])).values()).sort((a,b)=>a.timestamp-b.timestamp).slice(-10);
  const nets=unique.map(point=>point.net);
  const netChange=nets.length>=2?nets[nets.length-1]-nets[0]:null;
  const averageNet=nets.length?nets.reduce((sum,value)=>sum+value,0)/nets.length:null;
  const volatility=nets.length>=2?standardDeviation(nets):null;
  let trend:AcademicHistoryAnalysis["trend"]="insufficient";
  if(nets.length>=3){
    const deltas=nets.slice(1).map((value,index)=>value-nets[index]);
    const positive=deltas.filter(value=>value>0.5).length;
    const negative=deltas.filter(value=>value<-0.5).length;
    if(positive>=deltas.length*.7)trend="rising";
    else if(negative>=deltas.length*.7)trend="falling";
    else if((volatility||0)<=1.5)trend="stable";
    else trend="fluctuating";
  }
  const labels={rising:"Yükselen performans",falling:"Düşüş eğilimi",stable:"İstikrarlı performans",fluctuating:"Dalgalı performans",insufficient:"Geçmiş veri yetersiz"} as const;

  let riskScore=0;
  const riskReasons:string[]=[];
  if(trend==="falling"){riskScore+=45;riskReasons.push("Son sınavlarda toplam net düşüş eğilimindedir.");}
  if(trend==="fluctuating"){riskScore+=20;riskReasons.push("Sınav sonuçları belirgin biçimde dalgalanmaktadır.");}
  if(netChange!==null&&netChange<-5){riskScore+=25;riskReasons.push(`İlk sınava göre ${Math.abs(netChange).toFixed(2)} net kayıp vardır.`);}
  else if(netChange!==null&&netChange<-2){riskScore+=12;riskReasons.push(`İlk sınava göre ${Math.abs(netChange).toFixed(2)} net azalma vardır.`);}
  if((volatility||0)>6){riskScore+=18;riskReasons.push("Net değişkenliği yüksektir; çalışma düzeni ve sınav stratejisi izlenmelidir.");}
  else if((volatility||0)>3){riskScore+=8;riskReasons.push("Net sonuçlarında orta düzeyde oynaklık vardır.");}
  const latest=nets[nets.length-1]||0;
  if(averageNet!==null&&latest<averageNet-3){riskScore+=12;riskReasons.push("Son sınav neti geçmiş ortalamanın belirgin biçimde altındadır.");}
  riskScore=Math.max(0,Math.min(100,riskScore));
  const riskLevel=unique.length<3?"unknown":riskScore>=55?"high":riskScore>=25?"medium":"low";
  const consistencyScore=unique.length<3?null:Math.max(0,Math.min(100,100-(volatility||0)*8));
  const dataQuality=unique.length<2?"insufficient":unique.length<5?"limited":"adequate";

  const subjectNames=Array.from(new Set(unique.flatMap(point=>Object.keys(point.subjects))));
  const subjectTrends=subjectNames.map(subject=>{
    const values=unique.map(point=>point.subjects[subject]?.net).filter(value=>Number.isFinite(value));
    const change=values.length>=2?values[values.length-1]-values[0]:0;
    return{subject,change,latestNet:values[values.length-1]||0,direction:change>.5?"up" as const:change<-.5?"down" as const:"stable" as const};
  }).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change));

  return{
    points:unique,
    trend,
    trendLabel:labels[trend],
    netChange,
    averageNet,
    volatility,
    riskScore,
    riskLevel,
    forecast:linearForecast(nets),
    subjectTrends,
    riskReasons,
    consistencyScore,
    dataQuality,
  };
}
