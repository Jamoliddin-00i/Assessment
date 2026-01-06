"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Sparkles, PartyPopper } from "lucide-react";
import { useConfetti } from "@/components/ui/confetti";
import { useSoundEffects } from "@/hooks/use-sound-effects";

interface ScoreCelebrationProps {
  score: number;
  maxScore: number;
  show: boolean;
  onComplete?: () => void;
}

export function ScoreCelebration({
  score,
  maxScore,
  show,
  onComplete,
}: ScoreCelebrationProps) {
  const [displayedScore, setDisplayedScore] = useState(0);
  const { fireStars, fireRealistic, fireSchoolPride, fireEmoji } = useConfetti();
  const { playSound } = useSoundEffects();

  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const isPerfect = percentage === 100;
  const isExcellent = percentage >= 90;
  const isGood = percentage >= 70;

  useEffect(() => {
    if (!show) {
      setDisplayedScore(0);
      return;
    }

    // Animate score counting up
    const duration = 2000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      setDisplayedScore(Math.round(score * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Fire confetti based on score
        if (isPerfect) {
          fireRealistic();
          fireEmoji("🏆");
          playSound("achievement");
        } else if (isExcellent) {
          fireStars();
          playSound("success");
        } else if (isGood) {
          fireSchoolPride();
          playSound("success");
        }

        setTimeout(() => {
          onComplete?.();
        }, 3000);
      }
    };

    playSound("success");
    requestAnimationFrame(animate);
  }, [show, score, isPerfect, isExcellent, isGood, fireRealistic, fireStars, fireSchoolPride, fireEmoji, playSound, onComplete]);

  const getMessage = () => {
    if (isPerfect) return "Perfect Score!";
    if (isExcellent) return "Excellent Work!";
    if (isGood) return "Great Job!";
    if (percentage >= 50) return "Good Effort!";
    return "Keep Practicing!";
  };

  const getIcon = () => {
    if (isPerfect) return Trophy;
    if (isExcellent) return Star;
    if (isGood) return Sparkles;
    return PartyPopper;
  };

  const getColors = () => {
    if (isPerfect) return "from-yellow-400 via-amber-500 to-orange-500";
    if (isExcellent) return "from-purple-400 via-pink-500 to-red-500";
    if (isGood) return "from-green-400 via-emerald-500 to-teal-500";
    return "from-blue-400 via-indigo-500 to-purple-500";
  };

  const Icon = getIcon();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative flex flex-col items-center p-8"
          >
            {/* Animated background circles */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute inset-0 rounded-full bg-gradient-to-r ${getColors()} opacity-20`}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.2, 0.1, 0.2],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.5,
                  }}
                  style={{
                    filter: "blur(40px)",
                  }}
                />
              ))}
            </div>

            {/* Icon */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative mb-6"
            >
              <motion.div
                animate={isPerfect ? { rotate: [0, 10, -10, 0] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <Icon
                  className={`h-20 w-20 ${
                    isPerfect
                      ? "text-yellow-500"
                      : isExcellent
                      ? "text-purple-500"
                      : isGood
                      ? "text-green-500"
                      : "text-blue-500"
                  }`}
                />
              </motion.div>
              {isPerfect && (
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                >
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                      style={{
                        top: `${50 + 45 * Math.sin((i * Math.PI * 2) / 8)}%`,
                        left: `${50 + 45 * Math.cos((i * Math.PI * 2) / 8)}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                    />
                  ))}
                </motion.div>
              )}
            </motion.div>

            {/* Score display */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="relative mb-4"
            >
              <span
                className={`text-7xl font-bold bg-gradient-to-r ${getColors()} bg-clip-text text-transparent`}
              >
                {displayedScore}
              </span>
              <span className="text-3xl text-muted-foreground font-medium">
                /{maxScore}
              </span>
            </motion.div>

            {/* Percentage */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-4"
            >
              <span className="text-2xl font-semibold text-muted-foreground">
                {Math.round(percentage)}%
              </span>
            </motion.div>

            {/* Message */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={`text-3xl font-bold bg-gradient-to-r ${getColors()} bg-clip-text text-transparent`}
            >
              {getMessage()}
            </motion.h2>

            {/* Progress bar */}
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "100%", opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-6 w-64 h-3 bg-muted rounded-full overflow-hidden"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ delay: 0.8, duration: 1.5, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r ${getColors()} rounded-full`}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
