import { useState } from "react";

const RULE_BUTTONS = ["Genel Kısıtlamalar", "Öğretmen Kısıtlamaları", "Şube Kısıtlamaları"] as const;
type RuleButton = (typeof RULE_BUTTONS)[number];

type Constraint = {
  id: string;
  label: string;
  value?: number;
  min?: number;
  max?: number;
  force: number;
  enabled: boolean;
};

const INITIAL_CONSTRAINTS: Constraint[] = [
  { id: "max-days", label: "Bir öğretmenin haftada ders görevi alabileceği en fazla gün sayısı", value: 5, min: 1, max: 5, force: 100, enabled: true },
  { id: "min-days", label: "Bir öğretmenin haftada ders görevi alabileceği en az gün sayısı", value: 4, min: 1, max: 5, force: 100, enabled: true },
  { id: "no-consecutive-days", label: "Bir öğretmen ardışık (arka arkaya gelen) iki gün çalışmamalıdır.", force: 100, enabled: false },
  { id: "max-daily-gap", label: "Bir öğretmenin günlük en fazla boş saati", value: 1, min: 0, max: 8, force: 100, enabled: false },
  { id: "max-weekly-gap", label: "Bir öğretmenin haftalık en fazla boş saati", value: 5, min: 0, max: 20, force: 100, enabled: true },
  { id: "max-daily-lessons", label: "Bir öğretmenin günlük en fazla gireceği ders saati", value: 8, min: 1, max: 12, force: 100, enabled: true },
  { id: "min-daily-lessons", label: "Bir öğretmenin günlük en az gireceği ders saati", value: 4, min: 1, max: 12, force: 100, enabled: false },
];

export default function ScheduleRulesModule() {
  const [selectedRule, setSelectedRule] = useState<RuleButton>("Genel Kısıtlamalar");
  const [constraints, setConstraints] = useState(INITIAL_CONSTRAINTS);

  const update = (id: string, patch: Partial<Constraint>) =>
    setConstraints((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const clearAll = () => setConstraints((items) => items.map((item) => ({ ...item, enabled: false })));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-6 pb-6 pt-0 lg:px-8 lg:pb-8 lg:pt-0">
      <section className="rounded-3xl border-2 border-dashed border-green-600 bg-white p-4">
        <div className="bg-theme-pattern flex min-h-[52px] w-full flex-wrap items-center gap-1.5 rounded-2xl bg-green-600 p-1.5 shadow-inner">
          {RULE_BUTTONS.map((rule) => {
            const selected = selectedRule === rule;
            return (
              <button key={rule} type="button" onClick={() => setSelectedRule(rule)}
                className={`flex h-[40px] min-w-[150px] flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border-2 px-5 text-[11px] font-bold transition-all ${selected ? "border-white bg-white text-green-700 shadow-sm" : "border-white/60 text-white hover:bg-green-700/80"}`}>
                {rule}
              </button>
            );
          })}
        </div>
      </section>

      {selectedRule === "Genel Kısıtlamalar" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Genel Kısıtlamalar</h2>
              <p className="mt-0.5 text-xs text-slate-500">Ders programı oluşturulurken uygulanacak genel çalışma sınırlarını belirleyin.</p>
            </div>
            <button type="button" onClick={clearAll} className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-600">Tüm Kısıtlamaları Temizle</button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[minmax(360px,1fr)_130px_320px_150px] border-b border-slate-200 bg-slate-100/80 text-[11px] font-extrabold text-slate-700">
                <div className="px-5 py-3">Kısıtlama</div><div className="px-4 py-3">Değer</div><div className="px-4 py-3">Kural Zorla</div><div className="px-4 py-3">Durum</div>
              </div>
              {constraints.map((item) => (
                <div key={item.id} className={`grid grid-cols-[minmax(360px,1fr)_130px_320px_150px] items-center border-b border-slate-100 last:border-b-0 ${item.enabled ? "bg-white" : "bg-slate-50/60"}`}>
                  <div className="px-5 py-4 text-[12px] font-medium text-slate-700">{item.label}</div>
                  <div className="px-4 py-4">
                    {typeof item.value === "number" ? (
                      <select value={item.value} onChange={(e) => update(item.id, { value: Number(e.target.value) })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 outline-none focus:border-teal-500">
                        {Array.from({ length: (item.max ?? item.value) - (item.min ?? 0) + 1 }, (_, i) => (item.min ?? 0) + i).map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </div>
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <input aria-label={`${item.label} kural zorla`} type="range" min="0" max="100" value={item.force} onChange={(e) => update(item.id, { force: Number(e.target.value) })} className="h-2 flex-1 cursor-pointer accent-teal-600" />
                      <span className="w-12 rounded-lg bg-slate-800 px-2 py-1 text-center text-[10px] font-extrabold text-white">%{item.force}</span>
                    </div>
                  </div>
                  <div className="px-4 py-4">
                    <button type="button" onClick={() => update(item.id, { enabled: !item.enabled })} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <span className={`relative h-6 w-11 rounded-full transition ${item.enabled ? "bg-teal-500" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${item.enabled ? "left-6" : "left-1"}`} /></span>
                      {item.enabled ? "Açık" : "Kapalı"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-slate-200 bg-teal-50/60 px-5 py-3 text-[11px] text-teal-800"><span className="font-extrabold">Not:</span> Kural Zorla yüzdesi, program motorunun ilgili kısıtlamaya vereceği önceliği belirtir.</div>
        </section>
      )}
    </div>
  );
}
