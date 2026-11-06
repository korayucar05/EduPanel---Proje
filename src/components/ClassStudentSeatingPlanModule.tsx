import React, { useEffect, useMemo, useState } from "react";
import { Camera, DoorOpen, LayoutGrid, LayoutTemplate, Monitor, Printer, RotateCcw, Search, UserPlus, UserRound, Users, X } from "lucide-react";
import type { Classroom, Student } from "../types";
import appStateService from "../core/state/AppStateService";
import { sqliteStorage } from "../core/state/SyncStateStore";
import { compareClassroomNames } from "../utils/classroomSort";
import { findSchoolLocationForClass, readSchoolBuildingCatalog } from "./schoolBuildingCatalog";
import type { RoomElement, RoomElementType } from "./schoolBuildingLayoutStore";

interface Props {
  students: Student[];
  classrooms?: Classroom[];
  initialClassName?: string;
}

type SeatAssignments = Record<string, string>;
type PhysicalLayout = {
  classroomId?: string;
  classroomName?: string;
  buildingId?: string;
  buildingName?: string;
  floorId?: string;
  floorName?: string;
  deskColumns?: 3 | 4;
  deskRows?: number;
  activeDesks?: boolean[];
  elements?: RoomElement[];
};

const normalize = (value: unknown) => String(value || "").trim().toLocaleUpperCase("tr-TR");
const studentNo = (student: any) => String(student?.number ?? student?.studentNumber ?? student?.schoolNo ?? student?.no ?? student?.id ?? "").trim();
const studentPhoto = (student: any) => String(student?.avatar || student?.photo || student?.photoUrl || student?.image || "").trim();
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const elementLabel: Record<RoomElementType, string> = {
  board: "YAZI TAHTASI",
  "teacher-desk": "ÖĞRETMEN MASASI",
  door: "KAPI",
  window: "PENCERE",
};

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

const normalizeLayoutDesks = (layout: PhysicalLayout, columns: 3 | 4, rows: number) => {
  const count = columns * rows;
  const source = Array.isArray(layout.activeDesks) ? layout.activeDesks : [];
  if (source.length >= 28 && columns === 3 && source.length !== count) {
    return Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / columns);
      const col = i % columns;
      return source[row * 4 + col] !== false;
    });
  }
  return Array.from({ length: count }, (_, index) => source[index] !== false);
};

function elementClass(type: RoomElementType) {
  if (type === "board") return "bg-slate-800 text-white border-slate-900";
  if (type === "teacher-desk") return "bg-amber-100 text-amber-950 border-amber-500";
  if (type === "door") return "bg-rose-100 text-rose-800 border-rose-400";
  return "bg-cyan-100 text-cyan-800 border-cyan-400";
}

function elementIcon(type: RoomElementType) {
  if (type === "board") return Monitor;
  if (type === "teacher-desk") return UserRound;
  if (type === "door") return DoorOpen;
  return LayoutGrid;
}

