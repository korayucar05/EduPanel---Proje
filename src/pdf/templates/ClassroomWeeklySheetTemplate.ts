import { PdfEngine } from "../core/PdfEngine";

export interface ClassroomWeeklySheetData {
  classroomName: string;
  advisorTeacherName?: string;
  days?: string[];
  lessonTimes: Array<{ label: string; start?: string; end?: string }>;
  schedule: Record<string, Record<string, { course?: string; teacher?: string } | string | undefined>>;
  students: Array<{ name: string; number?: string | number }>;
  schoolName?: string;
}

/** One-page portrait A4 classroom programme + two-column roster. */
export function buildClassroomWeeklySheet(data: ClassroomWeeklySheetData): Record<string, any> {
  const days = data.days?.length ? data.days : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  const cell = (value: any) => {
    if (!value) return { text: "—", color: "#94A3B8", alignment: "center" };
    if (typeof value === "string") return { text: value, alignment: "center", fontSize: 7.5 };
    return { stack: [{ text: value.course || "—", bold: true, color: "#173B57" }, ...(value.teacher ? [{ text: value.teacher, color: "#64748B", fontSize: 6.3, margin: [0, 2, 0, 0] }] : [])], alignment: "center", fontSize: 7.4, margin: [2, 3, 2, 3] };
  };
  const header = [{ text: "GÜN / DERS", style: "tableHead" }, ...data.lessonTimes.map(t => ({ text: `${t.label}\n${t.start || ""}${t.end ? `–${t.end}` : ""}`, style: "tableHead" }))];
  const body = [header, ...days.map(day => [{ text: day.toLocaleUpperCase("tr-TR"), style: "dayHead" }, ...data.lessonTimes.map(t => cell(data.schedule?.[day]?.[t.label]))])];
  const left = data.students.filter((_, i) => i % 2 === 0); const right = data.students.filter((_, i) => i % 2 === 1);
  const roster = Array.from({ length: Math.max(left.length, right.length) }, (_, i) => [left[i] ? `${left[i].number ? `${left[i].number}  ` : ""}${left[i].name}` : "", right[i] ? `${right[i].number ? `${right[i].number}  ` : ""}${right[i].name}` : ""]);
  return { pageSize: "A4", pageOrientation: "portrait", pageMargins: [28, 28, 28, 24], info: { title: `${data.classroomName} Ders Programı` }, background: [{ canvas: [{ type: "rect", x: 0, y: 0, w: 595, h: 7, color: "#0E7490" }, { type: "rect", x: 0, y: 7, w: 595, h: 3, color: "#BFE7F2" }, { type: "ellipse", x: 575, y: 815, r1: 75, r2: 35, color: "#E7F5F9" }] }], content: [
    { text: data.schoolName || "e-Nstitü", style: "eyebrow", alignment: "center" },
    { text: `${data.classroomName} DERS PROGRAMI`, style: "title", alignment: "center" },
    { columns: [{ text: "HAFTALIK DERS PLANI", style: "section" }, { text: `Sınıf Öğretmeni: ${data.advisorTeacherName || "—"}`, alignment: "right", style: "teacher" }], margin: [0, 0, 0, 8] },
    { table: { headerRows: 1, widths: [58, ...data.lessonTimes.map(() => "*")], body }, layout: { fillColor: (row: number) => row === 0 ? "#12324A" : row % 2 ? "#FFFFFF" : "#F1F7FA", hLineColor: (i: number) => i === 1 ? "#0E7490" : "#D7E2E8", vLineColor: () => "#D7E2E8", hLineWidth: (i: number) => i === 1 ? 1.2 : .5, paddingTop: () => 7, paddingBottom: () => 7 } },
    { text: "SINIF LİSTESİ", style: "section", margin: [0, 16, 0, 6] },
    { table: { widths: ["*", "*"], body: roster.map(r => r.map(v => ({ text: v || " ", fontSize: 8.5, color: "#334155", margin: [8, 4, 8, 4] }))) }, layout: { fillColor: (row: number) => row % 2 ? "#F5F9FB" : "#FFFFFF", hLineColor: () => "#DDE7EC", vLineColor: () => "#DDE7EC", paddingTop: () => 2, paddingBottom: () => 2 } }
  ], styles: { eyebrow: { fontSize: 8, color: "#5B7184", bold: true, characterSpacing: 1.2 }, title: { fontSize: 18, bold: true, color: "#173B57", margin: [0, 3, 0, 10] }, section: { fontSize: 9, bold: true, color: "#0E7490", characterSpacing: 0.8 }, teacher: { fontSize: 8, color: "#475569" }, tableHead: { color: "#FFFFFF", bold: true, fontSize: 7, alignment: "center", margin: [2, 4, 2, 4] }, dayHead: { bold: true, color: "#173B57", fontSize: 8, alignment: "center" } } };
}

export async function downloadClassroomWeeklySheet(data: ClassroomWeeklySheetData, filename?: string) { return PdfEngine.generate(buildClassroomWeeklySheet(data), { filename: filename || `${data.classroomName}-ders-programi.pdf` }); }
