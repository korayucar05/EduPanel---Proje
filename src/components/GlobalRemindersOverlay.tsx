import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO, differenceInDays, startOfDay, endOfDay, subDays } from "date-fns";
import { tr } from "date-fns/locale";
import { motion, AnimatePresence } from "motion/react";
import { Bell, ChevronDown, AlertCircle, Calendar as CalendarIcon, Clock } from "lucide-react";

import { sqliteStorage } from "../core/state/SyncStateStore";
import type { PanelUser } from "../lib/accessControl";
const parseDateSafe = (dateStr: any): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  const cleanStr = String(dateStr).trim();
  let d = parseISO(cleanStr);
  if (!isNaN(d.getTime())) return d;

  const dmyRegex = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[T ](\d{1,2}):(\d{1,2}))?/;
  const match = cleanStr.match(dmyRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const date = new Date(year, month, day, hour, minute);
    if (!isNaN(date.getTime())) return date;
  }

  d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;

  return new Date();
};

type Props = {
  currentUser?: PanelUser;
  activeSchoolId?: string;
};

export default function GlobalRemindersOverlay({ currentUser, activeSchoolId }: Props) {
  const [events, setEvents] = useState<any[]>(() => {
    try {
      const saved = sqliteStorage.getItem("academic_events");
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.from(new Map(parsed.map((e: any) => [e.id, e])).values());
    } catch {
      return [];
    }
  });

  const [showOverlay, setShowOverlay] = useState(false);
  const [todayTick, setTodayTick] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setTodayTick(new Date()), 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeReminders = useMemo(() => {
    const now = startOfDay(todayTick);
    return events.filter((e: any) => {
      if (e.completed || e.stopReminding) return false;
      if (e.schoolId && activeSchoolId && String(e.schoolId) !== String(activeSchoolId)) return false;
      if (e.assignedToUserId && String(e.assignedToUserId) !== String(currentUser?.id || "")) return false;
      
      const start = startOfDay(parseDateSafe(e.startDate));
      const end = endOfDay(parseDateSafe(e.endDate));
      
      if (now > end) return false;

      const lead = e.reminderLeadDays !== undefined ? e.reminderLeadDays : 3;
      const reminderStart = subDays(start, lead);
      
      // Also show any upcoming task that is starting in the next 15 days
      const daysUntilStart = differenceInDays(start, now);
      const isUpcomingSoon = daysUntilStart >= 0 && daysUntilStart <= 15;

      return e.dailyReminder
        ? (now >= reminderStart && now <= end)
        : ((now >= reminderStart && now <= end) || isUpcomingSoon);
    }).sort((a: any, b: any) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      return parseDateSafe(a.startDate).getTime() - parseDateSafe(b.startDate).getTime();
    });
  }, [events, todayTick, currentUser?.id, activeSchoolId]);

  const [prevCount, setPrevCount] = useState(0);

  // Show upon reload/restart if there are active reminders
  useEffect(() => {
    if (activeReminders.length > 0) {
      setShowOverlay(true);
    }
  }, []);

  useEffect(() => {
    if (activeReminders.length > prevCount) {
      setShowOverlay(true);
    }
    setPrevCount(activeReminders.length);
  }, [activeReminders.length]);

  // Sosyal etkinliklerde "günlük mesaj" davranışı: 7 günlük pencere boyunca
  // sorumlu idareci uygulamaya girdiğinde her takvim gününde en az bir kez hatırlatma görür.
  useEffect(() => {
    if (!currentUser?.id || activeReminders.length === 0) return;
    const todayKey = format(todayTick, "yyyy-MM-dd");
    let hasNewDailyReminder = false;

    activeReminders.forEach((event: any) => {
      if (!event?.dailyReminder) return;
      const key = `enstitu_daily_reminder_${currentUser.id}_${event.id}_${todayKey}`;
      if (sqliteStorage.getItem(key) === "1") return;
      sqliteStorage.setItem(key, "1");
      hasNewDailyReminder = true;

      try {
        if ("Notification" in window && Notification.permission === "granted") {
          const days = Math.max(0, differenceInDays(startOfDay(parseDateSafe(event.startDate)), startOfDay(todayTick)));
          new Notification("e-Nstitü · Sosyal Etkinlik Hatırlatması", {
            body: `${event.title}${days > 0 ? ` · ${days} gün kaldı` : " · Bugün"}`,
            tag: `social-reminder-${event.id}-${todayKey}`,
          });
        }
      } catch {
        // Tarayıcı bildirimi kullanılamazsa uygulama içi hatırlatma çalışmaya devam eder.
      }
    });

    if (hasNewDailyReminder) setShowOverlay(true);
  }, [activeReminders, currentUser?.id, todayTick]);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = sqliteStorage.getItem("academic_events");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setEvents(Array.from(new Map(parsed.map((e: any) => [e.id, e])).values()));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("academic_events_updated", handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("academic_events_updated", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (events.length > 0) {
      const currentSaved = sqliteStorage.getItem("academic_events") || "[]";
      const currentString = JSON.stringify(events);
      if (currentSaved !== currentString) {
        sqliteStorage.setItem("academic_events", currentString);
        window.dispatchEvent(new Event("academic_events_updated"));
      }
    }
  }, [events]);

  const toggleComplete = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
    if (activeReminders.length <= 1) setShowOverlay(false);
  };

  const toggleStopReminding = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, stopReminding: !e.stopReminding } : e))
    );
    if (activeReminders.length <= 1) setShowOverlay(false);
  };

  if (!showOverlay || activeReminders.length === 0) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowOverlay(false)}
          className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl relative z-20 overflow-hidden border border-white/20 flex flex-col max-h-[85vh]"
        >
          <div className="bg-amber-500 bg-theme-pattern p-8 text-white relative">
             <div className="relative z-10">
               <div className="flex items-center gap-3 mb-2">
                 <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Bell className="w-6 h-6 text-white" />
                 </div>
                 <h2 className="text-2xl font-black tracking-tight">Ajanda Hatırlatmaları</h2>
               </div>
               <p className="text-amber-100 text-[10px] font-black uppercase tracking-[0.2em]">Aktif Süreçler ve Yaklaşan Faaliyetler</p>
             </div>
             <button 
               onClick={() => setShowOverlay(false)}
               className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-all cursor-pointer"
             >
               <ChevronDown className="w-6 h-6 text-white" />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
             {activeReminders.map((e) => (
               <div
                 key={e.id}
                 className={`p-5 rounded-3xl border transition-all relative overflow-hidden group ${
                   e.priority ? "bg-red-50 border-red-100 shadow-lg shadow-red-500/5" : "bg-slate-50 border-slate-100"
                 }`}
               >
                 <div className="flex items-start gap-4">
                    <div className={`shrink-0 w-3 h-3 rounded-full mt-2 ${e.priority ? "bg-red-500 animate-ping" : "bg-amber-400"}`} />
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className={`text-base font-black truncate leading-tight ${e.priority ? "text-red-900" : "text-slate-800"}`}>
                            {e.title}
                          </h4>
                          {e.priority && (
                            <div className="bg-red-600 text-white px-2 py-0.5 rounded-lg text-[9px] font-black shadow-md shadow-red-500/20 flex items-center gap-1 shrink-0">
                               <AlertCircle className="w-2.5 h-2.5" />
                               ACİL
                            </div>
                          )}
                       </div>
                       
                       <div className="flex flex-wrap gap-2 mb-3">
                         <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase text-white shadow-xs ${e.type === "toplantı" ? "bg-blue-500" : e.type === "etkinlik" ? "bg-purple-500" : e.type === "hatırlatma" ? "bg-amber-500" : "bg-slate-500"}`}>
                           {e.type}
                         </span>
                         {e.category && (
                           <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-200 text-slate-600 uppercase border border-slate-300">
                             {e.category}
                           </span>
                         )}
                       </div>

                       <p className="text-xs text-slate-500 font-medium mb-3 line-clamp-2 leading-relaxed">
                         {e.description || "Bu planlama için detaylı bir açıklama girilmemiş."}
                       </p>
                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                             <CalendarIcon className="w-3 h-3" />
                             {format(parseDateSafe(e.startDate), "d MMMM yyyy HH:mm", { locale: tr })}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 uppercase tracking-wider">
                             <Clock className="w-3 h-3" />
                             {differenceInDays(parseDateSafe(e.startDate), new Date()) > 0 
                               ? `${differenceInDays(parseDateSafe(e.startDate), new Date())} Gün Kaldı` 
                               : differenceInDays(parseDateSafe(e.endDate), new Date()) >= 0 ? "Devam Ediyor" : "Vadesi Geçti"}
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="mt-4 pt-4 border-t border-black/5 flex items-center justify-end gap-2">
                    <button 
                      onClick={() => toggleStopReminding(e.id)}
                      className="text-[10px] font-black text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
                    >
                      HATIRLATMAYI DURDUR
                    </button>
                    <button 
                      onClick={() => toggleComplete(e.id)}
                      className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all cursor-pointer shadow-sm"
                    >
                      TAMAMLANDI
                    </button>
                 </div>
               </div>
             ))}
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
             <button
               onClick={() => setShowOverlay(false)}
               className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors cursor-pointer"
             >
               DAHA SONRA HATIRLAT
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
