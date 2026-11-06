import { initializeSqliteStorageBridge } from "./lib/sqliteStorageBridge";
import { isStudentRegistrationRoute } from "./utils/studentRegistrationRoute";

const PRELOAD_RECOVERY_KEY = "enstitu_preload_recovery_at";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const previous = Number(sessionStorage.getItem(PRELOAD_RECOVERY_KEY) || 0);
  const now = Date.now();
  if (now - previous < 15_000) return;
  sessionStorage.setItem(PRELOAD_RECOVERY_KEY, String(now));
  window.location.reload();
});

window.setTimeout(() => {
  sessionStorage.removeItem(PRELOAD_RECOVERY_KEY);
}, 15_000);

async function bootstrap() {
  // Kalıcı öğretmen bağlantısı kendi verisini doğrudan güvenli link API'sinden
  // alır. Yönetim paneline ait SQLite/localStorage aynasını ve çekirdek runtime'ı
  // bekletmek mobil açılışta gereksiz, uzun bir beyaz ekran oluşturur.
  // Public QR registration must not wait for the administrator's SQLite
  // hydration. On phones the local API may be unreachable or slow even when
  // the web page itself is available, which otherwise leaves a blank screen.
  if (isStudentRegistrationRoute(window.location) || /^\/(?:t|veli|ogrenci)\/[^/]+\/?$/i.test(window.location.pathname)) {
    await import("./main.tsx");
    return;
  }

  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  await initializeSqliteStorageBridge();

  // UI'yi veritabanı sağlık kontrolüne bağlama. Login/ana kabuk hemen render edilir;
  // çekirdek sağlık kontrolü arka planda tamamlanır.
  await import("./main.tsx");

  void Promise.all([import("./core/runtime"), import("./core/performance")])
    .then(async ([{ hasatRuntime }, { performanceMonitor }]) => {
      await hasatRuntime.start();
      const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      performanceMonitor.record("bootstrap.total", endedAt - startedAt);
      window.addEventListener("pagehide", () => { void hasatRuntime.flush(); }, { once: true });
    })
    .catch((error) => console.warn("e-Nstitü çekirdek çalışma zamanı degraded modda başlatıldı:", error));
}

bootstrap().catch((error) => {
  console.error("e-Nstitü başlatılamadı:", error);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="font-family:system-ui;padding:32px"><h2>e-Nstitü başlatılamadı</h2><p>${String(error?.message || error)}</p><button onclick="location.reload()">Yeniden dene</button></div>`;
  }
});
