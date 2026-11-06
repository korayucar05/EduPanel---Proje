import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  LayoutGrid,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  createOpticTemplate,
  deleteOpticTemplate,
  listOpticTemplates,
  updateOpticTemplate,
  type OpticAnswerField,
  type OpticIdentityField,
  type OpticIdentityKey,
  type OpticTemplate,
  type OpticTemplateKind,
} from "../lib/opticTemplateApi";

const IDENTITY_DEFINITIONS: Array<{
  key: OpticIdentityKey;
  label: string;
}> = [
  { key: "schoolCode", label: "Okul Kodu" },
  { key: "studentNo", label: "Öğrenci No" },
  { key: "fullName", label: "Adı Soyadı" },
  { key: "classLevel", label: "Sınıfı" },
  { key: "branch", label: "Şubesi" },
  { key: "area", label: "Alanı" },
  { key: "bookletType", label: "Kitapçık Türü" },
];

const COURSE_OPTIONS = [
  "Türkçe",
  "Türk Dili ve Edebiyatı",
  "Sosyal Bilimler",
  "Tarih",
  "Coğrafya",
  "Felsefe",
  "Din Kültürü ve Ahlak Bilgisi",
  "Matematik",
  "Temel Matematik",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "Fen Bilimleri",
  "İngilizce",
  "Almanca",
  "Fransızca",
];

const blankIdentityFields = (): OpticIdentityField[] =>
  IDENTITY_DEFINITIONS.map((item) => ({
    ...item,
    startColumn: 0,
    columnCount: 0,
  }));

const ANSWER_AREA_COUNT = 4;

const blankAnswerAreaStarts = () =>
  Array.from({ length: ANSWER_AREA_COUNT }, () => 0);

const normalizeCourseKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const legacyAreaIndexForCourse = (courseName: unknown, fallbackIndex: number) => {
  const key = normalizeCourseKey(courseName);
  if (/turk|edebiyat|yabanci dil|ingiliz|almanca|fransiz/.test(key)) return 0;
  if (/tarih|cograf|felsefe|din kulturu|sosyal/.test(key)) return 1;
  if (/matematik/.test(key)) return 2;
  if (/fizik|kimya|biyoloji|fen bilim/.test(key)) return 3;
  return Math.min(Math.max(fallbackIndex, 0), ANSWER_AREA_COUNT - 1);
};

const answerAreaIndexOf = (field: Partial<OpticAnswerField>, fallbackIndex = 0) => {
  const match = String(field?.id || "").match(/^area-(\d)-/);
  if (match) {
    const parsed = Number(match[1]) - 1;
    if (parsed >= 0 && parsed < ANSWER_AREA_COUNT) return parsed;
  }
  return legacyAreaIndexForCourse(field?.courseName, fallbackIndex);
};

const withAreaFieldId = (field: OpticAnswerField, areaIndex: number) => {
  if (/^area-\d-/.test(String(field.id || ""))) return field.id;
  return `area-${areaIndex + 1}-${field.id || `answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
};

const prepareAnswerLayout = (template: Pick<OpticTemplate, "answerFields" | "answerAreaStarts">) => {
  const groups: OpticAnswerField[][] = Array.from(
    { length: ANSWER_AREA_COUNT },
    () => [],
  );
  const sourceFields = [...(template.answerFields || [])].sort(
    (left, right) => Number(left.startColumn || 0) - Number(right.startColumn || 0),
  );

  sourceFields.forEach((field, index) => {
    const areaIndex = answerAreaIndexOf(field, Math.min(index, ANSWER_AREA_COUNT - 1));
    groups[areaIndex].push({
      ...field,
      id: withAreaFieldId(field, areaIndex),
    });
  });

  const savedStarts =
    Array.isArray(template.answerAreaStarts) && template.answerAreaStarts.length === ANSWER_AREA_COUNT
      ? template.answerAreaStarts.map((value) => Math.max(0, Number(value) || 0))
      : blankAnswerAreaStarts();

  const starts = groups.map((group, areaIndex) => {
    if (savedStarts[areaIndex] > 0) return savedStarts[areaIndex];
    const configured = group
      .map((field) => Number(field.startColumn || 0))
      .filter((value) => value > 0);
    return configured.length ? Math.min(...configured) : 0;
  });

  return {
    starts,
    fields: groups.flatMap((group) => group),
  };
};

