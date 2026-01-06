"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelGroupProps {
  children: React.ReactNode;
  className?: string;
  direction?: "horizontal" | "vertical";
}

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  className?: string;
}

interface ResizableHandleProps {
  className?: string;
  withHandle?: boolean;
}

interface PanelConfig {
  defaultSize: number;
  minSize: number;
  maxSize: number;
}

interface PanelContextValue {
  direction: "horizontal" | "vertical";
  sizes: number[];
  setSizes: React.Dispatch<React.SetStateAction<number[]>>;
  registerPanel: (index: number, config: PanelConfig) => void;
  panelConfigs: PanelConfig[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const PanelContext = React.createContext<PanelContextValue | null>(null);

export function ResizablePanelGroup({
  children,
  className,
  direction = "horizontal",
}: ResizablePanelGroupProps) {
  const [sizes, setSizes] = React.useState<number[]>([]);
  const [panelConfigs, setPanelConfigs] = React.useState<PanelConfig[]>([]);
  const initialized = React.useRef(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const registerPanel = React.useCallback(
    (index: number, config: PanelConfig) => {
      if (!initialized.current) {
        setSizes((prev) => {
          const newSizes = [...prev];
          newSizes[index] = config.defaultSize;
          return newSizes;
        });
        setPanelConfigs((prev) => {
          const newConfigs = [...prev];
          newConfigs[index] = config;
          return newConfigs;
        });
      }
    },
    []
  );

  React.useEffect(() => {
    initialized.current = true;
  }, []);

  return (
    <PanelContext.Provider value={{ direction, sizes, setSizes, registerPanel, panelConfigs, containerRef }}>
      <div
        ref={containerRef}
        className={cn(
          "flex h-full w-full",
          direction === "horizontal" ? "flex-row" : "flex-col",
          className
        )}
      >
        {children}
      </div>
    </PanelContext.Provider>
  );
}

export function ResizablePanel({
  children,
  defaultSize = 33,
  minSize = 10,
  maxSize = 80,
  className,
}: ResizablePanelProps) {
  const context = React.useContext(PanelContext);
  const indexRef = React.useRef(-1);
  const panelRef = React.useRef<HTMLDivElement>(null);

  if (!context) {
    throw new Error("ResizablePanel must be used within ResizablePanelGroup");
  }

  const { direction, sizes, registerPanel, containerRef } = context;

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !panelRef.current) return;

    const panels = container.querySelectorAll("[data-resizable-panel]");
    let myIndex = -1;
    panels.forEach((panel, i) => {
      if (panel === panelRef.current) {
        myIndex = i;
      }
    });

    if (myIndex >= 0 && indexRef.current !== myIndex) {
      indexRef.current = myIndex;
      registerPanel(myIndex, { defaultSize, minSize, maxSize });
    }
  }, [defaultSize, minSize, maxSize, registerPanel, containerRef]);

  const size = sizes[indexRef.current] ?? defaultSize;

