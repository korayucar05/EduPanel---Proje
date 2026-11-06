import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ClipboardPaste, Copy, Trash2, UserRound, X } from "lucide-react";
import type { Classroom, Course, Student, Teacher } from "../../types";
import { classroomService } from "../../modules/classroom";
import { compareClassrooms } from "../../utils/classroomSort";

interface Props {
  classrooms: Classroom[];
  setClassrooms: React.Dispatch<React.SetStateAction<Classroom[]>>;
  courses: Course[];
  customCreatedCourses: any[];
  setCustomCreatedCourses: React.Dispatch<React.SetStateAction<any[]>>;
  teachers: Teacher[];
  students: Student[];
  notify: (message: string) => void;
  focusClassroomId?: string;
}

const normalize = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");

// Öğrenci kayıtlarında sınıf adı farklı biçimlerde tutulabiliyor:
// "9-A", "9 - A", "9/A", "9 · A", "9A" vb. Ders ekranındaki
// sınıf adı ile öğrenci kaydını aynı anahtara indirerek eşleştiriyoruz.
const normalizeClassroomKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/SINIFI|SINIF|ŞUBE|SUBE/gu, "")
    .replace(/[^0-9A-ZÇĞİÖŞÜ]/gu, "");

const studentBelongsToClassroom = (student: any, classroom: any) => {
  if (!student || !classroom) return false;

  const classroomId = String(classroom?.id ?? "").trim();
  const directIds = [student?.classId, student?.classroomId]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (classroomId && directIds.includes(classroomId)) return true;

  const targetKeys = new Set(
    [classroom?.name, classroom?.id]
      .map(normalizeClassroomKey)
      .filter(Boolean),
  );

  const studentClassValues = [
    student?.classroom,
    student?.className,
    student?.classroomName,
    student?.sinif,
    student?.["sınıf"],
    student?.class,
  ];

  if (studentClassValues.some((value) => targetKeys.has(normalizeClassroomKey(value)))) {
    return true;
  }

  // Bazı eski kayıtlarda düzey ve şube ayrı alanlarda tutuluyor.
  const grade = String(
    student?.gradeLevel ?? student?.grade ?? student?.level ?? "",
  ).match(/(?:^|\D)(9|10|11|12)(?:\D|$)/)?.[1];
  const section = String(
    student?.section ?? student?.branchName ?? student?.classBranch ?? "",
  ).trim();
  if (grade && section) {
    const combined = normalizeClassroomKey(`${grade}${section}`);
    if (targetKeys.has(combined)) return true;
  }

  return false;
};

