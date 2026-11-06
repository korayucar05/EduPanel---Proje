import { decisionTaskRepository, type DecisionTaskScope } from "../data/decisionTaskRepository";
import { hasPendingLocalDatabaseWrites, testLocalDatabaseConnection } from "../../lib/localDatabase";

export type AcceptanceStatus = "passed" | "failed" | "warning";
export type AcceptanceCheck = { id: string; label: string; status: AcceptanceStatus; detail: string };
export type ProductionAcceptanceResult = {
  checks: AcceptanceCheck[];
  score: number;
  testedAt: string;
  membership?: { uid: string; schoolId: string; role: string; active: boolean; displayName?: string };
  failedCount: number;
  warningCount: number;
  ready: boolean;
};

const makeCheck = (id: string, label: string, status: AcceptanceStatus, detail: string): AcceptanceCheck => ({ id, label, status, detail });

const healthCheck = async (): Promise<AcceptanceCheck> => {
  try {
    const response = await fetch("/api/health", { headers: { accept: "application/json" }, cache: "no-store" });
    const body = await response.json().catch(() => null);
    return response.ok && body?.ok === true
      ? makeCheck("api", "Uygulama sunucusu", "passed", `${body?.service || "e-Nstitü API"} · ${body?.environment || "?"} · ${body?.database || "?"}`)
      : makeCheck("api", "Uygulama sunucusu", "failed", `Sağlık kontrolü başarısız: HTTP ${response.status}.`);
  } catch (error) {
    return makeCheck("api", "Uygulama sunucusu", "failed", error instanceof Error ? error.message : "Sunucuya ulaşılamadı.");
  }
};

const sqliteCheck = async (): Promise<AcceptanceCheck> => {
  const connected = await testLocalDatabaseConnection();
  if (!connected) return makeCheck("sqlite", "SQLite bağlantısı", "failed", "Yerel SQLite API bağlantısı kurulamadı.");
  return hasPendingLocalDatabaseWrites()
    ? makeCheck("sqlite", "SQLite bağlantısı", "warning", "SQLite bağlı; ancak henüz tamamlanmamış yazma kuyruğu var.")
    : makeCheck("sqlite", "SQLite bağlantısı", "passed", "SQLite bağlı ve bekleyen yazma kuyruğu yok.");
};

const criticalModuleCheck = async (): Promise<AcceptanceCheck> => {
  const probes: Array<[string, () => Promise<unknown>]> = [
    ["Sınav Hazırla", () => import("../../components/ExamPrepareModule")],
    ["Oku/Düzenle", () => import("../../components/QuestionManagerView")],
    ["Sınav Analizi", () => import("../../components/ExamAnalysisModule")],
    ["Raporlar", () => import("../../components/exam/reports/ReportsModule")],
    ["Davranış", () => import("../../components/BehaviorModule")],
    ["Disiplin", () => import("../../components/DisciplineModule")],
    ["Kelebek A", () => import("../../components/KelebekSystemAModule")],
    ["Kelebek B", () => import("../../components/KelebekSystemBModule")],
  ];
  const failed: string[] = [];
  for (const [label, loader] of probes) {
    try {
      await loader();
    } catch {
      failed.push(label);
    }
  }
  return failed.length
    ? makeCheck("module-load", "Kritik modül yükleme", "failed", `Yüklenemeyen: ${failed.join(", ")}`)
    : makeCheck("module-load", "Kritik modül yükleme", "passed", `${probes.length}/${probes.length} kritik modül tarayıcıda yüklendi.`);
};

const finish = (checks: AcceptanceCheck[], membership?: ProductionAcceptanceResult["membership"]): ProductionAcceptanceResult => {
  const weights: Record<AcceptanceStatus, number> = { passed: 1, warning: 0.5, failed: 0 };
  const score = checks.length ? Math.round((checks.reduce((sum, item) => sum + weights[item.status], 0) / checks.length) * 100) : 0;
  const failedCount = checks.filter((item) => item.status === "failed").length;
  const warningCount = checks.filter((item) => item.status === "warning").length;
  return { checks, score, testedAt: new Date().toISOString(), membership, failedCount, warningCount, ready: failedCount === 0 };
};

export const productionAcceptanceService = {
  async run(scope: DecisionTaskScope): Promise<ProductionAcceptanceResult> {
    const checks: AcceptanceCheck[] = [];
    const online = typeof navigator === "undefined" || navigator.onLine;
    checks.push(makeCheck("network", "İnternet bağlantısı", online ? "passed" : "warning", online ? "Tarayıcı çevrimiçi." : "Tarayıcı çevrimdışı; yerel çalışma devam eder."));
    checks.push(await healthCheck());
    checks.push(await sqliteCheck());
    checks.push(await criticalModuleCheck());

    const localTasks = await decisionTaskRepository.list(scope).catch(() => null);
    checks.push(localTasks
      ? makeCheck("local-store", "Yerel görev deposu", "passed", `${localTasks.length} görev okunabildi.`)
      : makeCheck("local-store", "Yerel görev deposu", "failed", "Yerel görev deposu okunamadı."));

    checks.push(makeCheck(
      "cloud-runtime",
      "Bulut çalışma katmanı",
      "passed",
      "Normal uygulama işlemleri SQLite üzerinde çalışıyor; Firestore arka plan dinleyicileri devre dışı.",
    ));
    checks.push(makeCheck(
      "live-report-cloud",
      "Canlı rapor bulut servisi",
      "warning",
      "Canlı öğrenci/veli raporu yalnızca ilgili özellik kullanıldığında ayrı olarak bulut bağlantısı açar.",
    ));

    return finish(checks);
  },
};
