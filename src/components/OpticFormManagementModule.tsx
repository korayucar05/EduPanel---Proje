import React, { useEffect, useMemo, useState } from "react";
import {
  Upload,
  FileText,
  Save,
  Copy,
  Download,
  Trash2,
  Eye,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import localforage from "../core/state/AppStateService";

import { sqliteStorage } from "../core/state/SyncStateStore";
type Direction = "D" | "Y" | string;

type FmtField = {
  id: string;
  raw: string;
  startCol: number | null;
  endCol: number | null;
  startRow: number | null;
  endRow: number | null;
  markType: string;
  direction: Direction;
  options: string;
  formatCode: string;
  label: string;
  fieldType: string;
  length: number;
  optionCount: number;
  explanation: string;
  warning?: string;
};

type OpticFormRecord = {
  id: string;
  name: string;
  source: "FMT";
  createdAt: string;
  updatedAt: string;
  fmtText: string;
  txtTemplate: string;
  fields: FmtField[];
  totalQuestions: number;
  answerFields: number;
};

const OPTIC_FORMS_KEY = "opticForms";

const cleanLabel = (value: string) =>
  String(value || "")
    .replace(/=+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const onlyOptions = (value: string) => String(value || "").replace(/\s+/g, "");

const getFieldType = (label: string) => {
  const up = label.toLocaleUpperCase("tr-TR");
  if (up.includes("OKUL")) return "okulKodu";
  if (up.includes("ÖĞRENC") || up.includes("OGRENC")) return "ogrenciNo";
  if (up.includes("ADI") || up.includes("SOYADI")) return "adSoyad";
  if (up.includes("TC") || up.includes("TEL")) return "tcTel";
  if (up.includes("KİTAP") || up.includes("KITAP")) return "kitapcik";
  if (up.includes("SINIF")) return "sinif";
  if (up.includes("ŞUBE") || up.includes("SUBE")) return "sube";
  if (up.includes("GRUP")) return "grup";
  if (up.includes("OTURUM")) return "oturum";
  if (up.includes("KOD")) return "kod";
  return "cevapAlani";
};

const fieldTypeLabel: Record<string, string> = {
  okulKodu: "Okul Kodu",
  ogrenciNo: "Öğrenci No",
  adSoyad: "Adı Soyadı",
  tcTel: "TC / Telefon",
  kitapcik: "Kitapçık",
  sinif: "Sınıf",
  sube: "Şube",
  grup: "Grup",
  oturum: "Oturum",
  kod: "Kod Alanı",
  cevapAlani: "Cevap Alanı / Ders",
};

const numberOrNull = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function explainField(field: Omit<FmtField, "explanation" | "warning">) {
  const optionText = onlyOptions(field.options);
  const isVertical = field.direction === "D";
  const isHorizontal = field.direction === "Y";
  const colText =
    field.startCol !== null && field.endCol !== null
      ? `${field.startCol}-${field.endCol}`
      : "-";
  const rowText =
    field.startRow !== null && field.endRow !== null
      ? `${field.startRow}-${field.endRow}`
      : "-";

  if (isVertical) {
    return `${field.label}: ${colText}. sütun aralığında, ${rowText}. satırlar boyunca dikey okunur. Uzunluk ${field.length} karakter; seçenekler: ${optionText || "-"}.`;
  }
  if (isHorizontal) {
    return `${field.label}: ${rowText}. satır aralığında, ${colText}. sütunlar boyunca yatay okunur. ${field.length} soru/karakter; seçenekler: ${optionText || "-"}.`;
  }
  return `${field.label}: ${colText}. sütun, ${rowText}. satır aralığında özel alan olarak okunur.`;
}

function parseFmt(text: string): FmtField[] {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const parts = line.split("=");
    const x2Index = parts.findIndex((p) => p.trim().toUpperCase() === "X2");
    const label =
      cleanLabel(
        x2Index >= 0
          ? parts.slice(x2Index + 1).join("=")
          : parts.slice(7).join("="),
      ) || `Alan ${index + 1}`;

    const startCol = numberOrNull(parts[0] || "");
    const endCol = numberOrNull(parts[1] || "");
    const startRow = numberOrNull(parts[2] || "");
    const endRow = numberOrNull(parts[3] || "");
    const markType = String(parts[4] || "").trim();
    const direction = String(parts[5] || "").trim() as Direction;
    const options = String(parts[6] || "").trim();
    const formatCode = x2Index >= 0 ? "X2" : "";

    const colSpan =
      startCol !== null && endCol !== null
        ? Math.abs(endCol - startCol) + 1
        : 0;
    const rowSpan =
      startRow !== null && endRow !== null
        ? Math.abs(endRow - startRow) + 1
        : 0;
    const length =
      direction === "Y"
        ? colSpan
        : direction === "D"
          ? rowSpan
          : Math.max(colSpan, rowSpan);
    const optionCount = onlyOptions(options).length;
    const fieldType = getFieldType(label);

    const base = {
      id: `field-${Date.now()}-${index}`,
      raw: line,
      startCol,
      endCol,
      startRow,
      endRow,
      markType,
      direction,
      options,
      formatCode,
      label,
      fieldType,
      length,
      optionCount,
    };

    let warning = "";
    if (x2Index < 0 && index > 0)
      warning = "X2 etiketi bulunamadı; satır özel/header olarak yorumlandı.";
    if ((direction === "D" || direction === "Y") && length <= 0)
      warning = "Koordinat aralığı hesaplanamadı.";

    return {
      ...base,
      explanation: explainField(base),
      warning,
    } as FmtField;
  });
}

