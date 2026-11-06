import React from "react";
import { ArrowLeft, Home, LockKeyhole } from "lucide-react";
import { roleLabel, type CloudRole } from "../../core/auth";

type AccessDeniedStateProps = {
  role: CloudRole;
  moduleId: string;
  onBack: () => void;
  onHome: () => void;
};

export default function AccessDeniedState({ role, moduleId, onBack, onHome }: AccessDeniedStateProps) {
  return (
    <section className="mx-auto flex min-h-[58vh] max-w-3xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-xl sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <LockKeyhole className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-slate-900">Bu modüle erişim yetkiniz yok</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600">
          {roleLabel(role)} rolü <span className="font-black text-slate-800">{moduleId}</span> çalışma alanını açamaz.
          Yetkinizin değişmesi gerekiyorsa okul yöneticinizden kullanıcı izinlerinizi güncellemesini isteyin.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onBack} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Önceki ekrana dön
          </button>
          <button type="button" onClick={onHome} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700">
            <Home className="h-4 w-4" /> Ana sayfaya git
          </button>
        </div>
      </div>
    </section>
  );
}
