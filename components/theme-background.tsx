"use client";

import { memo, useEffect, useState } from "react";

// Memoized pattern components to prevent re-renders
const LightPattern = memo(function LightPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="light-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" className="text-primary" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#light-dots)" />
    </svg>
  );
});

const DarkPattern = memo(function DarkPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dark-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dark-grid)" />
    </svg>
  );
});

const CyberpunkPattern = memo(function CyberpunkPattern() {
  return (
    <>
      <div className="absolute inset-0 cyberpunk-grid opacity-20" />
      <div className="absolute inset-0 cyberpunk-scanlines opacity-10" />
    </>
  );
});

const OceanPattern = memo(function OceanPattern() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[hsl(var(--primary)/0.1)] to-transparent" />
  );
});

const SunsetPattern = memo(function SunsetPattern() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[hsl(var(--primary)/0.15)] via-[hsl(var(--secondary)/0.08)] to-transparent" />
  );
});

const ForestPattern = memo(function ForestPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 1440 800">
      <path d="M0,500 C200,450 400,550 600,500 C800,450 1000,550 1200,500 C1400,450 1440,500 1440,500 L1440,800 L0,800 Z" fill="hsl(var(--primary))" opacity="0.3" />
      <path d="M0,600 C200,550 400,650 600,600 C800,550 1000,650 1200,600 C1400,550 1440,600 1440,600 L1440,800 L0,800 Z" fill="hsl(var(--secondary))" opacity="0.2" />
    </svg>
  );
});

const GalaxyPattern = memo(function GalaxyPattern() {
  return <div className="absolute inset-0 galaxy-stars" />;
});

const AuroraPattern = memo(function AuroraPattern() {
  return <div className="absolute top-0 left-0 right-0 h-1/2 aurora-gradient" />;
});

const RetroPattern = memo(function RetroPattern() {
  return (
    <>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] retro-sun opacity-30" />
      <div className="absolute bottom-0 left-0 right-0 h-1/3 retro-grid opacity-40" />
    </>
  );
});

const MidnightPattern = memo(function MidnightPattern() {
  return <div className="absolute inset-0 midnight-stars opacity-30" />;
});

const patternMap: Record<string, React.ComponentType> = {
  light: LightPattern,
  dark: DarkPattern,
  cyberpunk: CyberpunkPattern,
  ocean: OceanPattern,
  sunset: SunsetPattern,
  forest: ForestPattern,
  galaxy: GalaxyPattern,
  aurora: AuroraPattern,
  retro: RetroPattern,
  midnight: MidnightPattern,
};

export const ThemeBackground = memo(function ThemeBackground() {
  const [theme, setTheme] = useState<string>("light");

  useEffect(() => {
    // Get initial theme
    const stored = localStorage.getItem("app-theme");
    if (stored) setTheme(stored);

    // Listen for theme changes via custom event (no polling)
    const handleThemeChange = (e: CustomEvent<string>) => {
      setTheme(e.detail);
    };

    window.addEventListener("theme-change" as keyof WindowEventMap, handleThemeChange as EventListener);
    return () => window.removeEventListener("theme-change" as keyof WindowEventMap, handleThemeChange as EventListener);
  }, []);

  const Pattern = patternMap[theme];

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 theme-gradient-bg opacity-30" />
      {Pattern && <Pattern />}
    </div>
  );
});
