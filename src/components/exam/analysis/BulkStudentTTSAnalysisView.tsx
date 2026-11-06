import React, { useEffect, useState } from "react";
import localforage from "localforage";
import { sqliteStorage } from "../../../core/state/SyncStateStore";
import {
  Check, Copy, Download, Loader2, Pause, Play, Search, Share2, Sparkles, Square, Volume2, X,
} from "lucide-react";
import { cleanPhone, generateStudentSpeechText } from "./ttsUtils";

interface BulkStudentTTSAnalysisViewProps {
  sortedCalculatedResults: any[];
  activeExam?: any;
}

export function BulkStudentTTSAnalysisView({ sortedCalculatedResults, activeExam }: BulkStudentTTSAnalysisViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [voice, setVoice] = useState("Kore");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Registered students for looking up phone numbers
  const [allRegisteredStudents, setAllRegisteredStudents] = useState<any[]>([]);
  
  // Shortened link mappings from the database
  const [shortIds, setShortIds] = useState<Record<string, string>>({});
  const [generatingShortLinks, setGeneratingShortLinks] = useState(false);
  const [shortlinkError, setShortlinkError] = useState<string | null>(null);

  // Checkbox Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Wizard States
  const [wizardActive, setWizardActive] = useState(false);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [wizardSentIds, setWizardSentIds] = useState<Set<string>>(new Set());
  const [customWizardMessage, setCustomWizardMessage] = useState("");
  const [useFixedMessage, setUseFixedMessage] = useState(false);

  // Preview states
  const [playingStudentId, setPlayingStudentId] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  // WhatsApp API Configuration
  const [whatsappConfig, setWhatsappConfig] = useState<{ apiUrl?: string; apiKey?: string; senderPhone?: string; messageTemplate?: string } | null>(null);
  const [isSendingAuto, setIsSendingAuto] = useState(false);
  const [autoSendSuccessCount, setAutoSendSuccessCount] = useState(0);
  const [rowSendingStatus, setRowSendingStatus] = useState<Record<string, "idle" | "sending" | "success" | "error">>({});

  // Load students and WhatsApp configuration on mount
  useEffect(() => {
    localforage.getItem("school_students").then((savedStudents: any) => {
      if (savedStudents) {
        setAllRegisteredStudents(savedStudents);
      } else {
        const lsStudents = sqliteStorage.getItem("school_students");
        if (lsStudents) {
          try {
            setAllRegisteredStudents(JSON.parse(lsStudents));
          } catch (e) {}
        }
      }
    });

    // Load saved WhatsApp API configs
    localforage.getItem("whatsappConfig").then((savedConfig: any) => {
      if (savedConfig) {
        setWhatsappConfig({
          apiUrl: savedConfig.apiUrl || "https://api.mhatsapp.com/api/v3/message/send/",
          apiKey: savedConfig.apiKey || "b8c3e4f6-1234-4abc-9def-0123456789ab",
          senderPhone: savedConfig.senderPhone || "",
          messageTemplate: savedConfig.messageTemplate || "Merhaba, *{ogrenci_adi}* için hazırlanan *{sinav_adi}* sesli yapay zeka deneme sınavı analiz dökümünü aşağıdaki bağlantıdan dinleyebilirsiniz:\n\n🎧 {link}"
        });
      } else {
        setWhatsappConfig({
          apiUrl: "https://api.mhatsapp.com/api/v3/message/send/",
          apiKey: "b8c3e4f6-1234-4abc-9def-0123456789ab",
          senderPhone: "",
          messageTemplate: "Merhaba, *{ogrenci_adi}* için hazırlanan *{sinav_adi}* sesli yapay zeka deneme sınavı analiz dökümünü aşağıdaki bağlantıdan dinleyebilirsiniz:\n\n🎧 {link}"
        });
      }
    });
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, [audio]);

  // Generate short links when results or voice selection changes
  useEffect(() => {
    if (sortedCalculatedResults.length > 0) {
      generateAllShortLinks();
    }
  }, [sortedCalculatedResults, voice]);

  const generateAllShortLinks = async () => {
    setGeneratingShortLinks(true);
    setShortlinkError(null);
    try {
      const items = sortedCalculatedResults.map(student => {
        const text = generateStudentSpeechText(student, sortedCalculatedResults);
        return {
          studentId: student.recordId,
          studentName: student.studentName,
          voice: voice,
          text: text
        };
      });

      const res = await fetch("/api/tts/shorten-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      if (!res.ok) {
        throw new Error("Kısa link oluşturma sunucu hatası.");
      }
      const data = await res.json();
      if (data.success && data.results) {
        const mapping: Record<string, string> = {};
        data.results.forEach((item: any) => {
          mapping[item.studentId] = item.shortId;
        });
        setShortIds(mapping);
      } else {
        throw new Error(data.error || "Bilinmeyen sunucu hatası");
      }
    } catch (err: any) {
      console.error("Kısa linkler oluşturulurken hata:", err);
      setShortlinkError("Bağlantılar otomatik kısaltılamadı. Uzun linkler kullanılacak.");
    } finally {
      setGeneratingShortLinks(false);
    }
  };

  // Distinct classes for filter
  const distinctClasses = Array.from(
    new Set(sortedCalculatedResults.map((r) => r.classroom || "Sınıfsız"))
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }));

  // Filtered students
  const filteredStudents = sortedCalculatedResults.filter((student) => {
    const nameMatch = (student.studentName || "")
      .toLocaleLowerCase("tr")
      .includes(searchQuery.toLocaleLowerCase("tr"));
    const numberMatch = (student.studentNumber || "")
      .toString()
      .includes(searchQuery);
    const classMatch =
      classFilter === "all" || (student.classroom || "Sınıfsız") === classFilter;
    return (nameMatch || numberMatch) && classMatch;
  });

  const getStudentPhone = (student: any) => {
    if (!allRegisteredStudents || allRegisteredStudents.length === 0) return "";
    const registered = allRegisteredStudents.find(
      (s: any) => 
        (s.id && String(s.id).trim() === String(student.studentNumber).trim()) ||
        (s.name && s.name.toLowerCase().trim() === student.studentName.toLowerCase().trim())
    );
    if (registered) {
      return registered.parentPhone || registered.phone || "";
    }
    return "";
  };

  const getShareUrl = (student: any) => {
    const base = window.location.origin.replace("ais-dev-", "ais-pre-");
    const shortId = shortIds[student.recordId];
    if (shortId) {
      return `${base}/api/tts/s/${shortId}`;
    }
    const text = generateStudentSpeechText(student, sortedCalculatedResults);
    return `${base}/api/tts/stream?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
  };

  const formatWhatsappMessage = (student: any, shareUrl: string) => {
    const template = whatsappConfig?.messageTemplate;
    if (!template) {
      return `Merhaba, *${student.studentName || "Değerli Öğrencimiz"}* için hazırlanan sesli yapay zeka deneme sınavı analiz dökümünü aşağıdaki bağlantıdan dinleyebilirsiniz:\n\n🎧 ${shareUrl}`;
    }

    const studentName = student.studentName || "Değerli Öğrencimiz";
    const studentNo = student.studentNumber || "-";
    const classroom = student.classroom || "Sınıfsız";
    const examName = activeExam?.examName || activeExam?.name || "Deneme Sınavı";

    const totalNet = student.totals?.net !== undefined ? student.totals.net : 0;
    const correct = student.totals?.correct !== undefined ? student.totals.correct : 0;
    const wrong = student.totals?.wrong !== undefined ? student.totals.wrong : 0;
    const empty = student.totals?.empty !== undefined ? student.totals.empty : 0;

    const rank = sortedCalculatedResults.findIndex(s => s.recordId === student.recordId) + 1;
    const totalCount = sortedCalculatedResults.length;

    const classStudents = sortedCalculatedResults.filter(s => s.classroom === student.classroom);
    const classRank = classStudents.findIndex(s => s.recordId === student.recordId) + 1;
    const classCount = classStudents.length;

    return template
      .replace(/{ogrenci_adi}/g, String(studentName))
      .replace(/{ogrenci_no}/g, String(studentNo))
      .replace(/{sinif}/g, String(classroom))
      .replace(/{sinav_adi}/g, String(examName))
      .replace(/{toplam_net}/g, typeof totalNet === "number" ? totalNet.toFixed(2) : String(totalNet))
      .replace(/{dogru}/g, String(correct))
      .replace(/{yanlis}/g, String(wrong))
      .replace(/{bos}/g, String(empty))
      .replace(/{kurum_derece}/g, String(rank))
      .replace(/{kurum_katilim}/g, String(totalCount))
      .replace(/{sinif_derece}/g, String(classRank))
      .replace(/{sinif_katilim}/g, String(classCount))
      .replace(/{link}/g, String(shareUrl));
  };

  const handleCopyLink = async (student: any) => {
    try {
      const shareUrl = getShareUrl(student);
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(student.recordId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareWhatsApp = async (student: any) => {
    try {
      const config = whatsappConfig;
      if (!config || !config.apiKey) {
        throw new Error("WhatsApp API ayarları (API Anahtarı) yapılandırılmamış. Lütfen sol menüden 'WhatsApp Entegrasyonu' ayarlarını tamamlayın.");
      }

      const phone = getStudentPhone(student);
      const cleanPh = cleanPhone(phone);
      if (!cleanPh) {
        throw new Error("Öğrencinin/Velinin geçerli bir telefon numarası bulunamadı.");
      }

      const shareUrl = getShareUrl(student);
      const message = formatWhatsappMessage(student, shareUrl);

      const res = await fetch("/api/whatsapp/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          phone: cleanPh,
          message: message
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "API üzerinden gönderilirken hata oluştu.");
      }

      alert("Mesaj başarıyla gönderildi!");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Bilinmeyen bir hata oluştu.");
    }
  };

  const handleTogglePreview = async (student: any) => {
    if (playingStudentId === student.recordId) {
      if (audio) {
        audio.pause();
      }
      setPlayingStudentId(null);
      return;
    }

    try {
      if (audio) {
        audio.pause();
      }
      setPreviewLoadingId(student.recordId);
      setPlayingStudentId(null);

      const streamUrl = getShareUrl(student);
      const newAudio = new Audio(streamUrl);
      
      newAudio.onended = () => {
        setPlayingStudentId(null);
      };
      newAudio.onerror = () => {
        setPlayingStudentId(null);
        setPreviewLoadingId(null);
      };

      setAudio(newAudio);
      await newAudio.play();
      setPlayingStudentId(student.recordId);
    } catch (err) {
      console.error("Audio preview failed:", err);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  // Checkbox Handlers
  const handleToggleSelect = (recordId: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(recordId)) {
      updated.delete(recordId);
    } else {
      updated.add(recordId);
    }
    setSelectedIds(updated);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      const allFiltered = new Set(filteredStudents.map(s => s.recordId));
      setSelectedIds(allFiltered);
    }
  };

  // Wizard Queue
  const getWizardQueue = () => {
    if (selectedIds.size > 0) {
      return filteredStudents.filter(s => selectedIds.has(s.recordId));
    }
    return filteredStudents;
  };

  const startWizard = () => {
    const queue = getWizardQueue();
    if (queue.length === 0) return;
    setWizardIndex(0);
    setWizardActive(true);
    setUseFixedMessage(false);
    
    const firstStudent = queue[0];
    const link = getShareUrl(firstStudent);
    setCustomWizardMessage(formatWhatsappMessage(firstStudent, link));
  };

  // Wizard updates message on index change
  useEffect(() => {
    const queue = getWizardQueue();
    if (wizardActive && queue[wizardIndex] && !useFixedMessage) {
      const student = queue[wizardIndex];
      const link = getShareUrl(student);
      setCustomWizardMessage(formatWhatsappMessage(student, link));
    }
  }, [wizardIndex, wizardActive, whatsappConfig, shortIds, useFixedMessage]);

  const handleWizardSend = async () => {
    const queue = getWizardQueue();
    const student = queue[wizardIndex];
    if (!student) return;

    try {
      const config = whatsappConfig;
      if (!config || !config.apiKey) {
        throw new Error("WhatsApp API ayarları (API Anahtarı) yapılandırılmamış. Lütfen sol menüden 'WhatsApp Entegrasyonu' ayarlarını tamamlayın.");
      }

      const phone = getStudentPhone(student);
      const cleanPh = cleanPhone(phone);
      if (!cleanPh) {
        throw new Error("Öğrencinin/Velinin geçerli bir telefon numarası bulunamadı.");
      }
      
      let finalMessage = customWizardMessage;
      if (useFixedMessage) {
        const link = getShareUrl(student);
        finalMessage = finalMessage.replace(/{link}/g, link);
      }

      const res = await fetch("/api/whatsapp/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          phone: cleanPh,
          message: finalMessage
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "API üzerinden gönderilirken hata oluştu.");
      }

      const updatedSent = new Set(wizardSentIds);
      updatedSent.add(student.recordId);
      setWizardSentIds(updatedSent);

      if (wizardIndex < queue.length - 1) {
        setWizardIndex(wizardIndex + 1);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Bilinmeyen bir hata oluştu.");
    }
  };

  const handleWizardSkip = () => {
    const queue = getWizardQueue();
    if (wizardIndex < queue.length - 1) {
      setWizardIndex(wizardIndex + 1);
    }
  };

  const handleWizardPrev = () => {
    if (wizardIndex > 0) {
      setWizardIndex(wizardIndex - 1);
    }
  };

  const handleSendViaApi = async (student: any) => {
    const recordId = student.recordId;
    setRowSendingStatus(prev => ({ ...prev, [recordId]: "sending" }));
    
    try {
      const config = whatsappConfig;
      if (!config || !config.apiKey) {
        throw new Error("WhatsApp API ayarları (API Anahtarı) yapılandırılmamış. Lütfen sol menüden 'WhatsApp Entegrasyonu' ayarlarını tamamlayın.");
      }

      const phone = getStudentPhone(student);
      const cleanPh = cleanPhone(phone);
      if (!cleanPh) {
        throw new Error("Öğrencinin/Velinin geçerli bir telefon numarası bulunamadı.");
      }

      const shareUrl = getShareUrl(student);
      const message = formatWhatsappMessage(student, shareUrl);

      const res = await fetch("/api/whatsapp/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          phone: cleanPh,
          message: message
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "API üzerinden gönderilirken hata oluştu.");
      }

      setRowSendingStatus(prev => ({ ...prev, [recordId]: "success" }));
      setTimeout(() => {
        setRowSendingStatus(prev => ({ ...prev, [recordId]: "idle" }));
      }, 4000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Bilinmeyen bir hata oluştu.");
      setRowSendingStatus(prev => ({ ...prev, [recordId]: "error" }));
    }
  };

  const handleAutoSendAll = async () => {
    const queue = getWizardQueue();
    if (queue.length === 0) return;

    const config = whatsappConfig;
    if (!config || !config.apiKey) {
      alert("WhatsApp API ayarları (API Anahtarı) yapılandırılmamış. Lütfen sol menüden 'WhatsApp Entegrasyonu' ayarlarını tamamlayın.");
      return;
    }

    if (!confirm(`Sıradaki ${queue.length} öğrenci için WhatsApp mesajları arka planda otomatik olarak gönderilecek. Onaylıyor musunuz?`)) {
      return;
    }

    setIsSendingAuto(true);
    setAutoSendSuccessCount(0);
    let successCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const student = queue[i];
      setWizardIndex(i); // Update UI focus to current student

      const phone = getStudentPhone(student);
      const cleanPh = cleanPhone(phone);
      if (!cleanPh) {
        console.warn(`Student ${student.studentName} has no phone. Skipping.`);
        continue;
      }

      // Generate message body with custom short links
      const link = getShareUrl(student);
      let messageText = "";
      if (useFixedMessage) {
        messageText = customWizardMessage.replace(/{link}/g, link);
      } else {
        messageText = formatWhatsappMessage(student, link);
      }

      try {
        const res = await fetch("/api/whatsapp/send-direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            phone: cleanPh,
            message: messageText
          })
        });

        if (res.ok) {
          successCount++;
          setAutoSendSuccessCount(successCount);
          setWizardSentIds(prev => {
            const updated = new Set(prev);
            updated.add(student.recordId);
            return updated;
          });
        } else {
          const errData = await res.json();
          console.error(`API Error for ${student.studentName}:`, errData);
        }
      } catch (err) {
        console.error(`Network Error for ${student.studentName}:`, err);
      }

      // Delay of 1.5s to respect API rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setIsSendingAuto(false);
    alert(`Toplu otomatik gönderim tamamlandı! Başarıyla gönderilen mesaj sayısı: ${successCount}`);
  };

  const handleSendWizardCurrentViaApi = async () => {
    const queue = getWizardQueue();
    const student = queue[wizardIndex];
    if (!student) return;

    try {
      const config = whatsappConfig;
      if (!config || !config.apiKey) {
        throw new Error("WhatsApp API ayarları (API Anahtarı) yapılandırılmamış. Lütfen sol menüden 'WhatsApp Entegrasyonu' ayarlarını tamamlayın.");
      }

      const phone = getStudentPhone(student);
      const cleanPh = cleanPhone(phone);
      if (!cleanPh) {
        throw new Error("Öğrencinin/Velinin geçerli bir telefon numarası bulunamadı.");
      }

      const res = await fetch("/api/whatsapp/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          phone: cleanPh,
          message: customWizardMessage
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "API üzerinden gönderilirken hata oluştu.");
      }

      const updatedSent = new Set(wizardSentIds);
      updatedSent.add(student.recordId);
      setWizardSentIds(updatedSent);

      alert(`${student.studentName} için mesaj API üzerinden başarıyla gönderildi!`);

      if (wizardIndex < queue.length - 1) {
        setWizardIndex(wizardIndex + 1);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Bilinmeyen bir hata oluştu.");
    }
  };

  const handleCopyAllLinks = async () => {
    const queue = getWizardQueue();
    if (queue.length === 0) return;

    const textList = queue.map(student => {
      const link = getShareUrl(student);
      return `${student.studentName}: ${link}`;
    }).join("\n");

    try {
      await navigator.clipboard.writeText(textList);
      alert("Tüm seçilen öğrencilerin kısa linkleri kopyalandı!");
    } catch (err) {
      console.error(err);
    }
  };

  const currentQueue = getWizardQueue();

  return (
    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
      
      {/* Header and Info Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-lg font-black text-slate-850 flex items-center gap-2">
            <span>🔊</span> Toplu Sesli Karne Gönderim Merkezi
          </h3>
          <p className="text-xs text-slate-450 font-medium mt-1">
            Sınava giren tüm öğrenciler için yapay zeka sesli yorumlarını özel kısa bağlantılarla toplu olarak paylaşın.
          </p>
        </div>

        {/* Global Voice Setting */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
          {/* Automatic Shortlink Generation Indicator */}
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-[11px] font-black shadow-sm shrink-0">
            {generatingShortLinks ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                <span className="text-orange-600">Kısa Linkler Hazırlanıyor...</span>
              </>
            ) : shortlinkError ? (
              <>
                <span className="text-amber-500">⚠️</span>
                <span className="text-amber-600">{shortlinkError}</span>
              </>
            ) : (
              <>
                <span className="text-emerald-500">⚡</span>
                <span className="text-slate-650">Kısa Linkler Aktif ({Object.keys(shortIds).length} Hazır)</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <Volume2 className="w-4 h-4 text-orange-650 shrink-0" />
            <span className="text-xs font-black text-slate-700 whitespace-nowrap">Model Sesi:</span>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="text-xs font-bold text-slate-650 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="Kore">Kore (Samimi - Tavsiye Edilen)</option>
              <option value="Zephyr">Zephyr (Akıcı & Enerjik)</option>
              <option value="Fenrir">Fenrir (Net & Tok Ses)</option>
              <option value="Puck">Puck (Profesyonel Raporlama)</option>
              <option value="Charon">Charon (Resmi & Kurumsal)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Panel (Active when students filtered or selected) */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-700">
            {selectedIds.size > 0 ? (
              <>Seçilen Öğrenci Sayısı: <strong className="text-orange-600 text-sm font-black">{selectedIds.size} / {filteredStudents.length}</strong></>
            ) : (
              <>Seçim yapılmadı. Tüm <strong className="text-slate-850 font-black">{filteredStudents.length}</strong> öğrenci gönderim sırasına dahil edilecektir.</>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-bold">
            Öğrencileri tek tek göndermek yerine sihirbaz ile sırayla tek tıkla gönderebilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleCopyAllLinks}
            disabled={currentQueue.length === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer transition-all disabled:opacity-50"
            title="Sıradaki tüm öğrencilerin kısa linklerini bir liste halinde kopyala"
          >
            <Copy className="w-3.5 h-3.5 text-slate-600" />
            <span>Kısa Linkleri Kopyala</span>
          </button>

          <button
            onClick={startWizard}
            disabled={currentQueue.length === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 h-11 bg-orange-650 hover:bg-orange-700 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md shadow-orange-650/10 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>Toplu WhatsApp Göndericiyi Başlat</span>
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Öğrenci adı, no ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
          />
        </div>

        <div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 transition-all cursor-pointer"
          >
            <option value="all">Tüm Sınıflar</option>
            {distinctClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls} Sınıfı
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end px-3">
          <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200/60 px-4 py-2.5 rounded-xl shadow-sm">
            Gösterilen Öğrenci: <strong className="text-slate-800">{filteredStudents.length} / {sortedCalculatedResults.length}</strong>
          </span>
        </div>
      </div>

      {/* Info Notice Box */}
      <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-2xl text-xs text-orange-850 leading-relaxed font-medium space-y-1">
        <p className="font-bold flex items-center gap-1">
          <span>💡</span> Toplu Paylaşım Nasıl Çalışır?
        </p>
        <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px] text-orange-900/95 font-medium">
          <li><strong>Mükemmel Kısa Linkler</strong>: Ses analizi devasa uzunlukta veri taşır. Sistemimiz, verileri sizin için sunucudaki veri tabanında otomatik olarak sıkıştırıp sadece 8 haneli benzersiz kısa bağlantılar oluşturur. Böylece bağlantılar SMS karakter limitlerini aşmaz ve çok şık görünür!</li>
          <li><strong>Direkt Velinin Numarasına Gönderim</strong>: Öğrenci kayıt kartında kayıtlı olan veli veya öğrenci numarası otomatik olarak sorgulanır. WhatsApp butonu veya sihirbaza tıkladığınızda rehberde kayıtlı olmasa dahi doğrudan doğru kişinin WhatsApp sohbet ekranı mesajı hazır şekilde açılır!</li>
          <li><strong>Toplu WhatsApp Gönderim Asistanı</strong>: Yukarıdaki asistanı başlattığınızda açılan kontrol panelinde tek bir yeşil tuşa basarak tüm öğrencilerin mesajlarını sırasıyla 2 saniye içinde saniyeler gibi kısa sürede gönderebilirsiniz.</li>
        </ul>
      </div>

      {/* Students List Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-black uppercase text-slate-450 tracking-wider">
                <th className="py-3 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4 w-12 text-center">Derece</th>
                <th className="py-3 px-4">Öğrenci Bilgisi</th>
                <th className="py-3 px-4">Sınıf</th>
                <th className="py-3 px-4">İletişim Bilgisi</th>
                <th className="py-3 px-4">Net ve Başarı</th>
                <th className="py-3 px-4 text-center w-80">Sesli Rapor & Paylaşım İşlemleri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold text-xs">
                    Aranan kriterlere uygun öğrenci bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const globalRank = sortedCalculatedResults.findIndex(s => s.recordId === student.recordId) + 1;
                  const correct = student.totals?.correct ?? 0;
                  const wrong = student.totals?.wrong ?? 0;
                  const net = student.totals?.net ?? 0;
                  const totalQuestionsInExam = (student.subjects || []).reduce((sum: number, sh: any) => sum + sh.totalQuestions, 0);
                  const successRate = totalQuestionsInExam > 0 ? Number(((correct / totalQuestionsInExam) * 100).toFixed(0)) : 0;

                  const isCopying = copiedId === student.recordId;
                  const isPlayingThis = playingStudentId === student.recordId;
                  const isLoadingThis = previewLoadingId === student.recordId;

                  const phone = getStudentPhone(student);
                  const isSelected = selectedIds.has(student.recordId);

                  return (
                    <tr key={student.recordId} className={`hover:bg-slate-50/50 transition-colors group ${isSelected ? "bg-orange-50/10" : ""}`}>
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(student.recordId)}
                          className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                        />
                      </td>

                      {/* Rank */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 text-[11px] font-black text-slate-700">
                          {globalRank}
                        </span>
                      </td>

                      {/* Name & Number */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 text-xs">{student.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-bold">No: {student.studentNumber || "-"}</div>
                      </td>

                      {/* Classroom */}
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-bold text-slate-650 bg-slate-100/60 px-2.5 py-1 rounded-md">
                          {student.classroom || "Sınıfsız"}
                        </span>
                      </td>

                      {/* Phone Matching */}
                      <td className="py-3 px-4">
                        {phone ? (
                          <div className="text-xs font-black text-slate-700 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {phone}
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-slate-400 italic">Telefon kayıtlı değil</div>
                        )}
                      </td>

                      {/* Totals */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-700">{net.toFixed(2)} Net</span>
                          <span className="text-[10px] font-black text-slate-400">|</span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            successRate >= 70 ? "bg-green-50 text-green-700" :
                            successRate >= 40 ? "bg-amber-50 text-amber-700" :
                            "bg-rose-50 text-rose-700"
                          }`}>
                            %{successRate} Başarı
                          </span>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Live Preview Play button */}
                          <button
                            onClick={() => handleTogglePreview(student)}
                            disabled={isLoadingThis}
                            className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                              isPlayingThis
                                ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm"
                                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                            }`}
                            title="Öğrencinin sesli raporunu canlı dinleyin"
                          >
                            {isLoadingThis ? (
                              <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                            ) : isPlayingThis ? (
                              <>
                                <Pause className="w-3 h-3 fill-amber-700 text-amber-700" />
                                <span>Durdur</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-slate-500 text-slate-500" />
                                <span>Dinle</span>
                              </>
                            )}
                          </button>

                          {/* Copy Link */}
                          <button
                            onClick={() => handleCopyLink(student)}
                            className={`flex items-center gap-1 px-3 h-9 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                              isCopying
                                ? "bg-green-50 border-green-200 text-green-700"
                                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                            }`}
                            title="Sesli karne bağlantısını kopyala"
                          >
                            {isCopying ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-600" />
                                <span>Kopyalandı</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                                <span>Linki Kopyala</span>
                              </>
                            )}
                          </button>

                          {/* API Direct Send */}
                          {whatsappConfig?.apiKey && (
                            <button
                              onClick={() => handleSendViaApi(student)}
                              disabled={rowSendingStatus[student.recordId] === "sending"}
                              className={`flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                rowSendingStatus[student.recordId] === "success"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : rowSendingStatus[student.recordId] === "error"
                                  ? "bg-rose-50 border-rose-200 text-rose-700"
                                  : "bg-sky-50 border-sky-150 hover:bg-sky-100 text-sky-850"
                              }`}
                              title="Mesajı mhatsapp.com API üzerinden doğrudan arka planda gönder"
                            >
                              {rowSendingStatus[student.recordId] === "sending" ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                                  <span>Gönderiliyor</span>
                                </>
                              ) : rowSendingStatus[student.recordId] === "success" ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>API İletildi</span>
                                </>
                              ) : rowSendingStatus[student.recordId] === "error" ? (
                                <>
                                  <span className="text-rose-500 font-bold">⚠️</span>
                                  <span>Başarısız</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 text-sky-600 animate-pulse" />
                                  <span>API Gönder</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* WhatsApp Share */}
                          <button
                            onClick={() => handleShareWhatsApp(student)}
                            className="flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-xl text-[11px] font-bold text-white bg-[#25D366] hover:bg-[#20ba5a] transition-all cursor-pointer shadow-sm shadow-[#25d366]/10"
                            title="WhatsApp Web / Uygulaması ile paylaş (Tarayıcıda yeni sekme açar)"
                          >
                            <Share2 className="w-3.5 h-3.5 text-white" />
                            <span>WhatsApp Web</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sequential Sending Wizard Modal Overlay */}
      {wizardActive && currentQueue[wizardIndex] && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl p-6 relative overflow-hidden space-y-6">
            
            {/* Top orange line indicator */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 to-amber-500"></div>

            {/* Modal Header */}
            <div className="flex justify-between items-start pt-2">
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-650 px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider uppercase">
                  Toplu İletişim Sihirbazı
                </span>
                <h4 className="text-base font-black text-slate-850">WhatsApp Gönderim Ekranı</h4>
              </div>
              <button 
                onClick={() => setWizardActive(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-black text-slate-500">
                <span>Gönderilen: <strong className="text-slate-800">{wizardIndex + 1} / {currentQueue.length} Öğrenci</strong></span>
                <span>Tamamlanan: {Math.round(((wizardIndex) / currentQueue.length) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-300 rounded-full" 
                  style={{ width: `${((wizardIndex + 1) / currentQueue.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Student Info Card inside wizard */}
            {(() => {
              const student = currentQueue[wizardIndex];
              const rank = sortedCalculatedResults.findIndex(s => s.recordId === student.recordId) + 1;
              const phone = getStudentPhone(student);
              const alreadySent = wizardSentIds.has(student.recordId);

              return (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                        <span>{student.studentName}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-bold">Derece: {rank}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">{student.classroom} Sınıfı • Sınav No: {student.studentNumber || "-"}</p>
                    </div>

                    {alreadySent && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> Gönderildi
                      </span>
                    )}
                  </div>

                  <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between text-[11px] font-bold">
                    <div className="text-slate-500">Kayıtlı Alıcı Telefon:</div>
                    <div className="text-slate-800 flex items-center gap-1">
                      {phone ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {phone}
                        </>
                      ) : (
                        <span className="text-amber-600 italic">Bulunamadı (WhatsApp Arama Ekranı Açılacak)</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Message preview block */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex justify-between items-center">
                <span>Gönderilecek Mesaj Taslağı</span>
                <span className="text-[10px] text-slate-400 font-bold">Metni düzenleyebilirsiniz</span>
              </label>
              <textarea
                value={customWizardMessage}
                onChange={(e) => setCustomWizardMessage(e.target.value)}
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 transition-all leading-relaxed"
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useFixedMessage}
                  onChange={(e) => setUseFixedMessage(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                />
                <span className="text-[11px] font-bold text-slate-700">Bu mesajı tüm öğrencilere sabit olarak uygula (Şablon değişkenleri dikkate alınmaz, sadece {'{link}'} güncellenir)</span>
              </label>
            </div>

            {/* API Sending Mode Alert / Status */}
            {isSendingAuto && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <div className="text-xs text-emerald-800 font-bold">
                  Arka planda otomatik toplu gönderim yapılıyor... Başarılı: {autoSendSuccessCount} / {currentQueue.length}
                </div>
              </div>
            )}

            {/* Wizard Controls */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={handleWizardPrev}
                  disabled={wizardIndex === 0 || isSendingAuto}
                  className="px-4 h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black cursor-pointer transition-colors disabled:opacity-30"
                >
                  Önceki
                </button>

                <button
                  onClick={handleWizardSkip}
                  disabled={isSendingAuto}
                  className="px-4 h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black cursor-pointer transition-colors disabled:opacity-30"
                >
                  Atla
                </button>

                <button
                  onClick={handleWizardSend}
                  disabled={isSendingAuto}
                  className="flex-1 flex items-center justify-center gap-2 h-11 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md shadow-[#25d366]/10 disabled:opacity-50"
                >
                  <Share2 className="w-4 h-4 text-white" />
                  <span>WhatsApp'ta Gönder & İlerle</span>
                </button>
              </div>

              {/* API Integration Direct Buttons (Visible only if API config is present) */}
              {whatsappConfig?.apiKey ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleSendWizardCurrentViaApi}
                    disabled={isSendingAuto}
                    className="flex items-center justify-center gap-1.5 h-11 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 rounded-xl text-xs font-black cursor-pointer transition-all disabled:opacity-50"
                  >
                    <span>⚡ Bu Öğrenciyi API ile Gönder</span>
                  </button>

                  <button
                    onClick={handleAutoSendAll}
                    disabled={isSendingAuto}
                    className="flex items-center justify-center gap-1.5 h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md shadow-emerald-500/10 disabled:opacity-50"
                  >
                    {isSendingAuto ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Sırayla Gönderiliyor...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                        <span>Tüm Sırayı Otomatik Gönder</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-center font-bold">
                  💡 Sol menüden <strong>WhatsApp Entegrasyonu</strong> ayarlarını tanımlarsanız, arka planda tek tıkla otomatik gönderim sihirbazını da kullanabilirsiniz!
                </div>
              )}
            </div>

            {/* Hint footer */}
            <p className="text-[10px] text-slate-400 font-bold text-center">
              "WhatsApp'ta Gönder" tuşuna basıldığında yeni sekme açılır, mesaj otomatik yapışır. Ardından geri dönüp sonraki öğrencilere devam edebilirsiniz.
            </p>

          </div>
        </div>
      )}


    </div>
  );
}
