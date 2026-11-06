import React from "react";
import {
  BarChart3,
  Cake,
  ClipboardCheck,
  Clock3,
  FileText,
  Gift,
  GraduationCap,
  Hourglass,
  MapPin,
  Megaphone,
  MessageCircle,
  PieChart,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Announcement, Classroom, Course, Student, Teacher } from "../types";
import type { PanelUser } from "../lib/accessControl";
import { sqliteStorage } from "../core/state/SyncStateStore";
import { useSchedulePersistence } from "../hooks/useSchedulePersistence";

interface DashboardProps {
  stats: any;
  students: Student[];
  teachers: Teacher[];
  courses: Course[];
  classrooms: Classroom[];
  setActiveTab: (tab: any) => void;
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  currentUser?: PanelUser;
}

type SchoolHour = { id: number; start: string; end: string };
type DutyAssignment = { id?: string; day: string; location: string; teacherName: string };
type LiveTeacher = {
  key: string;
  teacherName: string;
  branch: string;
  avatar?: string;
  className: string;
  courseName: string;
};

const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const DEFAULT_HOURS: SchoolHour[] = [
  { id: 1, start: "08:30", end: "09:10" },
  { id: 2, start: "09:20", end: "10:00" },
  { id: 3, start: "10:10", end: "10:50" },
  { id: 4, start: "11:00", end: "11:40" },
  { id: 5, start: "11:50", end: "12:30" },
  { id: 6, start: "13:15", end: "13:55" },
  { id: 7, start: "14:05", end: "14:45" },
  { id: 8, start: "14:55", end: "15:35" },
];

const toMinutes = (value: string) => {
  const [hour, minute] = String(value || "0:0").split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
};

function readTodayHours(day: string): SchoolHour[] {
  try {
    const byDay = JSON.parse(sqliteStorage.getItem("school_timetable_by_day") || "{}");
    if (Array.isArray(byDay?.[day]) && byDay[day].length) {
      return byDay[day].map((item: any, index: number) => ({
        id: Number(item.hour) || index + 1,
        start: item.start || "08:30",
        end: item.end || "09:10",
      }));
    }
    const single = JSON.parse(sqliteStorage.getItem("school_timetable") || "[]");
    if (Array.isArray(single) && single.length) {
      return single.map((item: any, index: number) => ({
        id: Number(item.hour) || index + 1,
        start: item.start || "08:30",
        end: item.end || "09:10",
      }));
    }
  } catch {
    // Varsayılan saatler kullanılır.
  }
  return DEFAULT_HOURS;
}

