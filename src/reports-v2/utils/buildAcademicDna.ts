import type {
  AcademicDnaDimension,
  AcademicDnaProfile,
  SubjectPerformance,
} from "../types";

const normalize=(value:string)=>String(value||"")
  .toLocaleLowerCase("tr-TR")
  .replace(/[^a-z0-9çğıöşü]/g,"");

const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const average=(values:number[])=>values.length
  ? values.reduce((sum,value)=>sum+value,0)/values.length
  : 50;

const rate=(subject:SubjectPerformance)=>Number.isFinite(Number(subject.successRate))
  ? Number(subject.successRate)
  : subject.totalQuestions
    ? subject.correct/subject.totalQuestions*100
    : 0;

const confidenceLabel=(confidence:1|2|3|4|5):AcademicDnaDimension["confidenceLabel"]=>
  (["Düşük","Sınırlı","Orta","İyi","Yüksek"] as const)[confidence-1];

const status=(score:number):AcademicDnaDimension["status"]=>
  score>=75?"strong":score>=55?"developing":"priority";

const dimension=(
  key:AcademicDnaDimension["key"],
  label:string,
  score:number,
  confidence:1|2|3|4|5,
  evidence:string,
):AcademicDnaDimension=>({
  key,
  label,
  score:Number(clamp(score).toFixed(1)),
  confidence,
  confidenceLabel:confidenceLabel(confidence),
  evidence,
  status:status(score),
});

const matchingRates=(subjects:SubjectPerformance[],keywords:string[])=>subjects
  .filter(subject=>{
    const name=normalize(subject.subjectName);
    return keywords.some(keyword=>name.includes(normalize(keyword)));
  })
  .map(rate);

