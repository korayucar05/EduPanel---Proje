import React, { useState } from "react";
import {
  FileText,
  Plus,
  X,
  Code,
  MapPin,
  AlignLeft,
  Hash,
  Settings,
  Info,
  Save,
  CheckCircle2,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { sqliteStorage } from "../core/state/SyncStateStore";
export default function OpticFormModule() {
  const [opticForms, setOpticForms] = useState<any[]>(() => {
    const saved = sqliteStorage.getItem("opticForms");
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      {
        id: "1",
        name: "Standart 120 Soru TYT",
        format: "TYT",
        parsedData: {
          formSpecs: "61 Sütun x 48 Satır (16 Referans Noktası)",
          studentInfo: [
            {
              name: "Adı Soyadı",
              details: "29 Karakter (ABCÇDEFG...)",
              type: "text",
            },
            {
              name: "Öğrenci Numarası",
              details: "10 Sütun, Rakam (0-9)",
              type: "number",
            },
            {
              name: "T.C. Kimlik / Cep Tel",
              details: "10 Haneli Rakam (0-9)",
              type: "number",
            },
            {
              name: "Kitapçık Türü",
              details: "Seçenekli (A, B)",
              type: "booklet",
            },
            { name: "Okul Kodu", details: "10 Haneli Rakam", type: "number" },
          ],
          tests: [
            { name: "Türkçe", format: "A B C D E", type: "TÜRKÇE" },
            { name: "Sosyal Bilimler", format: "A B C D E", type: "SOSYAL" },
            { name: "Matematik", format: "A B C D E", type: "MATEMATİK" },
            { name: "Fen Bilimleri", format: "A B C D E", type: "FEN" },
          ],
        },
      },
    ];
  });

  React.useEffect(() => {
    sqliteStorage.setItem("opticForms", JSON.stringify(opticForms));
  }, [opticForms]);

  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [modalActiveTab, setModalActiveTab] = useState<"fmt" | "txt_coords">("fmt");
  const [coordsState, setCoordsState] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState("");

  React.useEffect(() => {
    if (selectedForm) {
      const defaultC = {
        schoolCode: { start: 1, length: 5 },
        studentNo: { start: 6, length: 11 },
        grade: { start: 17, length: 2 },
        section: { start: 19, length: 1 },
        fullName: { start: 20, length: 30 },
        booklet: { start: 50, length: 1 },
        turkce: { start: 51, length: 40 },
        sosyal: { start: 91, length: 40 },
        matematik: { start: 131, length: 40 },
        fen: { start: 171, length: 40 }
      };
      setCoordsState(selectedForm.txtCoords || defaultC);
      setModalActiveTab("fmt");
    } else {
      setCoordsState(null);
    }
  }, [selectedForm]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  // Add Format Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormFormat, setNewFormFormat] = useState("TYT");
  const [fmtContent, setFmtContent] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  
  const [formToDelete, setFormToDelete] = useState<any>(null);

  const getIconForType = (type: string) => {
    switch (type) {
      case "text":
        return <AlignLeft className="w-4 h-4 text-blue-500" />;
      case "number":
        return <Hash className="w-4 h-4 text-emerald-500" />;
      case "booklet":
        return <Settings className="w-4 h-4 text-orange-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleFmtFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setFmtContent(content);
    };
    reader.readAsText(file, "windows-1254");
    e.target.value = ""; // Reset input
  };

  const handleParseFmt = () => {
    if (!fmtContent.trim()) return;

    const lines = fmtContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);
    if (lines.length === 0) return;

    let specs = "Bilinmeyen Format Bilgisi";
    const studentInfo: any[] = [];
    const tests: any[] = [];

    // First line is params
    const firstLineParams = lines[0].split("=");
    if (firstLineParams.length >= 4) {
      specs = `${firstLineParams[0]} Sütun x ${firstLineParams[1]} Satır (${firstLineParams[3]} Referans Noktası)`;
    }

    let testCounter = 1;

    lines.slice(1).forEach((line) => {
      let colInfo = "";
      let parsedName = "";
      let charSet = "";

      const parts = line.split("=");
      
      if (parts.length >= 4) {
        const startRow = parseInt(parts[0], 10);
        const endRow = parseInt(parts[1], 10);
        const startCol = parseInt(parts[2], 10);
        const endCol = parseInt(parts[3], 10);
        
        if (!isNaN(startRow) && !isNaN(endRow) && !isNaN(startCol) && !isNaN(endCol)) {
          const rowCount = Math.abs(endRow - startRow) + 1;
          const colCount = Math.abs(endCol - startCol) + 1;
          // It needs to be comma separated for the split(',', 2) logic
          const lengthIndicator = colCount; 
          colInfo = `Satır: ${Math.min(startRow, endRow)}-${Math.max(startRow, endRow)},Sütun: ${Math.min(startCol, endCol)}-${Math.max(startCol, endCol)} (${lengthIndicator} Hane)`;
        }
      }

      for (let i = parts.length - 1; i >= 0; i--) {
         const p = parts[i].trim();
         if (p && !p.match(/^[XDK0-9]+$/)) { // avoid format chars and numbers
            if (p.includes("ABC") || p.includes("0123") || p.includes("Y=A")) {
               charSet = p;
            } else if (!parsedName && p.length > 2) {
               // Assuming name is something long enough
               parsedName = p;
            }
         } else if (p.match(/^[0-9]+$/) && !charSet) {
             // could be just digits
             if (p.length > 5 && p.includes("0123456789")) charSet = p;
         }
      }

      // Check original string for char sets as fallback
      if (
        charSet.includes("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ") ||
        charSet.includes("ABCDEFGHIJKLMNOPRSTUVYZ") ||
        line.includes("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ") ||
        line.includes("ABCDEFGHIJKLMNOPRSTUVYZ")
      ) {
        studentInfo.push({
          name: parsedName || "Adı Soyadı",
          details: "Harf Matrisi",
          type: "text",
          colInfo,
        });
      } else if (charSet.includes("0123456789") || line.includes("0123456789")) {
        studentInfo.push({
          name: parsedName || "Numara / Kod Alanı",
          details: "Rakam (0-9)",
          type: "number",
          colInfo,
        });
      } else if (charSet.includes("Y=A B") || line.includes("Y=A B")) {
        if (!studentInfo.find((s) => s.type === "booklet")) {
          studentInfo.push({
            name: parsedName || "Kitapçık Türü",
            details: "A B seçenekli",
            type: "booklet",
            colInfo,
          });
        }
      } else if ((charSet.includes("ABCDE") || line.includes("ABCDE")) && !line.includes("ABCÇDEFG")) {
        tests.push({
          name: parsedName || `Test Bölümü ${testCounter}`,
          format: "A B C D E",
          type: "TEST",
          colInfo,
        });
        testCounter++;
      } else if (parsedName) {
        // Fallback for Custom Fields
        studentInfo.push({
          name: parsedName,
          details: charSet || "Özel Alan",
          type: "text",
          colInfo,
        });
      }
    });

    setParsedPreview({ formSpecs: specs, studentInfo, tests });
  };

  const handleSaveForm = () => {
    if (!newFormName || !parsedPreview) return;

    const newForm = {
      id: Date.now().toString(),
      name: newFormName,
      format: newFormFormat,
      parsedData: parsedPreview,
    };

    setOpticForms([...opticForms, newForm]);
    setIsAddModalOpen(false);
    setNewFormName("");
    setFmtContent("");
    setParsedPreview(null);
  };

  const handleSaveTxtCoords = () => {
    if (!selectedForm || !coordsState) return;
    const updated = opticForms.map(f => {
      if (f.id === selectedForm.id) {
        return {
          ...f,
          txtCoords: coordsState
        };
      }
      return f;
    });
    setOpticForms(updated);
    sqliteStorage.setItem("opticForms", JSON.stringify(updated));
    setSelectedForm({
      ...selectedForm,
      txtCoords: coordsState
    });
    showToast("TXT sütun koordinat ayarları başarıyla kaydedildi.");
  };

  const renderCoordinateInput = (label: string, fieldKey: string) => {
    if (!coordsState || !coordsState[fieldKey]) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 hover:border-indigo-200 transition-colors">
        <div className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
            {coordsState[fieldKey].start}-{coordsState[fieldKey].start + coordsState[fieldKey].length - 1}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Başlangıç Sütunu</label>
            <input
              type="number"
              min="1"
              value={coordsState[fieldKey].start || ""}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                setCoordsState({
                  ...coordsState,
                  [fieldKey]: { ...coordsState[fieldKey], start: val }
                });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-550"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Sütun Sayısı / Uzunluk</label>
            <input
              type="number"
              min="1"
              value={coordsState[fieldKey].length || ""}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                setCoordsState({
                  ...coordsState,
                  [fieldKey]: { ...coordsState[fieldKey], length: val }
                });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-550"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="text-left w-full animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[200] bg-emerald-650 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4" />
          {toastMessage}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pt-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Optik Form Yönetimi
          </h2>
          <p className="text-sm text-slate-500">
            Sisteme tanımlı optik formlar ve .fmt koordinat kalibrasyonları
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="add-optic-form-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="hidden"
          >
            Yeni Optik Şablon (.fmt) Yükle
          </button>
        </div>
      </div>

      {/* Her bir optik form için butonlar/kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {opticForms.map((form) => (
          <div key={form.id} className="relative group">
            <button
              onClick={() => setSelectedForm(form)}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:shadow-md hover:border-purple-200 transition-all cursor-pointer text-left w-full h-full"
            >
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-center w-full flex-1 flex flex-col justify-end">
                <h3 className="font-bold text-slate-800 text-sm">{form.name}</h3>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-1">
                  {form.format} FORMATI - İncele
                </p>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFormToDelete(form);
              }}
              className="absolute top-2 right-2 p-2 bg-red-50 text-red-500 rounded-lg opacity-0 lg:group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 focus:opacity-100 sm:opacity-100"
              title="Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Form Detay Modal */}
      {selectedForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg">
                    {selectedForm.name} Parametreleri
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                      {selectedForm.format}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{" "}
                      {selectedForm.parsedData.formSpecs}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedForm(null)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-6">
              <button
                onClick={() => setModalActiveTab("fmt")}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 text-xs font-black transition-all cursor-pointer ${
                  modalActiveTab === "fmt"
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Code className="w-4 h-4" />
                Optik Şablon Formülü (.fmt)
              </button>
              <button
                onClick={() => setModalActiveTab("txt_coords")}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 text-xs font-black transition-all cursor-pointer ${
                  modalActiveTab === "txt_coords"
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <AlignLeft className="w-4 h-4" />
                TXT Sütun Koordinat Ayarları (Oku-Düzenle)
              </button>
            </div>

            {/* Dynamic Modal Content */}
            {modalActiveTab === "txt_coords" ? (
              <div className="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-xs flex gap-3">
                  <Info className="w-5 h-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold mb-1">Bilgilendirme</p>
                    <p>
                      Öğrenci optik değerlendirme TXT dosyasını yüklediğinizde, sistem her bir satırı aşağıda belirttiğiniz sütun aralıklarına göre okuyacaktır.
                      Sütun koordinatları 1-den başlamalıdır (1-tabanlı dizindir). Harici yazılımlar genellikle 1-tabanlı gösterim kullanır.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderCoordinateInput("Okul Kodu", "schoolCode")}
                  {renderCoordinateInput("Öğrenci Numarası", "studentNo")}
                  {renderCoordinateInput("Sınıf Düzeyi", "grade")}
                  {renderCoordinateInput("Şubesi", "section")}
                  {renderCoordinateInput("Adı Soyadı", "fullName")}
                  {renderCoordinateInput("Kitapçık Bilgisi", "booklet")}
                  {renderCoordinateInput("Türkçe Testi", "turkce")}
                  {renderCoordinateInput("Sosyal Bilimler Testi", "sosyal")}
                  {renderCoordinateInput("Matematik Testi", "matematik")}
                  {renderCoordinateInput("Fen Bilimleri Testi", "fen")}
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <button
                    onClick={handleSaveTxtCoords}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Sütun Ayarlarını Kaydet
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 overflow-y-auto bg-slate-50 flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sol Sütun: Öğrenci Bilgileri */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Code className="w-4 h-4 text-purple-600" />
                    Öğrenci Bilgi Alanları Formülü
                  </h4>
                  <div className="space-y-3">
                    {selectedForm.parsedData.studentInfo.map(
                      (info: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm hover:border-purple-200 transition-colors"
                        >
                          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                            {getIconForType(info.type)}
                          </div>
                          <div className="w-full flex justify-between items-center">
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {info.name}
                              </p>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {info.details}
                              </p>
                            </div>
                            {info.colInfo && (
                              <div className="text-[10px] text-right font-bold text-purple-700 bg-purple-50 px-2 py-1.5 rounded-lg border border-purple-100 flex flex-col">
                                <span>{info.colInfo.split(',')[0]},</span>
                                <span className="text-purple-500">{info.colInfo.split(',')[1]}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* Sağ Sütun: Test Alanları */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
                    <AlignLeft className="w-4 h-4 text-emerald-600" />
                    Okunacak Test Blokları
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedForm.parsedData.tests.map(
                      (test: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                          <div className="flex justify-between items-center pl-2 w-full">
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {test.name}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-mono bg-slate-50 inline-block px-1.5 py-0.5 rounded">
                                Şıklar: {test.format}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              {test.colInfo && (
                                <div className="text-[10px] text-right font-bold text-purple-700 bg-purple-50 px-2 py-1.5 rounded-lg border border-purple-100 flex flex-col">
                                  <span>{test.colInfo.split(',')[0]},</span>
                                  <span className="text-purple-500">{test.colInfo.split(',')[1]}</span>
                                </div>
                              )}
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md">
                                {test.type}
                              </span>
                            </div>
                          </div>
                        </div>
                      ),
                    )}

                    {/* Bilgi Kutusu */}
                    <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-xs">
                      <Info className="w-5 h-5 flex-shrink-0 text-blue-600" />
                      <div>
                        <p className="font-bold mb-1">.fmt Çözümleme Bilgisi</p>
                        <li className="list-disc ml-3">
                          Boşluk alanları okunmadan atlanır.
                        </li>
                        <li className="list-disc ml-3">
                          Yatay sütun ve satırlar referans noktalarına göre
                          taranır.
                        </li>
                        <li className="list-disc ml-3">
                          Hatalı veya çift işaretlemeler algılandığında sistem log
                          kaydı oluşturur.
                        </li>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-white flex justify-end">
              <button
                onClick={() => setSelectedForm(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yeni Form Ekle Modalı */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg">
                  Yeni .fmt Şablonu Oluştur
                </h3>
                <p className="text-sm text-slate-500">
                  Optik okuyucudan alınan .fmt koordinat dosyasının içeriğini
                  yapıştırın.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setParsedPreview(null);
                  setFmtContent("");
                }}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Form Adı
                  </label>
                  <input
                    type="text"
                    value={newFormName}
                    onChange={(e) => setNewFormName(e.target.value)}
                    placeholder="Örn: 120 Soru TYT Optiği"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none text-sm font-medium text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Sınav Tipi
                  </label>
                  <select
                    value={newFormFormat}
                    onChange={(e) => setNewFormFormat(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    <option value="TYT">TYT</option>
                    <option value="AYT">AYT</option>
                    <option value="LGS">LGS</option>
                    <option value="DİĞER">DİĞER</option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      .FMT İçeriği:
                    </label>
                    <label className="cursor-pointer flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors">
                      <UploadCloud className="w-3.5 h-3.5" />
                      Dosyadan İçe Aktar
                      <input
                        type="file"
                        accept=".fmt,.txt"
                        className="hidden"
                        onChange={handleFmtFileUpload}
                      />
                    </label>
                  </div>
                  <textarea
                    value={fmtContent}
                    onChange={(e) => setFmtContent(e.target.value)}
                    placeholder="Örn:&#10;K=M=48=62=&#10;01=10=11=15=K=D=0123456789=X2=ÖĞRENCİ NO=&#10;01=30=20=24=K=D=ABCDE=X5=MATEMATIK=&#10;..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none text-sm font-mono text-slate-700 h-64 resize-none"
                  ></textarea>
                </div>
                <button
                  onClick={handleParseFmt}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Çözümle (Parse)
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 overflow-y-auto">
                {parsedPreview ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                      Çözümleme Başarılı
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Boyutlar
                      </h4>
                      <p className="text-sm font-bold text-slate-800 bg-white p-3 rounded-lg border border-slate-100">
                        {parsedPreview.formSpecs}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Alanlar: {parsedPreview.studentInfo.length}
                      </h4>
                      <div className="space-y-2">
                        {parsedPreview.studentInfo.map(
                          (info: any, idx: number) => (
                            <div
                              key={idx}
                              className="text-xs font-bold text-slate-700 bg-white p-2 rounded border border-slate-100 flex justify-between items-center"
                            >
                              <div className="flex flex-col gap-1">
                                <span>{info.name}</span>
                                <span className="text-slate-400">
                                  {info.details}
                                </span>
                              </div>
                              {info.colInfo && (
                                <div className="text-[9px] text-right text-purple-700 bg-purple-50 px-1.5 py-1 rounded border border-purple-100 flex flex-col font-medium">
                                  <span>{info.colInfo.split(',')[0]},</span>
                                  <span className="text-purple-500">{info.colInfo.split(',')[1]}</span>
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Testler: {parsedPreview.tests.length}
                      </h4>
                      <div className="space-y-2">
                        {parsedPreview.tests.map((t: any, idx: number) => (
                          <div
                            key={idx}
                            className="text-xs font-bold text-slate-700 bg-white p-2 rounded border border-slate-100 flex justify-between items-center"
                          >
                            <div className="flex flex-col gap-1">
                              <span>{t.name}</span>
                              <span className="text-slate-400">{t.format}</span>
                            </div>
                            {t.colInfo && (
                              <div className="text-[9px] text-right text-purple-700 bg-purple-50 px-1.5 py-1 rounded border border-purple-100 flex flex-col font-medium">
                                <span>{t.colInfo.split(',')[0]},</span>
                                <span className="text-purple-500">{t.colInfo.split(',')[1]}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                    <Code className="w-12 h-12 mb-3 text-slate-300" />
                    <p className="text-sm font-medium max-w-xs">
                      .fmt dosyasının içeriğini yapıştırıp <b>Çözümle</b>{" "}
                      butonuna tıklayarak sonuçları görebilirsiniz.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 rounded-b-3xl">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setParsedPreview(null);
                  setFmtContent("");
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSaveForm}
                disabled={!parsedPreview || !newFormName}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {formToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold justify-center text-slate-800 text-xl mb-2">
              Silmek İstediğinize Emin Misiniz?
            </h3>
            <p className="text-slate-500 font-medium text-sm mb-8">
              "{formToDelete.name}" optik form şablonu kalıcı olarak silinecektir.
            </p>
            <div className="flex w-full gap-3">
              <button
                onClick={() => setFormToDelete(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  setOpticForms((prev: any) => prev.filter((f: any) => f.id !== formToDelete.id));
                  setFormToDelete(null);
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm shadow-red-200 cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
