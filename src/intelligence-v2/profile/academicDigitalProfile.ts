import type {
  AcademicDigitalProfile,
  ExamHistoryEntry,
  StudentId,
} from "../core/types";

const now=()=>new Date().toISOString();

export function createAcademicDigitalProfile({
  student,
  sourceVersion="e-Nstitü-4.0",
}:{
  student:AcademicDigitalProfile["student"];
  sourceVersion?:string;
}):AcademicDigitalProfile{
  const timestamp=now();
  return{
    version:"2.0",
    student,
    examHistory:[],
    attendanceHistory:[],
    studyHistory:[],
    targetHistory:[],
    interventionHistory:[],
    teacherObservations:[],
    parentInteractions:[],
    behaviorHistory:[],
    predictionHistory:[],
    metadata:{
      createdAt:timestamp,
      updatedAt:timestamp,
      sourceVersion,
    },
  };
}

export function profileId(profile:AcademicDigitalProfile):StudentId{
  return profile.student.id;
}

export function appendExamHistory(
  profile:AcademicDigitalProfile,
  exam:ExamHistoryEntry,
):AcademicDigitalProfile{
  const withoutDuplicate=profile.examHistory.filter(item=>item.examId!==exam.examId);
  return{
    ...profile,
    examHistory:[...withoutDuplicate,exam].sort((a,b)=>
      String(a.examDate||"").localeCompare(String(b.examDate||""))
    ),
    metadata:{...profile.metadata,updatedAt:now()},
  };
}

export function updateAcademicDigitalProfile(
  profile:AcademicDigitalProfile,
  patch:Partial<Omit<AcademicDigitalProfile,"version"|"student"|"metadata">>,
):AcademicDigitalProfile{
  return{
    ...profile,
    ...patch,
    metadata:{...profile.metadata,updatedAt:now()},
  };
}
