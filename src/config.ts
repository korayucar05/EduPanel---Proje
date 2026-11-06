import "dotenv/config";
import path from "node:path";

const integer=(value:string|undefined,fallback:number)=>{
  const parsed=Number(value);
  return Number.isInteger(parsed)&&parsed>0?parsed:fallback;
};

export const config={
  port:integer(process.env.PORT,8787),
  publicAppUrl:String(process.env.HASAT_PUBLIC_APP_URL||"http://localhost:3000").replace(/\/+$/,""),
  allowedOrigins:String(process.env.HASAT_ALLOWED_ORIGINS||"http://localhost:3000")
    .split(",")
    .map(value=>value.trim())
    .filter(Boolean),
  dbPath:path.resolve(process.env.HASAT_DB_PATH||"./data/hasat-live-reports.db"),
  maxReportBytes:integer(process.env.HASAT_MAX_REPORT_BYTES,900000),
  maxValidDays:integer(process.env.HASAT_MAX_VALID_DAYS,90),
};
