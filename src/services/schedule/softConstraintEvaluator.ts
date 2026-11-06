import { getScheduleHours } from "./scheduleRules";
import type { ScheduleConstraintSettings } from "../../types/scheduleConstraints";

const values = (v: any) => !v ? [] : Array.isArray(v) ? v : [v];

export function evaluateConfiguredSoftPenalty(
  schedule: Record<string, any>,
  classId: string,
  day: string,
  teacherIds: string[],
  unwantedTeacherDays: Record<string, string[]>,
  settings: ScheduleConstraintSettings,
): number {
  const HOURS = getScheduleHours();
  let penalty = 0;
  const occupied = HOURS.filter((hour) => values(schedule[`class_${classId}_${day}_${hour}`]).length > 0);
  if (occupied.length) {
    const first = Math.min(...occupied), last = Math.max(...occupied);
    const gaps = HOURS.filter((h) => h >= first && h <= last && !occupied.includes(h)).length;
    penalty += gaps * settings.classGapPenalty;
    if (occupied.includes(HOURS[HOURS.length - 1])) penalty += settings.lastHourPenalty;
  }
  if (!settings.unwantedTeacherDayHard) {
    for (const teacherId of teacherIds) {
      if ((unwantedTeacherDays[teacherId] || []).includes(day)) penalty += settings.unwantedTeacherDayPenalty;
    }
  }
  return penalty;
}
