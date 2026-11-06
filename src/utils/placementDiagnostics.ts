export interface PlacementDiagnostic {
  success: boolean;
  reasons: Record<string, number>;
}

export function createDiagnostic(): PlacementDiagnostic {
  return {
    success: true,
    reasons: {}
  };
}

export function addReason(
  diag: PlacementDiagnostic,
  reason: string
) {
  diag.success = false;
  diag.reasons[reason] = (diag.reasons[reason] || 0) + 1;
}

export function diagnosticSummary(diag: PlacementDiagnostic): string {
  return Object.entries(diag.reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}