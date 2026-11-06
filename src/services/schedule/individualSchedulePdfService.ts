import type { Classroom, Teacher } from "../../types";
import type { ScheduleData } from "../../types/schedule";
import { PdfEngine } from "../../pdf";
import { DAYS, HOURS } from "./scheduleRules";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
const SCHOOL_NAME = "ORDU LİSESİ";

function asItems(value: unknown): any[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function normalize(value: unknown) {
  return String(value || "").trim();
}

function formatDate(value?: string) {
  if (!value) return "..... / ..... / ........";
  const raw = value.trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : raw;
}

function getPrincipalName() {
  try {
    const savedA = sqliteStorage.getItem("school_info_a_profile");
    if (savedA) {
      const parsedA = JSON.parse(savedA);
      if (parsedA?.principalName) return normalize(parsedA.principalName);
    }
    const saved = sqliteStorage.getItem("school_info");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.principalName) return normalize(parsed.principalName);
    }
  } catch (error) {
    console.error("Okul müdürü bilgisi okunamadı:", error);
  }
  return "";
}

function splitGroupNames(value: unknown): string[] {
  return String(value || "")
    .split(/[,/+]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function classroomGroupNames(classroom: Classroom): string[] {
  const preferred = [
    ...(Array.isArray(classroom.groups) ? classroom.groups : []),
    classroom.group1Name,
    classroom.group2Name,
  ]
    .map(normalize)
    .filter(Boolean);

  const fromCourses = (classroom.assignedCourses || [])
    .flatMap((course) => splitGroupNames(course?.groupName));

  return Array.from(new Set([...preferred, ...fromCourses]));
}

function findAssignedCourse(classroom: Classroom, item: any) {
  const itemCourse = normalize(item?.courseName);
  const itemGroup = normalize(item?.groupName);
  return (classroom.assignedCourses || []).find((course) => {
    if (normalize(course?.courseName) !== itemCourse) return false;
    const courseGroup = normalize(course?.groupName);
    return !itemGroup || !courseGroup || itemGroup === courseGroup;
  });
}

function courseDisplayMeta(classroom: Classroom, item: any, slotItems: any[] = []) {
  const assigned = findAssignedCourse(classroom, item);
  const type = normalize(item?.type || assigned?.type);
  const groupName = normalize(item?.groupName || assigned?.groupName);
  const isCompulsory = type === "compulsory" || type === "Zorunlu Ders";
  const groups = splitGroupNames(groupName);
  const allGroups = classroomGroupNames(classroom);

  // Seçmeli olsa bile bütün gruplar aynı dersi aynı saatte alıyorsa ders ortaktır.
  const sameCourseGroups = new Set(
    slotItems
      .filter((candidate) => normalize(candidate?.courseName) === normalize(item?.courseName))
      .flatMap((candidate) => {
        const match = findAssignedCourse(classroom, candidate);
        return splitGroupNames(candidate?.groupName || match?.groupName);
      }),
  );

  const assignedGroupCoverage = new Set(groups);
  const coversAllGroups = allGroups.length > 0 && allGroups.every(
    (group) => assignedGroupCoverage.has(group) || sameCourseGroups.has(group),
  );

  const sameCourseIsSharedInSlot = allGroups.length > 0 && allGroups.every((group) => sameCourseGroups.has(group));
  const common = isCompulsory || groups.length === 0 || coversAllGroups || sameCourseIsSharedInSlot;

  return { type, groupName, groups, common };
}

function groupColorMap(classroom: Classroom) {
  const groups = classroomGroupNames(classroom);
  const colors = ["#2563EB", "#DC2626"];
  return new Map(groups.map((group, index) => [group, colors[index % colors.length]]));
}

function classCell(scheduleData: ScheduleData, classroom: Classroom, day: string, hour: number) {
  const items = asItems(scheduleData[`class_${classroom.id}_${day}_${hour}`]);
  if (!items.length) return "";

  const colorMap = groupColorMap(classroom);
  const richText: any[] = [];

  items.forEach((item, index) => {
    const course = normalize(item?.courseName) || "Ders";
    const teachers = [normalize(item?.teacherName), normalize(item?.teacherName2)].filter(Boolean).join(" / ");
    const meta = courseDisplayMeta(classroom, item, items);
    const firstGroup = meta.groups[0];
    const color = meta.common ? "#000000" : (colorMap.get(firstGroup) || "#2563EB");

    richText.push({
      text: course,
      bold: meta.common,
      color,
    });

    if (teachers) {
      richText.push({
        text: `\n${teachers}`,
        bold: meta.common,
        color,
      });
    }

    if (index < items.length - 1) {
      richText.push({ text: "\n", color: "#94a3b8" });
    }
  });

  return {
    text: richText,
    alignment: "center",
    valign: "middle",
  };
}
function teacherCell(scheduleData: ScheduleData, teacher: Teacher, day: string, hour: number) {
  const direct = asItems(scheduleData[`teacher_${teacher.id}_${day}_${hour}`]);
  let items = direct;
  if (!items.length) {
    const suffix = `_${day}_${hour}`;
    items = Object.entries(scheduleData)
      .filter(([key]) => key.startsWith("class_") && key.endsWith(suffix))
      .flatMap(([, value]) => asItems(value))
      .filter((item) =>
        String(item?.teacherId || "") === String(teacher.id) ||
        String(item?.teacherId2 || "") === String(teacher.id) ||
        normalize(item?.teacherName) === normalize(teacher.name) ||
        normalize(item?.teacherName2) === normalize(teacher.name)
      );
  }
  if (!items.length) return "";
  return items.map((item) => {
    const course = normalize(item?.courseName) || "Ders";
    const className = normalize(item?.className);
    return [course, className].filter(Boolean).join("\n");
  }).join("\n---\n");
}


type TimelineLesson = {
  lessonNo?: number;
  startTime?: string;
  endTime?: string;
};

type TimelineDay = {
  dayName?: string;
  lessons?: TimelineLesson[];
};

const DEFAULT_LESSON_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "08:30", end: "09:10" },
  2: { start: "09:20", end: "10:00" },
  3: { start: "10:10", end: "10:50" },
  4: { start: "11:00", end: "11:40" },
  5: { start: "11:50", end: "12:30" },
  6: { start: "13:20", end: "14:00" },
  7: { start: "14:10", end: "14:50" },
  8: { start: "15:00", end: "15:40" },
};

