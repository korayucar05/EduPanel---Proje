import {
  findStudentMatch,
  getStudentClassroom,
  getStudentIdentity,
  getStudentName,
  getStudentNumber,
  studentIdentityMatches,
  uniqueStudentRows,
  type StudentIdentity,
} from "../student";

export type StudentResultResolution<T=any>={
  result?:T;
  matchedBy:"direct"|"number"|"id"|"name-class"|"none";
  candidateCount:number;
  identity:StudentIdentity;
};

const directReferenceMatch=(candidate:any,selected:any)=>
  Boolean(candidate&&selected&&candidate===selected);

const identifyMatchMethod=(candidate:any,identity:StudentIdentity):StudentResultResolution["matchedBy"]=>{
  const current=getStudentIdentity(candidate);
  if(identity.number&&current.number&&identity.number===current.number)return"number";
  if(identity.ids.length&&current.ids.some(id=>identity.ids.includes(id)))return"id";
  if(identity.name&&current.name&&identity.name===current.name&&(
    !identity.classroom||!current.classroom||identity.classroom===current.classroom
  ))return"name-class";
  return"none";
};

export const resolveStudentResult=<T=any>(
  rows:T[]|null|undefined,
  selected:any|StudentIdentity,
):StudentResultResolution<T>=>{
  const candidates=uniqueStudentRows(rows);
  const identity=(selected as StudentIdentity)?.ids&&Array.isArray((selected as StudentIdentity).ids)
    ? selected as StudentIdentity
    : getStudentIdentity(selected);

  const direct=candidates.find(row=>directReferenceMatch(row,selected));
  if(direct){
    return{
      result:direct,
      matchedBy:"direct",
      candidateCount:candidates.length,
      identity,
    };
  }

  const result=findStudentMatch(candidates,identity);
  return{
    result,
    matchedBy:result?identifyMatchMethod(result,identity):"none",
    candidateCount:candidates.length,
    identity,
  };
};

export const requireStudentResult=<T=any>(
  rows:T[]|null|undefined,
  selected:any|StudentIdentity,
  context="Öğrenci sınav sonucu",
):T=>{
  const resolution=resolveStudentResult<T>(rows,selected);
  if(resolution.result)return resolution.result;

  const display=[
    resolution.identity.number?`No: ${resolution.identity.number}`:"",
    getStudentName(selected),
    getStudentClassroom(selected),
  ].filter(Boolean).join(" · ");

  throw new Error(
    `${context} bulunamadı${display?` (${display})`:""}. `+
    `${resolution.candidateCount} sınav sonucu kontrol edildi.`
  );
};

export const resolveRegisteredStudent=<T=any>(
  registeredStudents:T[]|null|undefined,
  studentResult:any,
):T|undefined=>findStudentMatch(registeredStudents,studentResult);

export const mergeStudentRecordAndResult=(
  registeredStudent:any,
  studentResult:any,
)=>{
  const record=registeredStudent||{};
  const result=studentResult||{};
  return{
    ...record,
    ...result,
    studentNumber:getStudentNumber(result)||getStudentNumber(record),
    studentName:getStudentName(result)||getStudentName(record),
    classroom:getStudentClassroom(result)||getStudentClassroom(record),
    registeredStudent:registeredStudent||undefined,
    studentResult:studentResult||undefined,
  };
};

export const findAllStudentResults=<T=any>(
  rows:T[]|null|undefined,
  selected:any|StudentIdentity,
):T[]=>{
  const identity=(selected as StudentIdentity)?.ids&&Array.isArray((selected as StudentIdentity).ids)
    ? selected as StudentIdentity
    : getStudentIdentity(selected);

  return uniqueStudentRows(rows).filter(row=>studentIdentityMatches(row,identity));
};
