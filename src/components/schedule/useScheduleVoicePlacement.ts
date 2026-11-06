import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Classroom, Teacher } from "../../types";
import { checkClassroomConflict, DAYS, HOURS } from "../../services/schedule/scheduleRules";
import { buildSpeechDiagnostics, describeSpeechError, getSpeechRecognitionCtor, requestMicrophoneStream, startRecognitionUsingStream, stopMicrophoneStream } from "../../utils/speechRuntime";

type ScheduleViewType = "class" | "teacher";

type VoiceCommand = {
  day: string;
  hours: number[];
  subjectPhrase: string;
};

type VoicePlacementResult = {
  successCount: number;
  messages: string[];
};

interface UseScheduleVoicePlacementArgs {
  viewType: ScheduleViewType;
  selectedId: string;
  classrooms: Classroom[];
  teachers: Teacher[];
  assignedCourses: any[];
  scheduleData: Record<string, any>;
  setScheduleData: (value: Record<string, any> | ((previous: Record<string, any>) => Record<string, any>)) => void;
  writeAssignment: (
    schedule: Record<string, any>,
    day: string,
    hour: number,
    item: any,
    selectedId: string,
    viewType: ScheduleViewType,
  ) => void;
  isTeacherBusy: (
    teacherName: string,
    day: string,
    hour: number,
    excludeClassId?: string,
    currentScheduleData?: Record<string, any>,
  ) => boolean;
  getPlacedHoursForEntity: (
    type: ScheduleViewType,
    id: string,
    courseName: string,
    groupName?: string,
    className?: string,
    weeklyHours?: number,
    currentScheduleData?: Record<string, any>,
  ) => number;
  onPlacementComplete?: () => void;
}

const TURKISH_NUMBER_WORDS: Record<string, number> = {
  BIR: 1,
  BIRINCI: 1,
  IKI: 2,
  IKINCI: 2,
  UC: 3,
  UCUNCU: 3,
  DORT: 4,
  DORDUNCU: 4,
  BES: 5,
  BESINCI: 5,
  ALTI: 6,
  ALTINCI: 6,
  YEDI: 7,
  YEDINCI: 7,
  SEKIZ: 8,
  SEKIZINCI: 8,
  DOKUZ: 9,
  DOKUZUNCU: 9,
  ON: 10,
  ONUNCU: 10,
  ONBIR: 11,
  ONBIRINCI: 11,
  ONIKI: 12,
  ONIKINCI: 12,
  ONNUC: 13,
  ONNUCUNCU: 13,
  ONDORT: 14,
  ONDORDUNCU: 14,
  ONBES: 15,
  ONBESINCI: 15,
  ONALTI: 16,
  ONALTINCI: 16,
};

const DIGIT_WORDS: Record<string, string> = {
  "1": "BIR",
  "2": "IKI",
  "3": "UC",
  "4": "DORT",
  "5": "BES",
  "6": "ALTI",
  "7": "YEDI",
  "8": "SEKIZ",
  "9": "DOKUZ",
  "10": "ON",
  "11": "ON BIR",
  "12": "ON IKI",
};

