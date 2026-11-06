import {examIdentityMatches} from "./examResolver";
import {uniqueStudentRows} from "../student";

export type ReportLike={
  id?:string;
  examId?:string;
  examName?:string;
  results?:any[];
  student?:any;
  [key:string]:any;
};

const reportExam=(report:ReportLike)=>({
  id:report?.examId,
  examId:report?.examId,
  examName:report?.examName,
  name:report?.examName,
});

export const reportsForSameExam=<T extends ReportLike>(
  reports:T[]|null|undefined,
  selectedReport:T|undefined|null,
):T[]=>{
  if(!selectedReport)return[];
  return (Array.isArray(reports)?reports:[]).filter(report=>
    report===selectedReport||examIdentityMatches(reportExam(report),reportExam(selectedReport))
  );
};

export const collectExamResultsFromReports=<T=any>(
  reports:ReportLike[]|null|undefined,
  selectedReport:ReportLike|undefined|null,
):T[]=>{
  const rows=reportsForSameExam(reports,selectedReport)
    .flatMap(report=>Array.isArray(report?.results)?report.results:[]);
  return uniqueStudentRows<T>(rows as T[]);
};

export const getReportResults=<T=any>(report:ReportLike|undefined|null):T[]=>
  uniqueStudentRows<T>(Array.isArray(report?.results)?report.results:[]);

export const reportHasResults=(report:ReportLike|undefined|null):boolean=>
  getReportResults(report).length>0;
