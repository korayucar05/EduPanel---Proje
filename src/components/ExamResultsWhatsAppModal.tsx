import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Loader2, MessageCircle, Send, Trash2, X } from "lucide-react";
import localforage from "../core/state/AppStateService";
import { exportTablePdf, type PdfSection } from "../utils/tablePdf";
import { appendMhatsappLog, loadMhatsappSettings, sendMediaMessage, sendTextMessage } from "../lib/mhatsappApi";
import { fetchCollectionFromLocalDatabase } from "../core/data/LegacyDatabaseFacade";
import { buildStudentReportV2Data } from "../reports-v2/utils/buildStudentReportV2Data";
import { exportStudentReportV2Pdf } from "../reports-v2/utils/exportStudentReportV2Pdf";
import { findStudentMatch, getStudentClassroom, getStudentIdentity, getStudentName, getStudentNumber, normalizeStudentText, studentIdentityMatches, uniqueStudentRows } from "../core/student";
import { collectExamResultsFromReports, requireStudentResult, resolveRegisteredStudent, resolveStudentResult } from "../core/results";
import { buildReportContextFromReport } from "../core/report-context";
import {
  buildMessagingContext,
  deliverPdfAndLiveLink,
  deliveryRecordId,
  loadHasatFamilyDeliveries,
  saveHasatFamilyDelivery,
  syncHasatFamilyDeliveries,
  type HasatFamilyDeliveryRecord,
} from "../core/messaging";
import HasatFamilyDeliveryCenter from "./hasat-family/HasatFamilyDeliveryCenter";

import { sqliteStorage } from "../core/state/SyncStateStore";
const REPORT_QUEUE_KEY = "exam_whatsapp_report_queue";
type Audience = "admin" | "teacher" | "student" | "parent";
type Report = { id:string; examId?:string; title:string; examName:string; filename:string; createdAt:string; audiences:Audience[]; student?:any; blob:Blob; status:string; results?:any[] };
type Recipient = {
  id:string;
  name:string;
  phone:string;
  role:Audience;
  detail?:string;
  assignments?:{classroom:string;subject:string}[];
  studentResult?:any;
  studentRecord?:any;
  studentNumber?:string;
  studentName?:string;
  classroom?:string;
};

type SendFailure={recipientId:string;name:string;phone:string;error:string};
type ProgressState={current:number;total:number;success:number;failure:number;currentName:string;startedAt:number};

const cleanPhone=(value:string)=>{let phone=(value||"").replace(/\D/g,"");if(phone.startsWith("0"))phone=`90${phone.slice(1)}`;else if(phone.length===10)phone=`90${phone}`;return phone;};
const blobToBase64=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const value=String(reader.result||"");resolve(value.includes(",")?value.split(",")[1]:value);};reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});

const createHasatFamilyLinkCard=async(studentName:string,examName:string,liveUrl:string)=>{
  const canvas=document.createElement("canvas"); canvas.width=1080; canvas.height=1120;
  const ctx=canvas.getContext("2d"); if(!ctx)throw new Error("Kart oluşturulamadı.");
  const rr=(x:number,y:number,w:number,h:number,r:number)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
  const fit=(v:string,m:number,s:number)=>{let z=s;while(z>30){ctx.font=`800 ${z}px Arial`;if(ctx.measureText(v).width<=m)break;z-=2;}return z;};
  const wrap=(v:string,m:number)=>{ctx.font="700 24px Arial";const a:string[]=[];let c="";for(const ch of v){const n=c+ch;if(ctx.measureText(n).width>m&&c){a.push(c);c=ch;}else c=n;}if(c)a.push(c);return a;};
  const bg=ctx.createLinearGradient(0,0,1080,1120); bg.addColorStop(0,"#6f1117");bg.addColorStop(.42,"#aa241d");bg.addColorStop(.72,"#d84b1a");bg.addColorStop(1,"#f18a1a");ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1120);
  ctx.strokeStyle="#f2c65e";ctx.lineWidth=5;rr(34,34,1012,1052,44);ctx.stroke();
  ctx.textAlign="center";ctx.fillStyle="#f2c65e";ctx.font="900 70px Georgia";ctx.fillText("e-Nstitü",540,150);
  ctx.font="800 42px Arial";ctx.fillText("AİLE",540,210);
  ctx.fillStyle="#fffaf3";ctx.font="800 32px Arial";ctx.fillText("DİJİTAL SINAV KARNESİ",540,285);
  const who=String(studentName||"ÖĞRENCİ").toLocaleUpperCase("tr-TR");ctx.font=`800 ${fit(who,880,52)}px Arial`;ctx.fillText(who,540,390);
  ctx.fillStyle="#ffe0b6";ctx.font="700 29px Arial";const ex=String(examName||"Sınav sonucu");ctx.fillText(ex.length>46?`${ex.slice(0,43)}…`:ex,540,445);
  const ctaG=ctx.createLinearGradient(205,0,875,0);ctaG.addColorStop(0,"#f7c55a");ctaG.addColorStop(1,"#ffb52f");rr(205,525,670,130,32);ctx.fillStyle=ctaG;ctx.fill();ctx.strokeStyle="rgba(255,243,196,.9)";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="#57180f";ctx.font="900 45px Arial";ctx.fillText("RAPORUNU GÖR",540,607);
  const linkG=ctx.createLinearGradient(135,0,945,0);linkG.addColorStop(0,"rgba(111,17,23,.74)");linkG.addColorStop(.55,"rgba(170,36,29,.66)");linkG.addColorStop(1,"rgba(216,75,26,.50)");rr(135,705,810,170,28);ctx.fillStyle=linkG;ctx.fill();ctx.strokeStyle="rgba(242,198,94,.72)";ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle="#ffe7c6";ctx.font="700 24px Arial";ctx.fillText("KALICI e-Nstitü AİLE BAĞLANTISI",540,755);
  const lines=wrap(String(liveUrl||""),730).slice(0,3);ctx.fillStyle="#fffaf2";lines.forEach((line,index)=>ctx.fillText(line,540,810+index*34));
  ctx.fillStyle="#ffd5a8";ctx.font="italic 500 24px Georgia";ctx.fillText("Gelişimle, daima yanınızda.",540,985);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("PNG üretilemedi")),"image/png",.96));
};