  return (
    <div
      ref={panelRef}
      data-resizable-panel
      className={cn("overflow-auto", className)}
      style={{
        [direction === "horizontal" ? "width" : "height"]: `${size}%`,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

export function ResizableHandle({ className, withHandle = true }: ResizableHandleProps) {
  const context = React.useContext(PanelContext);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const handleRef = React.useRef<HTMLDivElement>(null);

  if (!context) {
    throw new Error("ResizableHandle must be used within ResizablePanelGroup");
  }

  const { direction, sizes, setSizes, panelConfigs, containerRef } = context;

  // Find which handle this is by counting previous handles in DOM
  const getHandleIndex = React.useCallback(() => {
    const container = containerRef.current;
    if (!container || !handleRef.current) return 0;

    const handles = container.querySelectorAll("[data-resizable-handle]");
    let myIndex = 0;
    handles.forEach((handle, i) => {
      if (handle === handleRef.current) {
        myIndex = i;
      }
    });
    return myIndex;
  }, [containerRef]);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      // This handle is between panel[handleIndex] and panel[handleIndex + 1]
      const handleIndex = getHandleIndex();
      const leftPanelIndex = handleIndex;
      const rightPanelIndex = handleIndex + 1;

      const startPos = direction === "horizontal" ? e.clientX : e.clientY;
      const container = containerRef.current;

      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const containerSize = direction === "horizontal" ? containerRect.width : containerRect.height;
      const startSizes = [...sizes];

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentPos = direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
        const delta = ((currentPos - startPos) / containerSize) * 100;

        const newSizes = [...startSizes];

        const leftConfig = panelConfigs[leftPanelIndex] || { minSize: 10, maxSize: 80 };
        const rightConfig = panelConfigs[rightPanelIndex] || { minSize: 10, maxSize: 80 };

        let newLeftSize = startSizes[leftPanelIndex] + delta;
        let newRightSize = startSizes[rightPanelIndex] - delta;

        // Calculate total of other panels (not the two being resized)
        let otherPanelsTotal = 0;
        for (let i = 0; i < startSizes.length; i++) {
          if (i !== leftPanelIndex && i !== rightPanelIndex) {
            otherPanelsTotal += startSizes[i];
          }
        }
        const availableSpace = 100 - otherPanelsTotal;

        // Apply constraints - only for the two adjacent panels
        if (newLeftSize < leftConfig.minSize) {
          newLeftSize = leftConfig.minSize;
          newRightSize = availableSpace - newLeftSize;
        }
        if (newRightSize < rightConfig.minSize) {
          newRightSize = rightConfig.minSize;
          newLeftSize = availableSpace - newRightSize;
        }

        // Cap at max sizes
        if (newLeftSize > availableSpace - rightConfig.minSize) {
          newLeftSize = availableSpace - rightConfig.minSize;
          newRightSize = rightConfig.minSize;
        }
        if (newRightSize > availableSpace - leftConfig.minSize) {
          newRightSize = availableSpace - leftConfig.minSize;
          newLeftSize = leftConfig.minSize;
        }

        // Ensure we don't go below 0
        if (newLeftSize < 0) newLeftSize = 0;
        if (newRightSize < 0) newRightSize = 0;

        newSizes[leftPanelIndex] = newLeftSize;
        newSizes[rightPanelIndex] = newRightSize;
        setSizes(newSizes);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [direction, sizes, setSizes, panelConfigs, getHandleIndex, containerRef]
  );

  return (
    <div
      ref={handleRef}
      data-resizable-handle
      className={cn(
        "relative flex items-center justify-center transition-all duration-200 flex-shrink-0",
        direction === "horizontal"
          ? "w-3 cursor-col-resize group"
          : "h-3 cursor-row-resize group",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background line */}
      <div
        className={cn(
          "absolute transition-all duration-300",
          direction === "horizontal"
            ? "w-[2px] h-full"
            : "h-[2px] w-full",
          isDragging
            ? "bg-gradient-to-b from-primary via-primary to-primary shadow-[0_0_15px_var(--glow),0_0_30px_var(--glow)]"
            : isHovered
              ? "bg-gradient-to-b from-primary/60 via-primary to-primary/60 shadow-[0_0_10px_var(--glow)]"
              : "bg-gradient-to-b from-border via-border/50 to-border"
        )}
      />

      {/* Fancy handle grip */}
      {withHandle && (
        <div
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full transition-all duration-300",
            direction === "horizontal"
              ? "w-4 h-12"
              : "h-4 w-12",
            isDragging
              ? "bg-primary shadow-[0_0_20px_var(--glow)]"
              : isHovered
                ? "bg-primary/80 shadow-[0_0_15px_var(--glow)]"
                : "bg-muted hover:bg-primary/60"
          )}
        >
          {/* Grip dots */}
          <div
            className={cn(
              "flex gap-[2px]",
              direction === "horizontal" ? "flex-col" : "flex-row"
            )}
          >
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300 w-1 h-1",
                  isDragging || isHovered
                    ? "bg-primary-foreground"
                    : "bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expanded hit area for easier grabbing */}
      <div
        className={cn(
          "absolute",
          direction === "horizontal"
            ? "w-6 h-full -left-[6px]"
            : "h-6 w-full -top-[6px]"
        )}
      />

      {/* Glow effect on edges when dragging */}
      {isDragging && (
        <>
          <div
            className={cn(
              "absolute pointer-events-none transition-opacity duration-300",
              direction === "horizontal"
                ? "w-8 h-full bg-gradient-to-r from-primary/20 via-transparent to-transparent -left-4"
                : "h-8 w-full bg-gradient-to-b from-primary/20 via-transparent to-transparent -top-4"
            )}
          />
          <div
            className={cn(
              "absolute pointer-events-none transition-opacity duration-300",
              direction === "horizontal"
                ? "w-8 h-full bg-gradient-to-l from-primary/20 via-transparent to-transparent -right-4"
                : "h-8 w-full bg-gradient-to-t from-primary/20 via-transparent to-transparent -bottom-4"
            )}
          />
        </>
      )}
    </div>
  );
}
