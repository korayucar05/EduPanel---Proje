import React, { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  Trash2,
  Calendar,
  Bookmark,
  Check,
  X,
  AlertCircle,
  Newspaper,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Announcement } from "../types";
import { runtimeSessionStorage } from "../lib/runtimeSessionStorage";

interface AnnouncementModuleProps {
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
}

type NewsItem = {
  id: string;
  source: string;
  title: string;
  url: string;
  content: string;
  publishedAt: string;
  date: string;
  time: string;
};

type PublishedNewsItem = NewsItem & {
  id: string;
  externalId: string;
  schoolId: string;
  publishedBy: string;
  selectedAt: string;
  active: boolean;
};

type ManagerSetting = {
  id: string;
  schoolId: string;
  managerId: string;
  managerName: string;
  managerRole?: string;
  updatedAt: string;
  updatedBy?: string;
};

type AuthUser = {
  id?: string;
  schoolId?: string;
  role?: string;
  name?: string;
  fullName?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
};

type PersonOption = { id: string; name: string; role?: string };

const normalize = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");

const userDisplayName = (user: AuthUser | null) => {
  if (!user) return "";
  return String(
    user.fullName ||
      user.displayName ||
      user.name ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      "",
  ).trim();
};

const authHeaders = (includeJson = false) => {
  const headers: Record<string, string> = {};
  const token = runtimeSessionStorage.getItem("edupanel_auth_token") || "";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
};

const fetchCollection = async (name: string) => {
  const response = await fetch(`/api/database/collections/${encodeURIComponent(name)}`, { cache: "no-store" });
  if (!response.ok) return [] as any[];
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
};



