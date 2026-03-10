import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const MOBILE_PANEL_CLASS =
  "relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl";

export const MOBILE_ACTION_BUTTON_CLASS =
  "menu-sweep-hover relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.08] px-4 text-sm font-semibold text-white transition-colors hover:text-black";

export const MOBILE_SECONDARY_BUTTON_CLASS =
  "menu-sweep-hover relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-[22px] border border-white/10 bg-black/20 px-4 text-sm font-semibold text-white/82 transition-colors hover:text-black";

export function MobileExperiencePage({
  accentColor,
  artworkUrl,
  children,
  className,
}: {
  accentColor?: string;
  artworkUrl?: string;
  children: ReactNode;
  className?: string;
}) {
  const glowStyle: CSSProperties | undefined = accentColor
    ? {
        backgroundColor: `hsl(${accentColor} / 0.22)`,
      }
    : undefined;

  return (
    <div className={cn("mobile-page-shell relative isolate overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.24] object-cover opacity-20 blur-3xl saturate-[1.35]"
          />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,116,96,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(79,133,255,0.16),transparent_24%),linear-gradient(180deg,rgba(6,6,7,0.6),rgba(3,3,4,0.95)_18%,rgba(1,1,2,1))]" />
        <div className="absolute -left-16 top-8 h-52 w-52 rounded-full blur-3xl" style={glowStyle} />
        <div className="absolute bottom-16 right-[-3rem] h-56 w-56 rounded-full bg-white/[0.05] blur-3xl" />
      </div>
      <div className="relative z-10 space-y-4 pb-4">{children}</div>
    </div>
  );
}

export function MobileHero({
  accentColor,
  actions,
  afterTitle,
  artworkAlt,
  artworkShape = "square",
  artworkUrl,
  description,
  eyebrow,
  footer,
  meta,
  title,
}: {
  accentColor?: string;
  actions?: ReactNode;
  afterTitle?: ReactNode;
  artworkAlt?: string;
  artworkShape?: "round" | "square";
  artworkUrl?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}) {
  const artworkClassName =
    artworkShape === "round"
      ? "h-28 w-28 rounded-full md:h-32 md:w-32"
      : "h-32 w-32 rounded-[28px] md:h-36 md:w-36";

  return (
    <section className={cn(MOBILE_PANEL_CLASS, "min-h-[19rem]")}>
      <div className="absolute inset-0 overflow-hidden">
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-38" />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: accentColor
              ? `radial-gradient(circle at 20% 18%, hsl(${accentColor} / 0.42), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.08), rgba(10,10,10,0.54) 38%, rgba(0,0,0,0.94))`
              : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(10,10,10,0.54) 38%, rgba(0,0,0,0.94))",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),transparent_26%,transparent_68%,rgba(255,255,255,0.08))]" />
      </div>

      <div className="relative z-10 grid gap-5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/52">
                {eyebrow}
              </div>
            ) : null}
            <div className="mt-3 flex items-end gap-4">
              {artworkUrl ? (
                <img
                  src={artworkUrl}
                  alt={artworkAlt || ""}
                  className={cn(
                    "shrink-0 border border-white/10 object-cover shadow-[0_18px_48px_rgba(0,0,0,0.4)]",
                    artworkClassName,
                  )}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 text-[clamp(2rem,8vw,3.4rem)] font-black leading-[0.88] tracking-[-0.08em] text-white">
                    {title}
                  </h1>
                  {afterTitle}
                </div>
                {description ? (
                  <div className="mt-3 text-sm leading-6 text-white/72">
                    {description}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
        {actions ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{actions}</div> : null}
        {footer ? <div>{footer}</div> : null}
      </div>
    </section>
  );
}

export function MobileSection({
  action,
  children,
  className,
  contentClassName,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className={cn(MOBILE_PANEL_CLASS, className)}>
      <div className="flex items-end justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/46">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="mt-1 text-[1.3rem] font-black tracking-[-0.05em] text-white">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("px-4 pb-4", contentClassName)}>{children}</div>
    </section>
  );
}

export function MobileRail({
  children,
  className,
  itemClassName,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <div className={cn("home-section-inline-row flex gap-3 overflow-x-auto pb-1 pr-1 pt-1 snap-x snap-mandatory", className)}>
      {items.map((child, index) => (
        <div key={index} className={cn("min-w-0 shrink-0 snap-start", itemClassName)}>
          {child}
        </div>
      ))}
    </div>
  );
}

export function MobileStatPill({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[20px] border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/44">{label}</div>
      <div className="mt-2 truncate text-lg font-black tracking-[-0.05em] text-white">{value}</div>
    </div>
  );
}

export function MobileMetaChip({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/72">
      <span className="text-white/46">{label}</span>
      <span className="text-white">{value}</span>
    </span>
  );
}