const COURSE_ALIASES: Array<[RegExp, string[]]> = [
  [/MATEMATIK|\bMAT\b/, ["MATEMATIK", "MATEMATI", "MATEMATIG", "MAT"]],
  [/ALMANCA/, ["ALMANCA", "ALMANJA", "ALMAN"]],
  [/INGILIZCE/, ["INGILIZCE", "INGILIZ", "INGLIZCE"]],
  [/FIZIK/, ["FIZIK", "FIZIG"]],
  [/KIMYA/, ["KIMYA", "KIMYA DERSI"]],
  [/BIYOLOJI/, ["BIYOLOJI", "BIYOLOJI DERSI"]],
  [/COGRAFYA/, ["COGRAFYA", "COGRAFYA DERSI"]],
  [/TARIH/, ["TARIH", "TARIH DERSI"]],
  [/TURK DILI.*EDEBIYATI|EDEBIYAT/, ["EDEBIYAT", "TURK DILI EDEBIYATI", "TDE"]],
  [/DIN KULTURU.*AHLAK|DIKAB/, ["DIN", "DIN KULTURU", "DIKAB"]],
  [/BEDEN EGITIMI.*SPOR|BEDEN/, ["BEDEN", "BEDEN EGITIMI"]],
  [/REHBERLIK.*YONLENDIRME|REHBERLIK/, ["REHBERLIK", "REHBER"]],
  [/SAGLIK BILGISI.*TRAFIK|SAGLIK/, ["SAGLIK", "TRAFIK", "SAGLIK BILGISI"]],
  [/GORSEL SANATLAR.*MUZIK|GORSEL|MUZIK/, ["GORSEL SANATLAR", "MUZIK", "GORSEL"]],
  [/KURANI? KERIM.*PEYGAMBER|KURPEY/, ["KURAN", "KURANI KERIM", "PEYGAMBERIMIZIN HAYATI", "KURPEY"]],
  [/ADABI MUASERET|ADAB/, ["ADAB", "ADABI MUASERET"]],
];

function normalizeVoiceText(value: unknown): string {
  return String(value || "")
    .replace(/[İIıi]/g, "I")
    .replace(/[Ğğ]/g, "G")
    .replace(/[Üü]/g, "U")
    .replace(/[Şş]/g, "S")
    .replace(/[Öö]/g, "O")
    .replace(/[Çç]/g, "C")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function isDayToken(token: string): string | null {
  const normalized = normalizeVoiceText(token);
  let best: { day: string; distance: number } | null = null;
  for (const day of DAYS) {
    const target = normalizeVoiceText(day);
    const distance = levenshtein(normalized, target);
    const limit = target.length <= 4 ? 0 : target.length <= 7 ? 1 : 2;
    if (distance <= limit && (!best || distance < best.distance)) best = { day, distance };
  }
  return best?.day || null;
}

function hourFromToken(token: string): number | null {
  const normalized = normalizeVoiceText(token);
  if (/^\d{1,2}$/.test(normalized)) {
    const value = Number(normalized);
    return Number.isInteger(value) ? value : null;
  }
  return TURKISH_NUMBER_WORDS[normalized] ?? null;
}

function tokenize(value: string): string[] {
  return String(value || "").match(/[\p{L}\p{N}]+/gu) || [];
}

const PRE_SUBJECT_FILLERS = new Set([
  "VE",
  "ILE",
  "SAAT",
  "SAATI",
  "SAATTE",
  "DERS",
  "DERSI",
  "DERSINDE",
  "DERSINE",
  "NUMARA",
  "NUMARALI",
]);

function extractLastSpokenDay(transcript: string): string {
  let lastDay = "";
  for (const token of tokenize(transcript)) {
    const day = isDayToken(token);
    if (day) lastDay = day;
  }
  return lastDay;
}

/**
 * Hızlı komut ayrıştırıcısı.
 *
 * Desteklenen örnekler:
 * - "Pazartesi 3 Matematik"
 * - "Pazartesi 3 ve 4 Matematik"
 * - "Pazartesi 3 Matematik 4 Fizik 5 Kimya"
 * - "Pazartesi" -> yalnızca gün bağlamını değiştirir
 * - Önceden Pazartesi söylendiyse: "3 Matematik 4 Fizik"
 */
export function parseScheduleVoiceCommands(transcript: string, fallbackDay = ""): VoiceCommand[] {
  const rawTokens = tokenize(transcript);
  if (!rawTokens.length) return [];

  const commands: VoiceCommand[] = [];
  let currentDay = isDayToken(fallbackDay) || fallbackDay || "";
  let hours: number[] = [];
  let subjectTokens: string[] = [];

  const flush = () => {
    if (!currentDay || !hours.length || !subjectTokens.length) {
      hours = [];
      subjectTokens = [];
      return;
    }
    commands.push({
      day: currentDay,
      hours: [...new Set(hours)],
      subjectPhrase: subjectTokens.join(" ").trim(),
    });
    hours = [];
    subjectTokens = [];
  };

  for (let index = 0; index < rawTokens.length; index += 1) {
    const rawToken = rawTokens[index];
    const normalized = normalizeVoiceText(rawToken);
    const spokenDay = isDayToken(rawToken);

    if (spokenDay) {
      flush();
      currentDay = spokenDay;
      continue;
    }

    const hour = hourFromToken(rawToken);
    const validHour = hour !== null && HOURS.includes(hour);

    if (validHour) {
      if (subjectTokens.length > 0) {
        // Aynı gün art arda: "3 Matematik 4 Fizik 5 Kimya"
        flush();
      }
      hours.push(hour as number);
      continue;
    }

    if (!currentDay) {
      // Gün söylenmeden önce gelen gereksiz kelimeleri yok say.
      continue;
    }

    if (hours.length > 0 && subjectTokens.length === 0 && PRE_SUBJECT_FILLERS.has(normalized)) {
      continue;
    }

    if (hours.length > 0) {
      subjectTokens.push(rawToken);
    }
  }

  flush();
  return commands;
}

function classAliases(className: string): string[] {
  const normalized = normalizeVoiceText(className);
  const compact = normalized.replace(/\s+/g, "");
  const parts = normalized.split(" ").filter(Boolean);
  const aliases = new Set<string>([normalized, compact]);
  if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
    const word = DIGIT_WORDS[parts[0]];
    if (word) aliases.add(`${word} ${parts.slice(1).join(" ")}`);
  }
  const compactMatch = compact.match(/^(\d+)([A-Z]+)$/);
  if (compactMatch) {
    aliases.add(`${compactMatch[1]} ${compactMatch[2]}`);
    const word = DIGIT_WORDS[compactMatch[1]];
    if (word) aliases.add(`${word} ${compactMatch[2]}`);
  }
  return [...aliases].filter(Boolean);
}

