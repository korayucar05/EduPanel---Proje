import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Bell,
  Clock,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Type,
  FileText,
  Download,
  Upload,
  Users,
  School,
  X,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  isWithinInterval,
  parseISO,
  differenceInDays,
} from "date-fns";
import { tr } from "date-fns/locale";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";

import { sqliteStorage } from "../core/state/SyncStateStore";
type EventType = "toplantı" | "etkinlik" | "hatırlatma" | "diğer";
type PlanCategory =
  | "MEB Yıllık Çalışma Planı"
  | "Okul İdari Çalışma Planı"
  | "Rehberlik Yıllık Çalışma Planı"
  | "Eğitsel Faaliyetler"
  | "Hatırlatmalar";

interface AcademicEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  category: PlanCategory;
  startDate: string;
  endDate: string;
  priority: boolean;
  reminderLeadDays: number;
  completed: boolean;
  stopReminding: boolean;
  responsibleMembers: string[];
  clubName?: string;
}

type StaffMember = {
  id?: string;
  name: string;
  branch?: string;
};

type ClubRecord = {
  id?: string;
  name: string;
  responsibleTeachers: string[];
  raw?: any;
};

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  toplantı: "bg-blue-500",
  etkinlik: "bg-purple-500",
  hatırlatma: "bg-amber-500",
  diğer: "bg-slate-500",
};

const PLAN_CATEGORIES: PlanCategory[] = [
  "MEB Yıllık Çalışma Planı",
  "Okul İdari Çalışma Planı",
  "Rehberlik Yıllık Çalışma Planı",
  "Eğitsel Faaliyetler",
  "Hatırlatmalar",
];

const MONTH_COLORS: Record<number, { weekday: string; weekend: string; text: string; ring: string }> = {
  0: { weekday: "bg-sky-50", weekend: "bg-sky-100", text: "text-sky-900", ring: "ring-sky-200" },
  1: { weekday: "bg-indigo-50", weekend: "bg-indigo-100", text: "text-indigo-900", ring: "ring-indigo-200" },
  2: { weekday: "bg-emerald-50", weekend: "bg-emerald-100", text: "text-emerald-900", ring: "ring-emerald-200" },
  3: { weekday: "bg-lime-50", weekend: "bg-lime-100", text: "text-lime-900", ring: "ring-lime-200" },
  4: { weekday: "bg-yellow-50", weekend: "bg-yellow-100", text: "text-yellow-900", ring: "ring-yellow-200" },
  5: { weekday: "bg-orange-50", weekend: "bg-orange-100", text: "text-orange-900", ring: "ring-orange-200" },
  6: { weekday: "bg-rose-50", weekend: "bg-rose-100", text: "text-rose-900", ring: "ring-rose-200" },
  7: { weekday: "bg-pink-50", weekend: "bg-pink-100", text: "text-pink-900", ring: "ring-pink-200" },
  8: { weekday: "bg-violet-50", weekend: "bg-violet-100", text: "text-violet-900", ring: "ring-violet-200" },
  9: { weekday: "bg-purple-50", weekend: "bg-purple-100", text: "text-purple-900", ring: "ring-purple-200" },
  10: { weekday: "bg-cyan-50", weekend: "bg-cyan-100", text: "text-cyan-900", ring: "ring-cyan-200" },
  11: { weekday: "bg-slate-50", weekend: "bg-slate-200", text: "text-slate-900", ring: "ring-slate-200" },
};

const normalizeName = (value: any) => String(value || "").trim();

const extractStaffName = (raw: any): string =>
  normalizeName(raw?.fullName || raw?.name || raw?.teacherName || raw?.displayName || raw?.title);

const readArrayFromLocalStorage = (keys: string[]): any[] => {
  for (const key of keys) {
    try {
      const saved = sqliteStorage.getItem(key);
      if (!saved) continue;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.items)) return parsed.items;
      if (Array.isArray(parsed?.data)) return parsed.data;
    } catch {
      // ignore
    }
  }
  return [];
};

