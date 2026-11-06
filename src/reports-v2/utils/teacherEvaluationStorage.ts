import type { TeacherEvaluation } from "../types";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
export function teacherEvaluationStorageKey(studentNumber:any){
  return `hasat_teacher_evaluation_${String(studentNumber||"unknown")}`;
}

export function loadTeacherEvaluation(studentNumber:any):TeacherEvaluation{
  try{
    const raw=sqliteStorage.getItem(teacherEvaluationStorageKey(studentNumber));
    if(!raw)return{};
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{
    return{};
  }
}

export function saveTeacherEvaluation(studentNumber:any,value:TeacherEvaluation){
  sqliteStorage.setItem(
    teacherEvaluationStorageKey(studentNumber),
    JSON.stringify({...value,updatedAt:new Date().toISOString()}),
  );
}
