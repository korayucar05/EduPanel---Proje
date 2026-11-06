export type HomeworkNotificationCardData = {
  schoolName?: string;
  schoolLogoUrl?: string;
  studentName: string;
  classroom?: string;
  courseName?: string;
  homeworkTitle?: string;
  checkDate?: string;
  status?: string;
};

const W = 900;
const H = 1120;

const font = (size:number, weight=600) => `${weight} ${size}px Arial, "Segoe UI", sans-serif`;

function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,r);
  ctx.fillStyle=fill;
  ctx.fill();
  if(stroke){
    ctx.strokeStyle=stroke;
    ctx.lineWidth=2;
    ctx.stroke();
  }
}

function text(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,size:number,color="#0f172a",weight=600){
  ctx.font=font(size,weight);
  ctx.fillStyle=color;
  ctx.fillText(value,x,y);
}

function wrap(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,maxWidth:number,lineHeight:number,maxLines:number,size:number,color="#334155",weight=500){
  ctx.font=font(size,weight);
  ctx.fillStyle=color;
  const words=String(value||"-").split(/\s+/);
  const lines:string[]=[];
  let line="";
  for(const word of words){
    const test=line?`${line} ${word}`:word;
    if(ctx.measureText(test).width>maxWidth && line){
      lines.push(line);
      line=word;
    }else{
      line=test;
    }
  }
  if(line) lines.push(line);
  const visible=lines.slice(0,maxLines);
  if(lines.length>maxLines && visible.length){
    let last=visible[visible.length-1];
    while(last.length>2 && ctx.measureText(`${last}…`).width>maxWidth) last=last.slice(0,-1);
    visible[visible.length-1]=`${last}…`;
  }
  visible.forEach((row,index)=>ctx.fillText(row,x,y+index*lineHeight));
}

function fmtDate(value?:string){
  if(!value) return "-";
  const d=new Date(value.includes("T")?value:`${value}T12:00:00`);
  return Number.isNaN(d.getTime())?value:d.toLocaleDateString("tr-TR");
}

const loadImage=(src?:string)=>new Promise<HTMLImageElement|null>((resolve)=>{
  if(!src) return resolve(null);
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>resolve(null);
  image.src=src;
});

export async function createHomeworkNotificationCardBase64(data:HomeworkNotificationCardData){
  const canvas=document.createElement("canvas");
  canvas.width=W;
  canvas.height=H;
  const ctx=canvas.getContext("2d");
  if(!ctx) throw new Error("Kart tuvali oluşturulamadı.");

  ctx.fillStyle="#fffdf7";
  ctx.fillRect(0,0,W,H);

  const school=data.schoolName||"Ordu Lisesi";
  const logo=await loadImage(data.schoolLogoUrl);

  if(logo){
    ctx.drawImage(logo,35,35,100,100);
  }else{
    ctx.beginPath();
    ctx.arc(85,85,50,0,Math.PI*2);
    ctx.fillStyle="#173b5e";
    ctx.fill();
    text(ctx,"OL",58,96,30,"#fff",900);
  }

  text(ctx,school.toLocaleUpperCase("tr-TR"),155,75,29,"#10213b",900);
  text(ctx,"Eğitimde Birlik, Gelecekte Işık!",155,108,16,"#b78a35",600);

  rounded(ctx,500,35,360,125,22,"#173b5e");
  text(ctx,"ÖDEV",620,90,36,"#fff",900);
  text(ctx,"BİLGİLENDİRMESİ",548,132,27,"#fff",850);

  rounded(ctx,35,205,330,690,25,"#ffffff","#e5e7eb");

  const field=(label:string,value:string,y:number)=>{
    text(ctx,label,65,y,15,"#173b5e",800);
    wrap(ctx,value||"-",65,y+32,255,29,2,22,"#10213b",700);
  };

  field("ÖĞRENCİ",data.studentName,260);
  field("SINIF",data.classroom||"-",385);
  field("DERS",data.courseName||"-",500);
  field("ÖDEV KONUSU",data.homeworkTitle||"-",620);
  field("KONTROL TARİHİ",fmtDate(data.checkDate),775);

  const status=String(data.status||"").toLocaleLowerCase("tr-TR");
  const accent=status.includes("tam")&&!status.includes("edilmedi")
    ? "#15803d"
    : status.includes("kısmi")
      ? "#d97706"
      : status.includes("geliştir")
        ? "#0369a1"
        : "#dc2626";

  const pale=status.includes("tam")&&!status.includes("edilmedi")
    ? "#ecfdf5"
    : status.includes("kısmi")
      ? "#fff7ed"
      : status.includes("geliştir")
        ? "#eff6ff"
        : "#fff1f2";

  rounded(ctx,405,245,455,220,25,pale,accent);
  wrap(ctx,(data.status||"ÖDEV DURUMU").toLocaleUpperCase("tr-TR"),450,315,365,36,2,29,accent,900);

  const statusText=status.includes("tam")&&!status.includes("edilmedi")
    ? "Ödev eksiksiz teslim edilmiştir."
    : status.includes("kısmi")
      ? "Ödev kısmen eksik teslim edilmiştir."
      : status.includes("geliştir")
        ? "Ödevin geliştirilmesi gereken bölümleri bulunmaktadır."
        : "Ödev teslim edilmemiştir.";

  wrap(ctx,statusText,450,395,360,29,3,21,"#334155",600);

  rounded(ctx,405,505,455,390,25,"#ffffff","#e5e7eb");
  text(ctx,"DEĞERLİ VELİMİZ,",450,570,22,"#173b5e",850);

  const note=status.includes("tam")&&!status.includes("edilmedi")
    ? "Öğrencimizin sorumluluğunu yerine getirmesinden memnuniyet duyuyor, bu güzel çalışma alışkanlığının devamını diliyoruz."
    : status.includes("kısmi")
      ? "Öğrencimizin eksiklerini tamamlaması için birlikte çalışarak daha güzel sonuçlara ulaşacağımıza inanıyoruz."
      : status.includes("geliştir")
        ? "Öğrencimizin potansiyeline inanıyoruz. Düzenli çalışma ve desteğinizle daha güzel sonuçlara ulaşacaktır."
        : "Öğrencimizin ödev sorumluluğunu yerine getirmesi konusunda desteğinizi rica ediyoruz.";

  wrap(ctx,note,450,625,355,33,7,23,"#334155",500);

  rounded(ctx,0,950,W,130,0,"#173b5e");
  text(ctx,school.toLocaleUpperCase("tr-TR"),45,1015,26,"#fff",850);
  text(ctx,"Birlikte Takip Edelim, Birlikte Geliştirelim.",45,1053,18,"#ead9aa",600);

  return canvas.toDataURL("image/png",0.96).split(",")[1];
}

