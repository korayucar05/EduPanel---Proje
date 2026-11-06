import type { ScheduleConstraintSettings } from "../../types/scheduleConstraints";

export type HardConstraintId = "teacher_conflict" | "class_conflict" | "group_conflict" | "blocked_slot" | "weekly_hours" | "unwanted_teacher_day";

export function enabledHardConstraints(settings: ScheduleConstraintSettings): Set<HardConstraintId> {
  const result = new Set<HardConstraintId>();
  if (settings.teacherConflictHard) result.add("teacher_conflict");
  if (settings.classConflictHard) result.add("class_conflict");
  if (settings.groupConflictHard) result.add("group_conflict");
  if (settings.blockedSlotsHard) result.add("blocked_slot");
  if (settings.weeklyHoursHard) result.add("weekly_hours");
  if (settings.unwantedTeacherDayHard) result.add("unwanted_teacher_day");
  return result;
}
