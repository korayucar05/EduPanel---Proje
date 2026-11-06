export type ReportFamilyPdfVariant="individual"|"institution"|"analysis";
export type ReportFamilyPdfAccent="subject"|"item"|"topic";
export type ReportFamilyPdfHeader={
  variant:ReportFamilyPdfVariant;
  schoolName?:string;
  academicYear?:string;
  examName:string;
  examDate?:string;
  reportName:string;
  student?:{name?:string;classroom?:string;number?:string|number;photoDataUrl?:string};
  meta?:Array<{label:string;value:string|number}>;
  accent?:ReportFamilyPdfAccent;
  sectionTitle?:string;
  sectionSubtitle?:string;
};

const formatDate=(value?:string)=>{
  if(!value)return "-";
  const raw=String(value).trim();
  const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso)return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return raw.includes("T")?raw.split("T")[0].split("-").reverse().join("."):raw;
};

const yearFromDate=(value?:string)=>{
  const date=value?new Date(value.includes("T")?value:`${value}T12:00:00`):new Date();
  const year=Number.isNaN(date.getTime())?new Date().getFullYear():date.getFullYear();
  const month=Number.isNaN(date.getTime())?8:date.getMonth()+1;
  const start=month>=7?year:year-1;
  return `${start} - ${start+1} EĞİTİM - ÖĞRETİM YILI`;
};

const themes={
  individual:{left:"#0b8ee6",leftSoft:"#eef8ff",mainA:"#1749a7",mainB:"#0757ad",accent:"#ffc526",rightA:"#06a5a8",rightB:"#034a58",date:"#f7ddf0",ink:"#071f48",reportText:"#ffffff"},
  institution:{left:"#8a69ef",leftSoft:"#f4f0ff",mainA:"#2446b4",mainB:"#6b2a90",accent:"#ffbe20",rightA:"#ffdb43",rightB:"#f4ad16",date:"#e8d7ff",ink:"#19153e",reportText:"#111827"},
  subject:{left:"#27b5ee",leftSoft:"#eefbff",mainA:"#109a9f",mainB:"#075d78",accent:"#ffd02a",rightA:"#0e8eda",rightB:"#053d68",date:"#d8efff",ink:"#07304e",reportText:"#ffffff"},
  item:{left:"#7f6bf2",leftSoft:"#f5f1ff",mainA:"#5c46b6",mainB:"#2f4dab",accent:"#ffc83c",rightA:"#6b54c6",rightB:"#2f256f",date:"#e7ddff",ink:"#21184f",reportText:"#ffffff"},
  topic:{left:"#19b9b1",leftSoft:"#edfffc",mainA:"#109b94",mainB:"#08717c",accent:"#f2c43d",rightA:"#13aaa4",rightB:"#07575c",date:"#daf6ef",ink:"#073c3a",reportText:"#ffffff"},
};

