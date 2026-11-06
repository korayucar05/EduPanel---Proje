import type { Classroom, Course, Teacher } from "../../types";
import type { ScheduleConstraintSettings } from "../../types/scheduleConstraints";
import { calculateSchedulePenalty } from "../../utils/penaltyCalculator";
import {
  runKorayUcarEngine,
  type KorayUcarSolverCallbacks,
  type KorayUcarSolverConfig,
  type KorayUcarSolverResult,
} from "./KorayUcarEngine";
import { getScheduleWeeklyHours, resolveTeacherIdentityKeys } from "./scheduleIdentity";

export const KORAY_UCAR_V3_ENGINE_NAME = "KorayUçar V3";

type StrategyName =
  | "atomic-mrv"
  | "paired-teacher-first"
  | "preferred-class-first"
  | "atomic-teacher-bottleneck"
  | "paired-randomized"
  | "two-hour-blocks-first";

interface Strategy {
  name: StrategyName;
  blockMode: "atomic" | "pairs" | "preferred";
  ordering: "default" | "teacher" | "class" | "two-hour-first";
  seedOffset: number;
  weight: number;
}

export interface KorayUcarV3Config extends KorayUcarSolverConfig {
  /** V3 toplam süre bütçesi. Varsayılan problem büyüklüğüne göre 120-240 sn. */
  v3TimeLimitMs?: number;
  /** Kaç farklı portfolio stratejisi kullanılacağı. */
  portfolioSize?: number;
}

export interface KorayUcarV3Result extends KorayUcarSolverResult {
  v3: {
    engine: typeof KORAY_UCAR_V3_ENGINE_NAME;
    strategiesTried: Array<{
      name: StrategyName;
      placed: number;
      total: number;
      penalty: number;
      durationMs: number;
      success: boolean;
    }>;
    winningStrategy: StrategyName | "none";
    totalPortfolioMs: number;
  };
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? {}));

function pairPattern(hours: number): number[] {
  const blocks: number[] = [];
  let remaining = Math.max(0, Math.floor(hours));
  while (remaining > 0) {
    const size = remaining >= 2 ? 2 : 1;
    blocks.push(size);
    remaining -= size;
  }
  return blocks;
}

function parseExistingPattern(course: any): number[] | null {
  if (Array.isArray(course?.preferredBlocks)) {
    const values = course.preferredBlocks
      .map(Number)
      .filter((value: number) => Number.isInteger(value) && value > 0);
    if (values.length) return values;
  }

  const raw = String(course?.blockPattern || course?.preferredBlockPattern || "").trim();
  if (!raw) return null;

  const values = raw
    .split(/[+,/xX\s-]+/)
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);

  return values.length ? values : null;
}

function courseWithBlockMode(course: any, mode: Strategy["blockMode"]) {
  const hours = getScheduleWeeklyHours(course);

  if (mode === "atomic") {
    return {
      ...course,
      strictBlocks: false,
    };
  }

  if (mode === "pairs") {
    return {
      ...course,
      strictBlocks: true,
      preferredBlocks: pairPattern(hours),
    };
  }

  const existing = parseExistingPattern(course);
  if (existing && existing.reduce((sum, value) => sum + value, 0) === hours) {
    return {
      ...course,
      strictBlocks: true,
      preferredBlocks: existing,
    };
  }

  // Tercih yoksa preferred stratejisi aşırı kısıtlamaz; atomik kalır.
  return {
    ...course,
    strictBlocks: false,
  };
}

function buildTeacherLoad(classrooms: Classroom[], teachers: Teacher[]) {
  const load = new Map<string, number>();

  for (const classroom of classrooms as any[]) {
    for (const course of classroom.assignedCourses || []) {
      const hours = getScheduleWeeklyHours(course);
      for (const key of resolveTeacherIdentityKeys(course, teachers)) {
        load.set(key, (load.get(key) || 0) + hours);
      }
    }
  }

  return load;
}

