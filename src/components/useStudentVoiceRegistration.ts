import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSpeechDiagnostics,
  describeSpeechError,
  getSpeechRecognitionCtor,
  requestMicrophoneStream,
  startRecognitionUsingStream,
  stopMicrophoneStream,
} from "../utils/speechRuntime";

export type StudentVoiceRecord = {
  id: string;
  name: string;
  classroom: string;
  parentName: string;
};

export type StudentVoiceStep = "id" | "name";

type RecognitionResult = {
  success: boolean;
  message?: string;
};

interface UseStudentVoiceRegistrationArgs {
  onProgress?: (record: StudentVoiceRecord, step: StudentVoiceStep) => void;
  onRecognized: (
    record: StudentVoiceRecord,
    transcript: string,
  ) => RecognitionResult | string | void | Promise<RecognitionResult | string | void>;
}

const normalize = (value: unknown) =>
  String(value || "")
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

const upperTr = (value: string) =>
  String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");

const tokenize = (value: string) => String(value || "").match(/[\p{L}\p{N}]+/gu) || [];

const NUMBER_UNITS: Record<string, number> = {
  SIFIR: 0,
  BIR: 1,
  IKI: 2,
  UC: 3,
  DORT: 4,
  BES: 5,
  ALTI: 6,
  YEDI: 7,
  SEKIZ: 8,
  DOKUZ: 9,
};

const NUMBER_TENS: Record<string, number> = {
  ON: 10,
  YIRMI: 20,
  OTUZ: 30,
  KIRK: 40,
  ELLI: 50,
  ALTMIS: 60,
  YETMIS: 70,
  SEKSEN: 80,
  DOKSAN: 90,
};

const NUMBER_WORDS = new Set([
  ...Object.keys(NUMBER_UNITS),
  ...Object.keys(NUMBER_TENS),
  "YUZ",
  "BIN",
]);

function parseTurkishNumber(words: string[]): string {
  const normalized = words.flatMap((word) => normalize(word).split(" ")).filter(Boolean);
  if (!normalized.length) return "";

  const digitChunks = normalized.filter((token) => /^\d+$/.test(token));
  if (digitChunks.length) return digitChunks.join("");

  // "bir iki üç dört" -> 1234
  if (normalized.length > 1 && normalized.every((token) => NUMBER_UNITS[token] !== undefined)) {
    return normalized.map((token) => String(NUMBER_UNITS[token])).join("");
  }

  let total = 0;
  let current = 0;
  let recognized = false;

  for (const token of normalized) {
    if (NUMBER_UNITS[token] !== undefined) {
      current += NUMBER_UNITS[token];
      recognized = true;
      continue;
    }
    if (NUMBER_TENS[token] !== undefined) {
      current += NUMBER_TENS[token];
      recognized = true;
      continue;
    }
    if (token === "YUZ") {
      current = (current || 1) * 100;
      recognized = true;
      continue;
    }
    if (token === "BIN") {
      total += (current || 1) * 1000;
      current = 0;
      recognized = true;
    }
  }

  return recognized ? String(total + current) : "";
}

const ID_FILLER = new Set([
  "OKUL",
  "OGRENCI",
  "OGRENCININ",
  "NUMARA",
  "NUMARASI",
  "NO",
  "NUMARALI",
  "NUMARAYI",
  "SOYLUYORUM",
  "KAYDET",
  "KAYDI",
  "LUTFEN",
]);

export function parseStudentSchoolNumber(transcript: string): string {
  const words = tokenize(transcript).filter((word) => !ID_FILLER.has(normalize(word)));
  if (!words.length) return "";

  const normalized = words.map(normalize).filter(Boolean);
  const digitChunks = normalized.filter((token) => /^\d+$/.test(token));
  if (digitChunks.length) return digitChunks.join("");

  const numericWords = words.filter((word) => NUMBER_WORDS.has(normalize(word)));
  return parseTurkishNumber(numericWords);
}

const NAME_FILLER = new Set([
  ...ID_FILLER,
  "ADI",
  "AD",
  "SOYADI",
  "SOYAD",
  "ISMI",
  "ISIM",
]);