function candidateAliases(course: any): string[] {
  const courseName = normalizeVoiceText(course?.courseName || course?.name || "");
  const aliases = new Set<string>([courseName]);
  aliases.add(courseName.replace(/^SECMELI\s+/, ""));
  COURSE_ALIASES.forEach(([pattern, values]) => {
    if (pattern.test(courseName)) values.forEach((value) => aliases.add(normalizeVoiceText(value)));
  });
  const groupName = normalizeVoiceText(course?.groupName || "");
  if (groupName) {
    aliases.add(`${courseName} ${groupName}`);
    groupName.split(" ").forEach((group) => aliases.add(`${courseName} ${group}`));
  }
  return [...aliases].filter(Boolean);
}

function scoreCoursePhrase(subjectPhrase: string, course: any): number {
  const spoken = normalizeVoiceText(subjectPhrase);
  if (!spoken) return 0;
  const spokenWords = spoken.split(" ").filter(Boolean);
  let best = 0;
  for (const alias of candidateAliases(course)) {
    if (!alias) continue;
    if (spoken === alias) best = Math.max(best, 100);
    else if (spoken.length >= 4 && (spoken.includes(alias) || alias.includes(spoken))) best = Math.max(best, 92);

    const aliasWords = alias.split(" ").filter(Boolean);
    const overlap = aliasWords.filter((word) => spokenWords.includes(word)).length;
    if (overlap > 0) {
      const recall = overlap / Math.max(1, aliasWords.length);
      const precision = overlap / Math.max(1, spokenWords.length);
      best = Math.max(best, Math.round((recall * 0.7 + precision * 0.3) * 82));
    }

    const maxLen = Math.max(spoken.length, alias.length);
    if (maxLen > 0 && maxLen <= 28) {
      const similarity = 1 - levenshtein(spoken, alias) / maxLen;
      if (similarity >= 0.72) best = Math.max(best, Math.round(similarity * 90));
    }
  }
  return best;
}

