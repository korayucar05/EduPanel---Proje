import React, { useEffect, useMemo, useState } from "react";
import {
  PenTool,
  Target,
  GraduationCap,
  LayoutGrid,
  Palette,
  Plus,
  X,
  Save,
  Trash2,
  Edit3,
  FileText,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import ScoringModule from "./ScoringModule";
import SekonicOpticFormPanel from "./SekonicOpticFormPanel";
import ExamCameraReader from "./ExamCameraReader";

type ToolTab = "optic-form" | "camera-reader" | "scoring" | "yok-atlas" | "trial-dates" | "design";
type ExamKind = "TYT" | "AYT" | "Ders Denemesi";

const normalizeExamKind = (value: unknown): ExamKind => {
  const key = String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");
  if (["branş deneme", "branş denemesi", "branch deneme", "branch denemesi", "ders deneme", "ders denemesi"].includes(key)) {
    return "Ders Denemesi";
  }
  if (key === "ayt") return "AYT";
  return "TYT";
};

type FieldName =
  | "Okul Kodu"
  | "Öğrenci No"
  | "Öğrenci Adı Soyadı"
  | "Alan Sınıf"
  | "Şube"
  | "Kitapçık"
  | "Türkçe"
  | "Tarih"
  | "Coğrafya"
  | "Felsefe"
  | "Sosyal Bilimler"
  | "Temel Matematik"
  | "Fen Bilimleri"
  | "Türk Dili ve Edebiyatı"
  | "Tarih - 1"
  | "Coğrafya - 1"
  | "Tarih - 2"
  | "Coğrafya - 2"
  | "Felsefe Grubu"
  | "Din Kültürü ve Ahlak Bilgisi"
  | "Matematik"
  | "Fizik"
  | "Kimya"
  | "Biyoloji";

type FmtField = {
  id: string;
  examKind: ExamKind;
  fieldName: FieldName;
  columnStart: string;
  columnCount: string;
  direction: "Dikey" | "Yatay";
  optionSet: string;
  rawLine?: string;
};

type OpticTemplate = {
  id: string;
  name: string;
  examKind: ExamKind;
  createdAt: string;
  fields: FmtField[];
  fmtText: string;
  txtTemplate: string;
};

const STORAGE_KEY = "opticForms";

type FieldOption = { name: FieldName; group?: string; questionCount?: number };

const COMMON_FIELD_OPTIONS: FieldOption[] = [
  { name: "Okul Kodu" },
  { name: "Öğrenci No" },
  { name: "Öğrenci Adı Soyadı" },
  { name: "Alan Sınıf" },
  { name: "Şube" },
  { name: "Kitapçık" },
];

const TYT_FIELD_OPTIONS: FieldOption[] = [
  ...COMMON_FIELD_OPTIONS,
  { name: "Türkçe", group: "Türkçe", questionCount: 40 },
  { name: "Tarih", group: "Sosyal Bilimler", questionCount: 5 },
  { name: "Coğrafya", group: "Sosyal Bilimler", questionCount: 5 },
  { name: "Felsefe", group: "Sosyal Bilimler", questionCount: 5 },
  { name: "Din Kültürü ve Ahlak Bilgisi", group: "Sosyal Bilimler", questionCount: 5 },
  { name: "Temel Matematik", group: "Temel Matematik", questionCount: 40 },
  { name: "Fizik", group: "Fen Bilimleri", questionCount: 7 },
  { name: "Kimya", group: "Fen Bilimleri", questionCount: 7 },
  { name: "Biyoloji", group: "Fen Bilimleri", questionCount: 6 },
];

const AYT_FIELD_OPTIONS: FieldOption[] = [
  ...COMMON_FIELD_OPTIONS,
  { name: "Türk Dili ve Edebiyatı", group: "Türk Dili ve Edebiyatı - Sosyal Bilimler - 1", questionCount: 24 },
  { name: "Tarih - 1", group: "Türk Dili ve Edebiyatı - Sosyal Bilimler - 1", questionCount: 10 },
  { name: "Coğrafya - 1", group: "Türk Dili ve Edebiyatı - Sosyal Bilimler - 1", questionCount: 6 },
  { name: "Tarih - 2", group: "Sosyal Bilimler - 2", questionCount: 11 },
  { name: "Coğrafya - 2", group: "Sosyal Bilimler - 2", questionCount: 11 },
  { name: "Felsefe Grubu", group: "Sosyal Bilimler - 2", questionCount: 12 },
  { name: "Din Kültürü ve Ahlak Bilgisi", group: "Sosyal Bilimler - 2", questionCount: 6 },
  { name: "Matematik", group: "Matematik", questionCount: 40 },
  { name: "Fizik", group: "Fen Bilimleri", questionCount: 14 },
  { name: "Kimya", group: "Fen Bilimleri", questionCount: 13 },
  { name: "Biyoloji", group: "Fen Bilimleri", questionCount: 13 },
];

const BRANCH_FIELD_OPTIONS: FieldOption[] = [
  ...COMMON_FIELD_OPTIONS,
  { name: "Türkçe" },
  { name: "Matematik" },
  { name: "Fizik" },
  { name: "Kimya" },
  { name: "Biyoloji" },
  { name: "Tarih - 1" },
  { name: "Coğrafya - 1" },
  { name: "Felsefe Grubu" },
  { name: "Din Kültürü ve Ahlak Bilgisi" },
];

const getFieldOptionsByExamKind = (kind: ExamKind): FieldOption[] => {
  if (kind === "AYT") return AYT_FIELD_OPTIONS;
  if (kind === "Ders Denemesi") return BRANCH_FIELD_OPTIONS;
  return TYT_FIELD_OPTIONS;
};

const getDefaultFieldsByExamKind = (kind: ExamKind): FmtField[] =>
  getFieldOptionsByExamKind(kind).map((item, idx) => ({
    id: `default-${Date.now()}-${idx}`,
    examKind: kind,
    fieldName: item.name,
    columnStart: "",
    columnCount: item.questionCount ? String(item.questionCount) : "",
    direction: "Dikey",
    optionSet:
      item.name === "Kitapçık"
        ? "ABCD"
        : item.questionCount || ["Türkçe", "Tarih", "Coğrafya", "Felsefe", "Sosyal Bilimler", "Temel Matematik", "Fen Bilimleri", "Matematik", "Türk Dili ve Edebiyatı", "Tarih - 1", "Coğrafya - 1", "Tarih - 2", "Coğrafya - 2", "Felsefe Grubu", "Din Kültürü ve Ahlak Bilgisi", "Fizik", "Kimya", "Biyoloji"].includes(item.name)
          ? "ABCDE"
          : "0123456789",
  }));

const normalizeFieldName = (raw: string): FieldName => {
  const value = String(raw || "").toLocaleUpperCase("tr-TR");
  if (value.includes("OKUL")) return "Okul Kodu";
  if (value.includes("ÖĞRENCİ") && value.includes("NO")) return "Öğrenci No";
  if (value.includes("AD") || value.includes("SOYAD")) return "Öğrenci Adı Soyadı";
  if (value.includes("SINIF") || value.includes("ALAN")) return "Alan Sınıf";
  if (value.includes("ŞUBE")) return "Şube";
  if (value.includes("KİTAP") || value.includes("KITAP")) return "Kitapçık";
  if (value.includes("EDEB")) return "Türk Dili ve Edebiyatı";
  if (value.includes("TARİH") && value.includes("1")) return "Tarih - 1";
  if (value.includes("TARIH") && value.includes("1")) return "Tarih - 1";
  if (value.includes("COĞRAFYA") && value.includes("1")) return "Coğrafya - 1";
  if (value.includes("COGRAFYA") && value.includes("1")) return "Coğrafya - 1";
  if (value.includes("TARİH") && value.includes("2")) return "Tarih - 2";
  if (value.includes("TARIH") && value.includes("2")) return "Tarih - 2";
  if (value.includes("TARİH") || value.includes("TARIH")) return "Tarih";
  if (value.includes("COĞRAFYA") && value.includes("2")) return "Coğrafya - 2";
  if (value.includes("COGRAFYA") && value.includes("2")) return "Coğrafya - 2";
  if (value.includes("COĞRAFYA") || value.includes("COGRAFYA")) return "Coğrafya";
  if (value.includes("FELSEFE") && value.includes("GRUP")) return "Felsefe Grubu";
  if (value.includes("FELSEFE")) return "Felsefe";
  if (value.includes("DİN") || value.includes("DIN")) return "Din Kültürü ve Ahlak Bilgisi";
  if (value.includes("FİZ") || value.includes("FIZ")) return "Fizik";
  if (value.includes("KİM") || value.includes("KIM")) return "Kimya";
  if (value.includes("BİY") || value.includes("BIY")) return "Biyoloji";
  if (value.includes("TÜRK") || value.includes("TURK")) return "Türkçe";
  if (value.includes("SOSYAL")) return "Sosyal Bilimler";
  if (value.includes("TEMEL") && value.includes("MAT")) return "Temel Matematik";
  if (value.includes("MAT")) return "Matematik";
  if (value.includes("FEN")) return "Fen Bilimleri";
  return "Türkçe";
};

const buildTxtTemplate = (fields: FmtField[]) =>
  fields
    .map((field) => field.fieldName.replace(/\s+/g, "_").toLocaleUpperCase("tr-TR"))
    .join(";");

const buildFmtText = (fields: FmtField[]) =>
  fields
    .filter((field) => field.columnStart && field.columnCount)
    .map((field) => {
      const start = Number(field.columnStart || 0);
      const count = Number(field.columnCount || 0);
      const end = start + Math.max(count - 1, 0);
      const dir = field.direction === "Dikey" ? "D" : "Y";
      return `${start}=1=${end}=1=K=${dir}=${field.optionSet || "0123456789"}=X2=${field.fieldName}=`;
    })
    .join("\n");

const parseFmtText = (fmtText: string, examKind: ExamKind): FmtField[] => {
  return String(fmtText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("=");
      const columnStart = parts[0] || "";
      const columnEnd = parts[2] || "";
      const direction = parts[5] === "Y" ? "Yatay" : "Dikey";
      const optionSet = parts[6] || "";
      const label = parts.slice(8).filter(Boolean).join(" ") || `Alan ${index + 1}`;
      const start = Number(columnStart || 0);
      const end = Number(columnEnd || 0);
      const columnCount = start && end ? String(Math.max(end - start + 1, 1)) : "";
      return {
        id: `field-${Date.now()}-${index}`,
        examKind,
        fieldName: normalizeFieldName(label),
        columnStart,
        columnCount,
        direction,
        optionSet,
        rawLine: line,
      } as FmtField;
    });
};

