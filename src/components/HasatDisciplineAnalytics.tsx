import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  RefreshCw,
  Scale,
  ShieldAlert,
  TrendingUp,
  UserRoundSearch,
  Users,
} from "lucide-react";
import type { BehaviorRecord } from "./behavior/behaviorTypes";
import { safeStorage } from "./behavior/behaviorStorage";

type Props = {
  onNavigate?: (tab: string) => void;
};

type AnalyticsRecord = BehaviorRecord & { source: string };

const STORAGE_SOURCES = [
  ["behaviorRecords", "Davranış"],
  ["disciplineWarnings", "Yazılı Uyarı"],
  ["disciplineBoardRecords", "Disiplin Süreci"],
  ["disciplineArchiveRecords", "Arşiv"],
] as const;

const normalize = (value: unknown) => String(value ?? "").trim();

const toTimestamp = (record: AnalyticsRecord) => {
  const direct = Number(record.createdAt || record.archivedAt || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const parsed = Date.parse(record.date || "");
  return Number.isFinite(parsed) ? parsed : 0;
};

const levelOf = (count: number) => {
  if (count >= 5) return { label: "Kritik", cls: "bg-rose-100 text-rose-700" };
  if (count >= 3) return { label: "Yüksek", cls: "bg-orange-100 text-orange-700" };
  if (count >= 2) return { label: "Orta", cls: "bg-amber-100 text-amber-700" };
  return { label: "Düşük", cls: "bg-emerald-100 text-emerald-700" };
};

export default function HasatDisciplineAnalytics({ onNavigate }: Props) {
  const [records, setRecords] = useState<AnalyticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"30" | "90" | "all">("90");

  const loadRecords = async () => {
    setLoading(true);
    try {
      const groups = await Promise.all(
        STORAGE_SOURCES.map(async ([key, source]) => {
          const value = (await safeStorage.getItem<BehaviorRecord[]>(key)) || [];
          return Array.isArray(value) ? value.map((item) => ({ ...item, source })) : [];
        }),
      );

      const deduped = new Map<string, AnalyticsRecord>();
      groups.flat().forEach((record) => {
        const key = [
          record.sourceRecordId || record.id,
          record.studentId,
          record.studentName,
          record.behaviorName,
          record.date,
          record.source,
        ].join("::");
        if (!deduped.has(key)) deduped.set(key, record);
      });
      setRecords([...deduped.values()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const filtered = useMemo(() => {
    if (range === "all") return records;
    const threshold = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    return records.filter((record) => {
      const timestamp = toTimestamp(record);
      return timestamp === 0 || timestamp >= threshold;
    });
  }, [records, range]);

  const metrics = useMemo(() => {
    const negative = filtered.filter((record) => record.behaviorType !== "Olumlu");
    const students = new Map<string, { name: string; classroom: string; number: string; count: number; latest: number }>();
    const classrooms = new Map<string, number>();
    const behaviors = new Map<string, number>();
    const months = new Map<string, number>();

    negative.forEach((record) => {
      const studentKey = normalize(record.studentId || record.studentNumber || record.studentName) || "bilinmeyen";
      const current = students.get(studentKey) || {
        name: normalize(record.studentName) || "Öğrenci bilgisi yok",
        classroom: normalize(record.studentClassroom) || "Sınıf yok",
        number: normalize(record.studentNumber),
        count: 0,
        latest: 0,
      };
      current.count += 1;
      current.latest = Math.max(current.latest, toTimestamp(record));
      students.set(studentKey, current);

      const classroom = normalize(record.studentClassroom) || "Sınıf bilgisi yok";
      classrooms.set(classroom, (classrooms.get(classroom) || 0) + 1);

      const behavior = normalize(record.behaviorName) || normalize(record.description) || "Tanımsız davranış";
      behaviors.set(behavior, (behaviors.get(behavior) || 0) + 1);

      const ts = toTimestamp(record);
      if (ts > 0) {
        const date = new Date(ts);
        const month = date.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
        months.set(month, (months.get(month) || 0) + 1);
      }
    });

    const repeatStudents = [...students.values()]
      .filter((student) => student.count >= 2)
      .sort((a, b) => b.count - a.count || b.latest - a.latest);
    const topClasses = [...classrooms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topBehaviors = [...behaviors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const trend = [...months.entries()].slice(-6);
    const activeCases = negative.filter((record) => record.source === "Disiplin Süreci" || record.source === "Yazılı Uyarı").length;

    return {
      negativeCount: negative.length,
      activeCases,
      repeatStudents,
      topClasses,
      topBehaviors,
      trend,
      uniqueStudents: students.size,
    };
  }, [filtered]);

  const maxClass = Math.max(1, ...metrics.topClasses.map(([, count]) => count));
  const maxBehavior = Math.max(1, ...metrics.topBehaviors.map(([, count]) => count));
  const maxTrend = Math.max(1, ...metrics.trend.map(([, count]) => count));

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-rose-950 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[.22em] text-rose-200">e-Nstitü DISCIPLINE INTELLIGENCE 1.0</div>
              <h1 className="mt-2 text-3xl font-black">Disiplin Analitik</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Davranış kayıtlarını, yazılı uyarıları ve disiplin süreçlerini birlikte değerlendirerek tekrarları ve sınıf yoğunluklarını görünür hâle getirir.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select value={range} onChange={(event) => setRange(event.target.value as typeof range)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none">
                <option className="text-slate-900" value="30">Son 30 gün</option>
                <option className="text-slate-900" value="90">Son 90 gün</option>
                <option className="text-slate-900" value="all">Tüm kayıtlar</option>
              </select>
              <button onClick={() => void loadRecords()} className="rounded-xl border border-white/20 bg-white/10 p-2.5 hover:bg-white/20" title="Verileri yenile">
                <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Olumsuz kayıt", value: metrics.negativeCount, icon: ShieldAlert, note: "Seçili dönemde" },
            { label: "Aktif işlem", value: metrics.activeCases, icon: Scale, note: "Uyarı ve disiplin" },
            { label: "Tekrarlayan öğrenci", value: metrics.repeatStudents.length, icon: UserRoundSearch, note: "En az iki kayıt" },
            { label: "Etkilenen öğrenci", value: metrics.uniqueStudents, icon: Users, note: "Tekil öğrenci" },
          ].map(({ label, value, icon: Icon, note }) => (
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div><div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div><div className="mt-2 text-3xl font-black text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-500">{note}</div></div>
                <span className="rounded-xl bg-rose-50 p-3 text-rose-700"><Icon className="h-5 w-5" /></span>
              </div>
            </article>
          ))}
        </section>

        {records.length === 0 && !loading ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <h2 className="mt-3 text-xl font-black text-slate-900">Analiz edilecek kayıt bulunamadı</h2>
            <p className="mt-2 text-sm text-slate-500">Davranış veya disiplin kaydı oluşturulduğunda bu ekran otomatik olarak dolacaktır.</p>
            <button onClick={() => onNavigate?.("behavior")} className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white">Davranış kaydına git</button>
          </section>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-2">
              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-black text-slate-900">Sınıf bazlı olay yoğunluğu</h2></div>
                <div className="mt-5 space-y-4">
                  {metrics.topClasses.map(([name, count]) => (
                    <div key={name}>
                      <div className="mb-1 flex justify-between text-sm font-bold"><span>{name}</span><span>{count}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(5, (count / maxClass) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-rose-600" /><h2 className="text-lg font-black text-slate-900">En sık davranış türleri</h2></div>
                <div className="mt-5 space-y-4">
                  {metrics.topBehaviors.map(([name, count]) => (
                    <div key={name}>
                      <div className="mb-1 flex justify-between gap-4 text-sm font-bold"><span className="truncate" title={name}>{name}</span><span>{count}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-rose-600" style={{ width: `${Math.max(5, (count / maxBehavior) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><UserRoundSearch className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-black text-slate-900">Tekrarlayan öğrenciler</h2></div><button onClick={() => onNavigate?.("guidance-center")} className="text-xs font-black text-indigo-700 hover:underline">Rehberlik Merkezinde aç</button></div>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500"><th className="pb-3">Öğrenci</th><th className="pb-3">Sınıf</th><th className="pb-3">Kayıt</th><th className="pb-3">Risk</th></tr></thead>
                    <tbody>
                      {metrics.repeatStudents.slice(0, 12).map((student, index) => {
                        const level = levelOf(student.count);
                        return <tr key={`${student.number}-${student.name}-${index}`} className="border-b border-slate-100"><td className="py-3 font-bold text-slate-900">{student.name}<div className="text-xs font-normal text-slate-500">{student.number || "Numara yok"}</div></td><td className="py-3">{student.classroom}</td><td className="py-3 font-black">{student.count}</td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${level.cls}`}>{level.label}</span></td></tr>;
                      })}
                      {metrics.repeatStudents.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-500">Tekrarlayan öğrenci kaydı bulunmuyor.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-cyan-700" /><h2 className="text-lg font-black text-slate-900">Aylık eğilim</h2></div>
                <div className="mt-6 flex h-48 items-end gap-3">
                  {metrics.trend.map(([month, count]) => (
                    <div key={month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <span className="text-xs font-black text-slate-700">{count}</span>
                      <div className="w-full rounded-t-xl bg-cyan-600" style={{ height: `${Math.max(10, (count / maxTrend) * 140)}px` }} />
                      <span className="text-[10px] font-bold text-slate-500">{month}</span>
                    </div>
                  ))}
                  {metrics.trend.length === 0 && <div className="m-auto text-center text-sm text-slate-500">Tarih bilgisi bulunan kayıt yok.</div>}
                </div>
                <button onClick={() => onNavigate?.("discipline")} className="mt-5 w-full rounded-xl bg-rose-700 px-4 py-3 text-sm font-black text-white hover:bg-rose-800">Disiplin işlemlerini aç</button>
              </article>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
