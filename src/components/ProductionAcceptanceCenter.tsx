import React from "react";
import { CheckCircle2, Loader2, ShieldCheck, UserRoundCheck } from "lucide-react";
import DashboardProductionReadiness from "./dashboard/DashboardProductionReadiness";
import { bootstrapCurrentSchoolMembership } from "../core/auth/schoolMembership";
import { firebaseAuthSession, type FirebaseAuthState } from "../core/auth/firebaseAuthSession";

type ProductionAcceptanceCenterProps = {
  taskScope: {
    schoolId: string;
    userId: string;
    userName: string;
  };
};

export default function ProductionAcceptanceCenter({ taskScope }: ProductionAcceptanceCenterProps) {
  const [bootstrapState, setBootstrapState] = React.useState<"idle" | "loading" | "done">("idle");
  const [bootstrapMessage, setBootstrapMessage] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [authState, setAuthState] = React.useState<FirebaseAuthState>(() => ({
    configured: true,
    authenticated: Boolean(firebaseAuthSession.currentUser()),
    uid: firebaseAuthSession.currentUser()?.uid,
    email: firebaseAuthSession.currentUser()?.email || undefined,
  }));

  React.useEffect(() => firebaseAuthSession.subscribe(setAuthState), []);

  const initialBootstrapUid = "6WxeicbulmVAFzrCWlNF8AFqoFf2";
  const uidMatchesBootstrap = authState.uid === initialBootstrapUid;
  const schoolMatchesBootstrap = taskScope.schoolId === "school-main";
  const bootstrapEligible = authState.authenticated && uidMatchesBootstrap && schoolMatchesBootstrap;

  const bootstrap = async () => {
    setBootstrapState("loading");
    setBootstrapMessage("");
    try {
      const membership = await bootstrapCurrentSchoolMembership(taskScope.schoolId, taskScope.userName);
      setBootstrapState("done");
      setBootstrapMessage(`Kurum üyeliği etkinleştirildi: ${membership.schoolId} / ${membership.role}`);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setBootstrapState("idle");
      setBootstrapMessage(error instanceof Error ? error.message : "Kurum üyeliği etkinleştirilemedi.");
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-emerald-700">Yönetici Aracı</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Üretim Kabul Merkezi</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-slate-600">
                e-Nstitü'ın canlı ortam sağlık durumunu, SQLite bağlantısını, API erişimini, Firebase yapılandırmasını
                ve kritik modüllerin yüklenmesini tek ekrandan doğrular.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white">
                {bootstrapState === "done" ? <CheckCircle2 className="h-5 w-5" /> : <UserRoundCheck className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-sm font-black text-sky-950">Firebase kurum üyeliği</h2>
                <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-sky-800">
                  Kurum üyeliği bulunamadığında ilk yönetici hesabını güvenli biçimde kurumla eşleştirir. Buton görünürlüğü artık UI koşullarına bağlı değildir; gerçek yetki Firestore güvenlik kuralları tarafından doğrulanır.
                </p>
                {bootstrapMessage && <p className="mt-2 text-xs font-bold text-sky-950">{bootstrapMessage}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void bootstrap()}
              disabled={!authState.authenticated || bootstrapState === "loading" || bootstrapState === "done"}
              className="flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bootstrapState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}
              {bootstrapState === "done" ? "Kurum üyeliği etkin" : bootstrapState === "loading" ? "Etkinleştiriliyor" : "Kurum üyeliğini etkinleştir"}
            </button>
          </div>

          <div className="mt-4 grid gap-2 rounded-2xl border border-sky-200 bg-white/80 p-4 text-[11px] font-semibold text-slate-700 md:grid-cols-2">
            <div><span className="text-slate-400">Firebase UID:</span> <span className="break-all font-black text-slate-900">{authState.uid || "Oturum bekleniyor"}</span></div>
            <div><span className="text-slate-400">Firebase e-posta:</span> <span className="break-all font-black text-slate-900">{authState.email || "Oturum bekleniyor"}</span></div>
            <div><span className="text-slate-400">Kurum kimliği:</span> <span className="font-black text-slate-900">{taskScope.schoolId || "—"}</span></div>
            <div>
              <span className="text-slate-400">Bootstrap tanısı:</span>{" "}
              <span className={`font-black ${bootstrapEligible ? "text-emerald-700" : "text-amber-700"}`}>
                {!authState.authenticated
                  ? "Firebase oturumu bekleniyor"
                  : bootstrapEligible
                    ? "Uygun — güvenlik kuralı son onayı verecek"
                    : !uidMatchesBootstrap
                      ? "Firebase UID ilk yönetici hesabıyla eşleşmiyor"
                      : !schoolMatchesBootstrap
                        ? `Kurum kimliği school-main değil (${taskScope.schoolId || "boş"})`
                        : "Güvenlik kuralı doğrulaması bekleniyor"}
              </span>
            </div>
          </div>
        </section>

        <DashboardProductionReadiness taskScope={taskScope} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