const esc=(value:any)=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const svgText=(value:any,x:number,y:number,size:number,weight:number,color:string,anchor:"start"|"middle"|"end"="start")=>`<text x="${x}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(value)}</text>`;
const userIcon=(x:number,y:number,color:string)=>`<circle cx="${x}" cy="${y-3}" r="2.2" fill="${color}"/><path d="M${x-4} ${y+4} C${x-4} ${y} ${x-2} ${y-1} ${x} ${y-1} C${x+2} ${y-1} ${x+4} ${y} ${x+4} ${y+4} Z" fill="${color}"/>`;
const capIcon=(x:number,y:number,color:string)=>`<polygon points="${x-5},${y} ${x},${y-3} ${x+5},${y} ${x},${y+3}" fill="${color}"/><rect x="${x-3.4}" y="${y+2}" width="6.8" height="1.2" fill="${color}"/>`;
const bookIcon=(x:number,y:number,color:string)=>`<path d="M${x-5} ${y-4} H${x-1} C${x} ${y-4} ${x} ${y-3} ${x} ${y-2} V${y+4} C${x-1} ${y+2} ${x-3} ${y+2} ${x-5} ${y+3} Z" fill="none" stroke="${color}" stroke-width="1"/><path d="M${x+5} ${y-4} H${x+1} C${x} ${y-4} ${x} ${y-3} ${x} ${y-2} V${y+4} C${x+1} ${y+2} ${x+3} ${y+2} ${x+5} ${y+3} Z" fill="none" stroke="${color}" stroke-width="1"/>`;
const calendarIcon=(x:number,y:number,color:string)=>`<rect x="${x-5}" y="${y-4}" width="10" height="8" rx="1" fill="none" stroke="${color}" stroke-width="1"/><line x1="${x-5}" y1="${y-1.5}" x2="${x+5}" y2="${y-1.5}" stroke="${color}" stroke-width="1"/><line x1="${x-2.5}" y1="${y-5}" x2="${x-2.5}" y2="${y-2.5}" stroke="${color}" stroke-width="1"/><line x1="${x+2.5}" y1="${y-5}" x2="${x+2.5}" y2="${y-2.5}" stroke="${color}" stroke-width="1"/>`;
const reportIconSvg=(x:number,y:number,color:string)=>`<rect x="${x-6}" y="${y-8}" width="12" height="16" rx="1.5" fill="none" stroke="${color}" stroke-width="1.6"/><line x1="${x-3}" y1="${y-3}" x2="${x+3}" y2="${y-3}" stroke="${color}" stroke-width="1.2"/><line x1="${x-3}" y1="${y}" x2="${x+3}" y2="${y}" stroke="${color}" stroke-width="1.2"/><line x1="${x-3}" y1="${y+3}" x2="${x+2}" y2="${y+3}" stroke="${color}" stroke-width="1.2"/>`;

const reportLines=(reportName:string)=>{
  const words=String(reportName||"").toLocaleUpperCase("tr-TR").split(/\s+/).filter(Boolean);
  if(words.length<=2)return [words.join(" ")];
  if(words.length===3)return [words[0],words.slice(1).join(" ")];
  if(words.length===4)return [words.slice(0,2).join(" "),words.slice(2).join(" ")];
  const mid=Math.ceil(words.length/2);
  return [words.slice(0,mid).join(" "),words.slice(mid).join(" ")];
};

