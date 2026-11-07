import React, { useEffect, useMemo, useState } from "react";
import { Check, Layers3, Save, UsersRound } from "lucide-react";
import type { Classroom } from "../../types";
import { classroomService } from "../../modules/classroom";
import { compareClassrooms } from "../../utils/classroomSort";

interface CourseSeatingPlanPanelProps {
  classrooms: Classroom[];
  setClassrooms: React.Dispatch<React.SetStateAction<Classroom[]>>;
  editingClassId: string | null;
  seatingPlanClassName: string;
}

const FIELD_GROUPS = [
  { id: "SAY", label: "Sayısal" },
  { id: "EA", label: "Eşit Ağırlık" },
  { id: "SÖZ", label: "Sözel" },
  { id: "DİL", label: "Dil" },
];

const normalize = (value: unknown) =>
  String(value || "").trim().toLocaleUpperCase("tr-TR");

const definedGroups = (classroom: Classroom | undefined) => {
  if (!classroom) return [];
  const raw = [
    ...(Array.isArray(classroom.groups) ? classroom.groups : []),
    classroom.group1Name,
    classroom.group2Name,
  ].map(normalize).filter(Boolean);
  return [...new Set(raw)].filter((value) => FIELD_GROUPS.some((group) => group.id === value));
};

export default function CourseSeatingPlanPanel({
  classrooms,
  setClassrooms,
  editingClassId,
  seatingPlanClassName,
}: CourseSeatingPlanPanelProps) {
  const sorted = useMemo(() => [...classrooms].sort(compareClassrooms), [classrooms]);
  const [selectedId, setSelectedId] = useState(() =>
    String(editingClassId || sorted.find((classroom) => classroom.name === seatingPlanClassName)?.id || sorted[0]?.id || ""),
  );
  const selectedClass = classrooms.find((classroom) => String(classroom.id) === selectedId);
  const [draftGroups, setDraftGroups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!selectedId || !classrooms.some((classroom) => String(classroom.id) === selectedId)) {
      setSelectedId(String(editingClassId || sorted[0]?.id || ""));
    }
  }, [classrooms, editingClassId, selectedId, sorted]);

  useEffect(() => {
    setDraftGroups(definedGroups(selectedClass));
    setNotice("");
  }, [selectedId, selectedClass?.groups?.join("|"), selectedClass?.group1Name, selectedClass?.group2Name]);

  const savedGroups = definedGroups(selectedClass);
  const changed = [...draftGroups].sort().join("|") !== [...savedGroups].sort().join("|");

  const toggleGroup = (id: string) => {
    setDraftGroups((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
    );
    setNotice("");
  };

  const saveGroups = async () => {
    if (!selectedClass || saving || !changed) return;
    const removed = savedGroups.filter((group) => !draftGroups.includes(group));
    const linkedAssignments = (selectedClass.assignedCourses || []).filter((course: any) => {
      const courseGroups = String(course.groupName || "")
        .split(",").map(normalize).filter(Boolean);
      const explicitTargets = Array.isArray(course.targetGroups)
        ? course.targetGroups.map(normalize) : [];
      return removed.some((group) => courseGroups.includes(group) || explicitTargets.includes(group));
    });
    const linkedStudents = selectedClass.groupStudentIds &&
      !Array.isArray(selectedClass.groupStudentIds) &&
      removed.some((group) =>
        Object.entries(selectedClass.groupStudentIds as Record<string, string[]>).some(([name, ids]) =>
          normalize(name) === group && Array.isArray(ids) && ids.length > 0));
    if (linkedAssignments.length || linkedStudents) {
      setNotice("Kaldırmak istediğiniz alanlara bağlı ders veya öğrenci bulunuyor. Önce bu atamaları düzenleyin; kayıtlar otomatik silinmedi.");
      return;
    }

    setSaving(true);
    setNotice("");
    try {
      // Yalnızca sınıfın alan tanımları güncellenir; ders, öğretmen ve öğrenciler korunur.
      const updated: Classroom = {
        ...selectedClass,
        groups: [...draftGroups],
        group1Name: draftGroups[0] || undefined,
        group2Name: draftGroups[1] || undefined,
      };
      await classroomService.save(updated);
      setClassrooms((previous) => previous.map((classroom) =>
        String(classroom.id) === String(updated.id) ? updated : classroom,
      ));
      setNotice(`${updated.name} sınıfının alanları kaydedildi. Ders atama ekranında bu alanlar kullanılacak.`);
    } catch (error: any) {
      setNotice(`Alanlar kaydedilemedi: ${error?.message || "Bilinmeyen hata"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[580px] w-full space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Layers3 className="h-6 w-6 text-indigo-600" />
            Sınıfların Alanlarını Tanımla
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Bir sınıfın SAY, EA, SÖZ veya DİL gruplarını seçin. Ders ve öğretmen atamaları bu ekranda değiştirilmez.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="area-class-picker" className="block text-sm font-black text-slate-700">Sınıf Seçiniz</label>
          <select id="area-class-picker" value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="h-12 w-full rounded-xl border border-indigo-200 bg-white px-3 text-base font-black text-indigo-900">
            {sorted.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
            ))}
          </select>
          <div className="rounded-xl bg-white p-3 text-xs font-semibold text-slate-600">
            <UsersRound className="mb-2 h-5 w-5 text-indigo-500" />
            {selectedClass?.name || "Sınıf seçilmedi"} — {savedGroups.length
              ? `Mevcut alanlar: ${savedGroups.join(" + ")}`
              : "Alan ayrımı yok (GENEL)"}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <h3 className="text-base font-black text-slate-900">Bu sınıf hangi alanlardan oluşuyor?</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {FIELD_GROUPS.map((group) => {
              const active = draftGroups.includes(group.id);
              return (
                <button key={group.id} type="button" aria-pressed={active} disabled={!selectedClass || saving}
                  onClick={() => toggleGroup(group.id)}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 px-3 py-3 font-black transition ${active
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"}`}>
                  <span className="flex items-center gap-1 text-base">{active && <Check className="h-4 w-4" />}{group.id}</span>
                  <span className="text-[11px] font-semibold opacity-80">{group.label}</span>
                </button>
              );
            })}
          </div>
          <div className="rounded-xl border border-indigo-100 bg-white p-3 text-sm font-semibold text-slate-700">
            {draftGroups.length === 0
              ? "GENEL — sınıfta alan ayrımı yok. Dersler tüm sınıfa atanır."
              : `${selectedClass?.name || "Sınıf"}: ${draftGroups.join(" + ")}`}
          </div>
          <p className="text-xs font-semibold leading-relaxed text-slate-500">
            Ders Öğretmen Ata ekranında bu sınıfa ders eklerken ORTAK veya burada seçilmiş alanlar görünecek.
            ORTAK seçimi tüm öğrencileri kapsar; alan seçimi yalnız ilgili gruba ders atar.
          </p>
          <div className="flex justify-end">
            <button type="button" disabled={!selectedClass || !changed || saving}
              onClick={() => void saveGroups()}
              className="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
              <Save className="h-4 w-4" /> {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
          {notice && <p role="status" className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">{notice}</p>}
        </div>
      </div>
    </div>
  );
}
