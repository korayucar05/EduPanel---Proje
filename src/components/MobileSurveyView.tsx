import React from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2, Send } from "lucide-react";

type MobileSurveyQuestion = {
  id: string;
  text: string;
  answerType: "short" | "paragraph" | "number" | "phone" | "choice" | "multiple" | "dropdown";
  options: string[];
  required: boolean;
};

type MobileSurveyItem = {
  token: string;
  inviteToken: string;
  title: string;
  description?: string;
  questions: MobileSurveyQuestion[];
  expiresAt?: string;
  publishedAt?: string;
  allowMultipleResponses?: boolean;
  alreadyResponded?: boolean;
};

type Props = {
  onBack: () => void;
  apiBase: string;
};

const answerEmpty = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim();

export default function MobileSurveyView({ onBack, apiBase }: Props) {
  const [surveys, setSurveys] = React.useState<MobileSurveyItem[]>([]);
  const [selected, setSelected] = React.useState<MobileSurveyItem | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/surveys`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setSurveys(Array.isArray(data?.surveys) ? data.surveys : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anketler alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  React.useEffect(() => { void load(); }, [load]);

  const openSurvey = (survey: MobileSurveyItem) => {
    setSelected(survey);
    setAnswers({});
    setError("");
    setMessage("");
  };

  const submit = async () => {
    if (!selected) return;
    const missing = selected.questions.find((question) => question.required && answerEmpty(answers[question.id]));
    if (missing) {
      setError(`“${missing.text}” sorusunu yanıtlayınız.`);
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/surveys/${encodeURIComponent(selected.token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "omit",
        body: JSON.stringify({ inviteToken: selected.inviteToken, answers }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setMessage("ANKET CEVAPLARINIZ KAYDEDİLDİ.");
      setSelected((current) => current ? { ...current, alreadyResponded: true } : current);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anket yanıtları kaydedilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  const setAnswer = (questionId: string, value: string | string[]) =>
    setAnswers((current) => ({ ...current, [questionId]: value }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-slate-50 p-2 text-slate-800">
      <div className="mx-auto min-h-[calc(100vh-1rem)] max-w-xl overflow-hidden rounded-[30px] border border-violet-100 bg-white shadow-[0_22px_60px_rgba(76,29,149,0.12)]">
        <header className="bg-gradient-to-r from-violet-700 via-purple-700 to-fuchsia-700 px-4 py-4 text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selected ? () => { setSelected(null); setAnswers({}); setError(""); setMessage(""); } : onBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"
              aria-label="Geri dön"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-[9px] font-black uppercase tracking-[0.28em] text-violet-100">E-NSTİTÜ</div>
              <h1 className="mt-0.5 text-xl font-black">ANKET</h1>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <ClipboardList className="h-5 w-5" />
            </span>
          </div>
        </header>

        <div className="overflow-hidden">
          <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${selected ? 100 : 0}%)` }}>
            <section className="w-full shrink-0 space-y-3 p-4">
              {loading ? (
                <div className="flex min-h-52 items-center justify-center gap-2 rounded-3xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" /> ANKETLER YÜKLENİYOR…
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-bold text-rose-700">{error}</div>
              ) : surveys.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center rounded-3xl border border-slate-100 bg-slate-50 px-6 text-center">
                  <ClipboardList className="mb-3 h-10 w-10 text-slate-300" />
                  <div className="text-sm font-black text-slate-600">SİZE TANIMLANMIŞ AKTİF ANKET BULUNMUYOR.</div>
                </div>
              ) : (
                surveys.map((survey) => (
                  <button
                    key={`${survey.token}:${survey.inviteToken}`}
                    type="button"
                    onClick={() => openSurvey(survey)}
                    className="w-full rounded-3xl border border-violet-100 bg-gradient-to-r from-white to-violet-50 p-4 text-left shadow-sm transition active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-900">{survey.title}</div>
                        {survey.description ? <div className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-slate-500">{survey.description}</div> : null}
                        {survey.expiresAt ? <div className="mt-2 text-[9px] font-black text-violet-600">SON TARİH: {new Date(survey.expiresAt).toLocaleString("tr-TR")}</div> : null}
                      </div>
                      {survey.alreadyResponded ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[8px] font-black text-emerald-700"><CheckCircle2 className="h-3 w-3" /> CEVAPLANDI</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[8px] font-black text-amber-700">BEKLİYOR</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </section>

            <section className="w-full shrink-0 p-4">
              {selected ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-violet-100 bg-violet-50 p-4">
                    <div className="text-lg font-black text-slate-900">{selected.title}</div>
                    {selected.description ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{selected.description}</p> : null}
                  </div>

                  {selected.questions.map((question, index) => {
                    const value = answers[question.id];
                    return (
                      <article key={question.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-black leading-5 text-slate-800">
                          <span className="mr-1 text-violet-700">{index + 1}.</span>{question.text}{question.required ? <span className="ml-1 text-rose-500">*</span> : null}
                        </div>

                        {question.answerType === "choice" ? (
                          <div className="mt-3 space-y-2">{question.options.map((option) => <label key={option} className="flex items-center gap-2 rounded-2xl border border-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700"><input type="radio" name={`survey-${selected.token}-${question.id}`} checked={value === option} disabled={Boolean(selected.alreadyResponded && !selected.allowMultipleResponses)} onChange={() => setAnswer(question.id, option)} className="h-4 w-4 accent-violet-700" />{option}</label>)}</div>
                        ) : question.answerType === "multiple" ? (
                          <div className="mt-3 space-y-2">{question.options.map((option) => { const values = Array.isArray(value) ? value : []; const checked = values.includes(option); return <label key={option} className="flex items-center gap-2 rounded-2xl border border-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700"><input type="checkbox" checked={checked} disabled={Boolean(selected.alreadyResponded && !selected.allowMultipleResponses)} onChange={() => setAnswer(question.id, checked ? values.filter((item) => item !== option) : [...values, option])} className="h-4 w-4 accent-violet-700" />{option}</label>; })}</div>
                        ) : question.answerType === "dropdown" ? (
                          <select value={typeof value === "string" ? value : ""} disabled={Boolean(selected.alreadyResponded && !selected.allowMultipleResponses)} onChange={(event) => setAnswer(question.id, event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-violet-500"><option value="">SEÇİNİZ</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                        ) : question.answerType === "paragraph" ? (
                          <textarea rows={5} value={typeof value === "string" ? value : ""} disabled={Boolean(selected.alreadyResponded && !selected.allowMultipleResponses)} onChange={(event) => setAnswer(question.id, event.target.value)} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-500" />
                        ) : (
                          <input type={question.answerType === "number" ? "number" : question.answerType === "phone" ? "tel" : "text"} value={typeof value === "string" ? value : ""} disabled={Boolean(selected.alreadyResponded && !selected.allowMultipleResponses)} onChange={(event) => setAnswer(question.id, event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-500" />
                        )}
                      </article>
                    );
                  })}

                  {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-bold text-rose-700">{error}</div> : null}
                  {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-black text-emerald-700">{message}</div> : null}

                  {selected.alreadyResponded && !selected.allowMultipleResponses ? (
                    <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-100 px-4 py-3 text-xs font-black text-emerald-700"><CheckCircle2 className="h-4 w-4" /> BU ANKETİ CEVAPLADINIZ.</div>
                  ) : (
                    <button type="button" disabled={submitting} onClick={() => void submit()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white shadow-md disabled:opacity-60"><Send className="h-4 w-4" />{submitting ? "KAYDEDİLİYOR…" : "ANKETİ GÖNDER"}</button>
                  )}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
