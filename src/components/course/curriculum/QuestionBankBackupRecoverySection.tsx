import React from "react";
import { ArchiveRestore, Download } from "lucide-react";

type Props = {
  bankBackupLoading: boolean;
  bankRestoreLoading: boolean;
  bankRestoreInputRef: React.RefObject<HTMLInputElement | null>;
  bankRestoreResult: any;
  createQuestionBankBackup: () => void | Promise<void>;
  restoreQuestionBankFromFile: (file: File | null) => void | Promise<void>;
};

export default function QuestionBankBackupRecoverySection({
  bankBackupLoading,
  bankRestoreLoading,
  bankRestoreInputRef,
  bankRestoreResult,
  createQuestionBankBackup,
  restoreQuestionBankFromFile,
}: Props) {
  return (
<>
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">Yedekleme ve Geri Yükleme</div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-500">
                      Soru görselleri, SQLite metadata, kullanım geçmişi, işlem kayıtları ve sınav şablonları birlikte korunur.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={bankBackupLoading}
                      onClick={() => void createQuestionBankBackup()}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-[10px] font-black text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                      <Download className={`h-4 w-4 ${bankBackupLoading ? "animate-pulse" : ""}`} />
                      {bankBackupLoading ? "Yedek hazırlanıyor…" : "Yedeği İndir"}
                    </button>

                    <button
                      type="button"
                      disabled={bankRestoreLoading}
                      onClick={() => bankRestoreInputRef.current?.click()}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-[10px] font-black text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                    >
                      <ArchiveRestore className={`h-4 w-4 ${bankRestoreLoading ? "animate-spin" : ""}`} />
                      {bankRestoreLoading ? "Geri yükleniyor…" : "Yedekten Geri Yükle"}
                    </button>
                    <input
                      ref={bankRestoreInputRef}
                      type="file"
                      accept=".gz,.enqbackup.gz,application/gzip,application/x-gzip"
                      className="hidden"
                      onChange={(event) =>
                        void restoreQuestionBankFromFile(event.target.files?.[0] || null)
                      }
                    />
                  </div>
                </div>

                {bankRestoreResult && (
                  <div
                    className={`mt-3 rounded-xl border p-3 ${
                      bankRestoreResult.success
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-rose-200 bg-rose-50"
                    }`}
                  >
                    {bankRestoreResult.success ? (
                      <>
                        <div className="text-[11px] font-black text-emerald-900">
                          Yedek güvenli birleştirme ile geri yüklendi.
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-lg bg-white/70 p-2 text-[9px] font-bold text-slate-600">
                            Yeni soru: <span className="font-black text-slate-900">{bankRestoreResult.questionsAdded || 0}</span>
                          </div>
                          <div className="rounded-lg bg-white/70 p-2 text-[9px] font-bold text-slate-600">
                            Eşleşen soru: <span className="font-black text-slate-900">{bankRestoreResult.questionsMatched || 0}</span>
                          </div>
                          <div className="rounded-lg bg-white/70 p-2 text-[9px] font-bold text-slate-600">
                            Yeni dosya: <span className="font-black text-slate-900">{bankRestoreResult.filesAdded || 0}</span>
                          </div>
                          <div className="rounded-lg bg-white/70 p-2 text-[9px] font-bold text-slate-600">
                            Kod çakışması: <span className="font-black text-slate-900">{bankRestoreResult.codeConflicts?.length || 0}</span>
                          </div>
                        </div>
                        {(bankRestoreResult.warnings?.length || 0) > 0 && (
                          <div className="mt-2 text-[9px] font-semibold text-amber-700">
                            {bankRestoreResult.warnings.length} uyarı oluştu. Bütünlük kontrolü sonucunu inceleyin.
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-[10px] font-black text-rose-800">
                        {bankRestoreResult.error || "Yedek geri yüklenemedi."}
                      </div>
                    )}
                  </div>
                )}
              </div>
</>
  );
}