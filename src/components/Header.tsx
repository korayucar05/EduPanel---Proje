import React, { useState, useEffect } from "react";
import {
  Bell,
  Search,
  Calendar as CalendarIcon,
  Clock,
  ShieldAlert,
  ChevronDown,
  Menu,
  LogOut,
} from "lucide-react";
import { PanelUser } from "../lib/accessControl";
import { BRAND_EXPANSION, BRAND_NAME } from "../constants/branding";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
  currentUser?: PanelUser;
  onLogout?: () => void;
}

export default function Header({ title, onMenuClick, currentUser, onLogout }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return time.toLocaleDateString("tr-TR", options);
  };

  const formatTime = () => {
    return time.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Get active tab heading in stylish readable Turkish
  const getTabLabel = (id: string) => {
    switch (id) {
      case "dashboard":
        return "Genel Durum Analizi";
      case "school-info":
        return "Okul Tanıtım & Kurumsal Bilgiler";
      case "human-resources":
        return "İnsan Kaynakları Yönetim Paneli";
      case "students":
        return "Öğrenci Kayıt Defteri";
      case "teachers":
        return "Öğretmen Kadrosu ve Atamalar";
      case "courses":
        return "Ders Programı & Sınıf Dağılımı";
      case "committees":
        return "Kurul ve Komisyon Yönetimi";
      case "whatsapp":
        return "WhatsApp Entegrasyonu";
      case "database":
        return "Veritabanı";
      case "exam-tools":
        return "Sınav Araç Gereçleri";
      case "announcements":
        return "Kurumsal Duyuru Panosu";
      case "messages":
        return "Whatsapp Mesaj";
      case "settings":
        return "Okullar, Kullanıcılar ve Yetkiler";
      case "exam-prepare":
        return "Sınav Hazırlama Paneli";
      case "exam-analysis":
        return "Sınav Sonuçları ve Analiz";
      case "exam-reports":
        return "Sınav Raporları";
      case "behavior":
        return "Davranış Takip Sistemi";
      case "guidance":
        return "Rehberlik ve Psikolojik Danışmanlık";
      case "discipline":
        return "Disiplin İşlemleri";
      case "discipline-analytics":
        return "Disiplin Analitik";
      case "learning-map":
        return "Öğrenme Haritası";
      case "teacher-analytics":
        return "Öğretmen Analitik";
      case "institution-trends":
        return "Kurum Trendleri ve Zümre Karar Paneli";
      case "hasat-brain":
        return "e-Nstitü Brain · Kurumsal Karar Zekâsı";
      case "responsibility-exam-seating":
        return "Sınav Yerleşim Planı";
      case "class-student-seating":
        return "Sınıf Oturma Planı";
      case "yearbook":
        return "Yıllık";
      default:
        return "Yönetim Sistemi";
    }
  };

  return (
    <header
      id="main-app-header"
      className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 md:px-6 lg:px-8 shrink-0 shadow-sm z-10"
    >
      {/* Title with context */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            title="Menüyü Aç"
          >
            <Menu className="w-5.5 h-5.5" />
          </button>
        )}
        <img src="/enstitu-mark-square.png" alt="" className="hidden h-9 w-9 rounded-xl sm:block" />
        <div className="hidden min-w-0 border-r border-slate-200 pr-3 sm:block">
          <div className="text-sm font-black tracking-[0.08em] text-slate-900">{BRAND_NAME}</div>
          <div className="hidden max-w-[220px] truncate text-[7px] font-semibold text-slate-500 xl:block">{BRAND_EXPANSION}</div>
        </div>
        <div id="header-title-section" className="flex flex-col">
          <h1 className="text-base md:text-lg font-bold text-slate-800 tracking-tight leading-tight">
            {getTabLabel(title)}
          </h1>
        </div>
      </div>

      {/* Stats / Realtime Clock Information */}
      <div
        id="header-time-stats"
        className="hidden lg:flex items-center gap-6 bg-slate-50 border border-slate-100 rounded-xl px-4 py-1.5"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <CalendarIcon className="w-4 h-4 text-slate-400" />
          <span>{formatDate()}</span>
        </div>
        <div className="h-4 w-px bg-slate-200"></div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-600">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>{formatTime()}</span>
        </div>
      </div>

      {/* Right side actions */}
      <div id="header-actions" className="flex items-center gap-4">
        {currentUser && <div className="hidden text-right xl:block"><strong className="block text-xs text-slate-700">{currentUser.fullName}</strong><span className="text-[10px] text-slate-400">{currentUser.username}</span></div>}
        {/* Rapid Search bar preview */}
        <div className="relative hidden md:block">
          <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Sistem genelinde ara..."
            className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-56 lg:w-64 transition-all hover:bg-slate-100/55"
          />
        </div>

        {/* Dynamic Alert Button */}
        <div className="relative group">
          <button
            id="notifications-button"
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer relative"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
          </button>

          {/* Quick Notifications micro-dropdown on hover */}
          <div className="absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 hidden group-hover:block z-50">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
              <span className="font-bold text-slate-800 text-xs">
                Son Bildirimler (2)
              </span>
              <span className="text-[10px] text-indigo-600 font-semibold cursor-pointer hover:underline">
                Tümünü Oku
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-xs text-slate-800 font-medium">
                    Kritik Devamsızlık Sınırı: Can Demir
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    11-A Sınıfı öğrencisi 11 devamsızlığa ulaştı.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-xs text-slate-800 font-medium">
                    Yeni Öğretmen İzinli Bildirimi
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Kimya Öğretmeni Marie Curie bugün raporlu.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {onLogout && <button type="button" onClick={onLogout} className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Güvenli çıkış"><LogOut className="h-5 w-5" /></button>}
      </div>
    </header>
  );
}
