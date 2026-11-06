import React from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Headphones,
  ListMusic,
  Pause,
  Play,
  Podcast,
  Radio,
  Save,
  Settings2,
  Trash2,
  Volume2,
  X,
  Plus,
} from "lucide-react";

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

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const defaultSettings: SchoolRadioSettings = {
  stationName: "Ordu Lisesi Okul Radyosu",
  tagline: "Okulun sesi, öğrencinin sözü.",
  enabled: false,
  streamUrl: "",
  artworkUrl: "",
  schedule: [],
  playlists: [],
  podcasts: [],
};

const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data as T;
};

const istanbulNow = () => {
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayRaw = String(map.weekday || "");
  const day = dayRaw ? dayRaw.charAt(0).toLocaleUpperCase("tr-TR") + dayRaw.slice(1).toLocaleLowerCase("tr-TR") : "";
  return { day, time: `${map.hour || "00"}:${map.minute || "00"}` };
};

const minuteOf = (value: string) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  return Number(match[1]) * 60 + Number(match[2]);
};

const cleanPrograms = (items: RadioProgram[]) => [...items].sort((a, b) => {
  const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
  return dayDiff || minuteOf(a.start) - minuteOf(b.start);
});

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function SchoolRadioView({
  onBack,
  adminToken = "",
  canManage = false,
}: {
  onBack: () => void;
  adminToken?: string;
  canManage?: boolean;
}) {
  const [settings, setSettings] = React.useState<SchoolRadioSettings>(defaultSettings);
  const [draft, setDraft] = React.useState<SchoolRadioSettings>(defaultSettings);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [manageOpen, setManageOpen] = React.useState(false);
  const [playingKey, setPlayingKey] = React.useState("");
  const [volume, setVolume] = React.useState(0.75);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [clock, setClock] = React.useState(() => istanbulNow());

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await requestJson<SchoolRadioSettings>("/api/school-radio");
      const next = { ...defaultSettings, ...data, schedule: Array.isArray(data.schedule) ? data.schedule : [], playlists: Array.isArray(data.playlists) ? data.playlists : [], podcasts: Array.isArray(data.podcasts) ? data.podcasts : [] };
      setSettings(next);
      setDraft(next);
    } catch (reason: any) {
      setError(reason?.message || "Okul radyosu bilgileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    const id = window.setInterval(() => setClock(istanbulNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  React.useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);
  React.useEffect(() => () => {
    try { audioRef.current?.pause(); } catch {}
  }, []);

  const todayPrograms = React.useMemo(
    () => cleanPrograms(settings.schedule.filter((item) => item.day === clock.day)),
    [settings.schedule, clock.day],
  );
  const currentProgram = React.useMemo(() => {
    const nowMinute = minuteOf(clock.time);
    return todayPrograms.find((item) => {
      const start = minuteOf(item.start);
      const end = minuteOf(item.end);
      return start >= 0 && end >= 0 && nowMinute >= start && nowMinute < end;
    }) || null;
  }, [todayPrograms, clock.time]);

  const playSource = async (key: string, url: string) => {
    if (!url) {
      setError("Henüz yayın adresi tanımlanmamış.");
      return;
    }
    setError("");
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (playingKey === key && !audio.paused) {
        audio.pause();
        setPlayingKey("");
        return;
      }
      if (audio.src !== url) {
        audio.pause();
        audio.src = url;
        audio.load();
      }
      await audio.play();
      setPlayingKey(key);
    } catch {
      setPlayingKey("");
      setError("Yayın başlatılamadı. Yayın adresini ve internet bağlantısını kontrol edin.");
    }
  };

  const save = async () => {
    if (!adminToken || !canManage) return;
    setSaving(true);
    setError("");
    try {
      const next = await requestJson<SchoolRadioSettings>(`/api/behavior/teacher-links/${encodeURIComponent(adminToken)}/school-radio`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, schedule: cleanPrograms(draft.schedule) }),
      });
      setSettings({ ...defaultSettings, ...next });
      setDraft({ ...defaultSettings, ...next });
      setManageOpen(false);
    } catch (reason: any) {
      setError(reason?.message || "Radyo ayarları kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-rose-50 via-white to-slate-50 p-2 text-slate-800 sm:p-4">
      <audio ref={audioRef} preload="none" onEnded={() => setPlayingKey("")} onError={() => setPlayingKey("")} />
      <div className="mx-auto min-h-[calc(100dvh-1rem)] max-w-xl overflow-hidden rounded-[30px] border border-rose-100 bg-white shadow-[0_22px_60px_rgba(136,19,55,0.12)]">
        <header className="relative overflow-hidden bg-gradient-to-br from-[#7f1d1d] via-[#be123c] to-[#e11d48] px-4 pb-5 pt-4 text-white">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-black/10" />
          <div className="relative flex items-center gap-3">
            <button type="button" onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10" aria-label="Geri dön">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-rose-100">e-Nstitü</div>
              <h1 className="truncate text-[18px] font-black">OKUL RADYOSU</h1>
            </div>
            {canManage ? (
              <button type="button" onClick={() => { setDraft(settings); setManageOpen(true); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10" aria-label="Radyo yönetimi">
                <Settings2 className="h-5 w-5" />
              </button>
            ) : <span className="h-10 w-10" />}
          </div>
        </header>

        <div className="space-y-3 p-3.5">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-[10px] font-bold text-rose-700">{error}</div> : null}
          {loading ? <div className="py-12 text-center text-xs font-bold text-slate-400">Radyo hazırlanıyor…</div> : (
            <>
              <section className="overflow-hidden rounded-[26px] border border-rose-100 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 p-4 text-white shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-rose-500 to-orange-400 shadow-lg">
                    {settings.artworkUrl ? <img src={settings.artworkUrl} alt="" className="h-full w-full object-cover" /> : <Radio className="h-8 w-8" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.18em] text-rose-200">
                      <span className={`h-2 w-2 rounded-full ${playingKey === "live" ? "animate-pulse bg-red-400" : "bg-white/40"}`} />
                      {settings.enabled ? "CANLI YAYIN" : "YAYIN HAZIRLANIYOR"}
                    </div>
                    <h2 className="mt-1 truncate text-[16px] font-black">{settings.stationName}</h2>
                    <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-white/65">{currentProgram ? `${currentProgram.title}${currentProgram.host ? ` · ${currentProgram.host}` : ""}` : settings.tagline}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!settings.enabled || !settings.streamUrl}
                    onClick={() => void playSource("live", settings.streamUrl)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-rose-700 shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {playingKey === "live" ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-white/55">
                      <span>{playingKey === "live" ? "Yayını dinliyorsunuz" : "Dinlemek için oynat"}</span>
                      <span>{clock.time}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-white/60" />
                      <input aria-label="Ses seviyesi" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="h-1.5 w-full accent-rose-400" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Clock3 className="h-4 w-4" /></span>
                  <div>
                    <h3 className="text-[12px] font-black text-slate-900">Bugünün Yayın Akışı</h3>
                    <p className="text-[8px] font-bold text-slate-400">{clock.day} · {clock.time}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {todayPrograms.length ? todayPrograms.map((program) => {
                    const active = currentProgram?.id === program.id;
                    return <div key={program.id} className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 ${active ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-slate-50"}`}>
                      <div className={`w-12 shrink-0 text-center text-[9px] font-black ${active ? "text-rose-700" : "text-slate-500"}`}>{program.start}</div>
                      <div className="min-w-0 flex-1"><strong className="block truncate text-[10px] text-slate-900">{program.title}</strong>{program.host ? <span className="block truncate text-[8px] font-bold text-slate-400">{program.host}</span> : null}</div>
                      {active ? <span className="rounded-full bg-rose-600 px-2 py-1 text-[7px] font-black text-white">ŞİMDİ</span> : <span className="text-[8px] font-bold text-slate-400">{program.end}</span>}
                    </div>;
                  }) : <div className="rounded-2xl bg-slate-50 px-3 py-5 text-center text-[9px] font-bold text-slate-400">Bugün için yayın programı girilmedi.</div>}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><ListMusic className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><h3 className="text-[12px] font-black text-slate-900">Çalma Listeleri</h3><p className="text-[8px] font-bold text-slate-400">Okul radyosu seçkilerini dinleyin</p></div>
                </div>
                <div className="mt-3 space-y-2">
                  {settings.playlists.filter((playlist) => playlist.active !== false && playlist.tracks.length > 0).length ? settings.playlists.filter((playlist) => playlist.active !== false && playlist.tracks.length > 0).map((playlist) => (
                    <div key={playlist.id} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-amber-600 shadow-sm">{playlist.artworkUrl ? <img src={playlist.artworkUrl} alt="" className="h-full w-full object-cover" /> : <ListMusic className="h-4 w-4" />}</div>
                        <div className="min-w-0 flex-1"><strong className="block truncate text-[10px] text-slate-900">{playlist.title}</strong><span className="block truncate text-[8px] font-semibold text-slate-400">{playlist.description || `${playlist.tracks.length} parça`}</span></div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {playlist.tracks.map((track, index) => {
                          const key = `playlist:${playlist.id}:${track.id}`;
                          return <button key={track.id} type="button" onClick={() => void playSource(key, track.audioUrl)} className="flex w-full items-center gap-2 rounded-xl border border-white bg-white/80 px-2 py-1.5 text-left active:scale-[0.99]">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-[8px] font-black text-amber-700">{playingKey === key ? <Pause className="h-3.5 w-3.5 fill-current" /> : index + 1}</span>
                            <span className="min-w-0 flex-1"><strong className="block truncate text-[9px] text-slate-900">{track.title}</strong><span className="block truncate text-[7px] font-semibold text-slate-400">{track.artist || track.description || "Okul Radyosu"}</span></span>
                            <Headphones className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                          </button>;
                        })}
                      </div>
                    </div>
                  )) : <div className="rounded-2xl bg-slate-50 px-3 py-5 text-center text-[9px] font-bold text-slate-400">Henüz aktif çalma listesi eklenmedi.</div>}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Podcast className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><h3 className="text-[12px] font-black text-slate-900">Podcast & Program Arşivi</h3><p className="text-[8px] font-bold text-slate-400">Kaçırdığınız okul yayınlarını dinleyin</p></div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {settings.podcasts.length ? settings.podcasts.map((podcast) => {
                    const key = `podcast:${podcast.id}`;
                    return <button key={podcast.id} type="button" onClick={() => void playSource(key, podcast.audioUrl)} className="flex w-full items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-left active:scale-[0.99]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">{playingKey === key ? <Pause className="h-4 w-4 fill-current" /> : <Headphones className="h-4 w-4" />}</span>
                      <span className="min-w-0 flex-1"><strong className="block truncate text-[10px] text-slate-900">{podcast.title}</strong><span className="block truncate text-[8px] font-semibold text-slate-400">{podcast.description || podcast.publishedAt || "Okul radyosu arşivi"}</span></span>
                    </button>;
                  }) : <div className="rounded-2xl bg-slate-50 px-3 py-5 text-center text-[9px] font-bold text-slate-400">Henüz podcast kaydı eklenmedi.</div>}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {manageOpen && canManage ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-2 sm:items-center">
          <div className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
              <div className="min-w-0 flex-1"><h2 className="text-[15px] font-black text-slate-950">Okul Radyosu Yönetimi</h2><p className="text-[8px] font-bold text-slate-400">Ses yayını e-Nstitü sunucusundan geçmez; yalnız yayın adresi oynatılır.</p></div>
              <button type="button" onClick={() => setManageOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4 p-4">
              <section className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50/40 p-3">
                <label className="flex items-center justify-between gap-3 text-[10px] font-black text-slate-700"><span>Radyo Yayını Aktif</span><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} className="h-5 w-5 accent-rose-600" /></label>
                <input value={draft.stationName} onChange={(event) => setDraft((current) => ({ ...current, stationName: event.target.value }))} placeholder="Radyo adı" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold outline-none focus:border-rose-300" />
                <input value={draft.tagline} onChange={(event) => setDraft((current) => ({ ...current, tagline: event.target.value }))} placeholder="Kısa slogan" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold outline-none focus:border-rose-300" />
                <input value={draft.streamUrl} onChange={(event) => setDraft((current) => ({ ...current, streamUrl: event.target.value }))} placeholder="Canlı yayın adresi (tercihen HTTPS)" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold outline-none focus:border-rose-300" />
                <input value={draft.artworkUrl || ""} onChange={(event) => setDraft((current) => ({ ...current, artworkUrl: event.target.value }))} placeholder="Radyo kapak görseli adresi (isteğe bağlı)" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold outline-none focus:border-rose-300" />
              </section>

              <section className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2"><div><h3 className="text-[11px] font-black text-slate-900">Yayın Akışı</h3><p className="text-[8px] font-semibold text-slate-400">Gün, saat, program ve sunucu bilgisi</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, schedule: [...current.schedule, { id: newId("program"), day: "Pazartesi", start: "12:00", end: "12:30", title: "Yeni Program", host: "", description: "" }] }))} className="flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-2 text-[9px] font-black text-white"><Plus className="h-3.5 w-3.5" /> Ekle</button></div>
                <div className="mt-3 space-y-2">{draft.schedule.map((program) => <div key={program.id} className="rounded-2xl bg-slate-50 p-2.5"><div className="grid grid-cols-[1fr_74px_74px_34px] gap-1.5"><select value={program.day} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, day: event.target.value } : item) }))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] font-bold">{DAYS.map((day) => <option key={day}>{day}</option>)}</select><input type="time" value={program.start} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, start: event.target.value } : item) }))} className="rounded-lg border border-slate-200 bg-white px-1 py-2 text-[9px] font-bold" /><input type="time" value={program.end} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, end: event.target.value } : item) }))} className="rounded-lg border border-slate-200 bg-white px-1 py-2 text-[9px] font-bold" /><button type="button" onClick={() => setDraft((current) => ({ ...current, schedule: current.schedule.filter((item) => item.id !== program.id) }))} className="flex items-center justify-center rounded-lg bg-rose-100 text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button></div><input value={program.title} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, title: event.target.value } : item) }))} placeholder="Program adı" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] font-bold" /><input value={program.host || ""} onChange={(event) => setDraft((current) => ({ ...current, schedule: current.schedule.map((item) => item.id === program.id ? { ...item, host: event.target.value } : item) }))} placeholder="Sunucu / ekip" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] font-semibold" /></div>)}</div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2"><div><h3 className="text-[11px] font-black text-slate-900">Podcast Arşivi</h3><p className="text-[8px] font-semibold text-slate-400">Ses dosyası e-Nstitü’ye yüklenmez; bağlantı kaydedilir.</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, podcasts: [...current.podcasts, { id: newId("podcast"), title: "Yeni Podcast", audioUrl: "", description: "", publishedAt: new Date().toISOString().slice(0, 10) }] }))} className="flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-2 text-[9px] font-black text-white"><Plus className="h-3.5 w-3.5" /> Ekle</button></div>
                <div className="mt-3 space-y-2">{draft.podcasts.map((podcast) => <div key={podcast.id} className="rounded-2xl bg-slate-50 p-2.5"><div className="flex gap-1.5"><input value={podcast.title} onChange={(event) => setDraft((current) => ({ ...current, podcasts: current.podcasts.map((item) => item.id === podcast.id ? { ...item, title: event.target.value } : item) }))} placeholder="Podcast adı" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] font-bold" /><button type="button" onClick={() => setDraft((current) => ({ ...current, podcasts: current.podcasts.filter((item) => item.id !== podcast.id) }))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button></div><input value={podcast.audioUrl} onChange={(event) => setDraft((current) => ({ ...current, podcasts: current.podcasts.map((item) => item.id === podcast.id ? { ...item, audioUrl: event.target.value } : item) }))} placeholder="Ses dosyası / podcast adresi" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] font-semibold" /><input value={podcast.description || ""} onChange={(event) => setDraft((current) => ({ ...current, podcasts: current.podcasts.map((item) => item.id === podcast.id ? { ...item, description: event.target.value } : item) }))} placeholder="Kısa açıklama" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] font-semibold" /></div>)}</div>
              </section>

              <button type="button" disabled={saving} onClick={() => void save()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-700 to-red-600 px-4 py-3.5 text-[11px] font-black text-white shadow-lg disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Kaydediliyor…" : "Radyo Ayarlarını Kaydet"}</button>
              <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-[8px] font-semibold leading-4 text-slate-500"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>Performans notu: Canlı ses ve podcast dosyaları harici adresten telefona gider. e-Nstitü yalnız radyo ayarlarını ve program listesini saklar; bu nedenle ana sunucuya ses trafiği yüklenmez.</span></div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
