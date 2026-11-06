export type HasatStudentReportInput={
  studentName:string;
  classroom?:string;
  studentNumber?:string|number;
  examName:string;
  reportTitle?:string;
  institutionRank?:number;
  institutionParticipants?:number;
  classroomRank?:number;
  classroomParticipants?:number;
  totals?:{correct?:number;wrong?:number;empty?:number;net?:number;score?:number};
  subjects?:Array<{
    subjectName:string;
    correct?:number;
    wrong?:number;
    empty?:number;
    net?:number;
    totalQuestions?:number;
    success?:number;
  }>;
};

const trMap:Record<string,string>={
  "ç":"c","Ç":"C","ğ":"g","Ğ":"G","ı":"i","İ":"I",
  "ö":"o","Ö":"O","ş":"s","Ş":"S","ü":"u","Ü":"U",
};

const ascii=(value:any)=>String(value??"")
  .replace(/[çÇğĞıİöÖşŞüÜ]/g,(character)=>trMap[character]||character)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/[^\x20-\x7E]/g,"")
  .trim();

const esc=(value:any)=>ascii(value)
  .replace(/\\/g,"\\\\")
  .replace(/\(/g,"\\(")
  .replace(/\)/g,"\\)");

const textWidth=(text:string,size:number)=>ascii(text).length*size*0.52;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const fmt=(value:any,digits=2)=>{
  const number=Number(value||0);
  return Number.isFinite(number)?number.toFixed(digits):"0.00";
};

class PdfPage{
  private commands:string[]=[];
  constructor(private width=595,private height=842){}

  rect(x:number,y:number,w:number,h:number,fill?:string,stroke?:string,lineWidth=1,radius=0){
    if(fill)this.commands.push(`${fill} rg`);
    if(stroke)this.commands.push(`${stroke} RG ${lineWidth} w`);
    // Radius deliberately ignored for compatibility and small size.
    this.commands.push(`${x} ${y} ${w} ${h} re ${fill&&stroke?"B":fill?"f":"S"}`);
  }