export default function AnnouncementModule({ announcements, setAnnouncements }: AnnouncementModuleProps) {
  const [activeSection, setActiveSection] = useState<"announcements" | "news">("announcements");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    tag: "Genel" as "Önemli" | "Genel" | "Etkinlik",
  });

  const [managerSetting, setManagerSetting] = useState<ManagerSetting | null>(null);
  const [managerCandidates, setManagerCandidates] = useState<PersonOption[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [newsPool, setNewsPool] = useState<NewsItem[]>([]);
  const [publishedNews, setPublishedNews] = useState<PublishedNewsItem[]>([]);
  const [selectedNewsIds, setSelectedNewsIds] = useState<string[]>([]);
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [serverCanAssign, setServerCanAssign] = useState(false);
  const [serverCanManage, setServerCanManage] = useState(false);

  const canAssignNewsManager = serverCanAssign;
  const canManageNews = serverCanManage;

  useEffect(() => {
    const applyRequestedSection = (event?: Event) => {
      const eventSection = String((event as CustomEvent | undefined)?.detail?.subTab || "");
      const storedSection = runtimeSessionStorage.getItem("edupanel_announcement_subtab_request") || "";
      const requestedSection = eventSection || storedSection;
      if (requestedSection === "news") setActiveSection("news");
      if (requestedSection === "announcements") setActiveSection("announcements");
      if (storedSection) runtimeSessionStorage.removeItem("edupanel_announcement_subtab_request");
    };

    applyRequestedSection();
    window.addEventListener("edupanel-announcement-subtab", applyRequestedSection);
    return () => window.removeEventListener("edupanel-announcement-subtab", applyRequestedSection);
  }, []);

  const loadNewsConfiguration = async (forceNews = false) => {
    setNewsBusy(true);
    setNewsError("");
    try {
      const [configResponse, teacherRows, schoolTeacherRows, publishedResponse, newsResponse] = await Promise.all([
        fetch("/api/news-management/config", { cache: "no-store", headers: authHeaders() }).then(async (response) => response.ok ? response.json() : Promise.reject(await response.json().catch(() => ({})))).catch((error) => { throw new Error(error?.error || "Haber yönetimi yetkisi okunamadı."); }),
        fetchCollection("teachers"),
        fetchCollection("school_teachers"),
        fetch("/api/news-management/published", { cache: "no-store", headers: authHeaders() }).then(async (response) => response.ok ? response.json() : ({ items: [] })).catch(() => ({ items: [] })),
        fetch(`/api/mobile/news/latest${forceNews ? "?refresh=1" : ""}`, { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null).catch(() => null),
      ]);

      const user = (configResponse?.user || null) as AuthUser | null;
      const currentSchoolId = String(configResponse?.schoolId || user?.schoolId || "school-main").trim() || "school-main";
      setServerCanAssign(Boolean(configResponse?.canAssign));
      setServerCanManage(Boolean(configResponse?.canManage));

      const manager = (configResponse?.setting || null) as ManagerSetting | null;
      setManagerSetting(manager);
      setSelectedManagerId(String(manager?.managerId || ""));

      const options = new Map<string, PersonOption>();
      if (user?.id && userDisplayName(user)) {
        options.set(String(user.id), { id: String(user.id), name: userDisplayName(user), role: String(user.role || "") });
      }
      [...teacherRows, ...schoolTeacherRows].forEach((row: any, index: number) => {
        const rowSchoolId = String(row?.schoolId || "").trim();
        if (rowSchoolId && rowSchoolId !== currentSchoolId) return;
        const name = String(row?.name || row?.fullName || row?.teacherName || row?.displayName || "").trim();
        if (!name) return;
        const id = String(row?.id || row?.teacherId || `teacher-${index}-${normalize(name)}`);
        if (!options.has(id)) options.set(id, { id, name, role: "teacher" });
      });
      setManagerCandidates(Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name, "tr")));

      const activePublished = (Array.isArray(publishedResponse?.items) ? publishedResponse.items : [])
        .filter((row: any) => row?.active !== false)
        .sort((a: any, b: any) => String(b?.publishedAt || b?.selectedAt || "").localeCompare(String(a?.publishedAt || a?.selectedAt || "")));
      setPublishedNews(activePublished as PublishedNewsItem[]);

      const items = Array.isArray(newsResponse?.items) ? newsResponse.items : [];
      setNewsPool(items as NewsItem[]);
    } catch (error: any) {
      setNewsError(error?.message || "Haber yönetimi verileri yüklenemedi.");
    } finally {
      setNewsBusy(false);
    }
  };

  useEffect(() => {
    if (activeSection !== "news") return;
    void loadNewsConfiguration(false);
  }, [activeSection]);

  const handleDelete = (id: string) => {
    if (window.confirm("Bu duyuruyu panodan kaldırmak istediğinizden emin misiniz?")) {
      setAnnouncements((prev) => prev.filter((ann) => ann.id !== id));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      setFormError("Lütfen duyuru başlığını ve detaylı içeriğini doldurunuz.");
      return;
    }
    const newAnnouncement: Announcement = {
      id: `ANN-${Math.floor(100 + Math.random() * 900)}`,
      title: formData.title.trim(),
      content: formData.content.trim(),
      date: new Date().toISOString().split("T")[0],
      tag: formData.tag,
    };
    setAnnouncements((prev) => [newAnnouncement, ...prev]);
    setIsModalOpen(false);
  };

  const saveManager = async () => {
    if (!canAssignNewsManager) return;
    const candidate = managerCandidates.find((item) => item.id === selectedManagerId);
    if (!candidate) {
      setNewsError("Lütfen haber yöneticisi olarak görevlendirilecek kişiyi seçiniz.");
      return;
    }
    setNewsBusy(true);
    setNewsError("");
    try {
      const response = await fetch("/api/news-management/manager", {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ managerId: candidate.id, managerName: candidate.name, managerRole: candidate.role || "" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Haber yöneticisi kaydedilemedi.");
      setManagerSetting(payload?.setting || null);
      setServerCanManage(Boolean(payload?.canManage));
      await loadNewsConfiguration(false);
    } catch (error: any) {
      setNewsError(error?.message || "Haber yöneticisi kaydedilemedi.");
    } finally {
      setNewsBusy(false);
    }
  };

  const toggleNewsSelection = (id: string) => {
    setSelectedNewsIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const publishSelectedNews = async () => {
    if (!canManageNews || selectedNewsIds.length === 0) return;
    const selected = newsPool.filter((item) => selectedNewsIds.includes(item.id));
    if (!selected.length) return;
    setNewsBusy(true);
    setNewsError("");
    try {
      const response = await fetch("/api/news-management/publish", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ items: selected }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Seçilen haberler yayınlanamadı.");
      setSelectedNewsIds([]);
      await loadNewsConfiguration(false);
    } catch (error: any) {
      setNewsError(error?.message || "Seçilen haberler yayınlanamadı.");
    } finally {
      setNewsBusy(false);
    }
  };

  const removePublishedNews = async (item: PublishedNewsItem) => {
    if (!canManageNews) return;
    if (!window.confirm("Bu haberi mobil uygulamadaki Haberler alanından kaldırmak istiyor musunuz?")) return;
    setNewsBusy(true);
    setNewsError("");
    try {
      const response = await fetch(`/api/news-management/published/${encodeURIComponent(item.id)}`, { method: "DELETE", headers: authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Haber yayından kaldırılamadı.");
      setPublishedNews((current) => current.filter((row) => row.id !== item.id));
    } catch (error: any) {
      setNewsError(error?.message || "Haber yayından kaldırılamadı.");
    } finally {
      setNewsBusy(false);
    }
  };

  const publishedExternalIds = useMemo(() => new Set(publishedNews.map((item) => String(item.externalId || ""))), [publishedNews]);

  return (
    <div id="announcements-tab" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2">
          <button type="button" onClick={() => setActiveSection("announcements")} className={`rounded-xl px-4 py-2.5 text-xs font-black ${activeSection === "announcements" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            Duyuru Yönetimi
          </button>
          <button type="button" onClick={() => setActiveSection("news")} className={`rounded-xl px-4 py-2.5 text-xs font-black ${activeSection === "news" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            Haber Yönetimi
          </button>
        </div>
      </div>

      {activeSection === "announcements" ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Akademik Takvim & Duyuru Yönetimi</h2>
              <p className="text-xs text-slate-400 mt-0.5">Tüm veli, öğrenci ve öğretmenlerimize yönelik resmi duyurular.</p>
            </div>
            <button id="new-announcement-btn" onClick={() => { setFormData({ title: "", content: "", tag: "Genel" }); setFormError(""); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 shadow-sm">
              <Plus className="w-4 h-4" /><span>Panoya Duyuru Yaz</span>
            </button>
          </div>

          <div id="announcement-list-timeline" className="space-y-6 max-w-4xl">
            {announcements.map((ann) => (
              <div id={`ann-card-${ann.id}`} key={ann.id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group relative flex flex-col sm:flex-row gap-5 items-start">
                <div className="shrink-0 flex sm:flex-col items-start gap-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg border ${ann.tag === "Önemli" ? "bg-rose-50 text-rose-600 border-rose-100" : ann.tag === "Etkinlik" ? "bg-sky-50 text-sky-600 border-sky-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"}`}><Bookmark className="w-3 h-3" />{ann.tag}</span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold font-mono"><Calendar className="w-3.5 h-3.5" /><span>{ann.date}</span></div>
                </div>
                <div className="hidden sm:block w-px self-stretch bg-slate-100" />
                <div className="flex-1 space-y-2 text-left"><h3 className="font-extrabold text-slate-800 text-base leading-snug">{ann.title}</h3><p className="text-xs text-slate-500 font-medium leading-relaxed whitespace-pre-line">{ann.content}</p></div>
                <button onClick={() => handleDelete(ann.id)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100" title="Duyuruyu Sil"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {announcements.length === 0 && <div className="bg-white border border-slate-100 text-center py-16 rounded-3xl p-6 text-slate-400 font-semibold">Duyuru panosu şu an boş.</div>}
          </div>
        </>
      ) : (
        <div className="space-y-5">
          <div className="rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-50 to-indigo-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-sky-600" /><h2 className="text-lg font-black text-slate-800">Okul Haber Yönetimi</h2></div>
                <p className="mt-1 max-w-2xl text-xs font-semibold text-slate-500">Üç onaylı kaynaktan gelen haberler önce bu havuza düşer. Mobil uygulamada yalnız Haber Yöneticisinin seçip yayınladığı haberler görünür.</p>
              </div>
              <button type="button" disabled={newsBusy} onClick={() => void loadNewsConfiguration(true)} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-black text-sky-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${newsBusy ? "animate-spin" : ""}`} />Kaynakları Yenile</button>
            </div>
          </div>

          {newsError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{newsError}</div> : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-600" /><h3 className="font-black text-slate-800">Haber Yöneticisi</h3></div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-black text-slate-500">Bu okul için görevli kişi</label>
                <select value={selectedManagerId} onChange={(event) => setSelectedManagerId(event.target.value)} disabled={!canAssignNewsManager || newsBusy} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 disabled:bg-slate-50">
                  <option value="">Görevli seçiniz</option>
                  {managerCandidates.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </div>
              {canAssignNewsManager ? <button type="button" onClick={() => void saveManager()} disabled={!selectedManagerId || newsBusy} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">Görevlendirmeyi Kaydet</button> : null}
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              {managerSetting ? <><UserRound className="mr-1 inline h-4 w-4 text-slate-400" />Aktif Haber Yöneticisi: <strong>{managerSetting.managerName}</strong></> : "Bu okul için henüz Haber Yöneticisi atanmadı."}
            </div>
          </section>

          {!canManageNews ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800">
              Haber havuzunu yalnız bu okulun atanmış Haber Yöneticisi yönetebilir. Okul yöneticileri yukarıdaki alandan görevlendirmeyi değiştirebilir.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-black text-slate-800">Haber Havuzu</h3><p className="text-[11px] font-semibold text-slate-400">Yayınlamak istediğiniz haberleri işaretleyiniz.</p></div>
                  <button type="button" disabled={!selectedNewsIds.length || newsBusy} onClick={() => void publishSelectedNews()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><Send className="h-4 w-4" />Seçilenleri Yayınla ({selectedNewsIds.length})</button>
                </div>
                {newsBusy && !newsPool.length ? <div className="flex items-center gap-2 py-8 text-xs font-bold text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Haberler yükleniyor...</div> : null}
                <div className="mt-4 divide-y divide-slate-100">
                  {newsPool.map((item) => {
                    const published = publishedExternalIds.has(String(item.id));
                    const checked = selectedNewsIds.includes(item.id);
                    return <div key={item.id} className="flex items-start gap-3 py-3">
                      <input type="checkbox" checked={checked || published} disabled={published} onChange={() => toggleNewsSelection(item.id)} className="mt-1 h-4 w-4 rounded border-slate-300" />
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-800">{item.title}</strong>{published ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">YAYINDA</span> : null}</div><p className="mt-1 text-[10px] font-bold text-slate-400">{item.source} · {item.date} {item.time}</p></div>
                      <button type="button" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-sky-600" title="Kaynağında aç"><ExternalLink className="h-4 w-4" /></button>
                    </div>;
                  })}
                  {!newsPool.length && !newsBusy ? <div className="py-8 text-center text-xs font-bold text-slate-400">Kaynaklardan haber alınamadı.</div> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h3 className="font-black text-slate-800">Yayındaki Haberler</h3></div>
                <div className="mt-4 divide-y divide-slate-100">
                  {publishedNews.map((item) => <div key={item.id} className="flex items-start gap-3 py-3"><div className="min-w-0 flex-1"><strong className="text-sm text-slate-800">{item.title}</strong><p className="mt-1 text-[10px] font-bold text-slate-400">{item.source} · {item.date} {item.time}</p></div><button type="button" onClick={() => void removePublishedNews(item)} disabled={newsBusy} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Yayından kaldır"><Trash2 className="h-4 w-4" /></button></div>)}
                  {!publishedNews.length ? <div className="py-8 text-center text-xs font-bold text-slate-400">Mobil uygulamada yayında haber yok.</div> : null}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {isModalOpen && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }} id="announcement-modal-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div id="ann-modal-container" className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0"><div className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-indigo-600" /><h3 className="font-bold text-slate-800 text-lg">Panoya Bildirim Yaz / Duyuru</h3></div><button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full"><X className="w-5 h-5" /></button></div>
            {formError && <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 text-xs mb-4"><AlertCircle className="w-4 h-4 shrink-0" /><span className="font-semibold">{formError}</span></div>}
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold text-slate-600">
              <div><label className="block text-slate-700 font-bold mb-1.5">Duyuru Etiketi</label><div className="flex gap-2">{(["Genel", "Önemli", "Etkinlik"] as const).map((tag) => <button key={tag} type="button" onClick={() => setFormData({ ...formData, tag })} className={`px-4 py-2 text-xs font-bold rounded-xl border ${formData.tag === tag ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}>{tag}</button>)}</div></div>
              <div><label className="block text-slate-700 font-bold mb-1.5">Duyuru Başlığı *</label><input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none" /></div>
              <div><label className="block text-slate-700 font-bold mb-1.5">Duyuru Detayı & İçeriği *</label><textarea required rows={4} value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none min-h-[100px] resize-y leading-relaxed font-normal" /></div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl">Vazgeç</button><button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl flex items-center gap-1.5 font-bold"><Check className="w-4 h-4" /><span>Duyuruyu Yayınla</span></button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
