"use client";

import { useCallback, useEffect, useState } from "react";

type SoundType = "click" | "success" | "error" | "open" | "close" | "select" | "toggle" | "upload" | "delete" | "submit" | "achievement";

type ThemeId = "light" | "dark" | "cyberpunk" | "ocean" | "sunset" | "forest" | "galaxy" | "aurora" | "retro" | "midnight";

// Global cached theme - avoids repeated localStorage reads
let cachedTheme: ThemeId = "light";

// Initialize theme cache once
if (typeof window !== "undefined") {
  cachedTheme = (localStorage.getItem("app-theme") as ThemeId) || "light";
  // Listen for theme changes from other components
  window.addEventListener("storage", (e) => {
    if (e.key === "app-theme" && e.newValue) {
      cachedTheme = e.newValue as ThemeId;
    }
  });
}

// Allow other components to update the cached theme
export function updateCachedTheme(theme: ThemeId) {
  cachedTheme = theme;
}

interface SoundConfig {
  frequencies: number[];
  duration: number;
  type: OscillatorType;
  gain: number;
}

// Simplified theme-specific sound configurations
const themeSoundConfigs: Record<ThemeId, Record<SoundType, SoundConfig>> = {
  light: {
    click: { frequencies: [880], duration: 0.03, type: "sine", gain: 0.06 },
    success: { frequencies: [523, 659, 784], duration: 0.1, type: "sine", gain: 0.1 },
    error: { frequencies: [220, 180], duration: 0.12, type: "triangle", gain: 0.08 },
    open: { frequencies: [400, 600], duration: 0.06, type: "sine", gain: 0.05 },
    close: { frequencies: [600, 400], duration: 0.06, type: "sine", gain: 0.05 },
    select: { frequencies: [1000], duration: 0.03, type: "sine", gain: 0.06 },
    toggle: { frequencies: [700, 900], duration: 0.04, type: "sine", gain: 0.06 },
    upload: { frequencies: [500, 700, 900], duration: 0.08, type: "sine", gain: 0.08 },
    delete: { frequencies: [400, 300], duration: 0.08, type: "triangle", gain: 0.06 },
    submit: { frequencies: [600, 800, 1000], duration: 0.1, type: "sine", gain: 0.1 },
    achievement: { frequencies: [523, 659, 784, 1047], duration: 0.12, type: "sine", gain: 0.12 },
  },
  dark: {
    click: { frequencies: [400], duration: 0.04, type: "sine", gain: 0.06 },
    success: { frequencies: [392, 494, 587], duration: 0.12, type: "sine", gain: 0.1 },
    error: { frequencies: [150, 120], duration: 0.15, type: "sawtooth", gain: 0.06 },
    open: { frequencies: [250, 350], duration: 0.08, type: "sine", gain: 0.05 },
    close: { frequencies: [350, 250], duration: 0.08, type: "sine", gain: 0.05 },
    select: { frequencies: [500], duration: 0.04, type: "sine", gain: 0.06 },
    toggle: { frequencies: [350, 450], duration: 0.05, type: "sine", gain: 0.06 },
    upload: { frequencies: [300, 450, 600], duration: 0.1, type: "sine", gain: 0.08 },
    delete: { frequencies: [250, 180], duration: 0.1, type: "triangle", gain: 0.06 },
    submit: { frequencies: [400, 550, 700], duration: 0.12, type: "sine", gain: 0.1 },
    achievement: { frequencies: [392, 494, 587, 784], duration: 0.14, type: "sine", gain: 0.12 },
  },
  cyberpunk: {
    click: { frequencies: [1200, 800], duration: 0.02, type: "square", gain: 0.05 },
    success: { frequencies: [440, 880, 1760], duration: 0.08, type: "square", gain: 0.08 },
    error: { frequencies: [100, 80], duration: 0.1, type: "sawtooth", gain: 0.08 },
    open: { frequencies: [200, 800], duration: 0.05, type: "sawtooth", gain: 0.05 },
    close: { frequencies: [800, 200], duration: 0.05, type: "sawtooth", gain: 0.05 },
    select: { frequencies: [1800], duration: 0.02, type: "square", gain: 0.06 },
    toggle: { frequencies: [1000, 1500], duration: 0.03, type: "square", gain: 0.06 },
    upload: { frequencies: [400, 800, 1600], duration: 0.06, type: "square", gain: 0.06 },
    delete: { frequencies: [800, 400, 200], duration: 0.06, type: "sawtooth", gain: 0.08 },
    submit: { frequencies: [600, 1200, 2400], duration: 0.08, type: "square", gain: 0.08 },
    achievement: { frequencies: [440, 880, 1320, 1760, 2200], duration: 0.1, type: "square", gain: 0.1 },
  },
  ocean: {
    click: { frequencies: [600, 500], duration: 0.05, type: "sine", gain: 0.06 },
    success: { frequencies: [392, 523, 659], duration: 0.15, type: "sine", gain: 0.1 },
    error: { frequencies: [200, 150], duration: 0.15, type: "triangle", gain: 0.06 },
    open: { frequencies: [300, 400, 500], duration: 0.1, type: "sine", gain: 0.05 },
    close: { frequencies: [500, 400, 300], duration: 0.1, type: "sine", gain: 0.05 },
    select: { frequencies: [700], duration: 0.04, type: "sine", gain: 0.06 },
    toggle: { frequencies: [500, 400], duration: 0.06, type: "sine", gain: 0.06 },
    upload: { frequencies: [400, 500, 600, 700], duration: 0.12, type: "sine", gain: 0.08 },
    delete: { frequencies: [400, 300, 200], duration: 0.1, type: "triangle", gain: 0.06 },
    submit: { frequencies: [500, 600, 700, 800], duration: 0.12, type: "sine", gain: 0.1 },
    achievement: { frequencies: [392, 494, 587, 784, 988], duration: 0.18, type: "sine", gain: 0.12 },
  },
  sunset: {
    click: { frequencies: [700], duration: 0.04, type: "sine", gain: 0.07 },
    success: { frequencies: [440, 554, 659], duration: 0.12, type: "sine", gain: 0.1 },
    error: { frequencies: [220, 180], duration: 0.15, type: "triangle", gain: 0.07 },
    open: { frequencies: [350, 500], duration: 0.08, type: "sine", gain: 0.05 },
    close: { frequencies: [500, 350], duration: 0.08, type: "sine", gain: 0.05 },
    select: { frequencies: [800], duration: 0.03, type: "sine", gain: 0.06 },
    toggle: { frequencies: [600, 700], duration: 0.04, type: "sine", gain: 0.06 },
    upload: { frequencies: [450, 600, 750], duration: 0.1, type: "sine", gain: 0.08 },
    delete: { frequencies: [350, 280], duration: 0.08, type: "triangle", gain: 0.06 },
    submit: { frequencies: [550, 700, 880], duration: 0.12, type: "sine", gain: 0.1 },
    achievement: { frequencies: [440, 554, 659, 880, 1109], duration: 0.16, type: "sine", gain: 0.12 },
  },
  forest: {
    click: { frequencies: [500, 400], duration: 0.05, type: "triangle", gain: 0.07 },
    success: { frequencies: [349, 440, 523], duration: 0.14, type: "triangle", gain: 0.1 },
    error: { frequencies: [180, 150], duration: 0.15, type: "triangle", gain: 0.07 },
    open: { frequencies: [280, 380], duration: 0.08, type: "triangle", gain: 0.05 },
    close: { frequencies: [380, 280], duration: 0.08, type: "triangle", gain: 0.05 },
    select: { frequencies: [600], duration: 0.04, type: "triangle", gain: 0.06 },
    toggle: { frequencies: [450, 380], duration: 0.05, type: "triangle", gain: 0.06 },
    upload: { frequencies: [350, 480, 600], duration: 0.12, type: "triangle", gain: 0.08 },
    delete: { frequencies: [320, 250], duration: 0.1, type: "triangle", gain: 0.06 },
    submit: { frequencies: [440, 560, 700], duration: 0.12, type: "triangle", gain: 0.1 },
    achievement: { frequencies: [349, 440, 523, 698, 880], duration: 0.16, type: "triangle", gain: 0.12 },
  },
  galaxy: {
    click: { frequencies: [1000, 800], duration: 0.04, type: "sine", gain: 0.06 },
    success: { frequencies: [523, 698, 880, 1047], duration: 0.15, type: "sine", gain: 0.1 },
    error: { frequencies: [180, 140], duration: 0.15, type: "sawtooth", gain: 0.05 },
    open: { frequencies: [400, 600, 900], duration: 0.1, type: "sine", gain: 0.05 },
    close: { frequencies: [900, 600, 400], duration: 0.1, type: "sine", gain: 0.05 },
    select: { frequencies: [1100], duration: 0.04, type: "sine", gain: 0.06 },
    toggle: { frequencies: [800, 1000], duration: 0.05, type: "sine", gain: 0.06 },
    upload: { frequencies: [500, 750, 1000, 1250], duration: 0.12, type: "sine", gain: 0.08 },
    delete: { frequencies: [500, 350, 200], duration: 0.1, type: "sawtooth", gain: 0.06 },
    submit: { frequencies: [600, 850, 1100, 1400], duration: 0.14, type: "sine", gain: 0.1 },
    achievement: { frequencies: [523, 698, 880, 1047, 1319], duration: 0.18, type: "sine", gain: 0.12 },
  },
  aurora: {
    click: { frequencies: [900, 1100], duration: 0.04, type: "sine", gain: 0.06 },
    success: { frequencies: [494, 622, 784, 988], duration: 0.14, type: "sine", gain: 0.1 },
    error: { frequencies: [200, 160], duration: 0.15, type: "triangle", gain: 0.06 },
    open: { frequencies: [350, 550, 750], duration: 0.1, type: "sine", gain: 0.05 },
    close: { frequencies: [750, 550, 350], duration: 0.1, type: "sine", gain: 0.05 },
    select: { frequencies: [1000], duration: 0.04, type: "sine", gain: 0.06 },
    toggle: { frequencies: [700, 850], duration: 0.05, type: "sine", gain: 0.06 },
    upload: { frequencies: [450, 650, 850, 1050], duration: 0.12, type: "sine", gain: 0.08 },
    delete: { frequencies: [450, 320, 200], duration: 0.1, type: "triangle", gain: 0.06 },
    submit: { frequencies: [550, 750, 950, 1150], duration: 0.12, type: "sine", gain: 0.1 },
    achievement: { frequencies: [494, 622, 784, 988, 1245], duration: 0.16, type: "sine", gain: 0.12 },
  },
  retro: {
    click: { frequencies: [1400], duration: 0.02, type: "square", gain: 0.04 },
    success: { frequencies: [523, 659, 784, 1047], duration: 0.06, type: "square", gain: 0.06 },
    error: { frequencies: [150, 100], duration: 0.1, type: "square", gain: 0.06 },
    open: { frequencies: [600, 900], duration: 0.05, type: "square", gain: 0.04 },
    close: { frequencies: [900, 600], duration: 0.05, type: "square", gain: 0.04 },
    select: { frequencies: [1400], duration: 0.02, type: "square", gain: 0.05 },
    toggle: { frequencies: [1000, 1200], duration: 0.03, type: "square", gain: 0.04 },
    upload: { frequencies: [700, 1000, 1400, 1800], duration: 0.06, type: "square", gain: 0.06 },
    delete: { frequencies: [600, 400], duration: 0.05, type: "square", gain: 0.05 },
    submit: { frequencies: [800, 1100, 1400], duration: 0.08, type: "square", gain: 0.07 },
    achievement: { frequencies: [523, 659, 784, 1047, 1319], duration: 0.1, type: "square", gain: 0.08 },
  },
  midnight: {
    click: { frequencies: [600], duration: 0.04, type: "sine", gain: 0.05 },
    success: { frequencies: [440, 554, 659, 880], duration: 0.14, type: "sine", gain: 0.08 },
    error: { frequencies: [180, 140], duration: 0.15, type: "triangle", gain: 0.06 },
    open: { frequencies: [320, 480], duration: 0.08, type: "sine", gain: 0.04 },
    close: { frequencies: [480, 320], duration: 0.08, type: "sine", gain: 0.04 },
    select: { frequencies: [750], duration: 0.03, type: "sine", gain: 0.05 },
    toggle: { frequencies: [550, 680], duration: 0.04, type: "sine", gain: 0.05 },
    upload: { frequencies: [400, 560, 720], duration: 0.1, type: "sine", gain: 0.07 },
    delete: { frequencies: [360, 280], duration: 0.08, type: "triangle", gain: 0.05 },
    submit: { frequencies: [500, 680, 860], duration: 0.12, type: "sine", gain: 0.08 },
    achievement: { frequencies: [440, 554, 659, 880, 1109], duration: 0.16, type: "sine", gain: 0.1 },
  },
};

// Lazy-loaded audio context
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

function playTone(config: SoundConfig) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const { frequencies, duration, type, gain } = config;
    const now = ctx.currentTime;

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      const startTime = now + index * duration * 0.2;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    });
  } catch {
    // Silently fail
  }
}

export function useSoundEffects() {
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("sound-effects-enabled");
    if (saved !== null) setSoundEnabled(saved === "true");
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
      const config = themeSoundConfigs[cachedTheme]?.[sound];
      if (config) playTone(config);
    },
    [soundEnabled]
  );

  return { playSound, soundEnabled, toggleSound };
}

// Global sound function for components that don't use the hook
let globalSoundEnabled = true;

export function playGlobalSound(sound: SoundType) {
  if (!globalSoundEnabled) return;
  const saved = localStorage.getItem("sound-effects-enabled");
  if (saved === "false") return;

  const config = themeSoundConfigs[cachedTheme]?.[sound];
  if (config) playTone(config);
}

export function setGlobalSoundEnabled(enabled: boolean) {
  globalSoundEnabled = enabled;
  localStorage.setItem("sound-effects-enabled", String(enabled));
}

export type { SoundType, ThemeId };
