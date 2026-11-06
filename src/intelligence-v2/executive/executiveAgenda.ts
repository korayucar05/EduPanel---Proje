import type {ExecutiveCenterInput,ExecutiveTask} from "./types";

export function buildExecutiveTasks({
  cohort,
  schoolTwin,
}:ExecutiveCenterInput):ExecutiveTask[]{
  const tasks:ExecutiveTask[]=[];

  for(const student of cohort.ranking.slice(0,8)){
    tasks.push({
      id:`student-${student.student.id}`,
      title:`${student.student.name} için müdahale planı`,
      detail:student.topReasons[0]||student.headline,
      owner:student.priorityLevel==="critical"?"guidance":"teacher",
      priority:student.priorityLevel==="critical"?5:student.priorityLevel==="high"?4:3,
      dueDays:student.priorityLevel==="critical"?7:14,
      expectedGain:student.expectedGain,
      classroom:student.student.classroom,
    });
  }

  const classroom=schoolTwin.classroomSummaries[0];
  if(classroom){
    tasks.push({
      id:`class-${classroom.classroom}`,
      title:`${classroom.classroom} sınıfı akademik toplantısı`,
      detail:`Sınıf öncelik puanı ${classroom.averagePriorityScore}/100.`,
      owner:"management",
      priority:classroom.averagePriorityScore>=65?5:4,
      dueDays:3,
      expectedGain:classroom.expectedGain,
      classroom:classroom.classroom,
    });
  }

  const subject=schoolTwin.branchSummaries[0];
  if(subject){
    tasks.push({
      id:`subject-${subject.subject}`,
      title:`${subject.subject} zümre müdahale planı`,
      detail:`${subject.priorityStudentCount} öğrenci için ortak gelişim alanı.`,
      owner:"teacher",
      priority:subject.impactLevel==="high"?5:4,
      dueDays:5,
      expectedGain:subject.expectedGain,
      subject:subject.subject,
    });
  }

  return tasks
    .sort((a,b)=>b.priority-a.priority||(b.expectedGain||0)-(a.expectedGain||0))
    .slice(0,15);
}
