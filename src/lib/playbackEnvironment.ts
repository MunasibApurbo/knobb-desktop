const LOCAL_DEVELOPMENT_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function isPublishedHostname(hostname: string | null | undefined) {
  const normalizedHostname = String(hostname || "").trim().toLowerCase();
  return normalizedHostname.length > 0 && !LOCAL_DEVELOPMENT_HOSTNAMES.has(normalizedHostname);
}

export function getRuntimeHostname() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.hostname;
}

export function isPublishedRuntimeHost() {
  return isPublishedHostname(getRuntimeHostname());
}
