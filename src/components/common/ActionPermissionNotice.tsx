import React from "react";
import { ShieldAlert } from "lucide-react";

export default function ActionPermissionNotice({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <div className="text-xs font-black uppercase tracking-wide">Salt okunur erişim</div>
        <p className="mt-1 text-xs font-semibold leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
