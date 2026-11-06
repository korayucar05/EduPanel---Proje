import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Copy, Home, RefreshCw } from "lucide-react";
import { logAppError, type StoredAppError } from "./errorLogger";

type Props = {
  children: ReactNode;
  scope?: string;
};

type State = {
  hasError: boolean;
  error: Error | null;
  report: StoredAppError | null;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, report: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const report = logAppError(error, {
      source: this.props.scope || "react-error-boundary",
      componentStack: errorInfo.componentStack || undefined,
    });
    this.setState({ report });
  }

  private copyTechnicalDetails = async () => {
    const details = [
      `Hata No: ${this.state.report?.id || "oluşturulamadı"}`,
      `Mesaj: ${this.state.error?.message || "Bilinmeyen hata"}`,
      this.state.error?.stack || "",
      this.state.report?.componentStack || "",
    ].filter(Boolean).join("\n\n");

    try {
      await navigator.clipboard.writeText(details);
    } catch {
      window.prompt("Teknik ayrıntıları kopyalayın:", details);
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-800">
        <section className="w-full max-w-2xl rounded-3xl border border-rose-200 bg-white p-7 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-600">e-Nstitü güvenli hata ekranı</p>
              <h1 className="mt-2 text-2xl font-black">Bu ekran açılırken bir sorun oluştu.</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Verileriniz silinmedi. Sayfayı yeniden yükleyebilir veya ana panele dönebilirsiniz.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Hata numarası</p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-800">{this.state.report?.id || "Hazırlanıyor..."}</p>
            <p className="mt-3 break-words text-sm text-rose-700">{this.state.error?.message || "Bilinmeyen uygulama hatası"}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
              <RefreshCw className="h-4 w-4" /> Sayfayı yenile
            </button>
            <button type="button" onClick={() => { window.location.href = window.location.pathname; }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Home className="h-4 w-4" /> Ana panele dön
            </button>
            <button type="button" onClick={this.copyTechnicalDetails} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Copy className="h-4 w-4" /> Teknik bilgiyi kopyala
            </button>
          </div>
        </section>
      </main>
    );
  }
}
