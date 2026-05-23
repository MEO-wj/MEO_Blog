import { useCallback, useRef } from "react";

const SOUND_FILES: Record<string, string> = {
  "project-hover": "/sound/02. Bumper End.mp3",
  "action-hover": "/sound/04. Default Activation.mp3",
  "action-click": "/sound/08. Message Toast.mp3",
  "project-click": "/sound/11. Out Of Game Detail.mp3",
  "close": "/sound/07. Launch Game.mp3",
};

const audioCache: Record<string, HTMLAudioElement> = {};

function getAudio(name: string): HTMLAudioElement {
  if (!audioCache[name]) {
    const src = SOUND_FILES[name];
    if (!src) return new Audio();
    const audio = new Audio(src);
    audio.volume = 0.4;
    audioCache[name] = audio;
  }
  return audioCache[name];
}

// Release all cached audio on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    for (const key of Object.keys(audioCache)) {
      audioCache[key].pause();
      audioCache[key].src = "";
      delete audioCache[key];
    }
  });
}

export function useSound() {
  const lastPlayRef = useRef<Record<string, number>>({});

  const play = useCallback((name: string) => {
    const now = Date.now();
    const last = lastPlayRef.current[name] || 0;
    if (now - last < 100) return;
    lastPlayRef.current[name] = now;

    try {
      const audio = getAudio(name);
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  return { play };
}
