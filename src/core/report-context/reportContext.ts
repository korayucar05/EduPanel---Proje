import {
  collectExamResultsFromReports,
  getExamIdentity,
  getExamName,
  getReportResults,
  requireStudentResult,
  resolveRegisteredStudent,
  type ReportLike,
} from "../results";
import {
  getStudentClassroom,
  getStudentIdentity,
  getStudentName,
  getStudentNumber,
  type StudentIdentity,
} from "../student";

export type ReportAudience="admin"|"teacher"|"student"|"parent"|"family";

export type ReportContext<TExam=any,TResult=any,TStudent=any>={
  exam:TExam;
  examIdentity:ReturnType<typeof getExamIdentity>;
  examName:string;
  results:TResult[];
  selectedResult:TResult;
  registeredStudent?:TStudent;
  studentIdentity:StudentIdentity;
  studentNumber:string;
  studentName:string;
  classroom:string;
  audience:ReportAudience;
  sourceReport?:ReportLike;
  sourceReports:ReportLike[];
  createdAt:string;
};

export type BuildReportContextInput<TExam=any,TResult=any,TStudent=any>={
  exam:TExam;
  results?:TResult[];
  selectedStudent:any;
  registeredStudents?:TStudent[];
  audience?:ReportAudience;
  sourceReport?:ReportLike;
  sourceReports?:ReportLike[];
};

const safeArray=<T,>(value:T[]|null|undefined):T[]=>
  Array.isArray(value)?value:[];

export function buildReportContext<TExam=any,TResult=any,TStudent=any>({
  exam,
  results,
  selectedStudent,
  registeredStudents,
  audience="student",
  sourceReport,
  sourceReports=[],
}:BuildReportContextInput<TExam,TResult,TStudent>):ReportContext<TExam,TResult,TStudent>{
  const reports=safeArray(sourceReports);
  const reportResults=sourceReport
    ? collectExamResultsFromReports<TResult>(reports,sourceReport)
    : [];
  const candidateResults=reportResults.length
    ? reportResults
    : safeArray(results);

  const selectedResult=requireStudentResult<TResult>(
    candidateResults,
    selectedStudent,
    "Rapor bağlamı için öğrenci sınav sonucu",
  );

  const registeredStudent=resolveRegisteredStudent<TStudent>(
    registeredStudents,
    selectedResult,
  );

  const identitySource={
    ...(registeredStudent as any||{}),
    ...(selectedResult as any||{}),
  };
  const studentIdentity=getStudentIdentity(identitySource);

  return{
    exam,
    examIdentity:getExamIdentity(exam),
    examName:getExamName(exam),
    results:candidateResults,
    selectedResult,
    registeredStudent,
    studentIdentity,
    studentNumber:getStudentNumber(identitySource),
    studentName:getStudentName(identitySource),
    classroom:getStudentClassroom(identitySource),
    audience,
    sourceReport,
    sourceReports:reports,
    createdAt:new Date().toISOString(),
  };
}

export function buildReportContextFromReport<TExam=any,TResult=any,TStudent=any>({
  exam,
  report,
  reports,
  selectedStudent,
  registeredStudents,
  audience,
}:{
  exam:TExam;
  report:ReportLike;
  reports:ReportLike[];
  selectedStudent:any;
  registeredStudents?:TStudent[];
  audience?:ReportAudience;
}):ReportContext<TExam,TResult,TStudent>{
  return buildReportContext<TExam,TResult,TStudent>({
    exam,
    results:getReportResults<TResult>(report),
    selectedStudent,
    registeredStudents,
    audience,
    sourceReport:report,
    sourceReports:reports,
  });
}
