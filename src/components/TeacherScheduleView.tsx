import React from "react";
import {
  ArrowLeft,
  BellRing,
  CalendarDays,
  Check,
  Loader2,
  NotebookPen,
  X,
} from "lucide-react";

type Assignment = {
  classroomId?: string;
  classroomName: string;
  courseName: string;
};

type LessonSlot = {
  hour: number;
  start: string;
  end: string;
  assignment: Assignment | null;
};

type ScheduleNote = {
  id: string;
  text: string;
  sourceDay: string;
  sourceHour: number;
  reminderDay: string;
  reminderHour: number;
  reminderDate: string;
};

type TeacherSchedule = {
  now: { date: string; day: string; time: string };
  active: {
    active: boolean;
    currentLesson?: number;
    courseName?: string;
    classroomName?: string;
    startTime?: string;
    endTime?: string;
  };
  days: Array<{ day: string; slots: LessonSlot[]; isDutyDay?: boolean; dutyLocations?: string[] }>;
  notes: ScheduleNote[];
  reminders: Array<{ id: string; text: string; reminderDay: string; reminderHour: number }>;
};

const addMinutesToTime = (value: string, minutes: number) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const total = (Number(match[1]) * 60 + Number(match[2]) + minutes) % (24 * 60);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    // Mobil öğretmen ekranı public token ile çalışır; büyük oturum cookie'leri
    // gönderilmez. Bu özellikle 431 Request Header Fields Too Large hatasını önler.
    credentials: "omit",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(String(body?.error || `Sunucu hatası (${response.status})`));
  }
  return response.json() as Promise<T>;
};

