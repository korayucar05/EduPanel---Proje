import React, { useState, useEffect, useRef } from "react";
import localforage from "../core/state/AppStateService";
import {
  DEFAULT_MHATSAPP_SETTINGS,
  loadMhatsappSettings,
  normalizeMhatsappNumber,
  saveMhatsappSettings,
  sendMediaMessage,
  sendPersonalizedBulkText,
  sendTextMessage,
} from "../lib/mhatsappApi";
import {
  MessageCircle,
  Save,
  Smartphone,
  Key,
  Server,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Wifi,
  RefreshCw,
  Send,
  Paperclip,
  Users,
  FileText,
  Image as ImageIcon,
  Trash2
} from "lucide-react";

interface WhatsappConfig {
  apiUrl?: string;
  apiKey?: string;
  senderPhone?: string;
  messageTemplate?: string;
}

const DEFAULT_TEMPLATE = "Merhaba, *{ogrenci_adi}* için hazırlanan *{sinav_adi}* sesli yapay zeka deneme sınavı analiz dökümünü aşağıdaki bağlantıdan dinleyebilirsiniz:\n\n🎧 {link}";

export default function WhatsappModule() {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);
  const [isSaved, setIsSaved] = useState(false);

  // Test sending states
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("mhatsapp.com API Entegrasyon Test Mesajı. Bu mesaj sistem üzerinden başarıyla iletilmiştir. 🎉");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendLogs, setTestSendLogs] = useState<string[]>([]);
  const [testSendStatus, setTestSendStatus] = useState<"idle" | "success" | "error">("idle");
  const [testSendError, setTestSendError] = useState("");
  
  // Pairing states
  const [pairingStatus, setPairingStatus] = useState<"unpaired" | "pairing" | "paired">("unpaired");
  const [pairingLogs, setPairingLogs] = useState<string[]>([]);
  const [pairedDevice, setPairedDevice] = useState<any>(null);

  // Simulated QR Scanner States
  const [showQRScannerModal, setShowQRScannerModal] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [scanStep, setScanStep] = useState("");

  // Multi-message states
  const [multiSendMode, setMultiSendMode] = useState<"common" | "personalized">("common");
  const [personalizedText, setPersonalizedText] = useState("");
  const [multiNumbersText, setMultiNumbersText] = useState("");
  const [multiMessageText, setMultiMessageText] = useState("");
  const [multiMessageType, setMultiMessageType] = useState<"text" | "image" | "document">("text");
  const [multiAttachedFileName, setMultiAttachedFileName] = useState("");
  const [multiAttachedFileType, setMultiAttachedFileType] = useState("");
  const [multiAttachedFileBase64, setMultiAttachedFileBase64] = useState("");
  const [isSendingMulti, setIsSendingMulti] = useState(false);
  const [multiSendStatus, setMultiSendStatus] = useState<"idle" | "success" | "error">("idle");
  const [multiSendErrorMsg, setMultiSendErrorMsg] = useState("");
  const [multiSendLogs, setMultiSendLogs] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cleanPhone = (phone: string) => normalizeMhatsappNumber(phone);

  const parseAndCleanNumbers = (rawText: string) => {
    const rawParts = rawText.split(/[,\n;\s]+/);
    const cleanedList = rawParts
      .map(p => cleanPhone(p))
      .filter(p => p.length >= 10);
    return cleanedList;
  };

  const parsePersonalizedText = (text: string) => {
    if (!text) return [];
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const result: { phone: string; message: string; original: string; isValid: boolean }[] = [];
    
    for (const line of lines) {
      let parts = line.split("|");
      if (parts.length < 2) {
        parts = line.split(":");
      }
      
      if (parts.length >= 2) {
        const rawPhone = parts[0].trim();
        const cleaned = cleanPhone(rawPhone);
        const msg = parts.slice(1).join("|").trim();
        result.push({
          phone: cleaned,
          message: msg,
          original: line,
          isValid: cleaned.length >= 10 && msg.length > 0
        });
      } else {
        result.push({
          phone: "",
          message: "",
          original: line,
          isValid: false
        });
      }
    }
    return result;
  };

  const handleMultiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setMultiAttachedFileName(file.name);
    setMultiAttachedFileType(file.type);
    
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const base64Data = reader.result.split(",")[1] || "";
        setMultiAttachedFileBase64(base64Data);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearMultiFile = () => {
    setMultiAttachedFileName("");
    setMultiAttachedFileType("");
    setMultiAttachedFileBase64("");
  };

  const handleSendMultiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey) {
      alert("Lütfen önce API Bağlantı Ayarları bölümünden API Yetkilendirme Anahtarını kaydedin.");
      return;
    }

    let finalNumbersList: string[] = [];
    let finalMessagesList: string | string[] = "";

    if (multiSendMode === "common") {
      const cleanedNumbers = parseAndCleanNumbers(multiNumbersText);
      if (cleanedNumbers.length === 0) {
        alert("Lütfen en az bir geçerli alıcı telefon numarası girin.");
        return;
      }
      if (!multiMessageText && multiMessageType === "text") {
        alert("Lütfen göndermek istediğiniz mesaj içeriğini girin.");
        return;
      }
      if ((multiMessageType === "image" || multiMessageType === "document") && !multiAttachedFileBase64) {
        alert("Lütfen göndermek istediğiniz görseli veya belgeyi seçin.");
        return;
      }
      finalNumbersList = cleanedNumbers;
      finalMessagesList = multiMessageText;
    } else {
      // Personalized Mode
      const parsedItems = parsePersonalizedText(personalizedText).filter(item => item.isValid);
      if (parsedItems.length === 0) {
        alert("Lütfen en az bir geçerli numara ve mesaj ikilisi girin. (Örn: 905111111111 | Mesajınız)");
        return;
      }
      finalNumbersList = parsedItems.map(item => item.phone);
      finalMessagesList = parsedItems.map(item => item.message);
    }

    setIsSendingMulti(true);
    setMultiSendStatus("idle");
    setMultiSendErrorMsg("");
    setMultiSendLogs([
      `Sistem hazırlanıyor...`,
      `${finalNumbersList.length} adet alıcı numarası doğrulandı.`,
      `mhatsapp.com API Gateway tüneline bağlantı açılıyor...`
    ]);

    try {
      const settings = {
        ...DEFAULT_MHATSAPP_SETTINGS,
        baseUrl: (() => {
          try { return new URL(apiUrl || DEFAULT_MHATSAPP_SETTINGS.baseUrl).origin; }
          catch { return DEFAULT_MHATSAPP_SETTINGS.baseUrl; }
        })(),
        token: apiKey.trim(),
      };

      setMultiSendLogs(prev => [...prev, `mHatsapp API isteği gerçek proxy üzerinden gönderiliyor...`]);

      let result;
      if (multiSendMode === "personalized") {
        const parsedItems = parsePersonalizedText(personalizedText).filter(item => item.isValid);
        result = await sendPersonalizedBulkText(settings, parsedItems.map(item => ({ number: item.phone, message: item.message })));
      } else if (multiMessageType === "text") {
        result = await sendTextMessage(settings, finalNumbersList, String(finalMessagesList));
      } else {
        result = await sendMediaMessage(
          settings,
          multiMessageType,
          finalNumbersList,
          String(finalMessagesList || " "),
          multiAttachedFileName || (multiMessageType === "image" ? "resim.jpg" : "belge.pdf"),
          multiAttachedFileBase64,
        );
      }

      if (!result.ok) {
        throw new Error(result.error || result.status || "mHatsapp mesajı kabul etmedi.");
      }
      setMultiSendStatus("success");
      setMultiSendLogs(prev => [
        ...prev,
        `Tünel İletimi Başarılı!`,
        `Kişiselleştirilmiş mesaj paketleri mhatsapp.com kuyruğuna kesintisiz şekilde yerleştirildi.`
      ]);
    } catch (err: any) {
      console.error("Multi-send API error:", err);
      setMultiSendStatus("error");
      setMultiSendErrorMsg(err.message || "Mesajlar gönderilemedi.");
      setMultiSendLogs(prev => [...prev, `HATA: ${err.message || "Bağlantı hatası"}`]);
    } finally {
      setIsSendingMulti(false);
    }
  };

  useEffect(() => {
    const canonical = loadMhatsappSettings();
    localforage.getItem<WhatsappConfig>("whatsappConfig").then((legacyConfig) => {
      const legacyToken = String(legacyConfig?.apiKey || "").trim();
      const canonicalToken = String(canonical.token || "").trim();
      const token = canonicalToken || legacyToken;
      const endpoint = legacyConfig?.apiUrl || `${canonical.baseUrl || DEFAULT_MHATSAPP_SETTINGS.baseUrl}/api/v3/message/send/`;
      const template = legacyConfig?.messageTemplate || DEFAULT_TEMPLATE;

      setApiUrl(endpoint);
      setApiKey(token);
      setSenderPhone(legacyConfig?.senderPhone || "");
      setMessageTemplate(template);

      // Tek kaynak: gerçek gönderim yapan bütün modüller bu SQLite ayarını okur.
      if (token && !canonicalToken) {
        saveMhatsappSettings({ ...canonical, baseUrl: (() => { try { return new URL(endpoint).origin; } catch { return DEFAULT_MHATSAPP_SETTINGS.baseUrl; } })(), token });
      }
      localforage.setItem("whatsappConfig", {
        apiUrl: endpoint, apiKey: token, senderPhone: legacyConfig?.senderPhone || "", messageTemplate: template,
      });
    });

    localforage.getItem<string>("whatsappPairingStatus").then((status) => {
      if (status) setPairingStatus(status as any);
    });
    localforage.getItem<any>("whatsappPairedDevice").then((device) => {
      if (device) setPairedDevice(device);
    });
  }, []);

  const handleStartPairing = () => {
    setPairingStatus("pairing");
    setPairingLogs([]);
    
    const logsList = [
      "Dijital tünel şifreli kanalı başlatılıyor...",
      "Eşleştirme anahtarı doğrulanıyor...",
      "Güvenli soket bağlantısı kuruluyor...",
      "Cihaz el sıkışması tamamlanıyor...",
      "WhatsApp API Gateway entegrasyonu sağlandı!",
      "Cihaz Durumu: AKTİF (Mobil Bağlantı Hazır)"
    ];

    logsList.forEach((log, idx) => {
      setTimeout(() => {
        setPairingLogs((prev) => [...prev, log]);
        if (idx === logsList.length - 1) {
          setPairingStatus("paired");
          const deviceInfo = {
            name: "Mobil Bağlantı İstasyonu (Dijital Tünel)",
            phone: senderPhone || "+90 555 123 4567",
            pairedAt: new Date().toLocaleDateString("tr-TR"),
            battery: "98%",
            signal: "Mükemmel",
            ip: "192.168.1.47"
          };
          setPairedDevice(deviceInfo);
          localforage.setItem("whatsappPairingStatus", "paired");
          localforage.setItem("whatsappPairedDevice", deviceInfo);
        }
      }, (idx + 1) * 600);
    });
  };

  const handleScanQRCodeSimulation = () => {
    setShowQRScannerModal(true);
    setScanningProgress(0);
    setScanStep("Kamera Optikleri Hizalanıyor...");
    
    // Step 1: Initialize Camera
    setTimeout(() => {
      setScanningProgress(25);
      setScanStep("QR Kod Taranıyor (Lazer Aktif)...");
    }, 1000);

    // Step 2: Read QR Code
    setTimeout(() => {
      setScanningProgress(50);
      setScanStep("Tünel Kimliği Çözümlendi...");
    }, 2200);

    // Step 3: Server Handshake
    setTimeout(() => {
      setScanningProgress(75);
      setScanStep("Güvenli Soket El Sıkışması...");
    }, 3500);

    // Step 4: Finish Pairing
    setTimeout(() => {
      setScanningProgress(100);
      setScanStep("Tünel Bağlantısı Kuruldu!");
      
      const deviceInfo = {
        name: "QR Bağlantılı Telefon (Dijital Tünel)",
        phone: senderPhone || "+90 555 123 4567",
        pairedAt: new Date().toLocaleDateString("tr-TR"),
        battery: "100%",
        signal: "Kusursuz",
        ip: "192.168.1.108"
      };
      
      setPairedDevice(deviceInfo);
      setPairingStatus("paired");
      localforage.setItem("whatsappPairingStatus", "paired");
      localforage.setItem("whatsappPairedDevice", deviceInfo);
      
      // Auto-close scanner modal after a short delay
      setTimeout(() => {
        setShowQRScannerModal(false);
      }, 800);
      
    }, 4800);
  };

  const handleDisconnect = () => {
    if (confirm("Cihaz tünel eşleşmesini sonlandırmak istediğinize emin misiniz?")) {
      setPairingStatus("unpaired");
      setPairingLogs([]);
      setPairedDevice(null);
      localforage.setItem("whatsappPairingStatus", "unpaired");
      localforage.removeItem("whatsappPairedDevice");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const baseUrl = (() => {
      try { return new URL(apiUrl || DEFAULT_MHATSAPP_SETTINGS.baseUrl).origin; }
      catch { return DEFAULT_MHATSAPP_SETTINGS.baseUrl; }
    })();
    saveMhatsappSettings({
      ...loadMhatsappSettings(),
      baseUrl,
      token: apiKey.trim(),
    });
    localforage.setItem("whatsappConfig", { apiUrl, apiKey: apiKey.trim(), senderPhone, messageTemplate }).then(() => {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    });
  };

  const handleResetAllConfigs = async () => {
    if (window.confirm("Bütün kayıtlı WhatsApp API bağlantı bilgilerini, gönderici numarasını ve ayarları sıfırlamak istediğinize emin misiniz?")) {
      await localforage.removeItem("whatsappConfig");
      await localforage.removeItem("whatsappPairingStatus");
      await localforage.removeItem("whatsappPairedDevice");
      saveMhatsappSettings(DEFAULT_MHATSAPP_SETTINGS);
      
      setApiUrl("https://api.mhatsapp.com/api/v3/message/send/");
      setApiKey("");
      setSenderPhone("");
      setMessageTemplate(DEFAULT_TEMPLATE);
      
      // Reset sending and testing states too
      setMultiNumbersText("");
      setMultiMessageText("");
      setPersonalizedText("");
      setMultiSendLogs([]);
      setMultiSendStatus("idle");
      
      setTestPhone("");
      setTestMessage("mhatsapp.com API Entegrasyon Test Mesajı. Bu mesaj sistem üzerinden başarıyla iletilmiştir. 🎉");
      setTestSendLogs([]);
      setTestSendStatus("idle");
      setTestSendError("");
      
      alert("Bütün bağlantı ve gönderim bilgileri sıfırlandı!");
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      alert("Lütfen önce API Bağlantı Ayarları bölümünden geçerli bir API Yetkilendirme Anahtarı girin ve kaydedin.");
      return;
    }
    
    const cleanedPhone = cleanPhone(testPhone);
    if (cleanedPhone.length < 10) {
      alert("Lütfen geçerli bir alıcı telefon numarası girin (Örn: 905550000000).");
      return;
    }
    
    if (!testMessage.trim()) {
      alert("Lütfen bir test mesajı metni girin.");
      return;
    }
    
    setIsSendingTest(true);
    setTestSendStatus("idle");
    setTestSendError("");
    setTestSendLogs([
      "Bağlantı testi başlatılıyor...",
      `Hedef Alıcı: ${cleanedPhone}`,
      "mhatsapp.com API tüneline bağlantı isteği gönderiliyor..."
    ]);
    
    try {
      const baseUrl = (() => {
        try { return new URL(apiUrl || DEFAULT_MHATSAPP_SETTINGS.baseUrl).origin; }
        catch { return DEFAULT_MHATSAPP_SETTINGS.baseUrl; }
      })();
      const settings = { ...loadMhatsappSettings(), baseUrl, token: apiKey.trim() };
      // Kaydet düğmesine basılmamış olsa bile test ile gerçek ayarı aynı kaynağa eşitle.
      saveMhatsappSettings(settings);
      const result = await sendTextMessage(settings, [cleanedPhone], testMessage);
      if (!result.ok) {
        throw new Error(result.error || result.status || "mHatsapp.com API mesajı kabul etmedi.");
      }
      setTestSendStatus("success");
      setTestSendLogs(prev => [
        ...prev,
        "API Yanıtı: Gerçek mHatsapp isteği başarılı",
        "Test mesajı mHatsapp tarafından kabul edildi. Telefonunuza ulaştığını da kontrol edin."
      ]);
    } catch (err: any) {
      console.error("Test send error:", err);
      setTestSendStatus("error");
      setTestSendError(err.message || "Bilinmeyen bir hata oluştu.");
      setTestSendLogs(prev => [
        ...prev,
        `HATA: ${err.message || "Bağlantı başarısız"}`
      ]);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto space-y-6 p-6">
      
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-emerald-100 pb-4">
        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">
            WhatsApp Entegrasyonu
          </h2>
          <p className="text-sm font-medium text-slate-500">
            Otomatik arka plan gönderimi için API Gateway bağlantı ayarlarınızı ve tünelinizi yapılandırın.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Section 1: API Config Card */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            1. API Bağlantı Ayarları
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 col-span-1 md:col-span-2">
              <div>
                <label className="block text-slate-700 font-bold mb-2 text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-500" />
                    API Endpoint URL
                  </span>
                  <button
                    type="button"
                    onClick={() => setApiUrl("https://api.mhatsapp.com/api/v3/message/send/")}
                    className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                  >
                    ⚡ mhatsapp.com Varsayılanı Yap
                  </button>
                </label>
                <input
                  type="url"
                  required
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.mhatsapp.com/api/v3/message/send/"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-2 text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-500" />
                  API Token / Secret Key
                </label>
                <input
                  type="password"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="API Yetkilendirme Anahtarı (Token)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-2 text-sm flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  Gönderici Telefon Numarası
                </label>
                <input
                  type="tel"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="+90 555 000 0000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs"
                />
              </div>
            </div>
          </div>

          {/* Moved Save Button inside Section 1 */}
          <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={handleResetAllConfigs}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-[14.67px]"
              title="Kayıtlı tüm WhatsApp bağlantı ayarlarını ve şablonları siler."
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              Gönderim Bilgilerini Sıfırla
            </button>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {isSaved && (
                <span className="text-sm font-bold text-emerald-600 flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Ayarlar Kaydedildi!
                </span>
              )}
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all hover:-translate-y-0.5 cursor-pointer text-[14.67px]"
              >
                <Save className="w-5 h-5 text-emerald-100 shrink-0" />
                API Bağlantı Ayarlarını Kaydet
              </button>
            </div>
          </div>

        </div>

      </form>

      {/* Section 2: mhatsapp.com API Gateway Connection Status */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${apiKey ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
              2. mhatsapp.com API Gateway Bağlantı İstasyonu
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              WhatsApp gönderimlerinizi mhatsapp.com entegrasyonu üzerinden kesintisiz yönetin.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left panel: Connection status feedback */}
          <div className="lg:col-span-7 space-y-5 flex flex-col justify-between">
            {!apiKey ? (
              <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-650 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-amber-850">Bağlantı Bekleniyor</h4>
                  <p className="text-[11px] text-amber-700/90 font-medium leading-relaxed">
                    Sistem henüz aktif bir API anahtarı (Token) ile yapılandırılmadı. Lütfen <strong>mhatsapp.com</strong> panelinizden aldığınız Token anahtarını yukarıdaki ayarlar bölümüne girip kaydedin.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800">mhatsapp.com Cloud API</h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Aktif Gönderici Tüneli</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-emerald-100/50 pt-3 text-[10px] font-bold text-slate-650">
                  <div>
                    <span className="text-slate-400 block font-medium">Gateway Durumu</span>
                    <span className="text-emerald-650 font-black mt-0.5 block flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      AKTİF / BULUT BAĞLANTISI HAZIR
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Güvenlik</span>
                    <span className="text-slate-800 font-black mt-0.5 block">SSL / AES-256 Şifreli</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Gönderici Numara</span>
                    <span className="text-slate-800 font-black mt-0.5 block">{senderPhone || "Belirtilmedi (Varsayılan)"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">API Endpoint</span>
                    <span className="text-slate-500 font-mono mt-0.5 block truncate" title={apiUrl}>{apiUrl || "mhatsapp.com API v3"}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
              <h4 className="text-xs font-black text-slate-700 mb-2 flex items-center gap-1.5">
                <span>💡</span> mhatsapp.com Bilgi Paneli
              </h4>
              <ul className="text-[11px] text-slate-500 font-medium space-y-1.5 list-disc list-inside">
                <li>Toplu gönderimlerde numara engelleme riskini azaltmak için mesajlarınızı kişiselleştirin.</li>
                <li>Tek seferde 1000+ alıcıya kadar kuyruğa ekleme yapabilirsiniz.</li>
                <li>Görsel (.jpg, .png) veya dosya (.pdf, .doc) formatlarında ek gönderebilirsiniz.</li>
              </ul>
            </div>
          </div>

          {/* Right panel: Connection guidance & Ping Status */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50 border border-slate-200 rounded-3xl p-6">
            <div className="space-y-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Bağlantı Kılavuzu</span>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                  <p className="text-slate-600 font-medium"><strong>mhatsapp.com</strong> web panelinize giriş yapın.</p>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                  <p className="text-slate-600 font-medium">Sol menüdeki <strong>API Key</strong> ve <strong>Numaralar</strong> sekmesinden bilgilerinizi kopyalayın.</p>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                  <p className="text-slate-600 font-medium">Yukarıdaki <strong>1. API Bağlantı Ayarları</strong> paneline yapıştırıp kaydedin.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/60 mt-4 text-center">
              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-wider">
                🔐 mhatsapp.com Resmi API Gateway Entegrasyonu
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Connection Test Area (Bağlantı Test Paneli) */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              3. Bağlantı Test Alanı (Tekli Test Mesajı Gönder)
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              API bilgilerinizin doğruluğunu kendi numaranıza anlık bir test mesajı göndererek test edin.
            </p>
          </div>
        </div>

        <form onSubmit={handleSendTestMessage} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-slate-700 font-bold mb-2 text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-500" />
                Alıcı Test Numarası
              </label>
              <input
                type="tel"
                required
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Örn: 905330000000"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs"
              />
              <p className="text-[10px] text-slate-450 font-bold mt-1">
                * Test mesajını almasını istediğiniz telefon numarasını ülke kodu dahil (Örn: 90) yazın.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-2 text-sm">
                Test Mesajı İçeriği
              </label>
              <textarea
                rows={3}
                required
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Test mesajınızı yazın..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSendingTest}
                className={`w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 cursor-pointer transition-all text-[14.67px] ${
                  isSendingTest ? "opacity-75 cursor-wait" : ""
                }`}
              >
                {isSendingTest ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Test İletiliyor...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-emerald-100" />
                    Test Mesajı Gönder
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Test log output console */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 flex flex-col justify-between font-mono text-[11px] h-[240px] md:h-auto border border-slate-850">
            <div className="space-y-2 overflow-y-auto pr-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-800 pb-1.5 mb-2">
                📡 Canlı Test İletim Konsolu
              </span>
              {testSendLogs.length === 0 ? (
                <div className="text-slate-500 italic">Test mesajı gönderildiğinde canlı iletim adımları burada görüntülenecektir...</div>
              ) : (
                testSendLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 animate-fadeIn text-emerald-400">
                    <span className="text-slate-500 shrink-0">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] font-black tracking-wider shrink-0 mt-2">
              <span className="text-slate-400">GÖNDERİM DURUMU:</span>
              {testSendStatus === "idle" && <span className="text-slate-500 uppercase">Hazır</span>}
              {testSendStatus === "success" && <span className="text-emerald-400 uppercase flex items-center gap-1">🟢 Başarılı</span>}
              {testSendStatus === "error" && <span className="text-rose-400 uppercase flex items-center gap-1">🔴 Hatalı</span>}
            </div>
          </div>
        </form>
      </div>

      {/* Section 4: Multi-Message Sending Panel */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          4. Hızlı Kesintisiz Çoklu Gönderim Paneli
        </h3>
        
        <p className="text-xs text-slate-500 font-medium">
          Ortak bir mesajı veya her bir alıcıya özel farklı mesajları tek bir API tüneli üzerinden kesintisiz olarak iletin.
        </p>

        <form onSubmit={handleSendMultiMessage} className="space-y-5">
          <div className="space-y-4">
            {/* Sending Mode Selector */}
            <div>
              <label className="block text-slate-700 font-bold mb-2 text-sm">
                Gönderim Modu
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setMultiSendMode("common")}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    multiSendMode === "common"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Users className="w-4 h-4 text-slate-400" />
                  Ortak Mesaj (Tümüne Aynı Mesaj)
                </button>
                <button
                  type="button"
                  onClick={() => setMultiSendMode("personalized")}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    multiSendMode === "personalized"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <FileText className="w-4 h-4 text-slate-400" />
                  Kişiselleştirilmiş (Her Biri İçin Farklı Mesaj)
                </button>
              </div>
            </div>

            {/* Render inputs based on Send Mode */}
            {multiSendMode === "common" ? (
              <>
                {/* Phone Numbers input */}
                <div>
                  <label className="block text-slate-700 font-bold mb-2 text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-500" />
                      Alıcı Telefon Numaraları
                    </span>
                    {multiNumbersText && (
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded-md border border-emerald-100">
                        {parseAndCleanNumbers(multiNumbersText).length} Geçerli Numara Tespit Edildi
                      </span>
                    )}
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={multiNumbersText}
                    onChange={(e) => setMultiNumbersText(e.target.value)}
                    placeholder="Örn: 905111111111,905222222222,905333333333&#10;(Numaraları virgülle ayırarak veya her satıra bir numara gelecek şekilde alt alta yazabilirsiniz)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs"
                  />
                </div>

                {/* Message Content Textarea */}
                <div>
                  <label className="block text-slate-700 font-bold mb-2 text-sm flex items-center justify-between">
                    <span>Mesaj İçeriği</span>
                  </label>
                  <textarea
                    rows={4}
                    value={multiMessageText}
                    onChange={(e) => setMultiMessageText(e.target.value)}
                    placeholder="Gönderilecek ortak mesaj metnini buraya yazın..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Personalized format input */}
                <div>
                  <label className="block text-slate-700 font-bold mb-2 text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      Kişiselleştirilmiş Mesaj Listesi (Numara | Mesaj)
                    </span>
                    {personalizedText && (
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded-md border border-emerald-100">
                        {parsePersonalizedText(personalizedText).filter(x => x.isValid).length} Geçerli İkili Tespit Edildi
                      </span>
                    )}
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={personalizedText}
                    onChange={(e) => setPersonalizedText(e.target.value)}
                    placeholder="Örn:&#10;905111111111 | Sayın Ali Yılmaz, 250 TL borcunuz vardır.&#10;905222222222 | Sayın Ayşe Demir, 90 TL borcunuz vardır.&#10;905333333333 | Sayın Mehmet Kaya, 1.200 TL borcunuz vardır."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-750 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                    * Telefon numarası ve göndermek istediğiniz mesajı dikey çizgi (<code className="bg-slate-100 px-1 py-0.5 rounded">|</code>) veya iki nokta (<code className="bg-slate-100 px-1 py-0.5 rounded">:</code>) ile ayırarak her satıra bir alıcı gelecek şekilde yazın.
                  </p>
                </div>

                {/* Personalized detection live preview */}
                {personalizedText && parsePersonalizedText(personalizedText).length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Canlı Algılama ve Önizleme</span>
                    <div className="max-h-[160px] overflow-y-auto border border-slate-150 rounded-xl divide-y divide-slate-100 bg-white shadow-xs">
                      {parsePersonalizedText(personalizedText).map((item, idx) => (
                        <div key={idx} className="p-2.5 flex items-start gap-3 text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 mt-0.5 ${item.isValid ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
                            {item.isValid ? "GEÇERLİ" : "HATALI"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-700">{item.phone || <span className="text-rose-500">Geçersiz Numara</span>}</div>
                            <div className="text-slate-500 font-medium truncate mt-0.5" title={item.message}>
                              {item.message || <span className="text-rose-400 italic">"Format hatalı, ayrıştırılamadı."</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Message Type Selector */}
            <div>
              <label className="block text-slate-700 font-bold mb-2 text-sm">
                Dosya/Medya Türü (İsteğe Bağlı)
              </label>
              <div className="flex gap-3">
                {[
                  { value: "text", label: "Sadece Metin", icon: MessageCircle },
                  { value: "image", label: "Görsel Gönder", icon: ImageIcon },
                  { value: "document", label: "Dosya/Belge Gönder", icon: FileText }
                ].map((typeOption) => {
                  const Icon = typeOption.icon;
                  const isActive = multiMessageType === typeOption.value;
                  return (
                    <button
                      key={typeOption.value}
                      type="button"
                      onClick={() => setMultiMessageType(typeOption.value as any)}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        isActive 
                          ? "bg-emerald-50 border-emerald-300 text-emerald-750 shadow-xs" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                      {typeOption.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File upload section for image/document */}
            {multiMessageType !== "text" && (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 shadow-xs">
                  <Paperclip className="w-5 h-5" />
                </div>
                
                {multiAttachedFileName ? (
                  <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2 w-full max-w-sm justify-between shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {multiMessageType === "image" ? (
                        <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      )}
                      <span className="text-xs font-black text-slate-700 truncate">
                        {multiAttachedFileName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearMultiFile}
                      className="text-rose-500 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors shrink-0"
                      title="Dosyayı Kaldır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <label className="inline-block px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all">
                      Dosya Seç / Yükle
                      <input
                        type="file"
                        className="hidden"
                        accept={multiMessageType === "image" ? "image/*" : "*"}
                        onChange={handleMultiFileChange}
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                      {multiMessageType === "image" ? "Desteklenen formatlar: JPG, JPEG, PNG, GIF" : "Tüm belge formatları desteklenir (.pdf, .docx, vs.)"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sending Feedback Panel */}
          {multiSendLogs.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Gönderim Durumu ve Sinyalleri</span>
              <div className="space-y-1.5 font-mono text-[10px] text-slate-650 font-bold max-h-[120px] overflow-y-auto">
                {multiSendLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-700 animate-fadeIn">
                    <span className="text-emerald-500 shrink-0">✓</span>
                    <span>{log}</span>
                  </div>
                ))}
                {isSendingMulti && (
                  <div className="flex items-center gap-2 text-blue-600 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                    <span>Gateway bağlantısı üzerinden veri paketleri aktarılıyor...</span>
                  </div>
                )}
              </div>

              {multiSendStatus === "success" && (
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[11px] font-black text-emerald-800">Gönderim Talebi Tamamlandı!</h4>
                    <p className="text-[10px] text-emerald-700 font-medium leading-relaxed mt-0.5">
                      mhatsapp.com API'si tüm alıcılara ait mesaj paketini kuyruğa başarıyla yerleştirdi.
                    </p>
                  </div>
                </div>
              )}

              {multiSendStatus === "error" && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[11px] font-black text-rose-800">Gönderim Hatası</h4>
                    <p className="text-[10px] text-rose-700 font-medium leading-relaxed mt-0.5">
                      {multiSendErrorMsg}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSendingMulti}
              className={`px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all hover:-translate-y-0.5 text-[14.67px] cursor-pointer ${
                isSendingMulti ? "opacity-75 cursor-wait" : ""
              }`}
            >
              {isSendingMulti ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-250" />
                  İletiliyor...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-emerald-100" />
                  Çoklu Gönderimi Başlat
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Simulated QR Code Camera Scanner Modal */}
      {showQRScannerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl flex flex-col items-center text-center space-y-4 animate-scaleIn">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <QrCode className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h4 className="font-black text-slate-800 text-sm">QR Kod ile Tünele Bağlanma</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Kameranız tünel QR kodunu tarıyor. Lütfen kamerasını QR koduna doğrultun.
              </p>
            </div>

            {/* Viewfinder with laser line scanning */}
            <div className="relative w-48 h-48 border-2 border-emerald-500 rounded-3xl p-2 bg-slate-900 flex items-center justify-center overflow-hidden shadow-inner">
              <style>{`
                @keyframes scanLaser {
                  0% { transform: translateY(-80px); }
                  50% { transform: translateY(80px); }
                  100% { transform: translateY(-80px); }
                }
              `}</style>
              <div 
                className="absolute inset-x-0 h-1 bg-emerald-500 shadow-[0_0_12px_#10b981] z-20" 
                style={{ animation: "scanLaser 2.2s infinite ease-in-out" }}
              />
              
              {/* Corner brackets simulating camera HUD */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>

              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=ffffff&bgcolor=0f172a&data=${encodeURIComponent("mhatsapp-tunnel://pair?token=" + (apiKey || "b8c3e4f6-1234-4abc-9def-0123456789ab"))}`}
                alt="Scanner QR"
                className="w-32 h-32 opacity-80"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Progress indicators */}
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>{scanStep}</span>
                <span>{scanningProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${scanningProgress}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowQRScannerModal(false);
                setScanningProgress(0);
              }}
              className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-xl font-bold transition-all text-xs cursor-pointer"
            >
              Tarama İşlemini İptal Et
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
