import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const DETAIL_ACTION_BUTTON_CLASS =
  "detail-action-button hero-action-btn group rounded-none h-14 justify-start px-4 md:px-5 font-semibold text-sm md:text-base bg-transparent border-0 " +
  "relative overflow-hidden transition-colors hover:text-[hsl(var(--dynamic-accent-foreground))] " +
  "before:content-[''] before:absolute before:inset-0 before:origin-left before:scale-x-0 " +
  "before:transition-transform before:duration-300 before:ease-out before:bg-[hsl(var(--player-waveform)/0.95)] " +
  "hover:before:scale-x-100 [&>*]:relative [&>*]:z-10";

interface DetailActionBarProps {
  children: ReactNode;
  className?: string;
  columns?: number;
}

export function DetailActionBar({
  children,
  className,
  columns = 4,
}: DetailActionBarProps) {
  return (
    <section
      className={cn(
        "detail-action-bar grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:[grid-template-columns:repeat(var(--detail-action-columns),minmax(0,1fr))]",
        className,
      )}
      style={{ "--detail-action-columns": columns } as CSSProperties}
    >
      {children}
    </section>
  );
}
