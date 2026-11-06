import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  Sparkles,
  RadioTower,
  Bot,
  Cpu,
  ListChecks,
  Bell,
  MessageSquare,
  Database,
  School,
  Users,
  UsersRound,
  BookOpen,
  GraduationCap,
  Calendar,
  MessageCircle,
  HardDrive,
  Settings as SettingsIcon,
  HelpCircle,
  X,
  Megaphone,
  ClipboardCheck,
  ClipboardList,
  Edit3,
  BarChart,
  CalendarDays,
  FileText,
  Shield,
  Heart,
  Scale,
  LayoutTemplate,
  Mic,
  ChevronDown,
  ChevronRight,
  Menu,
  ChevronLeft,
  User,
  LogOut,
  Archive,
  LineChart,
  Command,
  HeartHandshake,
  Gauge,
  Activity,
  BrainCircuit,
  Smartphone,
  Newspaper,
} from "lucide-react";
import { AccessControlState, isSchoolModuleEnabled, PanelUser } from "../lib/accessControl";
import { canAccessModuleTab, roleLabel, type CloudRole } from "../core/auth";
import { useScheduleStore } from "../stores/scheduleStore";
const fontBoostMenuLabels = new Set<string>(["Sınav Hazırla", "Sınav Analiz", "Sınav Raporları", "Davranış", "Rehberlik", "Disiplin", "Ortak Sınav Planı", "Ders Dağıtım Planı", "Mesaj Gönder", "Sesli Mesajlar", "Soru Hazırla", "Liste Takip", "Test Oluştur", "Müfredat", "Anket Paneli", "Yoklama Fişi", "Belgesini Kaybedenler", "Kulüpler / Sosyal Etkinlikler", "Öğrenci Görevlendirme", "Sorumluluk Sınavı", "Yıllık", "Albüm", "Okul Radyosu"]);

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser?: PanelUser;
  accessState: AccessControlState;
  cloudRole: CloudRole;
  onLogout?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, currentUser, accessState, cloudRole, onLogout }: SidebarProps) {
  const scheduleViewType = useScheduleStore((state) => state.viewType);
  const scheduleSelectedId = useScheduleStore((state) => state.selectedId);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDataPanelOpen, setIsDataPanelOpen] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<{ version: string; gitCommit: string; gitBranch: string } | null>(null);
  const canSeeReleaseInfo = ["super_admin", "principal", "assistant_principal"].includes(cloudRole);
  const [coachActiveSubTab, setCoachActiveSubTab] = useState(() => {
    try { return sessionStorage.getItem("edupanel_education_coach_subtab") || "dashboard"; }
    catch { return "dashboard"; }
  });
  
  useEffect(() => {
    if (!canSeeReleaseInfo) {
      setReleaseInfo(null);
      return;
    }
    let active = true;
    fetch("/api/release-info", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !data) return;
        setReleaseInfo({
          version: String(data.version || "bilinmiyor"),
          gitCommit: String(data.gitCommit || "bilinmiyor"),
          gitBranch: String(data.gitBranch || "bilinmiyor"),
        });
      })
      .catch(() => {
        if (active) setReleaseInfo(null);
      });
    return () => { active = false; };
  }, [canSeeReleaseInfo]);

  // Track expanded groups in normal mode
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "data-group": false,
    "messages-group": false,
    "exams-group": false,
    "education-coach-group": false,
    "daredi-group": false,
    "hdd-group": false,
    "survey-group": false,
    "management-group": false,
  });

  // Listen to mobile menu toggle event from Header
  useEffect(() => {
    const handleToggle = () => {
      setIsMinimized(false);
      setIsMobileOpen((prev) => !prev);
    };
    const handleClose = () => setIsMobileOpen(false);
    
    const handleCoachSubTab = (event: Event) => {
      const subTab = String((event as CustomEvent)?.detail?.subTab || "");
      if (subTab) setCoachActiveSubTab(subTab);
    };
    window.addEventListener("toggle-sidebar", handleToggle);
    window.addEventListener("close-sidebar", handleClose);
    window.addEventListener("edupanel-education-coach-subtab", handleCoachSubTab);
    
    return () => {
      window.removeEventListener("toggle-sidebar", handleToggle);
      window.removeEventListener("close-sidebar", handleClose);
      window.removeEventListener("edupanel-education-coach-subtab", handleCoachSubTab);
    };
  }, []);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const isCurrentlyOpen = Boolean(prev[groupId]);

      // Akordeon davranışı:
      // - Aynı ana butona tekrar basılırsa kapanır.
      // - Farklı bir ana butona basılırsa önceki kapanır, yenisi açılır.
      // - Ana butonların ekrandaki sırası hiçbir zaman değişmez.
      return Object.fromEntries(
        Object.keys(prev).map((key) => [key, key === groupId ? !isCurrentlyOpen : false]),
      );
    });
  };

  const canShowTab = (tabId: string) =>
    ["album", "school-radio", "class-student-seating"].includes(tabId) ||
    (canAccessModuleTab(currentUser, cloudRole, tabId) && isSchoolModuleEnabled(accessState, currentUser, tabId));

  const setHumanResourcesNormalMode = () => {
    try {
      sessionStorage.removeItem("edupanel_hr_teacher_assignment_shortcut");
      sessionStorage.removeItem("edupanel_hr_teacher_assignment_class_id");
    } catch {}
    window.dispatchEvent(new CustomEvent("edupanel-human-resources-mode", { detail: { shortcut: false } }));
  };

  const handleTabSelect = (tabId: string) => {
    if (!canShowTab(tabId)) {
      window.dispatchEvent(new CustomEvent("edupanel-access-denied", { detail: { tabId, cloudRole } }));
      return;
    }
    if (tabId === "human-resources") setHumanResourcesNormalMode();
    setActiveTab(tabId);
    window.dispatchEvent(new CustomEvent("edupanel-tab-selected", { detail: { tabId } }));
    setIsMobileOpen(false); // Close mobile drawer when a tab is selected
  };

  const handleTeacherAssignmentShortcut = () => {
    const targetTab = "human-resources";
    if (!canShowTab(targetTab)) {
      window.dispatchEvent(new CustomEvent("edupanel-access-denied", { detail: { tabId: targetTab, cloudRole } }));
      return;
    }

    if (scheduleViewType !== "class" || !scheduleSelectedId) {
      window.alert("Öğretmen Atama için önce Ders Programı ekranında çalışacağınız sınıfı seçiniz.");
      return;
    }

    const classroomId = String(scheduleSelectedId);
    try {
      sessionStorage.setItem("edupanel_hr_subtab_request", "teacher-course-assign");
      sessionStorage.setItem("edupanel_course_subtab_request", "teacher-course-assign");
      sessionStorage.setItem("edupanel_course_curriculum_standalone", "0");
      sessionStorage.setItem("edupanel_hr_teacher_assignment_shortcut", "1");
      sessionStorage.setItem("edupanel_hr_teacher_assignment_class_id", classroomId);
    } catch {}

    setActiveTab(targetTab);
    window.dispatchEvent(new CustomEvent("edupanel-tab-selected", { detail: { tabId: targetTab } }));
    window.dispatchEvent(new CustomEvent("edupanel-human-resources-mode", {
      detail: { shortcut: true, classroomId },
    }));
    window.dispatchEvent(
      new CustomEvent("edupanel-human-resources-subtab", {
        detail: { subTab: "teacher-course-assign", shortcut: true, classroomId },
      }),
    );
    setIsMobileOpen(false);
  };

  const handleMenuItemSelect = (item: any) => {
    const targetTab = String(item?.targetTab || item?.id || "");
    if (!targetTab) return;

    if (!canShowTab(targetTab)) {
      window.dispatchEvent(new CustomEvent("edupanel-access-denied", { detail: { tabId: targetTab, cloudRole } }));
      return;
    }

    const humanResourcesSubTab = String(item?.humanResourcesSubTab || "");
    if (targetTab === "human-resources") {
      setHumanResourcesNormalMode();
      if (humanResourcesSubTab) {
        try {
          sessionStorage.setItem("edupanel_hr_subtab_request", humanResourcesSubTab);
          sessionStorage.setItem("edupanel_course_curriculum_standalone", "0");
          sessionStorage.removeItem("edupanel_course_subtab_request");
        } catch {}
        window.dispatchEvent(
          new CustomEvent("edupanel-human-resources-subtab", {
            detail: { subTab: humanResourcesSubTab, shortcut: false },
          }),
        );
      }
    }

    const courseSubTab = String(item?.courseSubTab || "");
    if (targetTab === "courses" && courseSubTab) {
      try {
        sessionStorage.setItem("edupanel_course_subtab_request", courseSubTab);
        sessionStorage.setItem(
          "edupanel_course_curriculum_standalone",
          courseSubTab === "curriculum" ? "1" : "0",
        );
      } catch {}
      window.dispatchEvent(
        new CustomEvent("edupanel-course-subtab", {
          detail: {
            subTab: courseSubTab,
            standaloneCurriculum: courseSubTab === "curriculum",
          },
        }),
      );
    }

    const coachSubTab = String(item?.coachSubTab || "");
    if (targetTab === "education-coach" && coachSubTab) {
      setCoachActiveSubTab(coachSubTab);
      try { sessionStorage.setItem("edupanel_education_coach_subtab", coachSubTab); } catch {}
      window.dispatchEvent(new CustomEvent("edupanel-education-coach-subtab", { detail: { subTab: coachSubTab } }));
    }

    const announcementSubTab = String(item?.announcementSubTab || "");
    if (targetTab === "announcements" && announcementSubTab) {
      try { sessionStorage.setItem("edupanel_announcement_subtab_request", announcementSubTab); } catch {}
      window.dispatchEvent(new CustomEvent("edupanel-announcement-subtab", { detail: { subTab: announcementSubTab } }));
    }

    setActiveTab(targetTab);
    window.dispatchEvent(new CustomEvent("edupanel-tab-selected", { detail: { tabId: targetTab } }));
    setIsMobileOpen(false);
  };

  const groups = [
    {
      id: "data-group",
      label: "Veri Yönetimi",
      icon: Database,
      color: {
        bg: "bg-blue-600",
        hover: "hover:bg-blue-700",
        text: "text-blue-500",
        border: "border-blue-500/30",
        hoverBg: "hover:bg-blue-500/10",
        activeBg: "bg-blue-500/15 text-blue-400",
      },
      subItems: [
        { id: "school-info", label: "Okul Bilgileri", icon: School },
        { id: "human-resources", label: "Tanımlamalar", icon: Users },
        { id: "message-tools", label: "Mesaj Araçları", icon: MessageCircle },
        { id: "exam-tools", label: "Ölçme araçları", icon: Edit3 },
        { id: "committees", label: "Kurul ve Komisyonlar", icon: GraduationCap },
        { id: "academic-calendar", label: "Akademik Takvim", icon: Calendar },
        { id: "database", label: "Veritabanı", icon: HardDrive },
        { id: "duty-info", label: "Nöbet Bilgileri", icon: CalendarDays },
        { id: "behavior-definitions", label: "Davranış Tanımları", icon: Heart },
        { id: "settings", label: "Okullar ve Yetkiler", icon: SettingsIcon },
        { id: "teacher-interfaces", label: "Öğretmen Arayüzleri", icon: Smartphone },
      ],
    },
    {
      id: "messages-group",
      label: "WhatsApp",
      icon: MessageCircle,
      color: {
        bg: "bg-emerald-500",
        hover: "hover:bg-emerald-600",
        text: "text-emerald-500",
        border: "border-emerald-500/30",
        hoverBg: "hover:bg-emerald-500/10",
        activeBg: "bg-emerald-500/15 text-emerald-400",
      },
      subItems: [
        { id: "messages", label: "Mesaj Gönder", icon: MessageSquare },
        { id: "voice-messages", label: "Sesli Mesajlar", icon: Mic },
      ],
    },
    {
      id: "exams-group",
      label: "Akademik Analiz Merkezi",
      icon: ClipboardCheck,
      color: {
        bg: "bg-purple-600",
        hover: "hover:bg-purple-700",
        text: "text-purple-500",
        border: "border-purple-500/30",
        hoverBg: "hover:bg-purple-500/10",
        activeBg: "bg-purple-500/15 text-purple-400",
      },
      subItems: [
        { id: "exam-prepare", label: "Sınav Hazırla", icon: Edit3 },
        { id: "exam-analysis", label: "Sınav Analiz", icon: BarChart },
        { id: "exam-reports", label: "Sınav Raporları", icon: FileText },
        { id: "test", label: "Test Oluştur", icon: Sparkles },
        { id: "google-forms", label: "Mentör Modu", icon: FileText },
      ],
    },
    {
      id: "education-coach-group",
      label: "Deneme Kulübü",
      icon: BrainCircuit,
      color: {
        bg: "bg-amber-500",
        hover: "hover:bg-amber-600",
        text: "text-amber-600",
        border: "border-amber-500/30",
        hoverBg: "hover:bg-amber-500/10",
        activeBg: "bg-amber-500/15 text-amber-700",
      },
      subItems: [
        { id: "coach-registration", label: "Kayıt Merkezi", icon: UsersRound, targetTab: "education-coach", coachSubTab: "registration" },
        { id: "coach-dashboard", label: "Kontrol Merkezi", icon: Gauge, targetTab: "education-coach", coachSubTab: "dashboard" },
        { id: "coach-analysis-center", label: "Analiz Merkezi", icon: BarChart, targetTab: "education-coach", coachSubTab: "analysis-center" },
        { id: "coach-students", label: "Öğrenci Kartları", icon: Users, targetTab: "education-coach", coachSubTab: "students" },
        { id: "coach-tasks", label: "Plan & Görevler", icon: ClipboardCheck, targetTab: "education-coach", coachSubTab: "tasks" },
        { id: "coach-meetings", label: "Koç Görüşmeleri", icon: HeartHandshake, targetTab: "education-coach", coachSubTab: "meetings" },
        { id: "coach-warnings", label: "Erken Uyarılar", icon: Bell, targetTab: "education-coach", coachSubTab: "warnings" },
        { id: "coach-messages", label: "Koç Mesajları", icon: MessageSquare, targetTab: "education-coach", coachSubTab: "messages" },
        { id: "coach-reports", label: "Aylık Raporlar", icon: FileText, targetTab: "education-coach", coachSubTab: "reports" },
        { id: "coach-mobile", label: "Öğrenci Mobil", icon: Smartphone, targetTab: "education-coach", coachSubTab: "mobile" },
      ],
    },
    {
      id: "daredi-group",
      label: "Davranış Takip Merkezi",
      icon: Shield,
      color: {
        bg: "bg-teal-600",
        hover: "hover:bg-teal-700",
        text: "text-teal-500",
        border: "border-teal-500/30",
        hoverBg: "hover:bg-teal-500/10",
        activeBg: "bg-teal-500/15 text-teal-400",
      },
      subItems: [
        { id: "behavior", label: "Davranış", icon: Heart },
        { id: "guidance", label: "Rehberlik", icon: Users },
        { id: "discipline", label: "Disiplin İşlemleri", icon: Scale },
        { id: "homework-control", label: "Ödev Kontrolü", icon: ClipboardCheck },
      ],
    },
    {
      id: "hdd-group",
      label: "Ders Proğramı",
      icon: CalendarDays,
      color: {
        bg: "bg-rose-500",
        hover: "hover:bg-rose-600",
        text: "text-rose-500",
        border: "border-rose-500/30",
        hoverBg: "hover:bg-rose-500/10",
        activeBg: "bg-rose-500/15 text-rose-400",
      },
      subItems: [
        { id: "schedule-planner", label: "Ders Dağıtım Planı", icon: CalendarDays },
        { id: "rules-panel", label: "Kısıtlamalar", icon: SettingsIcon },
        { id: "a-panel", label: "Listeler", icon: LayoutTemplate },
      ],
    },
    {
      id: "survey-group",
      label: "Diğer İşlemler",
      icon: ClipboardCheck,
      color: {
        bg: "bg-cyan-500",
        hover: "hover:bg-cyan-600",
        text: "text-cyan-500",
        border: "border-cyan-500/30",
        hoverBg: "hover:bg-cyan-500/10",
        activeBg: "bg-cyan-500/15 text-cyan-400",
      },
      subItems: [
        { id: "question-cropper", label: "Soru İşlemleri", icon: FileText },
        { id: "yearbook", label: "Yıllık", icon: BookOpen },
        { id: "album", label: "Albüm", icon: Archive },
        { id: "school-radio", label: "Okul Radyosu", icon: RadioTower },
      ],
    },
    {
      id: "management-group",
      label: "Yönetim İşleri",
      icon: ClipboardCheck,
      color: {
        bg: "bg-sky-600",
        hover: "hover:bg-sky-700",
        text: "text-sky-500",
        border: "border-sky-500/30",
        hoverBg: "hover:bg-sky-500/10",
        activeBg: "bg-sky-500/15 text-sky-400",
      },
      subItems: [
        { id: "attendance-slip", label: "Yoklama Fişi", icon: ClipboardCheck },
        { id: "kelebek-b", label: "Ortak Sınav Planı", icon: Sparkles },
        { id: "social-clubs-activities", label: "Kulüpler / Sosyal Etkinlikler", icon: UsersRound },
        { id: "student-teacher-assignments", label: "Öğrenci Görevlendirme", icon: ClipboardList },
        { id: "responsibility-exams", label: "Sorumluluk Sınavı", icon: GraduationCap },
        { id: "lost-documents", label: "Belgesini Kaybedenler", icon: FileText },
        { id: "parent-consents", label: "Veli Onay Bilgisi", icon: ClipboardCheck },
        { id: "survey", label: "Anket Paneli", icon: ClipboardCheck },
        { id: "news-management", label: "Haber Yönetimi", icon: Newspaper, targetTab: "announcements", announcementSubTab: "news" },
      ],
    },
  ].map((group) => ({
    ...group,
    subItems: group.subItems.filter((item: any) => canShowTab(String(item.targetTab || item.id))),
  })).filter((group) => group.subItems.length > 0);

  const groupOrder = [
    "exams-group",
    "education-coach-group",
    "daredi-group",
    "hdd-group",
    "messages-group",
    "management-group",
    "survey-group",
  ];

  const orderedGroups = groups.filter((group) => group.id !== "data-group").sort(
    (first, second) => groupOrder.indexOf(first.id) - groupOrder.indexOf(second.id),
  );
  // Odaklı sidebar davranışı:
  // - Normal durumda tüm sarı ana gruplar kendi sabit sıralarında görünür.
  // - Bir grup açıldığında yalnızca o grup görünür ve listenin en üstünde yer alır.
  // - Aynı gruba tekrar basılıp kapatıldığında tüm gruplar eski sabit sıralarıyla geri gelir.
  const expandedGroupId = Object.keys(expandedGroups).find((groupId) => expandedGroups[groupId]);
  const displayedGroups = expandedGroupId
    ? orderedGroups.filter((group) => group.id === expandedGroupId)
    : orderedGroups;
  const dataManagementGroup = groups.find((group) => group.id === "data-group") ?? {
    id: "data-group",
    label: "Veri Yönetimi",
    icon: Database,
    color: {
      bg: "bg-blue-600",
      hover: "hover:bg-blue-700",
      text: "text-blue-600",
      border: "border-blue-500/30",
      hoverBg: "hover:bg-blue-500/10",
      activeBg: "bg-blue-500/15 text-blue-600",
    },
    subItems: [],
  };

  const sidebarContent = (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-50 text-slate-700">
      {/* Navigation Scrollable Panel */}
      <div className="relative z-10 flex-1 space-y-4 overflow-y-auto px-3 pb-4 pt-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
        <div className={`sticky top-0 z-30 mb-4 bg-slate-50/95 pt-3 backdrop-blur ${isMinimized ? "px-0" : "px-0"}`}>
          <div className="relative flex w-full justify-center">
            <button
              type="button"
              onClick={() => {
                handleTabSelect("dashboard");
                setExpandedGroups((prev) => Object.fromEntries(Object.keys(prev).map((key) => [key, false])));
              }}
              className={`block rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${isMinimized ? "w-full" : "w-[76%]"}`}
              title="Ana ekrana dön"
              aria-label="e-Nstitü ana ekrana dön"
            >
              <img
                src="/enstitu-sidebar-logo.png"
                alt="e-Nstitü"
                className="mx-auto block h-auto w-full rounded-xl object-contain"
              />
            </button>
            {!isMinimized && (
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="absolute right-2 top-2 hidden h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/45 text-white shadow-sm backdrop-blur hover:bg-black/65 md:flex"
                title="Menüyü daralt"
                aria-label="Menüyü daralt"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Stratejik merkez butonları kullanıcı isteğiyle kaldırıldı. */}

        {/* Collapsible Accordion Navigation Groups */}
        <div className="relative space-y-2 pb-[38px]">
          {displayedGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups[group.id];
            
            // Determine if group contains active item
            const hasActiveItem = group.subItems.some((sub: any) => String(sub.targetTab || sub.id) === activeTab);
            
            return (
              <div key={group.id} className="space-y-1.5">
                {isMinimized ? (
                  /* MINIMIZED DESKTOP STATE: Icon strip with Tailwind Hover Menu Dropdowns */
                  <div className="relative group/mini flex justify-center">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={`h-11 w-11 flex items-center justify-center rounded-xl transition-all cursor-pointer border ${
                        hasActiveItem
                          ? `${group.color.bg} text-white border-transparent`
                          : "border-amber-400 bg-yellow-300 text-slate-800 hover:bg-yellow-400 hover:text-slate-950"
                      }`}
                    >
                      <GroupIcon className="w-4.5 h-4.5" />
                    </button>

                    {/* Popover Hover Dropdown */}
                    <div className={`z-50 ml-2 w-56 rounded-2xl border border-sky-100 bg-white p-2 shadow-lg ${isExpanded ? "fixed left-20 top-24 block" : "absolute left-full top-0 hidden group-hover/mini:block"}`}>
                      <div className="mb-1.5 border-b border-slate-100 px-3 py-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {fontBoostMenuLabels.has(group.label) ? <span style={{ fontSize: 'calc(1em + 2pt)' }}>{group.label}</span> : group.label}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {group.subItems.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = String((sub as any).targetTab || sub.id) === "education-coach"
                            ? activeTab === "education-coach" && coachActiveSubTab === String((sub as any).coachSubTab || "dashboard")
                            : activeTab === String((sub as any).targetTab || sub.id);
                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleMenuItemSelect(sub)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-bold transition-all text-left cursor-pointer ${
                                isSubActive
                                  ? "border-l-2 border-indigo-500 bg-indigo-50 text-indigo-700"
                                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                              }`}
                            >
                              <SubIcon className="w-3.5 h-3.5" />
                              <span>{sub.label}</span>
                            </button>
                          );
                        })}
                        {group.id === "hdd-group" && canShowTab("human-resources") && (
                          <div className="mt-2 border-t border-blue-100 pt-2">
                            <button
                              type="button"
                              onClick={handleTeacherAssignmentShortcut}
                              className="flex w-full items-center gap-2.5 rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-left text-[13px] font-black text-white shadow-sm transition hover:bg-blue-700"
                            >
                              <User className="h-3.5 w-3.5" />
                              <span>Öğretmen Atama</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* EXPANDED DEFAULT STATE: Accordion Collapsible Item */
                  <div className="relative overflow-hidden rounded-xl">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={`relative flex w-full items-center justify-between rounded-xl border px-3 py-2 text-[14px] font-bold tracking-normal shadow-sm transition-colors ${
                        isExpanded
                          ? "border-red-700 bg-red-600 text-white shadow-md hover:bg-red-700"
                          : "border-amber-400 bg-yellow-300 text-slate-900 hover:border-amber-500 hover:bg-yellow-400"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`relative flex h-8 w-8 items-center justify-center rounded-xl border ${
                          isExpanded
                            ? "border-slate-300 bg-white text-slate-950"
                            : hasActiveItem
                            ? `${group.color.bg} border-transparent text-white`
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}>
                          <GroupIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate">{fontBoostMenuLabels.has(group.label) ? <span style={{ fontSize: 'calc(1em + 2pt)' }}>{group.label}</span> : group.label}</span>
                      </div>
                      <div>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </div>
                    </button>

                    <div
                      className="grid"
                      style={{
                        gridTemplateRows: isExpanded ? "1fr" : "0fr",
                        opacity: isExpanded ? 1 : 0,
                        transition: "grid-template-rows 120ms ease-out, opacity 90ms ease-out",
                      }}
                      aria-hidden={!isExpanded}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="relative ml-5 mt-1.5 space-y-1 pb-2 pl-3 pr-1 pt-1">
                          <span className={`absolute -left-px top-0 h-7 w-px ${group.color.bg} opacity-60`} />
                          {group.subItems.map((sub) => {
                            const SubIcon = sub.icon;
                            const isSubActive = String((sub as any).targetTab || sub.id) === "education-coach"
                            ? activeTab === "education-coach" && coachActiveSubTab === String((sub as any).coachSubTab || "dashboard")
                            : activeTab === String((sub as any).targetTab || sub.id);

                            return (
                              <button
                                key={sub.id}
                                onClick={() => handleMenuItemSelect(sub)}
                                tabIndex={isExpanded ? 0 : -1}
                                className={`group/sub relative flex w-full items-center gap-2.5 overflow-visible rounded-lg border py-2 pl-3 pr-3 text-left text-[13px] font-medium tracking-normal transition-colors ${
                                  isSubActive
                                    ? "border-slate-500 bg-slate-400 font-bold text-slate-950"
                                    : "border-slate-300 bg-slate-200 text-slate-900 hover:border-slate-400 hover:bg-slate-300"
                                }`}
                              >
                                <span className="absolute -left-[13px] top-1/2 h-px w-3 bg-slate-300" />
                                <SubIcon className={`h-3.5 w-3.5 shrink-0 ${isSubActive ? "text-slate-900" : "text-slate-600"}`} />
                                <span className="truncate">{sub.label}</span>
                              </button>
                            );
                          })}
                          {group.id === "hdd-group" && canShowTab("human-resources") && (
                            <div className="mt-3 border-t border-blue-200 pt-3">
                              <button
                                type="button"
                                onClick={handleTeacherAssignmentShortcut}
                                tabIndex={isExpanded ? 0 : -1}
                                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-blue-700 bg-blue-600 px-3 py-2.5 text-[13px] font-black text-white shadow-sm transition-colors hover:bg-blue-700"
                              >
                                <User className="h-4 w-4 shrink-0" />
                                <span>Öğretmen Atama</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / Minimize Action & User Card */}
      <div className="relative z-10 shrink-0 space-y-2 border-t border-slate-200 bg-white p-3">
        {/* Desktop Maximize Button (Only visible when minimized) */}
        {isMinimized && (
          <div className="flex justify-center">
            <button
              onClick={() => setIsMinimized(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:translate-x-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
              title="Genişlet"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}


        {canSeeReleaseInfo && !isMinimized && releaseInfo && (
          <div
            className={`rounded-xl border px-3 py-2 ${releaseInfo.gitBranch === "master" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
            title={`Git dalı: ${releaseInfo.gitBranch} | Commit: ${releaseInfo.gitCommit}`}
          >
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
              <span className={`h-2 w-2 rounded-full ${releaseInfo.gitBranch === "master" ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span>{releaseInfo.gitBranch === "master" ? "Canlı sürüm" : "Çalışma sürümü"}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 truncate text-[10px] font-bold text-slate-700">
              <span>v{releaseInfo.version.replace(/^v/i, "")}</span>
              <span className="text-slate-300">•</span>
              <span>{releaseInfo.gitBranch}</span>
              <span className="text-slate-300">•</span>
              <code className="font-mono text-[9px] text-slate-500">{releaseInfo.gitCommit}</code>
            </div>
          </div>
        )}

        {/* User Card info and logout */}
        <div className={`relative flex w-full items-center overflow-hidden rounded-2xl border border-sky-100 bg-white/85 p-1.5 ${isMinimized ? "justify-center" : "gap-1"}`}>
          <span className="absolute bottom-0 left-0 top-0 w-1 bg-sky-400" />
          <button type="button" onClick={() => handleTabSelect(canShowTab("settings") ? "settings" : "dashboard")} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-sky-50 ${isMinimized ? "justify-center" : ""}`}>
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <User className="w-4 h-4" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            {!isMinimized && (
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[11px] font-bold leading-none text-slate-800">{currentUser?.fullName || "Yönetici"}</span>
                <span className="mt-0.5 truncate text-[9px] font-bold text-sky-600">{roleLabel(cloudRole)}</span>
                <span className="mt-0.5 truncate text-[9px] font-medium text-slate-400">{currentUser?.email || ""}</span>
              </div>
            )}
          </button>
          {onLogout && (
            <button type="button" onClick={onLogout} className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Programdan çıkış" aria-label="Programdan çıkış">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP PERMANENT SIDEBAR */}
      <div
        className={`hidden md:block h-screen shrink-0 transition-all duration-300 ${
          isMinimized ? "w-20" : "w-72"
        }`}
      >
        {sidebarContent}
      </div>

      {/* 2. MOBILE FLOATING ACCORDION DRAWER */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop layer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />

            {/* Sidebar drawer body */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 h-full w-80 max-w-[84vw] shadow-2xl md:hidden"
            >
              <div className="relative h-full">
                {sidebarContent}
                
                {/* Float-out close button */}
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="absolute right-[-44px] top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-md transition-all hover:bg-rose-50 hover:text-rose-600"
                  title="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Right-edge data management drawer */}
      {dataManagementGroup.subItems.length > 0 && <>
      <button
        type="button"
        onClick={() => setIsDataPanelOpen((current) => !current)}
        className={`fixed right-0 top-1/2 z-[52] flex h-[20mm] w-[8mm] -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-red-700 bg-red-600 text-white shadow-lg transition-all hover:bg-red-700 ${isDataPanelOpen ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}
        title="Veri Yönetimi"
        aria-label="Veri Yönetimi menüsünü aç"
      >
        <Database className="h-4 w-4" />
      </button>
      <aside
        onMouseLeave={() => setIsDataPanelOpen(false)}
        className={`fixed inset-y-0 right-0 z-[51] flex w-80 max-w-[88vw] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out ${isDataPanelOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!isDataPanelOpen}
      >
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-black text-slate-900">{dataManagementGroup.label}</h2>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">Okul verileri ve tanımlamalar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDataPanelOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <nav className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 px-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Veri Yönetimi Araçları</p>
          <div className="space-y-1.5">
            {dataManagementGroup.subItems.map((sub) => {
              const SubIcon = sub.icon;
              const isSubActive = activeTab === String((sub as any).targetTab || sub.id);
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    handleTabSelect(sub.id);
                    setIsDataPanelOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-xs font-semibold transition-colors ${isSubActive ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50"}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isSubActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                    <SubIcon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{sub.label}</span>
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
                </button>
              );
            })}


          </div>
        </nav>
      </aside>
      </>}

    </>
  );
}
