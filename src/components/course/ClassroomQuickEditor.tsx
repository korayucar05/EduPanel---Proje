import React from "react";
import { Check, Pencil, Save, Trash2 } from "lucide-react";
import type { Classroom, Teacher } from "../../types";
import type { ClassroomFormState } from "./ClassroomEditModal";
import { compareClassrooms } from "../../utils/classroomSort";

type Props = {
  classError: string;
  classForm: ClassroomFormState;
  setClassForm: React.Dispatch<React.SetStateAction<ClassroomFormState>>;
  editingClassId: string | null;
  classrooms: Classroom[];
  teachers: Teacher[];
  getBranchLetter: (name: string) => string;
  handleLevelChangeInModal: (level: string) => void;
  handleBranchNameChange: (value: string) => void;
  handleAddClass: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleDeleteClass: (id: string, name: string) => void | Promise<void>;
  openEditClassModal: (classroom: Classroom) => void;
};

const normalize = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");

const isCounselor = (teacher: Teacher) => {
  const branch = normalize((teacher as any)?.branch);
  return (
    branch.includes("rehberlik") ||
    branch.includes("psikolojik danışman") ||
    branch.includes("psikolojik danisman") ||
    branch === "pdr" ||
    branch.includes("pdr")
  );
};

const isSchoolAdministrator = (teacher: Teacher) => {
  const role = normalize((teacher as any)?.adminRole || (teacher as any)?.role || (teacher as any)?.title);
  return (
    role.includes("müdür") ||
    role.includes("mudur") ||
    role.includes("yönetici") ||
    role.includes("yonetici")
  );
};

const isVicePrincipal = (teacher: Teacher) => {
  const role = normalize((teacher as any)?.adminRole || (teacher as any)?.role || (teacher as any)?.title);
  return (
    role.includes("müdür yardımcısı") ||
    role.includes("mudur yardimcisi") ||
    role.includes("müdür yard") ||
    role.includes("mudur yard")
  );
};

const levelNumber = (level: string) => level.match(/\d+/)?.[0] || "9";

