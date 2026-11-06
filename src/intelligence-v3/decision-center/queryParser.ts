const normalize=(value:string)=>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ç]/g,"c")
    .replace(/[ğ]/g,"g")
    .replace(/[ı]/g,"i")
    .replace(/[ö]/g,"o")
    .replace(/[ş]/g,"s")
    .replace(/[ü]/g,"u")
    .replace(/\s+/g," ")
    .trim();

export function parseDecisionIntent(query:string){
  const q=normalize(query);

  if(q.includes("gunluk")||q.includes("bugun ne var")||q.includes("brifing"))
    return"daily-briefing" as const;
  if(q.includes("kritik")||q.includes("acil")||q.includes("en onemli"))
    return"critical-events" as const;
  if(q.includes("ne yap")||q.includes("oncelik")||q.includes("gorev"))
    return"priority-actions" as const;
  if(q.includes("okul saglik")||q.includes("genel durum")||q.includes("okul nasil"))
    return"school-health" as const;
  if(q.includes("devamsiz"))
    return"attendance" as const;
  if(q.includes("odev"))
    return"homework" as const;
  if(q.includes("rehber"))
    return"guidance" as const;
  if(q.includes("veli"))
    return"parent" as const;
  if(q.includes("sinif"))
    return"classroom" as const;

  return"unknown" as const;
}
