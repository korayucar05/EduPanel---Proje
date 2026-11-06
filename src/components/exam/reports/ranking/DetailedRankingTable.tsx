import React from "react";

function DetailedRankingTable({rows,subjects,rankingMode,onSelect,selectedId,density="compact",showHeatmap=true,zoom=85}:{rows:any[];subjects:string[];rankingMode:"institution"|"classroom"|"subject";onSelect?:(student:any)=>void;selectedId?:string|null;density?:"compact"|"comfortable";showHeatmap?:boolean;zoom?:70|85|100}){
  const subjectRankLabel=rankingMode==="classroom"?"Şube":"Kurum";
  const subjectColumnWidth=52;
  const totalWidths=[58,58,58,72,78,68,72,68] as const;
  const totalLabels=["Top. D","Top. Y","Top. B","Top. Net","Puan","Şube","Kurum","Genel"] as const;
  const totalRightOffsets=totalWidths.map((_,index)=>totalWidths.slice(index+1).reduce((sum,width)=>sum+width,0));
  const totalBlockWidth=totalWidths.reduce((sum,width)=>sum+width,0);
  const minWidth=368+subjects.length*subjectColumnWidth*5+totalBlockWidth;
  const cellPadding=density==="compact"?"py-1.5":"py-2.5";
  const bodyText=density==="compact"?"text-[8px]":"text-[9px]";
  const average=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
  const subjectAverages=subjects.map((subjectName,index)=>({
    name:subjectName,
    correct:average(rows.map(row=>Number(row.subjects?.[index]?.correct||0))),
    wrong:average(rows.map(row=>Number(row.subjects?.[index]?.wrong||0))),
    empty:average(rows.map(row=>Number(row.subjects?.[index]?.empty||0))),
    net:average(rows.map(row=>Number(row.subjects?.[index]?.net||0))),
  }));
  const totalsAverage={
    correct:average(rows.map(row=>Number(row.totalCorrect||0))),
    wrong:average(rows.map(row=>Number(row.totalWrong||0))),
    empty:average(rows.map(row=>Number(row.totalEmpty||0))),
    net:average(rows.map(row=>Number(row.totalNet||0))),
    score:average(rows.map(row=>Number(row.score||0))),
  };
  const netTone=(net:number,totalQuestions:number)=>{
    if(!showHeatmap||!totalQuestions)return"";
    const success=Math.max(0,Math.min(100,net/totalQuestions*100));
    if(success>=80)return"bg-emerald-100 text-emerald-900";
    if(success>=60)return"bg-lime-100 text-lime-900";
    if(success>=40)return"bg-amber-100 text-amber-900";
    return"bg-rose-100 text-rose-900";
  };
  const rankTone=(rank:number)=>rank===1
    ?"bg-amber-400 text-amber-950"
    :rank===2
      ?"bg-slate-300 text-slate-800"
      :rank===3
        ?"bg-orange-200 text-orange-900"
        :rank<=10
          ?"bg-emerald-100 text-emerald-800"
          :rank<=50
            ?"bg-blue-100 text-blue-800"
            :rank<=100
              ?"bg-amber-100 text-amber-800"
              :"bg-slate-100 text-slate-600";
  const stickyTotalStyle=(index:number):React.CSSProperties=>({
    right:totalRightOffsets[index],
    width:totalWidths[index],
    minWidth:totalWidths[index],
    maxWidth:totalWidths[index],
  });
  const totalValues=(student:any)=>[
    student.totalCorrect,
    student.totalWrong,
    student.totalEmpty,
    student.totalNet.toFixed(2),
    student.score.toFixed(2),
    student.classroomRank,
    student.institutionRank,
    student.generalRank,
  ];
  const averageValues=[
    totalsAverage.correct.toFixed(1),
    totalsAverage.wrong.toFixed(1),
    totalsAverage.empty.toFixed(1),
    totalsAverage.net.toFixed(2),
    totalsAverage.score.toFixed(2),
    "—","—","—",
  ];
  const statusTone=(status:any)=>status?.tone==="rose"
    ?"border-rose-200 bg-rose-50 text-rose-700"
    :status?.tone==="amber"
      ?"border-amber-200 bg-amber-50 text-amber-700"
      :status?.tone==="blue"
        ?"border-blue-200 bg-blue-50 text-blue-700"
        :"border-emerald-200 bg-emerald-50 text-emerald-700";
  const statusDot=(status:any)=>status?.tone==="rose"
    ?"bg-rose-500"
    :status?.tone==="amber"
      ?"bg-amber-500"
      :status?.tone==="blue"
        ?"bg-blue-500"
        :"bg-emerald-500";
  const totalTextTone=(index:number)=>index===0
    ?"text-emerald-700"
    :index===1
      ?"text-rose-700"
      :index===2
        ?"text-slate-500"
        :index===3
          ?"text-blue-900"
          :index===4
            ?"text-violet-800"
            :index===7
              ?"text-rose-800"
              :"text-slate-900";

  return <table className="w-full origin-top-left border-separate border-spacing-0 text-left" style={{minWidth,zoom:zoom/100}}>
    <colgroup>
      <col style={{width:48}}/><col style={{width:64}}/><col style={{width:176}}/><col style={{width:80}}/>
      {subjects.flatMap(subject=>Array.from({length:5},(_,index)=><col key={`${subject}-${index}`} style={{width:subjectColumnWidth}}/>))}
      {totalWidths.map((width,index)=><col key={`total-${index}`} style={{width}}/>)}
    </colgroup>
    <thead className="sticky top-0 z-30 text-white shadow-md">
      <tr className="bg-slate-950 text-[8px] font-black uppercase tracking-[.04em]">
        <th rowSpan={2} className="sticky left-0 z-50 w-12 border-b border-r border-slate-700 bg-slate-950 px-2 py-2 text-center">Sıra</th>
        <th rowSpan={2} className="sticky left-12 z-50 w-16 border-b border-r border-slate-700 bg-slate-950 px-2 py-2 text-center">No</th>
        <th rowSpan={2} className="sticky left-28 z-50 w-44 border-b border-r border-slate-700 bg-slate-950 px-3 py-2">Öğrenci</th>
        <th rowSpan={2} className="sticky left-72 z-50 w-20 border-b border-r-2 border-slate-500 bg-slate-950 px-2 py-2 text-center shadow-[8px_0_12px_-10px_rgba(15,23,42,.9)]">Şube</th>
        {subjects.map(subject=><th key={subject} colSpan={5} className="border-b border-r-2 border-indigo-400 bg-indigo-800 px-2 py-2 text-center"><span className="block max-w-[250px] truncate" title={subject}>{subject}</span></th>)}
        <th colSpan={8} className="sticky right-0 z-50 border-b border-l-2 border-rose-300 bg-rose-800 px-2 py-2 text-center shadow-[-8px_0_12px_-10px_rgba(15,23,42,.9)]" style={{width:totalBlockWidth,minWidth:totalBlockWidth}}>Genel Sonuç</th>
      </tr>
      <tr className="bg-slate-800 text-[7px] font-black uppercase">
        {subjects.flatMap(subject=>[
          <th key={`${subject}-d`} className="border-b border-r border-slate-600 px-1 py-2 text-center">D</th>,
          <th key={`${subject}-y`} className="border-b border-r border-slate-600 px-1 py-2 text-center">Y</th>,
          <th key={`${subject}-b`} className="border-b border-r border-slate-600 px-1 py-2 text-center">B</th>,
          <th key={`${subject}-n`} className="border-b border-r border-slate-600 px-1 py-2 text-center">Net</th>,
          <th key={`${subject}-r`} className="border-b border-r-2 border-indigo-400 bg-indigo-950 px-1 py-2 text-center">{subjectRankLabel}</th>,
        ])}
        {totalLabels.map((label,index)=><th key={label} className={`sticky z-50 border-b border-r border-rose-700 bg-rose-900 px-1 py-2 text-center ${index===0?'border-l-2 border-l-rose-300 shadow-[-8px_0_12px_-10px_rgba(15,23,42,.9)]':''}`} style={stickyTotalStyle(index)}>{label}</th>)}
      </tr>
    </thead>
    <tbody>
      {rows.length>0&&<tr className="bg-cyan-50 text-[7px] font-black text-slate-700">
        <td className="sticky left-0 z-30 border-b border-r border-cyan-200 bg-cyan-50 px-2 py-2 text-center">Ort.</td>
        <td className="sticky left-12 z-30 border-b border-r border-cyan-200 bg-cyan-50 px-2 py-2 text-center">—</td>
        <td className="sticky left-28 z-30 border-b border-r border-cyan-200 bg-cyan-50 px-3 py-2">Gösterilen öğrenciler</td>
        <td className="sticky left-72 z-30 border-b border-r-2 border-cyan-300 bg-cyan-50 px-2 py-2 text-center shadow-[8px_0_12px_-10px_rgba(15,23,42,.7)]">{rows.length}</td>
        {subjectAverages.flatMap(subject=>[
          <td key={`${subject.name}-avg-d`} className="border-b border-r border-cyan-200 px-1 py-2 text-center text-emerald-800">{subject.correct.toFixed(1)}</td>,
          <td key={`${subject.name}-avg-y`} className="border-b border-r border-cyan-200 px-1 py-2 text-center text-rose-800">{subject.wrong.toFixed(1)}</td>,
          <td key={`${subject.name}-avg-b`} className="border-b border-r border-cyan-200 px-1 py-2 text-center text-slate-600">{subject.empty.toFixed(1)}</td>,
          <td key={`${subject.name}-avg-n`} className="border-b border-r border-cyan-200 px-1 py-2 text-center text-blue-900">{subject.net.toFixed(2)}</td>,
          <td key={`${subject.name}-avg-r`} className="border-b border-r-2 border-cyan-300 px-1 py-2 text-center">—</td>,
        ])}
        {averageValues.map((value,index)=><td key={`avg-total-${index}`} className={`sticky z-30 border-b border-r border-cyan-200 bg-cyan-50 px-1 py-2 text-center ${totalTextTone(index)} ${index===0?'border-l-2 border-l-cyan-300 shadow-[-8px_0_12px_-10px_rgba(15,23,42,.7)]':''}`} style={stickyTotalStyle(index)}>{value}</td>)}
      </tr>}
      {rows.map((student,index)=>{
        const stickyBackground=selectedId===student.id?'bg-indigo-50':index%2?'bg-slate-50':'bg-white';
        const totalBackground=selectedId===student.id?'bg-indigo-100':index%2?'bg-rose-50':'bg-white';
        return <tr key={`${student.id}-${student.institutionRank}`} onClick={()=>onSelect?.(student)} className={`${bodyText} transition ${onSelect?'cursor-pointer hover:bg-indigo-50':''} ${selectedId===student.id?'ring-2 ring-inset ring-indigo-500 bg-indigo-50':index%2?'bg-slate-50':'bg-white'}`}>
          <td className={`sticky left-0 z-20 border-b border-r border-slate-200 px-2 ${cellPadding} text-center font-black ${stickyBackground}`}><span className={`inline-flex min-w-7 items-center justify-center rounded-md px-1.5 py-1 ${rankTone(student.displayRank)}`}>{student.displayRank}</span></td>
          <td className={`sticky left-12 z-20 border-b border-r border-slate-200 px-2 ${cellPadding} text-center font-bold text-slate-500 ${stickyBackground}`}>{student.studentNumber}</td>
          <td className={`sticky left-28 z-20 max-w-44 border-b border-r border-slate-200 px-3 ${cellPadding} font-black text-slate-900 ${stickyBackground}`} title={`${student.studentName} · ${student.academicStatus?.label||""}`}><div className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(student.academicStatus)}`}/><div className="min-w-0"><span className="block truncate">{student.studentName}</span><span className={`mt-0.5 inline-flex rounded-full border px-1.5 py-0.5 text-[6px] font-black ${statusTone(student.academicStatus)}`}>{student.academicStatus?.shortLabel}</span></div></div></td>
          <td className={`sticky left-72 z-20 border-b border-r-2 border-slate-300 px-2 ${cellPadding} text-center font-black text-indigo-700 shadow-[8px_0_12px_-10px_rgba(15,23,42,.55)] ${stickyBackground}`}>{student.classroom}</td>
          {student.subjects.map((subject:any)=>[
            <td key={`${student.id}-${subject.name}-d`} className={`border-b border-r border-slate-200 px-1 ${cellPadding} text-center text-emerald-700`}>{subject.correct}</td>,
            <td key={`${student.id}-${subject.name}-y`} className={`border-b border-r border-slate-200 px-1 ${cellPadding} text-center text-rose-700`}>{subject.wrong}</td>,
            <td key={`${student.id}-${subject.name}-b`} className={`border-b border-r border-slate-200 px-1 ${cellPadding} text-center text-slate-500`}>{subject.empty}</td>,
            <td key={`${student.id}-${subject.name}-n`} className={`border-b border-r border-slate-200 px-1 ${cellPadding} text-center font-black ${netTone(subject.net,subject.totalQuestions)||"text-blue-800"}`}>{subject.net.toFixed(2)}</td>,
            <td key={`${student.id}-${subject.name}-r`} className={`border-b border-r-2 border-indigo-200 bg-indigo-50/40 px-1 ${cellPadding} text-center font-black text-indigo-800`}>{rankingMode==="classroom"?subject.classroomRank:subject.institutionRank}</td>,
          ])}
          {totalValues(student).map((value,totalIndex)=><td key={`${student.id}-total-${totalIndex}`} className={`sticky z-20 border-b border-r border-slate-200 px-1 ${cellPadding} text-center font-black ${totalTextTone(totalIndex)} ${totalBackground} ${totalIndex===0?'border-l-2 border-l-rose-200 shadow-[-8px_0_12px_-10px_rgba(15,23,42,.55)]':''}`} style={stickyTotalStyle(totalIndex)}>{value}</td>)}
        </tr>;
      })}
    </tbody>
  </table>;
}

export default DetailedRankingTable;
