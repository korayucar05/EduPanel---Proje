import { Loader2 } from "lucide-react";

export default function ModuleLoadingState({ label = "Modül yükleniyor..." }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] items-center justify-center text-slate-500" role="status" aria-live="polite">
      <Loader2 className="mr-3 h-6 w-6 animate-spin text-indigo-600" />
      <span className="text-sm font-bold">{label}</span>
    </div>
  );
}
