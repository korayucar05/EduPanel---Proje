import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import localforage from "../core/state/AppStateService";
import { fetchCollectionFromLocalDatabase } from "../core/data/LegacyDatabaseFacade";

type StudentRecord = {
  id: string;
  number: string;
  name: string;
  classroom: string;
};

type WeaknessRow = {
  subject: string;
  outcome: string;
  wrong: number;
  empty: number;
  lostNet: number;
  recoverableNet: number;
  priority: number;
};

type PlanTask = {
  id: string;
  day: number;
  subject: string;
  outcome: string;
  duration: number;
  questionCount: number;
  activity: string;
  completed: boolean;
};

type DevelopmentPlan = {
  id: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  classroom: string;
  durationDays: number;
  dailyMinutes: number;
  createdAt: string;
  updatedAt: string;
  examCount: number;
  totalLostNet: number;
  recoverableNet: number;
  estimatedScoreGain: number;
  estimatedRankGain: number;
  priorities: WeaknessRow[];
  tasks: PlanTask[];
  mentorNote: string;
};

const PLAN_STORE_KEY = "development_plans";

const normalizeText = (value: unknown) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeSearchText = (value: unknown) =>
  normalizeText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getStudentNumber = (student: any) =>
  normalizeText(
    student?.studentNumber ??
      student?.schoolNumber ??
      student?.schoolNo ??
      student?.studentNo ??
      student?.okulNo ??
      student?.okul_no ??
      student?.number ??
      student?.no ??
      student?.id,
  );

const getStudentName = (student: any) =>
  normalizeText(
    student?.studentName ??
      student?.fullName ??
      student?.name ??
      `${student?.firstName ?? student?.first_name ?? student?.adi ?? ""} ${student?.lastName ?? student?.last_name ?? student?.surname ?? student?.soyadi ?? ""}`,
  );

const getStudentClassroom = (student: any) =>
  normalizeText(
    student?.classroom ??
      student?.className ??
      student?.gradeLevel ??
      student?.classBranch,
  );

const studentIdentity = (student: any) =>
  normalizeText(
    student?.recordId ??
      student?.id ??
      student?.studentId ??
      getStudentNumber(student) ??
      `${getStudentName(student)}-${getStudentClassroom(student)}`,
  );

const safeNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const findStudentResult = (exam: any, student: StudentRecord) => {
  const resultCollections = [
    exam?.results,
    exam?.calculatedResults,
    exam?.studentResults,
    exam?.evaluatedResults,
    exam?.analysisResults,
  ].filter(Array.isArray);

  for (const collection of resultCollections) {
    const match = collection.find((candidate: any) => {
      const candidateNumber = getStudentNumber(candidate);
      const candidateId = studentIdentity(candidate);
      return (
        (student.number && candidateNumber === student.number) ||
        (student.id && candidateId === student.id)
      );
    });
    if (match) return match;
  }

  const rawRecords = Array.isArray(exam?.studentTxtRecords)
    ? exam.studentTxtRecords
    : [];

  return rawRecords.find((candidate: any) => {
    const candidateNumber = getStudentNumber(candidate);
    const candidateId = studentIdentity(candidate);
    return (
      (student.number && candidateNumber === student.number) ||
      (student.id && candidateId === student.id)
    );
  });
};