export default function ClassroomQuickEditor({
  classError,
  classForm,
  setClassForm,
  editingClassId,
  classrooms,
  teachers,
  getBranchLetter,
  handleLevelChangeInModal,
  handleBranchNameChange,
  handleAddClass,
  handleDeleteClass,
  openEditClassModal,
}: Props) {
  const sortedTeachers = [...teachers]
    .filter(Boolean)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr-TR"));

  const advisorTeachers = sortedTeachers.filter(
    (teacher) => !isSchoolAdministrator(teacher) && !isCounselor(teacher),
  );
  const counselorTeachers = sortedTeachers.filter(isCounselor);
  const vicePrincipals = sortedTeachers.filter(isVicePrincipal);

  const sortedClassrooms = [...classrooms].filter(Boolean).sort(compareClassrooms);
  const formReady = Boolean(classForm.level && getBranchLetter(classForm.name).trim());

  const isGroupSelected = (groupName: "GENEL" | "SAY" | "EA" | "SÖZ" | "DİL") => {
    if (groupName === "GENEL") return (classForm.groups || []).length === 0;
    return (classForm.groups || []).includes(groupName);
  };

  const toggleGroup = (groupName: "GENEL" | "SAY" | "EA" | "SÖZ" | "DİL") => {
    setClassForm((previous) => {
      const current = Array.isArray(previous.groups) ? previous.groups : [];
      if (groupName === "GENEL") return { ...previous, groups: [] };
      const selected = current.includes(groupName);
      return {
        ...previous,
        groups: selected
          ? current.filter((group) => group !== groupName)
          : [...new Set([...current.filter((group) => group !== "GENEL"), groupName])],
      };
    });
  };

  const groupButton = (groupName: "GENEL" | "SAY" | "EA" | "SÖZ" | "DİL") => {
    const selected = isGroupSelected(groupName);
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => toggleGroup(groupName)}
        className={`relative h-9 min-w-[44px] rounded-lg border px-2 text-[11px] font-black transition-all ${
          selected
            ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
        }`}
      >
        {selected && <Check className="absolute right-1 top-1 h-3 w-3" />}
        {groupName}
      </button>
    );
  };

  const selectClass =
    "h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  const renderEditableCells = () => (
    <>
      <td className="border-b border-slate-100 px-1 py-1.5 align-middle">
        <select
          value={classForm.level}
          onChange={(event) => handleLevelChangeInModal(event.target.value)}
          className="h-9 w-[58px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-800 outline-none focus:border-indigo-400"
        >
          {[9, 10, 11, 12].map((grade) => (
            <option key={grade} value={`${grade}. Sınıf`}>
              {grade}
            </option>
          ))}
        </select>
      </td>
      <td className="border-b border-slate-100 px-1 py-1.5 align-middle">
        <input
          type="text"
          maxLength={10}
          value={getBranchLetter(classForm.name)}
          onChange={(event) => handleBranchNameChange(event.target.value)}
          className="h-9 w-[58px] rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-black uppercase text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          placeholder="A"
        />
      </td>
      <td className="border-b border-slate-100 px-1 py-1.5 text-center">{groupButton("GENEL")}</td>
      <td className="border-b border-slate-100 px-1 py-1.5 text-center">{groupButton("SAY")}</td>
      <td className="border-b border-slate-100 px-1 py-1.5 text-center">{groupButton("EA")}</td>
      <td className="border-b border-slate-100 px-1 py-1.5 text-center">{groupButton("SÖZ")}</td>
      <td className="border-b border-slate-100 px-1 py-1.5 text-center">{groupButton("DİL")}</td>
      <td className="border-b border-slate-100 px-1 py-1.5">
        <select
          value={classForm.advisorTeacherId || ""}
          onChange={(event) =>
            setClassForm((previous) => ({ ...previous, advisorTeacherId: event.target.value }))
          }
          className={selectClass}
        >
          <option value="">Seçiniz</option>
          {advisorTeachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </select>
      </td>
      <td className="border-b border-slate-100 px-1 py-1.5">
        <select
          value={classForm.counselorTeacherId || ""}
          onChange={(event) =>
            setClassForm((previous) => ({ ...previous, counselorTeacherId: event.target.value }))
          }
          className={selectClass}
        >
          <option value="">Seçiniz</option>
          {counselorTeachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </select>
      </td>
      <td className="border-b border-slate-100 px-1 py-1.5">
        <select
          value={classForm.vicePrincipal || ""}
          onChange={(event) =>
            setClassForm((previous) => ({ ...previous, vicePrincipal: event.target.value }))
          }
          className={selectClass}
        >
          <option value="">Seçiniz</option>
          {vicePrincipals.map((teacher) => (
            <option key={teacher.id} value={teacher.name}>
              {teacher.name}
            </option>
          ))}
        </select>
      </td>
    </>
  );

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      {classError && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {classError}
        </div>
      )}

      <form onSubmit={handleAddClass}>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full table-fixed border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-500">
                <th className="w-[64px] border-b border-slate-200 px-1 py-2">Sınıf</th>
                <th className="w-[68px] border-b border-slate-200 px-1 py-2">Şube Adı</th>
                <th className="w-[48px] border-b border-slate-200 px-1 py-2 text-center">GENEL</th>
                <th className="w-[46px] border-b border-slate-200 px-1 py-2 text-center">SAY</th>
                <th className="w-[46px] border-b border-slate-200 px-1 py-2 text-center">EA</th>
                <th className="w-[46px] border-b border-slate-200 px-1 py-2 text-center">SÖZ</th>
                <th className="w-[46px] border-b border-slate-200 px-1 py-2 text-center">DİL</th>
                <th className="w-[150px] border-b border-slate-200 px-1 py-2">Sınıf Rehber Öğretmeni</th>
                <th className="w-[140px] border-b border-slate-200 px-1 py-2">Rehber Öğretmen</th>
                <th className="w-[150px] border-b border-slate-200 px-1 py-2">Sorumlu Müdür Yardımcısı</th>
                <th className="w-[220px] border-b border-slate-200 px-1 py-2 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {editingClassId === null && (
                <tr className="border-2 border-violet-500 bg-yellow-300">
                  {renderEditableCells()}
                  <td className="border-b border-slate-100 px-1 py-1.5">
                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                      <button
                        type="submit"
                        disabled={!formReady}
                        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[9px] font-black ${formReady ? "bg-emerald-600 text-white hover:bg-emerald-700" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}
                      >
                        <Save className="h-3.5 w-3.5" /> Kaydet
                      </button>
                      <button type="button" disabled className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[9px] font-black text-slate-300">
                        <Pencil className="h-3.5 w-3.5" /> Düzenle
                      </button>
                      <button type="button" disabled className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[9px] font-black text-slate-300">
                        <Trash2 className="h-3.5 w-3.5" /> Sil
                      </button>
                    </div>
                  </td>
                </tr>
              )}
  

              {sortedClassrooms.map((classroom) => {
                const editing = editingClassId === classroom.id;
                const groups = Array.isArray(classroom.groups) ? classroom.groups : [];
                const advisor = classroom.advisorTeacherName || teachers.find((t) => t.id === classroom.advisorTeacherId)?.name || "—";
                const counselor = classroom.counselorTeacherName || teachers.find((t) => t.id === classroom.counselorTeacherId)?.name || "—";

                return (
                  <tr key={classroom.id} className={editing ? "bg-indigo-50/50" : "hover:bg-slate-50/70"}>
                    {editing ? (
                      renderEditableCells()
                    ) : (
                      <>
                        <td className="border-b border-slate-100 px-1 py-1.5 text-xs font-black text-slate-800">{levelNumber(classroom.level || "")}</td>
                        <td className="border-b border-slate-100 px-1 py-1.5 text-xs font-black text-slate-900">{getBranchLetter(classroom.name)}</td>
                        {(["GENEL", "SAY", "EA", "SÖZ", "DİL"] as const).map((group) => {
                          const selected = group === "GENEL" ? groups.length === 0 : groups.includes(group);
                          return (
                            <td key={group} className="border-b border-slate-100 px-1 py-1.5 text-center">
                              <span className={`inline-flex h-7 min-w-[40px] items-center justify-center rounded-lg border px-2 text-[10px] font-black ${selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-slate-50 text-slate-300"}`}>
                                {group}
                              </span>
                            </td>
                          );
                        })}
                        <td className="border-b border-slate-100 px-1 py-1.5 text-[11px] font-bold text-slate-700">{advisor}</td>
                        <td className="border-b border-slate-100 px-1 py-1.5 text-[11px] font-bold text-slate-700">{counselor}</td>
                        <td className="border-b border-slate-100 px-1 py-1.5 text-[11px] font-bold text-slate-700">{classroom.vicePrincipal || "—"}</td>
                      </>
                    )}

                    <td className="border-b border-slate-100 px-1 py-1.5">
                      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                        <button
                          type="submit"
                          disabled={!editing || !formReady}
                          className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[9px] font-black ${editing && formReady ? "bg-emerald-600 text-white hover:bg-emerald-700" : "cursor-not-allowed bg-slate-100 text-slate-300"}`}
                        >
                          <Save className="h-3.5 w-3.5" /> Kaydet
                        </button>
                        <button
                          type="button"
                          disabled={editing}
                          onClick={() => openEditClassModal(classroom)}
                          className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[9px] font-black ${editing ? "cursor-not-allowed bg-slate-100 text-slate-300" : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteClass(classroom.id, classroom.name)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[9px] font-black text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

          </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
