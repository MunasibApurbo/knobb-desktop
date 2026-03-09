import { HOME_SECTION_CONFIG, isHomeSectionKey } from "@/lib/homeSections";

export type PageMetadata = {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  canonicalPath?: string;
  url?: string;
  type?: string;
  robots?: string;
  keywords?: string[];
  themeColor?: string;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
};

export const SITE_NAME = "KNOBB";
export const SITE_THEME_COLOR = "#1d0834";
export const DEFAULT_DESCRIPTION =
  "KNOBB is a modern music app for playlists, discovery, shared listening, and direct-source archives.";
export const DEFAULT_IMAGE_PATH = "/brand/knobb-share.png";
export const DEFAULT_IMAGE_ALT =
  "KNOBB share card with a silver K mark and layered KNOBB wordmark in silver, yellow, and purple on black.";
export const DEFAULT_KEYWORDS = [
  "KNOBB",
  "music app",
  "music discovery",
  "playlists",
  "shared playlists",
  "listening history",
  "music streaming",
];

const PRIVATE_ROUTE_PREFIXES = [
  "/admin",
  "/auth",
  "/favorite-artists",
  "/history",
  "/liked",
  "/my-playlist",
  "/notifications",
  "/profile",
  "/settings",
  "/stats",
];

function getConfiguredSiteOrigin() {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  if (!configured) return "";

  try {
    return new URL(configured).origin;
  } catch {
    return "";
  }
}

export function getSiteOrigin() {
  const configuredOrigin = getConfiguredSiteOrigin();
  if (configuredOrigin) return configuredOrigin;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function toAbsoluteMetadataUrl(value?: string | null) {
  if (!value) return "";
  if (/^(data:|blob:)/i.test(value)) return value;

  try {
    return new URL(value).toString();
  } catch {
    const origin = getSiteOrigin();
    return origin ? new URL(value, origin).toString() : value;
  }
}

export function buildCanonicalPath(pathname: string, search = "") {
  const params = new URLSearchParams(search);
  params.delete("embed");

  const nextSearch = params.toString();
  return `${pathname}${nextSearch ? `?${nextSearch}` : ""}`;
}

function ensureMetaTag(
  selector: string,
  attributes: Record<string, string>,
) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);

  if (!tag) {
    tag = document.createElement("meta");
    document.head.appendChild(tag);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    tag?.setAttribute(key, value);
  });

  return tag;
}

function ensureLinkTag(
  selector: string,
  attributes: Record<string, string>,
) {
  let tag = document.head.querySelector<HTMLLinkElement>(selector);

  if (!tag) {
    tag = document.createElement("link");
    document.head.appendChild(tag);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    tag?.setAttribute(key, value);
  });

  return tag;
}

function clearManagedStructuredData() {
  document.head
    .querySelectorAll('script[data-meta-managed="structured-data"]')
    .forEach((node) => node.remove());
}

export function normalizeTitle(value?: string) {
  if (!value) return SITE_NAME;
  if (value === SITE_NAME || value.endsWith(`• ${SITE_NAME}`)) return value;
  return `${value} • ${SITE_NAME}`;
}

function buildDefaultStructuredData(url: string) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url,
      description: DEFAULT_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "MusicApplication",
      operatingSystem: "Web",
      url,
      description: DEFAULT_DESCRIPTION,
    },
  ];
}

