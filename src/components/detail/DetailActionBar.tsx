import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const DETAIL_ACTION_BUTTON_CLASS =
  "detail-action-button hero-action-btn menu-sweep-hover group rounded-none h-14 justify-start px-4 md:px-5 font-semibold text-sm md:text-base bg-transparent border-0 " +
  "relative overflow-hidden transition-colors hover:text-black " +
  "[&>*]:relative [&>*]:z-10";

export const DETAIL_DESTRUCTIVE_ACTION_BUTTON_CLASS =
  "detail-action-button hero-action-btn destructive-sweep-hover group rounded-none h-14 justify-start px-4 md:px-5 font-semibold text-sm md:text-base border-0 bg-rose-500/[0.10] " +
  "relative overflow-hidden text-rose-200 hover:text-white focus-visible:text-white [&_svg]:text-rose-300 [&>*]:relative [&>*]:z-10";

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
        "detail-action-bar overflow-hidden rounded-[1.35rem] grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:[grid-template-columns:repeat(var(--detail-action-columns),minmax(0,1fr))]",
        className,
      )}
      style={{ "--detail-action-columns": columns } as CSSProperties}
    >
      {children}
    </section>
  );
}
