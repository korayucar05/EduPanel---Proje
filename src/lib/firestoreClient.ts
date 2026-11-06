import { enableNetwork, getFirestore, type Firestore } from "firebase/firestore";
import { requireFirebaseApp } from "./firebaseApp";

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env || {});

export const firestoreDatabaseId = String(env.VITE_FIRESTORE_DATABASE_ID || "").trim();

let cachedFirestore: Firestore | null = null;

/**
 * e-Nstitü'ın bütün bulut veri erişimini aynı Firestore veritabanına bağlar.
 * AI Studio/Firebase applet yapılandırması named database kullanıyorsa
 * VITE_FIRESTORE_DATABASE_ID üzerinden seçilir; aksi halde default DB kullanılır.
 */
export function getHasatFirestore(): Firestore {
  if (cachedFirestore) return cachedFirestore;
  const app = requireFirebaseApp();
  cachedFirestore = firestoreDatabaseId
    ? getFirestore(app, firestoreDatabaseId)
    : getFirestore(app);
  return cachedFirestore;
}

/** Firestore istemcisinin yanlışlıkla offline kalması durumunda ağı yeniden açar. */
export async function ensureHasatFirestoreNetwork(): Promise<Firestore> {
  const db = getHasatFirestore();
  await enableNetwork(db);
  return db;
}
