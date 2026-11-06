export type OpticIdentityKey =
  | "schoolCode"
  | "studentNo"
  | "fullName"
  | "classLevel"
  | "branch"
  | "area"
  | "bookletType";

export type OpticIdentityField = {
  key: OpticIdentityKey;
  label: string;
  startColumn: number;
  columnCount: number;
};

export type OpticAnswerField = {
  id: string;
  courseName: string;
  startColumn: number;
  columnCount: number;
};

export type OpticTemplateKind = "TYT" | "AYT" | "Özel";

export type OpticTemplate = {
  id: string;
  name: string;
  templateKind: OpticTemplateKind;
  identityFields: OpticIdentityField[];
  answerFields: OpticAnswerField[];
  answerAreaStarts: number[];
  createdAt: string;
  updatedAt: string;
};

export type OpticTemplateInput = Omit<
  OpticTemplate,
  "id" | "createdAt" | "updatedAt"
>;

// Bazı eski Node/SQLite kurulumlarında "Özel" enum değeri UTF-8 metninin
// Latin-1 olarak okunması nedeniyle "Ã–zel" biçiminde doğrulanıyor. UI'da
// daima doğru Türkçe değer kullanılır; ağ katmanı eski sunucuyla geriye
// uyumluluğu burada yönetir.
const normalizeTemplateKind = (value: unknown): OpticTemplateKind => {
  if (value === "TYT" || value === "AYT") return value;
  return "Özel";
};

// Eski API şeması 7 kimlik alanının tamamında startColumn/columnCount için
// pozitif sayı bekliyor. Yeni arayüzde ise bu alanların herhangi biri boş
// bırakılabilir. Boş alanları API'ye çakışmayan, satır uzunluğunun çok
// dışında kalan pozitif yer tutucularla gönderiyoruz; listelerken tekrar
// 0/0'a çevirerek arayüz ve optik okuma açısından "tanımsız" tutuyoruz.
const OPTIONAL_FIELD_SENTINEL_BASE = 1_000_001;
const OPTIONAL_FIELD_SENTINEL_STEP = 2;

const isOptionalFieldSentinel = (field: any) => {
  const start = Number(field?.startColumn || 0);
  const count = Number(field?.columnCount || 0);
  return start >= OPTIONAL_FIELD_SENTINEL_BASE && count === 1;
};

const normalizeIdentityFields = (value: unknown): OpticIdentityField[] =>
  Array.isArray(value)
    ? value.map((field: any) =>
        isOptionalFieldSentinel(field)
          ? { ...field, startColumn: 0, columnCount: 0 }
          : field,
      )
    : [];

const normalizeTemplate = (value: any): OpticTemplate => ({
  ...value,
  templateKind: normalizeTemplateKind(value?.templateKind),
  identityFields: normalizeIdentityFields(value?.identityFields),
  answerFields: Array.isArray(value?.answerFields)
    ? value.answerFields
    : [],
  answerAreaStarts:
    Array.isArray(value?.answerAreaStarts) && value.answerAreaStarts.length === 4
      ? value.answerAreaStarts.map((item: unknown) => Math.max(0, Number(item) || 0))
      : [0, 0, 0, 0],
});

const encodeOptionalIdentityFields = (
  fields: OpticIdentityField[],
): OpticIdentityField[] =>
  fields.map((field, index) => {
    const startColumn = Number(field?.startColumn || 0);
    const columnCount = Number(field?.columnCount || 0);

    if (startColumn > 0 && columnCount > 0) {
      return { ...field, startColumn, columnCount };
    }

    return {
      ...field,
      startColumn:
        OPTIONAL_FIELD_SENTINEL_BASE + index * OPTIONAL_FIELD_SENTINEL_STEP,
      columnCount: 1,
    };
  });

const toWireInput = (
  input: OpticTemplateInput,
  useLegacySpecialKind = false,
) => ({
  ...input,
  templateKind:
    useLegacySpecialKind && input.templateKind === "Özel"
      ? "Ã–zel"
      : input.templateKind,
  identityFields: encodeOptionalIdentityFields(input.identityFields || []),
});

const shouldRetryLegacySpecialKind = (
  error: unknown,
  input: OpticTemplateInput,
) =>
  input.templateKind === "Özel" &&
  error instanceof Error &&
  /Invalid option|expected one of|Ã.?zel/i.test(error.message);

const request = async <T>(
  url: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      String(body?.error || "Optik form işlemi başarısız."),
    );
  }

  return body as T;
};

export async function listOpticTemplates(): Promise<OpticTemplate[]> {
  const result = await request<{ templates: OpticTemplate[] }>(
    "/api/optic-templates",
  );
  return Array.isArray(result.templates)
    ? result.templates.map(normalizeTemplate)
    : [];
}

export async function createOpticTemplate(
  input: OpticTemplateInput,
): Promise<OpticTemplate> {
  try {
    const result = await request<{ template: OpticTemplate }>(
      "/api/optic-templates",
      {
        method: "POST",
        body: JSON.stringify(toWireInput(input)),
      },
    );
    return normalizeTemplate(result.template);
  } catch (error) {
    if (!shouldRetryLegacySpecialKind(error, input)) throw error;

    const result = await request<{ template: OpticTemplate }>(
      "/api/optic-templates",
      {
        method: "POST",
        body: JSON.stringify(toWireInput(input, true)),
      },
    );
    return normalizeTemplate(result.template);
  }
}

export async function updateOpticTemplate(
  id: string,
  input: OpticTemplateInput,
): Promise<OpticTemplate> {
  const url = `/api/optic-templates/${encodeURIComponent(id)}`;

  try {
    const result = await request<{ template: OpticTemplate }>(url, {
      method: "PUT",
      body: JSON.stringify(toWireInput(input)),
    });
    return normalizeTemplate(result.template);
  } catch (error) {
    if (!shouldRetryLegacySpecialKind(error, input)) throw error;

    const result = await request<{ template: OpticTemplate }>(url, {
      method: "PUT",
      body: JSON.stringify(toWireInput(input, true)),
    });
    return normalizeTemplate(result.template);
  }
}

export async function deleteOpticTemplate(id: string): Promise<void> {
  await request<{ success: true }>(
    `/api/optic-templates/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
