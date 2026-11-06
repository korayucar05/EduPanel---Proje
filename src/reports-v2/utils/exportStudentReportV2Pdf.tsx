import React from "react";
import { createRoot } from "react-dom/client";
import { toJpeg } from "html-to-image";
import { StudentReportV2 } from "../components/StudentReportV2";
import type { StudentReportV2Data } from "../types";

const wait=(ms:number)=>new Promise(resolve=>window.setTimeout(resolve,ms));

function dataUrlToBytes(dataUrl:string){
  const binary=atob(dataUrl.split(",")[1]||"");
  const bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);
  return bytes;
}

function jpegPagesToPdf(pages:Array<{jpeg:Uint8Array;width:number;height:number}>):Blob{
  const enc=new TextEncoder();
  const chunks:(Uint8Array|string)[]=[];
  const offsets:number[]=[0];
  let length=0;
  const push=(value:Uint8Array|string)=>{chunks.push(value);length+=typeof value==="string"?enc.encode(value).length:value.length;};
  push("%PDF-1.4\n");
  const totalObjects=2+pages.length*3;
  const pageIds=pages.map((_,index)=>3+index*3);
  const object=(id:number,body:(()=>void)|string)=>{offsets[id]=length;push(`${id} 0 obj\n`);typeof body==="string"?push(body):body();push("\nendobj\n");};
  object(1,"<< /Type /Catalog /Pages 2 0 R >>");
  object(2,`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((page,index)=>{
    const pageId=3+index*3,imageId=pageId+1,contentId=pageId+2;
    object(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    object(imageId,()=>{push(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);push(page.jpeg);push("\nendstream");});
    const stream=`q\n595 0 0 842 0 0 cm\n/Im${index} Do\nQ`;
    object(contentId,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  const xref=length;
  push(`xref\n0 ${totalObjects+1}\n0000000000 65535 f \n`);
  for(let index=1;index<=totalObjects;index+=1)push(`${String(offsets[index]).padStart(10,"0")} 00000 n \n`);
  push(`trailer\n<< /Size ${totalObjects+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const blobParts: BlobPart[] = chunks.map((chunk) => {
    if (typeof chunk === "string") return chunk;
    return new Uint8Array(chunk).buffer;
  });
  return new Blob(blobParts,{type:"application/pdf"});
}

function safeReportForExport(report:StudentReportV2Data):StudentReportV2Data{
  const photoUrl=String(report.student.photoUrl||"").trim();
  const safePhoto=photoUrl.startsWith("data:")||photoUrl.startsWith("blob:")
    ? photoUrl
    : undefined;
  return {
    ...report,
    student:{
      ...report.student,
      // Uzak kaynaklı görseller canvas güvenliğini bozabildiği için PDF'de
      // StudentReportV2 bileşeninin baş harf yer tutucusu kullanılır.
      photoUrl:safePhoto,
    },
  };
}

export async function exportStudentReportV2Pdf(report:StudentReportV2Data):Promise<Blob>{
  const host=document.createElement("div");
  host.style.cssText="position:fixed;left:-20000px;top:0;width:1123px;background:#fff;z-index:-1;pointer-events:none;";
  document.body.appendChild(host);
  const root=createRoot(host);
  try{
    root.render(<StudentReportV2 report={safeReportForExport(report)}/>);
    await wait(250);
    await document.fonts?.ready;

    const nodes=Array.from(host.querySelectorAll("#hasat-student-report-v2, #hasat-student-report-v2-premium, #hasat-student-report-v2-dna, #hasat-student-report-v2-target, #hasat-student-report-v2-ai, #hasat-student-report-v2-parent, #hasat-student-report-v2-prediction, #hasat-student-report-v2-teacher")) as HTMLElement[];
    if(!nodes.length)throw new Error("Karne V2 görünümü oluşturulamadı.");
    const pages:any[]=[];
    for(const node of nodes){
      const jpegDataUrl=await toJpeg(node,{backgroundColor:"#ffffff",cacheBust:true,pixelRatio:1.5,quality:0.9,width:1123,height:1588,style:{margin:"0",transform:"none"},filter:(element:HTMLElement)=>{const tag=element?.tagName?.toLowerCase();return tag!=="video"&&tag!=="canvas";}});
      pages.push({jpeg:dataUrlToBytes(jpegDataUrl),width:Math.round(1123*1.5),height:Math.round(1588*1.5)});
    }
    return jpegPagesToPdf(pages);
  }catch(error:any){
    const message=String(error?.message||error||"");
    if(message.toLowerCase().includes("tainted")||message.toLowerCase().includes("todataurl")){
      throw new Error("Karne görselindeki dış kaynak PDF'ye aktarılamadı. Fotoğraf kaldırılarak yeniden deneyin.");
    }
    throw error;
  }finally{
    root.unmount();
    host.remove();
  }
}

export async function downloadStudentReportV2Pdf(report:StudentReportV2Data,filename:string){
  const blob=await exportStudentReportV2Pdf(report);
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download=filename;
  anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}