function buildTxtTemplate(fields: FmtField[]) {
  const headers = fields
    .filter((f) => f.formatCode === "X2")
    .map((f) => f.label.replace(/\s+/g, "_").toLocaleUpperCase("tr-TR"));
  return headers.join(";");
}

function buildFmtFromFields(fields: FmtField[]) {
  return fields
    .map((f) => {
      const values = [
        f.startCol ?? "",
        f.endCol ?? "",
        f.startRow ?? "",
        f.endRow ?? "",
        f.markType || "K",
        f.direction || "D",
        f.options || "",
        f.formatCode || "X2",
        f.label || "Alan",
      ];
      return `${values.join("=")}=`;
    })
    .join("\n");
}

function buildSummary(fields: FmtField[]) {
  const totalAnswerQuestions = fields
    .filter((f) => f.fieldType === "cevapAlani" && f.direction === "Y")
    .reduce((sum, f) => sum + Number(f.length || 0), 0);
  return {
    totalFields: fields.length,
    totalAnswerQuestions,
    answerFields: fields.filter((f) => f.fieldType === "cevapAlani").length,
    identityFields: fields.filter((f) => f.fieldType !== "cevapAlani").length,
  };
}

async function readFileAsWindows1254(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("windows-1254").decode(buffer);
  } catch {
    return new TextDecoder("iso-8859-9").decode(buffer);
  }
}

