import type { Classroom, Teacher } from "../../types";
import { PdfEngine } from "../../pdf";
import { formatCourseName } from "../../utils/courseNameFormat";

type LoadCell = {
  classroomName: string;
  hours: number;
};

type TeacherColumn = {
  teacher: Teacher;
  shortName: string;
  branch: string;
};

function normalize(value: unknown) {
  return String(value || "").trim();
}

function canonicalCourseKey(value: unknown) {
  return normalize(value)
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR");
}

function preferredCourseName(current: string | undefined, candidate: string) {
  if (!current) return candidate;
  // Aynı ders farklı "ve/Ve/VE" yazılmışsa ilk temiz görünen adı koru.
  // Tamamı büyük harf olan varyant yerine normal başlık biçimini tercih et.
  const currentUpper = current === current.toLocaleUpperCase("tr-TR");
  const candidateUpper = candidate === candidate.toLocaleUpperCase("tr-TR");
  if (currentUpper && !candidateUpper) return candidate;
  return current;
}

function trSort(a: string, b: string) {
  return a.localeCompare(b, "tr", { sensitivity: "base", numeric: true });
}

export function shortTeacherName(name: string) {
  const parts = normalize(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return "-";
  if (parts.length === 1) return parts[0];
  return `${parts[0].charAt(0).toLocaleUpperCase("tr-TR")}. ${parts[parts.length - 1]}`;
}

export function sortTeachersByBranch(teachers: Teacher[]): TeacherColumn[] {
  return [...teachers]
    .sort((a, b) => {
      const branchDiff = trSort(normalize(a.branch), normalize(b.branch));
      if (branchDiff) return branchDiff;
      return trSort(normalize(a.name), normalize(b.name));
    })
    .map((teacher) => ({
      teacher,
      shortName: shortTeacherName(teacher.name),
      branch: normalize(teacher.branch) || "Branş Belirtilmemiş",
    }));
}

function buildLoadModel(classrooms: Classroom[], teachers: Teacher[]) {
  const teacherColumns = sortTeachersByBranch(teachers);
  const teacherIds = new Set(teacherColumns.map((item) => item.teacher.id));

  const courseNames = new Map<string, string>();
  const cellMap = new Map<string, LoadCell[]>();
  const teacherTotals = new Map<string, number>();
  const courseTotalsByKey = new Map<string, number>();

  const countedCourseClass = new Set<string>();

  for (const classroom of classrooms) {
    for (const assignment of classroom.assignedCourses || []) {
      const rawCourse = normalize(assignment.courseName);
      const courseKey = canonicalCourseKey(rawCourse);
      const hours = Number(assignment.weeklyHours || 0);
      if (!courseKey || hours <= 0) continue;

      courseNames.set(courseKey, formatCourseName(preferredCourseName(courseNames.get(courseKey), rawCourse)));

      const courseClassKey = `${classroom.id}|${courseKey}`;
      if (!countedCourseClass.has(courseClassKey)) {
        countedCourseClass.add(courseClassKey);
        courseTotalsByKey.set(courseKey, (courseTotalsByKey.get(courseKey) || 0) + hours);
      }

      const assignedTeachers = [
        { id: normalize(assignment.teacherId), name: normalize(assignment.teacherName) },
        { id: normalize(assignment.teacherId2), name: normalize(assignment.teacherName2) },
      ].filter((item) => item.id && teacherIds.has(item.id));

      for (const assigned of assignedTeachers) {
        const key = `${courseKey}|${assigned.id}`;
        const list = cellMap.get(key) || [];
        const existing = list.find((item) => item.classroomName === classroom.name);
        if (existing) existing.hours += hours;
        else list.push({ classroomName: classroom.name, hours });
        cellMap.set(key, list);
        teacherTotals.set(assigned.id, (teacherTotals.get(assigned.id) || 0) + hours);
      }
    }
  }

  const courseKeys = [...courseNames.keys()].sort((a, b) =>
    trSort(courseNames.get(a) || a, courseNames.get(b) || b),
  );
  for (const list of cellMap.values()) {
    list.sort((a, b) => trSort(a.classroomName, b.classroomName));
  }

  const courseTotals = new Map<string, number>();
  courseKeys.forEach((key) => courseTotals.set(courseNames.get(key) || key, courseTotalsByKey.get(key) || 0));

  return {
    teacherColumns,
    courseKeys,
    courseNames,
    courseList: courseKeys.map((key) => courseNames.get(key) || key),
    cellMap,
    teacherTotals,
    courseTotals,
    courseTotalsByKey,
  };
}
export function buildTeacherLoadRows(classrooms: Classroom[], teachers: Teacher[]) {
  const model = buildLoadModel(classrooms, teachers);
  return {
    ...model,
    rows: model.courseKeys.map((courseKey) => {
      const course = model.courseNames.get(courseKey) || courseKey;
      return {
        course,
        cells: model.teacherColumns.map(({ teacher }) => ({
          teacherId: teacher.id,
          entries: model.cellMap.get(`${courseKey}|${teacher.id}`) || [],
        })),
        total: model.courseTotalsByKey.get(courseKey) || 0,
      };
    }),
  };
}
function branchBoundaryIndexes(columns: TeacherColumn[]) {
  const boundaries = new Set<number>();
  for (let i = 1; i < columns.length; i += 1) {
    if (columns[i - 1].branch !== columns[i].branch) boundaries.add(i + 1);
  }
  return boundaries;
}

function makePage(
  model: ReturnType<typeof buildLoadModel>,
  columns: TeacherColumn[],
  pageNo: number,
  pageCount: number,
) {
  const boundaries = branchBoundaryIndexes(columns);
  const body: any[][] = [];

  body.push([
    { text: "Ders", bold: true, alignment: "center", noWrap: true, fillColor: "#D9E2F3" },
    ...columns.map((item) => ({
      text: [
        { text: item.shortName, bold: true, fontSize: 6.1 },
        { text: `\n${item.branch}`, fontSize: 4.4, color: "#475569" },
      ],
      alignment: "center",
      fillColor: "#D9E2F3",
    })),
    { text: "Ders\nToplamı", bold: true, alignment: "center", fillColor: "#D9E2F3" },
  ]);

  model.courseKeys.forEach((courseKey, courseIndex) => {
    const course = model.courseNames.get(courseKey) || courseKey;
    const rowFill = courseIndex % 2 === 0 ? "#FFFFFF" : "#EEF1F4";
    body.push([
      { text: course, bold: true, fontSize: 6.2, alignment: "center", noWrap: true, fillColor: rowFill },
      ...columns.map(({ teacher }) => {
        const entries = model.cellMap.get(`${course}|${teacher.id}`) || [];
        const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
        return {
          text: totalHours > 0 ? String(totalHours) : "",
          alignment: "center",
          fontSize: 6,
          fillColor: rowFill,
        };
      }),
      {
        text: String(model.courseTotalsByKey.get(courseKey) || 0),
        bold: true,
        alignment: "center",
        fontSize: 6.2,
        fillColor: rowFill,
      },
    ]);
  });

  body.push([
    { text: "Toplam Ders Saati", bold: true, alignment: "center", fillColor: "#E2E8F0" },
    ...columns.map(({ teacher }) => ({
      text: String(model.teacherTotals.get(teacher.id) || 0),
      bold: true,
      alignment: "center",
      fillColor: "#E2E8F0",
    })),
    {
      text: String([...model.courseTotals.values()].reduce((sum, value) => sum + value, 0)),
      bold: true,
      alignment: "center",
      fillColor: "#CBD5E1",
    },
  ]);

  // A3 yatay genişlik yaklaşık 1190.55 pt.
  // Sağ ve sol kenarda 5 mm (yaklaşık 14.17 pt) yazdırma boşluğu bırakılır.
  const sideMargin = 14.1732; // 5 mm
  const a3LandscapeWidth = 1190.551;
  const usableWidth = a3LandscapeWidth - (sideMargin * 2);

  // Ders adı tek satırda kalırken tablo toplamı kesinlikle kullanılabilir genişliği aşmaz.
  const courseWidth = 145;
  const totalWidth = 42;
  const remainingWidth = Math.max(1, usableWidth - courseWidth - totalWidth);
  const teacherWidth = remainingWidth / Math.max(1, columns.length);

  return [
    {
      columns: [
        { text: "ORDU LİSESİ", bold: true, fontSize: 11 },
        { text: "DERS YÜKÜ DAĞILIMI", bold: true, fontSize: 12, alignment: "center" },
        { text: `${pageNo}/${pageCount}`, fontSize: 7, alignment: "right" },
      ],
      margin: [0, 0, 0, 5],
    },
    {
      table: {
        headerRows: 1,
        widths: [courseWidth, ...columns.map(() => teacherWidth), totalWidth],
        body,
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 || i === body.length ? 1 : 0.35),
        vLineWidth: (i: number) => {
          if (i === 0 || i === columns.length + 2) return 1;
          return boundaries.has(i) ? 1.8 : 0.35;
        },
        hLineColor: () => "#64748B",
        vLineColor: () => "#475569",
        paddingLeft: () => 0.6,
        paddingRight: () => 0.6,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
    },
  ];
}

export async function generateTeacherLoadPdf({
  classrooms,
  teachers,
}: {
  classrooms: Classroom[];
  teachers: Teacher[];
}) {
  const model = buildLoadModel(classrooms, teachers);
  if (!model.teacherColumns.length) throw new Error("Ders yükü oluşturulacak öğretmen bulunamadı.");

  const chunks: TeacherColumn[][] = [];
  for (let i = 0; i < model.teacherColumns.length; i += 30) {
    chunks.push(model.teacherColumns.slice(i, i + 30));
  }

  const content: any[] = [];
  chunks.forEach((chunk, index) => {
    if (index > 0) content.push({ text: "", pageBreak: "before" });
    content.push(...makePage(model, chunk, index + 1, chunks.length));
  });

  return PdfEngine.generate(
    {
      pageSize: "A3",
      pageOrientation: "landscape",
      pageMargins: [14.1732, 18, 14.1732, 18],
      content,
      defaultStyle: { fontSize: 5.4 },
    },
    {
      mode: "blob",
      filename: "ders-yuku-dagilimi-a3.pdf",
    },
  );
}


export function buildClassLoadRows(classrooms: Classroom[]) {
  const sortedClassrooms = [...classrooms].sort((a, b) => trSort(a.name, b.name));
  const courseNames = new Map<string, string>();
  const courseClassHours = new Map<string, number>();
  const courseTotalsByKey = new Map<string, number>();
  const classTotals = new Map<string, number>();

  for (const classroom of sortedClassrooms) {
    for (const assignment of classroom.assignedCourses || []) {
      const rawCourse = normalize(assignment.courseName);
      const courseKey = canonicalCourseKey(rawCourse);
      const hours = Number(assignment.weeklyHours || 0);
      if (!courseKey || hours <= 0) continue;

      courseNames.set(courseKey, formatCourseName(preferredCourseName(courseNames.get(courseKey), rawCourse)));

      const key = `${courseKey}|${classroom.id}`;
      const current = courseClassHours.get(key) || 0;
      // Grup/öğretmen tekrarlarından dolayı aynı dersin iki kez sayılmasını engelle.
      if (hours > current) courseClassHours.set(key, hours);
    }
  }

  const courseKeys = [...courseNames.keys()].sort((a, b) =>
    trSort(courseNames.get(a) || a, courseNames.get(b) || b),
  );

  for (const courseKey of courseKeys) {
    let courseTotal = 0;
    for (const classroom of sortedClassrooms) {
      const hours = courseClassHours.get(`${courseKey}|${classroom.id}`) || 0;
      courseTotal += hours;
      classTotals.set(classroom.id, (classTotals.get(classroom.id) || 0) + hours);
    }
    courseTotalsByKey.set(courseKey, courseTotal);
  }

  const courseTotals = new Map<string, number>();
  courseKeys.forEach((key) =>
    courseTotals.set(courseNames.get(key) || key, courseTotalsByKey.get(key) || 0),
  );

  return {
    classrooms: sortedClassrooms,
    courseKeys,
    courseList: courseKeys.map((key) => courseNames.get(key) || key),
    courseNames,
    courseClassHours,
    courseTotals,
    courseTotalsByKey,
    classTotals,
    rows: courseKeys.map((courseKey) => ({
      course: courseNames.get(courseKey) || courseKey,
      cells: sortedClassrooms.map((classroom) => ({
        classroomId: classroom.id,
        hours: courseClassHours.get(`${courseKey}|${classroom.id}`) || 0,
      })),
      total: courseTotalsByKey.get(courseKey) || 0,
    })),
  };
}
export async function generateClassLoadPdf({
  classrooms,
}: {
  classrooms: Classroom[];
}) {
  const model = buildClassLoadRows(classrooms);
  if (!model.classrooms.length) throw new Error("Ders / Sınıf tablosu oluşturulacak sınıf bulunamadı.");

  const chunks: Classroom[][] = [];
  for (let i = 0; i < model.classrooms.length; i += 30) {
    chunks.push(model.classrooms.slice(i, i + 30));
  }

  const content: any[] = [];
  const sideMargin = 14.1732; // 5 mm
  const a3LandscapeWidth = 1190.551;
  const usableWidth = a3LandscapeWidth - (sideMargin * 2);

  chunks.forEach((chunk, pageIndex) => {
    if (pageIndex > 0) content.push({ text: "", pageBreak: "before" });

    const courseWidth = 145;
    const totalWidth = 42;
    const classWidth = (usableWidth - courseWidth - totalWidth) / Math.max(1, chunk.length);

    const body: any[][] = [
      [
        { text: "Ders", bold: true, alignment: "center", fillColor: "#D9E2F3", noWrap: true },
        ...chunk.map((classroom) => ({
          text: classroom.name,
          bold: true,
          alignment: "center",
          fillColor: "#D9E2F3",
          fontSize: 6,
        })),
        { text: "Ders\nToplamı", bold: true, alignment: "center", fillColor: "#D9E2F3" },
      ],
    ];

    model.courseKeys.forEach((courseKey, courseIndex) => {
      const course = model.courseNames.get(courseKey) || courseKey;
      const rowFill = courseIndex % 2 === 0 ? "#FFFFFF" : "#EEF1F4";
      body.push([
        { text: course, bold: true, alignment: "center", noWrap: true, fillColor: rowFill, fontSize: 6.2 },
        ...chunk.map((classroom) => {
          const hours = model.courseClassHours.get(`${courseKey}|${classroom.id}`) || 0;
          return {
            text: hours > 0 ? String(hours) : "",
            alignment: "center",
            fillColor: rowFill,
            fontSize: 6.2,
          };
        }),
        {
          text: String(model.courseTotalsByKey.get(courseKey) || 0),
          bold: true,
          alignment: "center",
          fillColor: rowFill,
          fontSize: 6.2,
        },
      ]);
    });

    body.push([
      { text: "Toplam Ders Saati", bold: true, alignment: "center", fillColor: "#E2E8F0" },
      ...chunk.map((classroom) => ({
        text: String(model.classTotals.get(classroom.id) || 0),
        bold: true,
        alignment: "center",
        fillColor: "#E2E8F0",
      })),
      {
        text: String([...model.courseTotals.values()].reduce((sum, value) => sum + value, 0)),
        bold: true,
        alignment: "center",
        fillColor: "#CBD5E1",
      },
    ]);

    content.push(
      {
        columns: [
          { text: "ORDU LİSESİ", bold: true, fontSize: 11 },
          { text: "DERS / SINIF DERS YÜKÜ", bold: true, fontSize: 12, alignment: "center" },
          { text: `${pageIndex + 1}/${chunks.length}`, fontSize: 7, alignment: "right" },
        ],
        margin: [0, 0, 0, 5],
      },
      {
        table: {
          headerRows: 1,
          widths: [courseWidth, ...chunk.map(() => classWidth), totalWidth],
          body,
        },
        layout: {
          hLineWidth: (i: number) => (i === 0 || i === body.length ? 1 : 0.35),
          vLineWidth: (i: number) => (i === 0 || i === chunk.length + 2 ? 1 : 0.35),
          hLineColor: () => "#64748B",
          vLineColor: () => "#64748B",
          paddingLeft: () => 0.6,
          paddingRight: () => 0.6,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
      },
    );
  });

  return PdfEngine.generate(
    {
      pageSize: "A3",
      pageOrientation: "landscape",
      pageMargins: [14.1732, 18, 14.1732, 18],
      content,
      defaultStyle: { fontSize: 5.6 },
    },
    {
      mode: "blob",
      filename: "ders-sinif-ders-yuku-a3.pdf",
    },
  );
}
