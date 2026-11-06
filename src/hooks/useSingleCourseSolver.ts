import type { Classroom, Teacher } from "../types";
import type { ScheduleData, ScheduleViewType } from "../types/schedule";
import { solveSingleCourseDeepCSP } from "../utils/cspSolver";
import { buildCourseBlocks } from "../services/schedule/courseAssignmentService";

interface UseSingleCourseSolverArgs {
  teachers: Teacher[];
  classrooms: Classroom[];
  viewType: ScheduleViewType;
  selectedId: string;
  scheduleData: ScheduleData;
  unwantedTeacherDays: Record<string, string[]>;
  getPlacedHoursForEntity: (
    type: "class" | "teacher",
    id: string,
    courseName: string,
    groupName?: string,
    className?: string,
    weeklyHours?: number,
    currentScheduleData?: Record<string, any>,
  ) => number;
  setScheduleData: (value: ScheduleData) => void;
  setSolverRunning: (value: boolean) => void;
  setSolverProgress: (value: number) => void;
  setSolverResult: (value: any) => void;
  setSolverTargetCourse: (value: any) => void;
}

/** Tek derslik CSP dağıtım akışını component'ten ayırır. */
export function useSingleCourseSolver({
  teachers,
  classrooms,
  viewType,
  selectedId,
  scheduleData,
  unwantedTeacherDays,
  getPlacedHoursForEntity,
  setScheduleData,
  setSolverRunning,
  setSolverProgress,
  setSolverResult,
  setSolverTargetCourse,
}: UseSingleCourseSolverArgs) {
  const runSingleCourseSolver = (course: any) => {
    const placed = getPlacedHoursForEntity(
      viewType,
      selectedId,
      course.courseName,
      course.groupName,
      course.className,
      Number(course.weeklyHours || 0),
      scheduleData,
    );
    const remaining = Number(course.weeklyHours || 0) - placed;
    if (remaining <= 0) {
      window.alert("Bu dersin tüm saatleri zaten dağıtılmış!");
      return;
    }

    const blocks = buildCourseBlocks(course, remaining);
    setSolverRunning(true);
    setSolverProgress(0);
    setSolverTargetCourse({ ...course, remaining });
    setSolverResult(null);

    let progress = 0;
    const progressTimer = window.setInterval(() => {
      progress = Math.min(99, progress + Math.floor(Math.random() * 5) + 1);
      setSolverProgress(progress);
    }, 200);

    const targetClassId =
      viewType === "class"
        ? selectedId
        : classrooms.find((item) => item.name === course.className)?.id || "";

    window.setTimeout(async () => {
      try {
        const result = await solveSingleCourseDeepCSP(
          course,
          blocks,
          targetClassId,
          scheduleData,
          teachers,
          classrooms,
          unwantedTeacherDays,
        );
        setSolverProgress(100);
        if (result.success) {
          setScheduleData(result.schedule);
          setSolverResult({
            success: true,
            courseName: course.courseName,
            details: `Başarıyla yerleştirildi. (Çözüm süresi: ${Math.round(result.durationMs / 1000)} sn)\n${result.details || ""}`,
          });
          window.setTimeout(() => setSolverTargetCourse(null), 1500);
        } else {
          setSolverResult({
            success: false,
            courseName: course.courseName,
            reasons: [
              `Çözüm bulunamadı. Arama süresi: ${Math.round(result.durationMs / 1000)} sn.`,
              "Tüm uygun ihtimaller denendi. Kapalı saatleri veya öğretmen kısıtlarını gözden geçiriniz.",
            ],
            details: result.details,
          });
        }
      } catch (error: any) {
        setSolverResult({
          success: false,
          courseName: course.courseName,
          reasons: [error?.message || "Tek ders dağıtımı sırasında hata oluştu."],
        });
      } finally {
        window.clearInterval(progressTimer);
        setSolverRunning(false);
      }
    }, 100);
  };

  return { runSingleCourseSolver };
}
