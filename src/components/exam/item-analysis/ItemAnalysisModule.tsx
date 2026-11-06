import React, { useEffect, useMemo, useRef, useState } from "react";
import localforage from "../../../core/state/AppStateService";
import { AlertTriangle, BarChart3, BookOpen, Eye, FileSpreadsheet, History, Loader2, Save, Search, Sparkles, Target, TrendingUp, Users, XCircle } from "lucide-react";
import { fetchCollectionFromLocalDatabase, upsertLocalDocument } from "../../../core/data/LegacyDatabaseFacade";
import { exportTablePdf } from "../../../utils/tablePdf";
import { compareClassroomNames } from "../../../utils/classroomSort";
import { getQuestionCorrectAnswer } from "../../../utils/questionAnswer";
import { examLearningAnalysisService } from "../../../modules/exam/ExamLearningAnalysisService";
import { examPipelineService } from "../../../modules/exam/ExamPipelineService";

type Tab = "overview" | "items" | "outcomes" | "decisions";
type Decision = "İncelenmedi" | "Kullanılabilir" | "Cevap anahtarı değiştirildi" | "Soru iptal edildi" | "İnceleme gerekli";
type Review = { decision: Decision; note: string; updatedAt: string; updatedBy: string };
type Item = { key:string; no:number; originalIndex:number; bookletNumbers:Partial<Record<string,number>>; subject:string; outcome:string; answer:string; correct:number; wrong:number; blank:number; difficulty:number; discrimination:number; upper:number; lower:number; choices:Record<string,number>; choiceCounts:Record<string,number>; status:string };
const LETTERS = ["A","B","C","D","E"];
const STORE = "item_analysis_reviews_v1";
const ANALYSIS_QUESTION_IMAGE_STORE = "exam_analysis_question_images";
type StoredQuestionImage = { name:string; type:string; blob:Blob };

const classroomName = (v:string) => (v || "Sınıfsız").trim().replace(/^-\s*/, "").replace(/(\d+)\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)/g, "$1-$2");
const mappedIndex = (
  booklet:string,
  index:number,
  count:number,
) => {
  const normalized = String(booklet || "A").toUpperCase().trim();

  if (normalized === "B") return count - 1 - index;
  if (normalized === "C") return (index + Math.floor(count / 2)) % count;
  if (normalized === "D") {
    return count - 1 - ((index + Math.floor(count / 3)) % count);
  }

  return index;
};

const isPrintedPublicationExam = (exam:any) =>
  String(exam?.examSource || "").trim() === "Basılı Yayın";

const referenceIndexForPrintedPosition = (
  exam:any,
  subject:string,
  booklet:string,
  printedPosition:number,
  count:number,
) => {
  const normalizedBooklet = String(booklet || "A").toUpperCase().trim();

  // ExamAnalysisModule ile aynı kural:
  // Basılı Yayın sınavlarında kayıtlı bookletNumbers kullanılır.
  if (isPrintedPublicationExam(exam)) {
    const questions = exam?.questions?.[subject] || {};

    for (let referenceIndex = 0; referenceIndex < count; referenceIndex += 1) {
      const savedPosition = Number(
        questions?.[referenceIndex]?.bookletNumbers?.[normalizedBooklet],
      );

      if (
        Number.isFinite(savedPosition) &&
        savedPosition === printedPosition
      ) {
        return referenceIndex;
      }
    }
  }

  // Sistem sınavlarında ExamAnalysisModule ile aynı deterministik dönüşüm.
  return mappedIndex(
    normalizedBooklet,
    printedPosition - 1,
    count,
  );
};

const printedPositionForReference = (
  exam:any,
  subject:string,
  booklet:string,
  referenceIndex:number,
  count:number,
) => {
  const normalizedBooklet = String(booklet || "A").toUpperCase().trim();

  if (isPrintedPublicationExam(exam)) {
    const explicitPosition = Number(
      exam?.questions?.[subject]?.[referenceIndex]
        ?.bookletNumbers?.[normalizedBooklet],
    );

    if (
      Number.isFinite(explicitPosition) &&
      explicitPosition >= 1 &&
      explicitPosition <= count
    ) {
      return explicitPosition;
    }
  }

  for (let printedPosition = 1; printedPosition <= count; printedPosition += 1) {
    if (
      referenceIndexForPrintedPosition(
        exam,
        subject,
        normalizedBooklet,
        printedPosition,
        count,
      ) === referenceIndex
    ) {
      return printedPosition;
    }
  }

  return referenceIndex + 1;
};

const answerForReference = (
  exam:any,
  subject:string,
  referenceIndex:number,
) => getQuestionCorrectAnswer(exam?.questions?.[subject]?.[referenceIndex]).toUpperCase();

const totalQuestionCountForExam = (exam:any) =>
  (exam?.examStructure || []).reduce(
    (examTotal:number, test:any) =>
      examTotal +
      (test?.subjects || []).reduce(
        (testTotal:number, subject:any) =>
          testTotal + Number(subject?.count || 0),
        0,
      ),
    0,
  );

