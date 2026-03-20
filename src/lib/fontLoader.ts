const GOOGLE_FONTS_PRECONNECT_ID = "knobb-google-fonts-preconnect";
const GOOGLE_FONTS_GSTATIC_ID = "knobb-google-fonts-gstatic";
const GOOGLE_FONT_STYLESHEET_ID = "knobb-google-fonts";

const FONT_FAMILY_TO_QUERY: Record<string, string> = {
  Outfit: "family=Outfit:wght@400;500;600;700;800",
  Inter: "family=Inter:wght@400;500;600;700;800",
  Poppins: "family=Poppins:wght@400;500;600;700;800",
  Nunito: "family=Nunito:wght@400;500;600;700;800",
  "Space Grotesk": "family=Space+Grotesk:wght@400;500;600;700",
  Roboto: "family=Roboto:wght@400;500;700",
  "JetBrains Mono": "family=JetBrains+Mono:wght@400;500;700",
};

function getGoogleFontHref(font: string) {
  const query = FONT_FAMILY_TO_QUERY[font];
  if (!query) return null;
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

function ensureHeadLink(id: string, rel: string, href: string, crossOrigin?: "anonymous") {
  if (typeof document === "undefined" || document.getElementById(id)) {
    return;
  }

  const link = document.createElement("link");
  link.id = id;
  link.rel = rel;
  link.href = href;
  if (crossOrigin) {
    link.crossOrigin = crossOrigin;
  }
  document.head.appendChild(link);
}

export function ensureGoogleFontLoaded(font: string) {
  if (typeof document === "undefined") return;

  const href = getGoogleFontHref(font);
  if (!href) return;

  ensureHeadLink(GOOGLE_FONTS_PRECONNECT_ID, "preconnect", "https://fonts.googleapis.com");
  ensureHeadLink(GOOGLE_FONTS_GSTATIC_ID, "preconnect", "https://fonts.gstatic.com", "anonymous");

  const existing = document.getElementById(GOOGLE_FONT_STYLESHEET_ID) as HTMLLinkElement | null;
  if (existing?.href === href) return;

  if (existing) {
    existing.href = href;
    return;
  }

  const link = document.createElement("link");
  link.id = GOOGLE_FONT_STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
