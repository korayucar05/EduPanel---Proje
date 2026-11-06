import type {
  AcademicDnaProfile,
  ParentSupportPlan,
  PersonalizedAiEvaluation,
  StudentTargetAnalysis,
  SubjectPerformance,
} from "../types";

const rate=(subject:SubjectPerformance)=>Number.isFinite(Number(subject.successRate))
  ? Number(subject.successRate)
  : subject.totalQuestions
    ? subject.correct/subject.totalQuestions*100
    : 0;

export function buildParentSupportPlan({
  studentName,
  subjects,
  totals,
  classroomAverageNet,
  academicDna,
  targetAnalysis,
  aiEvaluation,
}:{
  studentName:string;
  subjects:SubjectPerformance[];
  totals:{
    correct:number;
    wrong:number;
    empty:number;
    net:number;
    successRate:number;
  };
  classroomAverageNet?:number;
  academicDna?:AcademicDnaProfile;
  targetAnalysis?:StudentTargetAnalysis;
  aiEvaluation?:PersonalizedAiEvaluation;
}):ParentSupportPlan{
  const sorted=[...subjects].sort((a,b)=>rate(b)-rate(a));
  const strongest=sorted[0];
  const weakest=[...sorted].reverse()[0];
  const classAverage=Number(classroomAverageNet||0);
  const difference=totals.net-classAverage;
  const totalResponses=Math.max(1,totals.correct+totals.wrong+totals.empty);
  const emptyRate=totals.empty/totalResponses*100;
  const wrongRate=totals.wrong/totalResponses*100;

  const strengths=[
    strongest?`${strongest.subjectName} dersinde %${Math.round(rate(strongest))} başarı`:"",
    academicDna?.strengths?.[0]?`${academicDna.strengths[0]} alanında güçlü akademik profil`:"",
    difference>=0&&classAverage?`Sınıf ortalamasının ${difference.toFixed(2)} net üzerinde performans`:"",
  ].filter(Boolean);

  const developmentAreas=[
    weakest?`${weakest.subjectName} dersinde düzenli tekrar ihtiyacı`:"",
    academicDna?.priorities?.[0]?`${academicDna.priorities[0]} alanında gelişim ihtiyacı`:"",
    emptyRate>=10?"Boş bırakılan soruların azaltılması":"",
    wrongRate>=25?"Yanlış soru nedenlerinin ayrıştırılması":"",
  ].filter(Boolean);

  const homeSupportActions:ParentSupportPlan["homeSupportActions"]=[
    {
      title:"Planı kontrol edin, dersi değil",
      detail:"Günlük görevlerin yapılıp yapılmadığını kısa biçimde takip edin; çalışma süresine sürekli müdahale etmeyin.",
      frequency:"Haftada 3 kısa kontrol",
    },
    {
      title:"Yanlışların yeniden çözülmesini isteyin",
      detail:"Çocuğunuzdan yanlış yaptığı sorunun çözümünü size anlatmasını değil, çözümü kapatıp yeniden yapmasını isteyin.",
      frequency:"Haftada 2 kez",
    },
    {
      title:"Sonucu değil ilerlemeyi konuşun",
      detail:"Sınav puanından önce hangi derste gelişme olduğunu ve hangi planın işe yaradığını sorun.",
      frequency:"Her sınav sonrası",
    },
    {
      title:"Çalışma ortamını koruyun",
      detail:"Belirlenen çalışma saatinde telefon, televizyon ve gereksiz bölünmeleri azaltın.",
      frequency:"Her çalışma günü",
    },
  ];

  if(emptyRate>=10){
    homeSupportActions.push({
      title:"Süreli mini testleri destekleyin",
      detail:"Kısa süreli denemelerin düzenli yapılmasını ve boş soruların sonradan tekrar incelenmesini takip edin.",
      frequency:"Haftada 2 kez",
    });
  }

  const targetText=targetAnalysis?.isDefined
    ? `${targetAnalysis.definition.university||""} ${targetAnalysis.definition.program||""}`.trim()
    : "";

  const monthlyCheckpoints:ParentSupportPlan["monthlyCheckpoints"]=[
    {
      week:"1. Hafta",
      focus:weakest?`${weakest.subjectName} yanlışlarının ayrıştırılması`:"Yanlış soruların sınıflandırılması",
      parentAction:"Haftalık planın görünür bir yerde tutulmasını sağlayın.",
      successIndicator:"Planlanan görevlerin en az %80'inin tamamlanması",
    },
    {
      week:"2. Hafta",
      focus:emptyRate>=10?"Süre yönetimi ve boş soru azaltma":"Düzenli soru çözümü",
      parentAction:"İki kısa süreli testin yapılıp yapılmadığını kontrol edin.",
      successIndicator:"Boş soru sayısında azalma veya süreye uyum",
    },
    {
      week:"3. Hafta",
      focus:academicDna?.priorities?.[0]||"Öncelikli akademik alan",
      parentAction:"Çocuğunuzdan sadece ne öğrendiğini bir cümleyle özetlemesini isteyin.",
      successIndicator:"Aynı konudaki tekrar yanlışların azalması",
    },
    {
      week:"4. Hafta",
      focus:targetText?`${targetText} hedefi için ara değerlendirme`:"Aylık gelişim değerlendirmesi",
      parentAction:"Önceki sınavla yeni sonucu birlikte karşılaştırın; eleştiri yerine çözüm konuşun.",
      successIndicator:"Net, yanlış veya boş göstergelerinden en az birinde iyileşme",
    },
  ];

  const summary=[
    `Sayın Veli, ${studentName} bu sınavda ${totals.net.toFixed(2)} net elde etmiştir.`,
    classAverage
      ? difference>=0
        ? `Bu sonuç sınıf ortalamasının ${difference.toFixed(2)} net üzerindedir.`
        : `Bu sonuç sınıf ortalamasının ${Math.abs(difference).toFixed(2)} net altındadır.`
      : "",
    strongest?`${strongest.subjectName} güçlü yön olarak öne çıkmaktadır.`:"",
    weakest?`${weakest.subjectName} dersi ise planlı ve kısa çalışma bloklarıyla desteklenmelidir.`:"",
    "Evde yapılacak en yararlı destek; baskı oluşturmak değil, planın düzenli uygulanmasını ve yanlışların yeniden çözülmesini takip etmektir.",
  ].filter(Boolean).join(" ");

  const communicationNote=
    aiEvaluation?.teacherMessage ||
    `${studentName} için okul ve ev arasındaki takip; öncelikli ders, yanlış analizi ve haftalık hedefler üzerinden yürütülmelidir.`;

  const encouragementMessage=
    difference>=0
      ? "Mevcut güçlü performans korunurken gelişim alanlarına düzenli biçimde odaklanılması, öğrencinin hedeflerine yaklaşmasını destekleyecektir."
      : "Bu sonuç öğrencinin değişmez düzeyi değildir. Düzenli çalışma, doğru takip ve küçük hedeflerle anlamlı gelişim mümkündür.";

  const dnaDimensions=academicDna?.dimensions||[];
  const strongestDimension=[...dnaDimensions].sort((a,b)=>b.score-a.score)[0];
  const priorityDimension=[...dnaDimensions].sort((a,b)=>a.score-b.score)[0];
  const dnaScore=Number(academicDna?.overallScore||0);
  const snapshotStatus:"strong"|"balanced"|"attention"=
    dnaScore>=75?"strong":dnaScore>=55?"balanced":"attention";
  const snapshotStatusLabel=
    snapshotStatus==="strong"?"Güçlü akademik görünüm":
    snapshotStatus==="balanced"?"Dengeli, gelişime açık görünüm":
    "Yakın takip gerektiren görünüm";

  const conversationGuide={
    ask:weakest
      ? `${weakest.subjectName} dersinde bu hafta hangi küçük adımı tamamlamak istersin?`
      : "Bu hafta geliştirmek istediğin tek akademik alışkanlık hangisi?",
    say:strongest
      ? `${strongest.subjectName} dersindeki emeğinin sonucunu görüyorum; aynı düzeni gelişim alanına da taşıyabilirsin.`
      : "Sonucun ne olursa olsun planlı çabanı görüyorum ve gelişebileceğine inanıyorum.",
    avoid:"Neden daha yüksek almadın, arkadaşların kaç aldı veya bu gidişle başaramazsın gibi kıyaslayıcı ve kesin yargı içeren cümlelerden kaçının.",
  };

  return{
    version:"1.0",
    summary,
    academicSnapshot:academicDna?{
      dnaScore:Number(dnaScore.toFixed(1)),
      confidence:Number(academicDna.overallConfidence.toFixed(1)),
      strongestDimension:strongestDimension?.label||"Henüz belirlenmedi",
      priorityDimension:priorityDimension?.label||"Henüz belirlenmedi",
      status:snapshotStatus,
      statusLabel:snapshotStatusLabel,
    }:undefined,
    conversationGuide,
    strengths,
    developmentAreas,
    homeSupportActions,
    monthlyCheckpoints,
    communicationNote,
    encouragementMessage,
    disclaimer:"Bu sayfa veliyi bilgilendirmek ve evde yapıcı destek sağlamak amacıyla hazırlanmıştır. Öğrenci üzerinde baskı oluşturmak, kıyaslama yapmak veya cezalandırıcı takip için kullanılmamalıdır.",
  };
}
