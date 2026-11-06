import React from "react";

export function PremiumTable({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`hasat-premium-table overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function PremiumTableHead({
  children,
}: React.PropsWithChildren) {
  return (
    <thead className="hasat-premium-table-head text-white">
      {children}
    </thead>
  );
}

export function PremiumTableRow({
  children,
  index = 0,
  className = "",
}: React.PropsWithChildren<{ index?: number; className?: string }>) {
  return (
    <tr className={`${index % 2 ? "bg-slate-50" : "bg-white"} ${className}`}>
      {children}
    </tr>
  );
}

export function PremiumTableHeaderCell({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-3 py-3 text-left text-[9px] font-black uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

export function PremiumTableCell({
  children,
  className = "",
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <td className={`px-3 py-2 text-[9px] text-slate-700 ${className}`}>
      {children}
    </td>
  );
}
