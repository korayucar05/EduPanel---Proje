export type MessageEvidenceCreateInput = {
  recipientName: string;
  recipientPhone: string;
  recipientRole?: string;
  studentName?: string;
  studentNo?: string;
  className?: string;
  source?: string;
  messageType?: string;
  message: string;
  attachmentName?: string;
  validDays?: number;
};

export type MessageEvidenceCreated = {
  id: string;
  proofUrl: string;
  createdAt: string;
  expiresAt: string;
  messageHash: string;
};

export type MessageEvidenceRecord = {
  id: string;
  recipientName: string;
  recipientPhone?: string;
  recipientPhoneMasked?: string;
  recipientRole?: string;
  studentName?: string;
  studentNo?: string;
  className?: string;
  source?: string;
  messageType: string;
  message: string;
  messageHash: string;
  attachmentName?: string;
  createdAt: string;
  expiresAt: string;
  providerAcceptedAt?: string;
  providerFailedAt?: string;
  providerMessageId?: string;
  providerStatus?: string;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  openCount: number;
  acknowledgedAt?: string;
  acknowledgementCount: number;
};

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Mesaj Kanıt Kaydı sunucusu ${Math.round(timeoutMs / 1000)} saniye içinde yanıt vermedi.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function createMessageEvidence(input: MessageEvidenceCreateInput): Promise<MessageEvidenceCreated> {
  const res = await fetchWithTimeout("/api/message-evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }, 10_000);
  return readJson(res);
}

export async function updateMessageEvidenceProvider(
  id: string,
  data: { accepted: boolean; providerMessageId?: string; providerStatus?: string },
): Promise<void> {
  const res = await fetchWithTimeout(`/api/message-evidence/${encodeURIComponent(id)}/provider`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }, 10_000);
  await readJson(res);
}

export async function loadMessageEvidence(): Promise<MessageEvidenceRecord[]> {
  const res = await fetchWithTimeout("/api/message-evidence", { cache: "no-store" }, 10_000);
  return readJson(res);
}

export const messageEvidenceStatus = (record: MessageEvidenceRecord) => {
  if (record.acknowledgedAt) return "Onaylandı";
  if (record.firstOpenedAt) return "Görüntülendi";
  if (record.providerAcceptedAt) return "Gönderim kabul edildi";
  if (record.providerFailedAt) return "Gönderilemedi";
  return "Kanıt oluşturuldu";
};
