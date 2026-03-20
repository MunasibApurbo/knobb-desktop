import type { PropsWithChildren, ReactNode } from "react";

import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { cn } from "@/lib/utils";

type UtilityPagePanelProps = PropsWithChildren<{
  className?: string;
}>;

type UtilityPageLayoutProps = PropsWithChildren<{
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headerVisual?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
}>;

export function UtilityPagePanel({ children, className }: UtilityPagePanelProps) {
  return (
    <section
      className={cn(
        "page-panel overflow-hidden",
        PANEL_SURFACE_CLASS,
        className,
      )}
    >
      {children}
    </section>
  );
}

export function UtilityPageLayout({
  eyebrow,
  title,
  description,
  actions,
  headerVisual,
  children,
  className,
  headerClassName,
  contentClassName,
  titleClassName,
}: UtilityPageLayoutProps) {
  return (
    <div
      className={cn(
        "page-shell mx-auto w-full max-w-6xl space-y-4 pb-4 md:space-y-8 md:px-6 md:pt-8 md:pb-24",
        className,
      )}
    >
      <UtilityPagePanel className={cn("utility-page-header-surface px-4 py-5 sm:px-5 md:px-6 md:py-6", headerClassName)}>
        <div className="flex flex-col gap-4 md:gap-5">
          {headerVisual ? <div className="flex items-center">{headerVisual}</div> : null}

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 space-y-2 md:space-y-3">
              {eyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                  {eyebrow}
                </p>
              ) : null}
              <h1
                className={cn(
                  "text-3xl font-black tracking-tight text-foreground sm:text-4xl md:text-5xl",
                  titleClassName,
                )}
              >
                {title}
              </h1>
              {description ? (
                <div className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {description}
                </div>
              ) : null}
            </div>

            {actions ? (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      </UtilityPagePanel>

      <div className={cn("space-y-4 md:space-y-8", contentClassName)}>{children}</div>
    </div>
  );
}
