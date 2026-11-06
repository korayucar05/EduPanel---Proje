import React from "react";
import {
  CalendarDays,
  CheckCircle2,
  Headphones,
  ListMusic,
  Mic2,
  Music2,
  Plus,
  Podcast,
  Radio,
  Save,
  Trash2,
  Volume2,
  Wifi,
} from "lucide-react";
import { runtimeSessionStorage } from "../lib/runtimeSessionStorage";

type RadioProgram = {
  id: string;
  day: string;
  start: string;
  end: string;
  title: string;
  host?: string;
  description?: string;
};

type RadioTrack = {
  id: string;
  title: string;
  artist?: string;
  audioUrl: string;
  description?: string;
};

type RadioPlaylist = {
  id: string;
  title: string;
  description?: string;
  artworkUrl?: string;
  active: boolean;
  tracks: RadioTrack[];
};

type RadioPodcast = {
  id: string;
  title: string;
  audioUrl: string;
  description?: string;
  publishedAt?: string;
  artworkUrl?: string;
};

type SchoolRadioSettings = {
  stationName: string;
  tagline: string;
  enabled: boolean;
  streamUrl: string;
  artworkUrl?: string;
  schedule: RadioProgram[];
  playlists: RadioPlaylist[];
  podcasts: RadioPodcast[];
  updatedAt?: string;
};

type TabKey = "playlists" | "podcasts" | "schedule" | "settings";

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaults: SchoolRadioSettings = {
  stationName: "Ordu Lisesi Okul Radyosu",
  tagline: "Okulun sesi, öğrencinin sözü.",
  enabled: false,
  streamUrl: "",
  artworkUrl: "",
  schedule: [],
  playlists: [],
  podcasts: [],
};

const getJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
  return body as T;
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">{children}</div>
);

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

