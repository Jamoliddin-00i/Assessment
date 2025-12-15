"use client";

import { useCallback, useEffect, useState } from "react";

type SoundType =
  | "click"
  | "hover"
  | "success"
  | "error"
  | "notification"
  | "whoosh"
  | "pop"
  | "achievement";

// Sound frequencies and patterns for Web Audio API
const soundConfigs: Record<SoundType, { frequencies: number[]; duration: number; type: OscillatorType; gain: number }> = {
  click: {
    frequencies: [800, 600],
    duration: 0.05,
    type: "sine",
    gain: 0.1,
  },
  hover: {
    frequencies: [400, 500],
    duration: 0.03,
    type: "sine",
    gain: 0.05,
  },
  success: {
    frequencies: [523, 659, 784],
    duration: 0.15,
    type: "sine",
    gain: 0.15,
  },
  error: {
    frequencies: [200, 150],
    duration: 0.2,
    type: "sawtooth",
    gain: 0.1,
  },
  notification: {
    frequencies: [880, 1100, 880],
    duration: 0.1,
    type: "sine",
    gain: 0.12,
  },
  whoosh: {
    frequencies: [100, 800],
    duration: 0.15,
    type: "sine",
    gain: 0.08,
  },
  pop: {
    frequencies: [1000, 500],
    duration: 0.04,
    type: "sine",
    gain: 0.12,
  },
  achievement: {
    frequencies: [523, 659, 784, 1047],
    duration: 0.12,
    type: "sine",
    gain: 0.18,
  },
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

function playTone(
  frequencies: number[],
  duration: number,
  type: OscillatorType,
  gain: number
) {
  try {
    const ctx = getAudioContext();

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

      gainNode.gain.setValueAtTime(gain, ctx.currentTime + index * duration * 0.3);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + (index + 1) * duration * 0.3 + duration
      );

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime + index * duration * 0.3);
      oscillator.stop(ctx.currentTime + (index + 1) * duration * 0.3 + duration);
    });
  } catch (error) {
    console.warn("Audio playback failed:", error);
  }
}

export function useSoundEffects() {
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("sound-effects-enabled");
    if (saved !== null) {
      setSoundEnabled(saved === "true");
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const newValue = !prev;
      localStorage.setItem("sound-effects-enabled", String(newValue));
      return newValue;
    });
  }, []);

  const playSound = useCallback(
    (sound: SoundType) => {
      if (!soundEnabled) return;

      const config = soundConfigs[sound];
      if (config) {
        playTone(config.frequencies, config.duration, config.type, config.gain);
      }
    },
    [soundEnabled]
  );

  return {
    playSound,
    soundEnabled,
    toggleSound,
  };
}

// Singleton for global access
let globalSoundEnabled = true;

export function setGlobalSoundEnabled(enabled: boolean) {
  globalSoundEnabled = enabled;
  localStorage.setItem("sound-effects-enabled", String(enabled));
}

export function playGlobalSound(sound: SoundType) {
  if (!globalSoundEnabled) return;

  const saved = localStorage.getItem("sound-effects-enabled");
  if (saved === "false") return;

  const config = soundConfigs[sound];
  if (config) {
    playTone(config.frequencies, config.duration, config.type, config.gain);
  }
}
