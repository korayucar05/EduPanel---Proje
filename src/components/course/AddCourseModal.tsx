import React from "react";
import { BookOpen, X } from "lucide-react";

export interface AddCourseModalProps {
  isAddCourseModalOpen: boolean;
  setIsAddCourseModalOpen: (value: boolean) => void;
  newCourseName: string;
  setNewCourseName: React.Dispatch<React.SetStateAction<string>>;
  newCourseHours: number;
  setNewCourseHours: React.Dispatch<React.SetStateAction<number>>;
  newCourseType: "Zorunlu Ders" | "Seçmeli Ders";
  setNewCourseType: React.Dispatch<React.SetStateAction<"Zorunlu Ders" | "Seçmeli Ders">>;
  newCourseGrades: string[];
  setNewCourseGrades: React.Dispatch<React.SetStateAction<string[]>>;
  newCourseTargetGroups: Array<"ORTAK" | "SAY" | "EA" | "SÖZ" | "DİL">;
  setNewCourseTargetGroups: React.Dispatch<React.SetStateAction<Array<"ORTAK" | "SAY" | "EA" | "SÖZ" | "DİL">>>;
  classrooms: any[];
  handleSaveCustomCourse: () => void | Promise<void>;
}

export default function AddCourseModal(props: AddCourseModalProps) {
  const {
    isAddCourseModalOpen, setIsAddCourseModalOpen, newCourseName, setNewCourseName,
    newCourseHours, setNewCourseHours, newCourseType, setNewCourseType,
    newCourseGrades, setNewCourseGrades, newCourseTargetGroups, setNewCourseTargetGroups,
    classrooms, handleSaveCustomCourse,
  } = props;
  return (
<>
{isAddCourseModalOpen && (
  <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6">
    <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm sm:px-8">
        <div>
          <h3 className="flex items-center gap-3 text-xl font-black text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <BookOpen className="h-5 w-5" />
            </span>
            Ders Ekle
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Ders bilgilerini, ders türünü, sınıf düzeyini ve gerekiyorsa hedef grupları belirleyin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAddCourseModalOpen(false);
            setNewCourseTargetGroups(["ORTAK"]);
          }}
          className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
          aria-label="Ders ekleme penceresini kapat"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h4 className="text-sm font-black text-slate-900">1. Ders Bilgileri</h4>
              <p className="mt-1 text-xs font-semibold text-slate-400">Ders adını ve haftalık ders saatini elle girin.</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_minmax(360px,0.9fr)] xl:items-end">
              <div>
                <label className="mb-2 block text-xs font-black text-slate-600">Ders Adı</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Örn: Matematik, Görsel Sanatlar, Biyoloji..."
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-900 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black text-slate-600">Haftalık Ders Saati</label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={newCourseHours}
                  onChange={(e) => setNewCourseHours(Math.max(1, Math.min(40, parseInt(e.target.value, 10) || 1)))}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center text-lg font-black text-slate-900 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black text-slate-600">Ders Türü</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "Zorunlu Ders" as const, title: "Zorunlu Ders" },
                    { value: "Seçmeli Ders" as const, title: "Seçmeli Ders" },
                  ].map(option => {
                    const selected = newCourseType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setNewCourseType(option.value);
                          if (option.value === "Zorunlu Ders") setNewCourseTargetGroups(["ORTAK"]);
                        }}
                        className={`h-14 rounded-2xl border-2 px-3 text-sm font-black transition-all ${selected
                          ? "border-rose-500 bg-rose-600 text-white ring-4 ring-rose-100"
                          : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50/40"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">{selected && <span>✓</span>}{option.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h4 className="text-sm font-black text-slate-900">2. Sınıf Düzeyi</h4>
              <p className="mt-1 text-xs font-semibold text-slate-400">Dersin okutulacağı bir veya birden fazla sınıf düzeyini seçin.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {["9. Sınıf", "10. Sınıf", "11. Sınıf", "12. Sınıf"].map(grade => {
                const selected = newCourseGrades.includes(grade);
                const classCount = classrooms.filter(cls => cls.level === grade).length;
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() =>
                      setNewCourseGrades(previous => {
                        const exists = previous.includes(grade);
                        if (exists) {
                          const next = previous.filter(item => item !== grade);
                          return next;
                        }
                        return [...previous, grade];
                      })
                    }
                    className={`min-h-[88px] rounded-2xl border-2 px-4 py-3 text-center transition-all ${
                      selected
                        ? "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-200 ring-4 ring-violet-100"
                        : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50"
                    }`}
                  >
                    <div className="text-base font-black">{grade}</div>
                    <div className={`mt-1 text-[10px] font-bold ${selected ? "text-violet-100" : "text-slate-400"}`}>{classCount} kayıtlı sınıf</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`rounded-3xl border p-5 shadow-sm transition sm:p-6 ${newCourseType === "Seçmeli Ders" ? "border-emerald-200 bg-white" : "border-slate-200 bg-slate-100/80"}`}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className={`text-sm font-black ${newCourseType === "Seçmeli Ders" ? "text-slate-900" : "text-slate-400"}`}>3. Seçmeli Ders Hedef Grubu</h4>
                <p className={`mt-1 text-xs font-semibold ${newCourseType === "Seçmeli Ders" ? "text-slate-400" : "text-slate-400"}`}>
                  {newCourseType === "Seçmeli Ders"
                    ? "Bir veya birden fazla grup seçebilirsiniz. GENEL seçimi sınıf düzeyindeki tüm şubeleri kapsar."
                    : "Bu alan yalnızca Seçmeli Ders seçildiğinde aktif olur."}
                </p>
              </div>
              {newCourseType !== "Seçmeli Ders" && (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Pasif</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { value: "ORTAK" as const, label: "GENEL", description: "Tüm şubeler" },
                { value: "SAY" as const, label: "SAY", description: "Sayısal" },
                { value: "EA" as const, label: "EA", description: "Eşit Ağırlık" },
                { value: "SÖZ" as const, label: "SÖZ", description: "Sözel" },
                { value: "DİL" as const, label: "DİL", description: "Yabancı Dil" },
              ].map(option => {
                const enabled = newCourseType === "Seçmeli Ders";
                const selected = enabled && newCourseTargetGroups.includes(option.value);
                const matchedClassCount = option.value === "ORTAK"
                  ? classrooms.filter(cls => newCourseGrades.includes(cls.level)).length
                  : classrooms.filter(cls =>
                      newCourseGrades.includes(cls.level) &&
                      (cls.groups || []).some(group => group.toLocaleUpperCase("tr-TR") === option.value),
                    ).length;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!enabled}
                    onClick={() => {
                      if (!enabled) return;
                      if (option.value === "ORTAK") {
                        setNewCourseTargetGroups(["ORTAK"]);
                        return;
                      }
                      setNewCourseTargetGroups(previous => {
                        const withoutGeneral = previous.filter(group => group !== "ORTAK");
                        const next = withoutGeneral.includes(option.value)
                          ? withoutGeneral.filter(group => group !== option.value)
                          : [...withoutGeneral, option.value];
                        return next.length > 0 ? next : ["ORTAK"];
                      });
                    }}
                    className={`min-h-[98px] rounded-2xl border-2 px-3 py-3 text-center transition-all ${
                      !enabled
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 opacity-70"
                        : selected
                          ? "border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-4 ring-emerald-100"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-base font-black">{option.label}</span>
                      {selected && <span className="text-sm font-black">✓</span>}
                    </div>
                    <div className={`mt-1 text-[10px] font-bold ${selected ? "text-emerald-50" : "text-slate-400"}`}>{option.description}</div>
                    <div className={`mt-2 text-[9px] font-black ${selected ? "text-white" : enabled ? "text-slate-500" : "text-slate-300"}`}>{matchedClassCount} sınıf</div>
                  </button>
                );
              })}
            </div>

            {newCourseType === "Seçmeli Ders" && newCourseTargetGroups.some(group => group !== "ORTAK") && classrooms.filter(cls =>
              newCourseGrades.includes(cls.level) &&
              (cls.groups || []).some(group => newCourseTargetGroups.includes(group.toLocaleUpperCase("tr-TR") as "SAY" | "EA" | "SÖZ" | "DİL")),
            ).length === 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                {newCourseGrades.join(", ")} düzeylerinde seçtiğiniz {newCourseTargetGroups.filter(group => group !== "ORTAK").join(", ")} gruplarından herhangi biri tanımlanmış sınıf bulunmuyor. Grupları önce Sınıf Bilgisi alanından tanımlayın.
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="hidden text-xs font-semibold text-slate-400 md:block">
            {newCourseName.trim() ? `${newCourseName.trim()} • ${newCourseHours} saat • ${newCourseGrades.join(", ")}` : "Ders bilgilerini tamamlayın."}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsAddCourseModalOpen(false);
                setNewCourseTargetGroups(["ORTAK"]);
              }}
              className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSaveCustomCourse}
              disabled={!newCourseName.trim() || newCourseGrades.length === 0}
              className="rounded-2xl bg-rose-600 px-8 py-3 text-sm font-black text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700"
            >
              Dersi Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

</>
  );
}
