import { useCallback, useEffect, useRef, useState } from "react";
import type { Classroom, Course, Teacher } from "../types";
import type { ScheduleAlgorithm, ScheduleScope, ScheduleViewType, SolverResult, UnplacedInfo } from "../types/schedule";
import { ScheduleSolverWorkerClient } from "../services/schedule/scheduleSolverWorkerClient";
import { DISTRIBUTION_REPORT_STORAGE_KEY } from "../services/schedule/scheduleRules";
import { useScheduleConstraintStore } from "../stores/scheduleConstraintStore";
import { useScheduleStore } from "../stores/scheduleStore";
import { runSchedulePreflight } from "../services/schedule/schedulePreflight";
import { validateSmartFullSchedule } from "../services/schedule/smartFullScheduleValidator";
import { buildCourseBlocks } from "../services/schedule/courseAssignmentService";
import { getPhysicalClassIdentity, getScheduleWeeklyHours, isCommonCourseForClass, normalizeScheduleText } from "../services/schedule/scheduleIdentity";

import { sqliteStorage } from "../lib/sqliteStorageBridge";
type ScheduleData = Record<string, any>;

type WriteAssignment = (
  newSchedule: ScheduleData,
  day: string,
  hour: number,
  item: any,
  selectedId: string,
  viewType: ScheduleViewType,
) => void;

interface UseScheduleOptimizerArgs {
  teachers: Teacher[];
  classrooms: Classroom[];
  courses: Course[];
  scheduleData: ScheduleData;
  setScheduleData: (value: ScheduleData | ((prev: ScheduleData) => ScheduleData)) => void;
  viewType: ScheduleViewType;
  selectedId: string;
  selectedAlgorithm: ScheduleAlgorithm;
  selectedScope: ScheduleScope;
  unwantedTeacherDays: Record<string, string[]>;
  totalPenalty: number;
  unplacedInfo: UnplacedInfo;
  setSolverRunning: (value: boolean) => void;
  setSolverProgress: (value: number) => void;
  setSolverResult: (value: SolverResult | null) => void;
  setUnplacedInfo: (value: UnplacedInfo) => void;
  setSolverStats: (value: {
    totalBlocks?: number;
    placedBlocks?: number;
    remainingBlocks?: number;
    stage?: string;
  }) => void;
  writeAssignment: WriteAssignment;
  refreshSchedulingDatabase: () => Promise<void> | void;
}

/**
 * Yerel sınıf dağıtımında aynı fiziksel sınıfın (örn. 11C) farklı grup
 * kayıtları varsa, seçilen gruba yerleşen ORTAK dersleri kardeş grup
 * kayıtlarının aynı gün/saat hücresine de yansıtır. Grup/seçmeli derslere
 * dokunmaz. Böylece otomatik "Sınıf Dağıtımı" manuel yerleştirme ile
 * aynı temel kuralı uygular.
 */
function mirrorCommonCoursesToSiblingGroups(
  solvedSchedule: ScheduleData,
  classrooms: Classroom[],
  selectedClassId: string,
): ScheduleData {
  const selectedClass = (classrooms as any[]).find((cls) => String(cls?.id) === String(selectedClassId));
  if (!selectedClass) return solvedSchedule;

  const physicalIdentity = getPhysicalClassIdentity(selectedClass);
  const siblings = (classrooms as any[]).filter((cls) =>
    String(cls?.id) !== String(selectedClassId) && getPhysicalClassIdentity(cls) === physicalIdentity,
  );
  if (!siblings.length) return solvedSchedule;

  const commonCourses = (selectedClass?.assignedCourses || []).filter((course: any) =>
    isCommonCourseForClass(course) || course?.isCommonElective === true,
  );
  if (!commonCourses.length) return solvedSchedule;

  const isSelectedCommon = (item: any) => commonCourses.some((course: any) => {
    const sameName = normalizeScheduleText(course?.courseName || course?.name || course?.subject) ===
      normalizeScheduleText(item?.courseName || item?.name || item?.subject);
    if (!sameName) return false;
    const sourceHours = Number(course?.weeklyHours || 0);
    const itemHours = Number(item?.weeklyHours || 0);
    return !sourceHours || !itemHours || sourceHours === itemHours;
  });

  const next: ScheduleData = { ...solvedSchedule };
  const selectedPrefix = `class_${selectedClassId}_`;

  for (const [key, rawValue] of Object.entries(solvedSchedule)) {
    if (!key.startsWith(selectedPrefix) || !rawValue) continue;
    const suffix = key.slice(selectedPrefix.length);
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    const commonValues = values.filter(isSelectedCommon);
    if (!commonValues.length) continue;

    for (const sibling of siblings) {
      const siblingKey = `class_${sibling.id}_${suffix}`;
      const siblingRaw = next[siblingKey];
      const siblingValues = siblingRaw ? (Array.isArray(siblingRaw) ? siblingRaw : [siblingRaw]) : [];

      // Ortak ders bütün fiziksel sınıfı kapatır. Otomatik oluşturulmuş grup
      // dersleri varsa bu saatte tutulamaz; manuel/kilitli kayıtları ise asla
      // sessizce silmeyiz.
      const protectedValues = siblingValues.filter((item: any) => item?.isManual === true || item?.locked === true || item?.isLocked === true);
      if (protectedValues.length && !protectedValues.some(isSelectedCommon)) continue;

      next[siblingKey] = commonValues.map((item: any) => ({
        ...item,
        className: sibling.name || item?.className || selectedClass.name,
        groupName: "",
        targetGroups: [],
      }));
    }
  }

  return next;
}


/**
 * Yerel bir grup dağıtılırken çözücü sonuç programını yeniden kurabildiği için
 * kardeş grubun daha önce dağıtılmış alan/seçmeli dersleri sonuçtan düşebilir.
 * Bu yardımcı yalnızca kardeş grupların ORTAK OLMAYAN mevcut derslerini korur.
 * Ortak dersler mirrorCommonCoursesToSiblingGroups tarafından iki grupta aynı
 * hücreye eşitlenir. Seçilen grubun eski dersleri korunmaz; o grup yeniden
 * dağıtılabilsin diye çözücü sonucuna bırakılır.
 */
