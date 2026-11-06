import type {
  AcademicDnaProfile,
  AiAdvisorCard,
  PersonalizedAiEvaluation,
  StudentTargetAnalysis,
  SubjectPerformance,
} from "../types";

const rate=(subject:SubjectPerformance)=>Number.isFinite(Number(subject.successRate))
  ? Number(subject.successRate)
  : subject.totalQuestions
    ? subject.correct/subject.totalQuestions*100
    : 0;

const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const normalize=(value:string)=>String(value||"").toLocaleLowerCase("tr-TR");

export function buildPersonalizedAiEvaluation({
  studentName,
  subjects,
  totals,
  classroomAverageNet,
  academicDna,
  targetAnalysis,
  hasHistory=false,
}:{
  studentName:string;
  subjects:SubjectPerformance[];
  totals:{
    correct:number;
    wrong:number;
    empty:number;
    net:number;
    score?:number;
    successRate:number;
  };
  classroomAverageNet?:number;
  academicDna?:AcademicDnaProfile;
  targetAnalysis?:StudentTargetAnalysis;
  hasHistory?:boolean;
}):PersonalizedAiEvaluation{
  const sorted=[...subjects].sort((a,b)=>rate(b)-rate(a));
  const strongest=sorted[0];
  const weakest=[...sorted].reverse()[0];
  const totalResponses=Math.max(1,totals.correct+totals.wrong+totals.empty);
  const wrongRate=totals.wrong/totalResponses*100;
  const emptyRate=totals.empty/totalResponses*100;
  const classAverage=Number(classroomAverageNet||0);
  const netDifference=totals.net-classAverage;

  const dnaStrength=academicDna?.dimensions
    .slice()
    .sort((a,b)=>b.score-a.score)[0];
  const dnaPriority=academicDna?.dimensions
    .slice()
    .sort((a,b)=>a.score-b.score)[0];

  const potentialGain=targetAnalysis?.opportunities
    .reduce((sum,item)=>sum+item.suggestedGain,0) || 0;

  const advisorCards:AiAdvisorCard[]=[];

  if(strongest){
    advisorCards.push({
      type:"strength",
      title:"Güçlü Yanın",
      message:`${strongest.subjectName} dersindeki %${Math.round(rate(strongest))} başarı oranı genel performansını destekliyor.`,
      metric:`${strongest.net.toFixed(2)} net`,
    });
  }

  if(weakest){
    advisorCards.push({
      type:"attention",
      title:"Dikkat Edilecek Alan",
      message:`${weakest.subjectName} dersi düzenli tekrar ve kontrollü soru çözümüyle geliştirilebilir.`,
      metric:`%${Math.round(rate(weakest))}`,
    });
  }

  advisorCards.push({
    type:"action",
    title:"Bu Hafta",
    message:weakest
      ? `${weakest.subjectName} için kısa konu tekrarı, yanlış analizi ve en az 20 hedefli soru çözümü uygula.`
      : "Yanlış soruları yeniden çöz ve sonuçlarını kısa notlara dönüştür.",
    metric:emptyRate>=12?"Süre yönetimi":"Yanlış analizi",
  });

  advisorCards.push({
    type:"potential",
    title:"Potansiyel",
    message:potentialGain>0
      ? `Hedef planındaki ders fırsatlarıyla yaklaşık ${potentialGain.toFixed(2)} netlik gelişim alanı bulunuyor.`
      : "Öncelikli derslerde düzenli çalışma toplam netini artırabilir.",
    metric:potentialGain>0?`+${potentialGain.toFixed(2)} net`:"Gelişim alanı",
  });

  const strengths=[
    strongest?`${strongest.subjectName} dersindeki güçlü sonuç`:"",
    dnaStrength?`${dnaStrength.label} alanındaki ${Math.round(dnaStrength.score)} puanlık profil`:"",
    netDifference>=0?`sınıf ortalamasının ${netDifference.toFixed(2)} net üzerinde olman`:"",
  ].filter(Boolean);

  const priorities=[
    weakest?`${weakest.subjectName} dersindeki gelişim ihtiyacı`:"",
    dnaPriority?`${dnaPriority.label} alanının desteklenmesi`:"",
    emptyRate>=12?"boş soru oranının azaltılması":"",
    wrongRate>=25?"yanlış soru nedenlerinin ayrıştırılması":"",
  ].filter(Boolean);

  const studentMessage=[
    `${studentName}, bu sınavdaki performansın bize güçlü ve geliştirilebilir alanlarını birlikte gösteriyor.`,
    strengths.length?`Özellikle ${strengths.slice(0,2).join(" ve ")} dikkat çekiyor.`:"",
    priorities.length?`${priorities.slice(0,2).join(" ve ")} bir sonraki çalışma döneminin önceliği olmalıdır.`:"",
    targetAnalysis?.isDefined
      ? `Tanımlı hedefin için kalan farkı küçük ve ölçülebilir adımlara böldüğümüzde ilerlemen daha kolay takip edilebilir.`
      : "Kısa vadeli bir net hedefi belirlemek çalışma planını daha görünür hâle getirecektir.",
    "Düzenli tekrar, yanlış analizi ve haftalık kontrol alışkanlığı sürdürüldüğünde gelişim olasılığı yüksektir.",
  ].filter(Boolean).join(" ");

  const parentMessage=[
    `Sayın Veli, öğrencimizin mevcut sonucu ${totals.net.toFixed(2)} net düzeyindedir.`,
    classAverage
      ? netDifference>=0
        ? `Bu sonuç sınıf ortalamasının ${netDifference.toFixed(2)} net üzerindedir.`
        : `Bu sonuç sınıf ortalamasının ${Math.abs(netDifference).toFixed(2)} net altındadır.`
      : "",
    strongest?`${strongest.subjectName} güçlü yön olarak öne çıkmaktadır.`:"",
    weakest?`${weakest.subjectName} dersi düzenli ve kısa çalışma bloklarıyla desteklenmelidir.`:"",
    emptyRate>=12
      ? "Evde çalışma süresinden çok, planın uygulanıp uygulanmadığının ve boş bırakılan soruların yeniden çözülüp çözülmediğinin takip edilmesi önerilir."
      : "Evde haftalık planın düzenli uygulanması ve yanlış soruların yeniden çözülmesi yeterli ve yapıcı bir takip olacaktır.",
  ].filter(Boolean).join(" ");

  const teacherMessage=[
    `${studentName} için öncelikli müdahale alanı ${weakest?.subjectName||"düşük başarı gösterilen dersler"} olarak görünmektedir.`,
    dnaPriority?`${dnaPriority.label} göstergesi ${Math.round(dnaPriority.score)} puan ve ${dnaPriority.confidenceLabel.toLocaleLowerCase("tr-TR")} güven düzeyindedir.`:"",
    emptyRate>=12?`Boş soru oranı %${emptyRate.toFixed(1)} olduğundan süre yönetimi ve soru seçme stratejisi gözlenmelidir.`:"",
    wrongRate>=25?`Yanlış oranı %${wrongRate.toFixed(1)} olduğundan yanlışların bilgi, işlem ve dikkat kaynaklı olarak ayrıştırılması önerilir.`:"",
    targetAnalysis?.isDefined
      ? `Tanımlı hedefe yönelik ders fırsatları haftalık mikro hedeflere dönüştürülmelidir.`
      : "Öğrenciyle ölçülebilir kısa vadeli net hedefi belirlenmesi önerilir.",
  ].filter(Boolean).join(" ");

  const nextActions:PersonalizedAiEvaluation["nextActions"]=[];
  if(weakest){
    nextActions.push({
      priority:1,
      title:`${weakest.subjectName} için hedefli tekrar`,
      detail:"15 dakika konu özeti, 20 hedefli soru ve yanlışların yeniden çözümü.",
    });
  }
  if(emptyRate>=10){
    nextActions.push({
      priority:2,
      title:"Süre yönetimi uygulaması",
      detail:"Haftada iki kez süreli mini test çözülmeli ve boş bırakılan sorular ayrıca incelenmelidir.",
    });
  }
  nextActions.push({
    priority:3,
    title:"Yanlış defteri kontrolü",
    detail:"Yanlış sorular konu, işlem ve dikkat başlıkları altında sınıflandırılmalıdır.",
  });
  if(targetAnalysis?.isDefined){
    nextActions.push({
      priority:4,
      title:"Hedef kontrol noktası",
      detail:`Bir sonraki kontrolde ${targetAnalysis.milestones[0]?.targetNet.toFixed(2)||totals.net.toFixed(2)} net düzeyi izlenmelidir.`,
    });
  }
  nextActions.push({
    priority:5,
    title:"Haftalık kısa değerlendirme",
    detail:"Hafta sonunda tamamlanan görevler ve tekrar çözülen yanlışlar birlikte gözden geçirilmelidir.",
  });

  const decisionStatus:PersonalizedAiEvaluation["decisionSummary"]["status"]=
    totals.successRate>=75&&emptyRate<10?"strong":
    totals.successRate>=50&&wrongRate<30?"balanced":"attention";

  const decisionSummary:PersonalizedAiEvaluation["decisionSummary"]={
    status:decisionStatus,
    headline:decisionStatus==="strong"
      ?"Güçlü performans, kontrollü gelişim"
      :decisionStatus==="balanced"
        ?"Dengeli profil, belirgin gelişim fırsatı"
        :"Yakın takip ve hedefli müdahale gerekli",
    rationale:[
      `Başarı oranı %${totals.successRate.toFixed(1)}, toplam net ${totals.net.toFixed(2)}.`,
      strongest?`En güçlü ders ${strongest.subjectName}.`:"",
      weakest?`Öncelikli gelişim alanı ${weakest.subjectName}.`:"",
      emptyRate>=12?`Boş oranı %${emptyRate.toFixed(1)} ile süre yönetimi riski taşıyor.`:"",
    ].filter(Boolean).join(" "),
  };

  const riskSignals:PersonalizedAiEvaluation["riskSignals"]=[];
  if(emptyRate>=18){
    riskSignals.push({level:"high",title:"Süre yönetimi riski",detail:`Soruların %${emptyRate.toFixed(1)}'i boş bırakıldı. Süreli mini denemeler ve soru seçme stratejisi uygulanmalı.`});
  }else if(emptyRate>=10){
    riskSignals.push({level:"medium",title:"Boş soru eğilimi",detail:`Boş oranı %${emptyRate.toFixed(1)}. Çözülemeyen sorularda geri dönüş planı geliştirilmelidir.`});
  }
  if(wrongRate>=32){
    riskSignals.push({level:"high",title:"Yanlış yoğunluğu",detail:`Yanlış oranı %${wrongRate.toFixed(1)}. Yanlışlar bilgi, işlem ve dikkat başlıklarında ayrıştırılmalıdır.`});
  }else if(wrongRate>=22){
    riskSignals.push({level:"medium",title:"Yanlış analizi ihtiyacı",detail:`Yanlış oranı %${wrongRate.toFixed(1)}. Her çalışma oturumunda yanlışların yeniden çözümü yapılmalıdır.`});
  }
  if(netDifference<-5){
    riskSignals.push({level:"medium",title:"Sınıf ortalaması farkı",detail:`Toplam net sınıf ortalamasının ${Math.abs(netDifference).toFixed(2)} altında. Öncelikli iki derste mikro hedef belirlenmelidir.`});
  }
  if(dnaPriority&&dnaPriority.score<45){
    riskSignals.push({level:dnaPriority.score<30?"high":"medium",title:`${dnaPriority.label} desteği`,detail:`Akademik DNA puanı ${Math.round(dnaPriority.score)}. ${dnaPriority.evidence}`});
  }
  if(!riskSignals.length){
    riskSignals.push({level:"low",title:"Belirgin kritik risk yok",detail:"Mevcut verilerde kritik bir risk sinyali görülmedi. Düzenli takip ve çalışma ritmi korunmalıdır."});
  }

  const focusSubjects=[weakest,sorted.length>1?sorted[sorted.length-2]:undefined].filter(Boolean) as SubjectPerformance[];
  const days=["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"];
  const sevenDayPlan:PersonalizedAiEvaluation["sevenDayPlan"]=days.map((day,index)=>{
    const focus=focusSubjects[index%Math.max(1,focusSubjects.length)]||strongest;
    const focusName=focus?.subjectName||"Genel tekrar";
    const reviewDay=index===6;
    return{
      day,
      focus:reviewDay?"Haftalık kontrol":focusName,
      tasks:reviewDay
        ?["Haftanın yanlışlarını yeniden çöz","Tamamlanan görevleri işaretle","Yeni hafta için tek net hedef belirle"]
        :[
          `${focusName}: 15 dakika konu özeti`,
          `${focusName}: ${index===5?30:20} hedefli soru`,
          index%2===0?"Yanlışları nedenlerine göre sınıflandır":"10 dakika süreli mini test",
        ],
      minutes:reviewDay?35:index===5?60:45,
      successCheck:reviewDay
        ?"Haftalık görevlerin en az %80'i tamamlandı mı?"
        :`${focusName} çalışmasında yanlışların en az yarısı yeniden doğru çözüldü mü?`,
    };
  });

  const evidence=[
    `${subjects.length} ders sonucu analiz edildi.`,
    `Toplam net ${totals.net.toFixed(2)}, başarı oranı %${totals.successRate.toFixed(1)}.`,
    `Yanlış oranı %${wrongRate.toFixed(1)}, boş oranı %${emptyRate.toFixed(1)}.`,
    academicDna
      ? `Akademik DNA ${academicDna.dimensions.length} boyut ve ${academicDna.overallConfidence.toFixed(1)}/5 veri güveniyle kullanıldı.`
      : "",
    targetAnalysis?.isDefined
      ? "Tanımlı hedef üniversite/puan/net bilgileri değerlendirmeye katıldı."
      : "Tanımlı hedef bilgisi bulunmadı.",
  ].filter(Boolean);

  const baseConfidence=
    45 +
    Math.min(20,subjects.length*3) +
    (academicDna?academicDna.overallConfidence*5:0) +
    (targetAnalysis?.isDefined?7:0) +
    (hasHistory?12:0);

  return{
    version:"2.0",
    dataScope:hasHistory?"multi-exam":"single-exam",
    confidence:Number(clamp(baseConfidence,35,95).toFixed(1)),
    decisionSummary,
    advisorCards,
    riskSignals,
    studentMessage,
    parentMessage,
    teacherMessage,
    nextActions,
    sevenDayPlan,
    evidence,
    disclaimer:"Bu değerlendirme sınav verilerinden üretilen açıklanabilir bir karar destek çıktısıdır. Tanı, kesin gelecek tahmini veya öğrenci hakkında değişmez bir yargı değildir.",
  };
}
