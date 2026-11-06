import { sqliteStorage } from "./sqliteStorageBridge";
export type MhatsappMessageType = "text" | "image" | "document" | "poll";

export interface MhatsappSettings {
  baseUrl: string;
  token: string;
  delayMs: number;
  webhookUrl?: string;
}

export interface MhatsappRecipientResult {
  number: string;
  ok: boolean;
  id?: string;
  status?: string;
  error?: string;
  raw?: any;
}

export interface MhatsappSendResult {
  ok: boolean;
  status?: string;
  id?: string;
  error?: string;
  raw?: any;
  httpStatus?: number;
  successCount?: number;
  failureCount?: number;
  recipients?: MhatsappRecipientResult[];
}

export interface MhatsappRecipientMessage {
  number: string;
  message: string;
}

export const MHATSAPP_SETTINGS_KEY = "rota_mhatsapp_settings_v1";
export const MHATSAPP_LOGS_KEY = "rota_mhatsapp_logs_v1";

export const DEFAULT_MHATSAPP_SETTINGS: MhatsappSettings = {
  baseUrl: "https://api.mhatsapp.com",
  token: "",
  delayMs: 1500,
  webhookUrl: "",
};

export function loadMhatsappSettings(): MhatsappSettings {
  try {
    const saved = sqliteStorage.getItem(MHATSAPP_SETTINGS_KEY);
    return saved ? { ...DEFAULT_MHATSAPP_SETTINGS, ...JSON.parse(saved) } : DEFAULT_MHATSAPP_SETTINGS;
  } catch {
    return DEFAULT_MHATSAPP_SETTINGS;
  }
}

export function saveMhatsappSettings(settings: MhatsappSettings) {
  sqliteStorage.setItem(MHATSAPP_SETTINGS_KEY, JSON.stringify(settings));
}

export function normalizeMhatsappNumber(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.endsWith("@g.us")) return raw;

  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `90${digits}`;
  return digits;
}

export function isValidMhatsappNumber(input: string): boolean {
  const normalized = normalizeMhatsappNumber(input);
  if (normalized.endsWith("@g.us")) return /^\d+@g\.us$/.test(normalized);
  return /^\d{11,13}$/.test(normalized);
}

export function splitNumbers(text: string): string[] {
  return String(text || "")
    .split(/[\n,;]+/)
    .map((x) => normalizeMhatsappNumber(x))
    .filter(Boolean);
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getBaseUrl(settings: MhatsappSettings) {
  return (settings.baseUrl || DEFAULT_MHATSAPP_SETTINGS.baseUrl).replace(/\/$/, "");
}

function extractProviderData(raw: any): any {
  if (raw && typeof raw === "object" && "data" in raw) return raw.data;
  return raw;
}

function toReadableStatus(raw: any): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw !== "object") return String(raw);

  const provider = extractProviderData(raw);
  if (typeof provider === "string") return provider.trim();
  if (provider && typeof provider === "object") {
    return String(
      provider.status ||
      provider.message ||
      provider.error ||
      provider.id ||
      provider.rawResponse ||
      ""
    ).trim();
  }

  return String(raw.status || raw.message || raw.error || raw.id || raw.rawResponse || "").trim();
}

function translateMhatsappError(value: string): string {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();
  if (lower.includes("phone is offline")) return "mHatsapp'a bağlı telefon çevrimdışı. Telefon bağlantısını/oturumunu kontrol edin.";
  if (lower.includes("invalid phone number")) return "Alıcı telefon numarası geçersiz.";
  if (lower.includes("wrong token")) return "API token geçersiz veya yenilenmiş. Güncel tokenı kaydedin.";
  if (lower.includes("token is empty")) return "API token boş gönderildi.";
  if (lower.includes("unsupported message type")) return "Bu endpoint mesaj türünü desteklemiyor.";
  if (lower.includes("malformed data")) return "Gönderim verisi hatalı veya eksik.";
  if (lower.includes("invalid url")) return "Webhook URL geçersiz.";
  if (lower.includes("fetch failed")) return "mHatsapp sunucusuna bağlantı kurulamadı.";
  return text;
}

