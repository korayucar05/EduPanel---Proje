import React from "react";
import { createRoot } from "react-dom/client";
import { toJpeg } from "html-to-image";

export type HtmlReportPdfOptions={
  render:React.ReactElement;
  pageSelector:string;
  filename:string;
  hostWidth:number;
  captureWidth:number;
  captureHeight:number;
  pdfWidth:number;
  pdfHeight:number;
  pixelRatio?:number;
  quality?:number;
  backgroundColor?:string;
};

const wait=(ms:number)=>new Promise(resolve=>window.setTimeout(resolve,ms));

function dataUrlToBytes(dataUrl:string){
  const binary=atob(dataUrl.split(",")[1]||"");
  const bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);
  return bytes;
}

function jpegPagesToPdf(
  pages:Array<{jpeg:Uint8Array;width:number;height:number}>,
  pdfWidth:number,
  pdfHeight:number,
):Blob{
  const enc=new TextEncoder();
  const chunks:(Uint8Array|string)[]=[];
  const offsets:number[]=[0];
  let length=0;
  const push=(value:Uint8Array|string)=>{
    chunks.push(value);
    length+=typeof value==="string"?enc.encode(value).length:value.length;
  };
  push("%PDF-1.4\n");
  const totalObjects=2+pages.length*3;
  const pageIds=pages.map((_,index)=>3+index*3);
  const object=(id:number,body:(()=>void)|string)=>{
    offsets[id]=length;
    push(`${id} 0 obj\n`);
    typeof body==="string"?push(body):body();
    push("\nendobj\n");
  };
  object(1,"<< /Type /Catalog /Pages 2 0 R >>");
  object(2,`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((page,index)=>{
    const pageId=3+index*3,imageId=pageId+1,contentId=pageId+2;
    object(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth} ${pdfHeight}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    object(imageId,()=>{
      push(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
      push(page.jpeg);
      push("\nendstream");
    });
    const stream=`q\n${pdfWidth} 0 0 ${pdfHeight} 0 0 cm\n/Im${index} Do\nQ`;
    object(contentId,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  const xref=length;
  push(`xref\n0 ${totalObjects+1}\n0000000000 65535 f \n`);
  for(let index=1;index<=totalObjects;index+=1){
    push(`${String(offsets[index]).padStart(10,"0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${totalObjects+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const blobParts: BlobPart[] = chunks.map((chunk) => {
    if (typeof chunk === "string") return chunk;
    return new Uint8Array(chunk).buffer;
  });
  return new Blob(blobParts,{type:"application/pdf"});
}

export async function exportHtmlReportPdf(options:HtmlReportPdfOptions):Promise<Blob>{
  const host=document.createElement("div");
  host.style.cssText=`position:fixed;left:-20000px;top:0;width:${options.hostWidth}px;background:${options.backgroundColor||"#fff"};z-index:-1;pointer-events:none;`;
  document.body.appendChild(host);
  const root=createRoot(host);
  try{
    root.render(options.render);
    await wait(350);
    await document.fonts?.ready;
    const nodes=Array.from(host.querySelectorAll(options.pageSelector)) as HTMLElement[];
    if(!nodes.length)throw new Error("PDF sayfaları oluşturulamadı.");
    const pixelRatio=options.pixelRatio??1.25;
    const pages:any[]=[];
    for(const node of nodes){
      const jpegDataUrl=await toJpeg(node,{
        backgroundColor:options.backgroundColor||"#ffffff",
        cacheBust:true,
        pixelRatio,
        quality:options.quality??0.9,
        width:options.captureWidth,
        height:options.captureHeight,
        style:{margin:"0",transform:"none"},
        filter:(element:HTMLElement)=>{
          const tag=element?.tagName?.toLowerCase();
          return tag!=="video"&&tag!=="canvas";
        },
      });
      pages.push({
        jpeg:dataUrlToBytes(jpegDataUrl),
        width:Math.round(options.captureWidth*pixelRatio),
        height:Math.round(options.captureHeight*pixelRatio),
      });
    }
    return jpegPagesToPdf(pages,options.pdfWidth,options.pdfHeight);
  }catch(error:any){
    const message=String(error?.message||error||"");
    if(message.toLowerCase().includes("tainted")||message.toLowerCase().includes("todataurl")){
      throw new Error("Rapordaki dış kaynaklı görsel PDF'ye aktarılamadı.");
    }
    throw error;
  }finally{
    root.unmount();
    host.remove();
  }
}

export function downloadPdfBlob(blob:Blob,filename:string){
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download=filename;
  anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}