export function buildAcademicDna({
  subjects,
  totals,
  hasHistory=false,
}:{
  subjects:SubjectPerformance[];
  totals:{correct:number;wrong:number;empty:number;net:number;successRate:number};
  hasHistory?:boolean;
}):AcademicDnaProfile{
  const totalResponses=Math.max(1,totals.correct+totals.wrong+totals.empty);
  const wrongRate=totals.wrong/totalResponses*100;
  const emptyRate=totals.empty/totalResponses*100;
  const subjectRates=subjects.map(rate).filter(Number.isFinite);

  const analyticalRates=matchingRates(subjects,["matematik","geometri","fizik","kimya","biyoloji"]);
  const readingRates=matchingRates(subjects,["türk","edebiyat","tarih","coğraf","felsefe","din","sosyal"]);
  const problemRates=matchingRates(subjects,["matematik","geometri","fizik"]);

  const analytical=analyticalRates.length?average(analyticalRates):average(subjectRates);
  const reading=readingRates.length?average(readingRates):average(subjectRates);
  const problem=problemRates.length
    ? average(problemRates)*.82 + (100-wrongRate)*.18
    : average(subjectRates)*.75 + (100-wrongRate)*.25;

  const attention=100-clamp(wrongRate*2.25);
  const timeManagement=100-clamp(emptyRate*3.1);

  const mean=average(subjectRates);
  const variance=subjectRates.length
    ? subjectRates.reduce((sum,value)=>sum+(value-mean)**2,0)/subjectRates.length
    : 0;
  const standardDeviation=Math.sqrt(variance);
  const branchBalance=100-clamp(standardDeviation*2.15);

  const resilience=clamp(
    totals.successRate*.72 +
    (100-wrongRate)*.18 +
    (100-emptyRate)*.10
  );

  // Tek sınavla istikrar doğrudan ölçülemez. Bu nedenle puan nötr tutulur,
  // güven düzeyi düşük gösterilir. Geçmiş veri bağlandığında gerçek eğilim kullanılacaktır.
  const consistency=hasHistory
    ? clamp(totals.successRate*.85 + branchBalance*.15)
    : 50;

  const dimensions:AcademicDnaDimension[]=[
    dimension(
      "analyticalThinking",
      "Analitik Düşünme",
      analytical,
      analyticalRates.length>=3?3:analyticalRates.length?2:1,
      analyticalRates.length
        ? `${analyticalRates.length} sayısal dersin başarı oranlarından türetildi.`
        : "Sayısal ders ayrımı bulunmadığı için genel ders başarısı yaklaşık gösterge olarak kullanıldı.",
    ),
    dimension(
      "readingInterpretation",
      "Okuma ve Yorumlama",
      reading,
      readingRates.length>=3?3:readingRates.length?2:1,
      readingRates.length
        ? `${readingRates.length} sözel/yorum ağırlıklı dersin başarı oranlarından türetildi.`
        : "Sözel ders ayrımı bulunmadığı için genel başarı yaklaşık gösterge olarak kullanıldı.",
    ),
    dimension(
      "problemSolving",
      "Problem Çözme",
      problem,
      problemRates.length>=2?3:problemRates.length?2:1,
      "Matematik/fen başarısı ile yanlış soru oranının birlikte değerlendirilmesiyle hesaplandı.",
    ),
    dimension(
      "attention",
      "Dikkat ve Kontrol",
      attention,
      totalResponses>=60?3:2,
      `Toplam ${totals.wrong} yanlışın ${totalResponses} cevap içindeki oranı kullanıldı.`,
    ),
    dimension(
      "timeManagement",
      "Zaman Yönetimi",
      timeManagement,
      1,
      `Boş bırakılan ${totals.empty} soru dolaylı gösterge olarak kullanıldı; gerçek süre verisi bulunmadığı için güven düşüktür.`,
    ),
    dimension(
      "branchBalance",
      "Branş Dengesi",
      branchBalance,
      subjects.length>=5?3:subjects.length>=3?2:1,
      `${subjects.length} ders arasındaki başarı farklılıklarının dağılımına göre hesaplandı.`,
    ),
    dimension(
      "academicResilience",
      "Akademik Dayanıklılık",
      resilience,
      2,
      "Genel başarı, yanlış oranı ve boş oranının bileşik göstergesidir; sınav güçlük verisi bulunmadığı için sınırlıdır.",
    ),
    dimension(
      "consistency",
      "Öğrenme İstikrarı",
      consistency,
      hasHistory?3:1,
      hasHistory
        ? "Geçmiş sınav eğilimi ve branş dengesi birlikte kullanıldı."
        : "Tek sınav bulunduğu için istikrar ölçülemedi; nötr başlangıç değeri gösterilmektedir.",
    ),
  ];

  const weighted=dimensions.reduce((sum,item)=>sum+item.score*item.confidence,0);
  const weight=dimensions.reduce((sum,item)=>sum+item.confidence,0);
  const overallScore=weight?weighted/weight:50;
  const overallConfidence=dimensions.reduce((sum,item)=>sum+item.confidence,0)/dimensions.length;

  const sorted=[...dimensions].sort((a,b)=>b.score-a.score);
  const strengths=sorted.filter(item=>item.score>=70).slice(0,3).map(item=>item.label);
  const priorities=[...dimensions].sort((a,b)=>a.score-b.score).slice(0,3).map(item=>item.label);

  const summary=[
    strengths.length
      ? `Profilin güçlü tarafları ${strengths.join(", ")} alanlarında yoğunlaşmaktadır.`
      : "Profilde henüz belirgin bir güçlü alan oluşmamıştır.",
    priorities.length
      ? `${priorities.join(", ")} alanları gelişim önceliği olarak izlenmelidir.`
      : "",
    hasHistory
      ? "Geçmiş sınavlar kullanıldığı için istikrar göstergesi eğilime dayalıdır."
      : "Bu ilk profil tek sınava dayandığı için özellikle zaman yönetimi ve istikrar puanları ön değerlendirmedir.",
  ].filter(Boolean).join(" ");

  return{
    version:"1.0",
    dataScope:hasHistory?"multi-exam":"single-exam",
    overallScore:Number(overallScore.toFixed(1)),
    overallConfidence:Number(overallConfidence.toFixed(1)),
    dimensions,
    summary,
    strengths,
    priorities,
    disclaimer:"Akademik DNA bir tanı veya kişilik testi değildir. Sınav sonuçlarından üretilen açıklanabilir akademik göstergeler bütünüdür.",
  };
}
