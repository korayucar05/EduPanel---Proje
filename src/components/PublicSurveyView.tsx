import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { communicationService, type SurveyDraft } from "../modules/communication";

const tokenFromPath = () => window.location.pathname.match(/^\/anket\/([^/]+)\/?$/i)?.[1] || "";
const inviteFromUrl = () => new URLSearchParams(window.location.search).get("i") || "";

const upperTr = (value: string) => value.toLocaleUpperCase("tr-TR");
const digitsOnly = (value: string) => value.replace(/\D/g, "");
const phoneValue = (value: string) => {
  let digits = digitsOnly(value);
  if (digits && !digits.startsWith("0")) digits = `0${digits}`;
  return digits.slice(0, 11);
};

const deviceKey = () => {
  const key = "enstitu_survey_device_key";
  let value = localStorage.getItem(key);
  if (!value) { value = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`; localStorage.setItem(key,value); }
  return value;
};

export default function PublicSurveyView() {
  const [survey, setSurvey] = useState<SurveyDraft | null>(null);
  const [recipientName,setRecipientName]=useState("");
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [blocked,setBlocked]=useState<"expired"|"answered"|"">("");
  const token=useMemo(tokenFromPath,[]); const invitationToken=useMemo(inviteFromUrl,[]); const respondentKey=useMemo(deviceKey,[]);

  useEffect(() => {
    communicationService.getSurveyAccess(token,invitationToken,respondentKey)
      .then((access) => {
        setSurvey(access.survey); setRecipientName(access.invitation?.recipientName || "");
        if (!access.survey) setError("Anket bulunamadı veya bağlantı geçersiz.");
        else if(access.expired) setBlocked("expired");
        else if(access.alreadyResponded) setBlocked("answered");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Anket yüklenemedi."))
      .finally(() => setLoading(false));
  }, [token,invitationToken,respondentKey]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!survey) return; setSending(true); setError("");
    try { await communicationService.submitSurvey(token, answers,{invitationToken,respondentKey}); setDone(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { const msg=e instanceof Error?e.message:"Yanıt gönderilemedi."; setError(msg); if(msg.includes("daha önce"))setBlocked("answered"); }
    finally { setSending(false); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f0ebf8]"><Loader2 className="h-8 w-8 animate-spin text-violet-700" /></div>;
  if (done) return <StateCard icon={<CheckCircle2 className="h-12 w-12 text-emerald-600"/>} title="Yanıtınız kaydedildi" text="Ankete katıldığınız için teşekkür ederiz."/>;
  if(blocked==="expired") return <StateCard icon={<Clock3 className="h-12 w-12 text-amber-600"/>} title="Anket sona erdi" text="Bu anket için belirlenen yanıt süresi dolmuştur."/>;
  if(blocked==="answered") return <StateCard icon={<ShieldCheck className="h-12 w-12 text-violet-700"/>} title="Yanıtınız daha önce kaydedildi" text="Bu bağlantı tek yanıtlık olarak ayarlanmıştır. Aynı bağlantı ile ikinci kez yanıt gönderilemez."/>;
  if (!survey) return <StateCard title="Anket açılamadı" text={error || "Anket bulunamadı."}/>;

  const deadline=survey.expiresAt?new Date(survey.expiresAt):null;
  return <div className="min-h-screen bg-[#f0ebf8] px-3 py-8 sm:px-5">
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="h-2.5 bg-violet-700"/><div className="p-6">
        <div className="mb-3 flex items-center gap-2 text-violet-700"><ClipboardList className="h-5 w-5"/><span className="text-xs font-bold uppercase tracking-wider">e-Nstitü Anket</span></div>
        <h1 className="text-3xl font-normal text-slate-900">{survey.title}</h1>{survey.description&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{survey.description}</p>}
        {recipientName&&<div className="mt-4 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">Bu bağlantı <b>{recipientName}</b> için oluşturulmuştur.</div>}
        {deadline&&<div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4"/>Son yanıt: {deadline.toLocaleString("tr-TR")}</div>}
        {!survey.allowMultipleResponses&&<div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4"/>Bu ankette kişi başına yalnızca bir yanıt kabul edilir.</div>}
        <p className="mt-4 text-xs text-rose-600">* Zorunlu soruyu belirtir</p>
      </div></section>
      {survey.questions.map((q,index)=><section key={q.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 text-[15px] text-slate-900"><span className="mr-2 font-medium">{index+1}.</span>{q.text}{q.required&&<span className="ml-1 text-rose-600">*</span>}</div>
        {q.answerType==="short"&&<input required={q.required} value={String(answers[q.id]||"")} onChange={e=>setAnswers(a=>({...a,[q.id]:upperTr(e.target.value)}))} className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 uppercase outline-none focus:border-violet-700" placeholder="YANITINIZ"/>}
        {q.answerType==="paragraph"&&<textarea required={q.required} value={String(answers[q.id]||"")} onChange={e=>setAnswers(a=>({...a,[q.id]:upperTr(e.target.value)}))} rows={3} className="w-full resize-y border-0 border-b border-slate-300 bg-transparent px-0 py-2 uppercase outline-none focus:border-violet-700" placeholder="YANITINIZ"/>}
        {q.answerType==="number"&&<input required={q.required} inputMode="numeric" pattern="[0-9]*" value={String(answers[q.id]||"")} onChange={e=>setAnswers(a=>({...a,[q.id]:digitsOnly(e.target.value)}))} onPaste={e=>{e.preventDefault();const v=digitsOnly(e.clipboardData.getData("text"));setAnswers(a=>({...a,[q.id]:v}))}} className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 outline-none focus:border-violet-700" placeholder="YALNIZCA RAKAM"/>}
        {q.answerType==="phone"&&<div><input required={q.required} inputMode="tel" pattern="0[0-9]*" maxLength={11} value={String(answers[q.id]||"")} onChange={e=>setAnswers(a=>({...a,[q.id]:phoneValue(e.target.value)}))} onFocus={()=>{if(!answers[q.id])setAnswers(a=>({...a,[q.id]:"0"}))}} onPaste={e=>{e.preventDefault();const v=phoneValue(e.clipboardData.getData("text"));setAnswers(a=>({...a,[q.id]:v}))}} className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 outline-none focus:border-violet-700" placeholder="05XXXXXXXXX"/><p className="mt-1 text-[11px] text-slate-400">Telefon numarası 0 ile başlamalı ve boşluk içermemelidir.</p></div>}
        {q.answerType==="choice"&&<div className="space-y-3">{q.options.map(opt=><label key={opt} className="flex cursor-pointer items-center gap-3 text-sm"><input required={q.required} type="radio" name={q.id} checked={answers[q.id]===opt} onChange={()=>setAnswers(a=>({...a,[q.id]:opt}))} className="h-4 w-4 accent-violet-700"/>{opt}</label>)}</div>}
        {q.answerType==="multiple"&&<div className="space-y-3">{q.options.map(opt=>{const current=Array.isArray(answers[q.id])?answers[q.id] as string[]:[];return <label key={opt} className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={current.includes(opt)} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.checked?[...current,opt]:current.filter(x=>x!==opt)}))} className="h-4 w-4 accent-violet-700"/>{opt}</label>})}</div>}
        {q.answerType==="dropdown"&&<select required={q.required} value={String(answers[q.id]||"")} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))} className="min-w-56 rounded border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Seçin</option>{q.options.map(opt=><option key={opt}>{opt}</option>)}</select>}
      </section>)}
      {error&&<div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="flex items-center justify-between pb-8"><button disabled={sending} className="rounded bg-violet-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60">{sending?"Gönderiliyor...":"Gönder"}</button><span className="text-xs text-slate-500">e-Nstitü</span></div>
    </form>
  </div>;
}

function StateCard({icon,title,text}:{icon?:React.ReactNode;title:string;text:string}){return <div className="min-h-screen bg-[#f0ebf8] px-4 py-12"><div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">{icon&&<div className="mb-4">{icon}</div>}<h1 className="text-2xl font-semibold text-slate-900">{title}</h1><p className="mt-2 text-slate-600">{text}</p></div></div>}