function resolveCourseFromSpeech(subjectPhrase: string, courses: any[], viewType: ScheduleViewType) {
  const spoken = normalizeVoiceText(subjectPhrase);
  let pool = courses.filter(Boolean);
  let matchedClassName = "";

  if (viewType === "teacher") {
    const classMatches = [...new Set(pool.map((course) => String(course?.className || "").trim()).filter(Boolean))]
      .map((className) => ({
        className,
        matched: classAliases(className).some((alias) => alias && (spoken.includes(alias) || spoken.replace(/\s+/g, "").includes(alias.replace(/\s+/g, "")))),
      }))
      .filter((item) => item.matched);
    if (classMatches.length === 1) {
      matchedClassName = classMatches[0].className;
      pool = pool.filter((course) => String(course?.className || "").trim() === matchedClassName);
    }
  }

  const scored = pool
    .map((course) => ({ course, score: scoreCoursePhrase(subjectPhrase, course) }))
    .filter((item) => item.score >= 58)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return { course: null, error: `Ders bulunamadı: “${subjectPhrase}”.` };

  const bestScore = scored[0].score;
  const top = scored.filter((item) => item.score >= bestScore - 3);
  const uniqueTop = top.filter((item, index, items) => {
    const key = `${normalizeVoiceText(item.course.courseName)}__${normalizeVoiceText(item.course.groupName)}__${normalizeVoiceText(item.course.className)}`;
    return items.findIndex((other) => `${normalizeVoiceText(other.course.courseName)}__${normalizeVoiceText(other.course.groupName)}__${normalizeVoiceText(other.course.className)}` === key) === index;
  });

  if (viewType === "teacher" && !matchedClassName) {
    const sameSubject = uniqueTop.filter((item) => item.score >= bestScore - 2);
    const classes = [...new Set(sameSubject.map((item) => String(item.course?.className || "").trim()).filter(Boolean))];
    if (classes.length > 1) {
      return {
        course: null,
        error: `${sameSubject[0].course.courseName} birden fazla sınıfta var (${classes.join(", ")}). Komutta sınıfı da söyleyin.`,
      };
    }
  }

  if (uniqueTop.length > 1) {
    const labels = uniqueTop.slice(0, 4).map((item) => {
      const group = item.course?.groupName ? ` ${item.course.groupName}` : "";
      const cls = item.course?.className ? ` ${item.course.className}` : "";
      return `${item.course.courseName}${group}${cls}`.trim();
    });
    return { course: null, error: `Ders adı belirsiz: ${labels.join(" / ")}. Daha açık söyleyin.` };
  }

  return { course: scored[0].course, error: "" };
}

function getScheduleCell(schedule: Record<string, any>, type: ScheduleViewType, id: string, day: string, hour: number): any[] {
  const raw = schedule[`${type}_${id}_${day}_${hour}`];
  return Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
}

function displayCourseName(course: any): string {
  const group = String(course?.groupName || "").trim();
  return `${course?.courseName || course?.name || "Ders"}${group ? ` (${group})` : ""}`;
}