function getLessonTime(hour: number) {
  try {
    const raw = sqliteStorage.getItem("school_timeline");
    if (raw) {
      const parsed = JSON.parse(raw) as TimelineDay[];
      for (const day of Array.isArray(parsed) ? parsed : []) {
        const lesson = (day?.lessons || []).find((item) => Number(item?.lessonNo) === hour);
        if (lesson?.startTime && lesson?.endTime) {
          return { start: lesson.startTime, end: lesson.endTime };
        }
      }
    }
  } catch (error) {
    console.warn("Ders giriş-çıkış saatleri okunamadı, varsayılan saatler kullanılacak:", error);
  }

  return DEFAULT_LESSON_TIMES[hour] || { start: "", end: "" };
}

function hourCell(hour: number, rowHeight: number) {
  const time = getLessonTime(hour);
  const lines = time.start && time.end ? 2 : 1;
  const estimatedTextHeight = lines === 2 ? 18 : 9;
  const verticalPadding = Math.max(1, (rowHeight - estimatedTextHeight) / 2);

  return {
    text: [
      { text: `${hour}`, bold: true, fontSize: 8.2 },
      ...(time.start && time.end
        ? [{ text: `\n${time.start} - ${time.end}`, fontSize: 5.6, color: "#475569" }]
        : []),
    ],
    alignment: "center",
    margin: [0, verticalPadding, 0, verticalPadding],
  };
}

