export function hasPasswordRecoveryCallback(search: string, hash: string) {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  return searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
}

export function hasCurrentPasswordRecoveryCallback() {
  if (typeof window === "undefined") return false;
  return hasPasswordRecoveryCallback(window.location.search, window.location.hash);
}
