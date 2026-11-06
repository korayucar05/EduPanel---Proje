export type IntelligenceCacheRecord<T=unknown>={
  key:string;
  value:T;
  createdAt:string;
  expiresAt:string;
  profileUpdatedAt:string;
  engineVersion:string;
};

const memoryCache=new Map<string,IntelligenceCacheRecord<any>>();

export function buildIntelligenceCacheKey({
  studentId,
  engine,
  version,
}:{
  studentId:string;
  engine:string;
  version:string;
}){
  return`${studentId}:${engine}:${version}`;
}

export function getCachedIntelligence<T>(
  key:string,
  profileUpdatedAt:string,
):T|undefined{
  const record=memoryCache.get(key);
  if(!record)return undefined;
  if(new Date(record.expiresAt).getTime()<=Date.now()){
    memoryCache.delete(key);
    return undefined;
  }
  if(record.profileUpdatedAt!==profileUpdatedAt)return undefined;
  return record.value as T;
}

export function setCachedIntelligence<T>({
  key,
  value,
  profileUpdatedAt,
  engineVersion,
  ttlMinutes=30,
}:{
  key:string;
  value:T;
  profileUpdatedAt:string;
  engineVersion:string;
  ttlMinutes?:number;
}):T{
  const createdAt=new Date();
  const expiresAt=new Date(createdAt.getTime()+ttlMinutes*60_000);
  memoryCache.set(key,{
    key,
    value,
    createdAt:createdAt.toISOString(),
    expiresAt:expiresAt.toISOString(),
    profileUpdatedAt,
    engineVersion,
  });
  return value;
}

export function clearStudentIntelligenceCache(studentId:string){
  for(const key of memoryCache.keys()){
    if(key.startsWith(`${studentId}:`))memoryCache.delete(key);
  }
}

export function clearAllIntelligenceCache(){
  memoryCache.clear();
}