function scheduleTable(getCell: (day: string, hour: number) => any) {
  const rowHeight = 32;

  const makeCell = (day: string, hour: number) => {
    const value = getCell(day, hour);

    // pdfMake'in valign davranışı çok satırlı richText'te güvenilir değil.
    // İçeriğin satır sayısına göre üst-alt padding hesaplayarak gerçek merkeze yaklaştırıyoruz.
    const plainText = typeof value === "string"
      ? value
      : Array.isArray(value?.text)
        ? value.text.map((part: any) => String(part?.text || "")).join("")
        : String(value?.text || "");

    const lineCount = Math.max(1, plainText.split("\n").length);
    const estimatedTextHeight = Math.min(rowHeight - 4, lineCount * 7.2);
    const verticalPadding = Math.max(1.5, (rowHeight - estimatedTextHeight) / 2);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return {
        ...value,
        style: "scheduleCell",
        alignment: "center",
        margin: [0, verticalPadding, 0, verticalPadding],
      };
    }

    return {
      text: value || "",
      style: "scheduleCell",
      alignment: "center",
      margin: [0, verticalPadding, 0, verticalPadding],
    };
  };

  const body: any[][] = [
    [
      { text: "Saat", style: "tableHeader" },
      ...DAYS.map((day) => ({ text: day, style: "tableHeader" })),
    ],
  ];

  HOURS.forEach((hour) => {
    body.push([
      hourCell(hour, rowHeight),
      ...DAYS.map((day) => makeCell(day, hour)),
    ]);
  });

  return {
    table: {
      headerRows: 1,
      widths: [40, "*", "*", "*", "*", "*"],
      heights: (row: number) => row === 0 ? 20 : rowHeight,
      body,
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => "#475569",
      vLineColor: () => "#475569",
      paddingLeft: () => 1.5,
      paddingRight: () => 1.5,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}
function uniqueClassCourseRows(classroom: Classroom, scheduleData: ScheduleData) {
  type RawRow = {
    course: string;
    teacher: string;
    groupName: string;
    compulsory: boolean;
  };
  type Row = RawRow & { common: boolean };

  const raw = new Map<string, RawRow>();

  const addRow = (source: any) => {
    const course = normalize(source?.courseName);
    if (!course) return;
    const teacher = [normalize(source?.teacherName), normalize(source?.teacherName2)]
      .filter(Boolean)
      .join(" / ");
    const type = normalize(source?.type);
    const groupName = normalize(source?.groupName);
    const compulsory = type === "compulsory" || type === "Zorunlu Ders";
    raw.set(`${course}|${teacher}|${groupName}`, { course, teacher, groupName, compulsory });
  };

  for (const assignment of classroom.assignedCourses || []) addRow(assignment);

  for (const [key, value] of Object.entries(scheduleData)) {
    if (!key.startsWith(`class_${classroom.id}_`)) continue;
    for (const item of asItems(value)) {
      const assigned = findAssignedCourse(classroom, item);
      addRow({
        ...assigned,
        ...item,
        type: item?.type || assigned?.type,
        groupName: item?.groupName || assigned?.groupName,
      });
    }
  }

  const allGroups = classroomGroupNames(classroom);
  const coverageByCourse = new Map<string, Set<string>>();
  for (const row of raw.values()) {
    const set = coverageByCourse.get(row.course) || new Set<string>();
    splitGroupNames(row.groupName).forEach((group) => set.add(group));
    coverageByCourse.set(row.course, set);
  }

  const rows: Row[] = [...raw.values()].map((row) => {
    const coverage = coverageByCourse.get(row.course) || new Set<string>();
    const commonElective = allGroups.length > 0 && allGroups.every((group) => coverage.has(group));
    const common = row.compulsory || !row.groupName || commonElective;
    return { ...row, common };
  });

  // Aynı ortak seçmeli ders gruplar için ayrı kaydedilmişse tek satıra indir.
  const merged = new Map<string, Row>();
  for (const row of rows) {
    const key = row.common ? `${row.course}|${row.teacher}|COMMON` : `${row.course}|${row.teacher}|${row.groupName}`;
    const previous = merged.get(key);
    if (!previous) merged.set(key, row);
    else if (row.compulsory) merged.set(key, { ...previous, compulsory: true, common: true });
  }

  const groupOrder = classroomGroupNames(classroom);
  const groupRank = (groupName: string) => {
    const groups = splitGroupNames(groupName);
    if (!groups.length) return -1;
    const indexes = groups
      .map((group) => groupOrder.findIndex((item) => item.localeCompare(group, "tr", { sensitivity: "base" }) === 0))
      .filter((index) => index >= 0);
    return indexes.length ? Math.min(...indexes) : groupOrder.length + 1;
  };

  return [...merged.values()].sort((a, b) => {
    if (a.common !== b.common) return a.common ? -1 : 1;
    if (a.common && b.common) return a.course.localeCompare(b.course, "tr");
    const groupDiff = groupRank(a.groupName) - groupRank(b.groupName);
    if (groupDiff) return groupDiff;
    const groupNameDiff = a.groupName.localeCompare(b.groupName, "tr");
    if (groupNameDiff) return groupNameDiff;
    return a.course.localeCompare(b.course, "tr");
  });
}
function teacherClassCourseRows(teacher: Teacher, classrooms: Classroom[], scheduleData: ScheduleData) {
  const map = new Map<string, { className: string; course: string }>();

  for (const classroom of classrooms) {
    for (const assignment of classroom.assignedCourses || []) {
      const matches = assignment.teacherId === teacher.id || assignment.teacherId2 === teacher.id ||
        normalize(assignment.teacherName) === teacher.name || normalize(assignment.teacherName2) === teacher.name;
      if (!matches) continue;
      const course = normalize(assignment.courseName);
      if (!course) continue;
      map.set(`${classroom.name}|${course}`, { className: classroom.name, course });
    }
  }

  if (!map.size) {
    for (const [key, value] of Object.entries(scheduleData)) {
      if (!key.startsWith("class_")) continue;
      for (const item of asItems(value)) {
        const matches = normalize(item?.teacherName) === teacher.name || normalize(item?.teacherName2) === teacher.name;
        if (!matches) continue;
        const className = normalize(item?.className);
        const course = normalize(item?.courseName);
        if (!className || !course) continue;
        map.set(`${className}|${course}`, { className, course });
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const c = a.className.localeCompare(b.className, "tr", { numeric: true });
    return c || a.course.localeCompare(b.course, "tr");
  });
}

function detailTable(headers: string[], rows: string[][], widths: any[]) {
  const numericWidths = widths.map((width) => typeof width === "number" ? width : 100);
  const tableWidth = numericWidths.reduce((sum, width) => sum + width, 0);

  const headerRow = headers.map((text) => ({
    text,
    style: "detailHeader",
    alignment: "center",
    margin: [2, 4, 2, 4],
  }));

  const dataRows = rows.map((row, rowIndex) =>
    row.map((text, index) => ({
      text,
      style: index === 0 ? "detailNo" : "detailCell",
      alignment: "center",
      fillColor: rowIndex % 2 === 0 ? "#FFFFFF" : "#EEF1F4",
      margin: [2, 4.5, 2, 4.5],
    })),
  );

  const table = {
    table: {
      headerRows: 1,
      widths,
      body: [headerRow, ...dataRows],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };

  // Listeyi sayfanın yatay merkezine taşımak için iki esnek boşluk arasına yerleştir.
  return {
    columns: [
      { width: "*", text: "" },
      { width: tableWidth, stack: [table] },
      { width: "*", text: "" },
    ],
    columnGap: 0,
  };
}
function classPage(classroom: Classroom, scheduleData: ScheduleData, effectiveDate: string, principalName: string, pageBreak?: "before") {
  const advisorName = normalize(classroom.advisorTeacherName) || normalize(classroom.counselorTeacherName) || "Belirtilmedi";
  const classGroups = classroomGroupNames(classroom);
  const hasGroups = classGroups.length > 0;

  const courseRows = uniqueClassCourseRows(classroom, scheduleData);

  const rows = hasGroups
    ? courseRows.map((row, i) => [
        String(i + 1),
        row.common ? "ORTAK" : row.groupName,
        row.course,
        row.teacher || "-",
      ])
    : courseRows.map((row, i) => [
        String(i + 1),
        row.course,
        row.teacher || "-",
      ]);

  return {
    stack: [
      { text: SCHOOL_NAME, style: "schoolName", alignment: "center" },
      { text: `${classroom.name} HAFTALIK DERS PROGRAMI`, style: "pageTitle", alignment: "center", margin: [0, 1, 0, 3] },
      {
        columns: [
          { width: "70%", text: [{ text: "Rehber Öğretmen: ", bold: true }, advisorName], style: "meta" },
          { width: "30%", text: [{ text: "Uygulama Tarihi: ", bold: true }, formatDate(effectiveDate)], style: "meta", alignment: "right" },
        ],
        margin: [0, 0, 0, 3],
      },
      scheduleTable((day, hour) => classCell(scheduleData, classroom, day, hour)),
      {
        columns: [
          { width: "60%", text: "" },
          {
            width: "40%",
            stack: [
              { text: formatDate(effectiveDate), alignment: "center", margin: [0, 31, 0, 0], fontSize: 7 },
              { text: principalName || "........................................", bold: true, alignment: "center", fontSize: 9 },
              { text: "Okul Müdürü", alignment: "center", fontSize: 8 },
              { text: "İmza", alignment: "center", fontSize: 6.5, margin: [0, 6, 0, 0], color: "#64748b" },
            ],
          },
        ],
      },
      { text: "", margin: [0, 10, 0, 0] },
    { text: "DERS / ÖĞRETMEN LİSTESİ", bold: true, fontSize: 8, alignment: "center", margin: [0, 0, 0, 3] },
      hasGroups
      ? detailTable(
          ["Sıra No", "Grup", "Ders", "Derse Giren Öğretmen"],
          rows.length ? rows : [["1", "-", "-", "-"]],
          [28, 44, 112, 150],
        )
      : detailTable(
          ["Sıra No", "Ders", "Derse Giren Öğretmen"],
          rows.length ? rows : [["1", "-", "-"]],
          [28, 126, 156],
        ),
    ],
    ...(pageBreak ? { pageBreak } : {}),
  };
}

function teacherPage(teacher: Teacher, classrooms: Classroom[], scheduleData: ScheduleData, effectiveDate: string, principalName: string, pageBreak?: "before") {
  const rows = teacherClassCourseRows(teacher, classrooms, scheduleData).map((row, i) => [String(i + 1), row.className, row.course]);

  return {
    stack: [
      { text: SCHOOL_NAME, style: "schoolName", alignment: "center" },
      { text: `${teacher.name} HAFTALIK DERS PROGRAMI`, style: "pageTitle", alignment: "center", margin: [0, 1, 0, 3] },
      {
        columns: [
          { width: "70%", text: teacher.branch ? `Branş: ${teacher.branch}` : "Öğretmen Ders Programı", style: "meta" },
          { width: "30%", text: [{ text: "Uygulama Tarihi: ", bold: true }, formatDate(effectiveDate)], style: "meta", alignment: "right" },
        ],
        margin: [0, 0, 0, 5],
      },
      scheduleTable((day, hour) => teacherCell(scheduleData, teacher, day, hour)),
      {
        columns: [
          {
            width: "50%",
            stack: [
              { text: formatDate(effectiveDate), alignment: "center", margin: [0, 7, 0, 1], fontSize: 8 },
              { text: teacher.name, bold: true, alignment: "center", fontSize: 9 },
              { text: "Öğretmen", alignment: "center", fontSize: 8 },
              { text: "İmza", alignment: "center", fontSize: 7, margin: [0, 12, 0, 0], color: "#64748b" },
            ],
          },
          {
            width: "50%",
            stack: [
              { text: formatDate(effectiveDate), alignment: "center", margin: [0, 7, 0, 1], fontSize: 8 },
              { text: principalName || "........................................", bold: true, alignment: "center", fontSize: 9 },
              { text: "Okul Müdürü", alignment: "center", fontSize: 8 },
              { text: "İmza", alignment: "center", fontSize: 7, margin: [0, 12, 0, 0], color: "#64748b" },
            ],
          },
        ],
      },
      { text: "SINIF / DERS LİSTESİ", bold: true, fontSize: 9, margin: [0, 4, 0, 3] },
      detailTable(["Sıra No", "Sınıf", "Ders"], rows.length ? rows : [["1", "-", "-"]], [42, "35%", "*"]),
    ],
    ...(pageBreak ? { pageBreak } : {}),
  };
}

function documentDefinition(pages: any[]) {
  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [24, 18, 24, 18],
    content: pages,
    styles: {
      schoolName: { fontSize: 9, bold: true, color: "#166534" },
      pageTitle: { fontSize: 13, bold: true, color: "#0f172a" },
      meta: { fontSize: 8, color: "#0f172a" },
      tableHeader: { fontSize: 7.4, bold: true, color: "#ffffff", fillColor: "#166534", alignment: "center", valign: "middle" },
      hourCell: { fontSize: 7, bold: true, alignment: "center", color: "#0f172a" },
      scheduleCell: { fontSize: 5.8, color: "#0f172a", alignment: "center", valign: "middle", lineHeight: 1.0 },
      detailHeader: { fontSize: 6.3, bold: true, fillColor: "#D9DEE3", color: "#0f172a", alignment: "center" },
      detailNo: { fontSize: 6.2, alignment: "center", color: "#0f172a" },
      detailCell: { fontSize: 6.2, alignment: "center", color: "#0f172a" },
    },
    defaultStyle: { fontSize: 7.5 },
  };
}

export async function downloadClassSchedulesPdf({
  classrooms,
  scheduleData,
  effectiveDate,
}: {
  classrooms: Classroom[];
  scheduleData: ScheduleData;
  effectiveDate: string;
}) {
  if (!classrooms.length) throw new Error("PDF oluşturulacak sınıf bulunamadı.");
  const principalName = getPrincipalName();
  const pages = classrooms.map((classroom, index) => classPage(
    classroom,
    scheduleData,
    effectiveDate,
    principalName,
    index > 0 ? "before" : undefined,
  ));
  return PdfEngine.generate(documentDefinition(pages), {
    mode: "blob",
    filename: classrooms.length === 1
      ? `${classrooms[0].name}-ders-programi.pdf`
      : "tum-siniflar-ders-programlari.pdf",
  });
}

export async function downloadTeacherSchedulesPdf({
  teachers,
  classrooms,
  scheduleData,
  effectiveDate,
}: {
  teachers: Teacher[];
  classrooms: Classroom[];
  scheduleData: ScheduleData;
  effectiveDate: string;
}) {
  if (!teachers.length) throw new Error("PDF oluşturulacak öğretmen bulunamadı.");
  const principalName = getPrincipalName();
  const pages = teachers.map((teacher, index) => teacherPage(
    teacher,
    classrooms,
    scheduleData,
    effectiveDate,
    principalName,
    index > 0 ? "before" : undefined,
  ));
  return PdfEngine.generate(documentDefinition(pages), {
    mode: "blob",
    filename: teachers.length === 1
      ? `${teachers[0].name}-ders-programi.pdf`
      : "tum-ogretmenler-ders-programlari.pdf",
  });
}
