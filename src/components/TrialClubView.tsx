import React from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Save,
  Target,
} from "lucide-react";

type TrialClubScope = {
  label: string;
  count: number;
};

type TrialClubSubject = {
  name: string;
  totalQuestions: number;
  scopes: TrialClubScope[];
};

type TrialClubArea = {
  name: string;
  subjects: Array<{ name: string; totalQuestions: number }>;
};

type TrialClubExam = {
  id: string;
  examName?: string;
  examType?: string;
  gradeLevel: string;
  examNumber: number;
  examDate: string;
  subjects: TrialClubSubject[];
  areas?: TrialClubArea[];
  targetNets?: Record<string, number>;
  electronic?: boolean;
  bookletOptions?: string[];
  submitted?: boolean;
  finalized?: boolean;
  startsAt?: number;
  endsAt?: number;
  durationMinutes?: number;
  savedAnswers?: Record<string, string[]>;
  savedBooklet?: string;
  answerKey?: Record<string, string[]>;
  answerKeyBooklet?: string;
  answerStats?: Record<string, Array<{ correct: number; wrong: number; empty: number }>>;
  resultStatus?: "published" | "not-published" | "not-evaluated" | "student-result-missing";
  publishedResult?: {
    subjects: Array<{ name: string; correct: number; wrong: number; empty: number; net: number; rank?: number; participantCount?: number }>;
    correct: number; wrong: number; empty: number; net: number;
    score: number | null; rank: number; participantCount: number;
  };
};

type TrialClubPayload = {
  exams?: TrialClubExam[];
  canEditTargets?: boolean;
  studentName?: string;
  gradeLevel?: string;
  serverNow?: number;
};

const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    credentials: "omit",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data as T;
};

const formatDate = (value: string) => {
  if (!value) return "TARİH YOK";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date).toLocaleUpperCase("tr-TR");
};

const totalQuestionCount = (exam: TrialClubExam) =>
  exam.subjects.reduce((sum, subject) => sum + Math.max(0, Number(subject.totalQuestions) || 0), 0);

const answerOptions = ["A", "B", "C", "D", "E"] as const;