const createHasatFamilyCard=async(studentName:string,examName:string)=>{
  const canvas=document.createElement("canvas");
  canvas.width=1080;canvas.height=1080;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("e-Nstitü AİLE kartı oluşturulamadı.");
  const round=(x:number,y:number,w:number,h:number,r:number)=>{
    const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();
  };
  const gradient=ctx.createLinearGradient(0,0,1080,1080);
  gradient.addColorStop(0,"#063d32");gradient.addColorStop(1,"#075a47");
  ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1080);
  ctx.strokeStyle="#d9aa3a";ctx.lineWidth=3;ctx.beginPath();ctx.arc(540,185,82,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="#d9aa3a";ctx.font="700 72px Georgia, serif";ctx.textAlign="center";ctx.fillText("✦",540,208);
  ctx.font="700 60px Georgia, serif";ctx.fillText("e-Nstitü AİLE",540,330);
  ctx.fillStyle="#ffffff";ctx.font="800 58px Arial, sans-serif";
  const displayName=String(studentName||"ÖĞRENCİ").toLocaleUpperCase("tr-TR");
  const fit=(value:string,maxWidth:number,start:number)=>{
    let size=start;while(size>34){ctx.font=`800 ${size}px Arial, sans-serif`;if(ctx.measureText(value).width<=maxWidth)break;size-=2;}return size;
  };
  const nameSize=fit(displayName,900,58);ctx.font=`800 ${nameSize}px Arial, sans-serif`;ctx.fillText(displayName,540,485);
  ctx.font="500 38px Arial, sans-serif";ctx.fillStyle="#f5f5f4";
  const exam=String(examName||"Sınav sonucu");ctx.fillText(exam.length>42?`${exam.slice(0,39)}…`:exam,540,560);
  ctx.fillText("sınav sonuç raporunuz hazır.",540,615);
  round(250,700,580,130,28);ctx.fillStyle="#e4b84d";ctx.fill();
  ctx.fillStyle="#102b25";ctx.font="900 46px Arial, sans-serif";ctx.fillText("RAPORUNU GÖR",540,782);
  ctx.fillStyle="#d9e7e2";ctx.font="400 29px Arial, sans-serif";ctx.fillText("🔒  Bu bağlantı size özeldir. Paylaşmayınız.",540,930);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("e-Nstitü AİLE kartı PNG olarak üretilemedi.")),"image/png",0.94));
};


const createTinyTestPdf=():Blob=>{
  const pdf=`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 57 >>
stream
BT /F1 18 Tf 40 120 Td (e-Nstitü WhatsApp PDF Test) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000258 00000 n 
0000000365 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
435
%%EOF`;
  return new Blob([pdf],{type:"application/pdf"});
};
const normalize=(value:any)=>String(value||"").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]/g,"");

const asciiFilePart=(value:any)=>{
  const map:Record<string,string>={"ç":"c","Ç":"C","ğ":"g","Ğ":"G","ı":"i","İ":"I","ö":"o","Ö":"O","ş":"s","Ş":"S","ü":"u","Ü":"U"};
  return String(value||"")
    .replace(/[çÇğĞıİöÖşŞüÜ]/g,(character)=>map[character]||character)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9_-]+/g,"_")
    .replace(/_+/g,"_")
    .replace(/^_+|_+$/g,"")
    .slice(0,80);
};
const formatBytes=(bytes:number)=>{
  if(!Number.isFinite(bytes)||bytes<=0)return"0 KB";
  if(bytes<1024*1024)return`${(bytes/1024).toFixed(1)} KB`;
  return`${(bytes/(1024*1024)).toFixed(2)} MB`;
};

const pdfAscii=(value:any)=>asciiFilePart(value).replace(/_/g," ");
const pdfEscape=(value:any)=>pdfAscii(value).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");

