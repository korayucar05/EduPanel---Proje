import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, UserRound } from "lucide-react";

type RegistrationForm = {
  id: string;
  name: string;
  classroom: string;
  group: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  dob: string;
  pob: string;
  address: string;
  oob: string;
};

const EMPTY_FORM: RegistrationForm = {
  id: "",
  name: "",
  classroom: "",
  group: "",
  phone: "+90",
  parentName: "",
  parentPhone: "+90",
  dob: "",
  pob: "",
  address: "",
  oob: "",
};

const upper = (value: string) =>
  value.toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");

const normalizePhone = (value: string) => {
  let digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("90") && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 10);
  return `+90${digits}`;
};

const isValidTurkeyPhone = (value: string) => /^\+90\d{10}$/.test(value);
const FIXED_CLASSROOMS = Array.from({ length: 4 }, (_, grade) =>
  ["A", "B", "C", "D", "E"].map((branch) => `${grade + 9}${branch}`),
).flat();

export default function StudentRegisterForm() {
  const [form, setForm] = useState<RegistrationForm>(EMPTY_FORM);
  const [classrooms, setClassrooms] = useState<string[]>([]);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/public/student-registration/bootstrap", {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Kayıt formu hazırlanamadı.");
        }
        if (!active) return;
        // Public QR form uses a stable, controlled list; server data may contain
        // teacher-only or historic class names.
        setClassrooms(FIXED_CLASSROOMS);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Kayıt formu hazırlanamadı.");
        }
      })
      .finally(() => {
        if (active) setLoadingBootstrap(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const classroomGroups = useMemo(() => {
    const match = form.classroom.match(/^(\d{1,2})/);
    const grade = match ? Number(match[1]) : 0;
    return grade >= 11 ? ["SAY", "EA", "SÖZ", "DİL"] : [];
  }, [form.classroom]);

  const setText = (field: keyof RegistrationForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: upper(value),
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || completed) return;

    setError("");

    const studentNo = form.id.trim();
    const studentName = upper(form.name.trim());
    const parentName = upper(form.parentName.trim());

    if (!studentNo || !studentName || !form.classroom) {
      setError("ÖĞRENCİ NO, AD SOYAD VE SINIF / ŞUBE ZORUNLUDUR. DİĞER BİLGİLER SONRADAN GİRİLEBİLİR.");
      return;
    }

    if (form.phone !== "+90" && !isValidTurkeyPhone(form.phone)) {
      setError("ÖĞRENCİ TELEFONU +90 İLE BAŞLAYAN 10 HANELİ NUMARA OLMALIDIR.");
      return;
    }

    if (form.parentPhone !== "+90" && !isValidTurkeyPhone(form.parentPhone)) {
      setError("VELİ TELEFONU +90 İLE BAŞLAYAN 10 HANELİ NUMARA OLMALIDIR.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/public/student-registration/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          id: studentNo,
          name: studentName,
          parentName,
          phone: form.phone === "+90" ? "" : form.phone,
          parentPhone: form.parentPhone === "+90" ? "" : form.parentPhone,
          pob: upper(form.pob),
          address: upper(form.address),
          group: upper(form.group),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "KAYIT YAPILAMADI.");
      }

      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? upper(err.message) : "KAYIT YAPILAMADI.");
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
        <section className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-900">
            KAYDINIZ ALINDI
          </h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
            BİLGİLERİNİZ OKUL SİSTEMİNE KAYDEDİLDİ. AYNI ÖĞRENCİ NUMARASI İLE İKİNCİ KEZ KAYIT YAPILAMAZ.
          </p>
        </section>
      </main>
    );
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold uppercase text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 sm:px-5">
      <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="bg-slate-950 px-5 py-5 text-white sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black">ÖĞRENCİ BİLGİ KAYIT FORMU</h1>
              <p className="mt-1 text-xs font-semibold text-slate-300">
                FORM YALNIZCA BİR KEZ GÖNDERİLEBİLİR.
              </p>
            </div>
          </div>
        </header>

        {loadingBootstrap ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
              <p className="mt-3 text-xs font-black text-slate-500">FORM HAZIRLANIYOR...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
                <p className="text-xs font-bold leading-5 text-indigo-900">
                  KAYIT İÇİN YALNIZCA ÖĞRENCİ NO, AD SOYAD VE SINIF / ŞUBE ZORUNLUDUR. DİĞER BİLGİLER SONRADAN GİRİLEBİLİR. TÜM HARFLER OTOMATİK OLARAK BÜYÜK HARFE ÇEVRİLİR. TELEFON NUMARALARI +90XXXXXXXXXX BİÇİMİNDE KAYDEDİLİR. ÖĞRENCİ NUMARANIZ KAYDEDİLDİKTEN SONRA AYNI NUMARA İLE YENİDEN FORM GÖNDERİLEMEZ.
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black text-rose-700">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">ÖĞRENCİ NO *</span>
                <input
                  value={form.id}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      id: e.target.value.replace(/\D/g, "").slice(0, 12),
                    }))
                  }
                  inputMode="numeric"
                  className={inputClass}
                />
              </label>

              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">AD SOYAD *</span>
                <input value={form.name} onChange={(e) => setText("name", e.target.value)} className={inputClass} />
              </label>

              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">SINIF / ŞUBE *</span>
                <select
                    value={form.classroom}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      classroom: upper(e.target.value),
                      group: "",
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">SEÇİNİZ</option>
                  {FIXED_CLASSROOMS.map((classroom) => (
                    <option key={classroom} value={classroom}>
                      {classroom}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">ALAN / GRUP</span>
                <select
                  value={form.group}
                  onChange={(e) => setText("group", e.target.value)}
                  disabled={classroomGroups.length === 0}
                  className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                >
                  <option value="">SEÇİNİZ</option>
                  {classroomGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">ÖĞRENCİ TELEFONU</span>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      phone: normalizePhone(e.target.value.replace(/\D/g, "").replace(/^90/, "")),
                    }))
                  }
                  inputMode="tel"
                  className={inputClass}
                />
              </label>

              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">VELİ ADI SOYADI</span>
                <input value={form.parentName} onChange={(e) => setText("parentName", e.target.value)} className={inputClass} />
              </label>

              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">VELİ TELEFONU</span>
                <input
                  value={form.parentPhone}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      parentPhone: normalizePhone(e.target.value.replace(/\D/g, "").replace(/^90/, "")),
                    }))
                  }
                  inputMode="tel"
                  className={inputClass}
                />
              </label>

              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">DOĞUM TARİHİ</span>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((current) => ({ ...current, dob: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">DOĞUM YERİ</span>
                <input value={form.pob} onChange={(e) => setText("pob", e.target.value)} className={inputClass} />
              </label>

              <label>
                <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">OKUL PUANI (OÖB)</span>
                <input
                  value={form.oob}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      oob: e.target.value.replace(/[^0-9,.]/g, "").slice(0, 6),
                    }))
                  }
                  inputMode="decimal"
                  className={inputClass}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase text-slate-500">AÇIK ADRES</span>
              <textarea
                value={form.address}
                onChange={(e) => setText("address", e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold uppercase text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 text-sm font-black text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              BİLGİLERİMİ KAYDET
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
