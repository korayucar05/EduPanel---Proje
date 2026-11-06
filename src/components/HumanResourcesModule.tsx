import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  Users,
  GraduationCap,
  Plus,
  FileSpreadsheet,
  List,
  Building2,
  Tags,
  Trash2,
  UploadCloud,
  X,
  Printer,
  UsersRound,
  UserPlus,
  ClipboardCheck,
  BookOpen,
  QrCode
} from "lucide-react";
import { Classroom, Course, Student, Teacher } from "../types";

import { sqliteStorage } from "../core/state/SyncStateStore";

const StudentModule = lazy(() => import("./StudentModule"));
const TeacherModule = lazy(() => import("./TeacherModule"));
const CourseModule = lazy(() => import("./CourseModule"));

function InnerModuleFallback({ label }: { label: string }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center p-8" role="status" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-purple-900" />
        <p className="mt-3 text-sm font-semibold text-slate-600">{label} yükleniyor…</p>
      </div>
    </div>
  );
}
interface HumanResourcesModuleProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  teachers: Teacher[];
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  classrooms: Classroom[];
  setClassrooms: React.Dispatch<React.SetStateAction<Classroom[]>>;
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  customCreatedCourses: any[];
  setCustomCreatedCourses: React.Dispatch<React.SetStateAction<any[]>>;
  initialSubTab?: "teachers" | "students";
}