const createLightweightStudentPdf=(student:any,reportTitle:string,examName:string,allResults:any[]):Blob=>{
  const ranked=[...(allResults||[])].sort((a:any,b:any)=>Number(b?.totals?.net||0)-Number(a?.totals?.net||0));
  const classroom=String(student?.classroom||"-");
  const classRanked=ranked.filter((item:any)=>normalize(item?.classroom)===normalize(classroom));
  const institutionRank=Math.max(1,ranked.findIndex((item:any)=>sameStudent(item,student))+1);
  const classroomRank=Math.max(1,classRanked.findIndex((item:any)=>sameStudent(item,student))+1);

  const lines:string[]=[
    "e-Nstitü - BIREYSEL SINAV KARNESI",
    `Sinav: ${examName||"-"}`,
    `Ogrenci: ${studentNameOf(student)||"-"}`,
    `Sinif: ${classroom}    No: ${studentNumberOf(student)||"-"}`,
    `Kurum Sirasi: ${institutionRank}/${ranked.length||1}    Sinif Sirasi: ${classroomRank}/${classRanked.length||1}`,
    "",
    "DERS                         D     Y     B     NET     BASARI",
  ];

  (student?.subjects||[]).forEach((subject:any)=>{
    const name=pdfAscii(subject?.subjectName||"Ders").slice(0,28).padEnd(28," ");
    const correct=String(subject?.correct??0).padStart(3," ");
    const wrong=String(subject?.wrong??0).padStart(3," ");
    const empty=String(subject?.empty??0).padStart(3," ");
    const net=Number(subject?.net||0).toFixed(2).padStart(7," ");
    const total=Number(subject?.totalQuestions||0);
    const success=total?Math.round(Number(subject?.correct||0)/total*100):0;
    lines.push(`${name} ${correct}   ${wrong}   ${empty}   ${net}     %${String(success).padStart(3," ")}`);
  });

  lines.push(
    "",
    `Toplam Dogru: ${student?.totals?.correct??0}   Yanlis: ${student?.totals?.wrong??0}   Bos: ${student?.totals?.empty??0}   Net: ${Number(student?.totals?.net||0).toFixed(2)}`,
    "",
    "Bu belge e-Nstitü sistemi tarafindan otomatik olusturulmustur."
  );

  const pageWidth=595;
  const pageHeight=842;
  const marginX=48;
  const startY=790;
  const lineHeight=18;
  const maxLines=40;
  const pages:string[][]=[];
  for(let i=0;i<lines.length;i+=maxLines)pages.push(lines.slice(i,i+maxLines));

  const objects:string[]=[];
  const addObject=(content:string)=>{objects.push(content);return objects.length;};

  const catalogId=addObject("");
  const pagesId=addObject("");
  const fontRegularId=addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId=addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds:number[]=[];

  pages.forEach((pageLines,pageIndex)=>{
    let stream="BT\n";
    stream+=`/F2 16 Tf ${marginX} ${startY} Td (${pdfEscape(pageLines[0]||reportTitle)}) Tj\n`;
    stream+=`0 -28 Td /F1 10 Tf\n`;
    for(let index=1;index<pageLines.length;index++){
      const line=pageLines[index];
      const font=line.startsWith("DERS ")||line.startsWith("Toplam ")?"/F2 9 Tf":"/F1 9 Tf";
      stream+=`${font} 0 -${lineHeight} Td (${pdfEscape(line)}) Tj\n`;
    }
    stream+="ET";
    const contentId=addObject(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const pageId=addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf="%PDF-1.4\n";
  const offsets=[0];
  objects.forEach((obj,index)=>{
    offsets[index+1]=new TextEncoder().encode(pdf).length;
    pdf+=`${index+1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset=new TextEncoder().encode(pdf).length;
  pdf+=`xref\n0 ${objects.length+1}\n`;
  pdf+="0000000000 65535 f \n";
  for(let i=1;i<=objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf],{type:"application/pdf"});
};

const withTimeout=<T,>(promise:Promise<T>,milliseconds=45000):Promise<T>=>{
  return new Promise<T>((resolve,reject)=>{
    const timer=window.setTimeout(
      ()=>reject(new Error(`WhatsApp servisi ${Math.round(milliseconds/1000)} saniye içinde yanıt vermedi. Gönderim durduruldu.`)),
      milliseconds,
    );
    promise.then(
      value=>{window.clearTimeout(timer);resolve(value);},
      error=>{window.clearTimeout(timer);reject(error);},
    );
  });
};
const studentPhoneKeys=["phone","studentPhone","telefon","cepTelefonu","mobile","mobilePhone","phoneNumber","studentPhoneNumber","ogrenciTelefon","öğrenciTelefon","gsm","cellPhone"];
const parentPhoneKeys=["parentPhone","guardianPhone","veliTelefon","veliTelefonu","parentPhoneNumber","motherPhone","fatherPhone","anneTelefon","babaTelefon","phoneParent","guardian_phone","veliCep","veliCepTelefonu","parent_mobile"];
const readFirst=(item:any,keys:string[])=>{for(const key of keys){const value=item?.[key];if(value!==undefined&&value!==null&&String(value).trim())return String(value).trim();}return"";};
const studentNameOf=getStudentName;
const studentNumberOf=getStudentNumber;
const classroomOf=getStudentClassroom;
const sameStudent=studentIdentityMatches;
const studentIdentityOf=getStudentIdentity;
const identityMatches=(candidate:any,identity:any)=>studentIdentityMatches(candidate,identity);

export default function ExamResultsWhatsAppModal({ onClose,selectedExam }: { onClose: () => void;selectedExam?:{examId?:string;examName?:string;reportCategory?:"admin"|"teacher"|"student";results?:any[]} }) {
  const [reports,setReports]=useState<Report[]>([]);
  const [preparingAllStudents,setPreparingAllStudents]=useState(false);
  const [students,setStudents]=useState<any[]>([]);
  const [teachers,setTeachers]=useState<any[]>([]);
  const [classrooms,setClassrooms]=useState<any[]>([]);
  const [selectedReportId,setSelectedReportId]=useState("");
  const [selectedReportIds,setSelectedReportIds]=useState<string[]>([]);
  const [selectedRecipients,setSelectedRecipients]=useState<string[]>([]);
  const [sending,setSending]=useState(false);
  const [testingConnection,setTestingConnection]=useState(false);
  const [testingDocument,setTestingDocument]=useState(false);
  const [diagnostic,setDiagnostic]=useState("");
  const [result,setResult]=useState("");
  const [progress,setProgress]=useState<ProgressState>({current:0,total:0,success:0,failure:0,currentName:"",startedAt:0});
  const [paused,setPaused]=useState(false);
  const [cancelled,setCancelled]=useState(false);
  const [failedRecipients,setFailedRecipients]=useState<SendFailure[]>([]);
  const [deliveryRecords,setDeliveryRecords]=useState<HasatFamilyDeliveryRecord[]>([]);
  const [refreshingDeliveries,setRefreshingDeliveries]=useState(false);
  const pauseRef=useRef(false);
  const cancelRef=useRef(false);

  const load=async()=>{
    const [queue,cachedStudents,teacherRows,classroomRows]=await Promise.all([
      localforage.getItem<Report[]>(REPORT_QUEUE_KEY),
      localforage.getItem<any[]>("school_students"),
      localforage.getItem<any[]>("school_teachers"),
      localforage.getItem<any[]>("school_classrooms"),
    ]);
    let studentRows:any[]=Array.isArray(cachedStudents)?cachedStudents:[];
    try{
      const databaseStudents=await fetchCollectionFromLocalDatabase("students");
      if(Array.isArray(databaseStudents)&&databaseStudents.length)studentRows=databaseStudents;
    }catch(error){
      console.warn("Öğrenciler ana veritabanından alınamadı; yerel önbellek kullanılacak.",error);
    }
    if(!studentRows.length){
      try{
        const localStudents=JSON.parse(sqliteStorage.getItem("school_students")||"[]");
        if(Array.isArray(localStudents))studentRows=localStudents;
      }catch{}
    }
    const examReports=(queue||[]).filter(item=>item.examId&&selectedExam?.examId?item.examId===selectedExam.examId:item.examName===selectedExam?.examName);
    const next=selectedExam?.reportCategory
      ? examReports.filter(item=>item.audiences.includes(selectedExam.reportCategory as Audience))
      : examReports;
    setReports(next);setStudents(studentRows||[]);setTeachers(teacherRows||[]);setClassrooms(classroomRows||[]);
    const teacherReports=next.filter(item=>item.audiences.includes("teacher"));
    setSelectedReportId(current=>current&&next.some(item=>item.id===current)?current:(teacherReports[0]?.id||next[0]?.id||""));
    setSelectedReportIds(current=>{
      const available=current.filter(id=>teacherReports.some(item=>item.id===id));
      return available.length?available:teacherReports.map(item=>item.id);
    });
  };
  useEffect(()=>{load();window.addEventListener("exam-whatsapp-report-added",load);return()=>window.removeEventListener("exam-whatsapp-report-added",load);},[selectedExam?.examId,selectedExam?.examName]);
  const report=reports.find(item=>item.id===selectedReportId);
  const refreshDeliveryRecords=async(syncRemote=false)=>{
    if(!report?.id){setDeliveryRecords([]);return;}
    if(syncRemote)setRefreshingDeliveries(true);
    try{
      const rows=syncRemote
        ?await syncHasatFamilyDeliveries(report.id)
        :await loadHasatFamilyDeliveries(report.id);
      setDeliveryRecords(rows);
    }finally{
      if(syncRemote)setRefreshingDeliveries(false);
    }
  };
  useEffect(()=>{
    refreshDeliveryRecords(false);
    const listener=()=>refreshDeliveryRecords(false);
    window.addEventListener("hasat-family-delivery-updated",listener);
    return()=>window.removeEventListener("hasat-family-delivery-updated",listener);
  },[report?.id]);
  const recipients=useMemo<Recipient[]>(()=>{
    if(!report)return[];
    const rows:Recipient[]=[];
    if(report.audiences.includes("admin")){
      let profile:any={};
      try{
        profile=JSON.parse(sqliteStorage.getItem("school_info_a_profile")||sqliteStorage.getItem("school_info")||"{}");
      }catch{}
      rows.push({
        id:"admin-principal",
        name:profile.principalName||"Okul Müdürü",
        phone:cleanPhone(profile.principalPhone||profile.mobilePhone||profile.phone),
        role:"admin",
        detail:"Okul Müdürü",
      });
    }
    if(report.audiences.includes("teacher"))teachers.forEach((item,index)=>{
      let assignments=classrooms.flatMap(classroom=>(classroom.assignedCourses||[])
        .filter((course:any)=>course.teacherId===item.id||course.teacherId2===item.id||normalize(course.teacherName)===normalize(item.name)||normalize(course.teacherName2)===normalize(item.name))
        .map((course:any)=>({classroom:classroom.name,subject:course.courseName})))
        .filter(assignment=>report.results?.some(student=>normalize(student.classroom)===normalize(assignment.classroom)&&student.subjects?.some((subject:any)=>normalize(subject.subjectName)===normalize(assignment.subject))));
      if(!assignments.length&&item.assignedClassrooms?.length&&item.branch){
        assignments=item.assignedClassrooms.flatMap((classroom:string)=>report.results?.filter(student=>normalize(student.classroom)===normalize(classroom)).flatMap(student=>student.subjects?.filter((subject:any)=>normalize(subject.subjectName)===normalize(item.branch)).map((subject:any)=>({classroom,subject:subject.subjectName}))||[])||[]);
      }
      if(assignments.length)rows.push({id:`teacher-${item.id||index}`,name:item.name||item.fullName||`${item.firstName||""} ${item.lastName||""}`.trim()||"Öğretmen",phone:cleanPhone(item.phone||item.telefon),role:"teacher",detail:assignments.map(value=>`${value.classroom} ${value.subject}`).join(", "),assignments});
    });
    const isAllStudentReport=report.title!=="Birleşik Karne"&&Boolean(report.results?.length)&&(report.audiences.includes("student")||report.audiences.includes("parent"));
    const resultRows=Array.isArray(report.results)?report.results:[];
    const findRegisteredStudent=(studentResult:any)=>findStudentMatch(students,studentResult);

    if(isAllStudentReport){
      resultRows.forEach((studentResult,index)=>{
        const registered=findRegisteredStudent(studentResult);
        const source=registered||studentResult;
        const stableId=String(source?.recordId||source?.id||studentNumberOf(source)||index);
        const studentName=studentNameOf(studentResult)||studentNameOf(source)||"Öğrenci";
        const classroom=classroomOf(studentResult)||classroomOf(source);
        if(report.audiences.includes("student")){
          rows.push({
            id:`student-${stableId}`,
            name:studentName,
            phone:cleanPhone(readFirst(source,studentPhoneKeys)),
            role:"student",
            detail:classroom,
            studentResult,
            studentRecord:registered,
            studentNumber:studentNumberOf(studentResult)||studentNumberOf(source),
            studentName,
            classroom,
          });
        }
        if(report.audiences.includes("parent")){
          const parentName=String(source?.parentName||source?.guardianName||source?.veliAdi||source?.veliAdSoyad||"").trim();
          rows.push({
            id:`parent-${stableId}`,
            name:parentName||`${studentName} velisi`,
            phone:cleanPhone(readFirst(source,parentPhoneKeys)),
            role:"parent",
            detail:classroom,
            studentResult,
            studentRecord:registered,
            studentNumber:studentNumberOf(studentResult)||studentNumberOf(source),
            studentName,
            classroom,
          });
        }
      });
    }else if(report.audiences.includes("student")||report.audiences.includes("parent")){
      const selectedResult=resultRows.find(item=>report.student&&sameStudent(item,report.student))||resultRows[0];
      const registered=students.find(item=>report.student&&sameStudent(report.student,item))||(selectedResult?findRegisteredStudent(selectedResult):undefined);
      const source=registered||report.student||selectedResult;
      if(source){
        const stableId=String(source?.recordId||source?.id||studentNumberOf(source)||"selected");
        const studentName=studentNameOf(selectedResult)||studentNameOf(source)||"Öğrenci";
        const classroom=classroomOf(selectedResult)||classroomOf(source);
        if(report.audiences.includes("student"))rows.push({id:`student-${stableId}`,name:studentName,phone:cleanPhone(readFirst(source,studentPhoneKeys)),role:"student",detail:classroom,studentResult:selectedResult,studentRecord:registered,studentNumber:studentNumberOf(selectedResult)||studentNumberOf(source),studentName,classroom});
        if(report.audiences.includes("parent")){
          const parentName=String(source?.parentName||source?.guardianName||source?.veliAdi||source?.veliAdSoyad||"").trim();
          rows.push({id:`parent-${stableId}`,name:parentName||`${studentName} velisi`,phone:cleanPhone(readFirst(source,parentPhoneKeys)),role:"parent",detail:classroom,studentResult:selectedResult,studentRecord:registered,studentNumber:studentNumberOf(selectedResult)||studentNumberOf(source),studentName,classroom});
        }
      }
    }
    return rows;
  },[report,students,teachers,classrooms]);
  useEffect(()=>setSelectedRecipients([]),[selectedReportId]);

  const prepareAllStudentsForDelivery=async()=>{
    const resultRows=Array.isArray(selectedExam?.results)?selectedExam!.results!:[];
    if(!resultRows.length){
      setResult("Bu sınav için gönderime hazırlanacak öğrenci sonucu bulunamadı.");
      return;
    }
    setPreparingAllStudents(true);
    setResult("");
    try{
      const queue=(await localforage.getItem<Report[]>(REPORT_QUEUE_KEY))||[];
      const examId=String(selectedExam?.examId||"");
      const examName=String(selectedExam?.examName||"Sınav");
      const title="Bireysel Öğrenci Karnesi";
      const reportRecord:Report={
        id:crypto.randomUUID(),
        examId,
        title,
        examName,
        filename:`${asciiFilePart(examName)||"sinav"}_ogrenci_veli_raporlari.pdf`,
        createdAt:new Date().toISOString(),
        audiences:["student","parent"],
        // Canlı teslimde öğrenciye özel PDF/link gönderim sırasında üretilir.
        blob:new Blob([], {type:"application/pdf"}),
        status:"pending",
        results:resultRows,
      };
      const next=[reportRecord,...queue.filter(item=>!(item.examId===examId&&item.title===title))].slice(0,30);
      await localforage.setItem(REPORT_QUEUE_KEY,next);
      window.dispatchEvent(new CustomEvent("exam-whatsapp-report-added"));
      await load();
      setSelectedReportId(reportRecord.id);
      setResult(`${resultRows.length} öğrenci sonucu e-Nstitü AİLE teslimine hazırlandı.`);
    }catch(error:any){
      setResult(error?.message||"Öğrenci raporları gönderime hazırlanamadı.");
    }finally{
      setPreparingAllStudents(false);
    }
  };

  const removeReport=async(id:string)=>{const full=(await localforage.getItem<Report[]>(REPORT_QUEUE_KEY))||[];await localforage.setItem(REPORT_QUEUE_KEY,full.filter(item=>item.id!==id));const next=reports.filter(item=>item.id!==id);setReports(next);setSelectedReportId(next[0]?.id||"");};
  const teacherBlob=async(recipient:Recipient,sourceReport:Report=report!)=>{
    if(!sourceReport?.results||!recipient.assignments?.length)return sourceReport.blob;
    const sections:PdfSection[]=recipient.assignments.map(assignment=>{
      const entries=sourceReport.results!.filter(student=>normalize(student.classroom)===normalize(assignment.classroom)).map(student=>({student:student.studentName,studentNumber:student.studentNumber,result:student.subjects?.find((subject:any)=>normalize(subject.subjectName)===normalize(assignment.subject))})).filter(item=>item.result).sort((a,b)=>(b.result?.net||0)-(a.result?.net||0));
      if(sourceReport.title==="Şube Sıralı Listesi")return{title:`${assignment.classroom} - ${assignment.subject}`,subtitle:`${recipient.name} · ${entries.length} öğrenci`,headers:["Sıra","No","Öğrenci","Doğru","Yanlış","Boş","Net"],widths:[8,12,32,12,12,12,12],rows:entries.map((item,index)=>[index+1,item.studentNumber||"-",item.student,item.result.correct,item.result.wrong,item.result.empty,item.result.net])};
      return{title:`${assignment.classroom} - ${assignment.subject}`,subtitle:`${recipient.name} · ${entries.length} öğrenci`,headers:["Öğrenci","Doğru","Yanlış","Boş","Net"],widths:[44,14,14,14,14],rows:entries.map(item=>[item.student,item.result.correct,item.result.wrong,item.result.empty,item.result.net])};
    });
    return exportTablePdf(sourceReport.filename,sourceReport.title,sections,{orientation:"landscape",rowsPerPage:14,download:false});
  };
  const findStudentResultForRecipient=(recipient:Recipient)=>{
    if(recipient.studentResult)return recipient.studentResult;

    const registeredRecord=recipient.studentRecord||resolveRegisteredStudent(students,{
      studentNumber:recipient.studentNumber,
      studentName:recipient.studentName||recipient.name,
      classroom:recipient.classroom||recipient.detail,
    });

    const selectedIdentity={
      ...(registeredRecord||{}),
      studentNumber:recipient.studentNumber||studentNumberOf(registeredRecord),
      studentName:recipient.studentName||studentNameOf(registeredRecord)||recipient.name,
      classroom:recipient.classroom||classroomOf(registeredRecord)||recipient.detail,
    };

    const candidateResults=collectExamResultsFromReports<any>(reports,report);
    return resolveStudentResult(candidateResults,selectedIdentity).result;
  };

  const studentReportData=async(recipient:Recipient)=>{
    const selectedStudent={
      ...(recipient.studentRecord||{}),
      ...(recipient.studentResult||{}),
      studentNumber:recipient.studentNumber,
      studentName:recipient.studentName||recipient.name,
      classroom:recipient.classroom||recipient.detail,
    };

    const context=buildReportContextFromReport({
      exam:{id:report?.examId,examName:report?.examName,name:report?.examName},
      report:report!,
      reports,
      selectedStudent,
      registeredStudents:students,
      audience:recipient.role==="parent"?"parent":"student",
    });

    const reportData=buildStudentReportV2Data(
      context.exam,
      context.results,
      context.selectedResult,
    );

    return{context,reportData};
  };

  const studentBlob=async(recipient:Recipient)=>{
    const {reportData}=await studentReportData(recipient);
    return exportStudentReportV2Pdf(reportData);
  };

  const waitWhilePaused=async()=>{
    while(pauseRef.current&&!cancelRef.current){
      await new Promise(resolve=>window.setTimeout(resolve,250));
    }
  };
  const togglePause=()=>{
    const next=!pauseRef.current;
    pauseRef.current=next;
    setPaused(next);
  };
  const cancelSending=()=>{
    cancelRef.current=true;
    pauseRef.current=false;
    setPaused(false);
    setCancelled(true);
    setResult("Gönderim iptal ediliyor. Devam eden son işlem tamamlandığında kuyruk duracaktır.");
  };

  const testConnection=async()=>{
    const first=recipients.find(item=>item.phone);
    if(!first){setResult("Telefon numarası bulunan bir alıcı bulunamadı.");return;}
    setTestingConnection(true);
    setResult(`${first.name} numarasına yalnızca metin test mesajı gönderiliyor...`);
    try{
      const settings=loadMhatsappSettings();
      if(!settings.token?.trim())throw new Error("WhatsApp API tokenı eksik.");
      const testResult=await withTimeout(
        sendTextMessage(settings,[first.phone],"e-Nstitü WhatsApp bağlantı test mesajıdır."),
        45000,
      );
      if(!testResult.ok)throw new Error(testResult.error||testResult.status||"Metin testi başarısız.");
      setResult(`Metin testi başarılı: ${first.name} numarasına istek kabul edildi.${testResult.id?` Mesaj kimliği: ${testResult.id}`:""}`);
    }catch(error:any){
      setResult(`Metin testi başarısız: ${error?.message||"Bağlantı kurulamadı."}`);
    }finally{
      setTestingConnection(false);
    }
  };

  const testDocument=async()=>{
    const first=recipients.find(item=>item.phone);
    if(!first){setResult("Telefon numarası bulunan bir alıcı bulunamadı.");return;}
    setTestingDocument(true);
    setResult(`${first.name} numarasına küçük PDF test belgesi gönderiliyor...`);
    try{
      const settings=loadMhatsappSettings();
      if(!settings.token?.trim())throw new Error("WhatsApp API tokenı eksik.");
      const tinyPdf=createTinyTestPdf();
      const file=await blobToBase64(tinyPdf);
      const testResult=await withTimeout(
        sendMediaMessage(
          settings,
          "document",
          [first.phone],
          "e-Nstitü küçük PDF belge gönderim testidir.",
          "HASAT_PDF_Test.pdf",
          file,
        ),
        60000,
      );
      if(!testResult.ok)throw new Error(testResult.error||testResult.status||"Küçük PDF testi başarısız.");
      setResult(`Küçük PDF testi başarılı: ${first.name} numarasına belge isteği kabul edildi.${testResult.id?` Mesaj kimliği: ${testResult.id}`:""}`);
    }catch(error:any){
      setResult(`Küçük PDF testi başarısız: ${error?.message||"Belge gönderilemedi."}`);
    }finally{
      setTestingDocument(false);
    }
  };

  const runRecipientQueue=async(targets:Recipient[])=>{
    if(!report)return;
    const settings=loadMhatsappSettings();
    if(!settings.token?.trim())throw new Error("WhatsApp API tokenı eksik. Mesaj Araçları alanından tokenı kaydediniz.");

    const startedAt=Date.now();
    setProgress({current:0,total:targets.length,success:0,failure:0,currentName:"",startedAt});
    setFailedRecipients([]);
    cancelRef.current=false;
    pauseRef.current=false;
    setCancelled(false);
    setPaused(false);

    let successCount=0;
    const failures:SendFailure[]=[];

    for(let index=0;index<targets.length;index++){
      await waitWhilePaused();
      if(cancelRef.current)break;

      const recipient=targets[index];
      setProgress(current=>({...current,current:index+1,currentName:recipient.name,success:successCount,failure:failures.length}));
      setResult(`${recipient.name} için karne hazırlanıyor...`);

      const trackingId=deliveryRecordId(report.id,recipient.id);
      if(recipient.role!=="teacher"){
        await saveHasatFamilyDelivery({
          id:trackingId,
          reportId:report.id,
          examId:report.examId,
          examName:report.examName,
          reportTitle:report.title,
          recipientId:recipient.id,
          recipientName:recipient.name,
          phone:recipient.phone,
          studentName:recipient.studentName||recipient.name,
          studentNumber:recipient.studentNumber,
          classroom:recipient.classroom||recipient.detail,
          pdfStatus:"waiting",
          linkStatus:"waiting",
          whatsappStatus:"waiting",
          viewStatus:"unopened",
          error:"",
        });
      }

      try{
        setDiagnostic(recipient.role==="teacher"?"PDF oluşturuluyor...":"e-Nstitü AİLE canlı bağlantısı hazırlanıyor...");
        const completed=await withTimeout((async()=>{
          const started=performance.now();

          if(recipient.role==="teacher"){
            const attachment=await teacherBlob(recipient);
            const pdfMs=Math.round(performance.now()-started);
            if(!(attachment instanceof Blob))throw new Error("Karne PDF'i Blob biçiminde üretilemedi.");
            if(!attachment.size)throw new Error("Karne PDF'i boş üretildi.");
            if(attachment.size>12*1024*1024)throw new Error(`Karne PDF'i çok büyük: ${formatBytes(attachment.size)}.`);

            const base64StartedAt=performance.now();
            const file=await blobToBase64(attachment);
            const base64Ms=Math.round(performance.now()-base64StartedAt);
            const recipientPart=asciiFilePart(recipient.name)||"ogretmen";
            const examPart=asciiFilePart(report.examName)||"sinav";
            const titlePart=asciiFilePart(report.title)||"rapor";
            const filename=`${recipientPart}_${examPart}_${titlePart}.pdf`;
            const documentMessage=`Sayın ${recipient.name}, ${report.examName} sınavına ait ${report.title} ekte sunulmuştur.`;

            setDiagnostic(`PDF: ${formatBytes(attachment.size)} • WhatsApp yanıtı bekleniyor...`);
            const sendResult=await sendMediaMessage(
              settings,
              "document",
              [recipient.phone],
              documentMessage,
              filename,
              file,
            );
            return{
              sendResult,
              linkSendResult:null,
              filename,
              pdfSize:attachment.size,
              pdfMs,
              base64Ms,
              pdfError:"",
              liveUrl:undefined,
              livePublication:undefined,
            };
          }

          const built=await studentReportData(recipient);
          const reportData=built?.reportData||null;
          const reportContext=built?.context||null;
          if(!reportContext||!reportData){
            throw new Error("e-Nstitü AİLE canlı raporu için rapor bağlamı oluşturulamadı.");
          }

          const studentDisplayName=reportData?.student?.name||recipient.studentName||recipient.name;
          const recipientPart=asciiFilePart(recipient.name)||"ogrenci";
          const examPart=asciiFilePart(report.examName)||"sinav";
          const titlePart=asciiFilePart(report.title)||"karne";
          const filename=`${recipientPart}_${examPart}_${titlePart}.pdf`;
          const documentMessage=`Sayın Veli, ${studentDisplayName} için hazırlanan ${report.examName} sınav raporu ekte sunulmuştur.`;

          let attachment:Blob|null=null;
          let file:string|undefined;
          let pdfSize=0;
          let pdfMs=0;
          let base64Ms=0;
          let pdfError="";

          try{
            setDiagnostic("Canlı bağlantı hazırlanıyor • PDF yardımcı belge olarak oluşturuluyor...");
            const pdfStartedAt=performance.now();
            attachment=await exportStudentReportV2Pdf(reportData);
            pdfMs=Math.round(performance.now()-pdfStartedAt);
            if(!(attachment instanceof Blob))throw new Error("Karne PDF'i Blob biçiminde üretilemedi.");
            if(!attachment.size)throw new Error("Karne PDF'i boş üretildi.");
            if(attachment.size>12*1024*1024)throw new Error(`Karne PDF'i çok büyük: ${formatBytes(attachment.size)}.`);
            pdfSize=attachment.size;

            const base64StartedAt=performance.now();
            file=await blobToBase64(attachment);
            base64Ms=Math.round(performance.now()-base64StartedAt);
            await saveHasatFamilyDelivery({
              id:trackingId,
              reportId:report.id,
              recipientId:recipient.id,
              pdfStatus:"ready",
            });
          }catch(error:any){
            pdfError=error?.message||"Karne PDF'i oluşturulamadı.";
            await saveHasatFamilyDelivery({
              id:trackingId,
              reportId:report.id,
              recipientId:recipient.id,
              pdfStatus:"failed",
            });
            console.warn("PDF oluşturulamadı; canlı e-Nstitü AİLE bağlantısı ile devam ediliyor.",error);
          }

          const messagingContext=buildMessagingContext({
            channel:"whatsapp",
            recipient:{
              id:recipient.id,
              name:recipient.name,
              phone:recipient.phone,
              audience:recipient.role==="parent"?"parent":"student",
              studentName:studentDisplayName,
              studentNumber:String(reportData?.student?.number||recipient.studentNumber||""),
              classroom:reportData?.student?.classroom||recipient.classroom||recipient.detail,
            },
            reportContext,
            reportData,
          });

          setDiagnostic(pdfError
            ?"PDF hazırlanamadı • e-Nstitü AİLE canlı bağlantısı gönderiliyor..."
            :"PDF ve tıklanabilir e-Nstitü AİLE bağlantısı gönderiliyor...");

          const delivery=await deliverPdfAndLiveLink({
            context:messagingContext,
            filename:file?filename:undefined,
            pdfBase64:file,
            documentMessage:file?documentMessage:undefined,
            pdfError,
            validDays:30,
            sendDocument:(phone,message,name,base64)=>sendMediaMessage(
              settings,
              "document",
              [phone],
              message,
              name,
              base64,
            ),
            // FINAL-21: tek e-Nstitü AİLE kartı + yalnızca tıklanabilir HTTPS URL açıklaması.
            sendText:async(phone,message)=>{
              try{
                const cardBlob=await createHasatFamilyLinkCard(studentDisplayName,report.examName,message);
                const cardBase64=await blobToBase64(cardBlob);
                return await sendMediaMessage(
                  settings,
                  "image",
                  [phone],
                  message,
                  "HASAT_AILE_Dijital_Karne_FINAL29.png",
                  cardBase64,
                );
              }catch(cardError){
                console.warn("e-Nstitü AİLE kartı gönderilemedi; tıklanabilir link metnine dönülüyor.",cardError);
                return sendTextMessage(settings,[phone],message);
              }
            },
          });

          return{
            sendResult:delivery.documentResult,
            linkSendResult:delivery.linkResult||null,
            filename,
            pdfSize,
            pdfMs,
            base64Ms,
            pdfError,
            liveUrl:delivery.livePublication?.url,
            livePublication:delivery.livePublication,
          };
        })(),180000);

        const deliveryOk=recipient.role==="teacher"
          ?Boolean(completed.sendResult.ok)
          :Boolean(completed.linkSendResult?.ok||completed.sendResult.ok);

        appendMhatsappLog({
          kind:"exam-report",
          reportId:report.id,
          recipient:recipient.name,
          phone:recipient.phone,
          filename:completed.filename,
          ok:deliveryOk,
          status:completed.linkSendResult?.status||completed.sendResult.status,
          error:deliveryOk?undefined:(completed.linkSendResult?.error||completed.sendResult.error),
          id:completed.linkSendResult?.id||completed.sendResult.id,
          liveUrl:completed.liveUrl,
        });

        if(recipient.role!=="teacher"){
          const documentOk=Boolean(completed.sendResult.ok);
          const linkCreated=Boolean(completed.livePublication?.url);
          const linkOk=Boolean(completed.linkSendResult?.ok);
          const overallOk=linkOk||documentOk;
          await saveHasatFamilyDelivery({
            id:trackingId,
            reportId:report.id,
            recipientId:recipient.id,
            pdfStatus:documentOk?"sent":completed.pdfError?"failed":"waiting",
            linkStatus:linkOk?"sent":linkCreated?"ready":"failed",
            whatsappStatus:overallOk?"sent":linkCreated?"ready":"failed",
            publication:completed.livePublication,
            documentMessageId:completed.sendResult.id,
            linkMessageId:completed.linkSendResult?.id,
            error:overallOk?"":(completed.linkSendResult?.error||completed.linkSendResult?.status||completed.sendResult.error||completed.sendResult.status||"Gönderim tamamlanamadı"),
          });
        }

        if(!deliveryOk){
          throw new Error(
            completed.linkSendResult?.error||
            completed.linkSendResult?.status||
            completed.sendResult.error||
            completed.sendResult.status||
            "Gönderim başarısız."
          );
        }

        successCount++;
        setDiagnostic(
          recipient.role==="teacher"
            ?`Gönderim kabul edildi • PDF: ${formatBytes(completed.pdfSize)} • Üretim: ${completed.pdfMs} ms`
            :completed.linkSendResult?.ok&&completed.sendResult.ok
              ?"Gönderim kabul edildi • PDF ve tıklanabilir e-Nstitü AİLE bağlantısı gönderildi"
              :completed.linkSendResult?.ok
                ?"e-Nstitü AİLE canlı bağlantısı gönderildi • PDF yardımcı belgesi hazırlanamadı"
                :"PDF gönderildi • Canlı bağlantı hazırlandı ancak WhatsApp mesajı doğrulanamadı"
        );
      }catch(error:any){
        const errorMessage=error?.message||"Gönderilemedi";
        failures.push({
          recipientId:recipient.id,
          name:recipient.name,
          phone:recipient.phone,
          error:errorMessage,
        });
        if(recipient.role!=="teacher"){
          const current=(await loadHasatFamilyDeliveries(report.id)).find(item=>item.id===trackingId);
          await saveHasatFamilyDelivery({
            id:trackingId,
            reportId:report.id,
            recipientId:recipient.id,
            pdfStatus:current?.pdfStatus==="sent"||current?.pdfStatus==="ready"?current.pdfStatus:"failed",
            linkStatus:current?.linkStatus==="sent"||current?.linkStatus==="ready"?current.linkStatus:"failed",
            whatsappStatus:"failed",
            error:errorMessage,
          });
        }
      }

      setProgress(current=>({...current,success:successCount,failure:failures.length}));
    }

    setFailedRecipients(failures);

    if(successCount>0){
      const next=reports.map(item=>item.id===report.id?{...item,status:failures.length?"partial":"sent"}:item);
      const full=(await localforage.getItem<Report[]>(REPORT_QUEUE_KEY))||[];
      await localforage.setItem(REPORT_QUEUE_KEY,full.map(item=>item.id===report.id?{...item,status:failures.length?"partial":"sent"}:item));
      setReports(next);
    }

    const stopped=cancelRef.current;
    setResult(
      stopped
        ? `Gönderim durduruldu. ${successCount} başarılı, ${failures.length} başarısız, ${Math.max(0,targets.length-successCount-failures.length)} bekleyen.`
        : `${successCount} başarılı, ${failures.length} başarısız.`
    );
    setProgress(current=>({...current,currentName:"",success:successCount,failure:failures.length}));
  };

  const send=async()=>{
    if(!report||!selectedRecipients.length)return;
    setSending(true);
    setResult("");
    setDiagnostic("");
    try{
      const targets=recipients.filter(item=>selectedRecipients.includes(item.id)&&item.phone);
      await runRecipientQueue(targets);
    }catch(error:any){
      setResult(error?.message||"Gönderim başarısız.");
    }finally{
      setSending(false);
      pauseRef.current=false;
      cancelRef.current=false;
      setPaused(false);
    }
  };

  const retryFailed=async()=>{
    if(!failedRecipients.length)return;
    const failedIds=new Set(failedRecipients.map(item=>item.recipientId));
    const targets=recipients.filter(item=>failedIds.has(item.id)&&item.phone);
    if(!targets.length){setResult("Yeniden gönderilecek geçerli alıcı bulunamadı.");return;}
    setSending(true);
    setResult("");
    setDiagnostic("");
    try{
      await runRecipientQueue(targets);
    }catch(error:any){
      setResult(error?.message||"Yeniden gönderim başarısız.");
    }finally{
      setSending(false);
      pauseRef.current=false;
      cancelRef.current=false;
      setPaused(false);
    }
  };

  const retryDeliveryRecord=async(record:HasatFamilyDeliveryRecord)=>{
    const recipient=recipients.find(item=>item.id===record.recipientId);
    if(!recipient?.phone){setResult("Yeniden gönderilecek alıcı veya telefon numarası bulunamadı.");return;}
    setSelectedRecipients([recipient.id]);
    setSending(true);
    setResult("");
    setDiagnostic("");
    try{
      await runRecipientQueue([recipient]);
    }catch(error:any){
      setResult(error?.message||"Yeniden gönderim başarısız.");
    }finally{
      setSending(false);
      pauseRef.current=false;
      cancelRef.current=false;
      setPaused(false);
    }
  };

  const sendSelectedTeacherReports=async()=>{
    const selectedReports=reports.filter(item=>selectedReportIds.includes(item.id)&&item.audiences.includes("teacher"));
    const targets=recipients.filter(item=>item.role==="teacher"&&selectedRecipients.includes(item.id)&&item.phone);
    if(!selectedReports.length){setResult("Gönderilecek öğretmen raporu seçilmedi.");return;}
    if(!targets.length){setResult("Telefon numarası bulunan en az bir öğretmen seçiniz.");return;}
    setSending(true);setResult("");
    try{
      const settings=loadMhatsappSettings();
      if(!settings.token?.trim())throw new Error("WhatsApp API tokenı eksik. Mesaj Araçları alanından tokenı kaydediniz.");
      let sent=0;
      for(const selectedReport of selectedReports){
        for(const recipient of targets){
          setResult(`${recipient.name} için ${selectedReport.title} hazırlanıyor ve gönderiliyor...`);
          const sendResult=await withTimeout((async()=>{
            const teacherSpecificReport=await teacherBlob(recipient,selectedReport);
            const file=await blobToBase64(teacherSpecificReport);
            return await sendMediaMessage(settings,"document",[recipient.phone],`Sayın ${recipient.name}, ${selectedReport.examName} sınavına ait ${selectedReport.title} ekte sunulmuştur.`,selectedReport.filename,file);
          })(),60000);
          if(!sendResult.ok)throw new Error(sendResult.error||sendResult.status||`${recipient.name} için ${selectedReport.title} gönderilemedi.`);
          sent++;
        }
      }
      const sentIds=new Set(selectedReports.map(item=>item.id));
      const full=(await localforage.getItem<Report[]>(REPORT_QUEUE_KEY))||[];
      await localforage.setItem(REPORT_QUEUE_KEY,full.map(item=>sentIds.has(item.id)?{...item,status:"sent"}:item));
      setReports(current=>current.map(item=>sentIds.has(item.id)?{...item,status:"sent"}:item));
      setResult(`${selectedReports.length} rapor, ${targets.length} öğretmene toplam ${sent} belge olarak gönderildi.`);
    }catch(error:any){setResult(error?.message||"Gönderim başarısız.");}finally{setSending(false);}
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"><div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="flex items-center gap-2 text-base font-black text-slate-800"><MessageCircle className="h-5 w-5 text-emerald-600"/>e-Nstitü AİLE Teslim Merkezi</h3><p className="mt-1 text-xs text-slate-500"><strong className="text-slate-700">{selectedExam?.examName||"Seçili sınav"}</strong> için Canlı e-Nstitü AİLE bağlantısını gönderin; PDF hazırlanırsa yardımcı belge olarak eklenir.</p></div><button onClick={onClose} title="Kapat" className="p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5"/></button></header>
    <div className="grid min-h-0 flex-1 md:grid-cols-[320px_1fr]"><aside className="overflow-y-auto border-r border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <strong className="block text-xs font-black text-emerald-900">Öğrenci / Veli Teslim Hazırlığı</strong>
        <p className="mt-1 text-[11px] leading-5 text-emerald-800">
          {selectedExam?.results?.length
            ? `${selectedExam.results.length} öğrenci sonucu bu sınav için hazır.`
            : "Bu sınavın öğrenci sonuçları Teslim Merkezi'ne aktarılmamış."}
        </p>
        <button
          type="button"
          onClick={prepareAllStudentsForDelivery}
          disabled={preparingAllStudents||!(selectedExam?.results?.length)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >{preparingAllStudents?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}{preparingAllStudents?"Hazırlanıyor...":"Tüm Öğrencileri Gönderime Hazırla"}</button>
      </div>
      {reports.length===0?<div className="p-4">
        <p className="text-sm leading-6 text-slate-600">Bu rapor grubunda henüz gönderime hazırlanmış rapor yok.</p>
      </div>:reports.map(item=><button key={item.id} onClick={()=>setSelectedReportId(item.id)} className={`mb-2 flex w-full items-start gap-3 border p-3 text-left ${item.id===selectedReportId?"border-emerald-500 bg-white":"border-slate-200 bg-white hover:border-slate-300"}`}>{item.audiences.includes("teacher")&&<input type="checkbox" aria-label={`${item.title} raporunu seç`} checked={selectedReportIds.includes(item.id)} onClick={event=>event.stopPropagation()} onChange={()=>setSelectedReportIds(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id])} className="mt-1 h-4 w-4 accent-emerald-600"/>}<FileText className="mt-0.5 h-5 w-5 text-rose-600"/><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-800">{item.title}</strong><span className="mt-1 block truncate text-[11px] text-slate-500">{item.examName}</span></span>{item.status==="sent"&&<Check className="h-4 w-4 text-emerald-600"/>}</button>)}</aside>
      <main className="overflow-y-auto p-5">{report&&<><div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><h4 className="font-black text-slate-800">{report.title}</h4><p className="mt-1 text-xs text-slate-500">{report.examName} · {new Date(report.createdAt).toLocaleString("tr-TR")}</p></div><button onClick={()=>removeReport(report.id)} title="Raporu kuyruktan kaldır" className="p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></button></div>
        <div className="py-4">
          {!report.audiences.includes("teacher")&&<HasatFamilyDeliveryCenter
            records={deliveryRecords}
            refreshing={refreshingDeliveries}
            onRefresh={()=>refreshDeliveryRecords(true)}
            onRetry={retryDeliveryRecord}
          />}
          <div className="mb-3 flex items-center justify-between gap-2"><h5 className="text-xs font-black uppercase text-slate-600">Alıcılar</h5><div className="flex items-center gap-2"><button type="button" onClick={()=>{const first=recipients.find(item=>item.phone);setSelectedRecipients(first?[first.id]:[]);}} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">İlk telefonlu kişiyi seç</button><button type="button" onClick={()=>setSelectedRecipients([])} className="rounded border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50">Seçimi temizle</button><span className="text-xs text-slate-500">{selectedRecipients.length} seçili</span></div></div><div className="mb-3 grid grid-cols-3 gap-2 text-center text-[11px]"><div className="border border-slate-200 bg-slate-50 p-2"><strong className="block text-sm text-slate-800">{recipients.length}</strong>Toplam alıcı</div><div className="border border-emerald-200 bg-emerald-50 p-2 text-emerald-800"><strong className="block text-sm">{recipients.filter(item=>item.phone).length}</strong>Telefon bulunan</div><div className="border border-rose-200 bg-rose-50 p-2 text-rose-700"><strong className="block text-sm">{recipients.filter(item=>!item.phone).length}</strong>Telefon eksik</div></div><div className="space-y-2">{recipients.length===0?<p className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Sınav sonucundaki öğrenciler, kayıtlı öğrenci verileriyle eşleştirilemedi. Öğrenci numarası, ad-soyad ve sınıf bilgilerini kontrol edin.</p>:recipients.map(item=><label key={item.id} className={`flex items-center gap-3 border p-3 ${item.phone?"cursor-pointer border-slate-200":"border-rose-200 bg-rose-50"}`}><input type="checkbox" disabled={!item.phone} checked={selectedRecipients.includes(item.id)} onChange={()=>setSelectedRecipients(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id])}/><span className="min-w-0 flex-1"><strong className="block text-xs text-slate-800">{item.name}</strong><span className="text-[11px] text-slate-500">{item.role==="admin"?"Okul Müdürü":item.role==="teacher"?"Öğretmen":item.role==="student"?"Öğrenci":"Veli"}{item.detail?` · ${item.detail}`:""}</span></span><span className={`text-xs ${item.phone?"text-slate-600":"font-bold text-rose-600"}`}>{item.phone||"Telefon yok"}</span></label>)}</div></div>
        {report.audiences.includes("teacher")&&<div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="mb-2 text-xs font-bold text-emerald-900">{selectedReportIds.length} oluşturulmuş öğretmen raporu seçili öğretmenlere tek işlemde gönderilecek.</p><button onClick={sendSelectedTeacherReports} disabled={sending||!selectedRecipients.length||!selectedReportIds.length} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">{sending?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}{sending?"Raporlar gönderiliyor...":"Tüm Seçili Raporları Öğretmenlere Gönder"}</button></div>}
        {!report.audiences.includes("teacher")&&<button
          type="button"
          onClick={testConnection}
          disabled={sending||testingConnection||!recipients.some(item=>item.phone)}
          className="mb-3 flex w-full items-center justify-center gap-2 border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >{testingConnection?<Loader2 className="h-4 w-4 animate-spin"/>:<MessageCircle className="h-4 w-4"/>}{testingConnection?"Metin bağlantısı test ediliyor...":"Önce Metin Bağlantısını Test Et"}</button>}
        {!report.audiences.includes("teacher")&&<button
          type="button"
          onClick={testDocument}
          disabled={sending||testingConnection||testingDocument||!recipients.some(item=>item.phone)}
          className="mb-3 flex w-full items-center justify-center gap-2 border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >{testingDocument?<Loader2 className="h-4 w-4 animate-spin"/>:<FileText className="h-4 w-4"/>}{testingDocument?"Küçük PDF test ediliyor...":"Küçük PDF Belge Gönderimini Test Et"}</button>}
        {(sending||progress.total>0)&&<div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-emerald-900">
            <span>{progress.currentName||"Gönderim özeti"}</span>
            <span>{Math.min(progress.current,progress.total)} / {progress.total}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full bg-emerald-600 transition-all" style={{width:`${progress.total?Math.min(100,progress.current/progress.total*100):0}%`}}/>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-emerald-800">Başarılı: <strong>{progress.success}</strong> · Başarısız: <strong>{progress.failure}</strong></span>
            {sending&&<div className="flex gap-2">
              <button type="button" onClick={togglePause} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-bold text-amber-800 hover:bg-amber-100">{paused?"Devam Et":"Duraklat"}</button>
              <button type="button" onClick={cancelSending} className="rounded border border-rose-300 bg-rose-50 px-2 py-1 font-bold text-rose-700 hover:bg-rose-100">Gönderimi Durdur</button>
            </div>}
          </div>
        </div>}
        {diagnostic&&<p className="mb-3 border border-cyan-200 bg-cyan-50 p-3 text-xs font-bold text-cyan-900">{diagnostic}</p>}
        {result&&<p className="mb-3 border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700">{result}</p>}{failedRecipients.length>0&&<div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="text-xs text-rose-800">{failedRecipients.length} başarısız gönderim</strong>
            <button type="button" onClick={retryFailed} disabled={sending} className="rounded bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:bg-slate-300">Başarısızları Yeniden Gönder</button>
          </div>
          <div className="max-h-28 overflow-y-auto text-[11px] text-rose-700">
            {failedRecipients.map(item=><div key={item.recipientId} className="border-t border-rose-100 py-1 first:border-t-0">{item.name}: {item.error}</div>)}
          </div>
        </div>}
        {!report.audiences.includes("teacher")&&<button onClick={send} disabled={sending||!selectedRecipients.length} className="flex w-full items-center justify-center gap-2 bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">{sending?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}{sending?(paused?"Duraklatıldı":"Gönderiliyor..."):"e-Nstitü AİLE Linkini WhatsApp ile Gönder"}</button>}</>}</main></div>
  </div></div>;
}