const makeEmptyAnswer = (areaIndex: number): OpticAnswerField => ({
  id: `area-${areaIndex + 1}-answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  courseName: "",
  startColumn: 0,
  columnCount: 0,
});

const computeAnswerFields = (
  fields: OpticAnswerField[],
  areaStarts: number[],
): OpticAnswerField[] => {
  const groups: OpticAnswerField[][] = Array.from(
    { length: ANSWER_AREA_COUNT },
    () => [],
  );
  fields.forEach((field, index) => {
    groups[answerAreaIndexOf(field, Math.min(index, ANSWER_AREA_COUNT - 1))].push(field);
  });

  return groups.flatMap((group, areaIndex) => {
    let nextStart = Math.max(0, Number(areaStarts[areaIndex] || 0));
    return group.map((field) => {
      const questionCount = Math.max(0, Number(field.columnCount || 0));
      const computedStart = nextStart > 0 && questionCount > 0 ? nextStart : 0;
      if (computedStart > 0) nextStart += questionCount;
      return {
        ...field,
        id: withAreaFieldId(field, areaIndex),
        startColumn: computedStart,
        columnCount: questionCount,
      };
    });
  });
};

const rangeEnd = (start: number, count: number) =>
  start > 0 && count > 0 ? start + count - 1 : 0;

const rangesOverlap = (
  aStart: number,
  aCount: number,
  bStart: number,
  bCount: number,
) =>
  aStart > 0 &&
  aCount > 0 &&
  bStart > 0 &&
  bCount > 0 &&
  aStart <= rangeEnd(bStart, bCount) &&
  bStart <= rangeEnd(aStart, aCount);

export default function SekonicOpticFormPanel() {
  const [templates, setTemplates] = useState<OpticTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [templateKind, setTemplateKind] = useState<OpticTemplateKind>("Özel");
  const [identityFields, setIdentityFields] =
    useState<OpticIdentityField[]>(blankIdentityFields());
  const [answerFields, setAnswerFields] = useState<OpticAnswerField[]>([]);
  const [answerAreaStarts, setAnswerAreaStarts] = useState<number[]>(
    blankAnswerAreaStarts(),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [toast, setToast] = useState("");
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listOpticTemplates();
      setTemplates(rows);
    } catch (error) {
      console.error(error);
      setToast(
        error instanceof Error
          ? error.message
          : "Optik formlar yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Optik Form Yönetimi sekmesi aktifken "Yeni Optik Form" butonunu
  // mevcut koyu eflatun sekme çubuğunun en sağına yerleştir.
  useEffect(() => {
    const locateToolbar = () => {
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      );
      const opticTab = buttons.find((button) =>
        String(button.textContent || "")
          .trim()
          .toLocaleLowerCase("tr-TR")
          .includes("optik form yönetimi"),
      );

      const host = opticTab?.parentElement;
      if (host && host instanceof HTMLElement) {
        setToolbarHost(host);
      }
    };

    locateToolbar();

    const observer = new MutationObserver(() => locateToolbar());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const resetDraft = () => {
    setEditingId(null);
    setName("");
    setTemplateKind("Özel");
    setIdentityFields(blankIdentityFields());
    setAnswerFields([]);
    setAnswerAreaStarts(blankAnswerAreaStarts());
    setModalMessage("");
  };

  const openNewTemplate = () => {
    resetDraft();
    setIsModalOpen(true);
  };

  const openEditTemplate = (template: OpticTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setTemplateKind(
      template.templateKind === "TYT" || template.templateKind === "AYT"
        ? template.templateKind
        : "Özel",
    );
    const savedIdentityFields = new Map(
      (template.identityFields || []).map((field) => [field.key, field]),
    );
    setIdentityFields(
      blankIdentityFields().map((field) => ({
        ...field,
        ...(savedIdentityFields.get(field.key) || {}),
      })),
    );
    const preparedAnswerLayout = prepareAnswerLayout(template);
    setAnswerFields(preparedAnswerLayout.fields);
    setAnswerAreaStarts(preparedAnswerLayout.starts);
    setModalMessage("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    resetDraft();
  };

  const computedAnswerFields = useMemo(
    () => computeAnswerFields(answerFields, answerAreaStarts),
    [answerFields, answerAreaStarts],
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    const configuredIdentityFields = identityFields.filter(
      (field) => field.startColumn > 0 && field.columnCount > 0,
    );

    answerFields.forEach((field, index) => {
      const courseName = String(field.courseName || "").trim();
      const questionCount = Math.max(0, Number(field.columnCount || 0));
      if (courseName && questionCount <= 0) {
        errors.push(`${courseName} için soru sayısını girin.`);
      } else if (!courseName && questionCount > 0) {
        errors.push(`${index + 1}. ders satırında ders seçin.`);
      }
    });

    for (let areaIndex = 0; areaIndex < ANSWER_AREA_COUNT; areaIndex += 1) {
      const hasCourse = answerFields.some(
        (field, index) =>
          answerAreaIndexOf(field, Math.min(index, ANSWER_AREA_COUNT - 1)) === areaIndex &&
          Boolean(String(field.courseName || "").trim()) &&
          Number(field.columnCount || 0) > 0,
      );
      if (hasCourse && Number(answerAreaStarts[areaIndex] || 0) <= 0) {
        errors.push(`${areaIndex + 1}. alanın ilk başlangıç sütununu girin.`);
      }
    }

    const configuredAnswerFields = computedAnswerFields.filter(
      (field) =>
        Boolean(String(field.courseName || "").trim()) &&
        field.startColumn > 0 &&
        field.columnCount > 0,
    );

    const courseNames = configuredAnswerFields
      .map((field) => field.courseName.trim())
      .filter(Boolean);

    if (new Set(courseNames).size !== courseNames.length) {
      errors.push("Aynı ders bir optik forma iki kez eklenemez.");
    }

    const allRanges = [
      ...configuredIdentityFields.map((field) => ({
        label: field.label,
        start: field.startColumn,
        count: field.columnCount,
      })),
      ...configuredAnswerFields.map((field) => ({
        label: field.courseName || "Ders",
        start: field.startColumn,
        count: field.columnCount,
      })),
    ];

    for (let i = 0; i < allRanges.length; i += 1) {
      for (let j = i + 1; j < allRanges.length; j += 1) {
        if (
          rangesOverlap(
            allRanges[i].start,
            allRanges[i].count,
            allRanges[j].start,
            allRanges[j].count,
          )
        ) {
          errors.push(
            `${allRanges[i].label} ile ${allRanges[j].label} sütunları çakışıyor.`,
          );
        }
      }
    }

    return errors;
  }, [identityFields, answerFields, answerAreaStarts, computedAnswerFields]);

  const updateIdentityField = (
    key: OpticIdentityKey,
    property: "startColumn" | "columnCount",
    rawValue: string,
  ) => {
    const value = Math.max(0, Number(rawValue) || 0);

    setIdentityFields((current) =>
      current.map((field) =>
        field.key === key
          ? { ...field, [property]: value }
          : field,
      ),
    );
  };

  const updateAnswerField = (
    id: string,
    patch: Partial<OpticAnswerField>,
  ) => {
    setAnswerFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    );
  };

  const addAnswerField = (areaIndex: number) => {
    setAnswerFields((current) => [...current, makeEmptyAnswer(areaIndex)]);
  };

  const removeAnswerField = (id: string) => {
    setAnswerFields((current) =>
      current.filter((field) => field.id !== id),
    );
  };

  const saveTemplate = async () => {
    if (validationErrors.length > 0) {
      setModalMessage(validationErrors[0]);
      return;
    }

    setSaving(true);
    setModalMessage("");

    // Sunucudaki eski optik şeması kimlik alanları dizisinde 7 satırı da
    // bekliyor. Kullanıcı boş bıraktığı alanları arayüzde tanımlamak zorunda
    // değil; boş alanlar 0/0 olarak saklanır ve okuma sırasında zaten yok
    // sayılır. Böylece eski sunucu ile yeni esnek arayüz birlikte çalışır.
    const persistedIdentityFields = identityFields.map((field) => ({ ...field }));
    const configuredAnswerFields = computedAnswerFields.filter(
      (field) =>
        Boolean(String(field.courseName || "").trim()) &&
        field.startColumn > 0 &&
        field.columnCount > 0,
    );
    const payload = {
      name: name.trim() || `Optik Form ${templates.length + 1}`,
      templateKind,
      identityFields: persistedIdentityFields,
      answerFields: configuredAnswerFields.map((field) => ({
        ...field,
        courseName: field.courseName.trim(),
      })),
      answerAreaStarts: answerAreaStarts.map((value) =>
        Math.max(0, Number(value) || 0),
      ),
    };

    try {
      const saved = editingId
        ? await updateOpticTemplate(editingId, payload)
        : await createOpticTemplate(payload);

      const rows = await listOpticTemplates();
      const verified = rows.find((item) => item.id === saved.id);

      if (!verified) {
        throw new Error(
          "Optik form kaydedildi ancak SQLite doğrulaması başarısız oldu.",
        );
      }

      setTemplates(rows);
      setToast(
        editingId
          ? `"${verified.name}" güncellendi.`
          : `"${verified.name}" optik kartı oluşturuldu.`,
      );

      setIsModalOpen(false);
      resetDraft();

      window.dispatchEvent(
        new CustomEvent("edupanel:optic-templates-changed"),
      );
    } catch (error) {
      console.error(error);
      setModalMessage(
        error instanceof Error
          ? error.message
          : "Optik form kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrentTemplate = async () => {
    if (!editingId) {
      setModalMessage("Henüz kaydedilmemiş bir optik form silinemez.");
      return;
    }

    const current = templates.find((item) => item.id === editingId);
    if (!current) {
      setModalMessage("Silinecek optik form bulunamadı.");
      return;
    }

    const approved = window.confirm(
      `"${current.name}" adlı optik form silinsin mi?\n\nBu işlem geri alınamaz.`,
    );

    if (!approved) return;

    setSaving(true);
    setModalMessage("");

    try {
      await deleteOpticTemplate(current.id);

      const rows = await listOpticTemplates();
      setTemplates(rows);
      setToast(`"${current.name}" silindi.`);
      setIsModalOpen(false);
      resetDraft();

      window.dispatchEvent(
        new CustomEvent("edupanel:optic-templates-changed"),
      );
    } catch (error) {
      console.error(error);
      setModalMessage(
        error instanceof Error
          ? error.message
          : "Optik form silinemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const newButton = (
    <button
      type="button"
      onClick={openNewTemplate}
      className="ml-auto flex h-[40px] flex-none items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-rose-300 bg-rose-600 px-4 text-[11px] font-black text-white shadow-md shadow-rose-950/20 transition hover:bg-rose-700"
      title="Yeni optik form oluştur"
    >
      <Plus className="h-4 w-4" />
      Yeni Optik Form
    </button>
  );

  return (
    <>
      {toolbarHost
        ? createPortal(newButton, toolbarHost)
        : (
          <div className="mb-4 flex justify-end">
            {newButton}
          </div>
        )}

      {toast && (
        <div className="fixed right-5 top-5 z-[260] rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-700 shadow-2xl">
          {toast}
        </div>
      )}

      {/* Kapalı görünüm: yalnız kaydedilmiş optik kartları */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex min-h-[220px] items-center justify-center rounded-3xl border border-slate-200 bg-white text-sm font-bold text-slate-400">
            Optik kartlar yükleniyor...
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full flex min-h-[260px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <LayoutGrid className="h-8 w-8" />
            </div>
            <h3 className="text-base font-black text-slate-800">
              Henüz kayıtlı optik form yok
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Sağ üstteki Yeni Optik Form butonundan ilk kartı oluşturabilirsiniz.
            </p>
          </div>
        ) : (
          templates.map((template, index) => (
            <article
              key={template.id}
              className="group relative overflow-hidden rounded-[26px] border border-violet-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-950 via-fuchsia-700 to-violet-500" />

              <div className="relative p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950 to-fuchsia-700 text-white shadow-lg shadow-violet-950/20">
                      <FileText className="h-6 w-6" />
                      <div className="absolute bottom-1.5 right-1.5 grid grid-cols-3 gap-[2px] opacity-70">
                        {Array.from({ length: 9 }).map((_, dotIndex) => (
                          <span
                            key={dotIndex}
                            className="h-1 w-1 rounded-full bg-white"
                          />
                        ))}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-500">
                        Optik Form
                      </div>
                      <h3 className="mt-1 truncate text-base font-black text-slate-900">
                        {template.name}
                      </h3>
                      <div className="mt-1 text-[10px] font-bold text-slate-400">
                        Kart #{String(index + 1).padStart(2, "0")}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex h-8 min-w-[54px] items-center justify-center rounded-xl border px-2.5 text-[10px] font-black ${
                      template.templateKind === "TYT"
                        ? "border-sky-200 bg-sky-50 text-sky-700"
                        : template.templateKind === "AYT"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-violet-200 bg-violet-50 text-violet-700"
                    }`}
                  >
                    {template.templateKind || "Özel"}
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => openEditTemplate(template)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-950 px-4 py-3 text-xs font-black text-white transition hover:bg-violet-900"
                  >
                    <Pencil className="h-4 w-4" />
                    Güncelle
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Tek ekrana sığan kompakt optik form düzenleme penceresi */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section className="flex h-[96vh] w-[98vw] max-w-[1580px] flex-col overflow-hidden rounded-[26px] border border-white/20 bg-slate-50 shadow-2xl">
            <header className="flex h-[58px] shrink-0 items-center justify-between gap-4 bg-gradient-to-r from-violet-950 via-purple-900 to-fuchsia-900 px-5 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <LayoutGrid className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[8px] font-black uppercase tracking-[0.18em] text-violet-200">
                    Optik Form Yönetimi
                  </div>
                  <h2 className="truncate text-base font-black">
                    {editingId ? "Optik Formu Güncelle" : "Yeni Optik Form"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                title="Pencereyi kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[310px_minmax(0,1fr)]">
              {/* Sol kolon: mevcut sabit bilgiler, dar ve alt alta */}
              <div className="flex min-h-0 flex-col gap-3">
                <section className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
                  <div className="space-y-2.5">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-violet-700">
                      Optik Form Adı
                      <input
                        value={name}
                        onChange={(event) => {
                          setName(event.target.value);
                          setModalMessage("");
                        }}
                        placeholder="Örn. TYT Standart Optik"
                        className="mt-1 h-9 w-full rounded-xl border border-violet-200 bg-violet-50/30 px-3 text-xs font-black text-slate-900 outline-none focus:border-violet-400"
                      />
                    </label>

                    <label className="block text-[9px] font-black uppercase tracking-wider text-violet-700">
                      Optik Türü
                      <select
                        value={templateKind}
                        onChange={(event) =>
                          setTemplateKind(event.target.value as OpticTemplateKind)
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-violet-200 bg-white px-3 text-xs font-black text-slate-900 outline-none focus:border-violet-400"
                      >
                        <option value="TYT">TYT</option>
                        <option value="AYT">AYT</option>
                        <option value="Özel">Özel</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-900">
                        Optik Formun Sabit Bilgi Alanları
                      </h3>
                      <p className="text-[9px] font-semibold text-slate-400">
                        TXT başlangıç ve sütun bilgileri sabittir.
                      </p>
                    </div>
                    <span className="rounded-lg bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-700">
                      7 Alan
                    </span>
                  </div>

                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                    {identityFields.map((field) => (
                      <div
                        key={field.key}
                        className="grid grid-cols-[1fr_66px_62px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-1.5"
                      >
                        <div className="truncate text-[10px] font-black text-slate-800">
                          {field.label}
                        </div>

                        <label className="text-[7px] font-black uppercase text-slate-400">
                          Başlangıç
                          <input
                            type="number"
                            min="1"
                            value={field.startColumn || ""}
                            onChange={(event) =>
                              updateIdentityField(
                                field.key,
                                "startColumn",
                                event.target.value,
                              )
                            }
                            className="mt-0.5 h-7 w-full rounded-lg border border-slate-200 bg-white px-1 text-center text-[10px] font-black text-slate-900 outline-none focus:border-violet-400"
                          />
                        </label>

                        <label className="text-[7px] font-black uppercase text-slate-400">
                          Sütun
                          <input
                            type="number"
                            min="1"
                            value={field.columnCount || ""}
                            onChange={(event) =>
                              updateIdentityField(
                                field.key,
                                "columnCount",
                                event.target.value,
                              )
                            }
                            className="mt-0.5 h-7 w-full rounded-lg border border-slate-200 bg-white px-1 text-center text-[10px] font-black text-slate-900 outline-none focus:border-violet-400"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Sağ kolon: optikteki dört cevap alanı */}
              <section className="flex min-h-0 flex-col rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
                <div className="mb-2 shrink-0">
                  <h3 className="text-xs font-black text-slate-900">
                    Optik Cevap Alanları
                  </h3>
                  <p className="text-[9px] font-semibold text-slate-400">
                    Dört alanın TXT ilk başlangıç sütununu girin. Derslerin sonraki başlangıçları soru sayısına göre otomatik hesaplanır.
                  </p>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: ANSWER_AREA_COUNT }).map((_, areaIndex) => {
                    const areaFields = answerFields.filter(
                      (field, index) =>
                        answerAreaIndexOf(
                          field,
                          Math.min(index, ANSWER_AREA_COUNT - 1),
                        ) === areaIndex,
                    );

                    return (
                      <div
                        key={areaIndex}
                        className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/20"
                      >
                        <div className="shrink-0 border-b border-violet-100 bg-violet-950 p-2.5 text-white">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-[10px] font-black uppercase tracking-wider">
                              {areaIndex + 1}. Alan
                            </div>
                            <div className="text-[8px] font-bold text-violet-200">TXT</div>
                          </div>
                          <label className="block text-[8px] font-black uppercase tracking-wide text-violet-200">
                            İlk başlangıç sütunu
                            <input
                              type="number"
                              min="1"
                              value={answerAreaStarts[areaIndex] || ""}
                              onChange={(event) => {
                                const nextValue = Math.max(0, Number(event.target.value) || 0);
                                setAnswerAreaStarts((current) =>
                                  current.map((value, index) =>
                                    index === areaIndex ? nextValue : value,
                                  ),
                                );
                              }}
                              className="mt-1 h-8 w-full rounded-lg border border-violet-700 bg-white px-2 text-center text-xs font-black text-violet-950 outline-none"
                            />
                          </label>
                        </div>

                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                          {areaFields.map((field) => {
                            const computedField = computedAnswerFields.find(
                              (item) => item.id === field.id,
                            );
                            return (
                              <div
                                key={field.id}
                                className="rounded-xl border border-violet-100 bg-white p-2 shadow-sm"
                              >
                                <div className="mb-1.5 flex items-center justify-between gap-1">
                                  <span className="rounded-md bg-violet-100 px-1.5 py-1 text-[8px] font-black text-violet-800">
                                    Başl. {computedField?.startColumn || "—"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeAnswerField(field.id)}
                                    className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    title="Dersi kaldır"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>

                                <select
                                  value={field.courseName}
                                  onChange={(event) =>
                                    updateAnswerField(field.id, {
                                      courseName: event.target.value,
                                    })
                                  }
                                  className="h-8 w-full rounded-lg border border-violet-200 bg-white px-2 text-[10px] font-black text-slate-900 outline-none focus:border-violet-400"
                                >
                                  <option value="">Ders seçin...</option>
                                  {COURSE_OPTIONS.map((course) => (
                                    <option key={course} value={course}>
                                      {course}
                                    </option>
                                  ))}
                                </select>

                                <label className="mt-1.5 grid grid-cols-[1fr_58px] items-center gap-2 text-[8px] font-black uppercase text-slate-500">
                                  Soru sayısı
                                  <input
                                    type="number"
                                    min="1"
                                    value={field.columnCount || ""}
                                    onChange={(event) =>
                                      updateAnswerField(field.id, {
                                        columnCount: Math.max(
                                          0,
                                          Number(event.target.value) || 0,
                                        ),
                                      })
                                    }
                                    className="h-8 rounded-lg border border-violet-200 bg-white px-1 text-center text-[10px] font-black text-slate-900 outline-none focus:border-violet-400"
                                  />
                                </label>
                              </div>
                            );
                          })}

                          {areaFields.length === 0 && (
                            <div className="rounded-xl border border-dashed border-violet-200 bg-white/60 px-2 py-5 text-center text-[9px] font-bold text-violet-400">
                              Bu alana ders ekleyin.
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 border-t border-violet-100 p-2">
                          <button
                            type="button"
                            onClick={() => addAnswerField(areaIndex)}
                            className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-violet-100 px-2 text-[9px] font-black text-violet-800 hover:bg-violet-200"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Ders Ekle
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <footer className="flex h-[58px] shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4">
              <div className="min-w-0 flex-1">
                {(modalMessage || validationErrors[0]) && (
                  <div className="truncate rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700">
                    {modalMessage || validationErrors[0]}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void deleteCurrentTemplate()}
                  disabled={!editingId || saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                  Sil
                </button>

                <button
                  type="button"
                  onClick={() => void saveTemplate()}
                  disabled={saving || validationErrors.length > 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-black text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving
                    ? "Kaydediliyor..."
                    : editingId
                      ? "Değişiklikleri Kaydet"
                      : "Kaydet"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
