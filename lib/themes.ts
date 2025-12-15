export interface Theme {
  id: string;
  name: string;
  description: string;
  icon: string;
  preview: {
    background: string;
    primary: string;
    secondary: string;
    accent: string;
  };
  isSpecial?: boolean;
}

export const themes: Theme[] = [
  {
    id: "light",
    name: "Light",
    description: "Clean and bright",
    icon: "Sun",
    preview: {
      background: "#ffffff",
      primary: "#3b82f6",
      secondary: "#e2e8f0",
      accent: "#8b5cf6",
    },
  },
  {
    id: "dark",
    name: "Dark",
    description: "Easy on the eyes",
    icon: "Moon",
    preview: {
      background: "#0f172a",
      primary: "#60a5fa",
      secondary: "#1e293b",
      accent: "#a78bfa",
    },
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    description: "Neon-lit future",
    icon: "Zap",
    preview: {
      background: "#1a0a20",
      primary: "#ff0080",
      secondary: "#00ffff",
      accent: "#ffff00",
    },
    isSpecial: true,
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep sea vibes",
    icon: "Waves",
    preview: {
      background: "#0c1929",
      primary: "#22d3ee",
      secondary: "#0369a1",
      accent: "#2dd4bf",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm golden hour",
    icon: "Sunrise",
    preview: {
      background: "#1c1410",
      primary: "#f97316",
      secondary: "#ec4899",
      accent: "#fbbf24",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Natural serenity",
    icon: "TreePine",
    preview: {
      background: "#0d1a12",
      primary: "#22c55e",
      secondary: "#65a30d",
      accent: "#eab308",
    },
  },
  {
    id: "galaxy",
    name: "Galaxy",
    description: "Cosmic wonder",
    icon: "Sparkles",
    preview: {
      background: "#0f0a1a",
      primary: "#a855f7",
      secondary: "#3b82f6",
      accent: "#ec4899",
    },
    isSpecial: true,
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Northern lights",
    icon: "Stars",
    preview: {
      background: "#0a1220",
      primary: "#10b981",
      secondary: "#a855f7",
      accent: "#38bdf8",
    },
    isSpecial: true,
  },
  {
    id: "retro",
    name: "Retro",
    description: "80s Miami vibes",
    icon: "Radio",
    preview: {
      background: "#1a0a18",
      primary: "#f472b6",
      secondary: "#22d3ee",
      accent: "#facc15",
    },
    isSpecial: true,
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Elegant darkness",
    icon: "MoonStar",
    preview: {
      background: "#0b0d14",
      primary: "#6366f1",
      secondary: "#7c3aed",
      accent: "#0ea5e9",
    },
  },
];

export function getThemeById(id: string): Theme | undefined {
  return themes.find((t) => t.id === id);
}
