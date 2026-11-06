import React, { useState, useMemo, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  UserPlus,
  AlertCircle,
  Check,
  X,
  Phone,
  Mail,
  Bookmark,
  MapPin,
  Calendar,
  Image as ImageIcon,
  UploadCloud,
  CheckCircle2,
  XCircle,
  FileImage,
  RefreshCw,
  QrCode,
  Copy,
  ExternalLink,
  Users,
  UserMinus,
  BarChart3,
  List,
  Printer,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import { Student, Classroom } from "../types";
import {
  deleteLocalDocument,
  fetchCollectionFromLocalDatabase,
  searchStudentRecords,
  syncCollectionToLocalDatabase,
} from "../lib/localDatabase";
import { sqliteStorage } from "../core/state/SyncStateStore";
import appStateService from "../core/state/AppStateService";

interface StudentModuleProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  viewMode?: "lists" | "new" | "excel";
}

const normalizeAcademicGroup = (group?: string) => {
  const value = String(group || "").trim().toLocaleUpperCase("tr-TR");
  if (value === "SAY" || value === "SAYISAL") return "SAY";
  if (value === "EA" || value === "EŞİT AĞIRLIK") return "EA";
  if (value === "DİL") return "DİL";
  if (value === "SÖZ" || value === "SÖZEL") return "SÖZ";
  return "";
};


const DELETED_STUDENT_RECORDS_KEY = "student_deleted_records_v1";

