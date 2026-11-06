import React, { useEffect, useState } from "react";
import {
  Check, Copy, Download, Loader2, Pause, Play, Search, Share2, Sparkles, Square, Volume2, X,
} from "lucide-react";
import { generateLessonSpeechText } from "./ttsUtils";

interface LessonTTSAnalysisViewProps {
  selectedSubject: string;
  questionAnalysisData: any[];
  subjectAverageData: any[];
}

export function LessonTTSAnalysisView({ selectedSubject, questionAnalysisData, subjectAverageData }: LessonTTSAnalysisViewProps) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("Kore");
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSubject) {
      setText(generateLessonSpeechText(selectedSubject, questionAnalysisData, subjectAverageData));
      if (audio) {
        audio.pause();
        setIsPlaying(false);
        setAudio(null);
      }
    }
  }, [selectedSubject, questionAnalysisData, subjectAverageData]);

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
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-650 flex items-center justify-center">
          <Volume2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-black text-slate-800 text-sm">Sesli Ders Performans Raporlama (TTS)</h3>
          <p className="text-[10px] text-slate-500 font-bold">Dersin genel net ortalamasını ve kazanım dökümünü sesli dinleyin</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Text Area */}
        <div className="lg:col-span-7 space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">Okunacak Sınıf Genel Özet Metni (Düzenlenebilir)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-64 p-4 rounded-2xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-semibold text-slate-700 text-xs leading-relaxed resize-none outline-none transition-colors"
            placeholder="Seslendirilecek metni buraya yazın..."
          />
          <span className="text-[9px] text-slate-400 font-bold block">💡 İpucu: Metni düzenleyebilir veya öğretmen görüşleri ekleyebilirsiniz.</span>
        </div>

        {/* Right Side: Player Panel */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50/50 border border-slate-200/80 rounded-2xl p-6">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">Seçili Test</span>
              <h4 className="text-sm font-black text-slate-800 mt-1">{selectedSubject} Testi</h4>
              <p className="text-[10px] text-slate-500 font-bold">{questionAnalysisData.length} Soru Kazanımı • Sınıf Genel Analizi</p>
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
        </div>
      </div>
    </div>
  );
}

