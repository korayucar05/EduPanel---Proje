import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

const cleanBaseUrl = (value: unknown) => String(value ?? "").trim().replace(/\/+$/, "");

const configuredNativeApiBase = cleanBaseUrl(
  import.meta.env.VITE_ENSTITU_NATIVE_API_URL ||
  import.meta.env.VITE_HASAT_PUBLIC_APP_URL ||
  import.meta.env.VITE_PUBLIC_APP_URL ||
  "https://dersbende.com.tr",
);

export const isNativeEnstituApp = () => Capacitor.isNativePlatform();

export const nativeApiBaseUrl = () => configuredNativeApiBase;

export const publicAppBaseUrl = () => {
  if (isNativeEnstituApp()) return configuredNativeApiBase;
  if (typeof window === "undefined") return configuredNativeApiBase;
  return cleanBaseUrl(window.location.origin) || configuredNativeApiBase;
};

let nativeFetchBridgeInstalled = false;

const shouldRewriteNativeUrl = (rawUrl: string) => {
  if (!rawUrl) return false;
  if (rawUrl.startsWith("/api/")) return true;
  try {
    const parsed = new URL(rawUrl, window.location.href);
    const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const sameNativeOrigin = parsed.origin === window.location.origin;
    return parsed.pathname.startsWith("/api/") && (localHost || sameNativeOrigin);
  } catch {
    return false;
  }
};

const rewriteNativeUrl = (rawUrl: string) => {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    return `${configuredNativeApiBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawUrl.startsWith("/api/") ? `${configuredNativeApiBase}${rawUrl}` : rawUrl;
  }
};

const installNativeFetchBridge = () => {
  if (!isNativeEnstituApp() || nativeFetchBridgeInstalled || typeof window === "undefined") return;
  nativeFetchBridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      return originalFetch(shouldRewriteNativeUrl(input) ? rewriteNativeUrl(input) : input, init);
    }

    if (input instanceof URL) {
      const value = input.toString();
      return originalFetch(shouldRewriteNativeUrl(value) ? rewriteNativeUrl(value) : input, init);
    }

    if (typeof Request !== "undefined" && input instanceof Request) {
      if (!shouldRewriteNativeUrl(input.url)) return originalFetch(input, init);
      const rewritten = new Request(rewriteNativeUrl(input.url), input);
      return originalFetch(rewritten, init);
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;
};

const applyIncomingAppUrl = (rawUrl: string | undefined | null) => {
  if (!isNativeEnstituApp() || !rawUrl || typeof window === "undefined") return;
  try {
    const incoming = new URL(rawUrl);
    let target = "";

    if (incoming.protocol === "http:" || incoming.protocol === "https:") {
      if (incoming.hostname === "dersbende.com.tr" || incoming.hostname.endsWith(".dersbende.com.tr")) {
        target = `${incoming.pathname}${incoming.search}${incoming.hash}`;
      }
    } else if (incoming.protocol === "enstitu:") {
      target = `${incoming.pathname || "/"}${incoming.search}${incoming.hash}`;
    }

    if (!target || target === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    window.history.replaceState(null, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch {}
};

let nativeDeepLinksInstalled = false;
const installNativeDeepLinks = () => {
  if (!isNativeEnstituApp() || nativeDeepLinksInstalled) return;
  nativeDeepLinksInstalled = true;

  void CapacitorApp.getLaunchUrl().then((result) => applyIncomingAppUrl(result?.url)).catch(() => null);
  void CapacitorApp.addListener("appUrlOpen", ({ url }) => applyIncomingAppUrl(url));
};

export const installNativeRuntimeBridge = () => {
  if (!isNativeEnstituApp()) return;
  installNativeFetchBridge();
  installNativeDeepLinks();
};
