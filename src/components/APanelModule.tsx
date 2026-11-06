import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Classroom, Teacher, Student } from "../types";
import { downloadClassroomWeeklySheet } from "../pdf";
import { useSchedulePersistence } from "../hooks/useSchedulePersistence";
import {
  downloadClassSchedulesPdf,
  downloadTeacherSchedulesPdf,
} from "../services/schedule/individualSchedulePdfService";
import { buildTeacherLoadRows, buildClassLoadRows, generateTeacherLoadPdf, generateClassLoadPdf } from "../services/schedule/teacherLoadPdfService";
import { generateClassCoursesListPdf, generateTeacherCoursesListPdf } from "../services/schedule/listPdfService";
import { formatCourseName } from "../utils/courseNameFormat";

import { sqliteStorage } from "../core/state/SyncStateStore";
const PANEL_BUTTONS = ["AA", "BB", "CC", "DD", "EE", "FF"] as const;
const PANEL_LABELS: Record<string, string> = {
  AA: "Programlar",
  BB: "Ders Yükü",
  CC: "Listeler",
  DD: "DD",
  EE: "EE",
  FF: "FF",
};
const EFFECTIVE_DATE_KEY = "rota_schedule_effective_date";

interface APanelModuleProps {
  teachers: Teacher[];
  classrooms: Classroom[];
  students?: Student[];
}

