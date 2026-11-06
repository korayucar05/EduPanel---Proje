import React, { useEffect, useMemo, useState } from "react";
import { Award, BarChart3, Building2, CheckCircle2, Loader2, Plus, Send, Users } from "lucide-react";
import type { AccessControlState, PanelUser } from "../lib/accessControl";
import { examPipelineService } from "../modules/exam/ExamPipelineService";
import { examRepository } from "../modules/exam/ExamRepository";
import { networkExamService, type CommonExamDefinition, type NetworkExamAnalyticsSnapshot } from "../modules/network-exams";

interface Props {
  accessState: AccessControlState;
  currentUser: PanelUser;
  embedded?: boolean;
  initialLocalExamId?: string;
}

const formatNumber = (value: number) => Number(value || 0).toFixed(2);

export default function NetworkExamAnalyticsModule({ accessState, currentUser, embedded = false, initialLocalExamId = "" }: Props) {
  const isSuperAdmin = currentUser.role === "super_admin";
  const currentSchool = accessState.schools.find((school) => school.id === currentUser.schoolId);
  const [exams, setExams] = useState<CommonExamDefinition[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [analytics, setAnalytics] = useState<NetworkExamAnalyticsSnapshot | null>(null);
  const [evaluatedExams, setEvaluatedExams] = useState<any[]>([]);
  const [selectedLocalExamId, setSelectedLocalExamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", code: "", examDate: "", gradeLevel: "", publisherName: "" });

  const selectedExam = exams.find((exam) => exam.id === selectedExamId);
  const subjectNames = useMemo(() => Array.from(new Set((analytics?.subjects || []).map((row) => row.subjectName))), [analytics]);

  const reload = async () => {
    setBusy(true);
    setError("");
    try {
      const [commonExams, localExams] = await Promise.all([
        networkExamService.listExams(),
        examPipelineService.listEvaluated().catch(() => []),
      ]);
      const visible = isSuperAdmin
        ? commonExams
        : commonExams.filter((exam) => !exam.allowedSchoolIds?.length || (currentUser.schoolId && exam.allowedSchoolIds.includes(currentUser.schoolId)));
      setExams(visible);
      setEvaluatedExams(localExams);

      const preferredLocalExam = initialLocalExamId
        ? localExams.find((item: any) => String(item?.id) === String(initialLocalExamId))
        : null;
      if (preferredLocalExam) setSelectedLocalExamId(String(preferredLocalExam.id));

      const linkedNetworkExamId = String(preferredLocalExam?.networkExamId || "");
      const nextId = linkedNetworkExamId && visible.some((item) => String(item.id) === linkedNetworkExamId)
        ? linkedNetworkExamId
        : selectedExamId && visible.some((item) => String(item.id) === String(selectedExamId))
          ? String(selectedExamId)
          : visible[0]?.id || "";
      setSelectedExamId(String(nextId));
      setAnalytics(nextId ? await networkExamService.analytics(String(nextId)) : null);
    } catch (reason: any) {
      setError(reason?.message || "Ortak sınav ağı yüklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, [initialLocalExamId]);
  useEffect(() => {
    if (!selectedExamId) { setAnalytics(null); return; }
    void networkExamService.analytics(selectedExamId).then(setAnalytics).catch(() => setAnalytics(null));
  }, [selectedExamId]);

  const createExam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSuperAdmin) return;
    setBusy(true); setError("");
    try {
      const created = await networkExamService.createExam({
        ...form,
        status: "open",
        allowedSchoolIds: accessState.schools.filter((school) => school.status === "active").map((school) => school.id),
        createdByUserId: currentUser.id,
      });
      setForm({ name: "", code: "", examDate: "", gradeLevel: "", publisherName: "" });
      await reload();
      setSelectedExamId(created.id);
      setNotice("Ortak sınav oluşturuldu. Okullar bu sınava kendi değerlendirilmiş sınavlarını bağlayabilir.");
    } catch (reason: any) { setError(reason?.message || "Ortak sınav oluşturulamadı."); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!currentSchool || !selectedExamId || !selectedLocalExamId) return;
    const localExam = evaluatedExams.find((exam) => String(exam.id) === selectedLocalExamId);
    if (!localExam) return;
    setBusy(true); setError("");
    try {
      const localRows = await examRepository.findAll();
      const linkedExam = { ...localExam, networkExamId: selectedExamId, networkExamCode: selectedExam?.code || "", updatedAt: new Date().toISOString() };
      await examRepository.replaceAllAtomic(localRows.map((exam: any) => String(exam.id) === String(localExam.id) ? linkedExam : exam));
      await networkExamService.publishExam(selectedExamId, linkedExam, currentSchool);
      setEvaluatedExams((rows) => rows.map((exam) => String(exam.id) === String(localExam.id) ? linkedExam : exam));
      setAnalytics(await networkExamService.analytics(selectedExamId));
      setNotice("Okul sonuçları merkezi karşılaştırma havuzuna gönderildi.");
    } catch (reason: any) { setError(reason?.message || "Sonuçlar yayımlanamadı."); }
    finally { setBusy(false); }
  };

  return (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-[1500px] space-y-5"}>
      {notice && <div className="fixed bottom-6 right-6 z-[80] rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black text-white shadow-2xl">{notice}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">{error}</div>}

      {isSuperAdmin && (
        <form onSubmit={createExam} className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Plus className="h-5 w-5 text-indigo-600" /><h3 className="font-black">Yeni Ortak Sınav Tanımla</h3></div>
          <div className="grid gap-3 md:grid-cols-5">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sınav adı" className="rounded-xl border p-3 text-xs" />
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ortak sınav kodu" className="rounded-xl border p-3 text-xs" />
            <input required type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} className="rounded-xl border p-3 text-xs" />
            <input required value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} placeholder="Sınıf düzeyi (örn. 10)" className="rounded-xl border p-3 text-xs" />
            <input value={form.publisherName} onChange={(e) => setForm({ ...form, publisherName: e.target.value })} placeholder="Yayın / kaynak" className="rounded-xl border p-3 text-xs" />
          </div>
          <button disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Ortak Sınav Oluştur</button>
        </form>
      )}

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="text-xs font-black text-slate-700">Ortak Sınav</label>
            <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-xs font-bold">
              <option value="">Sınav seçiniz</option>
              {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} · {exam.gradeLevel}. Sınıf</option>)}
            </select>
            {selectedExam && <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-600"><strong className="block text-xs text-slate-900">{selectedExam.code}</strong>{selectedExam.examDate} · {selectedExam.publisherName || "Kaynak belirtilmedi"}</div>}
          </div>

          {!isSuperAdmin && currentSchool && (
            <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><Send className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-black">{currentSchool.name} Sonuçlarını Gönder</h3></div>
              <p className="mb-3 text-[10px] leading-4 text-slate-500">Yalnız değerlendirilmiş bir yerel sınav seçilir. Öğrenci net/puan ve ders sonuçları ortak sınav havuzuna gönderilir.</p>
              <select value={selectedLocalExamId} onChange={(e) => setSelectedLocalExamId(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 text-xs">
                <option value="">Değerlendirilmiş sınav seçiniz</option>
                {evaluatedExams.map((exam) => <option key={String(exam.id)} value={String(exam.id)}>{String(exam.examName || exam.name || exam.id)}</option>)}
              </select>
              <button onClick={publish} type="button" disabled={!selectedExamId || !selectedLocalExamId || busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 p-3 text-xs font-black text-white disabled:bg-slate-300">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Sonuçları Ağ Havuzuna Gönder</button>
            </div>
          )}
        </aside>

        <main className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<Building2 className="h-5 w-5" />} label="Katılan Okul" value={analytics?.schoolCount ?? 0} />
            <Metric icon={<Users className="h-5 w-5" />} label="Toplam Öğrenci" value={analytics?.participantCount ?? 0} />
            <Metric icon={<BarChart3 className="h-5 w-5" />} label="Ağ Net Ort." value={formatNumber(analytics?.networkAverageNet || 0)} />
            <Metric icon={<Award className="h-5 w-5" />} label="Ağ Puan Ort." value={formatNumber(analytics?.networkAverageScore || 0)} />
          </div>

          <div className="grid gap-5 2xl:grid-cols-2">
            <TableCard title="Okul Başarı Sıralaması" subtitle="Aynı sınava katılan okulların genel puan/net ortalaması">
              <table className="w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Okul</th><th className="p-3 text-center">Katılım</th><th className="p-3 text-center">Net Ort.</th><th className="p-3 text-center">Puan Ort.</th></tr></thead><tbody className="divide-y">{(analytics?.schools || []).map((row) => <tr key={row.schoolId}><td className="p-3 font-black text-indigo-700">{row.rank}</td><td className="p-3 font-bold">{row.schoolName}</td><td className="p-3 text-center">{row.participantCount}</td><td className="p-3 text-center font-mono">{formatNumber(row.averageNet)}</td><td className="p-3 text-center font-mono font-black">{formatNumber(row.averageScore)}</td></tr>)}</tbody></table>
            </TableCard>

            <TableCard title="Tüm Okullar Öğrenci Sıralaması" subtitle="Öğrenci puanı; eşitlikte net ve ad sırası">
              <div className="max-h-[360px] overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Öğrenci</th><th className="p-3 text-left">Okul</th><th className="p-3 text-center">Net</th><th className="p-3 text-center">Puan</th></tr></thead><tbody className="divide-y">{(analytics?.students || []).map((row) => {
                const canSeeIdentity = currentUser.role === "super_admin" || row.schoolId === currentUser.schoolId;
                return <tr key={`${row.schoolId}:${row.studentId}`} className={row.schoolId === currentUser.schoolId ? "bg-cyan-50" : ""}><td className="p-3 font-black text-violet-700">{row.networkRank}</td><td className="p-3"><strong className="block">{canSeeIdentity ? row.studentName : "Diğer okul öğrencisi"}</strong><span className="text-[9px] text-slate-400">{canSeeIdentity ? `${row.studentNumber} · ${row.classroom}` : "Kimlik bilgisi gizli"}</span></td><td className="p-3 text-[10px]">{row.schoolName}</td><td className="p-3 text-center font-mono">{formatNumber(row.net)}</td><td className="p-3 text-center font-mono font-black">{formatNumber(row.score)}</td></tr>;
              })}</tbody></table></div>
            </TableCard>
          </div>

          <TableCard title="Derslere Göre Okul Sıralamaları" subtitle="Her dersin okul ortalaması ağdaki diğer okullarla karşılaştırılır">
            <div className="space-y-4 p-4">
              {subjectNames.map((subjectName) => <div key={subjectName} className="overflow-hidden rounded-2xl border border-slate-200"><div className="bg-slate-900 px-4 py-3 text-xs font-black text-white">{subjectName}</div><table className="w-full text-[11px]"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Okul</th><th className="p-2 text-center">Öğrenci</th><th className="p-2 text-center">Net Ort.</th><th className="p-2 text-center">Ağ Ort.</th><th className="p-2 text-center">Fark</th><th className="p-2 text-center">Puan Ort.</th></tr></thead><tbody className="divide-y">{(analytics?.subjects || []).filter((row) => row.subjectName === subjectName).map((row) => { const delta = row.averageNet - row.networkAverageNet; return <tr key={`${subjectName}:${row.schoolId}`}><td className="p-2 font-black text-indigo-700">{row.rank}</td><td className="p-2 font-bold">{row.schoolName}</td><td className="p-2 text-center">{row.participantCount}</td><td className="p-2 text-center font-mono">{formatNumber(row.averageNet)}</td><td className="p-2 text-center font-mono text-slate-500">{formatNumber(row.networkAverageNet)}</td><td className={`p-2 text-center font-mono font-black ${delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{delta >= 0 ? "+" : ""}{formatNumber(delta)}</td><td className="p-2 text-center font-mono font-black">{formatNumber(row.averageScore)}</td></tr>; })}</tbody></table></div>)}
              {!subjectNames.length && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-400">Henüz ders karşılaştırma verisi yok.</div>}
            </div>
          </TableCard>
        </main>
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">{icon}</span><span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span><strong className="mt-1 block text-2xl font-black text-slate-900">{value}</strong></div>;
}

function TableCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b p-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-600" /><h3 className="font-black">{title}</h3></div><p className="mt-1 text-[10px] text-slate-500">{subtitle}</p></div>{children}</section>;
}
