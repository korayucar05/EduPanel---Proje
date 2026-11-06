import React from "react";
import { Plus, BookOpen, Trash2, X, CalendarDays, Upload, Search, Check, Lock, Unlock, School, Users, Clock, MapPin, Sparkles } from "lucide-react";

export default function DeleteCourseConfirmationModal(props: any) {
  const { confirmDelete, deleteConfirm, setDeleteConfirm } = props;
  return (<>
      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteConfirm?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-center text-slate-800 text-lg">
              Silmek istediğinizden emin misiniz?
            </h3>
            <p className="text-center text-sm text-slate-500">
              <span className="font-bold text-slate-700">
                '{deleteConfirm.name}'
              </span>{" "}
              {deleteConfirm.type === "class"
                ? "sınıfını sistemden tamamen kaldırmak istediğinizden emin misiniz? Sınıfa kayıtlı öğrencilerin sınıf haneleri korunur ancak sınıf listesinden çıkarılacaktır."
                : deleteConfirm.type === "elective-pool"
                ? `seçmeli dersini ${deleteConfirm.grade?.replace(". Sınıf", ". Sınıf Seviyesi")} havuzundan tamamen kaldırmak istediğinize emin misiniz? Atandığı tüm şubelerden de temizlenecektir.`
                : deleteConfirm.type === "custom-course"
                ? "dersini silmek istediğinize emin misiniz? Bu işlem atandığı tüm şubelerden ve zaman planlamasından bu dersi tamamen kaldıracaktır."
                : deleteConfirm.type === "custom-course-bulk"
                ? "silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve atandıkları tüm şubelerden bu dersler temizlenecektir."
                : deleteConfirm.type === "custom-course-class"
                ? "şubesinden atamasını kaldırmak istediğinize emin misiniz?"
                : deleteConfirm.type === "custom-course-clear"
                ? "dersini tanımlandığı tüm şubelerden/sınıflardan kaldırmak istediğinize emin misiniz? (Ders havuzunda kalmaya devam edecektir)"
                : "müfredat kaydını sistemden tamamen silmek istediğinizden emin misiniz?"}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
  </>);
}
