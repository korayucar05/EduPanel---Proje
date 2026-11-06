import {parseDecisionIntent} from "./queryParser";
import type {DecisionAnswer,DecisionCenterContext} from "./types";

const sourceLabel={
  exam:"Sınav",
  attendance:"Devamsızlık",
  homework:"Ödev",
  behavior:"Davranış",
  guidance:"Rehberlik",
  intervention:"Müdahale",
  parent:"Veli",
  system:"Sistem",
} as const;

export function askHasatDecisionCenter({
  query,
  context,
}:{
  query:string;
  context:DecisionCenterContext;
}):DecisionAnswer{
  const intent=parseDecisionIntent(query);
  const {snapshot,events}=context;
  const critical=events.filter(item=>item.level==="critical");
  const warnings=events.filter(item=>item.level==="warning");

  if(intent==="daily-briefing"){
    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      query,
      intent,
      title:snapshot.briefing.headline,
      answer:`Okul sağlık skoru ${snapshot.schoolHealthScore}. ${snapshot.criticalEventCount} kritik, ${snapshot.warningEventCount} uyarı ve ${snapshot.positiveEventCount} olumlu gelişme bulunuyor.`,
      evidence:[
        `${context.studentCount} öğrenci, ${context.teacherCount} öğretmen, ${context.classroomCount} sınıf`,
        ...snapshot.recentEvents.slice(0,5).map(item=>`${sourceLabel[item.source]}: ${item.title}`),
      ],
      actions:snapshot.actions.slice(0,5).map(item=>item.title),
      confidence:94,
    };
  }

  if(intent==="critical-events"){
    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      query,
      intent,
      title:critical.length?`${critical.length} kritik gelişme tespit edildi`:"Kritik gelişme bulunmuyor",
      answer:critical.length
        ?critical.slice(0,5).map(item=>item.title).join(", ")
        :"Son yedi günlük canlı veride kritik olay görünmüyor.",
      evidence:critical.slice(0,8).map(item=>`${sourceLabel[item.source]} · ${item.detail}`),
      actions:snapshot.actions.filter(item=>item.priority===5).slice(0,5).map(item=>item.title),
      confidence:96,
    };
  }

  if(intent==="priority-actions"){
    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      query,
      intent,
      title:"Bugünün öncelikli görevleri",
      answer:snapshot.actions.length
        ?`İlk olarak ${snapshot.actions[0].title} ele alınmalıdır.`
        :"Acil görev görünmüyor.",
      evidence:snapshot.actions.slice(0,8).map(item=>`${item.title} · ${item.dueDays} gün içinde`),
      actions:snapshot.actions.slice(0,8).map(item=>item.detail),
      confidence:92,
    };
  }

  if(intent==="school-health"){
    const weakest=[...snapshot.pulse].sort((a,b)=>a.value-b.value)[0];
    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      query,
      intent,
      title:`Okul sağlık skoru: ${snapshot.schoolHealthScore}`,
      answer:weakest
        ?`En çok dikkat gerektiren alan ${weakest.label} (${weakest.value}).`
        :"Canlı okul verisi henüz yeterli değil.",
      evidence:snapshot.pulse.map(item=>`${item.label}: ${item.value} (${item.change>=0?"+":""}${item.change})`),
      actions:weakest?[
        `${weakest.label} göstergesini etkileyen son olayları inceleyin.`,
        "Bir hafta sonra aynı metriği tekrar karşılaştırın.",
      ]:[],
      confidence:90,
    };
  }

  const sourceByIntent={
    attendance:"attendance",
    homework:"homework",
    guidance:"guidance",
    parent:"parent",
  } as const;

  if(intent in sourceByIntent){
    const source=sourceByIntent[intent as keyof typeof sourceByIntent];
    const matching=events.filter(item=>item.source===source);
    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      query,
      intent,
      title:`${sourceLabel[source]} görünümü`,
      answer:matching.length
        ?`${matching.length} kayıt bulundu. ${matching[0].title}`
        :"Son yedi günlük veride kayıt bulunmuyor.",
      evidence:matching.slice(0,10).map(item=>`${item.title} · ${item.detail}`),
      actions:snapshot.actions
        .filter(item=>matching.some(event=>event.id===item.sourceEventId))
        .slice(0,5)
        .map(item=>item.title),
      confidence:88,
    };
  }

  if(intent==="classroom"){
    const classroomEvents=new Map<string,number>();
    for(const event of events){
      if(!event.classroom)continue;
      classroomEvents.set(event.classroom,(classroomEvents.get(event.classroom)||0)+1);
    }
    const top=[...classroomEvents.entries()].sort((a,b)=>b[1]-a[1])[0];
    return{
      version:"1.0",
      generatedAt:new Date().toISOString(),
      query,
      intent,
      title:top?`En fazla canlı olay: ${top[0]}`:"Sınıf bazlı veri bulunmuyor",
      answer:top
        ?`${top[0]} sınıfında ${top[1]} canlı olay kaydı bulunuyor.`
        :"Olay kayıtlarında sınıf bilgisi yer almıyor.",
      evidence:top
        ?events.filter(item=>item.classroom===top[0]).slice(0,8).map(item=>item.title)
        :[],
      actions:top?["Sınıf rehber öğretmeniyle kısa durum değerlendirmesi yapın."]:[],
      confidence:82,
    };
  }

  return{
    version:"1.0",
    generatedAt:new Date().toISOString(),
    query,
    intent:"unknown",
    title:"Soruyu yorumlayamadım",
    answer:"Soruyu günlük brifing, kritik gelişmeler, görevler, devamsızlık, ödev, rehberlik, veli veya okul sağlığı üzerinden yazın.",
    evidence:[],
    actions:[
      "Örneğin: Bugün okulda en önemli konu nedir?",
      "Örneğin: Önce hangi görevi yapmalıyım?",
    ],
    confidence:35,
  };
}