const isArtEducationCourseName = (value: unknown) => {
  const key = normalize(value)
    .replace(/İ/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
  return key === "SANAT TARIHI" || key.startsWith("SANAT EGITIMI");
};

const parallelGroupIdOf = (item: any) =>
  String(item?.parallelGroupId || item?.splitGroupId || "").trim();

const clearClassParallelFields = (item: any) => {
  const next = { ...item };
  const parallelId = String(next.parallelGroupId || "").trim();
  const splitId = String(next.splitGroupId || "").trim();
  const isClassRelation = next.parallelRelationScope === "class";

  delete next.parallelCourseName;
  delete next.parallelGroupId;
  delete next.parallelRelationScope;

  // Bu splitGroupId yalnız sınıf-bazlı ortaklaştırma için üretildiyse kaldır.
  // Eski SAY/EA gibi gerçek grup ayrımlarının splitGroupId değeri korunur.
  if (isClassRelation || (parallelId && splitId === parallelId)) {
    delete next.splitGroupId;
  }
  // Sınıf-bazlı ortaklaştırmada öğrenci dağılımı yalnız bu ilişkiye aittir.
  // İlişki kaldırılırsa eski dağılımın daha sonra başka bir ortaklaştırmada
  // yanlışlıkla yeniden kullanılmaması için temizlenir.
  if (isClassRelation) {
    delete next.studentIds;
    delete next.studentDistributionMode;
    delete next.studentDistributionUpdatedAt;
  }
  return next;
};

const teacherKeysForParallelCheck = (course: any) =>
  [course?.teacherId, course?.teacherId2]
    .map((value) => String(value || "").trim())
    .filter(Boolean);


type TeacherHourDetail = { className: string; courseName: string; hours: number };

const classIdentityKey = (classroom: any) => {
  const level = normalize(classroom?.level || classroom?.gradeLevel || "");
  const raw = String(classroom?.name || "").trim();
  const grade = raw.match(/\b(9|10|11|12)\b/)?.[1] || "";
  const branch = raw
    .replace(/\b(9|10|11|12)\b/g, "")
    .replace(/SINIFI|SINIF|ŞUBE|SUBE/gi, "")
    .replace(/[-_/().\s]/g, "")
    .trim();
  return `${level || grade}|${normalize(branch || raw)}`;
};

const courseIdentityKey = (course: any) =>
  normalize(course?.courseId || course?.courseName || "")
    .replace(/\s*\((SAY|EA|SÖZ|SOZ|DİL|DIL|ORTAK)\)\s*$/i, "");

const buildTeacherHourSummary = (classrooms: Classroom[], teacherId: string) => {
  const details: TeacherHourDetail[] = [];
  const counted = new Set<string>();
  for (const classroom of classrooms || []) {
    for (const course of classroom.assignedCourses || []) {
      const assigned =
        String(course?.teacherId || "") === String(teacherId) ||
        String(course?.teacherId2 || "") === String(teacherId);
      if (!assigned) continue;
      const hours = Math.max(0, Number(course?.weeklyHours) || 0);
      if (!hours) continue;

      // Aynı düzey + aynı şube kimliğindeki ortak ders iki paralel sınıfta
      // aynı öğretmene atanmışsa öğretmen yükünde yalnız bir kez say.
      const key = `${classIdentityKey(classroom)}|${courseIdentityKey(course)}`;
      if (counted.has(key)) continue;
      counted.add(key);
      details.push({
        className: String(classroom.name || "Sınıf"),
        courseName: String(course.courseName || "Ders"),
        hours,
      });
    }
  }
  return { total: details.reduce((s, d) => s + d.hours, 0), details };
};

const isCommonAssignedCourse = (course: any) => {
  if (!course) return false;
  if (course?.isCommonElective === true) return true;
  if (Array.isArray(course?.targetGroups) && course.targetGroups.some((g: any) => normalize(g) === "ORTAK")) {
    return true;
  }
  // Grup adı yoksa ders sınıfın ortak dersi kabul edilir.
  return !String(course?.groupName || "").trim();
};

const shouldMirrorCommonCourseAssignment = (
  sourceClass: any,
  targetClass: any,
  sourceCourse: any,
  targetCourse: any,
) =>
  sourceClass?.id !== targetClass?.id &&
  classIdentityKey(sourceClass) === classIdentityKey(targetClass) &&
  courseIdentityKey(sourceCourse) === courseIdentityKey(targetCourse) &&
  isCommonAssignedCourse(sourceCourse) &&
  isCommonAssignedCourse(targetCourse);


const scheduleHours = (value: unknown) => {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

const getLevelNumber = (level: unknown) => {
  const match = String(level || "").match(/\d+/);
  return match ? Number(match[0]) : 999;
};

const getClassGroupLabel = (classroom: Classroom) => {
  const groups = Array.isArray(classroom.groups)
    ? classroom.groups
        .map((group) => String(group || "").trim().toLocaleUpperCase("tr-TR"))
        .filter(Boolean)
    : [];

  return groups.length > 0 ? groups.join(" + ") : "GENEL";
};

const isElective = (item: any) =>
  String(item?.type || item?.courseType || "")
    .toLocaleLowerCase("tr-TR")
    .includes("seçmeli") ||
  String(item?.type || "").toLocaleLowerCase("tr-TR") === "elective";

const isHtElective = (item: any) =>
  isElective(item) &&
  normalize(item?.courseName || item?.name || "").startsWith("HT");

const courseSortRank = (item: any) => {
  if (isHtElective(item)) return 2;
  if (isElective(item)) return 1;
  return 0;
};

const sortCourses = (a: any, b: any) => {
  const rankDiff = courseSortRank(a) - courseSortRank(b);
  if (rankDiff !== 0) return rankDiff;
  return String(a?.courseName || a?.name || "").localeCompare(
    String(b?.courseName || b?.name || ""),
    "tr-TR",
  );
};

export default function ClassCourseAssignmentPanel({
  classrooms,
  setClassrooms,
  courses,
  customCreatedCourses,
  teachers,
  students,
  notify,
  focusClassroomId,
}: Props) {
  const focusedClassroom = focusClassroomId
    ? classrooms.find((classroom) => String(classroom.id) === String(focusClassroomId)) || null
    : null;
  const focusedGrade = focusedClassroom ? getLevelNumber(focusedClassroom.level) : null;
  const [selectedClassId, setSelectedClassId] = useState<string>(
    () => String(focusClassroomId || [...classrooms].sort(compareClassrooms)[0]?.id || ""),
  );
  const [visibleGrades, setVisibleGrades] = useState<number[]>(() =>
    focusedGrade && focusedGrade !== 999 ? [focusedGrade] : [],
  );
  const [selectedAssignedCourseName, setSelectedAssignedCourseName] = useState<string>("");
  const [branchLoadModalOpen, setBranchLoadModalOpen] = useState(false);
  const [copiedClass, setCopiedClass] = useState<{ id: string; name: string; courses: any[] } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; classId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [teacherAssignmentMode, setTeacherAssignmentMode] = useState<1 | 2>(1);
  const [openTeacherHoursId, setOpenTeacherHoursId] = useState<string | null>(null);
  const [studentDistributionModal, setStudentDistributionModal] = useState<{
    isOpen: boolean;
    groupId: string;
  }>({ isOpen: false, groupId: "" });
  const [studentDistributionDraft, setStudentDistributionDraft] = useState<Record<string, string[]>>({});
  const [studentDistributionSearch, setStudentDistributionSearch] = useState("");

  const selectedClass =
    focusedClassroom ||
    classrooms.find(
      (classroom) =>
        classroom.id === selectedClassId &&
        visibleGrades.includes(getLevelNumber(classroom.level)),
    ) ||
    [...classrooms]
      .filter((classroom) => visibleGrades.includes(getLevelNumber(classroom.level)))
      .sort(compareClassrooms)[0] ||
    null;

  const pool = useMemo(() => {
    const map = new Map<string, any>();

    const add = (name: string, source: any, fallback?: any) => {
      const cleanName = String(name || "").trim();
      if (!cleanName) return;
      const key = normalize(cleanName);

      const weeklyHours = Number(
        source?.weeklyHours ||
          fallback?.weeklyHours ||
          scheduleHours(source?.schedule) ||
          scheduleHours(fallback?.schedule) ||
          0,
      );

      if (!map.has(key)) {
        map.set(key, {
          key,
          courseName: cleanName,
          weeklyHours,
          code: String(source?.courseCode || source?.code || fallback?.code || "").trim(),
          type:
            source?.courseType === "Seçmeli Ders" ||
            source?.type === "elective" ||
            fallback?.type === "elective"
              ? "Seçmeli Ders"
              : "Zorunlu Ders",
          branch: String(
            source?.branch ||
              source?.courseBranch ||
              fallback?.branch ||
              "",
          ).trim(),
          targetGroups: Array.isArray(source?.targetGroups)
            ? [...source.targetGroups]
            : undefined,
          courseGroup: source?.courseGroup,
        });
      }
    };

    customCreatedCourses.forEach((item) => {
      const name = String(item?.courseName || item?.name || "").trim();
      const fallback = courses.find((course) => normalize(course.name) === normalize(name));
      add(name, item, fallback);
    });

    courses.forEach((course: any) => add(course.name, course));

    return [...map.values()].sort(sortCourses);
  }, [courses, customCreatedCourses]);

  const assigned = useMemo(
    () =>
      [...(selectedClass?.assignedCourses || [])].sort(sortCourses),
    [selectedClass],
  );

  const totalHours = (() => {
    const countedParallelGroups = new Set<string>();
    return assigned.reduce((sum:number,item:any)=>{
      const hours=Number(item.weeklyHours||0);
      const splitId=String(item.splitGroupId||item.parallelGroupId||"").trim();
      if (!splitId) return sum+hours;
      if (countedParallelGroups.has(splitId)) return sum;
      countedParallelGroups.add(splitId);
      return sum+hours;
    },0);
  })();

  const assignedKeys = new Set(assigned.map((item: any) => normalize(item.courseName)));

  const commonCourseKeys = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    classrooms.forEach((classroom) => {
      const classIdentity = `${normalize(classroom.level)}::${normalize(classroom.name)}`;
      (classroom.assignedCourses || []).forEach((course: any) => {
        const courseName = normalize(course?.courseName);
        if (!courseName) return;
        const key = `${classIdentity}::${courseName}`;
        if (!counts.has(key)) counts.set(key, new Set<string>());
        counts.get(key)!.add(String(classroom.id));
      });
    });
    return new Set(
      [...counts.entries()]
        .filter(([, ids]) => ids.size >= 2)
        .map(([key]) => key),
    );
  }, [classrooms]);

  const isCommonCourseForSelectedClass = (courseName: string) => {
    if (!selectedClass) return false;
    return commonCourseKeys.has(
      `${normalize(selectedClass.level)}::${normalize(selectedClass.name)}::${normalize(courseName)}`,
    );
  };

  const selectedAssignedCourse =
    assigned.find(
      (item: any) => normalize(item.courseName) === normalize(selectedAssignedCourseName),
    ) || null;

  const selectedParallelGroupId = selectedAssignedCourse
    ? parallelGroupIdOf(selectedAssignedCourse)
    : "";

  const selectedParallelPartner = selectedParallelGroupId
    ? assigned.find(
        (item: any) =>
          item !== selectedAssignedCourse &&
          parallelGroupIdOf(item) === selectedParallelGroupId,
      ) || null
    : null;

  const selectedClassStudents = useMemo(() => {
    if (!selectedClass) return [] as Student[];
    return (students || [])
      .filter((student) =>
        String(student?.status || "Aktif") !== "Pasif" &&
        studentBelongsToClassroom(student, selectedClass),
      )
      .sort((first, second) => {
        const firstNo = String(
          first?.studentNumber ?? first?.number ?? first?.schoolNumber ?? first?.schoolNo ?? first?.id ?? "",
        ).trim();
        const secondNo = String(
          second?.studentNumber ?? second?.number ?? second?.schoolNumber ?? second?.schoolNo ?? second?.id ?? "",
        ).trim();
        const numberOrder = firstNo.localeCompare(secondNo, "tr-TR", { numeric: true, sensitivity: "base" });
        if (numberOrder !== 0) return numberOrder;
        return String(first?.name || "").localeCompare(String(second?.name || ""), "tr-TR");
      });
  }, [selectedClass, students]);

  const distributionMembers = useMemo(() => {
    if (!selectedClass || !studentDistributionModal.groupId) return [] as any[];
    return (selectedClass.assignedCourses || []).filter(
      (item: any) => parallelGroupIdOf(item) === studentDistributionModal.groupId,
    );
  }, [selectedClass, studentDistributionModal.groupId]);

  const selectedCourseDefinition = selectedAssignedCourse
    ? pool.find(
        (item: any) => normalize(item.courseName) === normalize(selectedAssignedCourse.courseName),
      )
    : null;

  const selectedCourseBranch = isArtEducationCourseName(selectedAssignedCourse?.courseName)
    ? ""
    : String(
        selectedAssignedCourse?.branch ||
          selectedCourseDefinition?.branch ||
          "",
      ).trim();

  useEffect(() => {
    // Sanat Eğitimi (Müze) / Sanat Eğitimi (Drama) branşa bağlı değildir
    // ve iki öğretmenle yürütülebilir.
    setTeacherAssignmentMode(
      selectedAssignedCourse?.teacherId2 || isArtEducationCourseName(selectedAssignedCourse?.courseName) ? 2 : 1,
    );
  }, [selectedClassId, selectedAssignedCourseName, selectedAssignedCourse?.teacherId2]);


  const branchTeachers = useMemo(() => {
    if (!selectedAssignedCourse) return [];

    const branchKey = normalize(selectedCourseBranch);
    const courseKey = normalize(selectedAssignedCourse.courseName);
    const shouldShowAllTeachers =
      courseKey === "REHBERLİK VE YÖNLENDİRME" ||
      courseKey === "REHBERLİK VE YÖNLENDIRME" ||
      isArtEducationCourseName(selectedAssignedCourse.courseName) ||
      branchKey === "ÖĞRETMEN";

    // Rehberlik ve Yönlendirme ile Sanat Eğitimi derslerinde branş filtresi
    // uygulanmaz; kayıtlı tüm öğretmenler listelenir.
    if (shouldShowAllTeachers) {
      return [...teachers].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "tr-TR"),
      );
    }

    return [...teachers]
      .filter((teacher: any) => {
        // İdari görev, öğretmenin derse atanmasına engel değildir.
        // Normal derslerde yalnız branş eşleşmesi dikkate alınır.
        if (!branchKey) return false;
        return normalize(teacher?.branch) === branchKey;
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "tr-TR"));
  }, [teachers, selectedAssignedCourse, selectedCourseBranch]);

  const branchLoadSummary = useMemo(() => {
    const branchKey = normalize(selectedCourseBranch);
    if (!branchKey) {
      return {
        teacherRows: [] as any[],
        unassignedRows: [] as any[],
        totalHours: 0,
        assignedHours: 0,
        waitingHours: 0,
      };
    }

    const teacherMap = new Map<string, any>();
    branchTeachers.forEach((teacher: any) => {
      teacherMap.set(String(teacher.id), {
        teacher,
        assignments: [] as any[],
        totalHours: 0,
      });
    });

    const unassignedRows: any[] = [];
    let totalHours = 0;
    let assignedHours = 0;

    classrooms.forEach((classroom) => {
      (classroom.assignedCourses || []).forEach((course: any) => {
        const courseName = String(course?.courseName || "").trim();
        if (!courseName) return;

        const definition =
          pool.find((item: any) => normalize(item.courseName) === normalize(courseName)) || null;
        const branch = String(course?.branch || definition?.branch || "").trim();

        if (normalize(branch) !== branchKey) return;

        const hours = Number(course?.weeklyHours || definition?.weeklyHours || 0);
        totalHours += hours;

        if (course?.teacherId) {
          assignedHours += hours;
          const row = teacherMap.get(String(course.teacherId));
          if (row) {
            row.assignments.push({
              classroomName: classroom.name,
              courseName,
              hours,
            });
            row.totalHours += hours;
          }
        } else {
          unassignedRows.push({
            classroomName: classroom.name,
            courseName,
            hours,
          });
        }
      });
    });

    const teacherRows = [...teacherMap.values()]
      .map((row) => ({
        ...row,
        assignments: [...row.assignments].sort(
          (a, b) =>
            String(a.classroomName).localeCompare(String(b.classroomName), "tr-TR") ||
            String(a.courseName).localeCompare(String(b.courseName), "tr-TR"),
        ),
      }))
      .sort((a, b) => String(a.teacher.name).localeCompare(String(b.teacher.name), "tr-TR"));

    unassignedRows.sort(
      (a, b) =>
        String(a.classroomName).localeCompare(String(b.classroomName), "tr-TR") ||
        String(a.courseName).localeCompare(String(b.courseName), "tr-TR"),
    );

    return {
      teacherRows,
      unassignedRows,
      totalHours,
      assignedHours,
      waitingHours: Math.max(0, totalHours - assignedHours),
    };
  }, [selectedCourseBranch, branchTeachers, classrooms, pool]);

  const persistClasses = async (
    nextClassrooms: Classroom[],
    message: string,
  ) => {
    if (saving) return false;
    setSaving(true);
    try {
      // Bu ekran yalnızca sınıf dokümanlarındaki assignedCourses alanını değiştirir.
      // Tüm classrooms/courses/customCreatedCourses koleksiyonlarını transaction ile
      // baştan yazmak, başka koleksiyonlarda aynı id'li legacy kayıt varsa SQLite
      // PRIMARY KEY çakışmasına (collection_name + document_id) neden olabiliyordu.
      // Bu nedenle sadece gerçekten değişen sınıf dokümanlarını UPSERT ediyoruz.
      // classroomService.save() tek belgeyi ON CONFLICT ... DO UPDATE ile yazar;
      // mevcut öğretmeni kaldırma, yeni öğretmen seçme ve sınıfa ders ekleme bu sayede
      // başka koleksiyonlardaki mükerrer kayıtlardan etkilenmez.
      const previousById = new Map(
        classrooms.map((classroom) => [String(classroom.id), classroom]),
      );
      const changedById = new Map<string, Classroom>();

      nextClassrooms.forEach((classroom) => {
        const previous = previousById.get(String(classroom.id));
        if (!previous || JSON.stringify(previous) !== JSON.stringify(classroom)) {
          changedById.set(String(classroom.id), classroom);
        }
      });

      for (const classroom of changedById.values()) {
        await classroomService.save(classroom);
      }

      setClassrooms(nextClassrooms);
      notify(message);
      return true;
    } catch (error) {
      console.error("Sınıf ders/öğretmen ataması kalıcı olarak kaydedilemedi:", error);
      notify(`Atama kaydedilemedi: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openStudentDistribution = () => {
    if (!selectedClass || !selectedParallelGroupId) return;
    const members = (selectedClass.assignedCourses || []).filter(
      (item: any) => parallelGroupIdOf(item) === selectedParallelGroupId,
    );
    if (members.length < 2) {
      notify("Öğrenci dağılımı için önce en az iki dersi eş zamanlı/ortak ders olarak bağlayın.");
      return;
    }

    const validStudentIds = new Set(selectedClassStudents.map((student) => String(student.id)));
    const alreadyClaimed = new Set<string>();
    const draft: Record<string, string[]> = {};

    // Eski kayıtta aynı öğrenci yanlışlıkla iki derste bulunuyorsa ilk kaydı koruyup
    // diğerini temizleyerek modalı daima çakışmasız açıyoruz.
    members.forEach((member: any) => {
      const key = normalize(member?.courseName);
      const ids = (Array.isArray(member?.studentIds) ? member.studentIds : [])
        .map((id: unknown) => String(id))
        .filter((id: string) => validStudentIds.has(id) && !alreadyClaimed.has(id));
      ids.forEach((id: string) => alreadyClaimed.add(id));
      draft[key] = ids;
    });

    setStudentDistributionDraft(draft);
    setStudentDistributionSearch("");
    setStudentDistributionModal({ isOpen: true, groupId: selectedParallelGroupId });
  };

  const toggleStudentDistribution = (studentId: string, courseName: string) => {
    const targetKey = normalize(courseName);
    setStudentDistributionDraft((previous) => {
      const next: Record<string, string[]> = {};
      let wasSelectedInTarget = false;
      distributionMembers.forEach((member: any) => {
        const key = normalize(member?.courseName);
        const current = Array.isArray(previous[key]) ? previous[key] : [];
        if (key === targetKey && current.includes(studentId)) wasSelectedInTarget = true;
        next[key] = current.filter((id) => id !== studentId);
      });
      if (!wasSelectedInTarget) {
        next[targetKey] = [...(next[targetKey] || []), studentId];
      }
      return next;
    });
  };

  const clearStudentDistribution = () => {
    const cleared: Record<string, string[]> = {};
    distributionMembers.forEach((member: any) => {
      cleared[normalize(member?.courseName)] = [];
    });
    setStudentDistributionDraft(cleared);
  };

  const saveStudentDistribution = async () => {
    if (!selectedClass || !studentDistributionModal.groupId || saving) return;
    const validIds = new Set(selectedClassStudents.map((student) => String(student.id)));
    const assignedTo = new Map<string, string>();
    let duplicateFound = false;

    distributionMembers.forEach((member: any) => {
      const key = normalize(member?.courseName);
      (studentDistributionDraft[key] || []).forEach((studentId) => {
        if (!validIds.has(String(studentId))) return;
        if (assignedTo.has(String(studentId))) duplicateFound = true;
        assignedTo.set(String(studentId), key);
      });
    });

    if (duplicateFound) {
      notify("Bir öğrenci aynı ortak ders saatinde yalnızca bir derse atanabilir. Çakışan seçimi düzeltin.");
      return;
    }

    const unassigned = selectedClassStudents.filter((student) => !assignedTo.has(String(student.id)));
    if (unassigned.length > 0) {
      notify(`${unassigned.length} öğrenci henüz bir derse atanmadı. Tüm öğrencileri işaretledikten sonra kaydedin.`);
      return;
    }

    const updatedAt = new Date().toISOString();
    const nextClassrooms = classrooms.map((classroom) => {
      if (String(classroom.id) !== String(selectedClass.id)) return classroom;
      return {
        ...classroom,
        assignedCourses: (classroom.assignedCourses || []).map((item: any) => {
          if (parallelGroupIdOf(item) !== studentDistributionModal.groupId) return item;
          const key = normalize(item?.courseName);
          const ids = (studentDistributionDraft[key] || []).filter((id) => validIds.has(String(id)));
          return {
            ...item,
            studentIds: Array.from(new Set(ids)),
            studentDistributionMode: "manual",
            studentDistributionUpdatedAt: updatedAt,
          };
        }),
      };
    });

    const saved = await persistClasses(
      nextClassrooms,
      `${selectedClass.name}: ortak ders öğrenci dağılımı kaydedildi.`,
    );
    if (saved) {
      setStudentDistributionModal({ isOpen: false, groupId: "" });
      setStudentDistributionSearch("");
    }
  };

  const setClassParallelCourse = async (partnerCourseName: string) => {
    if (!selectedClass || !selectedAssignedCourse || saving) return;

    const sourceName = String(selectedAssignedCourse.courseName || "").trim();
    const sourceKey = normalize(sourceName);
    const currentGroupId = parallelGroupIdOf(selectedAssignedCourse);

    // "Bağımsız" seçildiğinde yalnız bu sınıftaki mevcut eş-zamanlı ilişkiyi çöz.
    if (!partnerCourseName) {
      if (!currentGroupId) {
        notify(`${sourceName} dersi zaten bağımsız.`);
        return;
      }

      const nextClassrooms = classrooms.map((classroom) => {
        if (String(classroom.id) !== String(selectedClass.id)) return classroom;
        return {
          ...classroom,
          assignedCourses: (classroom.assignedCourses || []).map((item: any) =>
            parallelGroupIdOf(item) === currentGroupId
              ? clearClassParallelFields(item)
              : item,
          ),
        };
      });

      await persistClasses(
        nextClassrooms,
        `${selectedClass.name} sınıfında ${sourceName} dersinin eş zamanlı ders ilişkisi kaldırıldı.`,
      );
      return;
    }

    const partner = (selectedClass.assignedCourses || []).find(
      (item: any) => normalize(item?.courseName) === normalize(partnerCourseName),
    );
    if (!partner) {
      notify(`Eş zamanlı yapılacak ders ${selectedClass.name} sınıfında bulunamadı.`);
      return;
    }
    if (normalize(partner.courseName) === sourceKey) {
      notify("Bir ders kendisiyle eş zamanlı yapılamaz.");
      return;
    }

    const sourceHours = Number(selectedAssignedCourse.weeklyHours || 0);
    const partnerHours = Number(partner.weeklyHours || 0);
    if (sourceHours !== partnerHours) {
      notify(
        `Eş zamanlı yapılacak derslerin haftalık saati aynı olmalıdır. ${sourceName}: ${sourceHours} saat, ${partner.courseName}: ${partnerHours} saat.`,
      );
      return;
    }

    const sourceTeachers = teacherKeysForParallelCheck(selectedAssignedCourse);
    const partnerTeachers = teacherKeysForParallelCheck(partner);
    const sameTeacher = sourceTeachers.find((teacherId) => partnerTeachers.includes(teacherId));
    if (sameTeacher) {
      const teacher = teachers.find((item) => String(item.id) === sameTeacher);
      notify(
        `${teacher?.name || "Aynı öğretmen"} iki eş zamanlı derse birden atanamaz. Önce öğretmen atamasını değiştirin.`,
      );
      return;
    }

    const groupIdsToClear = new Set(
      [currentGroupId, parallelGroupIdOf(partner)].filter(Boolean),
    );
    const groupId = `parallel-${String(selectedClass.id)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const nextClassrooms = classrooms.map((classroom) => {
      if (String(classroom.id) !== String(selectedClass.id)) return classroom;

      const cleaned = (classroom.assignedCourses || []).map((item: any) =>
        groupIdsToClear.has(parallelGroupIdOf(item))
          ? clearClassParallelFields(item)
          : item,
      );

      return {
        ...classroom,
        assignedCourses: cleaned.map((item: any) => {
          const itemKey = normalize(item?.courseName);
          if (itemKey === sourceKey) {
            return {
              ...item,
              splitGroupId: groupId,
              parallelGroupId: groupId,
              parallelCourseName: String(partner.courseName || ""),
              parallelRelationScope: "class",
              studentIds: [],
              studentDistributionMode: "manual",
            };
          }
          if (itemKey === normalize(partner.courseName)) {
            return {
              ...item,
              splitGroupId: groupId,
              parallelGroupId: groupId,
              parallelCourseName: sourceName,
              parallelRelationScope: "class",
              studentIds: [],
              studentDistributionMode: "manual",
            };
          }
          return item;
        }),
      };
    });

    await persistClasses(
      nextClassrooms,
      `${selectedClass.name}: ${sourceName} + ${partner.courseName} aynı ders saatinde birlikte dağıtılacak.`,
    );
  };

  const addCourse = async (poolCourse: any) => {
    if (!selectedClass || saving) return;
    if (assignedKeys.has(poolCourse.key)) {
      notify(`${poolCourse.courseName} zaten ${selectedClass.name} sınıfına atanmış.`);
      return;
    }

    const nextClassrooms = classrooms.map((classroom) =>
      classroom.id === selectedClass.id
        ? {
            ...classroom,
            assignedCourses: [
              ...(classroom.assignedCourses || []),
              {
                id: `assigned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                courseName: poolCourse.courseName,
                weeklyHours: Number(poolCourse.weeklyHours || 0),
                teacherId: "",
                teacherName: "Öğretmen Atanmadı",
                teacherAssignmentCleared: true,
                type: poolCourse.type,
                branch: poolCourse.branch,
                targetGroups: poolCourse.targetGroups,
                groupName: poolCourse.courseGroup,
              } as any,
            ],
          }
        : classroom,
    );

    await persistClasses(
      nextClassrooms,
      `${poolCourse.courseName} → ${selectedClass.name} sınıfına atandı.`,
    );
  };

  const removeCourse = async (courseName: string) => {
    if (!selectedClass || saving) return;

    const approved = window.confirm(
      `"${courseName}" dersini ${selectedClass.name} sınıfından kaldırmak istiyor musunuz?`,
    );
    if (!approved) return;

    const courseKey = normalize(courseName);
    const beforeCount = (selectedClass.assignedCourses || []).length;
    const removedCourse = (selectedClass.assignedCourses || []).find(
      (item: any) => normalize(item.courseName) === courseKey,
    );
    const removedParallelGroupId = parallelGroupIdOf(removedCourse);

    const nextClassrooms = classrooms.map((classroom) =>
      classroom.id === selectedClass.id
        ? {
            ...classroom,
            assignedCourses: (classroom.assignedCourses || [])
              .filter((item: any) => normalize(item.courseName) !== courseKey)
              .map((item: any) =>
                removedParallelGroupId && parallelGroupIdOf(item) === removedParallelGroupId
                  ? clearClassParallelFields(item)
                  : item,
              ),
          }
        : classroom,
    );

    const updatedClass = nextClassrooms.find((classroom) => classroom.id === selectedClass.id);
    const afterCount = (updatedClass?.assignedCourses || []).length;

    if (afterCount >= beforeCount) {
      notify(`${courseName} dersi sınıf kaydında bulunamadığı için kaldırılamadı.`);
      return;
    }

    await persistClasses(
      nextClassrooms,
      `${courseName} dersi ${selectedClass.name} sınıfından kalıcı olarak kaldırıldı.`,
    );
  };

  const assignTeacher = async (teacher: Teacher) => {
    if (!selectedClass || !selectedAssignedCourse || saving) return;

    const parallelGroupId=String(
      (selectedAssignedCourse as any).parallelGroupId || selectedAssignedCourse.splitGroupId || "",
    ).trim();
    if (parallelGroupId) {
      const parallelSibling=(selectedClass.assignedCourses||[]).find((item:any)=>
        item!==selectedAssignedCourse &&
        String(item?.parallelGroupId || item?.splitGroupId || "").trim()===parallelGroupId
      );
      if (parallelSibling) {
        const siblingTeacherIds=[parallelSibling.teacherId,parallelSibling.teacherId2]
          .map((id:any)=>String(id||""))
          .filter(Boolean);
        if (siblingTeacherIds.includes(String(teacher.id))) {
          notify(`${teacher.name} öğretmeni eş zamanlı yürütülen “${parallelSibling.courseName}” dersine zaten atanmış. Paralel derslerde farklı öğretmenler kullanılmalıdır.`);
          return;
        }
      }
    }

    const currentFirstId = String(selectedAssignedCourse.teacherId || "");
    const currentSecondId = String(selectedAssignedCourse.teacherId2 || "");

    let nextTeacherId = currentFirstId;
    let nextTeacherName = String(selectedAssignedCourse.teacherName || "");
    let nextTeacherId2 = currentSecondId;
    let nextTeacherName2 = String(selectedAssignedCourse.teacherName2 || "");

    if (teacherAssignmentMode === 1) {
      nextTeacherId = teacher.id;
      nextTeacherName = teacher.name;
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    } else if (String(teacher.id) === currentFirstId) {
      // 1. öğretmene tekrar tıklanırsa seçimi kaldır.
      nextTeacherId = currentSecondId;
      nextTeacherName = String(selectedAssignedCourse.teacherName2 || "");
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    } else if (String(teacher.id) === currentSecondId) {
      // 2. öğretmene tekrar tıklanırsa yalnız ikinci seçimi kaldır.
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    } else if (!currentFirstId) {
      nextTeacherId = teacher.id;
      nextTeacherName = teacher.name;
    } else {
      nextTeacherId2 = teacher.id;
      nextTeacherName2 = teacher.name;
    }

    const nextClassrooms = classrooms.map((classroom) => {
      const isSourceClass = classroom.id === selectedClass.id;
      const hasMirroredCommonCourse = !isSourceClass && (classroom.assignedCourses || []).some(
        (item: any) =>
          shouldMirrorCommonCourseAssignment(
            selectedClass,
            classroom,
            selectedAssignedCourse,
            item,
          ),
      );

      if (!isSourceClass && !hasMirroredCommonCourse) return classroom;

      return {
        ...classroom,
        assignedCourses: (classroom.assignedCourses || []).map((item: any) => {
          const shouldUpdate = isSourceClass
            ? courseIdentityKey(item) === courseIdentityKey(selectedAssignedCourse)
            : shouldMirrorCommonCourseAssignment(
                selectedClass,
                classroom,
                selectedAssignedCourse,
                item,
              );

          return shouldUpdate
            ? {
                ...item,
                teacherId: nextTeacherId || "",
                teacherName: nextTeacherId ? nextTeacherName : "Öğretmen Atanmadı",
                teacherId2: nextTeacherId2 || "",
                teacherName2: nextTeacherId2 ? nextTeacherName2 : "",
                teacherAssignmentCleared: !(nextTeacherId || nextTeacherId2),
              }
            : item;
        }),
      };
    });

    const label =
      teacherAssignmentMode === 2 && nextTeacherId && nextTeacherId2
        ? `${nextTeacherName} + ${nextTeacherName2}`
        : nextTeacherName || nextTeacherName2 || "Öğretmen ataması kaldırıldı";

    await persistClasses(
      nextClassrooms,
      `${label} → ${selectedClass.name} / ${selectedAssignedCourse.courseName}`,
    );
  };

  const unassignTeacher = async (teacher: Teacher) => {
    if (!selectedClass || !selectedAssignedCourse || saving) return;

    const currentFirstId = String(selectedAssignedCourse.teacherId || "");
    const currentSecondId = String(selectedAssignedCourse.teacherId2 || "");

    if (String(teacher.id) !== currentFirstId && String(teacher.id) !== currentSecondId) {
      return;
    }

    let nextTeacherId = currentFirstId;
    let nextTeacherName = String(selectedAssignedCourse.teacherName || "");
    let nextTeacherId2 = currentSecondId;
    let nextTeacherName2 = String(selectedAssignedCourse.teacherName2 || "");

    if (String(teacher.id) === currentFirstId) {
      // 1. öğretmen kaldırılırsa varsa 2. öğretmeni birinci sıraya taşı.
      nextTeacherId = currentSecondId;
      nextTeacherName = String(selectedAssignedCourse.teacherName2 || "");
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    } else {
      nextTeacherId2 = "";
      nextTeacherName2 = "";
    }

    const nextClassrooms = classrooms.map((classroom) => {
      const isSourceClass = classroom.id === selectedClass.id;
      const hasMirroredCommonCourse = !isSourceClass && (classroom.assignedCourses || []).some(
        (item: any) =>
          shouldMirrorCommonCourseAssignment(
            selectedClass,
            classroom,
            selectedAssignedCourse,
            item,
          ),
      );

      if (!isSourceClass && !hasMirroredCommonCourse) return classroom;

      return {
        ...classroom,
        assignedCourses: (classroom.assignedCourses || []).map((item: any) => {
          const shouldUpdate = isSourceClass
            ? courseIdentityKey(item) === courseIdentityKey(selectedAssignedCourse)
            : shouldMirrorCommonCourseAssignment(
                selectedClass,
                classroom,
                selectedAssignedCourse,
                item,
              );

          return shouldUpdate
            ? {
                ...item,
                teacherId: nextTeacherId || "",
                teacherName: nextTeacherId ? nextTeacherName : "Öğretmen Atanmadı",
                teacherId2: nextTeacherId2 || "",
                teacherName2: nextTeacherId2 ? nextTeacherName2 : "",
                teacherAssignmentCleared: !(nextTeacherId || nextTeacherId2),
              }
            : item;
        }),
      };
    });

    await persistClasses(
      nextClassrooms,
      `${teacher.name} → ${selectedClass.name} / ${selectedAssignedCourse.courseName} ataması kaldırıldı`,
    );
  };

  const clearSelectedCourseTeachers = async () => {
    if (!selectedClass || !selectedAssignedCourse || saving) return;

    const hasAnyTeacher = Boolean(
      String(selectedAssignedCourse.teacherId || "") ||
      String(selectedAssignedCourse.teacherId2 || ""),
    );
    if (!hasAnyTeacher) {
      notify(`${selectedClass.name} / ${selectedAssignedCourse.courseName} dersinde atanmış öğretmen yok.`);
      return;
    }

    const nextClassrooms = classrooms.map((classroom) => {
      const isSourceClass = String(classroom.id) === String(selectedClass.id);
      const hasMirroredCommonCourse = !isSourceClass && (classroom.assignedCourses || []).some(
        (item: any) =>
          shouldMirrorCommonCourseAssignment(
            selectedClass,
            classroom,
            selectedAssignedCourse,
            item,
          ),
      );

      if (!isSourceClass && !hasMirroredCommonCourse) return classroom;

      return {
        ...classroom,
        assignedCourses: (classroom.assignedCourses || []).map((item: any) => {
          const shouldUpdate = isSourceClass
            ? courseIdentityKey(item) === courseIdentityKey(selectedAssignedCourse)
            : shouldMirrorCommonCourseAssignment(
                selectedClass,
                classroom,
                selectedAssignedCourse,
                item,
              );

          return shouldUpdate
            ? {
                ...item,
                teacherId: "",
                teacherName: "Öğretmen Atanmadı",
                teacherId2: "",
                teacherName2: "",
                teacherAssignmentCleared: true,
              }
            : item;
        }),
      };
    });

    await persistClasses(
      nextClassrooms,
      `${selectedClass.name} / ${selectedAssignedCourse.courseName} öğretmen ataması kaldırıldı.`,
    );
  };

  const copyClassCourses = (classId: string) => {
    const classroom = classrooms.find((item) => item.id === classId);
    if (!classroom) return;

    const copied = (classroom.assignedCourses || []).map((item: any) => ({
      courseName: item.courseName,
      weeklyHours: Number(item.weeklyHours || 0),
      type: item.type,
      branch: item.branch,
      targetGroups: item.targetGroups ? [...item.targetGroups] : undefined,
      groupName: item.groupName,
    }));

    setCopiedClass({ id: classroom.id, name: classroom.name, courses: copied });
    setContextMenu(null);
    notify(`${classroom.name} sınıfının ${copied.length} ders kaydı kopyalandı.`);
  };

  const pasteClassCourses = async (targetClassId: string) => {
    if (!copiedClass || saving) return;
    const target = classrooms.find((item) => item.id === targetClassId);
    if (!target) return;

    const existing = new Map(
      (target.assignedCourses || []).map((item: any) => [normalize(item.courseName), item]),
    );

    copiedClass.courses.forEach((item) => {
      const key = normalize(item.courseName);
      if (existing.has(key)) return;

      existing.set(key, {
        id: `assigned-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        courseName: item.courseName,
        weeklyHours: Number(item.weeklyHours || 0),
        teacherId: "",
        teacherName: "Öğretmen Atanmadı",
        teacherAssignmentCleared: true,
        type: item.type,
        branch: item.branch,
        targetGroups: item.targetGroups ? [...item.targetGroups] : undefined,
        groupName: item.groupName,
      });
    });

    const mergedAssignments = [...existing.values()];

    const nextClassrooms = classrooms.map((classroom) =>
      classroom.id === targetClassId
        ? { ...classroom, assignedCourses: mergedAssignments }
        : classroom,
    );

    setContextMenu(null);
    setSelectedClassId(targetClassId);
    await persistClasses(
      nextClassrooms,
      `${copiedClass.name} sınıfının dersleri ${target.name} sınıfına kopyalandı. Öğretmen atamaları kopyalanmadı.`,
    );
  };

  const groupedClasses = [9, 10, 11, 12]
    .filter((grade) => visibleGrades.includes(grade))
    .map((grade) => ({
      grade,
      items: [...classrooms]
        .filter((classroom) => getLevelNumber(classroom.level) === grade)
        .sort(compareClassrooms),
    }))
    .filter((group) => group.items.length > 0);

  const visibleClassrooms = groupedClasses.flatMap((group) => group.items);

  useEffect(() => {
    if (!focusedClassroom) return;
    setSelectedClassId(String(focusedClassroom.id));
    const grade = getLevelNumber(focusedClassroom.level);
    if (grade !== 999) setVisibleGrades([grade]);
    setSelectedAssignedCourseName("");
  }, [focusClassroomId, focusedClassroom?.id]);

  useEffect(() => {
    if (focusedClassroom) return;
    if (visibleClassrooms.length === 0) return;
    if (!visibleClassrooms.some((classroom) => classroom.id === selectedClassId)) {
      setSelectedClassId(visibleClassrooms[0].id);
      setSelectedAssignedCourseName("");
    }
  }, [visibleGrades, classrooms]);

  useEffect(() => {
    setSelectedAssignedCourseName("");
  }, [selectedClassId]);

  const toggleGrade = (grade: number) => {
    setVisibleGrades((current) => {
      if (current.includes(grade)) {
        return current.filter((item) => item !== grade);
      }
      return [...current, grade].sort((a, b) => a - b);
    });
  };

  return (
    <div
      className={`relative grid h-[calc(100vh-174px)] min-h-[636px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${
        focusedClassroom
          ? "grid-cols-[minmax(520px,1.25fr)_minmax(340px,0.9fr)]"
          : "grid-cols-[220px_minmax(480px,1.35fr)_minmax(320px,0.9fr)]"
      }`}
      onClick={() => contextMenu && setContextMenu(null)}
    >
      {/* 1. sütun: sınıflar - kısayol modunda gizlenir */}
      {!focusedClassroom && <aside className="border-r border-slate-200 bg-slate-50/70">
        <div className="border-b border-slate-200 px-3 py-3">
          <h3 className="text-sm font-black text-slate-900">Sınıflar</h3>

          <div className="mt-2 grid grid-cols-4 gap-1">
            {[9, 10, 11, 12].map((grade) => {
              const checked = visibleGrades.includes(grade);
              return (
                <label
                  key={grade}
                  className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[10px] font-black transition ${
                    checked
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGrade(grade)}
                    className="h-3.5 w-3.5 accent-emerald-600"
                  />
                  {grade}
                </label>
              );
            })}
          </div>

          <p className="mt-2 text-[9px] font-semibold text-slate-400">
            İşaretlenen sınıf düzeylerinin şubeleri gösterilir.
          </p>
          <p className="mt-1 text-[9px] font-semibold text-slate-400">
            Sağ tık: Kopyala / Yapıştır
          </p>
        </div>

        <div className="h-[calc(100%-104px)] overflow-y-auto p-2">
          {visibleGrades.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-[10px] font-bold text-slate-400">
              Sınıfları görmek için 9, 10, 11 veya 12. sınıf düzeylerinden en az birini seçiniz.
            </div>
          )}

          {groupedClasses.map((group) => (
            <div key={group.grade} className="mb-3">
              <div className="mb-1 px-2 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                {group.grade}. Sınıf
              </div>
              <div className="space-y-1">
                {group.items.map((classroom) => {
                  const active = selectedClass?.id === classroom.id;
                  const hours = (classroom.assignedCourses || []).reduce(
                    (sum: number, item: any) => sum + Number(item.weeklyHours || 0),
                    0,
                  );

                  return (
                    <button
                      key={classroom.id}
                      type="button"
                      onClick={() => setSelectedClassId(classroom.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedClassId(classroom.id);
                        setContextMenu({
                          x: event.clientX,
                          y: event.clientY,
                          classId: classroom.id,
                        });
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm"
                          : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="min-w-0 flex-1 truncate text-xs font-black">
                          {classroom.name}
                        </div>

                        {[11, 12].includes(getLevelNumber(classroom.level)) && (
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                              active
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {getClassGroupLabel(classroom)}
                          </span>
                        )}
                      </div>

                      <span className={`ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                        active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        {hours}s
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>}

      {/* 2. sütun: atanmış dersler */}
      <section className="border-r border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-emerald-50/50 px-4 py-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              {selectedClass?.name || "Sınıf seçiniz"} — Atanmış Dersler
            </h3>
            <p className="mt-1 text-[12px] font-semibold text-slate-500">
              Tek tık: öğretmen atama • Sağ panelden eş zamanlı ders seç • Silmek için çöp kutusu
            </p>
          </div>
          <Check className="h-5 w-5 text-emerald-600" />
        </div>

        <div className="h-[calc(100%-62px)] overflow-y-auto">
          <table className="w-full table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-left text-[9px] font-black uppercase tracking-wide text-slate-400">
                <th className="border-b border-slate-200 px-2 py-1.5">Ders</th>
                <th className="w-[190px] border-b border-slate-200 px-2 py-1.5">Atanan Öğretmen</th>
                <th className="w-[82px] border-b border-slate-200 px-1.5 py-1.5 text-center">Saat</th>
                <th className="w-[42px] border-b border-slate-200 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {assigned.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-xs font-bold text-slate-400">
                    Bu sınıfa henüz ders atanmamış.
                  </td>
                </tr>
              ) : (
                assigned.map((item: any) => (
                  <tr
                    key={`${selectedClass?.id}-${normalize(item.courseName)}`}
                    onClick={() => setSelectedAssignedCourseName(item.courseName)}
                    className={`cursor-pointer border-b border-slate-100 bg-white hover:bg-slate-50 ${
                      normalize(selectedAssignedCourseName) === normalize(item.courseName)
                        ? "ring-2 ring-inset ring-indigo-400"
                        : ""
                    }`}
                    title="Tek tıklayınca bu dersin branş öğretmenleri gösterilir"
                  >
                    <td className="px-2 py-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {isCommonCourseForSelectedClass(item.courseName) && (
                          <Check
                            className="h-4 w-4 shrink-0 stroke-[3] text-red-600"
                            aria-label="Ortak ders"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-black leading-tight text-slate-800">
                            {item.courseName}
                          </div>
                          {(() => {
                            const groupId = parallelGroupIdOf(item);
                            if (!groupId) return null;
                            const sibling = assigned.find(
                              (candidate: any) =>
                                candidate !== item && parallelGroupIdOf(candidate) === groupId,
                            );
                            if (!sibling) return null;
                            return (
                              <div className="mt-0.5 truncate text-[9px] font-black text-violet-600">
                                ↔ {sibling.courseName}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className={`truncate text-[12px] font-black leading-tight ${
                        item.teacherId ? "text-red-600" : "text-slate-400"
                      }`}>
                        {item.teacherId && item.teacherName
                          ? item.teacherName
                          : "Öğretmen atanmadı"}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 text-center text-[12px] font-black text-slate-700">
                      {Number(item.weeklyHours || 0)}
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeCourse(item.courseName);
                        }}
                        className="rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                        title="Dersi kaldır"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-emerald-50">
              <tr>
                <td className="border-t border-emerald-200 px-2 py-2 text-[12px] font-black text-emerald-900">
                  Haftalık Toplam
                </td>
                <td className="border-t border-emerald-200" />
                <td className="border-t border-emerald-200 px-1.5 py-2 text-center text-base font-black text-emerald-700">
                  {totalHours}
                </td>
                <td className="border-t border-emerald-200" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 3. sütun: ders havuzu veya seçili dersin branş öğretmenleri */}
      <section className="min-h-0">
        {selectedAssignedCourse ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 bg-indigo-50/70 px-4 py-3">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setBranchLoadModalOpen(true)}
                  className="truncate text-left text-base font-black text-indigo-800 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-950"
                  title="Branş ders yükü ve atama durumunu aç"
                >
                  Branş Öğretmenleri
                </button>
                <p className="mt-1 truncate text-[12px] font-bold text-slate-500">
                  {selectedAssignedCourse.courseName}
                  {selectedCourseBranch ? ` • ${selectedCourseBranch}` : ""}
                </p>
              </div>
              {(selectedAssignedCourse.teacherId || selectedAssignedCourse.teacherId2) && (
                <button
                  type="button"
                  onClick={() => void clearSelectedCourseTeachers()}
                  disabled={saving}
                  className="ml-auto mr-2 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  title="Bu dersteki mevcut öğretmen atamasını kaldır"
                >
                  Atamayı Kaldır
                </button>
              )}
              <div className="mr-2 flex rounded-lg border border-indigo-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setTeacherAssignmentMode(1)}
                  className={`rounded-md px-2 py-1 text-[10px] font-black transition ${
                    teacherAssignmentMode === 1
                      ? "bg-indigo-600 text-white"
                      : "text-slate-500 hover:bg-indigo-50"
                  }`}
                >
                  1 Öğretmen
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherAssignmentMode(2)}
                  className={`rounded-md px-2 py-1 text-[10px] font-black transition ${
                    teacherAssignmentMode === 2
                      ? "bg-indigo-600 text-white"
                      : "text-slate-500 hover:bg-indigo-50"
                  }`}
                >
                  2 Öğretmen
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssignedCourseName("")}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
                title="Ders havuzuna dön"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-[calc(100%-66px)] overflow-y-auto p-2">
              <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-[11px] font-black text-violet-900">
                    Bu sınıfta eş zamanlı ders
                  </label>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-violet-600">
                    Yalnız {selectedClass?.name}
                  </span>
                </div>
                <select
                  value={selectedParallelPartner?.courseName || ""}
                  onChange={(event) => void setClassParallelCourse(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-violet-400 disabled:opacity-50"
                  title="Bu sınıfta seçili dersle aynı ders saatinde yürütülecek diğer dersi seçin"
                >
                  <option value="">Bağımsız ders</option>
                  {assigned
                    .filter(
                      (item: any) =>
                        normalize(item.courseName) !== normalize(selectedAssignedCourse.courseName),
                    )
                    .map((item: any) => (
                      <option key={`parallel-${normalize(item.courseName)}`} value={item.courseName}>
                        {item.courseName} ({Number(item.weeklyHours || 0)} s.)
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-[9px] font-semibold leading-relaxed text-violet-700">
                  Önce iki dersi de bu sınıfa atayın. Buradan ortaklaştırdığınız dersler ders dağıtımında aynı hücreye, kendi öğretmenleriyle birlikte yerleşir.
                </p>
                {selectedParallelPartner && (
                  <div className="mt-3 rounded-xl border border-violet-200 bg-white p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black text-slate-800">Öğrenci dağılımı</div>
                        <div className="mt-0.5 text-[9px] font-semibold leading-relaxed text-slate-500">
                          Alan/grup oluşturmadan, bu sınıftaki öğrencilerin hangi derse gideceğini tek tek işaretleyin.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={openStudentDistribution}
                        disabled={saving}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                      >
                        <UserRound className="h-3.5 w-3.5" />
                        Öğrencileri Dağıt
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {[selectedAssignedCourse, selectedParallelPartner].filter(Boolean).map((member: any) => (
                        <div key={`distribution-count-${normalize(member.courseName)}`} className="rounded-lg bg-violet-50 px-2 py-1.5 text-[9px] font-bold text-violet-800">
                          <span className="block truncate">{member.courseName}</span>
                          <span className="text-violet-600">{Array.isArray(member.studentIds) ? member.studentIds.length : 0} öğrenci</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {branchTeachers.map((teacher: any) => {
                const isFirstTeacher = String(selectedAssignedCourse.teacherId || "") === String(teacher.id);
                const isSecondTeacher = String(selectedAssignedCourse.teacherId2 || "") === String(teacher.id);
                const assignedTeacher = isFirstTeacher || isSecondTeacher;
                const hourSummary = buildTeacherHourSummary(classrooms, teacher.id);
                const isHoursOpen = openTeacherHoursId === teacher.id;
                return (
                  <div key={teacher.id} className="relative mb-1 flex w-full items-stretch gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (saving) return;
                        if (assignedTeacher) {
                          void unassignTeacher(teacher);
                        } else {
                          void assignTeacher(teacher);
                        }
                      }}
                      disabled={saving}
                      className={`flex min-w-0 flex-1 items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                        assignedTeacher ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/60"
                      }`}
                      title={assignedTeacher ? "Tek tıklayınca bu öğretmenin ders ataması kaldırılır" : teacherAssignmentMode === 2 ? "Tek tıklayın: 1. / 2. öğretmen olarak atanır" : "Tek tıklayınca seçili derse atanır"}
                    >
                      <span className="truncate text-[14px] font-black text-slate-800">{teacher.name}</span>
                      <span className="ml-2 flex shrink-0 items-center gap-1">
                        {isFirstTeacher && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-black text-white">1</span>}
                        {isSecondTeacher && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-black text-white">2</span>}
                        {assignedTeacher && <UserRound className="h-4 w-4 text-indigo-600" />}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); setOpenTeacherHoursId(isHoursOpen ? null : teacher.id); }}
                      className="min-w-[44px] rounded-lg border border-rose-100 bg-rose-50 px-2 text-center text-[12px] font-black text-rose-600 hover:bg-rose-100"
                      title="Toplam ders saati ve sınıf dağılımı"
                    >{hourSummary.total}</button>
                    {isHoursOpen && (
                      <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="truncate text-[11px] font-black text-slate-800">{teacher.name}</span>
                          <span className="text-[12px] font-black text-rose-600">{hourSummary.total} saat</span>
                        </div>
                        <div className="max-h-56 space-y-1 overflow-y-auto">
                          {hourSummary.details.length === 0 ? <div className="py-3 text-center text-[11px] font-semibold text-slate-400">Henüz ders atanmamış.</div> :
                            hourSummary.details.map((item, index) => (
                              <div key={`${item.className}-${item.courseName}-${index}`} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-2">
                                <div className="min-w-0"><div className="truncate text-[11px] font-black text-slate-700">{item.className}</div><div className="truncate text-[10px] font-semibold text-slate-500">{item.courseName}</div></div>
                                <span className="shrink-0 text-[11px] font-black text-rose-600">{item.hours} sa.</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {branchTeachers.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-[12px] font-bold text-slate-400">
                  {selectedCourseBranch
                    ? `${selectedCourseBranch} branşında kayıtlı öğretmen bulunamadı.`
                    : "Bu dersin branş bilgisi bulunamadı."}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50/50 px-4 py-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Ders Havuzu</h3>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                  Seçili sınıfa atamak için derse tek tıklayın.
                </p>
              </div>
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>

            <div className="h-[calc(100%-66px)] overflow-y-auto">
              <table className="w-full table-fixed border-collapse">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
                    <th className="border-b border-slate-200 px-2 py-1.5">Ders</th>
                    <th className="w-[92px] border-b border-slate-200 px-1.5 py-1.5 text-center">Haftalık Saat</th>
                  </tr>
                </thead>
                <tbody>
                  {pool.map((item) => {
                    const alreadyAssigned = assignedKeys.has(item.key);
                    const elective = isElective(item);
                    const htElective = isHtElective(item);

                    return (
                      <tr
                        key={item.key}
                        onClick={() => !alreadyAssigned && void addCourse(item)}
                        className={`border-b border-white/70 ${
                          alreadyAssigned
                            ? "cursor-not-allowed bg-slate-50 opacity-40"
                            : htElective
                              ? "cursor-copy bg-pink-50 hover:bg-pink-100"
                              : elective
                                ? "cursor-copy bg-yellow-50 hover:bg-yellow-100"
                                : "cursor-copy bg-emerald-50 hover:bg-emerald-100"
                        }`}
                        title={
                          alreadyAssigned
                            ? "Bu ders zaten sınıfa atanmış."
                            : "Tek tıklayınca seçili sınıfa atanır."
                        }
                      >
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              htElective ? "bg-pink-500" : elective ? "bg-yellow-500" : "bg-emerald-600"
                            }`} />
                            <div className="truncate text-[14px] font-black leading-tight text-slate-800">
                              {item.courseName}
                            </div>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center text-[12px] font-black text-slate-700">
                          {Number(item.weeklyHours || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {branchLoadModalOpen && selectedAssignedCourse && (
        <div className="fixed inset-0 z-[10000] flex items-stretch justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-indigo-950 px-6 py-4 text-white">
              <div>
                <h2 className="text-xl font-black">
                  {selectedCourseBranch || "Branş"} — Ders Yükü ve Öğretmen Atamaları
                </h2>
                <p className="mt-1 text-xs font-semibold text-indigo-200">
                  Öğretmen bazında sınıf, ders ve haftalık ders saati dağılımı
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBranchLoadModalOpen(false)}
                className="rounded-xl border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_0.85fr]">
              <section className="min-h-0 overflow-y-auto border-r border-slate-200 p-4">
                <div className="mb-3 text-sm font-black text-slate-900">
                  Branş Öğretmenleri ve Ders Yükleri
                </div>

                <div className="space-y-3">
                  {branchLoadSummary.teacherRows.map((row: any) => (
                    <div
                      key={row.teacher.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    >
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                        <span className="text-sm font-black text-slate-900">
                          {row.teacher.name}
                        </span>
                        <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-black text-indigo-800">
                          {row.totalHours} saat
                        </span>
                      </div>

                      {row.assignments.length > 0 ? (
                        <table className="w-full table-fixed border-collapse">
                          <thead>
                            <tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-400">
                              <th className="w-[28%] border-t border-slate-100 px-3 py-2">Sınıf</th>
                              <th className="border-t border-slate-100 px-3 py-2">Ders</th>
                              <th className="w-[90px] border-t border-slate-100 px-3 py-2 text-center">Saat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.assignments.map((assignment: any, index: number) => (
                              <tr key={`${row.teacher.id}-${index}`} className="border-t border-slate-100">
                                <td className="px-3 py-2 text-xs font-black text-slate-700">
                                  {assignment.classroomName}
                                </td>
                                <td className="px-3 py-2 text-xs font-bold text-slate-700">
                                  {assignment.courseName}
                                </td>
                                <td className="px-3 py-2 text-center text-xs font-black text-slate-700">
                                  {assignment.hours}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="px-4 py-3 text-xs font-bold text-slate-400">
                          Bu öğretmene henüz ders atanmamış.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-h-0 overflow-y-auto p-4">
                <div className="mb-3 text-sm font-black text-slate-900">
                  Öğretmen Ataması Bekleyen Dersler
                </div>

                {branchLoadSummary.unassignedRows.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/30">
                    <table className="w-full table-fixed border-collapse">
                      <thead className="bg-rose-50">
                        <tr className="text-left text-[10px] font-black uppercase tracking-wide text-rose-500">
                          <th className="w-[28%] px-3 py-2">Sınıf</th>
                          <th className="px-3 py-2">Ders</th>
                          <th className="w-[90px] px-3 py-2 text-center">Saat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchLoadSummary.unassignedRows.map((row: any, index: number) => (
                          <tr key={`unassigned-${index}`} className="border-t border-rose-100">
                            <td className="px-3 py-2 text-xs font-black text-slate-700">
                              {row.classroomName}
                            </td>
                            <td className="px-3 py-2 text-xs font-bold text-slate-700">
                              {row.courseName}
                            </td>
                            <td className="px-3 py-2 text-center text-xs font-black text-rose-700">
                              {row.hours}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-black text-emerald-700">
                    Bu branşta öğretmen ataması bekleyen ders bulunmuyor.
                  </div>
                )}
              </section>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-slate-200 bg-slate-50 p-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Branş Toplam Ders Saati
                </div>
                <div className="mt-1 text-2xl font-black text-slate-900">
                  {branchLoadSummary.totalHours}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                <div className="text-[10px] font-black uppercase tracking-wide text-emerald-500">
                  Atanan Ders Saati
                </div>
                <div className="mt-1 text-2xl font-black text-emerald-700">
                  {branchLoadSummary.assignedHours}
                </div>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center">
                <div className="text-[10px] font-black uppercase tracking-wide text-rose-500">
                  Atamayı Bekleyen Ders Saati
                </div>
                <div className="mt-1 text-2xl font-black text-rose-700">
                  {branchLoadSummary.waitingHours}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {studentDistributionModal.isOpen && selectedClass && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          {(() => {
            const searchKey = normalize(studentDistributionSearch);
            const filteredStudents = selectedClassStudents.filter((student) => {
              if (!searchKey) return true;
              const number = String(student?.studentNumber ?? student?.number ?? "");
              return (
                normalize(student?.name).includes(searchKey) ||
                normalize(number).includes(searchKey)
              );
            });
            const assignedIds = new Set(
              Object.values(studentDistributionDraft).flatMap((ids) => ids || []),
            );
            const unassignedCount = selectedClassStudents.filter(
              (student) => !assignedIds.has(String(student.id)),
            ).length;

            return (
              <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-violet-100 bg-violet-50 px-6 py-5">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-600">
                      Ortaklaştırılmış Ders
                    </div>
                    <h3 className="mt-1 text-xl font-black text-slate-900">
                      {selectedClass.name} — Öğrenci Dağılımı
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Öğrenciler alan grubuna ayrılmaz. Yalnız bu ortak ders saatinde hangi derse gidecekleri belirlenir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentDistributionModal({ isOpen: false, groupId: "" });
                      setStudentDistributionSearch("");
                    }}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                    title="Kapat"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid gap-3 border-b border-slate-100 bg-white px-6 py-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="flex flex-wrap gap-2">
                    {distributionMembers.map((member: any) => {
                      const key = normalize(member?.courseName);
                      const count = (studentDistributionDraft[key] || []).length;
                      return (
                        <div key={`distribution-summary-${key}`} className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
                          <div className="text-[10px] font-black text-violet-800">{member.courseName}</div>
                          <div className="mt-0.5 text-[10px] font-bold text-violet-600">
                            {count} öğrenci
                            {member.teacherName && member.teacherId ? ` • ${member.teacherName}` : ""}
                          </div>
                        </div>
                      );
                    })}
                    <div className={`rounded-xl border px-3 py-2 ${unassignedCount ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                      <div className={`text-[10px] font-black ${unassignedCount ? "text-amber-800" : "text-emerald-800"}`}>
                        Atanmayan
                      </div>
                      <div className={`mt-0.5 text-[10px] font-bold ${unassignedCount ? "text-amber-600" : "text-emerald-600"}`}>
                        {unassignedCount} öğrenci
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={studentDistributionSearch}
                      onChange={(event) => setStudentDistributionSearch(event.target.value)}
                      placeholder="Öğrenci adı veya numarası..."
                      className="h-10 min-w-[240px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                    />
                    <button
                      type="button"
                      onClick={clearStudentDistribution}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-600 hover:bg-slate-50"
                    >
                      Seçimleri Temizle
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto px-6 py-4">
                  {selectedClassStudents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400">
                      {selectedClass.name} sınıfına kayıtlı öğrenci bulunamadı.
                    </div>
                  ) : (
                    <div className="min-w-[760px] overflow-hidden rounded-2xl border border-slate-200">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                          <tr>
                            <th className="w-[90px] px-3 py-3 text-left text-[10px] font-black uppercase tracking-wide">Ö. No</th>
                            <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wide">Öğrenci</th>
                            {distributionMembers.map((member: any) => (
                              <th key={`distribution-head-${normalize(member?.courseName)}`} className="min-w-[190px] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wide">
                                {member.courseName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map((student, index) => {
                            const studentId = String(student.id);
                            const number = String(student?.studentNumber ?? student?.number ?? "—");
                            const selectedCourseKey = distributionMembers
                              .map((member: any) => normalize(member?.courseName))
                              .find((key: string) => (studentDistributionDraft[key] || []).includes(studentId));
                            return (
                              <tr key={studentId} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                                <td className="border-t border-slate-100 px-3 py-2.5 text-xs font-black text-slate-600">{number}</td>
                                <td className="border-t border-slate-100 px-3 py-2.5">
                                  <div className="text-xs font-black text-slate-800">{student.name}</div>
                                  <div className="mt-0.5 text-[9px] font-bold text-slate-400">{student.classroom || selectedClass.name}</div>
                                </td>
                                {distributionMembers.map((member: any) => {
                                  const key = normalize(member?.courseName);
                                  const checked = (studentDistributionDraft[key] || []).includes(studentId);
                                  return (
                                    <td key={`${studentId}-${key}`} className="border-t border-slate-100 px-3 py-2.5 text-center">
                                      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition ${checked ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500 hover:border-violet-300 hover:bg-violet-50"}`}>
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleStudentDistribution(studentId, member.courseName)}
                                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                                        />
                                        <span className="text-[10px] font-black">{checked ? "Bu derse gidecek" : "Seç"}</span>
                                      </label>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <div className="text-[11px] font-bold text-slate-500">
                    Toplam <b className="text-slate-900">{selectedClassStudents.length}</b> öğrenci • Her öğrenci yalnız bir derse işaretlenebilir.
                    {unassignedCount > 0 && <span className="ml-2 font-black text-amber-600">{unassignedCount} öğrenci bekliyor.</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStudentDistributionModal({ isOpen: false, groupId: "" });
                        setStudentDistributionSearch("");
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-100"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveStudentDistribution()}
                      disabled={saving || selectedClassStudents.length === 0}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Dağılımı Kaydet
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-[9999] min-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => copyClassCourses(contextMenu.classId)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Copy className="h-4 w-4 text-indigo-500" />
            Dersleri Kopyala
          </button>

          <button
            type="button"
            disabled={!copiedClass || copiedClass.id === contextMenu.classId}
            onClick={() => void pasteClassCourses(contextMenu.classId)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ClipboardPaste className="h-4 w-4 text-emerald-600" />
            Dersleri Yapıştır
          </button>

          {copiedClass && (
            <div className="border-t border-slate-100 px-3 py-2 text-[9px] font-semibold text-slate-400">
              Kopyalanan: {copiedClass.name} • {copiedClass.courses.length} ders
            </div>
          )}
        </div>
      )}

      {saving && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/45 backdrop-blur-[1px]">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black text-slate-700 shadow-xl">
            Değişiklik kaydediliyor...
          </div>
        </div>
      )}
    </div>
  );
}