function parseDob(value: unknown): Date | null {
  if (!value) return null;
  const text = String(value).trim();
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;
  const parts = text.split(/[.\-/]/).map(Number);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    const year = c > 31 ? c : a;
    const month = c > 31 ? b : b;
    const day = c > 31 ? a : c;
    const parsed = new Date(year, Math.max(0, month - 1), day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export default function Dashboard({
  stats,
  students,
  teachers,
  classrooms,
  setActiveTab,
  announcements,
  currentUser,
}: DashboardProps) {
  const [now, setNow] = React.useState(new Date());
  const { scheduleData } = useSchedulePersistence(classrooms, teachers);
  const [dutyAssignments, setDutyAssignments] = React.useState<DutyAssignment[]>([]);
  const [teacherIndex, setTeacherIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const refreshDuties = () => {
      try {
        const raw = sqliteStorage.getItem("school_duty_assignments_v1");
        const parsed = raw ? JSON.parse(raw) : [];
        setDutyAssignments(Array.isArray(parsed) ? parsed : []);
      } catch {
        setDutyAssignments([]);
      }
    };
    refreshDuties();
    const timer = window.setInterval(refreshDuties, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const day = DAYS[now.getDay()];
  const todayHours = React.useMemo(() => readTodayHours(day), [day]);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const activeHour = todayHours.find((hour) => currentMinutes >= toMinutes(hour.start) && currentMinutes < toMinutes(hour.end));
  const nextHour = todayHours.find((hour) => currentMinutes < toMinutes(hour.start));
  const previousHour = [...todayHours].reverse().find((hour) => currentMinutes >= toMinutes(hour.end));
  const isBreak = !activeHour && !!nextHour && !!previousHour;
  const secondsRemaining = activeHour
    ? Math.max(0, (toMinutes(activeHour.end) - currentMinutes) * 60 - now.getSeconds())
    : nextHour
      ? Math.max(0, (toMinutes(nextHour.start) - currentMinutes) * 60 - now.getSeconds())
      : 0;
  const minutesRemaining = Math.ceil(secondsRemaining / 60);

  const lessonLabel = activeHour ? `${activeHour.id}. DERS` : isBreak ? "TENEFÜS" : nextHour ? "DERS ÖNCESİ" : "DERSLER BİTTİ";
  const lessonSubtext = activeHour
    ? `${activeHour.start} – ${activeHour.end}`
    : nextHour
      ? `${nextHour.id}. ders ${nextHour.start} saatinde başlayacak`
      : "Bugünkü eğitim programı tamamlandı";
  const countdownLabel = activeHour ? "DERSİN BİTMESİNE" : nextHour ? "DERSİN BAŞLAMASINA" : "EĞİTİM GÜNÜ";

  const liveTeachers = React.useMemo<LiveTeacher[]>(() => {
    if (!activeHour) return [];
    const result: LiveTeacher[] = [];
    const seen = new Set<string>();
    for (const cls of classrooms || []) {
      const key = `class_${cls.id}_${day}_${activeHour.id}`;
      const cell = scheduleData[key];
      const rows = cell ? (Array.isArray(cell) ? cell : [cell]) : [];
      rows.forEach((item: any, rowIndex: number) => {
        if (!item) return;
        const names = [item.teacherName, item.teacherName2].filter(Boolean);
        names.forEach((teacherName: string, teacherOrder: number) => {
          const unique = `${teacherName}|${cls.id}`.toLocaleLowerCase("tr-TR");
          if (seen.has(unique)) return;
          seen.add(unique);
          const teacher = teachers.find((t) => t.name?.toLocaleLowerCase("tr-TR") === teacherName.toLocaleLowerCase("tr-TR"));
          result.push({
            key: `${key}-${rowIndex}-${teacherOrder}`,
            teacherName,
            branch: teacher?.branch || item.courseName || "Öğretmen",
            avatar: teacher?.avatar,
            className: cls.name || String(cls.id),
            courseName: item.courseName || item.course || teacher?.branch || "Ders",
          });
        });
      });
    }
    return result;
  }, [activeHour, classrooms, day, scheduleData, teachers]);


  const activeClassLessons = React.useMemo(() => {
    if (!activeHour) return [];
    const result: any[] = [];
    (classrooms || []).forEach((cls: any) => {
      const key = `class_${cls.id}_${day}_${activeHour.id}`;
      const cell = scheduleData[key];
      const rows = cell ? (Array.isArray(cell) ? cell : [cell]) : [];
      rows.forEach((item: any, index: number) => {
        const teachersInLesson = [item?.teacherName, item?.teacherName2].filter(Boolean);
        teachersInLesson.forEach((teacherName: string) => {
          result.push({
            className: cls.name || String(cls.id),
            groupName: item?.groupName || item?.group || item?.branchGroup || "",
            courseName: item?.courseName || item?.course || "Ders",
            teacherName,
            orderName: `${cls.name || cls.id} ${item?.groupName || item?.group || ""}`,
            key: `${key}-${index}-${teacherName}`
          });
        });
      });
    });
    return result.sort((a,b) => a.orderName.localeCompare(b.orderName, "tr"));
  }, [activeHour, classrooms, day, scheduleData]);

  React.useEffect(() => {
    setTeacherIndex(0);
  }, [activeHour?.id, day, liveTeachers.length]);

  React.useEffect(() => {
    if (liveTeachers.length <= 1) return;
    const timer = window.setInterval(() => setTeacherIndex((value) => (value + 1) % liveTeachers.length), 3200);
    return () => window.clearInterval(timer);
  }, [liveTeachers.length]);

  const featuredTeacher = liveTeachers[teacherIndex % Math.max(1, liveTeachers.length)];
  const previousTeacher = liveTeachers.length > 1 ? liveTeachers[(teacherIndex - 1 + liveTeachers.length) % liveTeachers.length] : undefined;
  const nextTeacherCard = liveTeachers.length > 1 ? liveTeachers[(teacherIndex + 1) % liveTeachers.length] : undefined;

  const birthdays = React.useMemo(() => {
    return students
      .filter((student) => {
        const dob = parseDob(student.dob);
        return !!dob && dob.getDate() === now.getDate() && dob.getMonth() === now.getMonth();
      })
      .slice(0, 4);
  }, [students, now]);

  const todayDuties = React.useMemo(() => dutyAssignments.filter((item) => item.day === day).slice(0, 4), [dutyAssignments, day]);

  const quickActions = [
    { label: "Sınav Hazırla", tab: "exam-prepare", icon: ClipboardCheck, cls: "bg-[#edf4ff] text-[#3975eb]" },
    { label: "Test Paneli", tab: "test", icon: FileText, cls: "bg-[#fff0f5] text-[#ef4f8b]" },
    { label: "Anket Paneli", tab: "survey", icon: PieChart, cls: "bg-[#f4efff] text-[#7349dc]" },
    { label: "Davranış", tab: "behavior", icon: ShieldCheck, cls: "bg-[#f0f9e8] text-[#62b92d]" },
    { label: "Mesaj Gönder", tab: "messages", icon: MessageCircle, cls: "bg-[#fff7e4] text-[#f2a900]" },
    { label: "Yoklama Fişi", tab: "attendance-slip", icon: ClipboardCheck, cls: "bg-[#eaf9f8] text-[#16a6af]" },
    { label: "Raporlar", tab: "exam-reports", icon: BarChart3, cls: "bg-[#f0efff] text-[#5948d8]" },
    { label: "Ayarlar", tab: "settings", icon: Settings, cls: "bg-[#f3f5f7] text-[#85909e]" },
  ];

  const tickerItems = announcements.length
    ? announcements.map((item) => item.title ? `${item.title}: ${item.content}` : item.content)
    : ["EduPanel'e hoş geldiniz.", "Günün duyuruları bu alanda otomatik olarak yayınlanır."];

  return (
    <div id="dashboard-tab" className="edu-command-screen h-full min-h-0 w-full overflow-hidden bg-[#f7f9fc] text-[#122342]">
      <style>{`
        #dashboard-tab { height: 100%; }
        @keyframes eduTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes eduGlow { 0%,100% { opacity:.35; transform:scale(.95); } 50% { opacity:.7; transform:scale(1.04); } }
        .edu-ticker-track { animation: eduTicker 34s linear infinite; width: max-content; }
        .edu-glow { animation: eduGlow 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .edu-ticker-track,.edu-glow { animation:none !important; } }
        @media (max-height: 790px) {
          .edu-left-card { padding-top: 12px !important; padding-bottom: 12px !important; }
          .edu-live-hero { min-height: 176px !important; }
          .edu-mini-row { padding-top: 6px !important; padding-bottom: 6px !important; }
        }
      `}</style>

      <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_54px] gap-3 p-3 xl:p-4">
        <div className="grid min-h-0 gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="grid min-h-0 grid-rows-3 gap-3">
            <article className="edu-left-card relative min-h-0 overflow-hidden rounded-[26px] border border-[#dfe7ff] bg-white px-4 py-4 text-center shadow-[0_12px_28px_rgba(68,93,161,0.10)]">
              <div className="absolute -left-8 -top-8 h-24 w-28 rotate-12 rounded-[28px] bg-[#6a78eb] opacity-90" /><div className="absolute -right-10 -top-5 h-24 w-24 rotate-[22deg] rounded-[28px] bg-[#a9b7ff]/70" />
              <div className="relative mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-[#626dea] text-white shadow-lg"><Clock3 className="h-6 w-6" /></div>
              <span className="relative text-[11px] font-black tracking-[.08em] text-[#4f63e8]">ANLIK SAAT</span>
              <b className="relative mt-1 block font-mono text-[clamp(28px,3vh,40px)] font-black tracking-tight text-[#142e58]">{now.toLocaleTimeString("tr-TR")}</b>
              <span className="relative mt-1 block text-[11px] font-bold text-[#405674]">{now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span><span className="relative text-[10px] text-[#9aa6b6]">{day}</span>
            </article>

            <article className="edu-left-card relative min-h-0 overflow-hidden rounded-[26px] border border-[#ffe8b7] bg-white px-4 py-4 text-center shadow-[0_12px_28px_rgba(244,180,48,0.11)]">
              <div className="absolute -left-7 -bottom-8 h-24 w-28 -rotate-12 rounded-[28px] bg-[#ffd15a]/75" /><div className="absolute -right-10 -top-4 h-24 w-24 rotate-[20deg] rounded-[28px] bg-[#fff0b9]" />
              <div className="relative mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-[#ffba0b] text-white shadow-lg"><GraduationCap className="h-6 w-6" /></div>
              <span className="relative text-[11px] font-black tracking-[.08em] text-[#f1a300]">ŞU AN</span><b className="relative mt-1 block text-[clamp(25px,2.7vh,35px)] font-black text-[#f59b00]">{lessonLabel}</b><span className="relative mt-1 block text-[11px] font-semibold text-[#68778c]">{lessonSubtext}</span>
            </article>

            <article className="edu-left-card relative min-h-0 overflow-hidden rounded-[26px] border border-[#cbeedc] bg-white px-4 py-4 text-center shadow-[0_12px_28px_rgba(49,184,111,0.12)]">
              <div className="absolute -left-8 -bottom-8 h-24 w-28 -rotate-12 rounded-[28px] bg-[#61d49c]/70" /><div className="absolute -right-10 -top-4 h-24 w-24 rotate-[20deg] rounded-[28px] bg-[#d7f8e8]" />
              <div className="relative mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-[#31bf78] text-white shadow-lg"><Hourglass className="h-6 w-6" /></div>
              <span className="relative text-[11px] font-black tracking-[.06em] text-[#22aa68]">{countdownLabel}</span><b className="relative mt-1 block text-[clamp(25px,2.7vh,35px)] font-black text-[#24b96d]">{activeHour || nextHour ? `${minutesRemaining} DAKİKA` : "TAMAMLANDI"}</b><span className="relative mt-1 block text-[11px] font-semibold text-[#68778c]">{activeHour ? "Kalan Süre" : nextHour ? "Başlangıca kalan süre" : "Bugünkü dersler sona erdi"}</span>
            </article>
          </aside>

          <section className="grid min-h-0 grid-rows-[minmax(190px,0.9fr)_minmax(250px,1.1fr)] gap-3">
            <article className="edu-live-hero relative min-h-[190px] overflow-hidden rounded-[26px] border border-[#dcecef] bg-[#fbfefe] p-5 text-[#173159] shadow-[0_12px_30px_rgba(30,91,103,0.08)]">
              <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(circle at 82% 18%, rgba(25,153,168,.10) 0 1px, transparent 1.5px)", backgroundSize: "13px 13px" }} />
              <div className="relative z-10 flex items-center gap-2 text-[#147f8a]">
                <GraduationCap className="h-5 w-5" />
                <h2 className="text-[17px] font-black">AKTİF DERSLER</h2>
              </div>
              <div className="relative z-10 mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
                {activeClassLessons.length ? activeClassLessons.map((item:any) => (
                  <div key={item.key} className="flex items-center justify-between border-b border-[#e7eff1] py-1 text-[11px]">
                    <span className="font-black text-[#273a5a]">{item.className}{item.groupName ? ` (${item.groupName})` : ''}</span>
                    <span className="font-bold text-[#168f9a]">{item.teacherName}</span>
                  </div>
                )) : <div className="text-[11px] font-bold text-[#71869b]">Şu an aktif ders bulunamadı.</div>}
              </div>
            </article>
          </section>
        </div>


      </div>
    </div>
  );
}