export default function ClassStudentSeatingPlanModule({ students, classrooms = [], initialClassName }: Props) {
  const buildingCatalog = useMemo(() => readSchoolBuildingCatalog(classrooms), [classrooms]);
  const classNames = useMemo(() => {
    const names = new Set<string>();
    buildingCatalog.classrooms.forEach((room) => room.name && names.add(room.name));
    if (!names.size) {
      classrooms.forEach((classroom) => classroom?.name && names.add(classroom.name));
      students.forEach((student) => student?.classroom && names.add(student.classroom));
    }
    return [...names].sort(compareClassroomNames);
  }, [buildingCatalog.classrooms, classrooms, students]);

  const [selectedClass, setSelectedClass] = useState("");
  const [legacyLayout, setLegacyLayout] = useState<PhysicalLayout>({});
  const [assignments, setAssignments] = useState<SeatAssignments>({});
  const [editingSeat, setEditingSeat] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [photoOverrides, setPhotoOverrides] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialClassName && classNames.includes(initialClassName)) {
      setSelectedClass(initialClassName);
      return;
    }
    setSelectedClass((previous) => previous && classNames.includes(previous) ? previous : (classNames[0] || ""));
  }, [classNames, initialClassName]);

  const selectedLocation = useMemo(
    () => findSchoolLocationForClass(buildingCatalog, selectedClass),
    [buildingCatalog, selectedClass],
  );
  const selectedClassRecord = useMemo(
    () => classrooms.find((classroom) => normalize(classroom?.id) === normalize(selectedLocation?.id) || normalize(classroom?.name) === normalize(selectedClass)),
    [classrooms, selectedClass, selectedLocation],
  );
  const selectedClassKey = String(selectedClassRecord?.id || selectedLocation?.id || selectedClass || "").trim();
  const assignmentStorageKey = selectedClassKey ? `student_seating_plan_${selectedClassKey}` : "";
  const layoutStorageKey = selectedClassKey ? `classroom_seating_layout_${selectedClassKey}` : "";

  useEffect(() => {
    let alive = true;
    if (!selectedClass) return;
    Promise.all([
      layoutStorageKey ? appStateService.getItem<PhysicalLayout>(layoutStorageKey) : Promise.resolve(null),
      appStateService.getItem<PhysicalLayout>(`seating_plan_${selectedClass}`),
      assignmentStorageKey ? appStateService.getItem<SeatAssignments>(assignmentStorageKey) : Promise.resolve(null),
      appStateService.getItem<SeatAssignments>(`student_seating_plan_${selectedClass}`),
    ]).then(([idLayout, oldLayout, idAssignments, oldAssignments]) => {
      if (!alive) return;
      setLegacyLayout(idLayout || oldLayout || {});
      setAssignments(idAssignments || oldAssignments || {});
      setMessage("");
    }).catch(() => {
      if (!alive) return;
      setLegacyLayout({});
      setAssignments({});
    });
    return () => { alive = false; };
  }, [selectedClass, assignmentStorageKey, layoutStorageKey]);

  const centralLayout = (selectedLocation?.raw && typeof selectedLocation.raw === "object") ? selectedLocation.raw as PhysicalLayout : null;
  const layout: PhysicalLayout = centralLayout?.deskColumns ? centralLayout : legacyLayout;
  const hasCentralLayout = Boolean(centralLayout?.deskColumns && centralLayout?.deskRows);

  const classStudents = useMemo(() => {
    const targetName = normalize(selectedClass);
    const targetId = normalize(selectedClassKey);
    return students
      .filter((student) => normalize(student?.classroom) === targetName || normalize(student?.classroomId || student?.classId) === targetId)
      .slice()
      .sort((a: any, b: any) => studentNo(a).localeCompare(studentNo(b), "tr", { numeric: true }) || String(a.name || "").localeCompare(String(b.name || ""), "tr"));
  }, [students, selectedClass, selectedClassKey]);

  useEffect(() => {
    const next: Record<string, string> = {};
    classStudents.forEach((student) => {
      try {
        const saved = sqliteStorage.getItem(`student_seating_photo_${student.id}`);
        if (saved) next[String(student.id)] = saved;
      } catch {}
    });
    setPhotoOverrides(next);
  }, [classStudents]);

  const effectivePhoto = (student?: Student) => student ? (photoOverrides[String(student.id)] || studentPhoto(student)) : "";
  const studentById = useMemo(() => new Map(classStudents.map((student) => [String(student.id), student])), [classStudents]);
  const columnCount: 3 | 4 = layout.deskColumns === 4 ? 4 : 3;
  const rowCount = Math.max(1, Math.min(10, Number(layout.deskRows || 7)));
  const activeDesks = useMemo(() => normalizeLayoutDesks(layout, columnCount, rowCount), [layout, columnCount, rowCount]);
  const orientation: "portrait" | "landscape" = columnCount >= 4 ? "landscape" : "portrait";
  const orientationLabel = orientation === "landscape" ? "Yatay" : "Dikey";
  const elements = Array.isArray(layout.elements) ? layout.elements : [];

  const activeSeatIds = useMemo(() => {
    const result: string[] = [];
    activeDesks.forEach((active, deskIndex) => {
      if (!active) return;
      result.push(`${deskIndex}-L`, `${deskIndex}-R`);
    });
    return result;
  }, [activeDesks]);

  useEffect(() => {
    if (!selectedClass) return;
    const validIds = new Set(classStudents.map((student) => String(student.id)));
    const validSeats = new Set(activeSeatIds);
    const cleaned: SeatAssignments = {};
    Object.entries(assignments).forEach(([seatId, studentId]) => {
      if (validSeats.has(seatId) && validIds.has(String(studentId))) cleaned[seatId] = String(studentId);
    });
    if (JSON.stringify(cleaned) !== JSON.stringify(assignments)) setAssignments(cleaned);
  }, [selectedClass, classStudents, activeSeatIds, assignments]);

  const saveAssignments = async (next: SeatAssignments, feedback = "Oturma planı kaydedildi.") => {
    setAssignments(next);
    if (!selectedClass) return;
    try {
      if (assignmentStorageKey) await appStateService.setItem(assignmentStorageKey, next);
      await appStateService.setItem(`student_seating_plan_${selectedClass}`, next);
      setMessage(feedback);
    } catch (error) {
      console.error("Oturma planı kaydedilemedi:", error);
      setMessage("Oturma planı kaydedilemedi.");
    }
  };

  const autoPlace = () => {
    const next: SeatAssignments = {};
    classStudents.slice(0, activeSeatIds.length).forEach((student, index) => { next[activeSeatIds[index]] = String(student.id); });
    void saveAssignments(next, `${Math.min(classStudents.length, activeSeatIds.length)} öğrenci otomatik yerleştirildi.`);
  };

  const clearPlan = () => void saveAssignments({}, "Öğrenci yerleşimi temizlendi.");

  const assignStudent = (seatId: string, studentId: string) => {
    const next = { ...assignments };
    Object.keys(next).forEach((key) => { if (next[key] === studentId) delete next[key]; });
    next[seatId] = studentId;
    setEditingSeat(null);
    setStudentSearch("");
    void saveAssignments(next, "Öğrenci sıraya yerleştirildi.");
  };

  const clearSeat = (seatId: string) => {
    const next = { ...assignments };
    delete next[seatId];
    setEditingSeat(null);
    setStudentSearch("");
    void saveAssignments(next, "Sıra boşaltıldı.");
  };

  const uploadPhoto = (student: Student, file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Lütfen bir resim dosyası seçin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;
      sqliteStorage.setItem(`student_seating_photo_${student.id}`, dataUrl);
      setPhotoOverrides((prev) => ({ ...prev, [String(student.id)]: dataUrl }));
      setMessage(`${student.name} için oturma planı fotoğrafı kaydedildi.`);
    };
    reader.readAsDataURL(file);
  };

  const renderAvatar = (student?: Student, compact = false) => {
    const src = effectivePhoto(student);
    const size = compact ? "h-12 w-12" : "h-14 w-14";
    if (src) return <img src={src} alt={student?.name || "Öğrenci"} className={`${size} rounded-xl border border-slate-200 object-cover object-top`} />;
    return <div className={`${size} flex items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-indigo-100 text-xs font-black text-indigo-700`}>{initials(student?.name || "Ö")}</div>;
  };

  const printPlan = () => {
    if (!selectedClass) return;
    const popup = window.open("", "_blank", "width=1200,height=900");
    if (!popup) {
      setMessage("Yazdırma penceresi açılamadı. Tarayıcı açılır pencere iznini kontrol edin.");
      return;
    }
    const schoolName = schoolNameFromStorage();
    const schoolYear = academicYear();
    const gridHtml = Array.from({ length: columnCount * rowCount }).map((_, deskIndex) => {
      if (!activeDesks[deskIndex]) return `<div class="desk inactive"></div>`;
      const seats = (["L", "R"] as const).map((side) => {
        const seatId = `${deskIndex}-${side}`;
        const student = studentById.get(assignments[seatId] || "");
        const photo = student ? effectivePhoto(student) : "";
        return `<div class="student">${photo ? `<img src="${escapeHtml(photo)}"/>` : `<div class="ph">${escapeHtml(initials(student?.name || ""))}</div>`}<div class="no">${student ? escapeHtml(studentNo(student)) : ""}</div><div class="name">${student ? escapeHtml(student.name) : "BOŞ"}</div></div>`;
      }).join("");
      return `<div class="desk">${seats}</div>`;
    }).join("");
    const elementHtml = elements.map((element) => `<div class="roomEl ${escapeHtml(element.type)}" style="left:${element.x}%;top:${element.y}%">${escapeHtml(elementLabel[element.type])}</div>`).join("");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(selectedClass)} Sınıfı Oturma Planı</title><style>
      @page{size:A4 ${orientation};margin:7mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a}.page{width:100%;min-height:100%;}.header{display:grid;grid-template-columns:1fr 1.6fr 1fr;align-items:center;gap:8px;border-bottom:3px solid #facc15;padding:0 0 7px}.brand{font-weight:900;color:#0f766e;font-size:12px}.title{text-align:center;font-weight:900;font-size:18px}.school{text-align:right;font-weight:900;font-size:10px}.meta{display:flex;justify-content:space-between;font-size:8px;font-weight:700;color:#64748b;margin:5px 0}.room{position:relative;border:1px solid #cbd5e1;background:#f8fafc;border-radius:10px;min-height:${orientation === "landscape" ? "160mm" : "240mm"};overflow:hidden}.grid{position:absolute;left:10%;right:10%;top:20%;bottom:9%;display:grid;grid-template-columns:repeat(${columnCount},1fr);grid-template-rows:repeat(${rowCount},1fr);gap:3mm}.desk{min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:1mm;border:1.2px solid #a16207;background:#fef3c7;border-radius:4px;padding:1mm;overflow:hidden}.desk.inactive{border-style:dashed;border-color:#e2e8f0;background:transparent}.student{min-width:0;text-align:center;background:white;border-radius:3px;padding:.7mm;overflow:hidden}.student img,.ph{width:${orientation === "landscape" ? "13mm" : "15mm"};height:${orientation === "landscape" ? "15mm" : "18mm"};margin:0 auto;object-fit:cover;object-position:top;border-radius:3px;border:1px solid #cbd5e1}.ph{display:flex;align-items:center;justify-content:center;background:#e0f2fe;color:#0369a1;font-weight:900}.no{font-size:6.5px;font-weight:900;color:#64748b;margin-top:.5mm}.name{font-size:${orientation === "landscape" ? "6.5px" : "7px"};font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.roomEl{position:absolute;z-index:5;padding:1.5mm 3mm;border:1px solid;border-radius:4px;font-size:6px;font-weight:900;white-space:nowrap;transform:translateZ(0)}.roomEl.board{background:#1e293b;color:#fff;border-color:#0f172a}.roomEl.teacher-desk{background:#fef3c7;color:#78350f;border-color:#f59e0b}.roomEl.door{background:#ffe4e6;color:#9f1239;border-color:#fb7185}.roomEl.window{background:#cffafe;color:#155e75;border-color:#22d3ee}.footer{text-align:center;font-size:7px;font-weight:700;color:#64748b;margin-top:3mm}
    </style></head><body><div class="page"><div class="header"><div class="brand">HASAT / e-Nstitü<br><span style="font-size:7px;color:#64748b">Okul Yönetim Sistemi</span></div><div class="title">${escapeHtml(selectedClass)} SINIFI OTURMA PLANI</div><div class="school">${escapeHtml(schoolName.toLocaleUpperCase("tr-TR"))}<br><span style="font-weight:500">${escapeHtml(schoolYear)} Eğitim Öğretim Yılı</span></div></div><div class="meta"><span>${escapeHtml(selectedLocation?.buildingName || "")} ${selectedLocation?.floorName ? `• ${escapeHtml(selectedLocation.floorName)}` : ""}</span><span>Düzen: ${columnCount} sütun × ${rowCount} sıra • ${orientationLabel}</span></div><div class="room"><div class="grid">${gridHtml}</div>${elementHtml}</div><div class="footer">Öğrenci fotoğrafları ve sıra düzeni öğretmenin sınıfa bakışını kolaylaştıracak biçimde hazırlanmıştır.</div></div><script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`);
    popup.document.close();
  };

  const modalStudents = useMemo(() => {
    const q = normalize(studentSearch);
    return classStudents.filter((student) => !q || normalize(`${studentNo(student)} ${student.name}`).includes(q));
  }, [classStudents, studentSearch]);

  return (
    <div className="mx-auto max-w-[1700px] space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700"><Users className="h-5 w-5" /></div>
            <div><h2 className="text-xl font-black text-slate-900">Sınıf Oturma Planı</h2><p className="text-xs font-semibold text-slate-500">Sınıf krokisi Okul Bilgileri → Bina Bilgileri’nden gelir. Burada yalnız öğrencilerin hangi sırada oturduğu ve öğrenci fotoğrafları düzenlenir.</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800">
              {classNames.map((name) => { const room = findSchoolLocationForClass(buildingCatalog, name); return <option key={name} value={name}>{name}{room?.buildingName ? ` • ${room.buildingName}${room.floorName ? ` / ${room.floorName}` : ""}` : ""}</option>; })}
            </select>
            <span className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-800">A4: Otomatik • {orientationLabel}</span>
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">{columnCount} sütun × {rowCount} sıra</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5">Kaynak: {hasCentralLayout ? "Okul Bilgileri > Bina Bilgileri" : "Eski yerleşim kaydı"}</span>
          {selectedLocation?.buildingName && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{selectedLocation.buildingName}</span>}
          {selectedLocation?.floorName && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{selectedLocation.floorName}</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditingSeat(activeSeatIds[0] || null)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-black text-white hover:bg-cyan-700"><UserPlus className="h-4 w-4" /> Öğrenci Yerleştir</button>
          <button type="button" onClick={autoPlace} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-amber-950 hover:bg-amber-300"><LayoutTemplate className="h-4 w-4" /> Otomatik Yerleştir</button>
          <button type="button" onClick={clearPlan} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" /> Yerleşimi Temizle</button>
          <button type="button" onClick={printPlan} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700"><Printer className="h-4 w-4" /> PDF / Yazdır</button>
        </div>
        {message && <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{message}</div>}
        {!hasCentralLayout && selectedClass && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Bu sınıf için Bina Bilgileri ekranında hazırlanmış kroki bulunamadı. Önce Okul Bilgileri → Bina Bilgileri ekranından sınıf krokisini oluşturun.</div>}
      </div>

      <div className={`mx-auto rounded-[28px] border border-slate-200 bg-white shadow-lg ${orientation === "landscape" ? "w-full max-w-[1180px] p-5" : "w-full max-w-[820px] p-5"}`}>
        <div className="grid grid-cols-[1fr_2fr_1fr] items-center gap-3 border-b-4 border-amber-300 pb-3">
          <div className="text-sm font-black text-teal-700">HASAT / e-Nstitü<div className="text-[10px] font-bold text-slate-400">Okul Yönetim Sistemi</div></div>
          <div className="text-center text-lg font-black text-slate-900">{selectedClass || "SINIF"} SINIFI OTURMA PLANI</div>
          <div className="text-right text-xs font-black text-slate-700">{schoolNameFromStorage().toLocaleUpperCase("tr-TR")}<div className="text-[10px] font-semibold text-slate-400">{academicYear()} Eğitim Öğretim Yılı</div></div>
        </div>
        <div className={`relative mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${orientation === "landscape" ? "aspect-[16/10]" : "aspect-[10/14]"}`}>
          <div className="absolute inset-x-[10%] bottom-[9%] top-[20%] grid gap-2.5" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}>
            {Array.from({ length: columnCount * rowCount }).map((_, deskIndex) => {
              if (!activeDesks[deskIndex]) return <div key={`empty-${deskIndex}`} className="rounded-xl border border-dashed border-slate-200" />;
              return (
                <div key={deskIndex} className="grid min-h-0 grid-cols-2 gap-1.5 rounded-xl border-2 border-amber-700/50 bg-amber-100 p-1.5 shadow-sm">
                  {(["L", "R"] as const).map((side) => {
                    const seatId = `${deskIndex}-${side}`;
                    const student = studentById.get(assignments[seatId] || "");
                    return (
                      <button key={seatId} type="button" onClick={() => { setEditingSeat(seatId); setStudentSearch(""); }} className="flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg bg-white p-1 hover:ring-2 hover:ring-cyan-300">
                        {student ? renderAvatar(student, orientation === "landscape") : <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-[8px] font-black text-slate-400">BOŞ</div>}
                        <span className="mt-0.5 text-[8px] font-black text-slate-500">{student ? studentNo(student) : ""}</span>
                        <span className="max-w-full truncate text-[9px] font-black text-slate-900">{student?.name || "Öğrenci seç"}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {elements.map((element) => { const Icon = elementIcon(element.type); return <div key={element.id} className={`pointer-events-none absolute z-20 flex items-center gap-1 rounded-lg border-2 px-2 py-1.5 text-[8px] font-black shadow ${elementClass(element.type)}`} style={{ left: `${element.x}%`, top: `${element.y}%` }}><Icon className="h-3 w-3"/>{elementLabel[element.type]}</div>; })}
        </div>
      </div>

      {editingSeat && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 p-4" onClick={(e) => e.currentTarget === e.target && setEditingSeat(null)}>
          <div className="max-h-[84vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h3 className="font-black text-slate-900">Sıraya Öğrenci Yerleştir</h3><p className="text-xs font-semibold text-slate-500">{selectedClass} • {editingSeat}</p></div><button type="button" onClick={() => setEditingSeat(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <div className="p-4">
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input autoFocus value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Numara veya ad soyad ara" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-cyan-400" /></div>
              {assignments[editingSeat] && <button type="button" onClick={() => clearSeat(editingSeat)} className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700">Bu Sırayı Boşalt</button>}
              <div className="mt-3 max-h-[56vh] space-y-2 overflow-y-auto pr-1">
                {modalStudents.map((student) => {
                  const occupiedSeat = Object.entries(assignments).find(([, id]) => id === String(student.id))?.[0];
                  return <div key={student.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-2.5 hover:border-cyan-300 hover:bg-cyan-50">
                    <button type="button" onClick={() => assignStudent(editingSeat, String(student.id))} className="flex min-w-0 flex-1 items-center gap-3 text-left">{renderAvatar(student, true)}<div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-slate-900">{student.name}</div><div className="text-xs font-bold text-slate-500">No: {studentNo(student) || "—"}{occupiedSeat ? ` • ${occupiedSeat} sırasında` : ""}</div></div></button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"><Camera className="h-3.5 w-3.5"/> Fotoğraf<input type="file" accept="image/*" className="hidden" onChange={(e) => { uploadPhoto(student, e.target.files?.[0]); e.currentTarget.value = ""; }} /></label>
                  </div>;
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