export default function APanelModule({ teachers = [], classrooms = [], students = [] }: APanelModuleProps) {
  const [selectedButton, setSelectedButton] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadView, setLoadView] = useState<"teacher" | "class">("teacher");
  const [listView, setListView] = useState<"classCourses" | "teacherCourses">("classCourses");
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState("");
  const pdfFrameRef = useRef<HTMLIFrameElement | null>(null);
  const teacherLoadScrollRef = useRef<HTMLDivElement | null>(null);
  const teacherDragState = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [effectiveDate, setEffectiveDate] = useState(() => {
    try { return sqliteStorage.getItem(EFFECTIVE_DATE_KEY) || ""; } catch { return ""; }
  });
  const { scheduleData, isDbLoading } = useSchedulePersistence(classrooms, teachers);

  useEffect(() => {
    try {
      if (effectiveDate) sqliteStorage.setItem(EFFECTIVE_DATE_KEY, effectiveDate);
      else sqliteStorage.removeItem(EFFECTIVE_DATE_KEY);
    } catch (error) {
      console.error("Program uygulama tarihi kaydedilemedi:", error);
    }
  }, [effectiveDate]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const closePdfPreview = () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl("");
    setPdfPreviewTitle("");
  };

  const printPdfPreview = () => {
    const frame = pdfFrameRef.current;
    try {
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
    } catch (error) {
      console.error("PDF yazdırma penceresi açılamadı:", error);
      window.open(pdfPreviewUrl, "_blank", "noopener,noreferrer");
    }
  };

  const sortedClassrooms = useMemo(
    () => [...classrooms].sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true })),
    [classrooms],
  );
  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [teachers],
  );

  const teacherLoadModel = useMemo(
    () => buildTeacherLoadRows(classrooms, teachers),
    [classrooms, teachers],
  );

  const classLoadModel = useMemo(
    () => buildClassLoadRows(classrooms),
    [classrooms],
  );

  const classCourseListModel = useMemo(() => {
    const normalize = (value: unknown) => String(value || "").trim();
    const trSort = (a: string, b: string) =>
      a.localeCompare(b, "tr", { sensitivity: "base", numeric: true });

    const getGroups = (classroom: any) => {
      const values = [
        ...(Array.isArray(classroom?.groups) ? classroom.groups : []),
        classroom?.group1Name,
        classroom?.group2Name,
      ]
        .map(normalize)
        .filter(Boolean);
      return Array.from(new Set(values));
    };

    return [...classrooms]
      .sort((a, b) => trSort(a.name, b.name))
      .map((classroom) => {
        const groups = getGroups(classroom);
        const allGroupNames = new Set(groups);

        const rows = (classroom.assignedCourses || []).map((course: any) => {
          const courseName = normalize(course.courseName);
          const teacherNames = [normalize(course.teacherName), normalize(course.teacherName2)]
            .filter(Boolean)
            .join(" / ");
          const type = normalize(course.type);
          const groupName = normalize(course.groupName);
          const groupParts = groupName
            .split(/[,/+]+/)
            .map((item: string) => item.trim())
            .filter(Boolean);

          const compulsory = type === "compulsory" || type === "Zorunlu Ders";
          const sharedByAllGroups =
            groups.length > 0 &&
            (groupParts.length === 0 || groups.every((group) => groupParts.includes(group)));

          const common = compulsory || groupName === "" || sharedByAllGroups;

          return {
            courseName,
            teacherNames,
            common,
          };
        });

        const merged = new Map<string, { courseName: string; teacherNames: string; common: boolean }>();
        rows.forEach((row) => {
          const key = `${row.courseName}|${row.teacherNames}`;
          const current = merged.get(key);
          if (!current) merged.set(key, row);
          else if (row.common) merged.set(key, { ...current, common: true });
        });

        const sortedRows = [...merged.values()].sort((a, b) => {
          if (a.common !== b.common) return a.common ? -1 : 1;
          return trSort(a.courseName, b.courseName);
        });

        return {
          classroom,
          rows: sortedRows,
        };
      });
  }, [classrooms]);

  const teacherCourseListModel = useMemo(() => {
    const normalize = (value: unknown) => String(value || "").trim();
    const trSort = (a: string, b: string) =>
      a.localeCompare(b, "tr", { sensitivity: "base", numeric: true });

    const classSortKey = (name: string) => {
      const match = normalize(name).match(/(\d+)\s*[/\- ]?\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9]*)/);
      if (!match) return { grade: 99, branch: normalize(name) };
      return {
        grade: Number(match[1] || 99),
        branch: normalize(match[2] || ""),
      };
    };

    return [...teachers]
      .sort((a, b) => trSort(a.name, b.name))
      .map((teacher) => {
        const rows: Array<{ classroomName: string; courseName: string }> = [];

        for (const classroom of classrooms) {
          for (const course of classroom.assignedCourses || []) {
            const teacherIds = [normalize(course.teacherId), normalize(course.teacherId2)].filter(Boolean);
            if (!teacherIds.includes(teacher.id)) continue;

            rows.push({
              classroomName: classroom.name,
              courseName: normalize(course.courseName),
            });
          }
        }

        const merged = new Map<string, { classroomName: string; courseName: string }>();
        rows.forEach((row) => merged.set(`${row.classroomName}|${row.courseName}`, row));

        const sortedRows = [...merged.values()].sort((a, b) => {
          const aKey = classSortKey(a.classroomName);
          const bKey = classSortKey(b.classroomName);
          if (aKey.grade !== bKey.grade) return aKey.grade - bKey.grade;
          const branchDiff = trSort(aKey.branch, bKey.branch);
          if (branchDiff) return branchDiff;
          return trSort(a.courseName, b.courseName);
        });

        return {
          teacher,
          rows: sortedRows,
        };
      });
  }, [classrooms, teachers]);

  const runPdf = async (
    title: string,
    action: () => Promise<unknown> | unknown,
  ) => {
    if (isDbLoading) {
      alert("Ders programı verileri henüz yükleniyor. Lütfen birkaç saniye sonra tekrar deneyin.");
      return;
    }
    if (!effectiveDate) {
      alert("Lütfen önce programın uygulanacağı tarihi girin.");
      return;
    }
    try {
      setIsGenerating(true);
      const result = await action();
      if (!(result instanceof Blob)) {
        throw new Error("PDF önizleme verisi oluşturulamadı.");
      }
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      const url = URL.createObjectURL(result);
      setPdfPreviewTitle(title);
      setPdfPreviewUrl(url);
    } catch (error) {
      console.error("Program PDF'i oluşturulamadı:", error);
      alert("PDF oluşturulurken bir hata oluştu.");
    } finally {
      setIsGenerating(false);
    }
  };

  const runUtilityPdf = async (
    title: string,
    action: () => Promise<unknown> | unknown,
  ) => {
    try {
      setIsGenerating(true);
      const result = await action();
      if (!(result instanceof Blob)) throw new Error("PDF verisi oluşturulamadı.");
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewTitle(title);
      setPdfPreviewUrl(URL.createObjectURL(result));
    } catch (error) {
      console.error("PDF oluşturma hatası:", error);
      alert("PDF oluşturulurken bir hata oluştu.");
    } finally {
      setIsGenerating(false);
    }
  };

  const startTeacherTableDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const element = teacherLoadScrollRef.current;
    if (!element) return;
    teacherDragState.current = {
      active: true,
      startX: event.pageX,
      scrollLeft: element.scrollLeft,
    };
    element.style.cursor = "grabbing";
  };

  const moveTeacherTableDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const element = teacherLoadScrollRef.current;
    if (!element || !teacherDragState.current.active) return;
    event.preventDefault();
    const distance = event.pageX - teacherDragState.current.startX;
    element.scrollLeft = teacherDragState.current.scrollLeft - distance;
  };

  const stopTeacherTableDrag = () => {
    teacherDragState.current.active = false;
    if (teacherLoadScrollRef.current) teacherLoadScrollRef.current.style.cursor = "grab";
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 pb-6 pt-0 lg:px-8 lg:pb-8 lg:pt-0">
      <section className="rounded-3xl border-2 border-dashed border-green-600 bg-white p-4">
        <div className="bg-theme-pattern flex min-h-[52px] w-full flex-wrap items-center gap-1.5 rounded-2xl bg-green-600 p-1.5 shadow-inner">
          {PANEL_BUTTONS.map((buttonName) => {
            const selected = selectedButton === buttonName;
            return (
              <button
                key={buttonName}
                type="button"
                onClick={() => setSelectedButton(buttonName)}
                className={`flex h-[40px] min-w-[92px] flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border-2 px-5 text-[11px] font-bold transition-all ${
                  selected
                    ? "border-white bg-white text-green-700 shadow-sm"
                    : "border-white/60 text-white hover:bg-green-700/80"
                }`}
              >
                {PANEL_LABELS[buttonName] || buttonName}
              </button>
            );
          })}
        </div>
      </section>

      {selectedButton === "AA" && (
        <>
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="grid items-end gap-4 md:grid-cols-[1fr_280px]">
              <div>
                <h2 className="text-base font-bold text-emerald-950">Programın Uygulanacağı Tarih</h2>
                <p className="mt-1 text-sm text-emerald-800">
                  Bu tarih kaydedilir; sınıf ve öğretmen PDF’lerinde üst bilgi ve imza/onay alanlarında otomatik kullanılır.
                </p>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-emerald-900">Uygulama tarihi</span>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-emerald-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600"
                />
              </label>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">Sınıf Programları PDF</h2>
                
              </div>

              <label className="mb-2 block text-sm font-semibold text-slate-700">Sınıf seçin</label>
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-green-600"
              >
                <option value="">Sınıf seçiniz...</option>
                {sortedClassrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!selectedClassId || !effectiveDate || isGenerating || isDbLoading}
                  onClick={() => runPdf("Sınıf Programı", () => downloadClassSchedulesPdf({
                    classrooms: sortedClassrooms.filter((item) => item.id === selectedClassId),
                    scheduleData,
                    effectiveDate,
                  }))}
                  className="h-11 rounded-xl bg-green-600 px-4 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Seçili Sınıfı Aç / Yazdır
                </button>
                <button
                  type="button"
                  disabled={sortedClassrooms.length === 0 || !effectiveDate || isGenerating || isDbLoading}
                  onClick={() => runPdf("Sınıf Programı", () => downloadClassSchedulesPdf({ classrooms: sortedClassrooms, scheduleData, effectiveDate }))}
                  className="h-11 rounded-xl border-2 border-green-600 bg-white px-4 text-sm font-bold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tüm Sınıfları Aç / Yazdır
                </button>
              </div>
              <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-xs font-medium text-green-800">
                Toplu PDF düzeni: 1 sınıf = 1 sayfa.
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">Öğretmen Programları PDF</h2>
                
              </div>

              <label className="mb-2 block text-sm font-semibold text-slate-700">Öğretmen seçin</label>
              <select
                value={selectedTeacherId}
                onChange={(event) => setSelectedTeacherId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-green-600"
              >
                <option value="">Öğretmen seçiniz...</option>
                {sortedTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!selectedTeacherId || !effectiveDate || isGenerating || isDbLoading}
                  onClick={() => runPdf("Öğretmen Programı", () => downloadTeacherSchedulesPdf({
                    teachers: sortedTeachers.filter((item) => item.id === selectedTeacherId),
                    classrooms: sortedClassrooms,
                    scheduleData,
                    effectiveDate,
                  }))}
                  className="h-11 rounded-xl bg-green-600 px-4 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Seçili Öğretmeni Aç / Yazdır
                </button>
                <button
                  type="button"
                  disabled={sortedTeachers.length === 0 || !effectiveDate || isGenerating || isDbLoading}
                  onClick={() => runPdf("Öğretmen Programı", () => downloadTeacherSchedulesPdf({
                    teachers: sortedTeachers,
                    classrooms: sortedClassrooms,
                    scheduleData,
                    effectiveDate,
                  }))}
                  className="h-11 rounded-xl border-2 border-green-600 bg-white px-4 text-sm font-bold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tüm Öğretmenleri Aç / Yazdır
                </button>
              </div>
              <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-xs font-medium text-green-800">
                Toplu PDF düzeni: 1 öğretmen = 1 sayfa.
              </div>
            </div>
          </section>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Sınıflar Çarşaf Programı</h3>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
            <p className="text-sm font-medium text-slate-600">
              Tüm sınıfların haftalık ders dağılımını tek çarşaf program görünümünde hazırlamak için kullanılacaktır.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500"
            >
              Çarşaf Program Hazırla
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Öğretmenler Çarşaf Programı</h3>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
            <p className="text-sm font-medium text-slate-600">
              Tüm öğretmenlerin haftalık ders dağılımını tek çarşaf program görünümünde hazırlamak için kullanılacaktır.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500"
            >
              Çarşaf Program Hazırla
            </button>
          </div>
        </section>
      </div>
        </>
      )}

      {selectedButton === "CC" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Listeler</h2>
            <p className="mt-1 text-sm text-slate-600">
              Görüntülemek ve yazdırmak istediğiniz liste türünü seçin.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Sınıf Dersleri</h3>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
                <p className="text-sm font-medium text-slate-600">
                  Sınıfların derslerini ve derse giren öğretmenleri listeler.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setListView("classCourses");
                    setIsListModalOpen(true);
                  }}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Listeyi Aç
                </button>
                <button type="button" onClick={() => void downloadClassSchedulesPdf({ classrooms, scheduleData, effectiveDate })} className="mt-2 rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50">A4 Program + Sınıf Listesi</button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Öğretmen Dersleri</h3>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
                <p className="text-sm font-medium text-slate-600">
                  Öğretmenlerin derslerini sınıf ve ders adıyla listeler.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setListView("teacherCourses");
                    setIsListModalOpen(true);
                  }}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Listeyi Aç
                </button>
              </div>
            </section>
          </div>
        </section>
      )}

      {isListModalOpen && (
        <div className="fixed inset-0 z-[9998] flex flex-col bg-slate-950/90">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/15 bg-slate-900 px-5 text-white shadow-xl">
            <div>
              <div className="text-sm font-bold">
                {listView === "classCourses" ? "Sınıf Dersleri" : "Öğretmen Dersleri"}
              </div>
              <div className="text-xs text-slate-300">Liste görüntüleme ve yazdırma ekranı</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() =>
                  runUtilityPdf(
                    listView === "classCourses" ? "Sınıf Dersleri - A4" : "Öğretmen Dersleri - A4",
                    () =>
                      listView === "classCourses"
                        ? generateClassCoursesListPdf(classrooms)
                        : generateTeacherCoursesListPdf(classrooms, teachers),
                  )
                }
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                PDF Oluştur
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700"
              >
                Yazdır
              </button>
              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20"
              >
                Kapat
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 print:bg-white print:p-0">
            <div className="mx-auto max-w-[1200px] space-y-5 print:max-w-none">
              {listView === "classCourses" ? (
                classCourseListModel.map(({ classroom, rows }) => (
                  <section
                    key={classroom.id}
                    className="break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:shadow-none"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                      <h3 className="font-bold text-slate-900">{classroom.name}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="w-20 border-b border-slate-200 px-3 py-2 text-center">Sıra No</th>
                            <th className="border-b border-slate-200 px-3 py-2 text-left">Ders Adı</th>
                            <th className="border-b border-slate-200 px-3 py-2 text-left">Derse Giren Öğretmen(ler)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, index) => (
                            <tr key={`${row.courseName}-${row.teacherNames}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="px-3 py-2 text-center font-medium text-slate-700">{index + 1}</td>
                              <td className={`px-3 py-2 ${row.common ? "font-bold text-slate-950" : "text-slate-800"}`}>
                                {row.courseName}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{row.teacherNames || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))
              ) : (
                teacherCourseListModel.map(({ teacher, rows }) => (
                  <section
                    key={teacher.id}
                    className="break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:shadow-none"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                      <h3 className="font-bold text-slate-900">{teacher.name}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="w-20 border-b border-slate-200 px-3 py-2 text-center">Sıra No</th>
                            <th className="border-b border-slate-200 px-3 py-2 text-left">Sınıf</th>
                            <th className="border-b border-slate-200 px-3 py-2 text-left">Ders</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, index) => (
                            <tr key={`${row.classroomName}-${row.courseName}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="px-3 py-2 text-center font-medium text-slate-700">{index + 1}</td>
                              <td className="px-3 py-2 font-semibold text-slate-800">{row.classroomName}</td>
                              <td className="px-3 py-2 text-slate-700">{row.courseName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedButton === "BB" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Ders Yükü</h2>
            <p className="mt-1 text-sm text-slate-600">
              Görüntülemek istediğiniz ders yükü listesini seçin.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
              loadView === "teacher"
                ? "border-blue-400 ring-2 ring-blue-100"
                : "border-slate-200"
            }`}>
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Ders / Öğretmen</h3>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
                <p className="text-sm font-medium text-slate-600">
                  Derslerin öğretmenlere göre haftalık ders yüklerini görüntüler.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLoadView("teacher")}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Tabloyu Aç
                  </button>
                  <button
                    type="button"
                    disabled={isGenerating || teachers.length === 0}
                    onClick={() => runPdf("Ders / Öğretmen - A3", () => generateTeacherLoadPdf({ classrooms, teachers }))}
                    className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    A3 Önizle / Yazdır
                  </button>
                </div>
              </div>
            </section>

            <section className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
              loadView === "class"
                ? "border-blue-400 ring-2 ring-blue-100"
                : "border-slate-200"
            }`}>
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Ders / Sınıf</h3>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
                <p className="text-sm font-medium text-slate-600">
                  Derslerin sınıflara göre haftalık ders yüklerini görüntüler.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLoadView("class")}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Tabloyu Aç
                  </button>
                  <button
                    type="button"
                    disabled={isGenerating || classrooms.length === 0}
                    onClick={() => runPdf("Ders / Sınıf - A3", () => generateClassLoadPdf({ classrooms }))}
                    className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    A3 Önizle / Yazdır
                  </button>
                </div>
              </div>
            </section>
          </div>

          {loadView === "teacher" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-900">Ders / Öğretmen Tablosu</h3>
                <button
                  type="button"
                  disabled={isGenerating || teachers.length === 0}
                  onClick={() => runPdf("Ders / Öğretmen - A3", () => generateTeacherLoadPdf({ classrooms, teachers }))}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  A3 Önizle / Yazdır
                </button>
              </div>

              <div
                ref={teacherLoadScrollRef}
                onMouseDown={startTeacherTableDrag}
                onMouseMove={moveTeacherTableDrag}
                onMouseUp={stopTeacherTableDrag}
                onMouseLeave={stopTeacherTableDrag}
                className="w-full max-w-full cursor-grab select-none overflow-x-auto rounded-2xl border border-slate-200"
                title="Tabloyu sağa-sola taşımak için basılı tutup sürükleyin"
              >
                <table className="min-w-max border-collapse text-[10px]">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="sticky left-0 z-20 w-[180px] min-w-[180px] whitespace-nowrap border border-slate-300 bg-slate-100 px-3 py-2 text-center font-bold text-slate-800">
                        Ders
                      </th>
                      {teacherLoadModel.teacherColumns.map((item, index) => {
                        const prev = teacherLoadModel.teacherColumns[index - 1];
                        const branchStart = index > 0 && prev?.branch !== item.branch;
                        return (
                          <th
                            key={item.teacher.id}
                            className={`w-[125px] min-w-[125px] max-w-[125px] border border-slate-300 px-1 py-2 text-center align-middle ${
                              branchStart ? "border-l-[3px] border-l-slate-700" : ""
                            }`}
                            title={`${item.teacher.name} • ${item.branch}`}
                          >
                            <div className="whitespace-normal break-words font-bold leading-tight text-slate-900">{item.teacher.name}</div>
                            <div className="mt-1 text-[8px] font-medium leading-tight text-slate-500">{item.branch}</div>
                          </th>
                        );
                      })}
                      <th className="w-[100px] min-w-[100px] border border-slate-300 bg-slate-200 px-1 py-2 text-center font-bold">
                        Ders Toplamı
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherLoadModel.rows.map((row, rowIndex) => (
                      <tr key={formatCourseName(row.course)} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className={`sticky left-0 z-10 w-[180px] min-w-[180px] whitespace-nowrap border border-slate-300 px-3 py-2 text-center font-bold text-slate-800 ${
                          rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"
                        }`}>
                          {formatCourseName(row.course)}
                        </td>
                        {row.cells.map((cell, index) => {
                          const current = teacherLoadModel.teacherColumns[index];
                          const prev = teacherLoadModel.teacherColumns[index - 1];
                          const branchStart = index > 0 && prev?.branch !== current?.branch;
                          const total = cell.entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
                          return (
                            <td
                              key={cell.teacherId}
                              className={`w-[125px] min-w-[125px] max-w-[125px] border border-slate-300 px-0.5 py-1.5 text-center align-middle ${
                                branchStart ? "border-l-[3px] border-l-slate-700" : ""
                              }`}
                            >
                              {total > 0 ? total : ""}
                            </td>
                          );
                        })}
                        <td className="border border-slate-300 bg-slate-50 px-1 py-2 text-center font-bold">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-200 font-bold">
                      <td className="sticky left-0 z-10 w-[180px] min-w-[180px] whitespace-nowrap border border-slate-400 bg-slate-200 px-3 py-2 text-center">
                        Toplam Ders Saati
                      </td>
                      {teacherLoadModel.teacherColumns.map((item, index) => {
                        const prev = teacherLoadModel.teacherColumns[index - 1];
                        const branchStart = index > 0 && prev?.branch !== item.branch;
                        return (
                          <td
                            key={item.teacher.id}
                            className={`border border-slate-400 px-1 py-2 text-center ${
                              branchStart ? "border-l-[3px] border-l-slate-700" : ""
                            }`}
                          >
                            {teacherLoadModel.teacherTotals.get(item.teacher.id) || 0}
                          </td>
                        );
                      })}
                      <td className="border border-slate-400 bg-slate-300 px-1 py-2 text-center">
                        {[...teacherLoadModel.courseTotals.values()].reduce((sum, value) => sum + value, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-900">Ders / Sınıf Tablosu</h3>
                <button
                  type="button"
                  disabled={isGenerating || classrooms.length === 0}
                  onClick={() => runPdf("Ders / Sınıf - A3", () => generateClassLoadPdf({ classrooms }))}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  A3 Önizle / Yazdır
                </button>
              </div>

              <div className="w-full max-w-full overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full table-fixed border-collapse text-[10px]">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="w-[150px] whitespace-nowrap border border-slate-300 bg-slate-100 px-3 py-2 text-center font-bold text-slate-800">
                        Ders
                      </th>
                      {classLoadModel.classrooms.map((classroom) => (
                        <th
                          key={classroom.id}
                          className="min-w-0 border border-slate-300 px-1 py-2 text-center font-bold text-slate-800"
                          title={classroom.name}
                        >
                          <div className="truncate">{classroom.name}</div>
                        </th>
                      ))}
                      <th className="min-w-0 border border-slate-300 bg-slate-200 px-1 py-2 text-center font-bold">
                        Ders Toplamı
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {classLoadModel.rows.map((row, rowIndex) => (
                      <tr key={formatCourseName(row.course)} className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className={`w-[150px] whitespace-nowrap border border-slate-300 px-3 py-2 text-center font-bold text-slate-800 ${
                          rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"
                        }`}>
                          {formatCourseName(row.course)}
                        </td>
                        {row.cells.map((cell) => (
                          <td
                            key={cell.classroomId}
                            className="border border-slate-300 px-0.5 py-1.5 text-center align-middle"
                          >
                            {cell.hours > 0 ? cell.hours : ""}
                          </td>
                        ))}
                        <td className="border border-slate-300 bg-slate-50 px-1 py-2 text-center font-bold">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-200 font-bold">
                      <td className="w-[150px] whitespace-nowrap border border-slate-400 bg-slate-200 px-3 py-2 text-center">
                        Toplam Ders Saati
                      </td>
                      {classLoadModel.classrooms.map((classroom) => (
                        <td key={classroom.id} className="border border-slate-400 px-1 py-2 text-center">
                          {classLoadModel.classTotals.get(classroom.id) || 0}
                        </td>
                      ))}
                      <td className="border border-slate-400 bg-slate-300 px-1 py-2 text-center">
                        {[...classLoadModel.courseTotals.values()].reduce((sum, value) => sum + value, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      )}

      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/90">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/15 bg-slate-900 px-5 text-white shadow-xl">
            <div>
              <div className="text-sm font-bold">{pdfPreviewTitle}</div>
              <div className="text-xs text-slate-300">PDF önizleme ve yazdırma ekranı</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={printPdfPreview}
                className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700"
              >
                Yazdır
              </button>
              <button
                type="button"
                onClick={closePdfPreview}
                className="rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20"
              >
                Kapat
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-slate-700 p-3">
            <iframe
              ref={pdfFrameRef}
              title={pdfPreviewTitle || "PDF Önizleme"}
              src={pdfPreviewUrl}
              className="h-full w-full rounded-xl border-0 bg-white shadow-2xl"
            />
          </div>
        </div>
      )}



    </div>
  );
}

