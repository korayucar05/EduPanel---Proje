import React from "react";
import { Settings2, RotateCcw, X } from "lucide-react";
import { useScheduleConstraintStore } from "../../../stores/scheduleConstraintStore";
import type { ScheduleConstraintSettings } from "../../../types/scheduleConstraints";

const numberFields: Array<[keyof ScheduleConstraintSettings, string, number]> = [
  ["dailyLessonCount", "Günlük ders saati sayısı", 1],
  ["maxTeacherDailyHours", "Öğretmenin günlük azami dersi", 1],
  ["maxTeacherConsecutiveHours", "Öğretmenin azami ardışık dersi", 1],
  ["seed", "Deterministik seed", 1],
  ["maxDailyCourseHours", "Bir dersin günlük azami saati", 1],
  ["electiveEnglishMaxDailyHours", "Seçmeli İngilizce günlük azami", 1],
  ["unwantedTeacherDayPenalty", "İstenmeyen gün cezası", 1],
  ["teacherGapPenalty", "Öğretmen boşluk cezası", 1],
  ["teacherShortDayPenalty", "4 saatin altındaki öğretmen günü cezası", 1],
  ["classGapPenalty", "Sınıf boşluk cezası", 1],
  ["lastHourPenalty", "Son saat cezası", 1],
  ["sameCourseSameHourPenalty", "Aynı ders aynı saat cezası", 1],
  ["maxBacktrackingNodes", "Azami recursive düğüm", 1000],
  ["backtrackingTimeLimitMs", "Backtracking süre sınırı (ms)", 1000],
];

const booleanFields: Array<[keyof ScheduleConstraintSettings, string, string]> = [
  ["teacherConflictHard", "Öğretmen çakışması", "Hard"],
  ["classConflictHard", "Sınıf çakışması", "Hard"],
  ["groupConflictHard", "Grup çakışması", "Hard"],
  ["blockedSlotsHard", "Kapalı saatler", "Hard"],
  ["weeklyHoursHard", "Haftalık ders saati", "Hard"],
  ["unwantedTeacherDayHard", "İstenmeyen öğretmen günü", "Hard / kapalıysa soft"],
  ["requireTeacherFreeDay", "24 saatin altındaki öğretmene boş gün ver", "Soft tercih"],
  ["preserveManualAssignments", "Elle yerleştirilenleri koru", "Koruma"],
  ["domainCacheEnabled", "Incremental domain cache", "Performans"],
  ["nogoodLearningEnabled", "Nogood learning", "Performans"],
  ["visitedStateCacheEnabled", "Visited-state cache", "Tekrarlı durumları ele"],
  ["allowTeacherAutoInference", "Boş öğretmeni branştan otomatik tahmin et", "Varsayılan: Kapalı"],
];

export default function ConstraintSettingsModal() {
  const open = useScheduleConstraintStore((s) => s.settingsOpen);
  const settings = useScheduleConstraintStore((s) => s.settings);
  const setSettings = useScheduleConstraintStore((s) => s.setSettings);
  const resetSettings = useScheduleConstraintStore((s) => s.resetSettings);
  const setOpen = useScheduleConstraintStore((s) => s.setSettingsOpen);
  if (!open) return null;

  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
    <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div><h3 className="flex items-center gap-2 font-black text-slate-900"><Settings2 className="h-5 w-5 text-indigo-600"/>Ders Dağıtım Constraint Ayarları</h3><p className="mt-1 text-xs font-semibold text-slate-500">Hard kurallar ihlal edilmez; soft kurallar ceza puanıyla iyileştirilir.</p></div>
        <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button>
      </header>
      <div className="grid max-h-[72vh] gap-5 overflow-y-auto p-6 lg:grid-cols-2">
        <section><h4 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Hard / davranış kuralları</h4><div className="space-y-2">{booleanFields.map(([key,label,badge]) => <label key={String(key)} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3"><div><div className="text-sm font-bold text-slate-800">{label}</div><div className="text-[10px] font-bold text-indigo-500">{badge}</div></div><input type="checkbox" checked={Boolean(settings[key])} onChange={(e)=>setSettings({[key]:e.target.checked})} className="h-5 w-5"/></label>)}</div></section>
        <section className="space-y-5"><div><h4 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Çalışma günleri</h4><div className="flex flex-wrap gap-2">{["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"].map((day) => { const selected = (settings.workDays || []).includes(day); return <button key={day} type="button" onClick={() => { const current = settings.workDays || []; const next = selected ? current.filter((item) => item !== day) : [...current, day]; if (next.length > 0) setSettings({ workDays: next }); }} className={`rounded-xl border px-3 py-2 text-xs font-black transition ${selected ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-500"}`}>{day}</button>; })}</div></div><div><h4 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Limitler ve soft ceza puanları</h4><div className="grid gap-3 sm:grid-cols-2">{numberFields.map(([key,label,step]) => <label key={String(key)} className="rounded-2xl border border-slate-200 p-3"><span className="mb-2 block text-xs font-bold text-slate-600">{label}</span><input type="number" step={step} min={key === "dailyLessonCount" ? 1 : 0} max={key === "dailyLessonCount" ? 16 : undefined} value={Number(settings[key])} onChange={(e)=>setSettings({[key]:Number(e.target.value)})} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black"/></label>)}</div></div></section>
      </div>
      <footer className="flex justify-between border-t border-slate-100 px-6 py-4"><button onClick={resetSettings} className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700"><RotateCcw className="h-4 w-4"/>Varsayılanlara dön</button><button onClick={()=>setOpen(false)} className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white">Kaydet ve Kapat</button></footer>
    </div>
  </div>;
}
