import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardList, Link2, Loader2, MessageCircle, Save, Trash2, UserRound, UsersRound, Webhook } from "lucide-react";
import {
  DEFAULT_MHATSAPP_SETTINGS,
  deleteWebhook,
  loadMhatsappLogs,
  loadMhatsappSettings,
  MhatsappSettings,
  registerWebhook,
  saveMhatsappSettings,
  sendTextMessage,
  sendPersonalizedBulkText,
  appendMhatsappLog,
} from "../lib/mhatsappApi";

import { sqliteStorage } from "../core/state/SyncStateStore";
import { runtimeSessionStorage } from "../lib/runtimeSessionStorage";
import TeacherLinkManager from "./behavior/TeacherLinkManager";
import ParentApprovalCenter from "./ParentApprovalCenter";

type PortalTarget = {
  id: string;
  name: string;
  number: string;
  classroom: string;
  phone: string;
};


const normalizePortalClassroom = (value: unknown) =>
  String(value || "")
    .toLocaleUpperCase("tr-TR")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[\/\\_.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^(\d+)([A-ZÇĞİÖŞÜ])$/, "$1-$2");

const portalAuthHeaders = () => {
  const sessionToken = runtimeSessionStorage.getItem("edupanel_auth_token") || "";
  return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
};

function PortalLinkManager({
  kind,
  settings,
}: {
  kind: "parent" | "student";
  settings: MhatsappSettings;
}) {
  const [targets, setTargets] = useState<PortalTarget[]>([]);
  const [serverClassrooms, setServerClassrooms] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [classroom, setClassroom] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [deliveryRows, setDeliveryRows] = useState<Array<{ id: string; name: string; number: string; status: string; ok: boolean; url?: string }>>([]);
  const [failedLinkMessages, setFailedLinkMessages] = useState<Array<{ id: string; phone: string; message: string }>>([]);


  useEffect(() => {
    let active = true;
    setBusy(true);
    setInfo("");

    fetch("/api/message-tools/portal-targets", {
      cache: "no-store",
      headers: portalAuthHeaders(),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Sınıf ve öğrenci bilgileri yüklenemedi.");
        }
        return Array.isArray(data?.items) ? data.items : [];
      })
      .then((students) => {
        if (!active) return;

        const normalizedTargets: PortalTarget[] = students
          .map((student: any) => ({
            id: String(student?.id || "").trim(),
            name: String(student?.name || "").trim(),
            number: String(student?.number || "").trim(),
            classroom: String(student?.classroom || "").trim(),
            phone: String(
              kind === "parent" ? student?.parentPhone || "" : student?.studentPhone || ""
            ).trim(),
          }))
          .filter(
            (item: PortalTarget) =>
              Boolean(item.id && item.name && item.classroom),
          );

        setTargets(normalizedTargets);
        setServerClassrooms(
          Array.from(
            new Set(
              normalizedTargets
                .map((item) => item.classroom)
                .filter(Boolean),
            ),
          ),
        );
      })
      .catch((error) => {
        if (active) {
          setInfo(error?.message || "Sınıf ve öğrenci bilgileri yüklenemedi.");
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => { active = false; };
  }, [kind]);


  const classrooms = useMemo(() => {
    const byKey = new Map<string, string>();

    const put = (value: unknown) => {
      const raw = String(value || "").trim();
      if (!raw) return;
      const key = normalizePortalClassroom(raw);
      if (!key) return;

      // Aynı sınıf birden fazla koleksiyondan gelse bile yalnızca bir kez göster.
      if (!byKey.has(key)) {
        const display = key.replace(/^(\d+)-([A-ZÇĞİÖŞÜ])$/, "$1/$2");
        byKey.set(key, display);
      }
    };

    serverClassrooms.forEach(put);
    targets.forEach((item) => put(item.classroom));

    return Array.from(byKey.values()).sort((a, b) =>
      a.localeCompare(b, "tr-TR", { numeric: true, sensitivity: "base" })
    );
  }, [serverClassrooms, targets]);

  const classTargets = useMemo(() => {
    if (!classroom) return [];
    const selectedKey = normalizePortalClassroom(classroom);
    return targets.filter(
      (item) => normalizePortalClassroom(item.classroom) === selectedKey,
    );
  }, [targets, classroom]);

  const filtered = useMemo(() => {
    if (!classroom) return [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return classTargets.filter((item) => {
      if (!q) return true;
      return `${item.number} ${item.name} ${item.classroom}`
        .toLocaleLowerCase("tr-TR")
        .includes(q);
    });
  }, [classTargets, classroom, query]);

  useEffect(() => {
    setSelected([]);
    setQuery("");
  }, [classroom]);

  const createAndSend = async (ids: string[]) => {
    if (!ids.length || busy) return;
    setBusy(true);
    setInfo("");
    setDeliveryRows([]);
    setFailedLinkMessages([]);
    try {
      const uniqueIds = Array.from(new Set(ids));
      const selectedTargets = targets.filter((item) => uniqueIds.includes(item.id));
      if (selectedTargets.length !== uniqueIds.length) {
        throw new Error("Bazı öğrenciler güncel listede bulunamadı. Sınıf listesini yeniden yükleyiniz.");
      }

      const response = await fetch("/api/behavior/teacher-links/public-portal-links", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalAuthHeaders() },
        body: JSON.stringify({
          kind,
          targets: selectedTargets.map((item) => ({
            id: item.id,
            name: item.name,
            number: item.number,
            classroom: item.classroom,
            phone: item.phone,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Linkler oluşturulamadı.");

      const links = Array.isArray(data.links) ? data.links : [];
      const linkById = new Map<string, any>(links.map((item: any) => [String(item.requestId || ""), item]));
      const rows: Array<{ id: string; name: string; number: string; phone: string; message: string }> = [];
      const initial: Array<{ id: string; name: string; number: string; status: string; ok: boolean; url?: string }> = [];
      for (const item of selectedTargets) {
        const link = linkById.get(item.id);
        if (!link?.url) {
          initial.push({ id: item.id, name: item.name, number: item.number, status: "Kişisel bağlantı oluşturulamadı.", ok: false });
          continue;
        }
        if (!link.phone) {
          initial.push({ id: item.id, name: item.name, number: item.number, status: "Telefon numarası kayıtlı değil; bağlantıyı başka yolla paylaşabilirsiniz.", ok: false, url: String(link.url) });
          continue;
        }
        rows.push({
          id: item.id,
          name: item.name,
          number: item.number,
          message: kind === "parent"
            ? `e-Nstitü Veli Uygulaması\n\n${item.name} için size özel uygulama bağlantısı:\n${link.url}\n\nBağlantıyı açarak uygulamayı telefonunuza yükleyebilirsiniz.`
            : `e-Nstitü Öğrenci Uygulaması\n\n${item.name}, size özel uygulama bağlantınız:\n${link.url}\n\nBağlantıyı açarak uygulamayı telefonunuza yükleyebilirsiniz.`,
          // Telefonu saklayan API'nin ürettiği değer kullanılır; öğrenci kartı üzerinden tahmin edilmez.
          phone: String(link.phone),
        });
      }
      if (!rows.length) {
        setDeliveryRows(initial);
        setInfo(`Seçilen ${selectedTargets.length} öğrencinin hiçbirine gönderim yapılamadı. Eksik telefon ve bağlantı durumlarını aşağıda kontrol ediniz.`);
        return;
      }
      const result = await sendPersonalizedBulkText(settings, rows.map((item) => ({
        number: item.phone, message: item.message,
      })));
      const statuses = rows.map((item, index) => {
        const sent = result.recipients?.[index];
        return {
          id: item.id,
          name: item.name,
          number: item.number,
          ok: Boolean(sent?.ok),
          status: sent?.ok ? "API kabul etti · Teslimat bilinmiyor" : sent?.error || sent?.status || "Gönderim onaylanmadı.",
          url: String(linkById.get(item.id)?.url || ""),
        };
      });
      const combined = [...initial, ...statuses];
      setDeliveryRows(combined);
      setFailedLinkMessages(rows.filter((_, index) => !result.recipients?.[index]?.ok)
        .map((item) => ({ id: item.id, phone: item.phone, message: item.message })));
      const passed = combined.filter((item) => item.ok).length;
      setInfo(`Seçilen: ${selectedTargets.length} · API tarafından kabul edilen: ${passed} · Onay alınamayan: ${combined.length - passed}. API kabulü telefona teslimat anlamına gelmez. Ayrıntılar aşağıda.`);
    } catch (error: any) {
      setInfo(error?.message || "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const retryFailedViaStandard = async () => {
    if (busy || !failedLinkMessages.length) return;
    setBusy(true);
    setInfo("Yalnız önceki denemede onay alınamayan alıcılar alternatif API ile kontrol ediliyor…");
    const pending = [...failedLinkMessages];
    try {
      const result = await sendPersonalizedBulkText(settings, pending.map((item) => ({
        number: item.phone, message: item.message,
      })), "standard");
      const outcome = new Map<string, { ok: boolean; status: string }>();
      pending.forEach((item, index) => {
        const response = result.recipients?.[index];
        outcome.set(item.id, {
          ok: Boolean(response?.ok),
          status: response?.ok
            ? "Alternatif API kabul etti · Teslimat bilinmiyor"
            : response?.error || response?.status || "Alternatif API gönderimi onaylamadı.",
        });
      });
      setDeliveryRows((current) => current.map((item) => {
        const latest = outcome.get(item.id);
        return latest ? { ...item, ...latest } : item;
      }));
      const stillFailed = pending.filter((item) => !outcome.get(item.id)?.ok);
      setFailedLinkMessages(stillFailed);
      setInfo(`Alternatif API denemesi: ${pending.length - stillFailed.length} API kabulü, ${stillFailed.length} onaysız. Mesajların telefona ulaştığı doğrulanmadı; kabul edilen alıcılara tekrar gönderim yapılmadı.`);
    } catch (error: any) {
      setInfo(error?.message || "Alternatif API denemesi başarısız.");
    } finally {
      setBusy(false);
    }
  };

  const visibleIds = filtered.map((item) => item.id);
  const classIds = classTargets.map((item) => item.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const allClassSelected =
    classIds.length > 0 && classIds.every((id) => selected.includes(id));

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-black text-slate-900">
          {kind === "parent" ? "Veli Uygulama Linkleri" : "Öğrenci Uygulama Linkleri"}
        </h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Önce sınıfı seçin. Ardından öğrencileri tek tek veya toplu seçerek kişisel uygulama linklerini gönderin.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[240px_1fr]">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">
            Sınıf
          </span>
          <select
            value={classroom}
            onChange={(event) => setClassroom(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-black outline-none focus:border-sky-500"
          >
            <option value="">Sınıf seçiniz</option>
            {classrooms.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">
            Öğrenci Ara
          </span>
          <input
            value={query}
            disabled={!classroom}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={classroom ? "Numara veya ad soyad ara…" : "Önce sınıf seçiniz"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-sky-400 disabled:opacity-50"
          />
        </label>
      </div>

      {classroom ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={() =>
                setSelected((current) =>
                  allVisibleSelected
                    ? current.filter((id) => !visibleIds.includes(id))
                    : Array.from(new Set([...current, ...visibleIds])),
                )
              }
              className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-[10px] font-black text-sky-700 disabled:opacity-40"
            >
              {allVisibleSelected ? "Görünenlerin seçimini kaldır" : "Görünenlerin tümünü seç"}
            </button>

            <button
              type="button"
              disabled={classTargets.length === 0}
              onClick={() =>
                setSelected((current) =>
                  allClassSelected
                    ? current.filter((id) => !classIds.includes(id))
                    : Array.from(new Set([...current, ...classIds])),
                )
              }
              className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-[10px] font-black text-violet-700 disabled:opacity-40"
            >
              {allClassSelected ? "Sınıf seçimini kaldır" : `Sınıfın tümünü seç · ${classTargets.length}`}
            </button>

            <span className="ml-auto rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-600">
              {selected.length} seçili
            </span>
          </div>

          <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
            {filtered.map((item) => {
              const checked = selected.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex w-full items-center gap-2 rounded-xl border px-2 py-2 ${
                    checked
                      ? "border-sky-300 bg-white ring-1 ring-sky-100"
                      : "border-transparent bg-white/80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${
                      checked ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      {checked ? "✓" : "–"}
                    </span>

                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-black text-slate-900">
                        {item.name || `Öğrenci ${item.number || ""}`}
                      </strong>
                      <span className="mt-0.5 block truncate text-[10px] font-bold text-slate-500">
                        No {item.number || "—"} · {item.classroom}
                      </span>
                      <span className={`mt-0.5 block truncate text-[9px] font-bold ${
                        item.phone ? "text-emerald-600" : "text-rose-500"
                      }`}>
                        {kind === "parent" ? "Veli telefonu" : "Öğrenci telefonu"}: {item.phone || "Kayıtlı değil"}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={busy || !item.phone}
                    onClick={() => void createAndSend([item.id])}
                    className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2.5 text-[10px] font-black text-white disabled:bg-slate-300"
                  >
                    {item.phone ? "Tek Gönder" : "Telefon yok"}
                  </button>
                </div>
              );
            })}

            {!busy && filtered.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold text-slate-400">
                Bu sınıfta gösterilecek öğrenci bulunamadı.
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={() => void createAndSend(selected)}
              className="rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-black text-white disabled:bg-slate-300"
            >
              {busy ? "Gönderiliyor…" : `Seçilenlere Gönder · ${selected.length}`}
            </button>

            <button
              type="button"
              disabled={busy || classIds.length === 0}
              onClick={() => void createAndSend(classIds)}
              className="rounded-2xl bg-sky-600 px-4 py-3.5 text-sm font-black text-white disabled:bg-slate-300"
            >
              {busy ? "Gönderiliyor…" : `Sınıfın Tümüne Gönder · ${classIds.length}`}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <strong className="block text-sm font-black text-slate-700">Önce sınıf seçiniz</strong>
          <span className="mt-1 block text-xs font-semibold text-slate-400">
            Öğrenci isimleri sınıf seçildikten sonra listelenecek.
          </span>
        </div>
      )}

      {info ? (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
          {info}
        </div>
      ) : null}
      {failedLinkMessages.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-bold text-amber-900">
            {failedLinkMessages.length} alıcı için mHatsapp onayı alınmadı. Mesaj iletilmiş olma ihtimaline karşı, aşağıdaki işlem yalnızca açık onayınızla ikinci bir deneme yapar.
          </p>
          <button type="button" disabled={busy}
            onClick={() => {
              if (window.confirm("Yalnızca önceki denemede onay alınamayan " + failedLinkMessages.length + " alıcıya alternatif API üzerinden tekrar mesaj gönderilsin mi? Mükerrer mesaj ihtimali vardır.")) {
                void retryFailedViaStandard();
              }
            }}
            className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
            {busy ? "Gönderim sürüyor…" : `Onaysız ${failedLinkMessages.length} Alıcıyı Alternatif API ile Dene`}
          </button>
        </div>
      ) : null}
      {deliveryRows.length > 0 ? (
        <p className="mt-3 text-xs font-semibold text-slate-600">Sarı: yalnız API kabulü, telefon teslimatı bilinmiyor. Kırmızı: gönderim onayı yok veya telefon hatalı. Bağlantılar başka bir iletişim kanalıyla paylaşılabilir.</p>
      ) : null}
      {deliveryRows.length > 0 ? (
        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2" aria-label="Öğrenci bazında mesaj gönderim sonuçları">
          {deliveryRows.map((item) => (
            <div key={item.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-lg px-3 py-2 text-xs ${item.ok ? "bg-amber-50 text-amber-900" : "bg-rose-50 text-rose-800"}`}>
              <span className="font-semibold">{item.name} · No {item.number || "—"}</span>
              <span className="flex flex-wrap items-center justify-end gap-2 text-right">
                <span className="font-bold">{item.status}</span>
                {item.url ? <button type="button"
                  onClick={() => void navigator.clipboard.writeText(item.url!)}
                  className="rounded-md border border-current px-2 py-1 font-bold">
                  Linki Kopyala
                </button> : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ResultBox({ result }: { result: any }) {
  if (!result) return null;
  const ok = Boolean(result.ok);
  const recipients = Array.isArray(result.recipients) ? result.recipients : [];
  return (
    <div className={`rounded-2xl border p-4 text-sm font-semibold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
      <div className="flex items-start gap-2">
        {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
        <div className="min-w-0">
          <div>{ok ? (result.status || "İşlem başarılı.") : result.error || result.status || "İşlem başarısız."}</div>
          {result.httpStatus ? <div className="mt-1 text-xs opacity-75">HTTP: {result.httpStatus}</div> : null}
          {recipients.length > 0 && (
            <div className="mt-2 space-y-1">
              {recipients.map((item: any) => (
                <div key={item.number} className="rounded-lg bg-white/60 px-2 py-1 text-xs">
                  <span className="font-black">{item.number}:</span>{" "}
                  {item.ok ? `Gönderildi${item.id ? ` • ID: ${item.id}` : ""}` : item.error || item.status || "Başarısız"}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageToolsModule() {
  const [view, setView] = useState<"api" | "links">("api");
  const [linkType, setLinkType] = useState<"teacher" | "student" | "parent" | "parent-approval" | null>(null);
  const [settings, setSettings] = useState<MhatsappSettings>(() => loadMhatsappSettings());
  const [testNumber, setTestNumber] = useState("");
  const [testMessage, setTestMessage] = useState("e-Nstitü WhatsApp API test mesajıdır.");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logRefresh, setLogRefresh] = useState(0);

  const logs = useMemo(() => loadMhatsappLogs(), [logRefresh]);
  const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";
  const labelClass = "mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500";

  const syncMhatsappSettingsToServer = async (nextSettings: MhatsappSettings) => {
    if (!String(nextSettings.token || "").trim()) return;
    const response = await fetch("/api/mhatsapp/runtime-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: nextSettings.baseUrl, token: nextSettings.token }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "mHatsapp ayarları sunucuya aktarılamadı.");
  };

  useEffect(() => {
    if (!String(settings.token || "").trim()) return;
    syncMhatsappSettingsToServer(settings).catch(() => {
      // Eski kayıt ilk açılışta otomatik senkronize edilir; sunucu kapalıysa kullanıcı kaydederken tekrar denenir.
    });
    // Yalnız ilk yüklemede mevcut kayıtlı mHatsapp ayarını backend'e aktar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    try {
      saveMhatsappSettings(settings);
      await syncMhatsappSettingsToServer(settings);
      setResult({ ok: true, status: "WhatsApp API ayarları kaydedildi ve Veli Onay OTP sistemiyle eşitlendi." });
    } catch (error: any) {
      setResult({ ok: false, error: error?.message || "WhatsApp API ayarları kaydedilemedi." });
    }
  };

  const run = async (fn: () => Promise<any>, logType: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fn();
      setResult(res);
      appendMhatsappLog({ type: logType, ok: res.ok, status: res.status || res.error, raw: res.raw });
      setLogRefresh((v) => v + 1);
    } finally {
      setLoading(false);
    }
  };

  if (view === "links") {
    return (
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                type="button"
                onClick={() => {
                  setLinkType(null);
                  setView("api");
                }}
                className="mb-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
              >
                <ArrowLeft className="h-4 w-4" /> Mesaj Araçları
              </button>
              <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                <Link2 className="h-6 w-6 text-emerald-600" /> Link İşlemleri
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Öğretmen, öğrenci ve veli için kişisel uygulama bağlantılarını yönetin.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setLinkType("teacher")}
            className={`rounded-[2rem] border p-6 text-left shadow-sm transition ${
              linkType === "teacher"
                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <UsersRound className="h-6 w-6" />
            </span>
            <strong className="mt-5 block text-lg font-black text-slate-900">Öğretmen Linki</strong>
            <span className="mt-2 block text-sm leading-6 text-slate-500">
              Davranış, ödev ve soru işlemleri için öğretmen uygulama bağlantılarını oluşturun ve gönderin.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLinkType("student")}
            className={`rounded-[2rem] border p-6 text-left shadow-sm transition ${
              linkType === "student"
                ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
                : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <UserRound className="h-6 w-6" />
            </span>
            <strong className="mt-5 block text-lg font-black text-slate-900">Öğrenci Linki</strong>
            <span className="mt-2 block text-sm leading-6 text-slate-500">
              Öğrenciye özel bağlantı işlemleri bu alanda yönetilecektir.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLinkType("parent")}
            className={`rounded-[2rem] border p-6 text-left shadow-sm transition ${
              linkType === "parent"
                ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100"
                : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/40"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <UsersRound className="h-6 w-6" />
            </span>
            <strong className="mt-5 block text-lg font-black text-slate-900">Veli Linki</strong>
            <span className="mt-2 block text-sm leading-6 text-slate-500">
              Veliye özel bağlantı işlemleri bu alanda yönetilecektir.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLinkType("parent-approval")}
            className={`rounded-[2rem] border p-6 text-left shadow-sm transition ${
              linkType === "parent-approval"
                ? "border-fuchsia-500 bg-fuchsia-50 ring-2 ring-fuchsia-100"
                : "border-slate-200 bg-white hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-100 text-fuchsia-700">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <strong className="mt-5 block text-lg font-black text-slate-900">Veli Onay Merkezi</strong>
            <span className="mt-2 block text-sm leading-6 text-slate-500">
              İzin taleplerini oluşturun, WhatsApp ile gönderin ve onay/ret durumlarını izleyin.
            </span>
          </button>
        </section>

        {linkType === "teacher" && (
          <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Öğretmen davranış uygulaması</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Öğretmen davranış linki yönetimi açıldı. Linkler aynı ekranda hazırlanır, kopyalanır veya WhatsApp ile gönderilir.
            </p>
          </section>
        )}

        {linkType === "student" && (
          <PortalLinkManager kind="student" settings={settings} />
        )}

        {linkType === "parent" && (
          <PortalLinkManager kind="parent" settings={settings} />
        )}

        {linkType === "parent-approval" && (
          <ParentApprovalCenter settings={settings} />
        )}

        <TeacherLinkManager
          open={linkType === "teacher"}
          onClose={() => setLinkType(null)}
          teachers={[]}
          students={[]}
          behaviors={[]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
              <MessageCircle className="h-6 w-6 text-emerald-600" /> WhatsApp API Yapılandırması
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Bu ekran yalnızca mHatsapp API token, base URL, webhook ve test bağlantısı içindir. Mesaj gönderimi WhatsApp &gt; Mesaj Gönder ekranından yapılır.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setView("links")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-[16.67px] font-black text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800">
              <Link2 className="h-4 w-4" /> Link İşlemleri
            </button>
            <button onClick={handleSave} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-[16.67px] font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">
              <Save className="h-4 w-4" /> Ayarları Kaydet
            </button>
          </div>
        </div>
      </section>

      <ResultBox result={result} />

      <section className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-slate-800">API Bilgileri</h2>
          <div>
            <label className={labelClass}>Base URL</label>
            <input className={inputClass} value={settings.baseUrl} onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })} placeholder={DEFAULT_MHATSAPP_SETTINGS.baseUrl} />
          </div>
          <div>
            <label className={labelClass}>API Token</label>
            <input className={inputClass} type="password" value={settings.token} onChange={(e) => setSettings({ ...settings, token: e.target.value })} placeholder="Panelden alınan API token" />
          </div>
          <div>
            <label className={labelClass}>Toplu gönderim bekleme süresi (ms)</label>
            <input className={inputClass} type="number" min={0} value={settings.delayMs} onChange={(e) => setSettings({ ...settings, delayMs: Number(e.target.value || 0) })} />
            <p className="mt-2 text-xs font-semibold text-slate-500">Spam riskini azaltmak için toplu gönderimde 1000-3000 ms arası önerilir.</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-800"><Webhook className="h-5 w-5 text-indigo-600" /> Webhook</h2>
          <div>
            <label className={labelClass}>Callback URL</label>
            <input className={inputClass} value={settings.webhookUrl || ""} onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })} placeholder="https://site.com/wa-hook/gizli-anahtar" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button disabled={loading} onClick={() => run(() => registerWebhook(settings, settings.webhookUrl || ""), "register-webhook")} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Webhook Kaydet</button>
            <button disabled={loading} onClick={() => run(() => deleteWebhook(settings), "delete-webhook")} className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 disabled:opacity-50">Webhook Sil</button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-black text-slate-800">Test Mesajı</h2>
        <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800">Test mesajı tek alıcıya <strong>send-msg-blocking</strong> adresiyle gönderilir. Sonuçta mesaj kimliği alınırsa WhatsApp altyapısına gönderim onaylanmış demektir.</p>
        <div className="grid gap-4 lg:grid-cols-[240px_1fr_auto]">
          <input className={inputClass} value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="0532 123 45 67" />
          <input className={inputClass} value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
          <button disabled={loading} onClick={() => run(() => sendTextMessage(settings, [testNumber], testMessage), "test-text")} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test Gönder"}
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-800"><ClipboardList className="h-5 w-5 text-slate-600" /> Son Gönderim Kayıtları</h2>
          <button onClick={() => { sqliteStorage.removeItem("rota_mhatsapp_logs_v1"); setLogRefresh((v) => v + 1); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"><Trash2 className="h-3.5 w-3.5" /> Temizle</button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {logs.length === 0 ? <p className="text-sm font-semibold text-slate-400">Henüz kayıt yok.</p> : logs.slice(0, 50).map((log) => (
            <div key={log.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
              <div className="flex justify-between gap-3"><span>{log.type}</span><span>{new Date(log.date).toLocaleString("tr-TR")}</span></div>
              <div className={log.ok ? "text-emerald-600" : "text-rose-600"}>{log.ok ? "Başarılı" : "Başarısız"} {log.status ? `- ${log.status}` : ""}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
