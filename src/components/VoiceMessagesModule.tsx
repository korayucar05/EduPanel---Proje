import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Trash2, Send, Clock, PlayCircle } from "lucide-react";
import { communicationService } from "../modules/communication";

interface VoiceMessage {
  id: string;
  title: string;
  duration: number; // in seconds
  timestamp: string;
  sender: string;
}

export default function VoiceMessagesModule() {
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let active = true;
    communicationService.listVoiceMessages().then((rows) => { if (active) setMessages(rows); }).catch(() => {});
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const newMessage = await communicationService.saveVoiceMessage({
        title: `Yeni Sesli Mesaj (${new Date().toLocaleDateString('tr-TR')})`,
        duration: recordingTime,
        sender: "Siz",
        status: "ready",
      });
      setMessages((current) => [newMessage, ...current.filter((item) => item.id !== newMessage.id)]);
    } catch (error) {
      console.error("Sesli mesaj kaydedilemedi", error);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDelete = async (id: string) => {
    try {
      await communicationService.deleteVoiceMessage(id);
      setMessages((current) => current.filter((message) => message.id !== id));
    } catch (error) {
      console.error("Sesli mesaj silinemedi", error);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3 border-b border-purple-100 pb-4">
        <div className="bg-purple-100 p-2 rounded-xl text-purple-700">
          <Mic className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Sesli Mesajlar</h2>
          <p className="text-xs text-slate-500 font-medium">Öğrenci ve velilere sesli mesaj kaydedin ve gönderin</p>
        </div>
      </div>

      {/* Recorder Section */}
      <div className="bg-white border-2 border-dashed border-purple-200 rounded-3xl p-8 flex flex-col items-center justify-center space-y-6 shadow-sm relative overflow-hidden">
        {isRecording && (
          <div className="absolute inset-0 bg-red-50/50 animate-pulse pointer-events-none" />
        )}
        
        <div className="text-center z-10 space-y-2">
          <h3 className="text-slate-800 font-bold text-lg">
            {isRecording ? "Kaydediliyor..." : "Yeni Mesaj Kaydet"}
          </h3>
          <p className="text-slate-500 text-sm font-medium">
            {isRecording 
              ? "Konuşmanızı bitirdiğinizde durdur butonuna basın" 
              : "Kayda başlamak için mikrofon butonuna basın"}
          </p>
        </div>

        <div className="flex items-center justify-center gap-6 z-10">
          {isRecording ? (
            <div className="flex items-center gap-4">
              <span className="text-rose-600 font-mono font-bold text-2xl tracking-wider w-20 text-center">
                {formatTime(recordingTime)}
              </span>
              <button 
                onClick={stopRecording}
                className="w-16 h-16 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/30 transition-all hover:scale-105 cursor-pointer"
              >
                <Square className="w-6 h-6 fill-current" />
              </button>
            </div>
          ) : (
            <button 
              onClick={startRecording}
              className="w-16 h-16 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center text-white shadow-lg shadow-purple-600/30 transition-all hover:scale-105 cursor-pointer"
            >
              <Mic className="w-7 h-7" />
            </button>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-slate-800 font-bold text-sm flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-purple-600" />
            Kayıtlı Mesajlar
          </h3>
        </div>
        
        <div className="divide-y divide-slate-100">
          {messages.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm font-medium">
              Henüz kaydedilmiş bir sesli mesaj bulunmuyor.
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="p-5 flex flex-col sm:flex-row gap-4 justify-between group hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  <button className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 hover:bg-purple-200 transition-colors cursor-pointer">
                    <Play className="w-4 h-4 ml-0.5 fill-current" />
                  </button>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{message.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(message.duration)}
                      </span>
                      <span>•</span>
                      <span>{new Date(message.timestamp).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span>{message.sender}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 self-start sm:self-center ml-13 sm:ml-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-[14.67px] rounded-lg transition-colors cursor-pointer">
                    <Send className="w-3.5 h-3.5" />
                    Gönder
                  </button>
                  <button 
                    onClick={() => handleDelete(message.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