function prepareClassrooms(
  classrooms: Classroom[],
  teachers: Teacher[],
  strategy: Strategy,
): Classroom[] {
  const teacherLoad = buildTeacherLoad(classrooms, teachers);

  const prepared = clone(classrooms).map((classroom: any) => ({
    ...classroom,
    assignedCourses: (classroom.assignedCourses || []).map((course: any) =>
      courseWithBlockMode(course, strategy.blockMode),
    ),
  }));

  if (strategy.ordering === "teacher") {
    for (const classroom of prepared as any[]) {
      classroom.assignedCourses.sort((a: any, b: any) => {
        const loadA = resolveTeacherIdentityKeys(a, teachers).reduce(
          (sum, key) => sum + (teacherLoad.get(key) || 0),
          0,
        );
        const loadB = resolveTeacherIdentityKeys(b, teachers).reduce(
          (sum, key) => sum + (teacherLoad.get(key) || 0),
          0,
        );
        return loadB - loadA || getScheduleWeeklyHours(b) - getScheduleWeeklyHours(a);
      });
    }
  }

  if (strategy.ordering === "class") {
    prepared.sort((a: any, b: any) => {
      const hoursA = (a.assignedCourses || []).reduce(
        (sum: number, course: any) => sum + getScheduleWeeklyHours(course),
        0,
      );
      const hoursB = (b.assignedCourses || []).reduce(
        (sum: number, course: any) => sum + getScheduleWeeklyHours(course),
        0,
      );
      return hoursB - hoursA;
    });
  }

  if (strategy.ordering === "two-hour-first") {
    for (const classroom of prepared as any[]) {
      classroom.assignedCourses.sort((a: any, b: any) => {
        const aHours = getScheduleWeeklyHours(a);
        const bHours = getScheduleWeeklyHours(b);
        const aFixed = aHours === 2 ? 1 : 0;
        const bFixed = bHours === 2 ? 1 : 0;

        // Önce bölünemez 2 saatlik bloklar; sonra öğretmen darboğazı ve yüksek saat.
        if (aFixed !== bFixed) return bFixed - aFixed;

        const aTeacherLoad = resolveTeacherIdentityKeys(a, teachers).reduce(
          (sum, key) => sum + (teacherLoad.get(key) || 0),
          0,
        );
        const bTeacherLoad = resolveTeacherIdentityKeys(b, teachers).reduce(
          (sum, key) => sum + (teacherLoad.get(key) || 0),
          0,
        );

        return bTeacherLoad - aTeacherLoad || bHours - aHours;
      });
    }
  }

  return prepared;
}

function resultScore(
  result: KorayUcarSolverResult,
  classrooms: Classroom[],
  teachers: Teacher[],
  unwantedTeacherDays: Record<string, string[]>,
): number {
  const unplaced = result.unplacedBlocks?.length || 0;
  const penalty = Number.isFinite(result.finalPenalty)
    ? result.finalPenalty
    : calculateSchedulePenalty(
        result.schedule,
        classrooms,
        teachers,
        unwantedTeacherDays,
      ).totalPenalty;

  // Bir eksik blok, soft kalite puanından çok daha pahalıdır.
  return unplaced * 1_000_000 + penalty;
}

function strategyList(): Strategy[] {
  return [
    {
      name: "two-hour-blocks-first",
      blockMode: "atomic",
      ordering: "two-hour-first",
      seedOffset: 524287,
      weight: 1.35,
    },
    {
      name: "atomic-mrv",
      blockMode: "atomic",
      ordering: "default",
      seedOffset: 0,
      weight: 1.15,
    },
    {
      name: "paired-teacher-first",
      blockMode: "pairs",
      ordering: "teacher",
      seedOffset: 104729,
      weight: 1.0,
    },
    {
      name: "preferred-class-first",
      blockMode: "preferred",
      ordering: "class",
      seedOffset: 209759,
      weight: 0.9,
    },
    {
      name: "atomic-teacher-bottleneck",
      blockMode: "atomic",
      ordering: "teacher",
      seedOffset: 314159,
      weight: 1.1,
    },
    {
      name: "paired-randomized",
      blockMode: "pairs",
      ordering: "default",
      seedOffset: 499979,
      weight: 0.85,
    },
  ];
}

