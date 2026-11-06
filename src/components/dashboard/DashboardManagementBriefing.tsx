import React from "react";
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, ClipboardCheck, ClipboardPlus, Download, Eye, FileSignature, FileText, History, MailCheck, PenLine, Printer, RefreshCw, Send, UserCheck, Users, XCircle } from "lucide-react";
import { auditLog } from "../../core/audit";
import { decisionTaskRepository, managementDecisionRepository, type DecisionTaskRecord, type ManagementDecisionRecord } from "../../core/data";
import { managementNotificationPolicy, managementNotificationWorkflow, type ManagementNotificationPolicy, type ManagementNotificationWorkflow } from "../../core/notifications";
import { loadAccessState } from "../../lib/accessControl";

import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";
type BriefingPeriod = "daily" | "weekly";

type BriefingSnapshot = {
  generatedAt: number;
  period: BriefingPeriod;
  policy: ManagementNotificationPolicy;
  active: ManagementNotificationWorkflow[];
  resolved: ManagementNotificationWorkflow[];
  overdue: ManagementNotificationWorkflow[];
  escalated: ManagementNotificationWorkflow[];
  unassigned: ManagementNotificationWorkflow[];
  resolvedInPeriod: ManagementNotificationWorkflow[];
  onTimeRate: number;
  topItems: ManagementNotificationWorkflow[];
};

const actor = () => {
  const state = loadAccessState();
  const sessionUserId = typeof runtimeSessionStorage !== "undefined" ? runtimeSessionStorage.getItem("edupanel_authenticated_user") || "" : "";
  const user = state.users.find((candidate) => candidate.id === sessionUserId) || state.users.find((candidate) => candidate.id === state.currentUserId);
  return { userId: user?.id || "system", userName: user?.fullName || "Sistem", userRole: user?.role || "system" };
};

const priorityFor = (item: ManagementNotificationWorkflow) => {
  const base = item.level === "critical" ? 95 : item.level === "warning" ? 75 : 50;
  return Math.min(100, base + item.escalationLevel * 3 + (item.dueAt < Date.now() ? 2 : 0));
};

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const downloadText = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

async function buildSnapshot(schoolId: string, period: BriefingPeriod): Promise<BriefingSnapshot> {
  const [workflows, policy] = await Promise.all([
    managementNotificationWorkflow.list(schoolId),
    managementNotificationPolicy.get(schoolId),
  ]);
  const now = Date.now();
  const periodStart = now - (period === "daily" ? 24 : 7 * 24) * 60 * 60 * 1000;
  const active = workflows.filter((item) => item.status !== "resolved" && !(item.status === "snoozed" && Number(item.snoozedUntil || 0) > now));
  const resolved = workflows.filter((item) => item.status === "resolved");
  const overdue = active.filter((item) => item.dueAt < now);
  const escalated = active.filter((item) => item.escalationLevel > 0);
  const unassigned = active.filter((item) => !item.assignee.trim());
  const resolvedInPeriod = resolved.filter((item) => Number(item.resolvedAt || 0) >= periodStart);
  const onTime = resolvedInPeriod.filter((item) => Number(item.resolvedAt || Infinity) <= item.dueAt).length;
  const onTimeRate = resolvedInPeriod.length ? Math.round((onTime / resolvedInPeriod.length) * 100) : 100;
  const topItems = [...active]
    .sort((a, b) => priorityFor(b) - priorityFor(a) || a.dueAt - b.dueAt)
    .slice(0, 5);
  return { generatedAt: now, period, policy, active, resolved, overdue, escalated, unassigned, resolvedInPeriod, onTimeRate, topItems };
}

