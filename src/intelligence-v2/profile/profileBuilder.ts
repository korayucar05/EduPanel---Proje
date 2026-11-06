import type {StudentReportV2Data} from "../../reports-v2/types";
import {
  appendExamHistory,
  createAcademicDigitalProfile,
  updateAcademicDigitalProfile,
} from "./academicDigitalProfile";
import type {
  AcademicDigitalProfile,
  ExamHistoryEntry,
  StudentId,
} from "../core/types";

const clean=(value:any)=>String(value??"").trim();

const studentIdFromReport=(report:StudentReportV2Data):StudentId=>
  clean(report.student.number)||
  clean((report as any).studentId)||
  `${clean(report.student.name)}|${clean(report.student.classroom)}`;

const reportToExamHistory=(report:StudentReportV2Data):ExamHistoryEntry=>({
  examId:clean((report as any).examId)||clean(report.reportCode)||clean(report.examName),
  examName:report.examName,
  examDate:report.examDate||report.reportDate,
  examType:report.metadata?.examType,
  totalNet:Number(report.totals.net||0),
  totalScore:report.totals.score,
  successRate:Number(report.totals.successRate||0),
  classroomRank:Number((report.rankings||[]).find(item=>
    String(item.label).toLocaleLowerCase("tr-TR").includes("sınıf")
  )?.rank)||undefined,
  institutionRank:Number((report.rankings||[]).find(item=>
    String(item.label).toLocaleLowerCase("tr-TR").includes("kurum")
  )?.rank)||undefined,
  subjects:(report.subjects||[]).map(subject=>({
    subject:subject.subjectName,
    correct:Number(subject.correct||0),
    wrong:Number(subject.wrong||0),
    empty:Number(subject.empty||0),
    net:Number(subject.net||0),
    successRate:Number(subject.successRate||0),
  })),
});

export function buildAcademicDigitalProfileFromReports(
  reports:StudentReportV2Data[],
  existing?:AcademicDigitalProfile,
):AcademicDigitalProfile{
  if(!reports.length){
    if(existing)return existing;
    throw new Error("Akademik dijital profil için en az bir öğrenci raporu gerekir.");
  }

  const latest=reports[reports.length-1];
  let profile=existing||createAcademicDigitalProfile({
    student:{
      id:studentIdFromReport(latest),
      number:latest.student.number,
      name:latest.student.name,
      classroom:latest.student.classroom,
      branch:latest.student.branch,
      schoolName:latest.schoolName,
    },
  });

  for(const report of reports){
    profile=appendExamHistory(profile,reportToExamHistory(report));
  }

  const latestTarget=latest.targetAnalysis?.definition;
  const profileWithTarget=latestTarget
    ?updateAcademicDigitalProfile(profile,{
      targetHistory:[
        ...profile.targetHistory.filter(item=>
          item.university!==latestTarget.university||
          item.program!==latestTarget.program||
          item.targetNet!==latestTarget.targetNet
        ),
        {
          date:latest.targetAnalysis?.definition.updatedAt||latest.reportDate||new Date().toISOString(),
          university:latestTarget.university,
          program:latestTarget.program,
          scoreType:latestTarget.scoreType,
          targetScore:latestTarget.targetScore,
          targetNet:latestTarget.targetNet,
          targetYear:latestTarget.targetYear,
        },
      ],
    })
    :profile;

  const teacher=latest.teacherEvaluation;
  return teacher?.observation
    ?updateAcademicDigitalProfile(profileWithTarget,{
      teacherObservations:[
        ...profileWithTarget.teacherObservations,
        {
          date:teacher.evaluationDate||latest.reportDate||new Date().toISOString(),
          teacherName:teacher.teacherName,
          observation:teacher.observation,
          recommendation:teacher.recommendation,
          followUpDate:teacher.nextReviewDate,
        },
      ],
    })
    :profileWithTarget;
}
