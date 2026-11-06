export type WebPushSubscribeOptions = {
  subscribeUrl: string;
  unsubscribeUrl?: string;
  headers?: Record<string, string>;
  startUrl?: string;
};

type IosVersion = { major: number; minor: number } | null;

const base64UrlToUint8Array = (value: string) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
};

const isIosDevice = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

const iosVersion = (): IosVersion => {
  if (!isIosDevice()) return null;
  const ua = navigator.userAgent || "";
  const direct = ua.match(/OS (\d+)[._](\d+)/i);
  if (direct) return { major: Number(direct[1] || 0), minor: Number(direct[2] || 0) };
  const safari = ua.match(/Version\/(\d+)\.(\d+)/i);
  return safari ? { major: Number(safari[1] || 0), minor: Number(safari[2] || 0) } : null;
};

const isStandaloneWebApp = () => {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
};

const isNativeCapacitor = () => {
  try {
    const capacitor = (window as any)?.Capacitor;
    return Boolean(capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

export const webPushSupported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const assertWebPushEnvironment = () => {
  if (typeof window === "undefined") throw new Error("Bildirim özelliği bu ortamda kullanılamıyor.");
  if (!window.isSecureContext) {
    throw new Error("Bildirim için e-Nstitü HTTPS üzerinden açılmalıdır.");
  }

  if (isNativeCapacitor()) {
    throw new Error("Bu iPhone sürümünde native bildirim, Xcode/APNs kurulumu tamamlandıktan sonra etkinleşir. Şimdilik Ana Ekran web uygulamasındaki bildirim sistemini kullanın.");
  }

  if (isIosDevice()) {
    const version = iosVersion();
    if (version && (version.major < 16 || (version.major === 16 && version.minor < 4))) {
      throw new Error("iPhone kapalıyken bildirim için iOS 16.4 veya daha yeni bir sürüm gerekir.");
    }
    if (!isStandaloneWebApp()) {
      throw new Error("iPhone’da kapalıyken bildirim için önce e-Nstitü’yü Ana Ekrana ekleyin; ardından bildirimi Ana Ekrandaki e-Nstitü uygulamasının içinden açın.");
    }
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("Bu telefon veya tarayıcı Web Push bildirimini desteklemiyor.");
  }
};

const ensurePushServiceWorker = async () => {
  let registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) {
    registration = await navigator.serviceWorker.register("/enstitu-sw.js?v=38", {
      scope: "/",
      updateViaCache: "none",
    });
  } else {
    try { await registration.update(); } catch {}
  }
  const ready = await navigator.serviceWorker.ready;
  return ready || registration;
};

export async function enableWebPush(options: WebPushSubscribeOptions) {
  assertWebPushEnvironment();

  // Apple, iPhone/iPad web uygulamalarında izin isteğinin doğrudan kullanıcı
  // dokunuşundan doğmasını ister. Bu fonksiyon yalnız arayüzdeki bildirim
  // düğmesinin click/tap işleyicisinden çağrılır.
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Telefon bildirim izni verilmedi. Ayarlar > Bildirimler > e-Nstitü bölümünden izin verebilirsiniz.");

  const registration = await ensurePushServiceWorker();
  const keyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
  const keyData = await keyResponse.json().catch(() => ({}));
  if (!keyResponse.ok || !keyData?.publicKey) {
    throw new Error(keyData?.error || "Push sunucusu anahtarı alınamadı.");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(String(keyData.publicKey)),
    });
  }

  const response = await fetch(options.subscribeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      startUrl: options.startUrl || window.location.href,
      userAgent: navigator.userAgent,
      platform: isIosDevice() ? "ios-webapp" : "web",
      standalone: isStandaloneWebApp(),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Push aboneliği sunucuya kaydedilemedi.");

  // iOS ana ekran rozetini ilk abonelikte temizle. Bildirim geldiğinde service
  // worker yeniden 1 olarak işaretler; kullanıcı uygulamayı açtığında kaldırılır.
  try {
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    await nav.clearAppBadge?.();
  } catch {}

  return { subscription, data };
}

export async function disableWebPush(options: WebPushSubscribeOptions) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager?.getSubscription?.();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  if (options.unsubscribeUrl || options.subscribeUrl) {
    try {
      await fetch(options.unsubscribeUrl || options.subscribeUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        body: JSON.stringify({ endpoint }),
      });
    } catch {}
  }

  // Aynı telefonda öğrenci/veli/öğretmen gibi birden fazla e-Nstitü hesabı
  // bulunabileceğinden ortak tarayıcı PushSubscription'ı fiziksel olarak silmeyiz.
  try {
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    await nav.clearAppBadge?.();
  } catch {}
}

export async function hasWebPushSubscription() {
  if (!webPushSupported()) return false;
  if (isIosDevice() && !isStandaloneWebApp()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    return Notification.permission === "granted" && Boolean(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}
