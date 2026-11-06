import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { isStudentRegistrationRoute } from "./utils/studentRegistrationRoute";
import EnstituPwaInstall from "./components/EnstituPwaInstall.tsx";
import adminStartupPhoto from "./assets/splash/mobile-role-1.jpg";
import teacherStartupPhoto from "./assets/splash/mobile-role-2.jpg";
import studentStartupPhoto from "./assets/splash/mobile-role-3.jpg";
import parentStartupPhoto from "./assets/splash/mobile-role-4.jpg";
import { AppErrorBoundary, RuntimeErrorOverlay, installGlobalErrorHandlers } from "./core/errors";
import { installNativeRuntimeBridge, isNativeEnstituApp } from "./lib/nativeRuntime";
import "./index.css";

installNativeRuntimeBridge();
installGlobalErrorHandlers();

type EnstituBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

declare global {
  interface Window {
    __enstituPwaInstallPrompt?: EnstituBeforeInstallPromptEvent | null;
    __hasatPwaInstallPrompt?: EnstituBeforeInstallPromptEvent | null;
    __enstituPortalStartupStartedAt?: number;
  }
}

const ADMIN_STARTUP = "#ffffff";
const TEACHER_STARTUP = "#ffffff";
const isEnstituPortalPath = (pathname: string) => /^\/(?:t|ogrenci|veli)\/[^/]+\/?$/i.test(pathname);
const isTeacherPath = (pathname: string) => /^\/t\/[^/]+\/?$/i.test(pathname);

const isStandalone = () => {
  try {
    return (
      isNativeEnstituApp() ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
};

const portalToken = (pathname: string) => decodeURIComponent(pathname.match(/^\/t\/([^/]+)\/?$/i)?.[1] || "");

const readCachedRole = (pathname: string) => {
  const token = portalToken(pathname);
  if (!token) return "";
  try {
    const raw = localStorage.getItem(`enstitu_teacher_link_cache_v2:${token}`);
    const value = raw ? JSON.parse(raw) : null;
    const rememberedRole = String(localStorage.getItem(`enstitu:pwa:portal-role:${token}`) || "").trim().toUpperCase();
    const probe = [value?.role, value?.staffRole, value?.position, value?.title, rememberedRole]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    if (/admin|administrator|principal|vice[_ -]?principal|deputy[_ -]?principal|assistant[_ -]?principal|müdür|mudur|yönetici|yonetici/.test(probe)) return "ADMIN";
    if (/rehber|pdr|guidance|counsel/.test(probe)) return "GUIDANCE";
    if (rememberedRole === "TEACHER" || value) return "TEACHER";
    return "";
  } catch {
    return "";
  }
};

const rememberCurrentPortal = () => {
  if (!isEnstituPortalPath(window.location.pathname)) return;
  try {
    localStorage.setItem(
      "enstitu:pwa:last-portal",
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
  } catch {}
};

const resolveStandalonePortal = () => {
  if (isStudentRegistrationRoute(window.location)) return "";
  if (!isStandalone() || window.location.pathname !== "/") return "";
  try {
    const saved = localStorage.getItem("enstitu:pwa:last-portal") || "";
    const savedPath = saved.split(/[?#]/, 1)[0];
    if (isEnstituPortalPath(savedPath)) return saved;

    // Bazı telefonlarda PWA güncellemesi / eski service-worker temizliği sırasında
    // son portal anahtarı silinebiliyor; kişisel yönetici/öğretmen link önbelleği
    // ise cihazda kalıyor. Kurulu uygulama "/" ile açıldığında beyaz/login
    // ekranına düşmek yerine mevcut kişisel linki güvenli biçimde geri bul.
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i) || "";
      const prefix = "enstitu_teacher_link_cache_v2:";
      if (!key.startsWith(prefix)) continue;
      const token = key.slice(prefix.length).trim();
      if (!token) continue;
      try {
        const raw = localStorage.getItem(key);
        const cached = raw ? JSON.parse(raw) : null;
        if (!cached || typeof cached !== "object") continue;
        const recovered = `/t/${encodeURIComponent(token)}`;
        localStorage.setItem("enstitu:pwa:last-portal", recovered);
        return recovered;
      } catch {}
    }
    return "";
  } catch {
    return "";
  }
};

const resolveStartupTheme = () => {
  if (!isTeacherPath(window.location.pathname)) return ADMIN_STARTUP;
  const role = readCachedRole(window.location.pathname);
  return role === "ADMIN" ? ADMIN_STARTUP : TEACHER_STARTUP;
};

const resolveStartupPhoto = () => {
  const pathname = window.location.pathname;
  if (/^\/ogrenci\/[^/]+\/?$/i.test(pathname)) return { src: studentStartupPhoto, position: "center top" };
  if (/^\/veli\/[^/]+\/?$/i.test(pathname)) return { src: parentStartupPhoto, position: "center top" };
  if (isTeacherPath(pathname)) {
    const role = readCachedRole(pathname);
    if (role === "ADMIN") return { src: adminStartupPhoto, position: "center 34%" };
    return { src: teacherStartupPhoto, position: "center 40%" };
  }
  return null;
};

const prepareStartupSurface = () => {
  const portalMode = isEnstituPortalPath(window.location.pathname) || isStandalone();
  if (!portalMode) return false;
  const theme = resolveStartupTheme();
  document.documentElement.classList.add("enstitu-portal-startup");
  document.documentElement.style.background = theme;
  document.body.style.background = theme;
  document.body.style.margin = "0";
  const root = document.getElementById("root");
  if (root) {
    root.style.minHeight = "100vh";
    root.style.background = theme;

    const startupPhoto = resolveStartupPhoto();
    if (startupPhoto && !root.querySelector("[data-enstitu-startup-preview]")) {
      const preview = document.createElement("div");
      preview.dataset.enstituStartupPreview = "true";
      preview.setAttribute("aria-hidden", "true");
      Object.assign(preview.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483646",
        overflow: "hidden",
        background: "#ffffff",
      });

      const image = document.createElement("img");
      image.src = startupPhoto.src;
      image.alt = "";
      Object.assign(image.style, {
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "cover",
        objectPosition: startupPhoto.position,
      });
      preview.appendChild(image);
      root.appendChild(preview);
      return true;
    }
  }
  return false;
};

const ensureMeta = (name: string, content: string) => {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
  return meta;
};

const configureAppleWebApp = () => {
  // iPhone/iPad Home Screen uygulamasının Safari sekmesi gibi değil,
  // bağımsız uygulama olarak açılması için Apple uyumlu meta bilgileri.
  ensureMeta("apple-mobile-web-app-capable", "yes");
  ensureMeta("mobile-web-app-capable", "yes");
  ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  ensureMeta("apple-mobile-web-app-title", "e-Nstitü");
  ensureMeta("format-detection", "telephone=no");

  let viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement("meta");
    viewport.name = "viewport";
    document.head.appendChild(viewport);
  }
  const currentViewport = String(viewport.content || "width=device-width, initial-scale=1");
  const viewportParts = currentViewport
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^viewport-fit=/i.test(item));
  viewportParts.push("viewport-fit=cover");
  viewport.content = viewportParts.join(", ");

  // iOS ana ekran ikonu. Mevcut e-Nstitü ikonunu kullanır; ayrı bir
  // Apple ikon dosyası varsa tarayıcı otomatik olarak daha uygun olanı seçebilir.
  let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!appleIcon) {
    appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = "/enstitu-transparent-192.png?v=38";

  document.documentElement.style.setProperty("--enstitu-safe-top", "env(safe-area-inset-top, 0px)");
  document.documentElement.style.setProperty("--enstitu-safe-right", "env(safe-area-inset-right, 0px)");
  document.documentElement.style.setProperty("--enstitu-safe-bottom", "env(safe-area-inset-bottom, 0px)");
  document.documentElement.style.setProperty("--enstitu-safe-left", "env(safe-area-inset-left, 0px)");
};

