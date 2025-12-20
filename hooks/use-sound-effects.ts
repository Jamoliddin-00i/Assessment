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
  | "achievement"
  | "toggle"
  | "open"
  | "close"
  | "select"
  | "upload"
  | "delete"
  | "submit"
  | "navigate"
  | "celebrate";

type ThemeId =
  | "light"
  | "dark"
  | "cyberpunk"
  | "ocean"
  | "sunset"
  | "forest"
  | "galaxy"
  | "aurora"
  | "retro"
  | "midnight";

interface SoundConfig {
  frequencies: number[];
  duration: number;
  type: OscillatorType;
  gain: number;
  detune?: number;
  attack?: number;
  decay?: number;
}

// Theme-specific sound configurations
// Each theme has unique sonic characteristics that match its visual aesthetic
const themeSoundConfigs: Record<ThemeId, Record<SoundType, SoundConfig>> = {
  // Light - Clean, bright, professional sounds
  light: {
    click: { frequencies: [880, 1100], duration: 0.04, type: "sine", gain: 0.08 },
    hover: { frequencies: [600], duration: 0.02, type: "sine", gain: 0.04 },
    success: { frequencies: [523, 659, 784], duration: 0.12, type: "sine", gain: 0.12 },
    error: { frequencies: [220, 180], duration: 0.15, type: "triangle", gain: 0.1 },
    notification: { frequencies: [880, 1100, 880], duration: 0.08, type: "sine", gain: 0.1 },
    whoosh: { frequencies: [200, 600], duration: 0.12, type: "sine", gain: 0.06 },
    pop: { frequencies: [1200, 800], duration: 0.03, type: "sine", gain: 0.1 },
    achievement: { frequencies: [523, 659, 784, 1047], duration: 0.1, type: "sine", gain: 0.15 },
    toggle: { frequencies: [700, 900], duration: 0.05, type: "sine", gain: 0.08 },
    open: { frequencies: [400, 600, 800], duration: 0.08, type: "sine", gain: 0.07 },
    close: { frequencies: [800, 600, 400], duration: 0.08, type: "sine", gain: 0.07 },
    select: { frequencies: [1000, 1200], duration: 0.04, type: "sine", gain: 0.08 },
    upload: { frequencies: [500, 700, 900], duration: 0.1, type: "sine", gain: 0.1 },
    delete: { frequencies: [400, 300], duration: 0.1, type: "triangle", gain: 0.08 },
    submit: { frequencies: [600, 800, 1000], duration: 0.12, type: "sine", gain: 0.12 },
    navigate: { frequencies: [700, 900], duration: 0.05, type: "sine", gain: 0.06 },
    celebrate: { frequencies: [523, 659, 784, 1047, 1319], duration: 0.15, type: "sine", gain: 0.18 },
  },

  // Dark - Deeper, muted, mysterious tones
  dark: {
    click: { frequencies: [400, 500], duration: 0.05, type: "sine", gain: 0.08 },
    hover: { frequencies: [300], duration: 0.03, type: "sine", gain: 0.04 },
    success: { frequencies: [392, 494, 587], duration: 0.15, type: "sine", gain: 0.12 },
    error: { frequencies: [150, 120], duration: 0.2, type: "sawtooth", gain: 0.08 },
    notification: { frequencies: [440, 550, 440], duration: 0.1, type: "sine", gain: 0.1 },
    whoosh: { frequencies: [100, 400], duration: 0.15, type: "sine", gain: 0.06 },
    pop: { frequencies: [600, 400], duration: 0.04, type: "sine", gain: 0.1 },
    achievement: { frequencies: [392, 494, 587, 784], duration: 0.12, type: "sine", gain: 0.15 },
    toggle: { frequencies: [350, 450], duration: 0.06, type: "sine", gain: 0.08 },
    open: { frequencies: [250, 350, 450], duration: 0.1, type: "sine", gain: 0.07 },
    close: { frequencies: [450, 350, 250], duration: 0.1, type: "sine", gain: 0.07 },
    select: { frequencies: [500, 600], duration: 0.05, type: "sine", gain: 0.08 },
    upload: { frequencies: [300, 450, 600], duration: 0.12, type: "sine", gain: 0.1 },
    delete: { frequencies: [250, 180], duration: 0.12, type: "triangle", gain: 0.08 },
    submit: { frequencies: [400, 550, 700], duration: 0.15, type: "sine", gain: 0.12 },
    navigate: { frequencies: [350, 450], duration: 0.06, type: "sine", gain: 0.06 },
    celebrate: { frequencies: [392, 494, 587, 784, 988], duration: 0.18, type: "sine", gain: 0.18 },
  },

  // Cyberpunk - Electronic, synth, glitchy sounds
  cyberpunk: {
    click: { frequencies: [1200, 800, 1500], duration: 0.03, type: "square", gain: 0.07, detune: 20 },
    hover: { frequencies: [2000, 1800], duration: 0.02, type: "sawtooth", gain: 0.03 },
    success: { frequencies: [440, 880, 1760], duration: 0.1, type: "square", gain: 0.1 },
    error: { frequencies: [100, 80, 60], duration: 0.15, type: "sawtooth", gain: 0.12, detune: -50 },
    notification: { frequencies: [1500, 2000, 1500, 2500], duration: 0.06, type: "square", gain: 0.08 },
    whoosh: { frequencies: [50, 2000], duration: 0.1, type: "sawtooth", gain: 0.06 },
    pop: { frequencies: [2500, 1500], duration: 0.02, type: "square", gain: 0.1 },
    achievement: { frequencies: [440, 880, 1320, 1760, 2200], duration: 0.08, type: "square", gain: 0.12 },
    toggle: { frequencies: [1000, 1500, 800], duration: 0.04, type: "square", gain: 0.08 },
    open: { frequencies: [200, 800, 1600], duration: 0.06, type: "sawtooth", gain: 0.07 },
    close: { frequencies: [1600, 800, 200], duration: 0.06, type: "sawtooth", gain: 0.07 },
    select: { frequencies: [1800, 2200], duration: 0.03, type: "square", gain: 0.08 },
    upload: { frequencies: [400, 800, 1600, 3200], duration: 0.08, type: "square", gain: 0.08 },
    delete: { frequencies: [800, 400, 200], duration: 0.08, type: "sawtooth", gain: 0.1 },
    submit: { frequencies: [600, 1200, 2400], duration: 0.1, type: "square", gain: 0.1 },
    navigate: { frequencies: [1200, 1600], duration: 0.04, type: "square", gain: 0.06 },
    celebrate: { frequencies: [440, 880, 1320, 1760, 2200, 2640], duration: 0.12, type: "square", gain: 0.15 },
  },

  // Ocean - Flowing, water-like, serene sounds
  ocean: {
    click: { frequencies: [600, 500, 400], duration: 0.06, type: "sine", gain: 0.08 },
    hover: { frequencies: [400, 350], duration: 0.04, type: "sine", gain: 0.04 },
    success: { frequencies: [392, 523, 659], duration: 0.18, type: "sine", gain: 0.12, attack: 0.05 },
    error: { frequencies: [200, 150, 120], duration: 0.2, type: "triangle", gain: 0.08 },
    notification: { frequencies: [600, 500, 600, 700], duration: 0.12, type: "sine", gain: 0.1 },
    whoosh: { frequencies: [80, 300, 150], duration: 0.2, type: "sine", gain: 0.06 },
    pop: { frequencies: [800, 600, 500], duration: 0.05, type: "sine", gain: 0.1 },
    achievement: { frequencies: [392, 494, 587, 784, 988], duration: 0.2, type: "sine", gain: 0.15 },
    toggle: { frequencies: [500, 400, 500], duration: 0.07, type: "sine", gain: 0.08 },
    open: { frequencies: [300, 400, 500, 600], duration: 0.12, type: "sine", gain: 0.07 },
    close: { frequencies: [600, 500, 400, 300], duration: 0.12, type: "sine", gain: 0.07 },
    select: { frequencies: [700, 600, 700], duration: 0.05, type: "sine", gain: 0.08 },
    upload: { frequencies: [400, 500, 600, 700], duration: 0.15, type: "sine", gain: 0.1 },
    delete: { frequencies: [400, 300, 200], duration: 0.12, type: "triangle", gain: 0.08 },
    submit: { frequencies: [500, 600, 700, 800], duration: 0.15, type: "sine", gain: 0.12 },
    navigate: { frequencies: [500, 450, 500], duration: 0.06, type: "sine", gain: 0.06 },
    celebrate: { frequencies: [392, 494, 587, 698, 880, 1047], duration: 0.22, type: "sine", gain: 0.18 },
  },

  // Sunset - Warm, mellow, golden tones
  sunset: {
    click: { frequencies: [700, 600], duration: 0.05, type: "sine", gain: 0.09 },
    hover: { frequencies: [450, 400], duration: 0.03, type: "sine", gain: 0.04 },
    success: { frequencies: [440, 554, 659], duration: 0.15, type: "sine", gain: 0.12 },
    error: { frequencies: [220, 180], duration: 0.18, type: "triangle", gain: 0.09 },
    notification: { frequencies: [698, 880, 698], duration: 0.1, type: "sine", gain: 0.1 },
    whoosh: { frequencies: [150, 500], duration: 0.15, type: "sine", gain: 0.06 },
    pop: { frequencies: [900, 700], duration: 0.04, type: "sine", gain: 0.1 },
    achievement: { frequencies: [440, 554, 659, 880, 1109], duration: 0.14, type: "sine", gain: 0.16 },
    toggle: { frequencies: [600, 700], duration: 0.05, type: "sine", gain: 0.08 },
    open: { frequencies: [350, 500, 650], duration: 0.1, type: "sine", gain: 0.07 },
    close: { frequencies: [650, 500, 350], duration: 0.1, type: "sine", gain: 0.07 },
    select: { frequencies: [800, 900], duration: 0.04, type: "sine", gain: 0.08 },
    upload: { frequencies: [450, 600, 750], duration: 0.12, type: "sine", gain: 0.1 },
    delete: { frequencies: [350, 280], duration: 0.1, type: "triangle", gain: 0.08 },
    submit: { frequencies: [550, 700, 880], duration: 0.14, type: "sine", gain: 0.12 },
    navigate: { frequencies: [600, 700], duration: 0.05, type: "sine", gain: 0.06 },
    celebrate: { frequencies: [440, 554, 659, 880, 1109, 1319], duration: 0.18, type: "sine", gain: 0.18 },
  },

  // Forest - Organic, natural, earthy sounds
  forest: {
    click: { frequencies: [500, 400, 350], duration: 0.06, type: "triangle", gain: 0.09 },
    hover: { frequencies: [350, 300], duration: 0.04, type: "triangle", gain: 0.04 },
    success: { frequencies: [349, 440, 523], duration: 0.16, type: "triangle", gain: 0.12 },
    error: { frequencies: [180, 150], duration: 0.18, type: "triangle", gain: 0.09 },
    notification: { frequencies: [523, 659, 523], duration: 0.1, type: "triangle", gain: 0.1 },
    whoosh: { frequencies: [100, 350, 200], duration: 0.18, type: "triangle", gain: 0.06 },
    pop: { frequencies: [700, 500, 400], duration: 0.05, type: "triangle", gain: 0.1 },
    achievement: { frequencies: [349, 440, 523, 698, 880], duration: 0.16, type: "triangle", gain: 0.15 },
    toggle: { frequencies: [450, 380, 450], duration: 0.06, type: "triangle", gain: 0.08 },
    open: { frequencies: [280, 380, 480], duration: 0.1, type: "triangle", gain: 0.07 },
    close: { frequencies: [480, 380, 280], duration: 0.1, type: "triangle", gain: 0.07 },
    select: { frequencies: [600, 520, 600], duration: 0.05, type: "triangle", gain: 0.08 },
    upload: { frequencies: [350, 480, 600], duration: 0.14, type: "triangle", gain: 0.1 },
    delete: { frequencies: [320, 250], duration: 0.12, type: "triangle", gain: 0.08 },
    submit: { frequencies: [440, 560, 700], duration: 0.14, type: "triangle", gain: 0.12 },
    navigate: { frequencies: [420, 380, 420], duration: 0.06, type: "triangle", gain: 0.06 },
    celebrate: { frequencies: [349, 440, 523, 659, 784, 988], duration: 0.2, type: "triangle", gain: 0.18 },
  },

  // Galaxy - Ethereal, spacey, cosmic sounds
  galaxy: {
    click: { frequencies: [1000, 800, 1200], duration: 0.05, type: "sine", gain: 0.08, detune: 10 },
    hover: { frequencies: [600, 700], duration: 0.04, type: "sine", gain: 0.04 },
    success: { frequencies: [523, 698, 880, 1047], duration: 0.18, type: "sine", gain: 0.12 },
    error: { frequencies: [180, 140, 100], duration: 0.2, type: "sawtooth", gain: 0.07 },
    notification: { frequencies: [880, 1047, 1319, 1047], duration: 0.12, type: "sine", gain: 0.1 },
    whoosh: { frequencies: [60, 800, 200], duration: 0.2, type: "sine", gain: 0.06 },
    pop: { frequencies: [1400, 1000, 1200], duration: 0.04, type: "sine", gain: 0.1 },
    achievement: { frequencies: [523, 698, 880, 1175, 1397, 1760], duration: 0.2, type: "sine", gain: 0.16 },
    toggle: { frequencies: [800, 1000, 900], duration: 0.06, type: "sine", gain: 0.08 },
    open: { frequencies: [400, 600, 900, 1200], duration: 0.12, type: "sine", gain: 0.07 },
    close: { frequencies: [1200, 900, 600, 400], duration: 0.12, type: "sine", gain: 0.07 },
    select: { frequencies: [1100, 1300, 1100], duration: 0.05, type: "sine", gain: 0.08 },
    upload: { frequencies: [500, 750, 1000, 1250], duration: 0.14, type: "sine", gain: 0.1 },
    delete: { frequencies: [500, 350, 200], duration: 0.12, type: "sawtooth", gain: 0.08 },
    submit: { frequencies: [600, 850, 1100, 1400], duration: 0.16, type: "sine", gain: 0.12 },
    navigate: { frequencies: [800, 950, 800], duration: 0.06, type: "sine", gain: 0.06 },
    celebrate: { frequencies: [523, 698, 880, 1175, 1397, 1760, 2093], duration: 0.22, type: "sine", gain: 0.18 },
  },

  // Aurora - Mystical, shimmering, magical sounds
  aurora: {
    click: { frequencies: [900, 1100, 900], duration: 0.05, type: "sine", gain: 0.08 },
    hover: { frequencies: [550, 650], duration: 0.04, type: "sine", gain: 0.04 },
    success: { frequencies: [494, 622, 784, 988], duration: 0.16, type: "sine", gain: 0.12 },
    error: { frequencies: [200, 160, 130], duration: 0.18, type: "triangle", gain: 0.08 },
    notification: { frequencies: [784, 988, 1175, 988], duration: 0.1, type: "sine", gain: 0.1 },
    whoosh: { frequencies: [80, 600, 300, 900], duration: 0.18, type: "sine", gain: 0.06 },
    pop: { frequencies: [1200, 900, 1100], duration: 0.04, type: "sine", gain: 0.1 },
    achievement: { frequencies: [494, 622, 784, 988, 1245, 1568], duration: 0.18, type: "sine", gain: 0.16 },
    toggle: { frequencies: [700, 850, 700], duration: 0.06, type: "sine", gain: 0.08 },
    open: { frequencies: [350, 550, 750, 950], duration: 0.12, type: "sine", gain: 0.07 },
    close: { frequencies: [950, 750, 550, 350], duration: 0.12, type: "sine", gain: 0.07 },
    select: { frequencies: [1000, 1150, 1000], duration: 0.05, type: "sine", gain: 0.08 },
    upload: { frequencies: [450, 650, 850, 1050], duration: 0.14, type: "sine", gain: 0.1 },
    delete: { frequencies: [450, 320, 200], duration: 0.12, type: "triangle", gain: 0.08 },
    submit: { frequencies: [550, 750, 950, 1150], duration: 0.15, type: "sine", gain: 0.12 },
    navigate: { frequencies: [750, 850, 750], duration: 0.06, type: "sine", gain: 0.06 },
    celebrate: { frequencies: [494, 622, 784, 988, 1245, 1568, 1976], duration: 0.22, type: "sine", gain: 0.18 },
  },

  // Retro - 8-bit, arcade, chiptune sounds
  retro: {
    click: { frequencies: [1400, 1200], duration: 0.03, type: "square", gain: 0.06 },
    hover: { frequencies: [800], duration: 0.02, type: "square", gain: 0.03 },
    success: { frequencies: [523, 659, 784, 1047], duration: 0.08, type: "square", gain: 0.08 },
    error: { frequencies: [150, 100], duration: 0.12, type: "square", gain: 0.08 },
    notification: { frequencies: [1047, 1319, 1047], duration: 0.06, type: "square", gain: 0.08 },
    whoosh: { frequencies: [200, 1000], duration: 0.08, type: "square", gain: 0.05 },
    pop: { frequencies: [1800, 1400], duration: 0.02, type: "square", gain: 0.08 },
    achievement: { frequencies: [523, 659, 784, 1047, 1319, 1568], duration: 0.1, type: "square", gain: 0.1 },
    toggle: { frequencies: [1000, 1200], duration: 0.03, type: "square", gain: 0.06 },
    open: { frequencies: [600, 900, 1200], duration: 0.06, type: "square", gain: 0.06 },
    close: { frequencies: [1200, 900, 600], duration: 0.06, type: "square", gain: 0.06 },
    select: { frequencies: [1400, 1600], duration: 0.03, type: "square", gain: 0.07 },
    upload: { frequencies: [700, 1000, 1400, 1800], duration: 0.08, type: "square", gain: 0.08 },
    delete: { frequencies: [600, 400], duration: 0.06, type: "square", gain: 0.07 },
    submit: { frequencies: [800, 1100, 1400], duration: 0.1, type: "square", gain: 0.09 },
    navigate: { frequencies: [1100, 1300], duration: 0.03, type: "square", gain: 0.05 },
    celebrate: { frequencies: [523, 659, 784, 1047, 1319, 1568, 2093], duration: 0.12, type: "square", gain: 0.12 },
  },

  // Midnight - Elegant, soft, sophisticated sounds
  midnight: {
    click: { frequencies: [600, 750], duration: 0.05, type: "sine", gain: 0.07 },
    hover: { frequencies: [400, 450], duration: 0.03, type: "sine", gain: 0.03 },
    success: { frequencies: [440, 554, 659, 880], duration: 0.16, type: "sine", gain: 0.1 },
    error: { frequencies: [180, 140], duration: 0.18, type: "triangle", gain: 0.08 },
    notification: { frequencies: [659, 784, 659], duration: 0.1, type: "sine", gain: 0.09 },
    whoosh: { frequencies: [100, 450], duration: 0.16, type: "sine", gain: 0.05 },
    pop: { frequencies: [850, 650], duration: 0.04, type: "sine", gain: 0.09 },
    achievement: { frequencies: [440, 554, 659, 880, 1109], duration: 0.16, type: "sine", gain: 0.14 },
    toggle: { frequencies: [550, 680], duration: 0.05, type: "sine", gain: 0.07 },
    open: { frequencies: [320, 480, 640], duration: 0.1, type: "sine", gain: 0.06 },
    close: { frequencies: [640, 480, 320], duration: 0.1, type: "sine", gain: 0.06 },
    select: { frequencies: [750, 880], duration: 0.04, type: "sine", gain: 0.07 },
    upload: { frequencies: [400, 560, 720], duration: 0.12, type: "sine", gain: 0.09 },
    delete: { frequencies: [360, 280], duration: 0.1, type: "triangle", gain: 0.07 },
    submit: { frequencies: [500, 680, 860], duration: 0.14, type: "sine", gain: 0.1 },
    navigate: { frequencies: [550, 650], duration: 0.05, type: "sine", gain: 0.05 },
    celebrate: { frequencies: [440, 554, 659, 880, 1109, 1319], duration: 0.2, type: "sine", gain: 0.16 },
  },
};

