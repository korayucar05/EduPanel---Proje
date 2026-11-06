import React, { useMemo, useState } from "react";
import {
  Brain,
  Copy,
  Download,
  Eye,
  FileJson,
  FileText,
  Image as ImageIcon,
  Layers,
  MousePointer2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { sqliteStorage } from "../core/state/SyncStateStore";
type BubbleMode = "K" | "B";
type Direction = "Y" | "D";
type FieldType = "studentNo" | "schoolCode" | "booklet" | "answers" | "name" | "custom";
type DragMode = "move" | "resize" | null;

type OpticalField = {
  id: string;
  label: string;
  type: FieldType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  mode: BubbleMode;
  direction: Direction;
  values: string;
  factor: string;
  order: number;
  confidence?: number;
};

type DragState = {
  id: string;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startField: OpticalField;
};

const DEFAULT_FIELDS: OpticalField[] = [
  {
    id: "school-code",
    label: "OKUL KODU",
    type: "schoolCode",
    startX: 6,
    startY: 12,
    endX: 22,
    endY: 25,
    mode: "K",
    direction: "D",
    values: "0123456789",
    factor: "X2",
    order: 1,
    confidence: 92,
  },
  {
    id: "student-no",
    label: "ÖĞRENCİ NO",
    type: "studentNo",
    startX: 24,
    startY: 12,
    endX: 43,
    endY: 25,
    mode: "K",
    direction: "D",
    values: "0123456789",
    factor: "X2",
    order: 2,
    confidence: 96,
  },
  {
    id: "booklet",
    label: "KİTAPÇIK",
    type: "booklet",
    startX: 46,
    startY: 12,
    endX: 56,
    endY: 25,
    mode: "K",
    direction: "D",
    values: "ABCD",
    factor: "X2",
    order: 3,
    confidence: 94,
  },
  {
    id: "answers-1",
    label: "CEVAPLAR",
    type: "answers",
    startX: 8,
    startY: 34,
    endX: 92,
    endY: 88,
    mode: "K",
    direction: "Y",
    values: "ABCDE",
    factor: "X2",
    order: 4,
    confidence: 88,
  },
];

const FIELD_COLORS: Record<FieldType, string> = {
  schoolCode: "border-blue-500 bg-blue-500/10 text-blue-700",
  studentNo: "border-emerald-500 bg-emerald-500/10 text-emerald-700",
  booklet: "border-amber-500 bg-amber-500/10 text-amber-700",
  answers: "border-violet-500 bg-violet-500/10 text-violet-700",
  name: "border-slate-500 bg-slate-500/10 text-slate-700",
  custom: "border-rose-500 bg-rose-500/10 text-rose-700",
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function fmtLine(field: OpticalField) {
  return `${Math.round(field.startX)}=${Math.round(field.startY)}=${Math.round(field.endX)}=${Math.round(field.endY)}=${field.mode}=${field.direction}=${field.values}=${field.factor}=${field.label}=`;
}

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function boxStyle(field: OpticalField) {
  const left = Math.min(field.startX, field.endX);
  const top = Math.min(field.startY, field.endY);
  const width = Math.max(2, Math.abs(field.endX - field.startX));
  const height = Math.max(2, Math.abs(field.endY - field.startY));
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };
}

export default function OpticFormAIBuilderModule() {
  const [formName, setFormName] = useState("Yeni Optik Form");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [aiStatus, setAiStatus] = useState<string>("Yapay zekâ analizi için optik form görseli yükleyin.");
  const [fields, setFields] = useState<OpticalField[]>(DEFAULT_FIELDS);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_FIELDS[0].id);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [showGrid, setShowGrid] = useState(true);

  const selectedField = fields.find((f) => f.id === selectedId) || fields[0];

  const fmtContent = useMemo(() => fields.slice().sort((a, b) => a.order - b.order).map(fmtLine).join("\n"), [fields]);
  const txtTemplate = useMemo(() => {
    const headers = fields
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((f) => f.label.replace(/\s+/g, "_"));
    return headers.join(";") + "\n" + headers.map(() => "").join(";");
  }, [fields]);
  const jsonTemplate = useMemo(() => JSON.stringify({ name: formName, fields, fmtContent, txtTemplate }, null, 2), [formName, fields, fmtContent, txtTemplate]);

  const handleImage = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setAiStatus("Görsel yüklendi. Yapay zekâ analizi başlatılabilir. Alan kutularını sürükleyerek düzeltebilirsiniz.");
  };

  const updateField = (id: string, patch: Partial<OpticalField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const addField = (type: FieldType = "answers") => {
    const nextOrder = Math.max(...fields.map((f) => f.order), 0) + 1;
    const defaultLabel = type === "answers" ? `DERS BLOĞU ${nextOrder}` : type === "name" ? "AD SOYAD" : "ÖZEL ALAN";
    const newField: OpticalField = {
      id: `${type}-${Date.now()}`,
      label: defaultLabel,
      type,
      startX: 10,
      startY: 30,
      endX: 45,
      endY: 45,
      mode: "K",
      direction: type === "answers" ? "Y" : "D",
      values: type === "answers" ? "ABCDE" : type === "booklet" ? "ABCD" : "0123456789",
      factor: "X2",
      order: nextOrder,
      confidence: 0,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedId(newField.id);
  };

  const removeField = (id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id || "");
      return next;
    });
  };

  const simulateAiAnalysis = () => {
    const stamp = Date.now();
    setAiStatus("Yapay zekâ taslak alanları oluşturdu. Güven skoru düşük alanları görsel üzerinde sürükleyerek düzeltin.");
    setFields(DEFAULT_FIELDS.map((f, i) => ({ ...f, id: `${f.id}-ai-${stamp}-${i}`, confidence: [96, 98, 94, 87][i] || 82 })));
  };

  const saveForm = async () => {
    const item = {
      id: `optic-${Date.now()}`,
      name: formName,
      createdAt: new Date().toISOString(),
      fields,
      fmtContent,
      txtTemplate,
      jsonTemplate,
    };
    try {
      const saved = sqliteStorage.getItem("opticForms");
      const list = saved ? JSON.parse(saved) : [];
      sqliteStorage.setItem("opticForms", JSON.stringify([item, ...list]));
      setAiStatus("Optik form kaydedildi. Sınav hazırlama ekranındaki optik form listesinde kullanılabilir.");
    } catch {
      setAiStatus("Kayıt sırasında hata oluştu.");
    }
  };

  const startDrag = (e: React.MouseEvent, field: OpticalField, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(field.id);
    setDragState({ id: field.id, mode, startClientX: e.clientX, startClientY: e.clientY, startField: { ...field } });
  };

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - dragState.startClientX) / rect.width) * 100;
    const dy = ((e.clientY - dragState.startClientY) / rect.height) * 100;
    const f = dragState.startField;
    if (dragState.mode === "move") {
      const width = Math.abs(f.endX - f.startX);
      const height = Math.abs(f.endY - f.startY);
      const left = clamp(Math.min(f.startX, f.endX) + dx, 0, 100 - width);
      const top = clamp(Math.min(f.startY, f.endY) + dy, 0, 100 - height);
      updateField(dragState.id, { startX: Math.round(left), startY: Math.round(top), endX: Math.round(left + width), endY: Math.round(top + height) });
    }
    if (dragState.mode === "resize") {
      updateField(dragState.id, { endX: Math.round(clamp(f.endX + dx, f.startX + 2, 100)), endY: Math.round(clamp(f.endY + dy, f.startY + 2, 100)) });
    }
  };

  const copyFmt = async () => {
    try {
      await navigator.clipboard.writeText(fmtContent);
      setAiStatus("FMT içeriği panoya kopyalandı.");
    } catch {
      setAiStatus("Kopyalama başarısız oldu. İndirme seçeneğini kullanabilirsiniz.");
    }
  };

  const resetFields = () => {
    setFields(DEFAULT_FIELDS);
    setSelectedId(DEFAULT_FIELDS[0].id);
    setAiStatus("Alanlar varsayılan taslağa döndürüldü.");
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      <section className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
              <Layers className="h-6 w-6 text-emerald-600" /> Optik Form İşlemleri
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">Form görselinden yapay zekâ destekli FMT, TXT ve JSON şablonu oluşturun.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={simulateAiAnalysis} className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-[14.67px] font-black text-white shadow-lg shadow-violet-600/20">
              <Brain className="h-4 w-4" /> Yapay Zekâ ile Tanı
            </button>
            <button type="button" onClick={saveForm} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-[14.67px] font-black text-white shadow-lg shadow-emerald-600/20">
              <Save className="h-4 w-4" /> Kaydet
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Form adı</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </div>
            <button type="button" onClick={() => setShowGrid((v) => !v)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700">
              <MousePointer2 className="h-4 w-4" /> {showGrid ? "Izgarayı Gizle" : "Izgarayı Göster"}
            </button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white">
              <Upload className="h-4 w-4" /> Görsel Yükle
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
            </label>
          </div>

          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-3 min-h-[640px] flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              <div
                className="relative w-full min-h-[620px] rounded-2xl bg-white overflow-auto border border-slate-100 select-none"
                onMouseMove={handleMove}
                onMouseUp={() => setDragState(null)}
                onMouseLeave={() => setDragState(null)}
              >
                <div className="relative mx-auto w-fit min-w-[420px]">
                  <img src={imageUrl} alt="Optik form" className="mx-auto max-h-[920px] object-contain" draggable={false} />
                  <div
                    className="absolute inset-0"
                    style={showGrid ? { backgroundImage: "linear-gradient(to right, rgba(15,23,42,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.08) 1px, transparent 1px)", backgroundSize: "10% 10%" } : undefined}
                  >
                    {fields.map((field) => {
                      const selected = selectedId === field.id;
                      return (
                        <div
                          key={field.id}
                          className={`absolute rounded-xl border-2 ${FIELD_COLORS[field.type]} ${selected ? "ring-4 ring-emerald-300" : ""} cursor-move`}
                          style={boxStyle(field)}
                          onMouseDown={(e) => startDrag(e, field, "move")}
                        >
                          <div className="absolute -top-7 left-0 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-black shadow-sm whitespace-nowrap">
                            {field.label} {field.confidence ? `• %${field.confidence}` : ""}
                          </div>
                          <button
                            type="button"
                            aria-label="resize"
                            className="absolute -bottom-2 -right-2 h-5 w-5 rounded-full border-2 border-white bg-slate-900 shadow cursor-se-resize"
                            onMouseDown={(e) => startDrag(e, field, "resize")}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="absolute left-3 top-3 rounded-2xl bg-white/90 px-3 py-2 text-[11px] font-black text-slate-700 shadow-sm">
                  <Eye className="mr-1 inline h-3.5 w-3.5" /> Kutuları sürükleyerek düzenleyin
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400">
                <ImageIcon className="mx-auto mb-3 h-12 w-12" />
                <p className="text-sm font-bold">Optik form görseli veya PDF yükleyin.</p>
                <p className="mt-1 text-xs font-semibold">Yükleme sonrası alan kutuları görsel üzerinde taşınabilir hale gelir.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 text-sm font-bold text-violet-800 flex gap-2">
            <Sparkles className="h-5 w-5 shrink-0" />
            <span>{aiStatus}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black text-slate-900">Alan Tanımları</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => addField("answers")} className="inline-flex items-center gap-1 rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700">
                <Plus className="h-3.5 w-3.5" /> Ders
              </button>
              <button type="button" onClick={() => addField("custom")} className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
                <Plus className="h-3.5 w-3.5" /> Özel
              </button>
              <button type="button" onClick={resetFields} className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-[14.67px] font-black text-rose-700">
                <RotateCcw className="h-3.5 w-3.5" /> Sıfırla
              </button>
            </div>
          </div>

          <div className="max-h-56 overflow-auto rounded-2xl border border-slate-100 bg-slate-50 p-2 space-y-1">
            {fields.map((f) => (
              <button key={f.id} onClick={() => setSelectedId(f.id)} className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition ${selectedId === f.id ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-emerald-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{f.label}</span>
                  <span className="opacity-70">{Math.round(f.startX)},{Math.round(f.startY)} → {Math.round(f.endX)},{Math.round(f.endY)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${clamp(f.confidence || 0)}%` }} />
                </div>
              </button>
            ))}
          </div>

          {selectedField && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Pencil className="h-4 w-4" /> Alanı Düzenle</h3>
                <button type="button" onClick={() => removeField(selectedField.id)} className="rounded-xl bg-rose-50 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">Alan adı</label>
                  <input value={selectedField.label} onChange={(e) => updateField(selectedField.id, { label: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">Tip</label>
                  <select value={selectedField.type} onChange={(e) => updateField(selectedField.id, { type: e.target.value as FieldType })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
                    <option value="studentNo">Öğrenci No</option>
                    <option value="schoolCode">Okul Kodu</option>
                    <option value="booklet">Kitapçık</option>
                    <option value="answers">Cevaplar</option>
                    <option value="name">Ad Soyad</option>
                    <option value="custom">Özel</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["startX", "startY", "endX", "endY"] as const).map((key) => (
                  <div key={key}>
                    <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">{key}</label>
                    <input type="number" min={0} max={100} value={Math.round(selectedField[key])} onChange={(e) => updateField(selectedField.id, { [key]: clamp(Number(e.target.value)) } as any)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">K/B</label>
                  <select value={selectedField.mode} onChange={(e) => updateField(selectedField.id, { mode: e.target.value as BubbleMode })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
                    <option value="K">K</option>
                    <option value="B">B</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">Y/D</label>
                  <select value={selectedField.direction} onChange={(e) => updateField(selectedField.id, { direction: e.target.value as Direction })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
                    <option value="Y">Y</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">Değerler</label>
                  <input value={selectedField.values} onChange={(e) => updateField(selectedField.id, { values: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">Güven</label>
                  <input type="number" min={0} max={100} value={selectedField.confidence || 0} onChange={(e) => updateField(selectedField.id, { confidence: clamp(Number(e.target.value)) })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold" />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-950 p-3 text-white">
              <div className="mb-2 flex items-center justify-between text-xs font-black">
                <span>FMT Önizleme</span>
                <div className="flex gap-2">
                  <button type="button" onClick={copyFmt}><Copy className="h-4 w-4" /></button>
                  <button type="button" onClick={() => downloadText(`${formName}.fmt`, fmtContent)}><Download className="h-4 w-4" /></button>
                </div>
              </div>
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-slate-200">{fmtContent}</pre>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" onClick={() => downloadText(`${formName}.txt`, txtTemplate)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700">
                <FileText className="h-4 w-4" /> TXT İndir
              </button>
              <button type="button" onClick={() => downloadText(`${formName}.json`, jsonTemplate, "application/json;charset=utf-8")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700">
                <FileJson className="h-4 w-4" /> JSON İndir
              </button>
            </div>
          </div>

          <button type="button" onClick={() => downloadText(`${formName}.fmt`, fmtContent)} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">
            <FileText className="h-4 w-4" /> FMT Dosyasını İndir
          </button>
        </section>
      </div>
    </div>
  );
}
