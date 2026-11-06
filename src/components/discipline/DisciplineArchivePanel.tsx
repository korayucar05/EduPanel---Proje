import React from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import type { BehaviorRecord } from "../behavior/behaviorTypes";

type StudentSummary = { name: string; classroom: string; number: string };

interface DisciplineArchivePanelProps {
  archiveRecords: BehaviorRecord[];
  archiveUniqueStudentCount: number;
  archiveSanctionStats: Array<[string, number]>;
  getRecordStudents: (record: BehaviorRecord) => StudentSummary[];
  onRestore: (record: BehaviorRecord) => void | Promise<void>;
  onDelete: (recordId: string) => void | Promise<void>;
}

export function DisciplineArchivePanel({
  archiveRecords, archiveUniqueStudentCount, archiveSanctionStats,
  getRecordStudents, onRestore, onDelete,
}: DisciplineArchivePanelProps) {
  return (
    <div className="p-6 h-full flex flex-col animate-fadeIn">
      {archiveRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-slate-400 font-medium h-full flex-1 min-h-[300px]">
          <p>Henüz arşive gönderilmiş bir kayıt bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard label="Toplam öğrenci kaydı" value={archiveRecords.length} />
            <StatCard label="Farklı öğrenci" value={archiveUniqueStudentCount} />
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ceza dağılımı</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {archiveSanctionStats.map(([sanction, count]) => (
                  <span key={sanction} className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">{sanction}: {count}</span>
                ))}
              </div>
            </div>
          </div>
          {archiveRecords.map((record) => (
            <div key={record.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100/50 transition-colors gap-4">
              <div className="flex items-start gap-4 w-full md:w-auto">
                <div className="w-12 h-12 bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 shadow-inner mt-1">{record.studentName.charAt(0)}</div>
                <div className="flex-1">
                  <div className="flex flex-col gap-1.5">
                    {getRecordStudents(record).map((std, idx) => (
                      <h4 key={idx} className="font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                        <span>{std.name}</span><span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{std.classroom} - {std.number}</span>
                      </h4>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium mt-1.5 text-slate-500">
                    <span className="px-2 py-0.5 rounded-md border text-slate-600 bg-slate-100 border-slate-200/50 font-semibold">Arşivlenmiş Kayıt</span>
                    <span className="text-slate-300">•</span><span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/30 font-medium">Davranış: {record.behaviorName}</span>
                    <span className="text-slate-300">•</span><span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/30 font-medium">Ceza: {record.sanctionType || "Belirtilmedi"}</span>
                    <span className="text-slate-300">•</span><span>Tarih: {new Date(record.date).toLocaleDateString("tr-TR")}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 self-end md:self-center ml-auto">
                <button onClick={() => onRestore(record)} className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer h-[40px]" title="Arşivden Çıkar ve Uyarı Bildirimi Alanına Geri Yükle"><CheckCircle2 className="w-4 h-4" /><span>Geri Yükle</span></button>
                <button onClick={() => onDelete(record.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 hover:border-rose-100 h-[40px] w-[40px] flex items-center justify-center shrink-0 cursor-pointer" title="Arşivden Tamamen Sil"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-slate-800">{value}</div></div>;
}
