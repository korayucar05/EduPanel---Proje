import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Printer, Search, ShieldCheck } from "lucide-react";
import type { Classroom, Student } from "../types";
import { compareClassroomNames } from "../utils/classroomSort";
import { sqliteStorage } from "../core/state/SyncStateStore";

interface Props {
  students: Student[];
  classrooms?: Classroom[];
  initialClassName?: string;
}

const normalize = (value: unknown) => String(value || "").trim().toLocaleUpperCase("tr-TR");
const first = (student: any, keys: string[]) => {
  for (const key of keys) {
    const value = String(student?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
};
const studentNo = (student: any) => first(student, ["number", "studentNumber", "schoolNo", "no", "id"]);
const photoOf = (student: any) => first(student, ["avatar", "photo", "photoUrl", "image", "profilePhoto"]);
const motherName = (student: any) => first(student, ["motherName", "anneAdi", "anneAdı", "mother", "anne"]);
const fatherName = (student: any) => first(student, ["fatherName", "babaAdi", "babaAdı", "father", "baba"]);
const motherPhone = (student: any) => first(student, ["motherPhone", "anneTelefon", "anneTelefonu", "anneTel", "motherMobile"]);
const fatherPhone = (student: any) => first(student, ["fatherPhone", "babaTelefon", "babaTelefonu", "babaTel", "fatherMobile"]);
const ownPhone = (student: any) => first(student, ["phone", "studentPhone", "mobile", "gsm", "cepTelefonu"]);
const guardianName = (student: any) => first(student, ["parentName", "guardianName", "veliAdi", "veliAdSoyad"]);
const guardianPhone = (student: any) => first(student, ["parentPhone", "guardianPhone", "veliTelefon", "veliTelefonu", "parentPhoneNumber"]);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const academicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() >= 8 ? year : year - 1;
  return `${start}-${start + 1}`;
};

const schoolNameFromStorage = () => {
  try {
    const raw = sqliteStorage.getItem("school_info_a_profile") || sqliteStorage.getItem("school_info") || "{}";
    const parsed = JSON.parse(raw);
    return String(parsed?.officialName || parsed?.schoolName || parsed?.name || "Ordu Lisesi").trim() || "Ordu Lisesi";
  } catch {
    return "Ordu Lisesi";
  }
};

export default function SchoolAlbumModule({ students, classrooms = [], initialClassName }: Props) {
  const classNames = useMemo(() => {
    const names = new Set<string>();
    classrooms.forEach((classroom) => classroom?.name && names.add(classroom.name));
    students.forEach((student) => student?.classroom && names.add(student.classroom));
    return [...names].sort(compareClassroomNames);
  }, [classrooms, students]);

  const [selectedClass, setSelectedClass] = useState(() => initialClassName || classNames[0] || "");
  const [search, setSearch] = useState("");
  const schoolName = schoolNameFromStorage();
  const schoolYear = academicYear();

  useEffect(() => {
    if (initialClassName && classNames.includes(initialClassName)) {
      setSelectedClass(initialClassName);
      return;
    }
    setSelectedClass((previous) =>
      previous && classNames.includes(previous) ? previous : (classNames[0] || ""),
    );
  }, [classNames, initialClassName]);

  const rowsForClass = (className: string) => students
    .filter((student) => normalize(student?.classroom) === normalize(className))
    .slice()
    .sort((a: any, b: any) => studentNo(a).localeCompare(studentNo(b), "tr", { numeric: true }) || String(a.name || "").localeCompare(String(b.name || ""), "tr"));

  const selectedStudents = useMemo(() => {
    const q = normalize(search);
    return rowsForClass(selectedClass).filter((student) => !q || normalize(`${studentNo(student)} ${student.name}`).includes(q));
  }, [students, selectedClass, search]);

  const renderPhoto = (student: Student) => {
    const photo = photoOf(student);
    if (photo) return <img src={photo} alt={student.name} className="h-20 w-16 shrink-0 rounded-xl border border-slate-200 object-cover bg-white" />;
    return <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-lg font-black text-slate-600">{initials(student.name || "Ö")}</div>;
  };

  const studentCard = (student: Student) => {
    const mName = motherName(student) || "—";
    const fName = fatherName(student) || "—";
    const mPhone = motherPhone(student) || "—";
    const fPhone = fatherPhone(student) || "—";
    const sPhone = ownPhone(student) || "—";
    const gName = guardianName(student);
    const gPhone = guardianPhone(student);
    return (
      <div key={student.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-3">
          {renderPhoto(student)}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-wide text-teal-700">No: {studentNo(student) || "—"}</div>
            <div className="mt-0.5 text-sm font-black leading-tight text-slate-900">{student.name}</div>
            <div className="mt-2 grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-[10px] leading-tight">
              <span className="font-black text-slate-400">Anne</span><span className="font-bold text-slate-700">{mName}</span>
              <span className="font-black text-slate-400">Anne Tel</span><span className="font-bold text-slate-700">{mPhone}</span>
              <span className="font-black text-slate-400">Baba</span><span className="font-bold text-slate-700">{fName}</span>
              <span className="font-black text-slate-400">Baba Tel</span><span className="font-bold text-slate-700">{fPhone}</span>
              <span className="font-black text-slate-400">Öğrenci Tel</span><span className="font-bold text-slate-700">{sPhone}</span>
              {gName && !motherName(student) && !fatherName(student) && <><span className="font-black text-slate-400">Veli</span><span className="font-bold text-slate-700">{gName}</span></>}
              {gPhone && !motherPhone(student) && !fatherPhone(student) && <><span className="font-black text-slate-400">Veli Tel</span><span className="font-bold text-slate-700">{gPhone}</span></>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const printBooklet = (scope: "class" | "school") => {
    const targetClasses = scope === "class" ? [selectedClass].filter(Boolean) : classNames;
    const popup = window.open("", "_blank", "width=1200,height=900");
    if (!popup) return;
    const pageSize = 12;
    const pages: string[] = [];

    if (scope === "school") {
      pages.push(`<section class="page cover"><div class="coverMark">HASAT / e-Nstitü</div><div class="coverSchool">${escapeHtml(schoolName.toLocaleUpperCase("tr-TR"))}</div><div class="coverTitle">OKUL ALBÜMÜ</div><div class="coverYear">${escapeHtml(schoolYear)} Eğitim Öğretim Yılı</div><div class="coverCount">${targetClasses.length} sınıf • ${students.filter((student) => targetClasses.includes(String(student.classroom || ""))).length} öğrenci</div><div class="coverNotice">YALNIZCA YETKİLİ OKUL PERSONELİ KULLANIMI İÇİNDİR</div></section>`);
    }

    targetClasses.forEach((className) => {
      const classRows = rowsForClass(className);
      const pageCount = Math.max(1, Math.ceil(classRows.length / pageSize));
      for (let page = 0; page < pageCount; page += 1) {
        const slice = classRows.slice(page * pageSize, page * pageSize + pageSize);
        const cards = slice.map((student) => {
          const photo = photoOf(student);
          const avatar = photo
            ? `<img class="photo" src="${escapeHtml(photo)}" alt="${escapeHtml(student.name)}">`
            : `<div class="photo fallback">${escapeHtml(initials(student.name || "Ö"))}</div>`;
          const fallbackGuardian = (!motherName(student) && !fatherName(student) && guardianName(student))
            ? `<div><b>Veli:</b> ${escapeHtml(guardianName(student))}</div>` : "";
          const fallbackGuardianPhone = (!motherPhone(student) && !fatherPhone(student) && guardianPhone(student))
            ? `<div><b>Veli Tel:</b> ${escapeHtml(guardianPhone(student))}</div>` : "";
          return `<div class="card"><div class="identity">${avatar}<div class="who"><div class="no">NO ${escapeHtml(studentNo(student) || "—")}</div><div class="name">${escapeHtml(student.name)}</div></div></div><div class="details"><div><b>Anne:</b> ${escapeHtml(motherName(student) || "—")}</div><div><b>Anne Tel:</b> ${escapeHtml(motherPhone(student) || "—")}</div><div><b>Baba:</b> ${escapeHtml(fatherName(student) || "—")}</div><div><b>Baba Tel:</b> ${escapeHtml(fatherPhone(student) || "—")}</div><div><b>Öğrenci Tel:</b> ${escapeHtml(ownPhone(student) || "—")}</div>${fallbackGuardian}${fallbackGuardianPhone}</div></div>`;
        }).join("");
        pages.push(`<section class="page"><header><div class="brand">HASAT / e-Nstitü<span>Okul Yönetim Sistemi</span></div><div class="title">${escapeHtml(schoolName.toLocaleUpperCase("tr-TR"))}<br><strong>${escapeHtml(className)} SINIFI OKUL ALBÜMÜ</strong><span>${escapeHtml(schoolYear)} Eğitim Öğretim Yılı</span></div><div class="pageNo">${page + 1} / ${pageCount}</div></header><div class="notice">KİŞİSEL VERİ İÇERİR • YALNIZCA YETKİLİ OKUL PERSONELİ KULLANIMI İÇİNDİR</div><div class="cards">${cards}</div><footer>${escapeHtml(className)} • ${classRows.length} öğrenci • ${escapeHtml(schoolName)} • HASAT Okul Albümü</footer></section>`);
      }
    });

    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Okul Albümü</title><style>@page{size:A4 portrait;margin:7mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:white}.page{height:283mm;page-break-after:always;display:flex;flex-direction:column;padding:0}.page:last-child{page-break-after:auto}header{display:grid;grid-template-columns:1fr 2fr 55px;align-items:center;border-bottom:3px solid #facc15;padding:2mm 1mm 3mm;gap:3mm}.brand{font-size:12px;font-weight:900;color:#0f766e}.brand span{display:block;font-size:8px;color:#64748b}.title{text-align:center;font-size:11px;line-height:1.25}.title strong{display:block;font-size:17px}.title span{display:block;margin-top:.6mm;font-size:7.5px;color:#64748b;font-weight:700}.pageNo{text-align:right;font-size:10px;font-weight:900;color:#475569}.cover{align-items:center;justify-content:center;text-align:center;border:1.2mm solid #0f766e;padding:18mm;background:linear-gradient(145deg,#f0fdfa,#ffffff 55%,#fffbeb)}.coverMark{font-size:18px;font-weight:900;color:#0f766e;letter-spacing:.5px}.coverSchool{margin-top:24mm;font-size:18px;font-weight:900;color:#334155}.coverTitle{margin-top:7mm;font-size:34px;font-weight:900;letter-spacing:1.2px;color:#0f172a}.coverYear{margin-top:4mm;font-size:14px;font-weight:800;color:#64748b}.coverCount{margin-top:28mm;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;padding:5mm 15mm;font-size:12px;font-weight:800;color:#334155}.coverNotice{margin-top:28mm;font-size:9px;font-weight:900;color:#9a3412;letter-spacing:.5px}.notice{margin:2.5mm 0;border:1px solid #fed7aa;background:#fff7ed;border-radius:2mm;padding:1.5mm 2mm;text-align:center;font-size:7px;font-weight:800;color:#9a3412;letter-spacing:.3px}.cards{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(4,1fr);gap:2.3mm;flex:1;min-height:0}.card{border:1px solid #cbd5e1;border-radius:2.5mm;padding:2mm;background:white;overflow:hidden}.identity{display:flex;gap:2mm;align-items:flex-start}.photo{width:18mm;height:23mm;object-fit:cover;border:1px solid #cbd5e1;border-radius:2mm;background:#e2e8f0}.fallback{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#475569}.who{min-width:0;flex:1}.no{font-size:7.5px;font-weight:900;color:#0f766e}.name{font-size:10px;font-weight:900;line-height:1.05;margin-top:.8mm}.details{margin-top:1.5mm;border-top:1px solid #e2e8f0;padding-top:1.2mm;font-size:7.4px;line-height:1.45;color:#334155}.details b{color:#64748b}footer{text-align:center;font-size:7px;color:#64748b;margin-top:2mm}</style></head><body>${pages.join("")}<script>window.onload=()=>setTimeout(()=>window.print(),350);</script></body></html>`);
    popup.document.close();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><BookOpen className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-slate-900">Okul Albümü</h2><p className="text-xs font-semibold text-slate-500">Öğrenci fotoğrafı ve aile iletişim bilgilerini sınıf sınıf A4 kitapçık düzeninde hazırlayın.</p></div></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => printBooklet("class")} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-black text-violet-800 hover:bg-violet-100"><Printer className="h-4 w-4" /> Seçili Sınıfı Yazdır</button><button type="button" onClick={() => printBooklet("school")} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-800"><Printer className="h-4 w-4" /> Tüm Okulu Kitapçık Yap</button></div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[220px_1fr]">
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800">{classNames.map((name) => <option key={name} value={name}>{name}</option>)}</select>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Öğrenci no veya ad soyad ara" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm font-semibold outline-none focus:border-violet-400" /></div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900"><ShieldCheck className="h-4 w-4 shrink-0" /> Bu bölüm kişisel iletişim bilgileri içerir. Çıktılar yalnızca yetkili okul personeli kullanımına yöneliktir.</div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 flex items-end justify-between border-b-4 border-amber-300 pb-3"><div><div className="text-sm font-black text-teal-700">HASAT / e-Nstitü</div><div className="text-[10px] font-bold text-slate-400">Okul Yönetim Sistemi</div></div><div className="text-center"><div className="text-xs font-black text-slate-500">{schoolName.toLocaleUpperCase("tr-TR")}</div><div className="text-lg font-black text-slate-900">{selectedClass || "SINIF"} OKUL ALBÜMÜ</div><div className="text-[10px] font-bold text-slate-400">{schoolYear} Eğitim Öğretim Yılı</div></div><div className="text-right text-xs font-black text-slate-500">{selectedStudents.length} öğrenci</div></div>
        <div className="grid gap-3 lg:grid-cols-3">{selectedStudents.map(studentCard)}</div>
        {selectedStudents.length === 0 && <div className="py-16 text-center text-sm font-bold text-slate-400">Bu sınıfta görüntülenecek öğrenci bulunamadı.</div>}
      </div>
    </div>
  );
}
