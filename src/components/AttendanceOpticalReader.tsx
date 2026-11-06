import React, { useEffect, useMemo, useRef, useState } from "react";
import localforage from "../core/state/AppStateService";
import { AlertTriangle, BellRing, Camera, CameraOff, CheckCircle2, Copy, ExternalLink, FileImage, Save, ScanLine, Send, Square } from "lucide-react";
import { Classroom, Student, Teacher } from "../types";
import { getAttendanceClassCode, readAttendanceOpticalIdentity, readAttendanceOpticalImage } from "../utils/attendanceOptical";
import { getAttendanceStudentNumber, getSortedAttendanceStudents } from "../utils/attendanceStudents";
import { isValidMhatsappNumber, loadMhatsappSettings, normalizeMhatsappNumber, sendTextMessage } from "../lib/mhatsappApi";

import { sqliteStorage } from "../core/state/SyncStateStore";
type AbsenceItem = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  lessons: number[];
};

export type AttendanceOpticalRecord = {
  id: string;
  date: string;
  classroomId: string;
  classroomName: string;
  sourceName: string;
  createdAt: string;
  absentStudents: AbsenceItem[];
  submittedAt?: string;
  accessLinkId?: string;
};

type AttendanceReminder = {
  teacherId: string;
  teacherName: string;
  phone: string;
  linkId: string;
  url: string;
  expiresAt: string;
  lastSentAt: string;
  messageCount: number;
  serverManaged?: boolean;
};

interface Props {
  classrooms: Classroom[];
  students: Student[];
  teachers?: Teacher[];
  initialDate: string;
  setStudents?: React.Dispatch<React.SetStateAction<Student[]>>;
  remoteMode?: boolean;
  accessToken?: string;
}

const RECORD_KEY = "attendance_optical_records";
const REMINDER_KEY = "attendance_optical_active_reminder";
const REMINDER_INTERVAL_MS = 2 * 60 * 1000;

const studentNumber = getAttendanceStudentNumber;