function preserveSiblingGroupAssignments(
  solvedSchedule: ScheduleData,
  previousSchedule: ScheduleData,
  classrooms: Classroom[],
  selectedClassId: string,
): ScheduleData {
  const selectedClass = (classrooms as any[]).find((cls) => String(cls?.id) === String(selectedClassId));
  if (!selectedClass) return solvedSchedule;

  const physicalIdentity = getPhysicalClassIdentity(selectedClass);
  const siblingIds = new Set(
    (classrooms as any[])
      .filter((cls) => String(cls?.id) !== String(selectedClassId) && getPhysicalClassIdentity(cls) === physicalIdentity)
      .map((cls) => String(cls.id)),
  );
  if (!siblingIds.size) return solvedSchedule;

  const next: ScheduleData = { ...solvedSchedule };
  const isCommon = (item: any) =>
    isCommonCourseForClass(item) || item?.isCommonElective === true;

  for (const [key, oldRaw] of Object.entries(previousSchedule)) {
    const match = key.match(/^class_([^_]+)_(.+)$/);
    if (!match || !siblingIds.has(String(match[1])) || !oldRaw) continue;

    const oldValues = (Array.isArray(oldRaw) ? oldRaw : [oldRaw]).filter(Boolean);
    const oldGroupOnly = oldValues.filter((item: any) => !isCommon(item));
    if (!oldGroupOnly.length) continue;

    const newRaw = next[key];
    const newValues = newRaw ? (Array.isArray(newRaw) ? newRaw : [newRaw]).filter(Boolean) : [];

    // Çözücü kardeş grubun bu hücresini hiç üretmediyse mevcut seçmeli/alan
    // dersini aynen geri koy. Hücrede ortak ders varsa eski seçmeli dersi aynı
    // saate zorlamayız; ortak ders önceliklidir.
    if (!newValues.length) {
      next[key] = Array.isArray(oldRaw) ? oldGroupOnly : oldGroupOnly[0];
      continue;
    }
    if (newValues.some(isCommon)) continue;

    // Kardeş grubun seçmeli dersi sonuçta zaten varsa çoğaltma. Yoksa mevcut
    // kaydı koru. Normalde bir grup hücresinde tek ders olur; dizi desteği iki
    // grup gösterimi kullanan mevcut yapıyla uyumluluk içindir.
    const merged = [...newValues];
    for (const oldItem of oldGroupOnly) {
      const exists = merged.some((item: any) =>
        normalizeScheduleText(item?.courseName || item?.name) === normalizeScheduleText(oldItem?.courseName || oldItem?.name) &&
        normalizeScheduleText(item?.groupName) === normalizeScheduleText(oldItem?.groupName),
      );
      if (!exists) merged.push(oldItem);
    }
    next[key] = merged.length === 1 ? merged[0] : merged;
  }

  return next;
}

/**
 * Manuel yerleştirilen dersler otomatik dağıtımın değişmez sabitleridir.
 * Çözücü bir sonuç döndürse bile, çalıştırma öncesindeki isManual kayıtları
 * aynı anahtar/hücre üzerinde aynen geri konur. Böylece sınıf, öğretmen veya
 * genel dağıtım manuel yerleştirmeyi taşıyamaz ya da silemez.
 */
function preserveManualAssignments(
  solvedSchedule: ScheduleData,
  previousSchedule: ScheduleData,
): ScheduleData {
  const next: ScheduleData = { ...solvedSchedule };

  for (const [key, rawValue] of Object.entries(previousSchedule || {})) {
    if (!key.startsWith("class_") && !key.startsWith("teacher_")) continue;
    if (!rawValue) continue;
    const values = (Array.isArray(rawValue) ? rawValue : [rawValue]).filter(Boolean);
    const manualValues = values.filter((item: any) => item?.isManual === true);
    if (!manualValues.length) continue;

    // Manuel dersin bulunduğu hücre çözücü tarafından yeniden yazılamaz.
    // Aynı hücrede birden fazla manuel grup dersi varsa tamamını koru.
    next[key] = Array.isArray(rawValue) || manualValues.length > 1
      ? manualValues.map((item: any) => ({ ...item, isManual: true }))
      : { ...manualValues[0], isManual: true };
  }

  return next;
}

const algorithmTitle = (algorithm: ScheduleAlgorithm) => {
  switch (algorithm) {
    case "smart-full": return "Akıllı Tam Dağıtım";
    case "korayucardraft": return "Öğretmensiz Taslak Dağıtım";
    case "korayucarv3": return "KorayUçar V3";
    case "korayucar": return "KorayUçar V2";
    case "hybrid": return "Hibrit CSP + Backtracking + Genetik";
    case "ortools": return "Google OR-Tools";
    case "backtracking": return "Geriye Dönük Akıllı Dağıtım";
  }
};

const algorithmLogTitle = (algorithm: string) => {
  switch (algorithm) {
    case "smart-full": return "Akıllı Tam Dağıtım";
    case "korayucardraft": return "KorayUçar Taslak";
    case "korayucarv3": return "KorayUçar V3";
    case "korayucar": return "KorayUçar V2";
    case "hybrid": return "Hybrid CSP + Backtracking + Genetic";
    case "ortools": return "Google OR-Tools";
    case "backtracking": return "Backtracking Solver";
    default: return "Local Schedule Solver";
  }
};

type ExecutableAlgorithm = Exclude<ScheduleAlgorithm, "ortools" | "smart-full">;

// Dağıtım için tek kanonik yol: kısıt-öncelikli backtracking motoru.
// Eski/deneysel motorlara otomatik geri dönüş yapılmaz; aksi halde farklı
// kurallar aynı veride farklı ve izlenemez sonuçlar üretiyordu.
const fallbackAlgorithms: ExecutableAlgorithm[] = ["backtracking"];

