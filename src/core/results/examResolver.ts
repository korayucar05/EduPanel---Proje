export type ExamIdentity={
  ids:string[];
  name:string;
  date:string;
};

const clean=(value:any)=>String(value??"").trim();
const normalize=(value:any)=>clean(value)
  .toLocaleLowerCase("tr-TR")
  .replace(/[^a-z0-9çğıöşü]/g,"");

export const getExamId=(exam:any):string=>clean(
  exam?.examId||exam?.id||exam?.recordId||exam?.code||exam?.examCode
);

export const getExamName=(exam:any):string=>clean(
  exam?.examName||exam?.name||exam?.title||exam?.sinavAdi||exam?.sınavAdı||"Sınav"
);

export const getExamDate=(exam:any):string=>clean(
  exam?.examDate||exam?.date||exam?.applicationDate||exam?.createdAt||exam?.sinavTarihi
);

export const getExamIdentity=(exam:any):ExamIdentity=>({
  ids:[
    exam?.examId,
    exam?.id,
    exam?.recordId,
    exam?.code,
    exam?.examCode,
  ].filter(Boolean).map((value:any)=>clean(value)),
  name:normalize(getExamName(exam)),
  date:normalize(getExamDate(exam)),
});

export const examIdentityMatches=(candidate:any,selected:any|ExamIdentity):boolean=>{
  if(!candidate||!selected)return false;
  const target=(selected as ExamIdentity)?.ids&&Array.isArray((selected as ExamIdentity).ids)
    ? selected as ExamIdentity
    : getExamIdentity(selected);
  const current=getExamIdentity(candidate);

  if(target.ids.length&&current.ids.some(id=>target.ids.includes(id)))return true;

  return Boolean(
    target.name&&current.name&&target.name===current.name&&
    (!target.date||!current.date||target.date===current.date)
  );
};

export const findExamMatch=<T=any>(rows:T[]|null|undefined,selected:any|ExamIdentity):T|undefined=>
  (Array.isArray(rows)?rows:[]).find(row=>examIdentityMatches(row,selected));

export const uniqueExams=<T=any>(rows:T[]|null|undefined):T[]=>{
  const result:T[]=[];
  const seen=new Set<string>();

  for(const row of Array.isArray(rows)?rows:[]){
    const identity=getExamIdentity(row);
    const key=identity.ids.length
      ? `id:${identity.ids[0]}`
      : `name:${identity.name}|date:${identity.date}`;
    if(!key||seen.has(key))continue;
    seen.add(key);
    result.push(row);
  }

  return result;
};
