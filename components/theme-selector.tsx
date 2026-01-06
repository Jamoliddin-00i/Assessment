"use client";

import { useState, useEffect, memo } from "react";
import {
  Sun,
  Moon,
  Zap,
  Waves,
  Sunrise,
  TreePine,
  Sparkles,
  Stars,
  Radio,
  MoonStar,
  Palette,
  Check,
  Volume2,
  VolumeX,
} from "lucide-react";
import { themes, type Theme } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSoundEffects, updateCachedTheme } from "@/hooks/use-sound-effects";

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Sun,
  Moon,
  Zap,
  Waves,
  Sunrise,
  TreePine,
  Sparkles,
  Stars,
  Radio,
  MoonStar,
};

const ThemePreview = memo(function ThemePreview({ theme, isSelected }: { theme: Theme; isSelected: boolean }) {
  const Icon = iconMap[theme.icon] || Sun;

  return (
    <div
      className={`
        relative p-4 rounded-xl cursor-pointer overflow-hidden
        transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
        ${isSelected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "hover:ring-1 hover:ring-primary/50"
        }
      `}
      style={{ backgroundColor: theme.preview.background }}
    >
      {/* Static gradient background for special themes */}
      {theme.isSpecial && (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `linear-gradient(135deg, ${theme.preview.primary}, ${theme.preview.secondary}, ${theme.preview.accent})`,
          }}
        />
      )}

      {/* Theme preview circles - static */}
      <div className="relative flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded-full"
          style={{ backgroundColor: theme.preview.primary }}
        />
        <div
          className="w-5 h-5 rounded-full"
          style={{ backgroundColor: theme.preview.secondary }}
        />
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: theme.preview.accent }}
        />
      </div>

      {/* Theme info */}
      <div className="relative flex items-center gap-2">
        <Icon
          className="w-4 h-4"
          style={{ color: theme.preview.primary }}
        />
        <span
          className="font-medium text-sm"
          style={{ color: theme.preview.primary }}
        >
          {theme.name}
        </span>
      </div>
      <p
        className="relative text-xs mt-1 opacity-70"
        style={{ color: theme.preview.primary }}
      >
        {theme.description}
      </p>

      {/* Selected checkmark */}
      {isSelected && (
        <div
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center animate-scale-in"
          style={{ backgroundColor: theme.preview.primary }}
        >
          <Check className="w-4 h-4" style={{ color: theme.preview.background }} />
        </div>
      )}

      {/* Special theme badge */}
      {theme.isSpecial && (
        <div className="absolute bottom-2 right-2">
          <Sparkles
            className="w-4 h-4"
            style={{ color: theme.preview.accent }}
          />
        </div>
      )}
    </div>
  );
});

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<string>("light");
  const [open, setOpen] = useState(false);
  const { playSound, soundEnabled, toggleSound } = useSoundEffects();

  useEffect(() => {
    // Get initial theme from document
    const savedTheme = localStorage.getItem("app-theme") || "light";
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (themeId: string) => {
    const root = document.documentElement;

    // Remove all theme classes/attributes
    root.classList.remove("dark");
    root.removeAttribute("data-theme");

    if (themeId === "dark") {
      root.classList.add("dark");
    } else if (themeId !== "light") {
      root.setAttribute("data-theme", themeId);
    }

    localStorage.setItem("app-theme", themeId);

    // Update cached theme and notify listeners (no polling needed)
    updateCachedTheme(themeId as Parameters<typeof updateCachedTheme>[0]);
    window.dispatchEvent(new CustomEvent("theme-change", { detail: themeId }));
  };

  const handleThemeChange = (themeId: string) => {
    playSound("click");
    setCurrentTheme(themeId);
    applyTheme(themeId);

    // Play special sound for special themes
    const theme = themes.find(t => t.id === themeId);
    if (theme?.isSpecial) {
      setTimeout(() => playSound("success"), 200);
    }
  };

  const currentThemeData = themes.find(t => t.id === currentTheme) || themes[0];
  const CurrentIcon = iconMap[currentThemeData.icon] || Sun;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover-glow btn-press"
          onClick={() => playSound("click")}
        >
          <CurrentIcon className="h-5 w-5 transition-transform duration-300" />
          <span className="sr-only">Select theme</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Palette className="h-6 w-6 text-primary" />
            <span className="gradient-text font-bold">Choose Your Theme</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              onClick={() => {
                toggleSound();
                playSound("click");
              }}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          {themes.map((theme) => (
            <div
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
            >
              <ThemePreview
                theme={theme}
                isSelected={currentTheme === theme.id}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Themes marked with sparkles have special animated effects!</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
