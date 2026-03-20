const warmedOrigins = new Set<string>();

function resolveWarmableOrigin(url: string) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function appendWarmupLink(rel: "dns-prefetch" | "preconnect", origin: string) {
  const selector = `link[rel="${rel}"][href="${origin}"]`;
  if (document.head.querySelector(selector)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = rel;
  link.href = origin;
  if (rel === "preconnect" && origin !== window.location.origin) {
    link.crossOrigin = "anonymous";
  }
  document.head.append(link);
}

export function warmPlaybackOrigin(url: string) {
  const origin = resolveWarmableOrigin(url);
  if (!origin || warmedOrigins.has(origin)) {
    return;
  }

  warmedOrigins.add(origin);
  appendWarmupLink("dns-prefetch", origin);
  appendWarmupLink("preconnect", origin);
}

export function __resetPlaybackWarmupForTests() {
  warmedOrigins.clear();
}
