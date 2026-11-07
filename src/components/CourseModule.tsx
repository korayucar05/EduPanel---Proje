import { parseUploadFileName, groupInstructionCode, type UploadNameInfo } from "../utils/questionUploadFileName";
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  BookOpen,
  Clock,
  MapPin,
  User,
  Users,
  Trash2,
  Users2,
  CalendarDays,
  X,
  School,
  Save,
  Building2,
  GraduationCap,
  Sliders,
  ChevronUp,
  Sparkles,
  Split,
  Pencil,
  FileText,
  BookmarkMinus,
  Download,
  Upload,
  LayoutTemplate,
  UserCheck,
  Grid2X2,
  UserCog,
  Heart,
  Lock,
  Unlock,
  Mic,
  MicOff,
} from "lucide-react";
import { Course, Teacher, Classroom, Student } from "../types";
import {
  uploadQuestionBankImage,
  moveQuestionBankImage,
  deleteQuestionBankImage,
  deleteQuestionBankRecord,
  deleteQuestionBankRecordsBulk,
  getQuestionBankNextSequence,
  listQuestionBankRecords,
} from "../lib/localDatabase";
const AddCourseModal = lazy(() => import("./course/AddCourseModal"));
const CourseCurriculumModal = lazy(() => import("./course/CourseCurriculumModal"));
const CourseCurriculumPanel = lazy(() => import("./course/CourseCurriculumPanel"));
const TeacherAssignmentModal = lazy(() => import("./course/TeacherAssignmentModal"));
const ClassroomEditModal = lazy(() => import("./course/ClassroomEditModal"));
const ClassCourseAssignmentPanel = lazy(() => import("./course/ClassCourseAssignmentPanel"));
const EditCustomCourseModal = lazy(() => import("./course/EditCustomCourseModal"));
const LegacyCourseModal = lazy(() => import("./course/LegacyCourseModal"));
import DeleteCourseConfirmationModal from "./course/DeleteCourseConfirmationModal";
const CourseSelectionModals = lazy(() => import("./course/CourseSelectionModals"));
import CourseBranchInfoPanel from "./course/CourseBranchInfoPanel";
const CourseSeatingPlanPanel = lazy(() => import("./course/CourseSeatingPlanPanel"));
const CourseDefinitionTable = lazy(() => import("./course/CourseDefinitionTable"));
const TeacherCourseSelectionModal = lazy(() => import("./course/TeacherCourseSelectionModal"));
const CourseAssignmentExplorerModal = lazy(() => import("./course/CourseAssignmentExplorerModal"));
import { useCourseVoiceAssignment } from "./course/useCourseVoiceAssignment";
import { decodeTurkishTextFile } from "../utils/textEncoding";
import { saveAuthoritativeCurriculumEntry } from "../services/curriculumRepository";
import { compareClassrooms } from "../utils/classroomSort";


const CURRICULUM_COURSE_CATALOG = [
  { id: 1, name: "Türk Dili ve Edebiyatı" },
  { id: 2, name: "Tarih" },
  { id: 3, name: "Coğrafya" },
  { id: 4, name: "Felsefe" },
  { id: 5, name: "Din Kültürü ve Ahlak Bilgisi" },
  { id: 7, name: "Matematik" },
  { id: 8, name: "Fizik" },
  { id: 9, name: "Kimya" },
  { id: 10, name: "Biyoloji" },
] as const;

const normalizeCurriculumName = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "");

const curriculumGradeNumber = (grade: unknown) => {
  const match = String(grade || "").match(/(9|10|11|12)/);
  return match ? Number(match[1]) : 0;
};

const curriculumVirtualCourseId = (grade: number, courseId: number) =>
  `CURR-${grade}-${courseId}`;

const canonicalCourseIdFromHierarchy = (fallbackCourseId: unknown, ...hierarchyIds: unknown[]) => {
  for (const value of hierarchyIds) {
    const parts = String(value || "").split(".").filter(Boolean);
    if (parts.length >= 2 && /^(9|10|11|12)$/.test(parts[0])) return parts[1];
  }
  const fallback = String(fallbackCourseId || "");
  const virtualMatch = fallback.match(/^CURR-(?:9|10|11|12)-(.+)$/i);
  return virtualMatch?.[1] || fallback;
};


const stripQuestionsFromCurriculum = (curriculum: any) => {
  const next = curriculum && typeof curriculum === "object"
    ? JSON.parse(JSON.stringify(curriculum))
    : { units: [] };

  (next.units || []).forEach((unit: any) => {
    (unit.topics || []).forEach((topic: any) => {
      delete topic.questions;
      delete topic.nextQuestionSequence;
      (topic.outcomes || []).forEach((outcome: any) => {
        delete outcome.questions;
        delete outcome.nextQuestionSequence;
      });
    });
  });

  return next;
};

const stripQuestionsFromCurriculumStore = (store: Record<string, any>) => {
  const next: Record<string, any> = {};
  Object.entries(store || {}).forEach(([key, curriculum]) => {
    next[key] = stripQuestionsFromCurriculum(curriculum);
  });
  return next;
};


import { sqliteStorage } from "../core/state/SyncStateStore";
import { classroomService, normalizeClassroomName } from "../modules/classroom";
import { courseService } from "../modules/course";
import {
  COMPULSORY_COURSES,
  ELECTIVE_COURSES_POOL,
  findMatchingTeacher,
  formatCourseNameTitleCase,
  getCourseColors,
  getCourseRank,
  getTeacherAssignmentCourseColor,
  isSameCourseName,
  titleCaseTurkish,
} from "./course/courseCatalog";
export { COMPULSORY_COURSES, ELECTIVE_COURSES_POOL, findMatchingTeacher, isSameCourseName, titleCaseTurkish } from "./course/courseCatalog";