function normalizeProxyResponse(raw: any, httpOk: boolean, httpStatus?: number): MhatsappSendResult {
  const provider = extractProviderData(raw);
  const providerStatus = toReadableStatus(provider);
  const proxyError = String(raw?.error || "").trim();
  const combined = providerStatus || proxyError;
  const lower = combined.toLowerCase();
  const id = provider && typeof provider === "object" ? provider.id : undefined;
  const explicitSuccess =
    (provider && typeof provider === "object" && provider.status === "success") ||
    Boolean(id) ||
    raw?.ok === true;
  const hasError =
    raw?.ok === false ||
    lower.includes("error") ||
    Boolean(proxyError && !explicitSuccess);
  const ok = Boolean(httpOk && explicitSuccess && !hasError);

  const fallback = httpStatus && httpStatus >= 200 && httpStatus < 300
    ? "mHatsapp sunucusuna ulaşıldı ancak mesaj kimliği veya gönderim onayı alınamadı. mHatsapp panelindeki telefon bağlantısını ve token durumunu kontrol edin."
    : httpStatus
      ? `HTTP ${httpStatus}`
      : "mHatsapp yanıtı alınamadı";
  const errorText = hasError || !ok
    ? translateMhatsappError(combined || fallback)
    : undefined;

  return {
    ok,
    status: ok ? (id ? `WhatsApp altyapısına gönderildi. Mesaj kimliği: ${id}` : providerStatus || "WhatsApp gönderimi doğrulandı.") : providerStatus || undefined,
    id,
    error: errorText,
    raw,
    httpStatus: Number(raw?.httpStatus || httpStatus || 0) || undefined,
  };
}

async function postMhatsapp(settings: MhatsappSettings, path: string, actionPayload: any): Promise<MhatsappSendResult> {
  if (!settings.token?.trim()) {
    return { ok: false, error: "API token girilmemiş." };
  }

  const targetUrl = `${getBaseUrl(settings)}${path}`;
  const body = { targetUrl, action: actionPayload.action ?? actionPayload };

  try {
    console.log("MHATSAPP REQUEST");
    console.log("URL:", "/api/mhatsapp/proxy");
    console.log("TARGET:", targetUrl);
    console.log("BODY:", {
      ...body,
      action: body?.action ? {
        ...body.action,
        file: body.action.file ? `[base64:${String(body.action.file).length} chars]` : undefined,
      } : undefined,
    });

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 65_000);
    let res: Response;
    try {
      res = await fetch("/api/mhatsapp/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }

    const contentType = res.headers.get("content-type") || "";
    const raw = contentType.includes("application/json") ? await res.json() : await res.text();
    console.log("MHATSAPP RESPONSE", res.status, raw);

    if (!res.ok) {
      const message = typeof raw === "string" ? raw : raw?.error || raw?.details?.status || raw?.data?.status || `HTTP ${res.status}`;
      return { ok: false, status: String(res.status), error: String(message), raw };
    }

    return normalizeProxyResponse(raw, res.ok, res.status);
  } catch (error: any) {
    console.error("MHATSAPP ERROR", error);
    if (error?.name === "AbortError") {
      return { ok: false, error: "mHatsapp 65 saniye içinde gerçek gönderim onayı vermedi. Telefonun mHatsapp oturumunu, internet bağlantısını ve API tokenını kontrol edin." };
    }
    return { ok: false, error: error?.message || "Bağlantı hatası" };
  }
}

export async function sendTextMessage(settings: MhatsappSettings, numbers: string[], message: string): Promise<MhatsappSendResult> {
  const validNumbers = Array.from(new Set(numbers.map(normalizeMhatsappNumber).filter(isValidMhatsappNumber)));
  if (validNumbers.length === 0) return { ok: false, error: "Geçerli alıcı numarası yok." };
  if (!message.trim()) return { ok: false, error: "Mesaj metni boş olamaz." };

  // Dokümana göre blocking endpoint yalnızca tek numara kabul eder ve WhatsApp
  // altyapısına gönderim tamamlanana kadar bekler. Çoklu gönderimde bu nedenle
  // numaraları sırayla gönderiyoruz.
  const recipients: MhatsappRecipientResult[] = [];
  for (let index = 0; index < validNumbers.length; index += 1) {
    const number = validNumbers[index];
    // mHatsapp'ın normal v3 endpoint'i yalnızca isteği kuyruğa alıp
    // {"status":"success"} döndürebilir. Bu yüzden tek alıcılı metinlerde
    // gerçekten WhatsApp altyapısına ulaşana kadar bekleyen blocking endpoint'i kullanıyoruz.
    const result = await postMhatsapp(settings, "/api/send-msg-blocking/", {
      action: {
        type: "text",
        token: [settings.token.trim()],
        numbers: [number],
        message,
      },
    });

    recipients.push({
      number,
      ok: result.ok,
      id: result.id,
      status: result.status,
      error: result.error,
      raw: result.raw,
    });

    if (index < validNumbers.length - 1 && settings.delayMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, settings.delayMs));
    }
  }

  const successCount = recipients.filter((item) => item.ok).length;
  const failureCount = recipients.length - successCount;
  const allOk = failureCount === 0;
  const firstFailure = recipients.find((item) => !item.ok);
  const firstSuccess = recipients.find((item) => item.ok);

  return {
    ok: allOk,
    status: allOk
      ? `${successCount} mesajın WhatsApp altyapısına ulaştığı doğrulandı.`
      : `${successCount} başarılı, ${failureCount} başarısız.`,
    id: recipients.length === 1 ? firstSuccess?.id : undefined,
    error: firstFailure?.error,
    successCount,
    failureCount,
    recipients,
    raw: recipients.map((item) => ({ number: item.number, response: item.raw })),
  };
}

