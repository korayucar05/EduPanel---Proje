import React from "react";
import { AlertTriangle, Bell, BellRing, CheckCheck, Clock3, RotateCcw, ShieldAlert, UserRoundCheck, XCircle } from "lucide-react";
import { auditLog, rollbackService, type AuditLogEntry, type RollbackRequest } from "../../core/audit";
import { hasatDataStore } from "../../core/data/hasatDataStore";
import { managementNotificationPolicy, managementNotificationWorkflow, type ManagementNotificationPolicy, type ManagementNotificationWorkflow } from "../../core/notifications";

type NotificationLevel = "critical" | "warning" | "info";
type NotificationItem = { id: string; level: NotificationLevel; title: string; description: string; createdAt: number; source: "rollback" | "audit"; };
type DisplayItem = NotificationItem & { workflow?: ManagementNotificationWorkflow };

const seenKey = (schoolId: string) => `management_notifications_seen_v1:${schoolId || "school-main"}`;
const levelClass: Record<NotificationLevel, string> = { critical: "border-rose-200 bg-rose-50 text-rose-800", warning: "border-amber-200 bg-amber-50 text-amber-800", info: "border-blue-200 bg-blue-50 text-blue-800" };

function buildNotifications(requests: RollbackRequest[], logs: AuditLogEntry[]): NotificationItem[] {
  const now = Date.now();
  const rollbackItems = requests.flatMap<NotificationItem>((request) => {
    if (request.status === "pending") {
      const state = rollbackService.slaState(request, now);
      return [{ id: `rollback:${request.id}:${state}`, level: state === "overdue" ? "critical" : state === "due_soon" ? "warning" : "info", title: state === "overdue" ? "Geri alma talebi gecikti" : state === "due_soon" ? "Geri alma talebinin süresi doluyor" : "Yönetici onayı bekleniyor", description: `${request.targetType} · ${request.targetId} · ${request.requestedByName}`, createdAt: request.requestedAt, source: "rollback" }];
    }
    if (request.status === "failed") return [{ id: `rollback:${request.id}:failed`, level: "critical", title: "Geri alma uygulanamadı", description: request.error || `${request.targetType} kaydı geri alınamadı.`, createdAt: request.closedAt || request.reviewedAt || request.requestedAt, source: "rollback" }];
    return [];
  });
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const auditItems = logs.filter((log) => log.createdAt >= sevenDaysAgo && log.action === "permission_denied").slice(0, 20).map<NotificationItem>((log) => ({ id: `audit:${log.id}`, level: "warning", title: "Yetkisiz işlem engellendi", description: `${log.actorName} · ${log.module} · ${log.summary}`, createdAt: log.createdAt, source: "audit" }));
  const rank = { critical: 3, warning: 2, info: 1 } as const;
  return [...rollbackItems, ...auditItems].sort((a, b) => rank[b.level] - rank[a.level] || b.createdAt - a.createdAt);
}

const statusLabel = (workflow?: ManagementNotificationWorkflow) => workflow?.status === "assigned" ? "Atandı" : workflow?.status === "snoozed" ? "Ertelendi" : workflow?.status === "resolved" ? "Çözüldü" : "Açık";
const remainingLabel = (dueAt: number) => {
  const minutes = Math.round((dueAt - Date.now()) / 60_000);
  if (minutes < 0) return `${Math.abs(minutes)} dk gecikti`;
  if (minutes < 60) return `${minutes} dk kaldı`;
  return `${Math.ceil(minutes / 60)} sa kaldı`;
};