export default function SchoolRadioAdminModule() {
  const [draft, setDraft] = React.useState<SchoolRadioSettings>(defaults);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [tab, setTab] = React.useState<TabKey>("playlists");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getJson<SchoolRadioSettings>("/api/school-radio");
      setDraft({
        ...defaults,
        ...data,
        schedule: Array.isArray(data.schedule) ? data.schedule : [],
        playlists: Array.isArray(data.playlists) ? data.playlists : [],
        podcasts: Array.isArray(data.podcasts) ? data.podcasts : [],
      });
    } catch (reason: any) {
      setError(reason?.message || "Okul radyosu bilgileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const token = runtimeSessionStorage.getItem("edupanel_auth_token") || "";
    if (!token) {
      setError("Yönetici oturumu bulunamadı. Lütfen yeniden giriş yapınız.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const next = await getJson<SchoolRadioSettings>("/api/school-radio/admin", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draft),
      });
      setDraft({ ...defaults, ...next, playlists: next.playlists || [], podcasts: next.podcasts || [], schedule: next.schedule || [] });
      setSuccess("Okul Radyosu içeriği kaydedildi. Mobil uygulamalar bu kayıtları kullanacak.");
      window.setTimeout(() => setSuccess(""), 3500);
    } catch (reason: any) {
      setError(reason?.message || "Okul radyosu kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const addPlaylist = () => {
    const playlist: RadioPlaylist = {
      id: makeId("playlist"),
      title: "Yeni Çalma Listesi",
      description: "",
      artworkUrl: "",
      active: true,
      tracks: [],
    };
    setDraft((current) => ({ ...current, playlists: [...current.playlists, playlist] }));
  };

  const updatePlaylist = (id: string, patch: Partial<RadioPlaylist>) => {
    setDraft((current) => ({
      ...current,
      playlists: current.playlists.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const addTrack = (playlistId: string) => {
    setDraft((current) => ({
      ...current,
      playlists: current.playlists.map((playlist) => playlist.id !== playlistId ? playlist : {
        ...playlist,
        tracks: [...playlist.tracks, { id: makeId("track"), title: "Yeni Parça", artist: "", audioUrl: "", description: "" }],
      }),
    }));
  };

  const updateTrack = (playlistId: string, trackId: string, patch: Partial<RadioTrack>) => {
    setDraft((current) => ({
      ...current,
      playlists: current.playlists.map((playlist) => playlist.id !== playlistId ? playlist : {
        ...playlist,
        tracks: playlist.tracks.map((track) => track.id === trackId ? { ...track, ...patch } : track),
      }),
    }));
  };

  const removeTrack = (playlistId: string, trackId: string) => {
    setDraft((current) => ({
      ...current,
      playlists: current.playlists.map((playlist) => playlist.id !== playlistId ? playlist : {
        ...playlist,
        tracks: playlist.tracks.filter((track) => track.id !== trackId),
      }),
    }));
  };

  const totalTracks = draft.playlists.reduce((sum, playlist) => sum + playlist.tracks.length, 0);

  if (loading) {
    return <div className="flex min-h-[420px] items-center justify-center text-sm font-bold text-slate-400">Okul Radyosu hazırlanıyor…</div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-12">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-slate-950 via-rose-950 to-rose-800 px-6 py-6 text-white shadow-xl">
        <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-rose-400/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-inner ring-1 ring-white/15"><Radio className="h-8 w-8" /></div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-rose-200">e-Nstitü Yayın Merkezi</div>
              <h1 className="mt-1 text-2xl font-black">OKUL RADYOSU</h1>
              <p className="mt-1 max-w-2xl text-sm font-medium text-white/65">Mobil uygulamadaki canlı yayın, çalma listeleri, yayın akışı ve podcast arşivini buradan hazırlayın.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${draft.enabled ? "bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-300/30" : "bg-white/10 text-white/60 ring-1 ring-white/10"}`}>{draft.enabled ? "YAYIN AKTİF" : "YAYIN KAPALI"}</span>
            <button type="button" disabled={saving} onClick={() => void save()} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-rose-800 shadow-lg transition hover:bg-rose-50 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Kaydediliyor…" : "Tümünü Kaydet"}</button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
      {success ? <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{success}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: ListMusic, label: "Aktif Çalma Listesi", value: draft.playlists.filter((item) => item.active).length, className: "bg-rose-50 text-rose-600" },
          { icon: Music2, label: "Toplam Parça", value: totalTracks, className: "bg-amber-50 text-amber-600" },
          { icon: Podcast, label: "Podcast", value: draft.podcasts.length, className: "bg-indigo-50 text-indigo-600" },
          { icon: CalendarDays, label: "Yayın Programı", value: draft.schedule.length, className: "bg-emerald-50 text-emerald-600" },
        ].map(({ icon: Icon, label, value, className }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${className}`}><Icon className="h-5 w-5" /></div><div><div className="text-2xl font-black text-slate-900">{value}</div><div className="text-xs font-bold text-slate-400">{label}</div></div></div>
          </div>
        ))}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { key: "playlists" as TabKey, label: "Çalma Listeleri", icon: ListMusic },
            { key: "podcasts" as TabKey, label: "Podcastler", icon: Podcast },
            { key: "schedule" as TabKey, label: "Yayın Akışı", icon: CalendarDays },
            { key: "settings" as TabKey, label: "Canlı Yayın", icon: Wifi },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-black transition ${tab === key ? "bg-rose-700 text-white shadow-md" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>
      </section>

      {tab === "playlists" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-black text-slate-900">Çalma Listeleri</h2><p className="text-xs font-semibold text-slate-500">Aktif listeler ve içindeki parçalar mobil Okul Radyosu ekranında görünür.</p></div>
            <button type="button" onClick={addPlaylist} className="flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white"><Plus className="h-4 w-4" />Yeni Çalma Listesi</button>
          </div>
          {draft.playlists.length === 0 ? <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center"><ListMusic className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-500">Henüz çalma listesi yok.</p></div> : null}
          {draft.playlists.map((playlist, playlistIndex) => (
            <div key={playlist.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 lg:grid-cols-[1fr_1fr_220px_auto] lg:items-end">
                <div><FieldLabel>Çalma Listesi Adı</FieldLabel><input className={inputClass} value={playlist.title} onChange={(event) => updatePlaylist(playlist.id, { title: event.target.value })} /></div>
                <div><FieldLabel>Açıklama</FieldLabel><input className={inputClass} value={playlist.description || ""} onChange={(event) => updatePlaylist(playlist.id, { description: event.target.value })} placeholder="Örn. Öğle arası seçkisi" /></div>
                <label className="flex h-[43px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700"><span>Mobilde Göster</span><input type="checkbox" checked={playlist.active} onChange={(event) => updatePlaylist(playlist.id, { active: event.target.checked })} className="h-5 w-5 accent-rose-700" /></label>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, playlists: current.playlists.filter((item) => item.id !== playlist.id) }))} className="flex h-[43px] items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 text-sm font-black text-rose-700 hover:bg-rose-100"><Trash2 className="h-4 w-4" />Sil</button>
                <div className="lg:col-span-2"><FieldLabel>Kapak Görseli Adresi (isteğe bağlı)</FieldLabel><input className={inputClass} value={playlist.artworkUrl || ""} onChange={(event) => updatePlaylist(playlist.id, { artworkUrl: event.target.value })} placeholder="https://..." /></div>
                <div className="text-xs font-bold text-slate-400 lg:col-span-2 lg:text-right">{playlistIndex + 1}. liste · {playlist.tracks.length} parça</div>
              </div>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-slate-800">Parçalar</h3><button type="button" onClick={() => addTrack(playlist.id)} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white"><Plus className="h-3.5 w-3.5" />Parça Ekle</button></div>
                <div className="space-y-2">
                  {playlist.tracks.map((track, trackIndex) => (
                    <div key={track.id} className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[42px_1fr_1fr_2fr_42px] lg:items-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-rose-700 shadow-sm">{trackIndex + 1}</div>
                      <input className={inputClass} value={track.title} onChange={(event) => updateTrack(playlist.id, track.id, { title: event.target.value })} placeholder="Parça adı" />
                      <input className={inputClass} value={track.artist || ""} onChange={(event) => updateTrack(playlist.id, track.id, { artist: event.target.value })} placeholder="Sanatçı / sunucu" />
                      <input className={inputClass} value={track.audioUrl} onChange={(event) => updateTrack(playlist.id, track.id, { audioUrl: event.target.value })} placeholder="Harici ses adresi (https://...)" />
                      <button type="button" onClick={() => removeTrack(playlist.id, track.id)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {playlist.tracks.length === 0 ? <div className="rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">Bu listeye henüz parça eklenmedi.</div> : null}
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "podcasts" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-black text-slate-900">Podcast Arşivi</h2><p className="text-xs font-semibold text-slate-500">Üretilen podcastin ses bağlantısını buraya ekleyin; mobil uygulamada doğrudan dinlenir.</p></div>
            <button type="button" onClick={() => setDraft((current) => ({ ...current, podcasts: [...current.podcasts, { id: makeId("podcast"), title: "Yeni Podcast", audioUrl: "", description: "", publishedAt: new Date().toISOString().slice(0, 10), artworkUrl: "" }] }))} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-black text-white"><Plus className="h-4 w-4" />Yeni Podcast</button>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {draft.podcasts.map((podcast) => (
              <div key={podcast.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><Mic2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><input className={inputClass} value={podcast.title} onChange={(event) => setDraft((current) => ({ ...current, podcasts: current.podcasts.map((item) => item.id === podcast.id ? { ...item, title: event.target.value } : item) }))} placeholder="Podcast adı" /></div><button type="button" onClick={() => setDraft((current) => ({ ...current, podcasts: current.podcasts.filter((item) => item.id !== podcast.id) }))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></button></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><FieldLabel>Yayın Tarihi</FieldLabel><input type="date" className={inputClass} value={podcast.publishedAt || ""} onChange={(event) => setDraft((current) => ({ ...current, podcasts: current.podcasts.map((item) => item.id === podcast.id ? { ...item, publishedAt: event.target.value } : item) }))} /></div><div><FieldLabel>Kapak Görseli</FieldLabel><input className={inputClass} value={podcast.artworkUrl || ""} onChange={(event) => setDraft((current) => ({ ...current, podcasts: current.podcasts.map((item) => item.id === podcast.id ? { ...item, artworkUrl: event.target.value } : item) }))} placeholder="https://..." /></div></div>
                <div className="mt-3"><FieldLabel>Podcast Ses Adresi</FieldLabel><input className={inputClass} value={podcast.audioUrl} onChange={(event) => setDraft((current) => ({ ...current, podcasts: current.podcasts.map((item) => item.id === podcast.id ? { ...item, audioUrl: event.target.value } : item) }))} placeholder="https://.../podcast.mp3" /></div>
                <div className="mt-3"><FieldLabel>Açıklama</FieldLabel><textarea className={`${inputClass} min-h-20 resize-y`} value={podcast.description || ""} onChange={(event) => setDraft((current) => ({ ...current, podcasts: current.podcasts.map((item) => item.id === podcast.id ? { ...item, description: event.target.value } : item) }))} placeholder="Podcast konusu / kısa açıklama" /></div>
              </div>
            ))}
          </div>
          {draft.podcasts.length === 0 ? <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center"><Podcast className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-500">Henüz podcast eklenmedi.</p></div> : null}
        </section>
      ) : null}

      {tab === "schedule" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-slate-900">Yayın Akışı</h2><p className="text-xs font-semibold text-slate-500">Mobil uygulama “Şimdi Yayında” bilgisini bu saatlere göre gösterir.</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, schedule: [...current.schedule, { id: makeId("program"), day: "Pazartesi", start: "12:00", end: "12:30", title: "Yeni Program", host: "", description: "" }] }))} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white"><Plus className="h-4 w-4" />Program Ekle</button></div>
          <div className="space-y-2">
            {draft.schedule.map((program) => (
              <div key={program.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[150px_110px_110px_1fr_1fr_42px] lg:items-center">
                <select className={inputClass} value={program.day} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, day: event.target.value } : item) }))}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select>
                <input type="time" className={inputClass} value={program.start} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, start: event.target.value } : item) }))} />
                <input type="time" className={inputClass} value={program.end} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, end: event.target.value } : item) }))} />
                <input className={inputClass} value={program.title} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, title: event.target.value } : item) }))} placeholder="Program adı" />
                <input className={inputClass} value={program.host || ""} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, host: event.target.value } : item) }))} placeholder="Sunucu / ekip" />
                <button type="button" onClick={() => setDraft((current) => ({ ...current, schedule: current.schedule.filter((item) => item.id !== program.id) }))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-900">Canlı Yayın Ayarları</h2><p className="text-xs font-semibold text-slate-500">Ses akışı harici yayın sunucusundan gelir.</p></div><label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-700"><input type="checkbox" className="h-5 w-5 accent-rose-700" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />Yayın Aktif</label></div>
            <div><FieldLabel>Radyo Adı</FieldLabel><input className={inputClass} value={draft.stationName} onChange={(event) => setDraft((current) => ({ ...current, stationName: event.target.value }))} /></div>
            <div><FieldLabel>Slogan</FieldLabel><input className={inputClass} value={draft.tagline} onChange={(event) => setDraft((current) => ({ ...current, tagline: event.target.value }))} /></div>
            <div><FieldLabel>Canlı Yayın Adresi</FieldLabel><input className={inputClass} value={draft.streamUrl} onChange={(event) => setDraft((current) => ({ ...current, streamUrl: event.target.value }))} placeholder="https://.../stream" /></div>
            <div><FieldLabel>Radyo Kapak Görseli</FieldLabel><input className={inputClass} value={draft.artworkUrl || ""} onChange={(event) => setDraft((current) => ({ ...current, artworkUrl: event.target.value }))} placeholder="https://..." /></div>
          </div>
          <div className="rounded-[24px] bg-gradient-to-br from-slate-950 to-rose-950 p-5 text-white shadow-xl">
            <div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><Volume2 className="h-7 w-7" /></div><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-200">Mobil Önizleme</div><h3 className="text-lg font-black">{draft.stationName || "Okul Radyosu"}</h3></div></div>
            <p className="mt-4 text-sm font-medium leading-6 text-white/65">{draft.tagline || "Okulun sesi, öğrencinin sözü."}</p>
            <div className="mt-5 space-y-2 text-xs font-bold text-white/60"><div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span>Canlı yayın</span><span className={draft.enabled ? "text-emerald-300" : "text-rose-300"}>{draft.enabled ? "Açık" : "Kapalı"}</span></div><div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span>Aktif liste</span><span>{draft.playlists.filter((item) => item.active).length}</span></div><div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span>Podcast</span><span>{draft.podcasts.length}</span></div></div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] font-semibold leading-5 text-white/50"><Headphones className="mb-2 h-4 w-4 text-rose-300" />Ses dosyaları bu bilgisayara veya e-Nstitü veritabanına yüklenmez. Mobil cihaz ses bağlantısına doğrudan bağlanır; ana sistem yorulmaz.</div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
