import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Archive,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { Classroom, Course, Student, Teacher } from "../types";
import { sqliteStorage } from "../core/state/SyncStateStore";
import { loadAccessState } from "../lib/accessControl";
import eOkulLogoUrl from "../assets/e-okul-logo.png";

let eOkulLogoImagePromise: Promise<HTMLImageElement> | null = null;
const loadEOkulLogoImage = () => {
  if (!eOkulLogoImagePromise) {
    eOkulLogoImagePromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("e-Okul logosu yüklenemedi."));
      image.src = eOkulLogoUrl;
    });
  }
  return eOkulLogoImagePromise;
};

type ResponsibilityExamRecord = {
  id: string;
  examName: string;
  subjectName: string;
  level: string;
  studentIds: string[];
  commissionTeacherIds: string[];
  invigilatorTeacherIds: string[];
  createdAt: string;
  planId?: string;
};

type ExamDateTime = {
  id: string;
  date: string;
  time: string;
};

type ResponsibilityExamScheduleItem = {
  recordId: string;
  slotId: string;
};

type ResponsibilityExamPlan = {
  id: string;
  academicYear: string;
  periodName: string;
  examName: string;
  principalTeacherId: string;
  vicePrincipalTeacherId: string;
  coordinatorTeacherId: string;
  examDateTimes: ExamDateTime[];
  sessionsPerDay: number;
  recordIds: string[];
  schedule?: ResponsibilityExamScheduleItem[];
  scheduleGeneratedAt?: string;
  slotInvigilatorTeacherIds?: Record<string, string[]>;
  createdAt: string;
};

interface ResponsibilityExamModuleProps {
  students: Student[];
  teachers: Teacher[];
  courses: Course[];
  classrooms?: Classroom[];
}

const STORAGE_KEY = "enstitu_responsibility_exams_v1";
const PLAN_STORAGE_KEY = "enstitu_responsibility_exam_plans_v1";

const normalizeText = (value: string) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();

const getLevelFromText = (value: string) => {
  const match = String(value || "").match(/(9|10|11|12)/);
  return match ? match[1] : "";
};

