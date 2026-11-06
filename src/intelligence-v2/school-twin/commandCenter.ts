import type {SchoolDigitalTwinResult} from "./types";

export type CommandCenterAgendaItem={
  rank:number;
  title:string;
  detail:string;
  level:"critical"|"warning"|"positive"|"info";
  metric?:string;
  action:string;
};

export function buildCommandCenterAgenda(
  twin:SchoolDigitalTwinResult,
):CommandCenterAgendaItem[]{
  const items:Omit<CommandCenterAgendaItem,"rank">[]=[];

  const riskyClass=twin.classroomSummaries[0];
  if(riskyClass&&riskyClass.averagePriorityScore>=45){
    items.push({
      title:`${riskyClass.classroom} sınıfında akademik risk yoğunluğu`,
      detail:`Sınıf öncelik puanı ${riskyClass.averagePriorityScore}/100. ${riskyClass.criticalCount} kritik öğrenci bulunuyor.`,
      level:riskyClass.averagePriorityScore>=65?"critical":"warning",
      metric:`${riskyClass.criticalCount} kritik`,
      action:"Sınıf rehber öğretmeni ve branş öğretmenleriyle kısa müdahale toplantısı planlayın.",
    });
  }

  const riskySubject=twin.branchSummaries[0];
  if(riskySubject){
    items.push({
      title:`${riskySubject.subject} ortak gelişim alanı`,
      detail:`${riskySubject.priorityStudentCount} öğrencide öncelikli alan. Ortalama başarı %${riskySubject.averageSuccessRate}.`,
      level:riskySubject.impactLevel==="high"?"critical":riskySubject.impactLevel==="medium"?"warning":"info",
      metric:`${riskySubject.priorityStudentCount} öğrenci`,
      action:"Branş zümresiyle ortak kazanım ve soru analizi yapın.",
    });
  }

  if(twin.scenarioImpact.netDifference>0){
    items.push({
      title:"Planlanan müdahale olumlu etki gösteriyor",
      detail:`Senaryo ortalama nette +${twin.scenarioImpact.netDifference.toFixed(2)} artış öngörüyor.`,
      level:"positive",
      metric:`+${twin.scenarioImpact.expectedTotalNetGain.toFixed(1)} toplam net`,
      action:"Senaryoyu iki haftalık kontrollü pilot uygulama olarak başlatın.",
    });
  }

  if(twin.optimizer?.allocations?.length){
    items.push({
      title:"Copilot kaynak planı hazır",
      detail:`${twin.optimizer.selectedStudentCount} öğrenci için ${twin.optimizer.allocatedMinutes} dakika kaynak dağıtıldı.`,
      level:"info",
      metric:`+${twin.optimizer.expectedTotalNetGain.toFixed(1)} net`,
      action:"İlk hafta planlanan oturumların uygulanma durumunu takip edin.",
    });
  }

  if(twin.criticalStudentCount===0){
    items.push({
      title:"Kritik öğrenci yoğunluğu bulunmuyor",
      detail:"Mevcut senaryoda kritik öncelik grubunda öğrenci görünmüyor.",
      level:"positive",
      action:"Aylık erken uyarı döngüsünü sürdürün.",
    });
  }

  return items
    .sort((a,b)=>{
      const weight={critical:4,warning:3,info:2,positive:1};
      return weight[b.level]-weight[a.level];
    })
    .map((item,index)=>({...item,rank:index+1}));
}