function downloadText(
  filename: string,
  content: string,
  type = "text/plain;charset=windows-1254",
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function OpticFormManagementModule() {
  const [formName, setFormName] = useState("OPTIK-129 SEKONIC");
  const [fmtText, setFmtText] = useState("");
  const [fields, setFields] = useState<FmtField[]>([]);
  const [savedForms, setSavedForms] = useState<OpticFormRecord[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const lfForms = (await localforage.getItem(OPTIC_FORMS_KEY)) as
        OpticFormRecord[] | null;
      if (Array.isArray(lfForms)) {
        setSavedForms(lfForms);
        try {
          sqliteStorage.setItem(OPTIC_FORMS_KEY, JSON.stringify(lfForms));
        } catch {}
        return;
      }
      try {
        const ls = JSON.parse(sqliteStorage.getItem(OPTIC_FORMS_KEY) || "[]");
        if (Array.isArray(ls)) setSavedForms(ls);
      } catch {}
    };
    load();
  }, []);

  const summary = useMemo(() => buildSummary(fields), [fields]);
  const txtTemplate = useMemo(() => buildTxtTemplate(fields), [fields]);
  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  const parseAndSet = (text: string) => {
    setFmtText(text);
    const parsed = parseFmt(text);
    setFields(parsed);
    setSelectedFieldId(parsed[0]?.id || null);
    setMessage(`${parsed.length} FMT satırı çözümlendi.`);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    const text = await readFileAsWindows1254(file);
    setFormName(file.name.replace(/\.fmt$/i, ""));
    parseAndSet(text);
  };

  const updateField = (id: string, patch: Partial<FmtField>) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...patch };
        const colSpan =
          next.startCol !== null && next.endCol !== null
            ? Math.abs(Number(next.endCol) - Number(next.startCol)) + 1
            : 0;
        const rowSpan =
          next.startRow !== null && next.endRow !== null
            ? Math.abs(Number(next.endRow) - Number(next.startRow)) + 1
            : 0;
        next.length =
          next.direction === "Y"
            ? colSpan
            : next.direction === "D"
              ? rowSpan
              : Math.max(colSpan, rowSpan);
        next.optionCount = onlyOptions(next.options).length;
        next.fieldType = getFieldType(next.label);
        next.explanation = explainField(next);
        return next;
      }),
    );
  };

  const saveForm = async () => {
    if (!formName.trim()) {
      setMessage("Form adı yazılmalıdır.");
      return;
    }
    if (fields.length === 0) {
      setMessage(
        "Önce bir FMT dosyası yükleyin veya FMT metni yapıştırıp çözümleyin.",
      );
      return;
    }
    const updatedFmtText = buildFmtFromFields(fields);
    const record: OpticFormRecord = {
      id: `optic-${Date.now()}`,
      name: formName.trim(),
      source: "FMT",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fmtText: updatedFmtText,
      txtTemplate,
      fields,
      totalQuestions: summary.totalAnswerQuestions,
      answerFields: summary.answerFields,
    };
    setFmtText(updatedFmtText);
    const next = [
      record,
      ...savedForms.filter((f) => f.name !== record.name),
    ].slice(0, 50);
    setSavedForms(next);
    await localforage.setItem(OPTIC_FORMS_KEY, next);
    try {
      sqliteStorage.setItem(OPTIC_FORMS_KEY, JSON.stringify(next));
    } catch {}
    setMessage(
      "Optik form kaydedildi. Yeni sınav oluştururken Optik Form Seçimi alanında görünecek.",
    );
  };

  const deleteForm = async (id: string) => {
    const next = savedForms.filter((f) => f.id !== id);
    setSavedForms(next);
    await localforage.setItem(OPTIC_FORMS_KEY, next);
    try {
      sqliteStorage.setItem(OPTIC_FORMS_KEY, JSON.stringify(next));
    } catch {}
  };

  const loadSaved = (record: OpticFormRecord) => {
    setFormName(record.name);
    setFmtText(record.fmtText || "");
    setFields(record.fields || []);
    setSelectedFieldId(record.fields?.[0]?.id || null);
    setMessage(`${record.name} yüklendi.`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
              <FileText className="h-6 w-6 text-purple-600" /> Optik Form
              Yönetimi
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              JPG/PNG analizini şimdilik devre dışı bıraktık. FMT dosyasını
              çözümleyip alan bazlı yönetim arayüzü oluşturuyoruz.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-600/20 hover:bg-purple-700">
            <Upload className="h-4 w-4" /> FMT Dosyası Yükle
            <input
              type="file"
              className="hidden"
              accept=".fmt,.txt"
              onChange={(e) => handleUpload(e.target.files?.[0] || null)}
            />
          </label>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {message}
        </div>
      )}

      <div className="grid gap-6">
        <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">
                Optik Form Adı
              </label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-purple-50 p-3">
                <div className="text-lg font-black text-purple-700">
                  {summary.totalFields}
                </div>
                <div className="text-[10px] font-bold text-purple-500">
                  Alan
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3">
                <div className="text-lg font-black text-emerald-700">
                  {summary.totalAnswerQuestions}
                </div>
                <div className="text-[10px] font-bold text-emerald-500">
                  Soru
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3">
                <div className="text-lg font-black text-amber-700">
                  {summary.identityFields}
                </div>
                <div className="text-[10px] font-bold text-amber-500">
                  Kimlik
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">
              FMT İçeriği
            </label>
            <textarea
              value={fmtText}
              onChange={(e) => setFmtText(e.target.value)}
              className="h-56 w-full resize-none rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-xs text-green-100 outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              placeholder="FMT içeriğini buraya yapıştırabilirsiniz..."
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => parseAndSet(fmtText)}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white hover:bg-slate-800"
            >
              Çözümle
            </button>
            <button
              type="button"
              onClick={saveForm}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700"
            >
              <Save className="h-4 w-4" /> Kaydet
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(txtTemplate)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-xs font-black text-indigo-700 hover:bg-indigo-100"
            >
              <Copy className="h-4 w-4" /> TXT Kopyala
            </button>
            <button
              type="button"
              onClick={() =>
                downloadText(
                  `${formName || "optic"}.json`,
                  JSON.stringify({ name: formName, fields }, null, 2),
                  "application/json;charset=utf-8",
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-black text-amber-700 hover:bg-amber-100"
            >
              <Download className="h-4 w-4" /> JSON
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
              <Layers className="h-4 w-4" /> TXT Şablonu
            </h3>
            <pre className="max-h-24 overflow-auto rounded-xl bg-white p-3 text-xs font-bold text-slate-600">
              {txtTemplate || "Henüz TXT şablonu oluşmadı."}
            </pre>
          </div>
        </section>
      </div>

      {selectedField && (
        <section className="rounded-[2rem] border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <Eye className="h-5 w-5 text-purple-600" /> Alan Detayı:{" "}
              {selectedField.label}
            </h2>
            {selectedField.warning && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" /> {selectedField.warning}
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                Alan Adı
              </label>
              <input
                value={selectedField.label}
                onChange={(e) =>
                  updateField(selectedField.id, { label: e.target.value })
                }
                className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              />
            </div>
            {[
              ["startCol", "Başlangıç Sütun"],
              ["endCol", "Bitiş Sütun"],
              ["startRow", "Başlangıç Satır"],
              ["endRow", "Bitiş Satır"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                  {label}
                </label>
                <input
                  type="number"
                  value={(selectedField as any)[key] ?? ""}
                  onChange={(e) =>
                    updateField(selectedField.id, {
                      [key]:
                        e.target.value === "" ? null : Number(e.target.value),
                    } as any)
                  }
                  className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                Yön
              </label>
              <select
                value={selectedField.direction}
                onChange={(e) =>
                  updateField(selectedField.id, { direction: e.target.value })
                }
                className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              >
                <option value="D">Dikey</option>
                <option value="Y">Yatay</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                Seçenekler
              </label>
              <input
                value={selectedField.options}
                onChange={(e) =>
                  updateField(selectedField.id, { options: e.target.value })
                }
                className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              />
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-600 shadow-sm">
            {selectedField.explanation}
          </div>
        </section>
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">FMT Alanları</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Bu bölüm ekranın altındadır. Alan adlarını doğrudan tablodan
              değiştirip Kaydet butonuyla optik forma işleyebilirsiniz.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {fields.length} satır
          </span>
        </div>

        <div className="max-h-[560px] overflow-auto rounded-2xl border border-slate-100">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Alan</th>
                <th className="px-3 py-2">Tür</th>
                <th className="px-3 py-2">Sütun</th>
                <th className="px-3 py-2">Satır</th>
                <th className="px-3 py-2">Yön</th>
                <th className="px-3 py-2">Uzunluk</th>
                <th className="px-3 py-2">Seçenek</th>
                <th className="px-3 py-2">Açıklama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setSelectedFieldId(f.id)}
                  className={`cursor-pointer ${selectedFieldId === f.id ? "bg-purple-50" : "hover:bg-slate-50"}`}
                >
                  <td className="px-3 py-2">
                    <input
                      value={f.label}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateField(f.id, { label: e.target.value })
                      }
                      className="w-44 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-600">
                      {fieldTypeLabel[f.fieldType] || f.fieldType}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {f.startCol}-{f.endCol}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {f.startRow}-{f.endRow}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-lg px-2 py-1 font-black ${f.direction === "Y" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      {f.direction === "Y"
                        ? "Yatay"
                        : f.direction === "D"
                          ? "Dikey"
                          : f.direction}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-black text-slate-700">
                    {f.length}
                  </td>
                  <td className="px-3 py-2 font-mono">{f.options || "-"}</td>
                  <td className="px-3 py-2 text-slate-500">{f.explanation}</td>
                </tr>
              ))}
              {fields.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center font-semibold text-slate-400"
                  >
                    FMT dosyası yükleyin veya içerik yapıştırıp Çözümle butonuna
                    basın.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">
            Kayıtlı Optik Formlar
          </h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {savedForms.length} form
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {savedForms.map((form) => (
            <div
              key={form.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-800">{form.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {form.fields?.length || 0} alan • {form.totalQuestions || 0}{" "}
                    soru
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteForm(form.id)}
                  className="rounded-xl bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => loadSaved(form)}
                className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-xs font-black text-purple-700 hover:bg-purple-50"
              >
                Yükle / İncele
              </button>
            </div>
          ))}
          {savedForms.length === 0 && (
            <p className="text-sm font-semibold text-slate-400">
              Henüz kayıtlı optik form yok.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
