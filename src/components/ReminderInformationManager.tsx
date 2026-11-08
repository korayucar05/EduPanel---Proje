import React from "react";
import { BellRing, Plus, Save, Trash2, Pencil, X } from "lucide-react";

type Reminder = {
  id: string; schoolId: string; kind: string; title: string; body: string;
  recipients: string[]; startAt: string; endAt: string; active: boolean;
};
const initial = { kind: "Genel Bilgilendirme", title: "", body: "", recipients: ["student", "parent"], startAt: "", endAt: "", active: true };
const recipientOptions = [
  { id: "student", title: "Öğrenci" }, { id: "parent", title: "Veli" },
  { id: "teacher", title: "Öğretmen" }, { id: "admin", title: "Yönetici" },
];
const types = ["Genel Bilgilendirme", "Deneme Sınavı", "Ortak Sınav", "Toplantı", "Etkinlik", "Diğer"];
const formatted = (value: string) => value ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—";

export default function ReminderInformationManager({ schoolId }: { schoolId: string }) {
  const [items, setItems] = React.useState<Reminder[]>([]);
  const [draft, setDraft] = React.useState<Omit<Reminder, "id" | "schoolId">>(initial);
  const [editId, setEditId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/database/collections/reminderInformation?schoolId=${encodeURIComponent(schoolId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Hatırlatmalar yüklenemedi.");
      const json = await res.json();
      setItems((Array.isArray(json) ? json : []).filter((item: Reminder) => item.schoolId === schoolId));
    } catch (e: any) { setNotice(e.message || "Kayıtlar alınamadı."); }
  }, [schoolId]);
  React.useEffect(() => { void refresh(); }, [refresh]);
  const reset = () => { setDraft({ ...initial, recipients: [...initial.recipients] }); setEditId(""); };
  const save = async (record: Reminder) => {
    const response = await fetch(`/api/database/collections/reminderInformation/${encodeURIComponent(record.id)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Hatırlatma kaydedilemedi.");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.recipients.length) { setNotice("En az bir kullanıcı grubu seçiniz."); return; }
    if (new Date(draft.endAt).getTime() <= new Date(draft.startAt).getTime()) { setNotice("Bitiş zamanı başlangıçtan sonra olmalı."); return; }
    setBusy(true); setNotice("");
    try {
      await save({ ...draft, id: editId || crypto.randomUUID(), schoolId });
      reset(); await refresh(); setNotice("Hatırlatma kaydedildi.");
    } catch (e: any) { setNotice(e.message || "Kayıt hatası."); }
    finally { setBusy(false); }
  };
  const edit = (item: Reminder) => {
    setEditId(item.id);
    setDraft({ kind: item.kind, title: item.title, body: item.body, recipients: [...item.recipients], startAt: item.startAt, endAt: item.endAt, active: item.active });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changeActive = async (item: Reminder) => {
    setBusy(true);
    try { await save({ ...item, active: !item.active }); await refresh(); }
    catch (e: any) { setNotice(e.message || "İşlem başarısız."); }
    finally { setBusy(false); }
  };
  const remove = async (item: Reminder) => {
    if (!window.confirm("Bu hatırlatma silinsin mi?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/database/collections/reminderInformation/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Hatırlatma silinemedi.");
      if (editId === item.id) reset();
      await refresh();
    } catch (e: any) { setNotice(e.message || "Silme başarısız."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <form onSubmit={submit} className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-black text-sky-800"><BellRing className="h-5 w-5" />{editId ? "Hatırlatmayı Düzenle" : "Yeni Hatırlatma"}</h3>{editId ? <button type="button" onClick={reset} className="flex items-center gap-1 text-xs font-bold text-slate-600"><X className="h-4 w-4" /> Vazgeç</button> : null}</div>
      <label className="block text-xs font-black text-slate-600">Bilgi türü<select value={draft.kind} onChange={e=>setDraft(p=>({...p,kind:e.target.value}))} className="mt-1 w-full rounded-xl border p-3 text-sm">{types.map(type=><option key={type}>{type}</option>)}</select></label>
      <label className="block text-xs font-black text-slate-600">Hatırlatma başlığı<input required maxLength={140} value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))} className="mt-1 w-full rounded-xl border p-3 text-sm" placeholder="Örneğin: Veli toplantısı" /></label>
      <label className="block text-xs font-black text-slate-600">Açıklama<textarea required maxLength={1200} rows={3} value={draft.body} onChange={e=>setDraft(p=>({...p,body:e.target.value}))} className="mt-1 w-full rounded-xl border p-3 text-sm" /></label>
      <div><div className="mb-2 text-xs font-black text-slate-600">Hangi kullanıcılara gösterilsin?</div><div className="grid grid-cols-2 gap-3">{recipientOptions.map(option=><label key={option.id} className="flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold"><input type="checkbox" checked={draft.recipients.includes(option.id)} onChange={e=>setDraft(p=>({...p,recipients:e.target.checked?[...p.recipients,option.id]:p.recipients.filter(id=>id!==option.id)}))} />{option.title}</label>)}</div></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Başlangıç tarihi ve saati<input required type="datetime-local" value={draft.startAt} onChange={e=>setDraft(p=>({...p,startAt:e.target.value}))} className="mt-1 w-full rounded-xl border p-3 text-sm" /></label><label className="text-xs font-black text-slate-600">Bitiş tarihi ve saati<input required type="datetime-local" value={draft.endAt} onChange={e=>setDraft(p=>({...p,endAt:e.target.value}))} className="mt-1 w-full rounded-xl border p-3 text-sm" /></label></div>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.active} onChange={e=>setDraft(p=>({...p,active:e.target.checked}))} /> Hatırlatma etkin</label>
      {notice ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{notice}</p> : null}
      <button disabled={busy} type="submit" className="flex items-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{editId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editId ? "Değişiklikleri Kaydet" : "Hatırlatmayı Kaydet"}</button>
    </form>
    <section className="space-y-2"><h3 className="font-black text-slate-800">Kayıtlı Hatırlatmalar ({items.length})</h3>{items.map(item=><div key={item.id} className="rounded-2xl border bg-white p-4"><div className="flex items-start justify-between gap-2"><div><strong className="text-sm">{item.title}</strong><div className="text-xs font-bold text-sky-700">{item.kind} · {item.active ? "Etkin" : "Pasif"}</div></div><div className="flex gap-2"><button type="button" title="Düzenle" onClick={()=>edit(item)}><Pencil className="h-4 w-4" /></button><button type="button" title="Sil" disabled={busy} onClick={()=>void remove(item)}><Trash2 className="h-4 w-4 text-rose-600" /></button></div></div><p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{item.body}</p><p className="mt-2 text-xs text-slate-500">{formatted(item.startAt)} – {formatted(item.endAt)} · {item.recipients.map(id=>recipientOptions.find(r=>r.id===id)?.title||id).join(", ")}</p><button type="button" disabled={busy} onClick={()=>void changeActive(item)} className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">{item.active?"Pasifleştir":"Etkinleştir"}</button></div>)}{!items.length ? <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">Henüz kayıt bulunmuyor.</div> : null}</section>
  </div>;
}
