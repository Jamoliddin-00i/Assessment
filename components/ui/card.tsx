"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLMotionProps<"div"> {
  animated?: boolean;
  hoverEffect?: "lift" | "glow" | "scale" | "border" | "none";
  glowColor?: string;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, animated = true, hoverEffect = "lift", glowColor, ...props }, ref) => {
    const hoverVariants = {
      lift: {
        y: -4,
        boxShadow: "0 20px 40px -15px hsl(var(--primary) / 0.15)",
        transition: { duration: 0.2 },
      },
      glow: {
        boxShadow: `0 0 20px ${glowColor || "var(--glow)"}`,
        transition: { duration: 0.2 },
      },
      scale: {
        scale: 1.02,
        transition: { duration: 0.2 },
      },
      border: {
        borderColor: "hsl(var(--primary) / 0.5)",
        transition: { duration: 0.2 },
      },
      none: {},
    };

    if (!animated) {
      return (
        <div
          ref={ref}
          className={cn(
            "rounded-xl border bg-card text-card-foreground shadow-sm",
            className
          )}
          {...(props as React.HTMLAttributes<HTMLDivElement>)}
        />
      );
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-xl border bg-card text-card-foreground shadow-sm transition-colors",
          className
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={hoverVariants[hoverEffect]}
        transition={{ duration: 0.3 }}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  gradient?: boolean;
}

const CardTitle = React.forwardRef<HTMLParagraphElement, CardTitleProps>(
  ({ className, gradient, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "font-semibold leading-none tracking-tight text-lg",
        gradient && "gradient-text",
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// Special animated card variants
interface GlassCardProps extends CardProps {
  blur?: "sm" | "md" | "lg";
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, blur = "md", ...props }, ref) => {
    const blurValues = {
      sm: "backdrop-blur-sm",
      md: "backdrop-blur-md",
      lg: "backdrop-blur-lg",
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "bg-card/70 border-border/50",
          blurValues[blur],
          className
        )}
        {...props}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";

type GradientBorderCardProps = CardProps;

const GradientBorderCard = React.forwardRef<HTMLDivElement, GradientBorderCardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative p-[2px] rounded-xl bg-gradient-to-br from-primary via-secondary to-accent">
        <Card
          ref={ref}
          className={cn("bg-card border-0", className)}
          {...props}
        >
          {children}
        </Card>
      </div>
    );
  }
);
GradientBorderCard.displayName = "GradientBorderCard";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  GlassCard,
  GradientBorderCard,
};
