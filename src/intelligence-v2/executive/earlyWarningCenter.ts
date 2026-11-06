import type {ExecutiveAlert,ExecutiveCenterInput} from "./types";

export function buildExecutiveAlerts({
  cohort,
  schoolTwin,
}:ExecutiveCenterInput):ExecutiveAlert[]{
  const alerts:ExecutiveAlert[]=[];

  const criticalRate=cohort.totalStudents
    ?cohort.criticalCount/cohort.totalStudents*100
    :0;

  if(criticalRate>=10){
    alerts.push({
      key:"critical-density",
      title:"Kritik öğrenci yoğunluğu yükseldi",
      detail:`Öğrencilerin %${criticalRate.toFixed(1)}'i kritik müdahale grubunda.`,
      level:criticalRate>=20?"critical":"warning",
      metric:`${cohort.criticalCount} öğrenci`,
      action:"İlk 10 öğrenci için yedi günlük müdahale ve takip planı oluşturun.",
    });
  }

  const classroom=schoolTwin.classroomSummaries[0];
  if(classroom&&classroom.averagePriorityScore>=45){
    alerts.push({
      key:`classroom-${classroom.classroom}`,
      title:`${classroom.classroom} sınıfında risk yoğunluğu`,
      detail:`Sınıf öncelik puanı ${classroom.averagePriorityScore}/100.`,
      level:classroom.averagePriorityScore>=65?"critical":"warning",
      metric:`${classroom.criticalCount} kritik`,
      action:"Sınıf rehber öğretmeni ve branş öğretmenleriyle kısa durum toplantısı yapın.",
    });
  }

  const subject=schoolTwin.branchSummaries[0];
  if(subject&&subject.priorityStudentCount>0){
    alerts.push({
      key:`subject-${subject.subject}`,
      title:`${subject.subject} ortak gelişim alanı`,
      detail:`${subject.priorityStudentCount} öğrencide öncelikli ders olarak görülüyor.`,
      level:subject.impactLevel==="high"?"critical":subject.impactLevel==="medium"?"warning":"info",
      metric:`%${subject.averageSuccessRate}`,
      action:"Branş zümresiyle ortak kazanım ve soru analizi planlayın.",
    });
  }

  if(schoolTwin.scenarioImpact.netDifference>0){
    alerts.push({
      key:"scenario-positive",
      title:"Planlanan müdahale olumlu etki gösteriyor",
      detail:`Senaryo okul ortalamasında +${schoolTwin.scenarioImpact.netDifference.toFixed(2)} net artışı öngörüyor.`,
      level:"positive",
      metric:`+${schoolTwin.scenarioImpact.expectedTotalNetGain.toFixed(1)} net`,
      action:"Senaryoyu iki haftalık pilot uygulama olarak başlatın.",
    });
  }

  if(!alerts.length){
    alerts.push({
      key:"stable",
      title:"Okul akademik görünümü dengeli",
      detail:"Mevcut veride kritik yoğunlukta ortak risk tespit edilmedi.",
      level:"positive",
      action:"Aylık erken uyarı ve müdahale kontrollerini sürdürün.",
    });
  }

  return alerts;
}