const normalizedRecordAnswers = (exam:any, record:any) => {
  const totalQuestionCount = totalQuestionCountForExam(exam);

  // Boşluk, yıldız, nokta ve geçersiz karakterleri SİLME.
  // Her biri bir soru konumunu temsil ettiği için "-" olarak koru.
  return String(record?.answers || "")
    .toLocaleUpperCase("tr-TR")
    .split("")
    .map((character) =>
      LETTERS.includes(character) ? character : "-",
    )
    .join("")
    .padEnd(totalQuestionCount, "-")
    .slice(0, totalQuestionCount);
};

const studentAnswerForReference = (
  exam:any,
  record:any,
  subject:string,
  subjectCursor:number,
  referenceIndex:number,
  count:number,
) => {
  const booklet = String(record?.bookletType || "A").toUpperCase().trim();
  const printedPosition = printedPositionForReference(
    exam,
    subject,
    booklet,
    referenceIndex,
    count,
  );

  const answers = normalizedRecordAnswers(exam, record);
  const answer = String(
    answers[subjectCursor + printedPosition - 1] || "-",
  ).toUpperCase();

  return {
    answer,
    booklet,
    printedPosition,
  };
};

const itemStatus = (p:number, d:number) => d < 0 ? "İptal değerlendirilmeli" : d < .20 ? "Ayırt ediciliği düşük" : p < .20 ? "Çok zor" : p > .90 ? "Çok kolay" : "Uygun";

const qualityScore = (item: Item) => {
  const discriminationScore = Math.max(0, Math.min(1, item.discrimination / .40));
  const difficultyScore = Math.max(0, 1 - Math.abs(item.difficulty - .55) / .55);
  const workingDistractors = LETTERS.filter(letter => letter !== item.answer && item.choices[letter] >= 5).length;
  const distractorScore = workingDistractors / 4;
  const blankScore = Math.max(0, 1 - item.blank / 35);
  return Math.round(discriminationScore * 40 + difficultyScore * 25 + distractorScore * 20 + blankScore * 15);
};

const answerSuspicion = (item: Item) => {
  const strongestWrong = Math.max(...LETTERS.filter(letter => letter !== item.answer).map(letter => item.choices[letter] || 0));
  return item.discrimination < 0 || strongestWrong >= item.correct + 12;
};

const functionalDistractorCount = (item: Item) => LETTERS.filter(letter => letter !== item.answer && item.choices[letter] >= 5).length;

const choiceTone = (item: Item, letter: string) => {
  if (letter !== item.answer) return "border-slate-200 bg-slate-50 text-slate-700";
  if (item.correct < 20) return "border-rose-300 bg-rose-100 text-rose-800 ring-1 ring-rose-300";
  if (item.correct < 40) return "border-orange-300 bg-orange-100 text-orange-800 ring-1 ring-orange-300";
  if (item.correct < 60) return "border-amber-300 bg-amber-100 text-amber-800 ring-1 ring-amber-300";
  return "border-emerald-300 bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300";
};

function classroomComparison(exam:any, item:Item) {
  return examLearningAnalysisService.classroomComparison(exam, item);
}

export function analyzeItems(
  exam:any,
  classroom:string,
  subjectFilter:string,
):Item[] {
  if (!exam) return [];
  try {
    return examLearningAnalysisService.buildItems(exam, classroom, subjectFilter) as Item[];
  } catch {
    return [];
  }
}


const correctStudentsForItem = (
  exam: any,
  item: Item,
  classroomFilter: string,
) => examLearningAnalysisService.correctStudents(exam, item, classroomFilter);


const pedagogicalClassification = (rate:number,isCorrect:boolean) => {
  if (rate >= 85) return isCorrect
    ? {label:"Beklenen Başarı",explanation:"Bu kazanımda beklenen düzeyde bir performans sergilenmiştir."}
    : {label:"Dikkat Gerektiriyor",explanation:"Bu kazanımın kısa bir tekrar ve benzer örneklerle pekiştirilmesi yararlı olabilir."};
  if (rate >= 70) return isCorrect
    ? {label:"Başarılı",explanation:"Bu kazanımda genel olarak başarılı bir performans gösterilmiştir."}
    : {label:"Geliştirilmeli",explanation:"Bu kazanımın ek alıştırmalarla geliştirilmesi öğrenmeyi destekleyebilir."};
  if (rate >= 50) return isCorrect
    ? {label:"İyi Performans",explanation:"Bu kazanımda iyi bir performans ortaya konmuştur."}
    : {label:"Eksik Kazanım",explanation:"Bu kazanımın temel noktalarının yeniden ele alınması faydalı olabilir."};
  if (rate >= 30) return isCorrect
    ? {label:"Önemli Başarı",explanation:"Zorlayıcı bir soruda anlamlı bir başarı gösterilmiştir."}
    : {label:"Kritik Kazanım",explanation:"Bu kazanım için rehberli tekrar ve aşamalı soru çözümü önerilebilir."};
  if (rate >= 15) return isCorrect
    ? {label:"Üst Düzey Başarı",explanation:"Zorlayıcı bir kazanımda güçlü bir performans sergilenmiştir."}
    : {label:"Zorlayıcı Kazanım",explanation:"Bu kazanımın küçük adımlarla ve örneklerle yeniden çalışılması destekleyici olabilir."};
  return isCorrect
    ? {label:"Seçkin Başarı",explanation:"Oldukça zorlayıcı bir soruda dikkat çekici bir başarı gösterilmiştir."}
    : {label:"İleri Destek Önerilir",explanation:"Bu kazanım için bireyselleştirilmiş destek ve ek çalışma yararlı olabilir."};
};