const uniqById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const ResponsibilityExamModule: React.FC<ResponsibilityExamModuleProps> = ({
  students,
  teachers,
  courses,
}) => {
  const [activeTab, setActiveTab] = useState<"exam-info" | "planning" | "exam-calendar" | "documents" | "archive">("exam-info");

  const [academicYear, setAcademicYear] = useState("");
  const [periodName, setPeriodName] = useState("");
  const [principalTeacherId, setPrincipalTeacherId] = useState("");
  const [vicePrincipalTeacherId, setVicePrincipalTeacherId] = useState("");
  const [coordinatorTeacherId, setCoordinatorTeacherId] = useState("");
  const [examDateTimes, setExamDateTimes] = useState<ExamDateTime[]>([
    { id: `slot-${Date.now()}`, date: "", time: "" },
  ]);
  const [editingExamPlanId, setEditingExamPlanId] = useState<string | null>(null);
  const [openDocumentRecordId, setOpenDocumentRecordId] = useState<string | null>(null);
  const [generatingDocumentKey, setGeneratingDocumentKey] = useState("");

  const [editorPlanId, setEditorPlanId] = useState<string | null>(null);
  const [editorRecordId, setEditorRecordId] = useState<string | null>(null);
  const [editorLevel, setEditorLevel] = useState("");
  const [editorSubject, setEditorSubject] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedCommissionTeacherIds, setSelectedCommissionTeacherIds] = useState<string[]>([]);
  const [commissionPicker, setCommissionPicker] = useState("");

  const [plans, setPlans] = useState<ResponsibilityExamPlan[]>(() => {
    try {
      const raw = sqliteStorage.getItem(PLAN_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((plan: any) => ({
        id: String(plan.id || `sorumluluk-plan-${Date.now()}`),
        academicYear: String(plan.academicYear || ""),
        periodName: String(plan.periodName || ""),
        examName: String(plan.examName || "Sorumluluk Sınavı"),
        principalTeacherId: String(plan.principalTeacherId || ""),
        vicePrincipalTeacherId: String(plan.vicePrincipalTeacherId || ""),
        coordinatorTeacherId: String(plan.coordinatorTeacherId || ""),
        examDateTimes: Array.isArray(plan.examDateTimes) ? plan.examDateTimes : [],
        sessionsPerDay: Math.max(1, Number(plan.sessionsPerDay || 1)),
        recordIds: Array.isArray(plan.recordIds) ? plan.recordIds : [],
        schedule: Array.isArray(plan.schedule) ? plan.schedule.filter((item: any) => item?.recordId && item?.slotId) : [],
        scheduleGeneratedAt: String(plan.scheduleGeneratedAt || ""),
        slotInvigilatorTeacherIds: plan.slotInvigilatorTeacherIds && typeof plan.slotInvigilatorTeacherIds === "object" ? plan.slotInvigilatorTeacherIds : {},
        createdAt: String(plan.createdAt || new Date().toISOString()),
      }));
    } catch {
      return [];
    }
  });

  const [records, setRecords] = useState<ResponsibilityExamRecord[]>(() => {
    try {
      const raw = sqliteStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((record: ResponsibilityExamRecord) => {
        const level = getLevelFromText(record.level || "") || String(record.level || "").trim();
        return {
          ...record,
          level,
          examName: level && record.subjectName ? `${level} ${record.subjectName}` : String(record.examName || ""),
          studentIds: Array.isArray(record.studentIds) ? record.studentIds : [],
          commissionTeacherIds: Array.isArray(record.commissionTeacherIds) ? record.commissionTeacherIds : [],
          invigilatorTeacherIds: Array.isArray(record.invigilatorTeacherIds) ? record.invigilatorTeacherIds : [],
        };
      });
    } catch {
      return [];
    }
  });

  useEffect(() => {
    sqliteStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    sqliteStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  // 24.09.2026 16:00 için tek seferlik özel düzeltme:
  // 10 Tarih kaydını 10 Matematik olarak birleştir ve aynı plandaki mükerrer 10 Matematik kaydını kaldır.
  useEffect(() => {
    const migrationKey = "enstitu_responsibility_special_10_math_2026_09_24_v1";
    if (sqliteStorage.getItem(migrationKey) === "done") return;

    let targetPlanId = "";
    let targetRecordId = "";
    for (const plan of plans) {
      const targetSlot = (plan.examDateTimes || []).find((slot) => slot.date === "2026-09-24" && String(slot.time || "").startsWith("16:00"));
      if (!targetSlot) continue;
      const scheduledIds = new Set((plan.schedule || []).filter((item) => item.slotId === targetSlot.id).map((item) => item.recordId));
      const target = records.find((record) => scheduledIds.has(record.id) && String(record.level) === "10" && normalizeText(record.subjectName) === "tarih");
      if (target) {
        targetPlanId = plan.id;
        targetRecordId = target.id;
        break;
      }
    }

    if (!targetPlanId || !targetRecordId) return;

    const planMathRecords = records.filter((record) => record.planId === targetPlanId && String(record.level) === "10" && normalizeText(record.subjectName) === "matematik");
    const targetRecord = records.find((record) => record.id === targetRecordId);
    if (!targetRecord) return;

    const mergedStudentIds = Array.from(new Set([...(targetRecord.studentIds || []), ...planMathRecords.flatMap((record) => record.studentIds || [])]));
    const mergedCommissionIds = Array.from(new Set([...(targetRecord.commissionTeacherIds || []), ...planMathRecords.flatMap((record) => record.commissionTeacherIds || [])]));
    const duplicateIds = new Set(planMathRecords.map((record) => record.id));

    setRecords((prev) => prev
      .filter((record) => !duplicateIds.has(record.id))
      .map((record) => record.id === targetRecordId ? {
        ...record,
        subjectName: "Matematik",
        examName: "10 Matematik",
        studentIds: mergedStudentIds,
        commissionTeacherIds: mergedCommissionIds,
      } : record));

    setPlans((prev) => prev.map((plan) => plan.id !== targetPlanId ? plan : {
      ...plan,
      recordIds: Array.from(new Set((plan.recordIds || []).filter((id) => !duplicateIds.has(id)).concat(targetRecordId))),
      schedule: (plan.schedule || []).filter((item) => !duplicateIds.has(item.recordId)),
      scheduleGeneratedAt: plan.scheduleGeneratedAt || new Date().toISOString(),
    }));

    sqliteStorage.setItem(migrationKey, "done");
  }, [plans, records]);

  // 10 Matematik için tek seferlik özel planlama:
  // öğrencileri sırayla 22.09.2026 16:00 ve 24.09.2026 16:00 oturumlarına paylaştır.
  useEffect(() => {
    const migrationKey = "enstitu_responsibility_special_10_math_split_2026_09_22_24_v1";
    if (sqliteStorage.getItem(migrationKey) === "done") return;

    let targetPlan: ResponsibilityExamPlan | undefined;
    let slot22: ExamDateTime | undefined;
    let slot24: ExamDateTime | undefined;
    let sourceRecord: ResponsibilityExamRecord | undefined;

    for (const plan of plans) {
      const candidate22 = (plan.examDateTimes || []).find((slot) => slot.date === "2026-09-22" && String(slot.time || "").startsWith("16:00"));
      const candidate24 = (plan.examDateTimes || []).find((slot) => slot.date === "2026-09-24" && String(slot.time || "").startsWith("16:00"));
      if (!candidate22 || !candidate24) continue;

      const planRecords = records.filter((record) => record.planId === plan.id);
      const mathRecord = planRecords.find((record) => String(record.level) === "10" && normalizeText(record.subjectName) === "matematik");
      if (!mathRecord || !(mathRecord.studentIds || []).length) continue;

      targetPlan = plan;
      slot22 = candidate22;
      slot24 = candidate24;
      sourceRecord = mathRecord;
      break;
    }

    if (!targetPlan || !slot22 || !slot24 || !sourceRecord) return;

    const orderedStudentIds = Array.from(new Set(sourceRecord.studentIds || []));
    if (orderedStudentIds.length === 0) return;

    const students22 = orderedStudentIds.filter((_, index) => index % 2 === 0);
    const students24 = orderedStudentIds.filter((_, index) => index % 2 === 1);
    const secondRecordId = `${sourceRecord.id}-special-20260922`;
    const secondRecord: ResponsibilityExamRecord = {
      ...sourceRecord,
      id: secondRecordId,
      examName: "10 Matematik",
      subjectName: "Matematik",
      level: "10",
      studentIds: students22,
      createdAt: new Date().toISOString(),
      planId: targetPlan.id,
    };

    setRecords((prev) => {
      const withoutOldSpecial = prev.filter((record) => record.id !== secondRecordId);
      const next = withoutOldSpecial.map((record) => record.id === sourceRecord!.id ? {
        ...record,
        examName: "10 Matematik",
        subjectName: "Matematik",
        level: "10",
        studentIds: students24,
      } : record);
      return [...next, secondRecord];
    });

    setPlans((prev) => prev.map((plan) => plan.id !== targetPlan!.id ? plan : {
      ...plan,
      recordIds: Array.from(new Set([...(plan.recordIds || []), sourceRecord!.id, secondRecordId])),
      schedule: [
        ...(plan.schedule || []).filter((item) => item.recordId !== sourceRecord!.id && item.recordId !== secondRecordId),
        { recordId: secondRecordId, slotId: slot22!.id },
        { recordId: sourceRecord!.id, slotId: slot24!.id },
      ],
      scheduleGeneratedAt: new Date().toISOString(),
    }));

    sqliteStorage.setItem(migrationKey, "done");
  }, [plans, records]);

  const schoolName = useMemo(() => {
    try {
      const accessState = loadAccessState();
      const school = accessState.schools.find((item) => item.id === "school-main") || accessState.schools[0];
      return String(school?.name || "Ordu Lisesi").trim() || "Ordu Lisesi";
    } catch {
      return "Ordu Lisesi";
    }
  }, []);

  const schoolProfile = useMemo(() => {
    try {
      const profileRaw = sqliteStorage.getItem("school_info_a_profile");
      const legacyRaw = sqliteStorage.getItem("school_info");
      const profile = profileRaw ? JSON.parse(profileRaw) : {};
      const legacy = legacyRaw ? JSON.parse(legacyRaw) : {};
      return {
        principalName: String(profile?.principalName || legacy?.principalName || "").trim(),
        academicYear: String(profile?.activeSemester || legacy?.semester || "").trim(),
      };
    } catch {
      return { principalName: "", academicYear: "" };
    }
  }, []);

  const automaticAcademicYear = useMemo(() => {
    const now = new Date();
    const baseYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const calculated = `${baseYear}-${baseYear + 1}`;
    const saved = schoolProfile.academicYear;
    return saved.startsWith(String(baseYear)) ? saved : calculated;
  }, [schoolProfile.academicYear]);

  const levelOptions = ["9", "10", "11", "12"];

  const sortedTeachers = useMemo(
    () => teachers.slice().sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [teachers],
  );

  const principalTeacher = useMemo(() => sortedTeachers.find((teacher) => {
    const role = normalizeText(teacher.adminRole || "");
    return role.includes("mudur") && !role.includes("yardim");
  }) || null, [sortedTeachers]);

  const schoolPrincipalName = principalTeacher?.name || schoolProfile.principalName || "Okul Müdürü";
  const defaultPrincipalTeacherId = principalTeacher?.id || "";

  const vicePrincipalOptions = useMemo(() => {
    const filtered = sortedTeachers.filter((teacher) => {
      const role = normalizeText(teacher.adminRole || "");
      return role.includes("mudur") && role.includes("yardim");
    });
    return filtered.length ? filtered : sortedTeachers;
  }, [sortedTeachers]);

  useEffect(() => {
    if (!academicYear) setAcademicYear(automaticAcademicYear);
  }, [academicYear, automaticAcademicYear]);

  useEffect(() => {
    if (!principalTeacherId && defaultPrincipalTeacherId) setPrincipalTeacherId(defaultPrincipalTeacherId);
  }, [defaultPrincipalTeacherId, principalTeacherId]);

  const timeOptions = useMemo(() => {
    const result: string[] = [];
    for (let hour = 7; hour <= 20; hour += 1) {
      for (const minute of [0, 15, 30, 45]) {
        result.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
      }
    }
    return result;
  }, []);

  const buildPeriodLabel = (value: string) => {
    const trimmed = String(value || "").trim();
    return trimmed.replace(/\s+d[oö]nemi?$/i, "").trim() || trimmed;
  };

  const currentExamName = useMemo(() => {
    const year = academicYear.trim();
    const period = buildPeriodLabel(periodName);
    if (!year || !period) return "";
    return `${year} ${schoolName} ${period} Dönemi Sorumluluk Sınavı`;
  }, [academicYear, periodName, schoolName]);

  const addExamDateTime = () => {
    setExamDateTimes((prev) => [...prev, { id: `slot-${Date.now()}-${prev.length}`, date: "", time: "" }]);
  };

  const updateExamDateTime = (id: string, field: "date" | "time", value: string) => {
    setExamDateTimes((prev) => prev.map((slot) => slot.id === id ? { ...slot, [field]: value } : slot));
  };

  const removeExamDateTime = (id: string) => {
    setExamDateTimes((prev) => {
      const next = prev.filter((slot) => slot.id !== id);
      return next.length ? next : [{ id: `slot-${Date.now()}`, date: "", time: "" }];
    });
  };

  const resetExamInfoForm = (keepEditing = false) => {
    setAcademicYear(automaticAcademicYear);
    setPeriodName("");
    setPrincipalTeacherId(defaultPrincipalTeacherId);
    setVicePrincipalTeacherId("");
    setCoordinatorTeacherId("");
    setExamDateTimes([{ id: `slot-${Date.now()}`, date: "", time: "" }]);
    if (!keepEditing) setEditingExamPlanId(null);
  };

  const saveExamInfo = () => {
    const year = academicYear.trim();
    const period = buildPeriodLabel(periodName);
    const validSlots = examDateTimes.filter((slot) => slot.date && slot.time);
    if (!year || !period || !schoolPrincipalName || !vicePrincipalTeacherId || !coordinatorTeacherId || validSlots.length === 0) return;

    if (editingExamPlanId) {
      setPlans((prev) => prev.map((plan) => plan.id === editingExamPlanId ? {
        ...plan,
        academicYear: year,
        periodName: period,
        examName: `${year} ${schoolName} ${period} Dönemi Sorumluluk Sınavı`,
        principalTeacherId: principalTeacherId || plan.principalTeacherId || defaultPrincipalTeacherId,
        vicePrincipalTeacherId,
        coordinatorTeacherId,
        examDateTimes: validSlots,
        sessionsPerDay: 1,
        schedule: [],
        scheduleGeneratedAt: "",
        slotInvigilatorTeacherIds: Object.fromEntries(
          Object.entries(plan.slotInvigilatorTeacherIds || {}).filter(([slotId]) => validSlots.some((slot) => slot.id === slotId)),
        ),
      } : plan));
      setEditingExamPlanId(null);
      resetExamInfoForm();
      setActiveTab("planning");
      return;
    }

    const id = `sorumluluk-plan-${Date.now()}`;
    const plan: ResponsibilityExamPlan = {
      id,
      academicYear: year,
      periodName: period,
      examName: `${year} ${schoolName} ${period} Dönemi Sorumluluk Sınavı`,
      principalTeacherId: principalTeacherId || defaultPrincipalTeacherId,
      vicePrincipalTeacherId,
      coordinatorTeacherId,
      examDateTimes: validSlots,
      sessionsPerDay: 1,
      recordIds: [],
      schedule: [],
      scheduleGeneratedAt: "",
      slotInvigilatorTeacherIds: {},
      createdAt: new Date().toISOString(),
    };

    setPlans((prev) => [plan, ...prev]);
    resetExamInfoForm();
    setActiveTab("planning");
  };

  const openExamInfoEditor = (plan: ResponsibilityExamPlan) => {
    closeCourseEditor();
    setEditingExamPlanId(plan.id);
    setAcademicYear(plan.academicYear || automaticAcademicYear);
    setPeriodName(plan.periodName || "");
    setPrincipalTeacherId(plan.principalTeacherId || defaultPrincipalTeacherId);
    setVicePrincipalTeacherId(plan.vicePrincipalTeacherId || "");
    setCoordinatorTeacherId(plan.coordinatorTeacherId || "");
    setExamDateTimes(plan.examDateTimes?.length ? plan.examDateTimes.map((slot, index) => ({
      id: slot.id || `slot-edit-${plan.id}-${index}`,
      date: slot.date || "",
      time: slot.time || "",
    })) : [{ id: `slot-${Date.now()}`, date: "", time: "" }]);
    setActiveTab("exam-info");
  };

  const getSubjectOptionsForLevel = (level: string) => {
    const names = new Set<string>();
    courses.forEach((course) => {
      const courseLevels = new Set<string>();
      const mainLevel = getLevelFromText(course.classroom || "");
      if (mainLevel) courseLevels.add(mainLevel);
      (course.selectedClassrooms || []).forEach((classroom) => {
        const classLevel = getLevelFromText(classroom);
        if (classLevel) courseLevels.add(classLevel);
      });
      if (courseLevels.size > 0 && !courseLevels.has(level)) return;
      const name = String(course.name || "").trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "tr"));
  };

  const resolveBranchTeachers = (level: string, subjectName: string) => {
    if (!level || !subjectName) return [];
    const subjectKey = normalizeText(subjectName);
    const courseTeacherIds = new Set<string>();
    const courseTeacherNames = new Set<string>();

    courses.forEach((course) => {
      const courseName = normalizeText(course.name || "");
      const courseLevels = new Set<string>([
        getLevelFromText(course.classroom || ""),
        ...(course.selectedClassrooms || []).map((cls) => getLevelFromText(cls)),
      ].filter(Boolean));

      if (courseName !== subjectKey) return;
      if (courseLevels.size > 0 && !courseLevels.has(level)) return;
      if (course.teacherId) courseTeacherIds.add(String(course.teacherId));
      if (course.teacherName) courseTeacherNames.add(normalizeText(course.teacherName));
      if (course.teacherId2) courseTeacherIds.add(String(course.teacherId2));
      if (course.teacherName2) courseTeacherNames.add(normalizeText(course.teacherName2));
    });

    const matchedTeachers = uniqById<Teacher>(teachers.filter((teacher) => {
      const branchKey = normalizeText(teacher.branch || "");
      const teacherNameKey = normalizeText(teacher.name || "");
      return courseTeacherIds.has(String(teacher.id))
        || courseTeacherNames.has(teacherNameKey)
        || (branchKey && (branchKey.includes(subjectKey) || subjectKey.includes(branchKey)));
    })).sort((a, b) => a.name.localeCompare(b.name, "tr"));

    // Bazı dersler tek bir branşa bağlı değildir (örn. Sağlık Bilgisi ve Trafik Kültürü).
    // Ders/branş eşleşmesi bulunamazsa komisyon seçimi için tüm öğretmenleri göster.
    if (matchedTeachers.length > 0) return matchedTeachers;
    return uniqById<Teacher>(teachers).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  };

  const closeCourseEditor = () => {
    setEditorPlanId(null);
    setEditorRecordId(null);
    setEditorLevel("");
    setEditorSubject("");
    setStudentSearch("");
    setSelectedStudentIds([]);
    setSelectedCommissionTeacherIds([]);
    setCommissionPicker("");
  };

  const openNewCourseEditor = (planId: string, level: string, subjectName: string) => {
    if (!subjectName) return;
    setEditorPlanId(planId);
    setEditorRecordId(null);
    setEditorLevel(level);
    setEditorSubject(subjectName);
    setStudentSearch("");
    setSelectedStudentIds([]);
    setSelectedCommissionTeacherIds([]);
    setCommissionPicker("");
  };

  const openRecordEditor = (record: ResponsibilityExamRecord) => {
    setEditorPlanId(record.planId || null);
    setEditorRecordId(record.id);
    setEditorLevel(getLevelFromText(record.level) || record.level);
    setEditorSubject(record.subjectName);
    setStudentSearch("");
    setSelectedStudentIds(record.studentIds || []);
    setSelectedCommissionTeacherIds(record.commissionTeacherIds || []);
    setCommissionPicker("");
  };

  const eligibleStudents = useMemo(() => {
    if (!editorLevel) return [];
    const examLevel = Number(editorLevel);
    return students.filter((student) => {
      const currentLevel = Number(getLevelFromText(student.classroom || ""));
      return Number.isFinite(currentLevel) && currentLevel > examLevel;
    });
  }, [editorLevel, students]);

  const filteredStudents = useMemo(() => {
    const query = normalizeText(studentSearch);
    return eligibleStudents
      .filter((student) => {
        const combined = normalizeText(`${student.name} ${student.number || student.studentNumber || ""} ${student.classroom || ""}`);
        return !query || combined.includes(query);
      })
      .sort((a, b) => {
        const levelDiff = Number(getLevelFromText(a.classroom || "") || 99) - Number(getLevelFromText(b.classroom || "") || 99);
        if (levelDiff !== 0) return levelDiff;
        return String(a.name).localeCompare(String(b.name), "tr");
      });
  }, [eligibleStudents, studentSearch]);

  const selectedStudents = useMemo(
    () => selectedStudentIds.map((id) => students.find((student) => student.id === id)).filter(Boolean) as Student[],
    [selectedStudentIds, students],
  );

  const branchTeachers = useMemo(
    () => resolveBranchTeachers(editorLevel, editorSubject),
    [editorLevel, editorSubject, courses, teachers],
  );

  const selectedCommissionTeachers = useMemo(
    () => selectedCommissionTeacherIds.map((id) => teachers.find((teacher) => teacher.id === id)).filter(Boolean) as Teacher[],
    [selectedCommissionTeacherIds, teachers],
  );

  const saveCourseRecord = () => {
    if (!editorPlanId || !editorLevel || !editorSubject || selectedStudentIds.length === 0) return;
    const existing = editorRecordId ? records.find((record) => record.id === editorRecordId) : undefined;
    const recordId = existing?.id || `sorumluluk-${Date.now()}`;
    const payload: ResponsibilityExamRecord = {
      id: recordId,
      examName: `${editorLevel} ${editorSubject}`,
      subjectName: editorSubject,
      level: editorLevel,
      studentIds: [...selectedStudentIds],
      commissionTeacherIds: [...selectedCommissionTeacherIds],
      invigilatorTeacherIds: [],
      createdAt: existing?.createdAt || new Date().toISOString(),
      planId: editorPlanId,
    };

    setRecords((prev) => existing
      ? prev.map((record) => record.id === existing.id ? payload : record)
      : [...prev, payload]);
    setPlans((prev) => prev.map((plan) => {
      if (plan.id !== editorPlanId) return plan;
      const recordIds = plan.recordIds.includes(recordId) ? plan.recordIds : [...plan.recordIds, recordId];
      return { ...plan, recordIds, schedule: [], scheduleGeneratedAt: "" };
    }));
    closeCourseEditor();
  };

  const removeRecord = (recordId: string) => {
    const record = records.find((item) => item.id === recordId);
    setRecords((prev) => prev.filter((item) => item.id !== recordId));
    if (record?.planId) {
      setPlans((prev) => prev.map((plan) => plan.id === record.planId
        ? { ...plan, recordIds: plan.recordIds.filter((id) => id !== recordId), schedule: [], scheduleGeneratedAt: "" }
        : plan));
    }
    if (editorRecordId === recordId) closeCourseEditor();
  };

  const removePlan = (planId: string) => {
    const recordIds = new Set(records.filter((record) => record.planId === planId).map((record) => record.id));
    setRecords((prev) => prev.filter((record) => record.planId !== planId));
    setPlans((prev) => prev.filter((plan) => plan.id !== planId));
    if (editorPlanId === planId || (editorRecordId && recordIds.has(editorRecordId))) closeCourseEditor();
  };

  const sortedExamSlots = (plan: ResponsibilityExamPlan) =>
    plan.examDateTimes
      .filter((slot) => slot.date && slot.time)
      .slice()
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  const formatScheduleDateTime = (slot: ExamDateTime) => {
    if (!slot.date) return slot.time || "";
    const [year, month, day] = slot.date.split("-").map(Number);
    const date = new Date(year, Math.max(0, month - 1), day);
    const weekdayRaw = new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(date);
    const weekday = weekdayRaw ? `${weekdayRaw.charAt(0).toLocaleUpperCase("tr-TR")}${weekdayRaw.slice(1)}` : "";
    const formattedDate = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
    return `${formattedDate}${weekday ? ` ${weekday}` : ""} / ${slot.time || ""}`;
  };

  const generateSchedule = (plan: ResponsibilityExamPlan) => {
    const slots = sortedExamSlots(plan);
    if (slots.length === 0) return;

    const planRecords = records.filter((record) => record.planId === plan.id || plan.recordIds.includes(record.id));
    if (planRecords.length === 0) return;

    const studentSets = new Map<string, Set<string>>(planRecords.map((record) => [record.id, new Set<string>(record.studentIds || [])]));
    const conflictCount = new Map<string, number>();

    planRecords.forEach((record) => {
      let count = 0;
      const own = studentSets.get(record.id) || new Set<string>();
      planRecords.forEach((other) => {
        if (other.id === record.id) return;
        const otherSet = studentSets.get(other.id) || new Set<string>();
        for (const studentId of own) {
          if (otherSet.has(studentId)) { count += 1; break; }
        }
      });
      conflictCount.set(record.id, count);
    });

    const ordered = planRecords.slice().sort((a, b) => {
      const conflictDiff = (conflictCount.get(b.id) || 0) - (conflictCount.get(a.id) || 0);
      if (conflictDiff !== 0) return conflictDiff;
      const studentDiff = (b.studentIds?.length || 0) - (a.studentIds?.length || 0);
      if (studentDiff !== 0) return studentDiff;
      return a.examName.localeCompare(b.examName, "tr");
    });

    const assignedBySlot = new Map<string, ResponsibilityExamRecord[]>();
    slots.forEach((slot) => assignedBySlot.set(slot.id, []));
    const schedule: ResponsibilityExamScheduleItem[] = [];

    ordered.forEach((record) => {
      const ownStudents = studentSets.get(record.id) || new Set<string>();
      const target = slots.find((slot) => {
        const already = assignedBySlot.get(slot.id) || [];
        return already.every((other) => {
          const otherStudents = studentSets.get(other.id) || new Set<string>();
          for (const studentId of ownStudents) {
            if (otherStudents.has(studentId)) return false;
          }
          return true;
        });
      });
      if (!target) return;
      assignedBySlot.get(target.id)?.push(record);
      schedule.push({ recordId: record.id, slotId: target.id });
    });

    setPlans((prev) => prev.map((item) => item.id === plan.id
      ? { ...item, schedule, scheduleGeneratedAt: new Date().toISOString() }
      : item));
  };

  const toggleSlotInvigilator = (planId: string, slotId: string, teacherId: string) => {
    if (!teacherId) return;
    setPlans((prev) => prev.map((plan) => {
      if (plan.id !== planId) return plan;
      const map = { ...(plan.slotInvigilatorTeacherIds || {}) };
      const current = Array.isArray(map[slotId]) ? [...map[slotId]] : [];
      map[slotId] = current.includes(teacherId) ? current.filter((id) => id !== teacherId) : [...current, teacherId];
      return { ...plan, slotInvigilatorTeacherIds: map };
    }));
  };

  const escapeHtml = (value: unknown) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const downloadExamPlanPdf = async (plan: ResponsibilityExamPlan) => {
    const slots = sortedExamSlots(plan);
    const planRecords = records.filter((record) => record.planId === plan.id || plan.recordIds.includes(record.id));
    const schedule = plan.schedule || [];
    if (!plan.scheduleGeneratedAt || schedule.length === 0) return;

    const principalTeacherForPlan = teachers.find((teacher) => teacher.id === plan.principalTeacherId);
    const principalName = principalTeacherForPlan?.name || schoolPrincipalName;
    const periodLabel = buildPeriodLabel(plan.periodName || "");
    const printableTitle = `${plan.academicYear} Eğitim Öğretim Yılı ${periodLabel ? `${periodLabel} Dönemi ` : ""}Sorumluluk Sınav Planı`;

    type PrintableCourse = {
      record: ResponsibilityExamRecord;
      students: Student[];
      commission: string[];
      highlight: boolean;
    };
    type PrintableSlot = {
      slot: ExamDateTime;
      courses: PrintableCourse[];
      invigilators: string[];
      rowCount: number;
    };

    let courseIndex = 0;
    const printableSlots: PrintableSlot[] = slots.map((slot) => {
      const slotRecordIds = schedule.filter((item) => item.slotId === slot.id).map((item) => item.recordId);
      const slotRecords = slotRecordIds
        .map((id) => planRecords.find((record) => record.id === id))
        .filter(Boolean)
        .sort((a, b) => {
          const levelDiff = Number((a as ResponsibilityExamRecord).level || 99) - Number((b as ResponsibilityExamRecord).level || 99);
          if (levelDiff !== 0) return levelDiff;
          return (a as ResponsibilityExamRecord).subjectName.localeCompare((b as ResponsibilityExamRecord).subjectName, "tr");
        }) as ResponsibilityExamRecord[];

      const courses = slotRecords.map((record) => {
        const examStudents = record.studentIds
          .map((studentId) => students.find((student) => student.id === studentId))
          .filter(Boolean)
          .sort((a, b) => String(a.name).localeCompare(String(b.name), "tr")) as Student[];
        const commission = record.commissionTeacherIds
          .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId)?.name)
          .filter(Boolean)
          .slice(0, 2) as string[];
        const course: PrintableCourse = {
          record,
          students: examStudents.length ? examStudents : ([] as Student[]),
          commission,
          highlight: courseIndex % 2 === 0,
        };
        courseIndex += 1;
        return course;
      });

      const invigilators = (plan.slotInvigilatorTeacherIds?.[slot.id] || [])
        .map((id) => teachers.find((teacher) => teacher.id === id)?.name)
        .filter(Boolean) as string[];

      return {
        slot,
        courses,
        invigilators,
        rowCount: courses.reduce((sum, course) => sum + Math.max(1, course.students.length), 0),
      };
    }).filter((item) => item.courses.length > 0);

    const dateRowCounts = new Map<string, number>();
    printableSlots.forEach((item) => {
      dateRowCounts.set(item.slot.date, (dateRowCounts.get(item.slot.date) || 0) + item.rowCount);
    });

    const headerCell = (text: string, alignment: "left" | "center" = "left") => ({
      text,
      bold: true,
      fontSize: 7.3,
      alignment,
      fillColor: "#ffffff",
      margin: [1, 2, 1, 2],
    });
    const normalCell = (text: string, options: Record<string, any> = {}) => ({
      text,
      fontSize: 7,
      margin: [1, 1.7, 1, 1.7],
      verticalAlignment: "middle",
      ...options,
    });

    const tableBody: any[][] = [[
      headerCell("Tarih"),
      headerCell("Gün"),
      headerCell("Saat"),
      headerCell("Sınıf\nSeviyesi", "center"),
      headerCell("Ders"),
      headerCell("Öğrenci"),
      headerCell("Komisyon", "center"),
      headerCell("Komisyon", "center"),
      headerCell("Gözetmen", "center"),
    ]];

    const seenDates = new Set<string>();
    printableSlots.forEach((slotItem) => {
      let slotFirstRow = true;
      slotItem.courses.forEach((course) => {
        const studentsForRows = course.students.length ? course.students : [null];
        studentsForRows.forEach((student, studentIndex) => {
          const isCourseFirstRow = studentIndex === 0;
          const row: any[] = [];
          const fillColor = course.highlight ? "#fff200" : "#ffffff";

          if (!seenDates.has(slotItem.slot.date)) {
            seenDates.add(slotItem.slot.date);
            const [year, month, day] = slotItem.slot.date.split("-").map(Number);
            const dateObj = new Date(year, Math.max(0, month - 1), day);
            const weekdayRaw = new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(dateObj);
            const weekday = weekdayRaw ? `${weekdayRaw.charAt(0).toLocaleUpperCase("tr-TR")}${weekdayRaw.slice(1)}` : "";
            const dateText = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
            const dateRows = dateRowCounts.get(slotItem.slot.date) || slotItem.rowCount;
            row.push(normalCell(dateText, { rowSpan: dateRows, alignment: "center", bold: true, fontSize: 7 }));
            row.push(normalCell(weekday, { rowSpan: dateRows, alignment: "center", bold: true, fontSize: 7 }));
          } else {
            row.push({});
            row.push({});
          }

          row.push(normalCell(slotItem.slot.time || "", { fillColor, alignment: "center" }));
          row.push(normalCell(course.record.level || "", { fillColor, alignment: "center" }));
          row.push(normalCell(course.record.subjectName || course.record.examName || "", { fillColor, bold: true }));
          row.push(normalCell(student?.name || "Öğrenci kaydı yok", { fillColor, bold: true }));

          if (isCourseFirstRow) {
            const courseRowSpan = Math.max(1, studentsForRows.length);
            row.push(normalCell(course.commission[0] || "—", { rowSpan: courseRowSpan, alignment: "center", bold: true }));
            row.push(normalCell(course.commission[1] || "—", { rowSpan: courseRowSpan, alignment: "center", bold: true }));
          } else {
            row.push({});
            row.push({});
          }

          if (slotFirstRow) {
            row.push(normalCell(slotItem.invigilators.join(", ") || "—", {
              rowSpan: Math.max(1, slotItem.rowCount),
              alignment: "center",
              bold: true,
              fontSize: 6.7,
            }));
            slotFirstRow = false;
          } else {
            row.push({});
          }

          tableBody.push(row);
        });
      });
    });

    const { PdfEngine } = await import("../pdf/core/PdfEngine");
    await PdfEngine.generate({
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [18, 20, 18, 28],
      content: [
        { text: schoolName.toLocaleUpperCase("tr-TR"), alignment: "center", bold: true, fontSize: 14, margin: [0, 0, 0, 3] },
        { text: printableTitle, alignment: "center", bold: true, fontSize: 11.5, margin: [0, 0, 0, 8] },
        {
          table: {
            headerRows: 1,
            widths: [42, 34, 34, 38, 83, 113, 54, 54, 66],
            body: tableBody,
          },
          layout: {
            hLineWidth: (i: number) => i === 0 || i === 1 ? 0.9 : 0.55,
            vLineWidth: () => 0.55,
            hLineColor: () => "#4b5563",
            vLineColor: () => "#737373",
            paddingLeft: () => 1.5,
            paddingRight: () => 1.5,
            paddingTop: () => 1,
            paddingBottom: () => 1,
          },
        },
        {
          columns: [
            { width: "*", text: "" },
            {
              width: 175,
              stack: [
                { text: "İmza", alignment: "center", color: "#64748b", fontSize: 8, margin: [0, 22, 0, 22] },
                { text: principalName || "", alignment: "center", bold: true, fontSize: 10 },
                { text: "Okul Müdürü", alignment: "center", bold: true, fontSize: 9, margin: [0, 2, 0, 0] },
              ],
            },
          ],
          margin: [0, 8, 0, 0],
        },
      ],
      defaultStyle: { fontSize: 7 },
    }, {
      mode: "download",
      filename: `${plan.examName || "Sorumluluk Sınavı"}-Sınav-Planı.pdf`,
    });
  };

  const drawCanvasText = (
    context: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    options: { fontSize?: number; bold?: boolean; align?: CanvasTextAlign; maxWidth?: number; underline?: boolean } = {},
  ) => {
    const fontSize = options.fontSize || 28;
    context.save();
    context.font = `${options.bold === false ? "400" : "700"} ${fontSize}px "Times New Roman", Times, serif`;
    context.textAlign = options.align || "left";
    context.fillStyle = "#111111";
    if (typeof options.maxWidth === "number" && options.maxWidth > 0) {
      context.fillText(String(value || ""), x, y, options.maxWidth);
    } else {
      context.fillText(String(value || ""), x, y);
    }
    if (options.underline && value) {
      const measured = context.measureText(value).width;
      const left = options.align === "center" ? x - measured / 2 : options.align === "right" ? x - measured : x;
      context.beginPath();
      context.moveTo(left, y + fontSize + 3);
      context.lineTo(left + measured, y + fontSize + 3);
      context.lineWidth = 1.5;
      context.strokeStyle = "#111111";
      context.stroke();
    }
    context.restore();
  };

  const drawWrappedCanvasText = (
    context: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    maxWidth: number,
    options: { fontSize?: number; bold?: boolean; lineHeight?: number; align?: CanvasTextAlign } = {},
  ) => {
    const fontSize = options.fontSize || 28;
    const lineHeight = options.lineHeight || Math.round(fontSize * 1.28);
    context.save();
    context.font = `${options.bold ? "700" : "400"} ${fontSize}px "Times New Roman", Times, serif`;
    context.textAlign = options.align || "left";
    context.fillStyle = "#111111";
    const words = String(value || "").split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    lines.forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
    context.restore();
    return lines.length * lineHeight;
  };

  const downloadCanvasPdf = async (canvas: HTMLCanvasElement, filename: string) => {
    const image = canvas.toDataURL("image/png", 1);
    if (!image || image === "data:," || image.length < 1000) throw new Error("PDF sayfası görüntüsü oluşturulamadı.");
    const { PdfEngine } = await import("../pdf/core/PdfEngine");
    await PdfEngine.generate({
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [0, 0, 0, 0],
      content: [{ image, width: 595.28, height: 841.89 }],
    }, {
      mode: "download",
      filename,
    });
  };

  const formatDocumentDateParts = (slot: ExamDateTime) => {
    const [year = "", month = "", day = ""] = String(slot.date || "").split("-");
    const date = day && month && year ? new Date(Number(year), Number(month) - 1, Number(day)) : null;
    const weekday = date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(date).toLocaleUpperCase("tr-TR")
      : "";
    return {
      year,
      month,
      day,
      dateLabel: day && month && year ? `${day}.${month}.${year}` : "",
      slashDateLabel: day && month && year ? `${day} / ${month} / ${year}` : "",
      weekday,
    };
  };


  const createDesignedDocumentCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1323;
    canvas.height = 1871;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Belge sayfası hazırlanamadı.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = "top";
    return { canvas, context };
  };

  const strokeBox = (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    options: { fill?: string; stroke?: string; lineWidth?: number } = {},
  ) => {
    context.save();
    context.fillStyle = options.fill || "#ffffff";
    context.strokeStyle = options.stroke || "#cbd5e1";
    context.lineWidth = options.lineWidth || 2;
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
    context.restore();
  };

  const drawRule = (context: CanvasRenderingContext2D, x1: number, y: number, x2: number, color = "#cbd5e1", lineWidth = 2) => {
    context.save();
    context.beginPath();
    context.moveTo(x1, y);
    context.lineTo(x2, y);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();
  };

  const drawDesignedHeader = (
    context: CanvasRenderingContext2D,
    plan: ResponsibilityExamPlan,
    title: string,
    accent = "#4f46e5",
  ) => {
    const academicYear = String(plan.academicYear || automaticAcademicYear);
    const periodLabel = buildPeriodLabel(plan.periodName).toLocaleUpperCase("tr-TR");
    context.save();
    context.fillStyle = accent;
    context.fillRect(0, 0, 22, 1871);
    context.fillStyle = "#f8fafc";
    context.fillRect(22, 0, 1301, 260);
    context.fillStyle = accent;
    context.fillRect(70, 62, 14, 142);
    context.restore();
    drawCanvasText(context, schoolName.toLocaleUpperCase("tr-TR"), 112, 66, { fontSize: 34, bold: true });
    drawCanvasText(context, `${academicYear} EĞİTİM ÖĞRETİM YILI`, 112, 112, { fontSize: 27, bold: true });
    drawCanvasText(context, `${periodLabel} DÖNEMİ SORUMLULUK SINAVLARI`, 112, 151, { fontSize: 27, bold: true });
    drawCanvasText(context, title, 112, 202, { fontSize: 38, bold: true });
    drawRule(context, 70, 260, 1245, accent, 4);
  };


  const drawCenteredDocumentHeader = (
    context: CanvasRenderingContext2D,
    plan: ResponsibilityExamPlan,
    title: string,
  ) => {
    const academicYear = String(plan.academicYear || automaticAcademicYear);
    const rawPeriod = String(plan.periodName || "").trim();
    const periodTitle = rawPeriod
      ? rawPeriod.toLocaleLowerCase("tr-TR").replace(/(^|\s)([a-zçğıöşü])/g, (_match, space, letter) => `${space}${letter.toLocaleUpperCase("tr-TR")}`)
      : "";
    const centerX = 1323 / 2;
    drawCanvasText(context, schoolName.toLocaleUpperCase("tr-TR"), centerX, 54, { fontSize: 32, bold: true, align: "center", maxWidth: 1160 });
    drawCanvasText(
      context,
      `${academicYear} Eğitim Öğretim Yılı ${periodTitle} Dönemi Sorumluluk Sınavı`,
      centerX,
      103,
      { fontSize: 26, bold: true, align: "center", maxWidth: 1180 },
    );
    drawCanvasText(context, title, centerX, 149, { fontSize: 36, bold: true, align: "center", maxWidth: 1100 });
  };

  const drawOpenCommissionSignature = (
    context: CanvasRenderingContext2D,
    plan: ResponsibilityExamPlan,
    record: ResponsibilityExamRecord,
    y: number,
    accent = "#4f46e5",
    options: { topRule?: boolean; title?: string; ruleY?: number; contentOffsetY?: number; signatureDate?: string } = {},
  ) => {
    const principalName = teachers.find((teacher) => teacher.id === plan.principalTeacherId)?.name || schoolPrincipalName || "................................";
    const commissionNames = (record.commissionTeacherIds || [])
      .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId)?.name)
      .filter(Boolean)
      .slice(0, 2) as string[];
    const contentY = y + (options.contentOffsetY || 0);
    if (options.topRule !== false) drawRule(context, 78, options.ruleY ?? y - 24, 1245, accent, 3);
    drawCanvasText(context, options.title || "SINAV KOMİSYONU", 661, contentY, { fontSize: 20, bold: true, align: "center" });
    const columns = [272, 661, 1050];
    const names = [commissionNames[0] || "................................", commissionNames[1] || "................................", principalName];
    const roles = ["Komisyon Üyesi", "Komisyon Üyesi", "Okul Müdürü"];
    names.forEach((name, index) => {
      if (index === 2 && options.signatureDate) {
        drawCanvasText(context, options.signatureDate, columns[index], contentY + 18, { fontSize: 17, bold: true, align: "center", maxWidth: 280 });
      }
      drawCanvasText(context, name, columns[index], contentY + 46, { fontSize: 21, bold: true, align: "center", maxWidth: 300 });
      drawCanvasText(context, roles[index], columns[index], contentY + 80, { fontSize: 18, bold: false, align: "center", maxWidth: 280 });
    });
  };

  const drawLabelValue = (
    context: CanvasRenderingContext2D,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    options: { labelWidth?: number; height?: number; accent?: string; valueFontSize?: number } = {},
  ) => {
    const height = options.height || 72;
    const labelWidth = options.labelWidth || Math.round(width * 0.36);
    const accent = options.accent || "#4f46e5";
    strokeBox(context, x, y, width, height, { stroke: "#cbd5e1", fill: "#ffffff", lineWidth: 2 });
    context.save();
    context.fillStyle = "#f8fafc";
    context.fillRect(x, y, labelWidth, height);
    context.fillStyle = accent;
    context.fillRect(x, y, 6, height);
    context.restore();
    drawCanvasText(context, label, x + 22, y + 21, { fontSize: 21, bold: true, maxWidth: labelWidth - 36 });
    drawCanvasText(context, value || "", x + labelWidth + 20, y + 20, { fontSize: options.valueFontSize || 23, bold: true, maxWidth: width - labelWidth - 35 });
  };

  const drawCommissionSignature = (
    context: CanvasRenderingContext2D,
    plan: ResponsibilityExamPlan,
    record: ResponsibilityExamRecord,
    y: number,
    accent = "#4f46e5",
  ) => {
    const principalName = teachers.find((teacher) => teacher.id === plan.principalTeacherId)?.name || schoolPrincipalName;
    const commissionNames = (record.commissionTeacherIds || [])
      .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId)?.name)
      .filter(Boolean)
      .slice(0, 2) as string[];
    strokeBox(context, 78, y, 1167, 168, { fill: "#f8fafc", stroke: "#cbd5e1" });
    context.save();
    context.fillStyle = accent;
    context.fillRect(78, y, 1167, 7);
    context.restore();
    drawCanvasText(context, "SINAV KOMİSYONU", 661, y + 22, { fontSize: 22, bold: true, align: "center" });
    const columns = [272, 661, 1050];
    const names = [commissionNames[0] || "................................", commissionNames[1] || "................................", principalName || "................................"];
    const roles = ["Komisyon Üyesi", "Komisyon Üyesi", "Okul Müdürü"];
    names.forEach((name, index) => {
      drawCanvasText(context, name, columns[index], y + 69, { fontSize: 22, bold: true, align: "center", maxWidth: 300 });
      drawCanvasText(context, roles[index], columns[index], y + 106, { fontSize: 19, bold: false, align: "center", maxWidth: 280 });
    });
  };

  const createExamUnitMinutesCanvas = (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const academicYear = String(plan.academicYear || automaticAcademicYear);
    const periodLabel = buildPeriodLabel(plan.periodName).toLocaleUpperCase("tr-TR");
    const courseLabel = (record.examName || `${record.level} ${record.subjectName}`).toLocaleUpperCase("tr-TR");
    const { dateLabel, weekday } = formatDocumentDateParts(slot);
    const { canvas, context } = createDesignedDocumentCanvas();
    const accent = "#0f766e";
    drawCenteredDocumentHeader(context, plan, "SINAV SORU / ÜNİTE TUTANAĞI");

    // Bilgi tabloları ve soru/ünite çizelgesi yaklaşık 1 cm yukarı taşındı.
    drawLabelValue(context, "DERS / SEVİYE", courseLabel, 78, 237, 575, { accent, labelWidth: 205 });
    drawLabelValue(context, "SINAV TARİHİ", `${dateLabel} ${weekday}`, 670, 237, 575, { accent, labelWidth: 205, valueFontSize: 21 });
    drawLabelValue(context, "SINAV SAATİ", String(slot.time || ""), 78, 323, 575, { accent, labelWidth: 205 });
    drawLabelValue(context, "SINAVIN ŞEKLİ", "YAZILI", 670, 323, 575, { accent, labelWidth: 205 });
    drawLabelValue(context, "ÖĞRETİM YILI", academicYear, 78, 409, 575, { accent, labelWidth: 205 });
    drawLabelValue(context, "SINAV DÖNEMİ", `${periodLabel} DÖNEMİ`, 670, 409, 575, { accent, labelWidth: 205 });

    strokeBox(context, 78, 512, 1167, 178, { fill: "#f0fdfa", stroke: "#99f6e4" });
    drawCanvasText(context, "TUTANAK AÇIKLAMASI", 105, 537, { fontSize: 21, bold: true });
    const explanation = "Sınav komisyonu, dersin öğretim programı ve tamamlanan konuları dikkate alarak sınavda kullanılacak soru dağılımını görüşmüş; ünite/konu başlıkları, soru sayıları ve puan değerlerinin aşağıdaki çizelgeye işlenmesine karar vermiştir.";
    drawWrappedCanvasText(context, explanation, 105, 579, 1105, { fontSize: 21, lineHeight: 29, bold: false });

    const tableX = 78;
    const tableY = 727;
    const tableW = 1167;
    const rowH = 64;
    const col1 = 650;
    const col2 = 235;
    const col3 = tableW - col1 - col2;
    strokeBox(context, tableX, tableY, tableW, rowH, { fill: accent, stroke: accent });
    context.save();
    context.fillStyle = "#ffffff";
    context.font = '700 21px "Times New Roman", Times, serif';
    context.fillText("ÜNİTE / KONU ADI", tableX + 20, tableY + 19);
    context.textAlign = "center";
    context.fillText("SORU SAYISI", tableX + col1 + col2 / 2, tableY + 19);
    context.fillText("PUAN DEĞERİ", tableX + col1 + col2 + col3 / 2, tableY + 19);
    context.restore();
    for (let index = 0; index < 10; index += 1) {
      const y = tableY + rowH + index * rowH;
      strokeBox(context, tableX, y, tableW, rowH, { fill: index % 2 === 0 ? "#ffffff" : "#f8fafc", stroke: "#cbd5e1", lineWidth: 1.5 });
      drawCanvasText(context, `${index + 1}.`, tableX + 18, y + 19, { fontSize: 20, bold: true });
    }
    context.save();
    context.strokeStyle = "#cbd5e1";
    context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(tableX + col1, tableY); context.lineTo(tableX + col1, tableY + rowH * 11); context.stroke();
    context.beginPath(); context.moveTo(tableX + col1 + col2, tableY); context.lineTo(tableX + col1 + col2, tableY + rowH * 11); context.stroke();
    context.restore();

    // Tarih sol taraftan kaldırıldı; yalnızca okul müdürünün adının üstünde gösterilir.
    // Sadece üst ayraç çizgisi 1 cm yukarı alındı; komisyon üyeleri mevcut yerinde kaldı.
    drawOpenCommissionSignature(context, plan, record, 1602, accent, { topRule: true, ruleY: 1515, signatureDate: dateLabel || ".... / .... / ........" });
    return canvas;
  };

  const downloadExamUnitMinutesPdf = async (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const documentKey = `${plan.id}:${record.id}:unit-minutes`;
    if (generatingDocumentKey) return;
    setGeneratingDocumentKey(documentKey);
    try {
      const canvas = createExamUnitMinutesCanvas(plan, record, slot);
      await downloadCanvasPdf(canvas, `${record.examName || `${record.level}-${record.subjectName}`}-Sınav-Soru-Unite-Tutanagi.pdf`);
    } catch (error) {
      console.error("Sınav soru ünite tutanağı PDF oluşturulamadı", error);
      window.alert("Sınav soru ünite tutanağı PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setGeneratingDocumentKey("");
    }
  };

  const createExamMinutesCanvas = (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const academicYear = String(plan.academicYear || automaticAcademicYear);
    const rawPeriod = String(plan.periodName || "").trim();
    const periodTitle = rawPeriod
      ? rawPeriod.toLocaleLowerCase("tr-TR").replace(/(^|\s)([a-zçğıöşü])/g, (_match, space, letter) => `${space}${letter.toLocaleUpperCase("tr-TR")}`)
      : "";
    const courseLabel = (record.examName || `${record.level} ${record.subjectName}`).toLocaleUpperCase("tr-TR");
    const { dateLabel, weekday } = formatDocumentDateParts(slot);
    const { canvas, context } = createDesignedDocumentCanvas();
    const accent = "#1d4ed8";
    const pageCenter = canvas.width / 2;

    // Bu belge için başlık, diğer dokümanlardan bağımsız olarak daha klasik ve merkezli tutulur.
    drawCanvasText(context, schoolName.toLocaleUpperCase("tr-TR"), pageCenter, 54, { fontSize: 32, bold: true, align: "center", maxWidth: 1160 });
    drawCanvasText(
      context,
      `${academicYear} Eğitim Öğretim Yılı ${periodTitle} Dönemi Sorumluluk Sınavı`,
      pageCenter,
      103,
      { fontSize: 26, bold: true, align: "center", maxWidth: 1180 },
    );
    drawCanvasText(context, "SINAV TUTANAĞI", pageCenter, 149, { fontSize: 36, bold: true, align: "center", maxWidth: 1100 });

    // Sınavın tanımı: önceki tasarıma göre daha kısa ve sıkı.
    const infoX = 78;
    const infoY = 224;
    const infoW = 1167;
    const infoTitleH = 36;
    const infoValueH = 80;
    strokeBox(context, infoX, infoY, infoW, infoTitleH + infoValueH, { fill: "#ffffff", stroke: "#cbd5e1", lineWidth: 1.5 });
    context.save(); context.fillStyle = "#eff6ff"; context.fillRect(infoX, infoY, infoW, infoTitleH); context.restore();
    drawCanvasText(context, "SINAVIN TANIMI", pageCenter, infoY + 8, { fontSize: 20, bold: true, align: "center" });
    const infoCols = [78, 335, 563, 905, 1245];
    const infoLabels = ["ÖĞRETİM YILI", "SINAV DÖNEMİ", "DERS / SEVİYE", "TARİH / SAAT"];
    const infoValues = [academicYear, `${periodTitle.toLocaleUpperCase("tr-TR")} DÖNEMİ`, courseLabel, `${dateLabel} ${slot.time || ""}`];
    for (let i = 0; i < 4; i += 1) {
      const x = infoCols[i];
      const w = infoCols[i + 1] - infoCols[i];
      if (i > 0) {
        context.save(); context.beginPath(); context.moveTo(x, infoY + infoTitleH); context.lineTo(x, infoY + infoTitleH + infoValueH); context.strokeStyle = "#cbd5e1"; context.lineWidth = 1.3; context.stroke(); context.restore();
      }
      drawCanvasText(context, infoLabels[i], x + w / 2, infoY + infoTitleH + 8, { fontSize: 15, bold: true, align: "center", maxWidth: w - 18 });
      drawWrappedCanvasText(context, infoValues[i], x + w / 2, infoY + infoTitleH + 36, w - 22, { fontSize: 18, lineHeight: 21, bold: true, align: "center" });
    }

    // Sınav hazırlığı alanı sınav tanımına yaklaştırıldı.
    const prepY = 360;
    const prepH = 188;
    strokeBox(context, 78, prepY, 1167, prepH, { fill: "#ffffff", stroke: "#cbd5e1", lineWidth: 1.5 });
    context.save(); context.fillStyle = "#f8fafc"; context.fillRect(78, prepY, 250, prepH); context.restore();
    drawCanvasText(context, "SINAV HAZIRLIĞI", 104, prepY + 22, { fontSize: 21, bold: true });
    drawCanvasText(context, "Komisyonun toplandığı saat", 360, prepY + 20, { fontSize: 18, bold: true });
    drawCanvasText(context, "................................", 1105, prepY + 20, { fontSize: 19, bold: false, align: "center" });
    drawRule(context, 328, prepY + 59, 1245, "#e2e8f0", 1.2);
    drawWrappedCanvasText(context, "Soruların ve cevapların hazırlanarak sınava başlama durumuna gelindiği saat", 360, prepY + 72, 560, { fontSize: 17, lineHeight: 22, bold: true });
    drawCanvasText(context, "................................", 1105, prepY + 83, { fontSize: 19, bold: false, align: "center" });
    drawRule(context, 328, prepY + 126, 1245, "#e2e8f0", 1.2);
    drawWrappedCanvasText(context, "Sınav komisyonu sınav soruları ve cevap anahtarını hazırlamış, gerekli kontrol ve onay işlemlerini tamamlamıştır.", 360, prepY + 139, 840, { fontSize: 17, lineHeight: 22, bold: false });

    const principalName = teachers.find((teacher) => teacher.id === plan.principalTeacherId)?.name || schoolPrincipalName || "................................";
    const commissionNames = (record.commissionTeacherIds || [])
      .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId)?.name)
      .filter(Boolean)
      .slice(0, 2) as string[];

    const drawOpenSignatureBlock = (y: number, options: { showDate?: boolean; bottomRule?: boolean; bottomRuleOffset?: number } = {}) => {
      const columns = [310, 670, 1055];
      const names = [commissionNames[0] || "................................", commissionNames[1] || "................................", principalName];
      const roles = ["Komisyon Üyesi", "Komisyon Üyesi", "Okul Müdürü"];
      drawCanvasText(context, "SINAV KOMİSYONU", 670, y + 5, { fontSize: 18, bold: true, align: "center" });
      names.forEach((name, index) => {
        if (index === 2 && options.showDate !== false) {
          drawCanvasText(context, dateLabel || ".... / .... / ........", columns[index], y + 22, { fontSize: 16, bold: true, align: "center", maxWidth: 260 });
        }
        drawCanvasText(context, name, columns[index], y + 48, { fontSize: 19, bold: true, align: "center", maxWidth: 275 });
        drawCanvasText(context, roles[index], columns[index], y + 78, { fontSize: 16, bold: false, align: "center", maxWidth: 260 });
      });
      if (options.bottomRule !== false) drawRule(context, 78, y + (options.bottomRuleOffset ?? 137), 1245, accent, 3);
    };

    // Mavi çizgi tarih/gün satırından kaldırıldı; imza bloğunun altına alındı.
    drawOpenSignatureBlock(566, { showDate: true, bottomRule: true, bottomRuleOffset: 169 });

    const partY = 750;
    const partH = 270;
    strokeBox(context, 78, partY, 1167, partH, { fill: "#ffffff", stroke: "#cbd5e1", lineWidth: 1.5 });
    context.save(); context.fillStyle = "#f8fafc"; context.fillRect(78, partY, 292, partH); context.restore();
    drawWrappedCanvasText(context, "SINAVA BAŞLAMA, KATILMA VE SINAV NOTU", 104, partY + 23, 235, { fontSize: 20, lineHeight: 27, bold: true });
    const participationRows = [
      ["Sınavın başladığı saat", String(slot.time || "")],
      ["Sınava katılan öğrenci sayısı", ""],
      ["Sınava katılmayan öğrenci sayısı", ""],
      ["Toplam öğrenci sayısı", String(record.studentIds?.length || 0)],
      ["Kullanılan sınav kâğıdı sayısı", ""],
      ["Sınavın sona erdiği saat", ""],
      ["Birinci incelemenin yapılacağı tarih / saat", ""],
    ];
    const pRowH = partH / participationRows.length;
    participationRows.forEach((row, index) => {
      const y = partY + index * pRowH;
      if (index > 0) drawRule(context, 370, y, 1245, "#e2e8f0", 1.1);
      drawCanvasText(context, row[0], 395, y + 10, { fontSize: 17, bold: true, maxWidth: 590 });
      drawCanvasText(context, row[1], 1122, y + 9, { fontSize: 19, bold: true, align: "center", maxWidth: 210 });
    });
    context.save(); context.beginPath(); context.moveTo(1000, partY); context.lineTo(1000, partY + partH); context.strokeStyle = "#cbd5e1"; context.lineWidth = 1.4; context.stroke(); context.restore();

    // Açıklama tabloya yaklaştırıldı.
    const statementY = 1033;
    drawWrappedCanvasText(context, "Sınav ilgili yönetmelik hükümlerine uygun olarak yapılmış. Sınav evrakı inceleme ve arşiv işlemleri için okul müdürlüğüne teslim edilmiştir.", 94, statementY, 1135, { fontSize: 17, lineHeight: 22, bold: false });

    // Aynı komisyon + okul müdürü imza bloğu tekrarlandı ve çizgi altına alındı.
    drawOpenSignatureBlock(1090, { showDate: true, bottomRule: true, bottomRuleOffset: 169 });

    const reviewY = 1275;
    const reviewH = 170;
    strokeBox(context, 78, reviewY, 1167, reviewH, { fill: "#ffffff", stroke: "#cbd5e1", lineWidth: 1.5 });
    context.save(); context.fillStyle = "#f8fafc"; context.fillRect(78, reviewY, 292, reviewH); context.restore();
    drawCanvasText(context, "İNCELEME", 104, reviewY + 22, { fontSize: 21, bold: true });
    const reviewRows = [
      "İncelemenin yapıldığı tarih / saat",
      "İncelemede başarılı olan öğrenci sayısı",
      "İncelemede başarısız olan öğrenci sayısı",
      "Toplam",
    ];
    const reviewRowH = reviewH / reviewRows.length;
    reviewRows.forEach((label, index) => {
      const y = reviewY + index * reviewRowH;
      if (index > 0) drawRule(context, 370, y, 1245, "#e2e8f0", 1.1);
      drawCanvasText(context, label, 395, y + 11, { fontSize: 17, bold: true, maxWidth: 590 });
    });
    context.save(); context.beginPath(); context.moveTo(1000, reviewY); context.lineTo(1000, reviewY + reviewH); context.strokeStyle = "#cbd5e1"; context.lineWidth = 1.4; context.stroke(); context.restore();

    // İnceleme alanından sonra mavi ayraç yok; tamamlanma cümlesi ve son imzalar var.
    drawCanvasText(context, "İnceleme tamamlanmıştır.", 92, 1460, { fontSize: 18, bold: false });
    drawOpenSignatureBlock(1595, { showDate: true, bottomRule: false });

    // Son içerik yaklaşık 1 cm alt kenar boşluğu bırakacak şekilde bitirilir.
    return canvas;
  };

  const downloadExamMinutesPdf = async (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const documentKey = `${plan.id}:${record.id}:exam-minutes`;
    if (generatingDocumentKey) return;
    setGeneratingDocumentKey(documentKey);
    try {
      const canvas = createExamMinutesCanvas(plan, record, slot);
      await downloadCanvasPdf(canvas, `${record.examName || `${record.level}-${record.subjectName}`}-Sınav-Tutanagi.pdf`);
    } catch (error) {
      console.error("Sınav tutanağı PDF oluşturulamadı", error);
      window.alert("Sınav tutanağı PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setGeneratingDocumentKey("");
    }
  };

  const createEokulReferenceCanvas = () => {
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = 595 * scale;
    canvas.height = 841 * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("e-Okul belge sayfası hazırlanamadı.");
    context.scale(scale, scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 595, 841);
    context.textBaseline = "top";
    return { canvas, context };
  };

  const drawEokulText = (
    context: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    options: { fontSize?: number; bold?: boolean; align?: CanvasTextAlign; maxWidth?: number } = {},
  ) => {
    context.save();
    const fontSize = options.fontSize || 6.6;
    context.font = `${options.bold ? "700" : "400"} ${fontSize}px Tahoma, Arial, sans-serif`;
    context.textAlign = options.align || "left";
    context.fillStyle = "#000000";
    const text = String(value || "");
    if (options.maxWidth) context.fillText(text, x, y, options.maxWidth);
    else context.fillText(text, x, y);
    context.restore();
  };

  const drawEokulLine = (
    context: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    lineWidth = 1,
  ) => {
    context.save();
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = "#000000";
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();
  };

  const drawEokulRect = (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    lineWidth = 1,
  ) => {
    context.save();
    context.strokeStyle = "#000000";
    context.lineWidth = lineWidth;
    context.strokeRect(x, y, width, height);
    context.restore();
  };

  const formatEokulClassroom = (student: Student) => {
    const raw = String(student.classroom || "").trim();
    if (!raw) return "";
    const compact = raw.replace(/\s+/g, " ");
    const direct = compact.match(/^(9|10|11|12)\s*[-./]?\s*([A-ZÇĞİÖŞÜ])\b/i);
    if (direct) return `AL - ${direct[1]}. Sınıf / ${direct[2].toLocaleUpperCase("tr-TR")} Şubesi`;
    const level = getLevelFromText(compact);
    const branch = compact.match(/(?:şube(?:si)?\s*[:/-]?\s*|\b(?:9|10|11|12)\s*)\(?([A-ZÇĞİÖŞÜ])\)?/i)?.[1];
    if (level && branch) return `AL - ${level}. Sınıf / ${branch.toLocaleUpperCase("tr-TR")} Şubesi`;
    if (level) return `AL - ${level}. Sınıf / ${compact.replace(level, "").replace(/[^A-ZÇĞİÖŞÜ]/gi, "").slice(0, 1).toLocaleUpperCase("tr-TR") || "-"} Şubesi`;
    return compact;
  };

  const drawEokulMark = (context: CanvasRenderingContext2D, reportCode: string, logoImage?: HTMLImageElement | null) => {
    context.save();
    if (logoImage) {
      context.drawImage(logoImage, 18, 765, 112, 61);
    } else {
      context.fillStyle = "#0891b2";
      context.font = '700 14px Tahoma, Arial, sans-serif';
      context.fillText("e-Okul", 28, 786);
    }
    context.fillStyle = "#64748b";
    context.font = '400 6.3px Arial, sans-serif';
    context.fillText(reportCode, 47, 817);
    context.restore();
  };

  const getExamStudents = (record: ResponsibilityExamRecord) =>
    (record.studentIds || []).map((studentId) => students.find((student) => student.id === studentId)).filter(Boolean) as Student[];

  const getExamCommissionTeachers = (record: ResponsibilityExamRecord) =>
    (record.commissionTeacherIds || []).map((teacherId) => teachers.find((teacher) => teacher.id === teacherId)).filter(Boolean) as Teacher[];

  const createExamGradeSheetCanvas = (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime, eOkulLogoImage?: HTMLImageElement | null) => {
    const { canvas, context } = createEokulReferenceCanvas();
    const examStudents = getExamStudents(record);
    const commissionTeachers = getExamCommissionTeachers(record).slice(0, 4);
    const principalName = teachers.find((teacher) => teacher.id === plan.principalTeacherId)?.name || schoolPrincipalName;
    const academicYear = String(plan.academicYear || automaticAcademicYear);
    const courseLabel = `${String(record.subjectName || "").toLocaleUpperCase("tr-TR")} (${record.level}. Sınıf)`;
    const { day, month, year } = formatDocumentDateParts(slot);
    const examDate = day && month && year ? `${day}/${month}/${year}` : "____/____/___________";

    drawEokulText(context, "SORUMLULUK SINAVI NOT ÇİZELGESİ", 297.5, 41.85, { fontSize: 7.45, bold: true, align: "center" });
    drawEokulText(context, "Okul Adı", 28.5, 68.95, { bold: true });
    drawEokulText(context, ":", 90, 68.95, { bold: true });
    drawEokulText(context, schoolName.toLocaleUpperCase("tr-TR"), 94.35, 68.95);
    drawEokulText(context, "Öğretim Yılı", 28.5, 97.45, { bold: true });
    drawEokulText(context, ":", 90, 97.45, { bold: true });
    drawEokulText(context, academicYear, 94.35, 97.45);
    drawEokulText(context, "Dersin Adı", 28.5, 109.7, { bold: true });
    drawEokulText(context, ":", 90.75, 109.7, { bold: true });
    drawEokulText(context, courseLabel, 95.1, 109.7, { maxWidth: 330 });
    drawEokulText(context, "Sınav Tarihi", 28.5, 125.2, { bold: true });
    drawEokulText(context, ":", 90.75, 125.2, { bold: true });
    drawEokulText(context, examDate, 95.1, 125.2);
    drawEokulText(context, "Sayfa: 1", 519.75, 125.2, { bold: true });

    const left = 29;
    const right = 559;
    const top = 137.55;
    const firstHeaderBottom = 154.3;
    const headerBottom = 167.55;
    const rowHeight = 12.75;
    const rowCount = Math.max(1, examStudents.length);
    const bottom = headerBottom + rowCount * rowHeight;
    drawEokulRect(context, left, top, right - left, bottom - top, 1);
    [50, 139.75, 178.25].forEach((x) => drawEokulLine(context, x, firstHeaderBottom, x, bottom, 1));
    drawEokulLine(context, 362, top, 362, bottom, 1);
    drawEokulLine(context, 389, firstHeaderBottom, 389, bottom, 1);
    drawEokulLine(context, 421.25, firstHeaderBottom, 421.25, bottom, 1);
    drawEokulLine(context, 460.75, top, 460.75, bottom, 1);
    drawEokulLine(context, left, firstHeaderBottom, 460.75, firstHeaderBottom, 1);
    drawEokulLine(context, left, headerBottom, right, headerBottom, 1);
    for (let index = 1; index <= rowCount; index += 1) drawEokulLine(context, left, headerBottom + index * rowHeight, right, headerBottom + index * rowHeight, 1);

    drawEokulText(context, "Ö Ğ R E N C İ N İ N", 195.5, 141.75, { fontSize: 5.8, bold: true, align: "center" });
    drawEokulText(context, "A L D I Ğ I", 411.4, 142.5, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "AÇIKLAMA", 510, 149.2, { bold: true, align: "center" });
    drawEokulText(context, "Sıra", 39.5, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Sınıf /Şube", 94.9, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Öğr. No", 159, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Adı Soyadı", 270.1, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Puanı", 375.5, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Notu", 405.1, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Yazıyla", 441, 158, { fontSize: 5.8, align: "center" });

    examStudents.forEach((student, index) => {
      const y = headerBottom + index * rowHeight + 3.2;
      drawEokulText(context, String(index + 1), 39.5, y, { fontSize: 5.8, align: "center" });
      drawEokulText(context, formatEokulClassroom(student), 52.5, y, { fontSize: 5.8, maxWidth: 84.5 });
      drawEokulText(context, String(student.number || student.studentNumber || ""), 176, y, { fontSize: 5.8, align: "right", maxWidth: 33 });
      drawEokulText(context, String(student.name || "").toLocaleUpperCase("tr-TR"), 181.5, y, { fontSize: 5.8, maxWidth: 176 });
    });

    drawEokulText(context, "Komisyon Üyeleri                         :", 29.25, 707.65);
    drawEokulLine(context, 29.25, 715, 135, 715, 0.4);
    const memberXs = [30.75, 130, 228.25, 329.5];
    memberXs.forEach((x, index) => {
      const teacherName = commissionTeachers[index]?.name || "";
      drawEokulText(context, teacherName ? `Üye : ${teacherName}` : "Üye                         :", x, 726.4, { maxWidth: 92 });
      drawEokulLine(context, x, 734, x + 64.7, 734, 0.4);
    });
    drawEokulText(context, examDate, 496, 726.4, { align: "center", maxWidth: 115 });
    if (principalName) drawEokulText(context, principalName, 496, 742.2, { bold: true, align: "center", maxWidth: 115 });
    drawEokulText(context, "Okul Müdürü", 496, 755.65, { align: "center", maxWidth: 115 });
    drawEokulText(context, examDate, 127.5, 775.65);
    drawEokulMark(context, "OOK12001R014", eOkulLogoImage);
    return canvas;
  };

  const downloadExamGradeSheetPdf = async (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const documentKey = `${plan.id}:${record.id}:grade-sheet`;
    if (generatingDocumentKey) return;
    setGeneratingDocumentKey(documentKey);
    try {
      const eOkulLogoImage = await loadEOkulLogoImage();
      const canvas = createExamGradeSheetCanvas(plan, record, slot, eOkulLogoImage);
      await downloadCanvasPdf(canvas, `${record.examName || `${record.level}-${record.subjectName}`}-Sınav-Not-Çizelgesi.pdf`);
    } catch (error) {
      console.error("Sınav not çizelgesi PDF oluşturulamadı", error);
      window.alert("Sınav not çizelgesi PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setGeneratingDocumentKey("");
    }
  };

  const createExamPaperUsageCanvas = (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime, eOkulLogoImage?: HTMLImageElement | null) => {
    const { canvas, context } = createEokulReferenceCanvas();
    const examStudents = getExamStudents(record);
    const principalName = teachers.find((teacher) => teacher.id === plan.principalTeacherId)?.name || schoolPrincipalName;
    const academicYear = String(plan.academicYear || automaticAcademicYear);
    const courseLabel = `${String(record.subjectName || "").toLocaleUpperCase("tr-TR")} (${record.level}. Sınıf)`;
    const { day, month, year } = formatDocumentDateParts(slot);
    const examDate = day && month && year ? `${day}/${month}/${year}` : "____/____/___________";
    const invigilatorNames = ((plan.slotInvigilatorTeacherIds || {})[slot.id] || [])
      .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId)?.name)
      .filter(Boolean) as string[];

    drawEokulText(context, "SORUMLULUK SINAVI KAĞIT SARF TUTANAĞI", 297.5, 41.85, { fontSize: 7.45, bold: true, align: "center" });
    drawEokulText(context, "Okul Adı", 28.5, 68.95, { bold: true });
    drawEokulText(context, ":", 90, 68.95, { bold: true });
    drawEokulText(context, schoolName.toLocaleUpperCase("tr-TR"), 94.35, 68.95);
    drawEokulText(context, "Öğretim Yılı", 28.5, 95.2, { bold: true });
    drawEokulText(context, ":", 90, 95.2, { bold: true });
    drawEokulText(context, academicYear, 94.35, 95.2);
    drawEokulText(context, "Dersin Adı", 28.5, 109.7, { bold: true });
    drawEokulText(context, ":", 90.75, 109.7, { bold: true });
    drawEokulText(context, courseLabel, 95.1, 109.7, { maxWidth: 330 });
    drawEokulText(context, "Sınav Tarihi", 28.5, 125.2, { bold: true });
    drawEokulText(context, ":", 90.75, 125.2, { bold: true });
    drawEokulText(context, examDate, 95.1, 125.2);
    drawEokulText(context, "Sayfa: 1", 519.75, 125.2, { bold: true });

    const left = 29;
    const right = 559;
    const top = 137.55;
    const firstHeaderBottom = 154.3;
    const headerBottom = 167.55;
    const rowHeight = 12.75;
    const rowCount = Math.max(1, examStudents.length);
    const bottom = headerBottom + rowCount * rowHeight;
    drawEokulRect(context, left, top, right - left, bottom - top, 1);
    [50, 139.75, 178.25].forEach((x) => drawEokulLine(context, x, firstHeaderBottom, x, bottom, 1));
    drawEokulLine(context, 362, top, 362, bottom, 1);
    drawEokulLine(context, 400, firstHeaderBottom, 400, bottom, 1);
    drawEokulLine(context, 479.75, top, 479.75, bottom, 1);
    drawEokulLine(context, left, firstHeaderBottom, 479.75, firstHeaderBottom, 1);
    drawEokulLine(context, left, headerBottom, right, headerBottom, 1);
    for (let index = 1; index <= rowCount; index += 1) drawEokulLine(context, left, headerBottom + index * rowHeight, right, headerBottom + index * rowHeight, 1);

    drawEokulText(context, "Ö Ğ R E N C İ N İ N", 195.5, 141.75, { fontSize: 5.8, bold: true, align: "center" });
    drawEokulText(context, "Sınavda Kullanılan Kağıt Sayısı", 421, 142.5, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "İMZA", 519.4, 149.2, { bold: true, align: "center" });
    drawEokulText(context, "Sıra", 39.5, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Sınıf /Şube", 94.9, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Öğr. No", 159, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Adı Soyadı", 270.1, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Rakamla", 381, 158, { fontSize: 5.8, align: "center" });
    drawEokulText(context, "Yazıyla", 440, 158, { fontSize: 5.8, align: "center" });

    examStudents.forEach((student, index) => {
      const y = headerBottom + index * rowHeight + 3.2;
      drawEokulText(context, String(index + 1), 39.5, y, { fontSize: 5.8, align: "center" });
      drawEokulText(context, formatEokulClassroom(student), 52.5, y, { fontSize: 5.8, maxWidth: 84.5 });
      drawEokulText(context, String(student.number || student.studentNumber || ""), 176, y, { fontSize: 5.8, align: "right", maxWidth: 33 });
      drawEokulText(context, String(student.name || "").toLocaleUpperCase("tr-TR"), 181.5, y, { fontSize: 5.8, maxWidth: 176 });
    });

    drawEokulText(context, "Yapılan sınava .......(.....................................) öğrenci katılmış ve ...... (....................................) adet kağıt teslim alınmıştır.", 29.25, 707.65, { maxWidth: 380 });
    const invigilatorText = invigilatorNames.length ? invigilatorNames.join(", ") : "........................................................";
    drawEokulText(context, `GÖZETMENLER : ${invigilatorText}`, 144, 731.65, { maxWidth: 250 });
    drawEokulLine(context, 144, 739, 250.4, 739, 0.4);
    drawEokulText(context, examDate, 456.5, 731.65, { align: "center", maxWidth: 130 });
    if (principalName) drawEokulText(context, principalName, 456.5, 747.5, { bold: true, align: "center", maxWidth: 130 });
    drawEokulText(context, "Okul Müdürü", 456.5, 760.9, { align: "center", maxWidth: 130 });
    drawEokulMark(context, "OOK12001R016", eOkulLogoImage);
    return canvas;
  };

  const downloadExamPaperUsagePdf = async (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const documentKey = `${plan.id}:${record.id}:paper-usage`;
    if (generatingDocumentKey) return;
    setGeneratingDocumentKey(documentKey);
    try {
      const eOkulLogoImage = await loadEOkulLogoImage();
      const canvas = createExamPaperUsageCanvas(plan, record, slot, eOkulLogoImage);
      await downloadCanvasPdf(canvas, `${record.examName || `${record.level}-${record.subjectName}`}-Kağıt-Sarf-Tutanağı.pdf`);
    } catch (error) {
      console.error("Kağıt sarf tutanağı PDF oluşturulamadı", error);
      window.alert("Kağıt sarf tutanağı PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setGeneratingDocumentKey("");
    }
  };

  const createExamEnvelopeCanvas = (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const academicYear = String(plan.academicYear || automaticAcademicYear);
    const periodLabel = buildPeriodLabel(plan.periodName).toLocaleUpperCase("tr-TR");
    const courseLabel = (record.examName || `${record.level} ${record.subjectName}`).toLocaleUpperCase("tr-TR");
    const { dateLabel, weekday } = formatDocumentDateParts(slot);
    const { canvas, context } = createDesignedDocumentCanvas();
    const accent = "#7c3aed";
    drawCenteredDocumentHeader(context, plan, "SINAV EVRAK ZARFI");

    // Ana bilgi alanı yaklaşık 1 cm yukarı alındı.
    drawLabelValue(context, "ÖĞRETİM YILI", academicYear, 78, 237, 575, { accent, labelWidth: 205 });
    drawLabelValue(context, "SINAV DÖNEMİ", `${periodLabel} DÖNEMİ`, 670, 237, 575, { accent, labelWidth: 205 });
    drawLabelValue(context, "SINAV TÜRÜ", "SORUMLULUK SINAVI", 78, 323, 575, { accent, labelWidth: 205, valueFontSize: 21 });
    drawLabelValue(context, "DERS / SEVİYE", courseLabel, 670, 323, 575, { accent, labelWidth: 205, valueFontSize: 21 });
    drawLabelValue(context, "SINAV TARİHİ", `${dateLabel} ${weekday}`, 78, 409, 575, { accent, labelWidth: 205, valueFontSize: 20 });
    drawLabelValue(context, "SINAV SAATİ", String(slot.time || ""), 670, 409, 575, { accent, labelWidth: 205 });
    drawLabelValue(context, "ÖĞRENCİ SAYISI", String(record.studentIds?.length || 0), 78, 495, 575, { accent, labelWidth: 205 });
    drawLabelValue(context, "SINAVIN ŞEKLİ", "YAZILI", 670, 495, 575, { accent, labelWidth: 205 });

    // Alt tablo ana bilgi alanına yaklaştırıldı.
    const postY = 590;
    strokeBox(context, 78, postY, 1167, 660, { fill: "#ffffff", stroke: "#ddd6fe" });
    context.save(); context.fillStyle = "#f5f3ff"; context.fillRect(78, postY, 1167, 62); context.fillStyle = accent; context.fillRect(78, postY, 8, 660); context.restore();
    drawCanvasText(context, "SINAV SONRASI DOLDURULACAK BİLGİLER", 106, postY + 19, { fontSize: 22, bold: true });
    const postExamRows = [
      ["Sınava katılan öğrenci sayısı", ""],
      ["Kullanılan sınav kâğıdı sayısı", ""],
      ["İnceleme tarihi / saati", ""],
      ["Başarılı öğrenci sayısı", ""],
      ["Başarısız öğrenci sayısı", ""],
      ["Evrakın teslim tarihi", ""],
    ];
    const rowStartY = postY + 85;
    const rowHeight = 88;
    postExamRows.forEach(([label, value], index) => {
      const y = rowStartY + index * rowHeight;
      if (index > 0) drawRule(context, 106, y, 1217, "#e2e8f0", 1.5);
      drawCanvasText(context, label, 118, y + 27, { fontSize: 21, bold: true, maxWidth: 630 });
      drawCanvasText(context, value || "........................................................", 960, y + 27, { fontSize: 21, bold: false, align: "center", maxWidth: 360 });
    });

    strokeBox(context, 78, 1280, 1167, 118, { fill: "#ffffff", stroke: "#e2e8f0" });
    drawWrappedCanvasText(context, "Bu zarf; sınav soruları, cevap anahtarı, öğrenci sınav kâğıtları, tutanaklar ve sınava ilişkin diğer evrakın birlikte muhafaza edilmesi amacıyla hazırlanmıştır.", 105, 1308, 1110, { fontSize: 20, lineHeight: 28, bold: false });

    // Mor çizgi yerinde bırakıldı; komisyon başlığı ve imza içeriği 1 cm aşağı alındı.
    drawOpenCommissionSignature(context, plan, record, 1552, accent, { topRule: true, ruleY: 1528, contentOffsetY: 63, signatureDate: dateLabel || ".... / .... / ........" });
    return canvas;
  };

  const downloadExamEnvelopePdf = async (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const documentKey = `${plan.id}:${record.id}:envelope`;
    if (generatingDocumentKey) return;
    setGeneratingDocumentKey(documentKey);
    try {
      const canvas = createExamEnvelopeCanvas(plan, record, slot);
      await downloadCanvasPdf(canvas, `${record.examName || `${record.level}-${record.subjectName}`}-Sınav-Evrak-Zarfı.pdf`);
    } catch (error) {
      console.error("Sınav evrak zarfı PDF oluşturulamadı", error);
      window.alert("Sınav evrak zarfı PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setGeneratingDocumentKey("");
    }
  };

  const createExamDutyCanvas = (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const principalName = teachers.find((teacher) => teacher.id === plan.principalTeacherId)?.name || schoolPrincipalName;
    const commissionTeachers = (record.commissionTeacherIds || [])
      .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId))
      .filter(Boolean) as Teacher[];
    const academicYear = String(plan.academicYear || automaticAcademicYear);
    const periodLabel = buildPeriodLabel(plan.periodName).toLocaleUpperCase("tr-TR");
    const courseLabel = (record.examName || `${record.level} ${record.subjectName}`).toLocaleUpperCase("tr-TR");
    const { dateLabel, weekday } = formatDocumentDateParts(slot);
    const { canvas, context } = createDesignedDocumentCanvas();
    const accent = "#9333ea";
    drawCenteredDocumentHeader(context, plan, "SINAV GÖREV TEBLİĞİ");

    // Görevlendirilen komisyon alanı yaklaşık 1 cm yukarı alındı.
    const commissionBoxY = 237;
    strokeBox(context, 78, commissionBoxY, 1167, 190, { fill: "#faf5ff", stroke: "#e9d5ff" });
    drawCanvasText(context, "GÖREVLENDİRİLEN SINAV KOMİSYONU", 105, commissionBoxY + 26, { fontSize: 22, bold: true });
    const recipientNames = commissionTeachers.length ? commissionTeachers.map((teacher) => teacher.name).join(" - ") : "........................................................";
    drawWrappedCanvasText(context, recipientNames, 105, commissionBoxY + 72, 1090, { fontSize: 28, lineHeight: 35, bold: true });
    const branches = Array.from(new Set(commissionTeachers.map((teacher) => teacher.branch).filter(Boolean))).join(" / ");
    drawCanvasText(context, branches || `${record.subjectName} Öğretmenleri`, 105, commissionBoxY + 138, { fontSize: 20, bold: false, maxWidth: 1090 });

    // Açıklama komisyon alanına yaklaştırıldı.
    const introY = 445;
    strokeBox(context, 78, introY, 1167, 220, { fill: "#ffffff", stroke: "#cbd5e1" });
    context.save(); context.fillStyle = accent; context.fillRect(78, introY, 7, 220); context.restore();
    const dutyParagraph = `${academicYear} Eğitim Öğretim Yılı ${periodLabel} döneminde yapılacak sorumluluk sınavında görevli bulunduğunuz ders, tarih ve saat bilgileri aşağıda belirtilmiştir. Sınav evrakının hazırlanması, sınavın yürütülmesi, değerlendirilmesi ve idareye teslimi ile ilgili görevlerin ilgili mevzuat ve okul uygulamalarına uygun olarak yerine getirilmesi gerekmektedir.`;
    drawWrappedCanvasText(context, dutyParagraph, 108, introY + 28, 1100, { fontSize: 21, lineHeight: 29, bold: false });
    drawCanvasText(context, "Gereğini rica eder, görevinizde başarılar dilerim.", 108, introY + 174, { fontSize: 21, bold: true });

    // Sınav görev bilgileri 4 sütunlu, iki satırlı Excel benzeri tabloya dönüştürüldü.
    const tableX = 78;
    const tableY = 690;
    const tableW = 1167;
    const headerH = 60;
    const valueH = 92;
    const colW = tableW / 4;
    strokeBox(context, tableX, tableY, tableW, headerH + valueH, { fill: "#ffffff", stroke: "#cbd5e1", lineWidth: 1.5 });
    context.save(); context.fillStyle = "#faf5ff"; context.fillRect(tableX, tableY, tableW, headerH); context.restore();
    const dutyItems = [
      ["DERS / SEVİYE", courseLabel],
      ["SINAV TARİHİ", `${dateLabel} ${weekday}`],
      ["SINAV SAATİ", String(slot.time || "")],
      ["SINAV ŞEKLİ", "YAZILI"],
    ];
    dutyItems.forEach(([label, value], index) => {
      const x = tableX + index * colW;
      if (index > 0) {
        context.save(); context.beginPath(); context.moveTo(x, tableY); context.lineTo(x, tableY + headerH + valueH); context.strokeStyle = "#cbd5e1"; context.lineWidth = 1.3; context.stroke(); context.restore();
      }
      drawCanvasText(context, label, x + colW / 2, tableY + 18, { fontSize: 17, bold: true, align: "center", maxWidth: colW - 22 });
      drawWrappedCanvasText(context, value, x + colW / 2, tableY + headerH + 22, colW - 24, { fontSize: 20, lineHeight: 24, bold: true, align: "center" });
    });
    drawRule(context, tableX, tableY + headerH, tableX + tableW, "#cbd5e1", 1.3);

    const dutiesY = 875;
    strokeBox(context, 78, dutiesY, 1167, 500, { fill: "#ffffff", stroke: "#cbd5e1" });
    context.save(); context.fillStyle = "#f8fafc"; context.fillRect(78, dutiesY, 1167, 58); context.fillStyle = accent; context.fillRect(78, dutiesY, 7, 500); context.restore();
    drawCanvasText(context, "GÖREV VE İŞLEMLER", 105, dutiesY + 17, { fontSize: 22, bold: true });
    const duties = [
      "Sınav soruları ve cevap anahtarı komisyon tarafından hazırlanır ve gerekli onay işlemleri tamamlanır.",
      "Sınava girecek öğrenci listesi kontrol edilir; sınava katılmayan öğrenciler ilgili tutanaklarda belirtilir.",
      "Sınav, belirlenen tarih ve saatte başlatılır; sınav süresince gerekli düzen ve güvenlik sağlanır.",
      "Sınav kâğıtları aynı gün değerlendirilir ve sonuçlara ilişkin çizelge ile tutanaklar tamamlanır.",
      "Tüm sınav evrakı eksiksiz şekilde zarfına konularak okul idaresine teslim edilir.",
    ];
    duties.forEach((item, index) => {
      const y = dutiesY + 82 + index * 78;
      context.save(); context.fillStyle = accent; context.beginPath(); context.arc(111, y + 12, 11, 0, Math.PI * 2); context.fill(); context.restore();
      context.save(); context.fillStyle = "#ffffff"; context.font = '700 15px "Times New Roman", Times, serif'; context.textAlign = "center"; context.fillText(String(index + 1), 111, y + 4); context.restore();
      drawWrappedCanvasText(context, item, 140, y, 1060, { fontSize: 19, lineHeight: 25, bold: false });
    });

    // Mor çizgi aynı yerde; tebellüğ eden komisyon ve müdür imzaları 1 cm aşağı alındı.
    const dutySignatureLineY = 1558;
    const dutySignatureContentY = 1645;
    drawRule(context, 78, dutySignatureLineY, 1245, accent, 3);
    drawCanvasText(context, "Tebellüğ Eden Sınav Komisyonu", 330, dutySignatureContentY, { fontSize: 20, bold: true, align: "center" });
    commissionTeachers.slice(0, 2).forEach((teacher, index) => {
      const x = 205 + index * 280;
      drawCanvasText(context, teacher.name, x, dutySignatureContentY + 48, { fontSize: 20, bold: true, align: "center", maxWidth: 250 });
      drawCanvasText(context, "Komisyon Üyesi", x, dutySignatureContentY + 80, { fontSize: 17, bold: false, align: "center", maxWidth: 230 });
    });
    drawCanvasText(context, dateLabel || ".... / .... / ........", 1015, dutySignatureContentY + 20, { fontSize: 17, bold: true, align: "center", maxWidth: 320 });
    drawCanvasText(context, principalName || "................................", 1015, dutySignatureContentY + 48, { fontSize: 22, bold: true, align: "center", maxWidth: 360 });
    drawCanvasText(context, "Okul Müdürü", 1015, dutySignatureContentY + 80, { fontSize: 18, bold: false, align: "center" });
    return canvas;
  };

  const downloadExamDutyPdf = async (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const documentKey = `${plan.id}:${record.id}:duty`;
    if (generatingDocumentKey) return;
    setGeneratingDocumentKey(documentKey);
    try {
      const canvas = createExamDutyCanvas(plan, record, slot);
      await downloadCanvasPdf(canvas, `${record.examName || `${record.level}-${record.subjectName}`}-Sınav-Görev-Tebliği.pdf`);
    } catch (error) {
      console.error("Sınav görev tebliği PDF oluşturulamadı", error);
      window.alert("Sınav görev tebliği PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setGeneratingDocumentKey("");
    }
  };

  const downloadCanvasPagesPdf = async (canvases: HTMLCanvasElement[], filename: string) => {
    if (!canvases.length) return;
    const images = canvases.map((canvas) => canvas.toDataURL("image/png", 1));
    if (images.some((image) => !image || image === "data:," || image.length < 1000)) throw new Error("PDF sayfası görüntüsü oluşturulamadı.");
    const { PdfEngine } = await import("../pdf/core/PdfEngine");
    await PdfEngine.generate({
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [0, 0, 0, 0],
      content: images.map((image, index) => ({ image, width: 595.28, height: 841.89, ...(index ? { pageBreak: "before" } : {}) })),
    }, {
      mode: "download",
      filename,
    });
  };

  const downloadAllExamDocumentsPdf = async (plan: ResponsibilityExamPlan, record: ResponsibilityExamRecord, slot: ExamDateTime) => {
    const documentKey = `${plan.id}:${record.id}:all-documents`;
    if (generatingDocumentKey) return;
    setGeneratingDocumentKey(documentKey);
    try {
      const eOkulLogoImage = await loadEOkulLogoImage();
      const canvases = [
        createExamEnvelopeCanvas(plan, record, slot),
        createExamDutyCanvas(plan, record, slot),
        createExamUnitMinutesCanvas(plan, record, slot),
        createExamMinutesCanvas(plan, record, slot),
        createExamPaperUsageCanvas(plan, record, slot, eOkulLogoImage),
        createExamGradeSheetCanvas(plan, record, slot, eOkulLogoImage),
      ];
      await downloadCanvasPagesPdf(canvases, `${record.examName || `${record.level}-${record.subjectName}`}-Tum-Sinav-Evraklari.pdf`);
    } catch (error) {
      console.error("Tüm sınav evrakları PDF oluşturulamadı", error);
      window.alert("Tüm sınav evrakları PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setGeneratingDocumentKey("");
    }
  };

  type ExamOfficialSignatureRow = {
    teacherName: string;
    courseName: string;
    dateLabel: string;
    time: string;
    explanation: string;
  };

  const buildExamOfficialSignatureRows = (plan: ResponsibilityExamPlan): ExamOfficialSignatureRow[] => {
    const planRecords = records.filter((record) => record.planId === plan.id || plan.recordIds.includes(record.id));
    const slots = sortedExamSlots(plan);
    const schedule = plan.schedule || [];
    const result: ExamOfficialSignatureRow[] = [];

    slots.forEach((slot) => {
      const scheduledRecords = schedule
        .filter((item) => item.slotId === slot.id)
        .map((item) => planRecords.find((record) => record.id === item.recordId))
        .filter(Boolean) as ResponsibilityExamRecord[];
      const { dateLabel } = formatDocumentDateParts(slot);

      scheduledRecords.forEach((record) => {
        (record.commissionTeacherIds || []).forEach((teacherId) => {
          const teacher = teachers.find((item) => item.id === teacherId);
          if (!teacher) return;
          result.push({
            teacherName: teacher.name,
            courseName: record.examName || `${record.level} ${record.subjectName}`,
            dateLabel,
            time: String(slot.time || ""),
            explanation: "Komisyon Üyesi",
          });
        });
      });

      const slotCourseLabel = scheduledRecords.map((record) => record.examName || `${record.level} ${record.subjectName}`).join(" / ");
      (plan.slotInvigilatorTeacherIds?.[slot.id] || []).forEach((teacherId) => {
        const teacher = teachers.find((item) => item.id === teacherId);
        if (!teacher) return;
        result.push({
          teacherName: teacher.name,
          courseName: slotCourseLabel || "Oturum Gözetmenliği",
          dateLabel,
          time: String(slot.time || ""),
          explanation: "Gözetmen",
        });
      });
    });
    return result;
  };

  const createExamOfficialsSignatureCanvases = (plan: ResponsibilityExamPlan) => {
    const rows = buildExamOfficialSignatureRows(plan);
    const pageSize = 25;
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const canvases: HTMLCanvasElement[] = [];
    const accent = "#b91c1c";
    const todayLabel = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
    const principalName = teachers.find((teacher) => teacher.id === plan.principalTeacherId)?.name || schoolPrincipalName;

    for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
      const { canvas, context } = createDesignedDocumentCanvas();
      const academicYear = String(plan.academicYear || automaticAcademicYear);
      const periodLabel = buildPeriodLabel(plan.periodName).toLocaleUpperCase("tr-TR");
      // Diğer sorumluluk sınavı belgeleriyle aynı, ortalanmış üç satırlı başlık.
      context.save();
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, 258);
      context.restore();
      drawCanvasText(context, schoolName.toLocaleUpperCase("tr-TR"), 661.5, 62, { fontSize: 32, bold: true, align: "center", maxWidth: 1120 });
      drawCanvasText(context, `${academicYear} EĞİTİM ÖĞRETİM YILI ${periodLabel} DÖNEMİ SORUMLULUK SINAVI`, 661.5, 112, { fontSize: 25, bold: true, align: "center", maxWidth: 1160 });
      drawCanvasText(context, "SINAV GÖREVLİLERİ İMZA ÇİZELGESİ", 661.5, 164, { fontSize: 34, bold: true, align: "center", maxWidth: 1120 });
      drawRule(context, 78, 232, 1245, accent, 3);
      const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
      const tableX = 78;
      const tableY = 268;
      const tableW = 1167;
      const headerH = 62;
      const rowH = 48;
      const widths = [70, 270, 300, 180, 105, 120, 122];
      const headers = ["SIRA", "ÖĞRETMENİN ADI SOYADI", "SINAV YAPILACAK DERS", "SINAV TARİHİ", "SAAT", "İMZA", "AÇIKLAMA"];

      strokeBox(context, tableX, tableY, tableW, headerH, { fill: accent, stroke: accent });
      let x = tableX;
      headers.forEach((header, index) => {
        const w = widths[index];
        context.save(); context.fillStyle = "#ffffff"; context.font = '700 16px "Times New Roman", Times, serif'; context.textAlign = "center"; context.textBaseline = "middle";
        context.fillText(header, x + w / 2, tableY + headerH / 2, w - 12);
        context.restore();
        x += w;
      });

      for (let rowIndex = 0; rowIndex < pageSize; rowIndex += 1) {
        const y = tableY + headerH + rowIndex * rowH;
        strokeBox(context, tableX, y, tableW, rowH, { fill: rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc", stroke: "#cbd5e1", lineWidth: 1.2 });
        const row = pageRows[rowIndex];
        const globalIndex = pageIndex * pageSize + rowIndex + 1;
        if (row) {
          const values = [String(globalIndex), row.teacherName, row.courseName, row.dateLabel, row.time, "", row.explanation];
          let cellX = tableX;
          values.forEach((value, colIndex) => {
            const w = widths[colIndex];
            drawCanvasText(context, value, colIndex === 0 || colIndex >= 3 ? cellX + w / 2 : cellX + 9, y + 14, {
              fontSize: colIndex === 2 ? 15 : 16,
              bold: colIndex === 0 || colIndex === 1,
              align: colIndex === 0 || colIndex >= 3 ? "center" : "left",
              maxWidth: w - 16,
            });
            cellX += w;
          });
        } else {
          drawCanvasText(context, String(globalIndex), tableX + widths[0] / 2, y + 14, { fontSize: 16, bold: false, align: "center" });
        }
      }

      let dividerX = tableX;
      context.save(); context.strokeStyle = "#cbd5e1"; context.lineWidth = 1.2;
      widths.slice(0, -1).forEach((w) => {
        dividerX += w;
        context.beginPath(); context.moveTo(dividerX, tableY); context.lineTo(dividerX, tableY + headerH + pageSize * rowH); context.stroke();
      });
      context.restore();

      const footerY = tableY + headerH + pageSize * rowH + 28;
      drawCanvasText(context, `Sayfa ${pageIndex + 1} / ${pages}`, 90, footerY, { fontSize: 17, bold: true });
      drawCanvasText(context, "TASDİK OLUNUR", 1065, footerY, { fontSize: 20, bold: true, align: "center" });
      drawCanvasText(context, todayLabel, 1065, footerY + 32, { fontSize: 18, bold: false, align: "center" });
      drawCanvasText(context, principalName, 1065, footerY + 78, { fontSize: 20, bold: true, align: "center", maxWidth: 300 });
      drawCanvasText(context, "Okul Müdürü", 1065, footerY + 108, { fontSize: 18, bold: false, align: "center" });
      canvases.push(canvas);
    }
    return canvases;
  };

  const downloadExamOfficialsSignaturePdf = async (plan: ResponsibilityExamPlan) => {
    const documentKey = `${plan.id}:official-signatures`;
    if (generatingDocumentKey) return;
    if (!plan.scheduleGeneratedAt || !(plan.schedule || []).length) {
      window.alert("İmza çizelgesi için önce Sınav Takvimi ekranında takvimi hazırlayın.");
      return;
    }
    setGeneratingDocumentKey(documentKey);
    try {
      const canvases = createExamOfficialsSignatureCanvases(plan);
      await downloadCanvasPagesPdf(canvases, `${plan.examName}-Sınav-Görevlileri-İmza-Çizelgesi.pdf`);
    } catch (error) {
      console.error("Sınav görevlileri imza çizelgesi PDF oluşturulamadı", error);
      window.alert("Sınav görevlileri imza çizelgesi PDF oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setGeneratingDocumentKey("");
    }
  };

  const topTabs = [
    {
      id: "exam-info" as const,
      title: "Sınav Bilgileri",
      icon: ClipboardList,
    },
    {
      id: "planning" as const,
      title: "Planlama",
      icon: CalendarDays,
    },
    {
      id: "exam-calendar" as const,
      title: "Sınav Takvimi",
      icon: CalendarClock,
    },
    {
      id: "documents" as const,
      title: "Dokümanlar",
      icon: FileText,
    },
    {
      id: "archive" as const,
      title: "Arşiv",
      icon: Archive,
    },
  ];

  const canSaveExamInfo = Boolean(
    academicYear.trim()
      && periodName.trim()
      && schoolPrincipalName
      && vicePrincipalTeacherId
      && coordinatorTeacherId
      && examDateTimes.some((slot) => slot.date && slot.time),
  );

  const renderCourseEditor = (planId: string, level: string) => {
    if (editorPlanId !== planId || editorLevel !== level || !editorSubject) return null;
    const editorExamName = `${editorLevel} ${editorSubject}`;

    return (
      <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/65 p-2 backdrop-blur-[2px] md:p-5">
        <div className="mx-auto flex min-h-[calc(100vh-16px)] max-w-[1540px] flex-col overflow-hidden rounded-[30px] border border-violet-200 bg-white shadow-2xl md:min-h-[calc(100vh-40px)]">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-5">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-500">Sorumluluk Sınavı Dersi</span>
              <h3 className="mt-1 truncate text-xl font-black text-slate-950">{editorExamName}</h3>
            </div>
            <button type="button" onClick={closeCourseEditor} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600" aria-label="Pencereyi kapat"><X className="h-5 w-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.25fr_0.95fr_1fr]">
              <section className="flex min-h-[620px] flex-col rounded-[24px] border border-cyan-200 bg-cyan-50/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm font-black text-slate-900">Sınava Girecek Öğrenciler</strong>
                  <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-black text-cyan-700">{filteredStudents.length}</span>
                </div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Öğrenci ara" className="w-full rounded-2xl border border-cyan-200 bg-white py-3 pl-9 pr-3 text-xs font-bold outline-none focus:border-cyan-400" />
                </div>
                <div className="mt-3 max-h-[535px] flex-1 space-y-1.5 overflow-y-auto pr-1">
                  {filteredStudents.map((student) => {
                    const selected = selectedStudentIds.includes(student.id);
                    return (
                      <button key={student.id} type="button" onClick={() => setSelectedStudentIds((prev) => selected ? prev : [...prev, student.id])} className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2.5 text-left ${selected ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-white hover:border-cyan-200 hover:bg-cyan-50"}`}>
                        <span className="min-w-0"><strong className="block truncate text-[11px] font-black text-slate-900">{student.name}</strong><span className="mt-0.5 block text-[9px] font-bold text-slate-500">{student.classroom || "—"}{student.number || student.studentNumber ? ` · No ${student.number || student.studentNumber}` : ""}</span></span>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black ${selected ? "bg-emerald-100 text-emerald-700" : "bg-cyan-100 text-cyan-700"}`}>{selected ? "Eklendi" : "Ekle"}</span>
                      </button>
                    );
                  })}
                  {filteredStudents.length === 0 ? <div className="p-6 text-center text-xs font-black text-slate-400">Uygun öğrenci bulunamadı.</div> : null}
                </div>
              </section>

              <section className="flex min-h-[620px] flex-col rounded-[24px] border border-amber-200 bg-amber-50/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm font-black text-slate-900">Sınava Eklenen Öğrenciler</strong>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">{selectedStudents.length}</span>
                </div>
                <div className="mt-3 max-h-[570px] flex-1 space-y-1.5 overflow-y-auto pr-1">
                  {selectedStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-2 rounded-xl border border-amber-100 bg-white px-2.5 py-2.5">
                      <span className="min-w-0"><strong className="block truncate text-[11px] font-black text-slate-900">{student.name}</strong><span className="mt-0.5 block text-[9px] font-bold text-slate-500">{student.classroom || "—"}</span></span>
                      <button type="button" onClick={() => setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id))} className="shrink-0 rounded-lg bg-amber-50 p-1.5 text-amber-700"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  {selectedStudents.length === 0 ? <div className="p-6 text-center text-xs font-black text-slate-400">Sınava öğrenci eklenmedi.</div> : null}
                </div>
              </section>

              <section className="flex min-h-[620px] flex-col rounded-[24px] border border-violet-200 bg-violet-50/40 p-3">
                <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-700" /><strong className="text-sm font-black text-slate-900">Komisyon Öğretmenleri</strong></div>
                <div className="mt-3 flex gap-2">
                  <select value={commissionPicker} onChange={(e) => setCommissionPicker(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-2.5 py-3 text-[10px] font-black">
                    <option value="">Branş öğretmeni seçin</option>
                    {branchTeachers.filter((teacher) => !selectedCommissionTeacherIds.includes(teacher.id)).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.branch}</option>)}
                  </select>
                  <button type="button" disabled={!commissionPicker} onClick={() => { if (!commissionPicker) return; setSelectedCommissionTeacherIds((prev) => prev.includes(commissionPicker) ? prev : [...prev, commissionPicker]); setCommissionPicker(""); }} className="rounded-xl bg-violet-700 px-3 text-white disabled:bg-slate-300"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 max-h-[535px] flex-1 space-y-2 overflow-y-auto pr-1">
                  {selectedCommissionTeachers.map((teacher) => <div key={teacher.id} className="flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-white px-2.5 py-2.5 text-[10px] font-black text-violet-800"><span className="min-w-0 truncate">{teacher.name}</span><button type="button" onClick={() => setSelectedCommissionTeacherIds((prev) => prev.filter((id) => id !== teacher.id))} className="shrink-0 rounded-lg bg-violet-50 p-1.5"><X className="h-3.5 w-3.5" /></button></div>)}
                  {selectedCommissionTeachers.length === 0 ? <div className="p-5 text-center text-[10px] font-bold text-slate-400">Komisyon üyesi eklenmedi.</div> : null}
                </div>
              </section>

            </div>
          </div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3 md:px-5">
            <button type="button" onClick={closeCourseEditor} className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black text-slate-600">İptal</button>
            <button type="button" onClick={saveCourseRecord} disabled={selectedStudentIds.length === 0} className="rounded-2xl bg-violet-700 px-8 py-3 text-xs font-black text-white shadow-md shadow-violet-200 disabled:bg-slate-300 disabled:shadow-none">{editorRecordId ? "Güncelle" : "Kaydet"}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <section className="rounded-2xl border border-cyan-200 bg-white px-2 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {topTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { closeCourseEditor(); setActiveTab(tab.id); }}
                className={`inline-flex h-12 min-w-[185px] items-center justify-center gap-2.5 rounded-xl px-6 text-[13px] font-black transition ${isActive ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {tab.title}
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "exam-info" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <label className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[190px_1fr] md:items-center">
                <span className="text-xs font-black text-slate-700">Eğitim Öğretim Yılı</span>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-800">{academicYear || automaticAcademicYear}</div>
              </label>
              <label className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[190px_1fr] md:items-center">
                <span className="text-xs font-black text-slate-700">Sınav Dönemi</span>
                <input value={periodName} onChange={(e) => setPeriodName(e.target.value)} placeholder="Örn. 1. Dönem" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-400" />
              </label>
              <div className="grid gap-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-3 md:grid-cols-[190px_1fr] md:items-center">
                <span className="text-xs font-black text-slate-700">Okul Müdürü</span>
                <div className="rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-black text-slate-800">{schoolPrincipalName}</div>
              </div>
              <label className="grid gap-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-3 md:grid-cols-[190px_1fr] md:items-center">
                <span className="text-xs font-black text-slate-700">Hazırlayan Müdür Yardımcısı</span>
                <select value={vicePrincipalTeacherId} onChange={(e) => setVicePrincipalTeacherId(e.target.value)} className="rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-bold">
                  <option value="">Seçiniz</option>
                  {vicePrincipalOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                </select>
              </label>
              <label className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-3 md:grid-cols-[190px_1fr] md:items-center">
                <span className="text-xs font-black text-slate-700">Öğretmen</span>
                <select value={coordinatorTeacherId} onChange={(e) => setCoordinatorTeacherId(e.target.value)} className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-bold">
                  <option value="">Seçiniz</option>
                  {sortedTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.branch}</option>)}
                </select>
              </label>
            </div>

            <div className="rounded-[24px] border border-cyan-200 bg-cyan-50/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-cyan-700" /><h3 className="text-sm font-black text-slate-900">Sınav Tarih ve Saatleri</h3></div>
                <button type="button" onClick={addExamDateTime} className="inline-flex items-center gap-1 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-[10px] font-black text-cyan-700"><Plus className="h-3.5 w-3.5" />Tarih Ekle</button>
              </div>
              <div className="mt-3 space-y-2">
                {examDateTimes.map((slot, index) => (
                  <div key={slot.id} className="grid grid-cols-[26px_1fr_1fr_34px] items-center gap-2 rounded-2xl border border-cyan-100 bg-white p-2">
                    <span className="text-center text-[10px] font-black text-cyan-700">{index + 1}</span>
                    <input type="date" value={slot.date} onChange={(e) => updateExamDateTime(slot.id, "date", e.target.value)} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2 text-[11px] font-bold" />
                    <div className="relative"><Clock3 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><select value={slot.time} onChange={(e) => updateExamDateTime(slot.id, "time", e.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-2 text-[11px] font-black text-slate-700"><option value="">Saat seçin</option>{timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}</select></div>
                    <button type="button" onClick={() => removeExamDateTime(slot.id)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {currentExamName ? (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-500">Oluşturulacak Sınav Adı</span>
              <strong className="mt-1 block text-sm font-black text-slate-900">{currentExamName.toLocaleUpperCase("tr-TR")}</strong>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => resetExamInfoForm()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600">Temizle</button>
            <button type="button" onClick={saveExamInfo} disabled={!canSaveExamInfo} className="rounded-xl bg-violet-700 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-violet-200 disabled:bg-slate-300 disabled:shadow-none">{editingExamPlanId ? "Güncelle ve Planlamaya Geç" : "Kaydet ve Planlamaya Geç"}</button>
          </div>
        </section>
      ) : activeTab === "planning" ? (
        <section className="space-y-4">
          {plans.map((plan) => {
            const planRecords = records.filter((record) => record.planId === plan.id || plan.recordIds.includes(record.id));
            return (
              <article key={plan.id} className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-amber-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-red-600">{plan.examName.toLocaleUpperCase("tr-TR")}</h3>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button type="button" onClick={() => openExamInfoEditor(plan)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-[11px] font-black text-violet-700"><ClipboardList className="h-4 w-4" />Güncelle</button>
                    <button type="button" onClick={() => removePlan(plan.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[11px] font-black text-rose-700"><Trash2 className="h-4 w-4" />Sınavı Sil</button>
                  </div>
                </div>

                <div className="grid gap-3 p-4 xl:grid-cols-4">
                  {levelOptions.map((level) => {
                    const levelRecords = planRecords.filter((record) => getLevelFromText(record.level) === level).sort((a, b) => a.subjectName.localeCompare(b.subjectName, "tr"));
                    const usedSubjects = new Set(levelRecords.map((record) => normalizeText(record.subjectName)));
                    const subjects = getSubjectOptionsForLevel(level).filter((subject) => !usedSubjects.has(normalizeText(subject)));
                    return (
                      <section key={level} className="min-w-0 rounded-[22px] border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                          <strong className="text-sm font-black text-slate-900">{level}. Sınıf Dersleri</strong>
                          <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-violet-700 shadow-sm">{levelRecords.length}</span>
                        </div>

                        {(() => {
                          const isNewCourseSelection = editorPlanId === plan.id && editorLevel === level && Boolean(editorSubject) && !editorRecordId;
                          return (
                            <select
                              value={isNewCourseSelection ? editorSubject : ""}
                              onChange={(e) => openNewCourseEditor(plan.id, level, e.target.value)}
                              className={`mt-3 w-full rounded-xl border px-3 py-2.5 text-[10px] font-black outline-none transition ${isNewCourseSelection ? "border-red-700 bg-red-600 text-white shadow-md shadow-red-100 focus:border-red-800" : "border-violet-200 bg-white text-slate-700 focus:border-violet-400"}`}
                            >
                              <option value="" className="bg-white text-slate-700">Ders seçin</option>
                              {subjects.map((subject) => <option key={subject} value={subject} className="bg-white text-slate-800">{subject}</option>)}
                            </select>
                          );
                        })()}

                        <div className="mt-3 space-y-2">
                          {levelRecords.map((record) => (
                            <div key={record.id} className="rounded-2xl border border-amber-400 bg-amber-100 p-2.5 shadow-sm">
                              <button type="button" onClick={() => openRecordEditor(record)} className="w-full rounded-xl border border-amber-400 bg-amber-300 px-3 py-3 text-left transition hover:bg-amber-200">
                                <strong className="block truncate text-[12px] font-black text-slate-950">{record.examName || `${level} ${record.subjectName}`}</strong>
                                <span className="mt-1 block text-[8px] font-black text-amber-900">{record.studentIds.length} öğrenci · {record.commissionTeacherIds.length} komisyon</span>
                              </button>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => openRecordEditor(record)} className="rounded-xl border border-violet-200 bg-white px-2 py-2 text-[9px] font-black text-violet-700">Güncelle</button>
                                <button type="button" onClick={() => removeRecord(record.id)} className="rounded-xl border border-rose-200 bg-white px-2 py-2 text-[9px] font-black text-rose-700">Ders Sil</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>

              </article>
            );
          })}

          {plans.length === 0 ? <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-500">Henüz kaydedilmiş sorumluluk sınavı yok. Önce Sınav Bilgileri ekranından sınavı kaydedin.</div> : null}
        </section>
      ) : activeTab === "exam-calendar" ? (
        <section className="space-y-4">
          {plans.map((plan) => {
            const planRecords = records.filter((record) => record.planId === plan.id || plan.recordIds.includes(record.id));
            const slots = sortedExamSlots(plan);
            const schedule = plan.schedule || [];
            const assignedIds = new Set(schedule.map((item) => item.recordId));
            const unassigned = planRecords.filter((record) => !assignedIds.has(record.id));
            return (
              <article key={plan.id} className="overflow-hidden rounded-[28px] border border-cyan-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-violet-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-base font-black text-red-600">{plan.examName.toLocaleUpperCase("tr-TR")}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void downloadExamPlanPdf(plan)} disabled={!plan.scheduleGeneratedAt || schedule.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-black text-white shadow-md shadow-red-100 disabled:cursor-not-allowed disabled:bg-red-300 disabled:shadow-none"><FileText className="h-4 w-4" />Sınav Planı PDF</button>
                    <button type="button" onClick={() => generateSchedule(plan)} disabled={planRecords.length === 0 || slots.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-xs font-black text-white shadow-md shadow-cyan-100 disabled:bg-slate-300 disabled:shadow-none"><CalendarClock className="h-4 w-4" />Takvimi Hazırla</button>
                  </div>
                </div>

                <div className="p-4">
                  {plan.scheduleGeneratedAt ? (
                    <div className="space-y-3">
                      {slots.map((slot, index) => {
                        const slotRecordIds = schedule.filter((item) => item.slotId === slot.id).map((item) => item.recordId);
                        const slotRecords = slotRecordIds.map((id) => planRecords.find((record) => record.id === id)).filter(Boolean) as ResponsibilityExamRecord[];
                        if (slotRecords.length === 0) return null;
                        const slotInvigilatorIds = plan.slotInvigilatorTeacherIds?.[slot.id] || [];
                        const slotInvigilators = slotInvigilatorIds
                          .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId))
                          .filter(Boolean) as Teacher[];
                        const slotStudentIds = new Set<string>();
                        slotRecords.forEach((record) => (record.studentIds || []).forEach((studentId) => slotStudentIds.add(studentId)));
                        return (
                          <section key={slot.id} className="rounded-[24px] border border-blue-200 bg-blue-50/25 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-[11px] font-black text-white">{index + 1}</span>
                                <strong className="text-sm font-black text-blue-700">{formatScheduleDateTime(slot)}</strong>
                                <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[9px] font-black text-blue-700">{slotStudentIds.size} öğrenci</span>
                                <span className="text-[11px] font-black text-blue-700">Gözetmen: {slotInvigilators.length ? slotInvigilators.map((teacher) => teacher.name).join(", ") : "Seçilmedi"}</span>
                              </div>
                              <details className="relative shrink-0">
                                <summary className="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-[10px] font-black text-violet-700 shadow-sm hover:bg-violet-50">
                                  <Users className="h-4 w-4" />Gözetmen Öğretmen Seç
                                </summary>
                                <div className="absolute right-0 z-40 mt-2 max-h-[360px] w-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                                  <div className="border-b border-slate-100 px-2 py-2 text-[10px] font-black text-slate-500">Birden fazla öğretmen seçebilirsiniz</div>
                                  <div className="mt-1 space-y-1">
                                    {sortedTeachers.map((teacher) => {
                                      const checked = slotInvigilatorIds.includes(teacher.id);
                                      return (
                                        <label key={teacher.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-[10px] font-bold ${checked ? "border-violet-200 bg-violet-50 text-violet-800" : "border-transparent bg-white text-slate-700 hover:bg-slate-50"}`}>
                                          <input type="checkbox" checked={checked} onChange={() => toggleSlotInvigilator(plan.id, slot.id, teacher.id)} className="h-4 w-4 accent-violet-700" />
                                          <span className="min-w-0"><strong className="block truncate text-[10px] font-black">{teacher.name}</strong><span className="block truncate text-[8px] text-slate-500">{teacher.branch}</span></span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              </details>
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                              {slotRecords.map((record) => {
                                const examStudents = record.studentIds.map((studentId) => students.find((student) => student.id === studentId)).filter(Boolean) as Student[];
                                return (
                                  <div key={record.id} className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
                                    <strong className="block text-sm font-black text-slate-950">{record.examName || `${record.level} ${record.subjectName}`}</strong>
                                    <div className="mt-2 space-y-1">
                                      {examStudents.map((student) => (
                                        <div key={student.id} className="rounded-lg bg-slate-50 px-2 py-1.5 text-[9px] font-bold text-slate-700">
                                          <strong className="font-black text-slate-900">{student.name}</strong>{student.classroom ? ` · ${student.classroom}` : ""}
                                        </div>
                                      ))}
                                      {examStudents.length === 0 ? <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-[9px] font-bold text-slate-400">Öğrenci kaydı yok.</div> : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}

                      {unassigned.length > 0 ? (
                        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
                          <strong className="text-sm font-black text-rose-700">Planlanamayan Dersler</strong>
                          <p className="mt-1 text-[10px] font-bold text-rose-600">Tanımlı tarih ve saatlerde öğrenci çakışması nedeniyle yer bulunamadı. Sınav Bilgileri alanından yeni tarih/saat ekleyip Takvimi Hazırla düğmesine tekrar basın.</p>
                          <div className="mt-3 flex flex-wrap gap-2">{unassigned.map((record) => <span key={record.id} className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[10px] font-black text-rose-700">{record.examName || `${record.level} ${record.subjectName}`}</span>)}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
          {plans.length === 0 ? <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-500">Henüz sınav bilgisi kaydedilmedi.</div> : null}
        </section>
      ) : activeTab === "documents" ? (
        <section className="space-y-4">
          {plans.map((plan) => {
            const planRecords = records.filter((record) => record.planId === plan.id || plan.recordIds.includes(record.id));
            const slots = sortedExamSlots(plan);
            const schedule = plan.schedule || [];
            return (
              <article key={plan.id} className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-amber-50 px-4 py-4">
                  <h3 className="text-base font-black text-red-600">{plan.examName.toLocaleUpperCase("tr-TR")}</h3>
                  <button
                    type="button"
                    onClick={() => void downloadExamOfficialsSignaturePdf(plan)}
                    disabled={Boolean(generatingDocumentKey) || !plan.scheduleGeneratedAt || schedule.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-700 bg-red-600 px-4 py-2.5 text-[11px] font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <FileText className="h-4 w-4" />
                    Sınav Görevlileri İmza Çizelgesi
                  </button>
                </div>
                <div className="p-4">
                  {!plan.scheduleGeneratedAt || schedule.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-7 text-center text-xs font-black text-slate-500">
                      Dokümanları hazırlamak için önce Sınav Takvimi ekranında takvimi hazırlayın.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {slots.map((slot, slotIndex) => {
                        const slotRecordIds = schedule.filter((item) => item.slotId === slot.id).map((item) => item.recordId);
                        const slotRecords = slotRecordIds.map((id) => planRecords.find((record) => record.id === id)).filter(Boolean) as ResponsibilityExamRecord[];
                        if (slotRecords.length === 0) return null;
                        return (
                          <section key={slot.id} className="rounded-[24px] border border-blue-200 bg-blue-50/25 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-[11px] font-black text-white">{slotIndex + 1}</span>
                              <strong className="text-sm font-black text-blue-700">{formatScheduleDateTime(slot)}</strong>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {slotRecords.map((record) => {
                                const opened = openDocumentRecordId === record.id;
                                return (
                                  <div key={record.id} className="min-w-[210px] flex-1 basis-[220px] max-w-[360px]">
                                    <button
                                      type="button"
                                      onClick={() => setOpenDocumentRecordId((current) => current === record.id ? null : record.id)}
                                      className={`w-full rounded-2xl border px-4 py-3 text-left text-xs font-black transition ${opened ? "border-amber-500 bg-amber-300 text-slate-950 shadow-md shadow-amber-100" : "border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200"}`}
                                    >
                                      {record.examName || `${record.level} ${record.subjectName}`}
                                    </button>
                                    {opened ? (
                                      <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                                        <button
                                          type="button"
                                          onClick={() => void downloadAllExamDocumentsPdf(plan, record, slot)}
                                          disabled={Boolean(generatingDocumentKey)}
                                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-800 bg-indigo-700 px-3 py-2.5 text-left text-[10px] font-black text-white transition hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60"
                                        >
                                          <span>Tümünü İndir</span>
                                          <FileText className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void downloadExamEnvelopePdf(plan, record, slot)}
                                          disabled={Boolean(generatingDocumentKey)}
                                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left text-[10px] font-black text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
                                        >
                                          <span>Sınav Evrak Zarfı</span>
                                          <FileText className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void downloadExamDutyPdf(plan, record, slot)}
                                          disabled={Boolean(generatingDocumentKey)}
                                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left text-[10px] font-black text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
                                        >
                                          <span>Sınav Görev Tebliği</span>
                                          <FileText className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void downloadExamUnitMinutesPdf(plan, record, slot)}
                                          disabled={Boolean(generatingDocumentKey)}
                                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left text-[10px] font-black text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
                                        >
                                          <span>Sınav Soru Ünite Tutanağı</span>
                                          <FileText className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void downloadExamMinutesPdf(plan, record, slot)}
                                          disabled={Boolean(generatingDocumentKey)}
                                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left text-[10px] font-black text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
                                        >
                                          <span>Sınav Tutanağı</span>
                                          <FileText className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void downloadExamPaperUsagePdf(plan, record, slot)}
                                          disabled={Boolean(generatingDocumentKey)}
                                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left text-[10px] font-black text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
                                        >
                                          <span>Kağıt Sarf Tutanağı</span>
                                          <FileText className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void downloadExamGradeSheetPdf(plan, record, slot)}
                                          disabled={Boolean(generatingDocumentKey)}
                                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left text-[10px] font-black text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
                                        >
                                          <span>Sınav Not Çizelgesi</span>
                                          <FileText className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {plans.length === 0 ? <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-500">Henüz sınav bilgisi kaydedilmedi.</div> : null}
        </section>
      ) : (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70">
            <div className="text-center"><strong className="text-lg font-black text-slate-800">{topTabs.find((tab) => tab.id === activeTab)?.title}</strong></div>
          </div>
        </section>
      )}

      {editorPlanId && editorLevel && editorSubject ? renderCourseEditor(editorPlanId, editorLevel) : null}
    </div>
  );
};

export default ResponsibilityExamModule;
