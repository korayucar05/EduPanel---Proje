import React, { useState } from "react";
import {
  School,
  Phone,
  Mail,
  MapPin,
  Globe,
  Calendar,
  Award,
  Users,
  BookOpen,
  Save,
  Edit2,
  CheckCircle2,
  Building,
  FileText,
  X,
  Copy,
  Plus,
  Trash2,
  Clock,
  ArrowRight,
  Upload,
  Info,
  FileSpreadsheet,
  Search,
  Database,
  Download,
  RefreshCw,
} from "lucide-react";

import { sqliteStorage } from "../core/state/SyncStateStore";
import type { Classroom } from "../types";
import ResponsibilityExamSeatingPlanModule from "./ResponsibilityExamSeatingPlanModule";
interface SchoolInfoState {
  name: string;
  code: string;
  taxNumber: string;
  foundingYear: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  principalName: string;
  semester: string;
  capacity: string;
}

interface SchoolInfoStateA {
  instLine1: string;
  instLine2: string;
  instLine3: string;
  officialName: string;
  mebCode: string;
  principalName: string;
  phone: string;
  website: string;
  activeSemester: string;
  address: string;
}

export default function SchoolInfoModule({ classrooms = [] }: { classrooms?: Classroom[] } = {}) {
  const [activeTab, setActiveTab] = useState<"timetable" | "tab_a" | "building">("tab_a");
  const [isEditing, setIsEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; content: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // States for Custom Tab A Form (A Dosyası)
  const [infoA, setInfoA] = useState<SchoolInfoStateA>(() => {
    try {
      const saved = sqliteStorage.getItem("school_info_a_profile");
      return saved
        ? JSON.parse(saved)
        : {
            instLine1: "T.C.",
            instLine2: "ORDU VALİLİĞİ",
            instLine3: "ORDU LİSESİ MÜDÜRLÜĞÜ",
            officialName: "Ordu Lisesi",
            mebCode: "198302",
            principalName: "Koray Uçar",
            phone: "+90 452 214 10 10",
            website: "https://ordulisesi.meb.k12.tr",
            activeSemester: "2025-2026",
            address: "Ordu, Türkiye",
          };
    } catch {
      return {
        instLine1: "",
        instLine2: "",
        instLine3: "",
        officialName: "",
        mebCode: "",
        principalName: "",
        phone: "",
        website: "",
        activeSemester: "",
        address: "",
      };
    }
  });

  const [formDataA, setFormDataA] = useState<SchoolInfoStateA>({ ...infoA });
  const [isEditingA, setIsEditingA] = useState(false);

  const [info, setInfo] = useState<SchoolInfoState>(() => {
    try {
      const saved = sqliteStorage.getItem("school_info");
      return saved
        ? JSON.parse(saved)
        : {
            name: "",
            code: "",
            taxNumber: "",
            foundingYear: "",
            email: "",
            phone: "",
            website: "",
            address: "",
            principalName: "",
            semester: "",
            capacity: "",
          };
    } catch {
      return {
        name: "",
        code: "",
        taxNumber: "",
        foundingYear: "",
        email: "",
        phone: "",
        website: "",
        address: "",
        principalName: "",
        semester: "",
        capacity: "",
      };
    }
  });

  // Kurum Başlığı state (3 lines)
  const [instLines, setInstLines] = useState<string[]>(() => {
    const saved = sqliteStorage.getItem("school_inst_lines");
    return saved
      ? JSON.parse(saved)
      : ["", "", ""];
  });

  // Effect to automatically clear mock default values on mount
  React.useEffect(() => {
    try {
      const saved = sqliteStorage.getItem("school_info");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name === "Ordu Lisesi" || parsed.principalName === "Koray Uçar" || parsed.semester === "2025-2026") {
          sqliteStorage.removeItem("school_info");
          sqliteStorage.removeItem("school_inst_lines");
          const emptyInfo = {
            name: "",
            code: "",
            taxNumber: "",
            foundingYear: "",
            email: "",
            phone: "",
            website: "",
            address: "",
            principalName: "",
            semester: "",
            capacity: "",
          };
          setInfo(emptyInfo);
          setFormData(emptyInfo);
          setInstLines(["", "", ""]);
          setInstTempLines(["", "", ""]);
        }
      }
    } catch (e) {
      console.error("Error cleaning default school info:", e);
    }
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setUploadedFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        content: text
      });

      if (file.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          const newInfo = {
            name: parsed.name || parsed.okulAdi || "",
            code: parsed.code || parsed.mebKodu || parsed.kod || "",
            taxNumber: parsed.taxNumber || parsed.vergiNo || "",
            foundingYear: parsed.foundingYear || parsed.kurulusYili || "",
            email: parsed.email || parsed.eposta || "",
            phone: parsed.phone || parsed.telefon || "",
            website: parsed.website || parsed.webSitesi || "",
            address: parsed.address || parsed.adres || "",
            principalName: parsed.principalName || parsed.mudur || parsed.kurucu || "",
            semester: parsed.semester || parsed.donem || "",
            capacity: parsed.capacity || parsed.kontenjan || "",
          };
          setInfo(newInfo);
          setFormData(newInfo);
          sqliteStorage.setItem("school_info", JSON.stringify(newInfo));

          if (parsed.instLines && Array.isArray(parsed.instLines)) {
            setInstLines(parsed.instLines);
            setInstTempLines(parsed.instLines);
            sqliteStorage.setItem("school_inst_lines", JSON.stringify(parsed.instLines));
          } else if (parsed.baslik && Array.isArray(parsed.baslik)) {
            setInstLines(parsed.baslik);
            setInstTempLines(parsed.baslik);
            sqliteStorage.setItem("school_inst_lines", JSON.stringify(parsed.baslik));
          }
          setSuccessMsg("Dosya içeriği başarıyla çözümlendi ve bilgiler dolduruldu!");
          setTimeout(() => setSuccessMsg(""), 4000);
        } catch (err) {
          console.error("JSON parsing failed", err);
        }
      } else {
        setSuccessMsg(`"${file.name}" başarıyla yüklendi! Yapay zeka bu dosya verileriyle arayüzü düzenlemeye hazırdır.`);
        setTimeout(() => setSuccessMsg(""), 5000);
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    const emptyInfo: SchoolInfoState = {
      name: "",
      code: "",
      taxNumber: "",
      foundingYear: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      principalName: "",
      semester: "",
      capacity: "",
    };
    const emptyInst = ["", "", ""];
    setInfo(emptyInfo);
    setFormData(emptyInfo);
    setInstLines(emptyInst);
    setInstTempLines(emptyInst);
    setUploadedFile(null);
    sqliteStorage.removeItem("school_info");
    sqliteStorage.removeItem("school_inst_lines");
    setSuccessMsg("Tüm veriler başarıyla temizlendi! Yeni dosya bilgileri bekleniyor.");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  // Helper functions for Tab A Form (A Dosyası)
  const handleInputChangeA = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: keyof SchoolInfoStateA
  ) => {
    setFormDataA((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSaveA = (e: React.FormEvent) => {
    e.preventDefault();
    setInfoA(formDataA);
    sqliteStorage.setItem("school_info_a_profile", JSON.stringify(formDataA));
    setSuccessMsg("A Dosyası bilgileri başarıyla kaydedildi!");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleClearAllDataA = () => {
    const emptyInfoA: SchoolInfoStateA = {
      instLine1: "",
      instLine2: "",
      instLine3: "",
      officialName: "",
      mebCode: "",
      principalName: "",
      phone: "",
      website: "",
      activeSemester: "",
      address: "",
    };
    setInfoA(emptyInfoA);
    setFormDataA(emptyInfoA);
    sqliteStorage.setItem("school_info_a_profile", JSON.stringify(emptyInfoA));
    setSuccessMsg("A Dosyası verileri başarıyla temizlendi!");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const [isInstEditing, setIsInstEditing] = useState(false);
  const [instTempLines, setInstTempLines] = useState<string[]>([]);

  const handleInstSave = (e: React.FormEvent) => {
    e.preventDefault();
    setInstLines(instTempLines);
    try {
      sqliteStorage.setItem("school_inst_lines", JSON.stringify(instTempLines));
    } catch (err) {
      console.error("Failed to save school institution lines to local storage:", err);
    }
    setIsInstEditing(false);
    setSuccessMsg("Kurum başlığı başarıyla güncellendi !");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleInstCancel = () => {
    setInstTempLines([...instLines]);
    setIsInstEditing(false);
  };

  const [formData, setFormData] = useState<SchoolInfoState>(() => {
    try {
      const saved = sqliteStorage.getItem("school_info");
      return saved
        ? JSON.parse(saved)
        : {
            name: "",
            code: "",
            taxNumber: "",
            foundingYear: "",
            email: "",
            phone: "",
            website: "",
            address: "",
            principalName: "",
            semester: "",
            capacity: "",
          };
    } catch {
      return {
        name: "",
        code: "",
        taxNumber: "",
        foundingYear: "",
        email: "",
        phone: "",
        website: "",
        address: "",
        principalName: "",
        semester: "",
        capacity: "",
      };
    }
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setInfo(formData);
    setInstLines(instTempLines);
    try {
      sqliteStorage.setItem("school_info", JSON.stringify(formData));
      sqliteStorage.setItem("school_inst_lines", JSON.stringify(instTempLines));
    } catch (err) {
      console.error("Failed to save school credentials to database", err);
    }
    setIsEditing(false);
    setSuccessMsg("Okul bilgileri başarıyla güncellendi !");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleCancel = () => {
    setFormData({ ...info });
    setInstTempLines([...instLines]);
    setIsEditing(false);
  };

  const DAYS_OF_WEEK = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

  const DEFAULT_SLOTS = [
    { hour: 1, start: "08:30", end: "09:10", breakDuration: 10 },
    { hour: 2, start: "09:20", end: "10:00", breakDuration: 10 },
    { hour: 3, start: "10:10", end: "10:50", breakDuration: 10 },
    { hour: 4, start: "11:00", end: "11:40", breakDuration: 10 },
    { hour: 5, start: "11:50", end: "12:30", breakDuration: 60 },
    { hour: 6, start: "13:30", end: "14:10", breakDuration: 10 },
    { hour: 7, start: "14:20", end: "15:00", breakDuration: 10 },
    { hour: 8, start: "15:10", end: "15:50", breakDuration: 10 },
  ];

  const [timetableByDay, setTimetableByDay] = useState<{ [key: string]: typeof DEFAULT_SLOTS }>(() => {
    const saved = sqliteStorage.getItem("school_timetable_by_day");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const checkedDict: { [key: string]: typeof DEFAULT_SLOTS } = {};
          let hasAtLeastOneValidDay = false;
          DAYS_OF_WEEK.forEach((day) => {
            if (parsed[day] && Array.isArray(parsed[day]) && parsed[day].length > 0) {
              checkedDict[day] = parsed[day].map((slot: any) => ({
                hour: Number(slot.hour) || 1,
                start: slot.start || "08:30",
                end: slot.end || "09:10",
                breakDuration: slot.breakDuration !== undefined ? Number(slot.breakDuration) : 10
              }));
              hasAtLeastOneValidDay = true;
            }
          });
          if (hasAtLeastOneValidDay) {
            DAYS_OF_WEEK.forEach((day) => {
              if (!checkedDict[day]) {
                checkedDict[day] = JSON.parse(JSON.stringify(DEFAULT_SLOTS));
              }
            });
            return checkedDict;
          }
        }
      } catch (e) {}
    }

    const singleSaved = sqliteStorage.getItem("school_timetable");
    let initialSlots = DEFAULT_SLOTS;
    if (singleSaved) {
      try {
        const parsed = JSON.parse(singleSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialSlots = parsed.map((slot) => ({
            hour: Number(slot.hour) || 1,
            start: slot.start || "08:30",
            end: slot.end || "09:10",
            breakDuration: slot.breakDuration !== undefined ? Number(slot.breakDuration) : 10
          }));
        }
      } catch (e) {}
    }

    const dict: { [key: string]: typeof DEFAULT_SLOTS } = {};
    DAYS_OF_WEEK.forEach((d) => {
      dict[d] = JSON.parse(JSON.stringify(initialSlots));
    });
    return dict;
  });

  const [selectedDay, setSelectedDay] = useState("Pazartesi");
  const [isTimetableEditing, setIsTimetableEditing] = useState(false);
  const [timetableFormData, setTimetableFormData] = useState<typeof DEFAULT_SLOTS>([]);
  const [autoCascade, setAutoCascade] = useState(true);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetDays, setAssignTargetDays] = useState<string[]>([]);

  const cascadeSlots = (slots: typeof DEFAULT_SLOTS) => {
    const newSlots = [...slots];
    for (let i = 1; i < newSlots.length; i++) {
      const prev = newSlots[i - 1];
      const prevBreak = prev.breakDuration !== undefined ? prev.breakDuration : 10;

      if (!prev || !prev.end || !prev.end.includes(":")) continue;

      const [prevEndH, prevEndM] = prev.end.split(":").map(Number);
      if (!isNaN(prevEndH) && !isNaN(prevEndM)) {
        let startTotalMins = prevEndH * 60 + prevEndM + prevBreak;
        const startH = Math.floor(startTotalMins / 60) % 24;
        const startM = startTotalMins % 60;
        const startStr = `${startH.toString().padStart(2, "0")}:${startM.toString().padStart(2, "0")}`;

        let duration = 40;
        if (prev.start && prev.start.includes(":")) {
          const [pStartH, pStartM] = prev.start.split(":").map(Number);
          if (!isNaN(pStartH) && !isNaN(pStartM)) {
            duration = (prevEndH * 60 + prevEndM) - (pStartH * 60 + pStartM);
            if (duration <= 0) duration = 40;
          }
        }

        let endTotalMins = startTotalMins + duration;
        const endH = Math.floor(endTotalMins / 60) % 24;
        const endM = endTotalMins % 60;
        const endStr = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

        newSlots[i] = {
          ...newSlots[i],
          start: startStr,
          end: endStr
        };
      }
    }
    return newSlots;
  };

  const handleTimetableChange = (index: number, field: "start" | "end" | "breakDuration", value: string | number) => {
    let newTimetable = [...timetableFormData];
    if (field === "breakDuration") {
      newTimetable[index] = { ...newTimetable[index], breakDuration: Number(value) };
    } else {
      newTimetable[index] = { ...newTimetable[index], [field]: String(value) };
    }

    if (autoCascade) {
      newTimetable = cascadeSlots(newTimetable);
    }
    setTimetableFormData(newTimetable);
  };

  const triggerManualCascade = () => {
    const updated = cascadeSlots(timetableFormData);
    setTimetableFormData(updated);
    setSuccessMsg("Tüm saatler teneffüs sürelerine göre otomatik güncellendi!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleTimetableSave = (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const updatedByDay = {
      ...timetableByDay,
      [selectedDay]: timetableFormData
    };
    setTimetableByDay(updatedByDay);
    
    try {
      sqliteStorage.setItem("school_timetable_by_day", JSON.stringify(updatedByDay));
      sqliteStorage.setItem("school_timetable", JSON.stringify(timetableFormData));
    } catch (err) {
      console.error("Failed to save timetable to local storage:", err);
    }

    setIsTimetableEditing(false);
    setSuccessMsg(`${selectedDay} günü zaman çizelgesi başarıyla kaydedildi!`);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleTimetableCancel = () => {
    setIsTimetableEditing(false);
  };

  const handleOpenAssignModal = () => {
    setAssignTargetDays(DAYS_OF_WEEK.filter((d) => d !== selectedDay));
    setShowAssignModal(true);
  };

  const handleApplyAssign = () => {
    const currentSlots = isTimetableEditing ? timetableFormData : timetableByDay[selectedDay];
    const updatedByDay = { ...timetableByDay };

    assignTargetDays.forEach((day) => {
      updatedByDay[day] = JSON.parse(JSON.stringify(currentSlots));
    });

    setTimetableByDay(updatedByDay);
    
    try {
      sqliteStorage.setItem("school_timetable_by_day", JSON.stringify(updatedByDay));
    } catch (err) {
      console.error("Failed to copy timetable by day to local storage:", err);
    }

    if (isTimetableEditing) {
      updatedByDay[selectedDay] = timetableFormData;
      setTimetableByDay(updatedByDay);
      try {
        sqliteStorage.setItem("school_timetable", JSON.stringify(timetableFormData));
      } catch (err) {
        console.error("Failed to save default school timetable to local storage:", err);
      }
    }

    setShowAssignModal(false);
    setSuccessMsg(`${selectedDay} zaman planlaması seçilen günlere başarıyla kopyalandı!`);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleAddLesson = () => {
    const newHour = timetableFormData.length + 1;
    let newSlot = { hour: newHour, start: "16:00", end: "16:40", breakDuration: 10 };
    if (timetableFormData.length > 0) {
      const prev = timetableFormData[timetableFormData.length - 1];
      const prevBreak = prev.breakDuration !== undefined ? prev.breakDuration : 10;
      if (prev && prev.end && prev.end.includes(":")) {
        const [prevEndH, prevEndM] = prev.end.split(":").map(Number);
        if (!isNaN(prevEndH) && !isNaN(prevEndM)) {
          let startTotalMins = prevEndH * 60 + prevEndM + prevBreak;
          const startH = Math.floor(startTotalMins / 60) % 24;
          const startM = startTotalMins % 60;
          const startStr = `${startH.toString().padStart(2, "0")}:${startM.toString().padStart(2, "0")}`;

          let endTotalMins = startTotalMins + 40;
          const endH = Math.floor(endTotalMins / 60) % 24;
          const endM = endTotalMins % 60;
          const endStr = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

          newSlot = { hour: newHour, start: startStr, end: endStr, breakDuration: 10 };
        }
      }
    }
    setTimetableFormData([...timetableFormData, newSlot]);
  };

  const handleRemoveLesson = () => {
    if (timetableFormData.length <= 1) return;
    setTimetableFormData(timetableFormData.slice(0, -1));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pb-6 pt-0 lg:px-8 lg:pb-8 lg:pt-0">
      {/* Container to match other modules */}
      <div className="bg-white border-2 border-dashed border-purple-950 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        {/* Left purple area */}
        <div className="bg-purple-950 bg-theme-pattern p-1.5 rounded-2xl flex items-center overflow-x-auto gap-1 w-full flex-1 md:w-auto scrollbar-hide shrink-0 h-[52px]">
          <button
            onClick={() => setActiveTab("tab_a")}
            className={`flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all border whitespace-nowrap h-[40px] ${
              activeTab === "tab_a"
                ? "bg-white text-purple-900 border-transparent shadow-sm"
                : "bg-purple-950/40 text-purple-100 border-transparent hover:bg-purple-900"
            }`}
          >
            <Database className="w-4 h-4 shrink-0" />
            <span>Temel Bilgiler</span>
          </button>
          
          <button
            onClick={() => setActiveTab("timetable")}
            className={`flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all border whitespace-nowrap h-[40px] ${
              activeTab === "timetable"
                ? "bg-white text-purple-900 border-transparent shadow-sm"
                : "bg-purple-950/40 text-purple-100 border-transparent hover:bg-purple-900"
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Zaman Çizelgesi</span>
          </button>
          
          <button
            onClick={() => setActiveTab("building")}
            className={`flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all border whitespace-nowrap h-[40px] ${
              activeTab === "building"
                ? "bg-white text-purple-900 border-transparent shadow-sm"
                : "bg-purple-950/40 text-purple-100 border-transparent hover:bg-purple-900"
            }`}
          >
            <Building className="w-4 h-4 shrink-0" />
            <span>Bina Bilgileri</span>
          </button>
        </div>

        <div className="shrink-0 flex items-center">
          {activeTab === "timetable" && !isTimetableEditing && (
            <button
              onClick={() => {
                setTimetableFormData(JSON.parse(JSON.stringify(timetableByDay[selectedDay] || DEFAULT_SLOTS)));
                setIsTimetableEditing(true);
              }}
              className="bg-purple-950 hover:bg-purple-900 water-ripple-hover text-white font-bold text-xs px-5 rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-purple-950/10 hover:scale-[1.01] transition-all whitespace-nowrap h-[52px]"
            >
              <Edit2 className="w-4 h-4 shrink-0" />
              <span>Çizelgeyi Düzenle</span>
            </button>
          )}
        </div>
      </div>

      {/* Action alerts */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-xl animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}


      {activeTab === "building" && (
        <div className="animate-fadeIn">
          <ResponsibilityExamSeatingPlanModule embedded classrooms={classrooms} />
        </div>
      )}

      {activeTab === "timetable" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Day selection tabs */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">GÜNLÜK ZAMAN YÖNETİMİ</span>
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                {selectedDay} Günü Ders Programı Planı
              </h3>
            </div>
            
            <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
              {DAYS_OF_WEEK.map((day) => {
                const isActive = selectedDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => {
                      setSelectedDay(day);
                      if (isTimetableEditing) {
                        setTimetableFormData(JSON.parse(JSON.stringify(timetableByDay[day] || DEFAULT_SLOTS)));
                      }
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? "bg-purple-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-150/60"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">Ders Saatleri ve Teneffüs Çizelgesi</h4>
                  <p className="text-xs text-slate-400 font-medium">Ders sürelerini ve aralardaki dinlenme (teneffüs) sürelerini planlayın.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isTimetableEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenAssignModal}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Copy className="w-4 h-4" />
                      Planlamayı Günlere Ata
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimetableFormData(JSON.parse(JSON.stringify(timetableByDay[selectedDay] || DEFAULT_SLOTS)));
                        setIsTimetableEditing(true);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-purple-600/10 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                      Düzenle
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/85 px-3 py-1.5 rounded-xl mr-1">
                      <input
                        id="auto-cascade-checkbox"
                        type="checkbox"
                        checked={autoCascade}
                        onChange={(e) => setAutoCascade(e.target.checked)}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <label htmlFor="auto-cascade-checkbox" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                        Otomatik yansıt
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={triggerManualCascade}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-750 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="Süreleri toplayarak sıralar."
                    >
                      Otomatik Sırala
                    </button>

                    <button
                      type="button"
                      onClick={handleAddLesson}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ders Ekle
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveLesson}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Ders Sil
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50/50">
                    <th className="py-3 px-4 text-xs font-black text-slate-500 uppercase tracking-wider w-[140px]">Ders No</th>
                    <th className="py-3 px-4 text-xs font-black text-slate-500 uppercase tracking-wider w-[200px]">Giriş Saati</th>
                    <th className="py-3 px-4 text-xs font-black text-slate-500 uppercase tracking-wider w-[200px]">Çıkış Saati</th>
                    <th className="py-3 px-4 text-xs font-black text-slate-500 uppercase tracking-wider">Teneffüs Süresi</th>
                  </tr>
                </thead>
                <tbody>
                  {(isTimetableEditing ? (Array.isArray(timetableFormData) ? timetableFormData : []) : (Array.isArray(timetableByDay[selectedDay]) ? timetableByDay[selectedDay] : DEFAULT_SLOTS)).map((slot, idx, arr) => {
                    return (
                      <tr key={idx} className="border-b border-slate-100/50 hover:bg-slate-50/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-xs text-purple-900 bg-purple-50 border border-purple-100/60 px-3 py-1.5 rounded-xl inline-flex w-20 justify-center shadow-xs">
                            {slot.hour}. Ders
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isTimetableEditing ? (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="time"
                                value={slot.start}
                                onChange={(e) => handleTimetableChange(idx, "start", e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none w-32 shadow-xs transition-all"
                              />
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-slate-750 bg-slate-100/50 px-3 py-1.5 rounded-xl border border-slate-150/40">{slot.start}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {isTimetableEditing ? (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="time"
                                value={slot.end}
                                onChange={(e) => handleTimetableChange(idx, "end", e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none w-32 shadow-xs transition-all"
                              />
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-slate-750 bg-slate-100/50 px-3 py-1.5 rounded-xl border border-slate-150/40">{slot.end}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {isTimetableEditing ? (
                            <div className="flex items-center gap-2.5 max-w-[200px]">
                              <input
                                type="number"
                                min={0}
                                max={180}
                                value={slot.breakDuration !== undefined ? slot.breakDuration : 10}
                                onChange={(e) => handleTimetableChange(idx, "breakDuration", e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none w-20 shadow-xs transition-all"
                              />
                              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Dakika Teneffüs</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-650 bg-purple-50/20 text-purple-950 border border-purple-100/40 px-3 py-1.5 rounded-xl">
                                {slot.breakDuration !== undefined ? slot.breakDuration : 10} Dakika
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isTimetableEditing && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTimetableCancel}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleTimetableSave}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  Değişiklikleri Kaydet
                </button>
              </div>
            )}
          </div>

          {/* Copy Planning to Days Modal */}
          {showAssignModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={() => setShowAssignModal(false)}
              />
              
              <div className="relative bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <Copy className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">Zaman Çizelgesini Günlere Ata</h3>
                      <p className="text-[11px] font-medium text-slate-400">Şu anki planı diğer günlere kopyalayın.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-slate-600 font-medium">
                    <span className="font-black text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded mr-1">{selectedDay}</span> 
                    gününe ait ders ve teneffüs saatlerini aşağıdaki seçili olan günlere aynen kopyalayarak atayabilirsiniz:
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const isCurrent = day === selectedDay;
                      const isChecked = assignTargetDays.includes(day);
                      return (
                        <label
                          key={day}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                            isCurrent
                              ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                              : isChecked
                              ? "bg-indigo-50/55 border-indigo-200 text-indigo-900 font-extrabold"
                              : "bg-white border-slate-150 hover:border-slate-300 text-slate-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isCurrent}
                            checked={isChecked && !isCurrent}
                            onChange={() => {
                              if (isChecked) {
                                setAssignTargetDays(assignTargetDays.filter((d) => d !== day));
                              } else {
                                setAssignTargetDays([...assignTargetDays, day]);
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <span className="text-xs font-bold">{day}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 justify-start pt-1">
                    <button
                      type="button"
                      onClick={() => setAssignTargetDays(DAYS_OF_WEEK.filter((d) => d !== selectedDay))}
                      className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-wide cursor-pointer"
                    >
                      Tümünü Seç
                    </button>
                    <span className="text-slate-300 text-xs">|</span>
                    <button
                      type="button"
                      onClick={() => setAssignTargetDays([])}
                      className="text-[10px] font-black text-slate-400 hover:underline uppercase tracking-wide cursor-pointer"
                    >
                      Temizle
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyAssign}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Seçili Günlere Ata
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "tab_a" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Interactive Form */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Kurumsal Bilgiler Formu</h3>
                    <p className="text-xs text-slate-400 font-medium">Alanları el ile doldurup kaydedebilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearAllDataA}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Temizle
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveA} className="space-y-6">
                {/* Kurum Başlığı Satırları */}
                <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-purple-700 tracking-wider uppercase">Kurum Başlığı</span>
                    <span className="text-[10px] text-slate-400 font-medium">(Resmi Yazışma Başlığı)</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        1. Satır (Örn: T.C.)
                      </label>
                      <input
                        type="text"
                        value={formDataA.instLine1}
                        onChange={(e) => handleInputChangeA(e, "instLine1")}
                        placeholder="Örn: T.C."
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        2. Satır (Örn: ORDU VALİLİĞİ)
                      </label>
                      <input
                        type="text"
                        value={formDataA.instLine2}
                        onChange={(e) => handleInputChangeA(e, "instLine2")}
                        placeholder="Örn: ORDU VALİLİĞİ"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        3. Satır (Örn: ORDU LİSESİ MÜDÜRLÜĞÜ)
                      </label>
                      <input
                        type="text"
                        value={formDataA.instLine3}
                        onChange={(e) => handleInputChangeA(e, "instLine3")}
                        placeholder="Örn: ORDU LİSESİ MÜDÜRLÜĞÜ"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Diğer Bilgiler */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Okulun Resmi Adı
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <School className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={formDataA.officialName}
                        onChange={(e) => handleInputChangeA(e, "officialName")}
                        placeholder="Örn: Ordu Lisesi"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      MEB Kodu
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Award className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={formDataA.mebCode}
                        onChange={(e) => handleInputChangeA(e, "mebCode")}
                        placeholder="Örn: 198302"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Okul Müdürünün Adı Soyadı
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={formDataA.principalName}
                        onChange={(e) => handleInputChangeA(e, "principalName")}
                        placeholder="Örn: Koray Uçar"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Kurum Telefonu
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={formDataA.phone}
                        onChange={(e) => handleInputChangeA(e, "phone")}
                        placeholder="Örn: +90 452 214 10 10"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Kurumsal Web Adresi
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Globe className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={formDataA.website}
                        onChange={(e) => handleInputChangeA(e, "website")}
                        placeholder="Örn: https://ordulisesi.meb.k12.tr"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Aktif Dönem
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={formDataA.activeSemester}
                        onChange={(e) => handleInputChangeA(e, "activeSemester")}
                        placeholder="Örn: 2025-2026 Güz"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Okulun Adresi
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3.5 pointer-events-none text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <textarea
                      value={formDataA.address}
                      onChange={(e) => handleInputChangeA(e, "address")}
                      placeholder="Örn: Ordu, Türkiye"
                      rows={3}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFormDataA({ ...infoA })}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Değişiklikleri İptal Et
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/10 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Bilgileri Kaydet
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Live Institutional Preview */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl" />
                
                <div className="border-b border-slate-800 pb-4">
                  <span className="text-[10px] font-black text-purple-400 tracking-widest uppercase block mb-1">
                    DİNAMİK ÖNİZLEME
                  </span>
                  <h3 className="text-sm font-black text-white">Resmi Kurum Anteti Görünümü</h3>
                </div>

                {/* Institutional Header Letterhead simulation */}
                <div className="bg-white text-slate-800 rounded-2xl p-6 border border-slate-200 shadow-inner flex flex-col items-center justify-center text-center min-h-[140px] space-y-1">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-[10px] border border-red-200 shadow-sm mb-2">
                    T.C.
                  </div>
                  {formDataA.instLine1 ? (
                    <p className="text-[11px] font-black tracking-wider text-slate-900 leading-tight uppercase">
                      {formDataA.instLine1}
                    </p>
                  ) : (
                    <span className="text-[10px] text-slate-300 italic">1. Satır Girilmedi</span>
                  )}
                  {formDataA.instLine2 ? (
                    <p className="text-[11px] font-black tracking-wider text-slate-900 leading-tight uppercase">
                      {formDataA.instLine2}
                    </p>
                  ) : (
                    <span className="text-[10px] text-slate-300 italic">2. Satır Girilmedi</span>
                  )}
                  {formDataA.instLine3 ? (
                    <p className="text-[11px] font-black tracking-wider text-slate-900 leading-tight uppercase">
                      {formDataA.instLine3}
                    </p>
                  ) : (
                    <span className="text-[10px] text-slate-300 italic">3. Satır Girilmedi</span>
                  )}
                </div>

                {/* Info Card List */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
                    <span className="text-slate-400 font-bold">Okulun Resmi Adı:</span>
                    <span className="text-white font-medium text-right max-w-[200px] truncate">
                      {formDataA.officialName || <span className="text-slate-600 italic">Belirtilmedi</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
                    <span className="text-slate-400 font-bold">MEB Kodu:</span>
                    <span className="font-mono text-purple-300 font-bold">
                      {formDataA.mebCode || <span className="text-slate-600 italic">Belirtilmedi</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
                    <span className="text-slate-400 font-bold">Müdür Adı Soyadı:</span>
                    <span className="text-white font-medium">
                      {formDataA.principalName || <span className="text-slate-600 italic">Belirtilmedi</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
                    <span className="text-slate-400 font-bold">Telefon:</span>
                    <span className="text-white font-medium">
                      {formDataA.phone || <span className="text-slate-600 italic">Belirtilmedi</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
                    <span className="text-slate-400 font-bold">Web Adresi:</span>
                    <span className="text-purple-400 font-medium truncate max-w-[180px]">
                      {formDataA.website ? (
                        <a href={formDataA.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {formDataA.website}
                        </a>
                      ) : (
                        <span className="text-slate-600 italic">Belirtilmedi</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
                    <span className="text-slate-400 font-bold">Aktif Dönem:</span>
                    <span className="text-emerald-400 font-bold">
                      {formDataA.activeSemester || <span className="text-slate-600 italic">Belirtilmedi</span>}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs py-2">
                    <span className="text-slate-400 font-bold">Okul Adresi:</span>
                    <span className="text-slate-300 font-medium text-xs leading-relaxed">
                      {formDataA.address || <span className="text-slate-600 italic">Belirtilmedi</span>}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
