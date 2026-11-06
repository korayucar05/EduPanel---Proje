import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env || {});
const runtimeConfig = typeof window !== "undefined"
  ? (window as unknown as { __HASAT_FIREBASE_CONFIG__?: FirebaseOptions }).__HASAT_FIREBASE_CONFIG__
  : undefined;

export const firebaseConfig: FirebaseOptions = runtimeConfig || {
  apiKey: env.VITE_FIREBASE_API_KEY || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: env.VITE_FIREBASE_APP_ID || "",
};

const text = (value: unknown) => String(value || "").trim();
const looksLikeFirebaseApiKey = (value: unknown) => /^AIza[0-9A-Za-z_-]{20,}$/.test(text(value));
const isPlaceholder = (value: unknown) => /YOUR_|CHANGE_ME|FIREBASE_|example/i.test(text(value));

export const isFirebaseConfigured = Boolean(
  looksLikeFirebaseApiKey(firebaseConfig.apiKey) &&
  text(firebaseConfig.projectId) &&
  text(firebaseConfig.appId) &&
  !isPlaceholder(firebaseConfig.projectId) &&
  !isPlaceholder(firebaseConfig.appId)
);

// Invalid or placeholder Firebase credentials must never crash a local e-Nstitü
// module. Cloud features are optional; SQLite remains the local source of truth.
export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export function requireFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    throw new Error("Firebase yapılandırması geçersiz veya eksik. Yerel e-Nstitü/SQLite çalışmaya devam ediyor; bulut özellikleri için .env Firebase bilgilerini güncelleyin.");
  }
  return firebaseApp;
}
