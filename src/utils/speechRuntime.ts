export type SpeechRecognitionCtor = new () => any;

export type SpeechEnvironmentStatus = {
  supported: boolean;
  secureContext: boolean;
  hasMediaDevices: boolean;
  browser: "edge" | "chrome" | "other";
};

const getBrowser = (): SpeechEnvironmentStatus["browser"] => {
  if (typeof navigator === "undefined") return "other";
  const ua = String(navigator.userAgent || "");
  if (/Edg\//i.test(ua)) return "edge";
  if (/Chrome\//i.test(ua) || /Chromium\//i.test(ua)) return "chrome";
  return "other";
};

export const getSpeechRecognitionCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  return ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
};

export const getSpeechEnvironmentStatus = (): SpeechEnvironmentStatus => ({
  supported: Boolean(getSpeechRecognitionCtor()),
  secureContext: typeof window !== "undefined" ? Boolean(window.isSecureContext) : false,
  hasMediaDevices: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
  browser: getBrowser(),
});

export const requestMicrophoneStream = async (): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error("media-devices-unavailable"), { code: "media-devices-unavailable" });
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
};

export const stopMicrophoneStream = (stream: MediaStream | null | undefined) => {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    // no-op
  }
};

export const startRecognitionUsingStream = (recognition: any, stream: MediaStream | null | undefined) => {
  // getUserMedia yalnızca mikrofon iznini erkenden doğrulamak için kullanılıyor.
  // SpeechRecognition.start(MediaStreamTrack) hâlâ deneysel ve Edge/Chromium sürümleri
  // arasında tutarsız. Ayrıca açık getUserMedia akışı ile SpeechRecognition'ın aynı
  // mikrofonu eşzamanlı açması Windows'ta sorun çıkarabiliyor. İzni aldıktan sonra
  // geçici akışı kapatıp kararlı, standart start() yolunu kullanıyoruz.
  stopMicrophoneStream(stream);
  recognition.start();
  return "default" as const;
};

export const describeSpeechError = (errorLike: any): string => {
  const raw = String(errorLike?.error || errorLike?.code || errorLike?.name || errorLike?.message || errorLike || "").toLowerCase();
  const status = getSpeechEnvironmentStatus();

  if (raw.includes("not-allowed") || raw.includes("permission") || raw.includes("denied")) {
    return "Mikrofon izni kapalı. Adres çubuğundaki kilit simgesinden Mikrofon = İzin ver yapın ve tekrar deneyin.";
  }
  if (raw.includes("service-not-allowed")) {
    return status.browser === "edge"
      ? "Edge ses tanıma hizmetine izin vermiyor. Edge kurum politikası bunu kapatmış olabilir. Chrome ile açmayı deneyin veya Windows sesle yazma (Win+H) yedeğini kullanın."
      : "Tarayıcının ses tanıma hizmeti engellendi. Tarayıcı/site izinlerini kontrol edin.";
  }
  if (raw.includes("language-not-supported") || raw.includes("language-unavailable")) {
    return "Türkçe ses tanıma bu tarayıcıda kullanılamıyor. Chrome ile deneyin; uygulamadaki Win+H sesle yazma yedeği de kullanılabilir.";
  }
  if (raw.includes("audio-capture") || raw.includes("notreadable") || raw.includes("track-start")) {
    return "Mikrofon başka bir uygulama tarafından kullanılıyor veya ses girişi başlatılamadı. Mikrofon kullanan diğer uygulamaları kapatıp tekrar deneyin.";
  }
  if (raw.includes("network")) {
    return status.browser === "edge"
      ? "Edge ses tanıma servisine bağlanamadı. İnternet/kurum ağı veya Edge ses politikası engelliyor olabilir. Chrome ya da Win+H yedeğini kullanın."
      : "Ses tanıma servisine bağlanamadı. İnternet bağlantısını kontrol edin ve tekrar deneyin.";
  }
  if (raw.includes("phrases-not-supported")) {
    return "Tarayıcı deneysel kelime önceliklendirmesini desteklemiyor. Standart ses tanıma moduna geçiliyor.";
  }
  if (raw.includes("no-speech")) {
    return "Konuşma duyulmadı. Mikrofon açık; biraz daha yakından ve kısa komutlarla tekrar söyleyin.";
  }
  if (raw.includes("aborted")) {
    return "Ses tanıma oturumu kapandı.";
  }
  if (raw.includes("media-devices-unavailable")) {
    return "Bu ortam mikrofon erişimini desteklemiyor. Uygulamayı http://localhost:3000 üzerinden Chrome/Edge ile açın.";
  }

  return raw
    ? `Ses motoru hatası: ${raw}. Mikrofon/site izinlerini kontrol edin.`
    : "Ses motoru başlatılamadı. Mikrofon/site izinlerini kontrol edin.";
};

export const buildSpeechDiagnostics = (): string => {
  const status = getSpeechEnvironmentStatus();
  const browserLabel = status.browser === "edge" ? "Edge" : status.browser === "chrome" ? "Chrome" : "Tarayıcı";
  if (!status.secureContext) {
    return `${browserLabel}: güvenli bağlam değil. Ses için uygulamayı http://localhost:3000 üzerinden açın.`;
  }
  if (!status.supported) {
    return `${browserLabel}: SpeechRecognition API bulunamadı. Chrome masaüstü sürümünü kullanın veya Win+H yedeğini kullanın.`;
  }
  if (!status.hasMediaDevices) {
    return `${browserLabel}: mikrofon API'si bulunamadı.`;
  }
  return `${browserLabel}: ses API'si hazır. Mikrofon izni istendiğinde İzin verin.`;
};
