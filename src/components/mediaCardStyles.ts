import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";

export const MEDIA_CARD_SHELL_CLASS =
  `media-card-shell content-visibility-card hover-desaturate-card relative group cursor-pointer border-r border-b ${PANEL_SURFACE_CLASS.replace("border ", "")} ` +
  "transition-[background-color] duration-300 hover:bg-white/[0.03] hover:z-10 flex flex-col transform-gpu will-change-transform";

export const MEDIA_CARD_ARTWORK_CLASS =
  "media-card-artwork pointer-events-none select-none w-full h-full object-cover object-center";

export const MEDIA_CARD_BODY_CLASS =
  "media-card-body min-w-0 flex-1 flex flex-col justify-start text-left";

export const MEDIA_CARD_PLAY_BUTTON_CLASS =
  "media-card-hover-control media-card-hover-control-left absolute flex items-center justify-center shadow-xl rounded-full bg-black/50 " +
  "backdrop-blur-sm z-10";

export const MEDIA_CARD_FAVORITE_BUTTON_CLASS =
  "media-card-hover-control media-card-hover-control-right absolute flex items-center justify-center shadow-xl rounded-full bg-black/50 " +
  "backdrop-blur-sm z-10";

export const MEDIA_CARD_TITLE_CLASS =
  "media-card-title text-foreground";

export const MEDIA_CARD_META_CLASS =
  "media-card-meta text-muted-foreground/80";

export const MEDIA_CARD_ACTION_ICON_CLASS =
  "media-card-action-icon text-white";
