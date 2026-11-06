import type { Classroom, Teacher } from "../../types";
import { PdfEngine } from "../../pdf";
import { formatCourseName } from "../../utils/courseNameFormat";

function normalize(value: unknown) {
  return String(value || "").trim();
}

function key(value: unknown) {
  return normalize(value).replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

function trSort(a: string, b: string) {
  return a.localeCompare(b, "tr", { sensitivity: "base", numeric: true });
}

function classSortKey(name: string) {
  const match = normalize(name).match(/(\d+)\s*[/\- ]?\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9]*)/);
  return {
    grade: match ? Number(match[1]) : 99,
    branch: match ? normalize(match[2]) : normalize(name),
  };
}

function tableLayout() {
  return {
    hLineWidth: () => 0.45,
    vLineWidth: () => 0.45,
    hLineColor: () => "#94A3B8",
    vLineColor: () => "#94A3B8",
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 3.5,
    paddingBottom: () => 3.5,
  };
}

export async function generateClassCoursesListPdf(classrooms: Classroom[]) {
  const sorted = [...classrooms].sort((a, b) => trSort(a.name, b.name));
  const content: any[] = [];

  sorted.forEach((classroom, pageIndex) => {
    if (pageIndex > 0) content.push({ text: "", pageBreak: "before" });

    const groups = Array.from(new Set([
      ...(Array.isArray((classroom as any).groups) ? (classroom as any).groups : []),
      (classroom as any).group1Name,
      (classroom as any).group2Name,
    ].map(normalize).filter(Boolean)));

    const merged = new Map<string, { courseName: string; teachers: Set<string>; common: boolean }>();

    for (const assignment of classroom.assignedCourses || []) {
      const courseName = normalize(assignment.courseName);
      if (!courseName) continue;
      const courseKey = key(courseName);
      const groupName = normalize((assignment as any).groupName);
      const groupParts = groupName.split(/[,/+]+/).map((x) => x.trim()).filter(Boolean);
      const type = normalize((assignment as any).type);
      const compulsory = type === "compulsory" || type === "Zorunlu Ders";
      const shared = groups.length > 0 && (groupParts.length === 0 || groups.every((g) => groupParts.includes(g)));
      const common = compulsory || !groupName || shared;

      const entry = merged.get(courseKey) || { courseName: formatCourseName(courseName), teachers: new Set<string>(), common };
      [normalize((assignment as any).teacherName), normalize((assignment as any).teacherName2)]
        .filter(Boolean)
        .forEach((teacher) => entry.teachers.add(teacher));
      entry.common = entry.common || common;
      merged.set(courseKey, entry);
    }

    const rows = [...merged.values()].sort((a, b) => {
      if (a.common !== b.common) return a.common ? -1 : 1;
      return trSort(a.courseName, b.courseName);
    });

    content.push(
      { text: classroom.name, alignment: "center", bold: true, fontSize: 15, margin: [0, 0, 0, 10] },
      {
        table: {
          headerRows: 1,
          widths: [38, 190, "*"],
          body: [
            [
              { text: "Sıra No", bold: true, alignment: "center", fillColor: "#E2E8F0" },
              { text: "Ders Adı", bold: true, alignment: "center", fillColor: "#E2E8F0" },
              { text: "Derse Giren Öğretmen(ler)", bold: true, alignment: "center", fillColor: "#E2E8F0" },
            ],
            ...rows.map((row, index) => [
              { text: String(index + 1), alignment: "center", fillColor: index % 2 ? "#F8FAFC" : "#FFFFFF" },
              { text: row.courseName, bold: row.common, fillColor: index % 2 ? "#F8FAFC" : "#FFFFFF" },
              { text: [...row.teachers].sort(trSort).join(" / ") || "-", fillColor: index % 2 ? "#F8FAFC" : "#FFFFFF" },
            ]),
          ],
        },
        layout: tableLayout(),
      },
    );
  });

  return PdfEngine.generate({
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [28, 28, 28, 28],
    content,
    defaultStyle: { fontSize: 9 },
  }, {
    mode: "blob",
    filename: "sinif-dersleri-a4.pdf",
  });
}

export async function generateTeacherCoursesListPdf(classrooms: Classroom[], teachers: Teacher[]) {
  const sortedTeachers = [...teachers].sort((a, b) => trSort(a.name, b.name));
  const content: any[] = [];

  sortedTeachers.forEach((teacher, pageIndex) => {
    if (pageIndex > 0) content.push({ text: "", pageBreak: "before" });

    const merged = new Map<string, { classroomName: string; courseName: string }>();

    for (const classroom of classrooms) {
      for (const assignment of classroom.assignedCourses || []) {
        const ids = [normalize((assignment as any).teacherId), normalize((assignment as any).teacherId2)];
        if (!ids.includes(teacher.id)) continue;
        const courseName = normalize(assignment.courseName);
        const rowKey = `${classroom.id}|${key(courseName)}`;
        merged.set(rowKey, { classroomName: classroom.name, courseName: formatCourseName(courseName) });
      }
    }

    const rows = [...merged.values()].sort((a, b) => {
      const ak = classSortKey(a.classroomName);
      const bk = classSortKey(b.classroomName);
      if (ak.grade !== bk.grade) return ak.grade - bk.grade;
      const branch = trSort(ak.branch, bk.branch);
      if (branch) return branch;
      return trSort(a.courseName, b.courseName);
    });

    content.push(
      { text: teacher.name, alignment: "center", bold: true, fontSize: 15, margin: [0, 0, 0, 10] },
      {
        table: {
          headerRows: 1,
          widths: [38, 130, "*"],
          body: [
            [
              { text: "Sıra No", bold: true, alignment: "center", fillColor: "#E2E8F0" },
              { text: "Sınıf", bold: true, alignment: "center", fillColor: "#E2E8F0" },
              { text: "Ders", bold: true, alignment: "center", fillColor: "#E2E8F0" },
            ],
            ...rows.map((row, index) => [
              { text: String(index + 1), alignment: "center", fillColor: index % 2 ? "#F8FAFC" : "#FFFFFF" },
              { text: row.classroomName, alignment: "center", fillColor: index % 2 ? "#F8FAFC" : "#FFFFFF" },
              { text: row.courseName, fillColor: index % 2 ? "#F8FAFC" : "#FFFFFF" },
            ]),
          ],
        },
        layout: tableLayout(),
      },
    );
  });

  return PdfEngine.generate({
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [28, 28, 28, 28],
    content,
    defaultStyle: { fontSize: 9 },
  }, {
    mode: "blob",
    filename: "ogretmen-dersleri-a4.pdf",
  });
}