import React from "react";
import { BarChart3, BookOpen, Building2, CalendarDays, FileText, GraduationCap, UserRound } from "lucide-react";
import schoolLogo from "../../../../assets/ordu-lisesi-logo.png";
import campusImage from "../../../../assets/ordu-lisesi-campus-report.png";

type MetaItem={label:string;value:React.ReactNode};
export type ReportFamilyHeaderVariant="individual"|"institution"|"analysis";
export type ReportFamilyHeaderAccent="subject"|"item"|"topic";

type Props={
  variant:ReportFamilyHeaderVariant;
  schoolName?:string;
  academicYear?:string;
  examName:string;
  examDate?:string;
  reportName:string;
  student?:{name?:string;classroom?:string;number?:string|number;photoUrl?:string};
  meta?:MetaItem[];
  accent?:ReportFamilyHeaderAccent;
  compact?:boolean;
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
  individual:{left:"#0b8ee6",leftSoft:"#eef8ff",mainA:"#1749a7",mainB:"#0757ad",accent:"#ffc526",rightA:"#06a5a8",rightB:"#034a58",date:"#f7ddf0",ink:"#071f48"},
  institution:{left:"#8a69ef",leftSoft:"#f4f0ff",mainA:"#2446b4",mainB:"#6b2a90",accent:"#ffbe20",rightA:"#ffdb43",rightB:"#f4ad16",date:"#e8d7ff",ink:"#19153e"},
  subject:{left:"#27b5ee",leftSoft:"#eefbff",mainA:"#109a9f",mainB:"#075d78",accent:"#ffd02a",rightA:"#0e8eda",rightB:"#053d68",date:"#d8efff",ink:"#07304e"},
  item:{left:"#7f6bf2",leftSoft:"#f5f1ff",mainA:"#5c46b6",mainB:"#2f4dab",accent:"#ffc83c",rightA:"#6b54c6",rightB:"#2f256f",date:"#e7ddff",ink:"#21184f"},
  topic:{left:"#19b9b1",leftSoft:"#edfffc",mainA:"#109b94",mainB:"#08717c",accent:"#f2c43d",rightA:"#13aaa4",rightB:"#07575c",date:"#daf6ef",ink:"#073c3a"},
};

const reportIcon=(variant:ReportFamilyHeaderVariant,accent:ReportFamilyHeaderAccent)=>{
  if(variant==="individual")return <FileText className="h-7 w-7"/>;
  if(variant==="institution")return <Building2 className="h-7 w-7"/>;
  if(accent==="subject")return <BookOpen className="h-7 w-7"/>;
  return <BarChart3 className="h-7 w-7"/>;
};

