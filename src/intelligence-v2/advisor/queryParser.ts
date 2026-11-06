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

export type ParsedAdvisorQuery={
  normalized:string;
  intent:
    |"risk-class"
    |"risk-students"
    |"subject-risk"
    |"priority"
    |"school-summary"
    |"student-summary"
    |"unknown";
};

export function parseAdvisorQuery(query:string):ParsedAdvisorQuery{
  const q=normalize(query);

  if(
    q.includes("en riskli sinif")||
    q.includes("hangi sinif riskli")||
    q.includes("sinif riski")
  )return{normalized:q,intent:"risk-class"};

  if(
    q.includes("riskli ogrenci")||
    q.includes("müdahale gereken ogrenci")||
    q.includes("mudahale gereken ogrenci")||
    q.includes("acil ogrenci")
  )return{normalized:q,intent:"risk-students"};

  if(
    q.includes("hangi derste")||
    q.includes("ders riski")||
    q.includes("zorlanan ogrenci")||
    q.includes("matematik")||
    q.includes("turkce")||
    q.includes("fizik")||
    q.includes("kimya")||
    q.includes("biyoloji")||
    q.includes("tarih")||
    q.includes("cografya")
  )return{normalized:q,intent:"subject-risk"};

  if(
    q.includes("oncelik")||
    q.includes("bu hafta")||
    q.includes("ne yapmali")||
    q.includes("ne yapalim")
  )return{normalized:q,intent:"priority"};

  if(
    q.includes("okul durumu")||
    q.includes("kurum durumu")||
    q.includes("genel durum")||
    q.includes("ozet")
  )return{normalized:q,intent:"school-summary"};

  if(
    q.includes("ogrenci ozeti")||
    q.includes("bu ogrenci")||
    q.includes("ogrencinin durumu")
  )return{normalized:q,intent:"student-summary"};

  return{normalized:q,intent:"unknown"};
}

export function detectSubject(
  normalized:string,
  availableSubjects:string[],
){
  return availableSubjects.find(subject=>
    normalized.includes(normalize(subject))
  );
}