export function useScheduleVoicePlacement({
  viewType,
  selectedId,
  classrooms,
  teachers,
  assignedCourses,
  scheduleData,
  setScheduleData,
  writeAssignment,
  isTeacherBusy,
  getPlacedHoursForEntity,
  onPlacementComplete,
}: UseScheduleVoicePlacementArgs) {
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState(
    "Hızlı ses modu: Günü bir kez söyleyin; sonra sadece saat + ders söyleyerek seri devam edin.",
  );
  const [lastTranscript, setLastTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const keepListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const scheduleDataRef = useRef(scheduleData);
  const sessionPlacedCountRef = useRef(0);
  const lastDayRef = useRef("");
  const recentPlacementKeysRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    scheduleDataRef.current = scheduleData;
  }, [scheduleData]);

  const speechRecognitionSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  // Chromium'un deneysel SpeechRecognition.phrases özelliği Edge'in bazı sürümlerinde
  // `phrases-not-supported` hatası verip bütün tanımayı durduruyor. Bu yüzden V4'te
  // kelime önceliklendirmesi tamamen kapalı; ders eşleştirme uygulama içinde yapılıyor.
  const applyRecognitionPhraseBias = useCallback((_recognition: any) => {
    // intentionally disabled for cross-browser stability
  }, []);

  const stopVoicePlacement = useCallback((feedback?: string) => {
    keepListeningRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.stop(); } catch { /* recognition already ended */ }
    }
    stopMicrophoneStream(microphoneStreamRef.current);
    microphoneStreamRef.current = null;
    setIsListening(false);
    if (feedback) setVoiceFeedback(feedback);
  }, []);

  const processTranscript = useCallback((transcript: string): VoicePlacementResult => {
    const spokenDay = extractLastSpokenDay(transcript);
    const commands = parseScheduleVoiceCommands(transcript, lastDayRef.current);

    if (spokenDay) lastDayRef.current = spokenDay;

    if (!commands.length) {
      if (spokenDay) {
        return {
          successCount: 0,
          messages: [`✓ Gün ${spokenDay} olarak seçildi. Şimdi “3 Matematik”, “4 Fizik” diye seri devam edebilirsiniz.`],
        };
      }
      return {
        successCount: 0,
        messages: [
          lastDayRef.current
            ? `Komut anlaşılamadı. ${lastDayRef.current} için örnek: “3 Matematik” veya “4 ve 5 Almanca”.`
            : "Önce günü söyleyin. Örnek: “Pazartesi 3 Matematik”. Sonra aynı gün için yalnızca “4 Fizik” diyebilirsiniz.",
        ],
      };
    }

    // Tarayıcının aynı sonucu kısa aralıkla yeniden iletmesi halinde çift işlem yapılmasın.
    const now = Date.now();
    for (const [key, time] of recentPlacementKeysRef.current.entries()) {
      if (now - time > 8000) recentPlacementKeysRef.current.delete(key);
    }

    let nextSchedule = { ...scheduleDataRef.current };
    let successCount = 0;
    const messages: string[] = [];
    let sequence = 0;

    for (const command of commands) {
      lastDayRef.current = command.day;

      const invalidHours = command.hours.filter((hour) => !HOURS.includes(hour));
      if (invalidHours.length) {
        messages.push(`${command.day}: ${invalidHours.join(", ")}. saat geçerli değil.`);
        continue;
      }

      const resolved = resolveCourseFromSpeech(command.subjectPhrase, assignedCourses, viewType);
      if (!resolved.course) {
        messages.push(resolved.error);
        continue;
      }

      const courseFingerprint = [
        normalizeVoiceText(resolved.course?.courseName || resolved.course?.name || ""),
        normalizeVoiceText(resolved.course?.groupName || ""),
        normalizeVoiceText(resolved.course?.className || ""),
      ].join("|");

      const duplicateHours: number[] = [];
      const hoursToPlace = command.hours.filter((hour) => {
        const key = `${viewType}|${selectedId}|${command.day}|${hour}|${courseFingerprint}`;
        const previous = recentPlacementKeysRef.current.get(key);
        if (previous && now - previous < 5000) {
          duplicateHours.push(hour);
          return false;
        }
        return true;
      });

      if (!hoursToPlace.length) {
        messages.push(`✓ ${command.day} ${duplicateHours.join(" ve ")}. saat komutu zaten işlendi.`);
        continue;
      }

      const groupedCourses = Array.isArray(resolved.course.originalCourses) && resolved.course.originalCourses.length
        ? resolved.course.originalCourses
        : [resolved.course];
      const commandSchedule = { ...nextSchedule };
      const blockId = `voice_${Date.now()}_${sequence++}`;
      let commandError = "";

      for (const hour of hoursToPlace) {
        if (commandSchedule[`blocked_${viewType}_${selectedId}_${command.day}_${hour}`]) {
          commandError = `${command.day} ${hour}. saat dağıtıma kapalı.`;
          break;
        }

        for (const sourceCourse of groupedCourses) {
          const className = viewType === "class"
            ? classrooms.find((item) => item.id === selectedId)?.name || ""
            : String(sourceCourse?.className || resolved.course?.className || "").trim();
          const classObj = classrooms.find((item) => item.id === selectedId || item.name === className);
          if (!classObj) {
            commandError = "Dersin bağlı olduğu sınıf bulunamadı.";
            break;
          }
          if (commandSchedule[`blocked_class_${classObj.id}_${command.day}_${hour}`]) {
            commandError = `${classObj.name} için ${command.day} ${hour}. saat dağıtıma kapalı.`;
            break;
          }

          const weeklyHours = Number(sourceCourse?.weeklyHours || resolved.course?.weeklyHours || 0);
          const placedHours = getPlacedHoursForEntity(
            viewType,
            selectedId,
            sourceCourse?.courseName || resolved.course?.courseName || "",
            sourceCourse?.groupName,
            viewType === "teacher" ? className : undefined,
            weeklyHours,
            commandSchedule,
          );
          if (weeklyHours > 0 && placedHours >= weeklyHours) {
            commandError = `${displayCourseName(sourceCourse)} için haftalık ${weeklyHours} saat zaten yerleştirilmiş.`;
            break;
          }

          const classExisting = getScheduleCell(commandSchedule, "class", classObj.id, command.day, hour);
          const conflictResult = checkClassroomConflict(sourceCourse, classExisting, classObj);
          if (!conflictResult.fits) {
            commandError = `${command.day} ${hour}. saat: ${conflictResult.reason}`;
            break;
          }

          const teacherNames = [sourceCourse?.teacherName, sourceCourse?.teacherName2]
            .map((value) => String(value || "").trim())
            .filter((value) => value && value !== "Öğretmen Atanmadı" && value !== "Belirtilmedi");
          if (viewType === "teacher") {
            const selectedTeacher = teachers.find((teacher) => teacher.id === selectedId);
            if (selectedTeacher && !teacherNames.includes(selectedTeacher.name)) teacherNames.push(selectedTeacher.name);
          }

          const busyTeacher = teacherNames.find((teacherName) =>
            isTeacherBusy(
              teacherName,
              command.day,
              hour,
              viewType === "class" ? selectedId : classObj.id,
              commandSchedule,
            ),
          );
          if (busyTeacher) {
            commandError = `${busyTeacher} öğretmeni ${command.day} ${hour}. saatte başka bir derste.`;
            break;
          }

          writeAssignment(
            commandSchedule,
            command.day,
            hour,
            { ...sourceCourse, isManual: true, blockId },
            selectedId,
            viewType,
          );
        }
        if (commandError) break;
      }

      if (commandError) {
        messages.push(`${displayCourseName(resolved.course)} yerleştirilemedi: ${commandError}`);
        continue;
      }

      nextSchedule = commandSchedule;
      successCount += hoursToPlace.length;

      for (const hour of hoursToPlace) {
        const key = `${viewType}|${selectedId}|${command.day}|${hour}|${courseFingerprint}`;
        recentPlacementKeysRef.current.set(key, now);
      }

      const classLabel = viewType === "teacher" && resolved.course?.className ? ` · ${resolved.course.className}` : "";
      messages.push(`✓ ${command.day} ${hoursToPlace.join(" ve ")}. saat · ${displayCourseName(resolved.course)}${classLabel}`);
    }

    if (successCount > 0) {
      scheduleDataRef.current = nextSchedule;
      setScheduleData(nextSchedule);
      onPlacementComplete?.();
    }

    return { successCount, messages };
  }, [
    assignedCourses,
    classrooms,
    getPlacedHoursForEntity,
    isTeacherBusy,
    onPlacementComplete,
    selectedId,
    setScheduleData,
    teachers,
    viewType,
    writeAssignment,
  ]);


  // Mikrofon açıkken sınıf/öğretmen seçimi değişse bile en güncel bağlamı kullan.
  const processTranscriptRef = useRef(processTranscript);
  useEffect(() => {
    processTranscriptRef.current = processTranscript;
  }, [processTranscript]);

  const startVoicePlacement = useCallback(() => {
    stopVoicePlacement();
    setLastTranscript("");
    sessionPlacedCountRef.current = 0;
    lastDayRef.current = "";
    recentPlacementKeysRef.current.clear();

    if (!selectedId) {
      setVoiceFeedback(`Önce bir ${viewType === "class" ? "sınıf" : "öğretmen"} seçin.`);
      return;
    }

    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) {
      setVoiceFeedback(buildSpeechDiagnostics());
      return;
    }

    keepListeningRef.current = true;
    setVoiceFeedback("Mikrofon açılıyor… İzin sorulursa İzin verin.");

    requestMicrophoneStream().then((stream) => {
      if (!keepListeningRef.current) {
        stopMicrophoneStream(stream);
        return;
      }

      microphoneStreamRef.current = stream;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "tr-TR";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 5;
      applyRecognitionPhraseBias(recognition);

      const startRecognitionCycle = () => {
        if (!keepListeningRef.current || recognitionRef.current !== recognition) return;
        try {
          startRecognitionUsingStream(recognition, microphoneStreamRef.current);
        } catch (error) {
          if (keepListeningRef.current && recognitionRef.current === recognition) {
            setVoiceFeedback(describeSpeechError(error));
            restartTimerRef.current = window.setTimeout(startRecognitionCycle, 450);
          }
        }
      };

      recognition.onstart = () => {
        setIsListening(true);
        const count = sessionPlacedCountRef.current;
        setVoiceFeedback(
          count > 0
            ? `Dinliyorum… Bu oturumda ${count} ders yerleştirildi. Komut vermeye devam edin.`
            : "Dinliyorum… Örnek: ‘Pazartesi 3 Matematik 4 Fizik 5 Kimya’. Sonra aynı gün için ‘6 Almanca’ diyebilirsiniz.",
        );
      };

      recognition.onresult = (event: any) => {
        const startIndex = Number.isInteger(event?.resultIndex) ? event.resultIndex : 0;
        const feedbackMessages: string[] = [];
        let latestTranscript = "";
        let hasFinalResult = false;

        for (let resultIndex = startIndex; resultIndex < (event.results?.length || 0); resultIndex += 1) {
          const result = event.results[resultIndex];
          if (!result) continue;

          const firstTranscript = String(result[0]?.transcript || "").trim();
          if (firstTranscript) latestTranscript = firstTranscript;
          if (result.isFinal === false) continue;
          hasFinalResult = true;

          const alternatives: string[] = [];
          for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
            const value = String(result[alternativeIndex]?.transcript || "").trim();
            if (value && !alternatives.includes(value)) alternatives.push(value);
          }
          if (!alternatives.length) continue;

          let bestResult: VoicePlacementResult | null = null;
          let bestTranscript = alternatives[0] || "";
          for (const alternative of alternatives) {
            const parsed = processTranscriptRef.current(alternative);
            if (!bestResult || parsed.successCount > bestResult.successCount) {
              bestResult = parsed;
              bestTranscript = alternative;
            }
            if (parsed.successCount > 0) break;
          }

          latestTranscript = bestTranscript;
          const resultSummary = bestResult || { successCount: 0, messages: ["Konuşma algılanamadı."] };
          if (resultSummary.successCount > 0) sessionPlacedCountRef.current += resultSummary.successCount;
          feedbackMessages.push(...resultSummary.messages);
        }

        if (latestTranscript) setLastTranscript(latestTranscript);

        if (feedbackMessages.length) {
          const count = sessionPlacedCountRef.current;
          const dayContext = lastDayRef.current ? ` · Gün: ${lastDayRef.current}` : "";
          setVoiceFeedback(`${feedbackMessages.join(" • ")} • Dinleme açık${dayContext}${count > 0 ? ` · Toplam ${count} ders` : ""}.`);
        } else if (!hasFinalResult && latestTranscript) {
          const dayContext = lastDayRef.current ? ` · ${lastDayRef.current}` : "";
          setVoiceFeedback(`Duyuyorum${dayContext}: “${latestTranscript}”`);
        }
      };

      recognition.onerror = (event: any) => {
        const error = String(event?.error || "");
        if (error === "phrases-not-supported") {
          // Eski önbellekten/deneysel Chromium davranışından gelirse oturumu öldürme.
          try {
            if ("phrases" in recognition) recognition.phrases = [];
          } catch {
            // no-op
          }
          setVoiceFeedback("Standart hızlı ses moduna geçildi. Komut vermeye devam edin.");
          return;
        }
        if (error === "no-speech") {
          setVoiceFeedback("Dinleme açık. Konuşma duyulmadı; yeni komutu söyleyin.");
          return;
        }
        if (error === "aborted" && !keepListeningRef.current) {
          setVoiceFeedback("Sesli yerleştirme durduruldu.");
          return;
        }

        const fatal = [
          "not-allowed",
          "service-not-allowed",
          "audio-capture",
          "network",
          "language-not-supported",
          "language-unavailable",
        ].includes(error);

        setVoiceFeedback(describeSpeechError(event));
        if (fatal) {
          keepListeningRef.current = false;
          setIsListening(false);
          stopMicrophoneStream(microphoneStreamRef.current);
          microphoneStreamRef.current = null;
        }
      };

      recognition.onend = () => {
        if (!keepListeningRef.current || recognitionRef.current !== recognition) {
          if (recognitionRef.current === recognition) recognitionRef.current = null;
          setIsListening(false);
          return;
        }
        setIsListening(true);
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          startRecognitionCycle();
        }, 350);
      };

      setIsListening(true);
      startRecognitionCycle();
    }).catch((error) => {
      recognitionRef.current = null;
      keepListeningRef.current = false;
      setIsListening(false);
      stopMicrophoneStream(microphoneStreamRef.current);
      microphoneStreamRef.current = null;
      setVoiceFeedback(describeSpeechError(error));
      console.warn("Ders programı mikrofon hatası:", error);
    });
  }, [applyRecognitionPhraseBias, selectedId, stopVoicePlacement, viewType]);

  useEffect(() => {
    if (recognitionRef.current) applyRecognitionPhraseBias(recognitionRef.current);
  }, [applyRecognitionPhraseBias]);

  useEffect(() => {
    if (!isListening) return;
    if (!selectedId) {
      setVoiceFeedback(
        `Mikrofon açık. Yeni bir ${viewType === "class" ? "sınıf" : "öğretmen"} seçin; mikrofon kapanmayacak.`,
      );
      return;
    }
    const dayContext = lastDayRef.current ? ` · Gün: ${lastDayRef.current}` : "";
    setVoiceFeedback(
      `HIZLI MOD açık · ${viewType === "class" ? "Sınıf Planı" : "Öğretmen Planı"}${dayContext}. Komut vermeye devam edin.`,
    );
  }, [isListening, selectedId, viewType]);

  useEffect(() => () => {
    keepListeningRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      try { recognition.stop(); } catch { /* already ended */ }
    }
    stopMicrophoneStream(microphoneStreamRef.current);
    microphoneStreamRef.current = null;
  }, []);

  return {
    isListening,
    voiceFeedback,
    lastTranscript,
    speechRecognitionSupported,
    startVoicePlacement,
    stopVoicePlacement,
  };
}
