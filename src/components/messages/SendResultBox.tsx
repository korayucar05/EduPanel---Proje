import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { MessageSendResult } from "../../types/message";

export function SendResultBox({ result }: { result: MessageSendResult | null }) {
  if (!result) return null;
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
    <div className="flex items-center gap-2">{result.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}<span>{result.ok ? result.status || "Gönderim isteği alındı." : result.error || result.status || "Gönderim başarısız."}</span></div>
  </div>;
}