const extractQuestionRows = (
  exam: any,
  studentResult: any,
): WeaknessRow[] => {
  const grouped = new Map<string, WeaknessRow>();

  const push = (
    subjectValue: unknown,
    outcomeValue: unknown,
    isWrong: boolean,
    isEmpty: boolean,
    pointValue = 1,
  ) => {
    if (!isWrong && !isEmpty) return;

    const subject = normalizeText(subjectValue) || "Genel";
    const outcome =
      normalizeText(outcomeValue) || "Kazanım bilgisi bulunamadı";
    const key = `${subject}::${outcome}`;
    const current =
      grouped.get(key) ||
      ({
        subject,
        outcome,
        wrong: 0,
        empty: 0,
        lostNet: 0,
        recoverableNet: 0,
        priority: 0,
      } satisfies WeaknessRow);

    if (isEmpty) current.empty += 1;
    else current.wrong += 1;

    const lostNet = isEmpty ? pointValue : pointValue * 1.25;
    current.lostNet += lostNet;
    current.recoverableNet += lostNet * (isEmpty ? 0.65 : 0.75);
    grouped.set(key, current);
  };

  const subjects = Array.isArray(studentResult?.subjects)
    ? studentResult.subjects
    : [];

  subjects.forEach((subject: any) => {
    const subjectName =
      subject?.subjectName ?? subject?.name ?? subject?.lessonName;
    const questions =
      subject?.questions ??
      subject?.questionResults ??
      subject?.answers ??
      [];

    if (Array.isArray(questions)) {
      questions.forEach((question: any, index: number) => {
        const isEmpty =
          question?.isEmpty === true ||
          normalizeText(
            question?.studentAns ??
              question?.studentAnswer ??
              question?.answer,
          ) === "";
        const isCorrect =
          question?.isCorrect === true ||
          question?.correct === true ||
          question?.status === "correct";
        const isWrong =
          question?.isWrong === true ||
          question?.wrong === true ||
          (!isCorrect && !isEmpty);
        push(
          subjectName,
          question?.outcome ??
            question?.learningOutcome ??
            question?.kazanim ??
            question?.topic ??
            question?.subjectOutcome ??
            `Soru ${question?.qNum ?? question?.number ?? index + 1}`,
          isWrong,
          isEmpty,
          safeNumber(question?.point ?? question?.score ?? 1) || 1,
        );
      });
      return;
    }

    const wrong = safeNumber(subject?.wrong);
    const empty = safeNumber(subject?.empty);
    for (let index = 0; index < wrong; index += 1) {
      push(subjectName, "Ders geneli", true, false);
    }
    for (let index = 0; index < empty; index += 1) {
      push(subjectName, "Ders geneli", false, true);
    }
  });

  if (grouped.size === 0) {
    const totalWrong = safeNumber(
      studentResult?.totals?.wrong ?? studentResult?.wrong,
    );
    const totalEmpty = safeNumber(
      studentResult?.totals?.empty ?? studentResult?.empty,
    );

    for (let index = 0; index < totalWrong; index += 1) {
      push("Genel", "Sınav geneli", true, false);
    }
    for (let index = 0; index < totalEmpty; index += 1) {
      push("Genel", "Sınav geneli", false, true);
    }
  }

  return Array.from(grouped.values());
};

const mergeWeaknesses = (rows: WeaknessRow[]) => {
  const merged = new Map<string, WeaknessRow>();

  rows.forEach((row) => {
    const key = `${row.subject}::${row.outcome}`;
    const current =
      merged.get(key) ||
      ({
        ...row,
        wrong: 0,
        empty: 0,
        lostNet: 0,
        recoverableNet: 0,
        priority: 0,
      } satisfies WeaknessRow);

    current.wrong += row.wrong;
    current.empty += row.empty;
    current.lostNet += row.lostNet;
    current.recoverableNet += row.recoverableNet;
    merged.set(key, current);
  });

  const values = Array.from(merged.values());
  const maxLost = Math.max(...values.map((row) => row.lostNet), 1);

  return values
    .map((row) => ({
      ...row,
      lostNet: Number(row.lostNet.toFixed(2)),
      recoverableNet: Number(row.recoverableNet.toFixed(2)),
      priority: Math.max(
        1,
        Math.min(
          100,
          Math.round(
            (row.lostNet / maxLost) * 70 +
              Math.min(30, row.wrong * 4 + row.empty * 2),
          ),
        ),
      ),
    }))
    .sort(
      (first, second) =>
        second.priority - first.priority ||
        second.lostNet - first.lostNet,
    );
};

