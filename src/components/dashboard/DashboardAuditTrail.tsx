import React from "react";
import { AlertTriangle, BellRing, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Clock3, Download, FileText, RefreshCw, RotateCcw, Search, ShieldCheck, XCircle } from "lucide-react";
import { auditLog, rollbackService, type AuditLogEntry, type RollbackRequest } from "../../core/audit";

const actionLabel: Record<string, string> = {
  create: "Oluşturma", update: "Güncelleme", delete: "Silme", send: "Gönderim",
  publish: "Yayınlama", login: "Giriş", logout: "Çıkış", sync: "Senkron", permission_denied: "Yetki engeli",
};

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function DashboardAuditTrail({ schoolId }: { schoolId: string }) {
  const [logs, setLogs] = React.useState<AuditLogEntry[]>([]);
  const [queryText, setQueryText] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("all");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [rollbackRequests, setRollbackRequests] = React.useState<RollbackRequest[]>([]);
  const [requestLog, setRequestLog] = React.useState<AuditLogEntry | null>(null);
  const [requestReason, setRequestReason] = React.useState("");
  const [reviewNote, setReviewNote] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");
  const [rollbackFilter, setRollbackFilter] = React.useState<"all" | "pending" | "overdue" | "closed">("all");

  const reload = React.useCallback(async () => {
    setLoading(true);
    const [nextLogs, nextRequests] = await Promise.all([auditLog.list(schoolId), rollbackService.list(schoolId)]);
    setLogs(nextLogs);
    setRollbackRequests(nextRequests);
    setLoading(false);
  }, [schoolId]);

  React.useEffect(() => {
    void reload();
    const unsubscribeAudit = auditLog.subscribeLocal(() => void reload());
    const unsubscribeRollback = rollbackService.subscribe(() => void reload());
    return () => { unsubscribeAudit(); unsubscribeRollback(); };
  }, [reload]);

  const filtered = logs.filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    const haystack = `${log.actorName} ${log.module} ${log.summary} ${log.targetType} ${log.action}`.toLocaleLowerCase("tr-TR");
    return haystack.includes(queryText.trim().toLocaleLowerCase("tr-TR"));
  }).slice(0, 100);

  const rollbackMetrics = React.useMemo(() => {
    const now = Date.now();
    const pending = rollbackRequests.filter((item) => item.status === "pending");
    const overdue = pending.filter((item) => rollbackService.slaState(item, now) === "overdue");
    const closed = rollbackRequests.filter((item) => item.status !== "pending");
    const applied = rollbackRequests.filter((item) => item.status === "applied");
    const resolvedWithTime = closed.filter((item) => item.closedAt && item.requestedAt);
    const averageHours = resolvedWithTime.length
      ? resolvedWithTime.reduce((sum, item) => sum + ((item.closedAt || item.requestedAt) - item.requestedAt) / 3600000, 0) / resolvedWithTime.length
      : 0;
    return { pending: pending.length, overdue: overdue.length, closed: closed.length, applied: applied.length, averageHours };
  }, [rollbackRequests]);

  const visibleRollbackRequests = rollbackRequests.filter((request) => {
    if (rollbackFilter === "pending") return request.status === "pending";
    if (rollbackFilter === "overdue") return rollbackService.slaState(request) === "overdue";
    if (rollbackFilter === "closed") return request.status !== "pending";
    return true;
  });

  const formatRemaining = (request: RollbackRequest) => {
    if (request.status !== "pending") return request.closedAt ? `${new Date(request.closedAt).toLocaleString("tr-TR")} kapandı` : "Sonuçlandı";
    const diff = request.dueAt - Date.now();
    const absMinutes = Math.max(1, Math.round(Math.abs(diff) / 60000));
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    const text = hours ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
    return diff < 0 ? `${text} gecikti` : `${text} kaldı`;
  };

  const exportRollbackClosureReport = () => {
    const rows = [["Talep No", "Kayıt", "Talep Eden", "Talep Tarihi", "SLA Sonu", "Durum", "Onaylayan", "Kapanış Tarihi", "Süre (Saat)", "Gerekçe", "Onay/Red Notu"], ...rollbackRequests.map((request) => [
      request.id, `${request.targetType} / ${request.targetId}`, request.requestedByName, new Date(request.requestedAt).toLocaleString("tr-TR"),
      new Date(request.dueAt).toLocaleString("tr-TR"), request.status, request.reviewedByName || "", request.closedAt ? new Date(request.closedAt).toLocaleString("tr-TR") : "",
      request.closedAt ? (((request.closedAt - request.requestedAt) / 3600000).toFixed(2)) : "", request.reason, request.reviewNote || "",
    ])];
    const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `HASAT_Geri_Alma_Kapanis_Raporu_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const rows = [["Tarih", "Kullanıcı", "Rol", "İşlem", "Modül", "Kayıt Türü", "Kayıt No", "Özet", "Değişiklikler"], ...filtered.map((log) => [
      new Date(log.createdAt).toLocaleString("tr-TR"), log.actorName, log.actorRole, actionLabel[log.action] || log.action,
      log.module, log.targetType, log.targetId || "", log.summary,
      (log.changes || []).map((change) => `${change.field}: ${change.before} → ${change.after}`).join(" | "),
    ])];
    const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `HASAT_Denetim_Kaydi_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };



  const submitRollbackRequest = async () => {
    if (!requestLog) return;
    setBusyId(requestLog.id);
    setMessage("");
    try {
      await rollbackService.request(requestLog, requestReason);
      setRequestLog(null);
      setRequestReason("");
      setMessage("Geri alma talebi yönetici onayına gönderildi.");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  };

  const reviewRollback = async (request: RollbackRequest, decision: "approve" | "reject") => {
    setBusyId(request.id);
    setMessage("");
    try {
      const result = await rollbackService.review(request.id, decision, reviewNote[request.id] || "");
      setMessage(result.status === "applied" ? "Kayıt önceki sürümüne geri alındı." : result.status === "rejected" ? "Talep reddedildi." : result.error || "Talep sonuçlandırıldı.");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section id="dashboard-audit-trail" className="scroll-mt-6 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[.16em] text-indigo-600">İşlem Denetimi 2.0</span>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-black text-slate-900"><ShieldCheck className="h-5 w-5" /> Değişiklik geçmişi</h2>
          <p className="mt-1 text-[10px] text-slate-500">Kritik işlemler kullanıcı, zaman ve alan bazlı önce/sonra farklarıyla izlenir.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" /> CSV</button>
          <button type="button" onClick={() => void reload()} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Yenile</button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Kullanıcı, işlem veya kayıt ara" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-400" />
        </div>
        <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-indigo-400">
          <option value="all">Tüm işlemler</option>
          {Object.entries(actionLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {message && <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-800">{message}</div>}

      {rollbackRequests.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><span className="text-[9px] font-black uppercase tracking-wider text-amber-700">Kontrollü Geri Alma 2.0</span><h3 className="mt-1 flex items-center gap-2 text-sm font-black text-slate-900"><BellRing className="h-4 w-4" /> Onay kuyruğu ve SLA takibi</h3></div>
            <button type="button" onClick={exportRollbackClosureReport} className="flex items-center gap-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-[9px] font-black text-amber-800"><FileText className="h-4 w-4" /> Kapanış raporu</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <button onClick={() => setRollbackFilter("pending")} className="rounded-xl bg-white p-3 text-left"><span className="text-[9px] font-black uppercase text-amber-600">Bekleyen</span><strong className="mt-1 block text-xl text-slate-900">{rollbackMetrics.pending}</strong></button>
            <button onClick={() => setRollbackFilter("overdue")} className="rounded-xl bg-white p-3 text-left"><span className="text-[9px] font-black uppercase text-rose-600">SLA geciken</span><strong className="mt-1 block text-xl text-rose-700">{rollbackMetrics.overdue}</strong></button>
            <button onClick={() => setRollbackFilter("closed")} className="rounded-xl bg-white p-3 text-left"><span className="text-[9px] font-black uppercase text-emerald-600">Kapanan</span><strong className="mt-1 block text-xl text-emerald-700">{rollbackMetrics.closed}</strong></button>
            <div className="rounded-xl bg-white p-3"><span className="text-[9px] font-black uppercase text-indigo-600">Ort. kapanış</span><strong className="mt-1 block text-xl text-indigo-700">{rollbackMetrics.averageHours.toFixed(1)} sa</strong></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {([['all','Tümü'],['pending','Bekleyen'],['overdue','Geciken'],['closed','Kapanan']] as const).map(([value,label]) => <button key={value} onClick={() => setRollbackFilter(value)} className={`rounded-lg px-3 py-1.5 text-[9px] font-black ${rollbackFilter === value ? 'bg-amber-700 text-white' : 'bg-white text-amber-800'}`}>{label}</button>)}
          </div>
          {rollbackMetrics.overdue > 0 && <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-800"><AlertTriangle className="h-4 w-4" /> {rollbackMetrics.overdue} geri alma talebi 24 saatlik karar süresini aştı.</div>}
          <div className="mt-3 space-y-2">
            {visibleRollbackRequests.slice(0, 20).map((request) => (
              <div key={request.id} className="rounded-xl border border-amber-100 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><strong className="text-xs text-slate-900">{request.targetType} · {request.targetId}</strong><p className="mt-1 text-[10px] text-slate-600">{request.reason}</p><p className="mt-1 text-[9px] text-slate-400">{request.requestedByName} · {new Date(request.requestedAt).toLocaleString("tr-TR")}</p><p className={`mt-1 flex items-center gap-1 text-[9px] font-black ${rollbackService.slaState(request) === "overdue" ? "text-rose-700" : rollbackService.slaState(request) === "due_soon" ? "text-orange-700" : "text-slate-500"}`}><Clock3 className="h-3 w-3" /> SLA: {formatRemaining(request)} · Son karar: {new Date(request.dueAt).toLocaleString("tr-TR")}</p></div>
                  <span className={`rounded-lg px-2 py-1 text-[9px] font-black ${request.status === "pending" && rollbackService.slaState(request) === "overdue" ? "bg-rose-100 text-rose-800" : request.status === "pending" ? "bg-amber-100 text-amber-800" : request.status === "applied" ? "bg-emerald-100 text-emerald-800" : request.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}`}>{request.status === "pending" ? (rollbackService.slaState(request) === "overdue" ? "SLA gecikti" : "Onay bekliyor") : request.status === "applied" ? "Uygulandı" : request.status === "rejected" ? "Reddedildi" : request.status === "failed" ? "Başarısız" : request.status}</span>
                </div>
                {request.status === "pending" && rollbackService.canApprove() && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input value={reviewNote[request.id] || ""} onChange={(event) => setReviewNote((prev) => ({ ...prev, [request.id]: event.target.value }))} placeholder="Onay/red notu" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[10px]" />
                    <button disabled={busyId === request.id} onClick={() => void reviewRollback(request, "approve")} className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Onayla ve uygula</button>
                    <button disabled={busyId === request.id} onClick={() => void reviewRollback(request, "reject")} className="flex items-center justify-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"><XCircle className="h-4 w-4" /> Reddet</button>
                  </div>
                )}
                {request.reviewedByName && <p className="mt-2 text-[9px] text-slate-500">Karar: {request.reviewedByName} · {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString("tr-TR") : "—"}{request.reviewNote ? ` · ${request.reviewNote}` : ""}</p>}
                {request.error && <p className="mt-2 text-[9px] font-bold text-rose-700">{request.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {filtered.length ? filtered.map((log) => {
          const expanded = expandedId === log.id;
          return (
            <div key={log.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <button type="button" onClick={() => setExpandedId(expanded ? null : log.id)} className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-black uppercase text-indigo-700">{actionLabel[log.action] || log.action}</span>
                    <strong className="truncate text-xs text-slate-900">{log.summary}</strong>
                    {!!log.changes?.length && <span className="rounded-lg bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-800">{log.changes.length} alan değişti</span>}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">{log.actorName} · {log.actorRole} · {log.module}</p>
                </div>
                <div className="flex items-center gap-2"><time className="whitespace-nowrap text-[9px] font-bold text-slate-500">{new Date(log.createdAt).toLocaleString("tr-TR")}</time>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
              </button>
              {expanded && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="grid gap-2 text-[10px] sm:grid-cols-3">
                    <div><span className="font-black text-slate-500">Kayıt türü</span><p>{log.targetType}</p></div>
                    <div><span className="font-black text-slate-500">Kayıt no</span><p className="break-all">{log.targetId || "—"}</p></div>
                    <div><span className="font-black text-slate-500">Kaynak</span><p>{log.source === "cloud" ? "Bulut" : "Yerel"}</p></div>
                  </div>
                  {!!log.changes?.length ? (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full min-w-[560px] text-left text-[10px]"><thead className="bg-slate-100"><tr><th className="p-2">Alan</th><th className="p-2">Önce</th><th className="p-2">Sonra</th></tr></thead><tbody>{log.changes.map((change) => <tr key={change.field} className="border-t border-slate-100"><td className="p-2 font-black text-slate-700">{change.field}</td><td className="max-w-[240px] break-words p-2 text-rose-700">{change.before}</td><td className="max-w-[240px] break-words p-2 text-emerald-700">{change.after}</td></tr>)}</tbody></table>
                    </div>
                  ) : <p className="mt-3 rounded-xl bg-white p-3 text-[10px] text-slate-500">Bu işlem için alan bazlı değişiklik kaydı bulunmuyor.</p>}
                  {rollbackService.isSupported(log) && rollbackService.canRequest() && (
                    <button type="button" onClick={() => { setRequestLog(log); setRequestReason(""); setMessage(""); }} className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-800 hover:bg-amber-100"><RotateCcw className="h-4 w-4" /> Kontrollü geri alma talebi oluştur</button>
                  )}
                </div>
              )}
            </div>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500"><ClipboardList className="mx-auto mb-2 h-6 w-6" />{loading ? "Denetim kayıtları yükleniyor..." : "Bu kapsamda kayıt bulunamadı."}</div>
        )}
      </div>
      {requestLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-wider text-amber-600">Kontrollü Geri Alma</span><h3 className="mt-1 text-base font-black text-slate-900">Yönetici onayı iste</h3></div><button onClick={() => setRequestLog(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">×</button></div>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[10px] text-slate-600">Bu işlem kaydı doğrudan geri alınmayacak. Talep oluşturulacak ve farklı bir yetkili yönetici tarafından onaylandıktan sonra uygulanacaktır.</p>
            <div className="mt-3 rounded-xl border border-slate-200 p-3 text-[10px]"><strong>{requestLog.summary}</strong><p className="mt-1 text-slate-500">{requestLog.targetType} · {requestLog.targetId}</p></div>
            <textarea value={requestReason} onChange={(event) => setRequestReason(event.target.value)} rows={4} placeholder="Geri alma gerekçesini yazın" className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-amber-400" />
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setRequestLog(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-[10px] font-black text-slate-700">Vazgeç</button><button disabled={!requestReason.trim() || busyId === requestLog.id} onClick={() => void submitRollbackRequest()} className="rounded-xl bg-amber-600 px-4 py-2 text-[10px] font-black text-white disabled:opacity-50">Talebi gönder</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
