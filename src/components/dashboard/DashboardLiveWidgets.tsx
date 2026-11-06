import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  GraduationCap,
  BookOpen,
  Percent,
  TrendingUp,
  Award,
  ArrowUpRight,
  Megaphone,
  Bell,
  Activity,
  Calendar,
  Clock,
  Trash2,
  Plus,
  Pencil,
  Check,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  Cake,
  Sparkles,
  Star,
  UserCheck,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  attendanceTrends,
  gradeDistribution,
  performanceByBranch,
  initialAnnouncements,
} from "../../data";
import { Student, Teacher, Course, Announcement, Classroom } from "../../types";
import { compareClassroomNames } from "../../utils/classroomSort";
import ExecutiveDashboardHero from "./ExecutiveDashboardHero";
import RoleBasedDashboardPortal from "./RoleBasedDashboardPortal";
import type { CloudRole } from "../../core/auth";
import type { PanelUser } from "../../lib/accessControl";
import { teacherService } from "../../modules/teacher";

import { sqliteStorage } from "../../core/state/SyncStateStore";
const getTodayTimetable = () => {
  const DAYS_MAP = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const todayDayName = DAYS_MAP[new Date().getDay()];
  const queryDayName = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].includes(todayDayName)
    ? todayDayName
    : "Pazartesi";

  try {
    const savedByDay = sqliteStorage.getItem("school_timetable_by_day");
    if (savedByDay) {
      const parsed = JSON.parse(savedByDay);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const daySlots = parsed[queryDayName];
        if (daySlots && Array.isArray(daySlots) && daySlots.length > 0) {
          return daySlots.map((slot: any) => ({
            id: Number(slot?.hour) || 1,
            name: `${slot?.hour || 1}. Ders`,
            start: slot?.start || "08:30",
            end: slot?.end || "09:10",
            breakDuration: slot?.breakDuration !== undefined ? Number(slot.breakDuration) : 10
          }));
        }
      }
    }
  } catch (e) {}

  try {
    const savedSingle = sqliteStorage.getItem("school_timetable");
    if (savedSingle) {
      const parsed = JSON.parse(savedSingle);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((slot: any) => ({
          id: Number(slot?.hour) || 1,
          name: `${slot?.hour || 1}. Ders`,
          start: slot?.start || "08:30",
          end: slot?.end || "09:10",
          breakDuration: slot?.breakDuration !== undefined ? Number(slot.breakDuration) : 10
        }));
      }
    }
  } catch (e) {}

  return [
    { id: 1, name: "1. Ders", start: "08:30", end: "09:10" },
    { id: 2, name: "2. Ders", start: "09:20", end: "10:00" },
    { id: 3, name: "3. Ders", start: "10:10", end: "10:50" },
    { id: 4, name: "4. Ders", start: "11:00", end: "11:40" },
    { id: 5, name: "5. Ders", start: "11:50", end: "12:30" },
    { id: 6, name: "6. Ders", start: "13:15", end: "13:55" },
    { id: 7, name: "7. Ders", start: "14:05", end: "14:45" },
    { id: 8, name: "8. Ders", start: "14:55", end: "15:35" },
  ];
};