export default function DashboardNotificationCenter({ schoolId }: { schoolId: string }) {
  const [items, setItems] = React.useState<DisplayItem[]>([]);
  const [seenIds, setSeenIds] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState<"active" | "unread" | "critical" | "resolved" | "all">("active");
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [assigneeDraft, setAssigneeDraft] = React.useState<Record<string, string>>({});
  const [resolutionDraft, setResolutionDraft] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState("");
  const [policy, setPolicy] = React.useState<ManagementNotificationPolicy | null>(null);
  const [policyOpen, setPolicyOpen] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const [requests, logs, seenResult, policyResult] = await Promise.all([rollbackService.list(schoolId), auditLog.list(schoolId), hasatDataStore.readArray<string>(seenKey(schoolId), []), managementNotificationPolicy.get(schoolId)]);
    const generated = buildNotifications(requests, logs);
    await Promise.all(generated.map((item) => managementNotificationWorkflow.ensure({ notificationId: item.id, schoolId, title: item.title, description: item.description, level: item.level, source: item.source, createdAt: item.createdAt })));
    await managementNotificationWorkflow.autoEscalate(schoolId);
    const workflows = await managementNotificationWorkflow.list(schoolId);
    const workflowMap = new Map(workflows.map((workflow) => [workflow.notificationId, workflow]));
    const active = generated.map((item) => ({ ...item, workflow: workflowMap.get(item.id) }));
    const resolvedHistory = workflows.filter((workflow) => workflow.status === "resolved" && !generated.some((item) => item.id === workflow.notificationId)).map<DisplayItem>((workflow) => ({ id: workflow.notificationId, level: workflow.level, title: workflow.title, description: workflow.description, createdAt: workflow.createdAt, source: workflow.source, workflow }));
    setItems([...active, ...resolvedHistory].sort((a, b) => b.createdAt - a.createdAt));
    setSeenIds(seenResult.value);
    setPolicy(policyResult);
    setLoading(false);
  }, [schoolId]);

  React.useEffect(() => {
    void reload();
    const offRollback = rollbackService.subscribe(() => void reload());
    const offAudit = auditLog.subscribeLocal(() => void reload());
    const offWorkflow = managementNotificationWorkflow.subscribe(schoolId, () => void reload());
    const offPolicy = managementNotificationPolicy.subscribe(schoolId, () => void reload());
    const managementHandler = () => void reload();
    window.addEventListener("hasat-management-notification", managementHandler);
    const timer = window.setInterval(() => void reload(), 60_000);
    return () => { offRollback(); offAudit(); offWorkflow(); offPolicy(); window.removeEventListener("hasat-management-notification", managementHandler); window.clearInterval(timer); };
  }, [reload, schoolId]);

  const now = Date.now();
  const quietNow = policy ? managementNotificationPolicy.isQuietNow(policy) : false;
  const isHiddenBySnooze = (item: DisplayItem) => item.workflow?.status === "snoozed" && Number(item.workflow.snoozedUntil || 0) > now;
  const unread = items.filter((item) => item.workflow?.status !== "resolved" && !isHiddenBySnooze(item) && !seenIds.includes(item.id));
  const activeItems = items.filter((item) => item.workflow?.status !== "resolved" && !isHiddenBySnooze(item));
  const resolvedItems = items.filter((item) => item.workflow?.status === "resolved");
  const overdueCount = activeItems.filter((item) => Number(item.workflow?.dueAt || Infinity) < now).length;
  const escalatedCount = activeItems.filter((item) => Number(item.workflow?.escalationLevel || 0) > 0).length;
  const resolvedOnTime = resolvedItems.filter((item) => Number(item.workflow?.resolvedAt || Infinity) <= Number(item.workflow?.dueAt || 0)).length;
  const onTimeRate = resolvedItems.length ? Math.round((resolvedOnTime / resolvedItems.length) * 100) : 100;
  const workload = Array.from(activeItems.reduce((map, item) => { const name = item.workflow?.assignee || "Atanmamış"; map.set(name, (map.get(name) || 0) + 1); return map; }, new Map<string, number>())).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const visible = items.filter((item) => {
    if (policy && !policy.includeInfo && item.level === "info") return false;
    if (quietNow && item.level !== "critical" && filter !== "all" && filter !== "resolved") return false;
    if (filter === "active") return item.workflow?.status !== "resolved" && !isHiddenBySnooze(item);
    if (filter === "unread") return item.workflow?.status !== "resolved" && !isHiddenBySnooze(item) && !seenIds.includes(item.id);
    if (filter === "critical") return item.level === "critical" && item.workflow?.status !== "resolved" && !isHiddenBySnooze(item);
    if (filter === "resolved") return item.workflow?.status === "resolved";
    return true;
  }).slice(0, 30);

  const persistSeen = async (next: string[]) => { setSeenIds(next); await hasatDataStore.write(seenKey(schoolId), next.slice(-500)); };
  const markSeen = (id: string) => { if (!seenIds.includes(id)) void persistSeen([...seenIds, id]); };
  const markAllSeen = () => void persistSeen(Array.from(new Set([...seenIds, ...items.map((item) => item.id)])));
  const openAudit = () => document.getElementById("dashboard-audit-trail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const runAction = async (id: string, action: () => Promise<void>, success: string) => { setBusyId(id); setMessage(""); try { await action(); setMessage(success); await reload(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusyId(null); } };

  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><BellRing className="h-5 w-5 text-violet-600" /><span className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Yönetim Bildirim Merkezi 3.0</span></div>
          <h2 className="mt-1 text-lg font-black text-slate-900">Eskalasyon, iş yükü ve kapanış performansı</h2>
          <p className="mt-1 text-[10px] text-slate-500">Süresi aşan kritik bildirimler otomatik olarak üst yönetime atanır.</p>
        </div>
        <button type="button" onClick={markAllSeen} disabled={!unread.length} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700 disabled:opacity-40"><CheckCheck className="h-4 w-4" /> Tümünü okundu yap</button>
      </div>

      <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wide text-indigo-700">Bildirim politikası ve yönetim özeti</div>
            <div className="mt-1 flex flex-wrap gap-2 text-[9px] font-bold text-slate-600">
              <span>{quietNow ? "Sessiz saatler aktif" : "Normal bildirim dönemi"}</span>
              <span>•</span><span>{policy?.digestMode === "instant" ? "Anlık" : policy?.digestMode === "weekly" ? "Haftalık" : "Günlük"} özet</span>
              <span>•</span><span>Bilgi bildirimleri {policy?.includeInfo === false ? "gizli" : "dahil"}</span>
            </div>
          </div>
          <button type="button" onClick={() => setPolicyOpen((value) => !value)} className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-[9px] font-black text-indigo-700">{policyOpen ? "Ayarları kapat" : "Politikayı düzenle"}</button>
        </div>
        {policyOpen && policy && <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="rounded-xl bg-white p-3 text-[9px] font-bold text-slate-600"><span className="block mb-2">Özet sıklığı</span><select value={policy.digestMode} onChange={(event) => void managementNotificationPolicy.save(schoolId, { digestMode: event.target.value as ManagementNotificationPolicy["digestMode"] })} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-[10px]"><option value="instant">Anlık</option><option value="daily">Günlük</option><option value="weekly">Haftalık</option></select></label>
          <label className="rounded-xl bg-white p-3 text-[9px] font-bold text-slate-600"><span className="block mb-2">Sessiz saat başlangıcı</span><input type="time" value={policy.quietStart} onChange={(event) => void managementNotificationPolicy.save(schoolId, { quietStart: event.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-[10px]"/></label>
          <label className="rounded-xl bg-white p-3 text-[9px] font-bold text-slate-600"><span className="block mb-2">Sessiz saat bitişi</span><input type="time" value={policy.quietEnd} onChange={(event) => void managementNotificationPolicy.save(schoolId, { quietEnd: event.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-[10px]"/></label>
          <label className="flex items-center gap-2 rounded-xl bg-white p-3 text-[9px] font-bold text-slate-600"><input type="checkbox" checked={policy.quietHoursEnabled} onChange={(event) => void managementNotificationPolicy.save(schoolId, { quietHoursEnabled: event.target.checked })}/><span>Sessiz saatleri kullan</span></label>
          <label className="flex items-center gap-2 rounded-xl bg-white p-3 text-[9px] font-bold text-slate-600"><input type="checkbox" checked={policy.includeInfo} onChange={(event) => void managementNotificationPolicy.save(schoolId, { includeInfo: event.target.checked })}/><span>Bilgi bildirimlerini göster</span></label>
        </div>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white px-3 py-2"><div className="text-lg font-black text-slate-900">{activeItems.length}</div><div className="text-[8px] font-black uppercase text-slate-500">Açık iş</div></div>
          <div className="rounded-xl bg-white px-3 py-2"><div className="text-lg font-black text-rose-700">{overdueCount}</div><div className="text-[8px] font-black uppercase text-slate-500">Geciken</div></div>
          <div className="rounded-xl bg-white px-3 py-2"><div className="text-lg font-black text-amber-700">{escalatedCount}</div><div className="text-[8px] font-black uppercase text-slate-500">Üst yönetime taşınan</div></div>
          <div className="rounded-xl bg-white px-3 py-2"><div className="text-lg font-black text-emerald-700">%{onTimeRate}</div><div className="text-[8px] font-black uppercase text-slate-500">Zamanında kapanış</div></div>
        </div>
        {quietNow && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] font-bold text-amber-800">Sessiz saatler aktif: kritik olmayan bildirimler anlık listede bastırılıyor; “Tümü” filtresinden yine görüntülenebilir.</div>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[ [activeItems.length,"Aktif","bg-violet-50 text-violet-800"], [overdueCount,"Geciken","bg-rose-50 text-rose-800"], [escalatedCount,"Eskale","bg-amber-50 text-amber-800"], [resolvedItems.length,"Çözülen","bg-emerald-50 text-emerald-800"], [`%${onTimeRate}`,"Zamanında kapanış","bg-blue-50 text-blue-800"] ].map(([value,label,cls]) => <div key={String(label)} className={`rounded-2xl p-3 ${cls}`}><div className="text-xl font-black">{value}</div><div className="text-[9px] font-black uppercase tracking-wide">{label}</div></div>)}
      </div>

      {workload.length > 0 && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-slate-600">Sorumlu iş yükü</div><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{workload.map(([name,count]) => <div key={name} className="rounded-xl bg-white px-3 py-2"><div className="truncate text-[10px] font-bold text-slate-700">{name}</div><div className="text-lg font-black text-slate-900">{count}</div></div>)}</div></div>}

      {message && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-bold text-violet-800">{message}</div>}
      <div className="mt-4 flex flex-wrap gap-2">{([['active','Aktif'],['unread','Okunmamış'],['critical','Kritik'],['resolved','Çözülen'],['all','Tümü']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-[9px] font-black ${filter === value ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</button>)}</div>

      <div className="mt-4 space-y-3">
        {visible.length ? visible.map((item) => {
          const isSeen = seenIds.includes(item.id); const workflow = item.workflow; const Icon = item.level === "critical" ? XCircle : item.level === "warning" ? AlertTriangle : Bell; const assignee = assigneeDraft[item.id] ?? workflow?.assignee ?? ""; const resolution = resolutionDraft[item.id] ?? "";
          return <article key={item.id} className={`rounded-2xl border p-3 ${levelClass[item.level]} ${isSeen ? "opacity-80" : "ring-1 ring-current/10"}`}>
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => { markSeen(item.id); openAudit(); }} className="mt-0.5 shrink-0"><Icon className="h-5 w-5" /></button>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-xs">{item.title}</strong>{!isSeen && <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[8px] font-black uppercase">Yeni</span>}<span className="rounded-md bg-white/70 px-2 py-0.5 text-[8px] font-black uppercase">{statusLabel(workflow)}</span>{Number(workflow?.escalationLevel || 0) > 0 && <span className="rounded-md bg-rose-700 px-2 py-0.5 text-[8px] font-black uppercase text-white">Eskale {workflow?.escalationLevel}</span>}</div><p className="mt-1 text-[10px] opacity-85">{item.description}</p><div className="mt-1 flex flex-wrap gap-3 text-[9px] opacity-70"><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {new Date(item.createdAt).toLocaleString("tr-TR")}</span>{workflow && workflow.status !== "resolved" && <span className={workflow.dueAt < now ? "font-black text-rose-700" : ""}>{remainingLabel(workflow.dueAt)}</span>}{workflow?.assignee && <span className="flex items-center gap-1"><UserRoundCheck className="h-3 w-3" /> {workflow.assignee}</span>}</div>{workflow?.escalationReason && <div className="mt-2 rounded-lg bg-white/70 px-2 py-1 text-[9px] font-bold">{workflow.escalationReason}</div>}</div>
              <ShieldAlert className="h-4 w-4 shrink-0 opacity-50" />
            </div>
            {workflow?.status === "resolved" ? <div className="mt-3 rounded-xl border border-emerald-200 bg-white/70 p-3 text-[10px] text-emerald-800"><strong>Çözüm:</strong> {workflow.resolutionNote}<br/><span className="opacity-70">{workflow.resolvedByName} · {workflow.resolvedAt ? new Date(workflow.resolvedAt).toLocaleString("tr-TR") : ""}</span><button type="button" disabled={busyId === item.id} onClick={() => void runAction(item.id, () => managementNotificationWorkflow.reopen(schoolId, item.id), "Bildirim yeniden açıldı.")} className="ml-3 inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 font-black"><RotateCcw className="h-3 w-3" /> Yeniden aç</button></div> : <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto]"><div className="flex gap-2"><input value={assignee} onChange={(event) => setAssigneeDraft((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Sorumlu kişi/birim" className="min-w-0 flex-1 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-[10px] text-slate-800 outline-none"/><button type="button" disabled={busyId === item.id} onClick={() => void runAction(item.id, () => managementNotificationWorkflow.assign(schoolId, item.id, assignee), "Bildirim sorumluya atandı.")} className="rounded-xl bg-slate-900 px-3 py-2 text-[9px] font-black text-white disabled:opacity-50">Ata</button></div><select defaultValue="" disabled={busyId === item.id} onChange={(event) => { const hours = Number(event.target.value); if (!hours) return; void runAction(item.id, () => managementNotificationWorkflow.snooze(schoolId, item.id, Date.now() + hours * 60 * 60 * 1000), `Bildirim ${hours} saat ertelendi.`); event.currentTarget.value = ""; }} className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-[9px] font-black text-slate-700"><option value="">Ertele</option><option value="2">2 saat</option><option value="8">8 saat</option><option value="24">1 gün</option><option value="72">3 gün</option></select><button type="button" onClick={() => markSeen(item.id)} className="rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-black">Okundu</button><div className="flex gap-2 lg:col-span-3"><input value={resolution} onChange={(event) => setResolutionDraft((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Çözüm notunu yazın" className="min-w-0 flex-1 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-[10px] text-slate-800 outline-none"/><button type="button" disabled={busyId === item.id || !resolution.trim()} onClick={() => void runAction(item.id, () => managementNotificationWorkflow.resolve(schoolId, item.id, resolution), "Bildirim çözüm notuyla kapatıldı.")} className="rounded-xl bg-emerald-700 px-3 py-2 text-[9px] font-black text-white disabled:opacity-50">Çözüldü</button></div></div>}
          </article>;
        }) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">{loading ? "Bildirimler yükleniyor..." : "Bu filtrede bekleyen yönetim bildirimi yok."}</div>}
      </div>
    </section>
  );
}
