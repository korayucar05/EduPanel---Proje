import React, { useMemo, useState } from "react";
import { Camera, Check, Edit2, Save, Trash2 } from "lucide-react";
import { Teacher } from "../types";
import { teacherService } from "../modules/teacher";
import { sqliteStorage } from "../core/state/SyncStateStore";

export const AVAILABLE_BRANCHES = [
  "Almanca",
  "Beden Eğitimi",
  "Bilgisayar ve Yazılım",
  "Biyoloji",
  "Coğrafya",
  "Din Kültürü ve Ahlak Bilgisi",
  "Felsefe",
  "Fizik",
  "İngilizce",
  "Kimya",
  "Matematik",
  "Müzik",
  "Rehberlik",
  "Resim",
  "Sanat Eğitimi",
  "Tarih",
  "Türk Dili ve Edebiyatı",
];

interface TeacherModuleProps {
  teachers: Teacher[];
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
}

type Draft = {
  name: string;
  branch: string;
  phone: string;
  adminRole: string;
  avatar: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  branch: "Öğretmen",
  phone: "",
  adminRole: "Yok",
  avatar: "",
};

export default function TeacherModule({
  teachers,
  setTeachers,
}: TeacherModuleProps) {
  const [customBranches, setCustomBranches] = useState<string[]>(() => {
    try {
      const saved = sqliteStorage.getItem("custom_teacher_branches_v1");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const availableBranches = useMemo(
    () =>
      [...new Set([...AVAILABLE_BRANCHES, ...customBranches])].sort((a, b) =>
        a.localeCompare(b, "tr"),
      ),
    [customBranches],
  );

  React.useEffect(() => {
    const handleBranchesChanged = (event: Event) => {
      const branches = (event as CustomEvent<string[]>).detail;
      setCustomBranches(Array.isArray(branches) ? branches : []);
    };
    window.addEventListener("rota-custom-branches-changed", handleBranchesChanged);
    return () =>
      window.removeEventListener("rota-custom-branches-changed", handleBranchesChanged);
  }, []);

  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const sortedTeachers = useMemo(
    () =>
      [...teachers].sort((a, b) =>
        a.name.localeCompare(b.name, "tr", { sensitivity: "base" }),
      ),
    [teachers],
  );

  const beginEdit = (teacher: Teacher) => {
    setEditingTeacherId(teacher.id);
    setDraft({
      name: teacher.name || "",
      branch: teacher.branch || "Öğretmen",
      phone: teacher.phone || "",
      adminRole: teacher.adminRole || "Yok",
      avatar: teacher.avatar || "",
    });
    setError("");
  };

  const cancelEdit = () => {
    setEditingTeacherId(null);
    setDraft(EMPTY_DRAFT);
    setError("");
  };

  const saveNewTeacher = async () => {
    if (!newDraft.name.trim()) {
      setError("Öğretmen adı soyadı zorunludur.");
      return;
    }

    setSaving(true);
    try {
      const saved = await teacherService.createTeacher({
        name: newDraft.name.trim(),
        branch: newDraft.branch || "Öğretmen",
        phone: newDraft.phone.trim(),
        email: "",
        weeklyHours: 20,
        assignedClassrooms: [],
        status: "Aktif",
        adminRole: newDraft.adminRole || "Yok",
        commissions: [],
        avatar: newDraft.avatar || "",
      });

      setTeachers((prev) =>
        [...prev, saved].sort((a, b) =>
          a.name.localeCompare(b.name, "tr", { sensitivity: "base" }),
        ),
      );
      setNewDraft(EMPTY_DRAFT);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Öğretmen kaydı yapılamadı.");
    } finally {
      setSaving(false);
    }
  };

  const saveTeacherEdit = async (teacher: Teacher) => {
    if (!draft.name.trim()) {
      setError("Öğretmen adı soyadı zorunludur.");
      return;
    }

    setSaving(true);
    try {
      const saved = await teacherService.updateTeacher(teacher.id, {
        ...teacher,
        name: draft.name.trim(),
        branch: draft.branch || "Öğretmen",
        phone: draft.phone.trim(),
        adminRole: draft.adminRole || "Yok",
        avatar: draft.avatar || "",
        // E-posta ve haftalık ders yükü arayüzden kaldırıldı.
        // Mevcut değerleri veri kaybı olmaması için saklanır.
        email: teacher.email || "",
        weeklyHours: teacher.weeklyHours || 20,
      });

      setTeachers((prev) =>
        prev
          .map((item) => (item.id === teacher.id ? saved : item))
          .sort((a, b) =>
            a.name.localeCompare(b.name, "tr", { sensitivity: "base" }),
          ),
      );
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Öğretmen güncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  const removeTeacher = async () => {
    if (!deleteTargetId) return;
    setSaving(true);
    try {
      await teacherService.removeTeacher(deleteTargetId);
      setTeachers((prev) => prev.filter((teacher) => teacher.id !== deleteTargetId));
      if (editingTeacherId === deleteTargetId) cancelEdit();
      setDeleteTargetId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Öğretmen silinemedi.");
    } finally {
      setSaving(false);
    }
  };

  const loadTeacherPhoto = (file: File, target: "new" | "edit") => {
    if (!file.type.startsWith("image/")) { setError("Lütfen JPG, PNG veya WEBP fotoğraf seçiniz."); return; }
    if (file.size > 4 * 1024 * 1024) { setError("Öğretmen fotoğrafı en fazla 4 MB olabilir."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const avatar = String(reader.result || "");
      target === "new" ? setNewDraft((p) => ({ ...p, avatar })) : setDraft((p) => ({ ...p, avatar }));
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <div id="teachers-tab" className="mx-auto max-w-7xl p-4 lg:p-5">
      {error && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full table-fixed border-collapse">
          <thead className="bg-slate-50">
            <tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-500">
              <th className="w-[37%] border-b border-slate-200 px-3 py-2">Öğretmen</th>
              <th className="w-[18%] border-b border-slate-200 px-3 py-2">Telefon</th>
              <th className="w-[20%] border-b border-slate-200 px-3 py-2">İdari Görev</th>
              <th className="w-[25%] border-b border-slate-200 px-3 py-2 text-center">İşlemler</th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-2 border-violet-500 bg-yellow-300">
              <td className="px-3 py-2">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-11 w-11 overflow-hidden rounded-full bg-white ring-1 ring-emerald-200">
                    {newDraft.avatar ? <img src={newDraft.avatar} alt="" className="h-full w-full object-cover" /> : <Camera className="m-2.5 h-6 w-6 text-emerald-500" />}
                  </div>
                  <label className="cursor-pointer rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-[9px] font-black text-emerald-700">
                    FOTOĞRAF SEÇ
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f=e.target.files?.[0]; if(f) loadTeacherPhoto(f,"new"); e.currentTarget.value=""; }} />
                  </label>
                </div>
                <div className="grid grid-cols-[1.25fr_0.75fr] gap-2">
                  <input
                    value={newDraft.name}
                    onChange={(e) =>
                      setNewDraft((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="Yeni öğretmen adı soyadı"
                  />
                  <select
                    value={newDraft.branch}
                    onChange={(e) =>
                      setNewDraft((prev) => ({ ...prev, branch: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="Öğretmen">Branş seçiniz</option>
                    {availableBranches.map((branch) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
              </td>

              <td className="px-3 py-2">
                <input
                  value={newDraft.phone}
                  onChange={(e) =>
                    setNewDraft((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Telefon"
                />
              </td>

              <td className="px-3 py-2">
                <select
                  value={newDraft.adminRole}
                  onChange={(e) =>
                    setNewDraft((prev) => ({ ...prev, adminRole: e.target.value }))
                  }
                  className={inputClass}
                >
                  <option value="Yok">İdari Görevi Yok</option>
                  <option value="Okul Müdürü">Okul Müdürü</option>
                  <option value="Müdür Yardımcısı">Müdür Yardımcısı</option>
                </select>
              </td>

              <td className="px-2 py-2">
                <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveNewTeacher()}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[9px] font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Kaydet
                  </button>
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[9px] font-black text-slate-300"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[9px] font-black text-slate-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Sil
                  </button>
                </div>
              </td>
            </tr>

            {sortedTeachers.map((teacher) => {
              const editing = editingTeacherId === teacher.id;

              return (
                <tr key={teacher.id} className="border-b border-slate-100 bg-white hover:bg-slate-50/70">
                  <td className="px-3 py-2">
                    {editing ? (
                      <>
                      <div className="grid grid-cols-[1.25fr_0.75fr] gap-2">
                        <input
                          value={draft.name}
                          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                          className={inputClass}
                          placeholder="Ad Soyad"
                        />
                        <select
                          value={draft.branch}
                          onChange={(e) => setDraft((prev) => ({ ...prev, branch: e.target.value }))}
                          className={inputClass}
                        >
                          <option value="Öğretmen">Branş seçiniz</option>
                          {availableBranches.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                          {draft.avatar ? <img src={draft.avatar} alt="" className="h-full w-full object-cover" /> : <Camera className="m-3 h-6 w-6 text-slate-400" />}
                        </div>
                        <label className="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-[9px] font-black text-indigo-700">
                          FOTOĞRAF YÜKLE
                          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f=e.target.files?.[0]; if(f) loadTeacherPhoto(f,"edit"); e.currentTarget.value=""; }} />
                        </label>
                        {draft.avatar ? <button type="button" onClick={() => setDraft((p)=>({...p,avatar:""}))} className="text-[9px] font-black text-rose-600">Kaldır</button> : null}
                      </div>
                      </>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-indigo-100 ring-1 ring-indigo-200">
                          {teacher.avatar ? <img src={teacher.avatar} alt={teacher.name} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-indigo-700">{teacher.name.split(/\s+/).slice(0,2).map((p)=>p[0]).join("").toUpperCase()}</span>}
                        </div>
                        <div className="min-w-0">
                        <div className="truncate text-[13px] font-black text-slate-900">
                          {teacher.name}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] font-bold text-indigo-600">
                          {teacher.branch && teacher.branch !== "Öğretmen"
                            ? teacher.branch
                            : "Branş belirtilmemiş"}
                        </div>
                      </div>
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {editing ? (
                      <input
                        value={draft.phone}
                        onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                        className={inputClass}
                        placeholder="Telefon"
                      />
                    ) : (
                      <span className="text-[11px] font-bold text-slate-600">
                        {teacher.phone || "—"}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {editing ? (
                      <select
                        value={draft.adminRole}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, adminRole: e.target.value }))
                        }
                        className={inputClass}
                      >
                        <option value="Yok">İdari Görevi Yok</option>
                        <option value="Okul Müdürü">Okul Müdürü</option>
                        <option value="Müdür Yardımcısı">Müdür Yardımcısı</option>
                      </select>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-600">
                        {teacher.adminRole && teacher.adminRole !== "Yok"
                          ? teacher.adminRole
                          : "—"}
                      </span>
                    )}
                  </td>

                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!editing || saving}
                        onClick={() => void saveTeacherEdit(teacher)}
                        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[9px] font-black ${
                          editing
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-slate-100 text-slate-300"
                        }`}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Kaydet
                      </button>

                      <button
                        type="button"
                        onClick={() => (editing ? cancelEdit() : beginEdit(teacher))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-[9px] font-black text-indigo-700 hover:bg-indigo-100"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        {editing ? "Vazgeç" : "Düzenle"}
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setDeleteTargetId(teacher.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[9px] font-black text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}


          </tbody>
        </table>
      </div>

      {sortedTeachers.length === 0 && (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">
          Henüz öğretmen kaydı yok. Alttaki boş satırdan ilk öğretmeni kaydedebilirsiniz.
        </div>
      )}

      {deleteTargetId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-black text-slate-900">Öğretmeni Sil</div>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              Bu öğretmen kaydı sistemden silinecek. Devam etmek istiyor musunuz?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void removeTeacher()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
