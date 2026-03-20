export const DEFAULT_PUBLIC_SITE_ORIGIN = "https://knobb.netlify.app";

export function shouldHandleDesktopRequestLocally(pathname) {
  const normalizedPath = String(pathname || "").trim();
  return (
    normalizedPath === "/api/youtube-music" ||
    normalizedPath === "/.netlify/functions/youtube-music-proxy"
  );
}

export function shouldProxyDesktopRequestPath(pathname) {
  const normalizedPath = String(pathname || "").trim();
  return (
    normalizedPath === "/api" ||
    normalizedPath.startsWith("/api/") ||
    normalizedPath === "/.netlify/functions" ||
    normalizedPath.startsWith("/.netlify/functions/")
  );
}

export function normalizeDesktopOrigin(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const parsed = new URL(normalizedValue);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

export function getDesktopBackendOrigin({
  envSiteUrl,
  configuredSiteUrl,
  defaultOrigin = DEFAULT_PUBLIC_SITE_ORIGIN,
} = {}) {
  return normalizeDesktopOrigin(envSiteUrl)
    || normalizeDesktopOrigin(configuredSiteUrl)
    || normalizeDesktopOrigin(defaultOrigin);
}

export function buildDesktopProxyTargetUrl(requestUrl, backendOrigin) {
  const origin = normalizeDesktopOrigin(backendOrigin);
  if (!origin) {
    return null;
  }

  const resolvedRequestUrl = requestUrl instanceof URL
    ? requestUrl
    : new URL(String(requestUrl || "/"), "http://127.0.0.1");

  return new URL(
    `${resolvedRequestUrl.pathname}${resolvedRequestUrl.search}`,
    origin,
  ).toString();
}