const activityFor = (row: WeaknessRow) => {
  if (row.empty > row.wrong) {
    return "Kısa konu tekrarı, çözümlü örnek ve süreli mini test";
  }
  if (row.priority >= 75) {
    return "Konu anlatımı, rehberli soru çözümü ve pekiştirme testi";
  }
  if (row.priority >= 50) {
    return "Özet tekrar ve orta düzey soru çalışması";
  }
  return "Kısa tekrar ve kontrol testi";
};

const buildTasks = (
  priorities: WeaknessRow[],
  durationDays: number,
  dailyMinutes: number,
): PlanTask[] => {
  if (priorities.length === 0) return [];

  const tasks: PlanTask[] = [];
  const slotsPerDay = dailyMinutes >= 90 ? 3 : dailyMinutes >= 50 ? 2 : 1;
  const taskDuration = Math.max(
    20,
    Math.floor(dailyMinutes / slotsPerDay),
  );

  for (let day = 1; day <= durationDays; day += 1) {
    for (let slot = 0; slot < slotsPerDay; slot += 1) {
      const index = ((day - 1) * slotsPerDay + slot) % priorities.length;
      const row = priorities[index];

      tasks.push({
        id: `task-${Date.now()}-${day}-${slot}-${index}`,
        day,
        subject: row.subject,
        outcome: row.outcome,
        duration: taskDuration,
        questionCount: Math.max(
          10,
          Math.min(
            40,
            Math.round(10 + row.priority / 4 + slot * 2),
          ),
        ),
        activity: activityFor(row),
        completed: false,
      });
    }
  }

  return tasks;
};

