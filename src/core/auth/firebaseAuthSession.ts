import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseApp, isFirebaseConfigured, requireFirebaseApp } from "../../lib/firebaseApp";
import { clearSchoolMembershipCache } from "./schoolMembership";

import { runtimeSessionStorage } from "../../lib/runtimeSessionStorage";
export type FirebaseAuthState = {
  configured: boolean;
  authenticated: boolean;
  uid?: string;
  email?: string;
  error?: string;
};

const stateKey = "hasat_firebase_auth_state_v1";

const saveState = (state: FirebaseAuthState) => {
  if (typeof window === "undefined") return;
  runtimeSessionStorage.setItem(stateKey, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("hasat-firebase-auth-changed", { detail: state }));
};

export const readFirebaseAuthState = (): FirebaseAuthState => {
  if (!isFirebaseConfigured) return { configured: false, authenticated: false };
  if (typeof window === "undefined") return { configured: true, authenticated: false };
  try {
    const parsed = JSON.parse(runtimeSessionStorage.getItem(stateKey) || "null") as FirebaseAuthState | null;
    return parsed || { configured: true, authenticated: false };
  } catch {
    return { configured: true, authenticated: false };
  }
};

const fromUser = (user: User | null): FirebaseAuthState => ({
  configured: isFirebaseConfigured,
  authenticated: Boolean(user),
  uid: user?.uid,
  email: user?.email || undefined,
});

export const firebaseAuthSession = {
  async connect(email: string, password: string): Promise<FirebaseAuthState> {
    if (!isFirebaseConfigured) {
      const state = { configured: false, authenticated: false };
      saveState(state);
      return state;
    }
    if (!email) {
      const state = { configured: true, authenticated: false, error: "Kullanıcının Firebase e-posta adresi tanımlı değil." };
      saveState(state);
      return state;
    }
    try {
      const credential = await signInWithEmailAndPassword(getAuth(requireFirebaseApp()), email, password);
      const state = fromUser(credential.user);
      saveState(state);
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Firebase oturumu açılamadı.";
      const state = { configured: true, authenticated: false, error: message };
      saveState(state);
      return state;
    }
  },

  async disconnect(): Promise<void> {
    clearSchoolMembershipCache();
    if (isFirebaseConfigured) await signOut(getAuth(requireFirebaseApp())).catch(() => undefined);
    saveState({ configured: isFirebaseConfigured, authenticated: false });
  },

  currentUser(): User | null {
    if (!isFirebaseConfigured) return null;
    return getAuth(requireFirebaseApp()).currentUser;
  },

  requireUser(): User {
    const user = this.currentUser();
    if (!user) throw new Error("Bulut senkronizasyonu için Firebase oturumu gerekli.");
    return user;
  },

  subscribe(listener: (state: FirebaseAuthState) => void): () => void {
    if (!isFirebaseConfigured) {
      listener({ configured: false, authenticated: false });
      return () => undefined;
    }
    return onAuthStateChanged(getAuth(requireFirebaseApp()), (user) => {
      const state = fromUser(user);
      saveState(state);
      listener(state);
    });
  },
};
