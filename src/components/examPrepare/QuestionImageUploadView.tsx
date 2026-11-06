import React, { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import localforage from "../../core/state/AppStateService";

const ANALYSIS_QUESTION_IMAGE_STORE = "exam_analysis_question_images";

type AnalysisQuestionImage = { name: string; type: string; blob: Blob };

function QuestionImageUploadView({ exam }: { exam: any }) {
  const [images, setImages] = useState<Record<string, Record<number, AnalysisQuestionImage>>>({});
  const subjects = Array.from(
    new Map(
      (exam?.examStructure || [])
        .flatMap((test: any) => test.subjects || [])
        .map((subject: any) => [String(subject.name), subject]),
    ).values(),
  ) as any[];

  useEffect(() => {
    localforage
      .getItem<Record<string, Record<string, Record<number, AnalysisQuestionImage>>>>(
        ANALYSIS_QUESTION_IMAGE_STORE,
      )
      .then((stored) => setImages(stored?.[exam.id] || {}));
  }, [exam.id]);

  const uploadSubjectImages = async (subjectName: string, files: FileList | null) => {
    if (!files?.length) return;
    const nextSubject = { ...(images[subjectName] || {}) };
    Array.from(files).forEach((file) => {
      const baseName = file.name.replace(/\.[^.]+$/, "").trim();
      const questionNumber = Number(baseName);
      if (Number.isInteger(questionNumber) && questionNumber > 0) {
        nextSubject[questionNumber] = { name: file.name, type: file.type, blob: file };
      }
    });
    const nextImages = { ...images, [subjectName]: nextSubject };
    const stored =
      (await localforage.getItem<Record<string, Record<string, Record<number, AnalysisQuestionImage>>>>(
        ANALYSIS_QUESTION_IMAGE_STORE,
      )) || {};
    await localforage.setItem(ANALYSIS_QUESTION_IMAGE_STORE, {
      ...stored,
      [exam.id]: nextImages,
    });
    setImages(nextImages);
  };

  return (
    <div className="space-y-5 rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-black text-slate-850">Analiz İçin Soru Görselleri</h2>
        <p className="mt-1 text-xs font-bold text-slate-500">
          Görseller yalnız sınav sonrası analizde kullanılır; sınav kitapçığına eklenmez. Dosya adı soru numarası olmalıdır: 1.jpg, 2.png gibi.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject) => {
          const uploaded = Object.keys(images[subject.name] || {}).map(Number).sort((a, b) => a - b);
          return (
            <label
              key={subject.name}
              className="group cursor-pointer rounded-2xl border-2 border-dashed border-red-200 bg-red-50/40 p-5 transition hover:border-red-500 hover:bg-red-50"
            >
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={(event) => {
                  void uploadSubjectImages(subject.name, event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-xl bg-red-600 p-2.5 text-white"><ImageIcon className="h-5 w-5" /></span>
                <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-black text-red-700">
                  {uploaded.length} / {subject.count || "?"} görsel
                </span>
              </div>
              <h3 className="mt-4 font-black text-slate-850">{subject.name}</h3>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                Kartı tıklayıp bu derse ait JPG, JPEG veya PNG dosyalarını seçin.
              </p>
              {uploaded.length > 0 && (
                <p className="mt-3 line-clamp-2 text-[10px] font-black text-red-700">
                  Yüklenen sorular: {uploaded.join(", ")}
                </p>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}


export default QuestionImageUploadView;
