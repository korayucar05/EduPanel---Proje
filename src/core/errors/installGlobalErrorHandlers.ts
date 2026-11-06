import { logAppError } from "./errorLogger";

let installed = false;

export const installGlobalErrorHandlers = () => {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;

  const onError = (event: ErrorEvent) => {
    const entry = logAppError(event.error || event.message, {
      source: "window.error",
      metadata: { filename: event.filename, line: event.lineno, column: event.colno },
    });
    window.dispatchEvent(new CustomEvent("hasat:runtime-error", { detail: entry }));
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const entry = logAppError(event.reason, { source: "unhandledrejection" });
    window.dispatchEvent(new CustomEvent("hasat:runtime-error", { detail: entry }));
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    installed = false;
  };
};
