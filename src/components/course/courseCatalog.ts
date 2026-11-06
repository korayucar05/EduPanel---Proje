import type { Teacher } from "../../types";

export const formatCourseNameTitleCase = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const first = word.charAt(0).toLocaleUpperCase("tr-TR");
      return `${first}${word.slice(1)}`;
    })
    .join(" ");

export const COMPULSORY_COURSES = {
  "9. Sınıf": [
    { name: "Türk Dili ve Edebiyatı", hours: 5 },
    { name: "Din Kültürü ve Ahlak Bilgisi", hours: 2 },
    { name: "Tarih", hours: 2 },
    { name: "Coğrafya", hours: 2 },
    { name: "Matematik", hours: 6 },
    { name: "Fizik", hours: 2 },
    { name: "Kimya", hours: 2 },
    { name: "Biyoloji", hours: 2 },
    { name: "Birinci Yabancı Dil", hours: 4 },
    { name: "Beden Eğitimi ve Spor", hours: 2 },
    { name: "Görsel Sanatlar", hours: 2, parallelCourseGroup: "gorsel-muzik" },
    { name: "Müzik", hours: 2, parallelCourseGroup: "gorsel-muzik" },
    { name: "Sağlık Bilgisi ve Trafik Kültürü", hours: 1 },
    { name: "Rehberlik", hours: 1 },
  ],
  "10. Sınıf": [
    { name: "Türk Dili ve Edebiyatı", hours: 5 },
    { name: "Din Kültürü ve Ahlak Bilgisi", hours: 2 },
    { name: "Tarih", hours: 2 },
    { name: "Coğrafya", hours: 2 },
    { name: "Matematik", hours: 6 },
    { name: "Fizik", hours: 2 },
    { name: "Kimya", hours: 2 },
    { name: "Biyoloji", hours: 2 },
    { name: "Felsefe", hours: 2 },
    { name: "Birinci Yabancı Dil", hours: 4 },
    { name: "Beden Eğitimi ve Spor", hours: 2 },
    { name: "Görsel Sanatlar", hours: 2, parallelCourseGroup: "gorsel-muzik" },
    { name: "Müzik", hours: 2, parallelCourseGroup: "gorsel-muzik" },
    { name: "Rehberlik", hours: 1 },
  ],
  "11. Sınıf": [
    { name: "Türk Dili ve Edebiyatı", hours: 5 },
    { name: "Din Kültürü ve Ahlak Bilgisi", hours: 2 },
    { name: "Tarih", hours: 2 },
    { name: "Felsefe", hours: 2 },
    { name: "Birinci Yabancı Dil", hours: 4 },
    { name: "Beden Eğitimi ve Spor", hours: 2 },
    { name: "Görsel Sanatlar", hours: 2, parallelCourseGroup: "gorsel-muzik" },
    { name: "Müzik", hours: 2, parallelCourseGroup: "gorsel-muzik" },
    { name: "Rehberlik", hours: 1 },
  ],
  "12. Sınıf": [
    { name: "Türk Dili ve Edebiyatı", hours: 5 },
    { name: "Din Kültürü ve Ahlak Bilgisi", hours: 2 },
    { name: "T.C. İnkılap Tarihi ve Atatürkçülük", hours: 2 },
    { name: "Birinci Yabancı Dil", hours: 4 },
    { name: "Beden Eğitimi ve Spor", hours: 2 },
    { name: "Görsel Sanatlar", hours: 2, parallelCourseGroup: "gorsel-muzik" },
    { name: "Müzik", hours: 2, parallelCourseGroup: "gorsel-muzik" },
    { name: "Rehberlik", hours: 1 },
  ],
};