export interface CourseModuleProps {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  teachers: Teacher[];
  classrooms: Classroom[];
  setClassrooms: React.Dispatch<React.SetStateAction<Classroom[]>>;
  students: Student[];
  displayMode?: "classes" | "courses" | "connections" | "all";
  initialSubTab?: "courses" | "teacher-course-assign";
  focusClassroomId?: string;
  embeddedCourseDefinitions?: boolean;
  courseControlsPortalId?: string;
  embeddedClassDefinitions?: boolean;
  customCreatedCourses: any[];
  setCustomCreatedCourses: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function CourseModule({
  courses,
  setCourses,
  teachers,
  classrooms,
  setClassrooms,
  students,
  displayMode = "all",
  initialSubTab,
  focusClassroomId,
  embeddedCourseDefinitions = false,
  courseControlsPortalId,
  embeddedClassDefinitions = false,
  customCreatedCourses,
  setCustomCreatedCourses,
}: CourseModuleProps) {
  const [currentSubTab, setCurrentSubTab] = useState<
    "classrooms" | "teacher-course-assign" | "branch-info" | "courses" | "electives" | "split-classes" | "curriculum" | "seating-plan"
  >(
    initialSubTab
      ? initialSubTab
      : displayMode === "classes"
      ? "seating-plan"
      : displayMode === "courses" && !embeddedCourseDefinitions
        ? "courses"
        : embeddedCourseDefinitions
          ? "courses"
          : "classrooms",
  );
  const [standaloneCurriculum, setStandaloneCurriculum] = useState<boolean>(() => {
    // Ana CourseModule artık Atamalar ekranı olarak değil, Müfredat çalışma alanı
    // olarak açılır. Gömülü ders/sınıf tanımlama kullanımları mevcut davranışını korur.
    if (!embeddedCourseDefinitions && !embeddedClassDefinitions && displayMode === "all") {
      return true;
    }
    try {
      return sessionStorage.getItem("edupanel_course_curriculum_standalone") === "1";
    } catch {
      return false;
    }
  });

  // Soru Bankası > Müfredat yönlendirmesi bağımsız Müfredat çalışma alanını açar.
  // Eski Atamalar menü butonu kaldırılmıştır; atama altyapısı silinmemiştir.
  useEffect(() => {
    const allowed = new Set([
      "classrooms",
      "teacher-course-assign",
      "branch-info",
      "courses",
      "electives",
      "split-classes",
      "seating-plan",
    ]);

    const applyRequestedSubTab = (
      value: unknown,
      standaloneFromEvent?: boolean,
    ) => {
      const requested = String(value || "");
      const isCurriculum =
        requested === "curriculum" || standaloneFromEvent === true;

      if (isCurriculum) {
        setStandaloneCurriculum(true);
        try {
          sessionStorage.setItem("edupanel_course_curriculum_standalone", "1");
          sessionStorage.removeItem("edupanel_course_subtab_request");
        } catch {}
        return;
      }

      if (!allowed.has(requested)) return;

      setStandaloneCurriculum(false);
      setCurrentSubTab(requested as any);
      try {
        sessionStorage.setItem("edupanel_course_curriculum_standalone", "0");
        sessionStorage.removeItem("edupanel_course_subtab_request");
      } catch {}
    };

    try {
      const requested = sessionStorage.getItem("edupanel_course_subtab_request");
      const standalone =
        sessionStorage.getItem("edupanel_course_curriculum_standalone") === "1";
      if (requested) {
        applyRequestedSubTab(requested, standalone);
      } else if (standalone) {
        setStandaloneCurriculum(true);
      }
    } catch {}

    const handleRequestedSubTab = (event: Event) => {
      const detail =
        (event as CustomEvent<{
          subTab?: string;
          standaloneCurriculum?: boolean;
        }>).detail || {};
      applyRequestedSubTab(
        detail.subTab,
        Boolean(detail.standaloneCurriculum),
      );
    };

    window.addEventListener("edupanel-course-subtab", handleRequestedSubTab);
    return () =>
      window.removeEventListener("edupanel-course-subtab", handleRequestedSubTab);
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  const [courseControlsPortalTarget, setCourseControlsPortalTarget] =
    useState<HTMLElement | null>(null);

  const [teacherCourseModalTeacherId, setTeacherCourseModalTeacherId] =
    useState<string | null>(null);

  const [teacherCourseDraftKeys, setTeacherCourseDraftKeys] =
    useState<string[]>([]);

  const [teacherCourseListMode, setTeacherCourseListMode] =
    useState<any>("cards");

  const [isTeacherCourseSaving, setIsTeacherCourseSaving] =
    useState(false);

  const [selectedBranchTeacherId, setSelectedBranchTeacherId] =
    useState<string | null>(null);

  const [isAssignmentExplorerOpen, setIsAssignmentExplorerOpen] =
    useState(false);

  const [assignmentExplorerSelection, setAssignmentExplorerSelection] =
    useState<any>(null);
  const [draggedAssignedCourseKey, setDraggedAssignedCourseKey] =
    useState<string | null>(null);

  const [draggedBranchTeacherId, setDraggedBranchTeacherId] =
    useState<string | null>(null);
  const [teacherCourseBranch, setTeacherCourseBranch] =
    useState<string>("");
  const [customTeacherBranches, setCustomTeacherBranches] =
    useState<string[]>([]);

  const [customCourseUiOverrides, setCustomCourseUiOverrides] =
    useState<Record<string, any>>({});

  const [teacherCourseUiAssignments, setTeacherCourseUiAssignments] =
    useState<Record<string, {
      teacherId?: string;
      teacherName?: string;
      teacherId2?: string;
      teacherName2?: string;
      teacherAssignmentCleared?: boolean;
    }>>({});
  const [customCourseSaveRevision, setCustomCourseSaveRevision] =
    useState(0);

  const [branchCourseAssignments, setBranchCourseAssignments] = React.useState<Record<string, string[]>>(() => {
    try {
      const saved = sqliteStorage.getItem("branch_course_assignments_v1");
      if (!saved) return {};

      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch (error) {
      console.error("Branş-ders eşleştirmeleri okunamadı:", error);
      return {};
    }
  });
  useEffect(() => {
    try {
      sqliteStorage.setItem(
        "branch_course_assignments_v1",
        JSON.stringify(branchCourseAssignments),
      );
    } catch (error) {
      console.error("Branş-ders eşleştirmeleri kaydedilemedi:", error);
    }
  }, [branchCourseAssignments]);

  useEffect(() => {
    if (!embeddedCourseDefinitions || !courseControlsPortalId) {
      setCourseControlsPortalTarget(null);
      return;
    }
    setCourseControlsPortalTarget(document.getElementById(courseControlsPortalId));
  }, [embeddedCourseDefinitions, courseControlsPortalId]);

  useEffect(() => {
    const handleBranchesChanged = (event: Event) => {
      const branches = (event as CustomEvent<string[]>).detail;
      setCustomTeacherBranches(Array.isArray(branches) ? branches : []);
    };
    window.addEventListener("rota-custom-branches-changed", handleBranchesChanged);
    return () =>
      window.removeEventListener("rota-custom-branches-changed", handleBranchesChanged);
  }, []);

  const handleSaveCustomCourse = async () => {
    if (!newCourseName.trim()) {
      alert("Lütfen ders adı giriniz.");
      return;
    }

    if (newCourseGrades.length === 0) {
      alert("Lütfen en az bir sınıf düzeyi seçiniz.");
      return;
    }

    const formattedName = formatCourseNameTitleCase(newCourseName);
    const selectedGrades = [...newCourseGrades].sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10),
    );

    const targetGroups = newCourseTargetGroups.filter(group => group !== "ORTAK");
    const targetGroup = targetGroups.length > 0 ? targetGroups.join(", ") : undefined;

    const targetClassrooms = classrooms.filter(cls => {
      if (!selectedGrades.includes(cls.level)) return false;
      if (newCourseType === "Zorunlu Ders" || targetGroups.length === 0) return true;

      const normalizedGroups = (cls.groups || []).map(group =>
        String(group).trim().toLocaleUpperCase("tr-TR"),
      );
      return targetGroups.some(group => normalizedGroups.includes(group));
    });

    if (targetClassrooms.length === 0) {
      const gradeLabel = selectedGrades.join(", ");
      alert(
        targetGroup
          ? `${gradeLabel} düzeylerinde ${targetGroup} grubu tanımlanmış sınıf bulunamadı. Önce Sınıf Bilgisi alanından bu grupları sınıflara ekleyiniz.`
          : `${gradeLabel} düzeylerinde kayıtlı sınıf bulunamadı.`,
      );
      return;
    }

    const targetClassroomIds = new Set(targetClassrooms.map(cls => cls.id));
    const isCommonElective = newCourseType === "Seçmeli Ders" && targetGroups.length === 0;
    const now = Date.now();

    const classGroupsById: Record<string, string[]> = {};
    targetClassrooms.forEach(cls => {
      const normalizedGroups = (cls.groups || [])
        .map(group => String(group).trim().toLocaleUpperCase("tr-TR"))
        .filter(Boolean);
      classGroupsById[cls.id] = isCommonElective
        ? normalizedGroups
        : normalizedGroups.filter(group => targetGroups.includes(group as (typeof targetGroups)[number]));
    });

    // 1) Sınıf -> ders atamalarının yeni snapshot'ını oluştur.
    const nextClassrooms = classrooms.map(cls => {
      if (!targetClassroomIds.has(cls.id)) return cls;

      const existing = cls.assignedCourses || [];
      const selectedGroups = classGroupsById[cls.id] || [];
      const newGroupKey = selectedGroups
        .map((group) => String(group).trim().toLocaleUpperCase("tr-TR"))
        .filter(Boolean)
        .sort()
        .join("|");

      const alreadyExists = existing.some((item) => {
        const existingGroupKey = String(item.groupName || "")
          .split(",")
          .map((group) => group.trim().toLocaleUpperCase("tr-TR"))
          .filter(Boolean)
          .sort()
          .join("|");

        return (
          item.courseName.toLocaleLowerCase("tr-TR") ===
            formattedName.toLocaleLowerCase("tr-TR") &&
          Number(item.weeklyHours || 0) === Number(newCourseHours || 0) &&
          existingGroupKey === newGroupKey
        );
      });
      if (alreadyExists) return cls;

      return {
        ...cls,
        assignedCourses: [
          ...existing,
          {
            courseName: formattedName,
            teacherId: "",
            teacherName: "Belirtilmedi",
            weeklyHours: newCourseHours,
            type: newCourseType === "Zorunlu Ders" ? "compulsory" : "elective",
            groupName: selectedGroups.length > 0 ? selectedGroups.join(", ") : undefined,
          },
        ],
      };
    });

    // 2) Global Course kayıtlarının yeni snapshot'ını oluştur.
    const additions: Course[] = [];
    targetClassrooms.forEach((cls, index) => {
      const selectedGroups = classGroupsById[cls.id] || [];
      const newGroupKey = selectedGroups
        .map((group) => String(group).trim().toLocaleUpperCase("tr-TR"))
        .filter(Boolean)
        .sort()
        .join("|");

      const exists = courses.some((course) => {
        const existingGroupKey = String(course.groupName || "")
          .split(",")
          .map((group) => group.trim().toLocaleUpperCase("tr-TR"))
          .filter(Boolean)
          .sort()
          .join("|");

        return (
          course.name.toLocaleLowerCase("tr-TR") ===
            formattedName.toLocaleLowerCase("tr-TR") &&
          course.classroom === cls.name &&
          Number(course.weeklyHours || 0) === Number(newCourseHours || 0) &&
          existingGroupKey === newGroupKey
        );
      });
      if (exists) return;

      const safeCode = String(formattedName)
        .substring(0, 3)
        .toUpperCase()
        .replace(/[^A-Za-z0-9]/g, "DRS");
      additions.push({
        id: `course-${now}-${cls.id}-${index}`,
        name: formattedName,
        code: `${safeCode}-${cls.name.replace(/\s+/g, "")}-${index}`,
        weeklyHours: newCourseHours,
        type: newCourseType === "Zorunlu Ders" ? "compulsory" : "elective",
        color: newCourseType === "Zorunlu Ders" ? "bg-emerald-100" : "bg-amber-100",
        classroom: cls.name,
        teacherId: "",
        teacherName: "Belirtilmedi",
        schedule: `Haftalık ${newCourseHours} Saat`,
        studentCount: 24,
        groupName: selectedGroups.length > 0 ? selectedGroups.join(", ") : undefined,
      } as Course);
    });
    const nextCourses = [...courses, ...additions];

    // 3) Seçilen her sınıf düzeyi için customCreatedCourses kaydını kalıcı snapshot'a ekle.
    const customAdditions = selectedGrades
      .filter((gradeLevel) => {
        const newTargetGroupKey = (isCommonElective ? ["ORTAK"] : targetGroups)
          .map((group) => String(group).trim().toLocaleUpperCase("tr-TR"))
          .filter(Boolean)
          .sort()
          .join("|");

        return !customCreatedCourses.some((item) => {
          const existingTargetGroupKey = (item.targetGroups || [])
            .map((group) => String(group).trim().toLocaleUpperCase("tr-TR"))
            .filter(Boolean)
            .sort()
            .join("|");

          return (
            item.courseName?.toLocaleLowerCase("tr-TR") ===
              formattedName.toLocaleLowerCase("tr-TR") &&
            item.gradeLevel === gradeLevel &&
            Number(item.weeklyHours || 0) === Number(newCourseHours || 0) &&
            existingTargetGroupKey === newTargetGroupKey
          );
        });
      })
      .map((gradeLevel, index) => {
        const gradeClasses = targetClassrooms.filter(cls => cls.level === gradeLevel);
        const selectedClassrooms = gradeClasses.map(cls => cls.id);
        const classGroups: Record<string, string[]> = {};
        selectedClassrooms.forEach(classroomId => {
          classGroups[classroomId] = classGroupsById[classroomId] || [];
        });
        return {
          id: `cc-${now}-${index}`,
          gradeLevel,
          courseType: newCourseType,
          courseName: formattedName,
          courseGroup: targetGroup,
          targetGroups: isCommonElective ? ["ORTAK"] : targetGroups,
          isCommonElective,
          weeklyHours: newCourseHours,
          selectedClassrooms,
          classGroups,
        };
      });
    const nextCustomCreatedCourses = [...customCreatedCourses, ...customAdditions];

    // KRİTİK: Önce tek SQLite akademik kataloğuna atomik olarak yaz.
    // Veritabanı başarısızsa UI state'ini değiştirme; böylece yenilemede kaybolan hayali kayıt oluşmaz.
    try {
      await courseService.commitAcademicCatalog({
        classrooms: nextClassrooms,
        courses: nextCourses,
        customCreatedCourses: nextCustomCreatedCourses,
      });
    } catch (error) {
      console.error("Ders SQLite akademik kataloğuna kaydedilemedi:", error);
      alert(
        "Ders veritabanına kaydedilemedi. Hiçbir değişiklik uygulanmadı. " +
          (error instanceof Error ? error.message : String(error)),
      );
      return;
    }

    // SQLite başarıyla yazıldıktan sonra aynı snapshot'ı UI'a uygula.
    setClassrooms(nextClassrooms);
    setCourses(nextCourses);
    setCustomCreatedCourses(nextCustomCreatedCourses);

    if (editingClassId && targetClassroomIds.has(editingClassId)) {
      const selectedClass = nextClassrooms.find(cls => cls.id === editingClassId);
      setClassCourses(
        (selectedClass?.assignedCourses || []).map(course => ({
          ...course,
          studentIds: (course as any).studentIds || [],
          uiGroupSelectVisible: false,
          uiTempSelectedGroup: "SAY",
        })),
      );
    }

    setNewCourseName("");
    setNewCourseTargetGroups(["ORTAK"]);
    setNewCourseGrades(["9. Sınıf"]);
    setIsAddCourseModalOpen(false);
    triggerNotification(
      `'${formattedName}' • ${newCourseHours} saat • ${
        targetGroups.length > 0 ? targetGroups.join(" + ") : "GENEL"
      } • ${selectedGrades.join(", ")} düzeyleri için veritabanına kaydedildi.`,
    );
  };

  const [curriculumActiveGrade, setCurriculumActiveGrade] = useState("9. Sınıf");
  const [deletedCurriculumCourses, setDeletedCurriculumCourses] =
    useState<string[]>([]);

  const [curriculumSelectedCoursesByGrade, setCurriculumSelectedCoursesByGrade] = useState<Record<string, string[]>>(() => {
    try {
      const saved = sqliteStorage.getItem("curriculum_selected_courses_by_grade_v1");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [curriculumModalState, setCurriculumModalState] = useState<{ isOpen: boolean; courseId: string | null }>({ isOpen: false, courseId: null });
  const [curriculumStore, setCurriculumStore] = useState<Record<string, any>>(() => {
    const readStore = (key: string) => {
      let parsed: Record<string, any> = {};
      try {
        const saved = sqliteStorage.getItem(key);
        if (saved) parsed = JSON.parse(saved);
      } catch { /* eski sqlite kaydı okunamadı */ }
      try {
        const browserSaved = typeof window !== "undefined" ? window.localStorage?.getItem(key) : null;
        if (browserSaved) parsed = { ...parsed, ...JSON.parse(browserSaved) };
      } catch { /* tarayıcı aynası okunamadı */ }
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    };

    // Müfredat ekranı geçmişte iki farklı anahtar kullandı. V23 bunları yalnız
    // görünürlük/kurtarma amacıyla birlikte okur; bundan sonraki yazma anahtarı
    // course_curriculums_v1 olarak kalır. Böylece daha önce yüklenmiş dersler kaybolmaz.
    const legacy = readStore("rota_curriculum_store_v1");
    const primary = readStore("course_curriculums_v1");
    const sanitized = stripQuestionsFromCurriculumStore({ ...legacy, ...primary });
    try {
      sqliteStorage.setItem("course_curriculums_v1", JSON.stringify(sanitized));
      if (typeof window !== "undefined") {
        window.localStorage?.setItem("course_curriculums_v1", JSON.stringify(sanitized));
      }
    } catch { /* açılışta aynalama başarısız olsa da ekran açılmaya devam eder */ }
    return sanitized;
  });
  const curriculumStoreHasLoadedDataRef = useRef(
    Object.keys(curriculumStore).length > 0,
  );
  const [expandedCurriculumUnits, setExpandedCurriculumUnits] = useState<Record<string, boolean>>({});
  const [expandedCurriculumTopics, setExpandedCurriculumTopics] = useState<Record<string, boolean>>({});
  const [curriculumEditor, setCurriculumEditor] = useState<{ type: "unit" | "topic" | "outcome"; unitId?: string; topicId?: string; item?: any } | null>(null);
  const [curriculumForm, setCurriculumForm] = useState({ id: "", name: "" });
  const [teacherAssignmentModal, setTeacherAssignmentModal] = useState<{ isOpen: boolean; courseIndex: number | null; courseName: string }>({ isOpen: false, courseIndex: null, courseName: "" });
  const [tempTeacherToAssign, setTempTeacherToAssign] = useState<string>("");
  const [tempTeacherToAssign2, setTempTeacherToAssign2] = useState<string>("");

  useEffect(() => {
    const migrationKey =
      "rota_remove_aysegul_cebeci_german_assignment_sqlite_v2";
    if (sqliteStorage.getItem(migrationKey) === "done") return;
    if (!classrooms.length && !courses.length) return;

    const normalize = (value: unknown) =>
      String(value || "")
        .toLocaleLowerCase("tr-TR")
        .replace(/[^\p{L}\p{N}]/gu, "");

    const isGermanCourse = (courseName: unknown) =>
      normalize(courseName).includes("almanca");

    const isAysegulCebeci = (
      teacherId: unknown,
      teacherName: unknown,
    ) => {
      const normalizedName = normalize(teacherName);
      if (normalizedName === "ayşegülcebeci" || normalizedName === "aysegulcebeci") {
        return true;
      }

      const teacher = teachers.find(
        (item) => String(item.id || "") === String(teacherId || ""),
      );
      const registeredName = normalize(teacher?.name);
      return (
        registeredName === "ayşegülcebeci" ||
        registeredName === "aysegulcebeci"
      );
    };

    let classroomsChanged = false;
    const cleanedClassrooms = classrooms.map((classroom) => {
      let classChanged = false;
      const cleanedAssignedCourses = (classroom.assignedCourses || []).map(
        (course) => {
          if (!isGermanCourse(course.courseName)) return course;

          const firstIsAysegul = isAysegulCebeci(
            course.teacherId,
            course.teacherName,
          );
          const secondIsAysegul = isAysegulCebeci(
            course.teacherId2,
            course.teacherName2,
          );

          if (!firstIsAysegul && !secondIsAysegul) return course;

          classChanged = true;
          const nextCourse = { ...course };

          if (firstIsAysegul) {
            nextCourse.teacherId = "";
            nextCourse.teacherName = "Öğretmen Atanmadı";
            nextCourse.teacherAssignmentCleared = true;
          }

          if (secondIsAysegul) {
            nextCourse.teacherId2 = undefined;
            nextCourse.teacherName2 = undefined;
          }

          return nextCourse;
        },
      );

      if (!classChanged) return classroom;
      classroomsChanged = true;
      return { ...classroom, assignedCourses: cleanedAssignedCourses };
    });

    let coursesChanged = false;
    const cleanedCourses = courses.map((course) => {
      if (!isGermanCourse(course.name)) return course;

      const firstIsAysegul = isAysegulCebeci(
        course.teacherId,
        course.teacherName,
      );
      const secondIsAysegul = isAysegulCebeci(
        (course as any).teacherId2,
        (course as any).teacherName2,
      );

      if (!firstIsAysegul && !secondIsAysegul) return course;

      coursesChanged = true;
      const nextCourse: any = { ...course };

      if (firstIsAysegul) {
        nextCourse.teacher = "Atanmadı";
        nextCourse.teacherId = "";
        nextCourse.teacherName = "Öğretmen Atanmadı";
        nextCourse.teacherAssignmentCleared = true;
      }

      if (secondIsAysegul) {
        nextCourse.teacherId2 = undefined;
        nextCourse.teacherName2 = undefined;
      }

      return nextCourse as Course;
    });

    if (!classroomsChanged && !coursesChanged) {
      sqliteStorage.setItem(migrationKey, "done");
      return;
    }

    let cancelled = false;

    courseService.commitAcademicCatalog({
      classrooms: cleanedClassrooms,
      courses: cleanedCourses,
      customCreatedCourses: customCreatedCourses || [],
    })
      .then(() => {
        if (cancelled) return;
        setClassrooms(cleanedClassrooms);
        setCourses(cleanedCourses);
        sqliteStorage.setItem(migrationKey, "done");
        triggerNotification(
          "Ayşegül Cebeci'nin Almanca derslerindeki otomatik ataması veritabanından kaldırıldı.",
        );
      })
      .catch((error) => {
        console.error(
          "Ayşegül Cebeci Almanca ataması SQLite veritabanından kaldırılamadı:",
          error,
        );
        if (!cancelled) {
          triggerNotification(
            "Otomatik Almanca öğretmen ataması veritabanından kaldırılamadı. Lütfen tekrar deneyin.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    classrooms,
    courses,
    teachers,
    customCreatedCourses,
    setClassrooms,
    setCourses,
  ]);


  // Expanded categories state
  const [expandedCategories, setExpandedCategories] = useState<{
    [key: string]: boolean;
  }>({
    "AKADEMİK ÇALIŞMALAR": true,
    "İNSAN, TOPLUM VE BİLİM": false,
    "DİN, AHLAK VE DEĞER": false,
    "KÜLTÜR, SANAT VE SPOR": false,
  });

  // Selected electives state
  // Key format: `${courseId}_${gradeLevel}` -> hours value
  const [selectedElectives, setSelectedElectives] = useState<{
    [key: string]: number;
  }>(() => {
    try {
      const saved = sqliteStorage.getItem("selected_electives_pool");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Custom Electives State
  const [customElectives, setCustomElectives] = useState<any[]>(() => {
    try {
      const saved = sqliteStorage.getItem("custom_electives_pool");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [createElectiveName, setCreateElectiveName] = useState("");
  const [createElectiveGrade, setCreateElectiveGrade] = useState("9. Sınıf");

  useEffect(() => {
    try {
      sqliteStorage.setItem(
        "selected_electives_pool",
        JSON.stringify(selectedElectives),
      );
    } catch (e) {
      console.warn("Local storage quota exceeded for selected_electives_pool", e);
    }
  }, [selectedElectives]);

  useEffect(() => {
    try {
      sqliteStorage.setItem("custom_electives_pool", JSON.stringify(customElectives));
    } catch (e) {
      console.warn("Local storage quota exceeded for custom_electives_pool", e);
    }
  }, [customElectives]);

  // New States and Handlers for Custom Courses and Sections (Şubeler)
  const [newCourseGrades, setNewCourseGrades] = useState<string[]>(["9. Sınıf"]);
  const [newCourseType, setNewCourseType] = useState<"Zorunlu Ders" | "Seçmeli Ders">("Zorunlu Ders");
  const [newCourseName, setNewCourseName] = useState<string>("");
  const [newCourseHours, setNewCourseHours] = useState<number>(2);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [newCourseTargetGroups, setNewCourseTargetGroups] = useState<Array<"ORTAK" | "SAY" | "EA" | "SÖZ" | "DİL">>(["ORTAK"]);
  const [selectedCustomCourseIds, setSelectedCustomCourseIds] = useState<string[]>([]);
  const [editingCustomCourse, setEditingCustomCourse] = useState<{
    id: string;
    gradeLevel: string;
    courseType: "Zorunlu Ders" | "Seçmeli Ders";
    courseName: string;
    courseGroup?: string;
    targetGroups?: Array<"ORTAK" | "SAY" | "EA" | "SÖZ" | "DİL">;
    isCommonElective?: boolean;
    weeklyHours: number;
    selectedClassrooms: string[];
    classGroups?: Record<string, string[]>;
  } | null>(null);
  const [isEditCourseGroupDropdownOpen, setIsEditCourseGroupDropdownOpen] = useState(false);
  const [isEditingCompulsoryLocked, setIsEditingCompulsoryLocked] = useState(true);
  const handleStartEditingCustomCourse = (cc: any) => {
    const levelClasses = classrooms.filter(cls => cls.level === cc.gradeLevel);
    const storedClassGroups: Record<string, string[]> = { ...(cc.classGroups || {}) };

    const parsedCourseGroups = String(cc.courseGroup || "")
      .split(",")
      .map((group: string) => group.trim().toLocaleUpperCase("tr-TR"))
      .filter(Boolean);

    const storedTargetGroups = Array.isArray(cc.targetGroups)
      ? cc.targetGroups.map((group: string) => group.toLocaleUpperCase("tr-TR"))
      : parsedCourseGroups;

    const selectedIds = Array.isArray(cc.selectedClassrooms) ? cc.selectedClassrooms : [];
    const coversAllLevelClasses =
      levelClasses.length > 0 &&
      levelClasses.every(cls => selectedIds.includes(cls.id));

    const isCommonElective =
      cc.courseType === "Seçmeli Ders" &&
      (cc.isCommonElective === true ||
        storedTargetGroups.includes("ORTAK") ||
        (coversAllLevelClasses && parsedCourseGroups.length === 0));

    const normalizedSelectedClassrooms = isCommonElective
      ? levelClasses.map(cls => cls.id)
      : selectedIds;

    if (isCommonElective) {
      levelClasses.forEach(cls => {
        storedClassGroups[cls.id] = Array.from(
          new Set((cls.groups || []).map(group => group.toLocaleUpperCase("tr-TR"))),
        );
      });
    } else {
      normalizedSelectedClassrooms.forEach(classroomId => {
        const cls = levelClasses.find(item => item.id === classroomId);
        const allowedGroups = new Set(
          (cls?.groups || []).map(group => group.toLocaleUpperCase("tr-TR")),
        );
        const savedGroups = (storedClassGroups[classroomId] || storedTargetGroups)
          .map(group => group.toLocaleUpperCase("tr-TR"))
          .filter(group => allowedGroups.has(group));
        storedClassGroups[classroomId] = Array.from(new Set(savedGroups));
      });
    }

    setIsEditingCompulsoryLocked(false);
    setEditingCustomCourse({
      ...cc,
      isCommonElective,
      targetGroups: isCommonElective ? ["ORTAK"] : storedTargetGroups,
      selectedClassrooms: normalizedSelectedClassrooms,
      classGroups: storedClassGroups,
    });
  };

  const handleRemoveClassroomFromCustomCourse = (courseId: string, classroomId: string, classroomName: string) => {
    const course = customCreatedCourses.find(c => c.id === courseId);
    if (!course) return;

    setDeleteConfirm({
      isOpen: true,
      type: "custom-course-class",
      id: courseId,
      name: `${course.courseName} (${classroomName})`,
      extraId: classroomId,
    });
  };

  const handleClearCustomCourseClassrooms = (courseId: string) => {
    const course = customCreatedCourses.find(c => c.id === courseId);
    if (!course) return;

    setDeleteConfirm({
      isOpen: true,
      type: "custom-course-clear",
      id: courseId,
      name: course.courseName,
    });
  };

  const handleDeleteCustomCourse = (courseId: string) => {
    const courseToDelete = customCreatedCourses.find(c => c.id === courseId);
    if (!courseToDelete) return;

    setDeleteConfirm({
      isOpen: true,
      type: "custom-course",
      id: courseId,
      name: courseToDelete.courseName,
    });
  };

  const handleSaveEditedCustomCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomCourse || !editingCustomCourse.courseName.trim()) return;

    let finalClassroomIds = editingCustomCourse.selectedClassrooms;
    let finalClassGroups = { ...(editingCustomCourse.classGroups || {}) };

    if (editingCustomCourse.courseType === "Zorunlu Ders" && isEditingCompulsoryLocked) {
      const levelClasses = classrooms.filter(c => c.level === editingCustomCourse.gradeLevel);
      finalClassroomIds = levelClasses.map(c => c.id);
      levelClasses.forEach(cls => {
        if (cls.groups && cls.groups.length > 0) {
          finalClassGroups[cls.id] = [...cls.groups];
        } else {
          finalClassGroups[cls.id] = [];
        }
      });
    }
    
    const levelClasses = classrooms.filter(cls => cls.level === editingCustomCourse.gradeLevel);
    const selectedLevelClasses = levelClasses.filter(cls => finalClassroomIds.includes(cls.id));
    const allLevelClassesSelected =
      levelClasses.length > 0 &&
      selectedLevelClasses.length === levelClasses.length;

    const allGroupsSelected = selectedLevelClasses.every(cls => {
      const availableGroups = (cls.groups || []).map(group => group.toLocaleUpperCase("tr-TR"));
      const selectedGroups = (finalClassGroups[cls.id] || []).map(group => group.toLocaleUpperCase("tr-TR"));
      return availableGroups.every(group => selectedGroups.includes(group));
    });

    const isCommonElective =
      editingCustomCourse.courseType === "Seçmeli Ders" &&
      allLevelClassesSelected &&
      allGroupsSelected;

    const selectedTargetGroups = Array.from(
      new Set(
        Object.entries(finalClassGroups)
          .filter(([classroomId]) => finalClassroomIds.includes(classroomId))
          .flatMap(([, groups]) => groups)
          .map(group => String(group).toLocaleUpperCase("tr-TR")),
      ),
    ).filter(group => ["SAY", "EA", "SÖZ", "DİL"].includes(group)) as Array<"SAY" | "EA" | "SÖZ" | "DİL">;

    const updatedCourse = {
      ...editingCustomCourse,
      selectedClassrooms: finalClassroomIds,
      classGroups: finalClassGroups,
      isCommonElective,
      targetGroups: isCommonElective ? ["ORTAK"] : selectedTargetGroups,
      courseGroup: isCommonElective
        ? undefined
        : (selectedTargetGroups.length > 0 ? selectedTargetGroups.join(", ") : undefined),
      courseName: formatCourseNameTitleCase(editingCustomCourse.courseName)
    };

    setCustomCourseUiOverrides((current) => ({
      ...current,
      [updatedCourse.id]: updatedCourse,
    }));
    setCustomCreatedCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
    setCustomCourseSaveRevision((revision) => revision + 1);
    
    const previousCourse = customCreatedCourses.find(c => c.id === updatedCourse.id);
    const cleanOldName = (previousCourse?.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
    const cleanNewName = updatedCourse.courseName.trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");

    // Update classroom assignments
    setClassrooms(prev => prev.map(cls => {
      if (cls.level !== updatedCourse.gradeLevel) {
        return cls;
      }

      const assignedList = Array.isArray(cls.assignedCourses) ? cls.assignedCourses : [];

      let oldAssignment = assignedList.find(ac => {
        const cleanACName = (ac.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
        return cleanACName === cleanOldName;
      });

      let newAssigned = assignedList.filter(ac => {
        const cleanACName = (ac.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
        return cleanACName !== cleanOldName;
      });

      if (finalClassroomIds.includes(cls.id)) {
        let targetGroup: string | undefined = undefined;
        if (updatedCourse.classGroups && updatedCourse.classGroups[cls.id] && updatedCourse.classGroups[cls.id].length > 0) {
          targetGroup = updatedCourse.classGroups[cls.id].join(", ");
        } else if (updatedCourse.courseGroup) {
          targetGroup = updatedCourse.courseGroup;
        }

        newAssigned.push({
          id: oldAssignment?.id || `assigned_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          courseId: updatedCourse.id,
          courseName: updatedCourse.courseName,
          type: updatedCourse.courseType === "Zorunlu Ders" ? "compulsory" : "elective",
          weeklyHours: updatedCourse.weeklyHours,
          teacherId: oldAssignment?.teacherId || "",
          teacherName: oldAssignment?.teacherName || "Belirtilmedi",
          teacherId2: oldAssignment?.teacherId2,
          teacherName2: oldAssignment?.teacherName2,
          schedule: `Haftalık ${updatedCourse.weeklyHours} Saat`,
          studentCount: 24,
          groupName: updatedCourse.isCommonElective ? undefined : targetGroup,
          splitGroupId: oldAssignment?.splitGroupId,
          isCommonElective: updatedCourse.isCommonElective,
          targetGroups: updatedCourse.targetGroups
        });
      }
      
      if (editingClassId && cls.id === editingClassId) {
        // Sync classCourses for the currently open class view
        setClassCourses(prev => {
          let updatedCC = prev.filter(cc => {
            const cleanCCName = (cc.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
            return cleanCCName !== cleanOldName;
          });
          
          if (finalClassroomIds.includes(cls.id)) {
            let targetGroup: string | undefined = undefined;
            if (updatedCourse.classGroups && updatedCourse.classGroups[cls.id] && updatedCourse.classGroups[cls.id].length > 0) {
              targetGroup = updatedCourse.classGroups[cls.id].join(", ");
            } else if (updatedCourse.courseGroup) {
              targetGroup = updatedCourse.courseGroup;
            }
            
            updatedCC.push({
              courseName: updatedCourse.courseName,
              teacherId: oldAssignment?.teacherId || "",
              teacherName: oldAssignment?.teacherName || "Belirtilmedi",
              teacherId2: oldAssignment?.teacherId2,
              teacherName2: oldAssignment?.teacherName2,
              weeklyHours: updatedCourse.weeklyHours,
              studentIds: [],
              type: updatedCourse.courseType === "Zorunlu Ders" ? "compulsory" : "elective",
              groupName: targetGroup,
              splitGroupId: oldAssignment?.splitGroupId
            });
          }
          return updatedCC;
        });
      }

      return { ...cls, assignedCourses: newAssigned };
    }));

    // Rebuild global courses based on customCreatedCourses (simplified synchronization)
    setCourses(prev => {
      // Remove all instances of the old course ONLY for the affected grade level's classrooms
      let updatedCourses = prev.filter(c => {
        const cleanCName = (c.name || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
        if (cleanCName === cleanOldName) {
          const targetCls = classrooms.find(cls => cls.name === c.classroom);
          if (targetCls && targetCls.level === updatedCourse.gradeLevel) {
            return false; // remove
          }
        }
        return true; // keep
      });

      // Add new instances
      const targetClassrooms = classrooms.filter(c => finalClassroomIds.includes(c.id));
      const newGlobalCourses = targetClassrooms.map(cls => {
        let oldGlobalCourse = prev.find(c => {
           const cleanCName = (c.name || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
           return cleanCName === cleanOldName && c.classroom === cls.name;
        });

        const safeCode = String(updatedCourse.courseName).substring(0, 3).toUpperCase().replace(/[^A-Za-z0-9]/g, "DRS");
        return {
          id: oldGlobalCourse?.id || `${updatedCourse.id}_${cls.id}`,
          name: updatedCourse.courseName,
          code: oldGlobalCourse?.code || `${safeCode}-${cls.name.replace(/\s+/g, '')}`,
          type: updatedCourse.courseType === "Zorunlu Ders" ? "compulsory" : "elective",
          color: oldGlobalCourse?.color || (updatedCourse.courseType === "Zorunlu Ders" ? "bg-emerald-100" : "bg-amber-100"),
          weeklyHours: updatedCourse.weeklyHours,
          classroom: cls.name,
          teacher: oldGlobalCourse?.teacher || "Atanmadı",
          teacherId: oldGlobalCourse?.teacherId || "",
          teacherName: oldGlobalCourse?.teacherName || "Belirtilmedi",
          teacherId2: oldGlobalCourse?.teacherId2,
          teacherName2: oldGlobalCourse?.teacherName2,
          schedule: oldGlobalCourse?.schedule || `Haftalık ${updatedCourse.weeklyHours} Saat`,
          studentCount: oldGlobalCourse?.studentCount || 24,
          groupName: (() => {
            const selectedGroups = updatedCourse.classGroups?.[cls.id] || [];
            return updatedCourse.isCommonElective
              ? undefined
              : (selectedGroups.length > 0 ? selectedGroups.join(", ") : undefined);
          })(),
          isCommonElective: updatedCourse.isCommonElective,
          targetGroups: updatedCourse.targetGroups,
        };
      });

      return [...updatedCourses, ...newGlobalCourses];
    });

    setEditingCustomCourse(null);
    triggerNotification(`'${updatedCourse.courseName}' dersi güncellendi.`);
  };

  const handleBulkDeleteCustomCourses = () => {
    if (selectedCustomCourseIds.length === 0) return;
    
    setDeleteConfirm({
      isOpen: true,
      type: "custom-course-bulk",
      id: "bulk",
      name: `${selectedCustomCourseIds.length} ders`,
    });
  };

  useEffect(() => {
    // Migration: scrub corrupted Sanat Eğitimi groups that were duplicated.
    const scrubbedStr = sqliteStorage.getItem("scrubbed_sanat_egitimi");
    if (!scrubbedStr && classrooms.length > 0) {
      setClassrooms(prev => prev.map(cls => {
        if (!cls.assignedCourses) return cls;
        return {
          ...cls,
          assignedCourses: cls.assignedCourses.filter(ac => {
            if (!ac || !ac.courseName || typeof ac.courseName !== "string") return false;
            const lowerName = ac.courseName.toLowerCase();
            if (lowerName.includes("sanat eğitimi (1. grup) (1. grup)")) return false;
            if (lowerName.includes("sanat eğitimi (2. grup) (2. grup)")) return false;
            return true;
          })
        };
      }));
      sqliteStorage.setItem("scrubbed_sanat_egitimi", "true");
    }
  }, [classrooms, setClassrooms]);

  // SINIFA DERS ATAMASINDA TEK KAYNAK:
  // classrooms[].assignedCourses
  //
  // ÖNEMLİ: customCreatedCourses yalnızca ders tanımı/katalog bilgisidir.
  // selectedClassrooms veya classGroups alanlarından assignedCourses ÜRETİLMEZ.
  // Böylece Sınıfa Ders / Derse Öğretmen Ata ekranında silinen bir ders başka bir useEffect
  // tarafından yeniden oluşturulamaz.
  //
  // Eski çift yönlü "onarım" senkronizasyonu özellikle kaldırılmıştır.

  // Modals
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "class" | "course" | "class-course" | "elective-pool" | "custom-course" | "custom-course-bulk" | "custom-course-class" | "custom-course-clear";
    id: string; // will store the key `${courseId}_${gradeLevel}` for elective pool or course ID
    name: string;
    grade?: string; // Add optional grade parameter for elective-pool deletion display
    extraId?: string; // For classroom ID when removing course from a specific class
  } | null>(null);

  // Elective Assignments Modal
  const [electiveModalState, setElectiveModalState] = useState<{
    isOpen: boolean;
    course: (typeof ELECTIVE_COURSES_POOL)[0] | null;
    grade: string;
    hours: number;
    hourOptions: number[];
  }>({ isOpen: false, course: null, grade: "", hours: 0, hourOptions: [] });

  const [electiveClassSelections, setElectiveClassSelections] = useState<
    Record<string, "all" | "group1" | "group2" | "none">
  >({});

  // Errors
  const [classError, setClassError] = useState("");
  const [courseError, setCourseError] = useState("");

  // Class Form states
  const [editingClassId, setEditingClassId] = useState<string | null>(null);


  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [selectedUIClassGroup, setSelectedUIClassGroup] = useState<string>("");
  const [activeMainDropdown, setActiveMainDropdown] = useState<string | null>(null);
  const [isClassGroupDropdownOpen, setIsClassGroupDropdownOpen] = useState(false);
  const [classCoursesClassId, setClassCoursesClassId] = useState<string | null>(null);
  const [classModalTab, setClassModalTab] = useState<"compulsory" | "electives">("compulsory");
  const [classForm, setClassForm] = useState<{
    name: string;
    level: string;
    groups: string[];
    group1Name?: string;
    group2Name?: string;
    advisorTeacherId: string;
    counselorTeacherId: string;
    vicePrincipal: string;
  }>({
    name: "",
    level: "9. Sınıf",
    groups: [],
    group1Name: "",
    group2Name: "",
    advisorTeacherId: "",
    counselorTeacherId: "",
    vicePrincipal: "",
  });

  const seatingPlanClassName =
    classrooms.find((cls) => cls?.id === editingClassId)?.name ||
    classForm.name ||
    classrooms[0]?.name ||
    "";

  // Dynamic state for course-teacher pairs in the Class modal
  const [rawClassCourses, rawSetClassCourses] = useState<
    {
      courseName: string;
      teacherId: string;
      teacherName?: string;
      teacherId2?: string;
      teacherName2?: string;
      teacherAssignmentCleared?: boolean;
      isCommonElective?: boolean;
      targetGroups?: Array<"ORTAK" | "SAY" | "EA" | "SÖZ" | "DİL">;
      weeklyHours: number;
      groupName?: string;
      splitGroupId?: string;
      studentIds?: string[];
      uiGroupSelectVisible?: boolean;
      uiTempSelectedGroup?: string;
      uiCommonCourseVisible?: boolean;
      uiTempCommonCourseName?: string;
      uiTempCommonTeacherId?: string;
      type?: string;
    }[]
  >([]);

  const classCourses = React.useMemo(() => {
    const is11A = editingClassId && (() => {
      const cls = classrooms.find(c => c && c.id === editingClassId);
      return cls && cls.name && (
        cls.name.trim() === "11-A" ||
        cls.name.trim() === "11 A" ||
        cls.name.trim() === "11A"
      );
    })();

    if (is11A) {
      return rawClassCourses.filter(cc => {
        if (!cc || !cc.courseName) return true;
        const lowerName = cc.courseName.toLowerCase();
        return (
          !lowerName.includes("seçmeli ingilizce") &&
          !lowerName.includes("s. ingilizce")
        );
      });
    }
    return rawClassCourses;
  }, [rawClassCourses, editingClassId, classrooms]);

  const setClassCourses = (
    val: any[] | ((prev: any[]) => any[])
  ) => {
    rawSetClassCourses(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      const is11A = editingClassId && (() => {
        const cls = classrooms.find(c => c && c.id === editingClassId);
        return cls && cls.name && (
          cls.name.trim() === "11-A" ||
          cls.name.trim() === "11 A" ||
          cls.name.trim() === "11A"
        );
      })();

      if (is11A) {
        return next.filter(cc => {
          if (!cc || !cc.courseName) return true;
          const lowerName = cc.courseName.toLowerCase();
          return (
            !lowerName.includes("seçmeli ingilizce") &&
            !lowerName.includes("s. ingilizce")
          );
        });
      }
      return next;
    });
  };

  const totalClassHours = classCourses.reduce((sum, cc) => sum + (cc.weeklyHours || 0), 0);

  const groupHours = (classForm.groups || []).reduce((acc, g) => {
    const hours = classCourses.reduce((sum, cc) => {
      const isCompulsory = !cc.type || cc.type === "Zorunlu Ders" || cc.type === "compulsory";
      
      if (isCompulsory) {
        return sum + (cc.weeklyHours || 0);
      }

      if (cc.groupName && cc.groupName.trim() !== "") {
        const belongsToGroup = cc.groupName.split(",").map((s) => s.trim().toUpperCase()).includes(g.toUpperCase());
        if (belongsToGroup) {
          return sum + (cc.weeklyHours || 0);
        }
      }
      
      return sum;
    }, 0);
    acc[g] = hours;
    return acc;
  }, {} as Record<string, number>);

  // ESKİ SINIF-DERS OTOMATİK GERİ-YAZMA DEVRE DIŞI.
  // Sınıfa ders atamasının tek kaynağı classrooms[].assignedCourses'tur.
  // Legacy classCourses ekran snapshot'ı artık assignedCourses üzerine yazılmaz.
  // Bu blok silinen dersin birkaç saniye sonra yeniden oluşmasının ana nedeniydi.

  const [addElectiveModalOpen, setAddElectiveModalOpen] = useState(false);
  const [addElectiveForm, setAddElectiveForm] = useState<{
    courseName: string;
    hours: number;
    mode: 'all' | 'group' | 'common' | 'split' | 'two_teachers' | 'merge' | '';
    teacherId: string;
    teacher1Id: string;
    teacher2Id: string;
    groupName: string;
    commonCourseName: string;
    commonCourseTeacherId: string;
    splitCourseName1: string;
    splitTeacherId1: string;
    splitCourseName2: string;
    splitTeacherId2: string;
  }>({
    courseName: '',
    hours: 2,
    mode: '',
    teacherId: '',
    teacher1Id: '',
    teacher2Id: '',
    groupName: 'SAY',
    commonCourseName: '',
    commonCourseTeacherId: '',
    splitCourseName1: '',
    splitTeacherId1: '',
    splitCourseName2: '',
    splitTeacherId2: ''
  });

  // Student association for elective courses
  const [isStudentSelectModalOpen, setIsStudentSelectModalOpen] = useState(false);
  const [activeCourseIndexForStudents, setActiveCourseIndexForStudents] = useState<number | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");

  const [groupStudentModal, setGroupStudentModal] = useState<{
    isOpen: boolean;
    classId: string | null;
    groupName: string;
  }>({ isOpen: false, classId: null, groupName: "" });
  const [groupStudentSearchTerm, setGroupStudentSearchTerm] = useState("");

  const getStudentsForClassName = (className: string) => {
    const normalizedClassName = (className || "").replace(/\s/g, "").toLocaleUpperCase("tr-TR");
    return (students || []).filter((s) => {
      const studentClass = (s.classroom || "").replace(/\s/g, "").toLocaleUpperCase("tr-TR");
      return studentClass === normalizedClassName;
    });
  };

  const getClassGroupStudentIds = (classId: string | null, groupName: string): string[] => {
    if (!classId || !groupName) return [];
    const cls = classrooms.find((c) => c.id === classId) as any;
    const groupMap = cls?.groupStudentIds || {};
    return Array.isArray(groupMap[groupName]) ? groupMap[groupName] : [];
  };

  const getStudentAssignedGroupInClass = (classId: string | null, studentId: string): string => {
    if (!classId || !studentId) return "";
    const cls = classrooms.find((c) => c.id === classId) as any;
    const groupMap = cls?.groupStudentIds || {};
    for (const [groupName, ids] of Object.entries(groupMap)) {
      if (Array.isArray(ids) && ids.includes(studentId)) return groupName;
    }
    return "";
  };

  const setClassGroupStudentIds = (classId: string, groupName: string, studentIds: string[]) => {
    setClassrooms((prev) =>
      prev.map((cls) => {
        if (cls.id !== classId) return cls;
        const existingMap = ((cls as any).groupStudentIds || {}) as Record<string, string[]>;
        return {
          ...cls,
          groupStudentIds: {
            ...existingMap,
            [groupName]: Array.from(new Set(studentIds)),
          },
        } as any;
      })
    );
  };

  const toggleClassGroupStudent = (studentId: string) => {
    const { classId, groupName } = groupStudentModal;
    if (!classId || !groupName || !studentId) return;

    setClassrooms((prev) =>
      prev.map((cls) => {
        if (cls.id !== classId) return cls;
        const currentMap = { ...(((cls as any).groupStudentIds || {}) as Record<string, string[]>) };
        const currentlyAssigned = Array.isArray(currentMap[groupName]) && currentMap[groupName].includes(studentId);

        // Bir öğrenci aynı sınıfta yalnızca bir grupta bulunur.
        for (const key of Object.keys(currentMap)) {
          currentMap[key] = (currentMap[key] || []).filter((id) => id !== studentId);
        }

        if (!currentlyAssigned) {
          currentMap[groupName] = [...(currentMap[groupName] || []), studentId];
        }

        return { ...cls, groupStudentIds: currentMap } as any;
      })
    );
  };

  const assignAllClassStudentsToGroup = () => {
    const { classId, groupName } = groupStudentModal;
    if (!classId || !groupName) return;
    const cls = classrooms.find((c) => c.id === classId);
    if (!cls) return;
    const classStudentIds = getStudentsForClassName(cls.name).map((s) => s.id);
    setClassGroupStudentIds(classId, groupName, classStudentIds);
  };

  const clearClassGroupStudents = () => {
    const { classId, groupName } = groupStudentModal;
    if (!classId || !groupName) return;
    setClassGroupStudentIds(classId, groupName, []);
  };

  const toggleStudentSelected = (studentId: string) => {
    if (activeCourseIndexForStudents === null) return;
    const updated = [...classCourses];
    if (!updated[activeCourseIndexForStudents]) return;
    const currentList = updated[activeCourseIndexForStudents].studentIds || [];
    let newList;
    if (currentList.includes(studentId)) {
      newList = currentList.filter(id => id !== studentId);
    } else {
      newList = [...currentList, studentId];
    }
    updated[activeCourseIndexForStudents] = {
      ...updated[activeCourseIndexForStudents],
      studentIds: newList
    };
    setClassCourses(updated);
  };

  const selectAllStudents = (classStudents: Student[]) => {
    if (activeCourseIndexForStudents === null) return;
    const updated = [...classCourses];
    if (!updated[activeCourseIndexForStudents]) return;
    updated[activeCourseIndexForStudents] = {
      ...updated[activeCourseIndexForStudents],
      studentIds: classStudents.map(s => s.id)
    };
    setClassCourses(updated);
  };

  const deselectAllStudents = () => {
    if (activeCourseIndexForStudents === null) return;
    const updated = [...classCourses];
    if (!updated[activeCourseIndexForStudents]) return;
    updated[activeCourseIndexForStudents] = {
      ...updated[activeCourseIndexForStudents],
      studentIds: []
    };
    setClassCourses(updated);
  };

  // Course Form states
  const [courseForm, setCourseForm] = useState({
    name: "",
    code: "",
    classroom: "",
    teacherId: "",
    schedule: "Pazartesi 09:00 - 11:20",
    studentCount: "25",
  });

  // Split Class Form State
  const [splitForm, setSplitForm] = useState({
    classroomName: "",
    weeklyHours: 2,
    group1Name: "1. Grup",
    group1ElectiveId: "",
    group1TeacherId: "",
    group2Name: "2. Grup",
    group2ElectiveId: "",
    group2TeacherId: "",
  });



  // Filter lists
  const filteredClassrooms = classrooms.filter((c) => {
    if (!c) return false;
    const advisor =
      teachers.find((t) => t && t.id === c.advisorTeacherId)?.name || "";
    const vicePrincipal = c.vicePrincipal || "";
    const nameLower = (c.name || "").toLowerCase();
    const levelLower = (c.level || "").toLowerCase();
    const searchLower = (searchTerm || "").toLowerCase();
    return (
      nameLower.includes(searchLower) ||
      levelLower.includes(searchLower) ||
      advisor.toLowerCase().includes(searchLower) ||
      vicePrincipal.toLowerCase().includes(searchLower)
    );
  });

  const sortedFilteredClassrooms = [...filteredClassrooms].sort((a, b) => {
    const getGradeLevel = (lvl: string | undefined | null) => {
      if (!lvl) return 99;
      const match = lvl.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 99;
    };
    const levelA = getGradeLevel(a.level);
    const levelB = getGradeLevel(b.level);
    if (levelA !== levelB) return levelA - levelB;
    const nameA = a.name || "";
    const nameB = b.name || "";
    return nameA.localeCompare(nameB, "tr", { numeric: true, sensitivity: "base" });
  });

  const calculateTotalHours = (courses: any) => {
    if (!courses || !Array.isArray(courses)) return 0;
    
    let total = 0;
    const splitGroups = new Set<string>();
    
    for (const c of courses) {
      if (!c || typeof c !== 'object') continue;
      
      const hours = Number(c.weeklyHours) || 0;
      
      if (c.splitGroupId) {
        if (!splitGroups.has(c.splitGroupId)) {
          total += hours;
          splitGroups.add(c.splitGroupId);
        }
      } else {
        total += hours;
      }
    }
    return total;
  };

  const getLevelColorVars = (level: string | undefined | null) => {
    if (!level)
      return {
        bg: "bg-indigo-50",
        text: "text-indigo-600",
        fill: "bg-indigo-500",
      };
    if (level.includes("9."))
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-600",
        fill: "bg-emerald-500",
      };
    if (level.includes("10."))
      return { bg: "bg-cyan-50", text: "text-cyan-600", fill: "bg-cyan-500" };
    if (level.includes("11."))
      return {
        bg: "bg-amber-50",
        text: "text-amber-600",
        fill: "bg-amber-500",
      };
    if (level.includes("12."))
      return {
        bg: "bg-purple-50",
        text: "text-purple-600",
        fill: "bg-purple-500",
      };
    return {
      bg: "bg-indigo-50",
      text: "text-indigo-600",
      fill: "bg-indigo-500",
    };
  };

  const filteredCourses = courses.filter((course) => {
    if (!course) return false;
    const term = (searchTerm || "").toLowerCase();
    return (
      (course.name || "").toLowerCase().includes(term) ||
      (course.code || "").toLowerCase().includes(term) ||
      (course.teacherName || "").toLowerCase().includes(term) ||
      (course.classroom || "").toLowerCase().includes(term)
    );
  });

  // --- ACTIONS FOR CLASSES ---
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassError("");

    if (!classForm.name.trim()) {
      setClassError("Sınıf adı girmek zorunludur.");
      return;
    }

    let trimmedName = classForm.name.toUpperCase().trim();
    // Format to ensure hyphen (e.g., "12 - A")
    trimmedName = trimmedName.replace(/^-\s*/, "").replace(/(\d+)\s*-?\s*([A-Za-z]+)/g, "$1 - $2").replace(/\s*-\s*/g, " - ");

    // Format manually assigned courses from dynamic lines
    const assignedCoursesFormatted = (classCourses || [])
      .filter((cc) => cc && cc.courseName && typeof cc.courseName === "string" && cc.courseName.trim() !== "")
      .map((cc) => {
        const assignedTeacherObj = teachers.find((t) => t && t.id === cc.teacherId);
        const cleanCourseName = (cc.courseName || "").trim().replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
        
        return {
          courseName: cleanCourseName,
          teacherId: cc.teacherId || "",
          teacherName: cc.teacherName && cc.teacherName !== "Belirtilmedi"
            ? cc.teacherName
            : (assignedTeacherObj ? assignedTeacherObj.name : "Belirtilmedi"),
          teacherId2: cc.teacherId2 || undefined,
          teacherName2: cc.teacherName2 || undefined,
          weeklyHours: Number(cc.weeklyHours) || 2,
          groupName: cc.groupName || undefined,
          splitGroupId: cc.splitGroupId || undefined,
          studentIds: Array.isArray(cc.studentIds) ? cc.studentIds : [],
          type: (cc as any).type || undefined,
        };
      });

    // Sort electives and compulsory courses deterministically in the same format/order
    const compulsoryList = COMPULSORY_COURSES[classForm.level as keyof typeof COMPULSORY_COURSES] || [];
    const compCourses = assignedCoursesFormatted.filter(ac => 
      compulsoryList.some(c => isSameCourseName(c.name, ac.courseName))
    );
    const electCourses = assignedCoursesFormatted.filter(ac => 
      !compulsoryList.some(c => isSameCourseName(c.name, ac.courseName))
    );

    compCourses.sort((a, b) => {
      const idxA = compulsoryList.findIndex(c => isSameCourseName(c.name, a.courseName));
      const idxB = compulsoryList.findIndex(c => isSameCourseName(c.name, b.courseName));
      return idxA - idxB;
    });

    electCourses.sort((a, b) => {
      const nameA = a.courseName.toLocaleUpperCase("tr-TR");
      const nameB = b.courseName.toLocaleUpperCase("tr-TR");
      if (nameA !== nameB) return nameA.localeCompare(nameB, "tr");
      
      const grpA = (a.groupName || "").toLocaleUpperCase("tr-TR");
      const grpB = (b.groupName || "").toLocaleUpperCase("tr-TR");
      if (grpA !== grpB) return grpA.localeCompare(grpB, "tr");
      
      const sgA = a.splitGroupId || "";
      const sgB = b.splitGroupId || "";
      return sgA.localeCompare(sgB);
    });

    const sortedAssignedCourses = [...compCourses, ...electCourses];

    console.log("Saving class:", trimmedName, "with assignedCourses:", sortedAssignedCourses);

    const totalHours = calculateTotalHours(sortedAssignedCourses);
    if (totalHours > 80) {
      setClassError(
        `Sınıfa en fazla 80 saat ders eklenebilir. Şu anki toplam: ${totalHours} Saat`,
      );
      return;
    }

    const advisor = teachers.find((t) => t && t.id === classForm.advisorTeacherId);
    const counselor = teachers.find((t) => t && t.id === classForm.counselorTeacherId);

    const buildGeneratedCourses = (classroomName: string): Course[] =>
      (sortedAssignedCourses || []).map((cc, index) => {
        const safeName = cc.courseName || "Adsız Ders";
        const safeCode = String(safeName)
          .substring(0, 3)
          .toUpperCase()
          .replace(/[^A-Za-z0-9]/g, "DRS");

        return {
          id: `CRS-${Date.now()}-${index}-${classroomName.replace(/\s+/g, "")}`,
          name: safeName,
          code: `${safeCode}-${classroomName.replace(/\s+/g, "")}-${index}`,
          classroom: classroomName,
          teacherId: cc.teacherId || "",
          teacherName: cc.teacherName || "Belirtilmedi",
          teacherId2: cc.teacherId2,
          teacherName2: cc.teacherName2,
          teacherAssignmentCleared: Boolean((cc as any).teacherAssignmentCleared),
          schedule: cc.weeklyHours ? `Haftalık ${cc.weeklyHours} Saat` : "Belirtilmedi",
          studentCount: 24,
          groupName: cc.groupName,
          splitGroupId: cc.splitGroupId,
          weeklyHours: Number(cc.weeklyHours) || 0,
          type: (cc as any).type || undefined,
        };
      });

    if (editingClassId) {
      const oldClass = classrooms.find((c) => c && c.id === editingClassId);
      if (!oldClass) {
        setClassError("Güncellenecek sınıf kaydı bulunamadı.");
        return;
      }

      const updatedClassroom: Classroom = {
        ...oldClass,
        name: normalizeClassroomName(trimmedName),
        level: classForm.level || "9. Sınıf",
        groups: classForm.groups,
        group1Name: classForm.group1Name || undefined,
        group2Name: classForm.group2Name || undefined,
        advisorTeacherId: advisor?.id,
        advisorTeacherName: advisor?.name,
        counselorTeacherId: counselor?.id,
        counselorTeacherName: counselor?.name,
        vicePrincipal: (classForm.vicePrincipal || "").trim(),
        assignedCourses: sortedAssignedCourses || [],
      };

      try {
        await classroomService.assertUpdateAllowed(editingClassId, updatedClassroom);
        const nextClassrooms = (classrooms || []).map((classroom) =>
          classroom.id === editingClassId ? updatedClassroom : classroom,
        );
        const generatedCourses = buildGeneratedCourses(updatedClassroom.name);
        const nextCourses = [
          ...(courses || []).filter((course) => course && course.classroom !== oldClass.name),
          ...generatedCourses,
        ];

        // Sınıf + ona bağlı dersler tek SQLite transaction içinde yazılır.
        // Böylece ders yazımı başarısız olduğunda sınıf kaydı da rollback edilir.
        await classroomService.commitAcademicCatalog(
          nextClassrooms,
          nextCourses,
          customCreatedCourses || [],
          "updated",
          { previousId: editingClassId, classroom: updatedClassroom },
        );

        setClassrooms(nextClassrooms);
        setCourses(nextCourses);
        triggerNotification(`'${updatedClassroom.name}' sınıf bilgileri güncellendi.`);
        setIsClassroomModalOpen(false);
        setEditingClassId(null);
        setClassCoursesClassId(null);
        setClassForm({
          name: "",
          level: "9. Sınıf",
          groups: [],
          group1Name: "",
          group2Name: "",
          advisorTeacherId: "",
          counselorTeacherId: "",
          vicePrincipal: "",
        });
        setClassCourses([]);
      } catch (error) {
        console.error("Sınıf güncellenemedi:", error);
        setClassError(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    try {
      const newClass = await classroomService.prepareNewClassroom({
        name: trimmedName,
        level: classForm.level || "9. Sınıf",
        groups: classForm.groups,
        group1Name: classForm.group1Name || undefined,
        group2Name: classForm.group2Name || undefined,
        advisorTeacherId: advisor?.id,
        advisorTeacherName: advisor?.name,
        counselorTeacherId: counselor?.id,
        counselorTeacherName: counselor?.name,
        vicePrincipal: (classForm.vicePrincipal || "").trim(),
        assignedCourses: sortedAssignedCourses || [],
      });

      const generatedCourses = buildGeneratedCourses(newClass.name);
      const nextClassrooms = [...(classrooms || []), newClass];
      const nextCourses = [...(courses || []), ...generatedCourses];

      await classroomService.commitAcademicCatalog(
        nextClassrooms,
        nextCourses,
        customCreatedCourses || [],
        "created",
        newClass,
      );

      setClassrooms(nextClassrooms);
      setCourses(nextCourses);
      triggerNotification(`'${newClass.name}' sınıfı veritabanına kaydedildi.`);
      setIsClassroomModalOpen(false);
      setEditingClassId(null);
      setClassCoursesClassId(null);
      setClassForm({
        name: "",
        level: "9. Sınıf",
        groups: [],
        group1Name: "",
        group2Name: "",
        advisorTeacherId: "",
        counselorTeacherId: "",
        vicePrincipal: "",
      });
      setClassCourses([]);
    } catch (error) {
      console.error("Yeni sınıf kaydedilemedi:", error);
      setClassError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCreateCustomElective = () => {
    if (!createElectiveName.trim()) return;
    
    const newId = `custom-el-${Date.now()}`;
    const newCourse = {
      id: newId,
      name: createElectiveName.toUpperCase(),
      category: "ÖZEL",
      hoursMap: {
        [createElectiveGrade]: [1, 2, 3, 4, 5, 6, 7, 8], // Default wide range for custom ones
        "9. Sınıf": [1, 2, 3, 4],
        "10. Sınıf": [1, 2, 3, 4],
        "11. Sınıf": [1, 2, 3, 4],
        "12. Sınıf": [1, 2, 3, 4],
      },
      isCustom: true
    };
    
    setCustomElectives(prev => [...prev, newCourse]);
    setCreateElectiveName("");
    triggerNotification(`'${createElectiveName}' seçmeli dersi oluşturuldu.`);
  };

  const [notification, setNotification] = useState("");
  const triggerNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification("");
    }, 4500);
  };

  const {
    isListening,
    voiceFeedback,
    setVoiceFeedback,
    voiceTeacherSlot,
    startSpeechRecognition,
    stopSpeechRecognition,
  } = useCourseVoiceAssignment({
    teachers,
    classrooms,
    courses,
    customCreatedCourses,
    editingClassId,
    classCourses,
    setClassCourses,
    setClassrooms,
    setCourses,
    setTempTeacherToAssign,
    setTempTeacherToAssign2,
    notify: triggerNotification,
  });

  const openElectiveModal = (
    course: (typeof ELECTIVE_COURSES_POOL)[0],
    grade: string,
    defaultHours: number,
    hourOptions: number[],
  ) => {
    if (!course) return;
    const selections: Record<string, "all" | "group1" | "group2" | "none"> = {};
    const classesInGrade = (classrooms || []).filter((c) => c && c.level === grade);

    const anyAssigned = classesInGrade.some((c) => {
      if (!c) return false;
      return (c.assignedCourses || []).some(
        (ac) => ac && isSameCourseName(ac.courseName, course.name),
      );
    });

    classesInGrade.forEach((c) => {
      if (!c) return;
      const assigned = (c.assignedCourses || []).find(
        (ac) => ac && isSameCourseName(ac.courseName, course.name),
      );
      if (assigned) {
        if (assigned.groupName) {
          if (assigned.groupName === c.group1Name) selections[c.id] = "group1";
          else if (assigned.groupName === c.group2Name)
            selections[c.id] = "group2";
          else selections[c.id] = "all";
        } else {
          selections[c.id] = "all";
        }
      } else {
        selections[c.id] = "none";
      }
    });

    setElectiveClassSelections(selections);
    setElectiveModalState({
      isOpen: true,
      course,
      grade: grade || "",
      hours: defaultHours || (hourOptions && hourOptions[0]) || 2,
      hourOptions: hourOptions || [2],
    });
  };

  const saveElectiveSelection = () => {
    try {
      if (!electiveModalState || !electiveModalState.course) return;

      const { course, grade, hours } = electiveModalState;
      if (!course || !course.name) return;

      const key = `${course.id}_${grade}`;

      const isAnySelected = Object.values(electiveClassSelections || {}).some(
        (val) => val !== "none",
      );

      // Always keep it in selectedElectives when saved
      setSelectedElectives((prev) => {
        const newSelect = { ...(prev || {}) };
        newSelect[key] = hours;
        return newSelect;
      });

      let newlyAssignedToClass = 0;
      const newCoursesToCreate: Course[] = [];
      const removedClassroomNames: string[] = [];

      const updatedClassrooms = (classrooms || [])
        .filter(Boolean)
        .map((c) => {
          if (c.level !== grade) return c;

          const selection = (electiveClassSelections || {})[c.id] || "none";
          const existingAssigned = Array.isArray(c.assignedCourses) ? c.assignedCourses.filter(Boolean) : [];
          const hasCourse = existingAssigned.some(
            (ac) => ac && isSameCourseName(ac.courseName, course.name),
          );

          if (selection === "none") {
            if (hasCourse) {
              removedClassroomNames.push(c.name || "");
            }
            return {
              ...c,
              assignedCourses: existingAssigned.filter(
                (ac) => ac && !isSameCourseName(ac.courseName, course.name),
              ),
            };
          }

          let groupName: string | undefined;
          if (selection === "group1") groupName = c.group1Name;
          if (selection === "group2") groupName = c.group2Name;

          if (hasCourse) {
            return {
              ...c,
              assignedCourses: existingAssigned.map((ac) =>
                ac && isSameCourseName(ac.courseName, course.name)
                  ? { ...ac, weeklyHours: hours, groupName }
                  : ac,
              ),
            };
          } else {
            newlyAssignedToClass++;
            const matchedTeacher = findMatchingTeacher(course.name, teachers || []);
            const courseNameStr = course.name || "";
            const safeCode = courseNameStr
              .substring(0, 3)
              .toUpperCase()
              .replace(/[^A-Za-z0-9]/g, "DRS");
            newCoursesToCreate.push({
              id: `CRS-${Math.floor(100 + Math.random() * 899) + newlyAssignedToClass + Date.now()}`,
              name: courseNameStr,
              code: `${safeCode}-${c.name || ""}`,
              classroom: c.name || "",
              teacherId: matchedTeacher?.id || "",
              teacherName: matchedTeacher?.name || "Belirtilmedi",
              schedule: `Haftalık ${hours} Saat`,
              studentCount: 24,
            });

            return {
              ...c,
              assignedCourses: [
                ...existingAssigned,
                {
                  courseName: courseNameStr,
                  teacherId: matchedTeacher?.id || "",
                  teacherName: matchedTeacher?.name || "Belirtilmedi",
                  weeklyHours: hours,
                  groupName,
                },
              ],
            };
          }
        });

      setClassrooms(updatedClassrooms as Classroom[]);
      
      // Synchronize global courses list
      setCourses((prev) => {
        const prevList = prev || [];
        const filtered = prevList.filter(
          (crs) =>
            !(
              crs &&
              isSameCourseName(crs.name, course.name) &&
              crs.classroom &&
              removedClassroomNames.includes(crs.classroom)
            ),
        ).filter(Boolean);
        return [...filtered, ...newCoursesToCreate] as Course[];
      });

      triggerNotification(
        isAnySelected
          ? `${course.name} dersi seçili sınıflara atandı.`
          : `${course.name} dersinin şube atamaları güncellendi (hiçbir şubeye atanmadı).`,
      );

      setElectiveModalState({
        isOpen: false,
        course: null,
        grade: "",
        hours: 0,
        hourOptions: [],
      });
    } catch (error: any) {
      console.error("Save elective selection error:", error);
      triggerNotification(`Hata: ${error?.message || "Ders kaydedilirken bir hata oluştu"}`);
    }
  };

  const handleAutoLoadCompulsoryStructure = () => {
    const defaultClasses = [
      { name: "9-A", level: "9. Sınıf", vicePrincipal: "Müdür Yard. Ahmet Ak" },
      {
        name: "10-A",
        level: "10. Sınıf",
        vicePrincipal: "Müdür Yard. Can Demir",
      },
      {
        name: "11-A",
        level: "11. Sınıf",
        vicePrincipal: "Müdür Yard. Elif Yurt",
      },
      {
        name: "12-A",
        level: "12. Sınıf",
        vicePrincipal: "Müdür Yard. Seda Şen",
      },
    ];

    const newClassrooms: Classroom[] = [];
    const newCourses: Course[] = [];

    defaultClasses.forEach((defClass) => {
      // Skip if already exists
      if (classrooms.some((c) => c.name === defClass.name)) {
        return;
      }

      const levelKey = defClass.level as keyof typeof COMPULSORY_COURSES;
      const compulsoryForLevel = COMPULSORY_COURSES[levelKey] || [];

      const assignedCourses = compulsoryForLevel.map((cc) => {
        const matchedTeacher = findMatchingTeacher(cc.name, teachers);
        return {
          courseName: cc.name,
          teacherId: matchedTeacher.id,
          teacherName: matchedTeacher.name,
          weeklyHours: cc.hours,
        };
      });

      const newCls: Classroom = {
        id: `CLS-${Math.floor(1000 + Math.random() * 9000)}`,
        name: defClass.name,
        level: defClass.level,
        vicePrincipal: defClass.vicePrincipal,
        assignedCourses,
      };

      newClassrooms.push(newCls);

      assignedCourses.forEach((cc, index) => {
        const safeCode = cc.courseName
          .substring(0, 3)
          .toUpperCase()
          .replace(/[^A-Za-z0-9]/g, "DRS");
        newCourses.push({
          id: `CRS-${Math.floor(100 + Math.random() * 899) + index + Date.now()}`,
          name: cc.courseName,
          code: `${safeCode}-${defClass.name}`,
          classroom: defClass.name,
          teacherId: cc.teacherId,
          teacherName: cc.teacherName,
          schedule: `Haftalık ${cc.weeklyHours} Saat`,
          studentCount: 24,
        });
      });
    });

    if (newClassrooms.length === 0) {
      triggerNotification(
        "Sınıflar (9-A, 10-A, 11-A, 12-A) zaten mevcut olduğu için işlem yapılmadı.",
      );
      return;
    }

    setClassrooms((prev) => [...prev, ...newClassrooms]);
    setCourses((prev) => [...prev, ...newCourses]);
    triggerNotification(
      "Tüm ortak zorunlu dersler ve sınıflar haftalık çizelgeye göre yüklendi!",
    );
  };


  // Editor state for selected class
  const handleUpdateClassCourseTeacher = (
    idx: number,
    newTeacherId: string,
  ) => {
    const updatedLocal = [...classCourses];
    updatedLocal[idx].teacherId = newTeacherId;
    const teacher = teachers.find(t => t.id === newTeacherId);
    updatedLocal[idx].teacherName = teacher ? teacher.name : "Öğretmen Atanmadı";
    updatedLocal[idx].teacherAssignmentCleared = !newTeacherId;
    setClassCourses(updatedLocal);
  };

  const handleRemoveClassCourse = (idx: number, courseName: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: "class-course",
      id: idx.toString(),
      name: courseName,
    });
  };

  const handleDeleteClass = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, type: "class", id, name });
  };

  // --- ACTIONS FOR COURSES ---
  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    setCourseError("");

    if (
      !courseForm.name.trim() ||
      !courseForm.code.trim() ||
      !courseForm.schedule.trim()
    ) {
      setCourseError(
        "Ders adı, benzersiz ders kodu ve zaman planlaması zorunludur.",
      );
      return;
    }

    const assignedTeacher = teachers.find((t) => t && t.id === courseForm.teacherId);
    if (!assignedTeacher) {
      setCourseError("Sorumlu bir öğretmen atanmış olmalıdır.");
      return;
    }

    const studentCountNum = parseInt(courseForm.studentCount);
    if (isNaN(studentCountNum) || studentCountNum < 0) {
      setCourseError("Öğrenci kapasitesi geçerli bir sayı olmalıdır.");
      return;
    }

    // Determine classroom name
    let selectedClassroom = courseForm.classroom.trim();
    if (!selectedClassroom) {
      if (classrooms.length > 0) {
        selectedClassroom = classrooms[0].name;
      } else {
        selectedClassroom = "Belirtilmedi";
      }
    }

    const newCourse: Course = {
      id: `CRS-${Math.floor(100 + Math.random() * 900)}`,
      name: courseForm.name.trim(),
      code: courseForm.code.toUpperCase().trim(),
      classroom: selectedClassroom,
      teacherId: assignedTeacher.id,
      teacherName: assignedTeacher.name,
      schedule: courseForm.schedule.trim(),
      studentCount: studentCountNum,
    };

    setCourses((prev) => [...prev, newCourse]);
    setIsCourseModalOpen(false);
  };

  const handleDeleteCourse = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, type: "course", id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === "class") {
      const classToDelete = classrooms.find((c) => c.id === deleteConfirm.id);
      if (!classToDelete) {
        setDeleteConfirm(null);
        return;
      }
      const nextClassrooms = classrooms.filter((c) => c.id !== deleteConfirm.id);
      const nextCourses = courses.filter((c) => c.classroom !== classToDelete.name);
      try {
        await classroomService.commitAcademicCatalog(
          nextClassrooms,
          nextCourses,
          customCreatedCourses || [],
          "deleted",
          classToDelete,
        );
        setClassrooms(nextClassrooms);
        setCourses(nextCourses);
        triggerNotification(`'${classToDelete.name}' sınıfı ve bağlı ders kayıtları silindi.`);
      } catch (error) {
        console.error("Sınıf silinemedi:", error);
        triggerNotification(`Sınıf silinemedi: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    } else if (deleteConfirm.type === "course") {
      setCourses((prev) => prev.filter((c) => c.id !== deleteConfirm.id));
    } else if (deleteConfirm.type === "class-course") {
      const idx = parseInt(deleteConfirm.id, 10);
      const updatedLocal = [...classCourses];
      updatedLocal.splice(idx, 1);
      setClassCourses(updatedLocal);
    } else if (deleteConfirm.type === "elective-pool") {
      const key = deleteConfirm.id;
      const [courseId, grade] = key.split('_');
      
      setSelectedElectives(prev => {
        const copy = {...prev};
        delete copy[key];
        return copy;
      });
      
      const affectedClassrooms = classrooms.filter(c => c.level === grade).map(c => c.name);

      setClassrooms(prev => prev.map(c => {
        if(c.level === grade) {
          return {
            ...c,
            assignedCourses: (c.assignedCourses || []).filter(ac => ac && ac.courseName !== deleteConfirm.name)
          }
        }
        return c;
      }));

      setCourses(prev => prev.filter(c => !(c.name === deleteConfirm.name && affectedClassrooms.includes(c.classroom || ""))));
    } else if (deleteConfirm.type === "custom-course") {
      const courseId = deleteConfirm.id;
      const courseToDelete = customCreatedCourses.find(c => c.id === courseId);
      if (courseToDelete) {
        setCustomCreatedCourses(prev => prev.filter(c => c.id !== courseId));

        setClassrooms(prev => prev.map(cls => {
          if (cls.level === courseToDelete.gradeLevel && cls.assignedCourses) {
            return {
              ...cls,
              assignedCourses: cls.assignedCourses.filter(c => {
                const cleanCName = (c.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
                const cleanDelName = (courseToDelete.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
                return cleanCName !== cleanDelName;
              })
            };
          }
          return cls;
        }));

        setClassCourses(prev => {
          const activeCls = classrooms.find(c => c.id === editingClassId);
          if (activeCls && activeCls.level === courseToDelete.gradeLevel) {
            return prev.filter(c => {
              const cleanCName = (c.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
              const cleanDelName = (courseToDelete.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
              return cleanCName !== cleanDelName;
            });
          }
          return prev;
        });

        setCourses(prev => prev.filter(c => {
          const cleanCName = (c.name || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
          const cleanDelName = (courseToDelete.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
          if (cleanCName === cleanDelName) {
            const targetCls = classrooms.find(cls => cls.name === c.classroom);
            if (targetCls && targetCls.level === courseToDelete.gradeLevel) {
              return false;
            }
          }
          return true;
        }));
      }
    } else if (deleteConfirm.type === "custom-course-bulk") {
      const coursesToDelete = customCreatedCourses.filter(c => selectedCustomCourseIds.includes(c.id));
      const namesByGrade = new Map<string, Set<string>>();
      coursesToDelete.forEach(c => {
        const cleanName = c.courseName.trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
        if (!namesByGrade.has(c.gradeLevel)) {
          namesByGrade.set(c.gradeLevel, new Set());
        }
        namesByGrade.get(c.gradeLevel)!.add(cleanName);
      });

      setCustomCreatedCourses(prev => prev.filter(c => !selectedCustomCourseIds.includes(c.id)));

      setClassrooms(prev => prev.map(cls => {
        if (cls.assignedCourses && namesByGrade.has(cls.level)) {
          const namesForThisGrade = namesByGrade.get(cls.level)!;
          return {
            ...cls,
            assignedCourses: cls.assignedCourses.filter(c => {
              const cleanCName = (c.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
              return !namesForThisGrade.has(cleanCName);
            })
          };
        }
        return cls;
      }));

      setClassCourses(prev => {
        const activeCls = classrooms.find(c => c.id === editingClassId);
        if (activeCls && namesByGrade.has(activeCls.level)) {
          const namesForThisGrade = namesByGrade.get(activeCls.level)!;
          return prev.filter(c => {
            const cleanCName = (c.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
            return !namesForThisGrade.has(cleanCName);
          });
        }
        return prev;
      });

      setCourses(prev => prev.filter(c => {
        const cleanCName = (c.name || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
        const targetCls = classrooms.find(cls => cls.name === c.classroom);
        if (targetCls && namesByGrade.has(targetCls.level)) {
          const namesForThisGrade = namesByGrade.get(targetCls.level)!;
          return !namesForThisGrade.has(cleanCName);
        }
        return true;
      }));

      setSelectedCustomCourseIds([]);
      triggerNotification(`${selectedCustomCourseIds.length} ders başarıyla silindi.`);
    } else if (deleteConfirm.type === "custom-course-class") {
      const courseId = deleteConfirm.id;
      const classroomId = deleteConfirm.extraId;
      const course = customCreatedCourses.find(c => c.id === courseId);
      
      if (course && classroomId) {
        const classroomNameMatch = deleteConfirm.name.match(/\((.*?)\)/);
        const classroomName = classroomNameMatch ? classroomNameMatch[1] : "";

        setCustomCreatedCourses(prev => prev.map(cc => {
          if (cc.id === courseId) {
            return {
              ...cc,
              selectedClassrooms: cc.selectedClassrooms.filter(id => id !== classroomId)
            };
          }
          return cc;
        }));

        setClassrooms(prev => prev.map(cls => {
          if (cls.id === classroomId && cls.assignedCourses) {
            return {
              ...cls,
              assignedCourses: cls.assignedCourses.filter(ac => {
                const cleanCName = (ac.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
                const cleanDelName = (course.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
                return cleanCName !== cleanDelName;
              })
            };
          }
          return cls;
        }));

        setClassCourses(prev => prev.filter(c => {
          const cleanCName = (c.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
          const cleanDelName = (course.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
          return cleanCName !== cleanDelName;
        }));

        setCourses(prev => prev.filter(c => {
          const cleanCName = (c.name || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
          const cleanDelName = (course.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
          if (cleanCName === cleanDelName && c.classroom === classroomName) {
            return false;
          }
          return true;
        }));
      }
    } else if (deleteConfirm.type === "custom-course-clear") {
      const courseId = deleteConfirm.id;
      const course = customCreatedCourses.find(c => c.id === courseId);
      
      if (course) {
        setCustomCreatedCourses(prev => prev.map(cc => {
          if (cc.id === courseId) {
            return {
              ...cc,
              selectedClassrooms: []
            };
          }
          return cc;
        }));

        setClassrooms(prev => prev.map(cls => {
          if (cls.level === course.gradeLevel && cls.assignedCourses) {
            return {
              ...cls,
              assignedCourses: cls.assignedCourses.filter(ac => {
                const cleanCName = (ac.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
                const cleanDelName = (course.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
                return cleanCName !== cleanDelName;
              })
            };
          }
          return cls;
        }));

        setClassCourses(prev => {
          const activeCls = classrooms.find(c => c.id === editingClassId);
          if (activeCls && activeCls.level === course.gradeLevel) {
            return prev.filter(c => {
              const cleanCName = (c.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
              const cleanDelName = (course.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
              return cleanCName !== cleanDelName;
            });
          }
          return prev;
        });

        setCourses(prev => prev.filter(c => {
          const cleanCName = (c.name || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
          const cleanDelName = (course.courseName || "").trim().toLocaleLowerCase('tr-TR').replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "");
          if (cleanCName === cleanDelName) {
            const targetCls = classrooms.find(cls => cls.name === c.classroom);
            if (targetCls && targetCls.level === course.gradeLevel) {
              return false;
            }
          }
          return true;
        }));

        triggerNotification(`'${course.courseName}' dersi tüm şubelerden kaldırıldı.`);
      }
    }

    setDeleteConfirm(null);
  };

  const getBranchLetter = (fullName: string) => {
    if (!fullName) return "";
    const match = fullName.match(/[A-Za-z0-9ğüşıöçĞÜŞİÖÇ]+$/);
    return match ? match[0] : fullName;
  };

  const handleBranchNameChange = (letter: string) => {
    const levelNumber = classForm.level.match(/\d+/)?.[0] || "9";
    const combinedName = letter ? `${levelNumber} - ${letter.toUpperCase().trim()}` : "";
    setClassForm(prev => ({ ...prev, name: combinedName }));
  };

  const handleLevelChangeInModal = (newLevel: string) => {
    const currentLetter = getBranchLetter(classForm.name);
    const levelNumber = newLevel.match(/\d+/)?.[0] || "9";
    const combinedName = currentLetter ? `${levelNumber} - ${currentLetter}` : "";
    setClassForm(prev => ({ ...prev, level: newLevel, name: combinedName }));
  };

  const handleUpdateActiveClassField = async (field: string, value: any) => {
    if (!editingClassId) return;
    const active = classrooms.find((cls) => cls.id === editingClassId);
    if (!active) return;

    const updated: Classroom = { ...active };
    if (field === "vicePrincipal") {
      updated.vicePrincipal = String(value || "").trim();
    } else if (field === "advisorTeacherId") {
      const teacher = teachers.find((item) => item.id === value);
      updated.advisorTeacherId = value || undefined;
      updated.advisorTeacherName = teacher?.name || undefined;
    } else if (field === "counselorTeacherId") {
      const teacher = teachers.find((item) => item.id === value);
      updated.counselorTeacherId = value || undefined;
      updated.counselorTeacherName = teacher?.name || undefined;
    } else {
      return;
    }

    const nextClassrooms = classrooms.map((cls) => cls.id === editingClassId ? updated : cls);
    try {
      await classroomService.commitAcademicCatalog(
        nextClassrooms,
        courses || [],
        customCreatedCourses || [],
        "updated",
        { previousId: editingClassId, classroom: updated, changedField: field },
      );
      setClassrooms(nextClassrooms);
      setClassForm((prev) => {
        const next = { ...prev };
        if (field === "vicePrincipal") next.vicePrincipal = String(value || "");
        else if (field === "advisorTeacherId") next.advisorTeacherId = value;
        else if (field === "counselorTeacherId") next.counselorTeacherId = value;
        return next;
      });
      triggerNotification("Sınıf görevlisi veritabanına kaydedildi.");
    } catch (error) {
      console.error("Sınıf görevlisi güncellenemedi:", error);
      triggerNotification(`Sınıf görevlisi kaydedilemedi: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openAddClassModal = () => {
    setEditingClassId(null);
    setClassCoursesClassId(null);
    const newLevel = "9. Sınıf";
    setClassForm({
      name: "",
      level: newLevel,
      groups: [],
      group1Name: "",
      group2Name: "",
      advisorTeacherId: "",
      counselorTeacherId: "",
      vicePrincipal: "",
    });

    const levelKey = newLevel as keyof typeof COMPULSORY_COURSES;
    const compulsoryForLevel = COMPULSORY_COURSES[levelKey] || [];
    const customForLevel = customCreatedCourses.filter(c => c.gradeLevel === newLevel && c.courseType === "Zorunlu Ders");

    setClassCourses([
      ...compulsoryForLevel.map((cc) => ({
        courseName: cc.name,
        teacherId: "",
        teacherName: "Belirtilmedi",
        weeklyHours: cc.hours,
      })),
      ...customForLevel.map((cc) => ({
        courseName: cc.courseName,
        teacherId: "",
        teacherName: "Belirtilmedi",
        weeklyHours: cc.weeklyHours,
        type: cc.courseType === "Zorunlu Ders" ? "compulsory" : "elective",
        uiGroupSelectVisible: false,
        uiTempSelectedGroup: "SAY",
        groupName: cc.courseGroup || undefined
      }))
    ]);

    setClassError("");
  };

  const openEditClassModal = (cls: Classroom) => {
    setEditingClassId(cls.id);
    setClassCoursesClassId(cls.id);
    let detectedLevel = cls.level;
    if (detectedLevel === "Diğer" || !detectedLevel) {
      if (/^9(\D|$)/.test(cls.name)) detectedLevel = "9. Sınıf";
      else if (/^10(\D|$)/.test(cls.name)) detectedLevel = "10. Sınıf";
      else if (/^11(\D|$)/.test(cls.name)) detectedLevel = "11. Sınıf";
      else if (/^12(\D|$)/.test(cls.name)) detectedLevel = "12. Sınıf";
    }
    setClassForm({
      name: cls.name,
      level: detectedLevel,
      groups: cls.groups || [],
      group1Name: cls.group1Name || "",
      group2Name: cls.group2Name || "",
      advisorTeacherId: cls.advisorTeacherId || "",
      counselorTeacherId: cls.counselorTeacherId || "",
      vicePrincipal: cls.vicePrincipal || "",
    });

    let finalClassCourses = cls.assignedCourses ? cls.assignedCourses.map((cc) => ({
      courseName: cc.courseName,
      teacherId: cc.teacherId || "",
      teacherName: cc.teacherName || "",
      teacherId2: cc.teacherId2 || "",
      teacherName2: cc.teacherName2 || "",
      teacherAssignmentCleared: Boolean((cc as any).teacherAssignmentCleared),
      isCommonElective: Boolean((cc as any).isCommonElective),
      targetGroups: (cc as any).targetGroups,
      weeklyHours: cc.weeklyHours || 2,
      groupName: cc.groupName || "",
      splitGroupId: cc.splitGroupId || "",
      studentIds: cc.studentIds || [],
      uiGroupSelectVisible: !!cc.groupName,
      uiTempSelectedGroup: cc.groupName || "SAY",
      type: (cc as any).type || "",
    })) : [];

    // Dersler yalnızca cls.assignedCourses kaynağından gelir.
    // customCreatedCourses.selectedClassrooms burada ders üretmez.

    setClassCourses(finalClassCourses);

    setClassError("");
  };

  const openAddCourseModal = () => {
    setCourseForm({
      name: "",
      code: "",
      classroom: classrooms[0]?.name || "",
      teacherId: teachers[0]?.id || "",
      schedule: "Çarşamba 13:00 - 15:20",
      studentCount: "24",
    });
    setCourseError("");
    setIsCourseModalOpen(true);
  };

  useEffect(() => {
    try {
      sqliteStorage.setItem(
        "curriculum_selected_courses_by_grade_v1",
        JSON.stringify(curriculumSelectedCoursesByGrade),
      );
    } catch (e) {
      console.warn("Müfredat ders seçimleri kaydedilemedi", e);
    }
  }, [curriculumSelectedCoursesByGrade]);

  useEffect(() => {
    const hasCurriculumData = Object.keys(curriculumStore).length > 0;

    // SQLite aynası henüz hydrate olmadan modül render edilirse boş ilk state,
    // daha önce kaydedilmiş müfredatın üzerine yazılmamalıdır. Store bu
    // oturumda en az bir kez veri gördükten sonra kullanıcının tüm kayıtları
    // bilinçli olarak silmesi yine kalıcılaştırılır.
    if (!hasCurriculumData && !curriculumStoreHasLoadedDataRef.current) return;
    if (hasCurriculumData) curriculumStoreHasLoadedDataRef.current = true;

    try {
      sqliteStorage.setItem(
        "course_curriculums_v1",
        JSON.stringify(stripQuestionsFromCurriculumStore(curriculumStore)),
      );
    } catch (e) {
      console.warn("Müfredat verisi kaydedilemedi", e);
    }
  }, [curriculumStore]);

  useEffect(() => {
    let cancelled = false;
    const hydrateServerCurriculums = async () => {
      try {
        const response = await fetch("/api/database/collections/courseCurriculums", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json().catch(() => []);
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.rows)
            ? payload.rows
            : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload?.records)
                ? payload.records
                : Array.isArray(payload?.data)
                  ? payload.data
                  : [];
        if (cancelled || rows.length === 0) return;

        const fromServer: Record<string, any> = {};
        rows.forEach((row: any) => {
          const curriculum = row?.curriculum || row?.data || row?.value;
          if (!curriculum || typeof curriculum !== "object") return;
          const rawKey = String(row?.curriculumKey || row?.id || "").trim();
          const courseId = String(row?.courseId || "").trim();
          const key = rawKey
            ? (rawKey.startsWith("curriculum_") ? rawKey : `curriculum_${rawKey}`)
            : courseId
              ? `curriculum_${courseId}`
              : "";
          if (!key) return;
          fromServer[key] = {
            ...curriculum,
            __curriculumMeta: {
              ...(curriculum as any)?.__curriculumMeta,
              recordId: String(row?.id || key),
              curriculumKey: String(row?.curriculumKey || key),
              courseId,
              grade: String(row?.grade || curriculum?.grade || ""),
              courseName: String(row?.courseName || curriculum?.courseName || ""),
            },
          };
        });

        if (Object.keys(fromServer).length === 0) return;
        setCurriculumStore((current) =>
          stripQuestionsFromCurriculumStore({ ...current, ...fromServer }),
        );
      } catch (error) {
        console.warn("Sunucudaki müfredat kayıtları alınamadı; yerel kayıtlar kullanılacak.", error);
      }
    };
    void hydrateServerCurriculums();
    return () => { cancelled = true; };
  }, []);

  const getCurriculumKey = (courseId: string | null | undefined) => courseId ? `curriculum_${courseId}` : "";

  const curriculumAssignedCoursesForActiveGrade = React.useMemo(() => {
    const grade = curriculumGradeNumber(curriculumActiveGrade);
    const byName = new Map<string, { courseName: string; weeklyHours: number }>();
    const gradeClassroomIds = new Set<string>();

    (classrooms || []).forEach((classroom: any) => {
      const classroomGrade =
        curriculumGradeNumber(classroom?.level) ||
        curriculumGradeNumber(classroom?.gradeLevel) ||
        curriculumGradeNumber(classroom?.name);
      if (classroomGrade !== grade) return;

      if (classroom?.id) gradeClassroomIds.add(String(classroom.id));

      (classroom?.assignedCourses || []).forEach((course: any) => {
        const courseName = String(course?.courseName || course?.name || "").trim();
        if (!courseName) return;
        const key = normalizeCurriculumName(courseName);
        if (!key) return;
        const current = byName.get(key);
        byName.set(key, {
          courseName: current?.courseName || courseName,
          weeklyHours: Math.max(
            current?.weeklyHours || 0,
            Number(course?.weeklyHours || 0),
          ),
        });
      });
    });

    /*
     * Müfredat ekranı dersleri yalnızca OKUR; sınıf atamalarını değiştirmez.
     * Bazı eski/taşınmış kayıtlarda classrooms[].assignedCourses henüz dolu
     * olmayabiliyor fakat customCreatedCourses içindeki selectedClassrooms
     * gerçek sınıf seçimini koruyor. Yalnızca assignedCourses tamamen boşsa
     * bu bilgiyi görünürlük için güvenli geri dönüş kaynağı olarak kullan.
     */
    if (byName.size === 0) {
      (customCreatedCourses || []).forEach((course: any) => {
        if (curriculumGradeNumber(course?.gradeLevel) !== grade) return;

        const selectedClassrooms = Array.isArray(course?.selectedClassrooms)
          ? course.selectedClassrooms.map((id: unknown) => String(id))
          : [];

        const isAssignedToGrade =
          selectedClassrooms.length === 0
            ? gradeClassroomIds.size === 0
            : selectedClassrooms.some((id: string) => gradeClassroomIds.has(id));

        if (!isAssignedToGrade) return;

        const courseName = String(course?.courseName || course?.name || "").trim();
        if (!courseName) return;
        const key = normalizeCurriculumName(courseName);
        if (!key) return;

        const current = byName.get(key);
        byName.set(key, {
          courseName: current?.courseName || courseName,
          weeklyHours: Math.max(
            current?.weeklyHours || 0,
            Number(course?.weeklyHours || 0),
          ),
        });
      });
    }

    return [...byName.values()].sort((a, b) =>
      a.courseName.localeCompare(b.courseName, "tr-TR"),
    );
  }, [classrooms, customCreatedCourses, curriculumActiveGrade]);

  const curriculumCoursesForActiveGrade = React.useMemo(() => {
    const grade = curriculumGradeNumber(curriculumActiveGrade);
    const courses = curriculumAssignedCoursesForActiveGrade.map((assignedCourse) => {
      const catalogCourse = CURRICULUM_COURSE_CATALOG.find(
        (item) =>
          normalizeCurriculumName(item.name) ===
          normalizeCurriculumName(assignedCourse.courseName),
      );
      const existing = customCreatedCourses.find(
        (cc) =>
          curriculumGradeNumber(cc.gradeLevel) === grade &&
          normalizeCurriculumName(cc.courseName) ===
            normalizeCurriculumName(assignedCourse.courseName),
      );

      if (existing) {
        return {
          ...existing,
          curriculumCourseId: catalogCourse?.id,
          weeklyHours: Number(existing.weeklyHours || assignedCourse.weeklyHours || 0),
        };
      }

      const virtualSuffix = catalogCourse?.id || normalizeCurriculumName(assignedCourse.courseName);
      return {
        id: `CURR-${grade}-${virtualSuffix}`,
        curriculumCourseId: catalogCourse?.id,
        courseName: assignedCourse.courseName,
        gradeLevel: `${grade}. Sınıf`,
        courseType: "Müfredat Dersi",
        weeklyHours: assignedCourse.weeklyHours,
      };
    });

    /*
     * Daha önce müfredatı oluşturulmuş bir dersin güncel sınıf ataması
     * değişmiş olsa bile müfredat kartı kaybolmamalıdır. Kalıcı store'daki
     * canonical sanal ders anahtarlarını da katalog listesine geri ekle.
     */
    CURRICULUM_COURSE_CATALOG.forEach((catalogCourse) => {
      const virtualId = curriculumVirtualCourseId(grade, catalogCourse.id);
      const curriculum = curriculumStore[getCurriculumKey(virtualId)];
      const hasStoredCurriculum =
        Array.isArray(curriculum?.units) && curriculum.units.length > 0;
      const alreadyIncluded = courses.some(
        (course: any) => Number(course.curriculumCourseId) === catalogCourse.id,
      );
      if (!hasStoredCurriculum || alreadyIncluded) return;

      courses.push({
        id: virtualId,
        curriculumCourseId: catalogCourse.id,
        courseName: catalogCourse.name,
        gradeLevel: `${grade}. Sınıf`,
        courseType: "Müfredat Dersi",
        weeklyHours: 0,
      } as any);
    });

    return courses.sort((a: any, b: any) =>
      String(a.courseName || "").localeCompare(String(b.courseName || ""), "tr-TR"),
    );
  }, [customCreatedCourses, curriculumActiveGrade, curriculumAssignedCoursesForActiveGrade, curriculumStore]);

  const curriculumSelectedCourseNames = React.useMemo(
    () => curriculumSelectedCoursesByGrade[curriculumActiveGrade] || [],
    [curriculumSelectedCoursesByGrade, curriculumActiveGrade],
  );

  const curriculumMoveCatalog = React.useMemo(() => {
    const buildCoursesForGrade = (grade: number) => {
      const byName = new Map<string, { courseName: string; weeklyHours: number }>();

      (classrooms || []).forEach((classroom: any) => {
        const classroomGrade =
          curriculumGradeNumber(classroom?.level) ||
          curriculumGradeNumber(classroom?.gradeLevel) ||
          curriculumGradeNumber(classroom?.name);
        if (classroomGrade !== grade) return;

        (classroom?.assignedCourses || []).forEach((course: any) => {
          const courseName = String(course?.courseName || course?.name || "").trim();
          if (!courseName) return;
          const key = normalizeCurriculumName(courseName);
          const current = byName.get(key);
          byName.set(key, {
            courseName: current?.courseName || courseName,
            weeklyHours: Math.max(current?.weeklyHours || 0, Number(course?.weeklyHours || 0)),
          });
        });
      });

      return [...byName.values()]
        .map((assignedCourse) => {
          const catalogCourse = CURRICULUM_COURSE_CATALOG.find(
            (item) =>
              normalizeCurriculumName(item.name) ===
              normalizeCurriculumName(assignedCourse.courseName),
          );
          const existing = customCreatedCourses.find(
            (cc) =>
              curriculumGradeNumber(cc.gradeLevel) === grade &&
              normalizeCurriculumName(cc.courseName) ===
                normalizeCurriculumName(assignedCourse.courseName),
          );

          const course = existing
            ? {
                ...existing,
                curriculumCourseId: catalogCourse?.id,
                weeklyHours: Number(existing.weeklyHours || assignedCourse.weeklyHours || 0),
              }
            : {
                id: `CURR-${grade}-${catalogCourse?.id || normalizeCurriculumName(assignedCourse.courseName)}`,
                curriculumCourseId: catalogCourse?.id,
                courseName: assignedCourse.courseName,
                gradeLevel: `${grade}. Sınıf`,
                courseType: "Müfredat Dersi",
                weeklyHours: assignedCourse.weeklyHours,
              };

          return {
            ...course,
            curriculum: curriculumStore[getCurriculumKey(course.id)] || { units: [] },
          };
        })
        .sort((a: any, b: any) =>
          String(a.courseName || "").localeCompare(String(b.courseName || ""), "tr-TR"),
        );
    };

    return [9, 10, 11, 12].map((grade) => ({
      grade,
      label: `${grade}. Sınıf`,
      courses: buildCoursesForGrade(grade),
    }));
  }, [classrooms, customCreatedCourses, curriculumStore]);


  const toggleCurriculumCourseSelection = (courseName: string) => {
    setCurriculumSelectedCoursesByGrade((prev) => {
      const current = prev[curriculumActiveGrade] || [];
      const key = normalizeCurriculumName(courseName);
      const exists = current.some(
        (name) => normalizeCurriculumName(name) === key,
      );
      return {
        ...prev,
        [curriculumActiveGrade]: exists
          ? current.filter((name) => normalizeCurriculumName(name) !== key)
          : [...current, courseName],
      };
    });
  };

  const getSelectedCurriculumCourse = () =>
    customCreatedCourses.find((cc) => cc.id === curriculumModalState.courseId) ||
    curriculumCoursesForActiveGrade.find((cc: any) => cc.id === curriculumModalState.courseId) ||
    null;

  const resolveCurriculumStorageKey = (courseId: string | null | undefined) => {
    const rawId = String(courseId || "").trim();
    if (!rawId) return "";

    const directKey = getCurriculumKey(rawId);
    if (directKey && curriculumStore[directKey]) return directKey;

    const course =
      curriculumCoursesForActiveGrade.find((item: any) => String(item?.id || "") === rawId) ||
      customCreatedCourses.find((item: any) => String(item?.id || "") === rawId);
    const grade =
      curriculumGradeNumber(course?.gradeLevel) ||
      curriculumGradeNumber(curriculumActiveGrade);
    const courseName = String(course?.courseName || course?.name || "").trim();
    const catalogCourse =
      CURRICULUM_COURSE_CATALOG.find(
        (item) => Number(item.id) === Number(course?.curriculumCourseId),
      ) ||
      CURRICULUM_COURSE_CATALOG.find(
        (item) => normalizeCurriculumName(item.name) === normalizeCurriculumName(courseName),
      );

    const candidateIds = [
      rawId,
      catalogCourse?.id ? curriculumVirtualCourseId(grade, catalogCourse.id) : "",
      course?.curriculumCourseId ? curriculumVirtualCourseId(grade, Number(course.curriculumCourseId)) : "",
    ].filter(Boolean);

    for (const candidateId of candidateIds) {
      const key = getCurriculumKey(String(candidateId));
      if (key && curriculumStore[key]) return key;
    }

    // Eski kayıtlarda ders id'si değişmiş olabilir. Meta bilgi / ders adı üzerinden
    // aynı sınıf ve dersi bulup mevcut müfredatı görünür hale getir.
    const normalizedCourseName = normalizeCurriculumName(courseName);
    for (const [key, value] of Object.entries(curriculumStore)) {
      const meta = (value as any)?.__curriculumMeta || {};
      const valueGrade = curriculumGradeNumber(
        (value as any)?.grade || (value as any)?.gradeLevel || meta?.grade,
      );
      const valueName = String(
        (value as any)?.courseName || meta?.courseName || "",
      ).trim();
      if (grade && valueGrade && grade !== valueGrade) continue;
      if (normalizedCourseName && normalizeCurriculumName(valueName) === normalizedCourseName) {
        return key;
      }

      if (catalogCourse?.id) {
        const keyText = String(key);
        if (keyText === getCurriculumKey(curriculumVirtualCourseId(grade, catalogCourse.id))) {
          return key;
        }
      }
    }

    return directKey;
  };

  const getCourseCurriculum = (courseId: string | null | undefined) => {
    const key = resolveCurriculumStorageKey(courseId);
    return key && curriculumStore[key] ? curriculumStore[key] : { units: [] };
  };

  const hasCourseCurriculum = (courseId: string | null | undefined) => {
    const curriculum = getCourseCurriculum(courseId);
    return Array.isArray(curriculum.units) && curriculum.units.some((unit: any) =>
      unit && (unit.name || (unit.topics || []).length > 0)
    );
  };

  const setCourseCurriculum = (courseId: string, nextCurriculum: any) => {
    const key = resolveCurriculumStorageKey(courseId) || getCurriculumKey(courseId);
    const sanitizedCurriculum = stripQuestionsFromCurriculum(nextCurriculum);
    setCurriculumStore((prev) => {
      const nextStore = { ...prev, [key]: sanitizedCurriculum };
      try {
        sqliteStorage.setItem("course_curriculums_v1", JSON.stringify(nextStore));
      } catch (error) {
        console.error("Müfredat veritabanına yazılamadı:", error);
        triggerNotification("Müfredat veritabanına yazılamadı. İşlem tamamlanmadı.");
      }
      return nextStore;
    });
  };

  const uploadCurriculumQuestionImages = async (
    courseId: string,
    unitId: string,
    topicId: string,
    outcomeId: string,
    files: File[],
    answer: string,
    importSessionId?: string,
    targetType: "topic" | "outcome" = "outcome",
    questionType: "exam" | "study" = "study",
  ) => {
    const ensureReadableImage = (source: string) =>
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const width = Number(image.naturalWidth || 0);
          const height = Number(image.naturalHeight || 0);
          if (width < 200 || height < 80) {
            reject(new Error(`Görsel çözünürlüğü yetersiz (${width}x${height}).`));
            return;
          }
          resolve({ width, height });
        };
        image.onerror = () => reject(new Error("Görsel dosyası açılamadı."));
        image.src = source;
      });

    const validateQuestionFile = (file: File) => {
      if (!file || Number(file.size || 0) <= 0) {
        throw new Error("Dosya boş.");
      }
      if (Number(file.size || 0) > 25 * 1024 * 1024) {
        throw new Error("Dosya 25 MB sınırını aşıyor.");
      }

      const name = String(file.name || "").toLocaleLowerCase("tr-TR");
      const mime = String(file.type || "").toLocaleLowerCase("tr-TR");
      const supported =
        /\.(png|jpe?g)$/i.test(name) ||
        mime === "image/png" ||
        mime === "image/jpeg";

      if (!supported) {
        throw new Error("Yalnızca PNG, JPG veya JPEG soru kartı yüklenebilir.");
      }
    };

    const allFiles = Array.isArray(files) ? files : [];
    const unsupportedFiles = allFiles.filter(
      (file) => !(/\.(png|jpe?g)$/i.test(file.name) || /image\/(png|jpeg)/i.test(file.type)),
    );
    const imageFiles = allFiles.filter((file) =>
      /\.(png|jpe?g)$/i.test(file.name) || /image\/(png|jpeg)/i.test(file.type),
    );
    if (imageFiles.length === 0) {
      triggerNotification(
        unsupportedFiles.length > 0
          ? `${unsupportedFiles.length} dosya desteklenmedi. Yalnızca PNG, JPG veya JPEG soru kartı yüklenebilir.`
          : "Yüklenecek soru görseli bulunamadı.",
      );
      return;
    }

    const questionGroupInfoFromFileName = (fileName: string) => {
      const parsed = parseUploadFileName(fileName);
      if (!parsed || parsed.kind === "normal") return null;
      return { token: parsed.token, order: parsed.order, isInstruction: parsed.isInstruction };
    };

    const invalidNameFiles = imageFiles.filter((file) => !parseUploadFileName(file.name));
    if (invalidNameFiles.length > 0) {
      const preview = invalidNameFiles.slice(0, 4).map((file) => file.name).join(", ");
      const more = invalidNameFiles.length > 4 ? ` (+${invalidNameFiles.length - 4})` : "";
      const message = `Dosya adı standarda uymuyor: ${preview}${more}. Normal soru: 001_A.jpg · Grup: 001__G01Y.jpg + 002_B_G01.jpg`;
      triggerNotification(message);
      return { uploaded: 0, rejected: invalidNameFiles.length, error: message };
    }

    const explicitGroupInstructionFiles = imageFiles.filter(
      (file) => parseUploadFileName(file.name)?.kind === "instruction",
    );
    const explicitInstructionTokens = new Set(
      explicitGroupInstructionFiles
        .map((file) => parseUploadFileName(file.name)?.token || "")
        .filter(Boolean),
    );
    const groupQuestionTokens = new Set(
      imageFiles
        .map((file) => parseUploadFileName(file.name))
        .filter((info): info is UploadNameInfo => Boolean(info))
        .filter((info) => info.kind === "group-question")
        .map((info) => info.token),
    );
    const missingInstructionTokens = [...groupQuestionTokens].filter(
      (token) => !explicitInstructionTokens.has(token),
    );
    if (missingInstructionTokens.length > 0) {
      const message = `${missingInstructionTokens.join(", ")} grubu için yönerge dosyası eksik. Her grup aynı yüklemede 001__G01Y.jpg biçiminde bir yönerge içermelidir.`;
      triggerNotification(message);
      return { uploaded: 0, rejected: imageFiles.length, error: message };
    }

    const groupInstructionFiles = explicitGroupInstructionFiles;
    const validImageFiles = imageFiles.filter((file) =>
      parseUploadFileName(file.name)?.kind !== "instruction",
    );

    if (validImageFiles.length === 0) {
      triggerNotification("Yüklenecek gerçek soru görseli bulunamadı. Grup yönergesi soru olarak kaydedilmez.");
      return;
    }

    try {
      const curriculum = getCourseCurriculum(courseId);
      const unit = (curriculum?.units || []).find((item: any) => String(item.id) === String(unitId));
      const topic = unit?.topics?.find((item: any) => String(item.id) === String(topicId));
      if (!topic) {
        triggerNotification("Konu bulunamadı.");
        return { uploaded: 0, rejected: files.length, error: "Konu bulunamadı." };
      }
      const outcome = targetType === "outcome"
        ? topic?.outcomes?.find((item: any) => String(item.id) === String(outcomeId))
        : null;
      if (targetType === "outcome" && !outcome) {
        triggerNotification("Soru yükleme hedefi bulunamadı.");
        return { uploaded: 0, rejected: files.length, error: "Soru yükleme hedefi bulunamadı." };
      }

      const grade = Number(String(curriculumActiveGrade || "").match(/\d+/)?.[0] || 0);
      const canonicalCourseId = canonicalCourseIdFromHierarchy(
        courseId,
        targetType === "outcome" ? outcomeId : "",
        topicId,
        unitId,
      );
      const lastNumericSegment = (value: unknown) => {
        const matches = String(value || "").match(/\d+/g) || [];
        return matches.length ? String(matches[matches.length - 1]) : "";
      };
      const curriculumCodeParts = [
        lastNumericSegment(unitId),
        lastNumericSegment(topicId),
        ...(targetType === "outcome" ? [lastNumericSegment(outcomeId)] : []),
      ].filter(Boolean);
      const fallbackHierarchySource = String(
        targetType === "outcome" ? outcomeId : topicId,
      );
      const fallbackNumbers = fallbackHierarchySource.match(/\d+/g) || [];
      const expectedPartCount = targetType === "outcome" ? 3 : 2;
      const hierarchyTail = curriculumCodeParts.length === expectedPartCount
        ? curriculumCodeParts.join(".")
        : fallbackNumbers.slice(-expectedPartCount).join(".");
      const curriculumCode = `${grade}.${canonicalCourseId}.${hierarchyTail}`;
      if (!curriculumCode) {
        throw new Error("Ünite/konu/kazanım numarası oluşturulamadı.");
      }

      let uploadedCount = 0;
      let duplicateCount = 0;
      let relinkedCount = 0;
      const unreadableFiles: string[] = [];
      const unreadableReasons: string[] = [];

      const groupInstructionByToken = new Map<string, { imageUrl: string; questionId: string }>();
      for (const instructionFile of groupInstructionFiles) {
        const info = questionGroupInfoFromFileName(instructionFile.name);
        if (!info?.token) continue;
        try {
          validateQuestionFile(instructionFile);
          const instructionName = parseUploadFileName(instructionFile.name);
          const instructionCode = groupInstructionCode(curriculumCode, info.token, instructionName?.order || 1, instructionName?.answer || "");
          const storedInstruction: any = await uploadQuestionBankImage(instructionFile, {
            grade,
            courseId: canonicalCourseId,
            unitId,
            topicId,
            outcomeId: targetType === "outcome" ? outcomeId : "",
            questionCode: instructionCode,
            answer: "",
            importSessionId,
            questionType,
            role: "instruction",
          });
          const imageUrl = String(
            storedInstruction?.imageUrl ||
            storedInstruction?.image_url ||
            (storedInstruction?.storagePath ? `/api/question-bank/files/${String(storedInstruction.storagePath).split("/").map(encodeURIComponent).join("/")}` : ""),
          ).trim();
          const questionId = String(storedInstruction?.id || storedInstruction?.questionId || "").trim();
          if (!imageUrl || !questionId) {
            throw new Error("Yönerge kaydı sunucudan doğrulanamadı.");
          }
          groupInstructionByToken.set(info.token, { imageUrl, questionId });
        } catch (error) {
          unreadableFiles.push(instructionFile.name);
          unreadableReasons.push(
            `${instructionFile.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        }
      }

      const fileNameGroupMembers = new Map<
        string,
        Array<{ questionId: string; order: number }>
      >();
      const rememberFileNameGroupMember = (file: File, record: any) => {
        const info = questionGroupInfoFromFileName(file.name);
        const questionId = String(record?.id || record?.questionId || record?.question_id || "").trim();
        if (!info || info.isInstruction || !questionId) return;
        const members = fileNameGroupMembers.get(info.token) || [];
        const withoutSame = members.filter((member) => member.questionId !== questionId);
        withoutSame.push({ questionId, order: info.order });
        fileNameGroupMembers.set(info.token, withoutSame);
      };

      const persistFileNameQuestionGroups = async () => {
        let savedGroupCount = 0;
        for (const [token, members] of fileNameGroupMembers.entries()) {
          const orderedMembers = [...members].sort(
            (left, right) => left.order - right.order || left.questionId.localeCompare(right.questionId),
          );
          const currentIds = [...new Set(orderedMembers.map((member) => member.questionId).filter(Boolean))];
          if (currentIds.length < 2) continue;

          const groupId = [
            "filename-group",
            String(grade),
            String(canonicalCourseId),
            String(unitId),
            String(topicId),
            String(targetType === "outcome" ? outcomeId : ""),
            token,
          ].join(":");

          let previousGroup: any = null;
          try {
            const previousResponse = await fetch(
              `/api/question-bank/groups/${encodeURIComponent(groupId)}`,
              { cache: "no-store" },
            );
            if (previousResponse.ok) {
              const previousBody = await previousResponse.json().catch(() => ({}));
              previousGroup = previousBody?.group || null;
            }
          } catch {}

          const previousIds = Array.isArray(previousGroup?.questionIds)
            ? previousGroup.questionIds.map((value: any) => String(value || "").trim()).filter(Boolean)
            : [];
          const questionIds = [
            ...currentIds,
            ...previousIds.filter((id: string) => !currentIds.includes(id)),
          ];
          if (questionIds.length < 2) continue;

          const instructionMeta = groupInstructionByToken.get(token);
          const instructionImageUrl =
            instructionMeta?.imageUrl ||
            String(previousGroup?.instructionImageUrl || "");
          const instructionQuestionId =
            instructionMeta?.questionId ||
            String(previousGroup?.instructionQuestionId || "");
          const response = await fetch("/api/question-bank/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              groupId,
              mode: previousGroup?.mode || "required",
              layout: instructionImageUrl
                ? "full-width-source"
                : previousGroup?.layout || "normal",
              title: previousGroup?.title || "",
              instructionText: previousGroup?.instructionText || "",
              instructionImageUrl,
              instructionQuestionId,
              questionIds,
            }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body?.error || `${token} soru grubu kaydedilemedi.`);
          }
          savedGroupCount += 1;
        }
        return savedGroupCount;
      };

      for (const file of validImageFiles) {
        const parsedUploadName = parseUploadFileName(file.name);
        if (!parsedUploadName || parsedUploadName.isInstruction) continue;
        const validAnswer = parsedUploadName.answer;
        try {
          validateQuestionFile(file);
        } catch (error) {
          unreadableFiles.push(file.name);
          unreadableReasons.push(
            `${file.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }

        const questionCode = parsedUploadName.kind === "group-question"
          ? `${curriculumCode}_${String(parsedUploadName.order).padStart(3, "0")}_${validAnswer}_${parsedUploadName.token}`
          : `${curriculumCode}_${String(parsedUploadName.order).padStart(3, "0")}_${validAnswer}`;
        let storedImage: any = null;
        try {
          storedImage = await uploadQuestionBankImage(file, {
            grade,
            courseId: canonicalCourseId,
            unitId,
            topicId,
            outcomeId: targetType === "outcome" ? outcomeId : "",
            questionCode,
            answer: validAnswer,
            importSessionId,
            questionType,
          });

          if (storedImage?.relinked) {
            rememberFileNameGroupMember(file, storedImage);
            relinkedCount += 1;
            continue;
          }
          if (storedImage?.duplicate || storedImage?.skipped) {
            rememberFileNameGroupMember(file, storedImage);
            duplicateCount += 1;
            continue;
          }

          let uploadedImageUrl = String(
            storedImage?.imageUrl ||
              storedImage?.image_url ||
              storedImage?.thumbnailUrl ||
              storedImage?.thumbnail_url ||
              "",
          ).trim();
          const uploadedStoragePath = String(
            storedImage?.storagePath || storedImage?.storage_path || "",
          ).trim();
          const uploadedId = String(storedImage?.id || "").trim();

          // Bazı sunucu sürümleri POST cevabında yalnız id/storagePath döndürür.
          // Böyle bir durumda aynı soru kodunu bankadan tekrar okuyup gerçek
          // tarayıcı URL'sini buluruz. Görüntülenebilir URL bulunmadan soru
          // müfredat ağacına kesinlikle eklenmez.
          if (!uploadedImageUrl) {
            try {
              const payload: any = await listQuestionBankRecords({
                grade,
                courseId,
                unitId,
                topicId,
                outcomeId: targetType === "outcome" ? outcomeId : "",
                q: questionCode,
                status: "active",
                limit: 50,
              });
              const records = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.questions)
                  ? payload.questions
                  : Array.isArray(payload?.items)
                    ? payload.items
                    : Array.isArray(payload?.records)
                      ? payload.records
                      : Array.isArray(payload?.data)
                        ? payload.data
                        : [];
              const exact = records.find((record: any) =>
                String(
                  record?.questionCode ||
                    record?.question_code ||
                    record?.code ||
                    record?.fileName ||
                    record?.file_name ||
                    "",
                )
                  .replace(/\.[^.]+$/, "")
                  .trim() === questionCode,
              );
              if (exact) {
                storedImage = { ...storedImage, ...exact };
                uploadedImageUrl = String(
                  exact?.imageUrl ||
                    exact?.image_url ||
                    exact?.thumbnailUrl ||
                    exact?.thumbnail_url ||
                    "",
                ).trim();
              }
            } catch (refreshError) {
              console.warn(
                `Yüklenen soru bankadan yeniden okunamadı (${questionCode}):`,
                refreshError,
              );
            }
          }

          // storagePath ancak doğrudan HTTP/API yolu ise görsel kaynağı olarak
          // kullanılabilir. Windows/Linux disk yolunu <img src> olarak kullanmayız.
          if (!uploadedImageUrl && uploadedStoragePath) {
            if (
              uploadedStoragePath.startsWith("/") ||
              uploadedStoragePath.startsWith("http://") ||
              uploadedStoragePath.startsWith("https://") ||
              uploadedStoragePath.startsWith("data:")
            ) {
              uploadedImageUrl = uploadedStoragePath;
            }
          }

          if (!uploadedId && !uploadedStoragePath && !uploadedImageUrl) {
            throw new Error("Sunucu soru kaydını doğrulayan bir kimlik/path döndürmedi.");
          }
          if (!uploadedImageUrl) {
            throw new Error(
              "Soru dosyası kaydedildi ancak görüntülenebilir görsel adresi oluşmadı. Kayıt geri alındı.",
            );
          }

          // Son güvenlik kapısı yalnızca SUNUCUYA KAYDEDİLMİŞ gerçek URL üzerinde çalışır.
          await ensureReadableImage(uploadedImageUrl);

          // Müfredat kaydında doğrulanmış URL'nin kullanılmasını garanti et.
          storedImage = {
            ...storedImage,
            imageUrl: uploadedImageUrl,
          };
          rememberFileNameGroupMember(file, storedImage);
        } catch (error) {
          if (storedImage?.storagePath) {
            try { await deleteQuestionBankImage(String(storedImage.storagePath)); }
            catch (rollbackError) { console.error("Başarısız soru yüklemesi geri alınamadı:", rollbackError); }
          }
          console.error(`Soru yüklenemedi (${file.name}):`, error);
          unreadableFiles.push(file.name);
          unreadableReasons.push(
            `${file.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }

        // Soru metadata'sı artık yalnız canonical question_bank_questions
        // tablosunda tutulur. Müfredat JSON'una questions[] yazılmaz.
        uploadedCount += 1;
      }

      const fileNameGroupCount = await persistFileNameQuestionGroups();
      const fileNameGroupMessage = fileNameGroupCount > 0
        ? ` ${fileNameGroupCount} bağlantılı soru grubu dosya adından otomatik ilişkilendirildi.`
        : "";

      if (uploadedCount === 0 && relinkedCount > 0 && unreadableFiles.length === 0 && unsupportedFiles.length === 0) {
        const message = `${relinkedCount} mevcut soru seçtiğiniz müfredat hedefine bağlandı. Yeni kopya oluşturulmadı.` +
          (duplicateCount > 0 ? ` ${duplicateCount} soru bu hedefte zaten kayıtlıydı.` : "") +
          fileNameGroupMessage;
        triggerNotification(message);
        return {
          uploaded: 0,
          relinked: relinkedCount,
          skipped: duplicateCount,
          duplicate: duplicateCount,
          rejected: 0,
          message,
        };
      }

      if (uploadedCount === 0 && duplicateCount > 0 && unreadableFiles.length === 0 && unsupportedFiles.length === 0) {
        const message = `0 yeni soru yüklendi. ${duplicateCount} soru bu hedefte zaten kayıtlı olduğu için yeniden yüklenmedi.${fileNameGroupMessage}`;
        triggerNotification(message);
        return { uploaded: 0, relinked: 0, skipped: duplicateCount, duplicate: duplicateCount, rejected: 0, message };
      }

      if (uploadedCount === 0) {
        const rejectedCount =
          unsupportedFiles.length + invalidNameFiles.length + unreadableFiles.length;
        const message =
          `Hiçbir yeni soru yüklenmedi. ${rejectedCount} dosya doğrulamadan geçemedi.` +
          (relinkedCount > 0 ? ` ${relinkedCount} mevcut soru yeni hedefe bağlandı.` : "") +
          (duplicateCount > 0 ? ` ${duplicateCount} soru zaten kayıtlı.` : "") +
          (unreadableReasons.length > 0 ? ` İlk hata: ${unreadableReasons[0]}` : "") +
          fileNameGroupMessage;
        triggerNotification(message);
        return { uploaded: 0, skipped: duplicateCount, rejected: rejectedCount, error: message };
      }

      const successMessage =
        `${uploadedCount} ${questionType === "exam" ? "sınav" : "çalışma"} sorusu ${targetType === "outcome" ? `${outcomeId} kazanımına` : `${topicId} konusuna`} eklendi.` +
          (unsupportedFiles.length > 0
            ? ` ${unsupportedFiles.length} desteklenmeyen dosya yüklenmedi.`
            : "") +
          (invalidNameFiles.length > 0
            ? ` ${invalidNameFiles.length} dosya, adı standarda uymadığı için yüklenmedi.`
            : "") +
          (unreadableFiles.length > 0
            ? ` ${unreadableFiles.length} bozuk/eksik/düşük çözünürlüklü görsel yüklenmedi.`
            : "") +
          (relinkedCount > 0
            ? ` ${relinkedCount} mevcut soru seçilen müfredat hedefine bağlandı.`
            : "") +
          (duplicateCount > 0
            ? ` ${duplicateCount} soru bu hedefte zaten kayıtlı olduğu için atlandı.`
            : "") +
          fileNameGroupMessage;
      triggerNotification(successMessage);
      return {
        uploaded: uploadedCount,
        relinked: relinkedCount,
        skipped: duplicateCount,
        duplicate: duplicateCount,
        rejected: unsupportedFiles.length + invalidNameFiles.length + unreadableFiles.length,
        message: successMessage,
      };
} catch (error) {
      console.error("Soru kartı yükleme hatası:", error);
      const message = `Soru kartı yüklenemedi: ${error instanceof Error ? error.message : String(error)}`;
      triggerNotification(message);
      return { uploaded: 0, rejected: (files || []).length, error: message };
    }
  };


  const removeCurriculumQuestionsByImportSession = (_importSessionId: string) => {
    // v18+: Sorular müfredat JSON'unda tutulmaz. Bu çağrı yalnız eski
    // kurulumlardan kalabilecek questions[] alanlarını tekrar temizler.
    const sanitizedStore = stripQuestionsFromCurriculumStore(curriculumStore);
    setCurriculumStore(sanitizedStore);
    try {
      sqliteStorage.setItem("course_curriculums_v1", JSON.stringify(sanitizedStore));
    } catch {}
    return 0;
  };


  const moveCurriculumQuestion = async (
    source: {
      courseId: string;
      unitId: string;
      topicId: string;
      outcomeId: string;
      questionId: string;
    },
    target: {
      grade: number;
      courseId: string;
      unitId: string;
      topicId: string;
      outcomeId: string;
      answer: string;
    },
  ) => {
    try {
      const sourcePayload: any = await listQuestionBankRecords({
        status: "active",
        courseId: source.courseId,
        unitId: source.unitId,
        topicId: source.topicId,
        ...(source.outcomeId ? { outcomeId: source.outcomeId } : {}),
        limit: 500,
      });
      const sourceRows = Array.isArray(sourcePayload?.questions)
        ? sourcePayload.questions
        : Array.isArray(sourcePayload)
          ? sourcePayload
          : [];
      const question = sourceRows.find(
        (item: any) =>
          String(item?.id || item?.questionId || "") === String(source.questionId) ||
          String(item?.questionCode || item?.code || item?.fileName || "") === String(source.questionId),
      );

      if (!question) {
        triggerNotification("Taşınacak soru canonical soru tablosunda bulunamadı.");
        return null;
      }

      const validAnswer = /^[A-E]$/.test(String(target.answer || "").toUpperCase())
        ? String(target.answer).toUpperCase()
        : String(question.answer || "A").toUpperCase();

      const targetCurriculum = getCourseCurriculum(target.courseId);
      const targetUnit = (targetCurriculum?.units || []).find(
        (unit: any) => String(unit.id) === String(target.unitId),
      );
      const targetTopic = targetUnit?.topics?.find(
        (topic: any) => String(topic.id) === String(target.topicId),
      );
      const targetOutcome = target.outcomeId
        ? targetTopic?.outcomes?.find(
            (outcome: any) => String(outcome.id) === String(target.outcomeId),
          )
        : null;

      if (!targetTopic || (target.outcomeId && !targetOutcome)) {
        triggerNotification("Hedef konu/kazanım bulunamadı.");
        return null;
      }

      const sameTarget =
        String(source.courseId) === String(target.courseId) &&
        String(source.unitId) === String(target.unitId) &&
        String(source.topicId) === String(target.topicId) &&
        String(source.outcomeId || "") === String(target.outcomeId || "");

      let order = Number(question.order || 0);
      if (!sameTarget || order <= 0) {
        const sequencePayload: any = await getQuestionBankNextSequence({
          grade: target.grade,
          courseId: target.courseId,
          unitId: target.unitId,
          topicId: target.topicId,
          outcomeId: target.outcomeId || "",
        });
        order = Math.max(1, Number(sequencePayload?.nextSequence || 1));
      }

      const paddedOrder = String(order).padStart(3, "0");
      const questionBaseId = target.outcomeId || target.topicId;
      const questionCode = `${questionBaseId}_${paddedOrder}_${validAnswer}`;

      if (!question.storagePath) {
        triggerNotification("Sorunun fiziksel dosya yolu bulunamadı.");
        return null;
      }

      const movedQuestion: any = await moveQuestionBankImage({
        storagePath: question.storagePath,
        grade: target.grade,
        courseId: target.courseId,
        unitId: target.unitId,
        topicId: target.topicId,
        outcomeId: target.outcomeId || "",
        questionCode,
        answer: validAnswer,
        questionType: String(question.questionType || "study"),
      });

      triggerNotification(
        sameTarget
          ? `Soru ${movedQuestion?.fileName || questionCode} olarak güncellendi.`
          : `Soru ${target.outcomeId || target.topicId} hedefine taşındı.`,
      );

      return {
        grade: target.grade,
        courseId: target.courseId,
        unitId: target.unitId,
        topicId: target.topicId,
        outcomeId: target.outcomeId || "",
        questionId: String(movedQuestion?.id || question.id || source.questionId),
      };
    } catch (error) {
      console.error("Canonical soru taşıma hatası:", error);
      triggerNotification(
        `Soru taşınamadı: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  };


  const deleteCurriculumQuestion = async (
    _courseId: string,
    _unitId: string,
    _topicId: string,
    _outcomeId: string,
    questionId: string,
  ) => {
    try {
      const result: any = await deleteQuestionBankRecord(String(questionId));
      if (!result?.success) {
        triggerNotification("Soru silinemedi.");
        return false;
      }
      const protection = result?.protection || {};
      const protectedCount =
        Number(protection?.useCount || 0) +
        Number(protection?.teacherAssignmentCount || 0) +
        Number(protection?.teacherSelectionCount || 0);

      triggerNotification(
        protectedCount > 0
          ? `Soru arşivlendi. ${protectedCount} geçmiş test/görev bağlantısı korunuyor; soru yeni seçim havuzlarında görünmeyecek.`
          : "Soru arşivlendi. Fiziksel görsel korundu; soru yeni test ve öğretmen görevlerinde görünmeyecek.",
      );
      return true;
    } catch (error) {
      console.error("Canonical soru silme hatası:", error);
      triggerNotification(
        `Soru silinemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  };


  const deleteCurriculumQuestionsBulk = async (
    _courseId: string,
    _unitId: string,
    _topicId: string,
    _outcomeId: string,
    questionIds: string[],
  ) => {
    const ids = [...new Set(
      (Array.isArray(questionIds) ? questionIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    )];
    if (ids.length === 0) return { deleted: 0, failed: 0 };

    try {
      const result: any = await deleteQuestionBankRecordsBulk(ids);
      const deleted = Number(result?.deleted || 0);
      const failed = Number(result?.failed || 0);
      triggerNotification(
        failed > 0
          ? `${deleted} soru arşivlendi, ${failed} soru arşivlenemedi.`
          : `${deleted} soru arşivlendi. Geçmiş testler ve öğretmen görevleri için fiziksel görseller korundu.`,
      );
      return { deleted, failed };
    } catch (error) {
      console.error("Canonical toplu soru silme hatası:", error);
      triggerNotification(
        `Sorular silinemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { deleted: 0, failed: ids.length };
    }
  };


  const openCurriculumEditor = (type: "unit" | "topic" | "outcome", unitId?: string, topicId?: string, item?: any) => {
    setCurriculumEditor({ type, unitId, topicId, item });
    setCurriculumForm({ id: item?.id || "", name: item?.name || item?.text || "" });
  };

  const saveCurriculumEditor = async () => {
    const course = getSelectedCurriculumCourse();
    if (!course || !curriculumEditor || !curriculumForm.name.trim()) return;

    const previousCurriculum = JSON.parse(JSON.stringify(getCourseCurriculum(course.id)));
    const curriculum = JSON.parse(JSON.stringify(previousCurriculum));
    curriculum.units = Array.isArray(curriculum.units) ? curriculum.units : [];
    const grade =
      curriculumGradeNumber(course.gradeLevel) ||
      curriculumGradeNumber(curriculumActiveGrade);
    const courseCode = String(
      (course as any).curriculumCourseId ||
        (course as any).courseCode ||
        (course as any).code ||
        course.id ||
        "",
    )
      .replace(/^CURR-\d+-/i, "")
      .trim();
    if (!grade || !courseCode) {
      triggerNotification("Sınıf veya ders kodu bulunamadığı için müfredat ID'si oluşturulamadı.");
      return;
    }

    const nextChildNumber = (parentId: string, items: any[]) => {
      const prefix = `${parentId}.`;
      const highest = (items || []).reduce((max: number, item: any) => {
        const id = String(item?.id || "");
        if (!id.startsWith(prefix)) return max;
        const childPart = id.slice(prefix.length);
        if (!/^\d+$/.test(childPart)) return max;
        return Math.max(max, Number(childPart));
      }, 0);
      return highest + 1;
    };

    if (curriculumEditor.type === "unit") {
      const rootId = `${grade}.${courseCode}`;
      const unit = {
        id:
          curriculumEditor.item?.id ||
          `${rootId}.${nextChildNumber(rootId, curriculum.units)}`,
        name: curriculumForm.name.trim(),
        topics: curriculumEditor.item?.topics || [],
      };
      const idx = curriculum.units.findIndex((u: any) => u.id === curriculumEditor.item?.id);
      if (idx >= 0) curriculum.units[idx] = { ...curriculum.units[idx], ...unit };
      else curriculum.units.push(unit);
      setExpandedCurriculumUnits((prev) => ({ ...prev, [unit.id]: true }));
    }

    if (curriculumEditor.type === "topic" && curriculumEditor.unitId) {
      const unit = curriculum.units.find((u: any) => String(u.id) === String(curriculumEditor.unitId));
      if (!unit) return;
      unit.topics = Array.isArray(unit.topics) ? unit.topics : [];
      const topic = {
        id:
          curriculumEditor.item?.id ||
          `${unit.id}.${nextChildNumber(unit.id, unit.topics)}`,
        name: curriculumForm.name.trim(),
        outcomes: curriculumEditor.item?.outcomes || [],
      };
      const idx = unit.topics.findIndex((t: any) => String(t.id) === String(curriculumEditor.item?.id));
      if (idx >= 0) unit.topics[idx] = { ...unit.topics[idx], ...topic };
      else unit.topics.push(topic);
      setExpandedCurriculumUnits((prev) => ({ ...prev, [unit.id]: true }));
      setExpandedCurriculumTopics((prev) => ({ ...prev, [topic.id]: true }));
    }

    if (curriculumEditor.type === "outcome" && curriculumEditor.unitId && curriculumEditor.topicId) {
      const unit = curriculum.units.find((u: any) => String(u.id) === String(curriculumEditor.unitId));
      const topic = unit?.topics?.find((t: any) => String(t.id) === String(curriculumEditor.topicId));
      if (!topic) return;
      topic.outcomes = Array.isArray(topic.outcomes) ? topic.outcomes : [];
      const outcome = {
        id:
          curriculumEditor.item?.id ||
          `${topic.id}.${nextChildNumber(topic.id, topic.outcomes)}`,
        name: curriculumForm.name.trim(),
      };
      const idx = topic.outcomes.findIndex((o: any) => String(o.id) === String(curriculumEditor.item?.id));
      if (idx >= 0) topic.outcomes[idx] = { ...topic.outcomes[idx], ...outcome };
      else topic.outcomes.push(outcome);
      setExpandedCurriculumUnits((prev) => ({ ...prev, [unit.id]: true }));
      setExpandedCurriculumTopics((prev) => ({ ...prev, [topic.id]: true }));
    }

    setCourseCurriculum(course.id, curriculum);

    // Müfredat düzenleme ekranı sunucudaki courseCurriculums kaydını tek otorite
    // olarak kullanır. Yalnız yerel state güncellenirse özellikle kazanım adı
    // sayfa yenilendiğinde eski sunucu kaydıyla geri döner. Düzenlenen ağacı aynı
    // canonical ders kaydına da yaz ve hata olursa ekranda sahte başarı bırakma.
    const meta = curriculum?.__curriculumMeta || previousCurriculum?.__curriculumMeta || {};
    const storageKey = resolveCurriculumStorageKey(course.id) || getCurriculumKey(course.id);
    const authoritativeCourseId = String(
      meta?.courseId || String(storageKey || "").replace(/^curriculum_/, "") || course.id || "",
    ).trim();
    const authoritativeGrade =
      curriculumGradeNumber(course?.gradeLevel) ||
      curriculumGradeNumber(meta?.grade) ||
      curriculumGradeNumber(curriculumActiveGrade);
    const authoritativeCourseName = String(
      course?.courseName || course?.name || meta?.courseName || curriculum?.courseName || "",
    ).trim();
    const serverCurriculum = stripQuestionsFromCurriculum(curriculum);
    delete serverCurriculum.__curriculumMeta;

    try {
      await saveAuthoritativeCurriculumEntry(
        {
          courseId: authoritativeCourseId,
          grade: authoritativeGrade,
          courseName: authoritativeCourseName,
        },
        serverCurriculum,
      );
      setCurriculumEditor(null);
      setCurriculumForm({ id: "", name: "" });
      triggerNotification(
        curriculumEditor.type === "outcome"
          ? "Kazanım adı güncellendi."
          : curriculumEditor.type === "topic"
            ? "Konu güncellendi."
            : "Ünite güncellendi.",
      );
    } catch (error) {
      setCourseCurriculum(course.id, previousCurriculum);
      console.error("Müfredat düzenleme sunucuya kaydedilemedi:", error);
      triggerNotification(
        `Müfredat değişikliği kaydedilemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const deleteCurriculumItem = async (type: "unit" | "topic" | "outcome", unitId: string, topicId?: string, outcomeId?: string) => {
    const course = getSelectedCurriculumCourse();
    if (!course) return;

    const previousCurriculum = JSON.parse(JSON.stringify(getCourseCurriculum(course.id)));
    const curriculum = JSON.parse(JSON.stringify(previousCurriculum));
    curriculum.units = Array.isArray(curriculum.units) ? curriculum.units : [];

    if (type === "unit") {
      curriculum.units = curriculum.units.filter((u: any) => String(u.id) !== String(unitId));
    }

    if (type === "topic") {
      const unit = curriculum.units.find((u: any) => String(u.id) === String(unitId));
      if (!unit) {
        triggerNotification("Konunun bağlı olduğu ünite bulunamadı.");
        return;
      }
      const beforeCount = Array.isArray(unit.topics) ? unit.topics.length : 0;
      unit.topics = (unit.topics || []).filter(
        (t: any) => String(t.id) !== String(topicId),
      );
      if (unit.topics.length === beforeCount) {
        triggerNotification("Silinecek konu bulunamadı.");
        return;
      }
    }

    if (type === "outcome") {
      const unit = curriculum.units.find((u: any) => String(u.id) === String(unitId));
      const topic = unit?.topics?.find((t: any) => String(t.id) === String(topicId));
      if (!topic) {
        triggerNotification("Kazanımın bağlı olduğu konu bulunamadı.");
        return;
      }

      const beforeCount = Array.isArray(topic.outcomes) ? topic.outcomes.length : 0;
      topic.outcomes = (topic.outcomes || []).filter(
        (o: any) => String(o.id) !== String(outcomeId),
      );
      if (topic.outcomes.length === beforeCount) {
        triggerNotification("Silinecek kazanım bulunamadı.");
        return;
      }
    }

    setCourseCurriculum(course.id, curriculum);

    // Konu ve kazanım silme işlemleri yalnız yerel state'te bırakılırsa,
    // sunucudaki otoriter courseCurriculums kaydı sayfa yenilendiğinde eski
    // düğümleri tekrar getirir. Bu iki işlemde ağacın tamamını canonical kayda yaz.
    if (type === "topic" || type === "outcome") {
      const meta = curriculum?.__curriculumMeta || previousCurriculum?.__curriculumMeta || {};
      const storageKey = resolveCurriculumStorageKey(course.id) || getCurriculumKey(course.id);
      const courseId = String(
        meta?.courseId || String(storageKey || "").replace(/^curriculum_/, "") || course.id || "",
      ).trim();
      const grade =
        curriculumGradeNumber(course?.gradeLevel) ||
        curriculumGradeNumber(meta?.grade) ||
        curriculumGradeNumber(curriculumActiveGrade);
      const courseName = String(
        course?.courseName || course?.name || meta?.courseName || curriculum?.courseName || "",
      ).trim();
      const serverCurriculum = stripQuestionsFromCurriculum(curriculum);
      delete serverCurriculum.__curriculumMeta;

      try {
        await saveAuthoritativeCurriculumEntry(
          { courseId, grade, courseName },
          serverCurriculum,
        );
        triggerNotification(type === "topic" ? "Konu silindi." : "Kazanım silindi.");
      } catch (error) {
        // Sunucu kaydı başarısızsa ekranda silinmiş gibi bırakma.
        setCourseCurriculum(course.id, previousCurriculum);
        console.error(`${type === "topic" ? "Konu" : "Kazanım"} silme sunucuya kaydedilemedi:`, error);
        triggerNotification(
          `${type === "topic" ? "Konu" : "Kazanım"} silinemedi: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  const curriculumHeaders = [
    "SINIF_KODU",
    "DERS_KODU",
    "DERS_ADI",
    "UNITE_NO",
    "UNITE_ADI",
    "KONU_NO",
    "KONU_ADI",
    "KAZANIM_NO",
    "KAZANIM_ADI",
    "KAZANIM_KODU",
    "SORU_SIRA_NO",
    "SORU_CEVABI",
    "SORU_KODU",
  ];

  const normalizeCurriculumHeader = (value: unknown) =>
    String(value || "")
      .trim()
      .toLocaleUpperCase("tr-TR")
      .replace(/İ/g, "I")
      .replace(/Ş/g, "S")
      .replace(/Ğ/g, "G")
      .replace(/Ü/g, "U")
      .replace(/Ö/g, "O")
      .replace(/Ç/g, "C")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const curriculumCellAliases: Record<string, string[]> = {
    SINIF_KODU: ["SINIF_KODU", "SINIF_DUZEYI", "SINIF", "SINIF_SEVIYESI"],
    DERS_KODU: ["DERS_KODU", "DERS_ID", "DERS", "DERS_NO"],
    DERS_ADI: ["DERS_ADI", "DERS_ISMI"],
    UNITE_NO: ["UNITE_NO", "UNITE_KODU", "UNITE_SIRA_NO"],
    UNITE_ADI: ["UNITE_ADI", "UNITE_ISMI"],
    KONU_NO: ["KONU_NO", "KONU_KODU", "KONU_SIRA_NO"],
    KONU_ADI: ["KONU_ADI", "KONU_ISMI"],
    KAZANIM_NO: ["KAZANIM_NO", "KAZANIM_SIRA_NO"],
    KAZANIM_ADI: ["KAZANIM_ADI", "KAZANIM", "KAZANIM_ISMI"],
    KAZANIM_KODU: ["KAZANIM_KODU"],
    SORU_SIRA_NO: ["SORU_SIRA_NO", "SORU_NO"],
    SORU_CEVABI: ["SORU_CEVABI", "CEVAP"],
    SORU_KODU: ["SORU_KODU"],
  };

  const getCurriculumCell = (row: any, canonicalKey: string) => {
    const normalizedEntries = Object.entries(row || {}).map(([key, value]) => [
      normalizeCurriculumHeader(key),
      value,
    ] as const);
    const aliases = curriculumCellAliases[canonicalKey] || [canonicalKey];
    for (const alias of aliases) {
      const normalizedAlias = normalizeCurriculumHeader(alias);
      const found = normalizedEntries.find(([key]) => key === normalizedAlias);
      if (found && String(found[1] ?? "").trim() !== "") return found[1];
    }
    return "";
  };

  const resolveCurriculumCourse = (row: any) => {
    const rawCode = String(getCurriculumCell(row, "DERS_KODU") || "").trim();
    const suppliedName = String(getCurriculumCell(row, "DERS_ADI") || "").trim();
    const numericCode = Number(rawCode);

    let catalogCourse = Number.isFinite(numericCode) && numericCode > 0
      ? CURRICULUM_COURSE_CATALOG.find((item) => item.id === numericCode)
      : undefined;

    if (!catalogCourse && suppliedName) {
      catalogCourse = CURRICULUM_COURSE_CATALOG.find(
        (item) => normalizeCurriculumName(item.name) === normalizeCurriculumName(suppliedName),
      );
    }

    if (!catalogCourse && rawCode) {
      const matchingCustomCourse = (customCreatedCourses || []).find((course: any) => {
        const codes = [course?.code, course?.courseCode, course?.curriculumCourseId, course?.id]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        return codes.some((code) => normalizeCurriculumName(code) === normalizeCurriculumName(rawCode));
      });
      if (matchingCustomCourse) {
        catalogCourse = CURRICULUM_COURSE_CATALOG.find(
          (item) => normalizeCurriculumName(item.name) === normalizeCurriculumName(matchingCustomCourse.courseName),
        );
      }
    }

    return {
      rawCode,
      suppliedName,
      catalogCourse,
      courseCode: catalogCourse?.id || rawCode,
      courseName: catalogCourse?.name || suppliedName,
    };
  };

  const buildCurriculumFromRows = (rows: any[]) => {
    const byCourse = new Map<string, any>();
    const warnings: string[] = [];

    rows.forEach((row, index) => {
      const rowNo = index + 2;
      const grade = curriculumGradeNumber(getCurriculumCell(row, "SINIF_KODU"));
      if (![9, 10, 11, 12].includes(grade)) {
        warnings.push(`${rowNo}. satır: Geçerli sınıf kodu bulunamadı (9, 10, 11 veya 12 olmalı).`);
        return;
      }

      const { rawCode, suppliedName, catalogCourse, courseCode, courseName } = resolveCurriculumCourse(row);
      if (!rawCode) {
        warnings.push(`${rowNo}. satır: Ders kodu eksik.`);
        return;
      }
      if (!courseCode || !courseName) {
        warnings.push(`${rowNo}. satır: '${rawCode}' ders kodu sistemde bir dersle eşleştirilemedi.`);
        return;
      }
      if (
        catalogCourse &&
        suppliedName &&
        normalizeCurriculumName(suppliedName) !== normalizeCurriculumName(catalogCourse.name)
      ) {
        warnings.push(
          `${rowNo}. satır: ${rawCode} ders kodu '${catalogCourse.name}' dersine aittir; '${suppliedName}' adı dikkate alınmadı.`,
        );
      }

      const unitNo = Number(getCurriculumCell(row, "UNITE_NO"));
      const unitName = String(getCurriculumCell(row, "UNITE_ADI") || "").trim();
      const topicNo = Number(getCurriculumCell(row, "KONU_NO"));
      const topicName = String(getCurriculumCell(row, "KONU_ADI") || "").trim();
      const outcomeNo = Number(getCurriculumCell(row, "KAZANIM_NO"));
      const outcomeName = String(getCurriculumCell(row, "KAZANIM_ADI") || "").trim();

      if (!unitNo || !unitName || !topicNo || !topicName) {
        warnings.push(`${rowNo}. satır: Ünite veya konu bilgisi eksik.`);
        return;
      }
      const hasOutcome = Boolean(outcomeNo && outcomeName);
      if ((outcomeNo && !outcomeName) || (!outcomeNo && outcomeName)) {
        warnings.push(`${rowNo}. satır: Kazanım numarası ve adı birlikte doldurulmalı; satır konu düzeyinde kaydedildi.`);
      }

      const rootId = `${grade}.${courseCode}`;
      const unitId = `${rootId}.${unitNo}`;
      const topicId = `${unitId}.${topicNo}`;
      const outcomeId = hasOutcome ? `${topicId}.${outcomeNo}` : "";
      const mapKey = `${grade}::${courseCode}`;

      let curriculum = byCourse.get(mapKey);
      if (!curriculum) {
        curriculum = {
          grade,
          courseId: courseCode,
          courseCode,
          courseName,
          units: [],
        };
        byCourse.set(mapKey, curriculum);
      }

      let unit = curriculum.units.find((item: any) => item.id === unitId);
      if (!unit) {
        unit = { id: unitId, number: unitNo, name: unitName, topics: [] };
        curriculum.units.push(unit);
      }

      let topic = unit.topics.find((item: any) => item.id === topicId);
      if (!topic) {
        topic = { id: topicId, number: topicNo, name: topicName, outcomes: [] };
        unit.topics.push(topic);
      }

      let outcome: any = null;
      if (hasOutcome) {
        outcome = topic.outcomes.find((item: any) => item.id === outcomeId);
        if (!outcome) {
          outcome = {
            id: outcomeId,
            code: outcomeId,
            number: outcomeNo,
            name: outcomeName,
          };
          topic.outcomes.push(outcome);
        }
      }

    });

    byCourse.forEach((curriculum) => {
      curriculum.units.sort((a: any, b: any) => a.number - b.number);
      curriculum.units.forEach((unit: any) => {
        unit.topics.sort((a: any, b: any) => a.number - b.number);
        unit.topics.forEach((topic: any) => {
          topic.outcomes = Array.isArray(topic.outcomes) ? topic.outcomes : [];
          topic.outcomes.sort((a: any, b: any) => a.number - b.number);
        });
      });
    });

    return { byCourse, warnings };
  };

  const resolveCurriculumStorageCourseId = (grade: number, curriculum: any) => {
    const courseCode = String(curriculum?.courseCode || curriculum?.courseId || "").trim();
    const courseName = String(curriculum?.courseName || "").trim();

    // Temel dersler (özellikle Matematik) rastgele custom course id'si altında
    // tutulursa sınav hazırlama ekranı canonical CURR-{sınıf}-{ders} kaydını
    // bulamıyor ve sunucudaki eski kayıt yeni yüklemeyi tekrar ezebiliyor.
    // Bu yüzden katalogdaki dersler her zaman tek ve kararlı anahtara yazılır.
    const catalogCourse =
      CURRICULUM_COURSE_CATALOG.find(
        (item) => String(item.id) === courseCode,
      ) ||
      CURRICULUM_COURSE_CATALOG.find(
        (item) => normalizeCurriculumName(item.name) === normalizeCurriculumName(courseName),
      );
    if (catalogCourse) return curriculumVirtualCourseId(grade, catalogCourse.id);

    const existing = (customCreatedCourses || []).find((course: any) => {
      if (curriculumGradeNumber(course?.gradeLevel) !== grade) return false;
      const codeCandidates = [course?.curriculumCourseId, course?.courseCode, course?.code]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      const codeMatch = codeCandidates.some(
        (candidate) => normalizeCurriculumName(candidate) === normalizeCurriculumName(courseCode),
      );
      const nameMatch =
        courseName && normalizeCurriculumName(course?.courseName) === normalizeCurriculumName(courseName);
      return codeMatch || nameMatch;
    });
    return existing?.id || `CURR-${grade}-${courseCode}`;
  };

  const applyGradeCurriculumRows = (rows: any[]) => {
    const { byCourse, warnings } = buildCurriculumFromRows(rows);
    if (byCourse.size === 0) {
      triggerNotification(warnings[0] || "Yüklenebilir müfredat satırı bulunamadı.");
      return false;
    }

    const importedEntries = [...byCourse.values()]
      .map((curriculum: any) => {
        const grade = curriculumGradeNumber(curriculum?.grade);
        if (!grade) return null;
        const storageCourseId = resolveCurriculumStorageCourseId(grade, curriculum);
        return {
          grade,
          storageCourseId,
          curriculum: stripQuestionsFromCurriculum(curriculum),
        };
      })
      .filter(Boolean) as Array<{ grade: number; storageCourseId: string; curriculum: any }>;

    setCurriculumStore((prev) => {
      const next = { ...prev };
      importedEntries.forEach(({ storageCourseId, curriculum }) => {
        next[getCurriculumKey(storageCourseId)] = curriculum;
      });
      try {
        sqliteStorage.setItem("course_curriculums_v1", JSON.stringify(next));
      } catch (error) {
        console.error("Müfredat yerel veritabanına yazılamadı:", error);
      }
      return next;
    });

    // Yüklenen müfredatı yalnız yerel state'te bırakma. Sınav Hazırla ve diğer
    // ekranlar tek kaynak olarak sunucudaki courseCurriculums koleksiyonunu
    // okuduğu için her ders canonical kayıt olarak sunucuya da anında yazılır.
    // Böylece Matematik yüklenmiş görünüp biraz sonra kaybolmaz.
    void Promise.all(
      importedEntries.map(({ grade, storageCourseId, curriculum }) =>
        saveAuthoritativeCurriculumEntry(
          {
            courseId: storageCourseId,
            grade,
            courseName: String(curriculum?.courseName || "").trim(),
          },
          curriculum,
        ),
      ),
    ).catch((error) => {
      console.error("Müfredat sunucuya kaydedilemedi:", error);
      triggerNotification(
        `Müfredat ekranda yüklendi ancak sunucuya kaydedilemedi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    const importedCourses = [...byCourse.values()];
    setCurriculumSelectedCoursesByGrade((prev) => {
      const next = { ...prev };
      importedCourses.forEach((curriculum: any) => {
        const grade = curriculumGradeNumber(curriculum?.grade);
        if (!grade) return;
        const gradeKey = `${grade}. Sınıf`;
        const current = [...(next[gradeKey] || [])];
        if (
          curriculum.courseName &&
          !current.some((name) => normalizeCurriculumName(name) === normalizeCurriculumName(curriculum.courseName))
        ) {
          current.push(curriculum.courseName);
        }
        next[gradeKey] = current;
      });
      return next;
    });

    const gradeLabel = [...new Set(importedCourses.map((item: any) => item.grade))]
      .sort((a, b) => a - b)
      .map((grade) => `${grade}. sınıf`)
      .join(", ");
    triggerNotification(
      `${gradeLabel} müfredatı oluşturuldu: ${byCourse.size} ders` +
        (warnings.length ? ` • ${warnings.length} satır uyarısı` : ""),
    );
    return true;
  };

  const handleGradeCurriculumUpload = async (file: File | null) => {
    if (!file) return;
    const lowerName = file.name.toLocaleLowerCase("tr-TR");
    try {
      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const grade = curriculumGradeNumber(curriculumActiveGrade);
        const preferredSheet =
          workbook.SheetNames.find((name) => name.includes(String(grade))) ||
          workbook.SheetNames[0];
        const worksheet = workbook.Sheets[preferredSheet];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        applyGradeCurriculumRows(rows);
        return;
      }

      const text = await decodeTurkishTextFile(file);
      const lines = String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        triggerNotification("Müfredat dosyasında veri bulunamadı.");
        return;
      }
      const separator = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
      const headers = lines[0].split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map((line) => {
        const cells = line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
        return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
      });
      applyGradeCurriculumRows(rows);
    } catch (error) {
      console.error("Müfredat Excel yükleme hatası:", error);
      triggerNotification(
        `Müfredat dosyası okunamadı: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleCurriculumUpload = async (file: File | null) => {
    // Ders içi modalda yüklenen dosya da aynı toplu şemayı kullanır.
    await handleGradeCurriculumUpload(file);
  };

  const applyPastedCurriculumRows = (rows: any[]) => {
    const usableRows = Array.isArray(rows) ? rows : [];
    if (usableRows.length === 0) {
      triggerNotification("Yapıştırılan müfredat verisinde aktarılabilir satır bulunamadı.");
      return false;
    }

    return applyGradeCurriculumRows(usableRows);
  };

  const downloadCurriculumTemplate = async () => {
    const XLSX = await import("xlsx");
    const grade = curriculumGradeNumber(curriculumActiveGrade);
    const workbook = XLSX.utils.book_new();
    const rows: any[][] = [curriculumHeaders];

    CURRICULUM_COURSE_CATALOG.forEach((course) => {
      rows.push([
        grade,
        course.id,
        course.name,
        1,
        "1. Ünite Adı",
        1,
        "1. Konu Adı",
        1,
        "1. Kazanım Adı",
        `${grade}.${course.id}.1.1.1`,
        1,
        "A",
        `${grade}.${course.id}.1.1.1_1_A`,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 14 }, { wch: 10 }, { wch: 32 }, { wch: 10 }, { wch: 28 },
      { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 42 }, { wch: 22 },
      { wch: 14 }, { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, `${grade}. Sınıf`);

    const infoRows = [
      ["e-Nstitü Müfredat Şablonu"],
      ["Kazanım kodu", "SINIF_KODU.DERS_KODU.UNITE_NO.KONU_NO.KAZANIM_NO"],
      ["Örnek kazanım", "10.1.3.3.7"],
      ["Soru kodu", "KAZANIM_KODU_SIRA_NO_CEVAP"],
      ["Örnek soru", "10.1.3.3.7_4_B"],
      ["Not", "6 numaralı ders ID kullanıcı tanımında ayrılmış/boş bırakılmıştır."],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(infoRows), "Açıklama");
    XLSX.writeFile(workbook, `e-Nstitu_Mufredat_${grade}_Sinif_Sablonu.xlsx`);
  };

  const normalizeReportText = (value: unknown) =>
    String(value || "").trim().toLocaleLowerCase("tr-TR");

  const displayedCustomCreatedCourses = customCreatedCourses.map(
    (course) => customCourseUiOverrides[course.id] || course,
  );

  useEffect(() => {
    if (customCourseSaveRevision === 0) return;

    void courseService.commitAcademicCatalog({
      classrooms,
      courses,
      customCreatedCourses: displayedCustomCreatedCourses,
    }).catch((error) => {
      console.error("Ders sınıf ve grup seçimleri kalıcı olarak kaydedilemedi:", error);
      triggerNotification("Dersin sınıf ve grup seçimleri kaydedilemedi.");
    });
  }, [customCourseSaveRevision]);

  const assignmentReportRows = [...classrooms]
    .sort(compareClassrooms)
    .flatMap((classroom) =>
      (classroom.assignedCourses || []).map((storedAssignment) => {
        const assignment = {
          ...storedAssignment,
          ...teacherCourseUiAssignments[
            `${classroom.id}::${normalizeReportText(storedAssignment.courseName)}`
          ],
        };
        const assignedTeacherIds = assignment.teacherAssignmentCleared
          ? []
          : [assignment.teacherId, assignment.teacherId2].filter(
              (teacherId): teacherId is string => Boolean(teacherId),
            );
        const assignedTeacherNames = assignment.teacherAssignmentCleared
          ? []
          : [
              teachers.find((teacher) => teacher.id === assignment.teacherId)?.name ||
                assignment.teacherName,
              teachers.find((teacher) => teacher.id === assignment.teacherId2)?.name ||
                assignment.teacherName2,
            ].filter(
              (teacherName): teacherName is string =>
                Boolean(teacherName) &&
                !normalizeReportText(teacherName).includes("atanmadı") &&
                normalizeReportText(teacherName) !== "belirtilmedi",
            );
        const matchingCourse = courses.find(
          (course) =>
            normalizeReportText(course.name) === normalizeReportText(assignment.courseName) &&
            normalizeReportText(course.classroom) === normalizeReportText(classroom.name),
        );
        const rawType = assignment.type || matchingCourse?.type;
        const isElective =
          rawType === "elective" ||
          rawType === "Seçmeli Ders" ||
          normalizeReportText(assignment.courseName).startsWith("seçmeli") ||
          normalizeReportText(assignment.courseName).startsWith("s. ");

        return {
          classroomId: classroom.id,
          classroomName: classroom.name,
          courseName: assignment.courseName,
          weeklyHours: Number(assignment.weeklyHours || matchingCourse?.weeklyHours || 0),
          teacherIds: assignedTeacherIds,
          teacherNames: [...new Set(assignedTeacherNames)],
          isElective,
        };
      }),
    )
    .filter((row) => {
      const matchingDefinitions = displayedCustomCreatedCourses.filter(
        (course) => isSameCourseName(course.courseName, row.courseName),
      );

      // Dersler ekranında bu ders için bir sınıf seçimi tanımlanmışsa,
      // eski assignedCourses satırlarını değil güncel sınıf seçimini esas al.
      return (
        matchingDefinitions.length === 0 ||
        matchingDefinitions.some(
          (course) =>
            Array.isArray(course.selectedClassrooms) &&
            course.selectedClassrooms.includes(row.classroomId),
        )
      );
    });

  const getTeacherAssignmentRows = (teacher: Teacher) =>
    assignmentReportRows.filter(
      (row) =>
        row.teacherIds.includes(teacher.id) ||
        row.teacherNames.some(
          (teacherName) => normalizeReportText(teacherName) === normalizeReportText(teacher.name),
        ),
    );

  const getTeacherAssignedHours = (teacher: Teacher) =>
    getTeacherAssignmentRows(teacher).reduce((total, row) => total + row.weeklyHours, 0);

  const assignmentExplorerDropdowns: Array<{
    type: "branch" | "teacher" | "course" | "classroom";
    label: string;
    icon: React.ReactNode;
    options: Array<{ id: string; label: string; group?: string; secondary?: string }>;
  }> = [
    {
      type: "branch",
      label: "Branşlar",
      icon: <BookmarkMinus className="h-5 w-5" />,
      options: [...new Set(teachers.map((teacher) => teacher.branch).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "tr"))
        .map((branch) => ({ id: branch, label: branch })),
    },
    {
      type: "classroom",
      label: "Sınıflar",
      icon: <Building2 className="h-5 w-5" />,
      options: [...classrooms]
        .sort(compareClassrooms)
        .map((classroom) => ({ id: classroom.id, label: classroom.name })),
    },
  ];

  const availableTeacherBranches = [
    ...new Set([
      ...teachers.map((teacher) => teacher.branch?.trim()).filter(Boolean),
      ...customTeacherBranches,
    ]),
  ].sort((a, b) => a.localeCompare(b, "tr"));

  const branchCourseOptions = [
    ...new Set([
      ...courses.map((course) => course.name),
      ...assignmentReportRows.map((row) => row.courseName),
      ...(customCreatedCourses || []).map(
        (course) => course.courseName || course.name || "",
      ),
    ].filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "tr"));

  const toggleBranchCourseAssignment = (branch: string, courseName: string) => {
    setBranchCourseAssignments((current) => {
      const assignedCourses = current[branch] || [];
      const isSelected = assignedCourses.some((assignedCourse) =>
        isSameCourseName(assignedCourse, courseName),
      );
      return {
        ...current,
        [branch]: isSelected
          ? assignedCourses.filter(
              (assignedCourse) => !isSameCourseName(assignedCourse, courseName),
            )
          : [...assignedCourses, courseName].sort((a, b) => a.localeCompare(b, "tr")),
      };
    });
  };

  const getEligibleBranchesForCourse = (courseName: string) =>
    (Object.entries(branchCourseAssignments) as [string, string[]][])
      .filter(([, assignedCourses]) =>
        assignedCourses.some((assignedCourse) =>
          isSameBranchCourseName(assignedCourse, courseName),
        ),
      )
      .map(([branch]) => branch);

  const isTeacherEligibleForCourse = (teacher: Teacher, courseName: string) => {
    const eligibleBranches = getEligibleBranchesForCourse(courseName);

    // Herhangi bir branşa bağlanmamış dersler bütün öğretmenlere açık kalır.
    if (eligibleBranches.length === 0) return true;

    const teacherBranch = normalizeReportText(teacher.branch || "");
    return eligibleBranches.some(
      (branch) => normalizeReportText(branch) === teacherBranch,
    );
  };

  const normalizeBranchCourseName = (courseName: string) =>
    String(courseName || "")
      .replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL)\)\s*$/i, "")
      .toLocaleUpperCase("tr-TR")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const isSameBranchCourseName = (firstName: string, secondName: string) =>
    isSameCourseName(firstName, secondName) ||
    normalizeBranchCourseName(firstName) === normalizeBranchCourseName(secondName);

  const isCourseAssignedToAnyBranch = (courseName: string) =>
    (Object.values(branchCourseAssignments) as string[][]).some((assignedCourses) =>
      assignedCourses.some((assignedCourse) =>
        isSameBranchCourseName(assignedCourse, courseName),
      ),
    );

  const showTeacherCourseChangesImmediately = (nextClassrooms: Classroom[]) => {
    const nextUiAssignments: typeof teacherCourseUiAssignments = {};
    nextClassrooms.forEach((classroom) => {
      (classroom.assignedCourses || []).forEach((assignment) => {
        nextUiAssignments[
          `${classroom.id}::${normalizeReportText(assignment.courseName)}`
        ] = {
          teacherId: assignment.teacherId,
          teacherName: assignment.teacherName,
          teacherId2: assignment.teacherId2,
          teacherName2: assignment.teacherName2,
          teacherAssignmentCleared: assignment.teacherAssignmentCleared,
        };
      });
    });
    setTeacherCourseUiAssignments(nextUiAssignments);
  };

  const getTeacherCourseWorkingClassrooms = () =>
    classrooms.map((classroom) => ({
      ...classroom,
      assignedCourses: (classroom.assignedCourses || []).map((assignment) => ({
        ...assignment,
        ...teacherCourseUiAssignments[
          `${classroom.id}::${normalizeReportText(assignment.courseName)}`
        ],
      })),
    }));

  const getTeacherCourseWorkingCourses = (workingClassrooms: Classroom[]) =>
    courses.map((course) => {
      const classroom = workingClassrooms.find(
        (item) =>
          normalizeReportText(item.name) === normalizeReportText(course.classroom),
      );
      const assignment = classroom?.assignedCourses?.find((item) =>
        isSameCourseName(item.courseName, course.name),
      );
      if (!assignment) return course;
      return {
        ...course,
        teacherId: assignment.teacherId || "",
        teacherName: assignment.teacherName,
        teacherId2: assignment.teacherId2,
        teacherName2: assignment.teacherName2,
        teacherAssignmentCleared: assignment.teacherAssignmentCleared,
      };
    });

  const persistTeacherCourseChanges = async (
    previousClassrooms: Classroom[],
    nextClassrooms: Classroom[],
    previousCourses: Course[],
    nextCourses: Course[],
  ) => {
    const previousClassroomsById = new Map(
      previousClassrooms.map((classroom) => [classroom.id, classroom]),
    );
    const previousCoursesById = new Map(
      previousCourses.map((course) => [course.id, course]),
    );
    const changedClassrooms = nextClassrooms.filter(
      (classroom) =>
        JSON.stringify(previousClassroomsById.get(classroom.id)) !==
        JSON.stringify(classroom),
    );
    const changedCourses = nextCourses.filter(
      (course) =>
        JSON.stringify(previousCoursesById.get(course.id)) !== JSON.stringify(course),
    );

    if (changedClassrooms.length === 0 && changedCourses.length === 0) return;

    await courseService.commitAcademicCatalog(
      {
        classrooms: nextClassrooms,
        courses: nextCourses,
        customCreatedCourses: customCreatedCourses || [],
      },
      "teacherAssigned",
      { changedClassrooms: changedClassrooms.length, changedCourses: changedCourses.length },
    );
  };

  const waitForTeacherAssignmentUiPaint = () =>
    new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

  const toggleTeacherCourseAssignment = async (
    teacher: Teacher,
    row: (typeof assignmentReportRows)[number],
  ) => {
    if (isTeacherCourseSaving) return;
    setIsTeacherCourseSaving(true);
    const isAssignedToTeacher =
      row.teacherIds.includes(teacher.id) ||
      row.teacherNames.some(
        (teacherName) =>
          normalizeReportText(teacherName) === normalizeReportText(teacher.name),
      );

    const workingClassrooms = getTeacherCourseWorkingClassrooms();
    const workingCourses = getTeacherCourseWorkingCourses(workingClassrooms);
    const nextClassrooms = workingClassrooms.map((classroom) => {
      if (classroom.id !== row.classroomId) return classroom;
      return {
        ...classroom,
        assignedCourses: (classroom.assignedCourses || []).map((assignment) => {
          if (!isSameCourseName(assignment.courseName, row.courseName)) return assignment;

          if (!isAssignedToTeacher) {
            return {
              ...assignment,
              teacherId: teacher.id,
              teacherName: teacher.name,
              teacherAssignmentCleared: false,
            };
          }

          if (assignment.teacherId === teacher.id && assignment.teacherId2) {
            return {
              ...assignment,
              teacherId: assignment.teacherId2,
              teacherName: assignment.teacherName2 || "Belirtilmedi",
              teacherId2: undefined,
              teacherName2: undefined,
              teacherAssignmentCleared: false,
            };
          }

          if (assignment.teacherId2 === teacher.id) {
            return {
              ...assignment,
              teacherId2: undefined,
              teacherName2: undefined,
              teacherAssignmentCleared: false,
            };
          }

          return {
            ...assignment,
            teacherId: "",
            teacherName: "Öğretmen Atanmadı",
            teacherId2: undefined,
            teacherName2: undefined,
            teacherAssignmentCleared: true,
          };
        }),
      };
    });

    const updatedAssignment = nextClassrooms
      .find((classroom) => classroom.id === row.classroomId)
      ?.assignedCourses?.find((assignment) =>
        isSameCourseName(assignment.courseName, row.courseName),
      );

    const nextCourses = workingCourses.map((course) => {
      if (
        normalizeReportText(course.classroom) !== normalizeReportText(row.classroomName) ||
        !isSameCourseName(course.name, row.courseName)
      ) {
        return course;
      }
      return {
        ...course,
        teacherId: updatedAssignment?.teacherId || "",
        teacherName: updatedAssignment?.teacherId
          ? updatedAssignment.teacherName || "Belirtilmedi"
          : "Öğretmen Atanmadı",
        teacherId2: updatedAssignment?.teacherId2,
        teacherName2: updatedAssignment?.teacherName2,
        teacherAssignmentCleared: Boolean(updatedAssignment?.teacherAssignmentCleared),
      };
    });

    showTeacherCourseChangesImmediately(nextClassrooms);
    setClassrooms(nextClassrooms);
    setCourses(nextCourses);
    await waitForTeacherAssignmentUiPaint();

    try {
      await persistTeacherCourseChanges(
        classrooms,
        nextClassrooms,
        courses,
        nextCourses,
      );
      triggerNotification(
        isAssignedToTeacher
          ? `${row.courseName} dersi ${teacher.name} öğretmeninden alındı.`
          : `${row.courseName} dersi ${teacher.name} öğretmenine atandı.`,
      );
    } catch (error) {
      console.error("Öğretmen ders ataması kaydedilemedi:", error);
      triggerNotification("Öğretmen ders ataması kaydedilemedi.");
    } finally {
      setIsTeacherCourseSaving(false);
    }
  };

  const getTeacherCourseRowKey = (classroomId: string, courseName: string) =>
    `${classroomId}::${normalizeReportText(courseName)}`;

  const openTeacherCourseSelection = (teacher: Teacher) => {
    const configuredCourses = branchCourseAssignments[teacher.branch] || [];
    setTeacherCourseModalTeacherId(teacher.id);
    setTeacherCourseDraftKeys(
      assignmentReportRows
        .filter((row) => {
          const eligible =
            configuredCourses.some((courseName) =>
              isSameBranchCourseName(courseName, row.courseName),
            ) || !isCourseAssignedToAnyBranch(row.courseName);
          const assignedToTeacher =
            row.teacherIds.includes(teacher.id) ||
            row.teacherNames.some(
              (teacherName) =>
                normalizeReportText(teacherName) === normalizeReportText(teacher.name),
            );
          return eligible && assignedToTeacher;
        })
        .map((row) => getTeacherCourseRowKey(row.classroomId, row.courseName)),
    );
  };

  const saveTeacherCourseSelections = async () => {
    const teacher = teachers.find((item) => item.id === teacherCourseModalTeacherId);
    if (!teacher || isTeacherCourseSaving) return;
    setIsTeacherCourseSaving(true);

    const configuredCourses = branchCourseAssignments[teacher.branch] || [];
    const candidateRows = assignmentReportRows.filter((row) => {
      const allowedForBranch = configuredCourses.some((courseName) =>
        isSameBranchCourseName(courseName, row.courseName),
      );
      const hasNoBranch = !isCourseAssignedToAnyBranch(row.courseName);
      if (!allowedForBranch && !hasNoBranch) return false;
      return true;
    });
    const candidateKeys = new Set(
      candidateRows.map((row) => getTeacherCourseRowKey(row.classroomId, row.courseName)),
    );
    const selectedKeys = new Set(teacherCourseDraftKeys);

    const workingClassrooms = getTeacherCourseWorkingClassrooms();
    const workingCourses = getTeacherCourseWorkingCourses(workingClassrooms);
    const nextClassrooms = workingClassrooms.map((classroom) => ({
      ...classroom,
      assignedCourses: (classroom.assignedCourses || []).map((assignment) => {
        const key = getTeacherCourseRowKey(classroom.id, assignment.courseName);
        if (!candidateKeys.has(key)) return assignment;

        const isSelected = selectedKeys.has(key);
        const assignedToTeacher =
          assignment.teacherId === teacher.id ||
          assignment.teacherId2 === teacher.id ||
          normalizeReportText(assignment.teacherName) === normalizeReportText(teacher.name) ||
          normalizeReportText(assignment.teacherName2) === normalizeReportText(teacher.name);

        if (isSelected && !assignedToTeacher) {
          return {
            ...assignment,
            teacherId: teacher.id,
            teacherName: teacher.name,
            teacherAssignmentCleared: false,
          };
        }
        if (!isSelected && assignedToTeacher) {
          if (assignment.teacherId === teacher.id && assignment.teacherId2) {
            return {
              ...assignment,
              teacherId: assignment.teacherId2,
              teacherName: assignment.teacherName2 || "Belirtilmedi",
              teacherId2: undefined,
              teacherName2: undefined,
              teacherAssignmentCleared: false,
            };
          }
          if (assignment.teacherId2 === teacher.id) {
            return {
              ...assignment,
              teacherId2: undefined,
              teacherName2: undefined,
              teacherAssignmentCleared: false,
            };
          }
          return {
            ...assignment,
            teacherId: "",
            teacherName: "Öğretmen Atanmadı",
            teacherId2: undefined,
            teacherName2: undefined,
            teacherAssignmentCleared: true,
          };
        }
        return assignment;
      }),
    }));

    const nextCourses = workingCourses.map((course) => {
      const classroom = nextClassrooms.find(
        (item) => normalizeReportText(item.name) === normalizeReportText(course.classroom),
      );
      const assignment = classroom?.assignedCourses?.find((item) =>
        isSameCourseName(item.courseName, course.name),
      );
      if (!assignment) return course;
      return {
        ...course,
        teacherId: assignment.teacherId || "",
        teacherName: assignment.teacherId
          ? assignment.teacherName || "Belirtilmedi"
          : "Öğretmen Atanmadı",
        teacherId2: assignment.teacherId2,
        teacherName2: assignment.teacherName2,
        teacherAssignmentCleared: Boolean(assignment.teacherAssignmentCleared),
      };
    });

    showTeacherCourseChangesImmediately(nextClassrooms);
    setClassrooms(nextClassrooms);
    setCourses(nextCourses);
    setTeacherCourseModalTeacherId(null);
    setTeacherCourseDraftKeys([]);
    await waitForTeacherAssignmentUiPaint();

    try {
      await persistTeacherCourseChanges(
        classrooms,
        nextClassrooms,
        courses,
        nextCourses,
      );
      triggerNotification(`${teacher.name} için ders atamaları kaydedildi.`);
    } catch (error) {
      console.error("Toplu öğretmen ders ataması kaydedilemedi:", error);
      triggerNotification("Ders atamaları kaydedilemedi.");
    } finally {
      setIsTeacherCourseSaving(false);
    }
  };



  const teacherCourseBoardContext = {
    teachers, normalizeReportText, teacherCourseBranch, branchCourseAssignments, assignmentReportRows,
    isSameBranchCourseName, isCourseAssignedToAnyBranch, isSameCourseName, classrooms,
    draggedAssignedCourseKey, setDraggedAssignedCourseKey, toggleTeacherCourseAssignment,
    setDraggedBranchTeacherId, getTeacherAssignedHours, draggedBranchTeacherId, getTeacherCourseRowKey,
    getTeacherAssignmentCourseColor, teacherCourseModalTeacherId, teacherCourseListMode,
    setTeacherCourseListMode, openTeacherCourseSelection, isTeacherCourseSaving, saveTeacherCourseSelections,
    teacherCourseDraftKeys, setTeacherCourseDraftKeys,
  };

  return (
    <div
      id="courses-tab"
      className={
        embeddedCourseDefinitions || embeddedClassDefinitions
          ? "w-full bg-transparent p-0"
          : "mx-auto max-w-7xl space-y-6 px-6 pb-6 pt-0 lg:px-8 lg:pb-8 lg:pt-0"
      }
    >
      {/* Dersler sekmesinde üst sağ alana ek renk katmanı basılmaz.
          Kırmızı işlem şeridi HumanResourcesModule tarafından sabit tutulur. */}
      {/* Dynamic Tab Switcher */}
      {!embeddedCourseDefinitions && !embeddedClassDefinitions && !standaloneCurriculum && (
      <div className="bg-white border-2 border-dashed border-purple-950 rounded-3xl p-4 shadow-xs">
        <div className="bg-purple-950 bg-theme-pattern p-1.5 rounded-2xl flex w-full min-w-0 items-center overflow-x-auto gap-1.5 scrollbar-hide h-[52px]">
          {(displayMode === "all" || displayMode === "courses" || displayMode === "connections") && (
            <button
              id="subtab-classrooms-btn"
              onClick={() => {
                setCurrentSubTab("classrooms");
                setSearchTerm("");
                if (classrooms.length > 0 && !editingClassId) {
                  openEditClassModal(classrooms[0]);
                }
              }}
              className={`order-2 flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
                currentSubTab === "classrooms"
                  ? "bg-white text-purple-900 shadow-sm border-transparent"
                  : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              Ortak Dersler
            </button>
          )}
          {(displayMode === "all" || displayMode === "courses" || displayMode === "connections") && (
            <button
              id="subtab-teacher-course-assign-btn"
              type="button"
              onClick={() => {
                setCurrentSubTab("teacher-course-assign");
                setTeacherCourseModalTeacherId(null);
                setTeacherCourseDraftKeys([]);
                if (!teacherCourseBranch && availableTeacherBranches.length > 0) {
                  setTeacherCourseBranch(availableTeacherBranches[0]);
                }
              }}
              className={`order-1 flex-none flex h-[40px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-4 text-[13px] font-bold transition-all cursor-pointer ${
                currentSubTab === "teacher-course-assign"
                  ? "bg-white text-purple-900 shadow-sm border-transparent"
                  : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
              }`}
            >
              <UserCheck className="h-4 w-4 shrink-0" />
              Derse Öğretmen Ata
            </button>
          )}
          
          {displayMode === "classes" && (
            <button
              onClick={() => {
                setCurrentSubTab("seating-plan");
              }}
              className={`order-first flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
                currentSubTab === "seating-plan"
                  ? "bg-white text-purple-900 shadow-sm border-transparent"
                  : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
              }`}
            >
              <LayoutTemplate className="w-4 h-4 shrink-0" />
              Sınıf Krokisi
            </button>
          )}
          {(displayMode === "all" || displayMode === "courses") && (
            <button
              id="subtab-courses-btn"
              onClick={() => {
                setCurrentSubTab("courses");
                setSearchTerm("");
              }}
              className={`order-1 flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
                currentSubTab === "courses"
                  ? "bg-white text-purple-900 shadow-sm border-transparent"
                  : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              Ders / Sınıf Atama
            </button>
          )}
          {currentSubTab === "classrooms" && (
            <button
              type="button"
              onClick={() => {
                setAssignmentExplorerSelection(null);
                setActiveMainDropdown(null);
                setIsAssignmentExplorerOpen(true);
              }}
              className="order-last ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-400 text-amber-950 shadow-lg shadow-amber-950/20 transition hover:scale-105 hover:bg-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-200"
              aria-label="Sınıf, ders ve öğretmen seçim penceresini aç"
              title="Sınıf, ders ve öğretmen seçim penceresini aç"
            >
              <Grid2X2 className="h-5 w-5" />
            </button>
          )}
          {currentSubTab === "teacher-course-assign" && (
            <select
              value={teacherCourseBranch}
              onChange={(event) => setTeacherCourseBranch(event.target.value)}
              className="order-last ml-auto h-10 min-w-[230px] shrink-0 rounded-xl border-2 border-amber-300 bg-amber-400 px-3 text-sm font-black text-amber-950 outline-none focus:ring-4 focus:ring-amber-200"
              aria-label="Branş seçimi"
            >
              <option value="">Branş Seçiniz</option>
              {availableTeacherBranches.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-3 flex items-center justify-end gap-3">
          {currentSubTab === "classrooms" && (
            <div className="flex h-[52px] min-w-[240px] items-center rounded-2xl border border-slate-200 bg-white px-2 shadow-sm">
              <select
                value={editingClassId || ""}
                onChange={(e) => {
                  const selected = classrooms.find((c) => c.id === e.target.value);
                  if (selected) openEditClassModal(selected);
                }}
                className="h-[40px] w-full min-w-[220px] rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-black text-indigo-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                aria-label="Sınıf seçimi"
              >
                <option value="">Sınıf Seçiniz</option>
                {[...classrooms].sort(compareClassrooms).map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      )}

      {standaloneCurriculum && (
        <div className="space-y-4">
<Suspense
          fallback={
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white text-sm font-bold text-slate-400">
              Müfredat paneli yükleniyor...
            </div>
          }
        >
          <CourseCurriculumPanel
          customCreatedCourses={customCreatedCourses}
          curriculumActiveGrade={curriculumActiveGrade}
          setCurriculumActiveGrade={setCurriculumActiveGrade}
          deletedCurriculumCourses={deletedCurriculumCourses}
          setDeletedCurriculumCourses={setDeletedCurriculumCourses}
          setCurriculumModalState={setCurriculumModalState}
          downloadCurriculumTemplate={downloadCurriculumTemplate}
          handleGradeCurriculumUpload={handleGradeCurriculumUpload}
          applyPastedCurriculumRows={applyPastedCurriculumRows}
          curriculumCourses={curriculumCoursesForActiveGrade}
          availableAssignedCourses={curriculumAssignedCoursesForActiveGrade}
          selectedCourseNames={curriculumSelectedCourseNames}
          toggleCourseSelection={toggleCurriculumCourseSelection}
          hasCourseCurriculum={hasCourseCurriculum}
          getCourseCurriculum={getCourseCurriculum}
          uploadQuestionImages={uploadCurriculumQuestionImages}
          removeQuestionsByImportSession={removeCurriculumQuestionsByImportSession}
          deleteQuestion={deleteCurriculumQuestion}
          deleteQuestionsBulk={deleteCurriculumQuestionsBulk}
          curriculumMoveCatalog={curriculumMoveCatalog}
          moveQuestion={moveCurriculumQuestion}
        />
        </Suspense>
        </div>
      )}

      {teacherCourseModalTeacherId !== null && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10">
              <div className="rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl">
                İşlem ekranı yükleniyor...
              </div>
            </div>
          }
        >
          <TeacherCourseSelectionModal
        teacherCourseModalTeacherId={teacherCourseModalTeacherId}
        currentSubTab={currentSubTab}
        teachers={teachers}
        branchCourseAssignments={branchCourseAssignments}
        assignmentReportRows={assignmentReportRows}
        isSameBranchCourseName={isSameBranchCourseName}
        isCourseAssignedToAnyBranch={isCourseAssignedToAnyBranch}
        teacherCourseDraftKeys={teacherCourseDraftKeys}
        setTeacherCourseDraftKeys={setTeacherCourseDraftKeys}
        getTeacherCourseRowKey={getTeacherCourseRowKey}
        getTeacherAssignmentCourseColor={getTeacherAssignmentCourseColor}
        setTeacherCourseModalTeacherId={setTeacherCourseModalTeacherId}
        isTeacherCourseSaving={isTeacherCourseSaving}
        saveTeacherCourseSelections={saveTeacherCourseSelections}
      />
        </Suspense>
      )}

      {isAssignmentExplorerOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10">
              <div className="rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl">
                İşlem ekranı yükleniyor...
              </div>
            </div>
          }
        >
          <CourseAssignmentExplorerModal
        isOpen={isAssignmentExplorerOpen}
        setIsOpen={setIsAssignmentExplorerOpen}
        activeMainDropdown={activeMainDropdown}
        setActiveMainDropdown={setActiveMainDropdown}
        assignmentExplorerDropdowns={assignmentExplorerDropdowns}
        assignmentExplorerSelection={assignmentExplorerSelection}
        setAssignmentExplorerSelection={setAssignmentExplorerSelection}
        teachers={teachers}
        classrooms={classrooms}
        normalizeReportText={normalizeReportText}
        branchCourseAssignments={branchCourseAssignments}
        assignmentReportRows={assignmentReportRows}
        isSameCourseName={isSameCourseName}
        isCourseAssignedToAnyBranch={isCourseAssignedToAnyBranch}
        selectedBranchTeacherId={selectedBranchTeacherId}
        setSelectedBranchTeacherId={setSelectedBranchTeacherId}
        getTeacherAssignedHours={getTeacherAssignedHours}
        getTeacherAssignmentRows={getTeacherAssignmentRows}
        isTeacherCourseSaving={isTeacherCourseSaving}
        toggleTeacherCourseAssignment={toggleTeacherCourseAssignment}
      />
        </Suspense>
      )}

      {/* Content Canvas - yalnızca Atamalar çalışma alanı */}
      {!standaloneCurriculum && currentSubTab === "teacher-course-assign" && (
        <ClassCourseAssignmentPanel
          classrooms={classrooms}
          setClassrooms={setClassrooms}
          courses={courses}
          customCreatedCourses={customCreatedCourses}
          setCustomCreatedCourses={setCustomCreatedCourses}
          selectedElectives={selectedElectives}
          customElectives={customElectives}
          teachers={teachers}
          students={students}
          notify={triggerNotification}
          focusClassroomId={focusClassroomId}
        />
      )}
      {!standaloneCurriculum && (currentSubTab === "teacher-course-assign" ? (
        <div className="hidden">
          <div className="flex flex-col gap-4 bg-indigo-950 px-6 py-5 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-indigo-200">
                Sınıfa ders ata
              </p>
              <h3 className="mt-1 text-2xl font-black">Branş ve Öğretmen Seçimi</h3>
            </div>
            <select
              value={teacherCourseBranch}
              onChange={(event) => {
                setTeacherCourseBranch(event.target.value);
                setTeacherCourseModalTeacherId(null);
              }}
              className="h-12 min-w-72 rounded-2xl border border-white/20 bg-white px-4 text-sm font-black text-indigo-950 outline-none"
            >
              <option value="">Branş Seçiniz</option>
              {availableTeacherBranches.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
            {teachers
              .filter(
                (teacher) =>
                  normalizeReportText(teacher.branch) === normalizeReportText(teacherCourseBranch),
              )
              .sort((a, b) => a.name.localeCompare(b.name, "tr"))
              .map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => openTeacherCourseSelection(teacher)}
                  className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md"
                >
                  <span className="block text-base font-black text-slate-900">{teacher.name}</span>
                  <span className="mt-1 block text-xs font-bold text-slate-500">{teacher.branch}</span>
                  <span className="mt-3 inline-flex rounded-xl bg-amber-400 px-3 py-1.5 text-sm font-black text-amber-950">
                    {getTeacherAssignedHours(teacher)} saat
                  </span>
                </button>
              ))}
            {teacherCourseBranch &&
              teachers.filter(
                (teacher) =>
                  normalizeReportText(teacher.branch) === normalizeReportText(teacherCourseBranch),
              ).length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400">
                  Bu branşta kayıtlı öğretmen bulunmuyor.
                </div>
              )}
          </div>
        </div>
      ) : currentSubTab === "seating-plan" ? (
        <CourseSeatingPlanPanel
          classError={classError}
          classForm={classForm}
          setClassForm={setClassForm}
          editingClassId={editingClassId}
          classrooms={classrooms}
          teachers={teachers}
          students={students}
          getBranchLetter={getBranchLetter}
          handleLevelChangeInModal={handleLevelChangeInModal}
          handleBranchNameChange={handleBranchNameChange}
          handleAddClass={handleAddClass}
          handleDeleteClass={handleDeleteClass}
          openEditClassModal={openEditClassModal}
          seatingPlanClassName={seatingPlanClassName}
        />
      ) : currentSubTab === "classrooms" ? (
        <div
          className="h-[calc(100vh-174px)] min-h-[636px] w-full rounded-3xl border border-slate-200 bg-white"
          aria-label="Ortak Dersler çalışma alanı"
        />
      ) : currentSubTab === "courses" ? (
        <CourseDefinitionTable
          classrooms={classrooms}
          setClassrooms={setClassrooms}
          courses={courses}
          setCourses={setCourses}
          customCreatedCourses={customCreatedCourses}
          setCustomCreatedCourses={setCustomCreatedCourses}
          branches={availableTeacherBranches}
          notify={triggerNotification}
        />
            ) : null)}

      
      {isAddCourseModalOpen && (
        <Suspense fallback={null}>
          <AddCourseModal
        isAddCourseModalOpen={isAddCourseModalOpen}
        setIsAddCourseModalOpen={setIsAddCourseModalOpen}
        newCourseName={newCourseName}
        setNewCourseName={setNewCourseName}
        newCourseHours={newCourseHours}
        setNewCourseHours={setNewCourseHours}
        newCourseType={newCourseType}
        setNewCourseType={setNewCourseType}
        newCourseGrades={newCourseGrades}
        setNewCourseGrades={setNewCourseGrades}
        newCourseTargetGroups={newCourseTargetGroups}
        setNewCourseTargetGroups={setNewCourseTargetGroups}
        classrooms={classrooms}
        handleSaveCustomCourse={handleSaveCustomCourse}
      />
        </Suspense>
      )}

      {curriculumModalState.isOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10">
              <div className="rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl">
                İşlem ekranı yükleniyor...
              </div>
            </div>
          }
        >
          <CourseCurriculumModal
        curriculumModalState={curriculumModalState}
        getSelectedCurriculumCourse={getSelectedCurriculumCourse}
        getCourseCurriculum={getCourseCurriculum}
        downloadCurriculumTemplate={downloadCurriculumTemplate}
        handleCurriculumUpload={handleCurriculumUpload}
        openCurriculumEditor={openCurriculumEditor}
        setCurriculumModalState={setCurriculumModalState}
        setCurriculumEditor={setCurriculumEditor}
        expandedCurriculumUnits={expandedCurriculumUnits}
        setExpandedCurriculumUnits={setExpandedCurriculumUnits}
        expandedCurriculumTopics={expandedCurriculumTopics}
        setExpandedCurriculumTopics={setExpandedCurriculumTopics}
        deleteCurriculumItem={deleteCurriculumItem}
        curriculumEditor={curriculumEditor}
        curriculumForm={curriculumForm}
        setCurriculumForm={setCurriculumForm}
        saveCurriculumEditor={saveCurriculumEditor}
      />
        </Suspense>
      )}

      {addElectiveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col gap-5 shadow-2xl relative">
            <div className="flex flex-col gap-1 items-center justify-center text-center">
              <h3 className="text-lg font-bold text-slate-800">Ders Atama Modu</h3>
              <p className="text-xs font-bold text-slate-500">"{addElectiveForm.courseName}" dersini nasıl eklemek istersiniz?</p>
            </div>
            <div className="flex flex-col gap-3">
              <button className="p-4 bg-indigo-50 border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-all" onClick={() => { setAddElectiveForm({...addElectiveForm, mode: 'all'}); setAddElectiveModalOpen(false); }}>
                Tüm Sınıfa Ata
              </button>
              <button className="p-4 bg-emerald-50 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-all" onClick={() => { setAddElectiveForm({...addElectiveForm, mode: 'group'}); setAddElectiveModalOpen(false); }}>
                Gruba Ata (SAY, EA vb.)
              </button>
              <button className="p-4 bg-amber-50 border border-amber-200 hover:border-amber-400 hover:bg-amber-100 text-amber-700 font-bold rounded-xl transition-all" onClick={() => { setAddElectiveForm({...addElectiveForm, mode: 'common'}); setAddElectiveModalOpen(false); }}>
                Ortak Ders Oluştur
              </button>
              <button className="p-4 bg-rose-50 border border-rose-200 hover:border-rose-400 hover:bg-rose-100 text-rose-700 font-bold rounded-xl transition-all" onClick={() => { setAddElectiveForm({...addElectiveForm, mode: 'split', splitCourseName1: addElectiveForm.courseName}); setAddElectiveModalOpen(false); }}>
                Sınıfı Böl
              </button>
            </div>
            <button onClick={() => setAddElectiveModalOpen(false)} className="mt-2 text-xs font-bold text-slate-400 hover:text-slate-600">Vazgeç</button>
          </div>
        </div>
      )}

      {editingCustomCourse && (
        <Suspense fallback={null}>
          <EditCustomCourseModal
        classrooms={classrooms}
        editingCustomCourse={editingCustomCourse}
        handleSaveEditedCustomCourse={handleSaveEditedCustomCourse}
        isEditingCompulsoryLocked={isEditingCompulsoryLocked}
        setEditingCustomCourse={setEditingCustomCourse}
        setIsEditingCompulsoryLocked={setIsEditingCompulsoryLocked}
      />
        </Suspense>
      )}

      {isCourseModalOpen && (
        <Suspense fallback={null}>
          <LegacyCourseModal
        classrooms={classrooms}
        courseError={courseError}
        courseForm={courseForm}
        handleAddCourse={handleAddCourse}
        isCourseModalOpen={isCourseModalOpen}
        isTeacherEligibleForCourse={isTeacherEligibleForCourse}
        setCourseForm={setCourseForm}
        setIsCourseModalOpen={setIsCourseModalOpen}
        teachers={teachers}
      />
        </Suspense>
      )}

      <DeleteCourseConfirmationModal
        confirmDelete={confirmDelete}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
      />

      {(electiveModalState.isOpen ||
        groupStudentModal.isOpen ||
        isStudentSelectModalOpen) && (
        <Suspense fallback={null}>
          <CourseSelectionModals        activeCourseIndexForStudents={activeCourseIndexForStudents}
        assignAllClassStudentsToGroup={assignAllClassStudentsToGroup}
        classCourses={classCourses}
        classForm={classForm}
        classrooms={classrooms}
        clearClassGroupStudents={clearClassGroupStudents}
        deselectAllStudents={deselectAllStudents}
        electiveClassSelections={electiveClassSelections}
        electiveModalState={electiveModalState}
        getClassGroupStudentIds={getClassGroupStudentIds}
        getStudentAssignedGroupInClass={getStudentAssignedGroupInClass}
        getStudentsForClassName={getStudentsForClassName}
        groupStudentModal={groupStudentModal}
        groupStudentSearchTerm={groupStudentSearchTerm}
        isStudentSelectModalOpen={isStudentSelectModalOpen}
        saveElectiveSelection={saveElectiveSelection}
        selectAllStudents={selectAllStudents}
        setElectiveClassSelections={setElectiveClassSelections}
        setElectiveModalState={setElectiveModalState}
        setGroupStudentModal={setGroupStudentModal}
        setGroupStudentSearchTerm={setGroupStudentSearchTerm}
        setIsStudentSelectModalOpen={setIsStudentSelectModalOpen}
        setStudentSearchTerm={setStudentSearchTerm}
        studentSearchTerm={studentSearchTerm}
        students={students}
        toggleClassGroupStudent={toggleClassGroupStudent}
        toggleStudentSelected={toggleStudentSelected}
          />
        </Suspense>
      )}

      {teacherAssignmentModal.isOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10">
              <div className="rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl">
                İşlem ekranı yükleniyor...
              </div>
            </div>
          }
        >
          <TeacherAssignmentModal
        teacherAssignmentModal={teacherAssignmentModal}
        setTeacherAssignmentModal={setTeacherAssignmentModal}
        stopSpeechRecognition={stopSpeechRecognition}
        setTempTeacherToAssign={setTempTeacherToAssign}
        setTempTeacherToAssign2={setTempTeacherToAssign2}
        setVoiceFeedback={setVoiceFeedback}
        tempTeacherToAssign={tempTeacherToAssign}
        tempTeacherToAssign2={tempTeacherToAssign2}
        teachers={teachers}
        isTeacherEligibleForCourse={isTeacherEligibleForCourse}
        isListening={isListening}
        voiceTeacherSlot={voiceTeacherSlot}
        startSpeechRecognition={startSpeechRecognition}
        voiceFeedback={voiceFeedback}
        classCourses={classCourses}
        setClassCourses={setClassCourses}
        editingClassId={editingClassId}
        classrooms={classrooms}
        setClassrooms={setClassrooms}
        courses={courses}
        setCourses={setCourses}
        customCreatedCourses={customCreatedCourses}
        triggerNotification={triggerNotification}
      />
        </Suspense>
      )}

      {isClassroomModalOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10">
              <div className="rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-500 shadow-xl">
                İşlem ekranı yükleniyor...
              </div>
            </div>
          }
        >
          <ClassroomEditModal
        isOpen={isClassroomModalOpen}
        editingClassId={editingClassId}
        classForm={classForm}
        setClassForm={setClassForm}
        teachers={teachers}
        classrooms={classrooms}
        getBranchLetter={getBranchLetter}
        handleLevelChangeInModal={handleLevelChangeInModal}
        handleBranchNameChange={handleBranchNameChange}
        handleAddClass={handleAddClass}
        handleDeleteClass={handleDeleteClass}
        onClose={() => setIsClassroomModalOpen(false)}
      />
        </Suspense>
      )}

      {notification && (
        <div
          id="course-toast-notification"
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 text-xs shadow-md animate-fadeIn fixed bottom-6 right-6 z-50"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold">{notification}</span>
        </div>
      )}
    </div>
  );
}




