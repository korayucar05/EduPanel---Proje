import React, { useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";

export default function PasswordResetView() {
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") || "";
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return value;
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!token) return setError("Şifre sıfırlama bağlantısı eksik veya geçersiz.");
    if (password.length < 8) return setError("Yeni şifre en az 8 karakter olmalıdır.");
    if (password !== confirmPassword) return setError("Yeni şifreler birbiriyle aynı değil.");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setError(data.error || "Şifre yenilenemedi.");
      setSuccess(data.message || "Şifreniz yenilendi.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Şifre sıfırlama sunucusuna ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => { window.location.href = window.location.pathname; };

  return <main className="flex min-h-screen items-center justify-center bg-[#ece7da] p-5">
    <section className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-7 shadow-[0_24px_70px_rgba(62,55,42,.14)] backdrop-blur-xl sm:p-9">
      <div className="mb-7 flex items-start gap-3"><span className="rounded-2xl bg-[#425843] p-3 text-white"><ShieldCheck className="h-6 w-6" /></span><div><span className="text-[10px] font-black uppercase tracking-[.18em] text-[#66806a]">Güvenli hesap kurtarma</span><h1 className="mt-1 font-serif text-2xl font-semibold text-slate-800">Yeni şifrenizi belirleyin</h1><p className="mt-1 text-xs leading-5 text-slate-500">Bağlantı tek kullanımlıktır ve 20 dakika geçerlidir.</p></div></div>
      {success ? <div className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><p className="mt-4 text-sm font-black text-slate-800">{success}</p><button type="button" onClick={goToLogin} className="mt-6 w-full rounded-2xl bg-[#425843] py-3.5 text-sm font-bold text-white">Giriş ekranına dön</button></div> : <form onSubmit={submit} className="space-y-4">
        {[{ label: "Yeni şifre", value: password, setter: setPassword, autocomplete: "new-password" }, { label: "Yeni şifre tekrar", value: confirmPassword, setter: setConfirmPassword, autocomplete: "new-password" }].map((field) => <label key={field.label} className="block text-xs font-bold text-slate-600">{field.label}<div className="relative mt-2"><KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required minLength={8} autoComplete={field.autocomplete} type={showPassword ? "text" : "password"} value={field.value} onChange={(event) => field.setter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-sm outline-none focus:border-[#66806a] focus:ring-4 focus:ring-[#66806a]/10" />{field.label === "Yeni şifre" && <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400" aria-label="Şifre görünürlüğü"><span>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</span></button>}</div></label>)}
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div>}
        <button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#425843] py-3.5 text-sm font-bold text-white disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Şifreyi Yenile</button>
      </form>}
    </section>
  </main>;
}
