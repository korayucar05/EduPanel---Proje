import type { KorayUcarSolverResult } from "./KorayUcarEngine";

/**
 * Mevcut CP-SAT payload'ına KorayUçar aday çözümünü geriye dönük uyumlu biçimde ekler.
 * Python solver bu alanı tanımıyorsa JSON içinde fazladan alan olarak kalır ve mevcut
 * davranışı bozmaz. Yeni Python helper `korayucar_warm_start.py` bu alanı AddHint'e çevirebilir.
 */
export function attachKorayUcarWarmStartHint<T extends Record<string, any>>(
  payload: T,
  result: Pick<KorayUcarSolverResult, "cpSatWarmStartHint">,
): T & { korayUcarWarmStartHint: NonNullable<KorayUcarSolverResult["cpSatWarmStartHint"]> } {
  return {
    ...payload,
    korayUcarWarmStartHint: result.cpSatWarmStartHint || [],
  };
}
