import { createCourseIdentity, coursesConflictInSameClass, resolveTeacherIdentityKeys } from "../services/schedule/scheduleIdentity";
import { getScheduleDays, getScheduleHours } from "../services/schedule/scheduleRules";
import { loadConstraintSettings } from "../services/schedule/constraintDefaults";

export interface BlockTarget {
  course: any;
  classId: string;
  duration: number;
  blockId: string;
}

export async function solveSingleCourseDeepCSP(
  courseToPlace: any,
  blocksToPlace: number[],
  classId: string,
  currentSchedule: Record<string, any>,
  teachers: any[],
  classrooms: any[],
  unwantedTeacherDays: Record<string, string[]>
): Promise<{ success: boolean; schedule: Record<string, any>; durationMs: number; details: string }> {
  const DAYS = getScheduleDays();
  const HOURS = getScheduleHours();
  const constraintSettings = loadConstraintSettings();
  const startTime = Date.now();
  const TIME_LIMIT = 5 * 60 * 1000; // 5 minutes

  const getBlockDuration = (blockId: string, clsId: string, sched: Record<string, any>) => {
    let count = 0;
    for (const d of DAYS) {
      for (const h of HOURS) {
        const val = sched[`class_${clsId}_${d}_${h}`];
        if (val) {
           const arr = Array.isArray(val) ? val : [val];
           if (arr.some(x => x && x.blockId === blockId)) count++;
        }
      }
    }
    return count;
  };

  const getConflicts = (
    course: any, 
    targetClassId: string, 
    day: string, 
    startHour: number, 
    duration: number, 
    sched: Record<string, any>
  ): BlockTarget[] | null => {
    const conflicts = new Map<string, BlockTarget>();
    
    const isSecmeliIngilizce = course.courseName.toLowerCase().includes("seçmeli ingilizce") || course.courseName.toLowerCase().includes("s. ingilizce");
    const maxHours = isSecmeliIngilizce ? 4 : 2;
    let existingHoursOnDay = 0;
    for (let h = 1; h <= 8; h++) {
      const key = `class_${targetClassId}_${day}_${h}`;
      const val = sched[key];
      if (val) {
        const arr = Array.isArray(val) ? val : [val];
        if (arr.some((v: any) => createCourseIdentity(v, targetClassId) === createCourseIdentity(course, targetClassId))) {
          existingHoursOnDay++;
        }
      }
    }
    if (existingHoursOnDay + duration > maxHours) return null;

    for (let j = 0; j < duration; j++) {
      const h = startHour + j;
      if (h > HOURS.length) return null;
      
      if (sched[`blocked_class_${targetClassId}_${day}_${h}`]) return null;

      const classKey = `class_${targetClassId}_${day}_${h}`;
      const rawC = sched[classKey];
      const cArr = rawC ? (Array.isArray(rawC) ? rawC : [rawC]) : [];
      for (const c of cArr) {
        if (!c) continue;
        const overlap = coursesConflictInSameClass(course, c);
        
        if (overlap) {
          // Elle yerleştirilmiş ders, seçili blok için zincirleme onarımda
          // taşınabilir bir adaydır; yalnız kullanıcı tarafından açıkça
          // kilitlenen ders/hücre sabittir.
          if (c.isLocked || sched[`locked_class_${targetClassId}_${day}_${h}`]) return null;
          if (c.blockId && !conflicts.has(c.blockId)) {
            conflicts.set(c.blockId, { course: c, classId: targetClassId, duration: getBlockDuration(c.blockId, targetClassId, sched), blockId: c.blockId });
          }
        }
      }

      const teacherKeys = resolveTeacherIdentityKeys(course, teachers);
      for (const teacherKey of teacherKeys) {
        const teacherId = teacherKey.startsWith("ID:") ? teacherKey.slice(3) : "";
        if (teacherId) {
          if (sched[`blocked_teacher_${teacherId}_${day}_${h}`]) return null;
          const uDays = unwantedTeacherDays[teacherId] || [];
          // Öğretmen tercihi soft ise aday tamamen reddedilmez. Ana dağıtım
          // motoruyla aynı davranış: yalnızca tercih hard yapıldıysa kapalıdır.
          // Aksi halde elle yerleştirilebilen Perşembe 4 gibi hücreler tek
          // ders çözücüsünün arama alanında da kalır.
          if (constraintSettings.unwantedTeacherDayHard && uDays.includes(day)) return null;
        }

        for (const cls of classrooms) {
          const rawTc = sched[`class_${cls.id}_${day}_${h}`];
          const tcArr = rawTc ? (Array.isArray(rawTc) ? rawTc : [rawTc]) : [];
          for (const tc of tcArr) {
            if (!tc) continue;
            if (resolveTeacherIdentityKeys(tc, teachers).includes(teacherKey)) {
              if (
                tc.isLocked ||
                sched[`locked_class_${cls.id}_${day}_${h}`] ||
                (teacherId && sched[`locked_teacher_${teacherId}_${day}_${h}`])
              ) return null;
              if (tc.blockId && !conflicts.has(tc.blockId)) {
                conflicts.set(tc.blockId, { course: tc, classId: cls.id, duration: getBlockDuration(tc.blockId, cls.id, sched), blockId: tc.blockId });
              }
            }
          }
        }
      }
    }
    
    return Array.from(conflicts.values());
  };

  const removeBlock = (sched: Record<string, any>, blockId: string) => {
    const newSched = { ...sched };
    for (const key of Object.keys(newSched)) {
      if (key.startsWith("class_") || key.startsWith("teacher_")) {
        const val = newSched[key];
        if (val) {
          const arr = Array.isArray(val) ? val : [val];
          const filtered = arr.filter(x => x && x.blockId !== blockId);
          if (filtered.length === 0) {
            delete newSched[key];
          } else {
            newSched[key] = filtered;
          }
        }
      }
    }
    return newSched;
  };

  const placeBlock = (sched: Record<string, any>, target: BlockTarget, day: string, startHour: number) => {
    const newSched = { ...sched };
    const classroomName = classrooms.find((item) => String(item.id) === String(target.classId))?.name
      || target.course.className
      || "";
    const teacherIds = resolveTeacherIdentityKeys(target.course, teachers)
      .filter((key) => key.startsWith("ID:"))
      .map((key) => key.slice(3));

    for (let j = 0; j < target.duration; j++) {
      const h = startHour + j;
      const key = `class_${target.classId}_${day}_${h}`;
      const existing = newSched[key];
      const arr = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
      const payload = {
        id: target.course.id,
        courseId: target.course.courseId || target.course.id,
        courseName: target.course.courseName || target.course.name || target.course.subject || "",
        teacherId: target.course.teacherId || "",
        teacherId2: target.course.teacherId2 || "",
        teacherName: target.course.teacherName || "",
        teacherName2: target.course.teacherName2 || "",
        className: classroomName,
        type: target.course.type || target.course.courseType || "",
        groupName: target.course.groupName || "",
        targetGroups: Array.isArray(target.course.targetGroups) ? target.course.targetGroups : [],
        weeklyHours: Number(target.course.weeklyHours || 0),
        splitGroupId: target.course.splitGroupId || "",
        studentIds: Array.isArray(target.course.studentIds) ? target.course.studentIds : [],
        blockId: target.blockId,
        isCommonCourse: Boolean(target.course.isCommonCourse || target.course.isCommonElective),
        isManual: false,
      };
      newSched[key] = [...arr, payload];

      // Sınıf ve öğretmen çizelgeleri aynı kaynak programın iki görünümüdür.
      // Tek ders çözücüsü de normal manuel/otomatik yerleştirmeler gibi ikisini
      // birlikte güncellemelidir; aksi halde ders yerleşse bile öğretmen paneli
      // eksik saati hâlâ dağıtılmamış gösteriyordu.
      teacherIds.forEach((teacherId) => {
        const teacherKey = `teacher_${teacherId}_${day}_${h}`;
        const teacherExisting = newSched[teacherKey];
        const teacherArr = teacherExisting
          ? (Array.isArray(teacherExisting) ? teacherExisting : [teacherExisting])
          : [];
        if (!teacherArr.some((item: any) => item?.blockId === target.blockId)) {
          newSched[teacherKey] = [...teacherArr, payload];
        }
      });
    }
    return newSched;
  };

  let bestSchedule = currentSchedule;
  let solutionFound = false;
  let iterations = 0;

  const backtrack = async (
    sched: Record<string, any>, 
    unplaced: BlockTarget[], 
    depth: number, 
    maxDepth: number,
    history: Set<string>
  ): Promise<boolean> => {
    iterations++;
    
    // Yield the thread to prevent UI freeze
    if (iterations % 500 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    if (Date.now() - startTime > TIME_LIMIT) return false;
    if (solutionFound) return true;
    
    if (unplaced.length === 0) {
      bestSchedule = sched;
      solutionFound = true;
      return true;
    }

    if (depth > maxDepth) return false;

    const target = unplaced[0];
    const restUnplaced = unplaced.slice(1);

    const candidates: Array<{ day: string; hour: number; conflicts: BlockTarget[] }> = [];
    for (const d of DAYS) {
      for (let h = 1; h <= 8 - target.duration + 1; h++) {
        const conflicts = getConflicts(target.course, target.classId, d, h, target.duration, sched);
        if (conflicts !== null) candidates.push({ day: d, hour: h, conflicts });
      }
    }

    // Önce tamamen boş ve ardışık saatleri kullan. Bu, 9-E Almanca gibi tek
    // kalan bloklarda gereksiz ders taşıma aramasını önler. Boş alan yoksa en
    // az sayıda otomatik bloğu yerinden oynatan adaylar denenir.
    candidates.sort((a, b) =>
      a.conflicts.length - b.conflicts.length ||
      a.day.localeCompare(b.day, "tr") ||
      a.hour - b.hour,
    );

    for (const { day, hour, conflicts } of candidates) {
      const hasCycle = conflicts.some(c => history.has(c.blockId));
      if (hasCycle) continue;

      let nextSched = sched;
      for (const c of conflicts) {
        nextSched = removeBlock(nextSched, c.blockId);
      }

      nextSched = placeBlock(nextSched, target, day, hour);
      
      const nextUnplaced = [...conflicts, ...restUnplaced];
      
      const nextHistory = new Set(history);
      nextHistory.add(target.blockId);

      if (await backtrack(nextSched, nextUnplaced, depth + 1, maxDepth, nextHistory)) {
        return true;
      }
    }
    return false;
  };

  const initialUnplacedBlocks: BlockTarget[] = blocksToPlace.map((dur, idx) => ({
    course: courseToPlace,
    classId: classId,
    duration: dur,
    blockId: `new_block_${Date.now()}_${idx}_${Math.random().toString(36).substring(7)}`
  }));

  // Iterative deepening
  for (let maxDepth = 0; maxDepth <= 8; maxDepth++) {
    if (solutionFound || Date.now() - startTime > TIME_LIMIT) break;
    await backtrack(currentSchedule, initialUnplacedBlocks, 0, maxDepth, new Set<string>());
  }
  
  if (!solutionFound && Date.now() - startTime < TIME_LIMIT) {
     // Blok zincirini derinleştir: hedef ders için yer açmak üzere ilk
     // taşınan blok uygun değilse başka bloklar da sırayla denenir.
     await backtrack(currentSchedule, initialUnplacedBlocks, 0, 32, new Set<string>());
  }

  return {
    success: solutionFound,
    schedule: bestSchedule,
    durationMs: Date.now() - startTime,
      details: solutionFound ? `Başarıyla yerleştirildi (${iterations} iterasyon).` : "Çözüm bulunamadı.",
  };
}

