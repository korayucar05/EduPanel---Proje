import {examIdentityMatches, uniqueExams} from "./examResolver";
import {resolveStudentResult} from "./studentResultResolver";

export type ExamResultSource={
  exam:any;
  results:any[];
  isCurrent:boolean;
};

export const buildExamResultSources=({
  selectedExam,
  currentResults,
  availableExams,
  evaluateExam,
}:{
  selectedExam:any;
  currentResults:any[];
  availableExams:any[];
  evaluateExam?:(exam:any)=>any[];
}):ExamResultSource[]=>{
  const exams=uniqueExams([
    ...(Array.isArray(availableExams)?availableExams:[]),
    selectedExam,
  ].filter(Boolean));

  return exams.map(exam=>{
    const isCurrent=examIdentityMatches(exam,selectedExam);
    let results:any[]=[];
    try{
      results=isCurrent
        ? (Array.isArray(currentResults)?currentResults:[])
        : evaluateExam
          ? evaluateExam(exam)
          : Array.isArray(exam?.results)
            ? exam.results
            : [];
    }catch{
      results=[];
    }
    return{
      exam,
      results:Array.isArray(results)?results:[],
      isCurrent,
    };
  });
};

export const resolveStudentHistoryRows=({
  selectedStudent,
  sources,
}:{
  selectedStudent:any;
  sources:ExamResultSource[];
})=>sources
  .map(source=>({
    ...source,
    studentResult:resolveStudentResult(source.results,selectedStudent).result,
  }))
  .filter(source=>Boolean(source.studentResult));