export async function runKorayUcarV3Engine(
  config: KorayUcarV3Config,
  currentSchedule: Record<string, any>,
  classrooms: Classroom[],
  teachers: Teacher[],
  courses: Course[],
  unwantedTeacherDays: Record<string, string[]>,
  callbacks?: KorayUcarSolverCallbacks,
): Promise<KorayUcarV3Result> {
  const started = Date.now();
  const totalAssignedHours = (classrooms as any[]).reduce(
    (sum, classroom) =>
      sum +
      (classroom.assignedCourses || []).reduce(
        (courseSum: number, course: any) =>
          courseSum + getScheduleWeeklyHours(course),
        0,
      ),
    0,
  );

  const totalBudget =
    config.v3TimeLimitMs ||
    config.timeLimitMs ||
    (totalAssignedHours > 1400
      ? 240_000
      : totalAssignedHours > 900
        ? 210_000
        : totalAssignedHours > 500
          ? 180_000
          : 120_000);

  const deadline = started + totalBudget;
  const allStrategies = strategyList();
  const selectedStrategies = allStrategies.slice(
    0,
    Math.max(2, Math.min(allStrategies.length, config.portfolioSize || allStrategies.length)),
  );

  let best: KorayUcarSolverResult | null = null;
  let bestStrategy: StrategyName | "none" = "none";
  let bestScore = Number.POSITIVE_INFINITY;

  const reports: KorayUcarV3Result["v3"]["strategiesTried"] = [];

  for (let index = 0; index < selectedStrategies.length; index++) {
    if (Date.now() >= deadline || callbacks?.shouldCancel?.()) break;

    const strategy = selectedStrategies[index];
    const remainingMs = Math.max(8_000, deadline - Date.now());
    const remainingWeight = selectedStrategies
      .slice(index)
      .reduce((sum, item) => sum + item.weight, 0);
    const strategyBudget = Math.max(
      12_000,
      Math.min(
        remainingMs,
        Math.floor(remainingMs * (strategy.weight / Math.max(0.1, remainingWeight))),
      ),
    );

    const strategyClassrooms = prepareClassrooms(
      classrooms,
      teachers,
      strategy,
    );

    const strategySettings = {
      ...(config.constraintSettings || {}),
      seed:
        Number((config.constraintSettings as any)?.seed || 1729) +
        strategy.seedOffset,
    } as Partial<ScheduleConstraintSettings> & { seed?: number };

    const runStarted = Date.now();

    const result = await runKorayUcarEngine(
      {
        ...config,
        constraintSettings: strategySettings,
        timeLimitMs: strategyBudget,
        // V3 kendi portfolio'sunu yürüttüğü için her alt koşuda kontrollü restart.
        restarts: Math.max(3, Math.min(8, config.restarts || 5)),
      },
      currentSchedule,
      strategyClassrooms,
      teachers,
      courses,
      unwantedTeacherDays,
      {
        ...callbacks,
        onProgress: (progress, unplaced, details) => {
          const base = (index / selectedStrategies.length) * 100;
          const span = 100 / selectedStrategies.length;
          callbacks?.onProgress?.(
            Math.min(99, Math.floor(base + (progress / 100) * span)),
            unplaced,
            details,
          );
        },
      },
    );

    const score = resultScore(
      result,
      classrooms,
      teachers,
      unwantedTeacherDays,
    );

    reports.push({
      name: strategy.name,
      placed:
        (result.statistics?.totalBlocks || 0) -
        (result.unplacedBlocks?.length || 0),
      total: result.statistics?.totalBlocks || 0,
      penalty: result.finalPenalty,
      durationMs: Date.now() - runStarted,
      success: result.success,
    });

    if (score < bestScore) {
      best = result;
      bestScore = score;
      bestStrategy = strategy.name;
    }

    // Tam ve doğrulanmış çözüm bulduysak kalan bütçeyi gereksiz tüketmeyiz.
    // Sonraki kalite polish'i V2'nin LNS/penalty katmanı zaten yapmıştır.
    if (result.success && result.unplacedBlocks.length === 0) break;
  }

  if (!best) {
    // Güvenli fallback: V2'yi tek koşu çalıştır.
    best = await runKorayUcarEngine(
      {
        ...config,
        timeLimitMs: Math.max(15_000, deadline - Date.now()),
      },
      currentSchedule,
      classrooms,
      teachers,
      courses,
      unwantedTeacherDays,
      callbacks,
    );
  }

  callbacks?.onProgress?.(
    100,
    best.unplacedBlocks.length,
    best.unplacedBlocks,
  );

  return {
    ...best,
    details:
      `${config.draftWithoutTeachers ? "TASLAK PROGRAM / ÖĞRETMENSİZ MOD. " : ""}` +
      `${KORAY_UCAR_V3_ENGINE_NAME}: ${bestStrategy} stratejisi seçildi. ` +
      `${reports
        .map(
          (report) =>
            `${report.name}=${report.placed}/${report.total}, ${Math.round(report.durationMs / 1000)} sn`,
        )
        .join(" | ")}. ` +
      best.details,
    v3: {
      engine: KORAY_UCAR_V3_ENGINE_NAME,
      strategiesTried: reports,
      winningStrategy: bestStrategy,
      totalPortfolioMs: Date.now() - started,
    },
  };
}