const loadTemplates = (): OpticTemplate[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((template: any) => {
      const examKind = normalizeExamKind(template?.examKind);
      return {
        ...template,
        examKind,
        fields: Array.isArray(template?.fields)
          ? template.fields.map((field: any) => ({
              ...field,
              examKind: normalizeExamKind(field?.examKind || examKind),
            }))
          : [],
      };
    });
  } catch {
    return [];
  }
};

const saveTemplates = (templates: OpticTemplate[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
};

function OpticFormManagementPanel() {
  const [templates, setTemplates] = useState<OpticTemplate[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [examKind, setExamKind] = useState<ExamKind>("TYT");
  const [selectedFieldName, setSelectedFieldName] = useState<FieldName>("Okul Kodu");
  const [columnStart, setColumnStart] = useState("");
  const [columnCount, setColumnCount] = useState("");
  const [direction, setDirection] = useState<"Dikey" | "Yatay">("Dikey");
  const [optionSet, setOptionSet] = useState("0123456789");
  const [fields, setFields] = useState<FmtField[]>([]);
  const [fmtText, setFmtText] = useState("");
  const [fieldBeingCorrectedId, setFieldBeingCorrectedId] = useState<string | null>(null);

  const currentFieldOptions = useMemo(() => getFieldOptionsByExamKind(examKind), [examKind]);

  useEffect(() => {
    const options = getFieldOptionsByExamKind(examKind);
    if (!options.some((item) => item.name === selectedFieldName)) {
      setSelectedFieldName(options[0]?.name || "Okul Kodu");
    }
  }, [examKind, selectedFieldName]);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const computedFmtText = useMemo(() => buildFmtText(fields), [fields]);
  const computedTxtTemplate = useMemo(() => buildTxtTemplate(fields), [fields]);

  const upsertFields = (prev: FmtField[], incoming: FmtField[]) => {
    const next = [...prev];
    incoming.forEach((item) => {
      const index = next.findIndex((field) => field.fieldName === item.fieldName);
      if (index >= 0) {
        next[index] = { ...next[index], ...item };
      } else {
        next.push(item);
      }
    });
    return next;
  };

  const makeAutoField = (
    id: string,
    kind: ExamKind,
    fieldName: FieldName,
    start: number,
    count: number,
  ): FmtField => ({
    id,
    examKind: kind,
    fieldName,
    columnStart: String(start),
    columnCount: String(count),
    direction: "Dikey",
    optionSet: "ABCDE",
  });

  const applySequentialGroupColumns = (
    startValue: string,
    kind: ExamKind,
    triggerField: FieldName,
    sequence: { id: string; fieldName: FieldName; count: number }[],
  ) => {
    const start = Number(startValue || 0);
    if (!start || examKind !== kind || selectedFieldName !== triggerField) return false;

    const duplicateNames = sequence
      .map((item) => item.fieldName)
      .filter((name) => fields.some((field) => field.fieldName === name));

    if (duplicateNames.length > 0) {
      alert(`Bu alan(lar) zaten tanımlı: ${duplicateNames.join(", ")}. Önce yanlış kaydı “Düzelt” ile kaldırın.`);
      return false;
    }

    let cursor = start;
    const autoFields = sequence.map((item) => {
      const field = makeAutoField(item.id, kind, item.fieldName, cursor, item.count);
      cursor += item.count;
      return field;
    });

    setColumnCount(String(sequence[0]?.count || ""));
    setFields((prev) => [...prev, ...autoFields]);
    return true;
  };

  const applyAytLiteratureGroupColumns = (startValue: string) =>
    applySequentialGroupColumns(startValue, "AYT", "Türk Dili ve Edebiyatı", [
      { id: "ayt-tde", fieldName: "Türk Dili ve Edebiyatı", count: 24 },
      { id: "ayt-tarih-1", fieldName: "Tarih - 1", count: 10 },
      { id: "ayt-cografya-1", fieldName: "Coğrafya - 1", count: 6 },
    ]);

  const applyAytSocial2GroupColumns = (startValue: string) =>
    applySequentialGroupColumns(startValue, "AYT", "Tarih - 2", [
      { id: "ayt-tarih-2", fieldName: "Tarih - 2", count: 11 },
      { id: "ayt-cografya-2", fieldName: "Coğrafya - 2", count: 11 },
      { id: "ayt-felsefe", fieldName: "Felsefe Grubu", count: 12 },
      { id: "ayt-dkab", fieldName: "Din Kültürü ve Ahlak Bilgisi", count: 6 },
    ]);

  const applyAytScienceGroupColumns = (startValue: string) =>
    applySequentialGroupColumns(startValue, "AYT", "Fizik", [
      { id: "ayt-fizik", fieldName: "Fizik", count: 14 },
      { id: "ayt-kimya", fieldName: "Kimya", count: 13 },
      { id: "ayt-biyoloji", fieldName: "Biyoloji", count: 13 },
    ]);

  const applyTytSocialGroupColumns = (startValue: string) =>
    applySequentialGroupColumns(startValue, "TYT", "Tarih", [
      { id: "tyt-tarih", fieldName: "Tarih", count: 5 },
      { id: "tyt-cografya", fieldName: "Coğrafya", count: 5 },
      { id: "tyt-felsefe", fieldName: "Felsefe", count: 5 },
      { id: "tyt-dkab", fieldName: "Din Kültürü ve Ahlak Bilgisi", count: 5 },
    ]);

  const applyTytScienceGroupColumns = (startValue: string) =>
    applySequentialGroupColumns(startValue, "TYT", "Fizik", [
      { id: "tyt-fizik", fieldName: "Fizik", count: 7 },
      { id: "tyt-kimya", fieldName: "Kimya", count: 7 },
      { id: "tyt-biyoloji", fieldName: "Biyoloji", count: 6 },
    ]);

  const applyAutomaticColumnRules = (startValue: string) => {
    return (
      applyAytLiteratureGroupColumns(startValue) ||
      applyAytSocial2GroupColumns(startValue) ||
      applyAytScienceGroupColumns(startValue) ||
      applyTytSocialGroupColumns(startValue) ||
      applyTytScienceGroupColumns(startValue)
    );
  };

  const openModal = () => {
    setEditingTemplateId(null);
    setTemplateName("");
    setExamKind("TYT");
    setSelectedFieldName("Okul Kodu");
    setColumnStart("");
    setColumnCount("");
    setDirection("Dikey");
    setOptionSet("0123456789");
    setFields(getDefaultFieldsByExamKind("TYT"));
    setFmtText("");
    setIsModalOpen(true);
  };


  const openEditTemplate = (template: OpticTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name || "");
    setExamKind(normalizeExamKind(template.examKind || "TYT"));
    setSelectedFieldName(getFieldOptionsByExamKind(normalizeExamKind(template.examKind || "TYT"))[0]?.name || "Okul Kodu");
    setColumnStart("");
    setColumnCount("");
    setDirection("Dikey");
    setOptionSet("0123456789");
    setFields(Array.isArray(template.fields) ? template.fields : getDefaultFieldsByExamKind(normalizeExamKind(template.examKind || "TYT")));
    setFmtText(template.fmtText || "");
    setIsModalOpen(true);
  };


  const handleExamKindChange = (newKind: ExamKind) => {
    setExamKind(newKind);
    setSelectedFieldName(getFieldOptionsByExamKind(newKind)[0]?.name || "Okul Kodu");
    setColumnStart("");
    setColumnCount("");
    setFields(getDefaultFieldsByExamKind(newKind));
  };

  const addOrUpdateField = () => {
    if (!columnStart || !columnCount) {
      alert("Sütun No ve Kaç Sütun alanlarını doldurun.");
      return;
    }

    if (fields.some((field) => field.fieldName === selectedFieldName)) {
      alert(`${selectedFieldName} alanı zaten tanımlı. Aynı alan ikinci kez eklenemez.`);
      return;
    }

    if (
      (examKind === "AYT" && ["Türk Dili ve Edebiyatı", "Tarih - 2", "Fizik"].includes(selectedFieldName)) ||
      (examKind === "TYT" && ["Tarih", "Fizik"].includes(selectedFieldName))
    ) {
      const applied = applyAutomaticColumnRules(columnStart);
      if (applied !== false) {
        setColumnStart("");
        setColumnCount("");
        setFieldBeingCorrectedId(null);
      }
      return;
    }

    const newField: FmtField = {
      id: fieldBeingCorrectedId || `field-${Date.now()}`,
      examKind,
      fieldName: selectedFieldName,
      columnStart,
      columnCount,
      direction,
      optionSet,
    };

    setFields((prev) => [...prev, newField]);
    setColumnStart("");
    setColumnCount("");
    setFieldBeingCorrectedId(null);
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((field) => field.id !== id));
    if (fieldBeingCorrectedId === id) setFieldBeingCorrectedId(null);
  };

  const startFieldCorrection = (field: FmtField) => {
    setFields((prev) => prev.filter((item) => item.id !== field.id));
    setFieldBeingCorrectedId(field.id);
    setExamKind(field.examKind);
    setSelectedFieldName(field.fieldName);
    setColumnStart(String(field.columnStart || ""));
    setColumnCount(String(field.columnCount || ""));
    setDirection(field.direction === "Yatay" ? "Yatay" : "Dikey");
    setOptionSet(field.optionSet || "0123456789");
  };

  const moveField = (id: string, directionValue: -1 | 1) => {
    setFields((prev) => {
      const index = prev.findIndex((field) => field.id === id);
      const target = index + directionValue;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const getFieldGroupStyle = (field: FmtField) => {
    const option = getFieldOptionsByExamKind(field.examKind).find((item) => item.name === field.fieldName);
    const group = option?.group || "Kimlik Alanları";
    const styles: Record<string, string> = {
      "Kimlik Alanları": "bg-slate-50",
      "Türkçe": "bg-sky-50",
      "Sosyal Bilimler": "bg-amber-50",
      "Temel Matematik": "bg-violet-50",
      "Türk Dili ve Edebiyatı - Sosyal Bilimler - 1": "bg-rose-50",
      "Sosyal Bilimler - 2": "bg-orange-50",
      "Matematik": "bg-indigo-50",
      "Fen Bilimleri": "bg-emerald-50",
    };
    return styles[group] || "bg-white";
  };

  const handleFmtFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setFmtText(text);
    const parsedFields = parseFmtText(text, examKind);
    if (parsedFields.length > 0) setFields(parsedFields);
    if (!templateName) setTemplateName(file.name.replace(/\.fmt$/i, ""));
  };

  const saveTemplate = () => {
    const name = templateName.trim() || `${examKind} Optik Şablonu`;
    const existingTemplate = editingTemplateId
      ? templates.find((item) => item.id === editingTemplateId)
      : null;

    const nextTemplate: OpticTemplate = {
      id: editingTemplateId || `optic-${Date.now()}`,
      name,
      examKind,
      createdAt: existingTemplate?.createdAt || new Date().toISOString(),
      fields: Array.from(new Map(fields.map((field) => [field.fieldName, field])).values()),
      fmtText: computedFmtText || fmtText,
      txtTemplate: computedTxtTemplate,
    };

    const next = editingTemplateId
      ? templates.map((item) => (item.id === editingTemplateId ? nextTemplate : item))
      : [nextTemplate, ...templates.filter((item) => item.name !== name)];

    setTemplates(next);
    saveTemplates(next);
    setEditingTemplateId(null);
    setIsModalOpen(false);
  };

  const deleteTemplate = (id: string) => {
    if (!window.confirm("Bu optik şablonu silmek istediğinizden emin misiniz?")) return;
    const next = templates.filter((template) => template.id !== id);
    setTemplates(next);
    saveTemplates(next);
  };

  const renderGradeSelector = (
    selectedGrade: string,
    onChange: (gradeLevel: string) => void,
    tone: "sky" | "fuchsia",
    source: Record<string, DesignAsset>,
  ) => (
    <div className="flex flex-wrap items-center gap-2">
      {DESIGN_GRADE_LEVELS.map((gradeLevel) => {
        const selected = selectedGrade === gradeLevel;
        const count = countAssetsForGrade(source, gradeLevel);
        return (
          <button
            key={`${tone}-${gradeLevel}`}
            type="button"
            onClick={() => onChange(gradeLevel)}
            className={`rounded-2xl border px-4 py-2.5 text-xs font-black transition ${
              tone === "sky"
                ? selected
                  ? "border-sky-700 bg-sky-700 text-white"
                  : "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                : selected
                  ? "border-fuchsia-700 bg-fuchsia-700 text-white"
                  : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100"
            }`}
          >
            {gradeLevel}. Sınıf · {count}/{DESIGN_COURSES.length}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Optik Form Yönetimi</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              FMT dosyasını yükleyin veya alanların sütun başlangıç/değer uzunluğunu elle tanımlayın.
            </p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-950 px-5 py-3 text-xs font-black text-white shadow-lg shadow-purple-950/10 hover:bg-purple-900"
          >
            <Plus className="h-4 w-4" /> Yeni Optik Ekle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {templates.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="font-black text-slate-800">Kayıtlı optik şablon yok</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Yeni Optik Ekle butonuyla ilk optik şablonunuzu oluşturabilirsiniz.</p>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-purple-500">{template.examKind}</div>
                  <h3 className="text-base font-black text-slate-900">{template.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{template.fields?.length || 0} alan tanımlı</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditTemplate(template)}
                    className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"
                    title="Optik şablonu düzenle"
                  >
                    <Edit3 className="h-4 w-4" />
                    Düzenle
                  </button>
                  <button type="button" onClick={() => deleteTemplate(template.id)} className="rounded-xl bg-rose-50 p-2 text-rose-600 hover:bg-rose-100" title="Optik şablonu sil">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-48 overflow-auto rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                {(template.fields || []).map((field) => (
                  <div key={field.id} className="mb-1 flex justify-between gap-3 border-b border-slate-100 pb-1 last:border-0">
                    <span>{field.fieldName}</span>
                    <span className="font-black text-slate-800">Sütun {field.columnStart} • {field.columnCount} sütun</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">{editingTemplateId ? "Optik Şablonu Güncelle" : "Yeni Optik Ekle"}</h3>
                <p className="text-xs font-semibold text-slate-500">Sınav türünü ve alan sütun bilgilerini tanımlayın.</p>
              </div>
              <button type="button" onClick={() => { setEditingTemplateId(null); setIsModalOpen(false); }} className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-4 rounded-3xl border border-purple-100 bg-purple-50 p-4 lg:col-span-1">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Şablon adı</label>
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Örn: TYT 129 Sekonic"
                    className="w-full rounded-2xl border border-purple-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-purple-100"
                  />
                </div>

                <div className="rounded-2xl bg-white p-3 text-xs font-semibold text-slate-500">
                  Sınav türünü seçin, alan adını belirleyin, ardından sütun başlangıç numarası ve kaç sütun devam edeceğini elle girin.
                </div>
                {examKind === "AYT" && (
                  <div className="space-y-2 rounded-2xl border border-purple-100 bg-white p-3 text-xs font-bold text-slate-600">
                    <div className="text-[10px] font-black uppercase tracking-wider text-purple-600">AYT Ders Grupları</div>
                    <p><span className="text-slate-900">Türk Dili ve Edebiyatı - Sosyal Bilimler - 1:</span> Türk Dili ve Edebiyatı 24, Tarih - 1 10, Coğrafya - 1 6 soru</p>
                    <p className="rounded-xl bg-purple-50 p-2 text-purple-800">Türk Dili ve Edebiyatı, Tarih - 2 veya Fizik için sütun no girildiğinde aynı gruptaki sonraki derslerin sütunları otomatik hesaplanır.</p>
                    <p><span className="text-slate-900">Sosyal Bilimler - 2:</span> Tarih - 2 11, Coğrafya - 2 11, Felsefe Grubu 12, Din Kültürü ve Ahlak Bilgisi 6 soru</p>
                    <p><span className="text-slate-900">Matematik:</span> 40 soru</p>
                    <p><span className="text-slate-900">Fen Bilimleri:</span> Fizik 14, Kimya 13, Biyoloji 13 soru</p>
                  </div>
                )}
                {examKind === "TYT" && (
                  <div className="space-y-2 rounded-2xl border border-purple-100 bg-white p-3 text-xs font-bold text-slate-600">
                    <div className="text-[10px] font-black uppercase tracking-wider text-purple-600">TYT Ders Grupları</div>
                    <p><span className="text-slate-900">Sosyal Bilimler:</span> Tarih 5, Coğrafya 5, Felsefe 5, Din Kültürü ve Ahlak Bilgisi 5 soru</p>
                    <p><span className="text-slate-900">Fen Bilimleri:</span> Fizik 7, Kimya 7, Biyoloji 6 soru</p>
                    <p className="rounded-xl bg-purple-50 p-2 text-purple-800">Tarih veya Fizik için sütun no girildiğinde aynı gruptaki sonraki derslerin sütunları otomatik hesaplanır.</p>
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-4 lg:col-span-2">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Sınav</label>
                    <div className="relative">
                      <select value={examKind} onChange={(e) => handleExamKindChange(e.target.value as ExamKind)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-purple-100">
                        <option value="TYT">TYT</option>
                        <option value="AYT">AYT</option>
                        <option value="Ders Denemesi">Ders Denemesi</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Alan adı</label>
                    <select
                      value={selectedFieldName}
                      onChange={(e) => {
                        const nextName = e.target.value as FieldName;
                        const selected = currentFieldOptions.find((item) => item.name === nextName);
                        setSelectedFieldName(nextName);
                        if (selected?.questionCount) setColumnCount(String(selected.questionCount));
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-purple-100"
                    >
                      {examKind === "AYT" ? (
                        <>
                          <optgroup label="Kimlik Alanları">
                            {COMMON_FIELD_OPTIONS.map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                          <optgroup label="Türk Dili ve Edebiyatı - Sosyal Bilimler - 1">
                            {AYT_FIELD_OPTIONS.filter((field) => field.group === "Türk Dili ve Edebiyatı - Sosyal Bilimler - 1").map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                          <optgroup label="Sosyal Bilimler - 2">
                            {AYT_FIELD_OPTIONS.filter((field) => field.group === "Sosyal Bilimler - 2").map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                          <optgroup label="Matematik">
                            {AYT_FIELD_OPTIONS.filter((field) => field.group === "Matematik").map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                          <optgroup label="Fen Bilimleri">
                            {AYT_FIELD_OPTIONS.filter((field) => field.group === "Fen Bilimleri").map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                        </>
                      ) : examKind === "TYT" ? (
                        <>
                          <optgroup label="Kimlik Alanları">
                            {COMMON_FIELD_OPTIONS.map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                          <optgroup label="Türkçe">
                            {TYT_FIELD_OPTIONS.filter((field) => field.group === "Türkçe").map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                          <optgroup label="Sosyal Bilimler">
                            {TYT_FIELD_OPTIONS.filter((field) => field.group === "Sosyal Bilimler").map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                          <optgroup label="Temel Matematik">
                            {TYT_FIELD_OPTIONS.filter((field) => field.group === "Temel Matematik").map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                          <optgroup label="Fen Bilimleri">
                            {TYT_FIELD_OPTIONS.filter((field) => field.group === "Fen Bilimleri").map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}
                          </optgroup>
                        </>
                      ) : (
                        currentFieldOptions.map((field) => <option key={field.name} value={field.name}>{field.name}</option>)
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">1. Alan: Sütun No</label>
                    <input
                      value={columnStart}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, "");
                        setColumnStart(value);
                        applyAutomaticColumnRules(value);
                      }}
                      placeholder="örn. 16"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-purple-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">2. Alan: Kaç Sütun</label>
                    <input value={columnCount} onChange={(e) => setColumnCount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="örn. 40" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-purple-100" />
                  </div>

                  <div className="flex items-end">
                    <button type="button" onClick={addOrUpdateField} className="w-full rounded-2xl bg-purple-950 px-4 py-3 text-sm font-black text-white hover:bg-purple-900">
                      Ekle / Güncelle
                    </button>
                  </div>
                </div>

                {fieldBeingCorrectedId && (
                  <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Yanlış alan listeden kaldırıldı. Üstteki değerleri düzeltip “Ekle / Güncelle” butonuna basın.
                  </div>
                )}

                <div className="overflow-auto rounded-2xl border border-slate-100">
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Sınav</th>
                        <th className="px-3 py-2">Alan Adı</th>
                        <th className="px-3 py-2">Sütun No</th>
                        <th className="px-3 py-2">Kaç Sütun</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => (
                        <tr key={field.id} className={`border-t border-slate-100 ${getFieldGroupStyle(field)}`}>
                          <td className="px-3 py-2 font-bold text-slate-700">{field.examKind}</td>
                          <td className="px-3 py-2 font-black text-slate-800">{field.fieldName}</td>
                          <td className="px-3 py-2">
                            <input readOnly disabled value={field.columnStart} className="w-24 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-2 py-2 font-black text-slate-600 opacity-90" />
                          </td>
                          <td className="px-3 py-2">
                            <input readOnly disabled value={field.columnCount} className="w-24 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-2 py-2 font-black text-slate-600 opacity-90" />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" disabled={index === 0} onClick={() => moveField(field.id, -1)} className="rounded-lg bg-white/80 p-2 text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-30" title="Yukarı taşı">
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button type="button" disabled={index === fields.length - 1} onClick={() => moveField(field.id, 1)} className="rounded-lg bg-white/80 p-2 text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-30" title="Aşağı taşı">
                                <ArrowDown className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => startFieldCorrection(field)} className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-2 text-[10px] font-black text-amber-800" title="Yanlış bilgiyi silip yeniden gir">
                                <Edit3 className="h-4 w-4" /> Düzelt
                              </button>
                              <button type="button" onClick={() => removeField(field.id)} className="rounded-lg bg-rose-100 p-2 text-rose-700" title="Sil">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Üretilen FMT</label>
                <textarea readOnly value={computedFmtText || fmtText} className="h-44 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Üretilen TXT Başlık Şablonu</label>
                <textarea readOnly value={computedTxtTemplate} className="h-44 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs outline-none" />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => { setEditingTemplateId(null); setIsModalOpen(false); }} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-200">İptal</button>
              <button type="button" onClick={saveTemplate} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                <Save className="h-4 w-4" /> {editingTemplateId ? "Güncelle" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


type DesignSubTab = "test-headers" | "exam-headers" | "exam-covers";

type DesignAsset = {
  courseName?: string;
  gradeLevel?: string;
  slot?: number;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  width: number;
  height: number;
  updatedAt: string;
};

const DESIGN_TEST_HEADERS_KEY = "edupanel_exam_tool_test_headers_v1";
const DESIGN_EXAM_HEADERS_KEY = "edupanel_exam_tool_exam_headers_v1";
const DESIGN_EXAM_COVERS_KEY = "edupanel_exam_tool_exam_covers_v1";

const DESIGN_COURSES = [
  "Türkçe",
  "Türk Dili ve Edebiyatı",
  "Tarih",
  "Coğrafya",
  "Felsefe",
  "Din Kültürü ve Ahlak Bilgisi",
  "Matematik",
  "Temel Matematik",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "İngilizce",
  "Almanca",
];

const DESIGN_GRADE_LEVELS = ["9", "10", "11", "12"];

const normalizeDesignKey = (value: string) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");

const readDesignStore = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeDesignStore = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const loadImageAsset = (file: File): Promise<Omit<DesignAsset, "courseName" | "gradeLevel" | "slot">> =>
  new Promise((resolve, reject) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExtension = ["svg", "jpg", "jpeg", "png"].includes(extension);
    const allowedMime = ["image/svg+xml", "image/jpeg", "image/png"].includes(file.type);

    if (!allowedExtension && !allowedMime) {
      reject(new Error("Yalnız SVG, JPG veya PNG dosyası yüklenebilir."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) {
        reject(new Error("Dosya içeriği okunamadı."));
        return;
      }

      const image = new Image();
      image.onerror = () =>
        reject(new Error("Görsel boyutları okunamadı. Farklı bir SVG/JPG/PNG deneyin."));
      image.onload = () =>
        resolve({
          fileName: file.name,
          mimeType: file.type || (extension === "svg" ? "image/svg+xml" : "image/png"),
          dataUrl,
          width: Number(image.naturalWidth || image.width || 0),
          height: Number(image.naturalHeight || image.height || 0),
          updatedAt: new Date().toISOString(),
        });
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

function DesignAssetPreview({ asset }: { asset?: DesignAsset }) {
  if (!asset?.dataUrl) {
    return (
      <div className="flex h-14 w-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-300">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="h-14 w-24 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <img src={asset.dataUrl} alt="" className="h-full w-full object-contain" />
    </div>
  );
}

function DesignModule() {
  const [subTab, setSubTab] = useState<DesignSubTab>("test-headers");
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");

  const testHeaders = useMemo(
    () => readDesignStore<Record<string, DesignAsset>>(DESIGN_TEST_HEADERS_KEY, {}),
    [version],
  );
  const examHeaders = useMemo(
    () => readDesignStore<Record<string, DesignAsset>>(DESIGN_EXAM_HEADERS_KEY, {}),
    [version],
  );
  const examCovers = useMemo(
    () => readDesignStore<Record<string, DesignAsset>>(DESIGN_EXAM_COVERS_KEY, {}),
    [version],
  );

  const [examHeaderGradeLevel, setExamHeaderGradeLevel] = useState<string>("9");
  const [examCoverGradeLevel, setExamCoverGradeLevel] = useState<string>("9");

  const buildGradeCourseKey = (gradeLevel: string, courseName: string) =>
    `${gradeLevel}::${normalizeDesignKey(courseName)}`;

  const getGradeCourseAsset = (
    source: Record<string, DesignAsset>,
    courseName: string,
    gradeLevel?: string,
  ) => {
    if (gradeLevel) {
      const direct = source[buildGradeCourseKey(gradeLevel, courseName)];
      if (direct) return direct;

      const compatible = Object.entries(source).find(([key, value]) => {
        const valueGrade = String(value?.gradeLevel || "").trim();
        const valueCourse = normalizeDesignKey(String(value?.courseName || key));
        return valueGrade === gradeLevel && valueCourse === normalizeDesignKey(courseName);
      });
      if (compatible?.[1]) return compatible[1];
    }

    const classic = source[normalizeDesignKey(courseName)];
    if (classic) return classic;

    const fallback = Object.entries(source).find(([key, value]) => {
      const valueCourse = normalizeDesignKey(String(value?.courseName || key));
      return valueCourse === normalizeDesignKey(courseName);
    });
    return fallback?.[1];
  };

  const countAssetsForGrade = (
    source: Record<string, DesignAsset>,
    gradeLevel: string,
  ) => DESIGN_COURSES.filter((courseName) => Boolean(getGradeCourseAsset(source, courseName, gradeLevel))).length;

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2800);
  };

  const uploadCourseAsset = async (
    kind: "test" | "exam",
    courseName: string,
    file?: File,
    gradeLevel?: string,
  ) => {
    if (!file) return;
    try {
      const rawAsset = await loadImageAsset(file);
      const storeKey =
        kind === "test" ? DESIGN_TEST_HEADERS_KEY : DESIGN_EXAM_HEADERS_KEY;
      const key =
        kind === "exam" && gradeLevel
          ? buildGradeCourseKey(gradeLevel, courseName)
          : normalizeDesignKey(courseName);
      const current = readDesignStore<Record<string, DesignAsset>>(storeKey, {});
      const next = {
        ...current,
        [key]: { ...rawAsset, courseName, ...(gradeLevel ? { gradeLevel } : {}) },
      };
      writeDesignStore(storeKey, next);

      window.dispatchEvent(
        new CustomEvent(
          kind === "test"
            ? "edupanel:test-header-design-updated"
            : "edupanel:exam-header-design-updated",
          { detail: { courseName, key, gradeLevel: gradeLevel || null } },
        ),
      );

      setVersion((value) => value + 1);
      notify(
        kind === "test"
          ? `${courseName} test başlığı kaydedildi.`
          : `${gradeLevel}. sınıf ${courseName} ünite denemesi görseli kaydedildi.`,
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Dosya yüklenemedi.");
    }
  };

  const removeCourseAsset = (
    kind: "test" | "exam",
    courseName: string,
    gradeLevel?: string,
  ) => {
    const storeKey =
      kind === "test" ? DESIGN_TEST_HEADERS_KEY : DESIGN_EXAM_HEADERS_KEY;
    const key =
      kind === "exam" && gradeLevel
        ? buildGradeCourseKey(gradeLevel, courseName)
        : normalizeDesignKey(courseName);
    const current = readDesignStore<Record<string, DesignAsset>>(storeKey, {});
    if (!current[key]) return;
    const next = { ...current };
    delete next[key];
    writeDesignStore(storeKey, next);
    setVersion((value) => value + 1);
  };

  const uploadCover = async (
    gradeLevel: string,
    courseName: string,
    file?: File,
  ) => {
    if (!file) return;
    try {
      const rawAsset = await loadImageAsset(file);
      const current = readDesignStore<Record<string, DesignAsset>>(
        DESIGN_EXAM_COVERS_KEY,
        {},
      );
      const key = buildGradeCourseKey(gradeLevel, courseName);
      writeDesignStore(DESIGN_EXAM_COVERS_KEY, {
        ...current,
        [key]: {
          ...rawAsset,
          gradeLevel,
          courseName,
        },
      });

      window.dispatchEvent(
        new CustomEvent("edupanel:exam-cover-design-updated", {
          detail: { gradeLevel, courseName, key },
        }),
      );
      setVersion((value) => value + 1);
      notify(`${gradeLevel}. sınıf ${courseName} deneme kapağı kaydedildi.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Kapak yüklenemedi.");
    }
  };

  const removeCover = (gradeLevel: string, courseName: string) => {
    const current = readDesignStore<Record<string, DesignAsset>>(
      DESIGN_EXAM_COVERS_KEY,
      {},
    );
    const key = buildGradeCourseKey(gradeLevel, courseName);
    if (!current[key]) return;
    const next = { ...current };
    delete next[key];
    writeDesignStore(DESIGN_EXAM_COVERS_KEY, next);
    setVersion((value) => value + 1);
  };

  const renderCourseAssets = (
    kind: "test" | "exam" | "cover",
    gradeLevel?: string,
  ) => {
    const source =
      kind === "test"
        ? testHeaders
        : kind === "exam"
          ? examHeaders
          : examCovers;

    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {DESIGN_COURSES.map((courseName) => {
          const asset = getGradeCourseAsset(source, courseName, gradeLevel);
          const key = `${kind}-${gradeLevel || "all"}-${normalizeDesignKey(courseName)}`;
          const labelText =
            kind === "test"
              ? "Test başlık görseli"
              : kind === "exam"
                ? `${gradeLevel}. sınıf ünite denemesi görseli`
                : `${gradeLevel}. sınıf deneme kapak görseli`;
          return (
            <div
              key={key}
              className={`overflow-hidden rounded-3xl border p-4 shadow-sm transition ${
                kind === "cover"
                  ? "border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 via-white to-white"
                  : kind === "exam"
                    ? "border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white"
                    : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="flex h-24 w-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {asset?.dataUrl ? (
                      <img src={asset.dataUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <ImageIcon className="h-7 w-7" />
                        <span className="text-[10px] font-black">Görsel yok</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {gradeLevel && (
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        kind === "cover"
                          ? "bg-fuchsia-100 text-fuchsia-700"
                          : "bg-sky-100 text-sky-700"
                      }`}>
                        {gradeLevel}. Sınıf
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                      {kind === "cover" ? "Deneme Kapağı" : kind === "exam" ? "Ünite Denemesi" : "Test Başlığı"}
                    </span>
                  </div>

                  <div className="mt-3 text-base font-black text-slate-900">{courseName}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">{labelText}</div>
                  <div className="mt-2 truncate text-[10px] font-semibold text-slate-400">
                    {asset?.fileName || "Henüz görsel yüklenmedi"}
                  </div>
                  {asset?.fileName && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Kayıtlı
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {asset && (
                  <button
                    type="button"
                    onClick={() =>
                      kind === "cover"
                        ? removeCover(String(gradeLevel || ""), courseName)
                        : removeCourseAsset(kind as "test" | "exam", courseName, gradeLevel)
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-100"
                    title="Yüklenen dosyayı kaldır"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black text-white ${
                  kind === "cover"
                    ? "bg-fuchsia-700 hover:bg-fuchsia-800"
                    : kind === "exam"
                      ? "bg-sky-700 hover:bg-sky-800"
                      : "bg-purple-950 hover:bg-purple-900"
                }`}>
                  <Upload className="h-4 w-4" />
                  Görsel Yükle
                  <input
                    type="file"
                    accept=".svg,.jpg,.jpeg,.png,image/svg+xml,image/jpeg,image/png"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (kind === "cover") {
                        void uploadCover(String(gradeLevel || ""), courseName, file);
                      } else {
                        void uploadCourseAsset(kind as "test" | "exam", courseName, file, gradeLevel);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGradeSelector = (
    selectedGrade: string,
    onChange: (gradeLevel: string) => void,
    tone: "sky" | "fuchsia",
    source: Record<string, DesignAsset>,
  ) => (
    <div className="flex flex-wrap items-center gap-2">
      {DESIGN_GRADE_LEVELS.map((gradeLevel) => {
        const selected = selectedGrade === gradeLevel;
        const count = countAssetsForGrade(source, gradeLevel);
        return (
          <button
            key={`${tone}-${gradeLevel}`}
            type="button"
            onClick={() => onChange(gradeLevel)}
            className={`rounded-2xl border px-4 py-2.5 text-xs font-black transition ${
              tone === "sky"
                ? selected
                  ? "border-sky-700 bg-sky-700 text-white"
                  : "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                : selected
                  ? "border-fuchsia-700 bg-fuchsia-700 text-white"
                  : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100"
            }`}
          >
            {gradeLevel}. Sınıf · {count}/{DESIGN_COURSES.length}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      {message && (
        <div className="fixed right-5 top-5 z-[200] rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-xs font-black text-emerald-700 shadow-xl">
          {message}
        </div>
      )}

      <div className="rounded-3xl border border-purple-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "test-headers" as const, label: "Test Başlıkları" },
            { id: "exam-headers" as const, label: "Ünite Denemeleri" },
            { id: "exam-covers" as const, label: "Deneme Kapakları" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              className={`rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                subTab === item.id
                  ? "border-purple-950 bg-purple-950 text-white"
                  : "border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === "test-headers" && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">Test Başlıkları</h3>
            <p className="text-xs font-semibold text-slate-500">
              Her ders için SVG, JPG veya PNG başlık yükleyin. Test Paneli PDF üretiminde bu kayıt kullanılır.
            </p>
          </div>
          {renderCourseAssets("test")}
        </section>
      )}

      {subTab === "exam-headers" && (
        <section className="space-y-4">
          <div className="rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Ünite Denemeleri</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Her sınıf düzeyi için derslere ayrı ünite denemesi görselleri yükleyin. Seçilen sınıf düzeyi değiştiğinde yalnız o sınıfa ait ders görselleri listelenir.
                </p>
              </div>
              <div className="rounded-2xl bg-sky-100 px-4 py-2 text-xs font-black text-sky-800">
                {examHeaderGradeLevel}. Sınıf · {countAssetsForGrade(examHeaders, examHeaderGradeLevel)}/{DESIGN_COURSES.length} görsel
              </div>
            </div>
            <div className="mt-4">
              {renderGradeSelector(examHeaderGradeLevel, setExamHeaderGradeLevel, "sky", examHeaders)}
            </div>
          </div>
          {renderCourseAssets("exam", examHeaderGradeLevel)}
        </section>
      )}

      {subTab === "exam-covers" && (
        <section className="space-y-5">
          <div className="rounded-3xl border border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 via-white to-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Deneme Kapakları</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Her sınıf düzeyi için ders bazlı kapak görselleri yükleyin. Böylece aynı sınıftaki her ders için farklı kapak görseli ayrı ayrı saklanabilir.
                </p>
              </div>
              <div className="rounded-2xl bg-fuchsia-100 px-4 py-2 text-xs font-black text-fuchsia-800">
                {examCoverGradeLevel}. Sınıf · {countAssetsForGrade(examCovers, examCoverGradeLevel)}/{DESIGN_COURSES.length} görsel
              </div>
            </div>
            <div className="mt-4">
              {renderGradeSelector(examCoverGradeLevel, setExamCoverGradeLevel, "fuchsia", examCovers)}
            </div>
          </div>
          {renderCourseAssets("cover", examCoverGradeLevel)}
        </section>
      )}
    </div>
  );
}


type TrialExamKind = "TYT" | "AYT" | "Özel";

type TrialExamDateRow = {
  id: string;
  gradeLevel: "9" | "10" | "11" | "12";
  date: string;
  kind: TrialExamKind;
  description: string;
};

const TRIAL_GRADE_LEVELS = ["9", "10", "11", "12"] as const;

const makeTrialDateRow = (
  gradeLevel: TrialExamDateRow["gradeLevel"],
): TrialExamDateRow => ({
  id: `trial-${gradeLevel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  gradeLevel,
  date: "",
  kind: "TYT",
  description: "",
});

function TrialExamDatesModule() {
  const [rows, setRows] = useState<TrialExamDateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const ensureStarterRows = (source: TrialExamDateRow[]) => {
    const next = [...source];
    for (const gradeLevel of TRIAL_GRADE_LEVELS) {
      const count = next.filter((item) => item.gradeLevel === gradeLevel).length;
      for (let index = count; index < 6; index += 1) {
        next.push(makeTrialDateRow(gradeLevel));
      }
    }
    return next;
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/trial-exam-dates", { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(body?.error || "Deneme sınavı tarihleri okunamadı."));
        }
        if (!active) return;
        const incoming = Array.isArray(body?.items) ? body.items : [];
        setRows(ensureStarterRows(incoming));
      } catch (error) {
        if (!active) return;
        setRows(ensureStarterRows([]));
        setMessage(
          error instanceof Error ? error.message : "Deneme sınavı tarihleri okunamadı.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const rowsForGrade = (gradeLevel: TrialExamDateRow["gradeLevel"]) =>
    rows.filter((item) => item.gradeLevel === gradeLevel);

  const updateRow = (
    id: string,
    patch: Partial<TrialExamDateRow>,
  ) => {
    setRows((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              ...(patch.kind && patch.kind !== "Özel"
                ? { description: "" }
                : {}),
            }
          : item,
      ),
    );
  };

  const addRow = (gradeLevel: TrialExamDateRow["gradeLevel"]) => {
    setRows((current) => [...current, makeTrialDateRow(gradeLevel)]);
  };

  const removeRow = (id: string, gradeLevel: TrialExamDateRow["gradeLevel"]) => {
    setRows((current) => {
      const sameGrade = current.filter((item) => item.gradeLevel === gradeLevel);
      if (sameGrade.length <= 1) return current;
      return current.filter((item) => item.id !== id);
    });
  };

  const saveAll = async () => {
    setSaving(true);
    setMessage("");
    try {
      const payload = rows
        .filter((item) => item.date)
        .map((item) => ({
          ...item,
          description:
            item.kind === "Özel" ? String(item.description || "").trim() : "",
        }));

      const response = await fetch("/api/trial-exam-dates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(body?.error || "Deneme sınavı tarihleri kaydedilemedi."));
      }

      setRows(ensureStarterRows(Array.isArray(body?.items) ? body.items : payload));
      setMessage("Deneme sınavı tarihleri kaydedildi.");
      window.setTimeout(() => setMessage(""), 2800);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Deneme sınavı tarihleri kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      if (!saving && !loading) void saveAll();
    };
    window.addEventListener("edupanel:save-trial-exam-dates", handler);
    return () => {
      window.removeEventListener("edupanel:save-trial-exam-dates", handler);
    };
  }, [rows, saving, loading]);

  const dayNameFor = (dateValue: string) => {
    if (!dateValue) return "";
    const parsed = new Date(`${dateValue}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(parsed);
  };

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const gradeCardClass: Record<TrialExamDateRow["gradeLevel"], string> = {
    "9": "border-sky-200 bg-sky-50",
    "10": "border-emerald-200 bg-emerald-50",
    "11": "border-amber-200 bg-amber-50",
    "12": "border-rose-200 bg-rose-50",
  };

  const isPast = (dateValue: string) => Boolean(dateValue && dateValue < todayKey);

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-xs font-black text-purple-800">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {TRIAL_GRADE_LEVELS.map((gradeLevel) => {
          const gradeRows = rowsForGrade(gradeLevel);
          return (
            <section
              key={gradeLevel}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-200 bg-purple-950 px-4 py-3 text-center text-white">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-200">
                  Sınıf Seviyesi
                </div>
                <h3 className="mt-1 text-lg font-black">{gradeLevel}. Sınıf</h3>
              </div>

              <div className="max-h-[70vh] space-y-1.5 overflow-y-auto p-2">
                {gradeRows.map((item, index) => {
                  const past = isPast(item.date);
                  const dayName = dayNameFor(item.date);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border px-2.5 py-2 transition ${
                        past
                          ? "border-slate-300 bg-slate-200 text-slate-500"
                          : gradeCardClass[gradeLevel]
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <strong className={`min-w-[92px] text-[11px] font-black ${
                          past ? "text-slate-500" : "text-slate-900"
                        }`}>
                          {index + 1}. Deneme · {item.kind}
                        </strong>

                        <input
                          type="date"
                          value={item.date}
                          onChange={(event) =>
                            updateRow(item.id, { date: event.target.value })
                          }
                          className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold outline-none ${
                            past
                              ? "border-slate-300 bg-slate-100 text-slate-500"
                              : "border-white/80 bg-white/90 text-slate-800"
                          }`}
                        />

                        <span className={`min-w-[58px] text-center text-[9px] font-black capitalize ${
                          past ? "text-slate-500" : "text-slate-700"
                        }`}>
                          {dayName || "—"}
                        </span>

                        <select
                          value={item.kind}
                          onChange={(event) =>
                            updateRow(item.id, {
                              kind: event.target.value as TrialExamKind,
                            })
                          }
                          className={`w-[62px] rounded-lg border px-1.5 py-1.5 text-[10px] font-black outline-none ${
                            past
                              ? "border-slate-300 bg-slate-100 text-slate-500"
                              : "border-white/80 bg-white/90 text-slate-800"
                          }`}
                        >
                          <option value="TYT">TYT</option>
                          <option value="AYT">AYT</option>
                          <option value="Özel">Özel</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => removeRow(item.id, gradeLevel)}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm ${
                            past
                              ? "bg-slate-300 text-slate-500 hover:bg-slate-400"
                              : "bg-white/90 text-rose-600 hover:bg-rose-50"
                          }`}
                          title="Bu deneme satırını kaldır"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {item.kind === "Özel" && (
                        <textarea
                          value={item.description}
                          onChange={(event) =>
                            updateRow(item.id, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Dersler, başlanacak konu ve soru sayıları..."
                          className={`mt-1.5 min-h-[52px] w-full resize-y rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold outline-none ${
                            past
                              ? "border-slate-300 bg-slate-100 text-slate-500"
                              : "border-amber-200 bg-white/90 text-slate-700"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => addRow(gradeLevel)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-purple-300 bg-purple-50 px-3 py-2.5 text-xs font-black text-purple-800 hover:bg-purple-100"
                >
                  <Plus className="h-4 w-4" />
                  Deneme Ekle
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function ExamToolsModule() {
  const [currentTab, setCurrentTab] = useState<ToolTab>("optic-form");

  const tabs = [
    { id: "optic-form", label: "Optik Form Yönetimi", icon: LayoutGrid },
    { id: "camera-reader", label: "Kamerayla Optik Oku", icon: ImageIcon },
    { id: "scoring", label: "Puanlama Sistemi", icon: PenTool },
    { id: "yok-atlas", label: "YÖK Atlas Entegrasyonu", icon: GraduationCap },
    { id: "trial-dates", label: "Deneme Sınavı Tarihleri", icon: CalendarDays },
    { id: "design", label: "Tasarım", icon: Palette },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="bg-white border-2 border-dashed border-purple-950 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="bg-purple-950 bg-theme-pattern p-1.5 rounded-2xl flex items-center overflow-x-auto gap-1 w-full flex-1 sm:w-auto scrollbar-hide h-[52px] shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as ToolTab)}
                className={`flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[11px] font-bold transition-all cursor-pointer border whitespace-nowrap h-[40px] ${
                  currentTab === tab.id
                    ? "bg-white text-purple-900 shadow-sm border-transparent"
                    : "text-purple-200 hover:text-white hover:bg-purple-900/50 border-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}

          {currentTab === "trial-dates" && (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("edupanel:save-trial-exam-dates"));
              }}
              className="ml-auto flex h-[40px] flex-none items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-emerald-600 px-4 text-[11px] font-black text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Save className="h-4 w-4" />
              Kaydet
            </button>
          )}
        </div>
      </div>

      {currentTab === "camera-reader" ? (
        <ExamCameraReader />
      ) : currentTab === "scoring" ? (
        <ScoringModule />
      ) : currentTab === "optic-form" ? (
        <SekonicOpticFormPanel />
      ) : currentTab === "trial-dates" ? (
        <TrialExamDatesModule />
      ) : currentTab === "design" ? (
        <DesignModule />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 text-purple-600">
            <Target className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            YÖK Atlas Analiz Aracı
          </h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Seçilen araca ait modül ve içerikler bu ekranda görüntülenecektir.
          </p>
        </div>
      )}
    </div>
  );
}
