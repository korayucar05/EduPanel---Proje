import React from "react";
import { Check, Pencil, Save, School, X } from "lucide-react";
import type { Classroom, Teacher } from "../../types";

export type ClassroomFormState = {
  name: string;
  level: string;
  groups: string[];
  group1Name?: string;
  group2Name?: string;
  advisorTeacherId: string;
  counselorTeacherId: string;
  vicePrincipal: string;
};

type Props = {
  isOpen: boolean;
  editingClassId: string | null;
  classForm: ClassroomFormState;
  setClassForm: React.Dispatch<React.SetStateAction<ClassroomFormState>>;
  teachers: Teacher[];
  classrooms: Classroom[];
  getBranchLetter: (name: string) => string;
  handleLevelChangeInModal: (level: string) => void;
  handleBranchNameChange: (value: string) => void;
  handleAddClass: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleDeleteClass: (id: string, name: string) => void | Promise<void>;
  onClose: () => void;
};

export default function ClassroomEditModal({
  isOpen,
  editingClassId,
  classForm,
  setClassForm,
  teachers,
  classrooms,
  getBranchLetter,
  handleLevelChangeInModal,
  handleBranchNameChange,
  handleAddClass,
  handleDeleteClass,
  onClose,
}: Props) {
  if (!isOpen) return null;

  const sortedTeachers = [...teachers]
    .filter(Boolean)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr-TR"));
  const counselors = sortedTeachers.filter((teacher) => {
    const branch = String(teacher?.branch || "").toLocaleLowerCase("tr-TR").trim();
    return branch === "rehberlik" || branch === "rehber öğretmen" || branch === "pdr" || branch.includes("rehberlik");
  });
  const vicePrincipals = sortedTeachers.filter(
    (teacher) => String(teacher?.adminRole || "").trim() === "Müdür Yardımcısı",
  );

  return (
    <div className="fixed inset-0 z-[200] bg-white animate-fadeIn flex flex-col">
      <div className="h-20 shrink-0 px-8 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <School className="w-6 h-6" />
            </span>
            {editingClassId ? "Sınıfı Düzenle" : "Yeni Sınıf Oluştur"}
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-1 ml-14">
            Sınıf düzeyi, şube, gruplar ve sorumlu personel bilgilerini belirleyin.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all"
          aria-label="Pencereyi kapat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleAddClass} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-7">
          <div className="max-w-7xl mx-auto space-y-7">
            <section className="rounded-3xl border-2 border-amber-400 bg-yellow-100 p-6 shadow-md shadow-amber-200/60">
              <div className="mb-5 flex items-center gap-3">
                <span className="rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-950">Sınıf tanımlama alanı</span>
                <span className="text-xs font-semibold text-amber-900">Yeni sınıf bilgilerini en üstte tanımlayın.</span>
              </div>
              <div className="flex flex-col xl:flex-row xl:items-end gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-black text-slate-800 mb-3">Sınıf Seviyesi *</label>
                  <select
                    value={classForm.level}
                    onChange={(event) => handleLevelChangeInModal(event.target.value)}
                    className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-5 text-base font-black text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  >
                    {["9. Sınıf", "10. Sınıf", "11. Sınıf", "12. Sınıf"].map((grade) => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>
                <div className="xl:w-[320px]">
                  <label className="block text-sm font-black text-slate-800 mb-3">Şube Adı *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={getBranchLetter(classForm.name)}
                    onChange={(event) => handleBranchNameChange(event.target.value)}
                    className="w-full h-14 px-5 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none bg-white text-slate-900 text-lg font-black uppercase placeholder:text-slate-300"
                    placeholder="Örn: A"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-black text-slate-900">Sınıf Grupları</h4>
                  <p className="text-xs text-slate-500 font-semibold mt-1">Bir sınıfta birden fazla grup seçebilirsiniz. Seçili gruplar belirgin renkle gösterilir.</p>
                </div>
                {classForm.groups.length > 0 && (
                  <span className="shrink-0 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black">{classForm.groups.length} grup seçili</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {["GENEL", "SAY", "EA", "SÖZ", "DİL"].map((groupName) => {
                  const isGeneral = groupName === "GENEL";
                  const selected = isGeneral ? classForm.groups.length === 0 : classForm.groups.includes(groupName);
                  return (
                    <button
                      key={groupName}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        if (isGeneral) {
                          setClassForm((previous) => ({ ...previous, groups: [] }));
                          return;
                        }
                        setClassForm((previous) => ({
                          ...previous,
                          groups: selected
                            ? previous.groups.filter((group) => group !== groupName)
                            : [...new Set([...previous.groups, groupName])],
                        }));
                      }}
                      className={`relative h-16 rounded-2xl border-2 font-black text-base transition-all ${selected ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20 ring-4 ring-emerald-100" : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"}`}
                    >
                      {selected && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"><Check className="w-3.5 h-3.5" /></span>}
                      {groupName}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-6 shadow-sm">
              <h4 className="text-sm font-black text-slate-900 mb-5">Sorumlu Personel</h4>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-2">Sınıf Rehber Öğretmeni</label>
                  <select value={classForm.advisorTeacherId} onChange={(event) => setClassForm((previous) => ({ ...previous, advisorTeacherId: event.target.value }))} className="w-full min-h-[52px] px-4 border-2 border-slate-200 rounded-2xl bg-white text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
                    <option value="">Seçiniz</option>
                    {sortedTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.branch ? ` — ${teacher.branch}` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-2">Rehber Öğretmen</label>
                  <select value={classForm.counselorTeacherId} onChange={(event) => setClassForm((previous) => ({ ...previous, counselorTeacherId: event.target.value }))} className="w-full min-h-[52px] px-4 border-2 border-slate-200 rounded-2xl bg-white text-sm font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100">
                    <option value="">Seçiniz</option>
                    {counselors.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                  </select>
                  <p className="text-[11px] text-slate-400 font-semibold mt-2">Yalnızca branşı Rehberlik/PDR olan öğretmenler listelenir.</p>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-2">Sorumlu Müdür Yardımcısı</label>
                  <select value={classForm.vicePrincipal} onChange={(event) => setClassForm((previous) => ({ ...previous, vicePrincipal: event.target.value }))} className="w-full min-h-[52px] px-4 border-2 border-slate-200 rounded-2xl bg-white text-sm font-bold text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
                    <option value="">Seçiniz</option>
                    {vicePrincipals.map((teacher) => <option key={teacher.id} value={teacher.name}>{teacher.name}</option>)}
                  </select>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="shrink-0 px-8 py-5 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
          <div className="text-xs font-semibold text-slate-500">
            <span className="font-black text-slate-700">Önizleme:</span>{" "}{classForm.name || `${classForm.level} / Şube belirtilmedi`}{classForm.groups.length > 0 ? ` • ${classForm.groups.join(", ")}` : ""}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!editingClassId}
              onClick={() => {
                const selectedClass = classrooms.find((classroom) => classroom.id === editingClassId);
                if (!selectedClass) return;
                onClose();
                void handleDeleteClass(selectedClass.id, selectedClass.name);
              }}
              className="h-12 rounded-2xl border-2 border-rose-500 px-6 text-sm font-black text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"
            >Sil</button>
            <button type="submit" disabled={!editingClassId} className="flex h-12 items-center gap-2 rounded-2xl bg-amber-500 px-8 text-sm font-black text-amber-950 shadow-lg transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-35"><Pencil className="w-4 h-4" />Güncelle</button>
            <button type="submit" disabled={Boolean(editingClassId)} className="flex h-12 items-center gap-2 rounded-2xl bg-indigo-600 px-8 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-35"><Save className="w-4 h-4" />Kaydet</button>
          </div>
        </div>
      </form>
    </div>
  );
}
