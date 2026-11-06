import type {
  IntelligenceKernelInput,
  KernelRecommendation,
  KernelRecommendationLevel,
} from "./types";

const levelWeight:Record<KernelRecommendationLevel,number>={
  critical:4,
  high:3,
  medium:2,
  low:1,
};

export function buildKernelRecommendations(
  input:IntelligenceKernelInput,
):KernelRecommendation[]{
  const items:KernelRecommendation[]=[];

  for(const student of input.warning.topWarnings.slice(0,12)){
    items.push({
      id:`warning-${student.studentId}`,
      title:`${student.studentName} için erken müdahale`,
      detail:student.reasons[0]||"Risk artışı tespit edildi.",
      action:student.recommendedActions[0]||"Yakın takip planlayın.",
      level:student.predictedWarningLevel==="critical"
        ?"critical"
        :student.predictedWarningLevel==="high"
          ?"high"
          :student.predictedWarningLevel==="medium"
            ?"medium"
            :"low",
      owner:student.predictedWarningLevel==="critical"?"guidance":"teacher",
      score:student.warningScore,
      classroom:student.classroom,
      studentId:student.studentId,
      source:"early-warning",
    });
  }

  for(const task of input.executive.tasks.slice(0,10)){
    items.push({
      id:`executive-${task.id}`,
      title:task.title,
      detail:task.detail,
      action:task.detail,
      level:task.priority>=5?"critical":task.priority>=4?"high":"medium",
      owner:task.owner,
      score:task.priority*20,
      expectedGain:task.expectedGain,
      classroom:task.classroom,
      subject:task.subject,
      source:"executive",
    });
  }

  const riskyClass=input.schoolTwin.classroomSummaries[0];
  if(riskyClass){
    items.push({
      id:`classroom-${riskyClass.classroom}`,
      title:`${riskyClass.classroom} sınıfı akademik müdahale`,
      detail:`Öncelik puanı ${riskyClass.averagePriorityScore}/100.`,
      action:"Sınıf rehber öğretmeni ve branş öğretmenleriyle ortak plan oluşturun.",
      level:riskyClass.averagePriorityScore>=65?"critical":"high",
      owner:"management",
      score:riskyClass.averagePriorityScore,
      expectedGain:riskyClass.expectedGain,
      classroom:riskyClass.classroom,
      source:"school-twin",
    });
  }

  const branch=input.schoolTwin.branchSummaries[0];
  if(branch){
    items.push({
      id:`subject-${branch.subject}`,
      title:`${branch.subject} branş müdahalesi`,
      detail:`${branch.priorityStudentCount} öğrencide ortak gelişim alanı.`,
      action:"Kazanım ve soru analizi temelli zümre planı hazırlayın.",
      level:branch.impactLevel==="high"?"critical":branch.impactLevel==="medium"?"high":"medium",
      owner:"teacher",
      score:Math.min(100,branch.priorityStudentCount*5+(100-branch.averageSuccessRate)),
      expectedGain:branch.expectedGain,
      subject:branch.subject,
      source:"school-twin",
    });
  }

  const placement=input.university.highImpactStudents[0];
  if(placement){
    items.push({
      id:`university-${placement.studentId}`,
      title:`${placement.studentName} için üniversite hedef desteği`,
      detail:`Yerleşme olasılığında +${placement.probabilityChange} puan artış potansiyeli.`,
      action:`${placement.primaryNeed||"Öncelikli ders planı oluşturun."}`,
      level:placement.probabilityChange>=20?"high":"medium",
      owner:"teacher",
      score:Math.min(100,placement.probabilityChange*3),
      expectedGain:placement.predictedNet-placement.currentNet,
      classroom:placement.classroom,
      studentId:placement.studentId,
      source:"university",
    });
  }

  return items
    .sort((a,b)=>
      levelWeight[b.level]-levelWeight[a.level]||
      b.score-a.score||
      (b.expectedGain||0)-(a.expectedGain||0)
    )
    .filter((item,index,array)=>
      array.findIndex(candidate=>candidate.id===item.id)===index
    )
    .slice(0,30);
}