export type BehaviorNotificationCardData = {
  schoolName?: string;
  schoolLogoUrl?: string;
  studentName: string;
  classroom?: string;
  date?: string;
  behaviorName?: string;
  behaviorType?: string;
  description?: string;
  teacherName?: string;
};

export async function createBehaviorNotificationCardBase64(
  data: BehaviorNotificationCardData
) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Davranış bildirim kartı oluşturulamadı.");
  }

  const positive =
    String(data.behaviorType || "")
      .toLocaleLowerCase("tr-TR")
      .includes("olumlu");

  const accent = positive ? "#15803d" : "#c81e1e";
  const pale = positive ? "#f0fdf4" : "#fff5f5";
  const school = data.schoolName || "Ordu Lisesi";

  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, W, H);

  const logo = await loadImage(data.schoolLogoUrl);

  if (logo) {
    ctx.drawImage(logo, 35, 35, 100, 100);
  } else {
    ctx.beginPath();
    ctx.arc(85, 85, 50, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    text(ctx, "OL", 58, 96, 30, "#fff", 900);
  }

  text(
    ctx,
    school.toLocaleUpperCase("tr-TR"),
    155,
    75,
    29,
    "#10213b",
    900
  );

  text(
    ctx,
    "Eğitimde Birlik, Gelecekte Işık!",
    155,
    108,
    16,
    accent,
    600
  );

  rounded(ctx, 500, 35, 360, 125, 22, accent);

  if (positive) {
    text(ctx, "OLUMLU", 600, 88, 32, "#fff", 900);
    text(ctx, "DAVRANIŞ", 585, 128, 28, "#fff", 850);
  } else {
    text(ctx, "DAVRANIŞ", 585, 88, 31, "#fff", 900);
    text(ctx, "BİLDİRİMİ", 583, 128, 27, "#fff", 850);
  }

  rounded(ctx, 35, 205, 285, 690, 25, "#ffffff", "#e5e7eb");

  const field = (
    label: string,
    value: string,
    y: number
  ) => {
    text(ctx, label, 65, y, 15, accent, 800);
    wrap(
      ctx,
      value || "-",
      65,
      y + 32,
      215,
      29,
      3,
      21,
      "#10213b",
      700
    );
  };

  field("ÖĞRENCİ", data.studentName, 270);
  field("SINIF", data.classroom || "-", 420);
  field("TARİH", fmtDate(data.date), 555);
  field(
    "DAVRANIŞ TÜRÜ",
    positive ? "Olumlu Davranış" : "Olumsuz Davranış",
    690
  );

  rounded(ctx, 355, 225, 505, 235, 25, pale, accent);

  text(
    ctx,
    positive ? "TEBRİKLER!" : "BİLGİLENDİRME",
    405,
    290,
    29,
    accent,
    900
  );

  wrap(
    ctx,
    data.behaviorName || "Davranış Kaydı",
    405,
    350,
    400,
    34,
    3,
    24,
    "#334155",
    700
  );

  rounded(ctx, 355, 500, 505, 395, 25, "#ffffff", "#e5e7eb");

  text(
    ctx,
    "DAVRANIŞ BİLGİSİ",
    405,
    560,
    20,
    "#10213b",
    850
  );

  wrap(
    ctx,
    data.description || data.behaviorName || "-",
    405,
    610,
    400,
    31,
    5,
    22,
    "#334155",
    500
  );

  text(
    ctx,
    "DEĞERLİ VELİMİZ,",
    405,
    795,
    20,
    accent,
    850
  );

  const parentNote = positive
    ? "Öğrencimizin sergilediği bu güzel davranış bizleri mutlu etmiştir. Kendisini içtenlikle tebrik ediyor, olumlu tutumunun devamını diliyoruz."
    : "Öğrencimizin gelişimini birlikte desteklemek amacıyla bu durumu bilgilerinize sunuyor, göstereceğiniz ilgi ve destek için teşekkür ediyoruz.";

  wrap(
    ctx,
    parentNote,
    405,
    835,
    400,
    28,
    4,
    19,
    "#334155",
    500
  );

  rounded(ctx, 0, 950, W, 130, 0, accent);

  text(
    ctx,
    school.toLocaleUpperCase("tr-TR"),
    45,
    1012,
    26,
    "#fff",
    850
  );

  text(
    ctx,
    positive
      ? "Güzel davranışları birlikte büyütelim."
      : "Birlikte Takip Edelim, Birlikte Geliştirelim.",
    45,
    1052,
    18,
    "#fff",
    600
  );

  return canvas
    .toDataURL("image/png", 0.96)
    .split(",")[1];
}