const readDeletedStudentRecords = (): any[] => {
  try {
    const raw = sqliteStorage.getItem(DELETED_STUDENT_RECORDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const appendDeletedStudentRecords = (records: Student[]) => {
  if (records.length === 0) return;
  const previous = readDeletedStudentRecords();
  const deletedAt = new Date().toISOString();
  const next = [
    ...records.map((student) => ({
      id: String(student.id || ""),
      name: String(student.name || ""),
      classroom: String(student.classroom || ""),
      group: String(student.group || ""),
      phone: String(student.phone || ""),
      parentName: String(student.parentName || ""),
      parentPhone: String(student.parentPhone || ""),
      deletedAt,
    })),
    ...previous,
  ].slice(0, 2000);

  sqliteStorage.setItem(DELETED_STUDENT_RECORDS_KEY, JSON.stringify(next));
};

export default function StudentModule({
  students,
  setStudents,
  viewMode = "lists",
}: StudentModuleProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [directoryStudents, setDirectoryStudents] = useState<Student[]>([]);
  const [isDirectorySearching, setIsDirectorySearching] = useState(false);
  const [directorySearchError, setDirectorySearchError] = useState("");
  // Son kaydedilen öğrenciyi listenin en üstünde ve görünür tutar.
  // Özellikle sesli kayıt SQLite'a yazıldıktan sonra bellek/listenin geride kalmasını önler.
  const [recentlySavedStudentId, setRecentlySavedStudentId] = useState<string>("");

  // Load dynamic classrooms from localStorage
  const systemClassrooms: Classroom[] = useMemo(() => {
    try {
      const saved = localStorage.getItem("school_classrooms");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  const editableClassroomOptions = useMemo(() => {
    const names = new Set<string>();

    systemClassrooms.forEach((classroom) => {
      const name = String(classroom.name || "").trim();
      if (name) names.add(name);
    });

    students.forEach((student) => {
      const name = String(student.classroom || "").trim();
      if (name) names.add(name);
    });

    return Array.from(names).sort((a, b) =>
      a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }),
    );
  }, [systemClassrooms, students]);

  const classroomGroupByStudentId = useMemo(() => {
    const lookup = new Map<string, string>();
    systemClassrooms.forEach((classroom) => {
      const orderedGroups = classroom.groups?.length
        ? classroom.groups
        : Object.keys(classroom.groupStudentIds || {});
      orderedGroups.forEach((group) => {
        (classroom.groupStudentIds?.[group] || []).forEach((studentId) => {
          const key = `${String(classroom.name).toLocaleUpperCase("tr-TR").replace(/[\s\-_/]+/g, "")}:${String(studentId)}`;
          if (!lookup.has(key)) lookup.set(key, normalizeAcademicGroup(group));
        });
      });
    });
    return lookup;
  }, [systemClassrooms]);

  const resolveStudentGroup = useCallback((student: Student) => {
    const directGroup = normalizeAcademicGroup(student.group);
    if (directGroup) return directGroup;

    const classroomKey = String(student.classroom || "").toLocaleUpperCase("tr-TR").replace(/[\s\-_/]+/g, "");
    return classroomGroupByStudentId.get(`${classroomKey}:${String(student.id)}`) || "";
  }, [classroomGroupByStudentId]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrRegistrationUrl, setQrRegistrationUrl] = useState("");
  const [qrRegistrationError, setQrRegistrationError] = useState("");
  const [qrNetworkHost, setQrNetworkHost] = useState("");
  const printQrA5 = useCallback(() => {
    if (!qrRegistrationUrl) return;
    const popup = window.open("", "_blank", "width=760,height=1000");
    if (!popup) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&data=${encodeURIComponent(qrRegistrationUrl)}`;
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Öğrenci Kayıt QR</title><style>@page{size:A5 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;text-align:center;color:#0f172a;margin:0;padding:8mm}h1{font-size:22px;margin:0 0 5mm}p{font-size:13px;line-height:1.5;margin:4mm 0}img{display:block;width:112mm;height:112mm;margin:8mm auto;image-rendering:auto}small{display:block;word-break:break-all;color:#475569;font-size:9px}</style></head><body><h1>ÖĞRENCİ BİLGİ KAYIT FORMU</h1><p>Telefonunuzun kamerasıyla QR kodu okutun ve formu doldurun.</p><img src="${qrUrl}" alt="Öğrenci kayıt QR kodu"><p><b>Kayıt bağlantısı</b></p><small>${qrRegistrationUrl}</small><script>document.querySelector('img').addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`);
    popup.document.close();
  }, [qrRegistrationUrl]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isDeletingStudents, setIsDeletingStudents] = useState(false);
  const [studentDeleteError, setStudentDeleteError] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [statisticsMode, setStatisticsMode] = useState<"counts" | "lists" | null>(null);
  const [selectedGradeLevels, setSelectedGradeLevels] = useState<number[]>([]);
  const [selectedClassroomBranches, setSelectedClassroomBranches] = useState<string[]>([]);
  const [listOptionalColumns, setListOptionalColumns] = useState<Array<"group" | "phone" | "parentName" | "parentPhone">>([]);


  useEffect(() => {
    if (!isQrModalOpen && viewMode !== "excel") return;

    let cancelled = false;
    setQrRegistrationError("");

    const currentOrigin = window.location.origin;
    const fallbackIsReachable =
      !/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::\d+)?$/i.test(currentOrigin);

    if (fallbackIsReachable) {
      setQrRegistrationUrl(`${currentOrigin}/?mode=student-register`);
      setQrNetworkHost(new URL(currentOrigin).host);
      return;
    } else {
      setQrRegistrationUrl("");
      setQrNetworkHost("");
    }

    fetch("/api/public/student-registration/link", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "QR kayıt bağlantısı hazırlanamadı.");
        }
        if (cancelled) return;
        setQrRegistrationUrl(String(data.url || ""));
        setQrNetworkHost(String(data.host || ""));
      })
      .catch((error) => {
        if (cancelled) return;
        setQrRegistrationError(
          error instanceof Error
            ? error.message
            : "QR kayıt bağlantısı hazırlanamadı.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isQrModalOpen, viewMode]);

  // Group Assignment states
  const [isGroupAssignmentModalOpen, setIsGroupAssignmentModalOpen] = useState(false);
  const [assignClassroom, setAssignClassroom] = useState<string>("");
  const [assignGroup, setAssignGroup] = useState<string>("1. Grup");
  const [assignCustomGroup, setAssignCustomGroup] = useState<string>("");
  const [assignSearchQuery, setAssignSearchQuery] = useState<string>("");

  // Bulk upload states
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkUploadLogs, setBulkUploadLogs] = useState<
    {
      id: string;
      filename: string;
      matchedNo: string | null;
      matchedName: string | null;
      status: "success" | "failed";
      message: string;
      preview: string;
    }[]
  >([]);

  // Form states
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    classroom: systemClassrooms[0]?.name || "",
    group: "",
    gpa: "",
    absences: "",
    email: "",
    phone: "",
    parentName: "",
    parentPhone: "",
    status: "Aktif" as "Aktif" | "Pasif",
    dob: "",
    pob: "",
    address: "",
    oob: "",
    avatar: "",
  });

  const [formError, setFormError] = useState("");

  const emptyInlineStudent = {
    id: "",
    name: "",
    // Yeni kayıt satırı bilinçli olarak boş başlar.
    classroom: "",
    group: "",
    phone: "",
    parentName: "",
    parentPhone: "",
    status: "Aktif" as "Aktif" | "Pasif",
    dob: "",
    pob: "",
    address: "",
    oob: "",
  };

  const [inlineEditingStudentId, setInlineEditingStudentId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState(emptyInlineStudent);
  const [newInlineDraft, setNewInlineDraft] = useState(emptyInlineStudent);

  const studentToInlineDraft = (student: Student) => ({
    id: String(student.id || ""),
    name: String(student.name || ""),
    classroom: String(student.classroom || ""),
    group: resolveStudentGroup(student),
    phone: String(student.phone || ""),
    parentName: String(student.parentName || ""),
    parentPhone: String(student.parentPhone || ""),
    status: (student.status || "Aktif") as "Aktif" | "Pasif",
    dob: String(student.dob || ""),
    pob: String(student.pob || ""),
    address: String(student.address || ""),
    oob: student.oob !== undefined ? String(student.oob) : "",
  });

  const beginInlineStudentEdit = (student: Student) => {
    setInlineEditingStudentId(student.id);
    setInlineDraft(studentToInlineDraft(student));
    setFormError("");
  };

  const cancelInlineStudentEdit = () => {
    setInlineEditingStudentId(null);
    setInlineDraft(emptyInlineStudent);
    setFormError("");
  };

  const saveInlineStudentEdit = (original: Student) => {
    if (!inlineDraft.id.trim() || !inlineDraft.name.trim() || !inlineDraft.classroom.trim()) {
      setFormError("Öğrenci No, Ad Soyad ve Sınıf alanları zorunludur.");
      return;
    }

    const duplicate = students.some(
      (student) =>
        String(student.id).toLocaleLowerCase("tr-TR") ===
          inlineDraft.id.trim().toLocaleLowerCase("tr-TR") &&
        student.id !== original.id,
    );
    if (duplicate) {
      setFormError("Bu Öğrenci No başka bir öğrenciye ait.");
      return;
    }

    const parsedOob = inlineDraft.oob.trim()
      ? Number(inlineDraft.oob.replace(",", "."))
      : undefined;
    if (parsedOob !== undefined && (!Number.isFinite(parsedOob) || parsedOob < 0 || parsedOob > 100)) {
      setFormError("OÖB 0 ile 100 arasında olmalıdır.");
      return;
    }

    setStudents((previous) =>
      previous.map((student) =>
        student.id === original.id
          ? {
              ...student,
              id: inlineDraft.id.trim(),
              name: inlineDraft.name.trim(),
              classroom: inlineDraft.classroom,
              group: normalizeAcademicGroup(inlineDraft.group) || undefined,
              phone: inlineDraft.phone.trim(),
              parentName: inlineDraft.parentName.trim(),
              parentPhone: inlineDraft.parentPhone.trim(),
              status: inlineDraft.status,
              dob: inlineDraft.dob.trim(),
              pob: inlineDraft.pob.trim(),
              address: inlineDraft.address.trim(),
              oob: parsedOob,
            }
          : student,
      ),
    );
    setInlineEditingStudentId(null);
    setFormError("");
  };

  const saveNewInlineStudent = async () => {
    if (!newInlineDraft.id.trim() || !newInlineDraft.name.trim() || !newInlineDraft.classroom.trim()) {
      setFormError("Yeni kayıt için Öğrenci No, Ad Soyad ve Sınıf alanları zorunludur.");
      return;
    }

    const duplicate = students.some(
      (student) =>
        String(student.id).trim().toLocaleLowerCase("tr-TR") ===
        newInlineDraft.id.trim().toLocaleLowerCase("tr-TR"),
    );
    if (duplicate) {
      setFormError("Bu Öğrenci No zaten kayıtlı.");
      return;
    }

    const parsedOob = newInlineDraft.oob.trim()
      ? Number(newInlineDraft.oob.replace(",", "."))
      : undefined;
    if (parsedOob !== undefined && (!Number.isFinite(parsedOob) || parsedOob < 0 || parsedOob > 100)) {
      setFormError("OÖB 0 ile 100 arasında olmalıdır.");
      return;
    }

    const newStudent: Student = {
      id: newInlineDraft.id.trim(),
      name: newInlineDraft.name.trim(),
      classroom: newInlineDraft.classroom.trim(),
      group: normalizeAcademicGroup(newInlineDraft.group) || undefined,
      phone: newInlineDraft.phone.trim(),
      parentName: newInlineDraft.parentName.trim(),
      parentPhone: newInlineDraft.parentPhone.trim(),
      status: newInlineDraft.status,
      dob: newInlineDraft.dob.trim(),
      pob: newInlineDraft.pob.trim(),
      address: newInlineDraft.address.trim(),
      oob: parsedOob,
      registerDate: new Date().toISOString().split("T")[0],
      avatar: "",
    };

    const nextStudents = [newStudent, ...students];
    try {
      // Sarı satırdaki Kaydet düğmesi yalnızca ekrandaki state'i değil,
      // doğrudan SQLite koleksiyonunu da günceller. Böylece sayfa yenilense de kayıt kalır.
      await syncCollectionToLocalDatabase("students", nextStudents);
    } catch (error) {
      setFormError(
        `Öğrenci veritabanına kaydedilemedi: ${error instanceof Error ? error.message : "SQLite yazma hatası"}`,
      );
      return;
    }

    let verifiedStudents = nextStudents;
    try {
      const stored = await fetchCollectionFromLocalDatabase("students");
      if (Array.isArray(stored)) verifiedStudents = stored as Student[];
    } catch {
      // Yazma başarılıysa doğrulama okumasındaki geçici hata kaydı geri almamalı.
    }

    setStudents(verifiedStudents);
    setDirectoryStudents(verifiedStudents);
    setRecentlySavedStudentId(String(newStudent.id));

    // Kayıttan sonra arama/sınıf filtrelerini temizle; yeni öğrenci hemen alttaki listede görünsün.
    setSearchTerm("");
    setSelectedGradeLevels([]);
    setSelectedClassroomBranches([]);

    // Başarılı elle kayıttan sonra sarı kayıt satırını tamamen temizle.
    setNewInlineDraft({
      ...emptyInlineStudent,
      id: "",
      name: "",
      classroom: "",
      group: "",
      phone: "",
      parentName: "",
      parentPhone: "",
      dob: "",
      pob: "",
      address: "",
      oob: "",
    });
    setFormError("");
  };

  const getStudentGradeLevel = (student: Student) => {
    const match = String(student.classroom || "").trim().match(/^(\d{1,2})/);
    return match ? Number(match[1]) : null;
  };

  const normalizeClassroomName = (value?: string) => {
    const match = String(value || "").trim().toLocaleUpperCase("tr-TR").match(/^(\d{1,2})\s*-?\s*([A-ZÇĞİÖŞÜ])$/u);
    return match ? `${Number(match[1])}-${match[2]}` : String(value || "").trim();
  };

  const compactClassroomName = (value: string) => value.replace(/\s*[-/]\s*/g, "");

  const availableGradeLevels = useMemo(() => Array.from(
    new Set([
      9,
      ...students.map(getStudentGradeLevel),
      ...systemClassrooms.map((classroom) => {
        const match = String(classroom.name || "").trim().match(/^(\d{1,2})/);
        return match ? Number(match[1]) : null;
      }),
    ].filter((grade): grade is number => grade !== null)),
  ).sort((a, b) => a - b), [students, systemClassrooms]);

  const openStatistics = (mode: "counts" | "lists") => {
    const grades = mode === "lists" ? availableGradeLevels.slice(0, 1) : availableGradeLevels;
    setSelectedGradeLevels(grades);
    setSelectedClassroomBranches(
      mode === "lists"
        ? Array.from(new Set(students.filter((student) => getStudentGradeLevel(student) === grades[0]).map((student) => normalizeClassroomName(student.classroom))))
        : [],
    );
    setStatisticsMode(mode);
  };

  const normalizeGender = (student: Student) => {
    const value = String(student.gender || student.cinsiyet || "").trim().toLocaleUpperCase("tr-TR");
    if (["K", "KIZ", "KADIN"].includes(value)) return "Kız";
    if (["E", "ERKEK"].includes(value)) return "Erkek";
    return "Belirtilmemiş";
  };

  const availableClassroomBranches = useMemo(() => {
    const branches = new Set<string>([
      ...students
        .filter((student) => selectedGradeLevels.includes(getStudentGradeLevel(student) ?? -1))
        .map((student) => normalizeClassroomName(student.classroom)),
      ...systemClassrooms
        .filter((classroom) => {
          const match = String(classroom.name || "").trim().match(/^(\d{1,2})/);
          return match ? selectedGradeLevels.includes(Number(match[1])) : false;
        })
        .map((classroom) => normalizeClassroomName(classroom.name)),
    ]);

    // Veritabanında henüz 9. sınıf kaydı olmasa da okulun mevcut şube
    // düzenini kullanarak 9. sınıf seçeneklerini görünür tut.
    if (selectedGradeLevels.includes(9) && !Array.from(branches).some((name) => name.startsWith("9-"))) {
      const schoolBranchLetters = Array.from(new Set(
        systemClassrooms
          .map((classroom) => normalizeClassroomName(classroom.name).match(/^\d{1,2}-([A-ZÇĞİÖŞÜ])$/u)?.[1])
          .filter((branch): branch is string => Boolean(branch)),
      ));
      (schoolBranchLetters.length > 0 ? schoolBranchLetters : ["A", "B", "C", "D", "E"])
        .forEach((branch) => branches.add(`9-${branch}`));
    }

    return Array.from(branches).sort((a, b) =>
      a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }),
    );
  }, [selectedGradeLevels, students, systemClassrooms]);

  const reportStudents = useMemo(() => students.filter((student) => {
    const grade = getStudentGradeLevel(student);
    if (grade === null || !selectedGradeLevels.includes(grade)) return false;
    return statisticsMode !== "lists" || selectedClassroomBranches.includes(normalizeClassroomName(student.classroom));
  }), [selectedClassroomBranches, selectedGradeLevels, statisticsMode, students]);

  const reportClassrooms = useMemo(() => Array.from(new Set<string>(reportStudents.map((student) => student.classroom)))
    .sort((a, b) => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }))
    .map((classroom) => {
      const classStudents = reportStudents.filter((student) => student.classroom === classroom);
      const groups = { SAY: 0, EA: 0, "DİL": 0, "SÖZ": 0 };
      const genders = { "Kız": 0, "Erkek": 0, "Belirtilmemiş": 0 };
      classStudents.forEach((student) => {
        const group = resolveStudentGroup(student);
        if (group in groups) groups[group as keyof typeof groups] += 1;
        genders[normalizeGender(student)] += 1;
      });
      return { classroom, total: classStudents.length, groups, genders };
    }), [reportStudents, resolveStudentGroup]);

  const sortedReportStudents = useMemo(() => reportStudents.slice().sort(
    (a, b) =>
      String(a.id).localeCompare(String(b.id), "tr", { numeric: true, sensitivity: "base" }) ||
      a.name.localeCompare(b.name, "tr"),
  ), [reportStudents]);

  const createStatisticsPdf = async (mode: "download" | "print") => {
    const { PdfEngine } = await import("../pdf");
    const isCounts = statisticsMode === "counts";
    const body = isCounts
      ? [
          ["Sınıf", "Toplam", "SAY", "EA", "DİL", "SÖZ", "Kız", "Erkek", "Belirtilmemiş"],
          ...reportClassrooms.map((row) => [
            row.classroom, row.total, row.groups.SAY, row.groups.EA, row.groups["DİL"], row.groups["SÖZ"],
            row.genders["Kız"], row.genders["Erkek"], row.genders["Belirtilmemiş"],
          ]),
        ]
      : [
          [
            "Sınıf-Şube",
            "Öğrenci No",
            "Öğrenci Ad Soyad",
            ...(listOptionalColumns.includes("group") ? ["Grup"] : []),
            ...(listOptionalColumns.includes("phone") ? ["Öğrenci Tel"] : []),
            ...(listOptionalColumns.includes("parentName") ? ["Veli Adı"] : []),
            ...(listOptionalColumns.includes("parentPhone") ? ["Veli Telefon"] : []),
          ],
          ...sortedReportStudents.map((student) => [
            student.classroom,
            student.id,
            student.name,
            ...(listOptionalColumns.includes("group") ? [resolveStudentGroup(student) || "-"] : []),
            ...(listOptionalColumns.includes("phone") ? [student.phone || "-"] : []),
            ...(listOptionalColumns.includes("parentName") ? [student.parentName || "-"] : []),
            ...(listOptionalColumns.includes("parentPhone") ? [student.parentPhone || "-"] : []),
          ]),
        ];
    const tableWidths = isCounts
      ? Array(body[0].length).fill("*")
      : [
          55,
          55,
          135,
          ...(listOptionalColumns.includes("group") ? [38] : []),
          ...(listOptionalColumns.includes("phone") ? [68] : []),
          ...(listOptionalColumns.includes("parentName") ? [90] : []),
          ...(listOptionalColumns.includes("parentPhone") ? [68] : []),
        ];
    const pdfContent: any[] = isCounts
      ? [
          { text: "SINIF ÖĞRENCİ SAYILARI", style: "title", alignment: "center", margin: [0, 0, 0, 8] },
          { text: `Sınıf düzeyleri: ${selectedGradeLevels.map((grade) => `${grade}. Sınıf`).join(", ")} • Toplam: ${reportStudents.length}`, alignment: "center", margin: [0, 0, 0, 14] },
          { table: { headerRows: 1, widths: tableWidths, body }, layout: "lightHorizontalLines", fontSize: 8 },
        ]
      : selectedClassroomBranches.flatMap((classroom, index) => {
          const classroomStudents = sortedReportStudents.filter(
            (student) => normalizeClassroomName(student.classroom) === classroom,
          );
          const classroomBody = [
            body[0],
            ...classroomStudents.map((student) => [
              classroom,
              student.id,
              student.name,
              ...(listOptionalColumns.includes("group") ? [resolveStudentGroup(student) || "-"] : []),
              ...(listOptionalColumns.includes("phone") ? [student.phone || "-"] : []),
              ...(listOptionalColumns.includes("parentName") ? [student.parentName || "-"] : []),
              ...(listOptionalColumns.includes("parentPhone") ? [student.parentPhone || "-"] : []),
            ]),
          ];
          return [
            { text: `${classroom} ÖĞRENCİ LİSTESİ`, style: "title", alignment: "center", margin: [0, 0, 0, 6], ...(index > 0 ? { pageBreak: "before" } : {}) },
            { text: `Toplam öğrenci: ${classroomStudents.length}`, alignment: "center", margin: [0, 0, 0, 12] },
            { table: { headerRows: 1, widths: tableWidths, body: classroomBody }, layout: "lightHorizontalLines", fontSize: 8 },
          ];
        });
    await PdfEngine.generate({
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [28, 34, 28, 34],
      content: pdfContent,
    }, { mode, filename: isCounts ? "sinif-ogrenci-sayilari.pdf" : "ogrenci-listeleri.pdf" });
  };

  const downloadStudentListsExcel = () => {
    if (selectedClassroomBranches.length === 0) return;
    const workbook = XLSX.utils.book_new();
    selectedClassroomBranches.forEach((classroom) => {
      const classroomStudents = sortedReportStudents.filter(
        (student) => normalizeClassroomName(student.classroom) === classroom,
      );
      const rows = classroomStudents.map((student) => ({
        "Sınıf-Şube": classroom,
        "Öğrenci No": String(student.id),
        "Öğrenci Ad Soyad": student.name,
        ...(listOptionalColumns.includes("group") ? { Grup: resolveStudentGroup(student) || "-" } : {}),
        ...(listOptionalColumns.includes("phone") ? { "Öğrenci Tel": student.phone || "-" } : {}),
        ...(listOptionalColumns.includes("parentName") ? { "Veli Adı": student.parentName || "-" } : {}),
        ...(listOptionalColumns.includes("parentPhone") ? { "Veli Telefon": student.parentPhone || "-" } : {}),
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 14 },
        { wch: 14 },
        { wch: 30 },
        ...(listOptionalColumns.includes("group") ? [{ wch: 10 }] : []),
        ...(listOptionalColumns.includes("phone") ? [{ wch: 18 }] : []),
        ...(listOptionalColumns.includes("parentName") ? [{ wch: 26 }] : []),
        ...(listOptionalColumns.includes("parentPhone") ? [{ wch: 18 }] : []),
      ];
      worksheet["!autofilter"] = { ref: worksheet["!ref"] || "A1:C1" };
      worksheet["!pageSetup"] = { orientation: "landscape", paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
      XLSX.utils.book_append_sheet(workbook, worksheet, classroom.replace(/[\\/?*[\]:]/g, "-").slice(0, 31));
    });
    XLSX.writeFile(workbook, `ogrenci-listeleri-${selectedGradeLevels[0] ?? "sinif"}.xlsx`);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleSelectStudent = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };


  useEffect(() => {
    const queries = searchTerm.trim()
      ? [searchTerm.trim()]
      : selectedClassroomBranches;
    if (queries.length === 0) {
      // Listeyi yalnızca React belleğinden üretmek bazı sesli kayıtlarda eski bir kopyanın
      // görünmesine neden oluyordu. Önce anlık belleği göster, ardından SQLite'daki gerçek
      // öğrenci koleksiyonunu okuyup listeyi onunla doğrula.
      let active = true;
      setDirectoryStudents(students);
      setDirectorySearchError("");
      setIsDirectorySearching(true);

      fetchCollectionFromLocalDatabase("students")
        .then((records) => {
          if (!active) return;
          const storedStudents = Array.isArray(records) ? (records as Student[]) : [];
          setDirectoryStudents(storedStudents);
        })
        .catch((error) => {
          if (!active) return;
          // SQLite okunamazsa kullanıcı listesini boşaltma; bellekteki kayıtları göster.
          setDirectoryStudents(students);
          setDirectorySearchError(
            error instanceof Error ? error.message : "Öğrenci listesi veritabanından okunamadı.",
          );
        })
        .finally(() => {
          if (active) setIsDirectorySearching(false);
        });

      return () => {
        active = false;
      };
    }
    let active = true;
    setIsDirectorySearching(true);
    setDirectorySearchError("");
    const timer = window.setTimeout(() => {
      // Stored QR records historically use both `9A` and `9-A`. Search both
      // representations, then apply the canonical `9-A` filter below.
      const searchQueries = Array.from(new Set(queries.flatMap((query) => [query, compactClassroomName(query)])));
      Promise.all(searchQueries.map((query) => searchStudentRecords(query)))
        .then((results) => {
          if (!active) return;
          const uniqueStudents = new Map<string, Student>();
          results.forEach((result) => {
            (result.records as Student[]).forEach((student) => uniqueStudents.set(String(student.id), student));
          });
          setDirectoryStudents(Array.from(uniqueStudents.values()));
        })
        .catch((error) => {
          if (!active) return;
          setDirectoryStudents([]);
          setDirectorySearchError(error instanceof Error ? error.message : "Öğrenci araması yapılamadı.");
        })
        .finally(() => {
          if (active) setIsDirectorySearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchTerm, selectedClassroomBranches, students]);

  // Tüm koleksiyon yerine yalnızca veritabanından dönen arama sonuçlarını göster.
  // Yeni kaydedilen öğrenci artık listenin başına zorla taşınmaz. Öğrenciler her zaman
  // mevcut filtrelere uyar ve okul numarasına göre doğal (1, 2, 10, 623...) sırada görünür.
  const filteredStudents = useMemo(() => directoryStudents.filter((student) => {
    const grade = getStudentGradeLevel(student);

    if (
      selectedGradeLevels.length > 0 &&
      (grade === null || !selectedGradeLevels.includes(grade))
    ) {
      return false;
    }

    return (
      selectedClassroomBranches.length === 0 ||
      selectedClassroomBranches.includes(normalizeClassroomName(student.classroom))
    );
  }).sort((first, second) =>
    String(first.id).localeCompare(String(second.id), "tr", {
      numeric: true,
      sensitivity: "base",
    }),
  ), [directoryStudents, selectedClassroomBranches, selectedGradeLevels]);

  // Group Assignment memoized states and actions
  const activeAssignClassroom = assignClassroom || (systemClassrooms[0]?.name || "9-A");
  
  const availableGroups = useMemo(() => {
    const clsObj = systemClassrooms.find(c => c.name === activeAssignClassroom);
    if (!clsObj) return [];
    
    const groups = new Set<string>();
    if (clsObj.groups && clsObj.groups.length > 0) {
      clsObj.groups.forEach(g => groups.add(g));
    }
    if (clsObj.group1Name) groups.add(clsObj.group1Name);
    if (clsObj.group2Name) groups.add(clsObj.group2Name);
    
    return Array.from(groups);
  }, [systemClassrooms, activeAssignClassroom]);

  React.useEffect(() => {
    if (availableGroups.length > 0 && !availableGroups.includes(assignGroup) && assignGroup !== "Özel") {
      setAssignGroup(availableGroups[0]);
    } else if (availableGroups.length === 0 && assignGroup !== "Özel") {
      setAssignGroup("");
    }
  }, [activeAssignClassroom, availableGroups]);

  const activeAssignGroup = assignGroup === "Özel" ? assignCustomGroup.trim() : assignGroup;

  const searchedStudentsForAssignment = useMemo(() => {
    const q = assignSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return students.filter(s => {
      const fullName = `${s.name || ""}`.toLowerCase();
      const num = String(s.id || "").toLowerCase();
      const cls = (s.classroom || "").toLowerCase();
      const grp = (s.group || "").toLowerCase();
      return fullName.includes(q) || num.includes(q) || cls.includes(q) || grp.includes(q);
    }).slice(0, 8);
  }, [students, assignSearchQuery]);

  const currentGroupMembers = useMemo(() => {
    return students.filter(s => {
      const matchesClass = s.classroom === activeAssignClassroom;
      const matchesGroup = activeAssignGroup ? s.group === activeAssignGroup : !s.group;
      return matchesClass && matchesGroup;
    });
  }, [students, activeAssignClassroom, activeAssignGroup]);

  const addStudentToSelectedGroup = (studentId: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          classroom: activeAssignClassroom,
          group: activeAssignGroup || undefined
        };
      }
      return s;
    }));
  };

  const removeStudentFromSelectedGroup = (studentId: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          group: undefined
        };
      }
      return s;
    }));
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setFormData({
      id: "",
      name: "",
      classroom: systemClassrooms[0]?.name || "",
      group: "",
      gpa: "",
      absences: "",
      email: "",
      phone: "",
      parentName: "",
      parentPhone: "",
      status: "Aktif",
      dob: "",
      pob: "",
      address: "",
      oob: "",
      avatar: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!editingStudent) setIsModalOpen(false);
  }, [viewMode]);

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      id: student.id,
      name: student.name,
      classroom: student.classroom,
      group: resolveStudentGroup(student),
      gpa: student.gpa !== undefined ? student.gpa.toString() : "",
      absences:
        student.absences !== undefined ? student.absences.toString() : "",
      email: student.email || "",
      phone: student.phone,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      status: student.status,
      dob: student.dob || "",
      pob: student.pob || "",
      address: student.address || "",
      oob: student.oob !== undefined ? student.oob.toString() : "",
      avatar: student.avatar || "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const persistStudentDeletion = useCallback(async (nextStudents: Student[], deletedIds: string[]) => {
    const normalizeStudentKey = (value: unknown) => String(value ?? "").trim();
    const normalizedDeletedIds = new Set(deletedIds.map(normalizeStudentKey).filter(Boolean));

    const rowStudentKeys = (row: any) => [
      row?.id,
      row?.studentNumber,
      row?.studentNo,
      row?.schoolNumber,
      row?.number,
      row?.ogrenciNo,
      row?.ogrenci_no,
    ].map(normalizeStudentKey).filter(Boolean);

    const rowMatchesDeletedStudent = (row: any) =>
      rowStudentKeys(row).some((key) => normalizedDeletedIds.has(key));

    // Koleksiyon PUT işlemi bazı eski API sürümlerinde yalnız ekleme/güncelleme yapıp
    // listeden çıkarılan dokümanı fiziksel olarak silmiyor. Bu nedenle önce veritabanındaki
    // gerçek belge kimliklerini bulup DELETE çağrısı yapıyoruz. Özellikle Excel/QR ile
    // alınmış kayıtlarda __documentId okul numarasından farklı olabildiği için yalnız
    // student.id ile silmek yeterli değildir.
    const [canonicalBefore, legacyBefore] = await Promise.all([
      fetchCollectionFromLocalDatabase("students").catch(() => []),
      fetchCollectionFromLocalDatabase("school_students").catch(() => []),
    ]);

    const deleteMatchingDocuments = async (collectionName: "students" | "school_students", rows: any[]) => {
      const documentIds = new Set<string>();
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!rowMatchesDeletedStudent(row)) continue;
        const documentId = normalizeStudentKey(
          row?.__documentId ?? row?.documentId ?? row?._id ?? row?.id ?? row?.studentNumber ?? row?.number,
        );
        if (documentId) documentIds.add(documentId);
      }
      // Eski kayıtlarda belge kimliği doğrudan okul numarası olabilir. Bulunamasa bile
      // bu DELETE'ler best-effort çalışır; asıl doğrulama aşağıda koleksiyon tekrar okunarak yapılır.
      normalizedDeletedIds.forEach((id) => documentIds.add(id));
      await Promise.allSettled(
        Array.from(documentIds).map((documentId) => deleteLocalDocument(collectionName, documentId)),
      );
    };

    await Promise.all([
      deleteMatchingDocuments("students", canonicalBefore),
      deleteMatchingDocuments("school_students", legacyBefore),
    ]);

    // DELETE sonrasında koleksiyonları da silinen öğrencilerden arındırılmış tam listeyle
    // eşitle. Böylece yeni ve eski sunucu sürümlerinin her ikisinde de kalıcı sonuç oluşur.
    const canonicalNext = (Array.isArray(canonicalBefore) ? canonicalBefore : [])
      .filter((row: any) => !rowMatchesDeletedStudent(row));
    const legacyNext = (Array.isArray(legacyBefore) ? legacyBefore : [])
      .filter((row: any) => !rowMatchesDeletedStudent(row));

    // React'teki güncel liste daha zenginse onu canonical kaynak olarak kullan; fakat
    // directory aramasından gelen ve props listesinde bulunmayan kayıtların silinmesini
    // engellememek için yukarıdaki DB filtrelemesini de koru.
    const canonicalPayload = (Array.isArray(canonicalBefore) && canonicalBefore.length > 0)
      ? canonicalNext
      : nextStudents.filter((row: any) => !rowMatchesDeletedStudent(row));
    const legacyPayload = (Array.isArray(legacyBefore) && legacyBefore.length > 0)
      ? legacyNext
      : canonicalPayload;

    await Promise.all([
      syncCollectionToLocalDatabase("students", canonicalPayload),
      syncCollectionToLocalDatabase("school_students", legacyPayload),
      appStateService.setItem("school_students", legacyPayload),
    ]);

    // Bazı eski rapor/analiz modülleri hâlâ doğrudan localforage anahtarını okuyor.
    // Silinen öğrencinin bu ekranlarda yeniden görünmemesi için bu uyumluluk kopyasını da güncelle.
    try {
      const { default: localforage } = await import("localforage");
      await localforage.setItem("school_students", legacyPayload);
    } catch {
      // Ana SQLite kayıtları başarıyla güncellendiyse eski tarayıcı önbelleği zorunlu değildir.
    }

    try {
      sqliteStorage.setItem(
        "school_students",
        JSON.stringify(legacyPayload),
      );
    } catch {
      // Veritabanındaki DELETE başarılıysa tarayıcı uyumluluk kopyasındaki hata
      // kalıcı silme işlemini geri almamalıdır.
    }

    // Son doğrulama: hem canonical hem legacy koleksiyonunda okul numarası veya farklı
    // kimlik alanlarından hiçbiri kalmamalı. Varsa belge kimliğiyle bir kez daha silip
    // tekrar kontrol ediyoruz.
    let [canonicalAfter, legacyAfter] = await Promise.all([
      fetchCollectionFromLocalDatabase("students"),
      fetchCollectionFromLocalDatabase("school_students").catch(() => []),
    ]);

    if ([...(canonicalAfter || []), ...(legacyAfter || [])].some(rowMatchesDeletedStudent)) {
      await Promise.all([
        deleteMatchingDocuments("students", canonicalAfter || []),
        deleteMatchingDocuments("school_students", legacyAfter || []),
      ]);
      [canonicalAfter, legacyAfter] = await Promise.all([
        fetchCollectionFromLocalDatabase("students"),
        fetchCollectionFromLocalDatabase("school_students").catch(() => []),
      ]);
    }

    const stillExists = [...(Array.isArray(canonicalAfter) ? canonicalAfter : []), ...(Array.isArray(legacyAfter) ? legacyAfter : [])]
      .some(rowMatchesDeletedStudent);
    if (stillExists) {
      throw new Error("Öğrenci kaydı veritabanından fiziksel olarak silinemedi. Lütfen yeniden deneyin.");
    }
  }, []);

  const handleDelete = (id: string) => {
    setStudentDeleteError("");
    setStudentToDelete(id);
  };

  const handleBulkDelete = () => {
    if (selectedStudentIds.length === 0) return;
    setStudentDeleteError("");
    setIsBulkDeleteConfirmOpen(true);
  };

  const confirmSingleDelete = async () => {
    if (!studentToDelete || isDeletingStudents) return;
    const deleteId = String(studentToDelete);
    const deleted = students.find((student) => String(student.id) === deleteId)
      || directoryStudents.find((student) => String(student.id) === deleteId);
    const nextStudents = students.filter((student) => String(student.id) !== deleteId);

    setIsDeletingStudents(true);
    setStudentDeleteError("");
    try {
      await persistStudentDeletion(nextStudents, [deleteId]);
      if (deleted) appendDeletedStudentRecords([deleted]);
      setStudents(nextStudents);
      setDirectoryStudents((prev) => prev.filter((student) => String(student.id) !== deleteId));
      setSelectedStudentIds((prev) => prev.filter((id) => String(id) !== deleteId));
      setStudentToDelete(null);
    } catch (error) {
      setStudentDeleteError(error instanceof Error ? error.message : "Öğrenci veritabanından silinemedi.");
    } finally {
      setIsDeletingStudents(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedStudentIds.length === 0 || isDeletingStudents) return;
    const selectedIds = new Set(selectedStudentIds.map(String));
    const deletedStudents = students.filter((student) => selectedIds.has(String(student.id)));
    const nextStudents = students.filter((student) => !selectedIds.has(String(student.id)));

    setIsDeletingStudents(true);
    setStudentDeleteError("");
    try {
      await persistStudentDeletion(nextStudents, Array.from(selectedIds));
      appendDeletedStudentRecords(deletedStudents);
      setStudents(nextStudents);
      setDirectoryStudents((prev) => prev.filter((student) => !selectedIds.has(String(student.id))));
      setSelectedStudentIds([]);
      setIsBulkDeleteConfirmOpen(false);
    } catch (error) {
      setStudentDeleteError(error instanceof Error ? error.message : "Seçili öğrenciler veritabanından silinemedi.");
    } finally {
      setIsDeletingStudents(false);
    }
  };

  const handleExcelTemplateDownload = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Numara*": "1001",
        "Ad Soyad*": "Ahmet Yılmaz",
        "Sınıf*": "12-A",
        "Grup": "SAY",
        "Öğrenci Telefonu": "5559876543",
        "Velinin Adı Soyadı": "Mehmet Yılmaz",
        "Velinin Telefonu": "5551234567",
        "Doğum Tarihi(GG.AA.YY)": "01.01.2005",
        "Doğum Yeri": "İstanbul",
        "Açık Adres": "Örnek Mah. Çiçek Sok. No:1",
        "Okul Puanı (OOB)": "95.5",
        "Durum": "Aktif"
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ogrenciler");
    XLSX.writeFile(wb, "ogrenci_kayit_sablonu.xlsx");
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const normalizeHeader = (value: unknown) =>
      String(value ?? "")
        .replace(/^\uFEFF/, "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/[ıİ]/g, "i")
        .replace(/[şŞ]/g, "s")
        .replace(/[ğĞ]/g, "g")
        .replace(/[üÜ]/g, "u")
        .replace(/[öÖ]/g, "o")
        .replace(/[çÇ]/g, "c")
        .replace(/\*/g, "")
        .replace(/[^a-z0-9]+/g, "");

    const aliases: Record<string, string[]> = {
      id: ["numara", "ogrencino", "ogrencinumara", "okulno", "okulnumarasi", "no"],
      firstName: ["adi", "ad", "ogrenciadi", "ogrenciad"],
      lastName: ["soyadi", "soyad", "ogrencisoyadi", "ogrencisoyad"],
      fullName: ["adsoyad", "adisoyadi", "ogrenciadsoyad", "ogrenciadisoyadi"],
      classroom: ["sinif", "sinifsube", "sube", "sinifi", "sinifadi"],
      group: ["grup", "alan", "bolum", "program"],
      phone: ["ogrencitelefonu", "ogrencitelefon", "telefon", "ceptel", "ceptelefonu"],
      parentName: ["velininadisoyadi", "veliadisoyadi", "veliadsoyad", "vel_adi", "veliad", "veli"],
      parentPhone: ["velinintelefonu", "velitelefonu", "velitelefon", "velicep", "veliceptelefonu"],
      dob: ["dogumtarihiggaayy", "dogumtarihi", "dogumtarih", "dtarihi"],
      pob: ["dogumyeri", "dogumyer"],
      address: ["acikadres", "adres", "ikametadres"],
      oob: ["okulpuanioob", "oob", "okulpuani", "ortalama", "notortalamasi"],
      status: ["durum", "status", "ogrencidurum"],
      gender: ["cinsiyet", "gender"],
    };

    const asText = (value: unknown) => {
      if (value === null || value === undefined) return "";
      return String(value).trim();
    };

    const formatExcelDate = (value: unknown) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Intl.DateTimeFormat("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(value);
      }
      if (typeof value === "number" && value > 20000 && value < 100000) {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) {
          return `${String(parsed.d).padStart(2, "0")}.${String(parsed.m).padStart(2, "0")}.${parsed.y}`;
        }
      }
      return asText(value);
    };

    const reader = new FileReader();
    reader.onerror = () => {
      alert("Excel dosyası açılamadı. Dosyanın başka bir programda açık olmadığını kontrol edin.");
    };
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        if (!(arrayBuffer instanceof ArrayBuffer)) {
          throw new Error("Dosya içeriği okunamadı.");
        }

        const workbook = XLSX.read(arrayBuffer, {
          type: "array",
          cellDates: true,
          raw: true,
        });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = worksheetName ? workbook.Sheets[worksheetName] : undefined;
        if (!worksheet) throw new Error("Excel dosyasında çalışma sayfası bulunamadı.");

        const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
          header: 1,
          defval: "",
          blankrows: false,
          raw: true,
        });
        if (matrix.length < 2) {
          throw new Error("Excel dosyasında başlık satırı veya öğrenci kaydı bulunamadı.");
        }

        const headerRowIndex = matrix.findIndex((row) => {
          const normalized = (Array.isArray(row) ? row : []).map(normalizeHeader);
          return normalized.some((h) => aliases.id.includes(h)) &&
            normalized.some((h) => aliases.fullName.includes(h) || aliases.firstName.includes(h)) &&
            normalized.some((h) => aliases.classroom.includes(h));
        });
        if (headerRowIndex < 0) {
          throw new Error("Öğrenci numarası, ad soyad ve sınıf bilgilerini içeren başlık satırı bulunamadı. Şablonu indirip sütun adlarını değiştirmeden kullanın.");
        }

        const headers = (matrix[headerRowIndex] || []).map(normalizeHeader);
        const findIndex = (key: keyof typeof aliases) =>
          headers.findIndex((header) => aliases[key].includes(header));
        const indexes = Object.fromEntries(
          Object.keys(aliases).map((key) => [key, findIndex(key as keyof typeof aliases)]),
        ) as Record<keyof typeof aliases, number>;
        const valueAt = (row: unknown[], key: keyof typeof aliases) =>
          indexes[key] >= 0 ? row[indexes[key]] : "";

        const existingIds = new Set(students.map((student) => String(student.id).trim().toLocaleLowerCase("tr-TR")));
        const importedIds = new Set<string>();
        const newStudents: Student[] = [];
        let duplicateCount = 0;
        let invalidCount = 0;

        matrix.slice(headerRowIndex + 1).forEach((rawRow) => {
          const row = Array.isArray(rawRow) ? rawRow : [];
          if (row.every((cell) => asText(cell) === "")) return;

          const rawId = asText(valueAt(row, "id")).replace(/\.0$/, "");
          const firstName = asText(valueAt(row, "firstName"));
          const lastName = asText(valueAt(row, "lastName"));
          const rawName = `${firstName} ${lastName}`.trim() || asText(valueAt(row, "fullName"));
          const rawClass = asText(valueAt(row, "classroom"));
          if (!rawId || !rawName || !rawClass) {
            invalidCount += 1;
            return;
          }

          const normalizedId = rawId.toLocaleLowerCase("tr-TR");
          if (existingIds.has(normalizedId) || importedIds.has(normalizedId)) {
            duplicateCount += 1;
            return;
          }

          const classroom = rawClass
            .replace(/^[-–—]\s*/, "")
            .replace(/(\d+)\s*[-/.]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)/g, "$1-$2")
            .replace(/\s+-\s+/g, "-")
            .toLocaleUpperCase("tr-TR");
          const parsedOob = Number(String(valueAt(row, "oob")).replace(",", "."));
          const statusText = asText(valueAt(row, "status")).toLocaleLowerCase("tr-TR");
          const genderText = asText(valueAt(row, "gender"));

          newStudents.push({
            id: rawId,
            name: rawName.replace(/\s+/g, " "),
            classroom,
            group: normalizeAcademicGroup(asText(valueAt(row, "group"))) || undefined,
            gender: genderText || undefined,
            cinsiyet: genderText || undefined,
            phone: asText(valueAt(row, "phone")),
            parentName: asText(valueAt(row, "parentName")),
            parentPhone: asText(valueAt(row, "parentPhone")),
            dob: formatExcelDate(valueAt(row, "dob")),
            pob: asText(valueAt(row, "pob")),
            address: asText(valueAt(row, "address")),
            oob: Number.isFinite(parsedOob) ? parsedOob : undefined,
            status: statusText === "pasif" || statusText === "ayrildi" || statusText === "ayrıldı" ? "Pasif" : "Aktif",
            avatar: "",
            registerDate: new Date().toISOString(),
          });
          importedIds.add(normalizedId);
        });

        if (newStudents.length === 0) {
          const details = [
            duplicateCount ? `${duplicateCount} mükerrer kayıt` : "",
            invalidCount ? `${invalidCount} eksik kayıt` : "",
          ].filter(Boolean).join(", ");
          alert(`Aktarılabilecek öğrenci bulunamadı${details ? ` (${details})` : ""}. Öğrenci numarası, ad soyad ve sınıf bilgileri zorunludur.`);
          return;
        }

        setStudents((previous) => [...newStudents, ...previous]);
        const notes = [
          duplicateCount ? `${duplicateCount} mükerrer kayıt atlandı` : "",
          invalidCount ? `${invalidCount} eksik kayıt atlandı` : "",
        ].filter(Boolean);
        alert(`${newStudents.length} öğrenci başarıyla kaydedildi.${notes.length ? ` ${notes.join(", ")}.` : ""}`);
      } catch (error) {
        console.error("Öğrenci Excel aktarım hatası:", error);
        alert(error instanceof Error ? error.message : "Excel dosyası okunurken hata oluştu.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.id.trim() ||
      !formData.name.trim() ||
      !formData.classroom.trim()
    ) {
      setFormError(
        "Lütfen zorunlu alanları doldurunuz (Öğrenci No, Ad Soyad ve Sınıf zorunludur). Diğer bilgiler daha sonra girilebilir.",
      );
      return;
    }

    const trimmedId = formData.id.trim();

    // Check unique ID when creating a new student
    if (!editingStudent) {
      const isDuplicate = students.some(
        (s) => s.id.toLowerCase() === trimmedId.toLowerCase(),
      );
      if (isDuplicate) {
        setFormError(
          "Bu Öğrenci No zaten başka bir öğrenciye tanımlı. Lütfen benzersiz bir numara giriniz.",
        );
        return;
      }
    }

    const parsedOob = formData.oob.trim()
      ? parseFloat(formData.oob)
      : undefined;
    if (
      parsedOob !== undefined &&
      (isNaN(parsedOob) || parsedOob < 0 || parsedOob > 100)
    ) {
      setFormError(
        "OÖB (Ortaöğretim Başarı Puanı) 0 ile 100 arasında geçerli bir puan olmalıdır.",
      );
      return;
    }

    if (editingStudent) {
      // Edit mode
      setStudents((prev) =>
        prev.map((s) =>
          s.id === editingStudent.id
            ? {
                ...s,
                id: trimmedId,
                name: formData.name.trim(),
                classroom: formData.classroom,
                group: formData.group || undefined,
                phone: formData.phone.trim(),
                parentName: formData.parentName.trim(),
                parentPhone: formData.parentPhone.trim(),
                status: formData.status,
                dob: formData.dob.trim(),
                pob: formData.pob.trim(),
                address: formData.address.trim(),
                oob: parsedOob,
                avatar: formData.avatar || s.avatar,
              }
            : s,
        ),
      );
    } else {
      // Create mode
      const newStudent: Student = {
        id: trimmedId,
        name: formData.name.trim(),
        classroom: formData.classroom,
        group: formData.group || undefined,
        phone: formData.phone.trim(),
        parentName: formData.parentName.trim(),
        parentPhone: formData.parentPhone.trim(),
        status: formData.status,
        dob: formData.dob.trim(),
        pob: formData.pob.trim(),
        address: formData.address.trim(),
        oob: parsedOob,
        registerDate: new Date().toISOString().split("T")[0],
        avatar:
          formData.avatar ||
          `https://images.unsplash.com/photo-${Math.random() > 0.5 ? "1534528741775-53994a69daeb" : "1507003211169-0a1dd7228f2d"}?auto=format&fit=crop&q=80&w=120`,
      };
      setStudents((prev) => [newStudent, ...prev]);
    }

    if (viewMode === "new") openAddModal();
    else setIsModalOpen(false);
  };

  const normalizeStudentNumber = (value: unknown) => String(value ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");

  const normalizeStudentNameForPhoto = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9çğıöşü\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const optimizeStudentPhoto = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`${file.name} okunamadı.`));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error(`${file.name} geçerli bir resim değil.`));
        image.onload = () => {
          const maxWidth = 480;
          const maxHeight = 640;
          const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) return reject(new Error("Fotoğraf işleme alanı oluşturulamadı."));
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });

  const handleBulkPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) =>
      /\.(jpe?g|png)$/i.test(file.name),
    );
    e.target.value = "";
    if (files.length === 0) {
      alert("Lütfen JPG, JPEG veya PNG biçiminde öğrenci fotoğrafları seçin.");
      return;
    }

    const studentNumberIndex = new Map<string, Student[]>();
    students.forEach((student) => {
      const key = normalizeStudentNumber(student.id);
      if (!key) return;
      studentNumberIndex.set(key, [...(studentNumberIndex.get(key) || []), student]);
    });

    const seenStudentIds = new Set<string>();
    const results: typeof bulkUploadLogs = [];

    for (const file of files) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      const numberTokens = (cleanName.match(/\d+/g) || [])
        .map(normalizeStudentNumber)
        .filter(Boolean);

      let matched: Student | undefined;
      let failureMessage = "Dosya adında sistemde kayıtlı bir öğrenci numarası bulunamadı.";

      const exactCandidates = numberTokens.flatMap((token) => studentNumberIndex.get(token) || []);
      const uniqueCandidates = Array.from(new Map(exactCandidates.map((student) => [String(student.id), student])).values());

      if (uniqueCandidates.length === 1) {
        matched = uniqueCandidates[0];
      } else if (uniqueCandidates.length > 1) {
        failureMessage = "Dosya adındaki numaralar birden fazla öğrenciyle eşleşiyor.";
      } else if (numberTokens.length === 0) {
        const fileNameOnly = normalizeStudentNameForPhoto(cleanName);
        const nameCandidates = students.filter(
          (student) => normalizeStudentNameForPhoto(student.name) === fileNameOnly,
        );
        if (nameCandidates.length === 1) matched = nameCandidates[0];
        else if (nameCandidates.length > 1) failureMessage = "Aynı isimde birden fazla öğrenci var; okul numarası dosya adına eklenmeli.";
        else failureMessage = "Dosya adında okul numarası bulunamadı.";
      }

      if (matched && seenStudentIds.has(String(matched.id))) {
        failureMessage = `Aynı öğrenci için birden fazla fotoğraf seçildi (No: ${matched.id}).`;
        matched = undefined;
      }

      try {
        const preview = await optimizeStudentPhoto(file);
        if (matched) seenStudentIds.add(String(matched.id));
        results.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          filename: file.name,
          matchedNo: matched ? String(matched.id) : null,
          matchedName: matched?.name || null,
          status: matched ? "success" : "failed",
          message: matched ? "Okul numarası tam eşleşti; kaydetmeye hazır." : failureMessage,
          preview,
        });
      } catch (error) {
        results.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          filename: file.name,
          matchedNo: null,
          matchedName: null,
          status: "failed",
          message: error instanceof Error ? error.message : "Fotoğraf işlenemedi.",
          preview: "",
        });
      }
    }

    setBulkUploadLogs(results);
  };

  const saveBulkStudentPhotos = () => {
    const successful = bulkUploadLogs.filter(
      (log) => log.status === "success" && log.matchedNo && log.preview,
    );
    if (successful.length === 0) {
      alert("Kaydedilecek eşleşmiş fotoğraf bulunmuyor.");
      return;
    }

    const photoByStudentNo = new Map(
      successful.map((log) => [String(log.matchedNo), log.preview] as const),
    );

    setStudents((previous) =>
      previous.map((student) => {
        const avatar = photoByStudentNo.get(String(student.id));
        return avatar ? { ...student, avatar } : student;
      }),
    );

    setBulkUploadLogs((previous) =>
      previous.map((log) =>
        log.status === "success" ? { ...log, message: "Fotoğraf öğrenci kaydına kaydedildi." } : log,
      ),
    );
    alert(`${successful.length} öğrenci fotoğrafı başarıyla kaydedildi.`);
  };

  return (
    <div id="students-tab" className={`mx-auto flex w-full max-w-none flex-col gap-5 px-3 py-4 lg:px-4 lg:py-5 ${viewMode === "new" ? "student-new-record-mode" : viewMode === "excel" ? "student-excel-record-mode" : ""}`}>
      {/* Tab Header with Statistics Overview */}
      <div className="hidden">
        <button
          id="bulk-photo-upload-toggle-btn"
          onClick={() => setIsBulkUploadOpen(!isBulkUploadOpen)}
          className="hidden"
        >
          <UploadCloud className="w-4.5 h-4.5 text-indigo-600" />
          <span>Toplu Fotoğraf Yükle</span>
        </button>

        <input
          type="file"
          id="student-excel-upload-btn"
          className="hidden"
          accept=".xlsx, .xls"
          onChange={handleExcelUpload}
        />
        
        <button
          id="student-excel-template-btn"
          onClick={handleExcelTemplateDownload}
          className="hidden"
        >
          <span>Excel Şablonu İndir</span>
        </button>

        <button
          id="student-qr-register-btn"
          onClick={() => setIsQrModalOpen(true)}
          className="hidden"
        >
          <QrCode className="w-4 h-4" />
          <span>Öğrenci Kayıt QR</span>
        </button>

        <button id="add-student-btn" onClick={openAddModal} className="hidden">
          <Plus className="w-4 h-4" />
          <span>Yeni Öğrenci Ekle</span>
        </button>

        <button
          id="student-assign-groups-btn"
          onClick={() => {
            setIsGroupAssignmentModalOpen(true);
            setAssignSearchQuery("");
            if (systemClassrooms.length > 0) {
              setAssignClassroom(systemClassrooms[0].name);
            }
          }}
          className="hidden"
        >
          <span>Gruplara Atama</span>
        </button>

        <button id="student-statistics-counts-btn" onClick={() => openStatistics("counts")} className="hidden">
          Sınıf Öğrenci Sayıları
        </button>
        <button id="student-statistics-lists-btn" onClick={() => openStatistics("lists")} className="hidden">
          Öğrenci Listeleri
        </button>
      </div>

      {viewMode === "excel" && (
        <section id="student-excel-registration-card" className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Excel ile Öğrenci Kaydı</h2>
            <p className="mt-1 text-xs text-slate-500">Şablonu indirin, doldurduğunuz dosyayı yükleyin veya QR kod ile kayıt bağlantısını paylaşın.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <FileSpreadsheet className="mb-3 h-8 w-8 text-blue-600" />
              <h3 className="font-black text-slate-800">Excel Şablonu</h3>
              <p className="mt-1 flex-1 text-xs leading-5 text-slate-500">Gerekli öğrenci sütunlarını içeren hazır kayıt şablonunu indirin.</p>
              <button type="button" onClick={handleExcelTemplateDownload} className="mt-4 h-11 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700">Excel Şablonunu İndir</button>
            </div>
            <label className="flex cursor-pointer flex-col rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-5 hover:border-emerald-500">
              <UploadCloud className="mb-3 h-8 w-8 text-emerald-600" />
              <h3 className="font-black text-slate-800">Excel Yükleme Alanı</h3>
              <p className="mt-1 flex-1 text-xs leading-5 text-slate-500">Doldurulmuş `.xlsx` veya `.xls` dosyasını seçerek kayıtları veritabanına aktarın.</p>
              <span className="mt-4 flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white">Excel Dosyası Seç</span>
              <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
            </label>
            <div className="flex flex-col items-center rounded-2xl border border-violet-200 bg-violet-50 p-5 text-center">
              <QrCode className="mb-2 h-7 w-7 text-violet-600" />
              <h3 className="font-black text-slate-800">QR Kod ile Öğrenci Kaydı</h3>
              {qrRegistrationUrl ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrRegistrationUrl)}`} alt="Öğrenci Kayıt QR" className="my-3 h-40 w-40 rounded-xl border border-white bg-white p-2 shadow-sm" /> : <p className="my-3 text-xs text-slate-600">{qrRegistrationError || "Kayıt bağlantısı hazırlanıyor..."}</p>}
              <button type="button" disabled={!qrRegistrationUrl} onClick={() => { void navigator.clipboard.writeText(qrRegistrationUrl); setLinkCopied(true); window.setTimeout(() => setLinkCopied(false), 2000); }} className="h-11 w-full rounded-xl bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40">{linkCopied ? "Bağlantı Kopyalandı" : "Kayıt Bağlantısını Kopyala"}</button>
            </div>
          </div>
        </section>
      )}

      {/* Toplu Fotoğraf Yükleme Paneli */}
      {isBulkUploadOpen && (
        <div
          id="bulk-photo-panel"
          className="bg-gradient-to-br from-indigo-50/50 to-slate-55/50 border-2 border-dashed border-indigo-200 rounded-3xl p-6 shadow-xs space-y-6 animate-fadeIn"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-600" />
                <span>Akıllı Toplu Fotoğraf Eşleştirme Paneli</span>
              </h3>
              <p className="text-xs text-slate-500">
                JPG, JPEG veya PNG fotoğrafları seçin. Dosya adındaki okul numarası sistemdeki öğrenci numarasıyla tam eşleştirilir; sonuçları kontrol edip tek tıkla kaydedebilirsiniz.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {bulkUploadLogs.length > 0 && (
                <button
                  type="button"
                  onClick={saveBulkStudentPhotos}
                  disabled={!bulkUploadLogs.some((log) => log.status === "success")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Eşleşen Fotoğrafları Kaydet ({bulkUploadLogs.filter((log) => log.status === "success").length})
                </button>
              )}
              <button
              onClick={() => setIsBulkUploadOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full border border-slate-150 transition-colors shadow-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {bulkUploadLogs.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="text-[10px] font-bold uppercase text-slate-400">Seçilen</div><div className="text-xl font-black text-slate-900">{bulkUploadLogs.length}</div></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><div className="text-[10px] font-bold uppercase text-emerald-600">Eşleşen</div><div className="text-xl font-black text-emerald-700">{bulkUploadLogs.filter((log) => log.status === "success").length}</div></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"><div className="text-[10px] font-bold uppercase text-rose-600">Eşleşmeyen</div><div className="text-xl font-black text-rose-700">{bulkUploadLogs.filter((log) => log.status === "failed").length}</div></div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sol taraf: Drag & Drop Yükleme Alanı */}
            <div className="lg:col-span-1 bg-white border border-slate-200 p-5 rounded-2xl flex flex-col items-center justify-center text-center min-h-[200px] relative hover:border-indigo-400 transition-all group">
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                id="bulk-student-photos-input"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleBulkPhotoChange}
              />
              <div className="space-y-3 pointer-events-none flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">
                    Fotoğrafları Buraya Bırakın
                  </p>
                  <p className="text-[11px] text-slate-400">
                    veya tıklayarak dosya seçin
                  </p>
                </div>
                <div className="bg-slate-50 px-2 rounded-md py-1 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Örn. dosya adı:{" "}
                    <b className="text-slate-600 font-bold">
                      "201 Ahmet Yılmaz.jpg"
                    </b>
                  </span>
                </div>
              </div>
            </div>

            {/*  Sağ taraf: Otomatik Eşleşme Sonuç Günlüğü */}
            <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl flex flex-col max-h-[250px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  Eşleştirme Sonuç Listesi ({bulkUploadLogs.length} Dosya)
                </span>
                {bulkUploadLogs.length > 0 && (
                  <button
                    onClick={() => setBulkUploadLogs([])}
                    className="text-[10px] font-bold text-indigo-600 hover:underline transition-all cursor-pointer"
                  >
                    Günlüğü Temizle
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-1 space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                {bulkUploadLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 p-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl transition-colors"
                  >
                    <img
                      src={log.preview || undefined}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-semibold text-slate-700 truncate"
                        title={log.filename}
                      >
                        {log.filename}
                      </p>

                      {log.status === "success" ? (
                        <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                          <span>
                            Eşleşti: <b>{log.matchedNo}</b> - {log.matchedName}
                          </span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1 mt-0.5">
                          <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                          <span>{log.message}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {bulkUploadLogs.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                    <FileImage className="w-8 h-8 text-slate-300 stroke-1 mb-2" />
                    <p className="text-xs font-medium">
                      Henüz yüklenmiş öğrenci fotoğrafı bulunmuyor.
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Dosya ismindeki okul numaralarından otomatik öğrenci
                      eşleşmesi yapılır.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Öğrenci ana filtreleri */}
      <div className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <div className="grid w-full gap-3 lg:grid-cols-[190px_minmax(420px,1.25fr)_minmax(320px,0.85fr)] lg:items-end">
          <label>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Sınıf Seviyesi
            </span>
            <select
              value={selectedGradeLevels[0] ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedGradeLevels(value ? [Number(value)] : []);
                setSelectedClassroomBranches([]);
                setDirectoryStudents([]);
              }}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Sınıf seviyesi seçiniz</option>
              {availableGradeLevels.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}. Sınıf
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Sınıf Şubeleri
            </span>
            <div className="flex min-h-10 flex-wrap items-center gap-1.5">
              {selectedGradeLevels.length === 0 ? (
                <span className="text-[10px] font-semibold text-slate-400">
                  Önce sınıf seviyesi seçiniz.
                </span>
              ) : availableClassroomBranches.length === 0 ? (
                <span className="text-[10px] font-semibold text-slate-400">
                  Bu sınıf seviyesine ait şube bulunamadı.
                </span>
              ) : (
                availableClassroomBranches.map((classroom) => {
                  const checked = selectedClassroomBranches.includes(classroom);
                  return (
                    <label
                      key={classroom}
                      className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-black transition ${
                        checked
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedClassroomBranches((current) =>
                            checked
                              ? current.filter((item) => item !== classroom)
                              : [...current, classroom],
                          )
                        }
                        className="h-3.5 w-3.5 accent-emerald-600"
                      />
                      {classroom}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <label>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Öğrenci Ara
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="student-search-input"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Öğrenci no, ad veya soyad..."
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-16 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              {isDirectorySearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-indigo-600">
                  Aranıyor...
                </span>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Satır bazlı öğrenci kayıt tablosu */}
      <div id="student-table" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {formError && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">
            {formError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1170px] table-fixed border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                <th className="w-[50px] border-b border-slate-200 px-1.5 py-2 text-center">Sıra</th>
                <th className="w-[64px] border-b border-slate-200 px-1.5 py-2">Ö. No</th>
                <th className="w-[220px] border-b border-slate-200 px-1.5 py-2">Ad Soyad</th>
                <th className="w-[86px] border-b border-slate-200 px-1.5 py-2">Sınıf</th>
                <th className="w-[64px] border-b border-slate-200 px-1.5 py-2">Grup</th>
                <th className="w-[108px] border-b border-slate-200 px-1.5 py-2">Öğrenci Tel</th>
                <th className="w-[140px] border-b border-slate-200 px-1.5 py-2">Veli Adı</th>
                <th className="w-[108px] border-b border-slate-200 px-1.5 py-2">Veli Tel</th>
                
                <th className="w-[220px] border-b border-slate-200 px-1.5 py-2 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-2 border-violet-500 bg-yellow-300 whitespace-nowrap">
                <td className="px-1.5 py-1.5 text-center"><span className="text-[10px] font-black text-slate-400">+</span></td>
                <td className="px-1.5 py-1.5"><input value={newInlineDraft.id} onChange={(e) => setNewInlineDraft((p) => ({ ...p, id: e.target.value }))} className="h-8 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold" placeholder="No" /></td>
                <td className="px-1.5 py-1.5"><input value={newInlineDraft.name} onChange={(e) => setNewInlineDraft((p) => ({ ...p, name: e.target.value }))} className="h-8 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold" placeholder="Ad Soyad" /></td>
                <td className="px-1.5 py-1.5"><select value={newInlineDraft.classroom} onChange={(e) => setNewInlineDraft((p) => ({ ...p, classroom: e.target.value }))} className="h-8 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold"><option value="">Sınıf seç</option>{editableClassroomOptions.map((classroomName) => <option key={classroomName} value={classroomName}>{classroomName}</option>)}</select></td>
                <td className="px-1.5 py-1.5"><select value={newInlineDraft.group} onChange={(e) => setNewInlineDraft((p) => ({ ...p, group: e.target.value }))} className="h-8 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold"><option value="">—</option><option value="SAY">SAY</option><option value="EA">EA</option><option value="SÖZ">SÖZ</option><option value="DİL">DİL</option></select></td>
                <td className="px-1.5 py-1.5"><input value={newInlineDraft.phone} onChange={(e) => setNewInlineDraft((p) => ({ ...p, phone: e.target.value }))} className="h-8 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold" placeholder="Öğrenci tel" /></td>
                <td className="px-1.5 py-1.5"><input value={newInlineDraft.parentName} onChange={(e) => setNewInlineDraft((p) => ({ ...p, parentName: e.target.value }))} className="h-8 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold" placeholder="Veli adı" /></td>
                <td className="px-1.5 py-1.5"><input value={newInlineDraft.parentPhone} onChange={(e) => setNewInlineDraft((p) => ({ ...p, parentPhone: e.target.value }))} className="h-8 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold" placeholder="Veli tel" /></td>
                <td className="px-1.5 py-1.5"><div className="flex items-center justify-center gap-0.5 whitespace-nowrap"><button type="button" onClick={saveNewInlineStudent} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[9px] font-black text-white"><Check className="h-3.5 w-3.5" /> Kaydet</button><button type="button" disabled className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[9px] font-black text-slate-300"><Edit2 className="h-3.5 w-3.5" /> Düzenle</button><button type="button" disabled className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[9px] font-black text-slate-300"><Trash2 className="h-3.5 w-3.5" /> Sil</button></div></td>
              </tr>

              {filteredStudents.map((student, index) => {
                const editing = inlineEditingStudentId === student.id;
                const rowInput =
                  "h-8 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold text-slate-800 outline-none focus:border-indigo-400";

                return (
                  <tr key={student.id} className="border-b border-slate-100 bg-white whitespace-nowrap hover:bg-slate-50/60">
                    <td className="px-1.5 py-1.5 text-center">
                      <span className="text-[11px] font-black text-indigo-600">{index + 1}</span>
                    </td>
                    <td className="px-1.5 py-1.5">
                      {editing ? <input value={inlineDraft.id} onChange={(e) => setInlineDraft((p) => ({ ...p, id: e.target.value }))} className={rowInput} /> : <span className="whitespace-nowrap text-[11px] font-black text-slate-700">{student.id}</span>}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {editing ? <input value={inlineDraft.name} onChange={(e) => setInlineDraft((p) => ({ ...p, name: e.target.value }))} className={rowInput} /> : <span className="whitespace-nowrap text-[11px] font-black text-slate-900">{student.name}</span>}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {editing ? (
                        <select
                          value={inlineDraft.classroom}
                          onChange={(e) =>
                            setInlineDraft((p) => ({ ...p, classroom: e.target.value }))
                          }
                          className={rowInput}
                        >
                          <option value="">Sınıf seç</option>
                          {editableClassroomOptions.map((classroomName) => (
                            <option key={classroomName} value={classroomName}>
                              {classroomName}
                            </option>
                          ))}
                        </select>
                      ) : <span className="whitespace-nowrap text-[11px] font-bold text-slate-700">{student.classroom || "—"}</span>}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {editing ? (
                        <select value={inlineDraft.group} onChange={(e) => setInlineDraft((p) => ({ ...p, group: e.target.value }))} className={rowInput}>
                          <option value="">—</option><option value="SAY">SAY</option><option value="EA">EA</option><option value="SÖZ">SÖZ</option><option value="DİL">DİL</option>
                        </select>
                      ) : <span className="whitespace-nowrap text-[11px] font-bold text-slate-600">{resolveStudentGroup(student) || "—"}</span>}
                    </td>
                    <td className="px-1.5 py-1.5">{editing ? <input value={inlineDraft.phone} onChange={(e) => setInlineDraft((p) => ({ ...p, phone: e.target.value }))} className={rowInput} /> : <span className="whitespace-nowrap text-[11px] text-slate-600">{student.phone || "—"}</span>}</td>
                    <td className="px-1.5 py-1.5">{editing ? <input value={inlineDraft.parentName} onChange={(e) => setInlineDraft((p) => ({ ...p, parentName: e.target.value }))} className={rowInput} /> : <span className="whitespace-nowrap text-[11px] font-bold text-slate-700">{student.parentName || "—"}</span>}</td>
                    <td className="px-1.5 py-1.5">{editing ? <input value={inlineDraft.parentPhone} onChange={(e) => setInlineDraft((p) => ({ ...p, parentPhone: e.target.value }))} className={rowInput} /> : <span className="whitespace-nowrap text-[11px] text-slate-600">{student.parentPhone || "—"}</span>}</td>
                    <td className="px-1.5 py-1.5">
                      <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                        <button type="button" disabled={!editing} onClick={() => saveInlineStudentEdit(student)} className={`inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-[9px] font-black ${editing ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-300"}`}><Check className="h-3.5 w-3.5" /> Kaydet</button>
                        <button type="button" onClick={() => (editing ? cancelInlineStudentEdit() : beginInlineStudentEdit(student))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-[9px] font-black text-indigo-700"><Edit2 className="h-3.5 w-3.5" /> {editing ? "Vazgeç" : "Düzenle"}</button>
                        <button type="button" onClick={() => handleDelete(student.id)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[9px] font-black text-rose-700"><Trash2 className="h-3.5 w-3.5" /> Sil</button>
                      </div>
                    </td>
                  </tr>
                );
              })}


            </tbody>
          </table>
        </div>
      </div>

      {statisticsMode && (
        <div className="fixed inset-0 z-[130] flex bg-slate-950/70 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
            <header className="flex flex-col gap-4 border-b border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                  {statisticsMode === "counts" ? <BarChart3 className="h-6 w-6 text-indigo-600" /> : <List className="h-6 w-6 text-indigo-600" />}
                  {statisticsMode === "counts" ? "Sınıf Öğrenci Sayıları" : "Öğrenci Listeleri"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Sınıf düzeylerini seçerek rapor ön izlemesini güncelleyin.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={reportStudents.length === 0} onClick={() => { void createStatisticsPdf("print"); }} className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"><Printer className="h-4 w-4" /> Yazdır</button>
                <button disabled={reportStudents.length === 0} onClick={() => { void createStatisticsPdf("download"); }} className="flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-40"><FileDown className="h-4 w-4" /> PDF İndir</button>
                {statisticsMode === "lists" && <button disabled={reportStudents.length === 0 || selectedClassroomBranches.length === 0} onClick={downloadStudentListsExcel} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" /> Excel İndir</button>}
                <button onClick={() => setStatisticsMode(null)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800" aria-label="Kapat"><X className="h-5 w-5" /></button>
              </div>
            </header>

            <div className="border-b border-slate-200 bg-white px-5 py-4">
              {statisticsMode === "counts" ? <>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Sınıf düzeyleri</p>
                <div className="flex flex-wrap gap-2">
                  {availableGradeLevels.map((grade) => {
                    const checked = selectedGradeLevels.includes(grade);
                    return <label key={grade} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${checked ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500"}`}>
                      <input type="checkbox" checked={checked} onChange={() => setSelectedGradeLevels((current) => checked ? current.filter((item) => item !== grade) : [...current, grade].sort((a, b) => a - b))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                      {grade}. Sınıf
                    </label>;
                  })}
                </div>
              </> : <div className="space-y-4">
                <div className="grid w-full gap-3 lg:grid-cols-[190px_minmax(520px,1.4fr)_minmax(360px,0.9fr)] lg:items-end">
                  <label>
                    <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Sınıf düzeyi</span>
                    <select
                      value={selectedGradeLevels[0] ?? ""}
                      onChange={(event) => {
                        const grade = Number(event.target.value);
                        setSelectedGradeLevels([grade]);
                        setSelectedClassroomBranches([]);
                      }}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      {availableGradeLevels.map((grade) => (
                        <option key={grade} value={grade}>{grade}. Sınıf</option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Sınıf şubeleri</p>
                    <div className="flex min-h-11 flex-wrap items-center gap-2">
                      {availableClassroomBranches.map((classroom) => {
                        const checked = selectedClassroomBranches.includes(classroom);
                        return (
                          <label
                            key={classroom}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
                              checked
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-500"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedClassroomBranches((current) =>
                                  checked
                                    ? current.filter((item) => item !== classroom)
                                    : [...current, classroom],
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                            />
                            {classroom}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <label>
                    <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Öğrenci ara</span>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="student-search-input"
                        type="text"
                        placeholder="Okul no, ad veya soyad..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-16 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                      {isDirectorySearching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-indigo-600">Aranıyor...</span>
                      )}
                    </div>
                  </label>
                </div>
              </div>}
            </div>

            <main className="min-h-0 flex-1 overflow-auto p-5">
              {statisticsMode === "counts" && <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-indigo-600 p-4 text-white"><p className="text-xs font-bold text-indigo-100">Toplam Öğrenci</p><p className="mt-1 text-3xl font-black">{reportStudents.length}</p></div>
                {statisticsMode === "counts" && <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">Seçili Sınıf Düzeyi</p><p className="mt-1 text-3xl font-black text-slate-900">{selectedGradeLevels.length}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">Şube Sayısı</p><p className="mt-1 text-3xl font-black text-slate-900">{reportClassrooms.length}</p></div>
                </>}
              </div>}

              {statisticsMode === "counts" ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3">Sınıf</th><th className="px-4 py-3">Toplam</th><th className="px-4 py-3">SAY</th><th className="px-4 py-3">EA</th><th className="px-4 py-3">DİL</th><th className="px-4 py-3">SÖZ</th><th className="px-4 py-3">Kız</th><th className="px-4 py-3">Erkek</th><th className="px-4 py-3">Belirtilmemiş</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{reportClassrooms.map((row) => <tr key={row.classroom} className="hover:bg-slate-50"><td className="px-4 py-3 font-black text-slate-800">{row.classroom}</td><td className="px-4 py-3 font-black text-indigo-700">{row.total}</td><td className="px-4 py-3">{row.groups.SAY}</td><td className="px-4 py-3">{row.groups.EA}</td><td className="px-4 py-3">{row.groups["DİL"]}</td><td className="px-4 py-3">{row.groups["SÖZ"]}</td><td className="px-4 py-3">{row.genders["Kız"]}</td><td className="px-4 py-3">{row.genders["Erkek"]}</td><td className="px-4 py-3">{row.genders["Belirtilmemiş"]}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="min-w-[680px] table-fixed text-left text-xs">
                    <thead className="bg-slate-900 text-white"><tr>
                      <th className="w-24 px-2 py-2.5">Sınıf-Şube</th>
                      <th className="w-24 px-2 py-2.5">Öğrenci No</th>
                      <th className="w-56 px-2 py-2.5">Öğrenci Ad Soyad</th>
                      {listOptionalColumns.includes("group") && <th className="w-16 px-2 py-2.5">Grup</th>}
                      {listOptionalColumns.includes("phone") && <th className="w-32 px-2 py-2.5">Öğrenci Tel</th>}
                      {listOptionalColumns.includes("parentName") && <th className="w-44 px-2 py-2.5">Veli Adı</th>}
                      {listOptionalColumns.includes("parentPhone") && <th className="w-32 px-2 py-2.5">Veli Telefon</th>}
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">{sortedReportStudents.map((student) => <tr key={student.id} className="hover:bg-slate-50">
                      <td className="truncate px-2 py-2 font-bold">{student.classroom}</td>
                      <td className="truncate px-2 py-2 font-mono">{student.id}</td>
                      <td className="truncate px-2 py-2 font-bold text-slate-800">{student.name}</td>
                      {listOptionalColumns.includes("group") && <td className="truncate px-2 py-2">{resolveStudentGroup(student) || "-"}</td>}
                      {listOptionalColumns.includes("phone") && <td className="truncate px-2 py-2">{student.phone || "-"}</td>}
                      {listOptionalColumns.includes("parentName") && <td className="truncate px-2 py-2">{student.parentName || "-"}</td>}
                      {listOptionalColumns.includes("parentPhone") && <td className="truncate px-2 py-2">{student.parentPhone || "-"}</td>}
                    </tr>)}</tbody>
                  </table>
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {/* Slide-in Beautiful modal or card Dialog for Adding or Editing student */}
      {isModalOpen && (
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
                      Veli Ad Soyad
                    </label>
                    <input
                      type="text"
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
      )}

      {/* --- ÖĞRENCİ ÖZ-KAYIT QR KODU MODAL --- */}
      {isQrModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsQrModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 shadow-2xl relative space-y-5 animate-scaleUp">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  <span>Kendi Kendine Kayıt QR Kodu</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Hızlı Öğrenci Başvuru Sistemi
                </p>
              </div>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 px-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg border border-slate-200 cursor-pointer text-xs"
              >
                Kapat
              </button>
            </div>

            {/* Explanations */}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Aşağıdaki <strong className="text-slate-800">QR KODU</strong>{" "}
              öğrencilerinize veya velilerinize okutarak, cep telefonlarından
              hızlıca kendi kayıt formunu doldurmalarını sağlayabilirsiniz.
            </p>

            {/* QR Frame Component */}
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-150 rounded-2xl p-6 space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-lg relative shrink-0">
                <img
                  src={
                    qrRegistrationUrl
                      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrRegistrationUrl)}`
                      : undefined
                  }
                  alt="Öğrenci Kayıt QR"
                  className="w-44 h-44 object-contain"
                />
                <div className="absolute inset-x-0 -bottom-2 flex justify-center">
                  <span className="bg-emerald-500 text-white font-extrabold text-[8px] px-2.5 py-1 rounded-full border border-white shadow-xs uppercase tracking-widest animate-pulse">
                    TARATINIZ
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-extrabold text-center font-mono">
                {qrRegistrationUrl || "Yerel ağ bağlantısı hazırlanıyor..."}
              </p>
            </div>

            {/* Input URL Copy Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Açık Kayıt Bağlantısı (Link)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={qrRegistrationUrl}
                  className="bg-slate-50 border border-slate-200 text-slate-600 font-semibold font-mono text-[10px] px-3 py-2.5 rounded-xl flex-1 focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (!qrRegistrationUrl) return;
                    navigator.clipboard.writeText(qrRegistrationUrl);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="bg-slate-900 text-white font-semibold text-[11px] p-2.5 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Kopyalandı</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopyala</span>
                    </>
                  )}
                </button>
              </div>
            </div>


            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              {qrRegistrationError ? (
                <p className="text-[10px] font-bold leading-5 text-rose-600">
                  {qrRegistrationError}
                </p>
              ) : qrRegistrationUrl ? (
                <p className="text-[10px] font-bold leading-5 text-emerald-700">
                  Telefon ve bilgisayar aynı Wi-Fi / yerel ağdaysa bu QR doğrudan açılır.
                  {qrNetworkHost ? ` Ağ adresi: ${qrNetworkHost}` : ""}
                </p>
              ) : (
                <p className="text-[10px] font-bold text-slate-500">
                  Telefon için yerel ağ bağlantısı hazırlanıyor...
                </p>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
              <button type="button" onClick={printQrA5} disabled={!qrRegistrationUrl} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40">
                <Printer className="w-3.5 h-3.5" /><span>A5 Yazdır</span>
              </button>
              <a
                href={qrRegistrationUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Formu Yeni Sekmede Aç</span>
              </a>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold justify-center text-slate-800 text-xl mb-2">
              Öğrenci Kaydını Sil?
            </h3>
            <p className="text-slate-500 font-medium text-sm mb-8">
              Bu öğrenci kaydı kalıcı olarak silinecektir ve geri alınamaz. Onaylıyor musunuz?
            </p>
            {studentDeleteError && (
              <div className="mb-4 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-left text-xs font-bold text-rose-700">
                {studentDeleteError}
              </div>
            )}
            <div className="flex w-full gap-3">
              <button
                onClick={() => setStudentToDelete(null)}
                disabled={isDeletingStudents}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                onClick={() => void confirmSingleDelete()}
                disabled={isDeletingStudents}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm shadow-red-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingStudents ? "Siliniyor..." : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Çoklu Öğrenci Silme Onay Penceresi */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col items-center rounded-3xl bg-white p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500">
              <Trash2 className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-xl font-extrabold text-slate-800">
              Seçili Öğrencileri Sil?
            </h3>
            <p className="mb-2 text-sm font-medium text-slate-500">
              <strong className="text-rose-600">{selectedStudentIds.length}</strong> öğrenci kaydı kalıcı olarak silinecektir.
            </p>
            <p className="mb-8 text-xs text-slate-400">
              Bu işlem geri alınamaz. Devam etmek istediğinizden emin misiniz?
            </p>
            {studentDeleteError && (
              <div className="mb-4 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-left text-xs font-bold text-rose-700">
                {studentDeleteError}
              </div>
            )}
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                disabled={isDeletingStudents}
                className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void confirmBulkDelete()}
                disabled={isDeletingStudents}
                className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white shadow-sm shadow-red-200 transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingStudents ? "Siliniyor..." : `${selectedStudentIds.length} Öğrenciyi Sil`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GRUPLARA ÖĞRENCİ ATAMA MODALI --- */}
      {isGroupAssignmentModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsGroupAssignmentModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-[32px] border border-slate-100 max-w-2xl w-full p-6 md:p-8 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden space-y-6 animate-scaleUp">
            {/* Close button */}
            <button
              onClick={() => setIsGroupAssignmentModalOpen(false)}
              className="absolute top-6 right-6 p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="space-y-1 shrink-0">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2.5">
                <Users className="w-6 h-6 text-violet-600 animate-pulse" />
                <span>Gruplara Öğrenci Atama</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Sınıf şubesi ve grup seçerek öğrencileri hızlıca gruplara dahil edin veya çıkarın.
              </p>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin">
              {/* Step 1: Selection Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shrink-0">
                {/* Class branch selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Sınıf Şubesi Seçin
                  </label>
                  <select
                    value={activeAssignClassroom}
                    onChange={(e) => setAssignClassroom(e.target.value)}
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-100 focus:outline-none cursor-pointer shadow-xs"
                  >
                    {Array.from(new Set([
                      ...systemClassrooms.map(c => c.name),
                      ...students.map(s => s.classroom)
                    ])).filter(Boolean).sort((a, b) => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" })).map((cls) => (
                      <option key={cls} value={cls}>
                        {cls} Sınıfı
                      </option>
                    ))}
                  </select>
                </div>

                {/* Group selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Sınıf İçi Grup Seçin
                  </label>
                  <div className="flex flex-col gap-2">
                    <select
                      value={assignGroup}
                      onChange={(e) => {
                        setAssignGroup(e.target.value);
                        if (e.target.value !== "Özel") {
                          setAssignCustomGroup("");
                        }
                      }}
                      className="w-full h-11 px-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-100 focus:outline-none cursor-pointer shadow-xs"
                    >
                      {availableGroups.length > 0 ? (
                        availableGroups.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))
                      ) : (
                        <option value="">(Grup Tanımlanmamış)</option>
                      )}
                      <option value="Özel">Özel Grup Adı Tanımla...</option>
                    </select>

                    {assignGroup === "Özel" && (
                      <input
                        type="text"
                        value={assignCustomGroup}
                        onChange={(e) => setAssignCustomGroup(e.target.value)}
                        placeholder="Örn: Dil Sınıfı, A Grubu vb..."
                        className="w-full h-10 px-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold transition-all focus:ring-2 focus:ring-indigo-100 focus:outline-none animate-fadeIn shadow-xs"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: Student Search & Add */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Öğrenci Bul ve Gruba Ekle
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={assignSearchQuery}
                      onChange={(e) => setAssignSearchQuery(e.target.value)}
                      placeholder="Eklenecek öğrencinin adı, soyadı veya okul numarası..."
                      className="w-full h-11 pl-10 pr-4 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-medium transition-all focus:ring-2 focus:ring-indigo-100 focus:outline-none shadow-xs"
                    />
                  </div>
                </div>

                {/* Searched Results List */}
                {assignSearchQuery.trim() !== "" && (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 p-2 space-y-2 animate-fadeIn max-h-52 overflow-y-auto scrollbar-thin">
                    <div className="px-2 pt-1 pb-1 flex justify-between items-center shrink-0">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Arama Sonuçları ({searchedStudentsForAssignment.length})
                      </span>
                    </div>
                    {searchedStudentsForAssignment.length > 0 ? (
                      <div className="divide-y divide-slate-100 bg-white border border-slate-100 rounded-xl overflow-hidden">
                        {searchedStudentsForAssignment.map((student) => {
                          const isInSelectedGroup = student.classroom === activeAssignClassroom && student.group === activeAssignGroup;
                          return (
                            <div
                              key={student.id}
                              className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/80 transition-colors"
                            >
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-slate-800">
                                  {student.name}
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                                    No: {student.id}
                                  </span>
                                  <span>•</span>
                                  <span>{student.classroom || "Sınıfsız"}</span>
                                  {student.group && (
                                    <>
                                      <span>•</span>
                                      <span className="text-violet-600">{student.group}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => addStudentToSelectedGroup(student.id)}
                                disabled={isInSelectedGroup}
                                className={`h-8 px-3 rounded-xl text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                                  isInSelectedGroup
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                                }`}
                              >
                                {isInSelectedGroup ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Grupta</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Gruba Ekle</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic text-center py-4">
                        Öğrenci bulunamadı.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Step 3: Current Members of the Group */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Gruptaki Öğrenci Listesi ({currentGroupMembers.length})
                  </span>
                  <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full uppercase">
                    {activeAssignClassroom} • {activeAssignGroup || "Grup Yok"}
                  </span>
                </div>

                {currentGroupMembers.length > 0 ? (
                  <div className="border border-slate-150/60 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto scrollbar-thin shadow-xs">
                    {currentGroupMembers.map((student) => (
                      <div
                        key={student.id}
                        className="p-3 bg-white hover:bg-slate-50/50 flex items-center justify-between text-xs transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold font-mono">
                            {student.avatar ? (
                              <img src={student.avatar} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              student.name.charAt(0)
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-extrabold text-slate-800">{student.name}</span>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Okul No: {student.id}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => removeStudentFromSelectedGroup(student.id)}
                          className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors cursor-pointer"
                          title="Gruptan Çıkar"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 text-center">
                    <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
                      Seçilen <strong className="text-slate-600">{activeAssignClassroom}</strong> sınıfı{" "}
                      <strong className="text-slate-600">{activeAssignGroup || "Grupsuz"}</strong> grubunda şu an kayıtlı öğrenci bulunmuyor. Yukarıdaki arama kutusunu kullanarak bu gruba öğrenci dahil edebilirsiniz.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                onClick={() => setIsGroupAssignmentModalOpen(false)}
                className="h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Tamamla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