const extractNameTokens = (transcript: string) =>
  tokenize(transcript).filter((word) => {
    if (!/\p{L}/u.test(word)) return false;
    const normalized = normalize(word);
    if (!normalized) return false;
    if (NAME_FILLER.has(normalized)) return false;
    // Numara kelime olarak söylenmişse ("bin iki yüz...") isim alanına karışmasın.
    if (NUMBER_WORDS.has(normalized)) return false;
    return true;
  });

const dedupeAdjacentWords = (words: string[]) => {
  const result: string[] = [];
  for (const word of words) {
    if (normalize(result[result.length - 1]) === normalize(word)) continue;
    result.push(word);
  }
  return result;
};

export function parseStudentName(transcript: string): string {
  const cleaned = dedupeAdjacentWords(extractNameTokens(transcript));
  if (cleaned.length < 2) return "";
  return upperTr(cleaned.join(" "));
}

// Önceki sürümlerde dışarıdan kullanılmış olabilecek yardımcı fonksiyon için uyumluluk.
// V7'de sınıf sesle okunmaz; sınıf Öğrenciler arayüzündeki seçimden gelir.
export function parseStudentVoiceRecord(transcript: string, _classroomOptions?: string[]): StudentVoiceRecord {
  return {
    id: parseStudentSchoolNumber(transcript),
    name: parseStudentName(transcript),
    classroom: "",
    parentName: "",
  };
}

const stepLabel = (step: StudentVoiceStep) =>
  step === "id" ? "1/2 • OKUL NUMARASI" : "2/2 • ÖĞRENCİNİN ADI SOYADI";

const stepInstruction = (step: StudentVoiceStep) =>
  step === "id"
    ? "Önce yalnızca okul numarasını söyleyin. Örnek: “1234”."
    : "Şimdi öğrencinin adını ve soyadını söyleyin. Bitince SES KAYDINI KAPAT VE KAYDET düğmesine basın.";