const classPedagogicalDetailsForItem = (exam:any,item:Item,classroomFilter:string) => {
  const summary = correctStudentsForItem(exam,item,classroomFilter);
  const results = (exam?.evaluationResults || []).filter(
    (record:any) => classroomFilter === "Tümü" || classroomName(record?.classroom) === classroomFilter
  );
  const rateMap = new Map(summary.classStats.map((row:any)=>[
    row.classroom, row.total > 0 ? Number(((row.correct / row.total) * 100).toFixed(1)) : 0
  ]));
  const grouped = new Map<string,any[]>();
  results.forEach((record:any)=>{
    const classroom = classroomName(record?.classroom || "") || "Sınıfsız";
    const subjectResult = (record?.subjects || []).find((entry:any)=>entry?.subjectName===item.subject);
    const question = (subjectResult?.questions || []).find((entry:any)=>Number(entry?.originalIndex)===Number(item.originalIndex));
    if(!question) return;
    const rate = Number(rateMap.get(classroom) || 0);
    const isEmpty = Boolean(question.isEmpty);
    const isCorrect = Boolean(question.isCorrect);
    const status = isEmpty ? "empty" : isCorrect ? "correct" : "wrong";
    const pedagogical = pedagogicalClassification(rate,isCorrect);
    const name = String(record?.studentName || "İsimsiz Öğrenci").replace(/\s+/g," ").trim();
    const student = {
      id:String(record?.recordId || record?.studentNumber || name),
      name, number:String(record?.studentNumber || ""), classroom, status,
      classification:pedagogical.label, explanation:pedagogical.explanation,
    };
    const list = grouped.get(classroom) || []; list.push(student); grouped.set(classroom,list);
  });
  const studentsByClass = Array.from(grouped.entries())
    .map(([classroom,students])=>({classroom,students:students.sort((a:any,b:any)=>a.name.localeCompare(b.name,"tr-TR",{sensitivity:"base"}))}))
    .sort((a,b)=>a.classroom.localeCompare(b.classroom,"tr-TR",{numeric:true,sensitivity:"base"}));
  return {classStats:summary.classStats,studentsByClass};
};

const TONES:Record<string,string>={"Uygun":"bg-emerald-50 text-emerald-700 border-emerald-200","Çok kolay":"bg-sky-50 text-sky-700 border-sky-200","Çok zor":"bg-amber-50 text-amber-700 border-amber-200","Ayırt ediciliği düşük":"bg-orange-50 text-orange-700 border-orange-200","İptal değerlendirilmeli":"bg-rose-50 text-rose-700 border-rose-200"};
const Card=({icon:Icon,title,value,subtitle,onClick}:any)=><button onClick={onClick} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:shadow-md"><div className="flex items-center gap-3"><span className="rounded-xl bg-orange-50 p-3 text-orange-700"><Icon className="h-5 w-5"/></span><span><small className="block font-black uppercase tracking-wider text-slate-400">{title}</small><b className="text-xl text-slate-900">{value}</b><small className="block text-slate-400">{subtitle}</small></span></div></button>;

