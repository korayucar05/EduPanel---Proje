import React from "react";

export function PremiumIdentityMark({
  label = "e-Nstitü PREMIUM RAPOR",
}: {
  label?: React.ReactNode;
}) {
  return (
    <div className="hasat-premium-identity-mark">
      <span>{label}</span>
    </div>
  );
}
