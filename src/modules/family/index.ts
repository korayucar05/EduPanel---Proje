import { lazy } from "react";
import { registerHasatModule } from "../../core/modules";

export const FamilyApp = lazy(() => import("../../hasat-family/HasatFamilyApp"));
export const familyModule = registerHasatModule({
  id: "hasat.family",
  name: "e-Nstitü AİLE",
  description: "Veli mobil uygulaması, canlı akademik rapor ve PWA deneyimi.",
  area: "family",
  version: "2.0.0",
  status: "beta",
  component: FamilyApp,
  dependencies: ["hasat.reports", "hasat.intelligence"],
  capabilities: [
    "live-report",
    "family-dashboard",
    "pwa-install",
    "academic-dna",
    "target-tracking",
  ],
} as const);

export default FamilyApp;
