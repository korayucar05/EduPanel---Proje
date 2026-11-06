export const STUDENT_NUMBER_KEYS=[
  "studentNumber","studentNo","schoolNumber","schoolNo","number","no",
  "ogrenciNo","öğrenciNo","okulNo","okulNumarasi","okulNumarası","numara",
] as const;

export const normalizeStudentText=(value:any)=>String(value??"")
  .toLocaleLowerCase("tr-TR")
  .replace(/[^a-z0-9çğıöşü]/g,"");

export const readFirstStudentValue=(item:any,keys:readonly string[])=>{
  for(const key of keys){
    const value=item?.[key];
    if(value!==undefined&&value!==null&&String(value).trim())return String(value).trim();
  }
  return "";
};

export const getStudentNumber=(item:any):string=>{
  const direct=readFirstStudentValue(item,STUDENT_NUMBER_KEYS);
  if(direct)return direct;
  const nested=[item?.student,item?.profile,item?.identity,item?.registration,item?.personalInfo,item?.studentInfo,item?.data].filter(Boolean);
  for(const source of nested){
    const value=readFirstStudentValue(source,STUDENT_NUMBER_KEYS);
    if(value)return value;
  }

  // e-Nstitü'nün eski öğrenci kayıtlarında okul numarası doğrudan `id` alanında
  // tutuluyordu. Veritabanı belge kimliği ise ayrıca `__documentId`/`recordId`
  // alanında bulunur. Yalnızca okul numarası biçimindeki sayısal id'yi geri dönüş
  // olarak kabul ederek UUID/belge kimliklerinin yanlışlıkla okul no görünmesini önle.
  const legacyId=String(item?.id??"").trim();
  if(/^\d{1,12}$/.test(legacyId))return legacyId;
  return "";
};

export const normalizeStudentNumberFields=<T=any>(item:T):T=>{
  if(!item||typeof item!=="object")return item;
  const student=item as any;
  const number=getStudentNumber(student);
  if(!number)return item;
  const currentNumber=String(student?.number??"").trim();
  const currentStudentNumber=String(student?.studentNumber??"").trim();
  if(currentNumber===number&&currentStudentNumber===number)return item;
  return { ...student, number, studentNumber:number } as T;
};

export const normalizeStudentRows=<T=any>(rows:T[]|null|undefined):T[]=>
  (Array.isArray(rows)?rows:[]).map((row)=>normalizeStudentNumberFields(row));

export const getStudentName=(item:any):string=>String(
  item?.studentName||item?.fullName||item?.name||item?.adSoyad||item?.ogrenciAdSoyad||item?.studentFullName||
  [item?.firstName||item?.ad||item?.adi||item?.ogrenciAdi||item?.öğrenciAdi,
   item?.lastName||item?.surname||item?.soyad||item?.soyadi||item?.ogrenciSoyadi||item?.öğrenciSoyadi]
    .filter(Boolean).join(" ")||""
).trim();

export const getStudentClassroom=(item:any):string=>String(
  item?.classroom||item?.className||item?.sinif||item?.sınıf||item?.class||item?.gradeLevel||""
).trim();

export type StudentIdentity={
  ids:string[];
  number:string;
  name:string;
  classroom:string;
};

export const getStudentIdentity=(item:any):StudentIdentity=>({
  ids:[item?.recordId,item?.id,item?.studentId,item?.student_id]
    .filter(Boolean).map((value:any)=>String(value).trim()),
  number:getStudentNumber(item),
  name:normalizeStudentText(getStudentName(item)),
  classroom:normalizeStudentText(getStudentClassroom(item)),
});

export const studentIdentityMatches=(candidate:any,selected:any|StudentIdentity):boolean=>{
  if(!candidate||!selected)return false;
  const target=(selected as StudentIdentity)?.ids&&Array.isArray((selected as StudentIdentity).ids)
    ? selected as StudentIdentity
    : getStudentIdentity(selected);
  const current=getStudentIdentity(candidate);
  if(target.ids.length&&current.ids.some(id=>target.ids.includes(id)))return true;
  if(target.number&&current.number&&target.number===current.number)return true;
  return Boolean(target.name&&current.name&&target.name===current.name&&(
    !target.classroom||!current.classroom||target.classroom===current.classroom
  ));
};

export const findStudentMatch=<T=any>(rows:T[]|null|undefined,selected:any|StudentIdentity):T|undefined=>
  (Array.isArray(rows)?rows:[]).find(row=>studentIdentityMatches(row,selected));

export const uniqueStudentRows=<T=any>(rows:T[]|null|undefined):T[]=>{
  const result:T[]=[];
  const seen=new Set<string>();
  for(const row of Array.isArray(rows)?rows:[]){
    const identity=getStudentIdentity(row);
    const key=identity.number?`no:${identity.number}`:
      identity.ids.length?`id:${identity.ids[0]}`:
      `name:${identity.name}|class:${identity.classroom}`;
    if(!key||seen.has(key))continue;
    seen.add(key);result.push(row);
  }
  return result;
};
