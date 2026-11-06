import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import localforage from "../core/state/AppStateService";
import {
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  MapPin,
  Calendar,
  User,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Info,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { Teacher } from "../types";

import { sqliteStorage } from "../core/state/SyncStateStore";
interface DutyLocation {
  id: string;
  name: string;
  zone: string;
  note: string;
}

interface DutyAssignment {
  id: string;
  day: string;
  location: string;
  teacherName: string;
}

interface DutyInfoModuleProps {
  teachers: Teacher[];
}

export default function DutyInfoModule({ teachers }: DutyInfoModuleProps) {
  // 1. Current Active Inner Tab: "locations" or "planner"
  const [activeSubTab, setActiveSubTab] = useState<"locations" | "planner">("locations");

  // 2. States for Duty Locations (Nöbet Yerleri)
  const [locations, setLocations] = useState<DutyLocation[]>([
    { id: "loc-1", name: "Bahçe Nöbeti", zone: "Bahçe", note: "Teneffüslerde bahçe kontrolü ve çevre güvenliği" },
    { id: "loc-2", name: "Zemin Kat & Kantin", zone: "Zemin Kat", note: "Zemin kat koridoru ve kantin çevresi" },
    { id: "loc-3", name: "1. Kat Koridor", zone: "1. Kat", note: "1. kat derslikler koridoru" },
    { id: "loc-4", name: "2. Kat Koridor", zone: "2. Kat", note: "2. kat derslikler koridoru" },
    { id: "loc-5", name: "Zemin Kat & Giriş", zone: "Giriş", note: "Okul ana girişi ve turnike bölgesi" },
  ]);

  // 3. States for Duty Assignments (Nöbet Planlama)
  const [assignments, setAssignments] = useState<DutyAssignment[]>([
    { id: "duty-1", day: "Pazartesi", location: "Bahçe Nöbeti", teacherName: "Ahmet Yılmaz" },
    { id: "duty-2", day: "Pazartesi", location: "Zemin Kat & Kantin", teacherName: "Ayşe Demir" },
    { id: "duty-3", day: "Salı", location: "1. Kat Koridor", teacherName: "Mehmet Kaya" },
    { id: "duty-4", day: "Salı", location: "Bahçe Nöbeti", teacherName: "Fatma Şahin" },
    { id: "duty-5", day: "Çarşamba", location: "2. Kat Koridor", teacherName: "Mustafa Çelik" },
    { id: "duty-6", day: "Çarşamba", location: "Zemin Kat & Giriş", teacherName: "Zeynep Öztürk" },
    { id: "duty-7", day: "Perşembe", location: "Bahçe Nöbeti", teacherName: "Ali Yıldız" },
    { id: "duty-8", day: "Perşembe", location: "1. Kat Koridor", teacherName: "Elif Arslan" },
    { id: "duty-9", day: "Cuma", location: "Bahçe Nöbeti", teacherName: "Murat Aydın" },
    { id: "duty-10", day: "Cuma", location: "Zemin Kat & Kantin", teacherName: "Seda Yıldırım" },
  ]);

  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Load initially
  useEffect(() => {
    async function loadStoredData() {
      try {
        const storedLocs = await localforage.getItem<DutyLocation[]>("school_duty_locations_v1");
        const storedAssigns = await localforage.getItem<DutyAssignment[]>("school_duty_assignments_v1");

        let locsLoaded = false;
        let assignsLoaded = false;

        if (storedLocs && Array.isArray(storedLocs)) {
          setLocations(storedLocs);
          locsLoaded = true;
        }
        if (storedAssigns && Array.isArray(storedAssigns)) {
          setAssignments(storedAssigns);
          assignsLoaded = true;
        }

        // Migration fallback from sqliteStorage
        if (!locsLoaded) {
          try {
            const legacyLocs = sqliteStorage.getItem("school_duty_locations_v1");
            if (legacyLocs) {
              const parsed = JSON.parse(legacyLocs);
              if (Array.isArray(parsed)) {
                setLocations(parsed);
                await localforage.setItem("school_duty_locations_v1", parsed);
              }
            }
          } catch (e) {
            console.error("Failed to read legacy school_duty_locations_v1", e);
          }
        }

        if (!assignsLoaded) {
          try {
            const legacyAssigns = sqliteStorage.getItem("school_duty_assignments_v1");
            if (legacyAssigns) {
              const parsed = JSON.parse(legacyAssigns);
              if (Array.isArray(parsed)) {
                setAssignments(parsed);
                await localforage.setItem("school_duty_assignments_v1", parsed);
              }
            }
          } catch (e) {
            console.error("Failed to read legacy school_duty_assignments_v1", e);
          }
        }
      } catch (err) {
        console.error("Error loading duty data from localforage:", err);
      } finally {
        setIsDbLoaded(true);
      }
    }
    loadStoredData();
  }, []);

  // Save changes to localforage & fallback to sqliteStorage try/catch
  useEffect(() => {
    if (!isDbLoaded) return;

    async function saveData() {
      try {
        await localforage.setItem("school_duty_locations_v1", locations);
      } catch (err) {
        console.error("Error saving duty locations to localforage:", err);
      }

      try {
        sqliteStorage.setItem("school_duty_locations_v1", JSON.stringify(locations));
      } catch (err) {
        console.warn("Storage quota exceeded for sqliteStorage, saved in localforage only.");
      }
    }
    saveData();
  }, [locations, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;

    async function saveData() {
      try {
        await localforage.setItem("school_duty_assignments_v1", assignments);
      } catch (err) {
        console.error("Error saving duty assignments to localforage:", err);
      }

      try {
        sqliteStorage.setItem("school_duty_assignments_v1", JSON.stringify(assignments));
      } catch (err) {
        console.warn("Storage quota exceeded for sqliteStorage, saved in localforage only.");
      }
    }
    saveData();
  }, [assignments, isDbLoaded]);

  // Form states for adding/editing Locations
  const [locForm, setLocForm] = useState({ id: "", name: "", zone: "Bahçe", note: "" });
  const [isEditingLoc, setIsEditingLoc] = useState(false);
  const [locSearch, setLocSearch] = useState("");
  const [locToDelete, setLocToDelete] = useState<DutyLocation | null>(null);

  // Form states for scheduling assignments
  const [assignForm, setAssignForm] = useState({ id: "", day: "Pazartesi", location: "", teacherName: "" });
  const [isEditingAssign, setIsEditingAssign] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>("Tümü");

  // Schedule data states for viewing course program in modal
  const [scheduleData, setScheduleData] = useState<Record<string, any>>({});
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [currentScheduleTeacherIndex, setCurrentScheduleTeacherIndex] = useState(0);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState("Pazartesi");
  const [selectedScheduleLocation, setSelectedScheduleLocation] = useState("");

  const weekdays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  const zones = ["Bahçe", "Zemin Kat", "1. Kat", "2. Kat", "3. Kat", "Giriş", "Kantin", "Diğer"];

  // Load scheduleData
  useEffect(() => {
    async function loadSchedule() {
      try {
        const saved = await localforage.getItem<string>("scheduleData");
        if (saved) {
          try {
            setScheduleData(JSON.parse(saved));
          } catch (e) {
            setScheduleData(saved as any);
          }
        } else {
          const lsSaved = sqliteStorage.getItem("scheduleData");
          if (lsSaved) {
            setScheduleData(JSON.parse(lsSaved));
          }
        }
      } catch (e) {
        console.error("Failed to load scheduleData inside DutyInfoModule", e);
      }
    }
    loadSchedule();
  }, []);

  // Pre-set the location dropdown in assignment form if empty
  useEffect(() => {
    if (locations.length > 0 && !assignForm.location) {
      setAssignForm(prev => ({ ...prev, location: locations[0].name }));
    }
    if (locations.length > 0 && !selectedScheduleLocation) {
      setSelectedScheduleLocation(locations[0].name);
    }
  }, [locations, assignForm.location, selectedScheduleLocation]);

  // Keyboard navigation for teachers in schedule modal
  useEffect(() => {
    if (!isProgramModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevTeacher();
      } else if (e.key === "ArrowRight") {
        handleNextTeacher();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProgramModalOpen, currentScheduleTeacherIndex, teachers]);

  // Handle Location Submit
  const handleLocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newName = locForm.name.trim();
    if (!newName) return;

    if (isEditingLoc) {
      const oldLoc = locations.find(l => l.id === locForm.id);
      const oldName = oldLoc ? oldLoc.name : "";

      // Update locations list
      setLocations(prev => prev.map(l => l.id === locForm.id ? { ...l, name: newName, zone: locForm.zone, note: locForm.note.trim() } : l));

      // Synchronize existing duty assignments to use the new location name
      if (oldName && oldName !== newName) {
        setAssignments(prev => prev.map(a => a.location === oldName ? { ...a, location: newName } : a));
      }

      setIsEditingLoc(false);
    } else {
      const newLoc: DutyLocation = {
        id: `loc-${Date.now()}`,
        name: newName,
        zone: locForm.zone,
        note: locForm.note.trim(),
      };
      setLocations(prev => [...prev, newLoc]);
    }
    setLocForm({ id: "", name: "", zone: "Bahçe", note: "" });
  };

  // Start edit location
  const startEditLoc = (loc: DutyLocation) => {
    setLocForm({ id: loc.id, name: loc.name, zone: loc.zone, note: loc.note });
    setIsEditingLoc(true);
    // Smoothly scroll to the form section at the top of the module
    setTimeout(() => {
      document.getElementById("duty-info-module")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // Delete Location (opens beautiful custom confirm modal)
  const handleDeleteLoc = (loc: DutyLocation) => {
    setLocToDelete(loc);
  };

  const handleConfirmDeleteLoc = () => {
    if (!locToDelete) return;
    const { id, name } = locToDelete;
    setLocations(prev => prev.filter(l => l.id !== id));
    setAssignments(prev => prev.filter(a => a.location !== name));
    setLocToDelete(null);
  };

  // Handle Assignment Submit
  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.location || !assignForm.teacherName) {
      alert("Lütfen bir nöbet yeri ve görevli öğretmen seçin.");
      return;
    }

    // Check if the teacher already has an assignment on that day
    const hasDoubleDuty = assignments.some(
      a => a.day === assignForm.day && a.teacherName === assignForm.teacherName && a.id !== assignForm.id
    );

    if (hasDoubleDuty) {
      if (!confirm(`${assignForm.teacherName} isimli öğretmen ${assignForm.day} günü zaten başka bir nöbet görevine sahip. Yine de eklemek istiyor musunuz?`)) {
        return;
      }
    }

    if (isEditingAssign) {
      setAssignments(prev => prev.map(a => a.id === assignForm.id ? { ...a, day: assignForm.day, location: assignForm.location, teacherName: assignForm.teacherName } : a));
      setIsEditingAssign(false);
    } else {
      const newAssign: DutyAssignment = {
        id: `duty-${Date.now()}`,
        day: assignForm.day,
        location: assignForm.location,
        teacherName: assignForm.teacherName,
      };
      setAssignments(prev => [...prev, newAssign]);
    }

    // Reset keeping same day & location for convenience
    setAssignForm(prev => ({ ...prev, id: "", teacherName: "" }));
  };

  // Delete Assignment
  const handleDeleteAssign = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  // Edit Assignment
  const startEditAssign = (assign: DutyAssignment) => {
    setAssignForm({
      id: assign.id,
      day: assign.day,
      location: assign.location,
      teacherName: assign.teacherName,
    });
    setIsEditingAssign(true);
  };

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    return locations.filter(l =>
      l.name.toLowerCase().includes(locSearch.toLowerCase()) ||
      l.zone.toLowerCase().includes(locSearch.toLowerCase()) ||
      l.note.toLowerCase().includes(locSearch.toLowerCase())
    );
  }, [locations, locSearch]);

  // Count assignments per location
  const getLocAssignmentCount = (locName: string) => {
    return assignments.filter(a => a.location === locName).length;
  };

  // Navigations and helper functions for teacher program-based scheduler modal
  const handlePrevTeacher = () => {
    if (!teachers || teachers.length === 0) return;
    setCurrentScheduleTeacherIndex(prev => (prev === 0 ? teachers.length - 1 : prev - 1));
  };

  const handleNextTeacher = () => {
    if (!teachers || teachers.length === 0) return;
    setCurrentScheduleTeacherIndex(prev => (prev === teachers.length - 1 ? 0 : prev + 1));
  };

  const handleAssignFromModal = () => {
    const currentTeacher = teachers[currentScheduleTeacherIndex];
    if (!currentTeacher) return;
    if (!selectedScheduleLocation) {
      alert("Lütfen bir nöbet yeri seçin.");
      return;
    }

    // Check if teacher already has a duty on that day
    const hasDoubleDuty = assignments.some(
      a => a.day === selectedScheduleDay && a.teacherName === currentTeacher.name
    );

    if (hasDoubleDuty) {
      if (!confirm(`${currentTeacher.name} isimli öğretmen ${selectedScheduleDay} günü zaten başka bir nöbet görevine sahip. Yine de eklemek istiyor musunuz?`)) {
        return;
      }
    }

    const newAssign: DutyAssignment = {
      id: `duty-${Date.now()}`,
      day: selectedScheduleDay,
      location: selectedScheduleLocation,
      teacherName: currentTeacher.name,
    };

    setAssignments(prev => [...prev, newAssign]);
    alert(`${currentTeacher.name} öğretmeni ${selectedScheduleDay} günü için "${selectedScheduleLocation}" alanına başarıyla atandı!`);
  };

  return (
    <div id="duty-info-module" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* 2. Side-By-Side Button Swapper (Tab Selector) as requested */}
      <div className="flex items-center justify-start gap-4 border-b border-slate-100 pb-2">
        <button
          id="btn-tab-locations"
          onClick={() => setActiveSubTab("locations")}
          className={`px-6 py-3.5 rounded-2xl text-sm font-extrabold tracking-wide transition-all duration-200 cursor-pointer flex items-center gap-2 border shadow-sm ${
            activeSubTab === "locations"
              ? "bg-blue-600 border-blue-600 text-white shadow-blue-200/50"
              : "bg-white border-slate-150 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Nöbet Yerleri</span>
        </button>

        <button
          id="btn-tab-planner"
          onClick={() => setActiveSubTab("planner")}
          className={`px-6 py-3.5 rounded-2xl text-sm font-extrabold tracking-wide transition-all duration-200 cursor-pointer flex items-center gap-2 border shadow-sm ${
            activeSubTab === "planner"
              ? "bg-indigo-600 border-indigo-600 text-white shadow-indigo-200/50"
              : "bg-white border-slate-150 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Nöbet Planla</span>
        </button>
      </div>

      {/* 3. Main Dynamic Content View */}
      <AnimatePresence mode="wait">
        {activeSubTab === "locations" ? (
          <motion.div
            key="locations-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Form Column */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 h-fit space-y-5">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {isEditingLoc ? "Nöbet Yerini Düzenle" : "Yeni Nöbet Yeri Ekle"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Okul içinde öğretmenlerin nöbet tutacağı yeni bir nokta/bölge tanımlayın.
                </p>
              </div>

              <form onSubmit={handleLocSubmit} className="space-y-4">
                {/* Location Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nöbet Yeri Adı</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Bahçe Nöbeti, Yemekhane"
                    value={locForm.name}
                    onChange={(e) => setLocForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-350"
                  />
                </div>

                {/* Zone Area Select */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Okul Alanı / Bölgesi</label>
                  <select
                    value={locForm.zone}
                    onChange={(e) => setLocForm(prev => ({ ...prev, zone: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  >
                    {zones.map((z, idx) => (
                      <option key={idx} value={z}>{z}</option>
                    ))}
                  </select>
                </div>

                {/* Responsibility Note */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Açıklama / Görev Notu</label>
                  <textarea
                    rows={3}
                    placeholder="Görev esnasında dikkat edilecek hususlar veya özel talimatlar..."
                    value={locForm.note}
                    onChange={(e) => setLocForm(prev => ({ ...prev, note: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-350 resize-none"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isEditingLoc ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{isEditingLoc ? "Değişiklikleri Kaydet" : "Nöbet Yeri Ekle"}</span>
                  </button>
                  {isEditingLoc && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingLoc(false);
                        setLocForm({ id: "", name: "", zone: "Bahçe", note: "" });
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs px-4 py-3 rounded-xl transition-all cursor-pointer"
                    >
                      İptal
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Toolbar */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Nöbet yerlerinde ara (isim, bölge, not)..."
                    value={locSearch}
                    onChange={(e) => setLocSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                  {locSearch && (
                    <button
                      onClick={() => setLocSearch("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-400 font-bold self-center">
                  Toplam <span className="text-slate-700 font-extrabold">{filteredLocations.length}</span> nöbet yeri listeleniyor
                </div>
              </div>

              {/* Grid of location cards */}
              {filteredLocations.length === 0 ? (
                <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-12 text-center">
                  <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-bold">Aradığınız kriterlere uygun nöbet yeri bulunamadı.</p>
                  <p className="text-xs text-slate-400 mt-1">Yeni bir nöbet yeri ekleyerek başlayabilirsiniz.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredLocations.map((loc) => {
                    const assignCount = getLocAssignmentCount(loc.name);
                    return (
                      <div
                        key={loc.id}
                        className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                              <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                                {loc.name}
                              </h4>
                            </div>
                            <span className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase border border-slate-200/50 shrink-0">
                              {loc.zone}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 font-bold mt-2.5 line-clamp-2 min-h-[32px]">
                            {loc.note || "Açıklama belirtilmemiş."}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-indigo-50/50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-lg">
                            <Users className="w-3.5 h-3.5" />
                            <span>{assignCount} Atanan Öğretmen</span>
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditLoc(loc)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                              title="Düzenle"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLoc(loc)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="planner-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Quick Scheduler Form at top */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    {isEditingAssign ? "Nöbet Görevi Güncelle" : "Yeni Nöbet Ataması Planla"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Öğretmenleri haftanın belirli bir gününde, belirlenmiş bir nöbet noktasına atayın.
                  </p>
                </div>
                {!isEditingAssign && (
                  <button
                    type="button"
                    onClick={() => {
                      if (teachers && teachers.length > 0) {
                        setCurrentScheduleTeacherIndex(0);
                        setSelectedScheduleDay("Pazartesi");
                        if (locations.length > 0) {
                          setSelectedScheduleLocation(locations[0].name);
                        }
                        setIsProgramModalOpen(true);
                      } else {
                        alert("Sistemde kayıtlı öğretmen bulunmamaktadır.");
                      }
                    }}
                    className="bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-150 font-black text-xs px-4 py-3 rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    <CalendarDays className="w-4 h-4 text-indigo-600" />
                    <span>Öğretmen Ders Programı ile Planla 🗓️</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleAssignSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {/* Weekday select */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nöbet Günü</label>
                  <select
                    value={assignForm.day}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, day: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  >
                    {weekdays.map((d, idx) => (
                      <option key={idx} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Location select */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nöbet Yeri / Alanı</label>
                  <select
                    value={assignForm.location}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  >
                    {locations.length === 0 ? (
                      <option value="">Lütfen önce Nöbet Yeri ekleyin!</option>
                    ) : (
                      locations.map((loc) => (
                        <option key={loc.id} value={loc.name}>{loc.name} ({loc.zone})</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Teacher select */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Görevli Öğretmen</label>
                  <select
                    value={assignForm.teacherName}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, teacherName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  >
                    <option value="">Öğretmen Seçin</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} ({t.branch}) {t.status === "İzinli" ? "⚠️ İZİNLİ" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isEditingAssign ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{isEditingAssign ? "Atamayı Güncelle" : "Nöbet Planla"}</span>
                  </button>
                  {isEditingAssign && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingAssign(false);
                        setAssignForm({ id: "", day: "Pazartesi", location: "", teacherName: "" });
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs px-4 py-3 rounded-xl transition-all cursor-pointer"
                    >
                      İptal
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Weekly Grid View */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                  <h4 className="font-extrabold text-slate-800 text-base">Haftalık Nöbet Çizelgesi Dağılımı</h4>
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  Atama kartlarını ait olduğu sütunda görebilir ve yönetebilirsiniz
                </div>
              </div>

              {/* Responsive columns grid for each day */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch">
                {weekdays.map((day) => {
                  const dayAssignments = assignments.filter(a => a.day === day);
                  return (
                    <div
                      key={day}
                      className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 min-h-[300px]"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-black text-xs text-slate-700 uppercase tracking-wider">{day}</span>
                        <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100/50 px-2 py-0.5 rounded-full">
                          {dayAssignments.length} Nöbetçi
                        </span>
                      </div>

                      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[450px] pr-0.5">
                        {dayAssignments.length === 0 ? (
                          <div className="h-full flex items-center justify-center py-12 text-center">
                            <p className="text-[11px] text-slate-350 italic">Atanmış öğretmen yok</p>
                          </div>
                        ) : (
                          dayAssignments.map((assign) => {
                            const matchingTeacher = teachers.find(t => t.name === assign.teacherName);
                            return (
                              <div
                                key={assign.id}
                                className="bg-white border border-slate-100/80 rounded-xl p-3 shadow-[0_2px_4px_rgba(0,0,0,0.01)] hover:border-indigo-200 hover:shadow-md transition-all relative group"
                              >
                                <div className="pr-5">
                                  <span className="text-[9px] font-black tracking-wider text-indigo-500 bg-indigo-50/50 border border-indigo-100/30 px-1.5 py-0.5 rounded uppercase block w-fit mb-1">
                                    📍 {assign.location}
                                  </span>
                                  <h5 className="font-extrabold text-xs text-slate-800 truncate">
                                    {assign.teacherName}
                                  </h5>
                                  {matchingTeacher && (
                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                      {matchingTeacher.branch}
                                    </p>
                                  )}
                                </div>

                                <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => startEditAssign(assign)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer hover:bg-slate-50"
                                    title="Güncelle"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAssign(assign.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer hover:bg-slate-50"
                                    title="Sil"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Deletion Confirmation Modal for Duty Locations */}
      <AnimatePresence>
        {locToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-slate-100 max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-6"
            >
              {/* Header Icon & Title */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Nöbet Yerini Sil?</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Bu işlemi onayladığınızda seçilen nöbet yeri kalıcı olarak silinecektir.
                  </p>
                </div>
              </div>

              {/* Location details card */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">📍 {locToDelete.name}</span>
                  <span className="text-[10px] font-black tracking-wider px-2 py-0.5 rounded bg-white border border-slate-200/50 text-slate-500 uppercase">
                    {locToDelete.zone}
                  </span>
                </div>
                {locToDelete.note && (
                  <p className="text-[11px] text-slate-400 font-bold italic line-clamp-2">
                    "{locToDelete.note}"
                  </p>
                )}
              </div>

              {/* Warning box */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-lg leading-none mt-0.5">⚠️</span>
                <p className="text-[11px] text-amber-700 font-extrabold leading-relaxed">
                  Önemli Not: Bu nöbet yeri silindiğinde, bu yere atanmış olan tüm haftalık nöbetçi öğretmen çizelgesi görevleri de otomatik olarak kaldırılacaktır!
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setLocToDelete(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer text-center"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteLoc}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer text-center"
                >
                  Evet, Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Teacher Weekly Course Program & Duty Assignment Modal */}
      <AnimatePresence>
        {isProgramModalOpen && teachers && teachers.length > 0 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 20 }}
              className="bg-white rounded-3xl border border-slate-100 max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]"
            >
              {/* Left Panel: Teacher Info & Controls */}
              <div className="w-full md:w-80 bg-slate-50/80 border-r border-slate-100 p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
                <div className="space-y-6">
                  {/* Top Header Selector with Left/Right Arrows */}
                  <div className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-2xl shadow-sm">
                    <button
                      type="button"
                      onClick={handlePrevTeacher}
                      className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                      title="Önceki Öğretmen (Sol Yön Tuşu)"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="text-center">
                      <span className="text-[10px] font-black text-slate-400 block uppercase tracking-widest">
                        ÖĞRETMEN
                      </span>
                      <span className="text-xs font-black text-indigo-600">
                        {currentScheduleTeacherIndex + 1} / {teachers.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleNextTeacher}
                      className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                      title="Sonraki Öğretmen (Sağ Yön Tuşu)"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Teacher Details */}
                  {(() => {
                    const currentTeacher = teachers[currentScheduleTeacherIndex];
                    if (!currentTeacher) return null;
                    const teacherDuties = assignments.filter(a => a.teacherName === currentTeacher.name);

                    return (
                      <div className="space-y-4">
                        <div className="text-center p-4 bg-white border border-slate-100 rounded-3xl space-y-2 shadow-sm">
                          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xl mx-auto border border-indigo-100/50 shadow-inner">
                            {currentTeacher.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm leading-tight">
                              {currentTeacher.name}
                            </h4>
                            <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase mt-0.5 block">
                              {currentTeacher.branch}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-2 pt-1">
                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {currentTeacher.weeklyHours} Saat Ders
                            </span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                              currentTeacher.status === "İzinli" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                            }`}>
                              {currentTeacher.status}
                            </span>
                          </div>
                        </div>

                        {/* Current assignments for this teacher */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Haftalık Nöbet Durumu
                          </span>
                          {teacherDuties.length === 0 ? (
                            <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl text-center">
                              <p className="text-[11px] text-emerald-700 font-bold">
                                Bu hafta atanmış nöbeti yok.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {teacherDuties.map((duty) => (
                                <div key={duty.id} className="bg-white border border-slate-100 p-2.5 rounded-xl flex items-center justify-between shadow-sm">
                                  <div className="text-left">
                                    <span className="text-[9px] font-black text-indigo-600 block uppercase">
                                      {duty.day}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-600">
                                      📍 {duty.location}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteAssign(duty.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                    title="Nöbeti Kaldır"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Assignment Control Box */}
                        <div className="bg-indigo-600/5 border border-indigo-100 p-4 rounded-3xl space-y-4">
                          <h5 className="text-[11px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                            <span>Hızlı Nöbet Ata</span>
                          </h5>

                          {/* Selected Day view */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Seçilen Gün
                            </label>
                            <select
                              value={selectedScheduleDay}
                              onChange={(e) => setSelectedScheduleDay(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 outline-none"
                            >
                              {weekdays.map((d, idx) => (
                                <option key={idx} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>

                          {/* Location Dropdown */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Nöbet Yeri / Alanı
                            </label>
                            <select
                              value={selectedScheduleLocation}
                              onChange={(e) => setSelectedScheduleLocation(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 outline-none"
                            >
                              {locations.length === 0 ? (
                                <option value="">Nöbet yeri bulunamadı!</option>
                              ) : (
                                locations.map((loc) => (
                                  <option key={loc.id} value={loc.name}>
                                    {loc.name} ({loc.zone})
                                  </option>
                                ))
                              )}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={handleAssignFromModal}
                            disabled={locations.length === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-xs py-3 rounded-xl shadow-md transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Öğretmene Nöbet Ata</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-4 text-center">
                  <p className="text-[10px] text-slate-400 font-bold">
                    * Klavye sol/sağ yön tuşları ile öğretmen değiştirebilirsiniz.
                  </p>
                </div>
              </div>

              {/* Right Panel: Teacher Course Schedule Grid */}
              <div className="flex-1 p-6 flex flex-col overflow-y-auto">
                {/* Modal Title Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <span>🗓️ Haftalık Ders Programı Görünümü</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Öğretmenin ders durumuna göre en uygun nöbet gününü belirleyin. Sütunlara tıklayarak gün seçebilirsiniz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsProgramModalOpen(false)}
                    className="w-9 h-9 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 border border-slate-150 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Grid container */}
                {(() => {
                  const currentTeacher = teachers[currentScheduleTeacherIndex];
                  if (!currentTeacher) return null;

                  const hours = [1, 2, 3, 4, 5, 6, 7, 8];

                  return (
                    <div className="flex-1 overflow-x-auto">
                      <table className="w-full border-collapse border border-slate-100/50 text-left min-w-[600px]">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="p-3 border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-16">
                              SAAT
                            </th>
                            {weekdays.map((day) => {
                              const isSelected = selectedScheduleDay === day;
                              const dayAssignments = assignments.filter(
                                a => a.day === day && a.teacherName === currentTeacher.name
                              );

                              return (
                                <th
                                  key={day}
                                  onClick={() => setSelectedScheduleDay(day)}
                                  className={`p-3 border border-slate-100 text-center cursor-pointer transition-all ${
                                    isSelected
                                      ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-100"
                                      : "hover:bg-indigo-50/50 text-slate-700 font-extrabold"
                                  }`}
                                >
                                  <div className="text-xs">{day}</div>
                                  {dayAssignments.length > 0 && (
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded mt-1 inline-block ${
                                      isSelected ? "bg-white text-indigo-700" : "bg-indigo-50 text-indigo-600"
                                    }`}>
                                      📍 NÖBETÇİ
                                    </span>
                                  )}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {hours.map((hour) => (
                            <tr key={hour} className="hover:bg-slate-50/30 group">
                              <td className="p-2 border border-slate-100 text-center bg-slate-50/50">
                                <span className="text-xs font-black text-slate-600">{hour}. Saat</span>
                              </td>
                              {weekdays.map((day) => {
                                const isSelected = selectedScheduleDay === day;
                                const key = `teacher_${currentTeacher.id}_${day}_${hour}`;
                                const rawData = scheduleData[key];
                                const cellData = rawData
                                  ? Array.isArray(rawData)
                                    ? rawData[0]
                                    : rawData
                                  : null;

                                const isBlocked = !!scheduleData[`blocked_teacher_${currentTeacher.id}_${day}_${hour}`];

                                return (
                                  <td
                                    key={day}
                                    onClick={() => setSelectedScheduleDay(day)}
                                    className={`p-2.5 border border-slate-100 text-center cursor-pointer align-middle transition-colors min-h-[50px] ${
                                      isSelected
                                        ? "bg-indigo-50/30 border-indigo-200"
                                        : "hover:bg-indigo-50/20"
                                    }`}
                                  >
                                    {isBlocked ? (
                                      <span className="text-[8px] font-black text-slate-400 tracking-wider uppercase block bg-slate-100 py-1.5 rounded-lg">
                                        KAPALI
                                      </span>
                                    ) : cellData ? (
                                      <div className="bg-indigo-50/40 border border-indigo-100/50 rounded-xl p-1.5 space-y-0.5">
                                        <p className="text-[10px] font-extrabold text-indigo-800 leading-tight truncate">
                                          {cellData.courseName}
                                        </p>
                                        <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">
                                          🏫 {cellData.classroom || "Sınıf"}
                                        </p>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-300 italic font-bold">
                                        BOŞ
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

