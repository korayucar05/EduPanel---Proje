import { doc, getDocFromServer, setDoc } from "firebase/firestore";
import { isFirebaseConfigured, requireFirebaseApp } from "../../lib/firebaseApp";
import { ensureHasatFirestoreNetwork } from "../../lib/firestoreClient";
import { getAuth } from "firebase/auth";
import { normalizeCloudRole, type CloudRole } from "./rolePermissions";

export type SchoolMembership = {
  uid: string;
  schoolId: string;
  role: CloudRole;
  active: boolean;
  displayName?: string;
};

let cached: SchoolMembership | null = null;
let cachedUid = "";

export async function getCurrentSchoolMembership(force = false): Promise<SchoolMembership> {
  if (!isFirebaseConfigured) throw new Error("Firebase yapılandırılmamış.");
  const user = getAuth(requireFirebaseApp()).currentUser;
  if (!user) throw new Error("Kurum üyeliği için Firebase oturumu gerekli.");
  if (!force && cached && cachedUid === user.uid) return cached;

  const db = await ensureHasatFirestoreNetwork();
  const snapshot = await getDocFromServer(doc(db, "schoolMembers", user.uid));
  if (!snapshot.exists()) throw new Error("Bu kullanıcı için kurum üyeliği tanımlanmamış.");
  const data = snapshot.data() as Partial<SchoolMembership>;
  const membership: SchoolMembership = {
    uid: user.uid,
    schoolId: String(data.schoolId || "").trim(),
    role: normalizeCloudRole(data.role) || "teacher",
    active: data.active === true,
    displayName: typeof data.displayName === "string" ? data.displayName : undefined,
  };
  if (!membership.active || !membership.schoolId) {
    throw new Error("Kurum üyeliği pasif veya kurum kimliği eksik.");
  }
  cached = membership;
  cachedUid = user.uid;
  return membership;
}


const INITIAL_BOOTSTRAP_UID = "6WxeicbulmVAFzrCWlNF8AFqoFf2";
const INITIAL_BOOTSTRAP_SCHOOL_ID = "school-main";

export async function bootstrapCurrentSchoolMembership(schoolId: string, displayName?: string): Promise<SchoolMembership> {
  if (!isFirebaseConfigured) throw new Error("Firebase yapılandırılmamış.");
  const user = getAuth(requireFirebaseApp()).currentUser;
  if (!user) throw new Error("Kurum üyeliğini etkinleştirmek için Firebase oturumu gerekli.");

  if (user.uid !== INITIAL_BOOTSTRAP_UID || schoolId !== INITIAL_BOOTSTRAP_SCHOOL_ID) {
    throw new Error("Bu Firebase hesabı ilk kurum üyeliği etkinleştirmesi için yetkili değil.");
  }
  const normalizedEmail = String(user.email || "").trim().toLocaleLowerCase("tr-TR");

  const db = await ensureHasatFirestoreNetwork();
  const ref = doc(db, "schoolMembers", user.uid);
  const existing = await getDocFromServer(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      schoolId: INITIAL_BOOTSTRAP_SCHOOL_ID,
      role: "principal",
      active: true,
      displayName: String(displayName || user.displayName || user.email || "Yönetici").trim(),
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      createdAt: new Date().toISOString(),
      bootstrap: true,
    });
  }

  clearSchoolMembershipCache();
  return getCurrentSchoolMembership(true);
}

export function clearSchoolMembershipCache() {
  cached = null;
  cachedUid = "";
}
