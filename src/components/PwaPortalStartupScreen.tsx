import React from "react";
import adminPhoto from "../assets/splash/mobile-role-1.jpg";
import teacherPhoto from "../assets/splash/mobile-role-2.jpg";
import parentPhoto from "../assets/splash/mobile-role-4.jpg";
import studentPhoto from "../assets/splash/mobile-role-3.jpg";
import enstituLogo from "../assets/splash/enstitu-logo-transparent.png";
import schoolLogo from "../assets/ordu-lisesi-logo.png";
import "../styles/admin-phone-splash.css";

type CachedPortal = {
  teacherName?: string;
  fullName?: string;
  role?: string;
  staffRole?: string;
  position?: string;
  title?: string;
};

type PublicPortalIdentity = {
  studentName?: string;
  studentId?: string;
  studentNumber?: string;
  classroom?: string;
  schoolName?: string;
};

type StartupTheme = {
  photo: string;
  roleLabel: string;
  greeting: React.ReactNode;
  subtitle: string;
  variantClass: "is-admin" | "is-teacher";
};

const teacherTokenFromPath = () => decodeURIComponent(window.location.pathname.match(/^\/t\/([^/]+)\/?$/i)?.[1] || "");
const publicTokenFromPath = () => {
  const match = window.location.pathname.match(/^\/(veli|ogrenci)\/([^/]+)\/?$/i);
  return match ? { kind: match[1].toLowerCase() as "veli" | "ogrenci", token: decodeURIComponent(match[2] || "") } : null;
};

const readCachedTeacherPortal = (): CachedPortal | null => {
  const token = teacherTokenFromPath();
  if (!token) return null;
  try {
    const raw = localStorage.getItem(`enstitu_teacher_link_cache_v2:${token}`);
    const value = raw ? JSON.parse(raw) : null;
    if (value && typeof value === "object") return value;

    const role = String(localStorage.getItem(`enstitu:pwa:portal-role:${token}`) || "").trim();
    const fullName = String(localStorage.getItem(`enstitu:pwa:portal-name:${token}`) || "").trim();
    return role || fullName ? { role, staffRole: role, teacherName: fullName, fullName } : null;
  } catch {
    return null;
  }
};

const readCachedPublicPortal = (): PublicPortalIdentity | null => {
  const match = publicTokenFromPath();
  if (!match?.token) return null;
  const storageKeys = [
    `enstitu-portal-identity:${match.kind === "ogrenci" ? "student" : "parent"}:${match.token}`,
  ];
  for (const key of storageKeys) {
    try {
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      const value = raw ? JSON.parse(raw) : null;
      if (value && typeof value === "object") return value;
    } catch {}
  }
  return null;
};

const isAdminPortal = (value: CachedPortal | null) => {
  const probe = [value?.role, value?.staffRole, value?.position, value?.title]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
  return /admin|administrator|principal|vice[_ -]?principal|deputy[_ -]?principal|assistant[_ -]?principal|müdür|mudur|yönetici|yonetici/.test(probe);
};

const resolveTheme = (): StartupTheme => {
  const publicPortal = publicTokenFromPath();
  if (publicPortal?.kind === "ogrenci") {
    const identity = readCachedPublicPortal();
    const name = String(identity?.studentName || "Öğrenci").trim() || "Öğrenci";
    return {
      photo: studentPhoto,
      roleLabel: "ÖĞRENCİ",
      greeting: <>Merhaba {name},<br />iyi çalışmalar.</>,
      subtitle: "Öğrenci uygulaman hazırlanıyor.",
      variantClass: "is-admin",
    };
  }
  if (publicPortal?.kind === "veli") {
    const identity = readCachedPublicPortal();
    const studentName = String(identity?.studentName || "").trim();
    return {
      photo: parentPhoto,
      roleLabel: "VELİ",
      greeting: studentName
        ? <>Sayın Veli,<br />{studentName} için uygulama hazırlanıyor.</>
        : <>Sayın Veli,<br />iyi çalışmalar.</>,
      subtitle: "Veli bilgilendirme ekranı hazırlanıyor.",
      variantClass: "is-admin",
    };
  }

  const cachedTeacher = readCachedTeacherPortal();
  const admin = isAdminPortal(cachedTeacher);
  const name = String(cachedTeacher?.teacherName || cachedTeacher?.fullName || (admin ? "Yönetici" : "Öğretmen")).trim();
  return {
    photo: admin ? adminPhoto : teacherPhoto,
    roleLabel: admin ? "YÖNETİCİ" : "ÖĞRETMEN",
    greeting: <>Sayın {name},<br />iyi çalışmalar{admin ? "." : " dileriz."}</>,
    subtitle: admin ? "Okulunuzun tüm süreçleri burada." : "Geleceği birlikte inşa ediyoruz.",
    variantClass: admin ? "is-admin" : "is-teacher",
  };
};

export default function PwaPortalStartupScreen() {
  const teacherToken = teacherTokenFromPath();
  const teacherSplashAlreadyShown = React.useMemo(() => {
    if (!teacherToken) return false;
    try {
      return sessionStorage.getItem(`enstitu:pwa:staff-splash-shown:${teacherToken}`) === "1";
    } catch {
      return false;
    }
  }, [teacherToken]);
  const theme = React.useMemo(resolveTheme, []);

  // Öğretmen/idareci portalı aynı oturum içinde yeniden yüklenirse resimli
  // giriş ekranını tekrar göstermeyip doğrudan portalın ana menüsüne geç.
  if (teacherToken && teacherSplashAlreadyShown) {
    return <div aria-hidden="true" className="h-screen w-screen bg-white" />;
  }

  return (
    <div className={`admin-phone-splash ${theme.variantClass}`} aria-hidden="true">
      <div className="admin-phone-splash-card">
        <div className="admin-phone-splash-photo">
          <img src={theme.photo} alt="" />
        </div>
        <section className="admin-phone-splash-panel">
          <div className="admin-phone-splash-wave admin-phone-splash-wave-a" />
          <div className="admin-phone-splash-wave admin-phone-splash-wave-b" />
          <div className="admin-phone-splash-wave admin-phone-splash-wave-c" />
          <div className="admin-phone-splash-wave-logo">
            <img src={enstituLogo} alt="" />
            <span>e-Nstitü</span>
          </div>
          <div className="admin-phone-splash-role">{theme.roleLabel}</div>
          <div className="admin-phone-splash-rule" />
          <div className="admin-phone-splash-greeting">{theme.greeting}</div>
          <div className="admin-phone-splash-subtitle">{theme.subtitle}</div>
          <div className="admin-phone-splash-progress"><span /></div>
          <div className="admin-phone-splash-loading">Uygulama hazırlanıyor...</div>
          <div className="admin-phone-splash-school">
            <img src={schoolLogo} alt="Ordu Lisesi" />
            <div>
              <strong>Ordu Lisesi</strong>
              <span>Ordu'nun taa kendisi</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
