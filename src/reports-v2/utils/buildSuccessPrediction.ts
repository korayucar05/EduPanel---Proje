import type {
  AcademicDnaProfile,
  StudentTargetAnalysis,
  SuccessPrediction,
} from "../types";

const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const round=(value:number,digits=2)=>Number(value.toFixed(digits));

export function buildSuccessPrediction({
  currentNet,
  currentScore,
  previousNets=[],
  academicDna,
  targetAnalysis,
  emptyRate,
  wrongRate,
}:{
  currentNet:number;
  currentScore?:number;
  previousNets?:number[];
  academicDna?:AcademicDnaProfile;
  targetAnalysis?:StudentTargetAnalysis;
  emptyRate:number;
  wrongRate:number;
}):SuccessPrediction{
  const validHistory=previousNets.filter(Number.isFinite).slice(-6);
  const hasHistory=validHistory.length>=2;
  const allNets=[...validHistory,currentNet];

  let slope=0;
  if(hasHistory){
    const count=allNets.length;
    const xMean=(count-1)/2;
    const yMean=allNets.reduce((sum,value)=>sum+value,0)/count;
    const numerator=allNets.reduce((sum,value,index)=>sum+(index-xMean)*(value-yMean),0);
    const denominator=allNets.reduce((sum,_,index)=>sum+(index-xMean)**2,0)||1;
    slope=numerator/denominator;
  }

  const average=allNets.reduce((sum,value)=>sum+value,0)/Math.max(1,allNets.length);
  const volatility=hasHistory
    ? Math.sqrt(allNets.reduce((sum,value)=>sum+(value-average)**2,0)/allNets.length)
    : Math.max(2.5,currentNet*.08);
  const recentDrop=validHistory.length
    ? Math.max(0,validHistory[validHistory.length-1]-currentNet)
    : 0;

  const dnaConfidence=academicDna?.overallConfidence||1;
  const consistency=academicDna?.dimensions.find(item=>item.key==="consistency")?.score||50;
  const attention=academicDna?.dimensions.find(item=>item.key==="attention")?.score||50;
  const timeManagement=academicDna?.dimensions.find(item=>item.key==="timeManagement")?.score||50;
  const resilience=academicDna?.dimensions.find(item=>item.key==="academicResilience")?.score||50;
  const targetGain=targetAnalysis?.opportunities.reduce((sum,item)=>sum+item.suggestedGain,0)||0;

  const historyContribution=hasHistory?slope*.8:0;
  const dnaContribution=((consistency-50)*.015)+((attention-50)*.01)+((timeManagement-50)*.008);
  const planContribution=Math.min(3,targetGain*.28);
  const riskPenalty=(emptyRate*.025)+(wrongRate*.012);
  const expectedGain=historyContribution+dnaContribution+planContribution-riskPenalty;
  const expectedNet=Math.max(0,currentNet+expectedGain);

  const uncertainty=Math.max(
    2,
    volatility*(hasHistory?1.15:1.6)+(5-dnaConfidence)*.65+(hasHistory?0:2.5),
  );
  const lowerNet=Math.max(0,expectedNet-uncertainty);
  const upperNet=expectedNet+uncertainty;

  const scorePerNet=currentNet>0&&currentScore?currentScore/currentNet:undefined;
  const expectedScore=scorePerNet?expectedNet*scorePerNet:undefined;
  const lowerScore=scorePerNet?lowerNet*scorePerNet:undefined;
  const upperScore=scorePerNet?upperNet*scorePerNet:undefined;

  const trendLabel:SuccessPrediction["trendLabel"]=!hasHistory
    ? "Veri Yetersiz"
    : slope>0.75
      ? "Yükseliş"
      : slope<-0.75
        ? "Düşüş"
        : volatility>Math.max(3,currentNet*.12)
          ? "Dalgalı"
          : "Durağan";

  const riskIndex=clamp(
    18+
    Math.max(0,-slope)*10+
    Math.min(24,volatility*3)+
    emptyRate*.45+
    wrongRate*.22+
    recentDrop*2.4+
    Math.max(0,55-consistency)*.35+
    Math.max(0,55-attention)*.25+
    Math.max(0,55-timeManagement)*.22+
    Math.max(0,50-resilience)*.18-
    Math.max(0,slope)*4,
  );
  const riskLevel:SuccessPrediction["riskLevel"]=riskIndex>=78?"critical":riskIndex>=58?"high":riskIndex>=36?"medium":"low";
  const riskLabel:SuccessPrediction["riskLabel"]=riskLevel==="critical"?"Kritik":riskLevel==="high"?"Yüksek":riskLevel==="medium"?"Orta":"Düşük";
  const interventionWindow=riskLevel==="critical"
    ? "Bugün müdahale"
    : riskLevel==="high"
      ? "3 gün içinde"
      : riskLevel==="medium"
        ? "Bu hafta içinde"
        : "Rutin izleme";

  const baseConfidence=35+Math.min(30,validHistory.length*8)+dnaConfidence*5+(targetAnalysis?.isDefined?6:0)-Math.min(10,volatility);
  const confidence=clamp(baseConfidence,30,92);

  const scenarios:SuccessPrediction["scenarios"]=[
    {
      label:"Koruma",
      predictedNet:round(currentNet),
      predictedScore:scorePerNet?round(currentNet*scorePerNet,1):undefined,
      probability:Math.round(clamp(55+(consistency-50)*.3,35,78)),
      description:"Mevcut çalışma düzeni korunur ve belirgin ek gelişim gerçekleşmezse.",
    },
    {
      label:"Gelişim",
      predictedNet:round(upperNet),
      predictedScore:upperScore?round(upperScore,1):undefined,
      probability:Math.round(clamp(42+(attention-50)*.18+(targetGain>0?8:0),25,72)),
      description:"Önerilen çalışma planı düzenli uygulanır ve yanlış/boş oranları azalırsa.",
    },
    {
      label:"Risk",
      predictedNet:round(lowerNet),
      predictedScore:lowerScore?round(lowerScore,1):undefined,
      probability:Math.round(clamp(20+emptyRate*.5+wrongRate*.22+Math.max(0,-slope)*4,12,65)),
      description:"Çalışma düzeni bozulur, boş ve yanlış oranları artarsa.",
    },
  ];

  const earlyWarnings:SuccessPrediction["earlyWarnings"]=[];
  if(slope<-0.75)earlyWarnings.push({level:"high",title:"Net eğiliminde düşüş",detail:`Son sınav eğilimi sınav başına ${Math.abs(slope).toFixed(2)} net kayba işaret ediyor.`,action:"Son iki sınavın konu ve soru türü kayıplarını öğretmenle birlikte inceleyin."});
  if(volatility>Math.max(3,currentNet*.12))earlyWarnings.push({level:"medium",title:"Performans dalgalanması",detail:`Netlerin standart sapması ${volatility.toFixed(2)}; performans kararlılığı düşük.`,action:"Sınav öncesi rutin, uyku ve süre kullanımını sabitleyin."});
  if(emptyRate>=12)earlyWarnings.push({level:emptyRate>=20?"high":"medium",title:"Boş soru riski",detail:`Boş oranı %${emptyRate.toFixed(1)} düzeyinde.`,action:"Süre kontrollü mini denemeler ve ikinci tur soru stratejisi uygulayın."});
  if(wrongRate>=25)earlyWarnings.push({level:wrongRate>=35?"high":"medium",title:"Yanlış yoğunluğu",detail:`Yanlış oranı %${wrongRate.toFixed(1)} düzeyinde.`,action:"Yanlış defteriyle hata türlerini bilgi, dikkat ve işlem hatası olarak ayırın."});
  if(consistency<45)earlyWarnings.push({level:"medium",title:"Çalışma istikrarı",detail:`Akademik DNA istikrar puanı ${Math.round(consistency)}.`,action:"Her gün aynı saatte kısa ama sürdürülebilir çalışma bloğu oluşturun."});
  if(!earlyWarnings.length)earlyWarnings.push({level:"low",title:"Belirgin erken risk yok",detail:"Mevcut göstergelerde acil müdahale gerektiren bir sinyal oluşmadı.",action:"Mevcut planı koruyun ve sonraki sınavla eğilimi yeniden ölçün."});

  const trajectory:SuccessPrediction["trajectory"]=[
    ...validHistory.map((net,index)=>({label:`S${index+1}`,net:round(net),kind:"history" as const})),
    {label:"Şimdi",net:round(currentNet),kind:"current" as const},
    {label:"Tahmin",net:round(expectedNet),kind:"forecast" as const},
  ];

  const drivers:SuccessPrediction["drivers"]=[
    {
      title:"Geçmiş sınav eğilimi",
      impact:hasHistory?(slope>0?"positive":slope<0?"negative":"neutral"):"neutral",
      detail:hasHistory?`Net eğilimi sınav başına ${slope>=0?"+":""}${slope.toFixed(2)} net olarak hesaplandı.`:"Yeterli geçmiş sınav bulunmadığı için gerçek eğilim hesaplanamadı.",
    },
    {
      title:"Akademik DNA",
      impact:dnaConfidence>=3?"positive":"neutral",
      detail:`DNA veri güveni ${dnaConfidence.toFixed(1)}/5; istikrar ${Math.round(consistency)}, dikkat ${Math.round(attention)} puan.`,
    },
    {
      title:"Çalışma planı fırsatı",
      impact:targetGain>0?"positive":"neutral",
      detail:targetGain>0?`Tanımlı ders fırsatlarında yaklaşık +${targetGain.toFixed(2)} net gelişim alanı bulunuyor.`:"Tanımlı hedef veya ders bazlı gelişim fırsatı bulunmuyor.",
    },
    {
      title:"Yanlış ve boş oranları",
      impact:emptyRate>=12||wrongRate>=25?"negative":"positive",
      detail:`Yanlış oranı %${wrongRate.toFixed(1)}, boş oranı %${emptyRate.toFixed(1)}.`,
    },
  ];

  const summary=hasHistory
    ? `Bir sonraki sınav için beklenen net ${expectedNet.toFixed(2)}, öngörü aralığı ${lowerNet.toFixed(2)}–${upperNet.toFixed(2)} nettir. Erken risk puanı ${Math.round(riskIndex)}/100 (${riskLabel}) ve önerilen müdahale zamanı: ${interventionWindow}.`
    : `Geçmiş sınav sayısı yetersizdir. Temkinli öngörü ${lowerNet.toFixed(2)}–${upperNet.toFixed(2)} net aralığıdır. İlk risk puanı ${Math.round(riskIndex)}/100 olarak hesaplanmıştır.`;

  return{
    version:"2.0",
    dataScope:hasHistory?"multi-exam":"single-exam",
    confidence:round(confidence,1),
    currentNet:round(currentNet),
    expectedNet:round(expectedNet),
    lowerNet:round(lowerNet),
    upperNet:round(upperNet),
    expectedScore:expectedScore?round(expectedScore,1):undefined,
    lowerScore:lowerScore?round(lowerScore,1):undefined,
    upperScore:upperScore?round(upperScore,1):undefined,
    trendLabel,
    riskIndex:round(riskIndex,1),
    riskLevel,
    riskLabel,
    interventionWindow,
    trajectory,
    earlyWarnings,
    scenarios,
    drivers,
    summary,
    disclaimer:"Bu çıktı istatistiksel ve kural tabanlı bir erken uyarı ve başarı öngörüsüdür. Öğrenciyi etiketlemek, kesin sınav sonucu veya yerleşme garantisi vermek amacıyla kullanılamaz. Geçmiş sınav sayısı arttıkça güven düzeyi yükselir.",
  };
}
