export const OVERLAY_SURFACE_CLASS =
  "website-overlay-surface border border-white/12 text-white outline-none ring-0";

export const MENU_SURFACE_CLASS =
  "website-menu-surface border border-white/12 text-white outline-none ring-0";

export const MENU_ITEM_CLASS =
  "menu-sweep-hover relative flex min-h-11 cursor-default select-none items-center gap-3 rounded-[var(--surface-radius-sm)] px-4 py-3 text-[15px] font-medium leading-[1.25] tracking-[-0.02em] text-white/96 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:!text-black data-[highlighted]:[&_svg]:!text-black [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0 [&_svg]:text-white/96";

export const DESTRUCTIVE_MENU_ITEM_CLASS =
  "destructive-sweep-hover relative flex min-h-11 cursor-default select-none items-center gap-3 rounded-[var(--surface-radius-sm)] px-4 py-3 text-[15px] font-medium leading-[1.25] tracking-[-0.02em] text-rose-200/95 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:!text-white data-[highlighted]:[&_svg]:!text-white [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0 [&_svg]:text-rose-300/90";

export const MENU_LABEL_CLASS = "px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56";

export const MENU_SEPARATOR_CLASS = "mx-2 my-1 h-px bg-white/10";

export const OVERLAY_ITEM_CLASS = MENU_ITEM_CLASS;

export const OVERLAY_LABEL_CLASS = MENU_LABEL_CLASS;

export const OVERLAY_SEPARATOR_CLASS = MENU_SEPARATOR_CLASS;

export const PANEL_SURFACE_CLASS =
  "website-panel-surface border border-white/10 bg-[#121212] shadow-none";

export const DESTRUCTIVE_OUTLINE_BUTTON_CLASS =
  "destructive-sweep-hover relative inline-flex items-center justify-center rounded-[var(--settings-control-radius)] border border-rose-500/30 bg-rose-500/[0.10] text-rose-100 transition-colors hover:bg-rose-500/[0.14] hover:text-white focus-visible:text-white [&_svg]:text-rose-200";

export const DESTRUCTIVE_ICON_BUTTON_CLASS =
  "destructive-sweep-hover relative inline-flex items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/[0.10] text-rose-100 transition-colors hover:bg-rose-500/[0.14] hover:text-white focus-visible:text-white [&_svg]:text-rose-200";

export const DESTRUCTIVE_TEXT_BUTTON_CLASS =
  "destructive-sweep-hover relative inline-flex items-center justify-center rounded-full border border-rose-500/26 bg-rose-500/[0.08] px-3 text-rose-200 transition-colors hover:bg-rose-500/[0.14] hover:text-white focus-visible:text-white [&_svg]:text-rose-300/90";
