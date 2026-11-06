import type { Classroom, Teacher } from "../../types";
import type { ScheduleData, ScheduleViewType, SolverResult, UnplacedInfo } from "../../types/schedule";
import { DISTRIBUTION_REPORT_STORAGE_KEY } from "./scheduleRules";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
interface DownloadScheduleReportArgs {
  viewType: ScheduleViewType;
  selectedId: string;
  classrooms: Classroom[];
  teachers: Teacher[];
  scheduleData: ScheduleData;
  lastDistributionReport: any | null;
  unplacedInfo: UnplacedInfo;
  solverResult: SolverResult | null;
  totalPenalty: number;
  penaltyDetails: any[];
  getPlacedHoursForEntity: (
    type: "class" | "teacher",
    id: string,
    courseName: string,
    groupName?: string,
    className?: string,
    weeklyHours?: number,
    currentScheduleData?: ScheduleData,
  ) => number;
}

export function downloadScheduleDistributionReport({
  viewType, selectedId, classrooms, teachers, scheduleData, lastDistributionReport,
  unplacedInfo, solverResult, totalPenalty, penaltyDetails, getPlacedHoursForEntity,
}: DownloadScheduleReportArgs) {
  const now = new Date();
  let persistedDistributionReport = lastDistributionReport;
  if (!persistedDistributionReport) {
    try {
      const savedReport = sqliteStorage.getItem(DISTRIBUTION_REPORT_STORAGE_KEY);
      if (savedReport) persistedDistributionReport = JSON.parse(savedReport);
    } catch (error) {
      console.warn("Kaydedilmiş dağıtım raporu rapora eklenemedi:", error);
    }
  }

  const selectedName = selectedId
    ? viewType === "class"
      ? classrooms.find((c: any) => c.id === selectedId)?.name || selectedId
      : teachers.find((t: any) => t.id === selectedId)?.name || selectedId
    : "Tüm okul";

  const getBlockCourseName = (block: any) =>
    block?.course?.courseName || block?.course?.name || block?.courseName || "Ders";
  const getBlockTeacherName = (block: any) =>
    block?.course?.teacherName || block?.course?.teacherName2 || block?.teacherName || "Belirtilmedi";

  const allAssignedCourses: any[] = [];
  classrooms.forEach((cls: any) => {
    (cls.assignedCourses || []).forEach((course: any) => {
      const weeklyHours = Number(course.weeklyHours || 0);
      const placedHours = getPlacedHoursForEntity(
        "class", cls.id, course.courseName, course.groupName, cls.name, weeklyHours, scheduleData,
      );
      allAssignedCourses.push({
        className: cls.name,
        courseName: course.courseName || "Ders",
        teacherName: course.teacherName || course.teacherName2 || "Belirtilmedi",
        weeklyHours, placedHours, remaining: Math.max(0, weeklyHours - placedHours),
      });
    });
  });

  const missingCourses = allAssignedCourses.filter((item) => item.remaining > 0);
  const teacherlessCourses = allAssignedCourses.filter(
    (item) => !item.teacherName || item.teacherName === "Belirtilmedi" || item.teacherName === "Öğretmen Atanmadı",
  );
  const liveUnplacedBlocks = Array.isArray(persistedDistributionReport?.unplacedBlocks)
    ? persistedDistributionReport.unplacedBlocks
    : unplacedInfo.details || [];

  const reportLines = [
    "ORDU LİSESİ DERS DAĞITIM ANALİZ RAPORU",
    "================================",
    `Tarih: ${now.toLocaleString("tr-TR")}`,
    `Görünüm: ${viewType === "class" ? "Sınıf Planı" : "Öğretmen Planı"}`,
    `Seçim: ${selectedName}`, "", "ÖZET", "----",
    `Toplam atanmış ders kaydı: ${allAssignedCourses.length}`,
    `Yerleşemeyen / eksik ders kaydı: ${missingCourses.length}`,
    `Öğretmeni belirtilmemiş ders kaydı: ${teacherlessCourses.length}`,
    `Canlı yerleşemeyen blok sayısı: ${liveUnplacedBlocks.length}`,
    `Toplam ceza puanı: ${totalPenalty}`,
    `Ceza detayı sayısı: ${penaltyDetails.length}`,
    persistedDistributionReport ? `Son algoritma: ${persistedDistributionReport.algorithm || "Bilinmiyor"}` : "Son algoritma: Henüz dağıtım sonucu yok",
    persistedDistributionReport ? `Son algoritma sonucu: ${persistedDistributionReport.success ? "Başarılı" : "Başarısız"}` : "Son algoritma sonucu: Yok",
    persistedDistributionReport ? `Ceza değişimi: ${persistedDistributionReport.initialPenalty ?? "-"} -> ${persistedDistributionReport.finalPenalty ?? "-"}` : "Ceza değişimi: Yok",
    persistedDistributionReport?.durationMs ? `Çalışma süresi: ${Math.round(persistedDistributionReport.durationMs / 1000)} sn` : "Çalışma süresi: Yok",
    "", "YERLEŞEMEYEN / EKSİK DERSLER", "-----------------------------",
    ...(missingCourses.length ? missingCourses.map((item) =>
      `${item.className} | ${item.courseName} | Öğretmen: ${item.teacherName} | Haftalık: ${item.weeklyHours} | Yerleşen: ${item.placedHours} | Eksik: ${item.remaining}`
    ) : ["Yerleşemeyen ders görünmüyor."]),
    "", "CANLI SOLVER YERLEŞEMEYEN BLOKLARI", "----------------------------------",
    ...(liveUnplacedBlocks.length ? liveUnplacedBlocks.map((block: any, index: number) =>
      `${index + 1}. ${block.className || "Sınıf"} | ${getBlockCourseName(block)} | Öğretmen: ${getBlockTeacherName(block)} | Süre: ${block.duration || "-"} saat`
    ) : ["Canlı solver yerleşemeyen blok bilgisi yok."]),
    "", "ÖĞRETMENİ BELİRTİLMEMİŞ DERSLER", "-------------------------------",
    ...(teacherlessCourses.length ? teacherlessCourses.map((item) =>
      `${item.className} | ${item.courseName} | Haftalık: ${item.weeklyHours}`
    ) : ["Öğretmeni belirtilmemiş ders görünmüyor."]),
    "", "SON SOLVER DETAYI", "-----------------",
    persistedDistributionReport?.details || (solverResult
      ? `${solverResult.success ? "Başarılı" : "Başarısız"} | ${solverResult.courseName || ""} | ${(solverResult.reasons || []).join("; ")}`
      : "Henüz solver sonucu yok."),
    "", "CEZA / İYİLEŞTİRME DETAYLARI", "----------------------------",
    ...(penaltyDetails.length ? penaltyDetails.map((det: any) =>
      `${det.targetName} | ${det.day || "-"} ${det.hours || ""} | ${det.points} puan | ${det.description}`
    ) : ["Ceza detayı bulunmuyor."]),
  ];

  const blob = new Blob([reportLines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rota-ders-dagitim-analiz-raporu-${now.toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
