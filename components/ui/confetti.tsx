"use client";

import { useCallback, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { playGlobalSound } from "@/hooks/use-sound-effects";

interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  colors?: string[];
  origin?: { x: number; y: number };
  angle?: number;
}

export function useConfetti() {
  const confettiRef = useRef<confetti.CreateTypes | null>(null);

  useEffect(() => {
    const confettiInstance = confettiRef.current;
    return () => {
      if (confettiInstance) {
        confettiInstance.reset();
      }
    };
  }, []);

  const fire = useCallback((options?: ConfettiOptions) => {
    const defaults: ConfettiOptions = {
      particleCount: 100,
      spread: 70,
      startVelocity: 30,
      decay: 0.95,
      gravity: 1,
      colors: ["#ff0080", "#00ffff", "#ffff00", "#ff00ff", "#00ff00"],
      origin: { x: 0.5, y: 0.5 },
    };

    playGlobalSound("achievement");
    confetti({
      ...defaults,
      ...options,
    });
  }, []);

  const fireSchoolPride = useCallback(() => {
    playGlobalSound("achievement");
    const end = Date.now() + 3 * 1000;
    const colors = ["#3b82f6", "#8b5cf6", "#ec4899"];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const fireStars = useCallback(() => {
    playGlobalSound("achievement");
    const defaults = {
      spread: 360,
      ticks: 100,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
    };

    function shoot() {
      confetti({
        ...defaults,
        particleCount: 40,
        scalar: 1.2,
        shapes: ["star"],
      });

      confetti({
        ...defaults,
        particleCount: 10,
        scalar: 0.75,
        shapes: ["circle"],
      });
    }

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
  }, []);

  const fireRealistic = useCallback(() => {
    playGlobalSound("achievement");
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  }, []);

  const fireSideCannons = useCallback(() => {
    playGlobalSound("achievement");
    const end = Date.now() + 1000;

    (function frame() {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: ["#ff0080", "#00ffff", "#ffff00"],
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: ["#ff0080", "#00ffff", "#ffff00"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const fireEmoji = useCallback((emoji: string = "🎉") => {
    playGlobalSound("achievement");
    const scalar = 2;
    const emojiShape = confetti.shapeFromText({ text: emoji, scalar });

    const defaults = {
      spread: 360,
      ticks: 60,
      gravity: 0.5,
      decay: 0.96,
      startVelocity: 20,
      shapes: [emojiShape],
      scalar,
    };

    function shoot() {
      confetti({
        ...defaults,
        particleCount: 30,
      });

      confetti({
        ...defaults,
        particleCount: 5,
        flat: true,
      });
    }

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
  }, []);

  return {
    fire,
    fireSchoolPride,
    fireStars,
    fireRealistic,
    fireSideCannons,
    fireEmoji,
  };
}

// Component version for easy use
interface ConfettiButtonProps {
  children: React.ReactNode;
  type?: "default" | "stars" | "realistic" | "schoolPride" | "sideCannons";
  onClick?: () => void;
  className?: string;
}

export function ConfettiTrigger({
  children,
  type = "default",
  onClick,
  className,
}: ConfettiButtonProps) {
  const {
    fire,
    fireStars,
    fireRealistic,
    fireSchoolPride,
    fireSideCannons,
  } = useConfetti();

  const handleClick = () => {
    switch (type) {
      case "stars":
        fireStars();
        break;
      case "realistic":
        fireRealistic();
        break;
      case "schoolPride":
        fireSchoolPride();
        break;
      case "sideCannons":
        fireSideCannons();
        break;
      default:
        fire();
    }
    onClick?.();
  };

  return (
    <div onClick={handleClick} className={className}>
      {children}
    </div>
  );
}
