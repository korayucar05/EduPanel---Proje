import { getScheduleDays, getScheduleHours } from "../services/schedule/scheduleRules";
import { createCourseIdentity, getScheduleWeeklyHours, resolveTeacherIdentityKeys } from "../services/schedule/scheduleIdentity";
import { Classroom, Teacher } from "../types";
import type { ScheduleConstraintSettings } from "../types/scheduleConstraints";
import { loadConstraintSettings } from "../services/schedule/constraintDefaults";

export interface PenaltyDetail {
  id: string;
  type: "class_gap" | "teacher_gap" | "teacher_short_day" | "teacher_unwanted_day" | "teacher_working_days" | "same_course_hour" | "co_teacher_mismatch";
  targetName: string;
  day: string;
  hours?: string;
  points: number;
  description: string;
}

export function calculateSchedulePenalty(
  scheduleData: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
  settings: ScheduleConstraintSettings = loadConstraintSettings(),
) {
  const DAYS = getScheduleDays();
  const HOURS = getScheduleHours();

  const CLASS_GAP_POINT_PER_HOUR = Math.max(0, settings.classGapPenalty);
  const TEACHER_GAP_POINT_PER_HOUR = Math.max(0, settings.teacherGapPenalty);
  const TEACHER_SHORT_DAY_POINT_PER_HOUR = Math.max(0, settings.teacherShortDayPenalty);
  const teacherWeeklyHours = new Map<string, number>();

  // Ders yükü, yerleştirilmiş hücrelerden değil kaynak ders tanımlarından
  // hesaplanır. Böylece çözümün ara aşamasında eksik yerleşen dersler kuralı
  // yanlışlıkla devre dışı bırakmaz; ortak derste iki öğretmenin her birinin
  // gerçek haftalık yükü de doğru sayılır.
  classrooms.forEach((classroom) => {
    (classroom.assignedCourses || []).forEach((course: any) => {
      const weeklyHours = getScheduleWeeklyHours(course);
      if (weeklyHours <= 0) return;
      resolveTeacherIdentityKeys(course, teachers).forEach((teacherKey) => {
        teacherWeeklyHours.set(teacherKey, (teacherWeeklyHours.get(teacherKey) || 0) + weeklyHours);
      });
    });
  });
  
  let totalPenalty = 0;
  const details: PenaltyDetail[] = [];

  // 1. Calculate Class Gaps and Co-Teacher Mismatch
  classrooms.forEach((cls) => {
    DAYS.forEach((day) => {
      const hasLesson = HOURS.map((hour) => {
        const key = `class_${cls.id}_${day}_${hour}`;
        const val = scheduleData[key];
        return val && Array.isArray(val) ? val.length > 0 : !!val;
      });

      // Find first and last lesson hours
      let first = -1;
      let last = -1;
      for (let i = 0; i < HOURS.length; i++) {
        if (hasLesson[i]) {
          if (first === -1) first = i;
          last = i;
        }
      }

      if (first !== -1 && last !== -1 && last > first) {
        let currentGapLength = 0;
        let gapStartHour = -1;

        for (let i = first; i <= last; i++) {
          if (!hasLesson[i]) {
            if (currentGapLength === 0) {
              gapStartHour = i + 1;
            }
            currentGapLength++;
          } else {
            if (currentGapLength > 0) {
              // Add penalty
              const points = currentGapLength * CLASS_GAP_POINT_PER_HOUR;
              const hoursText = currentGapLength === 1 ? `${gapStartHour}. saat` : `${gapStartHour}-${gapStartHour + currentGapLength - 1}. saatler`;
              
              totalPenalty += points;
              details.push({
                id: `class_gap_${cls.id}_${day}_${gapStartHour}`,
                type: "class_gap",
                targetName: cls.name,
                day,
                hours: hoursText,
                points,
                description: `Sınıf programında ${currentGapLength} saatlik boşluk (${hoursText})`
              });

              currentGapLength = 0;
              gapStartHour = -1;
            }
          }
        }

        // Just in case (though loop ends on 'last' which is always true, so currentGapLength will be 0)
        if (currentGapLength > 0) {
          const points = currentGapLength * CLASS_GAP_POINT_PER_HOUR;
          const hoursText = currentGapLength === 1 ? `${gapStartHour}. saat` : `${gapStartHour}-${gapStartHour + currentGapLength - 1}. saatler`;
          
          totalPenalty += points;
          details.push({
            id: `class_gap_${cls.id}_${day}_${gapStartHour}`,
            type: "class_gap",
            targetName: cls.name,
            day,
            hours: hoursText,
            points,
            description: `Sınıf programında ${currentGapLength} saatlik boşluk (${hoursText})`
          });
        }
      }
    });

    // 3. Calculate Same Course Same Hour Penalty AND Co-Teacher Mismatch
    DAYS.forEach(day => {
      HOURS.forEach(hour => {
        const key = `class_${cls.id}_${day}_${hour}`;
        const val = scheduleData[key];
        if (val) {
           const arr = Array.isArray(val) ? val : [val];
           arr.forEach((v: any) => {
             // Check Co-Teacher Mismatch: If teacherName AND teacherName2 are set,
             // they MUST both be present in the assignment for this course in this class across all slots.
             // Wait, the constraint is: they must be assigned to the SAME slot.
             // If a course has 2 teachers, they must both be assigned to every slot that course is assigned to.
             if (v.teacherName && v.teacherName2 && v.teacherName !== "Öğretmen Atanmadı" && v.teacherName2 !== "Öğretmen Atanmadı") {
               // Check if both are assigned to the slot for this specific assignment
               // Actually the data structure seems to already store both in the same assignment object (v.teacherName, v.teacherName2)
               // The issue is if they are NOT in the same slot.
               // Let's check the assignments for this course over the whole week.
             }
           });
        }
      });
    });
    
    // Better way: Reconstruct course placements, then for each course, check if teachers are consistent.
    const coursePlacements: Record<string, { day: string, hour: number, teacherName: string, teacherName2: string }[]> = {};
    DAYS.forEach(day => {
      HOURS.forEach(hour => {
        const key = `class_${cls.id}_${day}_${hour}`;
        const val = scheduleData[key];
        if (val) {
          const arr = Array.isArray(val) ? val : [val];
          arr.forEach((v: any) => {
            const courseKey = createCourseIdentity(v, cls.id);
            if (!coursePlacements[courseKey]) coursePlacements[courseKey] = [];
            coursePlacements[courseKey].push({ day, hour, teacherName: v.teacherName, teacherName2: v.teacherName2 });
          });
        }
      });
    });

    Object.entries(coursePlacements).forEach(([courseKey, placements]) => {
      // Check for each placement if it has both teachers
      const hasTwoTeachers = placements.some(p => p.teacherName && p.teacherName2 && p.teacherName !== "Öğretmen Atanmadı" && p.teacherName2 !== "Öğretmen Atanmadı");
      
      if (hasTwoTeachers) {
        // If it has two teachers, EVERY placement must have both teachers assigned to the SAME slot.
        // Actually, if they are co-teachers, the assignment object should have both.
        // If a placement is missing one of them, that's a mismatch.
        placements.forEach(p => {
           if (!p.teacherName || p.teacherName === "Öğretmen Atanmadı" || !p.teacherName2 || p.teacherName2 === "Öğretmen Atanmadı") {
             totalPenalty += 100;
             details.push({
               id: `co_teacher_mismatch_${cls.id}_${courseKey}_${p.day}_${p.hour}`,
               type: "co_teacher_mismatch",
               targetName: cls.name,
               day: p.day,
               hours: `${p.hour}. saat`,
               points: 100,
               description: `"${courseKey}" dersine atanan öğretmenler (A ve B) bu saatte birlikte atanmamış.`
             });
           }
        });
      }
    });

    // Same Course Same Hour Penalty (Keep existing logic, maybe optimize)
    // ... (rest of the original code, starting from line 97)
    const courseHourMap: Record<string, Record<number, string[]>> = {};
    DAYS.forEach(day => {
      courseHourMap[day] = {};
      HOURS.forEach(hour => {
        const key = `class_${cls.id}_${day}_${hour}`;
        const val = scheduleData[key];
        const courses: string[] = [];
        if (val) {
           const arr = Array.isArray(val) ? val : [val];
           arr.forEach((v: any) => {
             if (v?.courseName) courses.push(createCourseIdentity(v, cls.id));
           });
        }
        courseHourMap[day][hour] = courses;
      });
    });

    const courseDayHours: Record<string, { day: string, hour: number }[]> = {};
    DAYS.forEach(day => {
      HOURS.forEach(hour => {
        courseHourMap[day][hour].forEach(c => {
           if (!courseDayHours[c]) courseDayHours[c] = [];
           courseDayHours[c].push({ day, hour });
        });
      });
    });

    Object.entries(courseDayHours).forEach(([courseName, times]) => {
      const hourGroups: Record<number, string[]> = {};
      times.forEach(t => {
        if (!hourGroups[t.hour]) hourGroups[t.hour] = [];
        if (!hourGroups[t.hour].includes(t.day)) {
          hourGroups[t.hour].push(t.day);
        }
      });
      
      Object.entries(hourGroups).forEach(([hourStr, days]) => {
        const count = days.length;
        if (count > 1) {
          const points = (count - 1) * Math.max(0, settings.sameCourseSameHourPenalty);
          totalPenalty += points;
          details.push({
            id: `same_course_hour_${cls.id}_${courseName}_${hourStr}`,
            type: "same_course_hour",
            targetName: cls.name,
            day: days.join(", "),
            hours: `${hourStr}. saat`,
            points,
            description: `"${courseName}" dersi birden fazla gün aynı saate (${hourStr}. saat) yerleştirildi.`
          });
        }
      });
    });
  });

  // 2. Calculate Teacher Gaps & Unwanted Day Penalties
  teachers.forEach((teacher) => {
    let workingDayCount = 0;
    const dailyLessonCounts = new Map<string, number>();
    const manuallyClosedDays = new Set(
      DAYS.filter((day) =>
        HOURS.every((hour) => Boolean(scheduleData[`blocked_teacher_${teacher.id}_${day}_${hour}`])),
      ),
    );
    DAYS.forEach((day) => {
      const hasLesson = HOURS.map((hour) => {
        const key = `teacher_${teacher.id}_${day}_${hour}`;
        const val = scheduleData[key];
        return val && Array.isArray(val) ? val.length > 0 : !!val;
      });

      // Find first and last lesson hours
      let first = -1;
      let last = -1;
      for (let i = 0; i < HOURS.length; i++) {
        if (hasLesson[i]) {
          if (first === -1) first = i;
          last = i;
        }
      }

      // Gap calculation
      if (first !== -1 && last !== -1 && last > first) {
        let currentGapLength = 0;
        let gapStartHour = -1;

        for (let i = first; i <= last; i++) {
          if (!hasLesson[i]) {
            if (currentGapLength === 0) {
              gapStartHour = i + 1;
            }
            currentGapLength++;
          } else {
            if (currentGapLength > 0) {
              // Bir saatlik ara kabul edilebilir; ikinci ve sonraki boş saatler
              // ancak zorunluysa seçilsin diye kademeli olarak çok daha pahalıdır.
              const points = currentGapLength * TEACHER_GAP_POINT_PER_HOUR
                + Math.max(0, currentGapLength - 1) * TEACHER_GAP_POINT_PER_HOUR * 2;
              const hoursText = currentGapLength === 1 ? `${gapStartHour}. saat` : `${gapStartHour}-${gapStartHour + currentGapLength - 1}. saatler`;
              
              totalPenalty += points;
              details.push({
                id: `teacher_gap_${teacher.id}_${day}_${gapStartHour}`,
                type: "teacher_gap",
                targetName: teacher.name,
                day,
                hours: hoursText,
                points,
                description: `Öğretmen programında ${currentGapLength} saatlik boşluk (${hoursText})`
              });

              currentGapLength = 0;
              gapStartHour = -1;
            }
          }
        }
      }

      // Unwanted day calculation
      const unwantedDays = unwantedTeacherDays[teacher.id] || [];
      if (unwantedDays.includes(day)) {
        const hasAnyLesson = hasLesson.some((val) => val);
        if (hasAnyLesson) {
          const unwantedDayPoints = Math.max(0, settings.unwantedTeacherDayPenalty);
          totalPenalty += unwantedDayPoints;
          details.push({
            id: `teacher_unwanted_${teacher.id}_${day}`,
            type: "teacher_unwanted_day",
            targetName: teacher.name,
            day,
            points: unwantedDayPoints,
            description: `Öğretmenin istemediği güne ders yerleştirilmesi`
          });
        }
      }
      const dailyLessonCount = hasLesson.filter(Boolean).length;
      dailyLessonCounts.set(day, dailyLessonCount);
      if (dailyLessonCount > 0) workingDayCount++;
    });

    const weeklyHours = teacherWeeklyHours.get(`ID:${teacher.id}`) || 0;
    // Haftalık yükü en az dört saat olan öğretmenlerde 1-3 saatlik günleri
    // azaltmayı tercih et. Tek çalışma günü olan düşük yükte ceza uygulamayız;
    // bu durumda dört saate tamamlama zaten mümkün olmayabilir.
    if (weeklyHours >= 4 && workingDayCount > 1 && TEACHER_SHORT_DAY_POINT_PER_HOUR > 0) {
      dailyLessonCounts.forEach((dailyLessonCount, day) => {
        if (dailyLessonCount === 0 || dailyLessonCount >= 4) return;
        const missingHours = 4 - dailyLessonCount;
        const points = missingHours * TEACHER_SHORT_DAY_POINT_PER_HOUR;
        totalPenalty += points;
        details.push({
          id: `teacher_short_day_${teacher.id}_${day}`,
          type: "teacher_short_day",
          targetName: teacher.name,
          day,
          points,
          description: `Öğretmenin ${dailyLessonCount} saatlik günü var; mümkünse dersler en az 4 saatlik bloklarda toplanmalı.`,
        });
      });
    }
    const needsFreeDay = settings.requireTeacherFreeDay && weeklyHours < 24;
    // Yönetici tabloda bir günün bütün saatlerini kapattıysa o gün, bu
    // öğretmen için zaten seçilmiş boş gündür. Çözücü ikinci bir boş gün
    // oluşturmaya çalışmamalı; mümkünse geriye kalan açık günlere ders koymalıdır.
    const targetWorkingDayCount = manuallyClosedDays.size > 0
      ? DAYS.length - manuallyClosedDays.size
      : DAYS.length - 1;
    // Manuel kapalı gün yoksa hedef, 24 saatin altındaki öğretmene en az bir
    // boş gün bırakmaktır: 5 gün çalışmak ceza almalıdır. Manuel kapalı gün
    // varsa o gün zaten boş gün seçilmiştir; bu kez açık günlerden birinin
    // gereksiz boş kalması ceza alır.
    const freeDayDeviation = manuallyClosedDays.size > 0
      ? Math.max(0, targetWorkingDayCount - workingDayCount)
      : Math.max(0, workingDayCount - targetWorkingDayCount);
    const workingDayPoints = needsFreeDay
      ? freeDayDeviation * Math.max(0, settings.teacherWorkingDayPenalty)
      : 0;
    if (workingDayPoints > 0) {
      totalPenalty += workingDayPoints;
      details.push({
        id: `teacher_working_days_${teacher.id}`,
        type: "teacher_working_days",
        targetName: teacher.name,
        day: `${workingDayCount}/${DAYS.length} gün`,
        points: workingDayPoints,
        description: needsFreeDay
          ? manuallyClosedDays.size > 0
            ? `Manuel kapatılan ${manuallyClosedDays.size} gün boş gün kabul edildi; kalan açık günlerde ${freeDayDeviation} ek boş gün oluştu.`
            : `Haftalık yükü ${weeklyHours} saat olan öğretmen ${workingDayCount} gün çalışıyor; hedeflenen boş günü oluşturmak için ${freeDayDeviation} çalışma günü azaltılmalı.`
          : `Öğretmenin ${workingDayCount} çalışma günü var`,
      });
    }
  });

  return {
    totalPenalty,
    details: details.filter((detail) => detail.points > 0)
  };
}
