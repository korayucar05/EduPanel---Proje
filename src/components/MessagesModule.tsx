import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, FileText, Image, MessageCircle, Search, Send, ShieldCheck, Trash2, Upload, Users, X, Wand2 } from "lucide-react";
import {
  appendMhatsappLog,
  fileToBase64,
  isValidMhatsappNumber,
  loadMhatsappSettings,
  MhatsappSettings,
  normalizeMhatsappNumber,
  sendMediaMessage,
  sendTextMessage,
} from "../lib/mhatsappApi";
import { createMessageEvidence, loadMessageEvidence, messageEvidenceStatus, MessageEvidenceRecord, updateMessageEvidenceProvider } from "../lib/messageEvidence";
import { useMessageDirectory } from "../hooks/useMessageDirectory";
import { useMessageStore } from "../stores/messageStore";
import type { Recipient, RecipientGroup, SendMode, SmartFileMatch } from "../types/message";
import { SendResultBox } from "./messages/SendResultBox";
import { fetchCollectionFromLocalDatabase } from "../lib/localDatabase";

const parentPhoneKeys = [
  "parentPhone", "guardianPhone", "veliTelefon", "veliTelefonu", "parentPhoneNumber", "motherPhone", "fatherPhone", "anneTelefon", "babaTelefon", "phoneParent", "guardian_phone", "veliCep", "veliCepTelefonu", "parent_mobile"
];
const studentPhoneKeys = ["phone", "studentPhone", "telefon", "cepTelefonu", "mobile", "phoneNumber", "studentPhoneNumber", "ogrenciTelefon", "öğrenciTelefon"];
const teacherPhoneKeys = ["phone", "teacherPhone", "telefon", "cepTelefonu", "mobile", "phoneNumber", "gsm", "cellPhone"];
const studentNoKeys = [
  "studentNo", "studentNumber", "schoolNumber", "schoolNo", "number", "no", "ogrenciNo", "öğrenciNo", "okulNo", "student_id", "studentId", "numara", "oob", "tcNo"
];