export default function DashboardManagementBriefing({ schoolId }: { schoolId: string }) {
  const [period, setPeriod] = React.useState<BriefingPeriod>("daily");
  const [snapshot, setSnapshot] = React.useState<BriefingSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [minutes, setMinutes] = React.useState<ManagementDecisionRecord[]>([]);
  const [minutesBusy, setMinutesBusy] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await buildSnapshot(schoolId, period));
    } finally {
      setLoading(false);
    }
  }, [period, schoolId]);

  const reloadMinutes = React.useCallback(async () => setMinutes(await managementDecisionRepository.list(schoolId)), [schoolId]);

  React.useEffect(() => {
    void reload();
    void reloadMinutes();
    const offWorkflow = managementNotificationWorkflow.subscribe(schoolId, () => void reload());
    const offPolicy = managementNotificationPolicy.subscribe(schoolId, () => void reload());
    const offMinutes = managementDecisionRepository.subscribe(schoolId, () => void reloadMinutes());
    return () => { offWorkflow(); offPolicy(); offMinutes(); };
  }, [reload, reloadMinutes, schoolId]);

  const exportCsv = async () => {
    if (!snapshot) return;
    const rows = [
      ["Öncelik", "Düzey", "Başlık", "Açıklama", "Sorumlu", "Son tarih", "Durum", "Eskalasyon"],
      ...snapshot.topItems.map((item) => [priorityFor(item), item.level, item.title, item.description, item.assignee || "Atanmamış", new Date(item.dueAt).toLocaleString("tr-TR"), item.status, item.escalationLevel]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
    downloadText(`HASAT_Yonetim_Brifingi_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
    await auditLog.record({ action: "publish", module: "system", targetType: "managementBriefing", targetId: schoolId, summary: "Yönetim brifingi CSV olarak dışa aktarıldı", metadata: { period } });
  };

  const printBriefing = async () => {
    if (!snapshot) return;
    const title = period === "daily" ? "Günlük Yönetim Brifingi" : "Haftalık Yönetim Brifingi";
    const win = window.open("", "_blank");
    if (!win) { setMessage("Yazdırma penceresi tarayıcı tarafından engellendi."); return; }
    const itemRows = snapshot.topItems.length
      ? snapshot.topItems.map((item, index) => `<tr><td>${index + 1}</td><td>${item.title}</td><td>${item.assignee || "Atanmamış"}</td><td>${new Date(item.dueAt).toLocaleString("tr-TR")}</td><td>${item.description}</td></tr>`).join("")
      : `<tr><td colspan="5">Öncelikli açık bildirim bulunmuyor.</td></tr>`;
    win.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#0f172a}h1{margin:0 0 4px}.meta{color:#64748b;font-size:12px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.stat{border:1px solid #cbd5e1;border-radius:10px;padding:12px}.stat b{display:block;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:11px}th{background:#f1f5f9}.sign{display:flex;justify-content:space-between;margin-top:50px}</style></head><body><h1>e-Nstitü ${title}</h1><div class="meta">Oluşturulma: ${new Date(snapshot.generatedAt).toLocaleString("tr-TR")}</div><div class="stats"><div class="stat"><b>${snapshot.active.length}</b>Açık</div><div class="stat"><b>${snapshot.overdue.length}</b>Geciken</div><div class="stat"><b>${snapshot.escalated.length}</b>Eskale</div><div class="stat"><b>%${snapshot.onTimeRate}</b>Zamanında kapanış</div></div><h2>Öncelikli Yönetim Gündemi</h2><table><thead><tr><th>#</th><th>Başlık</th><th>Sorumlu</th><th>Son tarih</th><th>Kanıt / açıklama</th></tr></thead><tbody>${itemRows}</tbody></table><div class="sign"><span>Hazırlayan</span><span>Okul Müdürü</span></div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
    await auditLog.record({ action: "publish", module: "system", targetType: "managementBriefing", targetId: schoolId, summary: "Yönetim brifingi yazdırıldı", metadata: { period } });
  };

  const createTask = async () => {
    const top = snapshot?.topItems[0];
    if (!top) { setMessage("Göreve dönüştürülecek açık bildirim bulunmuyor."); return; }
    setBusy(true);
    setMessage("");
    try {
      const currentActor = actor();
      const scope = { schoolId, userId: currentActor.userId, userName: currentActor.userName };
      const tasks = await decisionTaskRepository.list(scope);
      const decisionId = `notification:${top.notificationId}`;
      if (tasks.some((task) => task.decisionId === decisionId && task.status !== "done")) {
        setMessage("Bu bildirim için zaten aktif bir yönetim görevi bulunuyor.");
        return;
      }
      const nowIso = new Date().toISOString();
      const dueDate = new Date(top.dueAt).toISOString().slice(0, 10);
      const record: DecisionTaskRecord = {
        id: `notification-task-${Date.now()}`,
        decisionId,
        title: top.title,
        action: top.description,
        owner: top.assignee || "Okul Yönetimi",
        horizon: top.dueAt <= Date.now() + 24 * 60 * 60 * 1000 ? "Bugün" : "Bu hafta",
        targetTab: "dashboard",
        priority: priorityFor(top),
        status: "planned",
        createdAt: nowIso,
        updatedAt: nowIso,
        dueDate,
        assignee: top.assignee,
        notes: "Yönetim brifinginden otomatik oluşturuldu.",
        completionEvidence: "",
        schoolId,
        createdBy: currentActor.userId,
        createdByName: currentActor.userName,
        updatedBy: currentActor.userId,
        syncStatus: "pending",
      };
      await decisionTaskRepository.replaceAll([record, ...tasks], scope);
      await auditLog.record({ action: "create", module: "system", targetType: "decisionTask", targetId: record.id, summary: "Yönetim brifingindeki öncelikli bildirim göreve dönüştürüldü", metadata: { notificationId: top.notificationId } });
      setMessage("En öncelikli bildirim yönetim görevine dönüştürüldü.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const createMinutes = async () => {
    if (!snapshot?.topItems.length) { setMessage("Karar tutanağına aktarılacak gündem maddesi bulunmuyor."); return; }
    setMinutesBusy(true);
    try {
      const currentActor = actor();
      const now = new Date();
      const record: ManagementDecisionRecord = {
        id: `decision-minutes-${Date.now()}`, schoolId, period, meetingDate: now.toISOString().slice(0, 10),
        title: `${period === "daily" ? "Günlük" : "Haftalık"} Yönetim Karar Tutanağı`,
        items: snapshot.topItems.map((item, index) => ({ id: `item-${index + 1}`, title: item.title, decision: item.description, owner: item.assignee || "Okul Yönetimi", dueDate: new Date(item.dueAt).toISOString().slice(0, 10), notificationId: item.notificationId })),
        notes: "e-Nstitü Yönetim Brifingi üzerinden otomatik taslak oluşturuldu.", status: "draft",
        revision: 1, rootRecordId: `decision-minutes-${Date.now()}`, participants: [], signatures: [], recipients: [],
        createdAt: now.toISOString(), createdBy: currentActor.userId, createdByName: currentActor.userName,
      };
      record.rootRecordId = record.id;
      await managementDecisionRepository.save(record);
      await auditLog.record({ action: "create", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Yönetim karar tutanağı taslağı oluşturuldu", metadata: { itemCount: record.items.length } });
      setMessage("Karar tutanağı taslağı oluşturuldu.");
    } finally { setMinutesBusy(false); }
  };

  const submitMinutes = async (record: ManagementDecisionRecord) => {
    const next = { ...record, status: "pending_approval" as const, submittedAt: new Date().toISOString() };
    await managementDecisionRepository.save(next);
    await auditLog.record({ action: "publish", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Yönetim karar tutanağı onaya gönderildi" });
  };

  const approveMinutes = async (record: ManagementDecisionRecord) => {
    const currentActor = actor();
    if (record.createdBy === currentActor.userId && currentActor.userRole !== "super_admin") { setMessage("Tutanağı oluşturan kullanıcı kendi tutanağını onaylayamaz."); return; }
    setMinutesBusy(true);
    try {
      const scope = { schoolId, userId: currentActor.userId, userName: currentActor.userName };
      const tasks = await decisionTaskRepository.list(scope);
      const nowIso = new Date().toISOString();
      const createdTasks: DecisionTaskRecord[] = record.items.filter((item) => !item.taskId).map((item, index) => ({
        id: `meeting-task-${record.id}-${index + 1}`, decisionId: `minutes:${record.id}:${item.id}`, title: item.title, action: item.decision, owner: item.owner,
        horizon: item.dueDate <= new Date().toISOString().slice(0, 10) ? "Bugün" : "Bu hafta", targetTab: "dashboard", priority: 80 - index, status: "planned",
        createdAt: nowIso, updatedAt: nowIso, dueDate: item.dueDate, assignee: item.owner, notes: `Karar tutanağı: ${record.title}`, completionEvidence: "", schoolId,
        createdBy: currentActor.userId, createdByName: currentActor.userName, updatedBy: currentActor.userId, syncStatus: "pending",
      }));
      await decisionTaskRepository.replaceAll([...createdTasks, ...tasks], scope);
      const approved: ManagementDecisionRecord = { ...record, status: "approved", approvedAt: nowIso, approvedBy: currentActor.userId, approvedByName: currentActor.userName, lockedAt: nowIso, signatures: [...record.signatures.filter((signature) => signature.userId !== currentActor.userId), { userId: currentActor.userId, userName: currentActor.userName, signedAt: nowIso }], items: record.items.map((item, index) => ({ ...item, taskId: item.taskId || createdTasks[index]?.id })) };
      await managementDecisionRepository.save(approved);
      await auditLog.record({ action: "publish", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Yönetim karar tutanağı onaylandı ve görevler oluşturuldu", metadata: { taskCount: createdTasks.length } });
      setMessage(`${createdTasks.length} karar yönetim görevine dönüştürüldü.`);
    } finally { setMinutesBusy(false); }
  };

  const rejectMinutes = async (record: ManagementDecisionRecord) => {
    const note = window.prompt("Red gerekçesini yazın:");
    if (!note?.trim()) return;
    const currentActor = actor();
    await managementDecisionRepository.save({ ...record, status: "rejected", approvedAt: new Date().toISOString(), approvedBy: currentActor.userId, approvedByName: currentActor.userName, rejectionNote: note.trim() });
    await auditLog.record({ action: "update", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Yönetim karar tutanağı reddedildi", metadata: { reason: note.trim() } });
  };

  const editParticipants = async (record: ManagementDecisionRecord) => {
    if (record.status === "approved") { setMessage("Onaylı tutanak kilitlidir. Katılımcıları değiştirmek için yeni revizyon açın."); return; }
    const current = record.participants.map((participant) => `${participant.name}|${participant.role}`).join(", ");
    const input = window.prompt("Katılımcıları Ad Soyad|Görev biçiminde, virgülle ayırarak yazın:", current);
    if (input === null) return;
    const participants = input.split(",").map((value, index) => {
      const [name, role] = value.split("|").map((part) => part.trim());
      return name ? { id: `participant-${index + 1}`, name, role: role || "Katılımcı" } : null;
    }).filter(Boolean) as ManagementDecisionRecord["participants"];
    await managementDecisionRepository.save({ ...record, participants });
    await auditLog.record({ action: "update", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Karar tutanağı katılımcıları güncellendi", metadata: { participantCount: participants.length } });
  };

  const signMinutes = async (record: ManagementDecisionRecord) => {
    const currentActor = actor();
    if (record.status !== "approved") { setMessage("Tutanak ancak onaylandıktan sonra imzalanabilir."); return; }
    if (record.signatures.some((signature) => signature.userId === currentActor.userId)) { setMessage("Bu tutanağı daha önce imzaladınız."); return; }
    const signedAt = new Date().toISOString();
    await managementDecisionRepository.save({ ...record, signatures: [...record.signatures, { userId: currentActor.userId, userName: currentActor.userName, signedAt }] });
    await auditLog.record({ action: "publish", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Karar tutanağı elektronik olarak imzalandı", metadata: { revision: record.revision } });
    setMessage("Elektronik imzanız tutanağa eklendi.");
  };

  const distributeMinutes = async (record: ManagementDecisionRecord) => {
    if (record.status !== "approved") { setMessage("Yalnızca onaylanmış tutanak dağıtılabilir."); return; }
    const current = record.recipients.map((item) => `${item.name}|${item.role}|${item.userId || ""}`).join(", ");
    const input = window.prompt("Dağıtım listesini Ad Soyad|Görev|Kullanıcı ID biçiminde, virgülle ayırarak yazın:", current);
    if (input === null) return;
    const nowIso = new Date().toISOString();
    const previous = new Map(record.recipients.map((item) => [item.userId || item.name.toLocaleLowerCase("tr-TR"), item]));
    const recipients = input.split(",").map((value, index) => {
      const [name, role, userId] = value.split("|").map((part) => part.trim());
      if (!name) return null;
      const old = previous.get(userId || name.toLocaleLowerCase("tr-TR"));
      return old || { id: `recipient-${Date.now()}-${index + 1}`, userId: userId || undefined, name, role: role || "İlgili", deliveredAt: nowIso, acknowledgementDueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), reminderCount: 0, escalationLevel: 0 };
    }).filter(Boolean) as ManagementDecisionRecord["recipients"];
    const currentActor = actor();
    await managementDecisionRepository.save({ ...record, recipients, distributedAt: nowIso, distributedBy: currentActor.userId, distributedByName: currentActor.userName });
    await auditLog.record({ action: "publish", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Karar tutanağı dağıtım listesine gönderildi", metadata: { recipientCount: recipients.length, revision: record.revision } });
    setMessage(`${recipients.length} kişilik dağıtım listesi kaydedildi.`);
  };

  const remindPendingRecipients = async (record: ManagementDecisionRecord) => {
    const pending = record.recipients.filter((item) => !item.acknowledgedAt);
    if (!pending.length) { setMessage("Bu tutanakta bekleyen tebellüğ bulunmuyor."); return; }
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    let escalated = 0;
    const recipients = record.recipients.map((item) => {
      if (item.acknowledgedAt) return item;
      const dueAt = new Date(item.acknowledgementDueAt || new Date(new Date(item.deliveredAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()).getTime();
      const overdueMs = now - dueAt;
      const escalationLevel: 0 | 1 | 2 = overdueMs > 24 * 60 * 60 * 1000 ? 2 : overdueMs > 0 ? 1 : (item.escalationLevel || 0);
      if (escalationLevel > Number(item.escalationLevel || 0)) escalated += 1;
      return {
        ...item,
        acknowledgementDueAt: new Date(dueAt).toISOString(),
        lastReminderAt: nowIso,
        reminderCount: Number(item.reminderCount || 0) + 1,
        escalationLevel,
        escalatedAt: escalationLevel > 0 ? (item.escalatedAt || nowIso) : item.escalatedAt,
        escalationNote: escalationLevel === 2 ? "Tebellüğ süresi 24 saatten fazla aşıldı; okul müdürü takibine taşındı." : escalationLevel === 1 ? "Tebellüğ süresi aşıldı; okul yönetimi takibine taşındı." : item.escalationNote,
      };
    });
    await managementDecisionRepository.save({ ...record, recipients });
    await auditLog.record({ action: "publish", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Bekleyen tutanak tebellüğleri için hatırlatma ve eskalasyon işlendi", metadata: { pendingCount: pending.length, escalatedCount: escalated, revision: record.revision } });
    setMessage(`${pending.length} alıcı için hatırlatma kaydedildi${escalated ? `; ${escalated} kayıt üst yönetime taşındı` : ""}.`);
  };

  const markMinutesViewed = async (record: ManagementDecisionRecord) => {
    const currentActor = actor();
    const index = record.recipients.findIndex((item) => item.userId === currentActor.userId || item.name.toLocaleLowerCase("tr-TR") === currentActor.userName.toLocaleLowerCase("tr-TR"));
    if (index < 0) { setMessage("Dağıtım listesinde adınıza ait kayıt bulunamadı."); return; }
    const recipients = record.recipients.map((item, itemIndex) => itemIndex === index ? { ...item, viewedAt: item.viewedAt || new Date().toISOString() } : item);
    await managementDecisionRepository.save({ ...record, recipients });
    await auditLog.record({ action: "read", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Karar tutanağı görüntülendi", metadata: { revision: record.revision } });
    setMessage("Tutanağı görüntülediğiniz kaydedildi.");
  };

  const acknowledgeMinutes = async (record: ManagementDecisionRecord) => {
    const currentActor = actor();
    const index = record.recipients.findIndex((item) => item.userId === currentActor.userId || item.name.toLocaleLowerCase("tr-TR") === currentActor.userName.toLocaleLowerCase("tr-TR"));
    if (index < 0) { setMessage("Dağıtım listesinde adınıza ait kayıt bulunamadı."); return; }
    const nowIso = new Date().toISOString();
    const recipients = record.recipients.map((item, itemIndex) => itemIndex === index ? { ...item, viewedAt: item.viewedAt || nowIso, acknowledgedAt: nowIso } : item);
    await managementDecisionRepository.save({ ...record, recipients });
    await auditLog.record({ action: "publish", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Karar tutanağı tebellüğ edildi", metadata: { revision: record.revision } });
    setMessage("Tutanağı teslim aldığınız ve tebellüğ ettiğiniz kaydedildi.");
  };

  const createRevision = async (record: ManagementDecisionRecord) => {
    const currentActor = actor();
    try {
      const revision = await managementDecisionRepository.createRevision(record, currentActor);
      await auditLog.record({ action: "create", module: "system", targetType: "managementDecisionMinutes", targetId: revision.id, summary: "Onaylı karar tutanağı için yeni revizyon açıldı", metadata: { revisedFromId: record.id, revision: revision.revision } });
      setMessage(`Revizyon ${revision.revision} taslağı oluşturuldu.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const printMinutes = async (record: ManagementDecisionRecord) => {
    const win = window.open("", "_blank");
    if (!win) { setMessage("PDF/yazdırma penceresi tarayıcı tarafından engellendi."); return; }
    const rows = record.items.map((item, index) => `<tr><td>${index + 1}</td><td>${item.title}</td><td>${item.decision}</td><td>${item.owner}</td><td>${item.dueDate}</td></tr>`).join("");
    const participants = record.participants.length ? record.participants.map((item) => `<li>${item.name} — ${item.role}</li>`).join("") : "<li>Katılımcı bilgisi girilmedi.</li>";
    const signatures = record.signatures.length ? record.signatures.map((item) => `<div class="signature"><b>${item.userName}</b><span>${new Date(item.signedAt).toLocaleString("tr-TR")}</span></div>`).join("") : '<div class="signature">Elektronik imza bulunmuyor.</div>';
    const distribution = record.recipients.length ? record.recipients.map((item) => `<tr><td>${item.name}</td><td>${item.role}</td><td>${new Date(item.deliveredAt).toLocaleString("tr-TR")}</td><td>${item.acknowledgementDueAt ? new Date(item.acknowledgementDueAt).toLocaleString("tr-TR") : "—"}</td><td>${item.viewedAt ? new Date(item.viewedAt).toLocaleString("tr-TR") : "—"}</td><td>${item.acknowledgedAt ? new Date(item.acknowledgedAt).toLocaleString("tr-TR") : "Bekliyor"}</td><td>${item.reminderCount || 0}</td><td>${item.escalationLevel === 2 ? "Müdür takibi" : item.escalationLevel === 1 ? "Yönetim takibi" : "Normal"}</td></tr>`).join("") : '<tr><td colspan="8">Dağıtım yapılmadı.</td></tr>';
    win.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${record.title}</title><style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#0f172a;font-size:12px}h1{text-align:center;font-size:18px;margin:0}.meta{text-align:center;color:#64748b;margin:6px 0 18px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #94a3b8;padding:7px;vertical-align:top}th{background:#f1f5f9}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}.box{border:1px solid #cbd5e1;border-radius:8px;padding:10px}.signature{display:flex;justify-content:space-between;border-bottom:1px dotted #94a3b8;padding:8px 0}.lock{margin-top:16px;padding:8px;background:#ecfdf5;border:1px solid #a7f3d0}.footer{margin-top:24px;color:#64748b;font-size:10px}</style></head><body><h1>${record.title}</h1><div class="meta">Toplantı tarihi: ${record.meetingDate} · Revizyon: ${record.revision} · Durum: ${record.status === "approved" ? "ONAYLI" : record.status.toUpperCase()}</div><div><b>Notlar:</b> ${record.notes || "—"}</div><table><thead><tr><th>#</th><th>Gündem</th><th>Karar</th><th>Sorumlu</th><th>Son Tarih</th></tr></thead><tbody>${rows}</tbody></table><div class="grid"><div class="box"><b>Katılımcılar</b><ul>${participants}</ul></div><div class="box"><b>Elektronik İmzalar</b>${signatures}</div></div><h2>Dağıtım ve Tebliğ Takibi</h2><table><thead><tr><th>Alıcı</th><th>Görev</th><th>Dağıtım</th><th>Son Tebellüğ</th><th>Görüntüleme</th><th>Tebellüğ</th><th>Hatırlatma</th><th>Eskalasyon</th></tr></thead><tbody>${distribution}</tbody></table>${record.lockedAt ? `<div class="lock">Bu tutanak ${new Date(record.lockedAt).toLocaleString("tr-TR")} tarihinde kilitlenmiştir. Değişiklikler yalnızca yeni revizyon ile yapılabilir.</div>` : ""}<div class="footer">Kayıt No: ${record.id} · Kök kayıt: ${record.rootRecordId}${record.revisedFromId ? ` · Önceki revizyon: ${record.revisedFromId}` : ""}</div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
    await auditLog.record({ action: "publish", module: "system", targetType: "managementDecisionMinutes", targetId: record.id, summary: "Karar tutanağı PDF/yazdırma çıktısı oluşturuldu", metadata: { revision: record.revision } });
  };

  if (loading && !snapshot) return <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-bold text-slate-500">Yönetim brifingi hazırlanıyor…</div></section>;
  if (!snapshot) return null;

  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-indigo-600"><CalendarClock className="h-5 w-5" /> Yönetim Brifingi 1.0</div>
          <h2 className="mt-1 text-lg font-black text-slate-900">{period === "daily" ? "Günlük" : "Haftalık"} karar ve kapanış özeti</h2>
          <p className="mt-1 text-[10px] text-slate-500">Bildirim politikanız: {snapshot.policy.digestMode === "instant" ? "Anlık" : snapshot.policy.digestMode === "daily" ? "Günlük özet" : "Haftalık özet"}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={period} onChange={(event) => setPeriod(event.target.value as BriefingPeriod)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black text-slate-700"><option value="daily">Günlük</option><option value="weekly">Haftalık</option></select>
          <button type="button" onClick={() => void reload()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[9px] font-black text-slate-700"><RefreshCw className="h-3.5 w-3.5" /> Yenile</button>
          <button type="button" onClick={() => void exportCsv()} className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-black text-emerald-700"><Download className="h-3.5 w-3.5" /> CSV</button>
          <button type="button" onClick={() => void printBriefing()} className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[9px] font-black text-blue-700"><Printer className="h-3.5 w-3.5" /> Yazdır</button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[[snapshot.active.length,"Açık"],[snapshot.overdue.length,"Geciken"],[snapshot.escalated.length,"Eskale"],[snapshot.unassigned.length,"Atanmamış"],[`%${snapshot.onTimeRate}`,"Zamanında kapanış"]].map(([value,label]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-3"><div className="text-xl font-black text-slate-900">{value}</div><div className="text-[9px] font-black uppercase text-slate-500">{label}</div></div>)}
      </div>

      <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-700"><FileText className="h-4 w-4" /> Öncelikli gündem</div><p className="mt-1 text-[10px] text-indigo-800">{snapshot.topItems.length ? `${snapshot.topItems.length} konu yönetim kararı bekliyor.` : "Açık öncelikli konu bulunmuyor."}</p></div><button type="button" disabled={busy || !snapshot.topItems.length} onClick={() => void createTask()} className="inline-flex items-center gap-1 rounded-xl bg-indigo-700 px-3 py-2 text-[9px] font-black text-white disabled:opacity-50"><ClipboardPlus className="h-3.5 w-3.5" /> İlk konuyu göreve çevir</button></div>
        <div className="mt-3 space-y-2">{snapshot.topItems.map((item, index) => <div key={item.notificationId} className="grid gap-2 rounded-xl bg-white px-3 py-2 text-[10px] md:grid-cols-[28px_1fr_auto]"><span className="font-black text-indigo-700">{index + 1}</span><div><strong className="text-slate-900">{item.title}</strong><div className="text-slate-500">{item.description}</div></div><div className="text-right text-[9px] font-bold text-slate-600">{item.assignee || "Atanmamış"}<br/>{new Date(item.dueAt).toLocaleString("tr-TR")}</div></div>)}</div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-800"><ClipboardCheck className="h-4 w-4" /> Karar Tutanağı ve Onay Akışı</div><p className="mt-1 text-[10px] text-amber-900">Brifing maddelerini resmî karara ve görev dağıtımına dönüştürün.</p></div>
          <button type="button" disabled={minutesBusy || !snapshot.topItems.length} onClick={() => void createMinutes()} className="inline-flex items-center gap-1 rounded-xl bg-amber-700 px-3 py-2 text-[9px] font-black text-white disabled:opacity-50"><ClipboardPlus className="h-3.5 w-3.5" /> Tutanağa dönüştür</button>
        </div>
        <div className="mt-3 space-y-2">
          {minutes.slice(0, 8).map((record) => <div key={record.id} className="rounded-xl border border-amber-100 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-[11px] text-slate-900">{record.title}</strong><div className="text-[9px] text-slate-500">Rev. {record.revision} · {record.items.length} karar · {record.createdByName} · {new Date(record.createdAt).toLocaleString("tr-TR")}</div><div className="mt-1 text-[8px] font-bold text-slate-500">{record.participants.length} katılımcı · {record.signatures.length} elektronik imza · {record.recipients.length} alıcı · {record.recipients.filter((item) => item.acknowledgedAt).length} tebellüğ · {record.recipients.filter((item) => !item.acknowledgedAt).length} bekleyen · {record.recipients.filter((item) => Number(item.escalationLevel || 0) > 0 && !item.acknowledgedAt).length} eskale{record.supersededById ? " · Yeni revizyonu var" : ""}</div></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black uppercase text-slate-600">{record.status === "draft" ? "Taslak" : record.status === "pending_approval" ? "Onay bekliyor" : record.status === "approved" ? "Onaylı / Kilitli" : "Reddedildi"}</span></div>
            {record.recipients.some((item) => !item.acknowledgedAt && new Date(item.acknowledgementDueAt || 0).getTime() < Date.now()) && <div className="mt-2 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[9px] font-bold text-rose-800"><AlertTriangle className="h-3.5 w-3.5" /> {record.recipients.filter((item) => !item.acknowledgedAt && new Date(item.acknowledgementDueAt || 0).getTime() < Date.now()).length} alıcının tebellüğ süresi geçti.</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              {record.status !== "approved" && <button onClick={() => void editParticipants(record)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[8px] font-black text-slate-700"><Users className="h-3 w-3" /> Katılımcılar</button>}
              {record.status === "draft" && <button onClick={() => void submitMinutes(record)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[8px] font-black text-white"><Send className="h-3 w-3" /> Onaya gönder</button>}
              {record.status === "pending_approval" && <><button onClick={() => void approveMinutes(record)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[8px] font-black text-white"><CheckCircle2 className="h-3 w-3" /> Onayla ve görevleri oluştur</button><button onClick={() => void rejectMinutes(record)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[8px] font-black text-white"><XCircle className="h-3 w-3" /> Reddet</button></>}
              {record.status === "approved" && <><button onClick={() => void distributeMinutes(record)} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[8px] font-black text-white"><MailCheck className="h-3 w-3" /> Dağıtım</button><button onClick={() => void remindPendingRecipients(record)} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[8px] font-black text-amber-800"><BellRing className="h-3 w-3" /> Hatırlat / Eskale</button><button onClick={() => void markMinutesViewed(record)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[8px] font-black text-sky-700"><Eye className="h-3 w-3" /> Görüldü</button><button onClick={() => void acknowledgeMinutes(record)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[8px] font-black text-emerald-700"><UserCheck className="h-3 w-3" /> Tebellüğ et</button><button onClick={() => void signMinutes(record)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[8px] font-black text-white"><PenLine className="h-3 w-3" /> Elektronik imzala</button><button onClick={() => void createRevision(record)} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[8px] font-black text-white"><History className="h-3 w-3" /> Yeni revizyon</button></>}
              <button onClick={() => void printMinutes(record)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[8px] font-black text-blue-700"><FileSignature className="h-3 w-3" /> PDF / Yazdır</button>
              {record.status === "approved" && <span className="self-center text-[9px] font-bold text-emerald-700">{record.approvedByName} tarafından onaylandı · Kilitli</span>}
              {record.status === "rejected" && <span className="self-center text-[9px] font-bold text-rose-700">Red: {record.rejectionNote}</span>}
            </div>
          </div>)}
          {!minutes.length && <div className="rounded-xl bg-white px-3 py-4 text-center text-[10px] text-slate-500">Henüz karar tutanağı oluşturulmadı.</div>}
        </div>
      </div>
      {message && <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-800">{message}</div>}
    </section>
  );
}