export default function TeacherScheduleView({
  token,
  teacherName,
  onBack,
}: {
  token: string;
  teacherName: string;
  onBack: () => void;
}) {
  const [schedule, setSchedule] = React.useState<TeacherSchedule | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [noteTarget, setNoteTarget] = React.useState<{ day: string; slot: LessonSlot } | null>(null);
  const [noteText, setNoteText] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);
  const [noteError, setNoteError] = React.useState("");
  const longPressTimer = React.useRef<number | null>(null);
  const dayScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const swipeStartXRef = React.useRef<number | null>(null);
  const swipeStartDayIndexRef = React.useRef(0);
  const mouseDragStartScrollLeftRef = React.useRef(0);
  const [visibleDayIndex, setVisibleDayIndex] = React.useState(0);
  const [viewMode, setViewMode] = React.useState<"daily" | "weekly">("daily");

  const loadSchedule = React.useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const value = await requestJson<TeacherSchedule>(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/schedule`,
      );
      setSchedule(value);
      setError("");
    } catch (reason: any) {
      setError(reason?.message || "Ders programı alınamadı.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void loadSchedule();
    const interval = window.setInterval(() => void loadSchedule(true), 30_000);
    return () => window.clearInterval(interval);
  }, [loadSchedule]);

  React.useEffect(() => () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
  }, []);

  React.useEffect(() => {
    if (!schedule?.days.length) return;
    const todayIndex = Math.max(0, schedule.days.findIndex((item) => item.day === schedule.now.day));
    setVisibleDayIndex(todayIndex);
    const frame = window.requestAnimationFrame(() => {
      const scroller = dayScrollerRef.current;
      if (!scroller) return;
      scroller.scrollTo({ left: scroller.clientWidth * todayIndex, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [schedule?.now.day, schedule?.days.length]);

  const syncVisibleDay = () => {
    const scroller = dayScrollerRef.current;
    if (!scroller || !schedule?.days.length || scroller.clientWidth <= 0) return;
    const nextIndex = Math.max(
      0,
      Math.min(schedule.days.length - 1, Math.round(scroller.scrollLeft / scroller.clientWidth)),
    );
    setVisibleDayIndex(nextIndex);
  };

  const handleDayTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const scroller = dayScrollerRef.current;
    if (!scroller || !schedule?.days.length) return;
    swipeStartXRef.current = event.touches[0]?.clientX ?? null;
    swipeStartDayIndexRef.current = Math.max(
      0,
      Math.min(schedule.days.length - 1, Math.round(scroller.scrollLeft / Math.max(scroller.clientWidth, 1))),
    );
  };

  const handleDayTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const scroller = dayScrollerRef.current;
    if (!scroller || !schedule?.days.length || swipeStartXRef.current == null) return;

    const endX = event.changedTouches[0]?.clientX ?? swipeStartXRef.current;
    const deltaX = endX - swipeStartXRef.current;
    const startIndex = swipeStartDayIndexRef.current;
    swipeStartXRef.current = null;

    let targetIndex = startIndex;
    if (Math.abs(deltaX) >= 35) {
      targetIndex = deltaX < 0 ? startIndex + 1 : startIndex - 1;
    }

    targetIndex = Math.max(0, Math.min(schedule.days.length - 1, targetIndex));
    setVisibleDayIndex(targetIndex);

  };

  const clearLongPress = () => {
    if (longPressTimer.current === null) return;
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const beginLongPress = (day: string, slot: LessonSlot) => {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      setNoteTarget({ day, slot });
      setNoteText("");
      setNoteError("");
    }, 1000);
  };

  const saveNote = async () => {
    if (!noteTarget || !noteText.trim()) return;
    setSavingNote(true);
    setNoteError("");
    try {
      await requestJson(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/schedule/notes`,
        {
          method: "POST",
          body: JSON.stringify({
            day: noteTarget.day,
            hour: noteTarget.slot.hour,
            text: noteText.trim(),
          }),
        },
      );
      setNoteTarget(null);
      setNoteText("");
      await loadSchedule(true);
    } catch (reason: any) {
      setNoteError(reason?.message || "Not kaydedilemedi.");
    } finally {
      setSavingNote(false);
    }
  };

  const dismissReminder = async (noteId: string) => {
    try {
      await requestJson(
        `/api/behavior/teacher-links/${encodeURIComponent(token)}/schedule/notes/${encodeURIComponent(noteId)}/dismiss`,
        { method: "POST" },
      );
      await loadSchedule(true);
    } catch (reason: any) {
      setError(reason?.message || "Hatırlatma kapatılamadı.");
    }
  };

  const isActive = (day: string, hour: number) =>
    Boolean(schedule?.active.active)
    && schedule?.now.day === day
    && Number(schedule?.active.currentLesson) === hour;

  const notesFor = (day: string, hour: number) =>
    schedule?.notes.filter((note) => note.sourceDay === day && note.sourceHour === hour) || [];

  const renderSlot = (day: string, slot: LessonSlot) => {
    const active = isActive(day, slot.hour);
    const notes = notesFor(day, slot.hour);
    const lessonEnd = addMinutesToTime(slot.start, 40);

    const openNote = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      clearLongPress();
      setNoteTarget({ day, slot });
      setNoteText("");
      setNoteError("");
    };

    return (
      <div
        key={`${day}-${slot.hour}`}
        onPointerDown={() => beginLongPress(day, slot)}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onContextMenu={(event) => event.preventDefault()}
        className={`relative grid min-h-0 w-full select-none grid-cols-[58px_minmax(0,1fr)_58px] items-center gap-2 border px-2.5 py-1 text-left ${
          slot.assignment
            ? active
              ? "border-emerald-500 bg-yellow-200 text-slate-900 ring-1 ring-emerald-500"
              : "border-yellow-300 bg-yellow-100 text-slate-900"
            : "border-slate-300 bg-slate-200 text-slate-600"
        }`}
      >
        <div className="min-w-0">
          <span className={`block text-[10px] font-black ${active ? "text-emerald-800" : "text-slate-600"}`}>
            {slot.hour}. DERS
          </span>
          <span className={`mt-0.5 block text-[9px] font-bold leading-3 ${active ? "text-emerald-700" : "text-slate-500"}`}>
            {slot.start}
          </span>
          <span className={`block text-[9px] font-bold leading-3 ${active ? "text-emerald-700" : "text-slate-500"}`}>
            {lessonEnd}
          </span>
        </div>

        <div className="min-w-0">
          {slot.assignment ? (
            <>
              <strong className="block truncate text-[12px] font-black leading-4">
                {slot.assignment.courseName || "Ders"}
              </strong>
              <span className={`mt-0.5 block truncate text-[10px] font-bold ${active ? "text-emerald-800" : "text-slate-500"}`}>
                {slot.assignment.classroomName || "Sınıf bilgisi yok"}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex min-w-0 justify-end">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={openNote}
            className={`inline-flex min-h-8 min-w-[50px] items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black transition active:scale-95 ${
              active
                ? "border-emerald-300 bg-white text-emerald-800"
                : "border-slate-300 bg-white/90 text-slate-700"
            }`}
            aria-label={`${slot.hour}. ders için not al`}
          >
            <NotebookPen className="h-3.5 w-3.5" />
            <span>Not al</span>
          </button>
        </div>

        {notes.length > 0 && (
          <span className={`absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full ${active ? "bg-white text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            <NotebookPen className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
    );
  };

  const visibleDay = schedule?.days[visibleDayIndex];
  const maxLessonCount = Math.max(
    0,
    ...(schedule?.days || []).map((day) => Array.isArray(day.slots) ? day.slots.length : 0),
  );
  const lessonHours = Array.from(
    { length: Math.min(Math.max(maxLessonCount, 8), 12) },
    (_, index) => index + 1,
  ).filter((hour) =>
    (schedule?.days || []).some((day) =>
      day.slots?.some(
        (slot) =>
          Number(slot.hour) === hour &&
          !String((slot as any)?.label || (slot as any)?.name || "")
            .toLocaleUpperCase("tr-TR")
            .includes("ARA"),
      ),
    ),
  );

  const dayShort = (day: string) => {
    const map: Record<string, string> = {
      Pazartesi: "Pzt",
      Salı: "Sal",
      Çarşamba: "Çar",
      Perşembe: "Per",
      Cuma: "Cum",
    };
    return map[day] || day.slice(0, 3);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50/45 to-white text-slate-900">
      <div className="mx-auto min-h-screen w-full max-w-5xl bg-indigo-50/30">
        <header className="border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
              aria-label="Geri"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-black tracking-tight text-slate-950">
                  Ders Programı
                </h1>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                  {teacherName}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${
                viewMode === "daily"
                  ? "bg-white text-violet-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500"
              }`}
            >
              Günlük
            </button>
            <button
              type="button"
              onClick={() => setViewMode("weekly")}
              className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${
                viewMode === "weekly"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Haftalık
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-3 mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-[10px] font-bold text-rose-700">
            {error}
          </div>
        )}

        {loading && !schedule ? (
          <div className="flex min-h-[340px] items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Ders programı yükleniyor…
          </div>
        ) : schedule ? (
          <div>
            {schedule.reminders.length > 0 && (
              <div className="px-3 pt-2">
                {schedule.reminders.slice(0, 1).map((reminder) => (
                  <section key={reminder.id} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 shrink-0 text-amber-700" />
                      <p className="min-w-0 flex-1 truncate text-[10px] font-bold text-amber-900">
                        {reminder.text}
                      </p>
                      <button
                        type="button"
                        onClick={() => void dismissReminder(reminder.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-700 text-white"
                        aria-label="Hatırlatmayı tamamla"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </section>
                ))}
              </div>
            )}

            {viewMode === "daily" ? (
              <div>
                <div className="flex items-center justify-between px-3 pb-2 pt-3">
                  <div>
                    <h2 className="text-sm font-black text-red-600">
                      {visibleDay?.day || schedule.now.day}
                    </h2>
                    <p className="text-[9px] font-bold text-slate-400">
                      Sağa veya sola kaydırarak gün değiştirin
                    </p>
                    {visibleDay?.isDutyDay && (
                      <p className="mt-1 inline-flex rounded-full bg-pink-100 px-2 py-0.5 text-[9px] font-black text-pink-700">
                        Nöbet günü
                        {visibleDay.dutyLocations?.length
                          ? ` · ${visibleDay.dutyLocations.join(", ")}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-500">
                    Ders notları için “Not al”
                  </span>
                </div>

                <div
                  ref={dayScrollerRef}
                  onScroll={syncVisibleDay}
                  onTouchStart={handleDayTouchStart}
                  onTouchEnd={handleDayTouchEnd}
                  onPointerDown={(event) => {
                    if (event.pointerType !== "mouse" || event.button !== 0) return;
                    const scroller = dayScrollerRef.current;
                    if (!scroller) return;
                    swipeStartXRef.current = event.clientX;
                    mouseDragStartScrollLeftRef.current = scroller.scrollLeft;
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (event.pointerType !== "mouse" || swipeStartXRef.current == null) return;
                    const scroller = dayScrollerRef.current;
                    if (!scroller) return;
                    const deltaX = event.clientX - swipeStartXRef.current;
                    scroller.scrollLeft = mouseDragStartScrollLeftRef.current - deltaX;
                  }}
                  onPointerUp={(event) => {
                    if (event.pointerType !== "mouse" || swipeStartXRef.current == null) return;
                    const scroller = dayScrollerRef.current;
                    swipeStartXRef.current = null;
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                    if (!scroller || !schedule?.days.length || scroller.clientWidth <= 0) return;
                    const targetIndex = Math.max(
                      0,
                      Math.min(schedule.days.length - 1, Math.round(scroller.scrollLeft / scroller.clientWidth)),
                    );
                    setVisibleDayIndex(targetIndex);
                    scroller.scrollTo({ left: scroller.clientWidth * targetIndex, behavior: "smooth" });
                  }}
                  onPointerCancel={() => { swipeStartXRef.current = null; }}
                  className="flex cursor-grab snap-x snap-mandatory overflow-x-auto overscroll-x-none active:cursor-grabbing"
                  style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
                >
                  {schedule.days.map((item) => (
                    <section
                      key={item.day}
                      className={`w-full shrink-0 snap-center snap-always px-3 pb-3 ${
                        item.isDutyDay ? "bg-pink-50" : "bg-white"
                      }`}
                    >
                      <div className="space-y-1.5">
                        {item.slots.slice(0, 12).map((slot) => renderSlot(item.day, slot))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="flex justify-center gap-1.5 pb-3">
                  {schedule.days.map((item, index) => (
                    <span
                      key={item.day}
                      className={`h-1.5 rounded-full transition-all ${
                        index === visibleDayIndex
                          ? "w-5 bg-indigo-700"
                          : "w-1.5 bg-slate-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <section className="px-3 py-3 sm:px-5 sm:py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Haftalık Program</h2>
                    <p className="text-[9px] font-bold text-slate-400">
                      Pazartesi–Cuma · tüm dersler tek ekranda
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[8px] font-black text-slate-500 shadow-sm">
                    Kaydırma yok
                  </span>
                </div>

                <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_6px_22px_rgba(15,23,42,0.05)]">
                  <div
                    className="grid w-full"
                    style={{
                      gridTemplateColumns: `62px repeat(5, minmax(0, 1fr))`,
                    }}
                  >
                    <div className="flex h-12 items-center justify-center border-b border-r border-slate-200 bg-slate-50 px-1 text-[7px] font-black text-slate-600">
                      SAAT
                    </div>

                    {schedule.days.slice(0, 5).map((day) => (
                      <div
                        key={`day-head-${day.day}`}
                        className={`flex h-12 min-w-0 flex-col items-center justify-center border-b border-r border-slate-200 px-0.5 text-center ${
                          schedule.now.day === day.day
                            ? "bg-violet-50 text-violet-700"
                            : day.isDutyDay
                              ? "bg-pink-50 text-pink-700"
                              : "bg-white text-slate-700"
                        }`}
                      >
                        <strong className="text-[8px] font-black leading-none">{dayShort(day.day)}</strong>
                        <span className="mt-1 text-[6px] font-semibold opacity-70">{day.day}</span>
                        {day.isDutyDay ? (
                          <span className="mt-0.5 text-[4.8px] font-black">NÖBET</span>
                        ) : null}
                      </div>
                    ))}

                    {lessonHours.map((hour) => {
                      const sample = schedule.days.find((day) => day.slots?.find((slot) => Number(slot.hour) === hour))
                        ?.slots?.find((slot) => Number(slot.hour) === hour);

                      return (
                        <React.Fragment key={`row-${hour}`}>
                          <div className="flex min-h-[58px] min-w-0 flex-col items-center justify-center border-b border-r border-slate-200 bg-white px-0.5 text-center">
                            <strong className="text-[7px] font-black text-slate-800">{hour}. Ders</strong>
                            {sample ? (
                              <span className="mt-0.5 text-[5.5px] font-bold leading-none text-slate-400">
                                {sample.start}–{sample.end}
                              </span>
                            ) : null}
                          </div>

                          {schedule.days.slice(0, 5).map((day) => {
                            const slot = day.slots?.find((item) => Number(item.hour) === hour);
                            const active =
                              schedule.now.day === day.day &&
                              Number(schedule.active.currentLesson) === hour &&
                              schedule.active.active;

                            return (
                              <button
                                key={`${day.day}-${hour}`}
                                type="button"
                                disabled={!slot}
                                onClick={() => slot && setNoteTarget({ day: day.day, slot })}
                                className={`min-h-[58px] min-w-0 overflow-hidden border-b border-r border-slate-200 p-1.5 text-left ${
                                  slot?.assignment
                                    ? active
                                      ? "bg-emerald-100 ring-1 ring-inset ring-emerald-400"
                                      : day.day === "Pazartesi"
                                        ? "bg-sky-50"
                                        : day.day === "Salı"
                                          ? "bg-violet-50"
                                          : day.day === "Çarşamba"
                                            ? "bg-emerald-50"
                                            : day.day === "Perşembe"
                                              ? "bg-amber-50"
                                              : "bg-rose-50"
                                    : "bg-white"
                                }`}
                              >
                                {slot?.assignment ? (
                                  <div className="flex h-full flex-col justify-center">
                                    <strong className="line-clamp-3 break-words text-[6.8px] font-black leading-[8px] text-slate-900">
                                      {slot.assignment.courseName || "Ders"}
                                    </strong>
                                    <span className="mt-0.5 line-clamp-2 break-words text-[5.5px] font-bold leading-[7px] text-slate-500">
                                      {slot.assignment.classroomName || "Sınıf"}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="flex h-full items-center justify-center text-[7px] font-bold text-slate-300">
                                    —
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </div>
        ) : null}
      </div>

      {noteTarget && (
        <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <section className="w-full max-w-md bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-[.16em] text-indigo-700">Ders Notu</span><h2 className="mt-1 text-lg font-black text-slate-950">{noteTarget.day} · {noteTarget.slot.hour}. Ders</h2><p className="mt-1 text-xs font-bold text-slate-500">{noteTarget.slot.assignment?.courseName || "Ders saati"} · {noteTarget.slot.assignment?.classroomName || ""}</p></div><button type="button" onClick={() => setNoteTarget(null)} className="flex h-9 w-9 items-center justify-center bg-slate-100 text-slate-600" aria-label="Not eklemeyi kapat"><X className="h-4 w-4" /></button></div>
            <p className="mt-4 text-xs leading-5 text-slate-600">Notunuz, programdaki bir sonraki dersiniz başladığında size hatırlatılır.</p>
            <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} maxLength={1000} autoFocus placeholder="Hatırlatılmasını istediğiniz notu yazın…" className="mt-4 min-h-32 w-full border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            {noteError && <p className="mt-2 text-xs font-bold text-rose-700">{noteError}</p>}
            <button type="button" disabled={savingNote || !noteText.trim()} onClick={() => void saveNote()} className="mt-4 flex w-full items-center justify-center gap-2 bg-indigo-700 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"><NotebookPen className="h-4 w-4" />{savingNote ? "Kaydediliyor…" : "Notu Kaydet"}</button>
          </section>
        </div>
      )}
    </main>
  );
}
