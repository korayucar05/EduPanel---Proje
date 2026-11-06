import React, { useEffect, useRef, useState } from "react";
import { Classroom, Student } from "../types";
import { getAttendanceStudentNumber } from "../utils/attendanceStudents";
import { preloadScheduleData } from "../services/schedule/schedulePersistenceCache";
import schoolLogo from "../assets/ordu-lisesi-logo.png";
import { useScheduleStore } from "../stores/scheduleStore";
import type { ScheduleData } from "../types/schedule";
import { Activity, ClipboardCheck, Download, LoaderCircle, Printer, UserMinus, UserX, X } from "lucide-react";
import AttendanceDailyWorkflow from "./attendance/AttendanceDailyWorkflow";

import { sqliteStorage } from "../core/state/SyncStateStore";
interface Props {
  classrooms: Classroom[];
  students: Student[];
}
type ScheduleCell = {
  courseName?: string;
  teacherId?: string;
  teacherId2?: string;
  teacherName?: string;
  teacherName2?: string;
  groupName?: string;
  splitGroupId?: string;
  studentIds?: string[];
};

type AttendanceLessonPart = {
  groupName: string;
  course: string;
  teachers: string;
  studentIds: Set<string>;
};

const DEFAULT_TIMES = [
  ["08:30", "09:10"], ["09:20", "10:00"], ["10:10", "10:50"], ["11:00", "11:40"],
  ["12:30", "13:10"], ["13:20", "14:00"], ["14:10", "14:50"], ["15:00", "15:40"],
];
const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export default function AttendanceSlipModule({ classrooms, students }: Props) {
  const [activePanel, setActivePanel] = useState<"attendance" | "absences" | "activity" | "unauthorized">("attendance");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pdfScope, setPdfScope] = useState<"all" | "selected">("all");
  const [selectedClassroomIds, setSelectedClassroomIds] = useState<string[]>([]);
  const [isCreatingPdf, setIsCreatingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ done: 0, total: 0 });
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const pdfFrameRef = useRef<HTMLIFrameElement>(null);
  const liveSchedule = useScheduleStore((state) => state.scheduleData);
  const [persistedSchedule, setPersistedSchedule] = useState<ScheduleData>({});
  const [times, setTimes] = useState(DEFAULT_TIMES);
  // Ekrandaki ders programı kısmi yüklense bile kayıtlı sınıf/grup saatleri kaybolmasın.
  const schedule = { ...persistedSchedule, ...liveSchedule } as Record<string, ScheduleCell | ScheduleCell[]>;

  // Aynı fiziksel sınıf (örn. 11C) farklı grup kayıtlarıyla birden fazla kez
  // gelmiş olsa bile yoklama fişinde ve PDF'de yalnızca bir kez yer alır.
  const normalizeAcademicGroup = (value: unknown) => {
    const normalized = String(value ?? "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
    if (normalized === "SAY" || normalized === "SAYISAL") return "SAY";
    if (normalized === "EA" || normalized === "EŞİT AĞIRLIK" || normalized === "ESIT AGIRLIK") return "EA";
    if (normalized === "SÖZ" || normalized === "SÖZEL") return "SÖZ";
    if (normalized === "DİL" || normalized === "DIL" || normalized === "YABANCI DİL") return "DİL";
    return normalized;
  };
  const groupSuffixPattern = /(?:[-/_(\s]+)(SAYISAL|SAY|EA|EŞİT\s+AĞIRLIK|ESIT\s+AGIRLIK|SÖZEL|SÖZ|DİL|DIL)\)?\s*$/i;
  const getClassroomSuffixGroup = (name: unknown) => {
    const groupMatch = String(name ?? "").trim().match(groupSuffixPattern);
    return groupMatch ? normalizeAcademicGroup(groupMatch[1]) : "";
  };
  const normalizePhysicalClassName = (value: unknown) => String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\bSINIFI\b/g, "")
    .replace(groupSuffixPattern, "")
    .replace(/[^0-9A-ZÇĞİÖŞÜ]/g, "");
  const getStudentClassName = (student: Student) => {
    const source = student as Student & { className?: string; classroomName?: string; class?: string; branch?: string; grade?: string | number };
    const direct = source.classroom || source.className || source.classroomName || source.class || "";
    if (direct) return String(direct);
    if (source.grade && source.branch) return `${source.grade}${source.branch}`;
    return "";
  };
  const getStudentDisplayName = (student: Student) => {
    const source = student as Student & { fullName?: string; adSoyad?: string; ad_soyad?: string };
    return String(source.name || source.fullName || source.adSoyad || source.ad_soyad || "").trim();
  };
  const physicalClassrooms = classrooms.filter((classroom, index, list) =>
    list.findIndex((item) => normalizePhysicalClassName(item.name) === normalizePhysicalClassName(classroom.name)) === index
  );
  const getClassroomFamily = (classroom: Classroom) => classrooms.filter((item) =>
    normalizePhysicalClassName(item.name) === normalizePhysicalClassName(classroom.name)
  );

  useEffect(() => {
    preloadScheduleData()
      .then(setPersistedSchedule)
      .catch(() => setPersistedSchedule({}));
    try {
      const saved = JSON.parse(sqliteStorage.getItem("school_timetable") || "[]") as Array<{ hour?: number; start?: string; end?: string }>;
      if (saved.length) setTimes(DEFAULT_TIMES.map((fallback, index) => {
        const found = saved.find((item) => Number(item.hour) === index + 1);
        return [found?.start || fallback[0], found?.end || fallback[1]];
      }));
    } catch { /* Varsayılan saatler kullanılır. */ }
  }, []);

  useEffect(() => () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
  }, [pdfPreviewUrl]);

  const selectedDate = new Date(`${date}T12:00:00`);
  const dayName = DAY_NAMES[selectedDate.getDay()];

  const togglePdfClassroom = (classroomId: string) => {
    setSelectedClassroomIds((current) => current.includes(classroomId)
      ? current.filter((id) => id !== classroomId)
      : [...current, classroomId]);
  };

  const createAttendancePdf = async () => {
    const targetIds = pdfScope === "all"
      ? physicalClassrooms.map((classroom) => classroom.id)
      : selectedClassroomIds;
    if (targetIds.length === 0) {
      window.alert("PDF oluşturmak için en az bir sınıf seçiniz.");
      return;
    }

    setIsCreatingPdf(true);
    try {
      await document.fonts?.ready;
      const allPageNodes = Array.from(document.querySelectorAll<HTMLElement>(".attendance-page[data-classroom-id]"));
      const nodeByClassroomId = new Map(allPageNodes.map((node) => [node.dataset.classroomId || "", node]));
      const pageNodes = targetIds.map((id) => nodeByClassroomId.get(id)).filter(Boolean) as HTMLElement[];
      if (pageNodes.length !== targetIds.length) throw new Error("Seçilen sınıfların yoklama sayfaları bulunamadı.");

      const [{ toJpeg, getFontEmbedCSS }, { PdfEngine }] = await Promise.all([
        import("html-to-image"),
        import("../pdf/core/PdfEngine"),
      ]);

      // html-to-image normalde her fişte fontları yeniden okuyup gömer. Font CSS'ini
      // bir kez hazırlayıp bütün sınıflarda paylaşmak PDF üretimini belirgin biçimde hızlandırır.
      let fontEmbedCSS: string | undefined;
      try {
        fontEmbedCSS = await getFontEmbedCSS(pageNodes[0]);
      } catch {
        fontEmbedCSS = undefined;
      }

      setPdfProgress({ done: 0, total: pageNodes.length });
      const pageImages = new Array<string>(pageNodes.length);
      let nextIndex = 0;
      let completed = 0;
      const workerCount = Math.min(4, pageNodes.length);
      const renderWorker = async () => {
        while (true) {
          const index = nextIndex++;
          if (index >= pageNodes.length) return;
          const page = pageNodes[index];
          pageImages[index] = await toJpeg(page, {
            backgroundColor: "#ffffff",
            cacheBust: false,
            pixelRatio: 2,
            quality: 0.9,
            width: page.offsetWidth,
            height: page.offsetHeight,
            fontEmbedCSS,
            style: { margin: "0", boxShadow: "none" },
          });
          completed += 1;
          setPdfProgress({ done: completed, total: pageNodes.length });
        }
      };
      await Promise.all(Array.from({ length: workerCount }, () => renderWorker()));

      // Kaynak şablon doğrudan A4 boyutunda yakalanır; optik işaretleri kullanılmaz.
      const fullPageContent = pageImages.map((image, index) => ({
        image,
        width: 595.0,
        height: 841.0,
        margin: [0, 0, 0, 0],
        pageBreak: index > 0 ? "before" : undefined,
      }));

      const blob = await PdfEngine.generate({
        pageSize: "A4",
        pageOrientation: "portrait",
        pageMargins: [0, 0, 0, 0],
        content: fullPageContent,
      }, { filename: `yoklama-fisleri-${date}.pdf`, mode: "blob" }) as Blob;
      setPdfBlob(blob);
      setPdfPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error("Yoklama fişi PDF'i oluşturulamadı:", error);
      window.alert(error instanceof Error ? error.message : "Yoklama fişi PDF'i oluşturulamadı.");
    } finally {
      setIsCreatingPdf(false);
      setPdfProgress({ done: 0, total: 0 });
    }
  };

  const downloadAttendancePdf = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `yoklama-fisleri-${date}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const closePdfPreview = () => {
    setPdfPreviewUrl(null);
    setPdfBlob(null);
  };

  const renderSlip = (classroomId: string) => {
    const classroom = physicalClassrooms.find((item) => item.id === classroomId);
    const classroomFamily = classroom ? getClassroomFamily(classroom) : [];
    const familyIds = new Set(classroomFamily.map((item) => String(item.id)));
    const classStudents = classroom
      ? students
          .filter((student) => student.status !== "Pasif" && (
            [student.classroomId, student.classId].some((value) => familyIds.has(String(value ?? "")))
            || normalizePhysicalClassName(getStudentClassName(student)) === normalizePhysicalClassName(classroom.name)
          ))
          .filter((student, index, list) => list.findIndex((item) => String(item.id) === String(student.id)) === index)
          .sort((a, b) => getAttendanceStudentNumber(a).localeCompare(getAttendanceStudentNumber(b), "tr", { numeric: true, sensitivity: "base" }) || getStudentDisplayName(a).localeCompare(getStudentDisplayName(b), "tr", { sensitivity: "base" }))
      : [];
    const rows = classStudents;
    const normalizeGroupName = normalizeAcademicGroup;
    const classroomGroupMap = classroomFamily.reduce<Record<string, string[]>>((result, item) => {
      if (Array.isArray(item.groupStudentIds)) return result;
      Object.entries(item.groupStudentIds || {}).forEach(([groupName, ids]) => {
        result[groupName] = [...new Set([...(result[groupName] || []), ...((ids || []) as string[]).map(String)])];
      });
      return result;
    }, {});
    // Grup adları yalnız ders başlığında tutulmayabilir: sınıf tanımı,
    // öğrencinin grubu ve hedef ders grupları da aynı fiziksel sınıfı anlatır.
    const definedGroupNames = [...new Set([
      ...classroomFamily.flatMap((item) => [
        ...(Array.isArray(item.groups) ? item.groups : []),
        item.group1Name,
        item.group2Name,
        ...Object.keys(!Array.isArray(item.groupStudentIds) ? item.groupStudentIds || {} : {}),
      ]),
      ...classStudents.map((student) => (student as any).group || (student as any).groupName),
      ...classroomFamily.flatMap((item) => (item.assignedCourses || []).flatMap((course: any) => [
        course.groupName,
        ...(Array.isArray(course.targetGroups) ? course.targetGroups : []),
      ])),
    ].map(normalizeGroupName).filter((name) => name && name !== "GENEL" && name !== "ORTAK"))];
    const sortedClassGroups = definedGroupNames.sort((a, b) => {
      const priority = (name: string) => name === "SAY" ? 0 : name === "EA" ? 1 : 10;
      return priority(a) - priority(b) || a.localeCompare(b, "tr");
    });

    const getScheduledCellGroup = (cell: ScheduleCell, sourceClassroom: Classroom) => {
      if ((cell as any).isCommonCourse === true) return "";
      const explicitGroups = String(cell.groupName || "")
        .split(/[,/+]+/).map(normalizeGroupName)
        .filter((name) => name && name !== "GENEL" && name !== "ORTAK");
      if (explicitGroups.length === 1) return explicitGroups[0];
      if (explicitGroups.length > 1) return ""; // Birden fazla hedef grubun ortak dersi.
      const extended = cell as ScheduleCell & { targetGroups?: string[] };
      const targetGroups = (extended.targetGroups || [])
        .map(normalizeGroupName).filter((name) => name && name !== "GENEL" && name !== "ORTAK");
      if (targetGroups.length === 1) return targetGroups[0];
      if (targetGroups.length > 1) return "";

      // Sınıf dersleri bazı eski kayıtlarda yalnızca ders ismine eklenen
      // parantezli grup koduyla saklanmıştır (örn. Matematik (SAY)).
      const courseGroup = getClassroomSuffixGroup(cell.courseName);
      if (courseGroup) return courseGroup;

      const assignedIds = Array.isArray(cell.studentIds) ? cell.studentIds.map(String) : [];
      if (assignedIds.length) {
        const matchedGroups = Object.entries(classroomGroupMap)
          .map(([name, ids]) => ({ name: normalizeGroupName(name), count: ids.filter((id) => assignedIds.includes(String(id))).length }))
          .filter(({ count }) => count > 0)
          .sort((a, b) => b.count - a.count);
        if (matchedGroups.length === 1 || (matchedGroups.length > 1 && matchedGroups[0].count > matchedGroups[1].count)) {
          return matchedGroups[0].name;
        }
        const matchedStudentGroups = new Map<string, number>();
        classStudents.filter((student) => assignedIds.includes(String(student.id))).forEach((student) => {
          const studentGroup = normalizeGroupName((student as any).group || (student as any).groupName);
          if (studentGroup) matchedStudentGroups.set(studentGroup, (matchedStudentGroups.get(studentGroup) || 0) + 1);
        });
        const strongestGroup = [...matchedStudentGroups.entries()].sort((a, b) => b[1] - a[1]);
        if (strongestGroup.length === 1 || (strongestGroup.length > 1 && strongestGroup[0][1] > strongestGroup[1][1])) {
          return strongestGroup[0][0];
        }
      }
      const groupFromClassroomName = getClassroomSuffixGroup(sourceClassroom.name);
      if (groupFromClassroomName) return groupFromClassroomName;
      const classroomGroups = sourceClassroom.groups || [];
      if (classroomGroups.length === 1) return normalizeGroupName(classroomGroups[0]);
      if (assignedIds.length) return `ÖĞRENCİ:${[...assignedIds].sort().join("-")}`;
      if (cell.splitGroupId) return `BÖLÜNMÜŞ:${cell.splitGroupId}:${cell.courseName || ""}:${cell.teacherId || ""}`;
      return "";
    };
    const resolveCellStudentIds = (cell: ScheduleCell, groupName: string) => {
      if (Array.isArray(cell.studentIds) && cell.studentIds.length) return cell.studentIds;
      const directGroupIds = Object.entries(classroomGroupMap).find(([name]) => normalizeGroupName(name) === normalizeGroupName(groupName))?.[1];
      if (Array.isArray(directGroupIds) && directGroupIds.length) return directGroupIds;
      const assigned = classroomFamily.flatMap((item) => item.assignedCourses || []).find((course) =>
        String(course.courseName || "").trim() === String(cell.courseName || "").trim()
        && (!groupName || normalizeGroupName(course.groupName) === normalizeGroupName(groupName))
      );
      return Array.isArray(assigned?.studentIds) ? assigned.studentIds : [];
    };
    const lessonDetails = Array.from({ length: 8 }, (_, index) => {
      // Ders dağıtımında fiziksel şubenin grup kopyaları ayrı class_* anahtarında
      // saklanabilir. Tüm sınıf hücrelerini aynı gün/saat için topla; öğretmen_* 
      // anahtarları aynı dersin aynası olduğundan burada tekrar kullanma.
      const suffix = `_${dayName}_${index + 1}`;
      const familyIds = new Set(classroomFamily.map((item) => String(item.id)));
      const sourcedCells = Object.entries(schedule).flatMap(([key, raw]) => {
        if (!key.startsWith("class_") || !key.endsWith(suffix) || !raw) return [];
        const classId = key.slice("class_".length, -suffix.length);
        const sourceClassroom = classrooms.find((item) => String(item.id) === classId);
        const values = (Array.isArray(raw) ? raw : [raw]).filter(Boolean) as ScheduleCell[];
        return values.flatMap((value) => {
          const courses = Array.isArray((value as any).originalCourses) && (value as any).originalCourses.length
            ? (value as any).originalCourses as ScheduleCell[]
            : [value];
          return courses.filter((cell) =>
            familyIds.has(classId)
            || (sourceClassroom && normalizePhysicalClassName(sourceClassroom.name) === normalizePhysicalClassName(classroom.name))
            || normalizePhysicalClassName((cell as any).className) === normalizePhysicalClassName(classroom.name)
          ).map((cell) => ({ cell, groupName: getScheduledCellGroup(cell, sourceClassroom || classroom) }));
        });
      });
      const cells = sourcedCells.map(({ cell }) => cell);
      const parts: AttendanceLessonPart[] = sourcedCells.map(({ cell, groupName }) => ({
        groupName,
        course: String(cell.courseName || "").trim(),
        teachers: [...new Set([cell.teacherName?.trim(), cell.teacherName2?.trim()].filter(Boolean))].join(" / "),
        studentIds: new Set(resolveCellStudentIds(cell, groupName).map(String)),
      }));
      const groupedParts = new Map<string, AttendanceLessonPart>();
      parts.filter((part) => part.groupName).forEach((part) => {
        const key = normalizeGroupName(part.groupName);
        const current = groupedParts.get(key);
        if (!current) {
          groupedParts.set(key, { ...part, studentIds: new Set(part.studentIds) });
          return;
        }
        part.studentIds.forEach((studentId) => current.studentIds.add(studentId));
        current.course = [...new Set([current.course, part.course].filter(Boolean))].join(" / ");
        current.teachers = [...new Set([current.teachers, part.teachers].filter(Boolean))].join(" / ");
      });
      const groupPriority = (part: AttendanceLessonPart) => {
        const name = normalizeGroupName(part.groupName);
        if (name === "SAY") return 0;
        if (name === "EA") return 1;
        return 10;
      };
      const distinctGroupParts = [...groupedParts.values()]
        .map((part, order) => ({ part, order }))
        .sort((a, b) => groupPriority(a.part) - groupPriority(b.part) || a.order - b.order)
        .map(({ part }) => part);
      const allCellsWithoutGroupTarget = sourcedCells.every(({ cell }) => {
        const extended = cell as ScheduleCell & { targetGroups?: string[] };
        return !normalizeGroupName(cell.groupName)
          && !(extended.targetGroups || []).length
          && !(Array.isArray(cell.studentIds) && cell.studentIds.length)
          && !cell.splitGroupId;
      });
      const sharedCourseAcrossGroups = distinctGroupParts.length >= 2
        && distinctGroupParts.every((part) => Boolean(part.course) && part.course === distinctGroupParts[0].course && part.teachers === distinctGroupParts[0].teachers)
        && (allCellsWithoutGroupTarget || distinctGroupParts.every((part) =>
          part.studentIds.size === 0 || [...part.studentIds].every((id) => distinctGroupParts[0].studentIds.has(id))));

      // Rehberlik ve Yönlendirme ortak derstir: dağıtım hücresinde yanlışlıkla
      // SAY/EA etiketi kalsa da tüm öğrencilerin ovali tek hizada bulunur.
      const isCommonGuidanceLesson = cells.some((cell) => {
        const course = String(cell.courseName || "")
          .toLocaleUpperCase("tr-TR")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^A-Z0-9]/g, "");
        return course === "REHBERLIKVEYONLENDIRME";
      });

      // Tek bir grup dersi bulunması, dersin tüm sınıfa ait olduğunu göstermez.
      // 11-C SAY dersinde EA öğrencileri için oval basma; SAY ovalini solda tut.
      // Diğer grup için o saatte ders kaydı yoksa sağ taraf boş kalır.
      let splitParts: AttendanceLessonPart[] = [];
      if (!isCommonGuidanceLesson && distinctGroupParts.length >= 2 && !sharedCourseAcrossGroups) {
        splitParts = distinctGroupParts.slice(0, 2);
      } else if (!isCommonGuidanceLesson && distinctGroupParts.length === 1 && sortedClassGroups.length >= 2) {
        const activePart = distinctGroupParts[0];
        const matchingGroup = normalizeGroupName(activePart.groupName);
        if (sortedClassGroups.includes(matchingGroup)) {
          splitParts = sortedClassGroups.slice(0, 2).map((name) =>
            name === matchingGroup ? activePart : { groupName: name, course: "", teachers: "", studentIds: new Set<string>() }
          );
        }
      }

      return {
        course: [...new Set(cells.map((cell) => cell.courseName?.trim()).filter(Boolean))].join(" / "),
        teachers: [...new Set(cells.flatMap((cell) => [cell.teacherName?.trim(), cell.teacherName2?.trim()]).filter(Boolean))].join(" / "),
        splitParts,
      };
    });
    // Ortak dersler daha dar; aynı saatte iki grup varsa ovalin sağ/sol alanına
    // yer açmak için yalnız ilgili ders sütunu biraz genişletilir.
    const attendanceStudentNameWidthMm = 43;
    const attendanceLessonWidthsMm = lessonDetails.map((detail) => detail.splitParts.length >= 2 ? 13.5 : 10.2);
    const attendanceTableWidthMm = 4.7 + 8.5 + attendanceStudentNameWidthMm
      + attendanceLessonWidthsMm.reduce((total, width) => total + width, 0);
    // A4'te satırları hafif kısalt; yazı ve oval yüksekliğini koru.
    const attendanceRowHeightMm = Math.min(6.9, 186 / Math.max(1, rows.length));
    const attendanceOvalClass = "block h-[2.95mm] w-[3.9mm] shrink-0 rounded-[999px] border-[0.3mm] border-orange-500 bg-white";

    // Bir öğrenci, aynı ders saatinde yalnızca TEK yoklama ovaline sahip olabilir.
    // Öncelik: sınıfın kesin grup öğrenci listesi -> öğrencinin kayıtlı grup bilgisi ->
    // ders hücresindeki öğrenci listesi. Böylece hatalı/çakışan studentIds verisi bir
    // öğrencinin hem sol hem sağ grupta iki oval almasına neden olmaz.
    const resolveStudentLessonPartIndex = (student: Student, splitParts: AttendanceLessonPart[]) => {
      if (splitParts.length < 2) return 0;
      const studentId = String(student.id);
      const mappedGroup = Object.entries(classroomGroupMap).find(([, ids]) =>
        Array.isArray(ids) && ids.map(String).includes(studentId)
      )?.[0];
      const studentGroup = normalizeGroupName(mappedGroup || (student as any).group || (student as any).groupName);

      if (studentGroup) {
        const exactGroupIndex = splitParts.findIndex((part) => normalizeGroupName(part.groupName) === studentGroup);
        if (exactGroupIndex >= 0) return exactGroupIndex;
      }

      const matchingIndexes = splitParts
        .map((part, index) => part.studentIds.has(studentId) ? index : -1)
        .filter((index) => index >= 0);
      if (matchingIndexes.length) return matchingIndexes[0];

      // Grup bilgisi bulunamayan öğrencide yanlış gruba işaret alanı üretme.
      return -1;
    };

    // Her ders saatinde öğretmenin yazabileceği boş devamsızlık sayısı.
    const renderAbsentCount = () => (
      <div className="flex h-[4mm] w-full shrink-0 items-center justify-center whitespace-nowrap text-[5.4px] font-bold text-slate-800">
        (<span className="inline-block w-[3.4mm]" />) kişi
      </div>
    );

    const renderTeacherLessonArea = (part: AttendanceLessonPart, groupLabel: string, index: number) => {
      const teachers = part.teachers.split(" / ").map((name) => name.trim()).filter(Boolean);
      const teacherNameLines = teachers.map((fullName) => {
        const tokens = fullName.split(/\s+/).filter(Boolean);
        return {
          givenName: tokens.length > 1 ? tokens.slice(0, -1).join(" ") : fullName,
          surname: tokens.length > 1 ? tokens[tokens.length - 1] : "",
        };
      });
      return (
        <div key={`${groupLabel}-${index}`} className="relative flex h-full min-w-0 flex-col items-center px-[0.2mm] text-center" style={{ boxSizing: "border-box" }}>
          {groupLabel && <div className="flex h-[1.5mm] shrink-0 items-center justify-center text-[4.7px] font-black leading-none text-slate-700">{groupLabel}</div>}
          <div className={`mt-[0.5mm] flex w-full shrink-0 items-start justify-center overflow-hidden font-black leading-[1.08] text-red-600 ${groupLabel ? "h-[3.3mm]" : "h-[5.2mm]"}`} style={{ overflowWrap: "anywhere", fontSize: part.course.length > 34 ? "4.4px" : "5.2px" }}>
            <span style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>{part.course || ""}</span>
          </div>
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start overflow-hidden text-slate-800" style={{ fontSize: "4.1px", lineHeight: 1.12 }}>
            {teacherNameLines.map(({ givenName, surname }, teacherIndex) => (
              <div key={`${teacherIndex}-${givenName}`} className="min-w-0 w-full font-semibold" style={{ overflowWrap: "anywhere" }}>
                <div>{givenName}</div>
                {surname && <div>{surname}</div>}
              </div>
            ))}
          </div>
        </div>
      );
    };

    return <section className="attendance-slip relative flex h-[297mm] w-[210mm] shrink-0 flex-col items-center justify-start bg-white px-[10mm] pb-[7mm] pt-[7mm]" style={{ boxSizing: "border-box" }}>
      <header className="flex h-[22mm] w-full shrink-0 items-center justify-center text-center">
        <div className="flex h-[18mm] w-full items-center rounded-[2mm] border-[0.3mm] border-slate-700 bg-white px-[3mm] shadow-[inset_0_0_0_0.2mm_#e2e8f0]" style={{ maxWidth: `${attendanceTableWidthMm}mm` }}>
          <div className="flex w-[21mm] shrink-0 items-center justify-center border-r border-slate-300 pr-[2mm]">
            <img src={schoolLogo} alt="Ordu Lisesi logosu" className="h-[14mm] w-[14mm] shrink-0 object-contain" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-[2mm]">
            <h1 className="text-[13px] font-black tracking-[0.15px]">GÜNLÜK YOKLAMA FİŞİ</h1>
            <div className="mt-[1mm] flex min-h-[6.5mm] min-w-[56mm] items-center justify-center rounded-[1.2mm] bg-black px-[3mm] py-[0.8mm] text-[12px] font-black tracking-[0.35px] text-white">{classroom?.name || "-"}</div>
          </div>
          <div className="grid w-[38mm] shrink-0 border-l border-slate-300 pl-[2mm] text-center">
            <div className="flex h-[13.5mm] flex-col items-center justify-center rounded-[1mm] bg-slate-100 px-[1mm] py-[0.7mm]">
              <div className="text-[12px] font-black leading-none text-slate-950">{new Intl.DateTimeFormat("tr-TR").format(selectedDate)}</div>
              <div className="mt-[1.2mm] text-[9px] font-black leading-none text-slate-800">{dayName}</div>
            </div>
          </div>
        </div>
      </header>
      <table className="mx-auto table-fixed border-separate border-spacing-0 text-[8px] leading-none" style={{ width: `${attendanceTableWidthMm}mm` }}>
        <colgroup>
          <col style={{ width: "4.7mm" }} /><col style={{ width: "8.5mm" }} /><col style={{ width: `${attendanceStudentNameWidthMm}mm` }} />
          {times.map((_, index) => <col key={`lesson-col-${index}`} style={{ width: `${attendanceLessonWidthsMm[index]}mm` }} />)}
        </colgroup>
        <thead><tr style={{ height: "10mm" }}><th className="text-center text-[8px]">Sıra</th><th className="text-center text-[8px]">No</th><th className="px-1 text-left text-[8px]">ÖĞRENCİNİN ADI SOYADI</th>{times.map((time, index) => <th key={index} className={`border-l border-slate-300 px-0 text-center ${index === times.length - 1 ? "border-r" : ""}`}><div className="text-[8px] font-black">{index + 1}. DERS</div><div className="mt-[0.5mm] text-[7px] font-normal leading-tight">{time[0]}<br />{time[1]}</div></th>)}</tr></thead>
        <tbody>
          {rows.map((student, index) => (
            <tr key={student?.id || index} className={index % 2 === 0 ? "bg-orange-100" : "bg-white"} style={{ height: `${attendanceRowHeightMm}mm` }}>
              <td className="text-center text-[8px] font-black">{index + 1}</td>
              <td className="text-center text-[10px] font-bold">{getAttendanceStudentNumber(student) || "-"}</td>
              <td className="px-1 text-[10px] font-bold">{student ? getStudentDisplayName(student) : ""}</td>
              {times.map((_, lesson) => {
                const splitParts = lessonDetails[lesson]?.splitParts || [];
                if (splitParts.length < 2) return (
                  <td key={lesson} className={`border-l border-slate-300 p-0 text-center align-middle ${lesson === times.length - 1 ? "border-r" : ""}`}>
                    <span className={`mx-auto ${attendanceOvalClass}`}></span>
                  </td>
                );
                const activePartIndex = resolveStudentLessonPartIndex(student, splitParts);
                return (
                  <td key={lesson} className={`border-l border-slate-300 p-0 text-center align-middle ${lesson === times.length - 1 ? "border-r" : ""}`}>
                    <div className="flex w-full items-center" style={{ height: `${attendanceRowHeightMm}mm` }}>
                      {splitParts.map((part, partIndex) => (
                        <div key={`${part.groupName}-${partIndex}`} className="flex h-full w-1/2 min-w-0 items-center justify-center">
                          {activePartIndex === partIndex && <span aria-label={`${part.groupName} yoklama ovali`} className={attendanceOvalClass}></span>}
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-white">
            <td colSpan={3} className="h-[22mm]"></td>
            {lessonDetails.map((detail, lesson) => (
              <td key={lesson} className={`h-[22mm] border-l border-slate-300 p-0 align-top ${lesson === lessonDetails.length - 1 ? "border-r" : ""}`}>
                <div className="flex h-[22mm] w-full flex-col">
                  {renderAbsentCount()}
                  {detail.splitParts.length >= 2 ? (
                    <div className="flex min-h-0 flex-1 flex-row">
                      {detail.splitParts.slice(0, 2).map((part, partIndex) => (
                        <div key={`${part.groupName}-${partIndex}`} className="h-full w-1/2 min-w-0" style={partIndex === 0 ? { borderRight: "0.5px dashed #d1d5db" } : undefined}>
                          {renderTeacherLessonArea(part, part.groupName, partIndex)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1">
                      {renderTeacherLessonArea({ groupName: "", course: detail.course, teachers: detail.teachers, studentIds: new Set<string>() }, "", lesson)}
                    </div>
                  )}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <div
        aria-label="Yoklama fişi kareli not alanı"
        className="mt-[4mm] min-h-0 w-full flex-1"
        style={{
          backgroundImage: "linear-gradient(to right, #dce4ed 0.5px, transparent 0.5px), linear-gradient(to bottom, #dce4ed 0.5px, transparent 0.5px)",
          backgroundSize: "5mm 5mm",
          backgroundPosition: "0 0",
          boxSizing: "border-box",
        }}
      />
    </section>;
  };

  return <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-7">
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap'); .attendance-page { width: 210mm; height: 297mm; display: flex; align-items: center; justify-content: center; overflow: hidden; background: white; box-sizing: border-box; } .attendance-slip { transform: none; transform-origin: center center; } @media print { @page { size: A4 portrait; margin: 0; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } body * { visibility: hidden !important; } .attendance-print, .attendance-print * { visibility: visible !important; } .attendance-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; margin: 0 !important; padding: 0 !important; background: white !important; box-shadow: none !important; } .attendance-page { width: 210mm !important; height: 297mm !important; break-after: page; page-break-after: always; } .attendance-slip { transform: none !important; transform-origin: center center !important; } .attendance-page:last-child { break-after: auto; page-break-after: auto; } }`}</style>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-cyan-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button type="button" onClick={() => setActivePanel("attendance")} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${activePanel === "attendance" ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><ClipboardCheck className="h-4 w-4" /> Yoklama Fişi</button>
          <button type="button" onClick={() => setActivePanel("absences")} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${activePanel === "absences" ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><UserMinus className="h-4 w-4" /> Devamsızlıklar</button>
          <button type="button" onClick={() => setActivePanel("activity")} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${activePanel === "activity" ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><Activity className="h-4 w-4" /> Faaliyet</button>
          <button type="button" onClick={() => setActivePanel("unauthorized")} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${activePanel === "unauthorized" ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><UserX className="h-4 w-4" /> İzinsiz Gidenler</button>
        </div>
      </div>

      {activePanel === "attendance" ? <><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:max-w-xs">
          <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Tarih</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700" /></label>
        </div>
        <div className="flex flex-1 flex-col gap-2 lg:items-end">
          <span className="text-xs font-bold text-slate-600">PDF kapsamı</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPdfScope("all")} className={`h-10 rounded-xl px-4 text-xs font-black ${pdfScope === "all" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Tüm sınıflar ({physicalClassrooms.length})</button>
            <button type="button" onClick={() => setPdfScope("selected")} className={`h-10 rounded-xl px-4 text-xs font-black ${pdfScope === "selected" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Seçili sınıflar ({selectedClassroomIds.length})</button>
            <button type="button" disabled={isCreatingPdf || (pdfScope === "selected" && selectedClassroomIds.length === 0)} onClick={createAttendancePdf} className="flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-black text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
              {isCreatingPdf ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isCreatingPdf ? `PDF hazırlanıyor${pdfProgress.total ? ` (${pdfProgress.done}/${pdfProgress.total})` : ""}` : "PDF oluştur"}
            </button>
          </div>
        </div>
        </div>
        {pdfScope === "selected" && <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black text-slate-700">PDF'ye eklenecek sınıflar</span><div className="flex gap-3"><button type="button" onClick={() => setSelectedClassroomIds(physicalClassrooms.map((item) => item.id))} className="text-[11px] font-black text-orange-600">Tümünü seç</button><button type="button" onClick={() => setSelectedClassroomIds([])} className="text-[11px] font-black text-slate-400">Temizle</button></div></div>
          <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">{physicalClassrooms.map((classroom) => <label key={classroom.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={selectedClassroomIds.includes(classroom.id)} onChange={() => togglePdfClassroom(classroom.id)} className="accent-orange-500" />{classroom.name}</label>)}</div>
        </div>}
      </div><AttendanceDailyWorkflow mode="summary" date={date} classrooms={classrooms} students={students} /></> : activePanel === "absences" ? <AttendanceDailyWorkflow mode="absences" date={date} classrooms={classrooms} students={students} /> : activePanel === "activity" ? <AttendanceDailyWorkflow mode="activities" date={date} classrooms={classrooms} students={students} /> : <AttendanceDailyWorkflow mode="unauthorized" date={date} classrooms={classrooms} students={students} />}

      <div aria-hidden="true" className="pointer-events-none fixed left-[-20000px] top-0"><div className="attendance-print flex w-[210mm] flex-row flex-wrap gap-0 text-black" style={{ fontFamily: "Roboto, Arial, sans-serif" }}>{physicalClassrooms.map((classroom) => <div key={classroom.id} data-classroom-id={classroom.id} className="attendance-page">{renderSlip(classroom.id)}</div>)}</div></div>
    </div>
    {pdfPreviewUrl && <div className="fixed inset-0 z-[250] flex flex-col bg-slate-950">
      <div className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 text-white md:px-6">
        <div><h2 className="font-black">Günlük Yoklama Fişleri</h2><p className="text-xs font-medium text-slate-400">{new Intl.DateTimeFormat("tr-TR").format(selectedDate)} · {pdfScope === "all" ? `${physicalClassrooms.length} sınıf` : `${selectedClassroomIds.length} seçili sınıf`}</p></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={downloadAttendancePdf} className="flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-xs font-black text-white hover:bg-orange-600"><Download className="h-4 w-4" /> <span className="hidden sm:inline">PDF indir</span></button>
          <button type="button" onClick={() => pdfFrameRef.current?.contentWindow?.print()} className="flex h-10 items-center gap-2 rounded-xl bg-cyan-600 px-4 text-xs font-black text-white hover:bg-cyan-700"><Printer className="h-4 w-4" /> <span className="hidden sm:inline">Yazdır</span></button>
          <button type="button" aria-label="PDF önizlemeyi kapat" onClick={closePdfPreview} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <iframe ref={pdfFrameRef} title="Günlük yoklama fişi PDF önizleme" src={pdfPreviewUrl} className="min-h-0 flex-1 border-0 bg-slate-700" />
    </div>}
  </div>;
}
