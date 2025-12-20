"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PortraitImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function PortraitImage({ src, alt, className }: PortraitImageProps) {
  const [orientation, setOrientation] = React.useState<"portrait" | "landscape" | null>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const handleLoad = () => {
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      setDimensions({ width: naturalWidth, height: naturalHeight });
      setOrientation(naturalWidth > naturalHeight ? "landscape" : "portrait");
    }
  };

  const isLandscape = orientation === "landscape";
  const isLoaded = orientation !== null;

  // Note: aspect ratio is calculated inline in the style prop below

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-muted/50",
        className
      )}
      style={isLandscape && isLoaded ? {
        // Container should have portrait aspect ratio (inverted from original landscape)
        aspectRatio: `${dimensions.height} / ${dimensions.width}`,
      } : undefined}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={handleLoad}
        className={cn(
          "transition-all duration-300",
          !isLoaded && "opacity-0",
          isLoaded && !isLandscape && "w-full h-auto",
        )}
        style={isLandscape && isLoaded ? {
          transform: "rotate(90deg)",
          transformOrigin: "center center",
          width: `${(dimensions.width / dimensions.height) * 100}%`,
          maxWidth: "none",
          height: "auto",
        } : undefined}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center min-h-[200px]">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}
