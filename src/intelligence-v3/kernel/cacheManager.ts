import type {IntelligenceKernelResult} from "./types";

type CacheEntry={
  value:IntelligenceKernelResult;
  expiresAt:number;
};

const cache=new Map<string,CacheEntry>();

export function getKernelCache(key:string){
  const entry=cache.get(key);
  if(!entry)return undefined;
  if(entry.expiresAt<=Date.now()){
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setKernelCache(
  key:string,
  value:IntelligenceKernelResult,
  ttlMinutes=20,
){
  cache.set(key,{
    value,
    expiresAt:Date.now()+ttlMinutes*60_000,
  });
  return value;
}

export function clearKernelCache(key?:string){
  if(key)cache.delete(key);
  else cache.clear();
}