export default function HumanResourcesModule({
  students,
  setStudents,
  teachers,
  setTeachers,
  classrooms,
  setClassrooms,
  courses,
  setCourses,
  customCreatedCourses,
  setCustomCreatedCourses,
  initialSubTab = "teachers",
}: HumanResourcesModuleProps) {
  const [currentSubTab, setCurrentSubTab] = useState<
    "teachers" | "students" | "class-info" | "branch-definitions" | "courses" | "teacher-course-assign" | "curriculum"
  >(() => {
    try {
      const requested = sessionStorage.getItem("edupanel_hr_subtab_request");
      if (requested === "teacher-course-assign" || requested === "curriculum") {
        sessionStorage.removeItem("edupanel_hr_subtab_request");
        return requested;
      }
    } catch {}
    return initialSubTab;
  });
  const [teacherAssignmentShortcut, setTeacherAssignmentShortcut] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("edupanel_hr_teacher_assignment_shortcut") === "1";
    } catch {
      return false;
    }
  });
  const [teacherAssignmentClassroomId, setTeacherAssignmentClassroomId] = useState<string>(() => {
    try {
      return sessionStorage.getItem("edupanel_hr_teacher_assignment_class_id") || "";
    } catch {
      return "";
    }
  });
  const [teacherAssignmentClassPickerOpen, setTeacherAssignmentClassPickerOpen] = useState(false);
  const shortcutClassroom = classrooms.find((classroom) => String(classroom.id) === String(teacherAssignmentClassroomId));
  const teacherAssignmentClassroomOptions = React.useMemo(
    () => [...classrooms].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr", { numeric: true, sensitivity: "base" })),
    [classrooms],
  );
  const selectTeacherAssignmentClassroom = (classroomId: string) => {
    setTeacherAssignmentClassroomId(classroomId);
    setTeacherAssignmentClassPickerOpen(false);
    try {
      sessionStorage.setItem("edupanel_hr_teacher_assignment_class_id", classroomId);
    } catch {}
  };

  const [studentSection, setStudentSection] = useState<"new" | "excel" | "lists">("lists");
  const [studentRecordMenuOpen, setStudentRecordMenuOpen] = useState(false);
  const [studentListsDialogOpen, setStudentListsDialogOpen] = useState(false);
  const [studentRecordsDialogOpen, setStudentRecordsDialogOpen] = useState(false);
  const [studentRecordsView, setStudentRecordsView] = useState<"menu" | "deleted" | "new">("menu");
  const [deletedStudentRecords, setDeletedStudentRecords] = useState<any[]>([]);
  const [studentCommitmentOpen, setStudentCommitmentOpen] = useState(false);
  const [commitmentGrade, setCommitmentGrade] = useState<string>("");
  const [commitmentClassroom, setCommitmentClassroom] = useState<string>("");

  useEffect(() => {
    const handleRequestedSubTab = (event: Event) => {
      const detail = (event as CustomEvent<{ subTab?: string; shortcut?: boolean; classroomId?: string }>).detail || {};
      const requested = String(detail.subTab || "");
      if (requested !== "teacher-course-assign" && requested !== "curriculum") return;
      try {
        sessionStorage.removeItem("edupanel_hr_subtab_request");
        sessionStorage.setItem("edupanel_course_curriculum_standalone", "0");
      } catch {}

      if (requested === "curriculum") {
        setTeacherAssignmentShortcut(false);
        setTeacherAssignmentClassroomId("");
        setTeacherAssignmentClassPickerOpen(false);
        setCurrentSubTab("curriculum");
        return;
      }

      if (detail.shortcut === true) {
        setTeacherAssignmentShortcut(true);
        setTeacherAssignmentClassroomId(String(detail.classroomId || ""));
        setTeacherAssignmentClassPickerOpen(false);
      }
      setCurrentSubTab("teacher-course-assign");
    };

    const handleMode = (event: Event) => {
      const detail = (event as CustomEvent<{ shortcut?: boolean; classroomId?: string }>).detail || {};
      const shortcut = detail.shortcut === true;
      setTeacherAssignmentShortcut(shortcut);
      if (shortcut) {
        setTeacherAssignmentClassroomId(String(detail.classroomId || ""));
        setTeacherAssignmentClassPickerOpen(false);
        setCurrentSubTab("teacher-course-assign");
      } else {
        setTeacherAssignmentClassroomId("");
        setTeacherAssignmentClassPickerOpen(false);
      }
    };

    window.addEventListener("edupanel-human-resources-subtab", handleRequestedSubTab as EventListener);
    window.addEventListener("edupanel-human-resources-mode", handleMode as EventListener);
    return () => {
      window.removeEventListener("edupanel-human-resources-subtab", handleRequestedSubTab as EventListener);
      window.removeEventListener("edupanel-human-resources-mode", handleMode as EventListener);
    };
  }, []);

  const getStudentGrade = (student: Student) => {
    const match = String(student.classroom || "").trim().match(/^(\d{1,2})/);
    return match ? Number(match[1]) : null;
  };

  const commitmentGradeOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map(getStudentGrade)
            .filter((grade): grade is number => grade !== null),
        ),
      ).sort((a, b) => a - b),
    [students],
  );

  const commitmentClassroomOptions = React.useMemo(() => {
    if (!commitmentGrade) return [];
    const grade = Number(commitmentGrade);
    return Array.from(
      new Set(
        students
          .filter((student) => getStudentGrade(student) === grade)
          .map((student) => String(student.classroom || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) =>
      a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }),
    );
  }, [students, commitmentGrade]);

  const commitmentStudents = React.useMemo(() => {
    if (!commitmentGrade || !commitmentClassroom) return [];
    return students
      .filter(
        (student) =>
          getStudentGrade(student) === Number(commitmentGrade) &&
          String(student.classroom || "").trim() === commitmentClassroom,
      )
      .sort(
        (a, b) =>
          String(a.id).localeCompare(String(b.id), "tr", {
            numeric: true,
            sensitivity: "base",
          }) || a.name.localeCompare(b.name, "tr"),
      );
  }, [students, commitmentGrade, commitmentClassroom]);

  const createCommitmentPdf = async (mode: "download" | "print") => {
    if (!commitmentGrade || !commitmentClassroom || commitmentStudents.length === 0) {
      window.alert("PDF oluşturmak için sınıf seviyesi ve şube seçiniz.");
      return;
    }

    const { PdfEngine } = await import("../pdf");

    // 4 öğrenci / sayfa: okunaklı bilgi alanı + taahhüt + imza alanı için dengeli yerleşim.
    const studentsPerPage = 4;
    const pages = Array.from(
      { length: Math.ceil(commitmentStudents.length / studentsPerPage) },
      (_, pageIndex) =>
        commitmentStudents.slice(
          pageIndex * studentsPerPage,
          pageIndex * studentsPerPage + studentsPerPage,
        ),
    );

    const content: any[] = [];

    pages.forEach((pageStudents, pageIndex) => {
      content.push(
        {
          text: "ÖĞRENCİ BİLGİ TAAHHÜTNAMESİ",
          alignment: "center",
          fontSize: 16,
          bold: true,
          margin: [0, 0, 0, 4],
        },
        {
          text: `${commitmentClassroom} Sınıfı`,
          alignment: "center",
          fontSize: 11,
          bold: true,
          color: "#475569",
          margin: [0, 0, 0, 10],
        },
      );

      pageStudents.forEach((student, studentIndex) => {
        const infoRows = [
          ["Öğrenci No", String(student.id || "—"), "Sınıf / Şube", String(student.classroom || "—")],
          ["Ad Soyad", String(student.name || "—"), "Grup / Alan", String(student.group || "—")],
          ["Öğrenci Telefon", String(student.phone || "—"), "Veli Adı Soyadı", String(student.parentName || "—")],
          ["Veli Telefon", String(student.parentPhone || "—"), "Doğum Tarihi", String(student.dob || "—")],
          ["Doğum Yeri", String(student.pob || "—"), "Okul Puanı (OÖB)", student.oob !== undefined && student.oob !== null ? String(student.oob) : "—"],
          ["Adres", String(student.address || "—"), "", ""],
        ];

        content.push(
          {
            table: {
              widths: [70, "*", 72, "*"],
              body: infoRows.map((row, rowIndex) =>
                row.map((cell, cellIndex) => ({
                  text: cell,
                  fontSize: 8,
                  bold: cellIndex % 2 === 0 && Boolean(cell),
                  color: cellIndex % 2 === 0 ? "#475569" : "#0f172a",
                  margin: [3, 3, 3, 3],
                })),
              ),
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex % 2 === 0 ? "#f8fafc" : null),
              hLineColor: () => "#cbd5e1",
              vLineColor: () => "#cbd5e1",
              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6,
            },
            margin: [0, 0, 0, 5],
          },
          {
            text: "Verdiğim bilgilerin doğru olduğunu taahhüt ederim.",
            fontSize: 8.5,
            italics: true,
            color: "#334155",
            margin: [3, 0, 0, 5],
          },
          {
            columns: [
              {
                width: "30%",
                stack: [
                  { text: "Tarih", fontSize: 7.5, bold: true, color: "#64748b" },
                  { text: "…… / …… / 20……", fontSize: 8.5, margin: [0, 3, 0, 0] },
                ],
              },
              {
                width: "40%",
                stack: [
                  { text: "Öğrenci Adı Soyadı", fontSize: 7.5, bold: true, color: "#64748b", alignment: "center" },
                  { text: student.name || "………………………………", fontSize: 8.5, bold: true, alignment: "center", margin: [0, 3, 0, 0] },
                ],
              },
              {
                width: "30%",
                stack: [
                  { text: "İmza", fontSize: 7.5, bold: true, color: "#64748b", alignment: "right" },
                  { text: "\n", fontSize: 12 },
                ],
              },
            ],
            margin: [3, 0, 3, studentIndex === pageStudents.length - 1 ? 0 : 10],
          },
        );
      });

      if (pageIndex < pages.length - 1) {
        content.push({ text: "", pageBreak: "after" });
      }
    });

    const docDefinition: any = {
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [28, 24, 28, 24],
      info: {
        title: `${commitmentClassroom} Öğrenci Bilgi Taahhütnamesi`,
      },
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: commitmentClassroom, fontSize: 7, color: "#94a3b8", margin: [28, 0, 0, 0] },
          { text: `${currentPage} / ${pageCount}`, alignment: "right", fontSize: 7, color: "#94a3b8", margin: [0, 0, 28, 0] },
        ],
      }),
      defaultStyle: {
        fontSize: 9,
      },
      content,
    };

    const filename = `${commitmentClassroom.replace(/\s+/g, "_")}_ogrenci_bilgi_taahhutnamesi.pdf`;

    await PdfEngine.generate(
      docDefinition,
      {
        mode,
        filename,
      },
    );
  };


  const openStudentRecordsDialog = () => {
    try {
      const raw = sqliteStorage.getItem("student_deleted_records_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      setDeletedStudentRecords(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDeletedStudentRecords([]);
    }
    setStudentRecordsView("menu");
    setStudentRecordsDialogOpen(true);
  };

  const academicYearStart = React.useMemo(() => {
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(year, 8, 1);
  }, []);

  const newStudentsThisAcademicYear = React.useMemo(
    () =>
      students
        .filter((student) => {
          if (!student.registerDate) return false;
          const date = new Date(student.registerDate);
          return Number.isFinite(date.getTime()) && date >= academicYearStart;
        })
        .sort((a, b) =>
          String(b.registerDate || "").localeCompare(String(a.registerDate || "")),
        ),
    [students, academicYearStart],
  );
  const [newBranchName, setNewBranchName] = useState("");
  const [customBranches, setCustomBranches] = useState<string[]>(() => {
    try {
      const saved = sqliteStorage.getItem("custom_teacher_branches_v1");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const visibleBranches = React.useMemo(
    () => [...new Set([
      ...customBranches,
      ...teachers.map((teacher) => String(teacher.branch || "").trim()).filter(Boolean),
      ...courses.map((course) => String(course.branch || "").trim()).filter(Boolean),
    ])].sort((left, right) => left.localeCompare(right, "tr")),
    [customBranches, teachers, courses],
  );

  const saveCustomBranches = (branches: string[]) => {
    const normalized = [...new Set(branches.map((branch) => branch.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "tr"));
    setCustomBranches(normalized);
    sqliteStorage.setItem("custom_teacher_branches_v1", JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("rota-custom-branches-changed", {
      detail: normalized,
    }));
  };

  const addBranch = () => {
    const branchName = newBranchName.trim();
    if (!branchName) return;
    saveCustomBranches([...customBranches, branchName]);
    setNewBranchName("");
  };

  // Sync state if initialSubTab prop changes via parent navigation
  React.useEffect(() => {
    if (initialSubTab && !teacherAssignmentShortcut) {
      setCurrentSubTab(initialSubTab);
    }
  }, [initialSubTab, teacherAssignmentShortcut]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pb-6 pt-0 lg:px-8 lg:pb-8 lg:pt-0">
      {/* Öğretmen Atama kısayolunda Tanımlamalar sekmeleri gizlenir. */}
      {teacherAssignmentShortcut ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 shadow-sm">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-600">Öğretmen Atama</p>
              <h2 className="mt-0.5 text-xl font-black text-slate-900">{shortcutClassroom?.name || "Seçili sınıf"}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTeacherAssignmentClassPickerOpen((open) => !open)}
                className={`rounded-xl border px-3 py-2 text-xs font-black transition ${teacherAssignmentClassPickerOpen ? "border-blue-700 bg-blue-700 text-white" : "border-blue-300 bg-white text-blue-700 hover:bg-blue-100"}`}
              >
                Diğer Sınıflar
              </button>
              <div className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">Yalnız bu sınıf</div>
            </div>
          </div>
          {teacherAssignmentClassPickerOpen && (
            <div className="rounded-2xl border border-blue-200 bg-white p-3 shadow-sm">
              <div className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Sınıf seçiniz</div>
              <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {teacherAssignmentClassroomOptions.map((classroom) => {
                  const active = String(classroom.id) === String(teacherAssignmentClassroomId);
                  return (
                    <button
                      key={classroom.id}
                      type="button"
                      onClick={() => selectTeacherAssignmentClassroom(String(classroom.id))}
                      className={`rounded-xl border px-3 py-2 text-sm font-black transition ${active ? "border-blue-700 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50"}`}
                    >
                      {classroom.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
      <div className="flex flex-col gap-0 rounded-3xl border-2 border-dashed border-purple-950 bg-white p-4 shadow-xs md:flex-row md:items-center">
        <div className="flex h-[52px] min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-l-2xl bg-purple-950 bg-theme-pattern p-1.5 scrollbar-hide">
          <button
            id="hr-teachers-tab-btn"
            onClick={() => setCurrentSubTab("teachers")}
            className={`order-2 flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
              currentSubTab === "teachers"
                ? "bg-white text-purple-900 shadow-sm border-transparent"
                : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
            }`}
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            Öğretmenler
          </button>
          <button
            id="hr-students-tab-btn"
            onClick={() => {
              setCurrentSubTab("students");
              setStudentSection("lists");
            }}
            className={`order-3 flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
              currentSubTab === "students"
                ? "bg-white text-purple-900 shadow-sm border-transparent"
                : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            Öğrenciler
          </button>
          <button
            id="hr-class-info-tab-btn"
            onClick={() => setCurrentSubTab("class-info")}
            className={`order-4 flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
              currentSubTab === "class-info"
                ? "bg-white text-purple-900 shadow-sm border-transparent"
                : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            Sınıflar
          </button>
          <button
            id="hr-branch-definitions-tab-btn"
            onClick={() => setCurrentSubTab("branch-definitions")}
            className={`order-1 flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
              currentSubTab === "branch-definitions"
                ? "bg-white text-purple-900 shadow-sm border-transparent"
                : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
            }`}
          >
            <Tags className="w-4 h-4 shrink-0" />
            Branşlar
          </button>
          <button
            id="hr-courses-tab-btn"
            type="button"
            onClick={() => setCurrentSubTab("courses")}
            className={`order-5 flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
              currentSubTab === "courses"
                ? "bg-white text-purple-900 shadow-sm border-transparent"
                : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            Dersler
          </button>
          <button
            id="hr-teacher-course-assign-tab-btn"
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem(
                  "edupanel_course_subtab_request",
                  "teacher-course-assign",
                );
                sessionStorage.setItem(
                  "edupanel_course_curriculum_standalone",
                  "0",
                );
              } catch {}
              setCurrentSubTab("teacher-course-assign");
            }}
            className={`order-6 flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
              currentSubTab === "teacher-course-assign"
                ? "bg-white text-purple-900 shadow-sm border-transparent"
                : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
            }`}
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            Derse Öğretmen Ata
          </button>

          <button
            id="hr-curriculum-tab-btn"
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem("edupanel_course_curriculum_standalone", "0");
                sessionStorage.removeItem("edupanel_course_subtab_request");
              } catch {}
              setTeacherAssignmentShortcut(false);
              setTeacherAssignmentClassroomId("");
              setTeacherAssignmentClassPickerOpen(false);
              setCurrentSubTab("curriculum");
            }}
            className={`order-7 flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
              currentSubTab === "curriculum"
                ? "bg-white text-purple-900 shadow-sm border-transparent"
                : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            Müfredat
          </button>
        </div>

        <div className="flex h-[52px] shrink-0 items-center justify-end gap-2 overflow-hidden rounded-r-2xl bg-purple-950 bg-theme-pattern p-1.5">
          

          {currentSubTab === "students" && (
            <div className="flex h-[40px] items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStudentSection("lists");
                  setStudentListsDialogOpen(true);
                }}
                className="flex h-[40px] items-center gap-2 rounded-xl border border-white/40 bg-white/15 px-3 text-xs font-bold text-white shadow-sm hover:bg-white/25"
              >
                <List className="h-4 w-4" />
                Listeler
              </button>

              <button
                type="button"
                onClick={openStudentRecordsDialog}
                className="flex h-[40px] items-center gap-2 rounded-xl border border-white/40 bg-white/15 px-3 text-xs font-bold text-white shadow-sm hover:bg-white/25"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Kayıt İşlemleri
              </button>
            </div>
          )}
          {currentSubTab === "class-info" && (
            <div id="definitions-class-controls" className="flex h-[40px] items-center" />
          )}
        </div>
      </div>
      )}

      {studentListsDialogOpen && currentSubTab === "students" && (
        <div className="fixed inset-0 z-[120] flex bg-slate-950/65 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto flex h-full w-full max-w-[1320px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-indigo-950 px-6 py-4 text-white">
              <div>
                <h2 className="text-xl font-black">Öğrenci Listeleri</h2>
                <p className="mt-1 text-xs font-semibold text-indigo-200">Görüntülemek ve yazdırmak istediğiniz listeyi seçiniz.</p>
              </div>
              <button type="button" onClick={() => setStudentListsDialogOpen(false)} className="rounded-xl border border-white/20 bg-white/10 p-2 hover:bg-white/20" aria-label="Kapat">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 place-items-center bg-slate-50 p-6">
              <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
                <button type="button" onClick={() => { setStudentListsDialogOpen(false); window.setTimeout(() => document.getElementById("student-statistics-counts-btn")?.click(), 0); }} className="rounded-3xl border border-indigo-200 bg-white p-8 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-lg">
                  <UsersRound className="h-8 w-8 text-indigo-700" />
                  <h3 className="mt-5 text-xl font-black text-slate-900">Sınıf Öğrenci Sayıları</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-500">Sınıfların öğrenci sayılarını görüntüleyin ve yazdırın.</p>
                  <div className="mt-5 inline-flex items-center gap-2 text-xs font-black text-indigo-700"><Printer className="h-4 w-4" /> Görüntüle / Yazdır</div>
                </button>

                <button type="button" onClick={() => { setStudentListsDialogOpen(false); window.setTimeout(() => document.getElementById("student-statistics-lists-btn")?.click(), 0); }} className="rounded-3xl border border-emerald-200 bg-white p-8 text-left shadow-sm transition hover:border-emerald-400 hover:shadow-lg">
                  <List className="h-8 w-8 text-emerald-700" />
                  <h3 className="mt-5 text-xl font-black text-slate-900">Sınıf Listeleri</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-500">Sınıf ve şube bazında öğrenci listelerini görüntüleyin ve yazdırın.</p>
                  <div className="mt-5 inline-flex items-center gap-2 text-xs font-black text-emerald-700"><Printer className="h-4 w-4" /> Görüntüle / Yazdır</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {studentRecordsDialogOpen && currentSubTab === "students" && (
        <div className="fixed inset-0 z-[120] flex bg-slate-950/65 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto flex h-full w-full max-w-[1320px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-rose-700 px-6 py-4 text-white">
              <div>
                <h2 className="text-xl font-black">Kayıt İşlemleri</h2>
                <p className="mt-1 text-xs font-semibold text-rose-100">Toplu kayıt ve öğrenci hareketlerini yönetin.</p>
              </div>
              <button type="button" onClick={() => setStudentRecordsDialogOpen(false)} className="rounded-xl border border-white/20 bg-white/10 p-2 hover:bg-white/20" aria-label="Kapat">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-5">
              {studentRecordsView === "menu" ? (
                <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <button type="button" onClick={() => document.getElementById("student-excel-upload-btn")?.click()} className="rounded-3xl border border-emerald-200 bg-white p-6 text-left shadow-sm transition hover:border-emerald-400 hover:shadow-lg">
                    <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                    <h3 className="mt-4 text-lg font-black text-slate-900">Excel ile Toplu Kayıt</h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Excel dosyasındaki öğrencileri toplu olarak sisteme aktarın.</p>
                  </button>

                  <button type="button" onClick={() => { try { const raw = sqliteStorage.getItem("student_deleted_records_v1"); const parsed = raw ? JSON.parse(raw) : []; setDeletedStudentRecords(Array.isArray(parsed) ? parsed : []); } catch { setDeletedStudentRecords([]); } setStudentRecordsView("deleted"); }} className="rounded-3xl border border-rose-200 bg-white p-6 text-left shadow-sm transition hover:border-rose-400 hover:shadow-lg">
                    <Trash2 className="h-8 w-8 text-rose-600" />
                    <h3 className="mt-4 text-lg font-black text-slate-900">Kaydı Silinenler</h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Sistemden silinen öğrenci kayıtlarını görüntüleyin.</p>
                  </button>

                  <button type="button" onClick={() => setStudentRecordsView("new")} className="rounded-3xl border border-blue-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-400 hover:shadow-lg">
                    <UserPlus className="h-8 w-8 text-blue-600" />
                    <h3 className="mt-4 text-lg font-black text-slate-900">Sene İçinde Yeni Gelenler</h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Bu eğitim-öğretim yılı içinde kaydedilen öğrencileri görüntüleyin.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStudentCommitmentOpen(true);
                      setCommitmentGrade("");
                      setCommitmentClassroom("");
                    }}
                    className="rounded-3xl border border-violet-200 bg-white p-6 text-left shadow-sm transition hover:border-violet-400 hover:shadow-lg"
                  >
                    <ClipboardCheck className="h-8 w-8 text-violet-600" />
                    <h3 className="mt-4 text-lg font-black text-slate-900">
                      Taahhütname
                    </h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      Öğrencilerin verdiği bilgileri sınıf ve şube bazında taahhütname PDF'i olarak hazırlayın.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStudentRecordsDialogOpen(false);
                      window.setTimeout(() => {
                        document.getElementById("student-qr-register-btn")?.click();
                      }, 0);
                    }}
                    className="rounded-3xl border border-cyan-200 bg-white p-6 text-left shadow-sm transition hover:border-cyan-400 hover:shadow-lg"
                  >
                    <QrCode className="h-8 w-8 text-cyan-600" />
                    <h3 className="mt-4 text-lg font-black text-slate-900">
                      QR Kod ile Kayıt
                    </h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      Herkes için ortak kayıt QR kodunu açın. Öğrenci formu yalnızca bir kez gönderebilir.
                    </p>
                  </button>
                </div>
              ) : (
                <div className="mx-auto max-w-6xl">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{studentRecordsView === "deleted" ? "Kaydı Silinen Öğrenciler" : "Sene İçinde Yeni Gelen Öğrenciler"}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{studentRecordsView === "deleted" ? `${deletedStudentRecords.length} silinen kayıt` : `${newStudentsThisAcademicYear.length} yeni öğrenci`}</p>
                    </div>
                    <button type="button" onClick={() => setStudentRecordsView("menu")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100">Geri</button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full table-fixed border-collapse">
                      <thead className="bg-slate-900 text-white">
                        <tr className="text-left text-[10px] font-black uppercase tracking-wide">
                          <th className="w-[90px] px-3 py-2.5">Ö. No</th>
                          <th className="px-3 py-2.5">Ad Soyad</th>
                          <th className="w-[120px] px-3 py-2.5">Sınıf</th>
                          <th className="w-[180px] px-3 py-2.5">{studentRecordsView === "deleted" ? "Silinme Tarihi" : "Kayıt Tarihi"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(studentRecordsView === "deleted" ? deletedStudentRecords : newStudentsThisAcademicYear).map((student: any, index: number) => (
                          <tr key={`${student.id}-${index}`} className="border-t border-slate-100 text-xs">
                            <td className="px-3 py-2 font-black text-slate-700">{student.id || "—"}</td>
                            <td className="px-3 py-2 font-bold text-slate-900">{student.name || "—"}</td>
                            <td className="px-3 py-2 font-semibold text-slate-600">{student.classroom || "—"}</td>
                            <td className="px-3 py-2 font-semibold text-slate-500">{studentRecordsView === "deleted" ? (student.deletedAt ? new Date(student.deletedAt).toLocaleString("tr-TR") : "—") : (student.registerDate || "—")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {((studentRecordsView === "deleted" && deletedStudentRecords.length === 0) || (studentRecordsView === "new" && newStudentsThisAcademicYear.length === 0)) && (
                      <div className="p-10 text-center text-sm font-bold text-slate-400">Kayıt bulunamadı.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {studentCommitmentOpen && currentSubTab === "students" && (
        <div className="fixed inset-0 z-[150] flex bg-slate-950/70 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-violet-800 px-6 py-4 text-white">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <ClipboardCheck className="h-6 w-6" />
                  Öğrenci Bilgi Taahhütnamesi
                </h2>
                <p className="mt-1 text-xs font-semibold text-violet-200">
                  Sınıf ve şube seçerek öğrencilerin bilgi taahhütnamesini PDF olarak hazırlayın.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStudentCommitmentOpen(false)}
                className="rounded-xl border border-white/20 bg-white/10 p-2 hover:bg-white/20"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-[220px_minmax(300px,1fr)_auto_auto] md:items-end">
                <label>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Sınıf Seviyesi
                  </span>
                  <select
                    value={commitmentGrade}
                    onChange={(event) => {
                      setCommitmentGrade(event.target.value);
                      setCommitmentClassroom("");
                    }}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="">Seçiniz</option>
                    {commitmentGradeOptions.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}. Sınıf
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Sınıf / Şube
                  </span>
                  <select
                    value={commitmentClassroom}
                    onChange={(event) => setCommitmentClassroom(event.target.value)}
                    disabled={!commitmentGrade}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">Seçiniz</option>
                    {commitmentClassroomOptions.map((classroom) => (
                      <option key={classroom} value={classroom}>
                        {classroom}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  disabled={commitmentStudents.length === 0}
                  onClick={() => void createCommitmentPdf("print")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Printer className="h-4 w-4" />
                  Yazdır
                </button>

                <button
                  type="button"
                  disabled={commitmentStudents.length === 0}
                  onClick={() => void createCommitmentPdf("download")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  PDF İndir
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-5">
              {!commitmentGrade || !commitmentClassroom ? (
                <div className="grid h-full min-h-[360px] place-items-center">
                  <div className="max-w-md text-center">
                    <ClipboardCheck className="mx-auto h-12 w-12 text-violet-300" />
                    <h3 className="mt-4 text-lg font-black text-slate-800">
                      Sınıf ve şube seçiniz
                    </h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                      Seçim yapıldığında öğrencilerin taahhütname ön izlemesi burada görüntülenecektir.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-4xl space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <div>
                      <div className="text-sm font-black text-violet-900">
                        {commitmentClassroom}
                      </div>
                      <div className="mt-0.5 text-[10px] font-bold text-violet-600">
                        PDF'de sayfa başına 4 öğrenci yer alır.
                      </div>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-2 text-center shadow-sm">
                      <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                        Öğrenci Sayısı
                      </div>
                      <div className="text-xl font-black text-slate-900">
                        {commitmentStudents.length}
                      </div>
                    </div>
                  </div>

                  {commitmentStudents.map((student) => (
                    <div
                      key={student.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="grid gap-x-6 gap-y-2 text-xs md:grid-cols-2">
                        <div><span className="font-black text-slate-500">Ö. No:</span> <span className="font-bold text-slate-900">{student.id}</span></div>
                        <div><span className="font-black text-slate-500">Sınıf:</span> <span className="font-bold text-slate-900">{student.classroom || "—"}</span></div>
                        <div><span className="font-black text-slate-500">Ad Soyad:</span> <span className="font-bold text-slate-900">{student.name}</span></div>
                        <div><span className="font-black text-slate-500">Grup / Alan:</span> <span className="font-bold text-slate-900">{student.group || "—"}</span></div>
                        <div><span className="font-black text-slate-500">Öğrenci Tel:</span> <span className="font-bold text-slate-900">{student.phone || "—"}</span></div>
                        <div><span className="font-black text-slate-500">Veli:</span> <span className="font-bold text-slate-900">{student.parentName || "—"}</span></div>
                        <div><span className="font-black text-slate-500">Veli Tel:</span> <span className="font-bold text-slate-900">{student.parentPhone || "—"}</span></div>
                        <div><span className="font-black text-slate-500">Doğum:</span> <span className="font-bold text-slate-900">{student.dob || "—"} / {student.pob || "—"}</span></div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3 text-xs italic text-slate-600">
                        Verdiğim bilgilerin doğru olduğunu taahhüt ederim.
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-wide text-slate-400">
                        <span>Tarih</span>
                        <span className="text-center">Öğrenci Adı Soyadı</span>
                        <span className="text-right">İmza</span>
                      </div>
                    </div>
                  ))}

                  {commitmentStudents.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-bold text-slate-400">
                      Bu sınıf / şube için öğrenci bulunamadı.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Inner Module Canvas
          Öğretmenler/Öğrenciler mevcut beyaz canvas'ı korur.
          Sınıflar/Dersler doğrudan Tanımlamalar çalışma alanına oturur. */}
      <div
        id={currentSubTab === "students" ? "student-list-interface" : undefined}
        className={
          currentSubTab === "class-info" || currentSubTab === "courses" || currentSubTab === "teacher-course-assign" || currentSubTab === "curriculum"
            ? "w-full overflow-visible bg-transparent"
            : "overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xs"
        }
      >
        <Suspense fallback={<InnerModuleFallback label={currentSubTab === "teachers" ? "Öğretmenler" : currentSubTab === "students" ? "Öğrenciler" : currentSubTab === "class-info" ? "Sınıflar" : currentSubTab === "courses" ? "Dersler" : currentSubTab === "curriculum" ? "Müfredat" : "Tanımlamalar"} />}>
        {currentSubTab === "teachers" ? (
          <TeacherModule teachers={teachers} setTeachers={setTeachers} />
        ) : currentSubTab === "students" ? (
          <StudentModule students={students} setStudents={setStudents} viewMode={studentSection} />
        ) : currentSubTab === "class-info" ? (
          <div key="definitions-class-info" className="w-full bg-transparent">
          <CourseModule
            courses={courses}
            setCourses={setCourses}
            teachers={teachers}
            classrooms={classrooms}
            setClassrooms={setClassrooms}
            students={students}
            displayMode="classes"
            embeddedClassDefinitions
            courseControlsPortalId="definitions-class-controls"
            customCreatedCourses={customCreatedCourses}
            setCustomCreatedCourses={setCustomCreatedCourses}
          />
          </div>
        ) : currentSubTab === "courses" ? (
          <div key="definitions-courses" className="w-full bg-transparent">
            <CourseModule
              courses={courses}
              setCourses={setCourses}
              teachers={teachers}
              classrooms={classrooms}
              setClassrooms={setClassrooms}
              students={students}
              displayMode="courses"
              initialSubTab="courses"
              embeddedCourseDefinitions
              customCreatedCourses={customCreatedCourses}
              setCustomCreatedCourses={setCustomCreatedCourses}
            />
          </div>
        ) : currentSubTab === "teacher-course-assign" ? (
          <div key="definitions-teacher-course-assign" className="w-full bg-transparent">
            <CourseModule
              key={`teacher-course-assign-${teacherAssignmentShortcut ? teacherAssignmentClassroomId || "none" : "definitions"}`}
              courses={courses}
              setCourses={setCourses}
              teachers={teachers}
              classrooms={classrooms}
              setClassrooms={setClassrooms}
              students={students}
              displayMode="courses"
              initialSubTab="teacher-course-assign"
              embeddedCourseDefinitions
              focusClassroomId={teacherAssignmentShortcut ? teacherAssignmentClassroomId : undefined}
              customCreatedCourses={customCreatedCourses}
              setCustomCreatedCourses={setCustomCreatedCourses}
            />
          </div>
        ) : currentSubTab === "curriculum" ? (
          <div key="definitions-curriculum" className="w-full bg-transparent">
            <CourseModule
              courses={courses}
              setCourses={setCourses}
              teachers={teachers}
              classrooms={classrooms}
              setClassrooms={setClassrooms}
              students={students}
              displayMode="all"
              customCreatedCourses={customCreatedCourses}
              setCustomCreatedCourses={setCustomCreatedCourses}
            />
          </div>
        ) : (
          <div className="p-6">
            <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-indigo-950 px-6 py-5 text-white">
                <p className="text-xs font-black uppercase tracking-wider text-indigo-200">Tanımlamalar</p>
                <h3 className="mt-1 text-2xl font-black">Branş Tanımla</h3>
                <p className="mt-1 text-xs font-semibold text-indigo-200">
                  Eklenen branşlar öğretmen ekleme ve düzenleme formlarında kullanılabilir.
                </p>
              </div>
              <div className="flex gap-3 border-b border-slate-200 p-5">
                <input
                  value={newBranchName}
                  onChange={(event) => setNewBranchName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addBranch();
                    }
                  }}
                  placeholder="Yeni branş adı"
                  className="h-12 flex-1 rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={addBranch}
                  className="flex h-12 items-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Branş Ekle
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleBranches.map((branch) => (
                  <div key={branch} className="flex items-center justify-between px-5 py-4">
                    <span className="font-black text-slate-800">{branch}</span>
                    {customBranches.includes(branch) && (
                      <button
                        type="button"
                        onClick={() =>
                          saveCustomBranches(customBranches.filter((item) => item !== branch))
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"
                        aria-label={`${branch} branşını sil`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {visibleBranches.length === 0 && (
                  <p className="p-8 text-center text-sm font-bold text-slate-400">
                    Henüz branş tanımlanmamış.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        </Suspense>
      </div>
    </div>
  );
}