export function buildReportFamilyPdfHeader(header:ReportFamilyPdfHeader,logoDataUrl?:string,campusDataUrl?:string):any{
  const key=header.variant==="individual"?"individual":header.variant==="institution"?"institution":header.accent||"subject";
  const theme=themes[key];
  const width=547;
  const height=91;
  const schoolName=(header.schoolName||"ORDU LİSESİ").toLocaleUpperCase("tr-TR");
  const year=header.academicYear||yearFromDate(header.examDate);
  const examName=String(header.examName||"Sınav").toLocaleUpperCase("tr-TR");
  const date=formatDate(header.examDate);
  const lines=reportLines(header.reportName);
  const meta=header.variant==="analysis"
    ? [
        {label:"DERS",value:header.sectionTitle||header.meta?.[0]?.value||"Tümü"},
        {label:"KAPSAM",value:header.sectionSubtitle||header.meta?.[1]?.value||"-"},
        ...(header.meta||[]).slice(2,3),
      ]
    : (header.meta||[]);
  const student=header.student;
  const examFont=examName.length>34?9:examName.length>24?11:13;
  const schoolFont=schoolName.length>20?13:16;
  const reportFont=lines.some(line=>line.length>19)?8.5:9.5;
  const imageTag=(href:string|undefined,x:number,y:number,w:number,h:number,extra="")=>href?`<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" ${extra}/>`:"";

  const leftContent=header.variant==="individual"?`
    <defs><clipPath id="photoClip"><circle cx="54" cy="46" r="33"/></clipPath></defs>
    <circle cx="54" cy="46" r="36" fill="#ffffff" stroke="${theme.left}" stroke-width="3"/>
    ${student?.photoDataUrl?imageTag(student.photoDataUrl,21,13,66,66,'clip-path="url(#photoClip)"'):`<circle cx="54" cy="46" r="28" fill="${theme.leftSoft}"/>${svgText((student?.name||"?").trim().charAt(0).toLocaleUpperCase("tr-TR"),54,54,22,800,theme.left,"middle")}`}
    ${userIcon(92,35,theme.ink)}${svgText(student?.name||"-",104,38,9.7,800,"#172033")}
    ${capIcon(92,53,theme.ink)}${svgText(student?.classroom||"-",104,56,8.5,700,"#172033")}
    ${bookIcon(92,70,theme.ink)}${svgText(`Öğrenci No: ${student?.number||"-"}`,104,73,8.2,700,"#172033")}
  `:`
    <circle cx="49" cy="46" r="29" fill="${theme.left}" stroke="#ffffff" stroke-width="3"/>
    ${svgText(header.variant==="institution"?"K":"A",49,54,22,800,"#ffffff","middle")}
    ${meta.slice(0,3).map((item,index)=>`${svgText(String(item.label||"").toLocaleUpperCase("tr-TR"),86,31+index*19,5.8,800,theme.ink)}${svgText(item.value,86,40+index*19,8.4,800,"#172033")}`).join("")}
  `;

  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="leftGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${theme.leftSoft}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
      <linearGradient id="mainGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${theme.mainA}"/><stop offset="1" stop-color="${theme.mainB}"/></linearGradient>
      <linearGradient id="rightGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${theme.rightA}"/><stop offset="1" stop-color="${theme.rightB}"/></linearGradient>
      <clipPath id="campusClip"><rect x="355" y="0" width="150" height="91"/></clipPath>
    </defs>
    <rect x="0.5" y="0.5" width="546" height="90" rx="1" fill="#ffffff" stroke="#dbe3e8"/>
    <rect x="0" y="0" width="200" height="91" fill="url(#leftGrad)"/>
    <path d="M0 0 H86 C57 17 46 35 44 57 C42 72 33 84 18 91 H0 Z" fill="${theme.left}" opacity=".95"/>
    <path d="M52 0 C95 5 120 15 146 38" fill="none" stroke="${theme.left}" stroke-width="2" opacity=".7"/>
    ${campusDataUrl?imageTag(campusDataUrl,355,0,150,91,'clip-path="url(#campusClip)"'):''}
    <path d="M355 0 C375 15 382 31 383 46 C384 64 378 79 365 91 H350 V0 Z" fill="#ffffff" opacity=".9"/>
    <path d="M453 0 C432 12 424 28 415 45 C405 65 391 79 370 91 H547 V0 Z" fill="url(#rightGrad)"/>
    <path d="M470 0 C447 13 438 30 430 48 C420 66 409 78 393 91" fill="none" stroke="#ffffff" stroke-width="3"/>
    <path d="M481 0 C458 14 449 31 440 50 C431 69 420 80 405 91" fill="none" stroke="${theme.accent}" stroke-width="1.6" opacity=".85"/>
    <rect x="200" y="42" width="228" height="30" rx="15" fill="${theme.accent}" transform="translate(4,4)" opacity=".96"/>
    <rect x="200" y="42" width="228" height="30" rx="15" fill="url(#mainGrad)"/>
    <rect x="281" y="73" width="104" height="17" rx="8.5" fill="${theme.date}" stroke="#ffffff" stroke-width=".7"/>
    ${leftContent}
    ${logoDataUrl?imageTag(logoDataUrl,225,5,26,26):''}
    ${svgText(schoolName,313,21,schoolFont,900,theme.ink,"middle")}
    ${svgText(examName,325,61,examFont,900,"#ffffff","middle")}
    ${calendarIcon(294,81,theme.ink)}
    ${svgText(date,335,84,7.5,900,theme.ink,"middle")}
    ${reportIconSvg(506,27,theme.reportText)}
    ${lines.map((line,index)=>svgText(line,506,51+index*12,reportFont,900,theme.reportText,"middle")).join("")}
  </svg>`;

  return {svg,width:547,height:91,margin:[0,0,0,8]};
}