export function applyMetadata(metadata: PageMetadata) {
  if (typeof document === "undefined") return;

  const title = normalizeTitle(metadata.title);
  const description = metadata.description?.trim() || DEFAULT_DESCRIPTION;
  const image = toAbsoluteMetadataUrl(metadata.image || DEFAULT_IMAGE_PATH);
  const imageAlt = metadata.imageAlt?.trim() || DEFAULT_IMAGE_ALT;
  const canonicalPath =
    metadata.canonicalPath || buildCanonicalPath(window.location.pathname, window.location.search);
  const url = toAbsoluteMetadataUrl(metadata.url || canonicalPath);
  const robots = metadata.robots || "index, follow";
  const keywords = (metadata.keywords || DEFAULT_KEYWORDS).join(", ");
  const themeColor = metadata.themeColor || SITE_THEME_COLOR;
  const type = metadata.type || "website";
  const structuredData =
    metadata.structuredData ||
    buildDefaultStructuredData(toAbsoluteMetadataUrl("/"));

  document.title = title;
  document.documentElement.lang = "en";

  ensureMetaTag('meta[name="description"]', {
    name: "description",
    content: description,
  });
  ensureMetaTag('meta[name="keywords"]', {
    name: "keywords",
    content: keywords,
  });
  ensureMetaTag('meta[name="application-name"]', {
    name: "application-name",
    content: SITE_NAME,
  });
  ensureMetaTag('meta[name="author"]', {
    name: "author",
    content: SITE_NAME,
  });
  ensureMetaTag('meta[name="theme-color"]', {
    name: "theme-color",
    content: themeColor,
  });
  ensureMetaTag('meta[name="color-scheme"]', {
    name: "color-scheme",
    content: "dark",
  });
  ensureMetaTag('meta[name="format-detection"]', {
    name: "format-detection",
    content: "telephone=no",
  });
  ensureMetaTag('meta[name="robots"]', {
    name: "robots",
    content: robots,
  });
  ensureMetaTag('meta[name="referrer"]', {
    name: "referrer",
    content: "strict-origin-when-cross-origin",
  });
  ensureMetaTag('meta[name="apple-mobile-web-app-capable"]', {
    name: "apple-mobile-web-app-capable",
    content: "yes",
  });
  ensureMetaTag('meta[name="apple-mobile-web-app-status-bar-style"]', {
    name: "apple-mobile-web-app-status-bar-style",
    content: "black-translucent",
  });
  ensureMetaTag('meta[name="apple-mobile-web-app-title"]', {
    name: "apple-mobile-web-app-title",
    content: SITE_NAME,
  });
  ensureMetaTag('meta[name="mobile-web-app-capable"]', {
    name: "mobile-web-app-capable",
    content: "yes",
  });
  ensureMetaTag('meta[name="msapplication-TileColor"]', {
    name: "msapplication-TileColor",
    content: themeColor,
  });

  ensureMetaTag('meta[property="og:site_name"]', {
    property: "og:site_name",
    content: SITE_NAME,
  });
  ensureMetaTag('meta[property="og:locale"]', {
    property: "og:locale",
    content: "en_US",
  });
  ensureMetaTag('meta[property="og:title"]', {
    property: "og:title",
    content: title,
  });
  ensureMetaTag('meta[property="og:description"]', {
    property: "og:description",
    content: description,
  });
  ensureMetaTag('meta[property="og:type"]', {
    property: "og:type",
    content: type,
  });
  ensureMetaTag('meta[property="og:url"]', {
    property: "og:url",
    content: url,
  });
  ensureMetaTag('meta[property="og:image"]', {
    property: "og:image",
    content: image,
  });
  ensureMetaTag('meta[property="og:image:alt"]', {
    property: "og:image:alt",
    content: imageAlt,
  });
  ensureMetaTag('meta[property="og:image:width"]', {
    property: "og:image:width",
    content: "1200",
  });
  ensureMetaTag('meta[property="og:image:height"]', {
    property: "og:image:height",
    content: "630",
  });
  ensureMetaTag('meta[property="og:image:type"]', {
    property: "og:image:type",
    content: "image/png",
  });

  ensureMetaTag('meta[name="twitter:card"]', {
    name: "twitter:card",
    content: "summary_large_image",
  });
  ensureMetaTag('meta[name="twitter:title"]', {
    name: "twitter:title",
    content: title,
  });
  ensureMetaTag('meta[name="twitter:description"]', {
    name: "twitter:description",
    content: description,
  });
  ensureMetaTag('meta[name="twitter:image"]', {
    name: "twitter:image",
    content: image,
  });
  ensureMetaTag('meta[name="twitter:image:alt"]', {
    name: "twitter:image:alt",
    content: imageAlt,
  });

  ensureLinkTag('link[rel="canonical"]', {
    rel: "canonical",
    href: url,
  });

  clearManagedStructuredData();
  const entries = Array.isArray(structuredData) ? structuredData : [structuredData];

  entries.forEach((entry) => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.metaManaged = "structured-data";
    script.text = JSON.stringify(entry);
    document.head.appendChild(script);
  });
}

