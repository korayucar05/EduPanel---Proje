import type { ComponentType, LazyExoticComponent } from "react";

export type HasatModuleArea =
  | "core"
  | "academics"
  | "reports"
  | "family"
  | "management"
  | "messaging"
  | "guidance"
  | "discipline"
  | "ai";

export type HasatModuleStatus = "stable" | "beta" | "experimental";

export type HasatModuleComponent<P = Record<string, unknown>> =
  | ComponentType<P>
  | LazyExoticComponent<ComponentType<P>>;

export interface HasatModuleManifest<P = Record<string, unknown>> {
  id: string;
  name: string;
  description: string;
  area: HasatModuleArea;
  version: string;
  status: HasatModuleStatus;
  component?: HasatModuleComponent<P>;
  dependencies?: readonly string[];
  capabilities?: readonly string[];
}