export async function sendMediaMessage(
  settings: MhatsappSettings,
  type: "image" | "document",
  numbers: string[],
  message: string,
  filename: string,
  fileBase64: string,
): Promise<MhatsappSendResult> {
  const validNumbers = Array.from(new Set(numbers.map(normalizeMhatsappNumber).filter(isValidMhatsappNumber)));
  if (validNumbers.length === 0) return { ok: false, error: "Geçerli alıcı numarası yok." };
  if (!settings.token?.trim()) return { ok: false, error: "API token girilmemiş." };
  if (!filename || !fileBase64) return { ok: false, error: "Dosya seçilmemiş." };

  // Medya gönderiminde önce uzun süredir kullanılan aynı-origin backend yolunu kullanıyoruz.
  // Bu endpoint mHatsapp dokümanındaki ortak şemayı sunucuda birebir kurar:
  // numbers = virgülle ayrılmış string, token = tek elemanlı dizi, file = saf base64.
  // Böylece tarayıcıdan büyük PDF/JPG gövdelerinin genel proxy katmanında bozulması önlenir.
  const directBody = {
    apiUrl: `${getBaseUrl(settings)}/api/v3/message/send/`,
    apiKey: settings.token.trim(),
    numbers: validNumbers.join(","),
    message: message || " ",
    type,
    filename,
    file: String(fileBase64).replace(/^data:[^,]+,/, ""),
  };

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 65_000);
    let response: Response;
    try {
      response = await fetch("/api/whatsapp/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(directBody),
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }

    const contentType = response.headers.get("content-type") || "";
    const raw = contentType.includes("application/json") ? await response.json() : await response.text();
    const provider = raw && typeof raw === "object" ? (raw.data?.data ?? raw.data ?? raw.details ?? raw) : raw;
    const statusText = String(
      (provider && typeof provider === "object" && (provider.status || provider.message || provider.error)) ||
      (raw && typeof raw === "object" && (raw.status || raw.message || raw.error)) ||
      "",
    ).trim();
    const lower = statusText.toLowerCase();
    const id = provider && typeof provider === "object"
      ? (provider.id || provider.messageId || provider.message_id)
      : undefined;
    const accepted = response.ok && Boolean(
      (raw && typeof raw === "object" && (raw.success === true || raw.ok === true)) ||
      id ||
      /(^|\b)(success|sent|queued|accepted|ok)(\b|$)/i.test(lower)
    );

    if (accepted) {
      return {
        ok: true,
        id: id ? String(id) : undefined,
        status: id ? `WhatsApp altyapısına gönderildi. Mesaj kimliği: ${id}` : (statusText || "WhatsApp gönderimi kabul edildi."),
        raw,
        httpStatus: response.status,
      };
    }

    const detail = typeof raw === "string"
      ? raw
      : String(raw?.error || raw?.details?.error || raw?.details?.status || raw?.data?.error || raw?.data?.status || statusText || `HTTP ${response.status}`);

    // Eski kurulumlarda send-direct route'u bulunmayabilir. Yalnızca route yoksa
    // mevcut güvenli proxy'ye geri düş. Sağlayıcı reddettiyse aynı dosyayı ikinci kez
    // yollayıp çift gönderim riski oluşturma.
    if (response.status === 404 || response.status === 405) {
      return postMhatsapp(settings, "/api/v3/message/send/", {
        action: {
          type,
          token: [settings.token.trim()],
          numbers: validNumbers.join(","),
          message: message || " ",
          filename,
          file: String(fileBase64).replace(/^data:[^,]+,/, ""),
        },
      });
    }

    return {
      ok: false,
      error: translateMhatsappError(detail || "WhatsApp sağlayıcısı dosyayı kabul etmedi."),
      status: statusText || undefined,
      raw,
      httpStatus: response.status,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return { ok: false, error: "Dosya gönderimi 65 saniye içinde yanıt vermedi. Telefon bağlantısını ve mHatsapp oturumunu kontrol edin." };
    }

    // Backend route'una erişilemiyorsa son çare mevcut proxy yolunu dene.
    return postMhatsapp(settings, "/api/v3/message/send/", {
      action: {
        type,
        token: [settings.token.trim()],
        numbers: validNumbers.join(","),
        message: message || " ",
        filename,
        file: String(fileBase64).replace(/^data:[^,]+,/, ""),
      },
    });
  }
}