export default function GoogleFormsModule() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [plans, setPlans] = useState<DevelopmentPlan[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [durationDays, setDurationDays] = useState(14);
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [databaseStudentRows, legacyStudentRows, examRows, savedPlans] = await Promise.all([
        fetchCollectionFromLocalDatabase("students").catch(() => []),
        localforage.getItem<any[]>("school_students"),
        localforage.getItem<any[]>("exams"),
        localforage.getItem<DevelopmentPlan[]>(PLAN_STORE_KEY),
      ]);

      // Yeni sürümlerde ana kaynak SQLite `students` koleksiyonudur. Eski
      // IndexedDB anahtarı yalnızca geriye dönük uyumluluk için kullanılır.
      const studentRows = Array.isArray(databaseStudentRows) && databaseStudentRows.length
        ? databaseStudentRows
        : Array.isArray(legacyStudentRows)
          ? legacyStudentRows
          : [];

      const normalizedStudents = (studentRows || [])
        .map((student: any) => ({
          id: studentIdentity(student),
          number: getStudentNumber(student),
          name: getStudentName(student) || "İsimsiz Öğrenci",
          classroom: getStudentClassroom(student),
        }))
        .filter(
          (student: StudentRecord) =>
            student.id || student.number || student.name,
        )
        .sort((first: StudentRecord, second: StudentRecord) => {
          const classCompare = first.classroom.localeCompare(
            second.classroom,
            "tr-TR",
            { numeric: true, sensitivity: "base" },
          );
          if (classCompare !== 0) return classCompare;

          return first.name.localeCompare(second.name, "tr-TR", {
            sensitivity: "base",
          });
        });

      setStudents(normalizedStudents);
      setExams(Array.isArray(examRows) ? examRows : []);
      setPlans(Array.isArray(savedPlans) ? savedPlans : []);
      if (!selectedStudentId && normalizedStudents[0]) {
        setSelectedStudentId(normalizedStudents[0].id);
      }
    } catch (error) {
      console.error(error);
      setNotice("Öğrenci ve sınav bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedStudent = students.find(
    (student) => student.id === selectedStudentId,
  );

  const filteredStudents = useMemo(() => {
    const queryTerms = normalizeSearchText(searchText).split(" ").filter(Boolean);
    if (!queryTerms.length) return students;

    return students.filter((student) => {
      const searchIndex = normalizeSearchText(`${student.number} ${student.name}`);
      return queryTerms.every((term) => searchIndex.includes(term));
    });
  }, [students, searchText]);

  useEffect(() => {
    const query = normalizeSearchText(searchText);
    if (!query) return;

    const exactMatch = filteredStudents.find(
      (student) =>
        normalizeSearchText(student.number) === query ||
        normalizeSearchText(student.name) === query,
    );
    if (exactMatch) setSelectedStudentId(exactMatch.id);
  }, [filteredStudents, searchText]);

  const runStudentSearch = () => {
    const query = normalizeSearchText(searchText);
    if (!query) {
      setNotice("Aramak için okul numarası, öğrenci adı veya soyadı yazınız.");
      return;
    }

    const exactMatch = filteredStudents.find(
      (student) =>
        normalizeSearchText(student.number) === query ||
        normalizeSearchText(student.name) === query,
    );
    if (exactMatch) {
      setSelectedStudentId(exactMatch.id);
      setSearchText("");
      setNotice(`${exactMatch.number ? `${exactMatch.number} - ` : ""}${exactMatch.name} seçildi.`);
      return;
    }

    if (filteredStudents.length === 1) {
      const [student] = filteredStudents;
      setSelectedStudentId(student.id);
      setSearchText("");
      setNotice(`${student.number ? `${student.number} - ` : ""}${student.name} seçildi.`);
      return;
    }

    setNotice(
      filteredStudents.length
        ? `${filteredStudents.length} öğrenci bulundu. Arama kutusunun altındaki listeden öğrenciyi seçiniz.`
        : "Arama ölçütüne uygun öğrenci bulunamadı.",
    );
  };

  const selectedPlan = plans.find(
    (plan) => plan.studentId === selectedStudentId,
  );

  const generatePlan = async () => {
    if (!selectedStudent) {
      setNotice("Önce bir öğrenci seçiniz.");
      return;
    }

    setGenerating(true);

    try {
      const matchingExams = exams
        .map((exam) => ({
          exam,
          result: findStudentResult(exam, selectedStudent),
          date: new Date(
            exam?.examDate ?? exam?.date ?? exam?.createdAt ?? 0,
          ).getTime(),
        }))
        .filter((entry) => entry.result)
        .sort((first, second) => first.date - second.date)
        .slice(-5);

      const weaknessRows = matchingExams.flatMap((entry) =>
        extractQuestionRows(entry.exam, entry.result),
      );
      const priorities = mergeWeaknesses(weaknessRows).slice(0, 12);
      const tasks = buildTasks(
        priorities,
        durationDays,
        dailyMinutes,
      );

      const totalLostNet = Number(
        priorities
          .reduce((sum, row) => sum + row.lostNet, 0)
          .toFixed(2),
      );
      const recoverableNet = Number(
        priorities
          .reduce((sum, row) => sum + row.recoverableNet, 0)
          .toFixed(2),
      );
      const estimatedScoreGain = Number(
        Math.max(0, recoverableNet * 4).toFixed(1),
      );
      const estimatedRankGain = Math.max(
        0,
        Math.round(
          recoverableNet * Math.max(25, matchingExams.length * 18),
        ),
      );

      const topAreas = priorities.slice(0, 3);
      const mentorNote =
        priorities.length > 0
          ? `${selectedStudent.name} için son ${matchingExams.length} sınav incelendi. En yüksek öncelik ${topAreas
              .map((row) => `${row.subject} / ${row.outcome}`)
              .join(
                ", ",
              )} alanlarındadır. Plan tamamlandığında yaklaşık ${recoverableNet} netlik geri kazanım potansiyeli bulunmaktadır.`
          : `${selectedStudent.name} için ayrıntılı soru veya kazanım verisi bulunamadı. Sınav analizleri kaydedildikçe plan otomatik olarak ayrıntılanacaktır.`;

      const now = new Date().toISOString();
      const plan: DevelopmentPlan = {
        id: selectedPlan?.id || `development-plan-${Date.now()}`,
        studentId: selectedStudent.id,
        studentNumber: selectedStudent.number,
        studentName: selectedStudent.name,
        classroom: selectedStudent.classroom,
        durationDays,
        dailyMinutes,
        createdAt: selectedPlan?.createdAt || now,
        updatedAt: now,
        examCount: matchingExams.length,
        totalLostNet,
        recoverableNet,
        estimatedScoreGain,
        estimatedRankGain,
        priorities,
        tasks,
        mentorNote,
      };

      const nextPlans = selectedPlan
        ? plans.map((item) =>
            item.studentId === selectedStudentId ? plan : item,
          )
        : [...plans, plan];

      await localforage.setItem(PLAN_STORE_KEY, nextPlans);
      setPlans(nextPlans);
      setNotice("Akıllı gelişim planı oluşturuldu ve kaydedildi.");
    } catch (error) {
      console.error(error);
      setNotice("Gelişim planı oluşturulamadı.");
    } finally {
      setGenerating(false);
    }
  };

  const toggleTask = async (taskId: string) => {
    if (!selectedPlan) return;

    const updatedPlan: DevelopmentPlan = {
      ...selectedPlan,
      updatedAt: new Date().toISOString(),
      tasks: selectedPlan.tasks.map((task) =>
        task.id === taskId
          ? { ...task, completed: !task.completed }
          : task,
      ),
    };

    const nextPlans = plans.map((plan) =>
      plan.id === updatedPlan.id ? updatedPlan : plan,
    );
    await localforage.setItem(PLAN_STORE_KEY, nextPlans);
    setPlans(nextPlans);
  };

  const completedCount =
    selectedPlan?.tasks.filter((task) => task.completed).length || 0;
  const completionRate = selectedPlan?.tasks.length
    ? Math.round(
        (completedCount / selectedPlan.tasks.length) * 100,
      )
    : 0;

  const groupedTasks = useMemo(() => {
    const map = new Map<number, PlanTask[]>();
    (selectedPlan?.tasks || []).forEach((task) => {
      const current = map.get(task.day) || [];
      current.push(task);
      map.set(task.day, current);
    });
    return Array.from(map.entries()).sort(
      ([first], [second]) => first - second,
    );
  }, [selectedPlan]);

  const downloadPlan = () => {
    if (!selectedPlan) return;

    const lines = [
      "e-Nstitü AKILLI GELİŞİM PLANI",
      "",
      `Öğrenci: ${selectedPlan.studentName}`,
      `No: ${selectedPlan.studentNumber || "-"}`,
      `Sınıf: ${selectedPlan.classroom || "-"}`,
      `Plan Süresi: ${selectedPlan.durationDays} gün`,
      `Günlük Süre: ${selectedPlan.dailyMinutes} dakika`,
      `Kazanılabilir Net: ${selectedPlan.recoverableNet}`,
      "",
      selectedPlan.mentorNote,
      "",
      ...groupedTasks.flatMap(([day, tasks]) => [
        `${day}. GÜN`,
        ...tasks.map(
          (task) =>
            `${task.completed ? "[X]" : "[ ]"} ${task.subject} - ${task.outcome} | ${task.duration} dk | ${task.questionCount} soru | ${task.activity}`,
        ),
        "",
      ]),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedPlan.studentName}-gelisim-plani.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <section className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-700 via-violet-700 to-purple-700 p-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-white/15 p-3">
              <Brain className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-xl font-black">
                Mentör Modu
              </h1>
              <p className="mt-1 max-w-2xl text-xs font-semibold text-white/75">
                Rehber öğretmen, sınıf rehber öğretmeni ve yöneticiler için öğrenciyi sürekli izleyen tek sayfalık Akıllı Gelişim Panosu.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/25"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Verileri Yenile
          </button>
        </div>
      </section>

      {notice && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo-800">
          {notice}
        </div>
      )}

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.35fr_0.65fr]">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Öğrenci
          </label>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_260px]">
            <form
              className="relative z-20"
              onSubmit={(event) => {
                event.preventDefault();
                runStudentSearch();
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Numara, ad soyad veya sınıf ara..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-20 text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 rounded-lg bg-indigo-700 px-4 py-2 text-[11px] font-black text-white hover:bg-indigo-800"
              >
                Ara
              </button>
              {searchText.trim() && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {filteredStudents.length ? (
                    filteredStudents.slice(0, 20).map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(student.id);
                          setSearchText("");
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-indigo-50"
                      >
                        <span className="min-w-0 truncate font-black text-slate-800">
                          {student.number ? `${student.number} - ` : ""}{student.name}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-slate-500">
                          {student.classroom || "-"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-center text-xs font-bold text-slate-400">
                      Öğrenci bulunamadı.
                    </p>
                  )}
                </div>
              )}
            </form>

            <div className="relative">
              <select
                value={selectedStudentId}
                onChange={(event) =>
                  setSelectedStudentId(event.target.value)
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 pr-9 text-xs font-black text-slate-700 outline-none focus:border-indigo-400"
              >
                <option value="">Öğrenci seçiniz</option>
                {filteredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.number
                      ? `${student.number} - `
                      : ""}
                    {student.name} ({student.classroom || "-"})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Plan Süresi
            </span>
            <select
              value={durationDays}
              onChange={(event) =>
                setDurationDays(Number(event.target.value))
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700"
            >
              <option value={7}>7 gün</option>
              <option value={14}>14 gün</option>
              <option value={21}>21 gün</option>
            </select>
          </label>

          <label>
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Günlük Süre
            </span>
            <select
              value={dailyMinutes}
              onChange={(event) =>
                setDailyMinutes(Number(event.target.value))
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700"
            >
              <option value={30}>30 dk</option>
              <option value={45}>45 dk</option>
              <option value={60}>60 dk</option>
              <option value={90}>90 dk</option>
              <option value={120}>120 dk</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void generatePlan()}
          disabled={generating || loading || !selectedStudent}
          className="lg:col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          {generating
            ? "Gelişim Planı Hazırlanıyor..."
            : selectedPlan
              ? "Gelişim Planını Yeniden Oluştur"
              : "Gelişim Planı Oluştur"}
        </button>
      </section>

      {selectedPlan ? (
        <div className="space-y-5">
          <section className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
                  <UserRound className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {selectedPlan.studentName}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    No: {selectedPlan.studentNumber || "-"} • Sınıf: {selectedPlan.classroom || "-"} • Son güncelleme: {new Date(selectedPlan.updatedAt).toLocaleDateString("tr-TR")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={downloadPlan}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100"
              >
                <Download className="h-4 w-4" />
                Gelişim Planını İndir
              </button>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {[
              {
                label: "Kazanılabilir Net",
                value: `+${selectedPlan.recoverableNet}`,
                icon: Target,
                tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
              },
              {
                label: "Tahmini Puan Kazancı",
                value: `+${selectedPlan.estimatedScoreGain ?? 0}`,
                icon: TrendingUp,
                tone: "border-blue-200 bg-blue-50 text-blue-800",
              },
              {
                label: "Tahmini Sıralama Kazancı",
                value: `↑ ${selectedPlan.estimatedRankGain ?? 0}`,
                icon: TrendingUp,
                tone: "border-violet-200 bg-violet-50 text-violet-800",
              },
              {
                label: "Gelişim Yüzdesi",
                value: `%${completionRate}`,
                icon: CheckCircle2,
                tone: "border-cyan-200 bg-cyan-50 text-cyan-800",
              },
              {
                label: "Tamamlanan Görev",
                value: `${completedCount}/${selectedPlan.tasks.length}`,
                icon: CheckCircle2,
                tone: "border-lime-200 bg-lime-50 text-lime-800",
              },
              {
                label: "Plan Süresi",
                value: `${selectedPlan.durationDays} gün`,
                icon: CalendarDays,
                tone: "border-amber-200 bg-amber-50 text-amber-800",
              },
              {
                label: "İncelenen Sınav",
                value: selectedPlan.examCount,
                icon: BookOpen,
                tone: "border-slate-200 bg-slate-50 text-slate-800",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.label}
                  className={`rounded-2xl border p-4 shadow-sm ${card.tone}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-xl font-black">{card.value}</span>
                  </div>
                  <p className="mt-3 text-[9px] font-black uppercase tracking-wide opacity-75">
                    {card.label}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-indigo-800">
                <Brain className="h-5 w-5" />
                <h3 className="text-sm font-black">
                  Yapay Zekâ Mentör Yorumu
                </h3>
              </div>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">
                {selectedPlan.mentorNote}
              </p>
            </article>

            <article className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-emerald-900">
                  Gelişim Takibi
                </h3>
                <span className="text-xl font-black text-emerald-800">
                  %{completionRate}
                </span>
              </div>
              <div className="mt-4 h-4 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-black text-emerald-800">
                <span>{completedCount} görev tamamlandı</span>
                <span>{selectedPlan.tasks.length - completedCount} görev kaldı</span>
              </div>
            </article>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Öncelikli Çalışma Alanları
                </h3>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">
                  En yüksek puan kazanımı sağlayacak ders ve kazanımlar
                </p>
              </div>
              <Target className="h-5 w-5 text-rose-600" />
            </header>

            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[820px] border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="rounded-l-xl px-3 py-3 text-left">Öncelik</th>
                    <th className="px-3 py-3 text-left">Ders</th>
                    <th className="px-3 py-3 text-left">Kazanım</th>
                    <th className="px-3 py-3 text-center">Yanlış</th>
                    <th className="px-3 py-3 text-center">Boş</th>
                    <th className="px-3 py-3 text-center">Kayıp Net</th>
                    <th className="rounded-r-xl px-3 py-3 text-center">Kazanılabilir</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPlan.priorities.map((row, index) => (
                    <tr
                      key={`${row.subject}-${row.outcome}-${index}`}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-3">
                        <span className="rounded-lg bg-rose-100 px-2 py-1 font-black text-rose-700">
                          %{row.priority}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-black text-slate-800">
                        {row.subject}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-600">
                        {row.outcome}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-rose-600">
                        {row.wrong}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-slate-500">
                        {row.empty}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-slate-700">
                        {row.lostNet}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-emerald-700">
                        +{row.recoverableNet}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedPlan.priorities.length === 0 && (
                <div className="p-10 text-center text-sm font-bold text-slate-400">
                  Ayrıntılı kazanım verisi bulunamadı.
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Günlük Çalışma Planı
                </h3>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">
                  Görevlere tıklayarak tamamlandı olarak işaretleyebilirsiniz
                </p>
              </div>
              <CalendarDays className="h-5 w-5 text-indigo-600" />
            </header>

            <div className="grid gap-4 p-5 lg:grid-cols-2">
              {groupedTasks.map(([day, tasks]) => (
                <section
                  key={day}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <header className="flex items-center justify-between bg-slate-100 px-4 py-3">
                    <h4 className="text-xs font-black text-slate-800">
                      {day}. Gün
                    </h4>
                    <span className="text-[10px] font-black text-slate-500">
                      {tasks.reduce((sum, task) => sum + task.duration, 0)} dakika
                    </span>
                  </header>

                  <div className="divide-y divide-slate-100">
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => void toggleTask(task.id)}
                        className={`flex w-full items-start gap-3 p-4 text-left transition ${
                          task.completed
                            ? "bg-emerald-50"
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            task.completed
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-300"
                          }`}
                        >
                          {task.completed ? "✓" : ""}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-black text-slate-800">
                            {task.subject} — {task.outcome}
                          </span>
                          <span className="mt-1 block text-[10px] font-semibold leading-5 text-slate-500">
                            {task.activity}
                          </span>
                          <span className="mt-2 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[9px] font-black text-indigo-700">
                              <Clock3 className="h-3 w-3" />
                              {task.duration} dk
                            </span>
                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700">
                              {task.questionCount} soru
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <UserRound className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-base font-black text-slate-700">
            Mentör Modu için öğrenci planı henüz oluşturulmadı
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-xs font-semibold leading-6 text-slate-500">
            Öğrenciyi, plan süresini ve günlük çalışma süresini
            belirleyerek Gelişim Planı Oluştur butonuna basınız.
          </p>
        </section>
      )}
    </div>
  );
}
