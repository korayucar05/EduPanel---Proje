import type { HasatModuleManifest } from "./types";

const manifests = new Map<string, HasatModuleManifest>();

export const registerHasatModule = <T extends HasatModuleManifest<any>>(manifest: T): T => {
  if (manifests.has(manifest.id)) {
    throw new Error(`e-Nstitü modülü iki kez kaydedilemez: ${manifest.id}`);
  }
  manifests.set(manifest.id, manifest);
  return manifest;
};

export const getHasatModule = (id: string) => manifests.get(id);

export const listHasatModules = () => Array.from(manifests.values());

export const assertHasatModuleDependencies = () => {
  const missing: string[] = [];
  for (const manifest of manifests.values()) {
    for (const dependency of manifest.dependencies || []) {
      if (!manifests.has(dependency)) missing.push(`${manifest.id} -> ${dependency}`);
    }
  }
  if (missing.length) {
    throw new Error(`Eksik e-Nstitü modül bağımlılıkları: ${missing.join(", ")}`);
  }
};