const resolveTeacherNamesFromClub = (club: any, staff: StaffMember[]): string[] => {
  const rawValues = [
    club?.responsibleTeachers,
    club?.teacherNames,
    club?.teachers,
    club?.advisorTeachers,
    club?.advisorTeacherNames,
    club?.teacherIds,
    club?.advisorTeacherIds,
    club?.advisorTeacherName,
    club?.teacherName,
    club?.responsibleTeacher,
  ].filter(Boolean);

  const names: string[] = [];

  rawValues.forEach((value) => {
    const list = Array.isArray(value) ? value : [value];
    list.forEach((item: any) => {
      if (!item) return;
      if (typeof item === "string") {
        const byId = staff.find((s) => s.id && s.id === item);
        names.push(byId?.name || item);
        return;
      }
      const name = extractStaffName(item);
      if (name) names.push(name);
      else if (item?.id) {
        const byId = staff.find((s) => s.id === item.id);
        if (byId?.name) names.push(byId.name);
      }
    });
  });

  return Array.from(new Set(names.map(normalizeName).filter(Boolean)));
};

const loadStaff = (): StaffMember[] => {
  const raw = readArrayFromLocalStorage(["teachers", "staff", "school_staff"]);
  return raw
    .map((item: any) => ({
      id: item?.id || item?.teacherId,
      name: extractStaffName(item),
      branch: item?.branch || item?.department || "",
    }))
    .filter((item) => item.name);
};

const loadClubs = (staff: StaffMember[]): ClubRecord[] => {
  const raw = readArrayFromLocalStorage(["clubs", "school_clubs", "student_clubs", "clubData", "social_clubs"]);
  return raw
    .map((item: any) => ({
      id: item?.id || item?.clubId,
      name: normalizeName(item?.name || item?.clubName || item?.title || item?.activityName),
      responsibleTeachers: resolveTeacherNamesFromClub(item, staff),
      raw: item,
    }))
    .filter((item) => item.name);
};

