import React from "react";
import { AlertCircle, Check, UserPlus, X } from "lucide-react";
import { Classroom, Student } from "../../types";

type StudentFormData = {
  id: string; name: string; classroom: string; group: string; gpa: string; absences: string;
  email: string; phone: string; parentName: string; parentPhone: string; status: "Aktif" | "Pasif";
  dob: string; pob: string; address: string; oob: string; avatar: string;
};

interface StudentFormModalProps {
  isModalOpen: boolean;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: "lists" | "new" | "excel";
  editingStudent: Student | null;
  formError: string;
  formData: StudentFormData;
  setFormData: React.Dispatch<React.SetStateAction<StudentFormData>>;
  systemClassrooms: Classroom[];
  handleFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}

export default function StudentFormModal(props: StudentFormModalProps) {
  const { isModalOpen, setIsModalOpen, viewMode, editingStudent, formError, formData, setFormData, systemClassrooms, handleFormSubmit } = props;
  if (!(isModalOpen || viewMode === "new")) return null;
  return (
<div
  onClick={(e) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  }}
  id="student-modal-overlay"
  className={viewMode === "new" ? "w-full" : "fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"}
>
  <div
    id="student-modal-container"
    className={viewMode === "new" ? "student-embedded-card flex w-full flex-col rounded-3xl border border-purple-200 bg-white p-4 shadow-sm" : "bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col p-6 animate-fadeIn"}
  >
    {/* Modal Heading */}
    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
      <div className="flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-slate-800 text-lg">
          {viewMode === "new"
            ? "Yeni Öğrenci Kaydı"
            : editingStudent
            ? `${editingStudent.name} Kaydını Düzenle`
            : "Yeni Öğrenci Başvurusu / Kayıt"}
        </h3>
      </div>
      {viewMode !== "new" && <button
        onClick={() => setIsModalOpen(false)}
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>}
    </div>

    {/* Error notifications block inside modal */}
    {formError && (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 text-xs mb-4">
        <AlertCircle className="w-4.5 h-4.5 shrink-0" />
        <span className="font-semibold">{formError}</span>
      </div>
    )}

    {/* Modal entry form */}
    <form
      onSubmit={handleFormSubmit}
      className="space-y-4 text-xs font-medium text-slate-600 flex-1"
    >
      <section className="student-form-section space-y-4 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
        <div className="student-form-section-title text-cyan-900">
          <span className="student-form-section-number bg-cyan-500">1</span>
          <div><strong>Kimlik Bilgileri</strong><small>Öğrencinin temel kayıt bilgileri</small></div>
        </div>
      {/* Profile Image Personal Single Upload */}
      <div>
        <label className="block text-slate-700 font-bold mb-1.5">
          Öğrenci Fotoğrafı
        </label>
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-150">
          <img
            src={
              formData.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || "Öğrenci")}&background=4f46e5&color=fff`
            }
            alt="Öğrenci Fotoğrafı"
            className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || "Öğrenci")}&background=4f46e5&color=fff`;
            }}
          />
          <div className="space-y-1">
            <input
              type="file"
              accept="image/*"
              id="student-avatar-upload-file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    if (event.target?.result) {
                      setFormData((prev) => ({
                        ...prev,
                        avatar: event.target!.result as string,
                      }));
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <label
              htmlFor="student-avatar-upload-file"
              className="bg-white border border-slate-200 text-slate-700 font-bold text-[11px] px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors inline-block"
            >
              Profil Fotoğrafı Seç...
            </label>
            <p className="text-[10px] text-slate-400">
              Dosya seçerek öğrencinin profil fotoğrafını tek tek
              yükleyebilirsiniz.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-slate-700 font-bold mb-1.5">
          Öğrenci Adı Soyadı *
        </label>
        <input
          type="text"
          required
          placeholder="Örn: Ahmet Yılmaz"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-semibold text-slate-800"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-slate-700 font-bold mb-1.5">
            Sınıf Şubesi *
          </label>
          {systemClassrooms.length > 0 ? (
            <select
              value={formData.classroom}
              onChange={(e) =>
                setFormData({ ...formData, classroom: e.target.value })
              }
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
            >
              {formData.classroom &&
                !systemClassrooms.some(
                  (classroom) => classroom.name === formData.classroom,
                ) && (
                  <option value={formData.classroom}>
                    {formData.classroom}
                  </option>
                )}
              {[...systemClassrooms]
                .sort((a, b) =>
                  a.name.localeCompare(b.name, "tr", {
                    numeric: true,
                    sensitivity: "base",
                  }),
                )
                .map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          ) : (
            <input
              type="text"
              required
              placeholder="Örn: 12-A"
              value={formData.classroom}
              onChange={(e) =>
                setFormData({ ...formData, classroom: e.target.value })
              }
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-slate-800 font-semibold"
            />
          )}
        </div>
        <div>
          <label className="block text-slate-700 font-bold mb-1.5">
            Öğrenci Grubu
          </label>
          <select
            value={formData.group}
            onChange={(e) =>
              setFormData({ ...formData, group: e.target.value })
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none bg-white font-medium text-slate-800"
          >
            <option value="">Grup Yok</option>
            <option value="SAY">SAY</option>
            <option value="EA">EA</option>
            <option value="DİL">DİL</option>
            <option value="SÖZ">SÖZ</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-700 font-bold mb-1.5">
            Öğrenci No *
          </label>
          <input
            type="text"
            required
            disabled={!!editingStudent}
            placeholder="Örn: ÖGR-208"
            value={formData.id}
            onChange={(e) =>
              setFormData({ ...formData, id: e.target.value })
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-semibold"
          />
        </div>
      </div>

      </section>
      <section className="student-form-section space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
        <div className="student-form-section-title text-indigo-900">
          <span className="student-form-section-number bg-indigo-600">2</span>
          <div><strong>Okul ve İletişim</strong><small>Sınıf, başarı ve kişisel bilgiler</small></div>
        </div>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-slate-700 font-bold mb-1.5">
            Öğrenci Cep Tel
          </label>
          <input
            type="text"
            placeholder="05XX XXX XX XX"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-slate-700 font-bold mb-1.5">
            Doğum Tarihi
          </label>
          <input
            type="date"
            value={formData.dob}
            onChange={(e) =>
              setFormData({ ...formData, dob: e.target.value })
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none bg-white text-slate-800 font-medium"
          />
        </div>
        <div>
          <label className="block text-slate-700 font-bold mb-1.5">
            Doğum Yeri
          </label>
          <input
            type="text"
            placeholder="Örn: Üsküdar, İstanbul"
            value={formData.pob}
            onChange={(e) =>
              setFormData({ ...formData, pob: e.target.value })
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-medium text-slate-800"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-700 font-bold mb-1.5">
            OÖB (Ortaöğretim Başarı Puanı)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Örn: 92.45"
            value={formData.oob}
            onChange={(e) =>
              setFormData({ ...formData, oob: e.target.value })
            }
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-semibold text-slate-800"
          />
        </div>
        <div>
          <label className="block text-slate-700 font-bold mb-1.5">
            Kayıt Durumu
          </label>
          <div className="flex gap-4 pt-2.5">
            <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="Aktif"
                checked={formData.status === "Aktif"}
                onChange={() =>
                  setFormData({ ...formData, status: "Aktif" })
                }
                className="text-indigo-600 focus:ring-indigo-500 text-sm"
              />
              <span className="text-sm">Aktif</span>
            </label>
            <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="Pasif"
                checked={formData.status === "Pasif"}
                onChange={() =>
                  setFormData({ ...formData, status: "Pasif" })
                }
                className="text-indigo-600 focus:ring-indigo-500 text-sm"
              />
              <span className="text-sm">Pasif</span>
            </label>
          </div>
        </div>
      </div>

      </section>
      <section className="student-form-section space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="student-form-section-title text-amber-900">
          <span className="student-form-section-number bg-amber-500">3</span>
          <div><strong>Veli ve Adres</strong><small>İletişim ve ikamet bilgileri</small></div>
        </div>
      <div className="space-y-1.5">
        <label className="block text-slate-700 font-bold mb-1">
          Öğrenci Açık Adresi
        </label>
        <textarea
          rows={2}
          placeholder="Seçili öğrencinin açık ikametgah adresi..."
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-medium text-slate-800"
        />
      </div>

      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
        <p className="font-extrabold text-slate-800 text-xs tracking-tight border-b border-slate-200 pb-1.5">
          Veli İrtibat Bilgileri
        </p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-slate-600 font-bold mb-1">
              Veli Ad Soyad *
            </label>
            <input
              type="text"
              required
              placeholder="Örn: Ramazan Yılmaz"
              value={formData.parentName}
              onChange={(e) =>
                setFormData({ ...formData, parentName: e.target.value })
              }
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-bold mb-1">
              Veli Cep Telefonu
            </label>
            <input
              type="text"
              placeholder="Örn: 0532..."
              value={formData.parentPhone}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  parentPhone: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
      </section>

      {/* Action buttons */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
        {viewMode !== "new" && <button
          type="button"
          onClick={() => setIsModalOpen(false)}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer transition-colors"
        >
          Vazgeç
        </button>}
        <button
          type="submit"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer flex items-center gap-1.5 font-bold shadow-md shadow-indigo-600/10 transition-colors"
        >
          <Check className="w-4 h-4" />
          <span>
            {editingStudent
              ? "Değişiklikleri Kaydet"
              : "Öğrenciyi Kaydet"}
          </span>
        </button>
      </div>
    </form>
  </div>
</div>
  );
}