export function useStudentVoiceRegistration({
  onProgress,
  onRecognized,
}: UseStudentVoiceRegistrationArgs) {
  const recognitionRef = useRef<any>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const sessionActiveRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const finalizedRef = useRef(false);
  const restartingRef = useRef<number | null>(null);
  const stopFallbackRef = useRef<number | null>(null);
  const stepRef = useRef<StudentVoiceStep>("id");
  const recordRef = useRef<StudentVoiceRecord>({ id: "", name: "", classroom: "", parentName: "" });
  const allFinalUtterancesRef = useRef<string[]>([]);
  const nameFinalUtterancesRef = useRef<string[]>([]);
  const latestInterimRef = useRef("");
  const onProgressRef = useRef(onProgress);
  const onRecognizedRef = useRef(onRecognized);

  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStep, setVoiceStep] = useState<StudentVoiceStep>("id");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceFeedback, setVoiceFeedback] = useState(
    `${stepLabel("id")} — ${stepInstruction("id")}`,
  );

  const voiceSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onRecognizedRef.current = onRecognized;
  }, [onRecognized]);

  const clearRestartTimer = useCallback(() => {
    if (restartingRef.current !== null) {
      window.clearTimeout(restartingRef.current);
      restartingRef.current = null;
    }
  }, []);

  const clearStopFallback = useCallback(() => {
    if (stopFallbackRef.current !== null) {
      window.clearTimeout(stopFallbackRef.current);
      stopFallbackRef.current = null;
    }
  }, []);

  const setStep = useCallback((step: StudentVoiceStep, extra?: string) => {
    stepRef.current = step;
    setVoiceStep(step);
    setVoiceFeedback(`${extra ? `${extra} ` : ""}${stepLabel(step)} — ${stepInstruction(step)}`.trim());
  }, []);

  const combinedNameTranscript = useCallback(() => {
    const pieces = [...nameFinalUtterancesRef.current];
    const interim = latestInterimRef.current.trim();
    if (interim) pieces.push(interim);
    return pieces.join(" ").replace(/\s+/g, " ").trim();
  }, []);

  const updateNamePreview = useCallback((transcript: string) => {
    const name = parseStudentName(transcript);
    const looseTokens = dedupeAdjacentWords(extractNameTokens(transcript));
    const looseName = looseTokens.length ? upperTr(looseTokens.join(" ")) : "";
    const current = { ...recordRef.current, name: name || looseName };
    recordRef.current = current;
    onProgressRef.current?.(current, "name");
    if (name) {
      setVoiceFeedback(`✓ AD SOYAD: ${name}. Hazır olduğunuzda “SES KAYDINI KAPAT VE KAYDET” düğmesine basın.`);
    } else if (looseName) {
      setVoiceFeedback(`Adın bir kısmını duydum: ${looseName}. Soyadını da söyleyin; sonra kaydı kapatın.`);
    }
  }, []);

  const processFinalUtterance = useCallback((transcript: string) => {
    const cleanTranscript = String(transcript || "").replace(/\s+/g, " ").trim();
    if (!cleanTranscript) return;

    latestInterimRef.current = "";
    allFinalUtterancesRef.current.push(cleanTranscript);
    setVoiceTranscript(allFinalUtterancesRef.current.join(" | "));

    if (stepRef.current === "id") {
      const id = parseStudentSchoolNumber(cleanTranscript);
      if (!id) {
        setVoiceFeedback(`${stepLabel("id")} — Okul numarasını anlayamadım. Yalnızca numarayı söyleyin. Örnek: “1234”.`);
        return;
      }

      const current = { ...recordRef.current, id };
      recordRef.current = current;
      onProgressRef.current?.(current, "name");

      // Kullanıcı numara + ad soyadı tek cümlede söylediyse adı da kaçırma.
      const sameUtteranceName = parseStudentName(cleanTranscript);
      if (sameUtteranceName) {
        current.name = sameUtteranceName;
        recordRef.current = current;
        nameFinalUtterancesRef.current = [cleanTranscript];
        onProgressRef.current?.(current, "name");
        setStep("name", `✓ Okul No ${id}. ✓ Ad Soyad ${sameUtteranceName}.`);
        setVoiceFeedback(`✓ Okul No ${id} • ✓ ${sameUtteranceName}. Kaydetmek için “SES KAYDINI KAPAT VE KAYDET” düğmesine basın.`);
        return;
      }

      setStep("name", `✓ Okul No ${id}.`);
      return;
    }

    const previousLast = nameFinalUtterancesRef.current[nameFinalUtterancesRef.current.length - 1];
    if (!previousLast || normalize(previousLast) !== normalize(cleanTranscript)) {
      nameFinalUtterancesRef.current.push(cleanTranscript);
    }
    updateNamePreview(combinedNameTranscript());
  }, [combinedNameTranscript, setStep, updateNamePreview]);

  const finalizeSession = useCallback(async () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    clearStopFallback();
    clearRestartTimer();

    const allHeard = [
      ...allFinalUtterancesRef.current,
      latestInterimRef.current,
    ].filter(Boolean).join(" | ");

    const current = { ...recordRef.current };
    if (!current.id) current.id = parseStudentSchoolNumber(allHeard);

    const nameTranscript = combinedNameTranscript();
    const finalName = parseStudentName(nameTranscript) || parseStudentName(allHeard);
    if (finalName) current.name = finalName;

    recordRef.current = current;
    onProgressRef.current?.(current, current.id ? "name" : "id");

    setVoiceFeedback("Öğrenci veritabanına kaydediliyor…");

    let normalizedResult: RecognitionResult;
    try {
      const result = await onRecognizedRef.current(current, allHeard);
      normalizedResult = typeof result === "string"
        ? { success: !/kayıt yapılmadı|başarısız|zaten kayıtlı/i.test(result), message: result }
        : result && typeof result === "object"
          ? result
          : { success: true };
    } catch (error) {
      normalizedResult = {
        success: false,
        message: `Öğrenci kaydı sırasında veritabanı hatası oluştu: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
      };
    }

    setVoiceActive(false);
    setVoiceListening(false);
    setVoiceFeedback(
      normalizedResult.message ||
      (normalizedResult.success
        ? "✓ Öğrenci kaydedildi. Yeni kayıt için Ses Kaydını Aç düğmesine basın."
        : "Kayıt yapılamadı. Algılanan bilgileri kontrol edip tekrar deneyin."),
    );

    if (normalizedResult.success) {
      recordRef.current = { id: "", name: "", classroom: "", parentName: "" };
      allFinalUtterancesRef.current = [];
      nameFinalUtterancesRef.current = [];
      latestInterimRef.current = "";
      stepRef.current = "id";
      setVoiceStep("id");
      setVoiceTranscript("");
    }
  }, [clearRestartTimer, clearStopFallback, combinedNameTranscript]);

  const stopVoice = useCallback(() => {
    if (!voiceActive && !sessionActiveRef.current) return;

    stopRequestedRef.current = true;
    sessionActiveRef.current = false;
    setVoiceListening(false);
    clearRestartTimer();
    setVoiceFeedback("Ses kaydı kapatılıyor… Son söylenen kelimeler alınıp öğrenci kaydediliyor.");

    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        // abort() son kelimeyi atabiliyor. stop() ise mevcut konuşmayı final sonuca dönüştürmeye çalışır.
        recognition.stop?.();
      } catch {
        try {
          recognition.abort?.();
        } catch {
          // no-op
        }
      }
    } else {
      void finalizeSession();
    }

    clearStopFallback();
    stopFallbackRef.current = window.setTimeout(() => {
      void finalizeSession();
    }, 900);

    stopMicrophoneStream(microphoneStreamRef.current);
    microphoneStreamRef.current = null;
  }, [clearRestartTimer, clearStopFallback, finalizeSession, voiceActive]);

  const createRecognition = useCallback(() => {
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) return null;

    const recognition = new Recognition();
    recognition.lang = "tr-TR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 10;

    recognition.onstart = () => {
      setVoiceListening(true);
      const step = stepRef.current;
      setVoiceFeedback(`${stepLabel(step)} — DİNLİYORUM. ${stepInstruction(step)}`);
    };

    recognition.onresult = (event: any) => {
      for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;

        let bestTranscript = "";
        let bestScore = -1;
        const alternatives = Math.min(Number(result.length || 1), 10);
        for (let altIndex = 0; altIndex < alternatives; altIndex += 1) {
          const candidate = String(result[altIndex]?.transcript || "").replace(/\s+/g, " ").trim();
          if (!candidate) continue;

          const score = stepRef.current === "id"
            ? (parseStudentSchoolNumber(candidate) ? 100 : 0) + candidate.length / 1000
            : (parseStudentName(candidate) ? 100 : extractNameTokens(candidate).length * 10) + candidate.length / 1000;

          if (score > bestScore) {
            bestScore = score;
            bestTranscript = candidate;
          }
        }

        if (!bestTranscript) continue;

        if (!result.isFinal) {
          latestInterimRef.current = bestTranscript;
          const shown = [...allFinalUtterancesRef.current, bestTranscript].filter(Boolean).join(" | ");
          setVoiceTranscript(shown);
          if (stepRef.current === "name") {
            updateNamePreview(combinedNameTranscript());
          }
          continue;
        }

        processFinalUtterance(bestTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      const raw = String(event?.error || "").toLowerCase();
      setVoiceListening(false);

      if (raw === "no-speech") {
        if (sessionActiveRef.current) {
          const step = stepRef.current;
          setVoiceFeedback(`${stepLabel(step)} — Ses duyamadım; mikrofon açık kalacak. ${stepInstruction(step)}`);
        }
        return;
      }

      if (raw === "aborted" && stopRequestedRef.current) return;

      const fatal = ["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported", "language-unavailable"].includes(raw);
      if (fatal) {
        sessionActiveRef.current = false;
        setVoiceActive(false);
        setVoiceFeedback(describeSpeechError(event));
      } else {
        setVoiceFeedback(describeSpeechError(event));
      }
    };

    recognition.onend = () => {
      setVoiceListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;

      if (stopRequestedRef.current) {
        void finalizeSession();
        return;
      }

      if (!sessionActiveRef.current) return;

      clearRestartTimer();
      restartingRef.current = window.setTimeout(() => {
        if (!sessionActiveRef.current) return;
        const next = createRecognition();
        if (!next) {
          sessionActiveRef.current = false;
          setVoiceActive(false);
          setVoiceFeedback(buildSpeechDiagnostics());
          return;
        }
        recognitionRef.current = next;
        try {
          next.start();
        } catch (error) {
          setVoiceFeedback(describeSpeechError(error));
          clearRestartTimer();
          restartingRef.current = window.setTimeout(() => {
            if (!sessionActiveRef.current) return;
            try {
              next.start();
            } catch (secondError) {
              sessionActiveRef.current = false;
              setVoiceActive(false);
              setVoiceFeedback(describeSpeechError(secondError));
            }
          }, 350);
        }
      }, 140);
    };

    return recognition;
  }, [clearRestartTimer, combinedNameTranscript, finalizeSession, processFinalUtterance, updateNamePreview]);

  const startVoice = useCallback(() => {
    if (sessionActiveRef.current) return;
    if (!voiceSupported) {
      setVoiceFeedback(buildSpeechDiagnostics());
      return;
    }

    stopRequestedRef.current = false;
    finalizedRef.current = false;
    clearStopFallback();
    clearRestartTimer();
    stepRef.current = "id";
    recordRef.current = { id: "", name: "", classroom: "", parentName: "" };
    allFinalUtterancesRef.current = [];
    nameFinalUtterancesRef.current = [];
    latestInterimRef.current = "";
    setVoiceStep("id");
    setVoiceTranscript("");
    onProgressRef.current?.(recordRef.current, "id");

    sessionActiveRef.current = true;
    setVoiceActive(true);
    setVoiceFeedback(`Sesli kayıt AÇILIYOR… ${stepLabel("id")} — ${stepInstruction("id")}`);

    requestMicrophoneStream()
      .then((stream) => {
        if (!sessionActiveRef.current) {
          stopMicrophoneStream(stream);
          return;
        }
        microphoneStreamRef.current = stream;
        const recognition = createRecognition();
        if (!recognition) {
          sessionActiveRef.current = false;
          setVoiceActive(false);
          stopMicrophoneStream(stream);
          microphoneStreamRef.current = null;
          setVoiceFeedback(buildSpeechDiagnostics());
          return;
        }
        recognitionRef.current = recognition;
        try {
          startRecognitionUsingStream(recognition, stream);
          microphoneStreamRef.current = null;
        } catch (error) {
          sessionActiveRef.current = false;
          setVoiceActive(false);
          setVoiceListening(false);
          stopMicrophoneStream(stream);
          microphoneStreamRef.current = null;
          recognitionRef.current = null;
          setVoiceFeedback(describeSpeechError(error));
        }
      })
      .catch((error) => {
        sessionActiveRef.current = false;
        setVoiceActive(false);
        setVoiceListening(false);
        recognitionRef.current = null;
        stopMicrophoneStream(microphoneStreamRef.current);
        microphoneStreamRef.current = null;
        setVoiceFeedback(describeSpeechError(error));
      });
  }, [clearRestartTimer, clearStopFallback, createRecognition, voiceSupported]);

  useEffect(() => () => {
    sessionActiveRef.current = false;
    stopRequestedRef.current = false;
    clearRestartTimer();
    clearStopFallback();
    try {
      recognitionRef.current?.abort?.();
    } catch {
      // no-op
    }
    recognitionRef.current = null;
    stopMicrophoneStream(microphoneStreamRef.current);
    microphoneStreamRef.current = null;
  }, [clearRestartTimer, clearStopFallback]);

  return {
    voiceSupported,
    voiceActive,
    voiceListening,
    voiceStep,
    voiceTranscript,
    voiceFeedback,
    setVoiceFeedback,
    startVoice,
    stopVoice,
  };
}