const configureManifest = () => {
  configureAppleWebApp();

  let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    document.head.appendChild(manifestLink);
  }

  const teacherToken = portalToken(window.location.pathname);
  if (teacherToken) {
    manifestLink.href = `/api/behavior/teacher-links/${encodeURIComponent(teacherToken)}/manifest.webmanifest?v=38`;
  } else {
    const publicPortal = window.location.pathname.match(/^\/(veli|ogrenci)\/([^/]+)\/?$/i);
    if (publicPortal) {
      manifestLink.href = `/api/behavior/teacher-links/public-portal/${encodeURIComponent(publicPortal[2])}/manifest.webmanifest?v=38`;
    } else {
      manifestLink.href = "/enstitu.webmanifest?v=38";
    }
  }

  const theme = resolveStartupTheme();
  ensureMeta("theme-color", theme);
};

const bootstrap = () => {
  // Eski kurulumların start_url'si "/" ise sayfayı ikinci kez yüklemek yerine
  // aynı belge içinde doğrudan kayıtlı kişisel portala geç. Böylece aradaki
  // siyah/beyaz boş yükleme ekranı oluşmaz.
  const savedPortal = resolveStandalonePortal();
  if (savedPortal) {
    window.history.replaceState(null, "", savedPortal);
  }

  rememberCurrentPortal();
  if (isEnstituPortalPath(window.location.pathname) || isStandalone()) {
    window.__enstituPortalStartupStartedAt = Date.now();
  }
  const hasStartupPreview = prepareStartupSurface();
  configureManifest();

  if (!isNativeEnstituApp()) {
    window.addEventListener("beforeinstallprompt", (event: Event) => {
      event.preventDefault();
      const promptEvent = event as EnstituBeforeInstallPromptEvent;
      window.__enstituPwaInstallPrompt = promptEvent;
      window.__hasatPwaInstallPrompt = promptEvent;
      window.dispatchEvent(new CustomEvent("enstitu:pwa-install-ready"));
      window.dispatchEvent(new CustomEvent("hasat:pwa-install-ready"));
    });

    window.addEventListener("appinstalled", () => {
      window.__enstituPwaInstallPrompt = null;
      window.__hasatPwaInstallPrompt = null;
      window.dispatchEvent(new CustomEvent("enstitu:pwa-installed"));
      window.dispatchEvent(new CustomEvent("hasat:pwa-installed"));
    });
  }

  if (!isNativeEnstituApp() && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/enstitu-sw.js?v=38", { scope: "/", updateViaCache: "none" })
        .catch((error) => console.warn("e-Nstitü servis çalışanı kaydedilemedi:", error));
    });
  }

  const renderApplication = () => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <AppErrorBoundary scope="application-root">
          <App />
          {!isNativeEnstituApp() && <EnstituPwaInstall />}
        </AppErrorBoundary>
        <RuntimeErrorOverlay />
      </StrictMode>,
    );
  };

  if (hasStartupPreview) {
    window.requestAnimationFrame(renderApplication);
  } else {
    renderApplication();
  }
};

bootstrap();