const UNFORMATTED_ELECTIVE_COURSES_POOL = [
  // AKADEMİK ÇALIŞMALAR
  {
    id: "el-1",
    name: "SEÇMELİ MATEMATİK",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [6], "12. Sınıf": [6] },
  },
  {
    id: "el-2",
    name: "TEMEL MATEMATİK",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [2], "12. Sınıf": [2] },
  },
  {
    id: "el-3",
    name: "SEÇMELİ FİZİK",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [4], "12. Sınıf": [4] },
  },
  {
    id: "el-4",
    name: "SEÇMELİ KİMYA",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [4], "12. Sınıf": [4] },
  },
  {
    id: "el-5",
    name: "SEÇMELİ BİYOLOJİ",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [4], "12. Sınıf": [4] },
  },
  {
    id: "el-6",
    name: "SEÇMELİ TÜRK DİLİ VE EDEBİYATI",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [3, 5], "12. Sınıf": [3, 5] },
  },
  {
    id: "el-7",
    name: "SEÇMELİ TARİH",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [2, 4], "12. Sınıf": [2, 4] },
  },
  {
    id: "el-8",
    name: "ÇAĞDAŞ TÜRK VE DÜNYA TARİHİ",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "12. Sınıf": [2] },
  },
  {
    id: "el-9",
    name: "SEÇMELİ COĞRAFYA",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [2, 4], "12. Sınıf": [2, 4] },
  },
  {
    id: "el-10",
    name: "PSİKOLOJİ",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [2], "12. Sınıf": [2] },
  },
  {
    id: "el-11",
    name: "SOSYOLOJİ",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [2], "12. Sınıf": [2] },
  },
  {
    id: "el-12",
    name: "MANTIK",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [2], "12. Sınıf": [2] },
  },
  {
    id: "el-13",
    name: "SEÇMELİ BİRİNCİ YABANCI DİL",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "11. Sınıf": [2, 10, 12], "12. Sınıf": [2, 10, 12] },
  },
  {
    id: "el-14",
    name: "HEDEF TEMELLİ DESTEK EĞİTİMİ",
    category: "AKADEMİK ÇALIŞMALAR",
    hoursMap: { "12. Sınıf": [3, 4, 5, 6] },
  },

  // İNSAN, TOPLUM VE BİLİM
  {
    id: "el-15",
    name: "FEN BİLİMLERİ UYGULAMALARI",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "11. Sınıf": [2, 3], "12. Sınıf": [2, 3] },
  },
  {
    id: "el-16",
    name: "MATEMATİK UYGULAMALARI",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "11. Sınıf": [2, 3], "12. Sınıf": [2, 3] },
  },
  {
    id: "el-17",
    name: "ASTRONOMİ VE UZAY BİLİMLERİ",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: {
      "9. Sınıf": [1, 2],
      "10. Sınıf": [1, 2],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
  {
    id: "el-18",
    name: "SOSYAL BİLİM ÇALIŞMALARI",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: {
      "9. Sınıf": [2, 3],
      "10. Sınıf": [2, 3],
      "11. Sınıf": [2, 3],
      "12. Sınıf": [2, 3],
    },
  },
  {
    id: "el-19",
    name: "BİLİŞİM TEKNOLOJİLERİ",
    category: "İNSAN, TOPLUM VE BİLİM",
    parallelCourseGroup: "bilisim-almanca",
    hoursMap: {
      "9. Sınıf": [1],
      "10. Sınıf": [1, 2, 3],
      "11. Sınıf": [1, 2, 3],
      "12. Sınıf": [1, 2, 3],
    },
  },
  {
    id: "el-20",
    name: "PROJE UYGULAMALARI",
    category: "İNSAN, TOPLUM VE BİLİM",
    parallelCourseGroup: "proje-iklim",
    hoursMap: {
      "9. Sınıf": [2, 3, 4],
      "10. Sınıf": [2, 3, 4],
      "11. Sınıf": [2, 3, 4],
      "12. Sınıf": [2, 3, 4],
    },
  },
  {
    id: "el-21",
    name: "DÜŞÜNME EĞİTİMİ",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "9. Sınıf": [1, 2], "10. Sınıf": [1, 2] },
  },
  {
    id: "el-22",
    name: "DEMOKRASİ VE İNSAN HAKLARI",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: {
      "9. Sınıf": [1, 2],
      "10. Sınıf": [2],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
  {
    id: "el-23",
    name: "SÜRDÜRÜLEBİLİR TARIM VE GIDA GÜVENLİĞİ",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "10. Sınıf": [1, 2], "11. Sınıf": [1, 2] },
  },
  {
    id: "el-24",
    name: "İKLİM VE ÇEVRE",
    category: "İNSAN, TOPLUM VE BİLİM",
    parallelCourseGroup: "proje-iklim",
    hoursMap: { "10. Sınıf": [1, 2], "11. Sınıf": [1, 2] },
  },
  {
    id: "el-25",
    name: "TEMEL HUKUK BİLGİSİ",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "10. Sınıf": [1, 2], "11. Sınıf": [1, 2], "12. Sınıf": [1, 2] },
  },
  {
    id: "el-26",
    name: "GİRİŞİMCİLİK",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "11. Sınıf": [1, 2], "12. Sınıf": [1, 2] },
  },
  {
    id: "el-27",
    name: "METİN TAHLİLLERİ",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "9. Sınıf": [1, 2], "10. Sınıf": [1, 2], "11. Sınıf": [1, 2] },
  },
  {
    id: "el-28",
    name: "SEÇMELİ İKİNCİ YABANCI DİL",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: {
      "9. Sınıf": [1, 2, 4],
      "10. Sınıf": [1, 2, 4],
      "11. Sınıf": [1, 2, 4],
      "12. Sınıf": [1, 2, 4],
    },
  },
  {
    id: "el-28-almanca",
    name: "SEÇMELİ ALMANCA",
    category: "İNSAN, TOPLUM VE BİLİM",
    parallelCourseGroup: "bilisim-almanca",
    hoursMap: {
      "9. Sınıf": [1, 2, 4],
      "10. Sınıf": [1, 2, 4],
      "11. Sınıf": [1, 2, 4],
      "12. Sınıf": [1, 2, 4],
    },
  },
  {
    id: "el-29",
    name: "OSMANLI TÜRKÇESİ",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: {
      "9. Sınıf": [2],
      "10. Sınıf": [2],
      "11. Sınıf": [2],
      "12. Sınıf": [2],
    },
  },
  {
    id: "el-30",
    name: "TÜRK DÜNYASI COĞRAFYASI",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "10. Sınıf": [1, 2], "11. Sınıf": [1, 2] },
  },
  {
    id: "el-31",
    name: "ORTAK TÜRK EDEBİYATI",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "10. Sınıf": [1, 2], "11. Sınıf": [1, 2] },
  },
  {
    id: "el-32",
    name: "ORTAK TÜRK TARİHİ",
    category: "İNSAN, TOPLUM VE BİLİM",
    hoursMap: { "10. Sınıf": [1, 2], "11. Sınıf": [1, 2] },
  },

  // DİN, AHLAK VE DEĞER
  {
    id: "el-33",
    name: "KUR'AN-I KERİM",
    category: "DİN, AHLAK VE DEĞER",
    parallelCourseGroup: "quran-peygamber",
    hoursMap: {
      "9. Sınıf": [2],
      "10. Sınıf": [2],
      "11. Sınıf": [2],
      "12. Sınıf": [2],
    },
  },
  {
    id: "el-34",
    name: "KUR'AN-I KERİM'İN ANLAM DÜNYASI",
    category: "DİN, AHLAK VE DEĞER",
    hoursMap: { "11. Sınıf": [2], "12. Sınıf": [2] },
  },
  {
    id: "el-35",
    name: "PEYGAMBERİMİZİN HAYATI",
    category: "DİN, AHLAK VE DEĞER",
    parallelCourseGroup: "quran-peygamber",
    hoursMap: {
      "9. Sınıf": [1, 2],
      "10. Sınıf": [1, 2],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
  {
    id: "el-36",
    name: "TEMEL DİNİ BİLGİLER",
    category: "DİN, AHLAK VE DEĞER",
    hoursMap: {
      "9. Sınıf": [1, 2],
      "10. Sınıf": [1, 2],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
  {
    id: "el-37",
    name: "TÜRK DÜŞÜNCE TARİHİ",
    category: "DİN, AHLAK VE DEĞER",
    hoursMap: { "10. Sınıf": [1, 2], "11. Sınıf": [1, 2], "12. Sınıf": [1, 2] },
  },
  {
    id: "el-38",
    name: "KLASİK AHLAK METİNLERİ",
    category: "DİN, AHLAK VE DEĞER",
    hoursMap: {
      "9. Sınıf": [1, 2],
      "10. Sınıf": [1, 2],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },

  // KÜLTÜR, SANAT VE SPOR
  {
    id: "el-39",
    name: "ADABIMUAŞERET",
    category: "KÜLTÜR, SANAT VE SPOR",
    hoursMap: { "9. Sınıf": [1], "10. Sınıf": [1] },
  },
  {
    id: "el-40",
    name: "TÜRK SOSYAL HAYATINDA AİLE",
    category: "KÜLTÜR, SANAT VE SPOR",
    hoursMap: {
      "9. Sınıf": [1, 2],
      "10. Sınıf": [1, 2],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
  {
    id: "el-41",
    name: "İSLAM BİLİM TARİHİ",
    category: "KÜLTÜR, SANAT VE SPOR",
    hoursMap: {
      "9. Sınıf": [1, 2],
      "10. Sınıf": [1, 2],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
  {
    id: "el-42",
    name: "TÜRK KÜLTÜR VE MEDENİYET TARİHİ",
    category: "KÜLTÜR, SANAT VE SPOR",
    hoursMap: {
      "9. Sınıf": [2],
      "10. Sınıf": [2],
      "11. Sınıf": [2],
      "12. Sınıf": [2],
    },
  },
  {
    id: "el-43",
    name: "İSLAM KÜLTÜR VE MEDENİYETI",
    category: "KÜLTÜR, SANAT VE SPOR",
    hoursMap: {
      "9. Sınıf": [1, 2],
      "10. Sınıf": [1, 2],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
  {
    id: "el-44",
    name: "SPOR EĞİTİMİ",
    category: "KÜLTÜR, SANAT VE SPOR",
    hoursMap: {
      "9. Sınıf": [1, 2, 3],
      "10. Sınıf": [1, 2, 3],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
  {
    id: "el-45-muze",
    name: "SANAT EĞİTİMİ (MÜZE)",
    category: "KÜLTÜR, SANAT VE SPOR",
    parallelCourseGroup: "sanat-egitimi",
    hoursMap: {
      "9. Sınıf": [1, 2, 3],
      "10. Sınıf": [1, 2, 3],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
  {
    id: "el-45-drama",
    name: "SANAT EĞİTİMİ (DRAMA)",
    category: "KÜLTÜR, SANAT VE SPOR",
    parallelCourseGroup: "sanat-egitimi",
    hoursMap: {
      "9. Sınıf": [1, 2, 3],
      "10. Sınıf": [1, 2, 3],
      "11. Sınıf": [1, 2],
      "12. Sınıf": [1, 2],
    },
  },
];

export const titleCaseTurkish = (str: string): string => {
  if (!str) return "";
  const turkishLower = str.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
  return turkishLower
    .split(/\s+/)
    .map((word) => {
      if (!word) return "";
      const f = word.charAt(0);
      const r = word.slice(1);
      const upperF = f === "i" ? "İ" : f === "ı" ? "I" : f.toUpperCase();
      return upperF + r;
    })
    .join(" ");
};

export const ELECTIVE_COURSES_POOL = UNFORMATTED_ELECTIVE_COURSES_POOL.map((item) => ({
  ...item,
  name: titleCaseTurkish(item.name),
}));

export const isSameCourseName = (name1: string | undefined | null, name2: string | undefined | null): boolean => {
  if (!name1 || !name2 || typeof name1 !== "string" || typeof name2 !== "string") return false;
  const normalize = (str: string) => {
    if (!str || typeof str !== 'string') return "";
    return str
      .replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "")
      .replace(/İ/g, "I")
      .replace(/i/g, "I")
      .replace(/ı/g, "I")
      .replace(/I/g, "I")
      .replace(/Ğ/g, "G")
      .replace(/ğ/g, "G")
      .replace(/Ü/g, "U")
      .replace(/ü/g, "U")
      .replace(/Ş/g, "S")
      .replace(/ş/g, "S")
      .replace(/Ö/g, "O")
      .replace(/ö/g, "O")
      .replace(/Ç/g, "C")
      .replace(/ç/g, "C")
      .toUpperCase()
      .trim()
      .replace(/\s+/g, " ");
  };
  return normalize(name1) === normalize(name2);
};

export const findMatchingTeacher = (
  _courseName: string,
  _teachers: Teacher[],
): { id: string; name: string } => {
  // Öğretmen atamaları yalnızca yönetici tarafından yapılır.
  // Ders adına veya öğretmen branşına göre otomatik atama kesinlikle yapılmaz.
  return { id: "", name: "Belirtilmedi" };
};


export const getCourseRank = (type: string, groupName: string = "") => {
  if (type === "Zorunlu Ders" || type === "compulsory") return 0;
  if (!groupName || groupName.trim() === "") return 1;
  if (groupName.includes("SAY")) return 2;
  if (groupName.includes("EA")) return 3;
  if (groupName.includes("SÖZ")) return 4;
  if (groupName.includes("DİL")) return 5;
  return 6;
};

export const getCourseColors = (type: string, groupName: string = "") => {
  const isCompulsory = type === "Zorunlu Ders" || type === "compulsory";
  if (isCompulsory) {
    return { bg: "bg-emerald-50/70 border-emerald-100/80", text: "text-emerald-800", badge: "bg-emerald-100 text-emerald-700" };
  }
  
  if (!groupName || groupName.trim() === "") {
    return { bg: "bg-amber-50/60 border-amber-100/80", text: "text-amber-800", badge: "bg-amber-100 text-amber-700" };
  }
  
  if (groupName.includes("SAY")) {
    return { bg: "bg-rose-50/70 border-rose-100/80", text: "text-rose-800", badge: "bg-rose-100 text-rose-700" };
  }
  
  if (groupName.includes("EA")) {
    return { bg: "bg-blue-50/70 border-blue-100/80", text: "text-blue-800", badge: "bg-blue-100 text-blue-700" };
  }

  if (groupName.includes("SÖZ")) {
    return { bg: "bg-orange-50/70 border-orange-100/80", text: "text-orange-800", badge: "bg-orange-100 text-orange-700" };
  }

  if (groupName.includes("DİL")) {
    return { bg: "bg-fuchsia-50/70 border-fuchsia-100/80", text: "text-fuchsia-800", badge: "bg-fuchsia-100 text-fuchsia-700" };
  }

  return { bg: "bg-amber-50/60 border-amber-100/80", text: "text-amber-800", badge: "bg-amber-100 text-amber-700" };
};

const TEACHER_ASSIGNMENT_COURSE_COLORS = [
  "border-blue-300 bg-blue-50 hover:border-blue-500",
  "border-violet-300 bg-violet-50 hover:border-violet-500",
  "border-amber-300 bg-amber-50 hover:border-amber-500",
  "border-cyan-300 bg-cyan-50 hover:border-cyan-500",
  "border-fuchsia-300 bg-fuchsia-50 hover:border-fuchsia-500",
  "border-orange-300 bg-orange-50 hover:border-orange-500",
  "border-teal-300 bg-teal-50 hover:border-teal-500",
  "border-pink-300 bg-pink-50 hover:border-pink-500",
];

export const getTeacherAssignmentCourseColor = (
  courseName: string,
  orderedCourseNames: string[],
) => {
  const colorIndex = Math.max(0, orderedCourseNames.indexOf(courseName)) %
    TEACHER_ASSIGNMENT_COURSE_COLORS.length;
  return TEACHER_ASSIGNMENT_COURSE_COLORS[colorIndex];
};