export default function ItemAnalysisModule({
  embedded = false,
  selectedExamId,
  exam: providedExam,
  results: providedResults,
}: {
  embedded?: boolean;
  selectedExamId?: string;
  exam?: any;
  results?: any[];
}){
  const analysisRef=useRef<HTMLDivElement>(null);
  const [exams,setExams]=useState<any[]>([]),[examId,setExamId]=useState(""),[classroom,setClassroom]=useState("Tümü"),[subject,setSubject]=useState("Tümü"),[query,setQuery]=useState(""),[sortOrder,setSortOrder]=useState<"asc"|"desc">("asc"),[selectedKey,setSelectedKey]=useState(""),[tab,setTab]=useState<Tab>("items"),[reviews,setReviews]=useState<Record<string,Review>>({});
  const [questionImages,setQuestionImages]=useState<Record<string,Record<number,StoredQuestionImage>>>({});
  const [questionPreview,setQuestionPreview]=useState<{url:string;title:string;revoke?:boolean}|null>(null);
  const [correctStudentsModal,setCorrectStudentsModal]=useState<{
    item:Item;
    students:Array<{id:string;name:string;number:string;classroom:string}>;
    classStats:Array<{
      classroom:string;
      correct:number;
      wrong:number;
      empty:number;
      total:number;
    }>;
  }|null>(null);
  const [classPedagogicalModal,setClassPedagogicalModal]=useState<any|null>(null);
  useEffect(()=>{
    Promise.all([
      localforage.getItem<Record<string,Review>>(STORE),
      fetchCollectionFromLocalDatabase("itemAnalysisReviews").catch(()=>[]),
      providedExam ? Promise.resolve([]) : examPipelineService.listEvaluated().catch(()=>[]),
    ]).then(([local,stored,saved])=>{
      setReviews({
        ...(local||{}),
        ...Object.fromEntries((stored||[]).map((x:any)=>[x.id,x.review])),
      });

      // Sınav Analiz ekranı aktif sınavı zaten bulmuşsa onu TEK KAYNAK olarak kullan.
      // Böylece Madde Analizi ikinci kez listEvaluated() çağırıp farklı filtreye düşmez.
      if (providedExam) {
        const examWithResults =
          Array.isArray(providedResults) && providedResults.length > 0
            ? { ...providedExam, evaluationResults: providedResults }
            : providedExam;
        setExams([examWithResults]);
        setExamId(String(providedExam?.id || selectedExamId || ""));
        return;
      }

      const valid=(saved||[]).filter(
        (e:any)=>Array.isArray(e?.evaluationResults)&&e.evaluationResults.length>0
      );
      setExams(valid);
      setExamId(
        selectedExamId&&valid.some((e:any)=>String(e.id)===String(selectedExamId))
          ? selectedExamId
          :(valid[0]?.id||"")
      );
    });
  },[providedExam,providedResults,selectedExamId]);

  useEffect(()=>{
    if(selectedExamId)setExamId(selectedExamId);
    else if(providedExam?.id)setExamId(String(providedExam.id));
  },[selectedExamId,providedExam?.id]);
  useEffect(()=>{localforage.getItem<Record<string,Record<string,Record<number,StoredQuestionImage>>>>(ANALYSIS_QUESTION_IMAGE_STORE).then(stored=>setQuestionImages(stored?.[examId]||{}));},[examId]);
  useEffect(()=>()=>{if(questionPreview?.url&&questionPreview?.revoke)URL.revokeObjectURL(questionPreview.url);},[questionPreview?.url,questionPreview?.revoke]);
  const exam=providedExam
    ? (
        Array.isArray(providedResults) && providedResults.length > 0
          ? { ...providedExam, evaluationResults: providedResults }
          : providedExam
      )
    : exams.find(e=>String(e.id)===String(examId)), classrooms=useMemo(()=>["Tümü",...(Array.from(new Set((exam?.evaluationResults||[]).map((r:any)=>classroomName(r.classroom)))) as string[]).sort(compareClassroomNames)],[exam]), subjects=useMemo(()=>["Tümü",...Array.from(new Set((exam?.examStructure||[]).flatMap((t:any)=>(t.subjects||[]).map((s:any)=>s.name)))) as string[]],[exam]);
  const questionImageSource=(item:Item)=>{
    const stored=questionImages[item.subject]?.[item.bookletNumbers.A||item.no];
    if(stored?.blob)return{url:URL.createObjectURL(stored.blob),revoke:true};
    const source=exam?.questions?.[item.subject]?.[item.originalIndex]||exam?.questions?.[item.subject]?.[String(item.originalIndex)]||{};
    const url=String(source?.imageUrl||source?.questionImageUrl||"").trim();
    return url?{url,revoke:false}:null;
  };
  const hasQuestionImage=(item:Item)=>Boolean(
    questionImages[item.subject]?.[item.bookletNumbers.A||item.no]?.blob||
    exam?.questions?.[item.subject]?.[item.originalIndex]?.imageUrl||
    exam?.questions?.[item.subject]?.[String(item.originalIndex)]?.imageUrl||
    exam?.questions?.[item.subject]?.[item.originalIndex]?.questionImageUrl||
    exam?.questions?.[item.subject]?.[String(item.originalIndex)]?.questionImageUrl
  );
  const openQuestionImage=(item:Item)=>{
    const source=questionImageSource(item);
    if(!source)return;
    setQuestionPreview({url:source.url,revoke:source.revoke,title:`${item.subject} · A Kitapçığı Soru ${item.bookletNumbers.A||item.no}`});
  };
  const rows=useMemo(()=>analyzeItems(exam,classroom,subject),[exam,classroom,subject]), selected=rows.find(r=>r.key===selectedKey)||rows[0], participants=(exam?.evaluationResults||[]).filter((r:any)=>classroom==="Tümü"||classroomName(r.classroom)===classroom).length, average=rows.length?Math.round(rows.reduce((s,r)=>s+r.correct,0)/rows.length):0;
  const filtered=rows
    .filter(r=>`${r.no} ${r.subject} ${r.outcome}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")))
    .sort((a,b)=>sortOrder==="asc" ? a.correct-b.correct : b.correct-a.correct);
  const exportCsv=()=>{const lines=[["Soru","Ders","Kazanım","Doğru %","Yanlış %","Boş %","Güçlük","Ayırt Edicilik","Durum","Karar"],...rows.map(r=>[r.no,r.subject,r.outcome,r.correct,r.wrong,r.blank,r.difficulty.toFixed(2),r.discrimination.toFixed(2),r.status,reviews[`${examId}:${r.key}`]?.decision||"İncelenmedi"])];const url=URL.createObjectURL(new Blob(["\ufeff"+lines.map(x=>x.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n")],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="madde-analizi.csv";a.click();URL.revokeObjectURL(url);};
  const exportPdf=async()=>{
    const grouped=filtered.reduce<Record<string,Item[]>>((map,row)=>{map[row.subject]||=[];map[row.subject].push(row);return map},{});
    const choiceCell=(row:Item,letter:string)=>{const correct=letter===row.answer;const background=!correct?"#f8fafc":row.correct<20?"#ffe4e6":row.correct<40?"#ffedd5":row.correct<60?"#ecfccb":row.correct<80?"#d1fae5":"#a7f3d0";const color=!correct?"#475569":row.correct<20?"#be123c":row.correct<40?"#c2410c":row.correct<60?"#4d7c0f":row.correct<80?"#047857":"#065f46";return {text:row.choiceCounts[letter]||0,background,color,bold:correct,boxed:true}};
    const sections:any[]=[];
    for(const [subjectName,subjectRows] of Object.entries(grouped) as [string, Item[]][]){
      const reportRows=subjectRows.map(row=>{
        const questionNumber=row.bookletNumbers.B?`A:${row.bookletNumbers.A}  B:${row.bookletNumbers.B}`:`A:${row.bookletNumbers.A}`;
        const statusCell={text:row.status,background:row.status==="Uygun"?"#d1fae5":row.status.includes("İptal")?"#ffe4e6":"#ffedd5",color:row.status==="Uygun"?"#047857":row.status.includes("İptal")?"#be123c":"#c2410c",bold:true};
        return [questionNumber,row.outcome,row.correct,row.wrong,row.blank,...LETTERS.map(letter=>choiceCell(row,letter)),statusCell];
      });
      sections.push({title:subjectName,subtitle:`${subjectRows.length} soru`,headers:["A/B Soru","Kazanım","Doğru","Yanlış","Boş","A","B","C","D","E","Durum"],widths:[8,30,6,6,6,5,5,5,5,5,19],rows:reportRows});
    }
    await exportTablePdf(`${exam?.examName||"sinav"}-madde-analizi.pdf`,"Madde Analizi",sections,{orientation:"portrait",rowsPerPage:16,designedHeader:{variant:"analysis",accent:"item",schoolName:exam?.schoolName||exam?.institutionName||"ORDU LİSESİ",examName:exam?.examName||"Sınav",examDate:exam?.examDate,reportName:"MADDE ANALİZİ",meta:[{label:"DERS",value:subject},{label:"SORU",value:filtered.length},{label:"KATILIM",value:participants}]}});
  };
  if(!exam)return <div className="m-6 rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center"><AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-600"/><h2 className="text-xl font-black">Analiz edilecek sınav bulunamadı</h2><p className="mt-2 text-sm text-slate-600">Sınav Analizi tarafından seçilmiş aktif sınav bulunamadı.</p></div>;
  return <><main className={embedded ? "pt-2" : "min-h-screen bg-slate-50 p-4 md:p-6"}><div className="mx-auto max-w-[1600px] space-y-4">
    {!embedded&&<header className="flex flex-col justify-between gap-4 rounded-3xl border border-orange-100 bg-white p-5 shadow-sm md:flex-row md:items-center"><div className="flex items-center gap-3"><span className="rounded-2xl bg-orange-800 p-3 text-white"><BarChart3/></span><div><h1 className="text-2xl font-black">Madde Analizi</h1><p className="text-xs font-bold text-slate-400">Gerçek sınav cevaplarından ölçme ve değerlendirme</p></div></div></header>}
    {!embedded&&<section className={`grid gap-3 rounded-3xl border border-orange-200 bg-orange-50/30 p-4 shadow-sm ${embedded ? "md:grid-cols-[1fr_1fr_auto]" : "md:grid-cols-3"}`}>{!embedded&&<Select label="Sınav" value={examId} onChange={setExamId} options={exams.map(e=>[e.id,e.examName||e.name||"Adsız sınav"])}/>}<Select label="Sınıf / Şube" value={classroom} onChange={setClassroom} options={classrooms.map(x=>[x,x])}/><Select label="Ders" value={subject} onChange={setSubject} options={subjects.map(x=>[x,x])}/>{embedded&&<button onClick={exportCsv} className="flex items-center justify-center gap-2 self-end rounded-xl bg-orange-800 hover:bg-orange-900 px-4 py-2.5 text-xs font-black text-white"><FileSpreadsheet className="h-4 w-4"/>Excel'e Aktar</button>}</section>}
    {<div ref={analysisRef} className="w-full bg-white"><section className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="grid gap-2 border-b p-4 sm:grid-cols-3"><select aria-label="Sınıf veya şube seç" value={classroom} onChange={e=>setClassroom(e.target.value)} className="w-full rounded-xl border border-orange-200 bg-orange-50/40 px-3 py-2 text-xs font-black text-orange-950 outline-none focus:ring-2 focus:ring-orange-300">{classrooms.map(x=><option key={x} value={x}>{x==="Tümü"?"Tüm Sınıf / Şubeler":x}</option>)}</select><select aria-label="Ders seç" value={subject} onChange={e=>setSubject(e.target.value)} className="w-full rounded-xl border border-orange-200 bg-orange-50/40 px-3 py-2 text-xs font-black text-orange-950 outline-none focus:ring-2 focus:ring-orange-300">{subjects.map(x=><option key={x} value={x}>{x==="Tümü"?"Tüm Dersler":x}</option>)}</select><select aria-label="Başarı sıralaması" value={sortOrder} onChange={e=>setSortOrder(e.target.value as "asc"|"desc")} className="w-full rounded-xl border border-orange-200 bg-orange-50/40 px-3 py-2 text-xs font-black text-orange-950 outline-none focus:ring-2 focus:ring-orange-300"><option value="asc">Artan başarı</option><option value="desc">Azalan başarı</option></select></div><div className="grid gap-4 border-b bg-slate-50/70 p-4 lg:grid-cols-2">{([{title:"En Zor 10 Soru",rows:[...filtered].sort((a,b)=>a.correct-b.correct).slice(0,10),tone:"border-rose-200 bg-rose-50/60",bar:"bg-rose-600"},{title:"En Kolay 10 Soru",rows:[...filtered].sort((a,b)=>b.correct-a.correct).slice(0,10),tone:"border-emerald-200 bg-emerald-50/60",bar:"bg-emerald-600"}] as const).map(panel=><section key={panel.title} className={`rounded-2xl border p-4 ${panel.tone}`}><h2 className="mb-3 text-xs font-black text-slate-900">{panel.title}</h2><div className="space-y-2">{panel.rows.map(row=><div key={row.key} className="grid grid-cols-[62px_minmax(80px,1fr)_48px_52px] items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[10px]"><strong>{row.no}. Soru</strong><div className="h-1.5 overflow-hidden rounded-full bg-white"><div className={`h-full ${panel.bar}`} style={{width:`${Math.max(2,Math.min(100,row.correct))}%`}}/></div><strong className="text-right">%{row.correct.toFixed(1)}</strong><span className="text-right text-slate-500">Boş %{row.blank.toFixed(1)}</span></div>)}{!panel.rows.length&&<p className="py-2 text-center text-[10px] font-bold text-slate-400">Gösterilecek soru yok.</p>}</div></section>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{["Kitapçık / Soru","Ders / Kazanım","Doğru","Yanlış","Boş","A","B","C","D","E","Sınıf Değerlendirmesi"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{filtered.map(r=>{const hasImage=hasQuestionImage(r);return <tr key={r.key} className="border-t transition hover:bg-orange-50/50"><td className="px-4 py-2"><div className="flex min-w-[72px] items-center gap-1.5"><button type="button" disabled={!hasImage} onClick={()=>openQuestionImage(r)} title={hasImage?"Soru görselini aç":"Bu soru için görsel bulunamadı"} className={`rounded-lg px-2 py-1 text-[10px] font-black text-white ${hasImage?"cursor-pointer bg-orange-800 ring-2 ring-orange-200 hover:bg-orange-900":"cursor-default bg-orange-800"}`}>A · {r.bookletNumbers.A}</button>{r.bookletNumbers.B&&<span className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-800">B · {r.bookletNumbers.B}</span>}</div></td><td className="max-w-64 px-4"><b>{r.subject}</b><p className="truncate text-[10px] text-slate-400">{r.outcome}</p></td><td className="px-4 font-black text-emerald-600">%{r.correct}</td><td className="px-4 text-rose-600">%{r.wrong}</td><td className="px-4">%{r.blank}</td>{LETTERS.map(letter=><td key={letter} className="px-2 py-2 text-center">{letter===r.answer?<button type="button" onClick={()=>{
  const detail=correctStudentsForItem(exam,r,classroom);
  setCorrectStudentsModal({
    item:r,
    students:detail.students,
    classStats:detail.classStats,
  });
}} title={`${letter} doğru seçeneğini işaretleyen öğrencileri göster`} className={`inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg border px-2 text-xs font-black transition hover:scale-105 hover:shadow ${choiceTone(r,letter)}`}>{r.choiceCounts[letter]||0}</button>:<span title={`${letter} seçeneğini ${r.choiceCounts[letter]||0} öğrenci işaretledi`} className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-black ${choiceTone(r,letter)}`}>{r.choiceCounts[letter]||0}</span>}</td>)}<td className="px-4">
  <button
    type="button"
    onClick={()=>{
      const detail=classPedagogicalDetailsForItem(exam,r,classroom);
      setClassPedagogicalModal({item:r,...detail});
    }}
    className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] font-black text-indigo-700 transition hover:bg-indigo-100 hover:shadow-sm"
    title="Sınıf bazlı pedagojik değerlendirmeyi göster"
  >
    Sınıf Değerlendirmesi
  </button>