  line(x1:number,y1:number,x2:number,y2:number,stroke="0.8 0.8 0.8",lineWidth=1){
    this.commands.push(`${stroke} RG ${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  text(value:any,x:number,y:number,size=10,bold=false,color="0 0 0",align:"left"|"center"|"right"="left",maxWidth?:number){
    let text=ascii(value);
    if(maxWidth){
      const maxChars=Math.max(1,Math.floor(maxWidth/(size*0.52)));
      if(text.length>maxChars)text=text.slice(0,Math.max(1,maxChars-3))+"...";
    }
    let drawX=x;
    const width=textWidth(text,size);
    if(align==="center")drawX=x-width/2;
    if(align==="right")drawX=x-width;
    this.commands.push(`BT ${color} rg /${bold?"F2":"F1"} ${size} Tf ${drawX} ${y} Td (${esc(text)}) Tj ET`);
  }

  progress(x:number,y:number,w:number,h:number,percent:number){
    const p=clamp(percent,0,100);
    this.rect(x,y,w,h,"0.93 0.95 0.97");
    this.rect(x,y,w*p/100,h,p>=75?"0.08 0.55 0.34":p>=50?"0.95 0.62 0.08":"0.85 0.20 0.20");
  }

  stream(){return this.commands.join("\n");}
}

export function createHasatStudentReportPdf(input:HasatStudentReportInput):Blob{
  const page=new PdfPage();
  const green="0.06 0.45 0.29";
  const dark="0.08 0.16 0.24";
  const muted="0.38 0.45 0.54";
  const light="0.96 0.98 0.97";
  const border="0.82 0.86 0.89";
  const red="0.80 0.12 0.18";

  // Page frame and header.
  page.rect(20,20,555,802,"1 1 1",border,0.8);
  page.rect(20,742,555,80,green);
  page.text("e-Nstitü",48,783,24,true,"1 1 1");
  page.text("Hedefli Akademik Surec Analiz Takibi",48,760,9,false,"0.88 1 0.93");
  page.text(input.reportTitle||"BIREYSEL SINAV KARNESI",545,783,14,true,"1 1 1","right",260);
  page.text(input.examName,545,760,10,false,"0.88 1 0.93","right",280);

  // Student identity.
  page.rect(38,665,519,58,light,border,0.7);
  page.text("OGRENCI",52,704,8,true,green);
  page.text(input.studentName,52,682,17,true,dark,"left",230);
  page.text(`Sinif: ${input.classroom||"-"}`,330,700,9,true,dark);
  page.text(`Numara: ${input.studentNumber||"-"}`,330,682,9,true,dark);

  // KPI cards.
  const kpis=[
    ["DOGRU",String(input.totals?.correct??0)],
    ["YANLIS",String(input.totals?.wrong??0)],
    ["BOS",String(input.totals?.empty??0)],
    ["NET",fmt(input.totals?.net,2)],
    ["PUAN",fmt(input.totals?.score,2)],
  ];
  const cardW=98;
  kpis.forEach((item,index)=>{
    const x=38+index*(cardW+7);
    page.rect(x,600,cardW,48,"1 1 1",border,0.7);
    page.rect(x,630,cardW,18,index===4?red:green);
    page.text(item[0],x+cardW/2,635,7,true,"1 1 1","center");
    page.text(item[1],x+cardW/2,610,15,true,dark,"center");
  });

  // Rankings.
  page.text("SIRALAMA",38,575,10,true,green);
  page.rect(38,525,250,40,light,border,0.7);
  page.text("Kurum",52,548,9,true,dark);
  page.text(`${input.institutionRank||"-"} / ${input.institutionParticipants||"-"}`,270,548,12,true,green,"right");
  page.rect(307,525,250,40,light,border,0.7);
  page.text("Sinif",321,548,9,true,dark);
  page.text(`${input.classroomRank||"-"} / ${input.classroomParticipants||"-"}`,539,548,12,true,green,"right");

  // Subject table.
  page.text("DERS BAZLI BASARI",38,498,10,true,green);
  const tableX=38, tableY=462;
  const cols=[200,48,48,48,60,80];
  const headers=["Ders","D","Y","B","Net","Basari"];
  let x=tableX;
  headers.forEach((header,index)=>{
    page.rect(x,tableY,cols[index],24,green,border,0.5);
    page.text(header,x+(index==0?8:cols[index]/2),tableY+8,8,true,"1 1 1",index==0?"left":"center");
    x+=cols[index];
  });

  const subjects=(input.subjects||[]).slice(0,12);
  subjects.forEach((subject,rowIndex)=>{
    const y=tableY-26*(rowIndex+1);
    const fill=rowIndex%2===0?"1 1 1":light;
    const total=Number(subject.totalQuestions||0);
    const success=Number.isFinite(Number(subject.success))
      ? Number(subject.success)
      : total?Number(subject.correct||0)/total*100:0;
    const values=[
      subject.subjectName,
      subject.correct??0,
      subject.wrong??0,
      subject.empty??0,
      fmt(subject.net,2),
      `%${Math.round(success)}`,
    ];
    let cx=tableX;
    values.forEach((value,index)=>{
      page.rect(cx,y,cols[index],26,fill,border,0.4);
      page.text(value,cx+(index==0?8:cols[index]/2),y+9,index==0?8:8,index==0,dark,index==0?"left":"center",cols[index]-10);
      cx+=cols[index];
    });
  });

  // Overall success and short guidance.
  const totalQuestions=(input.subjects||[]).reduce((sum,s)=>sum+Number(s.totalQuestions||0),0);
  const overall=totalQuestions?Number(input.totals?.correct||0)/totalQuestions*100:0;
  page.text("GENEL BASARI",38,120,9,true,dark);
  page.progress(38,95,519,12,overall);
  page.text(`%${Math.round(overall)}`,557,119,10,true,overall>=50?green:red,"right");

  const sorted=[...(input.subjects||[])].sort((a,b)=>{
    const sa=Number(a.success??(a.totalQuestions?Number(a.correct||0)/Number(a.totalQuestions)*100:0));
    const sb=Number(b.success??(b.totalQuestions?Number(b.correct||0)/Number(b.totalQuestions)*100:0));
    return sb-sa;
  });
  const strongest=sorted[0]?.subjectName;
  const support=sorted[sorted.length-1]?.subjectName;
  page.text("Kisa Degerlendirme",38,72,9,true,green);
  page.text(
    strongest&&support
      ? `Guclu alan: ${strongest}. Gelistirilmesi gereken alan: ${support}.`
      : "Ders bazli sonuclarinizi inceleyerek calisma planinizi guncelleyiniz.",
    38,52,8,false,muted,"left",500,
  );

  // Build PDF objects.
  const stream=page.stream();
  const objects:string[]=[];
  const add=(content:string)=>{objects.push(content);return objects.length;};
  const catalogId=add("");
  const pagesId=add("");
  const fontId=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldId=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const contentId=add(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
  const pageId=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId-1]=`<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  let pdf="%PDF-1.4\n";
  const offsets=[0];
  objects.forEach((object,index)=>{
    offsets[index+1]=new TextEncoder().encode(pdf).length;
    pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset=new TextEncoder().encode(pdf).length;
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let index=1;index<=objects.length;index++){
    pdf+=`${String(offsets[index]).padStart(10,"0")} 00000 n \n`;
  }
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf],{type:"application/pdf"});
}