let audioContext: AudioContext | null = null;
let currentTheme: ThemeId = "light";

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

function playTone(config: SoundConfig) {
  try {
    const ctx = getAudioContext();
    const { frequencies, duration, type, gain, detune = 0 } = config;

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

      if (detune !== 0) {
        oscillator.detune.setValueAtTime(detune, ctx.currentTime);
      }

      const startTime = ctx.currentTime + index * duration * 0.25;
      const endTime = startTime + duration;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(endTime + 0.05);
    });
  } catch (error) {
    console.warn("Audio playback failed:", error);
  }
}

// Get current theme from localStorage or document
function getCurrentTheme(): ThemeId {
  if (typeof window === "undefined") return "light";

  // Try localStorage first
  const stored = localStorage.getItem("theme");
  if (stored && stored in themeSoundConfigs) {
    return stored as ThemeId;
  }

  // Fallback to checking document theme attribute
  const docTheme = document.documentElement.getAttribute("data-theme");
  if (docTheme && docTheme in themeSoundConfigs) {
    return docTheme as ThemeId;
  }

  // Check for dark class
  if (document.documentElement.classList.contains("dark")) {
    return "dark";
  }

  return "light";
}

// Update the current theme - should be called when theme changes
export function setCurrentTheme(theme: ThemeId) {
  currentTheme = theme;
}

export function useSoundEffects() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState<ThemeId>("light");

  useEffect(() => {
    // Load sound preference
    const saved = localStorage.getItem("sound-effects-enabled");
    if (saved !== null) {
      setSoundEnabled(saved === "true");
    }

    // Get current theme
    const currentTheme = getCurrentTheme();
    setTheme(currentTheme);

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      const newTheme = getCurrentTheme();
      setTheme(newTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    // Also listen for localStorage changes (for theme selector)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "theme" && e.newValue) {
        setTheme(e.newValue as ThemeId);
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
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

      const themeConfig = themeSoundConfigs[theme] || themeSoundConfigs.light;
      const config = themeConfig[sound];
      if (config) {
        playTone(config);
      }
    },
    [soundEnabled, theme]
  );

  return {
    playSound,
    soundEnabled,
    toggleSound,
    currentTheme: theme,
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

  const theme = getCurrentTheme();
  const themeConfig = themeSoundConfigs[theme] || themeSoundConfigs.light;
  const config = themeConfig[sound];

  if (config) {
    playTone(config);
  }
}

// Export types for use in other components
export type { SoundType, ThemeId };