export default function TrialClubView({
  onBack,
  token,
  mode,
}: {
  onBack: () => void;
  token: string;
  mode: "staff" | "portal";
}) {
  const [payload, setPayload] = React.useState<TrialClubPayload>({ exams: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [selectedExamId, setSelectedExamId] = React.useState("");
  const [selectedGrade, setSelectedGrade] = React.useState("");
  const [targetDraft, setTargetDraft] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [electronicBooklet, setElectronicBooklet] = React.useState("");
  const [electronicAnswers, setElectronicAnswers] = React.useState<Record<string, string[]>>({});
  const [electronicSaving, setElectronicSaving] = React.useState(false);
  const [electronicRevision, setElectronicRevision] = React.useState(0);
  const electronicAutoSaveQueue = React.useRef<Promise<void>>(Promise.resolve());
  const electronicDraftRef = React.useRef<{ examId: string; booklet: string; answers: Record<string, string[]> }>({ examId: "", booklet: "", answers: {} });
  const electronicLastSavedRevision = React.useRef(0);
  const electronicAutoSaveError = React.useRef("");

  const [selectedAnswerDetail, setSelectedAnswerDetail] = React.useState("");
  const [examPage, setExamPage] = React.useState<"answers" | "result">("answers");
  const examTouchX = React.useRef<number | null>(null);
  const [clock, setClock] = React.useState(Date.now());
  const [clockOffset, setClockOffset] = React.useState(0);
  React.useEffect(() => { const id = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(id); }, []);

  const load = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const url = mode === "staff"
        ? `/api/behavior/teacher-links/${encodeURIComponent(token)}/trial-club`
        : `/api/public-portal/${encodeURIComponent(token)}/trial-club`;
      const data = await requestJson<TrialClubPayload>(url);
      setPayload({ ...data, exams: Array.isArray(data.exams) ? data.exams : [] });
      if (Number.isFinite(data.serverNow)) setClockOffset(Number(data.serverNow) - Date.now());
    } catch (reason: any) {
      setError(reason?.message || "DENEME KULÜBÜ BİLGİLERİ ALINAMADI.");
      setPayload({ exams: [] });
    } finally {
      setLoading(false);
    }
  }, [mode, token]);

  React.useEffect(() => { void load(); }, [load]);
  // Sonuç yayınlandığında uygulamadan çıkıp tekrar girmeyi gerektirmeden güncelle.
  // Arka plandayken gereksiz istek gönderme; sekmeye dönülünce hemen yenile.
  React.useEffect(() => {
    if (mode !== "portal") return;
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [mode, load]);

  const exams = Array.isArray(payload.exams) ? payload.exams : [];
  const grades = React.useMemo(
    () => Array.from(new Set(exams.map((exam) => String(exam.gradeLevel || "")).filter(Boolean))).sort((a, b) => Number(a) - Number(b)),
    [exams],
  );

  React.useEffect(() => {
    if (mode !== "staff" || selectedGrade || !grades.length) return;
    setSelectedGrade(grades[0]);
  }, [grades, mode, selectedGrade]);

  const visibleExams = React.useMemo(() => {
    if (mode !== "staff" || !selectedGrade) return exams;
    return exams.filter((exam) => String(exam.gradeLevel) === selectedGrade);
  }, [exams, mode, selectedGrade]);

  const selectedExam = exams.find((exam) => exam.id === selectedExamId) || null;
  // Yalnız öğrencinin değiştirdiği cevaplar için ara kayıt gönder.
  // Birden çok isteğin eski cevapları yeni cevapların üzerine yazmaması için
  // istekler tek sırada işlenir. Veriler sunucuda saklandığı için cihaz değişse de devam eder.
  const persistElectronicDraft = React.useCallback((examId: string, booklet: string, answers: Record<string, string[]>) => {
    if (!examId || !booklet || mode !== "portal") return electronicAutoSaveQueue.current;
    const save = async () => {
      const result = await requestJson<{ success?: boolean; finalized?: boolean; serverNow?: number }>(
        `/api/public-portal/${encodeURIComponent(token)}/trial-club/exams/${encodeURIComponent(examId)}/submit`,
        { method: "POST", body: JSON.stringify({ bookletType: booklet, answers }) },
      );
      if (Number.isFinite(result.serverNow)) setClockOffset(Number(result.serverNow) - Date.now());
      if (result.finalized) {
        setPayload((current) => ({ ...current, exams: (current.exams || []).map((exam) =>
          exam.id === examId ? { ...exam, finalized: true, submitted: true } : exam) }));
      }
      electronicAutoSaveError.current = "";
    };
    // Zincir bir önceki isteğin hatası olsa bile sonraki kayıtları engellemez.
    const pending = electronicAutoSaveQueue.current.catch(() => {}).then(save);
    electronicAutoSaveQueue.current = pending.catch((reason: any) => {
      electronicAutoSaveError.current = reason?.message || "Ara kayıt başarısız";
    });
    return pending;
  }, [mode, token]);

  React.useEffect(() => {
    electronicDraftRef.current = { examId: selectedExamId, booklet: electronicBooklet, answers: electronicAnswers };
  }, [selectedExamId, electronicBooklet, electronicAnswers]);

  React.useEffect(() => {
    if (!selectedExamId || !electronicRevision || !electronicBooklet || mode !== "portal") return;
    const exam = payload.exams?.find((item) => item.id === selectedExamId);
    if (!exam?.electronic || exam.finalized || !exam.startsAt || !exam.endsAt) return;
    const now = Date.now() + clockOffset;
    if (now < exam.startsAt || now >= exam.endsAt) return;
    const revision = electronicRevision;
    const timer = window.setTimeout(() => {
      if (electronicLastSavedRevision.current >= revision) return;
      void persistElectronicDraft(selectedExamId, electronicBooklet, electronicAnswers)
        .then(() => { electronicLastSavedRevision.current = Math.max(electronicLastSavedRevision.current, revision); })
        .catch(() => { setError("ARA KAYIT YAPILAMADI. KAYDET BUTONUNU KULLANINIZ."); });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [selectedExamId, electronicBooklet, electronicAnswers, electronicRevision, mode, clockOffset, persistElectronicDraft]);

  // Süre dolarken bekleyen son işaretlemeleri de kaydet; sunucu optiği kesinleştirir.
  React.useEffect(() => {
    if (!selectedExam?.electronic || selectedExam.finalized || !selectedExam.endsAt || mode !== "portal") return;
    const ms = Number(selectedExam.endsAt) - (Date.now() + clockOffset);
    if (ms <= 0) return;
    const timer = window.setTimeout(() => {
      const draft = electronicDraftRef.current;
      if (draft.examId !== selectedExam.id || !draft.booklet) return;
      void persistElectronicDraft(draft.examId, draft.booklet, draft.answers)
        .then(() => { void load(); })
        .catch(() => { void load(); });
    }, ms + 50);
    return () => window.clearTimeout(timer);
  }, [selectedExam?.id, selectedExam?.endsAt, selectedExam?.finalized, clockOffset, mode, persistElectronicDraft, load]);

  React.useEffect(() => {
    if (!selectedExam?.electronic || !selectedExam.endsAt || selectedExam.answerKey || clock + clockOffset < selectedExam.endsAt) return;
    const interval = window.setInterval(() => { void load(); }, 10000);
    void load();
    return () => window.clearInterval(interval);
  }, [selectedExam?.id, selectedExam?.endsAt, Boolean(selectedExam?.answerKey), clockOffset]);

  const openExam = (exam: TrialClubExam) => {
    const next: Record<string, string> = {};
    for (const subject of exam.subjects) {
      const saved = exam.targetNets?.[subject.name];
      next[subject.name] = Number.isFinite(Number(saved)) ? String(saved) : "";
    }
    setTargetDraft(next);
    setElectronicBooklet(exam.savedBooklet || "");
    setElectronicAnswers(exam.savedAnswers || {});
    setElectronicRevision(0);
    electronicLastSavedRevision.current = 0;
    setNotice("");
    setError("");
    setSelectedAnswerDetail("");
    setExamPage("answers");
    setSelectedExamId(exam.id);
  };

  const closeExam = () => {
    setSelectedExamId("");
    setElectronicBooklet("");
    setElectronicAnswers({});
    setError("");
  };

  const saveTargets = async () => {
    if (!selectedExam || !payload.canEditTargets || mode !== "portal") return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const targets: Record<string, number> = {};
      for (const subject of selectedExam.subjects) {
        const raw = String(targetDraft[subject.name] ?? "").trim().replace(",", ".");
        if (!raw) continue;
        const numeric = Number(raw);
        if (!Number.isFinite(numeric) || numeric < 0) {
          throw new Error(`${subject.name} İÇİN HEDEF NET GEÇERLİ DEĞİL.`);
        }
        if (subject.totalQuestions > 0 && numeric > subject.totalQuestions) {
          throw new Error(`${subject.name} İÇİN HEDEF NET ${subject.totalQuestions} SORUYU GEÇEMEZ.`);
        }
        targets[subject.name] = Math.round(numeric * 100) / 100;
      }
      const data = await requestJson<{ targets?: Record<string, number> }>(
        `/api/public-portal/${encodeURIComponent(token)}/trial-club/targets/${encodeURIComponent(selectedExam.id)}`,
        { method: "PUT", body: JSON.stringify({ targets }) },
      );
      const savedTargets = data.targets || targets;
      setPayload((current) => ({
        ...current,
        exams: (current.exams || []).map((exam) => exam.id === selectedExam.id ? { ...exam, targetNets: savedTargets } : exam),
      }));
      setNotice("HEDEF NETLER KAYDEDİLDİ.");
    } catch (reason: any) {
      setError(reason?.message || "HEDEF NETLER KAYDEDİLEMEDİ.");
    } finally {
      setSaving(false);
    }
  };

  const setElectronicAnswer = (subjectName: string, questionIndex: number, option: string) => {
    if (!selectedExam || clock + clockOffset >= Number(selectedExam.endsAt || Infinity)) return;
    setElectronicAnswers((current) => {
      const nextSubject = [...(current[subjectName] || [])];
      nextSubject[questionIndex] = nextSubject[questionIndex] === option ? "" : option;
      return { ...current, [subjectName]: nextSubject };
    });
    setElectronicRevision((value) => value + 1);
  };

  const submitElectronicExam = async () => {
    if (!selectedExam || !selectedExam.electronic || mode !== "portal" || electronicSaving) return;
    if (!electronicBooklet) { setError("ÖNCE KİTAPÇIK TÜRÜNÜ SEÇİNİZ."); return; }
    const expired = clock + clockOffset >= Number(selectedExam.endsAt || Infinity);
    setElectronicSaving(true);
    setError("");
    try {
      await electronicAutoSaveQueue.current;
      const result = await requestJson<{ success?: boolean; finalized?: boolean; serverNow?: number }>(
        `/api/public-portal/${encodeURIComponent(token)}/trial-club/exams/${encodeURIComponent(selectedExam.id)}/submit`,
        { method: "POST", body: JSON.stringify({ bookletType: electronicBooklet, answers: electronicAnswers }) },
      );
      electronicLastSavedRevision.current = electronicRevision;
      if (Number.isFinite(result.serverNow)) setClockOffset(Number(result.serverNow) - Date.now());
      if (result.finalized) {
        setNotice("SINAV SONA ERDİ. OPTİK FORM KAPATILDI. CEVAP ANAHTARI BİR SAAT BOYUNCA GÖRÜNTÜLENEBİLİR.");
        setPayload((current) => ({ ...current, exams: (current.exams || []).map((exam) => exam.id === selectedExam.id ? { ...exam, finalized: true, submitted: true } : exam) }));
      } else {
        setNotice("CEVAPLAR KAYDEDİLDİ. SINAV DEVAM EDİYOR; OPTİK FORM AÇIK KALACAK.");
        setPayload((current) => ({ ...current, exams: (current.exams || []).map((exam) => exam.id === selectedExam.id ? { ...exam, submitted: true, savedBooklet: electronicBooklet, savedAnswers: electronicAnswers } : exam) }));
      }
      if (expired || result.finalized) void load();
    } catch (reason: any) {
      setError(reason?.message || "CEVAPLAR KAYDEDİLEMEDİ.");
    } finally { setElectronicSaving(false); }
  };

  const formatCountdown = (milliseconds: number) => {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds % 3600 / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  const renderAnswerKey = (exam: TrialClubExam) => (
    <div className="space-y-3">
      {exam.answerKey ? <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
        <div className="mb-3 text-center text-sm font-black text-emerald-950">{exam.answerKeyBooklet || exam.savedBooklet || electronicBooklet} KİTAPÇIĞI CEVAP ANAHTARI</div>
        {Object.entries(exam.answerKey).map(([subject, answers]) => (
          <div key={subject} className="mt-4">
            <strong className="text-xs text-emerald-950">{subject}</strong>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {answers.map((answer, i) => {
                const id = `${subject}-${i}`;
                const studentAnswer = String(exam.savedAnswers?.[subject]?.[i] || "").toUpperCase();
                const incorrect = Boolean(studentAnswer && /^[A-E]$/.test(studentAnswer) && answer && studentAnswer !== answer);
                const unanswered = !/^[A-E]$/.test(studentAnswer);
                const stats = exam.answerStats?.[subject]?.[i];
                return <div key={id} className="min-w-0">
                  <button type="button" onClick={() => setSelectedAnswerDetail((current) => current === id ? "" : id)}
                    aria-expanded={selectedAnswerDetail === id}
                    className={`flex w-full items-center justify-center gap-0.5 rounded-lg border px-0.5 py-2 text-[12px] font-black ${unanswered ? "border-slate-300 bg-slate-100" : incorrect ? "border-pink-200 bg-pink-50" : "border-rose-200 bg-white"}`}>
                    <span className="text-slate-950">{i + 1}</span><span className={`text-[14px] ${incorrect ? "text-black underline decoration-black decoration-2 underline-offset-[3px]" : "text-red-700"}`}>{answer || "—"}</span>
                  </button>
                  {selectedAnswerDetail === id ? <div className="mt-1 rounded-lg bg-white px-1 py-2 text-center text-[10px] font-bold text-slate-800 shadow-sm">
                    {stats ? <><div>Doğru {stats.correct}</div><div>Yanlış {stats.wrong}</div><div>Boş {stats.empty}</div></> : "İstatistik yok"}
                  </div> : null}
                </div>;
              })}
            </div>
          </div>
        ))}
      </div> : null}
    </div>
  );

  const renderElectronicOptic = (exam: TrialClubExam) => {
    const now = clock + clockOffset;
    const startsAt = Number(exam.startsAt || 0);
    const endsAt = Number(exam.endsAt || 0);
    const pending = startsAt > 0 && now < startsAt;
    const expired = endsAt > 0 && now >= endsAt;
    const keyWindow = expired && now < endsAt + 3_600_000;
    const bookletOptions = Array.isArray(exam.bookletOptions) && exam.bookletOptions.length ? exam.bookletOptions : ["A"];
    const isTyt = String(exam.examType || "").trim().toLocaleUpperCase("tr-TR") === "TYT";
    const tytAreaForSubject = (subjectName: string) => {
      const key = String(subjectName || "").trim().toLocaleUpperCase("tr-TR");
      if (key.includes("TÜRKÇE") || key.includes("TURKCE")) return "Türkçe";
      if (key.includes("TARİH") || key.includes("TARIH") || key.includes("COĞRAFYA") || key.includes("COGRAFYA") || key.includes("FELSEFE") || key.includes("DİN KÜLTÜR") || key.includes("DIN KULTUR")) return "Sosyal Bilimler";
      if (key.includes("MATEMATİK") || key.includes("MATEMATIK")) return "Matematik";
      if (key.includes("FİZİK") || key.includes("FIZIK") || key.includes("KİMYA") || key.includes("KIMYA") || key.includes("BİYOLOJİ") || key.includes("BIYOLOJI")) return "Fen Bilimleri";
      return String(subjectName || "Alan");
    };
    const fallbackTytAreas = () => {
      const order = ["Türkçe", "Sosyal Bilimler", "Matematik", "Fen Bilimleri"];
      const grouped = new Map<string, TrialClubArea["subjects"]>();
      for (const subject of exam.subjects) {
        const areaName = tytAreaForSubject(subject.name);
        const current = grouped.get(areaName) || [];
        current.push({ name: subject.name, totalQuestions: subject.totalQuestions });
        grouped.set(areaName, current);
      }
      return [...order, ...Array.from(grouped.keys()).filter((name) => !order.includes(name))]
        .filter((name, index, all) => all.indexOf(name) === index && grouped.has(name))
        .map((name) => ({ name, subjects: grouped.get(name) || [] }));
    };
    const opticAreas: TrialClubArea[] = isTyt
      ? (Array.isArray(exam.areas) && exam.areas.length ? exam.areas : fallbackTytAreas())
      : exam.subjects.map((subject) => ({
          name: subject.name,
          subjects: [{ name: subject.name, totalQuestions: subject.totalQuestions }],
        }));
    const answeredCount = exam.subjects.reduce((sum, subject) => {
      const answers = electronicAnswers[subject.name] || [];
      return sum + Array.from({ length: subject.totalQuestions }, (_, index) => answers[index] || "").filter(Boolean).length;
    }, 0);
    const total = totalQuestionCount(exam);
    const remaining = Math.max(0, total - answeredCount);

    return <div className="space-y-3">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center">
        <div className="text-xs font-black text-rose-900">SINAV BAŞLAMA SAATİ: {startsAt ? new Date(startsAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }) : "BELİRTİLMEDİ"}</div>
        <div className="mt-1 text-lg font-black tabular-nums text-rose-900">{pending ? `BAŞLAMASINA ${formatCountdown(startsAt - now)} KALDI` : expired ? "SINAV SONA ERDİ" : `KALAN SÜRE ${formatCountdown(endsAt - now)}`}</div>
      </div>
      {expired && mode === "portal" && !exam.publishedResult ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs font-bold text-indigo-900">
          {exam.resultStatus === "student-result-missing"
            ? "Sonuçlar yayımlandı ancak size ait değerlendirme kaydı bulunamadı. Okul yönetimi kayıt eşleştirmesini kontrol etmelidir."
            : exam.resultStatus === "not-evaluated"
              ? "Sınav henüz değerlendirilemedi. Sonuçlar değerlendirildikten ve yayımlandıktan sonra Sonuçlarım ekranında görünecek."
              : "Sonuçlar henüz yönetici tarafından yayımlanmadı. Cevap anahtarı, sonuç yayımlama işleminin tamamlandığı anlamına gelmez."}
          <button type="button" onClick={() => void load()} className="ml-2 mt-2 rounded-lg bg-indigo-700 px-3 py-1.5 text-white">Sonuçları Yenile</button>
        </div>
      ) : null}
      {pending ? <div className="rounded-2xl bg-amber-50 p-5 text-center text-sm font-black text-amber-900">SINAV SAATİ GELMEDEN OPTİK FORM AÇILMAZ.</div> : null}
      {expired && !exam.finalized ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-center text-xs font-black text-rose-900">Sınav süresi doldu. Kaydedilmiş cevaplar otomatik olarak kesinleştirilir ve değerlendirmeye alınır.</div> : null}
      {!pending && !expired && !exam.finalized ? <><div className="sticky top-0 z-10 rounded-[24px] border border-violet-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">1. ADIM · KİTAPÇIK TÜRÜ</div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {bookletOptions.map((booklet) => {
              const selected = electronicBooklet === booklet;
              return <button
                key={booklet}
                type="button"
                onClick={() => { setElectronicBooklet(booklet); setElectronicRevision((value) => value + 1); setError(""); }}
                className={`relative flex h-12 min-w-[88px] items-center justify-center gap-2 rounded-2xl border-2 px-4 text-base font-black transition ${selected ? "border-fuchsia-700 bg-fuchsia-700 text-white shadow-[0_10px_24px_rgba(162,28,175,0.35)] ring-2 ring-fuchsia-200" : "border-violet-200 bg-white text-violet-700"}`}
                aria-pressed={selected}
              >
                <span>{booklet}</span>
                {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
              </button>;
            })}
          </div>
          <button
            type="button"
            disabled={!electronicBooklet || electronicSaving}
            onClick={() => void submitElectronicExam()}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-red-600 px-4 text-[11px] font-black text-white shadow-md transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {electronicSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {electronicSaving ? "KAYDEDİLİYOR…" : "KAYDET"}
          </button>
        </div>
        {!electronicBooklet ? <p className="mt-2 text-[10px] font-black text-slate-600">Optiğe başlamadan önce kitapçık türünüzü işaretleyin.</p> : (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-black">
            <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-fuchsia-100 px-3 py-1.5 text-fuchsia-800"><CheckCircle2 className="h-3.5 w-3.5" />{electronicBooklet} Kitapçığı Seçildi</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1.5 text-emerald-700">{answeredCount} işaretli</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1.5 text-amber-700">{remaining} boş</span>
          </div>
        )}
      </div>

      {!electronicBooklet ? (
        <div className="rounded-[24px] border border-dashed border-violet-200 bg-violet-50/50 p-8 text-center">
          <Target className="mx-auto h-8 w-8 text-violet-300" />
          <div className="mt-3 text-xs font-black text-violet-700">ÖNCE KİTAPÇIK TÜRÜNÜ SEÇİNİZ</div>
          <p className="mt-2 text-[10px] font-bold leading-5 text-slate-500">Kitapçık seçildikten sonra elektronik optik açılır ve tek parmakla yukarı kaydırarak {isTyt ? "alanlar" : "dersler"} arasında ilerleyebilirsiniz.</p>
        </div>
      ) : (
        <div
          className="max-h-[calc(100dvh-285px)] space-y-3 overflow-y-auto overscroll-contain pr-1"
          style={{ touchAction: "pan-y", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {opticAreas.map((area) => {
            const areaQuestionCount = area.subjects.reduce((sum, subject) => sum + Math.max(0, Number(subject.totalQuestions) || 0), 0);
            return <div key={area.name} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <strong className="text-[12px] font-black text-slate-950">{area.name.toLocaleUpperCase("tr-TR")}</strong>
                <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-slate-500 shadow-sm">{areaQuestionCount} SORU</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-[38px_repeat(5,minmax(0,1fr))] gap-1.5 px-1 pb-2 text-center text-[9px] font-black text-slate-400">
                  <span>Soru</span>
                  {answerOptions.map((option) => <span key={option}>{option}</span>)}
                </div>
                <div className="space-y-1.5">
                  {area.subjects.flatMap((subject, subjectIndex) => {
                    const answers = electronicAnswers[subject.name] || [];
                    const questionOffset = area.subjects
                      .slice(0, subjectIndex)
                      .reduce((sum, item) => sum + Math.max(0, Number(item.totalQuestions) || 0), 0);
                    return Array.from({ length: subject.totalQuestions }, (_, questionIndex) => {
                      const displayQuestionNumber = questionOffset + questionIndex + 1;
                      return (
                        <div key={`${area.name}-${subject.name}-${questionIndex}`} className="grid grid-cols-[38px_repeat(5,minmax(0,1fr))] items-center gap-1.5">
                          <span className="text-center text-[11px] font-black text-slate-600">{displayQuestionNumber}</span>
                          {answerOptions.map((option) => {
                            const selected = answers[questionIndex] === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setElectronicAnswer(subject.name, questionIndex, option)}
                                disabled={expired}
                                className={`flex h-9 select-none items-center justify-center rounded-xl border text-xs font-black transition ${selected ? "border-black bg-black text-white shadow-sm" : "border-slate-300 bg-white text-slate-900 active:bg-slate-100"}`}
                                style={{ touchAction: "pan-y", WebkitTapHighlightColor: "transparent" }}
                                aria-pressed={selected}
                                aria-label={`${area.name} ${displayQuestionNumber}. soru ${option} seçeneği`}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </div>;
          })}
        </div>
      )}</> : null}
    </div>;
  };

  return (
    <main className="min-h-[100dvh] bg-slate-50 p-2 text-slate-800 sm:p-4">
      <div className="mx-auto min-h-[calc(100dvh-1rem)] max-w-xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(67,56,202,0.12)]">
        <div
          className="relative overflow-hidden px-4 pb-5 pt-4 text-white"
          style={{ background: "linear-gradient(115deg, #681130 0%, #851039 58%, #A61550 100%)", color: "#FFFFFF", isolation: "isolate" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_34%)]" />
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/12" />
          <div className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={selectedExam ? closeExam : onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
              style={{ backgroundColor: "#FFFFFF", borderColor: "#FFFFFF", color: "#771B40", opacity: 1 }}
              aria-label="Geri dön"
            >
              <ArrowLeft className="h-5 w-5" style={{ color: "#771B40", strokeWidth: 3 }} />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] drop-shadow-sm" style={{ color: "#FFFFFF", opacity: 1 }}>e-Nstitü</div>
              <h1 className="truncate text-[21px] font-black tracking-[0.01em] drop-shadow-sm" style={{ color: "#FFFFFF", opacity: 1 }}>DENEME KULÜBÜ</h1>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm" style={{ borderColor: "rgba(255,255,255,0.60)", backgroundColor: "rgba(255,255,255,0.18)", color: "#FFFFFF", opacity: 1 }}>
              <Target className="h-5 w-5" style={{ color: "#FFFFFF" }} />
            </span>
          </div>
        </div>

        {error ? <div className="mx-3 mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-[10px] font-black text-rose-700">{error}</div> : null}
        {!selectedExam && notice ? <div className="mx-3 mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-[10px] font-black text-emerald-700">{notice}</div> : null}

        <div className="overflow-hidden">
          <div
            className={`flex w-[200%] transition-transform duration-500 ease-out ${selectedExam ? "-translate-x-1/2" : "translate-x-0"}`}
            style={selectedExam ? ({ touchAction: "pan-y" } as React.CSSProperties) : undefined}
          >
            <section className="w-1/2 shrink-0 p-3.5">
              {mode === "staff" && grades.length > 1 ? (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {grades.map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setSelectedGrade(grade)}
                      className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-black ${selectedGrade === grade ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-600"}`}
                    >
                      {grade}. SINIF
                    </button>
                  ))}
                </div>
              ) : null}

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-14 text-xs font-black text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />YÜKLENİYOR…</div>
              ) : visibleExams.length === 0 ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-7 text-center">
                  <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
                  <div className="mt-3 text-xs font-black text-slate-500">PLANLANMIŞ DENEME BULUNMUYOR.</div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleExams.map((exam) => (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => openExam(exam)}
                      className="flex w-full items-center gap-3 rounded-[22px] border border-indigo-100 bg-white p-3 text-left shadow-sm transition active:scale-[0.99]"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-black text-white">{exam.examNumber}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <strong className="block text-[13px] font-black text-slate-950">{exam.examName || `${exam.examNumber}. DENEME`}</strong>
                          {exam.publishedResult ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[8px] font-black text-indigo-700">SONUÇ YAYIMLANDI</span> : exam.electronic ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[7px] font-black text-emerald-700">ELEKTRONİK OPTİK</span> : null}
                        </span>
                        <span className="mt-1 block text-[9px] font-black text-indigo-600">{formatDate(exam.examDate)}</span>
                        <span className="mt-1 block text-[9px] font-bold text-slate-400">
                          {mode === "staff" ? `${exam.gradeLevel}. SINIF · ` : ""}{totalQuestionCount(exam)} SORU · {exam.subjects.length} DERS
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-indigo-400" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="w-1/2 shrink-0 p-3.5" style={{ touchAction: "pan-y" }}
              onTouchStart={(event) => { examTouchX.current = event.touches[0]?.clientX ?? null; }}
              onTouchEnd={(event) => {
                if (examTouchX.current === null || !selectedExam?.finalized || !selectedExam.electronic || !selectedExam.endsAt || clock + clockOffset < selectedExam.endsAt) return;
                const delta = (event.changedTouches[0]?.clientX ?? examTouchX.current) - examTouchX.current;
                if (Math.abs(delta) > 60) setExamPage(delta < 0 ? "result" : "answers");
                examTouchX.current = null;
              }}>
              {selectedExam ? (
                <>
                  <div className="mb-3 rounded-[24px] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-700 text-lg font-black text-white">{selectedExam.examNumber}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-black text-slate-950">{selectedExam.examName || `${selectedExam.examNumber}. DENEME`}</div>
                        <div className="mt-1 text-[9px] font-black text-violet-700">{formatDate(selectedExam.examDate)}</div>
                        <div className="mt-1 text-[9px] font-bold text-slate-400">{totalQuestionCount(selectedExam)} SORU · {selectedExam.subjects.length} DERS</div>
                      </div>
                    </div>
                  </div>

                  {mode === "portal" && selectedExam.electronic && selectedExam.finalized && selectedExam.endsAt && clock + clockOffset >= selectedExam.endsAt && examPage === "answers" ? (
                    selectedExam.answerKey ? renderAnswerKey(selectedExam) : (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                        Cevap anahtarı henüz erişilebilir değil. Öğrencinin kitapçık bilgisi, cevap anahtarı ve yayın durumu kontrol edilmelidir.
                        <button type="button" onClick={() => void load()} className="mt-3 block rounded-xl bg-amber-700 px-4 py-2 text-xs text-white">Yenile</button>
                      </div>
                    )
                  ) : mode === "portal" && selectedExam.publishedResult && (!selectedExam.electronic || examPage === "result") ? (
                    <div className="space-y-3 rounded-[24px] border border-indigo-200 bg-white p-4 shadow-sm">
                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        {([ ["Doğru", selectedExam.publishedResult.correct], ["Yanlış", selectedExam.publishedResult.wrong], ["Boş", selectedExam.publishedResult.empty], ["Net", selectedExam.publishedResult.net] ] as const).map(([label, value]) => (
                          <div key={label} className="min-w-0 rounded-xl bg-indigo-50 px-1 py-2 sm:p-3"><div className="text-[10px] font-bold text-indigo-600">{label}</div><div className="text-base font-black text-slate-900 sm:text-lg">{value}</div></div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-black text-slate-800">
                        {selectedExam.publishedResult.score !== null ? <span className="rounded-xl bg-amber-50 px-3 py-2">Puan: {selectedExam.publishedResult.score}</span> : null}
                        <span className="rounded-xl bg-emerald-50 px-3 py-2">Sıralama: {selectedExam.publishedResult.rank} / {selectedExam.publishedResult.participantCount}</span>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-100"><tr>{["Ders", "D", "Y", "B", "Net", "Sıra"].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead>
                          <tbody>{selectedExam.publishedResult.subjects.map((subject, index) => <tr key={`${subject.name}-${index}`} className="border-t border-slate-100"><td className="px-2 py-2 font-bold">{subject.name}</td><td className="px-2">{subject.correct}</td><td className="px-2">{subject.wrong}</td><td className="px-2">{subject.empty}</td><td className="px-2 font-bold">{subject.net}</td><td className="px-2 font-black text-red-700">{subject.rank != null && subject.rank > 0 ? `${subject.rank}.` : "—"}</td></tr>)}</tbody>
                        </table>
                      </div>
                      <p className="text-[10px] font-medium text-slate-500">Bu sonuçlar yönetici tarafından yayımlanmıştır ve daha sonra da görüntülenebilir.</p>
                    </div>
                  ) : mode === "portal" && selectedExam.electronic && selectedExam.endsAt && clock + clockOffset >= selectedExam.endsAt + 3_600_000 ? (
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-bold text-indigo-900">
                      {selectedExam.resultStatus === "student-result-missing"
                        ? "Sonuçlar yayımlandı ancak bu öğrenciye ait değerlendirme kaydı bulunamadı. Okul yönetimiyle iletişime geçiniz."
                        : selectedExam.resultStatus === "not-evaluated"
                          ? "Bu sınav henüz değerlendirilemedi. Sonuçlar hazır olduğunda burada gösterilecektir."
                          : "Sınav tamamlandı. Sonuçlar yönetici tarafından yayımlandığında burada gösterilecektir."}
                      <button type="button" onClick={() => void load()} className="mt-3 block rounded-xl bg-indigo-700 px-4 py-2 text-xs text-white">Sonuçları Yenile</button>
                    </div>
                  ) : mode === "portal" && selectedExam.electronic ? renderElectronicOptic(selectedExam) : (
                    <>
                      {selectedExam.subjects.length === 0 ? (
                        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-center text-[10px] font-black text-amber-700">BU DENEMENİN MÜFREDAT İÇERİĞİ HENÜZ HAZIRLANMADI.</div>
                      ) : (
                        <div className="space-y-3">
                          {selectedExam.subjects.map((subject) => {
                            const savedTarget = selectedExam.targetNets?.[subject.name];
                            return (
                              <div key={subject.name} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-3.5 py-3">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><BookOpen className="h-4 w-4" /></span>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[12px] font-black text-slate-950">{subject.name.toLocaleUpperCase("tr-TR")}</div>
                                    <div className="mt-0.5 text-[8px] font-black text-indigo-600">{subject.totalQuestions} SORU</div>
                                  </div>
                                  {payload.canEditTargets ? (
                                    <label className="w-24 text-right">
                                      <span className="block text-[7px] font-black text-slate-400">HEDEF NET</span>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        max={subject.totalQuestions || undefined}
                                        step="0.25"
                                        value={targetDraft[subject.name] ?? ""}
                                        onChange={(event) => setTargetDraft((current) => ({ ...current, [subject.name]: event.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-center text-[12px] font-black text-slate-900 outline-none focus:border-amber-400"
                                        placeholder="0"
                                      />
                                    </label>
                                  ) : Number.isFinite(Number(savedTarget)) ? (
                                    <div className="rounded-xl bg-amber-50 px-2.5 py-2 text-center">
                                      <div className="text-[7px] font-black text-amber-600">HEDEF NET</div>
                                      <div className="text-[12px] font-black text-amber-800">{savedTarget}</div>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="space-y-1.5 p-3">
                                  {subject.scopes.map((scope, index) => (
                                    <div key={`${subject.name}-${scope.label}-${index}`} className="flex items-start gap-2 rounded-xl bg-indigo-50/70 px-2.5 py-2">
                                      <span className="min-w-0 flex-1 text-[9px] font-bold leading-4 text-slate-700">{scope.label.toLocaleUpperCase("tr-TR")}</span>
                                      <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[8px] font-black text-indigo-700 shadow-sm">{scope.count > 0 ? `${scope.count} SORU` : "KAPSAM"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {payload.canEditTargets ? (
                        <div className="sticky bottom-2 mt-4">
                          {notice ? <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-center text-[9px] font-black text-emerald-700">{notice}</div> : null}
                          <button
                            type="button"
                            onClick={() => void saveTargets()}
                            disabled={saving}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-700 to-violet-700 px-4 py-3 text-[11px] font-black text-white shadow-lg disabled:opacity-60"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            HEDEF NETLERİ KAYDET
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
