import React from "react";
import { Sparkles, CalendarDays, AlertTriangle, Users, ClipboardCheck } from "lucide-react";

export default function RotaWelcome() {
  const today = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-2xl border border-slate-800">
      <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.45em] text-indigo-300">
              e-Nstitü
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight">
              Yönetim Merkezi
            </h1>

            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
              Okul Yönetim ve Karar Destek Sistemi. Veriyi bilgiye, bilgiyi doğru
              kararlara dönüştüren akıllı yönetim platformu.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right border border-white/10">
            <p className="text-xs text-slate-400">Bugün</p>
            <p className="text-sm font-black text-white">{today}</p>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-rose-500/10 p-4 border border-rose-400/20">
            <AlertTriangle className="mb-3 h-5 w-5 text-rose-300" />
            <p className="text-xs text-rose-200">Öncelik</p>
            <p className="mt-1 text-lg font-black">Devamsızlık Takibi</p>
          </div>

          <div className="rounded-2xl bg-blue-500/10 p-4 border border-blue-400/20">
            <Users className="mb-3 h-5 w-5 text-blue-300" />
            <p className="text-xs text-blue-200">Personel</p>
            <p className="mt-1 text-lg font-black">Nöbet & İzin</p>
          </div>

          <div className="rounded-2xl bg-emerald-500/10 p-4 border border-emerald-400/20">
            <ClipboardCheck className="mb-3 h-5 w-5 text-emerald-300" />
            <p className="text-xs text-emerald-200">İş Akışı</p>
            <p className="mt-1 text-lg font-black">Günlük Görevler</p>
          </div>

          <div className="rounded-2xl bg-amber-500/10 p-4 border border-amber-400/20">
            <CalendarDays className="mb-3 h-5 w-5 text-amber-300" />
            <p className="text-xs text-amber-200">Takvim</p>
            <p className="mt-1 text-lg font-black">Okul Gündemi</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white/10 p-4 border border-white/10">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-emerald-300" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-300">
                e-Nstitü Öneriyor
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-200">
                Bugün yönetim ekranında devamsızlık, nöbet, izin ve duyuru
                işlemlerini öncelikli olarak kontrol etmeniz önerilir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