function timeToMins(t: any) {
  if (typeof t !== "string" || !t || !t.includes(":")) return 0;
  const parts = t.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function LessonCountdownWidget() {
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayHours = getTodayTimetable();

  // Calculate current countdown state
  const secs = currentTime.getSeconds();
  const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  
  let activeLessonNum = 1;
  let label = "";
  let minsLeft = 0;
  let secsLeft = 59 - secs;
  let progress = 0;
  let isBreak = false;

  // Real-time calculation
  let found = false;
  for (let i = 0; i < todayHours.length; i++) {
    const lesson = todayHours[i];
    const startMins = timeToMins(lesson.start);
    const endMins = timeToMins(lesson.end);

    if (currentMins >= startMins && currentMins < endMins) {
      activeLessonNum = lesson.id;
      label = `${lesson.id}. dersin bitmesine`;
      const totalDuration = endMins - startMins;
      const elapsed = currentMins - startMins;
      const elapsedSecs = elapsed * 60 + secs;
      const remainingSecs = Math.max(0, (totalDuration * 60) - elapsedSecs);
      
      minsLeft = Math.floor(remainingSecs / 60);
      secsLeft = remainingSecs % 60;
      progress = (elapsedSecs / (totalDuration * 60)) * 100;
      found = true;
      break;
    } else if (i < todayHours.length - 1) {
      // Break before next lesson
      const nextLesson = todayHours[i + 1];
      const nextStartMins = timeToMins(nextLesson.start);
      if (currentMins >= endMins && currentMins < nextStartMins) {
        activeLessonNum = nextLesson.id;
        label = "Teneffüsün sona ermesine";
        const breakDuration = nextStartMins - endMins;
        const breakElapsed = currentMins - endMins;
        const breakElapsedSecs = breakElapsed * 60 + secs;
        
        const breakRemainingSecs = Math.max(0, (breakDuration * 60) - breakElapsedSecs);

        minsLeft = Math.floor(breakRemainingSecs / 60);
        secsLeft = breakRemainingSecs % 60;
        progress = (breakElapsedSecs / (breakDuration * 60)) * 100;
        isBreak = true;
        found = true;
        break;
      }
    }
  }

  if (!found && todayHours.length > 0) {
    const firstLessonStart = timeToMins(todayHours[0].start);
    if (currentMins < firstLessonStart) {
      activeLessonNum = 1;
      label = "1. dersin başlamasına";
      const timeUntilStart = firstLessonStart - currentMins;
      const totalRemainingSecs = Math.max(0, timeUntilStart * 60 - secs);
      minsLeft = Math.floor(totalRemainingSecs / 60);
      secsLeft = totalRemainingSecs % 60;
      progress = 0;
    } else {
      activeLessonNum = todayHours[todayHours.length - 1].id;
      label = "Eğitim Günü Sona Erdi";
      minsLeft = 0;
      secsLeft = 0;
      progress = 100;
    }
  }

  const formatNum = (num: number) => num.toString().padStart(2, "0");

  const dateStr = currentTime.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const dayStr = currentTime.toLocaleDateString("tr-TR", {
    weekday: "long"
  });

  return (
    <div
      id="attendance-chart-card"
      className="bg-black border border-slate-900 shadow-2xl rounded-2xl p-4 md:p-5 flex flex-col justify-center"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center w-full">
        {/* Left Column: Date, Day, and Time */}
        <div className="md:col-span-5 flex flex-col justify-center items-center text-center py-2 gap-4 h-full">
          {/* Today's Date & Day Name side by side */}
          <div className="flex items-center gap-3 flex-wrap justify-center select-none">
            <span className="text-lg md:text-xl lg:text-2xl font-extrabold text-white tracking-tight">
              {dateStr}
            </span>
            <span className="text-lg md:text-xl lg:text-2xl font-black text-white tracking-wide uppercase">
              {dayStr}
            </span>
          </div>

          {/* Instant Clock */}
          <div className="w-full flex flex-col items-center justify-center">
            <span className="font-mono text-3xl md:text-4xl lg:text-5xl font-black text-slate-100 tracking-wider select-none">
              {formatNum(currentTime.getHours())}:{formatNum(currentTime.getMinutes())}:{formatNum(currentTime.getSeconds())}
            </span>
          </div>
        </div>

        {/* Yellow Vertical Divider */}
        <div className="h-px w-full bg-yellow-400 md:h-20 md:w-[2px] md:self-center my-0.5 md:my-0 shrink-0 opacity-85" />

        {/* Right Column: Active Lesson Countdown */}
        <div className="md:col-span-6 flex flex-col items-center justify-center py-1 w-full">
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 w-full select-none">
            <span className={`text-xs md:text-sm font-black tracking-wider uppercase border px-3 py-1.5 rounded-full select-none transition-colors shrink-0 ${
              isBreak 
                ? "text-yellow-400 bg-yellow-950/40 border-yellow-900/40 shadow-[0_0_10px_rgba(250,204,21,0.12)]" 
                : "text-red-500 bg-red-950/40 border-red-900/40 shadow-[0_0_10px_rgba(239,68,68,0.12)]"
            }`}>
              {label}
            </span>

            <div className="flex items-baseline justify-center py-0.5">
              <span className={`font-oxanium text-5xl md:text-6xl lg:text-7xl font-black tracking-wider tabular-nums select-none leading-none transition-colors ${
                isBreak 
                  ? "text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]" 
                  : "text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]"
              }`}>
                {formatNum(minsLeft)}:{formatNum(secsLeft)}
              </span>
            </div>

            <span className={`text-xs md:text-sm font-black tracking-wider uppercase border px-3 py-1.5 rounded-full select-none transition-colors shrink-0 ${
              isBreak 
                ? "text-yellow-400 bg-yellow-950/40 border-yellow-900/40 shadow-[0_0_10px_rgba(250,204,21,0.12)]" 
                : "text-red-500 bg-red-950/40 border-red-900/40 shadow-[0_0_10px_rgba(239,68,68,0.12)]"
            }`}>
              dk. var
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-2.5">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-black tracking-wide shadow-sm border ${
              isBreak 
                ? "bg-yellow-950/60 text-yellow-400 border-yellow-900/60 animate-[pulse_1.2s_infinite] shadow-[0_0_10px_rgba(234,179,8,0.2)]" 
                : "bg-emerald-950/40 text-emerald-400 border-emerald-900/40"
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBreak ? "bg-yellow-400" : "bg-emerald-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isBreak ? "bg-yellow-500" : "bg-emerald-500"}`}></span>
              </span>
              <span className={isBreak ? "animate-[pulse_0.8s_infinite] text-yellow-400 font-extrabold uppercase tracking-wider" : "uppercase text-yellow-300 text-sm md:text-[15px] font-black tracking-wider"}>
                {isBreak ? "Teneffüs Arası" : `${activeLessonNum}. Ders İşleniyor`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActiveScheduleStatusWidget({
  teachers,
  students,
}: {
  teachers: Teacher[];
  students: Student[];
}) {
  const [scheduleData, setScheduleData] = React.useState<Record<string, any>>({});
  const [classrooms, setClassrooms] = React.useState<{ id: string; name: string }[]>([]);
  const [currentTime, setCurrentTime] = React.useState(new Date());

  const [activeTab, setActiveTab] = React.useState<"classes" | "teachers">("classes");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isPlaying, setIsPlaying] = React.useState(true);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const lsClassrooms = sqliteStorage.getItem("school_classrooms");
        if (lsClassrooms) {
          setClassrooms(JSON.parse(lsClassrooms));
        } else {
          const lf = await import("../../core/state/AppStateService");
          const lfClassrooms = await lf.default.getItem<any>("school_classrooms");
          if (lfClassrooms) {
            setClassrooms(lfClassrooms);
          } else {
            const uniqueClasses = Array.from(new Set(students.map((s) => s.classroom).filter(Boolean)));
            setClassrooms(uniqueClasses.sort(compareClassroomNames).map((name) => ({ id: name, name })));
          }
        }
      } catch (e) {
        console.error(e);
      }

      try {
        const saved = sqliteStorage.getItem("scheduleData");
        if (saved) {
          setScheduleData(JSON.parse(saved));
        } else {
          const lf = await import("../../core/state/AppStateService");
          const lfSaved = await lf.default.getItem<string>("scheduleData");
          if (lfSaved) {
            setScheduleData(JSON.parse(lfSaved));
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
  }, [students]);

  // Determine current day & hour in Turkish
  const dayIndex = currentTime.getDay();
  const daysOfWeek = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const liveDay = daysOfWeek[dayIndex];

  const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  let liveHour = 1;
  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  const todayHours = getTodayTimetable();

  for (let i = 0; i < todayHours.length; i++) {
    const lesson = todayHours[i];
    const startMins = timeToMins(lesson.start);
    const endMins = timeToMins(lesson.end);
    if (currentMins >= startMins && currentMins < endMins) {
      liveHour = lesson.id;
      break;
    } else if (i < todayHours.length - 1) {
      const nextLesson = todayHours[i + 1];
      const nextStartMins = timeToMins(nextLesson.start);
      if (currentMins >= endMins && currentMins < nextStartMins) {
        liveHour = nextLesson.id;
        break;
      }
    }
  }

  if (todayHours.length > 0) {
    if (currentMins > timeToMins(todayHours[todayHours.length - 1].end)) {
      liveHour = todayHours[todayHours.length - 1].id;
    } else if (currentMins < timeToMins(todayHours[0].start)) {
      liveHour = todayHours[0].id;
    }
  }

  // Active day and hour to query
  const queryDay = DAYS.includes(liveDay) ? liveDay : "Pazartesi";
  const queryHour = liveHour;

  const validClassrooms = classrooms.filter((c) => c && c.name);

  // Generate lists for classes and teachers
  const classroomItems = React.useMemo(() => {
    return validClassrooms.map((cls) => {
      const classKey = `class_${cls.id}_${queryDay}_${queryHour}`;
      const cell = scheduleData[classKey];
      const arr = cell ? (Array.isArray(cell) ? cell : [cell]) : [];
      const activeLesson = arr[0];

      // Check if teacher(s) of this lesson are on leave
      const teacher1 = activeLesson ? activeLesson.teacherName : null;
      const teacher2 = activeLesson ? activeLesson.teacherName2 : null;
      const isTeacher1OnLeave = teacher1 
        ? teachers.some(t => t.name && t.name.toLowerCase() === teacher1.toLowerCase() && t.status === "İzinli")
        : false;
      const isTeacher2OnLeave = teacher2 
        ? teachers.some(t => t.name && t.name.toLowerCase() === teacher2.toLowerCase() && t.status === "İzinli")
        : false;
      const isLessonOnLeave = isTeacher1OnLeave || isTeacher2OnLeave;

      return {
        id: `class_${cls.id}`,
        type: "class" as const,
        label: cls.name,
        detailLabel: "Sınıfı",
        teacherName: activeLesson ? (activeLesson.teacherName || "Atanmadı") : null,
        courseName: activeLesson ? activeLesson.courseName : null,
        statusText: isLessonOnLeave
          ? "Ders Boş"
          : activeLesson 
            ? `${activeLesson.courseName} (${activeLesson.teacherName || "Atanmadı"})`
            : "Boş Ders / Serbest",
        isFilled: activeLesson && !isLessonOnLeave,
      };
    });
  }, [validClassrooms, scheduleData, queryDay, queryHour, teachers]);

  const teacherItems = React.useMemo(() => {
    return teachers.map((t) => {
      let activeLesson: { courseName: string; className: string } | null = null;
      for (const cls of validClassrooms) {
        const classKey = `class_${cls.id}_${queryDay}_${queryHour}`;
        const classCell = scheduleData[classKey];
        const classArr = classCell ? (Array.isArray(classCell) ? classCell : [classCell]) : [];
        const foundAssignment = classArr.find((item: any) => 
          item && (
            (item.teacherName && t.name && item.teacherName.toLowerCase() === t.name.toLowerCase()) ||
            (item.teacherName2 && t.name && item.teacherName2.toLowerCase() === t.name.toLowerCase())
          )
        );
        if (foundAssignment) {
          activeLesson = {
            courseName: foundAssignment.courseName,
            className: cls.name
          };
          break;
        }
      }

      // Check if teacher has ANY lesson at all today (in the entire day across hours 1 to 8)
      let hasAnyLessonToday = false;
      for (const cls of validClassrooms) {
        for (let hr = 1; hr <= 8; hr++) {
          const classKey = `class_${cls.id}_${queryDay}_${hr}`;
          const classCell = scheduleData[classKey];
          const classArr = classCell ? (Array.isArray(classCell) ? classCell : [classCell]) : [];
          const found = classArr.some((item: any) =>
            item && (
              (item.teacherName && t.name && item.teacherName.toLowerCase() === t.name.toLowerCase()) ||
              (item.teacherName2 && t.name && item.teacherName2.toLowerCase() === t.name.toLowerCase())
            )
          );
          if (found) {
            hasAnyLessonToday = true;
            break;
          }
        }
        if (hasAnyLessonToday) break;
      }

      return {
        id: `teacher_${t.id}`,
        type: "teacher" as const,
        label: t.name,
        detailLabel: t.branch,
        teacherName: t.name,
        courseName: null,
        statusText: activeLesson
          ? `${activeLesson.className} Sınıfı`
          : !hasAnyLessonToday
            ? "Tüm gün dersi yok"
            : "Dersi yok",
        isFilled: !!activeLesson,
        branch: t.branch,
      };
    });
  }, [teachers, validClassrooms, scheduleData, queryDay, queryHour]);

  const activeList = React.useMemo(() => {
    return activeTab === "classes" ? classroomItems : teacherItems;
  }, [activeTab, classroomItems, teacherItems]);

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return activeList;
    const query = searchQuery.toLowerCase();
    return activeList.filter(item => 
      item.label.toLowerCase().includes(query) ||
      item.statusText.toLowerCase().includes(query) ||
      item.detailLabel.toLowerCase().includes(query)
    );
  }, [activeList, searchQuery]);

  const itemHeight = 56;
  const gap = 10;
  const totalHeight = React.useMemo(() => {
    return filteredItems.length > 0
      ? (filteredItems.length * itemHeight + (filteredItems.length - 1) * gap + 10)
      : 0;
  }, [filteredItems]);

  const duration = React.useMemo(() => {
    const speed = 55; // pixels per second
    return totalHeight > 0 ? Math.max(3, totalHeight / speed) : 10;
  }, [totalHeight]);

  const handleTabChange = (tab: "classes" | "teachers") => {
    setActiveTab(tab);
  };

  return (
    <div
      id="live-schedule-status-card"
      className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6 flex flex-col h-full min-h-[480px] justify-between relative overflow-hidden group/card"
    >
      {/* Main scrolling viewport */}
      <div className="flex-1 relative overflow-hidden h-[420px] border border-slate-100/50 rounded-2xl bg-slate-50/20 p-4">
        {/* Ambient fade filters on top and bottom */}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />

        {/* CSS Keyframe Style for Seamless Smooth Ticker Scroll */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes liveStatusScrollUp {
            0% { transform: translateY(0); }
            100% { transform: translateY(var(--scroll-end, -100%)); }
          }
          .live-status-scroller {
            animation: liveStatusScrollUp var(--scroll-duration, 15s) linear 1;
            animation-play-state: var(--scroll-play-state, running);
          }
        `}} />

        {filteredItems.length > 0 ? (
          <div className="absolute inset-x-4 top-4 bottom-4 overflow-hidden">
            <div
              key={activeTab}
              onAnimationEnd={() => {
                if (isPlaying) {
                  handleTabChange(activeTab === "classes" ? "teachers" : "classes");
                }
              }}
              className="live-status-scroller flex flex-col gap-2.5"
              style={{
                "--scroll-end": `-${totalHeight}px`,
                "--scroll-duration": `${duration}s`,
                "--scroll-play-state": isPlaying ? "running" : "paused",
              } as React.CSSProperties}
            >
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] h-[56px] shrink-0 hover:border-indigo-150 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 border transition-colors ${
                      item.type === "class" 
                        ? "bg-indigo-50 text-indigo-700 border-indigo-100" 
                        : "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100"
                    }`}>
                      {item.type === "class" 
                        ? item.label 
                        : (item.detailLabel ? item.detailLabel.substring(0, 3).toUpperCase() : "ÖGR")
                      }
                    </div>
                    <div className="truncate min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-2.5">
                      <span className="text-sm font-black text-slate-800 shrink-0 flex items-center gap-1.5 flex-wrap">
                        {item.type === "class" ? (
                          <>
                            <span>{item.label} Sınıfı</span>
                            {item.teacherName && item.courseName && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                item.statusText === "Ders Boş"
                                  ? "bg-rose-50 text-rose-500 line-through border border-rose-100"
                                  : "bg-slate-50 text-slate-400 border border-slate-100"
                              }`}>
                                {item.teacherName} • {item.courseName}
                              </span>
                            )}
                          </>
                        ) : (
                          item.label
                        )}
                      </span>
                      <span className="text-sm font-bold truncate text-slate-500">
                        • {item.statusText}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border transition-colors ${
                      item.isFilled
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : "bg-slate-100 text-slate-400 border-slate-200/50"
                    }`}>
                      {item.isFilled 
                        ? (item.type === "class" ? "Dolu" : "Ders Var") 
                        : (item.type === "class" ? "Boş" : "Dersi Yok")
                      }
                    </span>
                    <span className="relative flex h-2 w-2">
                      {item.isFilled && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        item.isFilled ? "bg-emerald-500" : "bg-slate-300"
                      }`} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
            Arama kriterine uygun sonuç bulunamadı.
          </div>
        )}
      </div>

    </div>
  );
}

interface DashboardProps {
  stats: {
    totalStudents: number;
    activeStudents: number;
    totalTeachers: number;
    totalClasses: number;
    dailyAttendanceRate: number;
    gpaAverage: number;
  };
  students: Student[];
  teachers: Teacher[];
  courses: Course[];
  classrooms: Classroom[];
  setActiveTab: (tab: string) => void;
  setTeachers?: React.Dispatch<React.SetStateAction<Teacher[]>>;
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  currentUser?: PanelUser;
}

export const exportCardAsJPEG = async (student: any, theme: string, messageText: string, schoolName: string) => {
  const canvas = document.createElement("canvas");
  const scale = 3; // For 300 DPI equivalent quality (800*3 = 2400px width)
  canvas.width = 800 * scale;
  canvas.height = 450 * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(scale, scale);

  // Theme Definitions (Colors)
  const themes: Record<string, { bgColor: string; textColor: string; accentColor: string; frameColor: string }> = {
    "tezhib-gold": { bgColor: "#171717", textColor: "#ffffff", accentColor: "#fbbf24", frameColor: "rgba(217, 119, 6, 0.6)" },
    "tezhib-navy": { bgColor: "#0f172a", textColor: "#ffffff", accentColor: "#60a5fa", frameColor: "rgba(37, 99, 235, 0.5)" },
    "modern-minimal": { bgColor: "#ffffff", textColor: "#334155", accentColor: "#2563eb", frameColor: "#cbd5e1" },
    "modern-geometric": { bgColor: "#ffffff", textColor: "#334155", accentColor: "#ec4899", frameColor: "#f472b6" },
    "aesthetic-watercolor": { bgColor: "#f0fdfa", textColor: "#115e59", accentColor: "#0d9488", frameColor: "#2dd4bf" },
    "aesthetic-abstract": { bgColor: "#fff7ed", textColor: "#431407", accentColor: "#ea580c", frameColor: "#fb923c" },
    "simple-linen": { bgColor: "#fafaf9", textColor: "#44403c", accentColor: "#78716c", frameColor: "#a8a29e" },
    "simple-charcoal": { bgColor: "#1f2937", textColor: "#ffffff", accentColor: "#9ca3af", frameColor: "#d1d5db" },
    "vintage-paper": { bgColor: "#fef3c7", textColor: "#451a03", accentColor: "#b45309", frameColor: "#d97706" },
    "floral-soft": { bgColor: "#fff1f2", textColor: "#881337", accentColor: "#e11d48", frameColor: "#fb7185" }
  };

  const currentTheme = themes[theme] || themes["tezhib-gold"];

  // Draw Background
  ctx.fillStyle = currentTheme.bgColor;
  ctx.fillRect(0, 0, 800, 450);

  // Draw Ornamental Frame
  ctx.strokeStyle = currentTheme.frameColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 760, 410);
  ctx.lineWidth = 1;
  ctx.strokeRect(30, 30, 740, 390);

  // Custom Message
  ctx.fillStyle = currentTheme.textColor;
  ctx.font = 'italic 24px "Playfair Display", Georgia, serif';
  ctx.textAlign = "left";
  if (currentTheme.textColor === "#ffffff") {
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
  }
  
  const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const lines = text.split("\n");
    let currentY = y;
    for (let i = 0; i < lines.length; i++) {
      const words = lines[i].split(" ");
      let line = "";
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          context.fillText(line, x, currentY);
          line = words[n] + " ";
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      context.fillText(line, x, currentY);
      currentY += lineHeight;
    }
  };

  const defaultTemplate = `Sevgili, {isim}\n\nBugün {yas}. doğum gününü en içten dileklerimizle kutluyoruz! Bu yeni yaşında da hayallerinin peşinden cesaretle koş. Hayallerine doğru attığın her adımda seni destekliyor, başarılarının artarak devam etmesini diliyoruz. Yeni yaşın sana ve ailene mutluluk, sağlık getirsin.`;
  const template = messageText || defaultTemplate;
  const finalMessage = template
    .replace(/{isim}/g, student.name)
    .replace(/{yas}/g, String(student.age || ""));

  wrapText(ctx, finalMessage, 60, 100, 680, 32);
  
  ctx.shadowColor = "transparent";

  // Footer info
  ctx.fillStyle = currentTheme.accentColor;
  ctx.font = 'italic bold 22px "Playfair Display", Georgia, serif';
  ctx.textAlign = "center";
  ctx.fillText(`${schoolName} Öğretmenleri`, 400, 410);

  // Trigger download
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `${student.id}.jpg`;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
      });
  } catch (err) {
    console.error("Kart JPEG oluşturma hatası:", err);
  }
};



