import {createHash,randomBytes,timingSafeEqual} from "node:crypto";

export const randomSecret=(bytes=24)=>randomBytes(bytes).toString("base64url");
export const hashSecret=(value:string)=>createHash("sha256").update(value).digest("hex");

export const safeHashEqual=(left:string,right:string)=>{
  const a=Buffer.from(left,"hex");
  const b=Buffer.from(right,"hex");
  return a.length===b.length&&timingSafeEqual(a,b);
};
