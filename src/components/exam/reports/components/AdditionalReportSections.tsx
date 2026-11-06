import React from "react";
import { ChevronDown, FileText, TrendingUp } from "lucide-react";

type Props={
  showAllCategories:boolean;
  activeReportView:string;
  openReportSections:Record<string,boolean>;
  toggleReportSection:(key:string)=>void;
  setShowDevelopmentText:(value:boolean)=>void;
  developmentCards:any[];
  developmentExamCount:number;
  developmentReliability:any;
  exam:any;
  results:any[];
  selectedStudent:any;
};

export default function AdditionalReportSections({
  showAllCategories,activeReportView,openReportSections,toggleReportSection,setShowDevelopmentText,
  developmentCards,developmentExamCount,developmentReliability,exam,results,selectedStudent,
}:Props){
  return <>
      {showAllCategories && activeReportView==="mentor" && (
        <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={()=>toggleReportSection("Mentörler İçin Öğrenci Gelişim Raporları")}
            className="flex w-full items-center justify-between gap-4 bg-indigo-700 p-5 text-left text-white transition hover:bg-indigo-800"
            aria-expanded={Boolean(openReportSections["Mentörler İçin Öğrenci Gelişim Raporları"])}
          >
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-white/15 p-3">
                <TrendingUp className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-black">Mentörler İçin Öğrenci Gelişim Raporları</h2>
                <p className="mt-1 text-[11px] text-white/75">
                  Öğrencinin birden fazla sınavdaki akademik gelişimini izlemeye yönelik raporlar
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 shrink-0 transition-transform ${
                openReportSections["Mentörler İçin Öğrenci Gelişim Raporları"] ? "rotate-180" : ""
              }`}
            />
          </button>

          {openReportSections["Mentörler İçin Öğrenci Gelişim Raporları"] && (
            <div className="space-y-4 p-4">
              <div className={`rounded-2xl border p-4 ${developmentReliability.tone}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-black">
                      Veri Güvenilirliği: {developmentReliability.label}
                    </div>
                    <p className="mt-1 text-xs font-semibold opacity-80">
                      {developmentReliability.detail}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-xs font-black">
                    Toplam {developmentExamCount} deneme
                  </div>
                </div>
              </div>

              {!selectedStudent && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">
                  Gelişim raporlarını hesaplamak için önce bir öğrenci seçiniz.
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <article className="flex min-h-44 flex-col rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
                  <h3 className="text-xs font-black text-slate-800">Gelişim Analizi</h3>
                  <p className="mt-1 min-h-8 flex-1 text-[10px] leading-relaxed text-slate-500">
                    e-Nstitü için önerilen gelişim kriterleri ve değerlendirme yaklaşımı.
                  </p>
                  <div className="mt-3 rounded-2xl bg-white/70 p-2">
                    <button
                      type="button"
                      onClick={() => setShowDevelopmentText(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-700 bg-indigo-700 px-3 py-2.5 text-[10px] font-black text-white shadow-sm transition hover:bg-indigo-800"
                    >
                      <FileText className="h-4 w-4" />
                      Metin
                    </button>
                  </div>
                </article>

                {developmentCards.map((card,index)=>{
                  const active=Boolean(selectedStudent)&&developmentExamCount>=card.minimum;
                  const progress=Math.min(
                    100,
                    Math.round((Math.min(developmentExamCount,card.minimum)/card.minimum)*100)
                  );

                  return (
                    <article
                      key={`${card.title}-${index}`}
                      className={`flex min-h-44 flex-col rounded-2xl border p-4 ${
                        active
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-xs font-black text-slate-800">
                          {card.title}
                        </h3>
                        <span className={`rounded-lg px-2 py-1 text-[9px] font-black ${
                          active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}>
                          {active ? "Aktif" : `${card.minimum} deneme`}
                        </span>
                      </div>

                      <p className="mt-2 flex-1 text-[10px] leading-relaxed text-slate-600">
                        {card.description}
                      </p>

                      {active ? (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black text-emerald-800">
                          {card.result}
                        </div>
                      ) : (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[9px] font-bold text-slate-500">
                            <span>Mevcut: {developmentExamCount}</span>
                            <span>Gerekli: {card.minimum}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{width:`${progress}%`}}
                            />
                          </div>
                          <p className="mt-2 text-[9px] font-semibold text-slate-500">
                            {selectedStudent
                              ? `${Math.max(0,card.minimum-developmentExamCount)} deneme daha gerekli.`
                              : "Önce öğrenci seçiniz."}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {showAllCategories && activeReportView==="champions" && (
        <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={()=>toggleReportSection("Şampiyonlar Ligi")}
            className="flex w-full items-center justify-between gap-4 bg-amber-700 p-5 text-left text-white transition hover:bg-amber-800"
            aria-expanded={Boolean(openReportSections["Şampiyonlar Ligi"])}
          >
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-white/15 p-3">
                <TrendingUp className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-black">Şampiyonlar Ligi</h2>
                <p className="mt-1 text-[11px] text-white/75">
                  Başarı gruplarının gelişim, kazanım, dikkat ve ders performanslarına göre karşılaştırılması
                </p>
              </div>
            </div>

            <ChevronDown
              className={`h-5 w-5 shrink-0 transition-transform ${
                openReportSections["Şampiyonlar Ligi"] ? "rotate-180" : ""
              }`}
            />
          </button>

          {openReportSections["Şampiyonlar Ligi"] && (
            <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <article className="flex min-h-36 flex-col rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <h3 className="text-xs font-black text-slate-800">
                  Gelişim Kupası
                </h3>
                <p className="mt-2 flex-1 text-[10px] leading-relaxed text-slate-600">
                  En çok gelişen grup
                </p>
              </article>

              <article className="flex min-h-36 flex-col rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
                <h3 className="text-xs font-black text-slate-800">
                  Kazanım Kupası
                </h3>
                <p className="mt-2 flex-1 text-[10px] leading-relaxed text-slate-600">
                  En çok kazanım geliştiren grup
                </p>
              </article>

              <article className="flex min-h-36 flex-col rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <h3 className="text-xs font-black text-slate-800">
                  Zor Soru Kupası
                </h3>
                <p className="mt-2 flex-1 text-[10px] leading-relaxed text-slate-600">
                  Zor sorularda en başarılı grup
                </p>
              </article>

              <article className="flex min-h-36 flex-col rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                <h3 className="text-xs font-black text-slate-800">
                  Dikkat Kupası
                </h3>
                <p className="mt-2 flex-1 text-[10px] leading-relaxed text-slate-600">
                  En az dikkatsizlik yapan grup
                </p>
              </article>

              <article className="flex min-h-36 flex-col rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <h3 className="text-xs font-black text-slate-800">
                  Takım Dengesi
                </h3>
                <p className="mt-2 flex-1 text-[10px] leading-relaxed text-slate-600">
                  Her öğrencisi gelişen grup
                </p>
              </article>

              <article className="flex min-h-36 flex-col rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                <h3 className="text-xs font-black text-slate-800">
                  En Büyük Sıçrama
                </h3>
                <p className="mt-2 flex-1 text-[10px] leading-relaxed text-slate-600">
                  Son sınavda en çok gelişen grup
                </p>
              </article>

              <article className="flex min-h-36 flex-col rounded-2xl border border-lime-200 bg-lime-50/70 p-4">
                <h3 className="text-xs font-black text-slate-800">
                  Ders Şampiyonları
                </h3>
                <p className="mt-2 flex-1 text-[10px] leading-relaxed text-slate-600">
                  Her ders için ayrı şampiyon grup
                </p>
              </article>

              <article className="flex min-h-36 flex-col rounded-2xl border border-fuchsia-200 bg-fuchsia-50/70 p-4">
                <h3 className="text-xs font-black text-slate-800">
                  Süper Grup
                </h3>
                <p className="mt-2 flex-1 text-[10px] leading-relaxed text-slate-600">
                  Tüm kriterlerin ağırlıklı ortalamasında en başarılı grup
                </p>
              </article>
            </div>
          )}
        </section>
      )}


      {showAllCategories && activeReportView==="points" && (
        <section className="overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={()=>toggleReportSection("Kazanılabilir Puanlar")}
            className="flex w-full items-center justify-between gap-4 bg-rose-700 p-5 text-left text-white transition hover:bg-rose-800"
            aria-expanded={Boolean(openReportSections["Kazanılabilir Puanlar"])}
          >
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-white/15 p-3">
                <FileText className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-black">Kazanılabilir Puanlar</h2>
                <p className="mt-1 text-[11px] text-white/75">
                  Yanlış ve boş cevaplardan geri kazanılabilecek puanların analiz edilmesi
                </p>
              </div>
            </div>

            <ChevronDown
              className={`h-5 w-5 shrink-0 transition-transform ${
                openReportSections["Kazanılabilir Puanlar"]
                  ? "rotate-180"
                  : ""
              }`}
            />
          </button>

          {openReportSections["Kazanılabilir Puanlar"] && (
            <div className="grid gap-4 p-4 xl:grid-cols-3">
              <section className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/60">
                <header className="border-b border-sky-200 bg-sky-100/80 px-4 py-3">
                  <h3 className="text-sm font-black text-sky-900">
                    Genel Bakış
                  </h3>
                  <p className="mt-1 text-[10px] font-semibold text-sky-700/80">
                    Öğrencinin sınav genelindeki puan kaybının özet görünümü
                  </p>
                </header>

                <div className="space-y-2 p-3">
                  {[
                    "Toplam Kayıp Puan",
                    "Derslere Göre Kayıp Puan",
                    "Konulara Göre Kayıp Puan",
                    "Son 5 Sınavdaki Değişim",
                  ].map((title)=>(
                    <article
                      key={title}
                      className="rounded-xl border border-sky-200 bg-white px-3 py-3 shadow-sm"
                    >
                      <h4 className="text-xs font-black text-slate-800">
                        {title}
                      </h4>
                    </article>
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/60">
                <header className="border-b border-violet-200 bg-violet-100/80 px-4 py-3">
                  <h3 className="text-sm font-black text-violet-900">
                    Kazanım Analizi
                  </h3>
                  <p className="mt-1 text-[10px] font-semibold text-violet-700/80">
                    Puan kaybına neden olan ve gelişim gösteren kazanımlar
                  </p>
                </header>

                <div className="space-y-2 p-3">
                  {[
                    "En Fazla Puan Kaybettiren Kazanımlar",
                    "Hiç Puan Kaybedilmeyen Kazanımlar",
                    "Son Sınavlara Göre Gelişen Kazanımlar",
                    "Sürekli Zorlanılan Kazanımlar",
                  ].map((title)=>(
                    <article
                      key={title}
                      className="rounded-xl border border-violet-200 bg-white px-3 py-3 shadow-sm"
                    >
                      <h4 className="text-xs font-black text-slate-800">
                        {title}
                      </h4>
                    </article>
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/60">
                <header className="border-b border-emerald-200 bg-emerald-100/80 px-4 py-3">
                  <h3 className="text-sm font-black text-emerald-900">
                    Gelişim Önerileri
                  </h3>
                  <p className="mt-1 text-[10px] font-semibold text-emerald-700/80">
                    Öğrencinin puanını yükseltmeye yönelik öncelikli öneriler
                  </p>
                </header>

                <div className="space-y-2 p-3">
                  {[
                    "Geri Kazanılabilir Puan",
                    "Öncelikli Çalışma Alanları",
                    "Hedef Puan İçin Gerekli Kazanımlar",
                    "Tahmini Sıralama Kazanımı",
                  ].map((title)=>(
                    <article
                      key={title}
                      className="rounded-xl border border-emerald-200 bg-white px-3 py-3 shadow-sm"
                    >
                      <h4 className="text-xs font-black text-slate-800">
                        {title}
                      </h4>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      )}

  </>;
}