const normalizeText = (value: any) =>
  String(value || "")
    .toLocaleUpperCase("tr-TR")
    .replace(/[İI]/g, "I")
    .replace(/Ä/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Å/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCompact = (value: any) => normalizeText(value).replace(/\s+/g, "");

const readAnyPhone = (obj: any, keys: string[]) => {
  for (const key of keys) {
    const val = obj?.[key];
    if (val !== undefined && val !== null && String(val).trim()) return String(val).trim();
  }
  return "";
};

const readAnyValue = (obj: any, keys: string[]) => {
  for (const key of keys) {
    const val = obj?.[key];
    if (val !== undefined && val !== null && String(val).trim()) return String(val).trim();
  }
  return "";
};

const getStudentName = (s: any) => {
  const full = [
    s?.firstName || s?.name || s?.studentName || s?.ad || s?.adi || s?.ogrenciAdi || s?.["öğrenciAdi"],
    s?.lastName || s?.surname || s?.soyad || s?.soyadi || s?.ogrenciSoyadi || s?.["öğrenciSoyadi"],
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || s?.fullName || s?.adSoyad || s?.ogrenciAdSoyad || s?.studentFullName || "Öğrenci";
};

const getStudentNo = (s: any) => {
  const direct = readAnyValue(s, studentNoKeys);
  if (direct) return direct;

  const nestedSources = [
    s?.student,
    s?.profile,
    s?.identity,
    s?.registration,
    s?.personalInfo,
    s?.studentInfo,
    s?.data,
  ].filter(Boolean);
  for (const source of nestedSources) {
    const nested = readAnyValue(source, studentNoKeys);
    if (nested) return nested;
  }

  const numericId = String(s?.id || s?.recordId || "").trim();
  return /^\d{1,12}$/.test(numericId) ? numericId : "";
};
const getStudentClassName = (s: any) => s?.classroom || s?.className || s?.sinif || s?.["sınıf"] || s?.class || "";
const getParentName = (s: any) => {
  const parent = [s?.parentName || s?.guardianName || s?.veliAdi || s?.veliAdSoyad, s?.parentSurname || s?.veliSoyadi]
    .filter(Boolean)
    .join(" ")
    .trim();
  return parent || `Velisi: ${getStudentName(s)}`;
};

function recipientKey(recipient: Partial<Recipient> | null | undefined) {
  const normalized = String(recipient?.normalized || "").trim();
  if (normalized) return normalized;
  const id = String(recipient?.id || "").trim();
  return id;
}

function cleanRecipients(list: any[]): Recipient[] {
  const seen = new Set<string>();
  const result: Recipient[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw) continue;
    const normalized = normalizeMhatsappNumber(raw.normalized || raw.number || "");
    if (!normalized || !isValidMhatsappNumber(normalized)) continue;
    const safe: Recipient = {
      id: String(raw.id || normalized),
      name: String(raw.name || raw.studentName || "İsimsiz Kayıt"),
      className: raw.className ? String(raw.className) : "",
      role: raw.role === "Öğrenci" || raw.role === "Öğretmen" || raw.role === "Manuel" ? raw.role : "Veli",
      number: String(raw.number || normalized),
      normalized,
      studentNo: raw.studentNo ? String(raw.studentNo) : "",
      studentName: raw.studentName ? String(raw.studentName) : "",
      source: raw.source,
    };
    const key = recipientKey(safe);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(safe);
  }
  return result;
}

type MessagesModuleProps = {
  mobile?: boolean;
  settingsRefresh?: number;
  studentsOverride?: any[];
  teachersOverride?: any[];
  classroomsOverride?: any[];
  scopeConfigured?: boolean;
  scopeReason?: string;
  canSendMessages?: boolean;
};

export default function MessagesModule({
  mobile = false,
  settingsRefresh = 0,
  studentsOverride,
  teachersOverride,
  classroomsOverride,
  scopeConfigured = true,
  scopeReason,
  canSendMessages = true,
}: MessagesModuleProps) {
  const [settings, setSettings] = useState<MhatsappSettings>(() => loadMhatsappSettings());
  const messageDirectory = useMessageDirectory();

  const students = studentsOverride ?? messageDirectory.students;
  const teachers = teachersOverride ?? messageDirectory.teachers;
  const classrooms = classroomsOverride ?? messageDirectory.classrooms;
  const {
    recipientGroup, selectedClass, manualNumbers, selectedRecipients, recipientSearch, selectedSearch,
    sendMode, message, smartFileMatches, fileMatchInfo, setRecipientGroup, setSelectedClass,
    setManualNumbers, setSelectedRecipients, setRecipientSearch, setSelectedSearch, setSendMode,
    setMessage, setSmartFileMatches, setFileMatchInfo,
  } = useMessageStore();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [mobileStep, setMobileStep] = useState<"recipients" | "compose" | "selected">("recipients");
  const [evidenceEnabled, setEvidenceEnabled] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceRecords, setEvidenceRecords] = useState<MessageEvidenceRecord[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [trialClubRegistrations, setTrialClubRegistrations] = useState<any[]>([]);
  const [trialClubError, setTrialClubError] = useState("");

  useEffect(() => {
    if (recipientGroup !== "trial-club") return;
    let active = true;
    setTrialClubError("");
    void fetchCollectionFromLocalDatabase("trial_club_registrations")
      .then((rows) => { if (active) setTrialClubRegistrations(Array.isArray(rows) ? rows.filter((row) => row?.active !== false) : []); })
      .catch(() => { if (active) { setTrialClubRegistrations([]); setTrialClubError("Deneme Kulübü kayıtları okunamadı."); } });
    return () => { active = false; };
  }, [recipientGroup]);


  const refreshEvidenceRecords = async () => {
    setEvidenceLoading(true);
    try {
      setEvidenceRecords(await loadMessageEvidence());
    } catch (error: any) {
      setResult((current: any) => current || { ok: false, error: error?.message || "Mesaj kanıt kayıtları alınamadı." });
    } finally {
      setEvidenceLoading(false);
    }
  };

  // Kanıt kaydı sistem içinde tutulur; alıcıya doğrulama bağlantısı eklenmez.
  const evidenceMessageFor = (baseMessage: string, _proofUrl: string) =>
    String(baseMessage || "").trim();

  const createEvidenceForRecipient = async (
    recipient: Recipient,
    bodyMessage: string,
    messageType: string,
    attachmentName?: string,
  ) => createMessageEvidence({
    recipientName: recipient.name,
    recipientPhone: recipient.normalized,
    recipientRole: recipient.role,
    studentName: recipient.studentName,
    studentNo: recipient.studentNo,
    className: recipient.className,
    source: "Mesaj Gönder",
    messageType,
    message: bodyMessage || (attachmentName ? `${attachmentName} dosyası gönderildi.` : "Okul bilgilendirmesi"),
    attachmentName,
    validDays: 180,
  });

  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      const msg = String(event?.message || event?.error?.message || "");
      if (msg.includes("removeChild") || msg.includes("The node to be removed is not a child")) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    };
    window.addEventListener("error", handler, true);
    return () => window.removeEventListener("error", handler, true);
  }, []);

  useEffect(() => {
    setSettings(loadMhatsappSettings());
  }, [settingsRefresh]);

  const classes = useMemo(() => {
    const fromClassrooms = classrooms.map((c) => c?.name).filter(Boolean);
    const fromStudents = students.map(getStudentClassName).filter(Boolean);
    return Array.from(new Set([...fromClassrooms, ...fromStudents])).sort((a, b) => String(a).localeCompare(String(b), "tr", { numeric: true }));
  }, [classrooms, students]);

  const makeRecipient = (student: any, role: "Veli" | "Öğrenci", idx = 0): Recipient | null => {
    const number = role === "Veli" ? readAnyPhone(student, parentPhoneKeys) : readAnyPhone(student, studentPhoneKeys);
    const normalized = normalizeMhatsappNumber(number);
    if (!isValidMhatsappNumber(normalized)) return null;
    const studentNo = getStudentNo(student);
    const studentName = getStudentName(student);
    return {
      id: `${role === "Veli" ? "parent" : "student"}-${student?.id || studentNo || normalized || idx}`,
      name: role === "Veli" ? getParentName(student) : studentName,
      className: getStudentClassName(student),
      role,
      number,
      normalized,
      studentNo,
      studentName,
      source: student,
    };
  };

  const makeTeacherRecipient = (teacher: any, idx = 0): Recipient | null => {
    const number = readAnyPhone(teacher, teacherPhoneKeys);
    const normalized = normalizeMhatsappNumber(number);
    if (!isValidMhatsappNumber(normalized)) return null;
    const name = String(teacher?.name || teacher?.fullName || teacher?.adSoyad || "Öğretmen").trim();
    return {
      id: `teacher-${teacher?.id || normalized || idx}`,
      name,
      className: String(teacher?.branch || teacher?.branş || ""),
      role: "Öğretmen",
      number,
      normalized,
      source: teacher,
    };
  };

  const buildRecipients = (): Recipient[] => {
    let list: Recipient[] = [];
    const inClass = (s: any) => !selectedClass || normalizeCompact(getStudentClassName(s)) === normalizeCompact(selectedClass);

    if (recipientGroup === "parents" && selectedClass) {
      list = students
        .filter(inClass)
        .map((s, idx) => makeRecipient(s, "Veli", idx))
        .filter(Boolean) as Recipient[];
    }

    if (recipientGroup === "students") {
      list = students
        .filter((student) => !selectedClass || inClass(student))
        .map((s, idx) => makeRecipient(s, "Öğrenci", idx))
        .filter(Boolean) as Recipient[];
    }

    if (recipientGroup === "trial-club" && selectedClass) {
      const registeredNumbers = new Set(
        trialClubRegistrations
          .filter((row) => String(row.gradeLevel || row.classroom || "").match(/(?:^|\D)(9|10|11)(?:\D|$)/)?.[1] === selectedClass)
          .map((row) => String(row.studentNumber || "").trim().replace(/^0+(?=\d)/, ""))
          .filter(Boolean),
      );
      const registeredIds = new Set(trialClubRegistrations
        .filter((row) => String(row.gradeLevel || row.classroom || "").match(/(?:^|\D)(9|10|11)(?:\D|$)/)?.[1] === selectedClass)
        .map((row) => String(row.studentId || "")));
      list = students
        .filter((student) => registeredIds.has(String(student.id || "")) || registeredNumbers.has(getStudentNo(student).trim().replace(/^0+(?=\d)/, "")))
        .map((student, idx) => makeRecipient(student, "Öğrenci", idx))
        .filter(Boolean) as Recipient[];
    }

    if (recipientGroup === "teachers") {
      list = teachers
        .map((teacher, idx) => makeTeacherRecipient(teacher, idx))
        .filter(Boolean) as Recipient[];
    }

    if (recipientGroup === "manual") {
      list = manualNumbers
        .split(/[\n,;]+/)
        .map((n) => String(n || "").trim())
        .filter(Boolean)
        .map((n, idx) => ({ id: `manual-${idx}-${normalizeMhatsappNumber(n)}`, name: `Manuel Alıcı ${idx + 1}`, role: "Manuel" as const, number: n, normalized: normalizeMhatsappNumber(n) }));
    }

    const cleaned = cleanRecipients(list);
    if (recipientGroup === "students" || recipientGroup === "parents" || recipientGroup === "trial-club") {
      return cleaned.sort((first, second) => {
        const firstNo = Number(String(first.studentNo || "").replace(/\D/g, ""));
        const secondNo = Number(String(second.studentNo || "").replace(/\D/g, ""));
        if (firstNo && secondNo && firstNo !== secondNo) return firstNo - secondNo;
        if (firstNo && !secondNo) return -1;
        if (!firstNo && secondNo) return 1;
        return first.name.localeCompare(second.name, "tr");
      });
    }
    return cleaned;
  };

  const previewRecipientsRaw = useMemo(() => buildRecipients(), [recipientGroup, selectedClass, manualNumbers, students, teachers, classrooms, trialClubRegistrations]);
  const previewRecipients = useMemo(() => {
    const rawQuery = recipientSearch.trim();
    if (!rawQuery) return previewRecipientsRaw;

    const textQuery = normalizeText(rawQuery);
    const compactQuery = normalizeCompact(rawQuery);
    const digitQuery = rawQuery.replace(/\D/g, "");
    const isNumericSearch = /^\s*\d+\s*$/.test(rawQuery);

    return previewRecipientsRaw.filter((recipient) => {
      const source = recipient.source || {};
      const sourceStudentNo = getStudentNo(source);
      const studentNo = String(recipient.studentNo || sourceStudentNo || "");
      if (isNumericSearch && digitQuery) {
        const studentNumberDigits = studentNo.replace(/\D/g, "");
        return Boolean(studentNumberDigits && studentNumberDigits.includes(digitQuery));
      }

      const searchableText = normalizeText([
        recipient.name,
        recipient.studentName,
        recipient.className,
        recipient.role,
        (source as any)?.name,
        (source as any)?.firstName,
        (source as any)?.lastName,
        (source as any)?.fullName,
        (source as any)?.branch,
        sourceStudentNo,
      ].filter(Boolean).join(" "));

      return searchableText.includes(textQuery) || normalizeCompact(searchableText).includes(compactQuery);
    });
  }, [previewRecipientsRaw, recipientSearch]);

  const safeSelectedRecipients = useMemo(() => cleanRecipients(selectedRecipients), [selectedRecipients]);
  const filteredSelected = useMemo(() => {
    const q = selectedSearch.toLocaleLowerCase("tr-TR").trim();
    if (!q) return safeSelectedRecipients;
    return safeSelectedRecipients.filter((r) => `${r.name} ${r.studentName || ""} ${r.className || ""} ${r.normalized} ${r.studentNo || ""}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [safeSelectedRecipients, selectedSearch]);

  const addRecipients = (items: Recipient[] = previewRecipients) => setSelectedRecipients((prev) => cleanRecipients([...prev, ...items]));
  const toggleOneRecipient = (recipient: Recipient) => {
    const key = recipientKey(recipient);
    setSelectedRecipients((prev) => {
      const cleaned = cleanRecipients(prev);
      const exists = cleaned.some((r) => recipientKey(r) === key);
      if (exists) return cleaned.filter((r) => recipientKey(r) !== key);
      return cleanRecipients([...cleaned, recipient]);
    });
  };
  const isRecipientSelected = (recipient: Recipient) => safeSelectedRecipients.some((r) => recipientKey(r) === recipientKey(recipient));
  const clearRecipients = () => {
    setSelectedRecipients([]);
    setSelectedSearch("");
  };
  const removeRecipient = (key?: string) => {
    if (!key) return;
    setSelectedRecipients((prev) => cleanRecipients(prev).filter((r) => recipientKey(r) !== key));
  };

  const getTeacherName = (teacher: any) =>
    String(teacher?.name || teacher?.fullName || teacher?.adSoyad || teacher?.teacherName || teacher?.ad || "").trim();

  const findRecipientsFromFileName = (selectedFile: File): Recipient[] => {
    const baseName = selectedFile.name.replace(/\.[^.]+$/, "");
    const fileText = normalizeText(baseName);
    const fileCompact = normalizeCompact(baseName);
    const digits = baseName.replace(/\D/g, "");

    if (recipientGroup === "teachers") {
      const matches = teachers.filter((teacher) => {
        const teacherName = getTeacherName(teacher);
        const nameCompact = normalizeCompact(teacherName);
        const nameText = normalizeText(teacherName);
        const nameHit = nameCompact.length >= 4 && (fileCompact.includes(nameCompact) || nameCompact.includes(fileCompact));
        const words = nameText.split(" ").filter((w) => w.length >= 3);
        const wordHit = words.length >= 2 && words.every((w) => fileText.includes(w));
        return Boolean(nameHit || wordHit);
      });
      return cleanRecipients(matches.map((teacher, idx) => makeTeacherRecipient(teacher, idx)).filter(Boolean) as Recipient[]);
    }

    const wantsStudent = recipientGroup === "students";
    const targetRole: "Veli" | "Öğrenci" = wantsStudent ? "Öğrenci" : "Veli";
    const matches = students.filter((student) => {
      const studentNo = getStudentNo(student);
      const studentName = getStudentName(student);
      const nameCompact = normalizeCompact(studentName);
      const nameText = normalizeText(studentName);
      const noHit = studentNo && digits && digits.includes(String(studentNo));
      const nameHit = nameCompact.length >= 5 && (fileCompact.includes(nameCompact) || nameCompact.includes(fileCompact));
      const wordHit = nameText.split(" ").filter((w) => w.length >= 3).every((w) => fileText.includes(w));
      return Boolean(noHit || nameHit || wordHit);
    });
    return cleanRecipients(matches.map((student, idx) => makeRecipient(student, targetRole, idx)).filter(Boolean) as Recipient[]);
  };

  const matchSmartFile = (selectedFile: File, index: number): SmartFileMatch => {
    const baseName = selectedFile.name.replace(/\.[^.]+$/, "");
    const numberParts = baseName.match(/\d+/g) || [];
    const compactName = normalizeCompact(baseName);
    const fileText = normalizeText(baseName);
    const id = `smart-${Date.now()}-${index}-${selectedFile.name}`;
    if (selectedFile.size > 20 * 1024 * 1024) {
      return { id, file: selectedFile, student: null, recipient: null, status: "too-large", detail: "Dosya 20 MB sınırını aşıyor." };
    }

    // Akıllı çoklu dosya seçiminde ayrıca alıcı grubu seçilmez.
    // Dosya adı hem öğrenci hem öğretmen kayıtlarında aranır ve tek, kesin eşleşme otomatik alıcıya dönüştürülür.
    const teacherCandidates = teachers.filter((teacher) => {
      const teacherName = getTeacherName(teacher);
      const nameCompact = normalizeCompact(teacherName);
      const nameText = normalizeText(teacherName);
      const nameHit = nameCompact.length >= 4 && (compactName.includes(nameCompact) || nameCompact.includes(compactName));
      const words = nameText.split(" ").filter((w) => w.length >= 3);
      const wordHit = words.length >= 2 && words.every((w) => fileText.includes(w));
      return Boolean(nameHit || wordHit);
    });

    const numberMatches = students.filter((student) => {
      const studentNo = String(getStudentNo(student)).replace(/\D/g, "");
      return Boolean(studentNo && numberParts.some((part) => part === studentNo));
    });
    let studentCandidates = numberMatches;
    let matchType = "okul numarası";
    if (studentCandidates.length === 0) {
      studentCandidates = students.filter((student) => {
        const studentName = normalizeCompact(getStudentName(student));
        return studentName.length >= 4 && (compactName.includes(studentName) || studentName.includes(compactName));
      });
      matchType = "ad soyad";
    }

    const totalCandidates = teacherCandidates.length + studentCandidates.length;
    if (totalCandidates === 0) {
      return { id, file: selectedFile, student: null, recipient: null, status: "unmatched", detail: "Dosya adında öğrenci numarası/adı soyadı veya öğretmen adı soyadı bulunamadı." };
    }
    if (totalCandidates > 1) {
      return { id, file: selectedFile, student: null, recipient: null, status: "ambiguous", detail: `${totalCandidates} kayıtla eşleşti; dosya adını daha belirgin yapın.` };
    }

    if (teacherCandidates.length === 1) {
      const teacher = teacherCandidates[0];
      const recipient = makeTeacherRecipient(teacher, index);
      if (!recipient) {
        return { id, file: selectedFile, student: teacher, recipient: null, status: "no-phone", detail: `${getTeacherName(teacher)} eşleşti ancak öğretmen telefonu geçersiz veya eksik.` };
      }
      return { id, file: selectedFile, student: teacher, recipient, status: "matched", detail: "öğretmen adı soyadı ile eşleşti." };
    }

    const student = studentCandidates[0];
    const recipient = makeRecipient(student, "Öğrenci", index);
    if (!recipient) {
      return { id, file: selectedFile, student, recipient: null, status: "no-phone", detail: `${getStudentName(student)} eşleşti ancak öğrenci telefonu geçersiz veya eksik.` };
    }
    return { id, file: selectedFile, student, recipient, status: "matched", detail: `${matchType} ile öğrenci eşleşti.` };
  };
  const handleSmartFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList || []).slice(0, 100);
    if (files.length === 0) return;
    const matches = files.map(matchSmartFile);
    setSmartFileMatches(matches);
    addRecipients(matches.map((match) => match.recipient).filter(Boolean) as Recipient[]);
    setFile(null);
    setSendMode("document");
    const studentCount = matches.filter((match) => match.status === "matched" && match.recipient?.role === "Öğrenci").length;
    const teacherCount = matches.filter((match) => match.status === "matched" && match.recipient?.role === "Öğretmen").length;
    setFileMatchInfo(`${matches.filter((match) => match.status === "matched").length}/${matches.length} dosya eşleştirildi${studentCount || teacherCount ? ` · ${studentCount} öğrenci · ${teacherCount} öğretmen` : ""}.`);
  };

  const removeSmartFile = (id: string) => {
    setSmartFileMatches((current) => {
      const removed = current.find((match) => match.id === id);
      const remaining = current.filter((match) => match.id !== id);
      if (removed?.recipient && !remaining.some((match) => match.recipient && recipientKey(match.recipient) === recipientKey(removed.recipient))) {
        removeRecipient(recipientKey(removed.recipient));
      }
      return remaining;
    });
  };

  const clearSmartFiles = () => {
    const smartRecipientKeys = new Set(smartFileMatches.map((match) => recipientKey(match.recipient)).filter(Boolean));
    setSelectedRecipients((current) => cleanRecipients(current).filter((recipient) => !smartRecipientKeys.has(recipientKey(recipient))));
    setSmartFileMatches([]);
    setFileMatchInfo("");
  };

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);
    setFileMatchInfo("");
    if (!selectedFile) return;
    const matchedRecipients = findRecipientsFromFileName(selectedFile);
    if (matchedRecipients.length > 0) {
      addRecipients(matchedRecipients);
      setFileMatchInfo(`Dosya adından ${matchedRecipients.length} alıcı bulundu ve Gönderilecekler Listesi'ne eklendi.`);
    } else {
      setFileMatchInfo(`Dosya adından ${recipientGroup === "teachers" ? "öğretmen" : "öğrenci"} tanınamadı. Gerekirse Listeler alanından alıcı seçiniz.`);
    }
  };

  const mirrorSuccessfulMessageToApps = async (recipients: Recipient[], bodyText: string) => {
    const safeBody = String(bodyText || "").trim();
    if (!safeBody || recipients.length === 0) return;

    const mappedRecipients = recipients
      .filter((recipient) => recipient.role !== "Manuel")
      .map((recipient) => {
        const source: any = recipient.source || {};
        const role = String(recipient.role || "");
        return {
          role,
          name: recipient.name,
          studentId:
            role === "Öğrenci" || role === "Veli"
              ? String(source?.id || source?.studentId || "").trim()
              : "",
          studentNumber: String(recipient.studentNo || source?.studentNumber || source?.number || "").trim(),
          studentName: String(recipient.studentName || source?.studentName || source?.name || "").trim(),
          classroom: String(recipient.className || source?.classroom || source?.className || "").trim(),
          teacherId:
            role === "Öğretmen"
              ? String(source?.id || source?.teacherId || source?.userId || "").trim()
              : "",
          sourceId: String(source?.id || "").trim(),
        };
      })
      .filter((recipient) => recipient.studentId || recipient.studentNumber || recipient.teacherId);

    if (!mappedRecipients.length) return;

    try {
      await fetch("/api/internal-messages/desktop-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: "e-Nstitü Yönetimi",
          title: "Bilgilendirme",
          body: safeBody,
          recipients: mappedRecipients,
        }),
      });
    } catch {
      // WhatsApp gönderimi başarılıysa, uygulama içi kopyadaki geçici ağ hatası
      // ana gönderimi başarısız saydırmaz.
    }
  };

  const send = async () => {
    const recipients = cleanRecipients(safeSelectedRecipients);
    if (!settings.token?.trim()) {
      setResult({ ok: false, error: "Önce Veri Yönetimi > Mesaj Araçları ekranından API token giriniz." });
      return;
    }
    if (recipients.length === 0) {
      setResult({ ok: false, error: "Gönderilecek alıcı bulunmuyor." });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      let res: any;

      if (evidenceEnabled) {
        const deliveries: any[] = [];

        if (smartFileMatches.length > 0) {
          const sendableMatches = smartFileMatches.filter((match) => match.status === "matched" && match.recipient);
          for (let index = 0; index < sendableMatches.length; index += 1) {
            const match = sendableMatches[index];
            const recipient = match.recipient!;
            try {
              const base64 = await fileToBase64(match.file);
              const mediaMode: "image" | "document" = match.file.type.startsWith("image/") ? "image" : "document";
              const evidence = await createEvidenceForRecipient(recipient, message, mediaMode, match.file.name);
              const delivery = await sendMediaMessage(
                settings,
                mediaMode,
                [recipient.normalized],
                evidenceMessageFor(message || `${match.file.name} dosyası`, evidence.proofUrl),
                match.file.name,
                base64,
              );
              await updateMessageEvidenceProvider(evidence.id, {
                accepted: Boolean(delivery.ok),
                providerMessageId: delivery.id,
                providerStatus: delivery.status || delivery.error,
              }).catch(() => {});
              deliveries.push({ recipient: recipient.name, file: match.file.name, evidenceId: evidence.id, ...delivery });
            } catch (error: any) {
              deliveries.push({
                ok: false,
                recipient: recipient.name,
                file: match.file.name,
                error: error?.message || "Dosya hazırlanırken veya gönderilirken hata oluştu.",
              });
            }
            if (index < sendableMatches.length - 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 350));
            }
          }
        } else if (sendMode === "text") {
          for (const recipient of recipients) {
            const evidence = await createEvidenceForRecipient(recipient, message, "text");
            const delivery = await sendTextMessage(
              settings,
              [recipient.normalized],
              evidenceMessageFor(message, evidence.proofUrl),
            );
            await updateMessageEvidenceProvider(evidence.id, {
              accepted: Boolean(delivery.ok),
              providerMessageId: delivery.id,
              providerStatus: delivery.status || delivery.error,
            }).catch(() => {});
            deliveries.push({ recipient: recipient.name, evidenceId: evidence.id, ...delivery });
          }
        } else {
          if (!file) {
            setResult({ ok: false, error: "Dosya seçiniz." });
            return;
          }
          if (file.size > 20 * 1024 * 1024) {
            setResult({ ok: false, error: "Dosya 20 MB sınırını aşamaz." });
            return;
          }
          const base64 = await fileToBase64(file);
          for (const recipient of recipients) {
            const evidence = await createEvidenceForRecipient(recipient, message, sendMode, file.name);
            const delivery = await sendMediaMessage(
              settings,
              sendMode,
              [recipient.normalized],
              evidenceMessageFor(message || `${file.name} dosyası`, evidence.proofUrl),
              file.name,
              base64,
            );
            await updateMessageEvidenceProvider(evidence.id, {
              accepted: Boolean(delivery.ok),
              providerMessageId: delivery.id,
              providerStatus: delivery.status || delivery.error,
            }).catch(() => {});
            deliveries.push({ recipient: recipient.name, evidenceId: evidence.id, ...delivery });
          }
        }

        const successful = deliveries.filter((item) => item.ok).length;
        const firstFailure = deliveries.find((item) => !item.ok);
        res = {
          ok: deliveries.length > 0 && successful === deliveries.length,
          status: `${successful}/${deliveries.length} gönderim kanıt kaydıyla işlendi.`,
          error: successful === deliveries.length
            ? undefined
            : `${deliveries.length - successful} gönderim başarısız.${firstFailure?.error ? ` İlk hata: ${firstFailure.error}` : ""}`,
          raw: deliveries,
        };
        await refreshEvidenceRecords();
      } else {
        const numbers = recipients.map((r) => r.normalized).filter(Boolean);
        if (smartFileMatches.length > 0) {
          const sendableMatches = smartFileMatches.filter((match) => match.status === "matched" && match.recipient);
          const deliveryResults: any[] = [];
          for (let index = 0; index < sendableMatches.length; index += 1) {
            const match = sendableMatches[index];
            try {
              const base64 = await fileToBase64(match.file);
              const mediaMode: "image" | "document" = match.file.type.startsWith("image/") ? "image" : "document";
              const delivery = await sendMediaMessage(settings, mediaMode, [match.recipient!.normalized], message, match.file.name, base64);
              deliveryResults.push({ file: match.file.name, recipient: match.recipient!.name, ...delivery });
            } catch (error: any) {
              deliveryResults.push({
                ok: false,
                file: match.file.name,
                recipient: match.recipient!.name,
                error: error?.message || "Dosya hazırlanırken veya gönderilirken hata oluştu.",
              });
            }
            // mHatsapp'ın medya kuyruğunu arka arkaya onlarca büyük JSON isteğiyle
            // boğmamak için kısa bir kontrollü aralık bırak.
            if (index < sendableMatches.length - 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 350));
            }
          }
          const successful = deliveryResults.filter((delivery) => delivery.ok).length;
          const firstFailure = deliveryResults.find((delivery) => !delivery.ok);
          res = {
            ok: deliveryResults.length > 0 && successful === deliveryResults.length,
            status: `${successful}/${deliveryResults.length} kişisel dosya doğru alıcıya gönderildi.`,
            error: successful === deliveryResults.length
              ? undefined
              : `${deliveryResults.length - successful} dosya gönderilemedi.${firstFailure?.error ? ` İlk hata: ${firstFailure.error}` : ""}`,
            raw: deliveryResults,
          };
        } else if (sendMode === "text") {
          res = await sendTextMessage(settings, numbers, message);
        } else {
          if (!file) {
            setResult({ ok: false, error: "Dosya seçiniz." });
            return;
          }
          if (file.size > 20 * 1024 * 1024) {
            setResult({ ok: false, error: "Dosya 20 MB sınırını aşamaz." });
            return;
          }
          const base64 = await fileToBase64(file);
          res = await sendMediaMessage(settings, sendMode, numbers, message, file.name, base64);
        }
      }

      setResult(res);
      appendMhatsappLog({ type: sendMode, ok: res?.ok, status: res?.status || res?.error, recipientCount: recipients.length, raw: res?.raw });

      if (res?.ok) {
        const appMessageBody =
          String(message || "").trim() ||
          (file?.name ? `${file.name} dosyası gönderildi.` : "Yeni bir bilgilendirmeniz var.");
        void mirrorSuccessfulMessageToApps(recipients, appMessageBody);
      }

      if (smartFileMatches.length > 0) {
        // Akıllı dosya gönderiminden sonra alıcı listesi tamamen temizlenir.
        // Yalnızca eşleşmeyen veya sağlayıcı tarafından gönderilemeyen dosyalar Akıllı Dosya Seçimi altında kalır.
        const failedNames = new Set(
          Array.isArray(res?.raw)
            ? res.raw.filter((item: any) => item && item.ok === false && item.file).map((item: any) => item.file)
            : [],
        );
        const unsentMatches = smartFileMatches.filter(
          (match) => match.status !== "matched" || !match.recipient || failedNames.has(match.file.name),
        );
        const retryRecipients = cleanRecipients(
          unsentMatches
            .filter((match) => match.status === "matched" && match.recipient)
            .map((match) => match.recipient),
        );
        setSelectedRecipients(retryRecipients);
        setSelectedSearch("");
        setFile(null);
        setSmartFileMatches(unsentMatches);
        setFileMatchInfo(
          unsentMatches.length > 0
            ? `${unsentMatches.length} dosya gönderilemedi. Başarısız eşleşmiş dosyalar yeniden denemek için listede bırakıldı.`
            : "",
        );
      } else if (res?.ok) {
        window.setTimeout(() => {
          setSelectedRecipients([]);
          setSelectedSearch("");
          setFile(null);
          setFileMatchInfo("");
        }, 600);
      }
    } catch (error: any) {
      const messageText = error?.message || "Gönderim sırasında hata oluştu.";
      setResult({ ok: false, error: messageText });
      console.error("MESAJ GÖNDERİM HATASI:", error);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100";
  const labelClass = "mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500";

  return (
    <div className={`notranslate mx-auto w-full ${mobile ? "pb-24" : "min-h-[680px] max-w-6xl overflow-y-auto xl:h-[calc(100vh-7.5rem)] xl:overflow-hidden"}`} translate="no">
      {mobile && (
        <nav className="sticky top-0 z-20 mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur">
          {([
            ["recipients", "Alıcılar", Users],
            ["compose", "Mesaj", MessageCircle],
            ["selected", `Liste (${safeSelectedRecipients.length})`, Send],
          ] as const).map(([step, label, Icon]) => (
            <button key={step} type="button" onClick={() => setMobileStep(step)} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-black ${mobileStep === step ? "bg-emerald-600 text-white" : "text-slate-500"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      )}
      <div className={mobile ? "block" : "grid gap-4 xl:h-full xl:grid-cols-[0.68fr_1fr_1fr]"}>
        <section className={`${mobile && mobileStep !== "compose" ? "hidden" : "flex"} min-h-0 flex-col self-start rounded-2xl border border-slate-200 border-t-4 border-t-emerald-600 bg-white p-4 shadow-sm`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900"><Send className="h-5 w-5 text-emerald-600" /> Mesaj İçeriği</h2>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black ${settings.token ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{settings.token ? "API ayarları kayıtlı" : "API eksik"}</span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setSendMode("text")} className={`rounded-xl border px-3 py-2.5 text-xs font-black transition ${sendMode === "text" ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}><MessageCircle className="mr-1 inline h-4 w-4" /> Metin Mesaj</button>
            <button type="button" onClick={() => setSendMode("document")} className={`rounded-xl border px-3 py-2.5 text-xs font-black transition ${sendMode === "document" ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}><FileText className="mr-1 inline h-4 w-4" /> PDF/Dosya</button>
            <button type="button" onClick={() => setSendMode("image")} className={`rounded-xl border px-3 py-2.5 text-xs font-black transition ${sendMode === "image" ? "border-amber-500 bg-amber-500 text-white shadow-sm" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}><Image className="mr-1 inline h-4 w-4" /> Resim</button>
          </div>

          <div>
            <label className={labelClass}>{sendMode === "text" ? "Mesaj metni" : "Dosya açıklaması"}</label>
            <textarea className="h-36 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mesajınızı yazınız..." />
          </div>
          <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={evidenceEnabled} onChange={(e) => setEvidenceEnabled(e.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-700" />
                <span>
                  <span className="flex items-center gap-1.5 text-xs font-black text-cyan-950"><ShieldCheck className="h-4 w-4" />Mesaj Kanıt Kaydı</span>
              <span className="mt-1 block text-[10px] leading-4 text-cyan-800">Her alıcıya kişisel doğrulama bağlantısı ekler; görüntüleme ve “Okudum” onayını kaydeder.</span>
                </span>
              </label>
              <button type="button" onClick={async () => { setEvidenceOpen(true); await refreshEvidenceRecords(); }} className="shrink-0 rounded-xl border border-cyan-300 bg-white px-3 py-2 text-[10px] font-black text-cyan-800">Kayıtlar</button>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-xs font-black text-emerald-900"><Wand2 className="h-4 w-4" />Akıllı Dosya Seçimi</h3>
              </div>
              {smartFileMatches.length > 0 && <button type="button" onClick={clearSmartFiles} className="rounded-lg bg-white p-2 text-rose-500 shadow-sm" title="Akıllı dosya listesini temizle"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-white px-4 py-3 text-xs font-black text-emerald-800 hover:bg-emerald-50">
              <Upload className="h-4 w-4" />Birden Fazla Dosya Seç
              <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*" onChange={(event) => { handleSmartFiles(event.target.files); event.currentTarget.value = ""; }} />
            </label>
            {smartFileMatches.some((match) => match.status !== "matched") && (
              <div className="mt-2 max-h-44 space-y-1.5 overflow-auto pr-1">
                <div className="px-1 text-[10px] font-black uppercase tracking-wider text-rose-700">Gönderilemeyen Dosyalar</div>
                {smartFileMatches.filter((match) => match.status !== "matched").map((match) => (
                  <div key={match.id} className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700">
                    <div className="min-w-0"><strong className="block truncate">{match.file.name}</strong><span className="block truncate">{match.detail}</span></div>
                    <button type="button" onClick={() => removeSmartFile(match.id)} className="shrink-0 rounded-lg p-1.5 hover:bg-rose-100" title="Dosyayı listeden çıkar"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            {smartFileMatches.some((match) => match.status === "matched") && <div className="mt-2 text-[10px] font-bold text-emerald-800">{smartFileMatches.filter((match) => match.status === "matched").length} dosya hazır · Her dosya yalnızca eşleştiği alıcıya gönderilir.</div>}
          </div>

          {sendMode !== "text" && (
            <div className="mt-3 rounded-2xl border border-dashed border-amber-300 bg-white/70 p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-amber-700">Tek Dosya Gönderimi</div>
              <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl bg-white px-4 py-4 text-sm font-black text-slate-700 shadow-sm hover:bg-amber-50">
                <Upload className="h-5 w-5 text-amber-600" /> {file ? file.name : "PDF / Dosya Seç"}
                <input type="file" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] || null)} accept={sendMode === "image" ? "image/*" : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*"} />
              </label>
              {fileMatchInfo && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{fileMatchInfo}</span>
                </div>
              )}
              <p className="mt-2 text-xs font-semibold text-slate-500">En fazla 20 MB desteklenir.</p>
            </div>
          )}

          <SendResultBox result={result} />

          <div className="mt-3 text-xs font-black text-slate-500">Alıcı: <span className="text-slate-900">{safeSelectedRecipients.length}</span></div>
        </section>

        <section className={`${mobile && mobileStep !== "recipients" ? "hidden" : "flex"} min-h-[620px] flex-col rounded-2xl border border-slate-200 border-t-4 border-t-indigo-600 bg-white p-5 shadow-sm xl:h-full xl:min-h-0`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900"><Users className="h-5 w-5 text-indigo-600" /> Listeler</h2>
            {(!(recipientGroup === "students" || recipientGroup === "parents" || recipientGroup === "trial-club") || selectedClass || (recipientGroup === "students" && recipientSearch.trim())) && <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black text-indigo-700">{previewRecipients.length} kayıt</span>}
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>Alıcı Listesi</label>
                <select className={inputClass} value={recipientGroup} onChange={(e) => {
                  const nextGroup = e.target.value as RecipientGroup;
                  setRecipientGroup(nextGroup);
                  setSelectedClass("");
                  setRecipientSearch("");
                }}>
                  <option value="">Alıcı listesi seçiniz</option>
                  <option value="students">Öğrenciler</option>
                  <option value="parents">Veliler</option>
                  <option value="teachers">Öğretmenler</option>
                  <option value="manual">Manuel Numara</option>
                  <option value="trial-club">Deneme Kulübü</option>
                </select>
              </div>
            </div>

            {(recipientGroup === "students" || recipientGroup === "parents") && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className={labelClass}>{recipientGroup === "parents" ? "Velileri İçin Sınıf Seçiniz" : "Sınıf Seçiniz"}</label>
                  {selectedClass && <span className="text-[10px] font-black text-indigo-700">{selectedClass} seçildi</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {classes.map((className) => (
                    <button
                      key={String(className)}
                      type="button"
                      onClick={() => { setSelectedClass(String(className)); setRecipientSearch(""); }}
                      className={`rounded-xl border px-3 py-2 text-xs font-black transition ${selectedClass === String(className) ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400"}`}
                    >
                      {String(className)}
                    </button>
                  ))}
                </div>
                {classes.length === 0 && <p className="text-xs font-semibold text-slate-400">Kayıtlı sınıf bulunamadı.</p>}
              </div>
            )}

            {recipientGroup === "trial-club" && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
                <label className={labelClass}>Sınıf Düzeyi Seçiniz</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["9", "10", "11"].map((grade) => (
                    <button key={grade} type="button" onClick={() => { setSelectedClass(grade); setRecipientSearch(""); }}
                      className={`rounded-xl border px-3 py-2 text-xs font-black transition ${selectedClass === grade ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400"}`}>
                      {grade}. sınıf
                    </button>
                  ))}
                </div>
                {trialClubError && <p className="mt-2 text-xs font-bold text-red-600">{trialClubError}</p>}
              </div>
            )}

            {recipientGroup === "manual" ? (
              <div>
                <label className={labelClass}>Manuel numaralar</label>
                <textarea className={inputClass} rows={4} value={manualNumbers} onChange={(e) => setManualNumbers(e.target.value)} placeholder="0532 123 45 67\n905xxxxxxxxx" />
              </div>
            ) : (recipientGroup === "students" || recipientGroup === "trial-club" ? Boolean(selectedClass) : recipientGroup !== "parents" || Boolean(selectedClass)) ? (
              <div>
                <label className={labelClass}>{recipientGroup === "students" ? "Öğrenci Okul Numarası veya Adı Soyadıyla Ara" : recipientGroup === "parents" ? "Çocuğun Okul Numarası veya Adı Soyadıyla Ara" : "İsim Ara"}</label>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 h-4 w-4 text-indigo-400" />
                  <input
                    type="search"
                    aria-label={recipientGroup === "students" ? "Öğrenci okul numarası veya adı soyadı" : "Alıcı ara"}
                    className={`${inputClass} pl-10`}
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder={recipientGroup === "students" ? "Örn: 125 veya Ahmet Yılmaz" : recipientGroup === "parents" ? "Örn: 125 veya öğrencinin adı" : "İsim yazarak arayın"}
                  />
                </div>
              </div>
            ) : null}

            {recipientGroup !== "trial-club" && (!(recipientGroup === "students" || recipientGroup === "parents") || selectedClass || (recipientGroup === "students" && recipientSearch.trim())) && <button type="button" onClick={() => addRecipients()} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-indigo-700">
              {recipientGroup === "trial-club" ? `${selectedClass}. Sınıf Deneme Kulübü Öğrencilerini Gönderilecekler'e Ekle` : recipientGroup === "students" ? selectedClass ? `${selectedClass} Sınıfının Tamamını Gönderilecekler'e Ekle` : "Arama Sonuçlarını Gönderilecekler'e Ekle" : recipientGroup === "parents" ? `${selectedClass} Sınıfının Tüm Velilerini Gönderilecekler'e Ekle` : "Görünenleri Gönderilecekler Listesi'ne Aktar"}
            </button>}
          </div>

          {(!(recipientGroup === "students" || recipientGroup === "parents" || recipientGroup === "trial-club") || selectedClass || (recipientGroup === "students" && recipientSearch.trim())) && <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl border border-indigo-100 bg-white/70 p-2">
            {(recipientGroup === "students" || recipientGroup === "parents") && (selectedClass || recipientSearch.trim()) && previewRecipients.length > 0 && (
              <div className="mb-2 rounded-xl bg-sky-50 px-3 py-2 text-[10px] font-bold text-sky-700">
                {recipientGroup === "parents" ? "Veliler, çocuklarının okul numarasına göre sıralandı. Tek tek seçmek için veli satırına tıklayın." : selectedClass ? "Öğrenciler okul numarasına göre sıralandı. Tek tek seçmek için öğrenciye tıklayın." : "Tüm okulda bulunan arama sonuçları okul numarasına göre sıralandı."}
              </div>
            )}
            {previewRecipients.slice(0, 250).map((r) => {
              const selected = isRecipientSelected(r);
              return (
                <button key={recipientKey(r)} type="button" onClick={() => toggleOneRecipient(r)} className={`mb-1.5 w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${selected ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-white text-slate-600 hover:bg-indigo-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        {r.role === "Öğrenci" && r.studentNo && <span className="shrink-0 rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700">No: {r.studentNo}</span>}
                      <div className="truncate font-black">{selected ? "✓ " : ""}{r.role === "Veli" ? `${r.studentNo ? `${r.studentNo} — ` : ""}${r.studentName || "Öğrenci"} (${r.name || "Veli adı yok"})` : r.name || "İsimsiz Kayıt"}</div>
                      </div>
                      <div className="truncate text-[10px] opacity-70">{r.role} {r.className ? `• ${r.className}` : ""} {r.role !== "Öğrenci" && r.role !== "Veli" && r.studentNo ? `• Öğrenci No: ${r.studentNo}` : ""}</div>
                    </div>
                    <div className="shrink-0 text-[10px] font-black">{r.normalized}</div>
                  </div>
                </button>
              );
            })}
            {previewRecipients.length === 0 && <p className="p-4 text-sm font-semibold text-slate-400">{recipientGroup === "students" && !selectedClass && recipientSearch.trim() ? "Tüm okulda bu numara veya adla eşleşen, geçerli telefonu bulunan öğrenci yok." : recipientGroup === "parents" && !selectedClass ? "Velileri görmek için yukarıdan bir sınıf seçiniz." : recipientGroup ? "Bu seçimde geçerli telefon numarası bulunan kayıt yok." : "Alıcı Listesi açılır menüsünden seçim yapınız."}</p>}
          </div>}
        </section>

        <section className={`${mobile && mobileStep !== "selected" ? "hidden" : "flex"} min-h-[620px] flex-col rounded-2xl border border-slate-200 border-t-4 border-t-teal-600 bg-white p-5 shadow-sm xl:h-full xl:min-h-0`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-slate-900">Gönderilecekler Listesi</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700">{safeSelectedRecipients.length} kişi</span>
              <button type="button" onClick={clearRecipients} className="rounded-xl bg-rose-50 p-2 text-rose-600 hover:bg-rose-100" title="Listeyi temizle"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <button type="button" disabled={loading || safeSelectedRecipients.length === 0} onClick={send} className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-[16.67px] font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50">
            <Send className="h-4 w-4" /> <span>{loading ? "Gönderiliyor..." : "Gönder"}</span>
          </button>
          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-emerald-100 bg-white/70 p-2">
            {safeSelectedRecipients.length === 0 ? <p className="p-4 text-sm font-semibold text-slate-400">Gönderilecek alıcı yok.</p> : safeSelectedRecipients.map((r) => {
              const key = recipientKey(r);
              return (
                <div key={key} className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      {r.role === "Öğrenci" && r.studentNo && <span className="shrink-0 rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700">No: {r.studentNo}</span>}
                        <div className="truncate font-black text-slate-800">{r.role === "Veli" ? `${r.studentNo ? `${r.studentNo} — ` : ""}${r.studentName || "Öğrenci"} (${r.name || "Veli adı yok"})` : r.name || "İsimsiz Kayıt"}</div>
                    </div>
                        <div className="truncate text-xs font-semibold text-slate-500">{r.role || "-"} {r.className ? `• ${r.className}` : ""} {r.role !== "Öğrenci" && r.role !== "Veli" && r.studentNo ? `• Öğrenci No: ${r.studentNo}` : ""} • {r.normalized}</div>
                  </div>
                  <button type="button" onClick={() => removeRecipient(key)} className="rounded-xl bg-rose-50 p-2 text-rose-500 hover:bg-rose-100" title="Alıcıyı çıkar"><X className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {evidenceOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={() => setEvidenceOpen(false)}>
          <div className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><ShieldCheck className="h-5 w-5 text-cyan-700" />Mesaj Kanıt Kayıtları</h3>
                <p className="mt-1 text-xs text-slate-500">Gönderim kabulü, bilinçli görüntüleme ve alıcı onayı ayrı ayrı tutulur.</p>
              </div>
              <button type="button" onClick={() => setEvidenceOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              {evidenceLoading ? (
                <div className="p-8 text-center text-sm font-bold text-slate-500">Kanıt kayıtları yükleniyor...</div>
              ) : evidenceRecords.length === 0 ? (
                <div className="p-8 text-center text-sm font-bold text-slate-400">Henüz mesaj kanıt kaydı yok.</div>
              ) : (
                <div className="space-y-2">
                  {evidenceRecords.map((record) => {
                    const status = messageEvidenceStatus(record);
                    const statusClass = record.acknowledgedAt
                      ? "bg-emerald-100 text-emerald-800"
                      : record.firstOpenedAt
                        ? "bg-cyan-100 text-cyan-800"
                        : record.providerAcceptedAt
                          ? "bg-blue-100 text-blue-800"
                          : record.providerFailedAt
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-700";
                    return (
                      <div key={record.id} className="grid gap-3 rounded-2xl border border-slate-200 p-3 md:grid-cols-[1.1fr_1fr_auto]">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-900">{record.recipientName}</div>
                          <div className="mt-1 text-[10px] text-slate-500">{record.recipientPhoneMasked || record.recipientPhone} · {record.studentName || record.recipientRole || "Alıcı"} {record.className ? `· ${record.className}` : ""}</div>
                          <div className="mt-1 truncate text-[11px] text-slate-600">{record.message}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center text-[9px]">
                          <div className={`rounded-xl p-2 ${record.providerAcceptedAt ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-400"}`}><Send className="mx-auto mb-1 h-3.5 w-3.5" />Kabul<br/>{record.providerAcceptedAt ? new Date(record.providerAcceptedAt).toLocaleString("tr-TR") : "—"}</div>
                          <div className={`rounded-xl p-2 ${record.firstOpenedAt ? "bg-cyan-50 text-cyan-700" : "bg-slate-50 text-slate-400"}`}><Eye className="mx-auto mb-1 h-3.5 w-3.5" />Görüntü<br/>{record.firstOpenedAt ? new Date(record.firstOpenedAt).toLocaleString("tr-TR") : "—"}</div>
                          <div className={`rounded-xl p-2 ${record.acknowledgedAt ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"}`}><CheckCircle2 className="mx-auto mb-1 h-3.5 w-3.5" />Onay<br/>{record.acknowledgedAt ? new Date(record.acknowledgedAt).toLocaleString("tr-TR") : "—"}</div>
                        </div>
                        <div className="flex items-center justify-end">
                          <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${statusClass}`}>{status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}