export async function sendPersonalizedBulkText(
  settings: MhatsappSettings,
  rows: MhatsappRecipientMessage[],
): Promise<MhatsappSendResult> {
  const cleaned = rows
    .map((row) => ({ number: normalizeMhatsappNumber(row.number), message: String(row.message || "").trim() }))
    .filter((row) => isValidMhatsappNumber(row.number) && row.message);

  if (cleaned.length === 0) return { ok: false, error: "Gönderilecek geçerli kayıt bulunamadı." };

  // Her kişiye farklı anket bağlantısı gönderildiği için kişiselleştirilmiş
  // mesajları tek tek gönderiyoruz. Go proxy katmanı `numbers` alanını []string
  // olarak beklediğinden tek alıcıda dahi dizi kullanmak zorunludur.
  const recipients: MhatsappRecipientResult[] = [];
  for (let index = 0; index < cleaned.length; index += 1) {
    const row = cleaned[index];
    // Her satır zaten tek alıcıya ayrı gönderiliyor. Böylece öğrenci/öğretmen
    // kişisel linklerinde de "API kabul etti" yerine gerçek WhatsApp gönderimi doğrulanır.
    const result = await postMhatsapp(settings, "/api/send-msg-blocking/", {
      action: {
        type: "text",
        token: [settings.token.trim()],
        numbers: [row.number],
        message: row.message,
      },
    });

    recipients.push({
      number: row.number,
      ok: result.ok,
      id: result.id,
      status: result.status,
      error: result.error,
      raw: result.raw,
    });

    if (index < cleaned.length - 1 && settings.delayMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, settings.delayMs));
    }
  }

  const successCount = recipients.filter((item) => item.ok).length;
  const failureCount = recipients.length - successCount;
  const firstFailure = recipients.find((item) => !item.ok);

  return {
    ok: failureCount === 0,
    status: failureCount === 0
      ? `${successCount} kişiselleştirilmiş mesaj WhatsApp altyapısına gönderildi.`
      : `${successCount} başarılı, ${failureCount} başarısız.`,
    error: firstFailure?.error,
    successCount,
    failureCount,
    recipients,
    raw: recipients.map((item) => ({ number: item.number, response: item.raw })),
  };
}


export function appendMhatsappLog(item: any) {
  try {
    const saved = sqliteStorage.getItem(MHATSAPP_LOGS_KEY);
    const list = saved ? JSON.parse(saved) : [];
    const safeItem = { ...item };

    // Base64 medya verisini log içine yazmayalım.
    if (safeItem.raw?.action?.file) {
      safeItem.raw = {
        ...safeItem.raw,
        action: {
          ...safeItem.raw.action,
          file: "[base64-hidden]",
        },
      };
    }

    const next = [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date().toISOString(),
        ...safeItem,
      },
      ...list,
    ].slice(0, 250);

    sqliteStorage.setItem(MHATSAPP_LOGS_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("mHatsapp log kaydedilemedi:", error);
  }
}

export function loadMhatsappLogs(): any[] {
  try {
    const saved = sqliteStorage.getItem(MHATSAPP_LOGS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("mHatsapp logları okunamadı:", error);
    return [];
  }
}

export async function registerWebhook(
  settings: MhatsappSettings,
  webhookUrl: string,
): Promise<MhatsappSendResult> {
  const url = String(webhookUrl || "").trim();

  if (!url) {
    return { ok: false, error: "Webhook URL boş olamaz." };
  }

  return postMhatsapp(settings, "/api/webhook/", {
    action: {
      type: "register",
      token: [settings.token.trim()],
      url,
    },
  });
}

export async function deleteWebhook(
  settings: MhatsappSettings,
): Promise<MhatsappSendResult> {
  return postMhatsapp(settings, "/api/webhook/", {
    action: {
      type: "delete",
      token: [settings.token.trim()],
    },
  });
}