export default function AcademicCalendarModule() {
  const [events, setEvents] = useState<AcademicEvent[]>(() => {
    const saved = sqliteStorage.getItem("academic_events");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      const uniqueEvents = Array.from(new Map(parsed.map((e: any) => [e.id, e])).values());
      return uniqueEvents as AcademicEvent[];
    } catch {
      return [];
    }
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"aylık" | "haftalık" | "günlük">("aylık");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AcademicEvent | null>(null);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [tempStaffName, setTempStaffName] = useState("");

  const [availableStaff] = useState<StaffMember[]>(() => loadStaff());
  const [availableClubs] = useState<ClubRecord[]>(() => loadClubs(loadStaff()));

  const [formData, setFormData] = useState<Omit<AcademicEvent, "id">>({
    title: "",
    description: "",
    type: "toplantı",
    category: "MEB Yıllık Çalışma Planı",
    startDate: format(new Date(), "yyyy-MM-dd'T'09:00"),
    endDate: format(new Date(), "yyyy-MM-dd'T'17:00"),
    priority: false,
    reminderLeadDays: 3,
    completed: false,
    stopReminding: false,
    responsibleMembers: [],
    clubName: "",
  });

  useEffect(() => {
    const syncHolidays = () => {
      const year = currentDate.getFullYear();
      const yearsToSync = [year, year + 1];
      const holidayTemplates = [
        { date: "01-01", title: "Yılbaşı" },
        { date: "04-23", title: "Ulusal Egemenlik ve Çocuk Bayramı" },
        { date: "05-01", title: "Emek ve Dayanışma Günü" },
        { date: "05-19", title: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
        { date: "07-15", title: "Demokrasi ve Milli Birlik Günü" },
        { date: "08-30", title: "Zafer Bayramı" },
        { date: "10-29", title: "Cumhuriyet Bayramı" },
      ];

      const holidayEvents: AcademicEvent[] = [];
      yearsToSync.forEach((y) => {
        holidayTemplates.forEach((t) => {
          const slug = t.title
            .toLocaleLowerCase("tr-TR")
            .replace(/[ıİ]/g, "i")
            .replace(/[öÖ]/g, "o")
            .replace(/[üÜ]/g, "u")
            .replace(/[çÇ]/g, "c")
            .replace(/[şŞ]/g, "s")
            .replace(/[ğĞ]/g, "g")
            .replace(/\s+/g, "-");
          holidayEvents.push({
            id: `holiday-${slug}-${y}`,
            title: `🇹🇷 ${t.title}`,
            description: "Resmi tatil ve ulusal bayram kutlaması.",
            type: "etkinlik",
            category: "MEB Yıllık Çalışma Planı",
            startDate: `${y}-${t.date}T00:00`,
            endDate: `${y}-${t.date}T23:59`,
            priority: true,
            reminderLeadDays: 7,
            completed: false,
            stopReminding: false,
            responsibleMembers: ["Okul Yönetimi"],
          });
        });
      });

      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const trulyNew = holidayEvents.filter((he) => !existingIds.has(he.id));
        if (trulyNew.length === 0) return prev;
        const combined = [...prev, ...trulyNew];
        return Array.from(new Map(combined.map((e) => [e.id, e])).values());
      });
    };

    syncHolidays();

    const handleStorageChange = () => {
      const saved = sqliteStorage.getItem("academic_events");
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved);
        const uniqueEvents = Array.from(new Map(parsed.map((e: any) => [e.id, e])).values());
        setEvents(uniqueEvents as AcademicEvent[]);
      } catch {
        // ignore
      }
    };

    window.addEventListener("academic_events_updated", handleStorageChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("academic_events_updated", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [currentDate.getFullYear()]);

  useEffect(() => {
    const currentSaved = sqliteStorage.getItem("academic_events") || "[]";
    const currentString = JSON.stringify(events);
    if (currentSaved !== currentString) {
      sqliteStorage.setItem("academic_events", currentString);
      window.dispatchEvent(new Event("academic_events_updated"));
    }
  }, [events]);

  const activeReminders = useMemo(() => {
    const now = startOfDay(new Date());
    return events
      .filter((e) => {
        if (e.completed || e.stopReminding) return false;
        const start = startOfDay(parseISO(e.startDate));
        const end = endOfDay(parseISO(e.endDate));
        if (now > end) return false;
        const reminderStart = subDays(start, e.reminderLeadDays || 3);
        return now >= reminderStart && now <= end;
      })
      .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
  }, [events]);

  const daysInCurrentView = useMemo(() => {
    if (view === "aylık") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(monthStart);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
    if (view === "haftalık") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
    return [currentDate];
  }, [currentDate, view]);

  const resetFormForDate = (date: Date) => {
    setEditingEvent(null);
    setFormData({
      title: "",
      description: "",
      type: "toplantı",
      category: "MEB Yıllık Çalışma Planı",
      startDate: format(date, "yyyy-MM-dd'T'09:00"),
      endDate: format(date, "yyyy-MM-dd'T'17:00"),
      priority: false,
      reminderLeadDays: 3,
      completed: false,
      stopReminding: false,
      responsibleMembers: [],
      clubName: "",
    });
    setTempStaffName("");
  };

  const openAddModalForDate = (date: Date) => {
    resetFormForDate(date);
    setIsAddModalOpen(true);
  };

  const openEditModal = (event: AcademicEvent) => {
    setEditingEvent(event);
    setFormData({ ...event, clubName: event.clubName || "" });
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingEvent(null);
    resetFormForDate(currentDate);
  };

  const handleCategoryChange = (category: PlanCategory) => {
    if (category === "Eğitsel Faaliyetler") {
      const firstClub = availableClubs[0];
      setFormData((prev) => ({
        ...prev,
        category,
        type: "etkinlik",
        clubName: firstClub?.name || "",
        responsibleMembers: firstClub?.responsibleTeachers || [],
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, category, type: "toplantı", clubName: "", responsibleMembers: [] }));
  };

  const handleClubChange = (clubName: string) => {
    const club = availableClubs.find((item) => item.name === clubName);
    setFormData((prev) => ({
      ...prev,
      clubName,
      responsibleMembers: club?.responsibleTeachers || [],
    }));
  };

  const addResponsibleMember = (name: string) => {
    const clean = normalizeName(name);
    if (!clean || formData.responsibleMembers.includes(clean)) return;
    setFormData((prev) => ({ ...prev, responsibleMembers: [...prev.responsibleMembers, clean] }));
    setTempStaffName("");
  };

  const removeResponsibleMember = (name: string) => {
    setFormData((prev) => ({ ...prev, responsibleMembers: prev.responsibleMembers.filter((m) => m !== name) }));
  };

  const handleAddOrUpdateEvent = () => {
    if (!formData.title.trim()) return;
    const normalizedStartDate = formData.startDate.includes("T") ? formData.startDate : `${formData.startDate}T09:00`;
    const normalizedEndDate = formData.endDate.includes("T") ? formData.endDate : `${formData.endDate}T17:00`;

    const finalFormData = {
      ...formData,
      title: formData.title.trim(),
      description: formData.description.trim(),
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      reminderLeadDays: 3,
      priority: formData.category === "Eğitsel Faaliyetler" ? false : formData.priority,
      clubName: formData.category === "Eğitsel Faaliyetler" ? formData.clubName : "",
    };

    if (editingEvent) {
      setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? { ...finalFormData, id: e.id } : e)));
    } else {
      setEvents((prev) => [...prev, { ...finalFormData, id: Math.random().toString(36).substring(2, 9) }]);
    }
    closeModal();
  };

  const deleteEvent = (id: string) => {
    if (window.confirm("Bu planı silmek istediğinize emin misiniz?")) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const toggleComplete = (id: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e)));
  };

  const toggleStopReminding = (id: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, stopReminding: !e.stopReminding } : e)));
  };

  const downloadExcelTemplate = () => {
    const templateData = [
      {
        Başlık: "Örnek Plan Başlığı",
        Açıklama: "Plan açıklaması buraya gelecek",
        "Plan Türü": "Okul İdari Çalışma Planı",
        "Kulüp Adı": "",
        "Başlangıç Tarihi (YYYY-MM-DD HH:mm)": format(new Date(), "yyyy-MM-dd 09:00"),
        "Bitiş Tarihi (YYYY-MM-DD HH:mm)": format(new Date(), "yyyy-MM-dd 17:00"),
        "Sorumlu Kişiler (Virgülle Ayırın)": "Ali Yılmaz, Ayşe Demir",
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plan Taslağı");
    XLSX.writeFile(workbook, "Akademik_Takvim_Sablonu.xlsx");
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      const newEvents: AcademicEvent[] = data.map((row: any) => {
        const category = (PLAN_CATEGORIES.includes(row["Plan Türü"]) ? row["Plan Türü"] : "MEB Yıllık Çalışma Planı") as PlanCategory;
        const clubName = normalizeName(row["Kulüp Adı"]);
        const club = availableClubs.find((item) => item.name === clubName);
        return {
          id: Math.random().toString(36).substring(2, 9),
          title: row["Başlık"] || "Başlıksız Plan",
          description: row["Açıklama"] || "",
          category,
          type: category === "Eğitsel Faaliyetler" ? "etkinlik" : "toplantı",
          startDate: row["Başlangıç Tarihi (YYYY-MM-DD HH:mm)"]
            ? String(row["Başlangıç Tarihi (YYYY-MM-DD HH:mm)"]).replace(" ", "T")
            : format(new Date(), "yyyy-MM-dd'T'09:00"),
          endDate: row["Bitiş Tarihi (YYYY-MM-DD HH:mm)"]
            ? String(row["Bitiş Tarihi (YYYY-MM-DD HH:mm)"]).replace(" ", "T")
            : format(new Date(), "yyyy-MM-dd'T'17:00"),
          priority: false,
          reminderLeadDays: 3,
          completed: false,
          stopReminding: false,
          responsibleMembers:
            category === "Eğitsel Faaliyetler" && club
              ? club.responsibleTeachers
              : row["Sorumlu Kişiler (Virgülle Ayırın)"]
              ? String(row["Sorumlu Kişiler (Virgülle Ayırın)"]).split(",").map((s) => s.trim()).filter(Boolean)
              : [],
          clubName: category === "Eğitsel Faaliyetler" ? clubName : "",
        };
      });
      setEvents((prev) => [...prev, ...newEvents]);
      alert(`${newEvents.length} plan başarıyla yüklendi.`);
      e.target.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const getEventsForDay = (day: Date) =>
    events.filter((e) => {
      const start = startOfDay(parseISO(e.startDate));
      const end = endOfDay(parseISO(e.endDate));
      return isWithinInterval(startOfDay(day), { start, end });
    });

  const renderMonthGrid = () => (
    <div className="rounded-[28px] bg-white/80 p-3 shadow-sm border border-slate-100">
      <div className="grid grid-cols-7 gap-2">
        {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
          <div key={d} className="rounded-2xl bg-slate-100/80 py-2.5 text-center text-[10px] uppercase font-black text-slate-500 shadow-sm">
            {d}
          </div>
        ))}
        {daysInCurrentView.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const monthStyle = MONTH_COLORS[currentDate.getMonth()];
          const dayEvents = isCurrentMonth ? getEventsForDay(day) : [];
          const background = isWeekend ? monthStyle.weekend : monthStyle.weekday;

          if (!isCurrentMonth) {
            return (
              <div
                key={day.toString()}
                className={`min-h-[92px] rounded-2xl border border-white/70 ${background} opacity-35 shadow-sm`}
                aria-hidden="true"
              />
            );
          }

          return (
            <div
              key={day.toString()}
              onClick={() => openAddModalForDate(day)}
              className={`min-h-[92px] rounded-2xl border border-white/80 p-2.5 relative group transition-all overflow-hidden cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 ${monthStyle.ring} ${background}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-2xl font-black w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${
                    isToday ? "bg-purple-600 text-white shadow-lg shadow-purple-200 ring-2 ring-purple-100" : monthStyle.text
                  }`}
                >
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px] font-black text-slate-600 bg-white/80 px-2 py-1 rounded-xl uppercase shadow-sm">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-1 overflow-y-auto max-h-[42px] scrollbar-hide">
                {dayEvents.slice(0, 2).map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(event);
                    }}
                    className={`w-full text-left px-2 py-1 rounded-lg text-[9px] font-black leading-tight truncate transition-all bg-white/90 border border-white/80 shadow-xs ${
                      event.completed ? "opacity-40 line-through grayscale" : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    {event.category === "Eğitsel Faaliyetler" && <span className="mr-1">🎓</span>}
                    {event.title}
                  </button>
                ))}
                {dayEvents.length > 2 && (
                  <div className="px-2 text-[9px] font-black text-slate-500">+{dayEvents.length - 2} plan</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderWeeklyList = () => (
    <div className="space-y-4">
      {daysInCurrentView.map((day) => {
        const dayEvents = getEventsForDay(day);
        const isToday = isSameDay(day, new Date());
        return (
          <div
            key={day.toString()}
            onClick={() => openAddModalForDate(day)}
            className={`bg-white rounded-2xl border border-slate-100 p-4 shadow-xs transition-all cursor-pointer ${
              isToday ? "ring-2 ring-purple-500/20 shadow-lg shadow-purple-500/5 bg-purple-50/10" : ""
            }`}
          >
            <div className="flex items-center gap-3 mb-4 border-b border-slate-50 pb-3">
              <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${isToday ? "bg-purple-600 border-purple-500 shadow-md text-white" : "bg-slate-50 border-slate-100"}`}>
                <span className="text-[10px] font-black uppercase leading-none mb-0.5">{format(day, "EEE", { locale: tr })}</span>
                <span className="text-lg font-black leading-none">{format(day, "d")}</span>
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-black ${isToday ? "text-purple-900" : "text-slate-800"}`}>{format(day, "d MMMM yyyy", { locale: tr })}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">{dayEvents.length} Kayıtlı Plan</p>
              </div>
            </div>
            {dayEvents.length === 0 ? (
              <div className="py-4 text-center"><p className="text-[11px] text-slate-400 font-medium italic">Bu gün için plan bulunmamaktadır.</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(event);
                    }}
                    className="p-4 rounded-2xl border bg-slate-50/60 border-slate-100 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <h5 className="text-sm font-black text-slate-800 mb-1 line-clamp-1">{event.title}</h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">{event.description || "Açıklama yok."}</p>
                    <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500">{format(parseISO(event.startDate), "HH:mm")} - {format(parseISO(event.endDate), "HH:mm")}</span>
                      {event.completed && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderDailyList = () => {
    const day = currentDate;
    const dayEvents = getEventsForDay(day).sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div onClick={() => openAddModalForDate(day)} className="bg-purple-950 bg-theme-pattern rounded-3xl p-8 text-white shadow-xl shadow-purple-950/20 relative overflow-hidden cursor-pointer">
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-1 tracking-tight">{format(day, "d MMMM", { locale: tr })}</h2>
            <p className="text-purple-200 font-bold uppercase tracking-[0.2em] text-xs">{format(day, "EEEE", { locale: tr })} • {dayEvents.length} Plan</p>
          </div>
          <CalendarIcon className="absolute -right-4 -bottom-4 w-40 h-40 text-white/5 rotate-12" />
        </div>
        <div className="space-y-4">
          {dayEvents.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-100">
              <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800 mb-1">Plan bulunmuyor</h3>
              <p className="text-sm text-slate-500 font-medium">Bu tarihe ait kayıtlı plan yok. Tarih kartına tıklayarak plan ekleyebilirsiniz.</p>
            </div>
          ) : (
            dayEvents.map((event) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={event.id}
                onClick={() => openEditModal(event)}
                className="bg-white rounded-3xl p-6 border border-slate-100 group cursor-pointer transition-all hover:shadow-xl hover:scale-[1.01] relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 w-2 h-full ${EVENT_TYPE_COLORS[event.type]}`} />
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(parseISO(event.startDate), "HH:mm")}</span>
                    <div className="w-full h-px bg-slate-200 my-1" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(parseISO(event.endDate), "HH:mm")}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black mb-1 text-slate-800">{event.title}</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{event.description || "Açıklama eklenmedi."}</p>
                    {event.clubName && <p className="mt-2 text-xs font-black text-purple-700 bg-purple-50 inline-flex px-3 py-1 rounded-xl">{event.clubName}</p>}
                  </div>
                  <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComplete(event.id);
                      }}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${event.completed ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEvent(event.id);
                      }}
                      className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderResponsibleArea = () => {
    if (formData.category === "Eğitsel Faaliyetler") {
      const selectedClub = availableClubs.find((club) => club.name === formData.clubName);
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kulüp</label>
            <div className="relative">
              <School className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={formData.clubName || ""}
                onChange={(e) => handleClubChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all appearance-none cursor-pointer"
              >
                {availableClubs.length === 0 ? (
                  <option value="">Kayıtlı kulüp bulunamadı</option>
                ) : (
                  availableClubs.map((club) => (
                    <option key={club.id || club.name} value={club.name}>{club.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Eğitsel Faaliyetten Sorumlu Öğretmenler</label>
            <div className="min-h-[50px] bg-purple-50 border border-purple-100 rounded-2xl p-3 flex flex-wrap gap-2">
              {(selectedClub?.responsibleTeachers || formData.responsibleMembers || []).length === 0 ? (
                <span className="text-xs font-bold text-slate-400">Seçili kulüpte görevli öğretmen bilgisi bulunamadı.</span>
              ) : (
                (selectedClub?.responsibleTeachers || formData.responsibleMembers).map((name) => (
                  <span key={name} className="bg-white border border-purple-100 text-purple-800 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" /> {name}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sorumlu Üyeler</label>
          <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{formData.responsibleMembers.length} kişi</span>
        </div>
        <div className="min-h-[52px] p-2 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 flex flex-wrap gap-2">
          {formData.responsibleMembers.length === 0 ? (
            <p className="text-[10px] text-slate-400 font-medium italic mt-2 ml-2">Henüz sorumlu üye eklenmedi.</p>
          ) : (
            formData.responsibleMembers.map((member) => (
              <span key={member} className="bg-white border border-slate-100 flex items-center gap-2 py-1 px-2.5 rounded-xl text-xs font-bold text-slate-700 shadow-sm">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                {member}
                <button type="button" onClick={() => removeResponsibleMember(member)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2 relative">
          <div className="flex-1 relative">
            <button
              type="button"
              onClick={() => setShowStaffDropdown(!showStaffDropdown)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-4 text-xs font-bold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-all focus:ring-2 focus:ring-purple-500/20"
            >
              <span>{tempStaffName || "Öğretmen / personel seçin..."}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showStaffDropdown ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showStaffDropdown && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setShowStaffDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.98 }}
                    className="absolute bottom-full mb-2 left-0 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl z-[70] overflow-hidden py-2"
                  >
                    <div className="max-h-56 overflow-y-auto scrollbar-hide">
                      {availableStaff.length === 0 ? (
                        <div className="p-4 text-center"><p className="text-[10px] font-bold text-slate-400">Kayıtlı öğretmen/personel bulunamadı.</p></div>
                      ) : (
                        availableStaff.map((staff) => (
                          <button
                            key={staff.id || staff.name}
                            type="button"
                            onClick={() => {
                              addResponsibleMember(staff.name);
                              setShowStaffDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors flex items-center justify-between gap-3"
                          >
                            <span>{staff.name}</span>
                            {staff.branch && <span className="text-[9px] text-slate-400">{staff.branch}</span>}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="h-px bg-slate-50 my-1" />
                    <div className="p-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Manuel isim girin..."
                        value={tempStaffName}
                        onChange={(e) => setTempStaffName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            addResponsibleMember(tempStaffName);
                            setShowStaffDropdown(false);
                          }
                        }}
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                      <button type="button" onClick={() => addResponsibleMember(tempStaffName)} className="px-3 py-2 bg-purple-950 text-white rounded-xl text-[10px] font-black">Ekle</button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1700px] mx-auto min-h-screen bg-slate-50/50">
      <div className="mb-8 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-950 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-900/10">
                <CalendarIcon className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Akademik Takvim</h1>
            </div>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-[0.2em] ml-15">EĞİTİM YILI KURUMSAL PLANI</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[28px] shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 px-2 mr-2">
              <button onClick={() => (view === "aylık" ? setCurrentDate(subMonths(currentDate, 1)) : setCurrentDate(subDays(currentDate, view === "haftalık" ? 7 : 1)))} className="w-10 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="min-w-[150px] text-center">
                <span className="text-sm font-black text-purple-900 uppercase">{view === "günlük" ? format(currentDate, "d MMMM yyyy", { locale: tr }) : format(currentDate, "MMMM yyyy", { locale: tr })}</span>
              </div>
              <button onClick={() => (view === "aylık" ? setCurrentDate(addMonths(currentDate, 1)) : setCurrentDate(addDays(currentDate, view === "haftalık" ? 7 : 1)))} className="w-10 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="h-10 w-px bg-slate-100 mx-1 hidden sm:block" />

            <div className="bg-slate-50 p-1 rounded-2xl flex items-center gap-1 shrink-0">
              {[
                { id: "aylık", label: "AY", icon: CalendarDays },
                { id: "haftalık", label: "HAFTA", icon: CalendarRange },
                { id: "günlük", label: "GÜN", icon: LayoutList },
              ].map((item) => (
                <button key={item.id} onClick={() => setView(item.id as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 cursor-pointer ${view === item.id ? "bg-white text-purple-900 shadow-md ring-1 ring-slate-100" : "text-slate-400 hover:text-slate-600"}`}>
                  <item.icon className={`w-3.5 h-3.5 ${view === item.id ? "text-purple-600" : ""}`} />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <button onClick={() => setShowAddDropdown(!showAddDropdown)} className="bg-purple-950 hover:bg-purple-900 text-white font-black text-xs px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-xl shadow-purple-900/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                <Plus className="w-4 h-4" /> PLAN EKLE <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAddDropdown ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showAddDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAddDropdown(false)} />
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden py-1.5">
                      <button
                        onClick={() => {
                          openAddModalForDate(currentDate);
                          setShowAddDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-purple-600" /> Manuel Plan Ekle
                      </button>
                      <div className="h-px bg-slate-50 mx-2 my-1" />
                      <button onClick={() => { downloadExcelTemplate(); setShowAddDropdown(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                        <Download className="w-4 h-4 text-emerald-600" /> Excel Şablonu İndir
                      </button>
                      <label className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4 text-blue-600" /> Excel ile Yükle
                        <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleExcelUpload} />
                      </label>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        <div className="xl:col-span-5 space-y-6 xl:sticky xl:top-8 overflow-y-auto max-h-[calc(100vh-100px)] scrollbar-hide">
          <div className="bg-white rounded-[32px] p-7 border border-slate-100 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 -mr-12 -mt-12 rounded-full blur-2xl" />
            <div className="flex items-center justify-between mb-6 relative">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center"><Bell className="w-4 h-4 text-amber-600" /></div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Ajanda Hatırlatmaları</h3>
              </div>
              <span className="bg-amber-100 text-amber-600 text-[10px] font-black px-2.5 py-1 rounded-full ring-2 ring-amber-50">{activeReminders.length}</span>
            </div>

            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {activeReminders.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                    <CheckCircle2 className="w-9 h-9 text-slate-200 mx-auto mb-2" />
                    <p className="text-[11px] font-black text-slate-400 uppercase leading-snug">Güncel uyarı bulunmuyor</p>
                  </motion.div>
                ) : (
                  activeReminders.map((event) => (
                    <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} key={event.id} onClick={() => openEditModal(event)} className="p-5 rounded-3xl border bg-white border-slate-100 shadow-sm hover:shadow-lg hover:border-amber-200 transition-all cursor-pointer relative overflow-hidden">
                      <div className="absolute left-0 top-0 h-full w-1.5 bg-amber-400" />
                      <div className="space-y-3 pl-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-black text-slate-900 leading-snug line-clamp-2">{event.title}</p>
                            {event.description && <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed line-clamp-3">{event.description}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase">{format(parseISO(event.startDate), "d MMM", { locale: tr })}</p>
                            <p className="text-[10px] font-black text-slate-500">{format(parseISO(event.startDate), "HH:mm")}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl">
                            {differenceInDays(parseISO(event.startDate), new Date()) > 0 ? `${differenceInDays(parseISO(event.startDate), new Date())} gün kaldı` : format(parseISO(event.startDate), "d MMMM yyyy", { locale: tr })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={(e) => { e.stopPropagation(); toggleComplete(event.id); }} className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-all cursor-pointer">TAMAMLA</button>
                            <button onClick={(e) => { e.stopPropagation(); toggleStopReminding(event.id); }} className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg hover:bg-slate-200 transition-all cursor-pointer">SONLANDIR</button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="xl:col-span-7">
          <AnimatePresence mode="wait">
            <motion.div key={view + currentDate.toString()} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {view === "aylık" && renderMonthGrid()}
              {view === "haftalık" && renderWeeklyList()}
              {view === "günlük" && renderDailyList()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} className="bg-white rounded-[34px] w-full max-w-5xl shadow-2xl relative z-20 overflow-hidden border border-white/20">
              <div className="bg-purple-950 p-7 text-white relative overflow-hidden flex items-center justify-between gap-4">
                <div className="relative z-10">
                  <h2 className="text-2xl font-black mb-1">{editingEvent ? "Planı Güncelle" : "Plan Ekle"}</h2>
                  <p className="text-purple-300 text-xs font-bold uppercase tracking-widest">Başlık, açıklama, tarih ve sorumluları belirleyin</p>
                </div>
                <button onClick={closeModal} className="relative z-10 w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                  <X className="w-5 h-5" />
                </button>
                <CalendarIcon className="absolute -right-4 -bottom-4 w-36 h-36 text-white/5 rotate-12" />
              </div>

              <div className="p-8 max-h-[72vh] overflow-y-auto scrollbar-thin">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Başlık</label>
                      <div className="relative">
                        <Type className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-11 pr-4 text-sm font-bold placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                          placeholder="Örn: Veli toplantısı, kulüp faaliyeti, deneme sınavı"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Açıklama</label>
                      <div className="relative">
                        <FileText className="w-4 h-4 absolute left-4 top-4 text-slate-400" />
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={7}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-11 text-sm font-bold placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all resize-none"
                          placeholder="Planla ilgili kısa açıklama yazın..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plan Türü</label>
                      <select
                        value={formData.category}
                        onChange={(e) => handleCategoryChange(e.target.value as PlanCategory)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all appearance-none cursor-pointer"
                      >
                        {PLAN_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Başlangıç</label>
                        <input
                          type="datetime-local"
                          value={formData.startDate.includes("T") ? formData.startDate : `${formData.startDate}T09:00`}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bitiş</label>
                        <input
                          type="datetime-local"
                          value={formData.endDate.includes("T") ? formData.endDate : `${formData.endDate}T17:00`}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300"
                        />
                      </div>
                    </div>

                    {renderResponsibleArea()}
                  </div>
                </div>
              </div>

              <div className="p-7 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
                {editingEvent && (
                  <button onClick={() => deleteEvent(editingEvent.id)} className="py-4 px-5 rounded-2xl text-[11px] font-black uppercase bg-red-50 text-red-600 hover:bg-red-100 transition-all cursor-pointer">
                    Sil
                  </button>
                )}
                <button onClick={closeModal} className="flex-1 py-4 rounded-2xl text-[13.67px] font-black uppercase text-slate-500 hover:bg-slate-200 transition-all cursor-pointer">
                  Vazgeç
                </button>
                <button onClick={handleAddOrUpdateEvent} className="flex-[2] py-4 rounded-2xl text-[13.67px] font-black uppercase bg-purple-950 text-white shadow-xl shadow-purple-900/20 hover:bg-purple-900 hover:scale-[1.01] transition-all cursor-pointer">
                  {editingEvent ? "Güncelle" : "Kaydet"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