export function getRouteMetadata(pathname: string, search: string): PageMetadata {
  const canonicalPath = buildCanonicalPath(pathname, search);
  const isEmbedMode = new URLSearchParams(search).get("embed");
  const embedActive = isEmbedMode === "1" || isEmbedMode === "true";

  if (pathname === "/") {
    return {
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      canonicalPath: "/",
    };
  }

  if (pathname === "/browse") {
    return {
      title: "Browse",
      description: "Browse playlists, artists, albums, and new releases on KNOBB.",
      canonicalPath,
    };
  }

  if (pathname === "/genre") {
    return {
      title: "Genres",
      description: "Explore genres and category-driven listening paths on KNOBB.",
      canonicalPath,
    };
  }

  if (pathname === "/search") {
    return {
      title: "Search",
      description: "Search for tracks, artists, albums, and playlists on KNOBB.",
      canonicalPath,
      robots: "noindex, nofollow",
    };
  }

  if (pathname === "/unreleased") {
    return {
      title: "Unreleased Archive",
      description: "Browse KNOBB's unreleased archive with artist and project pages sourced from ArtistGrid.",
      canonicalPath,
    };
  }

  if (pathname.startsWith("/home-section/")) {
    const section = pathname.split("/").pop() || "";
    const routeTitle = isHomeSectionKey(section)
      ? HOME_SECTION_CONFIG[section].title
      : "Home Section";

    return {
      title: routeTitle,
      description: `Explore the ${routeTitle.toLowerCase()} shelf on KNOBB.`,
      canonicalPath: pathname,
      robots: "noindex, nofollow",
    };
  }

  if (pathname.startsWith("/album/")) {
    return {
      title: "Album",
      description: "Open album details, tracklists, and playback on KNOBB.",
      canonicalPath: pathname,
      type: "music.album",
    };
  }

  if (pathname.startsWith("/playlist/")) {
    return {
      title: embedActive ? "Embedded Playlist" : "Playlist",
      description: "Open a playlist and play it on KNOBB.",
      canonicalPath: pathname,
      robots: embedActive ? "noindex, nofollow" : "index, follow",
      type: "music.playlist",
    };
  }

  if (pathname.startsWith("/shared-playlist/")) {
    return {
      title: embedActive ? "Embedded Shared Playlist" : "Shared Playlist",
      description: "Open a shared playlist on KNOBB.",
      canonicalPath: pathname,
      robots: embedActive ? "noindex, nofollow" : "index, follow",
      type: "music.playlist",
    };
  }

  if (pathname.startsWith("/artist/") && pathname.endsWith("/mix")) {
    return {
      title: "Artist Mix",
      description: "Listen to a curated artist mix or radio session on KNOBB.",
      canonicalPath: pathname,
      type: "music.playlist",
    };
  }

  if (pathname.startsWith("/artist/")) {
    return {
      title: "Artist",
      description: "Open artist profiles, top tracks, albums, and related acts on KNOBB.",
      canonicalPath: pathname,
      type: "profile",
    };
  }

  if (pathname.startsWith("/mix/")) {
    return {
      title: "Mix",
      description: "Play a mix built from a track, mood, or listening path on KNOBB.",
      canonicalPath: pathname,
      type: "music.playlist",
    };
  }

  if (pathname.startsWith("/unreleased/")) {
    return {
      title: "Unreleased",
      description: "Browse unreleased artist and project archives on KNOBB.",
      canonicalPath: pathname,
    };
  }

  if (pathname === "/legal/privacy") {
    return {
      title: "Privacy Policy",
      description: "Read the KNOBB privacy policy.",
      canonicalPath,
    };
  }

  if (pathname === "/legal/terms") {
    return {
      title: "Terms of Service",
      description: "Read the KNOBB terms of service.",
      canonicalPath,
    };
  }

  if (pathname === "/legal/cookies") {
    return {
      title: "Cookie Policy",
      description: "Read the KNOBB cookie policy.",
      canonicalPath,
    };
  }

  if (PRIVATE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const routeLabel = pathname.split("/").filter(Boolean).at(-1)?.replace(/-/g, " ") || "Private";

    return {
      title: routeLabel.replace(/\b\w/g, (value) => value.toUpperCase()),
      description: "Private KNOBB account page.",
      canonicalPath: pathname,
      robots: "noindex, nofollow",
    };
  }

  return {
    title: "Page Not Found",
    description: "The page you requested could not be found on KNOBB.",
    canonicalPath: pathname,
    robots: "noindex, nofollow",
  };
}