export default function AttendanceOpticalReader({ classrooms, students, teachers = [], initialDate, setStudents, remoteMode = false, accessToken = "" }: Props) {
  const [classroomId, setClassroomId] = useState("");
  const [scanDate, setScanDate] = useState(initialDate);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [markedLessons, setMarkedLessons] = useState<number[][] | null>(null);
  const [reviewStudents, setReviewStudents] = useState<Student[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [showManualClass, setShowManualClass] = useState(false);
  const [identityMessage, setIdentityMessage] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [records, setRecords] = useState<AttendanceOpticalRecord[]>([]);
  const [phoneUrl, setPhoneUrl] = useState("");
  const [phoneLinkExpiresAt, setPhoneLinkExpiresAt] = useState("");
  const [phoneLinkIsPublic, setPhoneLinkIsPublic] = useState(false);
  const [phoneLinkId, setPhoneLinkId] = useState("");
  const [phoneLinkError, setPhoneLinkError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const resultSectionRef = useRef<HTMLElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isSendingTeacherLink, setIsSendingTeacherLink] = useState(false);
  const [reminderNotice, setReminderNotice] = useState("");
  const [activeReminder, setActiveReminder] = useState<AttendanceReminder | null>(() => {
    try { return JSON.parse(sqliteStorage.getItem(REMINDER_KEY) || "null"); } catch { return null; }
  });
  const reminderSendingRef = useRef(false);
  const availableTeachers = useMemo(() => teachers
    .filter((teacher) => teacher && teacher.status !== "İzinli")
    .sort((a, b) => a.name.localeCompare(b.name, "tr")), [teachers]);

  const stopReminder = (notice: string) => {
    if (activeReminder?.serverManaged) {
      void fetch(`/api/attendance-optical/reminders/${encodeURIComponent(activeReminder.linkId)}`, { method: "DELETE" }).catch(() => null);
    }
    setActiveReminder(null);
    try { sqliteStorage.removeItem(REMINDER_KEY); } catch { /* Tarayıcı depolaması kapalı olabilir. */ }
    setReminderNotice(notice);
  };

  useEffect(() => {
    if (classroomId && !classrooms.some((item) => item.id === classroomId)) setClassroomId("");
  }, [classrooms, classroomId]);

  useEffect(() => {
    if (!selectedTeacherId && availableTeachers.length) setSelectedTeacherId(availableTeachers[0].id);
  }, [availableTeachers, selectedTeacherId]);

  useEffect(() => {
    Promise.all([
      localforage.getItem<AttendanceOpticalRecord[]>(RECORD_KEY).catch(() => []),
      fetch("/api/public/attendance-optical/records", {
        cache: "no-store",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }).then((response) => response.ok ? response.json() : []).catch(() => []),
    ]).then(([localRecords, remoteRecords]) => {
      const merged = new Map<string, AttendanceOpticalRecord>();
      [...(Array.isArray(localRecords) ? localRecords : []), ...(Array.isArray(remoteRecords) ? remoteRecords : [])]
        .forEach((record) => merged.set(record.id, record));
      setRecords([...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
  }, [accessToken]);

  useEffect(() => {
    if (remoteMode) return;
    void Promise.all([
      fetch("/api/database/collections/school_students", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(students) }).catch(() => null),
      fetch("/api/database/collections/school_classrooms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(classrooms) }).catch(() => null),
    ]);
  }, [remoteMode, students, classrooms]);

  useEffect(() => {
    if (remoteMode) return;
    setPhoneLinkError("");
    fetch("/api/attendance-optical/share-link", { method: "POST", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.url) throw new Error(data.error || "Güvenli bağlantı oluşturulamadı.");
        setPhoneUrl(data.url);
        setPhoneLinkExpiresAt(data.expiresAt || "");
        setPhoneLinkIsPublic(Boolean(data.isPublic));
        setPhoneLinkId(data.linkId || "");
      })
      .catch((error) => setPhoneLinkError(error instanceof Error ? error.message : "Güvenli bağlantı oluşturulamadı."));
  }, [remoteMode]);

  useEffect(() => {
    if (remoteMode || !activeReminder) return;
    let disposed = false;

    const checkUploadAndRemind = async () => {
      if (disposed || reminderSendingRef.current) return;
      if (new Date(activeReminder.expiresAt).getTime() <= Date.now()) {
        stopReminder("Bağlantının süresi dolduğu için hatırlatmalar durduruldu.");
        return;
      }

      try {
        const response = await fetch("/api/public/attendance-optical/records", { cache: "no-store" });
        const remoteRecords = response.ok ? await response.json() : [];
        if (Array.isArray(remoteRecords)) {
          const uploaded = remoteRecords.some((record: AttendanceOpticalRecord) => record.accessLinkId === activeReminder.linkId);
          if (uploaded) {
            stopReminder(`${activeReminder.teacherName} tarafından fiş yüklendi. Hatırlatmalar durduruldu.`);
            return;
          }
        }
      } catch {
        // Geçici bağlantı kesintisinde bir sonraki kontrolde yeniden denenir.
      }

      if (activeReminder.serverManaged) {
        try {
          const statusResponse = await fetch(`/api/attendance-optical/reminders/${encodeURIComponent(activeReminder.linkId)}`, { cache: "no-store" });
          if (statusResponse.ok) {
            const status = await statusResponse.json();
            if (status.lastSentAt !== activeReminder.lastSentAt || status.messageCount !== activeReminder.messageCount) {
              const next = { ...activeReminder, lastSentAt: status.lastSentAt, messageCount: status.messageCount };
              setActiveReminder(next);
              sqliteStorage.setItem(REMINDER_KEY, JSON.stringify(next));
            }
            setReminderNotice(status.lastError
              ? `Hatırlatma gönderilemedi: ${status.lastError}`
              : `${activeReminder.teacherName} öğretmenine ${status.messageCount} mesaj gönderildi. Fiş yüklenene kadar iki dakikada bir yinelenecek.`);
            return;
          }
        } catch {
          return;
        }
        const fallback = { ...activeReminder, serverManaged: false };
        setActiveReminder(fallback);
        try { sqliteStorage.setItem(REMINDER_KEY, JSON.stringify(fallback)); } catch { /* Depolama kapalı olabilir. */ }
        setReminderNotice("Sunucu hatırlatma görevi bulunamadı; bu ekran açıkken hatırlatmalar sürdürülecek.");
        return;
      }

      const lastSentAt = new Date(activeReminder.lastSentAt).getTime();
      if (Date.now() - lastSentAt < REMINDER_INTERVAL_MS) return;
      reminderSendingRef.current = true;
      const attemptedAt = new Date().toISOString();
      try {
        const settings = loadMhatsappSettings();
        const reminderText = `Sayın ${activeReminder.teacherName}, yoklama fişi henüz sisteme yüklenmedi. Lütfen aşağıdaki güvenli bağlantıyı açarak fiş fotoğrafını yükleyiniz:\n\n${activeReminder.url}`;
        const result = await sendTextMessage(settings, [activeReminder.phone], reminderText);
        if (!result.ok) throw new Error(result.error || "Hatırlatma gönderilemedi.");
        const next = { ...activeReminder, lastSentAt: attemptedAt, messageCount: activeReminder.messageCount + 1 };
        setActiveReminder(next);
        sqliteStorage.setItem(REMINDER_KEY, JSON.stringify(next));
        setReminderNotice(`${activeReminder.teacherName} öğretmenine ${next.messageCount}. mesaj gönderildi. Fiş yüklenene kadar iki dakikada bir yinelenecek.`);
      } catch (error) {
        const next = { ...activeReminder, lastSentAt: attemptedAt };
        setActiveReminder(next);
        try { sqliteStorage.setItem(REMINDER_KEY, JSON.stringify(next)); } catch { /* Depolama kapalı olabilir. */ }
        setReminderNotice(error instanceof Error ? error.message : "Hatırlatma gönderilemedi.");
      } finally {
        reminderSendingRef.current = false;
      }
    };

    void checkUploadAndRemind();
    const timer = window.setInterval(() => void checkUploadAndRemind(), 10_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeReminder, remoteMode]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  };

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const classroom = classrooms.find((item) => item.id === classroomId);
  const classStudents = useMemo(() => getSortedAttendanceStudents(students, classroom), [students, classroom]);
  const studentsForReview = reviewStudents.length ? reviewStudents : classStudents;

  const resetReading = () => {
    setMarkedLessons(null);
    setReviewStudents([]);
    setMessage(null);
  };

  const handleFile = async (nextFile: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : "");
    resetReading();
    setIdentityMessage("");
    setShowManualClass(false);
    if (!nextFile) {
      setClassroomId("");
      return;
    }

    setIsIdentifying(true);
    try {
      const identity = await readAttendanceOpticalIdentity(nextFile);
      const detectedClassrooms = classrooms.filter((item) => getAttendanceClassCode(item.id) === identity.classCode);
      if (detectedClassrooms.length === 0) throw new Error("Karekoddaki sınıf sistemde bulunamadı.");
      if (detectedClassrooms.length > 1) throw new Error("Karekod birden fazla sınıfla eşleşti. Hatalı kayıt riskini önlemek için sınıfı manuel seçin.");
      const detectedClassroom = detectedClassrooms[0];
      setClassroomId(detectedClassroom.id);
      setScanDate(identity.date);
      setIdentityMessage(`${detectedClassroom.name} sınıfı ve ${identity.date.split("-").reverse().join(".")} tarihi karekoddan belirlendi.`);
    } catch (error) {
      setClassroomId(classrooms[0]?.id || "");
      setShowManualClass(true);
      setIdentityMessage(error instanceof Error ? error.message : "Karekod okunamadı. Sınıfı manuel seçin.");
    } finally {
      setIsIdentifying(false);
    }
  };

  const startCamera = async () => {
    setCameraError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Canlı kamera yalnızca HTTPS bağlantısında ve kamera erişimini destekleyen tarayıcılarda açılabilir. Aşağıdaki Telefon Kamerası düğmesini de kullanabilirsiniz.");
      return;
    }
    setIsStartingCamera(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      window.setTimeout(() => {
        if (!videoRef.current || cameraStreamRef.current !== stream) return;
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => setCameraError("Kamera görüntüsü başlatılamadı. Tarayıcıdaki kamera iznini kontrol edin."));
      }, 0);
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      setCameraError(errorName === "NotAllowedError"
        ? "Kamera izni verilmedi. Tarayıcının adres çubuğundaki kilit simgesinden kamera iznini açıp yeniden deneyin."
        : errorName === "NotFoundError"
          ? "Bu cihazda kullanılabilir kamera bulunamadı."
          : "Kamera açılamadı. Başka bir uygulamanın kamerayı kullanmadığından emin olun veya Telefon Kamerası düğmesini deneyin.");
      stopCamera();
    } finally {
      setIsStartingCamera(false);
    }
  };

  const captureCameraFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Kamera görüntüsü henüz hazır değil. Birkaç saniye sonra tekrar deneyin.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("Fotoğraf oluşturulamadı. Telefon Kamerası düğmesini deneyin.");
        return;
      }
      const capturedFile = new File([blob], `yoklama-fisi-${Date.now()}.jpg`, { type: "image/jpeg" });
      stopCamera();
      void handleFile(capturedFile);
    }, "image/jpeg", 0.94);
  };

  const readForm = async () => {
    if (!file || !classroom || classStudents.length === 0 || isIdentifying) return;
    setIsReading(true);
    setMessage(null);
    const studentsAtReadTime = [...classStudents];
    setReviewStudents(studentsAtReadTime);
    try {
      const result = await readAttendanceOpticalImage(file, studentsAtReadTime.length);
      URL.revokeObjectURL(result.previewUrl);
      setMarkedLessons(result.markedLessons);
      const absentCount = result.markedLessons.filter((lessons) => lessons.length > 0).length;
      const markedLessonCount = result.markedLessons.reduce((sum, lessons) => sum + lessons.length, 0);
      const suspiciousResult = absentCount >= Math.max(8, Math.ceil(studentsAtReadTime.length * 0.75));
      setMessage({
        type: suspiciousResult ? "error" : "success",
        text: suspiciousResult
          ? `${absentCount} öğrencide ${markedLessonCount} ders işareti algılandı. Sonuç olağan dışı yüksek; kaydetmeyin. Fişi düz, gölgesiz ve dört köşe işareti görünür biçimde yeniden çekin.`
          : `${absentCount} öğrencide ${markedLessonCount} ders işareti algılandı. Kaydetmeden önce aşağıdaki ders kutularını kontrol edin.`,
      });
      window.setTimeout(() => resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (error) {
      setMarkedLessons(null);
      setReviewStudents([]);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Fiş okunamadı." });
    } finally {
      setIsReading(false);
    }
  };

  const toggleLesson = (rowIndex: number, lesson: number) => {
    setMarkedLessons((current) => {
      if (!current) return current;
      return current.map((lessons, index) => index !== rowIndex
        ? lessons
        : lessons.includes(lesson)
          ? lessons.filter((item) => item !== lesson)
          : [...lessons, lesson].sort((a, b) => a - b));
    });
  };

  const saveReading = async () => {
    if (!markedLessons || !classroom) return;
    const absentStudents = studentsForReview.flatMap((student, index) => {
      const lessons = markedLessons[index] || [];
      return lessons.length ? [{
        studentId: student.id,
        studentName: student.name,
        studentNumber: studentNumber(student),
        lessons,
      }] : [];
    });
    const previous = records.find((item) => item.date === scanDate && item.classroomId === classroom.id);
    const record: AttendanceOpticalRecord = {
      id: previous?.id || `attendance-${classroom.id}-${scanDate}`,
      date: scanDate,
      classroomId: classroom.id,
      classroomName: classroom.name,
      sourceName: file?.name || "Kamera",
      createdAt: new Date().toISOString(),
      absentStudents,
    };
    try {
      const response = await fetch("/api/public/attendance-optical/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(record),
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok || !responseData.success) throw new Error(responseData.error || "Kayıt okul sistemine gönderilemedi.");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Kayıt okul sistemine gönderilemedi." });
      return;
    }
    const nextRecords = [record, ...records.filter((item) => item.id !== record.id)]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setRecords(nextRecords);
    await localforage.setItem(RECORD_KEY, nextRecords);
    try { sqliteStorage.setItem(RECORD_KEY, JSON.stringify(nextRecords)); } catch { /* localforage kaydı yeterli. */ }

    setMessage({ type: "success", text: `${absentStudents.length} öğrencinin optik okuma sonucu kontrol ve düzeltme kuyruğuna alındı.` });
  };

  const sendLinkToTeacher = async () => {
    const teacher = availableTeachers.find((item) => item.id === selectedTeacherId);
    if (!teacher || !phoneUrl || !phoneLinkId || !phoneLinkExpiresAt) return;
    const phone = normalizeMhatsappNumber(teacher.phone || (teacher as any).teacherPhone || (teacher as any).telefon || (teacher as any).gsm || "");
    if (!isValidMhatsappNumber(phone)) {
      setReminderNotice(`${teacher.name} için geçerli telefon numarası bulunamadı.`);
      return;
    }
    const settings = loadMhatsappSettings();
    if (!settings.token?.trim()) {
      setReminderNotice("WhatsApp API ayarları eksik. Önce Mesaj Araçları alanından API tokenını kaydedin.");
      return;
    }

    setIsSendingTeacherLink(true);
    setReminderNotice("Yükleme bağlantısı öğretmene gönderiliyor...");
    try {
      const initialMessage = `Sayın ${teacher.name}, yoklama fişini sisteme yüklemek için aşağıdaki güvenli bağlantıyı açınız. Fiş yüklenene kadar iki dakikada bir hatırlatma gönderilecektir.\n\n${phoneUrl}`;
      const result = await sendTextMessage(settings, [phone], initialMessage);
      if (!result.ok) throw new Error(result.error || "Bağlantı gönderilemedi.");
      const sentAt = new Date().toISOString();
      const registrationResponse = await fetch("/api/attendance-optical/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId: phoneLinkId,
          teacherName: teacher.name,
          phone,
          url: phoneUrl,
          expiresAt: phoneLinkExpiresAt,
          baseUrl: settings.baseUrl,
          token: settings.token,
          lastSentAt: sentAt,
        }),
      }).catch(() => null);
      const reminder: AttendanceReminder = {
        teacherId: teacher.id,
        teacherName: teacher.name,
        phone,
        linkId: phoneLinkId,
        url: phoneUrl,
        expiresAt: phoneLinkExpiresAt,
        lastSentAt: sentAt,
        messageCount: 1,
        serverManaged: Boolean(registrationResponse?.ok),
      };
      setActiveReminder(reminder);
      sqliteStorage.setItem(REMINDER_KEY, JSON.stringify(reminder));
      setReminderNotice(`Yükleme mesajı ${teacher.name} öğretmenine gönderildi. Fiş yüklenene kadar iki dakikada bir hatırlatılacak${registrationResponse?.ok ? "; başka ekrana geçebilirsiniz" : "; bu ekranı açık tutun"}.`);
    } catch (error) {
      setReminderNotice(error instanceof Error ? error.message : "Bağlantı gönderilemedi.");
    } finally {
      setIsSendingTeacherLink(false);
    }
  };

  const copyPhoneLink = async () => {
    if (!phoneUrl) return;
    try {
      await navigator.clipboard.writeText(phoneUrl);
    } catch {
      const area = document.createElement("textarea");
      area.value = phoneUrl;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  const absentCount = markedLessons?.filter((lessons) => lessons.length > 0).length || 0;

  return <div className="mx-auto w-full max-w-7xl space-y-4">
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Optik Yoklama Fişi Oku</h2>
          </div>
        </div>

        {!remoteMode && <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-orange-700">Telefon Bağlantısı</p>
          <p className="mt-1 truncate text-[11px] font-bold text-slate-600">{phoneUrl || "Ağ adresi belirleniyor..."}</p>
          {phoneLinkExpiresAt && <p className="mt-1 text-[10px] font-bold text-slate-500">
            {phoneLinkIsPublic ? "İnternet bağlantısı" : "Yerel ağ bağlantısı"} • {new Date(phoneLinkExpiresAt).toLocaleString("tr-TR")} tarihine kadar geçerli
          </p>}
          {phoneLinkError && <p className="mt-1 text-[10px] font-bold text-rose-600">{phoneLinkError}</p>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={!phoneUrl} onClick={copyPhoneLink} className="flex h-9 items-center justify-center gap-2 rounded-xl bg-orange-600 px-3 text-[14.67px] font-black text-white hover:bg-orange-700 disabled:bg-slate-300"><Copy className="h-3.5 w-3.5" />{linkCopied ? "Kopyalandı" : "Linki Kopyala"}</button>
            <button type="button" disabled={!phoneUrl} onClick={() => window.open(phoneUrl, "_blank", "noopener,noreferrer")} className="flex h-9 items-center justify-center gap-2 rounded-xl border border-orange-300 bg-white px-3 text-xs font-black text-orange-700 hover:bg-orange-100 disabled:text-slate-300"><ExternalLink className="h-3.5 w-3.5" />Bağlantıyı Aç</button>
          </div>
          <div className="mt-3 rounded-xl border border-orange-200 bg-white/80 p-2.5">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <select value={selectedTeacherId} onChange={(event) => setSelectedTeacherId(event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700">
                {availableTeachers.length === 0 && <option value="">Öğretmen kaydı bulunamadı</option>}
                {availableTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.phone ? ` • ${teacher.phone}` : " • Telefon yok"}</option>)}
              </select>
              <button type="button" onClick={sendLinkToTeacher} disabled={!phoneUrl || !phoneLinkId || !selectedTeacherId || isSendingTeacherLink} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13.67px] font-black text-white hover:bg-emerald-700 disabled:bg-slate-300">
                <Send className="h-3.5 w-3.5" />{isSendingTeacherLink ? "Gönderiliyor..." : "Öğretmene Gönder"}
              </button>
            </div>
            {(reminderNotice || activeReminder) && <div className={`mt-2 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[10px] font-bold ${activeReminder ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
              <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{reminderNotice || `${activeReminder?.teacherName} için fiş yüklemesi bekleniyor.`}{activeReminder ? ` Sonraki kontrol: ${new Date(new Date(activeReminder.lastSentAt).getTime() + REMINDER_INTERVAL_MS).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}.` : ""}</span>
              {activeReminder && <button type="button" onClick={() => stopReminder("Hatırlatmalar kullanıcı tarafından durduruldu.")} className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[9px] font-black text-amber-800"><Square className="h-2.5 w-2.5 fill-current" />Durdur</button>}
            </div>}
          </div>
        </div>}

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fiş Kimliği</span>
              <p className={`mt-1 text-sm font-black ${classroom ? "text-slate-900" : "text-slate-500"}`}>
                {isIdentifying ? "Karekod okunuyor..." : classroom ? `${classroom.name} • ${scanDate.split("-").reverse().join(".")}` : "Fiş görseli bekleniyor"}
              </p>
            </div>
            <button type="button" onClick={() => {
              setShowManualClass((current) => !current);
              if (!classroomId) setClassroomId(classrooms[0]?.id || "");
            }} className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-black text-slate-700 hover:bg-slate-100">
              {showManualClass ? "Seçimi Gizle" : "Sınıfı Elle Seç"}
            </button>
          </div>
          {identityMessage && <p className={`mt-2 text-xs font-bold ${showManualClass ? "text-amber-700" : "text-emerald-700"}`}>{identityMessage}</p>}
        </div>

        {showManualClass && <div className="mt-3 grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Sınıf / Şube</span>
            <select value={classroomId} onChange={(event) => { setClassroomId(event.target.value); resetReading(); }} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
              {classrooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Yoklama Tarihi</span>
            <input type="date" value={scanDate} onChange={(event) => setScanDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" />
          </label>
        </div>}

        <div className="mt-4 overflow-hidden rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/60 p-3">
          {cameraOpen ? <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} autoPlay muted playsInline className="aspect-[3/4] max-h-[68vh] w-full object-cover sm:aspect-[4/3]" />
            <div className="pointer-events-none absolute inset-[5%] rounded-lg border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" />
            <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black text-white">Fişin dört köşesini çerçeveye yerleştirin</span>
          </div> : previewUrl ? <div className="flex min-h-36 items-center justify-center"><img src={previewUrl} alt="Okutulacak yoklama fişi" className="max-h-72 rounded-xl border border-slate-200 bg-white object-contain shadow-sm" /></div> : <div className="flex min-h-36 flex-col items-center justify-center p-4 text-center">
            <Camera className="h-8 w-8 text-sky-600" />
            <span className="mt-2 text-sm font-black text-slate-800">Optik fişi kamerada görüntüle ve çek</span>
            <span className="mt-1 text-xs font-medium text-slate-500">Canlı kamera, telefon kamerası veya kayıtlı görsel kullanılabilir</span>
          </div>}

          {cameraError && <div className="mt-3 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{cameraError}</span></div>}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cameraOpen ? <>
              <button type="button" onClick={captureCameraFrame} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 text-[14.67px] font-black text-white hover:bg-sky-800"><Camera className="h-4 w-4" /> Fotoğrafı Çek</button>
              <button type="button" onClick={stopCamera} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-[14.67px] font-black text-slate-700 hover:bg-slate-100"><CameraOff className="h-4 w-4" /> Kamerayı Kapat</button>
            </> : <button type="button" onClick={startCamera} disabled={isStartingCamera} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 text-[14.67px] font-black text-white hover:bg-sky-800 disabled:bg-slate-300"><Camera className="h-4 w-4" /> {isStartingCamera ? "Kamera Açılıyor..." : "Canlı Kamerayı Aç"}</button>}
            {!cameraOpen && <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 text-center text-xs font-black text-orange-700 hover:bg-orange-100"><Camera className="h-4 w-4" /> Telefon Kamerası<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} /></label>}
            {!cameraOpen && <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-center text-xs font-black text-slate-700 hover:bg-slate-100"><FileImage className="h-4 w-4" /> Görsel Seç<input type="file" accept="image/*" className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} /></label>}
          </div>
        </div>

        <button type="button" onClick={readForm} disabled={!file || !classroom || classStudents.length === 0 || isReading || isIdentifying} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[16.67px] font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
          {isReading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <ScanLine className="h-5 w-5" />}
          {isReading ? "Optik işaretler okunuyor..." : "Fişi Oku"}
        </button>

        {message && <div className={`mt-4 flex gap-2 rounded-xl border p-3 text-xs font-bold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>}
      </section>

      <section ref={resultSectionRef} className="scroll-mt-4 flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">Okuma Sonucu ve Doğrulama</h3>
          </div>
          <span className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">{absentCount} öğrenci yok</span>
        </div>

        <div className="min-h-[320px] flex-1 overflow-auto">
          {!markedLessons ? <div className="flex h-full min-h-96 flex-col items-center justify-center p-8 text-center text-slate-400">
            <FileImage className="h-10 w-10" />
            <p className="mt-3 text-sm font-black">Henüz okunmuş fiş yok</p>
            <p className="mt-1 max-w-sm text-xs font-medium">Fişin fotoğrafını yükleyin. Sınıf ve tarih karekoddan belirlendikten sonra “Fişi Oku” düğmesine basın.</p>
          </div> : studentsForReview.length === 0 ? <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="mt-3 text-sm font-black text-slate-800">Öğrenci listesi görüntülenemedi</p>
            <p className="mt-1 max-w-sm text-xs font-medium text-slate-500">Sınıfı elle seçip fişi yeniden okutun. Okuma sonucu kaybolmadan öğrenci listesi yeniden eşleştirilecektir.</p>
          </div> : <>
          <div className="divide-y divide-slate-100 md:hidden">
            {studentsForReview.map((student, rowIndex) => <article key={`${student.id}-${rowIndex}`} className={`p-3 ${markedLessons[rowIndex]?.length ? "bg-rose-50/70" : "bg-white"}`}>
              <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-black text-slate-900">{studentNumber(student)} · {student.name}</p><p className="mt-0.5 text-[10px] font-bold text-slate-500">Girmediği dersleri kontrol edin</p></div><span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${markedLessons[rowIndex]?.length ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{markedLessons[rowIndex]?.length || 0} ders</span></div>
              <div className="mt-2 grid grid-cols-8 gap-1">{Array.from({ length: 8 }, (_, lessonIndex) => {
                const lesson = lessonIndex + 1;
                const checked = markedLessons[rowIndex]?.includes(lesson) || false;
                return <button key={lesson} type="button" onClick={() => toggleLesson(rowIndex, lesson)} className={`flex h-8 items-center justify-center rounded-lg border text-[10px] font-black ${checked ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{lesson}</button>;
              })}</div>
            </article>)}
          </div>
          <div className="hidden overflow-auto md:block"><table className="w-full min-w-[720px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
              <tr><th className="px-3 py-3 text-left">No</th><th className="px-3 py-3 text-left">Öğrenci</th>{Array.from({ length: 8 }, (_, index) => <th key={index} className="px-2 py-3 text-center">{index + 1}</th>)}</tr>
            </thead>
            <tbody>
              {studentsForReview.map((student, rowIndex) => <tr key={`${student.id}-${rowIndex}`} className={`border-t border-slate-100 ${markedLessons[rowIndex]?.length ? "bg-rose-50/70" : "bg-white"}`}>
                <td className="px-3 py-2.5 font-black text-slate-700">{studentNumber(student)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-800">{student.name}</td>
                {Array.from({ length: 8 }, (_, lessonIndex) => {
                  const lesson = lessonIndex + 1;
                  const checked = markedLessons[rowIndex]?.includes(lesson) || false;
                  return <td key={lesson} className="px-2 py-2.5 text-center"><button type="button" onClick={() => toggleLesson(rowIndex, lesson)} className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg border text-[10px] font-black ${checked ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 bg-white text-transparent hover:border-slate-400"}`}>✓</button></td>;
                })}
              </tr>)}
            </tbody>
          </table></div></>}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" onClick={saveReading} disabled={!markedLessons} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[16.67px] font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            <Save className="h-4 w-4" /> Kontrol Kuyruğuna Gönder
          </button>
        </div>
      </section>
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-black text-slate-900">Son Optik Yoklama Kayıtları</h3></div>
      {records.length === 0 ? <p className="p-6 text-center text-xs font-bold text-slate-400">Henüz kaydedilmiş optik yoklama bulunmuyor.</p> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">Sınıf</th><th className="px-4 py-3 text-left">Gelmeyenler</th><th className="px-4 py-3 text-left">Kayıt zamanı</th></tr></thead><tbody>{records.slice(0, 20).map((record) => <tr key={record.id} className="border-t border-slate-100"><td className="px-4 py-3 font-bold">{record.date.split("-").reverse().join(".")}</td><td className="px-4 py-3 font-black">{record.classroomName}</td><td className="px-4 py-3">{record.absentStudents.length ? record.absentStudents.map((item) => `${item.studentNumber} ${item.studentName} (${item.lessons.join(",")}. ders)`).join(" • ") : "Yok"}</td><td className="px-4 py-3 text-slate-500">{new Date(record.createdAt).toLocaleString("tr-TR")}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
