const SOUND_URL = "/sounds/enstitu-digital.wav";
let audio: HTMLAudioElement | null = null;
let queued = false;
let installed = false;

const player = () => {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.preload = "auto";
    audio.volume = 1.0;
  }
  return audio;
};

const playNow = async () => {
  const item = player();
  if (!item) return false;
  try {
    item.currentTime = 0;
    await item.play();
    queued = false;
    return true;
  } catch {
    queued = true;
    return false;
  }
};

export const installEnstituSoundUnlock = () => {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  const unlock = async () => {
    const item = player();
    if (!item) return;
    try {
      item.muted = true;
      await item.play();
      item.pause();
      item.currentTime = 0;
      item.muted = false;
    } catch {
      item.muted = false;
    }
    if (queued) void playNow();
  };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });
};

export const playEnstituNotificationSound = async () => {
  installEnstituSoundUnlock();
  return playNow();
};