</td></tr>})}</tbody></table></div></section></div>}
  </div></main>
  {questionPreview&&(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={()=>setQuestionPreview(null)}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event=>event.stopPropagation()}>
        <header className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="font-black text-slate-850">{questionPreview.title}</h3>
          <button type="button" onClick={()=>setQuestionPreview(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><XCircle className="h-5 w-5"/></button>
        </header>
        <div className="min-h-0 overflow-auto bg-slate-100 p-4">
          <img src={questionPreview.url} alt={questionPreview.title} className="mx-auto max-h-[78vh] max-w-full rounded-lg bg-white object-contain shadow"/>
        </div>
      </div>
    </div>
  )}
  {correctStudentsModal&&(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={()=>setCorrectStudentsModal(null)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={event=>event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h3 className="font-black text-slate-900">
              Doğru Cevaplayan Öğrenciler
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {correctStudentsModal.item.subject} · Soru{" "}
              {correctStudentsModal.item.bookletNumbers.A ||
                correctStudentsModal.item.no} · Doğru cevap:{" "}
              {correctStudentsModal.item.answer}
            </p>
          </div>
          <button
            type="button"
            onClick={()=>setCorrectStudentsModal(null)}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
            title="Kapat"
          >
            <XCircle className="h-5 w-5"/>
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
            Toplam {correctStudentsModal.students.length} öğrenci doğru cevapladı.
          </div>

          {correctStudentsModal.students.length>0?(
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
              {correctStudentsModal.students.map((student,index)=>(
                <div
                  key={`${student.id}-${index}`}
                  className="flex items-center justify-between gap-3 bg-white px-4 py-3 hover:bg-slate-50"
                >
                  <div className="text-xs font-black text-slate-900">
                    {student.number||"-"} · {student.name}
                  </div>

                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">
                    {student.classroom||"Sınıfsız"}
                  </span>
                </div>
              ))}
            </div>
          ):(
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-xs font-bold text-slate-500">
              Bu soruyu doğru cevaplayan öğrenci bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  )}

  {classPedagogicalModal&&(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={()=>setClassPedagogicalModal(null)}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={event=>event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h3 className="font-black text-slate-900">{classPedagogicalModal.item.subject} - Soru Bazlı Sınıflar Başarı Durumu</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {classPedagogicalModal.item.subject} · Soru{" "}
              {classPedagogicalModal.item.bookletNumbers.A || classPedagogicalModal.item.no}
            </p>
          </div>
          <button
            type="button"
            onClick={()=>setClassPedagogicalModal(null)}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
            title="Kapat"
          >
            <XCircle className="h-5 w-5"/>
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-4">
          {(() => {
            const totalCorrect = classPedagogicalModal.classStats.reduce(
              (sum: number, row: any) => sum + Number(row?.correct || 0),
              0,
            );
            const totalStudents = classPedagogicalModal.classStats.reduce(
              (sum: number, row: any) => sum + Number(row?.total || 0),
              0,
            );
            const generalRate =
              totalStudents > 0
                ? Number(((totalCorrect / totalStudents) * 100).toFixed(1))
                : 0;

            const classGuidance = (rate: number) => {
              if (rate >= 85) {
                return "Sınıf bu soruda beklenen başarı düzeyine ulaşmıştır; benzer sorularla pekiştirme yeterli olabilir.";
              }
              if (rate >= 70) {
                return "Sınıf bu soruda başarılı bir performans göstermiştir; kısa tekrarlarla öğrenme kalıcı hale getirilebilir.";
              }
              if (rate >= 50) {
                return "Sınıfın önemli bir bölümü soruyu doğru cevaplamıştır; eksik kalan noktalar hedefli tekrarlarla desteklenebilir.";
              }
              if (rate >= 30) {
                return "Bu sorunun bağlı olduğu kazanım sınıf genelinde yeniden ele alınmalı ve rehberli soru çözümüyle desteklenmelidir.";
              }
              if (rate >= 15) {
                return "Soru sınıf için genel olarak zorlayıcı olmuştur; kazanımın küçük adımlarla ve örneklerle yeniden işlenmesi yararlı olabilir.";
              }
              return "Soru sınıf genelinde oldukça zorlayıcı olmuştur; kazanım için daha ayrıntılı öğretim ve ek destek planlanması uygun olabilir.";
            };

            return (
              <div className="space-y-4">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-center">
                  <div className="text-[10px] font-black uppercase text-indigo-600">
                    Genel Doğru Yapılma Oranı
                  </div>
                  <div className="mt-1 text-3xl font-black text-indigo-800">
                    %{generalRate}
                  </div>
                </div>

                {classPedagogicalModal.classStats.map(
                  (stats: any, index: number) => {
                    const classRate =
                      stats?.total > 0
                        ? Number(
                            ((stats.correct / stats.total) * 100).toFixed(1),
                          )
                        : 0;

                    return (
                      <section
                        key={`${stats.classroom}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900">
                              {stats.classroom}
                            </h4>
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">
                              %{classRate}
                            </span>
                          </div>

                          <div
                            className={`rounded-xl px-3 py-2 text-xs font-black ${
                              classRate >= generalRate
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {classRate > generalRate
                              ? "Genel ortalamanın üzerinde"
                              : classRate < generalRate
                                ? "Genel ortalamanın altında"
                                : "Genel ortalama ile aynı"}
                          </div>
                        </div>

                        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                          {classGuidance(classRate)}
                        </p>
                      </section>
                    );
                  },
                )}

                {classPedagogicalModal.classStats.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-xs font-bold text-slate-500">
                    Bu soru için sınıf bazlı değerlendirme verisi bulunamadı.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  )}
  </>;
}

const Select=({label,value,onChange,options}:any)=><label className="text-[10px] font-black uppercase text-slate-400">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-1 block w-full rounded-xl border border-orange-200 bg-orange-50/40 px-3 py-2.5 text-xs font-bold normal-case text-slate-700">{options.map(([v,l]:string[])=><option key={v} value={v}>{l}</option>)}</select></label>;
const Panel=({title,children}:any)=><section className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="mb-4 font-black">{title}</h3>{children}</section>;
const Progress=({label,value,suffix}:any)=><div className="mb-3"><div className="mb-1 flex justify-between text-xs font-bold"><span>{label}</span><span>{suffix}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-orange-500" style={{width:`${Math.min(100,value)}%`}}/></div></div>;
const Badge=({status}:any)=><span className={`whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-black ${TONES[status]}`}>{status}</span>;
function Detail({exam,item,review,onSave}:{exam:any;item:Item;review?:Review;onSave:(r:Review)=>Promise<void>}){const [decision,setDecision]=useState<Decision>(review?.decision||"İncelenmedi"),[note,setNote]=useState(review?.note||""),[saving,setSaving]=useState(false);const rates=classroomComparison(exam,item),spread=rates.length?rates[0].rate-rates[rates.length-1].rate:0,quality=qualityScore(item),suspicious=answerSuspicion(item),working=LETTERS.filter(x=>x!==item.answer&&item.choices[x]>=5).length;return <aside className="self-start rounded-3xl border border-orange-100 bg-white shadow-sm xl:sticky xl:top-4"><div className="border-b p-5"><h3 className="font-black">{item.subject} · A Kitapçığı Soru {item.bookletNumbers.A}</h3>{item.bookletNumbers.B&&<div className="mt-2 inline-flex rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-800">B Kitapçığı: Soru {item.bookletNumbers.B}</div>}<p className="text-xs text-slate-400">{item.outcome}</p></div><div className="space-y-5 p-5"><div className="grid grid-cols-2 gap-2"><div className="rounded-2xl bg-orange-800 p-3 text-white"><small className="font-bold text-orange-100">Soru kalite puanı</small><div className="mt-1 text-2xl font-black">{quality}<span className="text-xs text-orange-200">/100</span></div></div><div className={`rounded-2xl border p-3 ${suspicious?"border-rose-200 bg-rose-50 text-rose-700":"border-emerald-200 bg-emerald-50 text-emerald-700"}`}><small className="font-bold">Anahtar kontrolü</small><div className="mt-2 text-xs font-black">{suspicious?"Kontrol edilmeli":"Tutarlı görünüyor"}</div></div></div><div><div className="mb-2 flex justify-between"><b className="text-xs">Şubeler arası karşılaştırma</b><span className="text-[10px] font-black text-orange-700">{spread} puan fark</span></div>{rates.map(rate=><Progress key={rate.name} label={`${rate.name} (${rate.total})`} value={rate.rate} suffix={`%${rate.rate}`}/>)}</div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><b className="flex items-center gap-2 text-xs text-orange-800"><Sparkles className="h-4 w-4"/>Sistem tespiti</b><p className="mt-2 text-xs leading-relaxed text-slate-600">Güçlük {item.difficulty.toFixed(2)}, ayırt edicilik {item.discrimination.toFixed(2)}. Sonuç: {item.status}. Bu matematiksel bir tespittir; nihai karar öğretmene aittir.</p></div><div className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50 p-4"><b className="flex gap-2 text-xs text-orange-800"><History className="h-4 w-4"/>Öğretmen kararı</b><select value={decision} onChange={e=>setDecision(e.target.value as Decision)} className="w-full rounded-xl border bg-white p-2 text-xs">{["İncelenmedi","Kullanılabilir","Cevap anahtarı değiştirildi","Soru iptal edildi","İnceleme gerekli"].map(x=><option key={x}>{x}</option>)}</select><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="İnceleme notu..." className="min-h-20 w-full rounded-xl border bg-white p-3 text-xs"/><button disabled={saving} onClick={async()=>{setSaving(true);try{await onSave({decision,note,updatedAt:new Date().toISOString(),updatedBy:"Öğretmen"});}finally{setSaving(false)}}} className="flex w-full justify-center gap-2 rounded-xl bg-orange-800 p-2.5 text-xs font-black text-white">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Kalıcı kaydet</button>{review?.updatedAt&&<small className="text-slate-400">Son kayıt: {new Date(review.updatedAt).toLocaleString("tr-TR")}</small>}</div></div></aside>}