export function useScheduleOptimizer({
  teachers,
  classrooms,
  courses,
  scheduleData,
  setScheduleData,
  viewType,
  selectedId,
  selectedAlgorithm,
  selectedScope,
  unwantedTeacherDays,
  totalPenalty,
  unplacedInfo,
  setSolverRunning,
  setSolverProgress,
  setSolverResult,
  setUnplacedInfo,
  setSolverStats,
  writeAssignment,
  refreshSchedulingDatabase,
}: UseScheduleOptimizerArgs) {
  const constraintSettings = useScheduleConstraintStore((state) => state.settings);
  const [solverTargetCourse, setSolverTargetCourse] = useState<any | null>(null);
  const [isSolverPaused, setIsSolverPaused] = useState(false);
  const [lastDistributionReport, setLastDistributionReport] = useState<any | null>(null);
  const solverPausedRef = useRef(false);
  const solverCancelledRef = useRef(false);
  const showCurrentRequestedRef = useRef(false);
  const workerClientRef = useRef<ScheduleSolverWorkerClient | null>(null);
  // Aynı anda iki çözüm çalıştırılmaması için eşzamanlı başlatmayı engelle.
  const optimizerInFlightRef = useRef(false);

  useEffect(() => {
    try {
      const saved = sqliteStorage.getItem(DISTRIBUTION_REPORT_STORAGE_KEY);
      if (saved) setLastDistributionReport(JSON.parse(saved));
    } catch (error) {
      console.warn("Kaydedilmiş dağıtım raporu okunamadı:", error);
    }
  }, []);

  useEffect(() => () => workerClientRef.current?.terminate(), []);

  const saveLastDistributionReport = useCallback((report: any) => {
    setLastDistributionReport(report);
    try {
      if (report === null) sqliteStorage.removeItem(DISTRIBUTION_REPORT_STORAGE_KEY);
      else sqliteStorage.setItem(DISTRIBUTION_REPORT_STORAGE_KEY, JSON.stringify(report));
    } catch (error) {
      console.warn("Dağıtım raporu kaydedilemedi:", error);
    }
  }, []);

  const requestSolverPause = useCallback(() => {
    solverPausedRef.current = true;
    workerClientRef.current?.pause();
    setIsSolverPaused(true);
    setSolverResult({
      success: false,
      courseName: "Dağıtım duraklatıldı",
      reasons: ["Dağıtım güvenli durma noktasında bekletiliyor. Devam Et düğmesine basabilirsiniz."],
    });
  }, [setSolverResult]);

  const requestSolverResume = useCallback(() => {
    solverPausedRef.current = false;
    workerClientRef.current?.resume();
    setIsSolverPaused(false);
    setSolverResult(null);
  }, [setSolverResult]);

  const requestSolverCancel = useCallback(() => {
    solverCancelledRef.current = true;
    workerClientRef.current?.cancel();
    solverPausedRef.current = false;
    setIsSolverPaused(false);
    setSolverRunning(false);
    setSolverProgress(0);
    setSolverTargetCourse(null);
    setSolverResult({
      success: false,
      courseName: "Dağıtım iptal edildi",
      reasons: ["İptal isteği alındı. İşlem ilk güvenli noktada sonlandırılacak ve sonuç programa uygulanmayacak."],
    });
  }, [setSolverProgress, setSolverResult, setSolverRunning]);

  const requestShowCurrentDistribution = useCallback(() => {
    // V10 doğrudan ana-thread çözücüsü kullanır. shouldCancel() bu bayrağı
    // bir sonraki güvenli kontrol noktasında görür ve mevcut program korunur.
    showCurrentRequestedRef.current = true;
    workerClientRef.current?.cancel();
    solverPausedRef.current = false;
    setIsSolverPaused(false);

    const stats = useScheduleStore.getState().solverStats;
    setSolverRunning(false);
    setSolverStats({ stage: "Dağıtım durduruldu — mevcut program gösteriliyor" });
    setSolverResult({
      success: false,
      courseName: "Mevcut program dağıtımı gösteriliyor",
      reasons: [
        `${stats.placedBlocks} blok yerleştirildi.`,
        `${stats.remainingBlocks} blok henüz yerleştirilmedi.`,
        "O ana kadar bulunan en iyi dağıtım ekranda korunmuştur.",
      ],
    });
  }, [setSolverResult, setSolverRunning, setSolverStats]);

  const runGemini = useCallback(async () => {
    const response = await fetch("/api/scheduling/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classrooms, teachers, scheduleData }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Gemini API hatası oluştu.");
    }

    const responseData = await response.json();
    const newSchedule: ScheduleData = {};
    Object.entries(scheduleData).forEach(([key, value]) => {
      if (key.startsWith("blocked_")) newSchedule[key] = value;
    });

    let placedCount = 0;
    let totalLessons = 0;
    Object.entries(responseData.sinif_programlari || {}).forEach(([className, dayData]: [string, any]) => {
      const classroom = classrooms.find((item) => item.name === className);
      if (!classroom) return;
      Object.entries(dayData || {}).forEach(([day, hourList]: [string, any]) => {
        if (!Array.isArray(hourList)) return;
        hourList.forEach((courseName: string, index: number) => {
          if (!courseName || courseName === "Boş") return;
          totalLessons += 1;
          const candidates = (classroom.assignedCourses || []).filter((item) => item.courseName === courseName);
          const placedHours = (candidate: any) => Object.entries(newSchedule).reduce((count, [key, value]) => {
            if (!key.startsWith(`class_${classroom.id}_`)) return count;
            const values = Array.isArray(value) ? value : [value];
            return count + values.filter((item: any) => item?.courseName === candidate.courseName && (item?.groupName || "") === (candidate.groupName || "")).length;
          }, 0);
          const assigned = candidates.find((item) => placedHours(item) < (item.weeklyHours || 0)) || candidates[0];
          if (!assigned) return;
          writeAssignment(newSchedule, day, index + 1, {
            courseName: assigned.courseName,
            teacherName: assigned.teacherName || "",
            teacherName2: assigned.teacherName2 || "",
            className: classroom.name,
            type: assigned.type || "",
            groupName: assigned.groupName || "",
            blockId: `gemini_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
            isManual: false,
          }, classroom.id, "class");
          placedCount += 1;
        });
      });
    });

    setScheduleData(newSchedule);
    const logPayload = {
      algorithm: "Gemini AI Optimization",
      initial_penalty: 0,
      final_penalty: 0,
      duration_ms: 1200,
      status: "Success",
      details: `Gemini AI ile toplam ${placedCount}/${totalLessons} ders başarıyla dağıtıldı.`,
    };
    await fetch("/api/scheduling/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logPayload),
    });
    await refreshSchedulingDatabase();
    setSolverResult({ success: true, courseName: `Yöntem: Gemini AI (Toplam ${placedCount} ders yerleştirildi)` });
  }, [classrooms, refreshSchedulingDatabase, scheduleData, setScheduleData, setSolverResult, teachers, writeAssignment]);

  const runOrTools = useCallback(async (configOverride: {
    scope: ScheduleScope;
    selectedId?: string;
    viewType?: ScheduleViewType;
    currentScheduleOverride?: ScheduleData;
  }) => {
    const response = await fetch("/api/scheduling/ortools/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          algorithm: "ortools",
          scope: configOverride.scope,
          selectedId: configOverride.selectedId,
          viewType: configOverride.viewType,
          // Büyük okul modellerinde ilk uygulanabilir sonuçtan sonra tam kapsama
          // ulaşmak için aramaya yeterli süre bırak. Kullanıcı isterse dağıtımı
          // ilerleme penceresinden iptal edebilir.
          timeLimitSeconds: configOverride.scope === "global" ? 300 : 120,
          portfolioSize: configOverride.scope === "global" ? 6 : 4,
        },
        currentSchedule: configOverride.currentScheduleOverride ?? scheduleData,
        classrooms,
        teachers,
        courses,
        unwantedTeacherDays,
        settings: constraintSettings,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.error) {
      throw new Error(result?.error || result?.details || "OR-Tools CP-SAT servisi çalıştırılamadı.");
    }
    return result;
  }, [classrooms, constraintSettings, courses, scheduleData, teachers, unwantedTeacherDays]);

  const handleRunOptimizer = useCallback(async (overrides?: {
    scope?: ScheduleScope;
    selectedId?: string;
    viewType?: ScheduleViewType;
    algorithm?: ScheduleAlgorithm;
  }) => {
    const effectiveScope = overrides?.scope ?? selectedScope;
    const effectiveSelectedId = effectiveScope === "global"
      ? undefined
      : (overrides?.selectedId ?? selectedId);
    const effectiveViewType = effectiveScope === "global"
      ? undefined
      : (overrides?.viewType ?? viewType);
    // Dağıtım motorunu çağrının istediği algoritmaya göre çalıştır. Genel dağıtım
    // varsayılan olarak tarayıcı içindeki akıllı hibrit portföyü kullanır; OR-Tools
    // ayrıca seçildiğinde kullanılmaya devam eder. Böylece harici Python çözücüsü
    // kurulmamış olsa bile program dağıtımı çalışır.
    const effectiveAlgorithm: ScheduleAlgorithm = overrides?.algorithm ?? selectedAlgorithm ?? "smart-full";

    if (effectiveScope === "local" && !effectiveSelectedId) {
      setSolverResult({ success: false, courseName: "Seçim gerekli", reasons: ["Yerel dağıtım için önce bir sınıf veya öğretmen seçiniz."] });
      return;
    }

    // Blok sayısı ön kontrole girilmeden hesaplanır. Böylece geçersiz tek bir
    // ders kaydı çözücüyü durdursa bile ekranda sahte "0 blok / %100" görünmez.
    const requestedBlocks = (classrooms as any[]).reduce((total, classroom) =>
      total + (Array.isArray(classroom?.assignedCourses) ? classroom.assignedCourses : [])
        .reduce((sum: number, course: any) => {
          const hours = getScheduleWeeklyHours(course);
          return sum + buildCourseBlocks(course, hours).length;
        }, 0), 0);
    const assignedCourseCount = (classrooms as any[]).reduce((total, classroom) =>
      total + (Array.isArray(classroom?.assignedCourses) ? classroom.assignedCourses.length : 0), 0);

    // Önceki çalıştırma devam ederken ikinci çağrı arayüz durumunu sıfırlamasın.
    if (optimizerInFlightRef.current) return;
    optimizerInFlightRef.current = true;

    solverCancelledRef.current = false;
    showCurrentRequestedRef.current = false;
    solverPausedRef.current = false;
    setSolverStats({
      totalBlocks: requestedBlocks,
      placedBlocks: 0,
      remainingBlocks: requestedBlocks,
      stage: "Dağıtım hazırlanıyor...",
    });
    setSolverTargetCourse(null);
    setIsSolverPaused(false);
    setSolverRunning(true);
    setSolverProgress(0);
    setSolverResult(null);
    saveLastDistributionReport(null);

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 150));

      if (requestedBlocks === 0) {
        const cause = assignedCourseCount === 0
          ? "Ders Dağıtım Planına aktarılan sınıfların assignedCourses listeleri boş. Ders tanımları ile dağıtım ekranına gelen sınıf verileri arasındaki bağlantı kontrol edilmeli."
          : "Sınıflarda ders kaydı var fakat hiçbirinde geçerli haftalık ders saati yok. Ders saatleri ve kayıt biçimi kontrol edilmeli.";
        setSolverStats({ totalBlocks: 0, placedBlocks: 0, remainingBlocks: 0, stage: "Dağıtım başlatılamadı — ders bloğu bulunamadı" });
        setSolverResult({ success: false, courseName: "Dağıtılacak ders bloğu bulunamadı", reasons: [cause] });
        return;
      }

      if (effectiveAlgorithm === "smart-full") {
        {
        const startedAt = Date.now();
        const preflight = runSchedulePreflight(classrooms, teachers, constraintSettings);
        const fatal = preflight.issues.filter(
          (issue) => issue.severity === "error" && issue.code === "invalid_weekly_hours",
        );

        if (fatal.length) {
          setSolverStats({
            totalBlocks: requestedBlocks,
            placedBlocks: 0,
            remainingBlocks: requestedBlocks,
            stage: "Dağıtım başlatılamadı — haftalık ders saati kontrolü",
          });
          setSolverResult({
            success: false,
            courseName: "Akıllı Tam Dağıtım başlatılamadı",
            reasons: fatal.slice(0, 10).map((item) => item.message),
          });
          return;
        }

        // Canonical full-distribution path: the entire school is solved as one
        // constraint problem. The former class-by-class loop committed early
        // classes before later classes were considered, so a valid manual move
        // could remain invisible to the automatic run.
        const totalBlocks = (classrooms as any[]).reduce((total, classroom) =>
          total + (classroom.assignedCourses || []).reduce((classTotal: number, course: any) => {
            const weeklyHours = getScheduleWeeklyHours(course);
            return classTotal + buildCourseBlocks(course, weeklyHours).length;
          }, 0),
        0);

        setSolverStats({
          totalBlocks,
          placedBlocks: 0,
          remainingBlocks: totalBlocks,
          stage: "Tüm okul için kısıt modeli hazırlanıyor...",
        });

        if (!workerClientRef.current) workerClientRef.current = new ScheduleSolverWorkerClient();
        const result = await workerClientRef.current.run(
          {
            config: {
              algorithm: "hybrid",
              scope: "global",
              constraintSettings,
            },
            currentSchedule: scheduleData,
            classrooms,
            teachers,
            courses,
            unwantedTeacherDays,
          },
          ({ progress, unplacedCount, unplacedDetails }) => {
            // Worker başlangıç için progress:0/unplacedCount:0 gönderir. Bu, bütün
            // blokların yerleştiği anlamına gelmez: 0/554 olarak korunmalı.
            if (Number(progress || 0) <= 0) {
              setSolverProgress(0);
              setSolverStats({
                totalBlocks,
                placedBlocks: 0,
                remainingBlocks: totalBlocks,
                stage: "Dağıtım motoru başlatıldı; ilk yerleşim bekleniyor...",
              });
              return;
            }
            const remaining = Math.max(0, Number(unplacedCount || 0));
            const placed = Math.max(0, totalBlocks - remaining);
            setSolverProgress(Math.max(1, Math.min(99, Number(progress || 0))));
            setSolverStats({
              totalBlocks,
              placedBlocks: Math.min(totalBlocks, placed),
              remainingBlocks: remaining,
              stage:
                progress < 35
                  ? "İlk global aday program kuruluyor..."
                  : progress < 46
                    ? "CSP / geri izleme ile global çakışmalar çözülüyor..."
                    : progress < 72
                      ? "Tüm otomatik program atomik olarak yeniden kuruluyor..."
                      : progress < 98
                        ? "Büyük komşuluklar birlikte sökülüp yeniden çözülüyor..."
                        : "Program doğrulanıyor ve en iyi çözüm seçiliyor...",
            });
            setUnplacedInfo({
              count: remaining,
              details: Array.isArray(unplacedDetails) ? unplacedDetails : [],
            });
          },
        );

        if (solverCancelledRef.current) throw new Error("__ROTA_SOLVER_CANCELLED__");

        const workingSchedule = result.schedule || scheduleData;
        const unplacedBlocks = Array.isArray(result.unplacedBlocks) ? result.unplacedBlocks : [];
        const validation = validateSmartFullSchedule(workingSchedule, classrooms, teachers);
        const success = unplacedBlocks.length === 0 && validation.valid;
        // Worker sonucu boş/eksik geldiğinde ilerleme kartı 0/total gösterip
        // başarılı görünebiliyordu. Sonucu toplam blok sayısına göre normalize
        // ederek görünür istatistiklerin dağıtım sonucuyla tutarlı kalmasını sağla.
        const placedBlocks = Math.max(0, Math.min(totalBlocks, totalBlocks - unplacedBlocks.length));

        setUnplacedInfo({ count: unplacedBlocks.length, details: unplacedBlocks });
        setSolverProgress(100);
        setSolverStats({
          totalBlocks,
          placedBlocks,
          remainingBlocks: unplacedBlocks.length,
          stage: success ? "Akıllı Tam Dağıtım V2 tamamlandı" : "Kısmi dağıtım tamamlandı; engeller raporlandı",
        });
        saveLastDistributionReport({
          algorithm: "smart-full",
          success,
          initialPenalty: result.initialPenalty,
          finalPenalty: result.finalPenalty,
          durationMs: result.durationMs,
          details: result.details,
          unplacedBlocks,
          completedAt: new Date().toISOString(),
        });
        setSolverResult({
          success,
          courseName: success
            ? `Akıllı Tam Dağıtım V2 tamamlandı — ${placedBlocks}/${totalBlocks} blok`
            : `Akıllı Tam Dağıtım V2 kısmi tamamlandı — ${placedBlocks}/${totalBlocks} blok`,
          reasons: success
            ? undefined
            : [
                ...unplacedBlocks.slice(0, 8).map((block: any) =>
                  `${block.className || "Sınıf"} / ${block.courseName || block?.course?.courseName || "Ders"}: ${block.reason || "uygun slot bulunamadı"}`,
                ),
                ...validation.safetyErrors.slice(0, 2),
              ],
        });
        // Çözücünün en iyi aday programını uygula. Hard constraint doğrulaması
        // geçmiştir; yerleşemeyen blok varsa raporda ayrıca görünür.
        if (validation.valid) setScheduleData(workingSchedule);
        return;
        }

        // V8: Sınıf sınıf dağıtım.
        // 488 blokluk tek dev problem yerine her sınıf ayrı çözülür.
        // Daha önce çözülen sınıflar schedule üzerinde kaldığı için öğretmen çakışmaları
        // sonraki sınıflarda otomatik olarak dikkate alınır.
        const cleanSchedule: ScheduleData = JSON.parse(JSON.stringify(scheduleData || {}));
        for (const key of Object.keys(cleanSchedule)) {
          if (!key.startsWith("class_") && !key.startsWith("teacher_")) continue;
          const raw = cleanSchedule[key];
          const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
          const keep = items.filter((item: any) => item?.isManual || item?.isLocked);
          if (keep.length) cleanSchedule[key] = keep;
          else delete cleanSchedule[key];
        }

        const classPlans = (classrooms as any[])
          .map((cls) => {
            const assigned = Array.isArray(cls.assignedCourses) ? cls.assignedCourses : [];
            const blockCount = assigned.reduce((sum: number, course: any) => {
              const weekly = Math.max(
                0,
                Number(course?.weeklyHours ?? String(course?.schedule || "").match(/(\d+)/)?.[1] ?? 0),
              );
              return sum + buildCourseBlocks(course, weekly).length;
            }, 0);
            return { cls, blockCount };
          })
          .filter((item) => item.blockCount > 0)
          .sort((a, b) => b.blockCount - a.blockCount || String(a.cls.name).localeCompare(String(b.cls.name)));

        const totalBlocks = classPlans.reduce((sum, item) => sum + item.blockCount, 0);
        let placedBlocks = 0;
        let workingSchedule = cleanSchedule;
        const allUnplaced: any[] = [];

        setSolverProgress(1);
        setSolverStats({
          totalBlocks,
          placedBlocks: 0,
          remainingBlocks: totalBlocks,
          stage: `Sınıflar hazırlanıyor — ${classPlans.length} sınıf`,
        });
        setScheduleData(workingSchedule);

        for (let classIndex = 0; classIndex < classPlans.length; classIndex += 1) {
          if (solverCancelledRef.current || showCurrentRequestedRef.current) break;

          const { cls, blockCount } = classPlans[classIndex];
          const beforePlaced = placedBlocks;
          setSolverStats({
            totalBlocks,
            placedBlocks,
            remainingBlocks: Math.max(0, totalBlocks - placedBlocks),
            stage: `${cls.name} dağıtılıyor (${classIndex + 1}/${classPlans.length})`,
          });

          // UI önce sınıf adını ve gerçek başlangıç durumunu çizsin.
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

          // Akıllı Tam Dağıtım artık sınıfı, kullanıcıdaki "Sınıfı Dağıt"
          // düğmesinin kullandığı AYNI motorla çözer. Önceki instant/hybrid yol
          // hızlıydı fakat özellikle 2+2+1 bloklarında son 1 saati ve paralel
          // grup seçmelilerini gereğinden erken bırakabiliyordu.
          if (!workerClientRef.current) workerClientRef.current = new ScheduleSolverWorkerClient();
          const classResult = await workerClientRef.current.run(
            {
              config: {
                algorithm: "backtracking",
                scope: "local",
                selectedId: String(cls.id),
                viewType: "class",
                constraintSettings,
              },
              currentSchedule: workingSchedule,
              classrooms,
              teachers,
              courses,
              unwantedTeacherDays,
            },
            ({ progress, unplacedCount, unplacedDetails }) => {
              // İlk worker bildirimi istatistik değildir; yerleşmiş blok sayısını artırma.
              if (Number(progress || 0) <= 0) return;
              const classPlaced = Math.max(0, blockCount - Number(unplacedCount || 0));
              const livePlaced = beforePlaced + classPlaced;
              const globalProgress = Math.max(
                1,
                Math.min(
                  99,
                  Math.round(
                    ((classIndex + Math.max(0, Math.min(100, Number(progress || 0))) / 100) /
                      Math.max(1, classPlans.length)) *
                      100,
                  ),
                ),
              );

              setSolverProgress(globalProgress);
              setSolverStats({
                totalBlocks,
                placedBlocks: Math.min(totalBlocks, livePlaced),
                remainingBlocks: Math.max(0, totalBlocks - livePlaced),
                stage: `${cls.name} derin çözülüyor (${classIndex + 1}/${classPlans.length})`,
              });
              setUnplacedInfo({
                count: Number(unplacedCount || 0),
                details: Array.isArray(unplacedDetails) ? unplacedDetails : [],
              });
            },
          );

          if (classResult?.schedule) {
            workingSchedule = classResult.schedule;
            setScheduleData(workingSchedule);
          }

          const classRemaining = Array.isArray(classResult?.unplacedBlocks)
            ? classResult.unplacedBlocks
            : [];
          const actuallyPlaced = Math.max(0, blockCount - classRemaining.length);
          placedBlocks += actuallyPlaced;
          allUnplaced.push(...classRemaining);

          setSolverProgress(
            Math.max(
              1,
              Math.min(99, Math.round(((classIndex + 1) / Math.max(1, classPlans.length)) * 100)),
            ),
          );
          setSolverStats({
            totalBlocks,
            placedBlocks: Math.min(totalBlocks, placedBlocks),
            remainingBlocks: Math.max(0, totalBlocks - placedBlocks),
            stage:
              classRemaining.length === 0
                ? `${cls.name} tamamlandı`
                : `${cls.name}: ${classRemaining.length} blok kaldı`,
          });

          // Sonraki sınıfa geçmeden önce arayüzün güncellenmesine izin ver.
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }

        // KURTARMA TURLARI: İlk sınıf-sınıf geçişte eksik kalan sınıfları,
        // artık oluşmuş tam program üzerinde tekrar çöz. Tekil "Sınıfı Dağıt"
        // düğmesinin sonradan başarılı olmasının temel farkı budur: aynı sınıf
        // daha olgun bir başlangıç programı üzerinde yeniden backtracking/repair
        // görür. Yalnızca eksik blok sayısı gerçekten azalırsa sonucu kabul et.
        if (allUnplaced.length > 0 && !solverCancelledRef.current && !showCurrentRequestedRef.current) {
          const rescuePassLimit = 3;
          for (let rescuePass = 1; rescuePass <= rescuePassLimit; rescuePass += 1) {
            const pendingNames = new Set(
              allUnplaced
                .map((item: any) => String(item?.className || item?.course?.className || "").trim())
                .filter(Boolean),
            );
            const pendingPlans = classPlans.filter((item) => pendingNames.has(String(item.cls.name)));
            if (!pendingPlans.length) break;

            let improvedThisPass = false;
            for (let pendingIndex = 0; pendingIndex < pendingPlans.length; pendingIndex += 1) {
              if (solverCancelledRef.current || showCurrentRequestedRef.current) break;
              const { cls } = pendingPlans[pendingIndex];
              const className = String(cls.name);
              const previousForClass = allUnplaced.filter(
                (item: any) => String(item?.className || item?.course?.className || "") === className,
              );
              if (!previousForClass.length) continue;

              setSolverStats({
                totalBlocks,
                placedBlocks: Math.max(0, totalBlocks - allUnplaced.length),
                remainingBlocks: allUnplaced.length,
                stage: `${className} kurtarma turu ${rescuePass}/${rescuePassLimit}`,
              });
              await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

              if (!workerClientRef.current) workerClientRef.current = new ScheduleSolverWorkerClient();
              const retryResult = await workerClientRef.current.run(
                {
                  config: {
                    algorithm: "backtracking",
                    scope: "local",
                    selectedId: String(cls.id),
                    viewType: "class",
                    constraintSettings,
                  },
                  currentSchedule: workingSchedule,
                  classrooms,
                  teachers,
                  courses,
                  unwantedTeacherDays,
                },
                ({ progress, unplacedCount, unplacedDetails }) => {
                  const rescueBase = 90 + ((rescuePass - 1) / rescuePassLimit) * 9;
                  const rescueSpan = 9 / rescuePassLimit;
                  setSolverProgress(
                    Math.min(99, Math.round(rescueBase + rescueSpan * (Number(progress || 0) / 100))),
                  );
                  setUnplacedInfo({
                    count: Number(unplacedCount || 0),
                    details: Array.isArray(unplacedDetails) ? unplacedDetails : [],
                  });
                },
              );

              const retryRemaining = Array.isArray(retryResult?.unplacedBlocks)
                ? retryResult.unplacedBlocks
                : previousForClass;

              // Aynı sınıf için gerçekten daha az blok kaldıysa programı ve
              // global eksik listesini güncelle; aksi halde önceki programı koru.
              if (retryResult?.schedule && retryRemaining.length < previousForClass.length) {
                workingSchedule = retryResult.schedule;
                for (let i = allUnplaced.length - 1; i >= 0; i -= 1) {
                  const item = allUnplaced[i] as any;
                  if (String(item?.className || item?.course?.className || "") === className) {
                    allUnplaced.splice(i, 1);
                  }
                }
                allUnplaced.push(...retryRemaining);
                placedBlocks = Math.max(0, totalBlocks - allUnplaced.length);
                improvedThisPass = true;
                setScheduleData(workingSchedule);
              }
            }

            if (!improvedThisPass || allUnplaced.length === 0) break;
          }
        }

        if (showCurrentRequestedRef.current) {
          setScheduleData(workingSchedule);
          setSolverStats({
            totalBlocks,
            placedBlocks,
            remainingBlocks: Math.max(0, totalBlocks - placedBlocks),
            stage: "Dağıtım durduruldu — mevcut program gösteriliyor",
          });
          setSolverResult({
            success: false,
            courseName: "Mevcut program dağıtımı gösteriliyor",
            reasons: [
              `${placedBlocks}/${totalBlocks} blok yerleştirildi.`,
              `${Math.max(0, totalBlocks - placedBlocks)} blok henüz yerleştirilmedi.`,
            ],
          });
          showCurrentRequestedRef.current = false;
          return;
        }

        const validation = validateSmartFullSchedule(workingSchedule, classrooms, teachers);
        const success = allUnplaced.length === 0 && validation.valid;

        setScheduleData(workingSchedule);
        setUnplacedInfo({ count: allUnplaced.length, details: allUnplaced });
        setSolverProgress(100);
        setSolverStats({
          totalBlocks,
          placedBlocks: Math.min(totalBlocks, placedBlocks),
          remainingBlocks: Math.max(0, totalBlocks - placedBlocks),
          stage: success ? "Sınıf sınıf dağıtım tamamlandı" : "Sınıf sınıf dağıtım kısmi tamamlandı",
        });

        saveLastDistributionReport({
          algorithm: "smart-full",
          success,
          initialPenalty: totalPenalty,
          finalPenalty: totalPenalty,
          durationMs: Date.now() - startedAt,
          details:
            `Akıllı Tam Dağıtım V8 sınıf sınıf çalıştırıldı. ` +
            `${placedBlocks}/${totalBlocks} blok yerleştirildi. ` +
            `${allUnplaced.length} blok yerleşmedi.`,
          unplacedBlocks: allUnplaced,
          completedAt: new Date().toISOString(),
        });

        if (success) {
          setSolverResult({
            success: true,
            courseName: `Akıllı Tam Dağıtım V2 tamamlandı — ${placedBlocks}/${totalBlocks} blok`,
          });
        } else {
          const reasons = [
            ...allUnplaced.slice(0, 8).map(
              (item: any) =>
                `${item.className || "Sınıf"} / ${item.courseName || item?.course?.courseName || "Ders"}: ` +
                `${item.reason || "uygun saat bulunamadı"}`,
            ),
            ...validation.safetyErrors.slice(0, 2),
          ];
          setSolverResult({
            success: false,
            courseName: `Sınıf sınıf dağıtım tamamlandı — ${placedBlocks}/${totalBlocks} blok yerleştirildi`,
            reasons: reasons.length ? reasons : [`${allUnplaced.length} blok henüz yerleşmedi.`],
          });
        }

        return;
      }

      if (effectiveAlgorithm === "ortools") {
        try {
          setSolverProgress(10);
          setSolverStats({
            totalBlocks: 0,
            placedBlocks: 0,
            remainingBlocks: 0,
            stage: effectiveScope === "global"
              ? "CP-SAT portföyü: 6 bağımsız tam kapsama araması çalışıyor..."
              : "CP-SAT portföyü: 4 bağımsız kapsam araması çalışıyor...",
          });
          const result = await runOrTools({
          scope: effectiveScope,
          selectedId: effectiveSelectedId,
          viewType: effectiveViewType,
        });
        if (solverCancelledRef.current) throw new Error("__ROTA_SOLVER_CANCELLED__");

        const remainingBlocks = Array.isArray(result.unplacedBlocks) ? result.unplacedBlocks : [];
        const diagnostics = Array.isArray(result.infeasibility) ? result.infeasibility : [];
        const totalBlocks = Number(result?.statistics?.blocks || 0);
        const placedBlocks = Number(result?.statistics?.placed || Math.max(0, totalBlocks - remainingBlocks.length));
        if (result.schedule) {
          const solverSchedule =
            effectiveScope === "local" && effectiveViewType === "class" && effectiveSelectedId
              ? mirrorCommonCoursesToSiblingGroups(
                  preserveSiblingGroupAssignments(
                    result.schedule as ScheduleData,
                    scheduleData,
                    classrooms,
                    effectiveSelectedId,
                  ),
                  classrooms,
                  effectiveSelectedId,
                )
              : (result.schedule as ScheduleData);
          // Son güvenlik katmanı: manuel yerleştirmeler hangi dağıtım türü
          // çalıştırılırsa çalıştırılsın kendi hücresinde sabit kalır.
          const scheduleToApply = preserveManualAssignments(solverSchedule, scheduleData);
          setScheduleData(scheduleToApply);
        }
        setUnplacedInfo({ count: remainingBlocks.length, details: remainingBlocks });
        setSolverProgress(100);
        setSolverStats({
          totalBlocks,
          placedBlocks,
          remainingBlocks: remainingBlocks.length,
          stage: remainingBlocks.length === 0
            ? "CP-SAT tam dağıtım ve kalite optimizasyonu tamamlandı"
            : "En iyi kısmi sonuç uygulandı; kapasite engelleri raporlandı",
        });
        saveLastDistributionReport({
          algorithm: "ortools",
          success: Boolean(result.success),
          initialPenalty: Number(result.initialPenalty || 0),
          finalPenalty: Number(result.finalPenalty || 0),
          durationMs: Number(result.durationMs || 0),
          details: result.details || "Google OR-Tools CP-SAT tamamlandı.",
          statistics: result.statistics,
          infeasibility: result.infeasibility,
          unplacedBlocks: remainingBlocks,
          completedAt: new Date().toISOString(),
        });

        await fetch("/api/scheduling/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            algorithm: "Google OR-Tools CP-SAT",
            initial_penalty: Number(result.initialPenalty || 0),
            final_penalty: Number(result.finalPenalty || 0),
            duration_ms: Number(result.durationMs || 0),
            status: result.success && remainingBlocks.length === 0 ? "Success" : "Partial",
            details: result.details || "",
          }),
        });
        await refreshSchedulingDatabase();

        setSolverResult({
          success: Boolean(result.success) && remainingBlocks.length === 0,
          courseName: remainingBlocks.length === 0
            ? `Google OR-Tools CP-SAT: tüm okul programı oluşturuldu (${result.durationMs || 0} ms)`
            : `Google OR-Tools CP-SAT: ${remainingBlocks.length} blok yerleşmedi`,
          reasons: remainingBlocks.length
            ? [
                ...diagnostics.slice(0, 4).map((item: any) => item.summary || item.reason).filter(Boolean),
                ...remainingBlocks.slice(0, 6).map((item: any) => `${item.className || "Sınıf"} / ${item.courseName || "Ders"} / ${item.reason || "uygun slot bulunamadı"}`),
              ].slice(0, 8)
            : undefined,
        });
          return;
        } catch (error: any) {
          throw new Error(
            `CP-SAT dağıtım servisi kullanılamıyor: ${error?.message || "bilinmeyen hata"}. ` +
            "Eski dağıtım motoruna geri dönülmedi.",
          );
        }
      }

      const startIndex = Math.max(0, fallbackAlgorithms.indexOf(effectiveAlgorithm as ExecutableAlgorithm));
      const algorithmsToTry = fallbackAlgorithms.slice(startIndex);
      let result: any = null;
      let usedAlgorithm: ExecutableAlgorithm = effectiveAlgorithm as ExecutableAlgorithm;
      let bestPartial: any = null;
      let bestPartialAlgorithm: ExecutableAlgorithm = effectiveAlgorithm as ExecutableAlgorithm;
      let lastError: unknown = null;

      const resultScore = (candidate: any) =>
        (Array.isArray(candidate?.unplacedBlocks) ? candidate.unplacedBlocks.length : 9999) * 100000 + Number(candidate?.finalPenalty || 0);

      for (const algorithm of algorithmsToTry) {
        try {
          if (!workerClientRef.current) workerClientRef.current = new ScheduleSolverWorkerClient();
          const candidate = await workerClientRef.current.run(
            {
              config: {
                algorithm,
                scope: effectiveScope,
                selectedId: effectiveSelectedId,
                viewType: effectiveViewType,
                constraintSettings,
              },
              currentSchedule: scheduleData,
              classrooms,
              teachers,
              courses,
              unwantedTeacherDays,
            },
            ({ progress, unplacedCount, unplacedDetails }) => {
              setSolverProgress(progress);
              setUnplacedInfo({ count: Number(unplacedCount || 0), details: Array.isArray(unplacedDetails) ? unplacedDetails : [] });
            },
          );
          if (solverCancelledRef.current) throw new Error("__ROTA_SOLVER_CANCELLED__");
          if (!bestPartial || resultScore(candidate) < resultScore(bestPartial)) {
            bestPartial = candidate;
            bestPartialAlgorithm = algorithm;
          }
          if (candidate.success && (!Array.isArray(candidate.unplacedBlocks) || candidate.unplacedBlocks.length === 0)) {
            result = candidate;
            usedAlgorithm = algorithm;
            break;
          }
        } catch (error) {
          lastError = error;
          console.warn(`Algorithm ${algorithm} failed:`, error);
          if (solverCancelledRef.current) break;
        }
      }

      if (solverCancelledRef.current) throw new Error("__ROTA_SOLVER_CANCELLED__");
      if (!result && bestPartial) {
        result = bestPartial;
        usedAlgorithm = bestPartialAlgorithm;
      }
      if (!result) throw lastError || new Error("Tüm algoritmalar denendi ancak çözüm bulunamadı.");

      const remainingBlocks = Array.isArray(result.unplacedBlocks) ? result.unplacedBlocks : [];
      setUnplacedInfo({ count: remainingBlocks.length, details: remainingBlocks });
      saveLastDistributionReport({
        algorithm: usedAlgorithm,
        success: result.success,
        initialPenalty: result.initialPenalty,
        finalPenalty: result.finalPenalty,
        durationMs: result.durationMs,
        details: result.details,
        unplacedBlocks: remainingBlocks,
        completedAt: new Date().toISOString(),
      });

      const logPayload = {
        algorithm: algorithmLogTitle(usedAlgorithm),
        initial_penalty: result.initialPenalty,
        final_penalty: result.finalPenalty,
        duration_ms: result.durationMs,
        status: result.success && remainingBlocks.length === 0 ? "Success" : "Partial",
        details: result.details,
      };
      await fetch("/api/scheduling/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logPayload),
      });
      await refreshSchedulingDatabase();

      const resultValidation = validateSmartFullSchedule(result.schedule || scheduleData, classrooms, teachers);
      // En yüksek yerleşim sayısı, ardından en düşük ceza puanı ile seçilen
      // aday programı uygula. Yerleşemeyen bloklar sonuç penceresinde kalır.
      if (result.schedule) setScheduleData(result.schedule);
      const totalBlocks = Number(
        result?.statistics?.totalBlocks ||
        result?.v3?.strategiesTried?.find(
          (item: any) => item.name === result?.v3?.winningStrategy,
        )?.total ||
        requestedBlocks,
      );
      const isFullSuccess = Boolean(result.success) && remainingBlocks.length === 0 && resultValidation.valid;
      const effectiveRemainingBlocks = remainingBlocks.length > 0
        ? remainingBlocks.length
        : (resultValidation.valid ? 0 : totalBlocks);
      const placedBlocks = Number(
        (Number(result?.statistics?.bestPlacedBlocks) > 0 ? result.statistics.bestPlacedBlocks : undefined) ||
        (totalBlocks > 0 ? totalBlocks - effectiveRemainingBlocks : 0),
      );
      setSolverProgress(100);
      setSolverStats({
        totalBlocks,
        placedBlocks: Math.max(0, Math.min(totalBlocks, placedBlocks)),
        remainingBlocks: effectiveRemainingBlocks,
        stage: isFullSuccess ? "Dağıtım tamamlandı" : "Kısmi dağıtım tamamlandı",
      });

      const reasons = remainingBlocks.slice(0, 8).map((block: any) => {
        const className = block?.className || "Sınıf";
        const courseName = block?.course?.courseName || block?.courseName || block?.course?.name || "Ders";
        const teacherName = block?.course?.teacherName || block?.teacherName || "Öğretmen belirtilmedi";
        return `${className} / ${courseName} / ${teacherName} / ${block?.duration ? `${block.duration} saat` : "süre yok"}`;
      });
      setSolverResult({
        success: isFullSuccess,
        courseName: isFullSuccess
            ? `Yöntem: ${logPayload.algorithm} — ${placedBlocks || totalBlocks}/${totalBlocks || placedBlocks} blok yerleştirildi`
          : totalBlocks > 0
            ? `Kısmi dağıtım uygulandı: ${placedBlocks}/${totalBlocks} blok yerleştirildi, ${effectiveRemainingBlocks} blok kaldı.`
            : `Kısmi dağıtım uygulandı: ${remainingBlocks.length} blok yerleşmedi.`,
        reasons: isFullSuccess
          ? undefined
          : [...reasons, ...resultValidation.completenessErrors.slice(0, 6), result.details || "Bazı ders blokları için uygun yer bulunamadı."].slice(0, 9),
      });
    } catch (error: any) {
      if (showCurrentRequestedRef.current) {
        const stats = useScheduleStore.getState().solverStats;
        setSolverStats({ stage: "Dağıtım durduruldu — mevcut program gösteriliyor" });
        setSolverResult({
          success: false,
          courseName: "Mevcut program dağıtımı gösteriliyor",
          reasons: [
            `${stats.placedBlocks} blok yerleştirildi.`,
            `${stats.remainingBlocks} blok henüz yerleştirilmedi.`,
            "Dağıtıma devam etmek isterseniz Akıllı Tam Dağıtım'ı yeniden çalıştırabilirsiniz.",
          ],
        });
        showCurrentRequestedRef.current = false;
      } else if (error?.message === "__ROTA_SOLVER_CANCELLED__" || solverCancelledRef.current) {
        setSolverResult({ success: false, courseName: "Dağıtım iptal edildi", reasons: ["Dağıtım kullanıcı tarafından iptal edildi. Programa yeni sonuç uygulanmadı."] });
      } else {
        console.error("Solver error:", error);
        setSolverStats({
          totalBlocks: requestedBlocks,
          stage: "Dağıtım tamamlanamadı — hata oluştu",
        });
        setSolverResult({ success: false, courseName: "Optimizasyon Hatası", reasons: [error?.message || "Bilinmeyen bir solver hatası oluştu."] });
        saveLastDistributionReport({
          algorithm: effectiveAlgorithm,
          success: false,
          initialPenalty: totalPenalty,
          finalPenalty: totalPenalty,
          durationMs: 0,
          details: error?.message || "Bilinmeyen bir solver hatası oluştu.",
          unplacedBlocks: unplacedInfo.details || [],
          completedAt: new Date().toISOString(),
        });
      }
    } finally {
      optimizerInFlightRef.current = false;
      setSolverProgress(100);
      setSolverRunning(false);
      workerClientRef.current?.terminate();
      workerClientRef.current = null;
    }
  }, [
    classrooms, courses, refreshSchedulingDatabase, runOrTools, saveLastDistributionReport,
    scheduleData, selectedAlgorithm, selectedId, selectedScope, setScheduleData,
    setSolverProgress, setSolverResult, setSolverRunning, setSolverStats, setUnplacedInfo, teachers,
    totalPenalty, unwantedTeacherDays, unplacedInfo.details, viewType,
  ]);

  return {
    solverTargetCourse,
    setSolverTargetCourse,
    isSolverPaused,
    lastDistributionReport,
    handleRunOptimizer,
    requestSolverPause,
    requestSolverResume,
    requestSolverCancel,
    requestShowCurrentDistribution,
  };
}