export default function ReportFamilyHeader({variant,schoolName="ORDU LİSESİ",academicYear,examName,examDate,reportName,student,meta=[],accent="subject",compact=false}:Props){
  const theme=variant==="individual"?themes.individual:variant==="institution"?themes.institution:themes[accent];
  const height=compact?118:150;
  const leftMeta:MetaItem[]=variant==="individual"?[
    {label:"",value:student?.name||"-"},
    {label:"",value:student?.classroom||"-"},
    {label:"",value:`Öğrenci No: ${student?.number||"-"}`},
  ]:meta.slice(0,3);
  const examFont=String(examName||"").length>34?compact?14:18:String(examName||"").length>24?compact?16:21:compact?18:25;
  const reportFont=String(reportName||"").length>28?compact?11:13:compact?12:15;

  return <section className="relative isolate w-full overflow-hidden border border-slate-200 bg-white shadow-[0_5px_16px_rgba(15,23,42,.16)]" style={{height}}>
    <div className="absolute inset-0 bg-white"/>

    {/* left light field and colored wedge */}
    <div className="absolute inset-y-0 left-0 w-[36%]" style={{background:`linear-gradient(95deg,${theme.leftSoft} 0%,#ffffff 86%)`}}/>
    <div className="absolute -left-[7%] -top-[34%] h-[175%] w-[23%] rotate-[8deg] rounded-[48%] opacity-95" style={{background:`linear-gradient(135deg,${theme.left} 0%,${theme.leftSoft} 82%)`}}/>
    <div className="absolute left-[5%] top-0 h-[5px] w-[33%] rounded-full opacity-80" style={{background:`linear-gradient(90deg,${theme.left},transparent)`}}/>

    {/* campus photo field */}
    <div className="absolute inset-y-0 right-[9.5%] w-[29%] overflow-hidden">
      <img src={campusImage} alt="" className="h-full w-full object-cover object-center"/>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,white_0%,rgba(255,255,255,.78)_12%,transparent_40%)]"/>
    </div>

    {/* right wave, screenshot-like */}
    <div className="absolute -bottom-[52%] -right-[10%] h-[168%] w-[35%] rotate-[-11deg] rounded-[48%] border-l-[4px] border-white" style={{background:`linear-gradient(130deg,${theme.rightA},${theme.rightB})`}}/>
    <div className="absolute -bottom-[60%] right-[4%] h-[166%] w-[25%] rotate-[-11deg] rounded-[48%] border-l-[3px] opacity-60" style={{borderColor:theme.accent}}/>

    {/* center ribbon shadow/accent */}
    <div className="absolute left-[35.8%] top-[48%] h-[43%] w-[40.5%] -translate-y-1/2 translate-x-[6px] translate-y-[7px] rounded-full" style={{background:theme.accent}}/>
    <div className="absolute left-[35.8%] top-[48%] h-[43%] w-[40.5%] -translate-y-1/2 rounded-full shadow-[0_8px_12px_rgba(0,0,0,.18)]" style={{background:`linear-gradient(90deg,${theme.mainA},${theme.mainB})`}}/>

    {/* school title */}
    <div className="absolute left-[41%] top-[8px] z-20 flex w-[24%] items-center justify-center gap-3">
      <img src={schoolLogo} alt="" className={compact?"h-8 w-8 object-contain":"h-10 w-10 object-contain"}/>
      <div className="min-w-0 text-center">
        <div className="truncate font-black uppercase tracking-[-.02em]" style={{color:theme.ink,fontSize:compact?17:24}}>{schoolName}</div>
      </div>
    </div>

    {/* left identity / summary */}
    {variant==="individual"?<>
      <div className="absolute left-[1.3%] top-[8%] z-20 overflow-hidden rounded-full border-[4px] bg-white shadow-[0_4px_10px_rgba(0,0,0,.14)]" style={{width:compact?78:106,height:compact?78:106,borderColor:theme.left}}>
        {student?.photoUrl?<img src={student.photoUrl} alt="Öğrenci" className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center" style={{color:theme.left}}><UserRound className="h-10 w-10"/></div>}
      </div>
      <div className="absolute left-[15.5%] top-[31%] z-20 w-[16%] space-y-[7px] text-slate-800">
        <div className="flex items-center gap-2"><UserRound className="h-4 w-4 shrink-0"/><span className="truncate font-black" style={{fontSize:compact?10:12}}>{leftMeta[0]?.value}</span></div>
        <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 shrink-0"/><span className="truncate font-bold" style={{fontSize:compact?9:11}}>{leftMeta[1]?.value}</span></div>
        <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 shrink-0"/><span className="truncate font-bold" style={{fontSize:compact?9:11}}>{leftMeta[2]?.value}</span></div>
      </div>
    </>:<>
      <div className="absolute left-[2%] top-[19%] z-20 flex items-center gap-3">
        <div className="flex items-center justify-center rounded-full border-[4px] border-white shadow-md" style={{width:compact?62:84,height:compact?62:84,background:theme.left,color:"white"}}>
          {variant==="institution"?<Building2 className="h-8 w-8"/>:accent==="subject"?<BookOpen className="h-8 w-8"/>:<BarChart3 className="h-8 w-8"/>}
        </div>
        <div className="w-[170px] space-y-1.5">
          {leftMeta.map((item,index)=><div key={`${item.label}-${index}`} className="flex items-baseline gap-2 border-b border-slate-200 pb-1">
            <span className="shrink-0 font-black uppercase tracking-[.04em]" style={{color:theme.ink,fontSize:compact?7:8}}>{item.label}</span>
            <span className="min-w-0 truncate font-extrabold text-slate-800" style={{fontSize:compact?9:11}}>{item.value}</span>
          </div>)}
        </div>
      </div>
    </>}

    {/* main exam title */}
    <div className="absolute left-[39.3%] top-[50%] z-20 w-[34.4%] -translate-y-1/2 truncate text-right font-black uppercase leading-none text-white drop-shadow-sm pr-[4%]" style={{fontSize:examFont}}>{examName}</div>

    {/* date capsule */}
    <div className="absolute left-[58.5%] bottom-[2px] z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-1 font-black shadow-sm" style={{background:theme.date,color:theme.ink,fontSize:compact?8:10}}>
      <CalendarDays className="h-4 w-4"/>{formatDate(examDate)}
    </div>

    {/* right report name */}
    <div className="absolute right-[1.1%] top-[25%] z-30 flex w-[13%] flex-col items-center justify-center text-center font-black uppercase leading-[1.02]" style={{color:variant==="institution"?"#111827":"white",fontSize:reportFont}}>
      <div className="mb-2">{reportIcon(variant,accent)}</div>
      <div className="whitespace-pre-line">{reportName}</div>
    </div>
  </section>;
}
