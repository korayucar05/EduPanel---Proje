import React, { useEffect, useState } from "react";
import localforage from "localforage";
import {
  Check, Copy, Download, Loader2, Pause, Play, Search, Share2, Sparkles, Square, Volume2, X,
} from "lucide-react";
import { cleanPhone, generateStudentSpeechText } from "./ttsUtils";

interface StudentTTSAnalysisViewProps {
  selectedStudent: any;
  sortedCalculatedResults: any[];
  activeExam?: any;
}

  export function StudentTTSAnalysisView({ selectedStudent, sortedCalculatedResults, activeExam }: StudentTTSAnalysisViewProps) {
    const [text, setText] = useState("");
    const [voice, setVoice] = useState("Kore");
    const [loading, setLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [whatsappConfig, setWhatsappConfig] = useState<any>(null);

    useEffect(() => {
      localforage.getItem("whatsappConfig").then((saved: any) => {
        if (saved) {
          setWhatsappConfig({
            apiUrl: saved.apiUrl || "https://api.mhatsapp.com/api/v3/message/send/",
            apiKey: saved.apiKey || "b8c3e4f6-1234-4abc-9def-0123456789ab",
            senderPhone: saved.senderPhone || "",
            messageTemplate: saved.messageTemplate || "Merhaba, *{ogrenci_adi}* için hazırlanan *{sinav_adi}* sesli yapay zeka deneme sınavı analiz dökümünü aşağıdaki bağlantıdan dinleyebilirsiniz:\n\n🎧 {link}"
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

    const getShareUrl = () => {
      const base = window.location.origin.replace("ais-dev-", "ais-pre-");
      return `${base}/api/tts/stream?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
    };

    const handleCopyLink = async () => {
      try {
        const shareUrl = getShareUrl();
        await navigator.clipboard.writeText(shareUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error(err);
        setError("Bağlantı kopyalanamadı.");
      }
    };

    const handleShareWhatsApp = async () => {
      try {
        const config = whatsappConfig;
        if (!config || !config.apiKey) {
          throw new Error("WhatsApp API ayarları (API Anahtarı) yapılandırılmamış. Lütfen sol menüden 'WhatsApp Entegrasyonu' ayarlarını tamamlayın.");
        }
  
        const phone = selectedStudent?.parentPhone || selectedStudent?.studentPhone || "";
        const cleanPh = cleanPhone(phone);
        
        if (!cleanPh) {
          throw new Error("Öğrencinin/Velinin geçerli bir telefon numarası bulunamadı.");
        }
  
        const shareUrl = getShareUrl();
        const message = formatWhatsappMessage(selectedStudent, shareUrl);
  
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

    const handleDownload = () => {
      if (!audio || !audio.src) {
        setError("Lütfen indirmeden önce en az bir kez 'Sesi Başlat' butonuna tıklayarak sesi sentezleyin.");
        return;
      }
      const link = document.createElement("a");
      link.href = audio.src;
      link.download = `${selectedStudent?.studentName || "Ogrenci"}_Deneme_Analizi.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  
    // Auto-generate speech text when student changes
    useEffect(() => {
      if (selectedStudent) {
        setText(generateStudentSpeechText(selectedStudent, sortedCalculatedResults));
        // Stop and reset audio if playing
        if (audio) {
          audio.pause();
          setIsPlaying(false);
          setAudio(null);
        }
      }
    }, [selectedStudent, sortedCalculatedResults]);
  
    // Audio lifecycle cleanup
    useEffect(() => {
      return () => {
        if (audio) {
          audio.pause();
        }
      };
    }, [audio]);
  
    const handleGenerateAndPlay = async () => {
      try {
        setError(null);
        setLoading(true);
  
        if (audio) {
          audio.pause();
          setAudio(null);
        }
  
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice }),
        });
  
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Ses dosyası oluşturulurken bir sorun oluştu.");
        }
  
        const data = await response.json();
      const mime = data.mimeType || 'audio/wav';
      const audioUrl = `data:${mime};base64,${data.audio}`;
      const newAudio = new Audio(audioUrl);

      newAudio.onended = () => {
        setIsPlaying(false);
      };

      newAudio.onerror = () => {
        setError("Ses çalınırken bir hata oluştu.");
        setIsPlaying(false);
      };

      setAudio(newAudio);
      setIsPlaying(true);
      newAudio.play();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Bilinmeyen bir hata.");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlay = () => {
    if (!audio) {
      handleGenerateAndPlay();
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
    }
  };

  return (
    <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs space-y-6">
      <style>{`
        @keyframes eq-1 { 0%, 100% { height: 4px; } 50% { height: 40px; } }
        @keyframes eq-2 { 0%, 100% { height: 10px; } 50% { height: 32px; } }
        @keyframes eq-3 { 0%, 100% { height: 6px; } 50% { height: 44px; } }
        @keyframes eq-4 { 0%, 100% { height: 15px; } 50% { height: 24px; } }
        @keyframes eq-5 { 0%, 100% { height: 8px; } 50% { height: 36px; } }
        @keyframes eq-6 { 0%, 100% { height: 12px; } 50% { height: 48px; } }
        @keyframes eq-7 { 0%, 100% { height: 5px; } 50% { height: 28px; } }
        @keyframes eq-8 { 0%, 100% { height: 14px; } 50% { height: 42px; } }
        
        .animate-eq-1 { animation: eq-1 0.8s ease-in-out infinite; }
        .animate-eq-2 { animation: eq-2 0.6s ease-in-out infinite; }
        .animate-eq-3 { animation: eq-3 0.9s ease-in-out infinite; }
        .animate-eq-4 { animation: eq-4 0.7s ease-in-out infinite; }
        .animate-eq-5 { animation: eq-5 1.1s ease-in-out infinite; }
        .animate-eq-6 { animation: eq-6 0.5s ease-in-out infinite; }
        .animate-eq-7 { animation: eq-7 1.0s ease-in-out infinite; }
        .animate-eq-8 { animation: eq-8 0.75s ease-in-out infinite; }
      `}</style>

      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-650 flex items-center justify-center">
          <Volume2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-black text-slate-800 text-sm">Sesli Yapay Zeka Öğrenci Karnesi (TTS)</h3>
          <p className="text-[10px] text-slate-500 font-bold">Öğrencinin performansını sesli özet döküm olarak dinleyin veya paylaşın</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Text Area */}
        <div className="lg:col-span-7 space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">Okunacak Özet Metni (Düzenlenebilir)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-64 p-4 rounded-2xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-semibold text-slate-700 text-xs leading-relaxed resize-none outline-none transition-colors"
            placeholder="Seslendirilecek metni buraya yazın..."
          />
          <span className="text-[9px] text-slate-400 font-bold block">💡 İpucu: Metni dilediğiniz gibi düzenleyebilir veya kişiselleştirilmiş notlar ekleyebilirsiniz.</span>
        </div>

        {/* Right Side: Player Panel */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50/50 border border-slate-200/80 rounded-2xl p-6">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">Seçili Aday</span>
              <h4 className="text-sm font-black text-slate-800 mt-1">{selectedStudent?.studentName || "Öğrenci Seçilmedi"}</h4>
              <p className="text-[10px] text-slate-500 font-bold">{selectedStudent?.classroom || "Şube"} • Okul No: {selectedStudent?.studentNumber || "-"}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">Yapay Zeka Ses Modeli</label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-orange-500"
              >
                <option value="Kore">Kore (Samimi & Türkçe Uyumlu - Tavsiye Edilen)</option>
                <option value="Zephyr">Zephyr (Akıcı & Enerjik)</option>
                <option value="Fenrir">Fenrir (Net & Tok Ses)</option>
                <option value="Puck">Puck (Profesyonel Raporlama)</option>
                <option value="Charon">Charon (Resmi & Kurumsal)</option>
              </select>
            </div>

            {/* Visualizer and Status */}
            <div className="bg-white border rounded-xl p-4 flex flex-col items-center justify-center min-h-[100px] relative overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-orange-650 animate-spin" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider animate-pulse">Ses Sentezleniyor...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  {/* Equalizer Waveform */}
                  <div className="flex items-end justify-center gap-1.5 h-12 w-36 px-2 overflow-hidden">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
                      return (
                        <div
                          key={i}
                          className={`w-2 bg-orange-650 rounded-t-sm transition-all duration-300 ${
                            isPlaying ? `animate-eq-${i}` : "h-1.5"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">
                    {isPlaying ? "Ses Çalınıyor..." : "Hazır / Beklemede"}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] text-rose-700 font-bold leading-normal">
                ⚠️ Hata: {error}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={handleTogglePlay}
              disabled={loading || !text.trim()}
              className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-black transition-all cursor-pointer ${
                isPlaying
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-orange-850 hover:bg-orange-900 text-white"
              } disabled:opacity-50`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-white" />
                  Duraklat
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Sesi Başlat
                </>
              )}
            </button>

            <button
              onClick={handleStop}
              disabled={!audio}
              className="px-4 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              title="Durdur"
            >
              <Square className="w-4 h-4 fill-slate-600" />
            </button>
          </div>

          {/* Share Section */}
          <div className="mt-5 pt-5 border-t border-slate-200 space-y-3">
            <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">Öğrenciyle Paylaş ve Gönder</span>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={handleShareWhatsApp}
                disabled={!text.trim()}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#20ba5a] transition-all cursor-pointer disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp ile Paylaş
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopyLink}
                  disabled={!text.trim()}
                  className={`flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                    copySuccess
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Kopyalandı!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      Bağlantıyı Kopyala
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  disabled={!audio}
                  className="flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
                  title="Ses dosyasını bilgisayarınıza veya telefonunuza indirin"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  Sesi İndir (WAV)
                </button>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 font-bold leading-normal">
              💡 <strong className="text-slate-500">Nasıl Çalışır?</strong> Bağlantıyı kopyalayıp SMS veya e-posta ile gönderebilirsiniz. Öğrenci linke tıkladığında sesli karnesini anında dinleyebilir. Sesi indirerek WhatsApp'tan doğrudan ses dosyası olarak da yollayabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

