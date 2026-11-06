import type { StudentReportV2Data } from "../types";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
export type LiveReportRecord={
  token:string;
  createdAt:string;
  expiresAt:string;
  report:StudentReportV2Data;
};

const PREFIX="hasat_live_report_";

const randomToken=()=>{
  const bytes=new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,value=>value.toString(16).padStart(2,"0")).join("");
};

export function publishLiveReport(report:StudentReportV2Data,validDays=30):LiveReportRecord{
  const token=randomToken();
  const createdAt=new Date();
  const expiresAt=new Date(createdAt.getTime()+validDays*24*60*60*1000);
  const record:LiveReportRecord={
    token,
    createdAt:createdAt.toISOString(),
    expiresAt:expiresAt.toISOString(),
    report,
  };
  sqliteStorage.setItem(`${PREFIX}${token}`,JSON.stringify(record));
  return record;
}

export function loadLiveReport(token:string):LiveReportRecord|null{
  try{
    const raw=sqliteStorage.getItem(`${PREFIX}${token}`);
    if(!raw)return null;
    const record=JSON.parse(raw) as LiveReportRecord;
    if(!record?.token||!record?.report)return null;
    if(new Date(record.expiresAt).getTime()<Date.now()){
      sqliteStorage.removeItem(`${PREFIX}${token}`);
      return null;
    }
    return record;
  }catch{
    return null;
  }
}

export function revokeLiveReport(token:string){
  sqliteStorage.removeItem(`${PREFIX}${token}`);
}

export function buildLiveReportUrl(token:string){
  const url=new URL(window.location.href);
  url.search="";
  url.hash="";
  url.searchParams.set("mode","live-report");
  url.searchParams.set("token",token);
  return url.toString();
}
