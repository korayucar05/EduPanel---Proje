export interface ScheduleConstraintSettings {
  seed: number;
  workDays: string[];
  dailyLessonCount: number;
  allowTeacherAutoInference: boolean;
  maxDailyCourseHours: number;
  electiveEnglishMaxDailyHours: number;
  maxTeacherDailyHours: number;
  maxTeacherConsecutiveHours: number;
  requireTeacherFreeDay: boolean;
  preserveManualAssignments: boolean;
  teacherConflictHard: boolean;
  classConflictHard: boolean;
  groupConflictHard: boolean;
  blockedSlotsHard: boolean;
  weeklyHoursHard: boolean;
  unwantedTeacherDayHard: boolean;
  unwantedTeacherDayPenalty: number;
  teacherGapPenalty: number;
  teacherShortDayPenalty: number;
  teacherWorkingDayPenalty: number;
  classGapPenalty: number;
  lastHourPenalty: number;
  sameCourseSameHourPenalty: number;
  maxBacktrackingNodes: number;
  backtrackingTimeLimitMs: number;
  domainCacheEnabled: boolean;
  nogoodLearningEnabled: boolean;
  visitedStateCacheEnabled: boolean;
}

export interface ScheduleValidationIssue {
  id: string;
  severity: "error" | "warning";
  type: string;
  message: string;
  day?: string;
  hour?: number;
  className?: string;
  teacherName?: string;
}

export interface ScheduleValidationResult {
  valid: boolean;
  errors: ScheduleValidationIssue[];
  warnings: ScheduleValidationIssue[];
}
