import localforage from "../core/state/AppStateService";
import { fetchCollectionFromLocalDatabase } from "../core/data/LegacyDatabaseFacade";
import { PdfEngine } from "./core/PdfEngine";
import { urlToDataUrl } from "./core/PdfHelpers";
import { buildReportFamilyPdfHeader } from "./components/ReportFamilyHeader";

const subjectResult=(student:any,subjectName:string)=>(student?.subjects||[]).find((subject:any)=>subject.subjectName===subjectName);
const scorecardSchoolLogoUrl=new URL("../assets/ordu-lisesi-logo.png",import.meta.url).href;
const scorecardCampusUrl=new URL("../assets/ordu-lisesi-campus-report.png",import.meta.url).href;

const formatScorecardDate=(value:any)=>{
  const raw=String(value||"").trim();
  if(!raw)return "-";
  const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(match)return `${match[3]}.${match[2]}.${match[1]}`;
  return raw.includes("T")?raw.split("T")[0].split("-").reverse().join("."):raw;
};

export async function generateDesignedIndividualScorecardPdf({
  exam,
  results,
  selectedStudent,
}: {
  exam:any;
  results:any[];
  selectedStudent:any;
}):Promise<Blob>{
  const examName=exam?.examName||"Sınav";
  const [scorecardSchoolLogo,scorecardCampus]=await Promise.all([
    urlToDataUrl(scorecardSchoolLogoUrl).catch(()=>undefined),
    urlToDataUrl(scorecardCampusUrl).catch(()=>undefined),
  ]);
    const ranked=[...results].sort((a,b)=>(b.totals?.net||0)-(a.totals?.net||0));
    if(!ranked.length)throw new Error("Bireysel karne oluşturmak için sınav sonucu bulunamadı.");

    const reportStudents=selectedStudent
      ? ranked.filter(student=>
          student.recordId===selectedStudent.recordId||
          student.id===selectedStudent.id||
          (
            String(student.studentNumber||"")===String(selectedStudent.studentNumber||"")&&
            String(student.classroom||"")===String(selectedStudent.classroom||"")
          )
        )
      : [ranked[0]];

    if(!reportStudents.length)throw new Error("Seçili öğrenciye ait sınav sonucu bulunamadı.");

    const navy="#082f49";
    const blue="#0f5f99";
    const sky="#eaf5fb";
    const cyan="#d9f0f7";
    const gold="#d6a33d";
    const cream="#fffaf0";
    const green="#0f766e";
    const greenSoft="#dff5ef";
    const rose="#be123c";
    const roseSoft="#ffe7ee";
    const amber="#a16207";
    const amberSoft="#fef3c7";
    const slate="#334155";
    const muted="#64748b";
    const line="#cbd5e1";
    const white="#ffffff";

    const summaryCardWidth=50;
    const summaryCardHeight=50;
    const badge=(label:string,value:any,color:string,background:string)=>({
      width:"*",
      stack:[
        {
          canvas:[
            {type:"rect",x:3,y:4,w:summaryCardWidth,h:summaryCardHeight,r:9,color:"#c8d3df"},
            {type:"rect",x:0,y:0,w:summaryCardWidth,h:summaryCardHeight,r:9,color:background},
            {type:"rect",x:0,y:0,w:summaryCardWidth,h:17,r:9,color},
            {type:"rect",x:0,y:10,w:summaryCardWidth,h:7,color},
            {type:"rect",x:0,y:0,w:summaryCardWidth,h:summaryCardHeight,r:9,lineColor:"#bfd0dd",lineWidth:.65},
          ],
        },
        {
          stack:[
            {
              text:label,
              fontSize:5.4,
              bold:true,
              color:white,
              alignment:"center",
              characterSpacing:.45,
              margin:[1,0,1,0],
            },
            {
              text:String(value??"-"),
              fontSize:9.4,
              bold:false,
              color:"#0f4c81",
              alignment:"center",
              margin:[1,13,1,0],
            },
          ],
          margin:[0,-45,0,0],
        },
      ],
    });

    const gridCard=(label:string,value:any,color:string,background:string)=>({
      stack:[
        {
          canvas:[
            {type:"rect",x:3,y:4,w:48,h:50,r:8,color:"#c8d3df"},
            {type:"rect",x:0,y:0,w:48,h:50,r:8,color:background},
            {type:"rect",x:0,y:0,w:48,h:17,r:8,color},
            {type:"rect",x:0,y:10,w:48,h:7,color},
            {type:"rect",x:0,y:0,w:48,h:50,r:8,lineColor:"#bfd0dd",lineWidth:.65},
          ],
        },
        {
          stack:[
            {
              text:label,
              fontSize:4.65,
              bold:true,
              color:white,
              alignment:"center",
              characterSpacing:.25,
              margin:[1,0,1,0],
              noWrap:true,
            },
            {
              text:String(value??"-"),
              fontSize:8.8,
              bold:false,
              color:"#0f4c81",
              alignment:"center",
              margin:[1,13,1,0],
              noWrap:true,
            },
          ],
          margin:[0,-45,0,0],
        },
      ],
    });


    const summaryTimelineNode=(label:string,value:any,color:string,symbol:string)=>{
      const display=String(value??"-");
      const valueFont=display.length>18?5.1:display.length>12?5.9:display.length>8?7.0:8.8;
      return {
        stack:[
          {
            canvas:[
              {type:"rect",x:4,y:0,w:48,h:12,r:6,color},
              {type:"ellipse",x:28,y:28,r1:20.5,r2:20.5,lineColor:color,lineWidth:2.4,color:"#ffffff"},
              {type:"ellipse",x:28,y:28,r1:14.8,r2:14.8,color},
              {type:"ellipse",x:28,y:59,r1:1.45,r2:1.45,color},
              {type:"ellipse",x:28,y:65,r1:1.45,r2:1.45,color},
              {type:"ellipse",x:28,y:71,r1:1.45,r2:1.45,color},
              {type:"ellipse",x:28,y:81,r1:5.2,r2:5.2,color:"#ffffff",lineColor:color,lineWidth:1.5},
              {type:"ellipse",x:28,y:81,r1:1.7,r2:1.7,color},
            ],
          },
          {
            stack:[
              {
                text:label,
                fontSize:4.5,
                bold:true,
                color:"#ffffff",
                alignment:"center",
                lineHeight:.95,
                margin:[2,2.4,2,0],
              },
              {
                text:display,
                fontSize:valueFont,
                bold:true,
                color:"#ffffff",
                alignment:"center",
                lineHeight:.95,
                margin:[1,15.3,1,0],
              },
            ],
            margin:[0,-84,0,0],
          },
        ],
      };
    };

    const buildSummaryTimeline=(items:{label:string;value:any;color:string;symbol:string}[])=>({
      stack:[
        {
          canvas:[
            {type:"line",x1:28,y1:81,x2:Math.max(28,items.length*57-29),y2:81,lineColor:"#bcc9d7",lineWidth:1.5},
          ],
          margin:[0,0,0,-86],
        },
        {
          table:{
            widths:Array.from({length:items.length},()=>57),
            body:[[...items.map(item=>summaryTimelineNode(item.label,item.value,item.color,item.symbol))]],
          },
          layout:{
            hLineWidth:()=>0,
            vLineWidth:()=>0,
            paddingLeft:()=>0,
            paddingRight:()=>0,
            paddingTop:()=>0,
            paddingBottom:()=>0,
          },
        },
      ],
      margin:[0,0,0,8],
    });

    const tableLayout={
      hLineColor:()=>line,
      vLineColor:()=>line,
      hLineWidth:()=>.55,
      vLineWidth:()=>.55,
      paddingLeft:()=>5,
      paddingRight:()=>5,
      paddingTop:()=>5,
      paddingBottom:()=>5,
    };

    let registeredStudents:any[]=[];
    try{
      registeredStudents=await fetchCollectionFromLocalDatabase("students");
    }catch{
      registeredStudents=[];
    }
    if(!registeredStudents.length){
      const legacyStudents=await localforage.getItem<any[]>("school_students");
      registeredStudents=Array.isArray(legacyStudents)?legacyStudents:[];
    }

    const resolveStudentProfile=(student:any)=>{
      const number=String(student.studentNumber||"").trim();
      const name=String(student.studentName||"").trim().toLocaleLowerCase("tr-TR");
      return registeredStudents.find((item:any)=>{
        const itemNumber=String(
          item.studentNumber??item.schoolNumber??item.number??item.no??item.id??""
        ).trim();
        const itemName=String(
          item.studentName??item.fullName??item.name??
          `${item.firstName??""} ${item.lastName??""}`
        ).replace(/\s+/g," ").trim().toLocaleLowerCase("tr-TR");
        return (number&&itemNumber===number)||(name&&itemName===name);
      });
    };

    const normalizePhoto=(profile:any)=>{
      const candidate=
        profile?.avatar??
        profile?.photoUrl??
        profile?.photo??
        profile?.profilePhoto??
        profile?.profileImage??
        profile?.imageData??
        "";
      const value=String(candidate||"").trim();
      return value.startsWith("data:image/")?value:"";
    };

    const buildCodeScorecardHeader=(student:any,studentPhoto:string)=>{
      const schoolName=String(exam?.schoolName||exam?.institutionName||exam?.school?.name||"ORDU LİSESİ").toLocaleUpperCase("tr-TR");
      return buildReportFamilyPdfHeader({
        variant:"individual",
        schoolName,
        examName:String(examName||"Sınav"),
        examDate:exam?.examDate||exam?.date||exam?.createdAt,
        reportName:"BİREYSEL SINAV KARNESİ",
        student:{
          name:String(student?.studentName||"-"),
          classroom:String(student?.classroom||"-"),
          number:String(student?.studentNumber||"-"),
          photoDataUrl:studentPhoto||undefined,
        },
      },scorecardSchoolLogo,scorecardCampus);
    };

    const content:any[]=[];

    reportStudents.forEach((student:any,studentIndex:number)=>{
      const classStudents=ranked.filter(item=>(item.classroom||"Sınıfsız")===(student.classroom||"Sınıfsız"));
      const institutionRank=ranked.findIndex(item=>item.recordId===student.recordId)+1;
      const classRank=classStudents.findIndex(item=>item.recordId===student.recordId)+1;
      const totalQuestions=(student.subjects||[]).reduce((sum:number,subject:any)=>sum+Number(subject.totalQuestions||0),0);
      const success=totalQuestions?Number((Number(student.totals?.correct||0)/totalQuestions*100).toFixed(1)):0;
      const totalNet=Number(student.totals?.net||0);
      const institutionAverage=ranked.length
        ? Number((ranked.reduce((sum:number,item:any)=>sum+Number(item.totals?.net||0),0)/ranked.length).toFixed(2))
        : 0;
      const classAverage=classStudents.length
        ? Number((classStudents.reduce((sum:number,item:any)=>sum+Number(item.totals?.net||0),0)/classStudents.length).toFixed(2))
        : 0;
      const score=Number(student.score??student.points??student.totals?.score??(totalNet*4));
      const rankPercent=ranked.length?Number(((institutionRank/ranked.length)*100).toFixed(1)):0;
      const generalParticipants=Number(
        student.generalParticipants??
        student.overallParticipants??
        student.nationalParticipants??
        ranked.length
      )||ranked.length;
      const generalRank=Number(
        student.generalRank??
        student.overallRank??
        student.nationalRank??
        institutionRank
      )||institutionRank;
      const schoolParticipants=Number(
        student.institutionParticipants??
        student.schoolParticipants??
        ranked.length
      )||ranked.length;
      const schoolRank=Number(
        student.institutionRank??
        student.schoolRank??
        institutionRank
      )||institutionRank;
      const generalAverage=Number(
        student.generalAverage??
        student.overallAverage??
        student.nationalAverage??
        institutionAverage
      );
      const studentProfile=resolveStudentProfile(student);
      const studentPhoto=normalizePhoto(studentProfile);
      const studentInitial=String(student.studentName||"?").trim().charAt(0).toLocaleUpperCase("tr-TR")||"?";

      const subjects=(student.subjects||[]).map((subject:any)=>{
        const subjectName=subject.subjectName||subject.name||"Ders";
        const total=Number(subject.totalQuestions||0);
        const subjectSuccess=total?Number((Number(subject.correct||0)/total*100).toFixed(1)):0;
        const allSubjectNets=ranked.map(item=>Number(subjectResult(item,subjectName)?.net||0));
        const classSubjectNets=classStudents.map(item=>Number(subjectResult(item,subjectName)?.net||0));
        const institutionSubjectAverage=allSubjectNets.length
          ? Number((allSubjectNets.reduce((sum,value)=>sum+value,0)/allSubjectNets.length).toFixed(2))
          : 0;
        const classSubjectAverage=classSubjectNets.length
          ? Number((classSubjectNets.reduce((sum,value)=>sum+value,0)/classSubjectNets.length).toFixed(2))
          : 0;
        const allSubjectScores=ranked.map(item=>{
          const result=subjectResult(item,subjectName);
          return Number(
            result?.score??
            result?.points??
            result?.puan??
            (Number(result?.net||0)*4)
          );
        });
        const classSubjectScores=classStudents.map(item=>{
          const result=subjectResult(item,subjectName);
          return Number(
            result?.score??
            result?.points??
            result?.puan??
            (Number(result?.net||0)*4)
          );
        });
        const institutionSubjectScoreAverage=allSubjectScores.length
          ? Number((allSubjectScores.reduce((sum,value)=>sum+value,0)/allSubjectScores.length).toFixed(2))
          : 0;
        const classSubjectScoreAverage=classSubjectScores.length
          ? Number((classSubjectScores.reduce((sum,value)=>sum+value,0)/classSubjectScores.length).toFixed(2))
          : 0;
        const allSubjectSuccesses=ranked.map(item=>{
          const result=subjectResult(item,subjectName);
          const q=Number(result?.totalQuestions||0);
          return q?Number(result?.correct||0)/q*100:0;
        });
        const classSubjectSuccesses=classStudents.map(item=>{
          const result=subjectResult(item,subjectName);
          const q=Number(result?.totalQuestions||0);
          return q?Number(result?.correct||0)/q*100:0;
        });
        const institutionSubjectSuccessAverage=allSubjectSuccesses.length
          ? Number((allSubjectSuccesses.reduce((sum,value)=>sum+value,0)/allSubjectSuccesses.length).toFixed(2))
          : 0;
        const classSubjectSuccessAverage=classSubjectSuccesses.length
          ? Number((classSubjectSuccesses.reduce((sum,value)=>sum+value,0)/classSubjectSuccesses.length).toFixed(2))
          : 0;
        const classSubjectRank=[...classStudents]
          .sort((a,b)=>Number(subjectResult(b,subjectName)?.net||0)-Number(subjectResult(a,subjectName)?.net||0))
          .findIndex(item=>item.recordId===student.recordId)+1;
        const institutionSubjectRank=[...ranked]
          .sort((a,b)=>Number(subjectResult(b,subjectName)?.net||0)-Number(subjectResult(a,subjectName)?.net||0))
          .findIndex(item=>item.recordId===student.recordId)+1;

        const subjectScore=Number(
          subject.score??
          subject.points??
          subject.puan??
          (Number(subject.net||0)*4)
        );
        const subjectGeneralRank=Number(
          subject.generalRank??
          subject.overallRank??
          subject.nationalRank??
          institutionSubjectRank
        )||institutionSubjectRank;
        const subjectGeneralParticipants=Number(
          subject.generalParticipants??
          subject.overallParticipants??
          subject.nationalParticipants??
          ranked.length
        )||ranked.length;

        return{
          name:subjectName,
          correct:Number(subject.correct||0),
          wrong:Number(subject.wrong||0),
          empty:Number(subject.empty||0),
          net:Number(subject.net||0),
          score:Number(subjectScore.toFixed(1)),
          success:subjectSuccess,
          classAverage:classSubjectAverage,
          institutionAverage:institutionSubjectAverage,
          classScoreAverage:classSubjectScoreAverage,
          institutionScoreAverage:institutionSubjectScoreAverage,
          classSuccessAverage:classSubjectSuccessAverage,
          institutionSuccessAverage:institutionSubjectSuccessAverage,
          classRank:classSubjectRank,
          institutionRank:institutionSubjectRank,
          generalRank:subjectGeneralRank,
          generalParticipants:subjectGeneralParticipants,
          questions:Array.isArray(subject.questions)?subject.questions:[],
        };
      });

      const strongest=[...subjects].sort((a,b)=>b.success-a.success)[0];
      const development=[...subjects].sort((a,b)=>a.success-b.success)[0];
      const aboveInstitution=totalNet>=institutionAverage;
      const shortComment=subjects.length
        ? `${strongest?.name||"En güçlü ders"} dersindeki performans öğrencinin öne çıkan alanıdır. ${development&&development.name!==strongest?.name?`${development.name} dersinde düzenli tekrar ve kazanım odaklı çalışma önerilir.`:"Mevcut performansın korunması için düzenli tekrar önerilir."}`
        : "Ders bazlı sonuçlar sisteme kaydedildikçe ayrıntılı değerlendirme oluşturulacaktır.";

      if(studentIndex>0)content.push({text:"",pageBreak:"before"});

      content.push(
        buildCodeScorecardHeader(student,studentPhoto),
        {
          columns:[
            {
              width:"*",
              stack:[
                buildSummaryTimeline([
                  {label:"DOĞRU",value:student.totals?.correct||0,color:"#ff5b45",symbol:""},
                  {label:"YANLIŞ",value:student.totals?.wrong||0,color:"#ff2d92",symbol:""},
                  {label:"BOŞ",value:student.totals?.empty||0,color:"#8b5cf6",symbol:""},
                  {label:"NET",value:Number(totalNet.toFixed(2)),color:"#2f7dff",symbol:""},
                  {label:"PUAN",value:score.toFixed(1),color:"#00a6ff",symbol:""},
                  {label:"BAŞARI",value:`%${success}`,color:"#00c4d6",symbol:""},
                  {label:"GENEL",value:`${generalRank}/${generalParticipants}`,color:"#ff8a00",symbol:""},
                  {label:"OKUL",value:`${schoolRank}/${schoolParticipants}`,color:"#ff4fa3",symbol:""},
                  {label:"SINIF",value:`${classRank}/${classStudents.length}`,color:"#7c4dff",symbol:""},
                ]),
              ],
              margin:[28,28,28,0],
            },
          ],
          margin:[0,0,0,12],
        },

        {
          table:{
            widths:["*"],
            body:[[
              {
                stack:[
                  {
                    text:"DERS BAZLI BAŞARI ANALİZİ",
                    fontSize:10,
                    bold:true,
                    color:"#dc2626",
                    alignment:"center",
                    characterSpacing:.7,
                    margin:[0,0,0,7],
                  },
                  {
                    table:{
                      headerRows:2,
                      widths:[88,25,25,25,36,38,42,49,49,49],
                      body:[
                        [
                          {text:"Ders",rowSpan:2,bold:true,color:navy,fillColor:"#f8fafc",alignment:"center",margin:[1,7,1,1]},
                          {text:"D",rowSpan:2,bold:true,color:navy,fillColor:"#f8fafc",alignment:"center",margin:[1,7,1,1]},
                          {text:"Y",rowSpan:2,bold:true,color:navy,fillColor:"#f8fafc",alignment:"center",margin:[1,7,1,1]},
                          {text:"B",rowSpan:2,bold:true,color:navy,fillColor:"#f8fafc",alignment:"center",margin:[1,7,1,1]},
                          {text:"BAŞARI",colSpan:3,bold:true,color:"#dc2626",fillColor:"#fff5f5",alignment:"center"},
                          {},
                          {},
                          {text:"SIRALAMA",colSpan:3,bold:true,color:navy,fillColor:"#f1f5f9",alignment:"center",characterSpacing:.5},
                          {},
                          {},
                        ],
                        [
                          {},
                          {},
                          {},
                          {},
                          {text:"Net",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Puan",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Başarı",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Genel",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Okul",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                          {text:"Sınıf",bold:true,color:navy,fillColor:"#f8fafc",alignment:"center"},
                        ],
                      ...subjects.map((subject,index)=>{
                          const rowFill=index%2===0?"#ffffff":"#f8fafc";
                          const mark=(show:boolean)=>show
                            ? {text:"✓",fontSize:8,bold:true,color:"#0f766e",alignment:"right",margin:[0,-1,0,0]}
                            : {text:""};
                          const valueWithMark=(value:string,show:boolean)=>({
                            columns:[
                              {text:value,width:"*",alignment:"center"},
                              {width:10,...mark(show)},
                            ],
                            columnGap:0,
                          });

                          const netAbove=
                            subject.net>subject.institutionAverage;
                          const scoreAbove=
                            subject.score>subject.institutionScoreAverage;
                          const successAbove=
                            subject.success>subject.institutionSuccessAverage;
                          const generalAbove=
                            subject.generalRank<=Math.max(1,Math.ceil(subject.generalParticipants/2));
                          const schoolAbove=
                            subject.institutionRank<=Math.max(1,Math.ceil(ranked.length/2));
                          const classAbove=
                            subject.classRank<=Math.max(1,Math.ceil(classStudents.length/2));

                          return[
                            {text:subject.name,bold:true,color:slate,fillColor:rowFill},
                            {text:subject.correct,alignment:"center",fillColor:rowFill},
                            {text:subject.wrong,alignment:"center",fillColor:rowFill},
                            {text:subject.empty,alignment:"center",fillColor:rowFill},
                            {stack:[valueWithMark(subject.net.toFixed(2),netAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(subject.score.toFixed(1),scoreAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(`%${subject.success}`,successAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(`${subject.generalRank}/${subject.generalParticipants}`,generalAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(`${subject.institutionRank}/${ranked.length}`,schoolAbove)],fillColor:rowFill},
                            {stack:[valueWithMark(`${subject.classRank}/${classStudents.length}`,classAbove)],fillColor:rowFill},
                          ];
                        }),
                      ],
                    },
                    layout:{
                      hLineColor:()=>"#dc2626",
                      vLineColor:(index:number)=>index===7?"#94a3b8":"#d8e1e8",
                      hLineWidth:()=>.45,
                      vLineWidth:(index:number)=>index===7?1:.4,
                      paddingLeft:()=>4,
                      paddingRight:()=>4,
                      paddingTop:()=>5,
                      paddingBottom:()=>5,
                    },
                  },
                ],
                margin:[12,10,12,10],
              },
            ]],
          },
          layout:{
            hLineColor:()=>"#dc2626",
            vLineColor:()=>"#dc2626",
            hLineWidth:()=>.8,
            vLineWidth:()=>.8,
            paddingLeft:()=>0,
            paddingRight:()=>0,
            paddingTop:()=>0,
            paddingBottom:()=>0,
          },
          margin:[0,28,0,12],
        },
        {
          stack:[
            {
              text:"DOĞRU CEVAPLAR VE ÖĞRENCİ CEVAPLARI",
              fontSize:10,
              bold:true,
              color:navy,
              alignment:"center",
              characterSpacing:.7,
              margin:[0,0,0,10],
            },
            ...Array.from(
              {length:Math.ceil(subjects.length/2)},
              (_,rowIndex)=>{
                const leftSubject=subjects[rowIndex*2];
                const rightSubject=subjects[rowIndex*2+1];

                const buildSubjectAnswerBlock=(subject:any)=>({
                  width:"49%",
                  stack:[
                    {
                      text:subject?.name||"-",
                      fontSize:8,
                      bold:true,
                      color:navy,
                      alignment:"left",
                      margin:[0,0,0,5],
                    },
                    ...Array.from(
                      {length:Math.max(1,Math.ceil((subject?.questions?.length||0)/10))},
                      (_,questionRowIndex)=>({
                        columns:Array.from({length:10},(_,columnIndex)=>{
                          const questionIndex=questionRowIndex*10+columnIndex;
                          const question=subject?.questions?.[questionIndex];

                          if(!question){
                            return{width:"*",text:""};
                          }

                          const rawStudentAnswer=
                            question.studentAnswer??
                            question.givenAnswer??
                            question.response??
                            question.selectedAnswer??
                            question.selectedOption??
                            question.studentChoice??
                            question.markedAnswer??
                            question.markedOption??
                            question.choice??
                            question.userAnswer??
                            "";

                          const rawCorrectAnswer=
                            question.correctAnswer??
                            question.answerKey??
                            question.key??
                            question.correctOption??
                            question.answer??
                            "";

                          const studentAnswer=String(rawStudentAnswer||"").trim();
                          const correctAnswer=String(rawCorrectAnswer||"").trim();

                          const isEmpty=Boolean(
                            question.isEmpty||
                            question.blank||
                            !studentAnswer
                          );

                          const isCorrect=Boolean(
                            question.isCorrect??
                            question.correct??
                            (
                              studentAnswer&&
                              correctAnswer&&
                              studentAnswer.toLocaleUpperCase("tr-TR")===
                              correctAnswer.toLocaleUpperCase("tr-TR")
                            )
                          );

                          const questionNo=question.originalIndex!=null
                            ? Number(question.originalIndex)+1
                            : question.qNum??
                              question.questionNumber??
                              questionIndex+1;

                          const shownCorrect=correctAnswer
                            ? correctAnswer.toLocaleUpperCase("tr-TR")
                            : "-";
                          const shownStudent=isEmpty
                            ? "-"
                            : studentAnswer.toLocaleUpperCase("tr-TR");

                          return{
                            width:"*",
                            stack:[
                              {text:String(questionNo),fontSize:4.8,color:muted,alignment:"center"},
                              {
                                text:[
                                  {text:"D: ",color:navy,bold:true},
                                  {text:shownCorrect,color:navy,bold:true},
                                ],
                                fontSize:6.9,
                                alignment:"center",
                                margin:[0,2,0,0],
                              },
                              {
                                text:[
                                  {text:"Ö: ",color:isCorrect||isEmpty?"#111827":"#dc2626",bold:true},
                                  {text:shownStudent,color:isCorrect||isEmpty?"#111827":"#dc2626",bold:true},
                                ],
                                fontSize:6.9,
                                alignment:"center",
                                margin:[0,1,0,0],
                              },
                            ],
                            margin:[1,0,1,4],
                          };
                        }),
                        columnGap:2,
                        margin:[0,0,0,3],
                      })
                    ),
                  ],
                });

                return{
                  columns:[
                    buildSubjectAnswerBlock(leftSubject),
                    rightSubject
                      ? buildSubjectAnswerBlock(rightSubject)
                      : {width:"49%",text:""},
                  ],
                  columnGap:18,
                  margin:[0,0,0,10],
                };
              }
            ),
          ],
          margin:[12,0,12,12],
        },
        {
          columns:[
            {
              width:"*",
              text:"",
              fontSize:6.5,
              color:muted,
            },
            {
              width:150,
              text:"",
              fontSize:6.5,
              bold:true,
              color:navy,
              alignment:"right",
            },
          ],
        },
      );
    });

    const definition:any={
      pageSize:"A4",
      pageOrientation:"portrait",
      pageMargins:[24,22,24,22],
      content,
      defaultStyle:{fontSize:7.5,color:slate},
      footer:(page:number,pages:number)=>({
        columns:[
          {text:`${examName} • Bireysel Sınav Karnesi`,fontSize:6,color:muted,margin:[24,0,0,0]},
          {text:`Sayfa ${page} / ${pages}`,fontSize:6,color:muted,alignment:"right",margin:[0,0,24,0]},
        ],
      }),
    };

    const studentName=reportStudents[0]?.studentName||"ogrenci";
    return await PdfEngine.generate(
      definition,
      {
        mode:"blob",
        filename:`${examName}-${studentName}-bireysel-sinav-karnesi.pdf`,
      },
    ) as Blob;
  }